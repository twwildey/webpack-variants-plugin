import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

import {
    VARIANTS_URI_DELIMITER,
    DEFAULT_VARIANT_PRIORITY,
    DEFAULT_VARIANT_CLOSURE_FILE_NAME
} from './constants.js';

import {
    isEmptyObj,
    firstIndexOfPrefix,
    lastIndexOfPrefix,
    iterateEntryImports
} from './utils.js';

import {
    buildVariantSet,
    buildVaraintsPriority
} from './MatchSet.js';

import ModuleVariantClosure from './ModuleVariantClosure.js';

export function stripExtension(str) {
    return str.substring(0, str.length - path.extname(str).length);
}

export default class VariantBuilderPlugin {
    constructor(options) {
        this.intiailizeOptions(options);

        this.firstRun = true;
        this.roots = {};
        this.encountered = {};
        this.collected = {};
        this.missing = {};
        this.varied = {};
    }

    intiailizeOptions(options = {}) {
        if (!options.priority) {
            options.priority = DEFAULT_VARIANT_PRIORITY;
        }

        if (!options.manifestPath) {
            options.manifestPath = DEFAULT_VARIANT_CLOSURE_FILE_NAME;
        }

        this.options = options;
    }

    resolverResultJSHookFactory(compiler) {
        const { fileSystem } = compiler.inputFileSystem;
        const {
            encountered,
            collected,
            missing,
            varied
        } = this;

        return (request) => {
            try {
                const unresolvedPath = request.path;

                if (encountered[unresolvedPath]) {
                    return;
                }

                const fullPath = fileSystem.realpathSync(unresolvedPath);

                if (encountered[fullPath]) {
                    encountered[unresolvedPath] = true;
                    return;
                }

                encountered[unresolvedPath] = encountered[fullPath] = true;

                const dirName = path.dirname(fullPath);
                const files = fileSystem.readdirSync(dirName);
                var filesLen = files.length - 1;
                if (filesLen >= 0) {
                    const extension = path.extname(fullPath);
                    const fileName = path.basename(fullPath, extension);
                    const fileNameLen = fileName.length;

                    const variantRegexStr = "^" + fileName + "(\\.[\\w\\=\\:]+)+" + (extension ? ("\\" + extension) : "\\.[a-zA-Z0-9]+") + "$";
                    const variantRegex = new RegExp(variantRegexStr, 'g');

                    let firstIdx = firstIndexOfPrefix(files, fileName, 0, filesLen);
                    if (firstIdx < 0) {
                        return;
                    }

                    const lastIdx = lastIndexOfPrefix(files, fileName, firstIdx, filesLen);

                    const variants = [];
                    while (firstIdx <= lastIdx) {
                        const file = files[firstIdx++];

                        if (file.match(variantRegex)) {
                            const variantsURI = file.substring(fileNameLen + 1, file.length - path.extname(file).length);
                            const variantSet = buildVariantSet(variantsURI);

                            if (!isEmptyObj(variantSet)) {
                                const variantFullPath = path.join(dirName, file);
                                const collectedVariant = {
                                    fullPath: variantFullPath,
                                    variantSet: variantSet,
                                    variantSetLength: Object.keys(variantSet).length,
                                    children: []
                                };

                                missing[variantFullPath] = variantFullPath;
                                collected[variantFullPath] = collectedVariant;
                                variants.push(collectedVariant);
                            }
                        }
                    }

                    variants.sort(function(a, b) {
                        return b.variantSetLength - a.variantSetLength;
                    });

                    if (!collected[fullPath]) {
                        collected[fullPath] = {
                            fullPath: fullPath,
                            variants: variants,
                            children: []
                        };
                    }

                    if (variants.length > 0) {
                        varied[fullPath] = collected[fullPath];
                    }
                }
            } catch (error) {
                console.error('Error caught in VariantBuilderPlugin::resolverResultJSHookFactory');
                console.error(error);
                throw error;
            }
        };
    }

    compilationSucceedModuleHookFactory() {
        const { collected } = this;

        return (module) => {
            try {
                const { fileDependencies } = module;
                if (!!fileDependencies && fileDependencies.length > 1) {
                    const { resource } = module;
                    const { children } = collected[resource];

                    fileDependencies.forEach(function(fileDependency) {
                        if (fileDependency !== resource) {
                            const collectedDep = collected[fileDependency];
                            !!collectedDep && children.push(collectedDep);
                        }
                    });
                }
            } catch (error) {
                console.error('Error caught in VariantBuilderPlugin::compilationSucceedModuleHookFactory');
                console.error(error);
                throw error;
            }
        };
    }

    compilationDoneHookFactory(compiler) {
        const {
            roots,
            collected,
            varied
        } = this;

        return (stats) => {
            try {
                const statsJson = stats.toJson({
                    hash: false,
                    version: false,
                    timings: false,
                    assets: true,
                    chunks: true,
                    chunkModules: false,
                    modules: true,
                    cached: false,
                    reasons: false,
                    source: false,
                    errorDetails: true,
                    chunkOrigins: false
                });

                const { fileSystem } = compiler.inputFileSystem;
                const { entry } = compiler.options;
                const {
                    assets,
                    chunks,
                    modules
                } = statsJson;

                // TODO - refactor this code so chunks with the same name don't collide
                const chunkTable = {};
                chunks.forEach(function(chunk) {
                    chunkTable[chunk.id] = [];
                });

                if (this.firstRun) {
                    const { roots } = this;
                    for (let name in entry) {
                        iterateEntryImports(entry[name], function(entryImportPath) {
                            const rootModuleFullPath = fileSystem.realpathSync(entryImportPath);
                            roots[rootModuleFullPath] = name;
                        });
                    }

                    delete this.firstRun;
                }

                assets.forEach(function(asset) {
                    const assetKey = stripExtension(asset.name);
                    const entryImports = entry[assetKey];
                    if (entryImports && asset.size > 0) {
                        asset.chunks.forEach(function(chunkId) {
                            iterateEntryImports(entryImports, function(entryImportPath) {
                                chunkTable[chunkId].push(entryImportPath);
                            });
                        });
                    }
                });

                modules.forEach(function(module) {
                    const moduleId = module.identifier;
                    const fullPath = module.fullPath = moduleId.substr(moduleId.lastIndexOf('|') + 1);

                    const variedModule = varied[fullPath];
                    if (variedModule) {
                        module.chunks.forEach(function(chunkId) {
                            chunkTable[chunkId].forEach(function(rootModulePath) {
                                const rootModuleFullPath = fileSystem.realpathSync(rootModulePath);
                                collected[rootModuleFullPath].children.push(variedModule);
                            });
                        });
                    }
                });

                this.hasErrors = stats.hasErrors();
            } catch (error) {
                console.error('Error caught in VariantBuilderPlugin::compilationDoneHookFactory');
                console.error(error);
                throw error;
            }
        };
    }

    // Copied from `createCompiler` in `webpack-cli/lib/webpack-cli.js`
    runWebpack(options) {
        try {
          webpack(options, (error, stats) => {
            if (error) {
              if (this.isValidationError(error)) {
                console.error(error.message);
              } else {
                console.error(error);
              }

              process.exit(2);
            }

            if (stats.hasErrors()) {
              process.exit(1);
            }

            console.log(stats.toString(options.stats));
          });
        } catch (error) {
          if (this.isValidationError(error)) {
            console.error(error.message);
          } else {
            console.error(error);
          }

          process.exit(2);
        }
    }

    // Copied from `isValidationError` in `webpack-cli/lib/webpack-cli.js`
    isValidationError(error) {
      // https://github.com/webpack/webpack/blob/master/lib/index.js#L267
      // https://github.com/webpack/webpack/blob/v4.44.2/lib/webpack.js#L90
      const ValidationError = webpack.ValidationError || webpack.WebpackOptionsValidationError;

      return (error instanceof ValidationError) || error.name === "ValidationError";
    }

    buildModuleVariantClosure(moduleNode, parentVariantClosure) {
        const variantClosure = new ModuleVariantClosure(moduleNode, parentVariantClosure);

        if (variantClosure.invalid) {
            return null;
        }

        const { variants, children } = moduleNode;
        if (Array.isArray(variants) && (variants.length > 0)) {
            variants.forEach((variantNode) => {
                this.buildModuleVariantClosure(variantNode, variantClosure);
            });
        }

        if (Array.isArray(children) && (children.length > 0)) {
            children.forEach((childNode) => {
                this.buildModuleVariantClosure(childNode, variantClosure);
            });
        }

        return variantClosure;
    }

    convertClosureToURI(closure) {
        closure.forEach(function(resolved, idx) {
            const variants = [];

            const { __variantSet__ } = resolved;
            for (let key in __variantSet__) {
                const URI = key + '=' + __variantSet__[key];
                variants.push(URI);
            }

            closure[idx] = variants;
        });

        return closure;
    }

    writeVariantsManifest(compiler, variantsMap) {
        let { manifestPath } = this.options;

        if (path.basename(manifestPath) === manifestPath) {
            const { output } = compiler.options;
            manifestPath = path.join(output.path, manifestPath);
        }

        fs.writeFileSync(manifestPath, JSON.stringify(variantsMap, null, 4));
    }

    finalizeVariants(compiler) {
        try {
            const variantsPriority = buildVaraintsPriority(this.options.priority);
            const { collected, roots } = this;

            const entryVariants = {};
            for (var rootModuleFullPath in roots) {
                var rootModuleVariantClosure = this.buildModuleVariantClosure(collected[rootModuleFullPath], null);
                if (rootModuleVariantClosure) {
                    rootModuleVariantClosure.merge(variantsPriority);
                }

                entryVariants[roots[rootModuleFullPath]] = this.convertClosureToURI(rootModuleVariantClosure.closureResolved);
            }

            this.writeVariantsManifest(compiler, entryVariants);
        } catch(error) {
            console.error('Error caught in VariantBuilderPlugin::finalizeVariants');
            console.error(error);
            throw error;
        }
    }

    removePrefixFromWebpackEntry(webpackEntry, prefixToRemove) {
        const newWebpackEntry = {};
        const prefixToRemoveRegex = new RegExp(`^${prefixToRemove}`);

        for (let webpackEntryKey in webpackEntry) {
            const newWebpackEntryKey = webpackEntryKey.replace(prefixToRemoveRegex, '.');
            newWebpackEntry[newWebpackEntryKey] = webpackEntry[webpackEntryKey];
        }

        return newWebpackEntry;
    }

    compilerShutdownHookFactory(compiler) {
        return () => {
            if (!isEmptyObj(this.missing)) {
                process.nextTick(() => {
                    const { context } = compiler.options;
                    console.error('Variants found and are being evaluated in an additional compilation:');

                    const missing = this.removePrefixFromWebpackEntry(this.missing, context);
                    Object.keys(missing).forEach(function(pathToBeCompiled) {
                        console.error(`\t${pathToBeCompiled}`);
                    });

                    compiler.options.entry = missing;
                    this.missing = {};

                    this.runWebpack(compiler.options);
                });
            } else {
                this.finalizeVariants(compiler);
            }
        };
    }

    apply(compiler) {
        // Resolves require-based assets (JS/JSX/CoffeeScript assets)
        compiler.hooks.afterResolvers.tap('VariantBuilderJSResolver', (compiler) => {
            compiler.resolverFactory.hooks.resolver.for('normal').tap('VariantBuilderJSResolverResolver', (resolver) => {
                // TODO - this doesn't get invoked anymore?
                // Remove hashtags
                resolver.hooks.resolve.tap('VariantBuilderCleanPathResult', (request) => {
                    request.path = request.path.replace(VARIANTS_URI_DELIMITER, '');
                });

                resolver.hooks.result.tap('VariantBuilderJSResolverResolverResult', this.resolverResultJSHookFactory(compiler));
            });
        });

        // TODO - validate this works still
        // Resolves CSS/SASS/LESS assets
        compiler.hooks.compilation.tap('VariantBuilderStylesResolver', (compilation) => {
            compilation.hooks.succeedModule.tap('VariantBuilderStylesResolverSucceedModule', this.compilationSucceedModuleHookFactory());
        });

        // Capture compilation stats
        compiler.hooks.done.tap('VariantBuilderRetrieveVariants', this.compilationDoneHookFactory(compiler));

        // Re-compile if missing variants are found
        compiler.hooks.shutdown.tap('VariantBuilderMissingVariants', this.compilerShutdownHookFactory(compiler));
    }
}

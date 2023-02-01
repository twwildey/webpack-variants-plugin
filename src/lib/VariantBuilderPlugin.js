import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

import {
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
    buildVariantRegexForFilename,
    buildVariantSet,
    buildVaraintsPriority,
    reduceVariantSetByPriority
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
        this.variantsPriority = buildVaraintsPriority(options.priority);
    }

    shouldIncludeVariant(variantSet, variantsPriority) {
        return isEmptyObj(reduceVariantSetByPriority(variantSet, variantsPriority));
    }

    resolverResultJSHookFactory(compiler) {
        const { fileSystem } = compiler.inputFileSystem;
        const {
            encountered,
            collected,
            missing,
            varied,
            variantsPriority
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
                    const { extension, fileName, fileNameLen, variantRegex } = buildVariantRegexForFilename(fullPath);

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

                                if (this.shouldIncludeVariant(variantSet, variantsPriority)) {
                                    missing[variantFullPath] = variantFullPath;
                                    collected[variantFullPath] = collectedVariant;
                                    variants.push(collectedVariant);
                                }
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

    resolveChunks(chunkNames, chunkIdHints) {
        if (Array.isArray(chunkNames) && (chunkNames.length > 0)) {
            return chunkNames;
        }

        return chunkIdHints;
    }

    addAssetsToChunkTable(chunkTable, chunkNames, chunks, entry) {
        chunkNames.forEach((chunkName, idx) => {
            const entryImports = entry[chunkName];
            if (entryImports) {
                const chunkId = chunks[idx];
                iterateEntryImports(entryImports, function(entryImportPath) {
                    chunkTable[chunkId].assets.push(entryImportPath);
                });
            }
        });
    }

    recurseChunks(chunkTable, chunkId, callback) {
        const chunk = chunkTable[chunkId];
        chunk.assets.forEach(callback);

        chunk.info.parents.forEach((parentChunkId) => {
            this.recurseChunks(chunkTable, parentChunkId, callback);
        });
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
                    chunkTable[chunk.id] = {
                        info: chunk,
                        assets: []
                    };
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

                assets.forEach((asset) => {
                    if (asset.size <= 0) {
                        return;
                    }

                    const chunkNames = this.resolveChunks(asset.chunkNames, asset.chunkIdHints);
                    this.addAssetsToChunkTable(chunkTable, chunkNames, asset.chunks, entry);

                    const auxiliaryChunkNames = this.resolveChunks(asset.auxiliaryChunkNames, asset.auxiliaryChunkIdHints);
                    this.addAssetsToChunkTable(chunkTable, auxiliaryChunkNames, asset.auxiliaryChunks, entry);
                });

                // For locating associated chunks when they are not directly available - needed for dynamic imports
                const moduleIdMap = {};

                modules.forEach((module) => {
                    const fullPath = module.nameForCondition;

                    // Non-modules do not have a valid nameForCondition
                    if (!fullPath) {
                        return;
                    }

                    moduleIdMap[module.id] = module;

                    const variedModule = varied[fullPath];
                    if (variedModule) {
                        module.chunks.forEach((chunkId) => {
                            this.recurseChunks(chunkTable, chunkId, function(rootModulePath) {
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
                    console.error(stats.toString({
                        errors: true,
                        errorDetails: true,
                    }));

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

        console.error(`\nWriting variant manifest to ${manifestPath}.\n`);

        fs.writeFileSync(manifestPath, JSON.stringify(variantsMap, null, 4));
    }

    finalizeVariants(compiler) {
        try {
            const { collected, roots, variantsPriority } = this;

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

                    console.error('\nThe following variants were found and will be evaluated in an additional compilation to identify transitive variants:');

                    const missing = this.removePrefixFromWebpackEntry(this.missing, context);
                    Object.keys(missing).forEach(function(variantPathForEvaluation) {
                        console.error(`\t${variantPathForEvaluation}`);
                    });

                    // Log newline
                    console.error('');

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
        // TODO - handle module federation resolution in webpack 5

        // Resolves require-based assets (JS/JSX/CoffeeScript assets)
        compiler.hooks.afterResolvers.tap('VariantBuilderJSResolver', (compiler) => {
            compiler.resolverFactory.hooks.resolver.for('normal').tap('VariantBuilderJSResolverResolver', (resolver) => {
                resolver.hooks.result.tap('VariantBuilderJSResolverResolverResult', this.resolverResultJSHookFactory(compiler));
            });
        });

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

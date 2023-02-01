import fs from 'fs';
import path from 'path';

import {
    VARIANTS_URI_DELIMITER,
    VARIANTS_URI_PART_PREFIX,
    DEFAULT_VARIANT_PRIORITY,
    DEFAULT_VARIANT_CLOSURE_FILE_NAME
} from './constants.js';

import {
    isEmptyObj,
    mergeObj,
    firstIndexOfPrefix,
    lastIndexOfPrefix,
    iterateEntryImports
} from './utils.js';

import {
    buildVariantRegexForFilename,
    buildVariantSet,
    buildVaraintsPriority,
    prioritizeVariantSet,
    reduceVariantSet,
    extractQueryFromURI,
    extractWebpackVariantsFromQuery,
    extractRawVariantsFromWebpackVariants,
    serializeVariantSetToURI
} from './MatchSet.js';

export function getEntryVariant(entryName, entryVariant) {
    return entryName + '.' + entryVariant.join('.');
}

export function getVariantsURIQueryDelimiter(filenamePath) {
    return (filenamePath.indexOf(VARIANTS_URI_DELIMITER) >= 0) ? '&' : VARIANTS_URI_DELIMITER;
}

export function loadWebpackVariantsManifest(manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath));
}

export function mergeWebpackEntryVariants(webpackEntry, webpackEntryVariants) {
    Object.keys(webpackEntry).forEach(function(key) {
        const webpackEntryPath = webpackEntry[key];
        const entryVariants = webpackEntryVariants[key];
        if (!!entryVariants) {
            entryVariants.forEach(function(entryVariant) {
                if (entryVariant.length > 0) {
                    const variantKey = getEntryVariant(key, entryVariant);
                    const webpackEntryVariantImport = [];

                    iterateEntryImports(webpackEntryPath, function(entryPath) {
                        const queryVariant = entryVariant.map((variantPart) => VARIANTS_URI_PART_PREFIX + variantPart);
                        webpackEntryVariantImport.push(entryPath + getVariantsURIQueryDelimiter(entryPath) + queryVariant.join('&'));
                    });

                    // TODO - handle updating `dependsOn` for webpackEntry[variantKey]
                    webpackEntry[variantKey] = mergeObj({}, webpackEntryPath);
                    webpackEntry[variantKey].import = webpackEntryVariantImport
                }
            });
        }
    });

    console.error('\nUpdated entry configuration for webpack after applying variants:');
    console.error(webpackEntry);
    console.error('');

    return webpackEntry;
}

export default class VariantResolverPlugin {
    constructor(options) {
        this.intiailizeOptions(options);

        // const webpackVariantsPriority = options.priority.map((variantKey) => VARIANTS_URI_PART_PREFIX + variantKey);
        this.variantsPriority = buildVaraintsPriority(options.priority);
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

    afterEnvironmentHookFactory(compiler) {
        return () => {
            let { manifestPath } = this.options;

            if (path.basename(manifestPath) === manifestPath) {
                manifestPath = path.join(compiler.options.output.path, manifestPath);
            }

            this.webpackVariantEntryManifest = loadWebpackVariantsManifest(manifestPath);
        };
    }

    entryOptionHookFactory(compiler) {
        const { options } = compiler;

        return () => {
            mergeWebpackEntryVariants(options.entry, this.webpackVariantEntryManifest);
        };
    }

    resolveWebpackFileVariant(fileSystem, variantsPriority, webpackVariantSet, resource) {
        if (!webpackVariantSet || isEmptyObj(webpackVariantSet)) {
            return {
                resource,
                webpackVariantSet: undefined
            };
        }

        const resourceWithoutQueryIdx = resource.lastIndexOf(VARIANTS_URI_DELIMITER);
        const resourceWithoutQuery = (resourceWithoutQueryIdx >= 0) ? resource.substring(0, resourceWithoutQueryIdx) : resource;
        const resourceDirName = path.dirname(resourceWithoutQuery);
        const files = fileSystem.readdirSync(fileSystem.realpathSync(resourceDirName));
        const filesLen = files.length - 1;
        if (filesLen >= 0) {
            const { extension, fileName, fileNameLen, variantRegex } = buildVariantRegexForFilename(resourceWithoutQuery);

            let firstIdx = firstIndexOfPrefix(files, fileName, 0, filesLen);
            if (firstIdx < 0) {
                return {
                    resource,
                    webpackVariantSet: undefined
                };
            }

            let currentVariantSet = {};
            let currentFile = null;

            const targetVariantSet = extractRawVariantsFromWebpackVariants(webpackVariantSet);
            const lastIdx = lastIndexOfPrefix(files, fileName, firstIdx, filesLen);

            while (firstIdx <= lastIdx) {
                const file = files[firstIdx++];
                const fileExt = path.extname(file);
                const fileExtLen = fileExt.length;

                if (file.match(variantRegex) && (fileExtLen > 0)) {
                    const variantsURI = file.substring(fileNameLen + 1, file.length - fileExtLen);
                    const variantSet = buildVariantSet(variantsURI);
                    const reducedVariantSet = reduceVariantSet(variantSet, targetVariantSet);

                    if ((reducedVariantSet !== false) && isEmptyObj(reducedVariantSet)) {
                        const prioritize = prioritizeVariantSet(variantSet, currentVariantSet, variantsPriority);

                        if (prioritize) {
                            currentVariantSet = variantSet;
                            currentFile = file;
                        }
                    }
                }
            }

            if (currentFile) {
                resource = path.join(resourceDirName, currentFile);
            }
        }

        return {
            resource,
            webpackVariantSet,
        };
    }

    normalFileResolverBeforeResolveHookFactory(compiler) {
        const { variantsPriority } = this;
        const { fileSystem } = compiler.inputFileSystem;

        return (resolveData) => {
            try {
                const { request } = resolveData;
                const query = extractQueryFromURI(request);
                const webpackVariantSet = extractWebpackVariantsFromQuery(query);
                if (!webpackVariantSet || isEmptyObj(webpackVariantSet)) {
                    return;
                }

                const variantSet = buildVariantSet(query.substring(1));
                const reducedVariantSet = reduceVariantSet(variantSet, webpackVariantSet);
                const reducedQuery = serializeVariantSetToURI(reducedVariantSet);
                const requestWithoutQueryIdx = request.lastIndexOf(VARIANTS_URI_DELIMITER);
                const requestWithoutQuery = (requestWithoutQueryIdx >= 0) ? request.substring(0, requestWithoutQueryIdx) : request;
                resolveData.request = requestWithoutQuery + reducedQuery;
                resolveData.createData.webpackVariantSet = webpackVariantSet;
            } catch (error) {
                console.error('Error caught in VariantResolverPlugin::resolverContextFileHook');
                console.error(error);
                throw error;
            }
        };
    }

    normalFileResolverAfterResolveHookFactory(compiler) {
        const { variantsPriority } = this;
        const { fileSystem } = compiler.inputFileSystem;

        return (resolveData) => {
            try {
                const { createData } = resolveData;
                const { webpackVariantSet } = createData;
                const resolvedFileInfo = this.resolveWebpackFileVariant(
                        fileSystem,
                        variantsPriority,
                        webpackVariantSet,
                        createData.resource
                );

                const targetFileBasename = path.basename(resolvedFileInfo.resource);

                let targetFilenameSuffix = '';
                if (!!webpackVariantSet && !isEmptyObj(webpackVariantSet)) {
                    targetFilenameSuffix = getVariantsURIQueryDelimiter(targetFileBasename) + serializeVariantSetToURI(webpackVariantSet);
                }

                const targetFile = targetFileBasename + targetFilenameSuffix;
                const targetFileQuery = extractQueryFromURI(targetFile);

                if (createData.rawRequest) {
                    createData.rawRequest = path.join(path.dirname(createData.rawRequest), targetFile);
                }

                if (createData.request) {
                    createData.request = path.join(path.dirname(createData.request), targetFile);
                }

                if (createData.userRequest) {
                    createData.userRequest = path.join(path.dirname(createData.userRequest), targetFile);
                }

                if (createData.resource) {
                    createData.resource = path.join(path.dirname(createData.resource), targetFileBasename);
                }

                if (targetFileQuery) {
                    createData.resourceResolveData.query = targetFileQuery;
                }
            } catch (error) {
                console.error('Error caught in VariantResolverPlugin::resolverNormalFileHook');
                console.error(error);
                throw error;
            }
        };
    }

    _updateModuleDependencies(module, requestQuerySuffix) {
        module.dependencies.forEach(function(dependency) {
            if (dependency.request) {
                dependency.request = dependency.request + getVariantsURIQueryDelimiter(dependency.request) + requestQuerySuffix;
            }

            if (dependency.userRequest) {
                dependency.userRequest = dependency.userRequest + getVariantsURIQueryDelimiter(dependency.userRequest) + requestQuerySuffix;
            }
        });
    }

    updateModuleDependenciesWithVariantsFactory() {
        return (module) => {
            const { request } = module;
            // TODO - we need to support nested CSS imports, but they are not provided by MiniCssExtractPlugin here at this time
            if (!request) {
                return;
            }

            const webpackVariantSet = extractWebpackVariantsFromQuery(extractQueryFromURI(request));
            if (!!webpackVariantSet && !isEmptyObj(webpackVariantSet)) {
                const webpackVariantQuerySuffix = serializeVariantSetToURI(webpackVariantSet, '&');

                this._updateModuleDependencies(module, webpackVariantQuerySuffix);

                module.blocks.forEach((block) => {
                    this._updateModuleDependencies(block, webpackVariantQuerySuffix);
                });
            }
        };
    }

    apply(compiler) {
        const { options } = compiler;
        var externals = options.externals || {};

        if (!this.options.skipBuildEntry) {
            compiler.hooks.afterEnvironment.tap('VariantResolverAfterEnvironment', this.afterEnvironmentHookFactory(compiler));
            compiler.hooks.entryOption.tap('VariantResolverBuildEntry', this.entryOptionHookFactory(compiler));
        }

        compiler.hooks.afterResolvers.tap('VariantResolverFileResolver', (compiler) => {
            compiler.hooks.normalModuleFactory.tap('VariantResolverNormalModuleFactory', (normalModuleFactory) => {
                normalModuleFactory.hooks.beforeResolve.tap('VariantResolverNormalModuleFactoryBeforeResolve', this.normalFileResolverBeforeResolveHookFactory(compiler));
                normalModuleFactory.hooks.afterResolve.tap('VariantResolverNormalModuleFactoryAfterResolve', this.normalFileResolverAfterResolveHookFactory(compiler));
            });
        });

        compiler.hooks.compilation.tap('VariantResolverCompilation', (compilation) => {
            compilation.hooks.succeedModule.tap('VariantResolverSucceedModule', this.updateModuleDependenciesWithVariantsFactory());
        });

        // For debugging purposes
        if (process.env.DEBUG !== undefined) {
            compiler.hooks.done.tap('VariantResolverErrorLogger', (stats) => {
                if (stats.hasErrors()) {
                    console.error(stats.toString({
                        errors: true,
                        errorDetails: true,
                        errorStack: true
                    }));
                }
            });
        }
    }
}

import fs from 'fs';
import path from 'path';

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
    hasVariantsInURI,
    buildVariantSet,
    buildVaraintsPriority,
    prioritizeVariantSet,
    reduceVariantSet
} from './MatchSet.js';

export function loadWebpackVariantsManifest(manifestPath) {
     return JSON.parse(fs.readFileSync(manifestPath));
}

export function mergeWebpackEntryVariants(webpackEntry, webpackEntryVariants) {
    Object.keys(webpackEntry).forEach(function(key) {
        const webpackEntryPath = webpackEntry[key];
        const entryVariants = webpackEntryVariants[key];
        if (!!entryVariants) {
            entryVariants.forEach(function(variant) {
                if (variant.length > 0) {
                    iterateEntryImports(webpackEntryPath, function(entryPath) {
                        const variantKey = key + '.' + variant.join('.');
                        webpackEntry[variantKey] = {
                            import: [ entryPath + VARIANTS_URI_DELIMITER + variant.join('&') ]
                        };
                    });
                }
            });
        }
    });

    return webpackEntry;
}

export default class VariantResolverPlugin {
    constructor(options) {
        this.intiailizeOptions(options);

        this.variantsPriority = buildVaraintsPriority(this.options.priority);
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

    entryOptionHookFactory(compiler) {
        const { options } = compiler;

        return () => {
            let { manifestPath } = this.options;

            if (path.basename(manifestPath) === manifestPath) {
                const { output } = options;
                manifestPath = path.join(output.path, manifestPath);
            }

            mergeWebpackEntryVariants(options.entry, loadWebpackVariantsManifest(manifestPath));
        };
    }

    updateModuleDependenciesWithVariants() {
        return (module) => {
            const { request } = module;
            const requestQueryIdx = request.indexOf(VARIANTS_URI_DELIMITER);
            const requestQuery = (requestQueryIdx >= 0) ? request.substr(requestQueryIdx) : '';

            module.dependencies.forEach(function(dependency) {
                dependency.request = dependency.request + requestQuery;
                dependency.userRequest = dependency.userRequest + requestQuery;
            });
        };
    }

    resolverFileHookFactory(compiler) {
        const { variantsPriority } = this;
        const { fileSystem } = compiler.inputFileSystem;

        return (request, resolveContext) => {
            try {
                const { fragment } = request;
                if (hasVariantsInURI(fragment)) {
                    // var missing = resolveContext.missing;
                    // var log = resolveContext.log;

                    const fullPath = request.path;
                    const dirName = path.dirname(fullPath);

                    const files = fileSystem.readdirSync(dirName);
                    const filesLen = files.length - 1;
                    if (filesLen >= 0) {
                        const targetVariantSet = buildVariantSet(fragment.substr(1));

                        const extension = path.extname(fullPath);
                        const fileName = path.basename(fullPath, extension);
                        const fileNameLen = fileName.length;

                        const variantRegexStr = "^" + fileName + "(\\.[\\w\\=\\:]+)*" + (extension ? "\\" + extension + "$" : "$");
                        const variantRegex = new RegExp(variantRegexStr, 'g');

                        let firstIdx = firstIndexOfPrefix(files, fileName, 0, filesLen);
                        if (firstIdx < 0) {
                            return;
                        }

                        let currentVariantSet = {};
                        let currentFile = null;
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
                            request.path = `${path.dirname(request.path)}/${currentFile}`;
                            request.relativePath = `${path.dirname(request.relativePath)}/${currentFile}`;
                            request.__innerRequest_relativePath = `${path.dirname(request.__innerRequest_relativePath)}/${currentFile}`;
                            request.__innerRequest = `${path.dirname(request.__innerRequest)}/${currentFile}`;
                        } else {
                            // TODO - finish this
                            console.error('Missing file');
                        }
                        
                    }
                }
            } catch (error) {
                console.error('Error caught in VariantResolverPlugin::fullPath');
                console.error(error);
                throw error;
            }
        };
    }

    apply(compiler) {
        const { options } = compiler;
        var externals = options.externals || {};

        if (!this.options.skipBuildEntry) {
            compiler.hooks.entryOption.tap('VariantResolverBuildVariedEntry', this.entryOptionHookFactory(compiler));
        }

        compiler.hooks.afterResolvers.tap('VariantBuilderJSResolver', (compiler) => {
            // TODO - handle ContextModuleFactory resolver
            compiler.resolverFactory.hooks.resolver.for('normal').tap('VariantResolverFileResolver', (resolver) => {
                resolver.hooks.result.tap('VariantResolverFileResolver', this.resolverFileHookFactory(compiler));
            });
        });

        compiler.hooks.compilation.tap('VariantResolverCompilation', (compilation) => {
            compilation.hooks.succeedModule.tap('VariantResolverSucceedModule', this.updateModuleDependenciesWithVariants());
        });
    }
}

import {
    DEFAULT_VARIANT_PRIORITY,
    DEFAULT_VARIANT_CLOSURE_FILE_NAME
} from './lib/constants.js';

import VariantBuilderPlugin from './lib/VariantBuilderPlugin.js';

import VariantResolverPlugin, {
    mergeWebpackEntryVariants,
    loadWebpackVariantsManifest
} from './lib/VariantResolverPlugin.js';

export {
    DEFAULT_VARIANT_PRIORITY,
    DEFAULT_VARIANT_CLOSURE_FILE_NAME,
    mergeWebpackEntryVariants,
    loadWebpackVariantsManifest,
    VariantBuilderPlugin,
    VariantResolverPlugin
};

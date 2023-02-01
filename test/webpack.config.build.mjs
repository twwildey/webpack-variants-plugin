import WebpackConfigFactory, { VARIANTS_PRIORITY } from './webpack.config.factory.mjs';

import { VariantResolverPlugin } from '../dist/esm/index.mjs';

export default WebpackConfigFactory({
    plugins: [
        new VariantResolverPlugin({
            priority: VARIANTS_PRIORITY
        }),
    ]
});

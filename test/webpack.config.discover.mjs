import WebpackConfigFactory, { VARIANTS_PRIORITY } from './webpack.config.factory.mjs';

import { VariantBuilderPlugin } from '../dist/esm/index.mjs';

export default WebpackConfigFactory({
    plugins: [
        new VariantBuilderPlugin({
            priority: VARIANTS_PRIORITY
        }),
    ]
});

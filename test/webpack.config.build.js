import WebpackConfigFactory from './webpack.config.factory.js';

import { VariantResolverPlugin } from '../index.js';

export default WebpackConfigFactory({
    plugins: [
        new VariantResolverPlugin(),
    ]
});

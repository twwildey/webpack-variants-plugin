import WebpackConfigFactory from './webpack.config.factory.js';

import { VariantBuilderPlugin } from '../index.js';

export default WebpackConfigFactory({
    plugins: [
        new VariantBuilderPlugin(),
    ]
});

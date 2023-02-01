import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VARIANTS_PRIORITY = [
    "device_type",
    "locale",
    "weblab:.*"
];

export default function(config) {
    return Object.assign({
        // TODO - figure out how to make tests work for dynamic imports in "web"
        target: 'node',
        mode: 'development',
        entry: {
            'main': './src/main.js',
            'dynamic': './src/dynamic.js',
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            library: {
                type: "var",
                name: "TestWebpackVariants"
            },
            globalObject: "this",
            publicPath: ""
        }
    }, config);
}

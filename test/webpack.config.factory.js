import path from 'path';
import { fileURLToPath } from 'url';
import { VariantBuilderPlugin } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function(config) {
    return Object.assign({
        mode: 'development',
        entry: {
            'main': './src/main.js',
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            library: {
                type: "var",
                name: "TestWebpackVariants"
            },
            globalObject: "this"
        }
    }, config);
}

# NodeJS-webpack-variants - `@amzn/webpack-variants`

This package provides the `VariantBuilderPlugin` and `VariantResolverPlugin` plugins, which can be used to find and build variants of a `webpack` bundle.

## Variants Explained

`webpack-variants` enables developers to create variants of their `webpack` bundles.  Using a specified set of variants/dimensions, `VariantBuilderPlugin` builds the closure of all variants found within a bundle produced by `webpack`, according to the variants of individual files included in that bundle.

To illustrate this, say a `webpack`-based package has the following `entry` defined in its `webpack.config.js`:

```js
{
    ...
    entry: {
        'main': './src/main.js',
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        ...
    },
    ...
}
```

Furthermore, assume the contents of `main.js` under `src/` include the following:

```js
import Component from 'Component.js';
import strings from 'strings.js';

// ...
```

Finally, presume the `src/` directory of this package has the following modules defined:

```
main.js
Component.js
Component.device_type=desktop.js
Component.device_type=tablet.js
Component.device_type=mobile.js
strings.js
strings.locale=en_US.js
strings.locale=fr_FR.js
strings.locale=zh_CN.js
```

Looking at the `Component.js` file, there are three variants of the file (according to the `device_type` dimension):

* `Component.device_type=desktop.js`
* `Component.device_type=tablet.js`
* `Component.device_type=mobile.js`

Similarly for the the `strings.js` file, there are three variants of the file (according to the `locale` dimension):

* `strings.locale=en_US.js`
* `strings.locale=fr_FR.js`
* `strings.locale=zh_CN.js`

The `VariantBuilderPlugin` detects all variants available within the `webpack` bundle for `main` and produces a `webpack.variants.json` manifest (under the `dist/` folder), containing all combinations of variants that need to built:

```json
{
    "main": [
        [ "device_type=desktop", "locale=en_US" ],
        [ "device_type=mobile", "locale=en_US" ],
        [ "device_type=tablet", "locale=en_US" ],
        [ "device_type=desktop", "locale=zh_CN" ],
        [ "device_type=mobile", "locale=zh_CN" ],
        [ "device_type=tablet", "locale=zh_CN" ],
        [ "device_type=desktop", "locale=fr_FR" ],
        [ "device_type=mobile", "locale=fr_FR" ],
        [ "device_type=tablet", "locale=fr_FR" ],
        [ "device_type=desktop" ],
        [ "device_type=mobile" ],
        [ "device_type=tablet" ],
        [ "locale=zh_CN" ],
        [ "locale=en_US" ],
        [ "locale=fr_FR" ]
    ]
}
```

In a `webpack` bundle, the `entry` file includes a tree of dependencies.  By default, each dependency added in the tree corresponds to one file in source code.  With the `VariantResolverPlugin`, it is possible for a variant of a dependency to be included instead of the original file.  `VariantResolverPlugin` uses query parameters in URI fragments to encode which variants should be included in a `webpack` bundle.  When query parameters are specified in the fragment of a URI for a module, `VariantResolverPlugin` modifies which variant of a file gets bundled according to those query parameters.

When a fragment is specified in the URI of the `entry` file for a bundle, `VariantResolverPlugin` transitively updates the URI of every module in that bundle to include the same fragment.  Using the variants found in `webpack.variants.json`, the `VariantResolverPlugin` modifies the `entry` provided by the `webpack.config.js` to produce the variants of bundles.

Following the previous example, `VariantResolverPlugin` converts the `entry` option of the `webpack.config.js` to the following:

```js
{
    'main': './src/main.js',
    'main.device_type=desktop.locale=zh_CN': './src/main.js#device_type=desktop&locale=zh_CN',
    'main.device_type=mobile.locale=zh_CN': './src/main.js#device_type=mobile&locale=zh_CN',
    'main.device_type=tablet.locale=zh_CN': './src/main.js#device_type=tablet&locale=zh_CN',
    'main.device_type=desktop.locale=en_US': './src/main.js#device_type=desktop&locale=en_US',
    'main.device_type=mobile.locale=en_US': './src/main.js#device_type=mobile&locale=en_US',
    'main.device_type=tablet.locale=en_US': './src/main.js#device_type=tablet&locale=en_US',
    'main.device_type=desktop.locale=fr_FR': './src/main.js#device_type=desktop&locale=fr_FR',
    'main.device_type=mobile.locale=fr_FR': './src/main.js#device_type=mobile&locale=fr_FR',
    'main.device_type=tablet.locale=fr_FR': './src/main.js#device_type=tablet&locale=fr_FR',
    'main.device_type=desktop': './src/main.js#device_type=desktop',
    'main.device_type=mobile': './src/main.js#device_type=mobile',
    'main.device_type=tablet': './src/main.js#device_type=tablet',
    'main.locale=zh_CN': './src/main.js#locale=zh_CN',
    'main.locale=en_US': './src/main.js#locale=en_US',
    'main.locale=fr_FR': './src/main.js#locale=fr_FR'
}
```

After updating the `entry` option of the `webpack.config.js` with variants of the original bundles, `webpack` will build each varied bundle separately.  Continuing the previous example, the following bundles are produced under the `dist/` folder by `webpack` and `VariantResolverPlugin`:

```
main.device_type=desktop.locale=en_US.js
main.device_type=desktop.locale=fr_FR.js
main.device_type=desktop.locale=zh_CN.js
main.device_type=tablet.locale=en_US.js
main.device_type=tablet.locale=fr_FR.js
main.device_type=tablet.locale=zh_CN.js
main.device_type=mobile.locale=en_US.js
main.device_type=mobile.locale=fr_FR.js
main.device_type=mobile.locale=zh_CN.js
main.locale=en_US.js
main.locale=fr_FR.js
main.locale=zh_CN.js
main.device_type=desktop.js
main.device_type=tablet.js
main.device_type=mobile.js
main.js
```

Each bundle includes the requested variant(s) of individual files/modules, when they are available.  In the example above, each varied bundle includes different versions of the `Component` and `strings` modules:

* The `main.device_type=desktop.locale=en_US.js` bundle includes the `Component.device_type=desktop.js` and `strings.locale=en_us.js` modules
* The `main.device_type=desktop.js` bundle includes the `Component.device_type=desktop.js` and `strings.js` modules
* The `main.locale=en_US.js` bundle includes the `Component.js` and `strings.locale=en_US.js` modules
* The `main.js` bundle includes the `Component.js` and `strings.js` modules

## Usage

Projects using `webpack-variants` need to build bundles using `webpack` twice.

The first build needs to discover all variants used within the `webpack` bundles and build all combinations of the variants used by these bundles.  The first build needs to include `VariantBuilderPlugin` as a plugin in `webpack.config.js`:

```js
import { VariantBuilderPlugin } from '@amzn/webpack-variants';

export default {
    entry: {
        'main': './src/main.js',
        // ...
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        // ...
    },
    plugins: [
        new VariantBuilderPlugin({
            priority: [ 'device_type', 'locale', 'weblab.*' ]
        }),
    ],
    // ...
};
```

The second build bundles all variants of the bundles specified in the `entry` option of the `webpack.config.js`.  `VariantResolverPlugin` selects the appropriate variant for each dependency based on the target variants for the bundle.  The second build must include the `VariantResolverPlugin` as a plugin in `webpack.config.js`:

```js
import { VariantResolverPlugin } from '@amzn/webpack-variants';

export default {
    entry: {
        'main': './src/main.js',
        // ...
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        // ...
    },
    plugins: [
        new VariantResolverPlugin({
            priority: [ 'device_type', 'locale', 'weblab.*' ]
        }),
    ],
    // ...
};
```

### Running `webpack-dev-server`

Rebuild speed is critical when running `webpack-dev-server`.  Projects can disable building all variants of bundles to accelerate re-builds by setting `skipBuildEntry` to `true`.  However, developers may need to author specific variants of their bundles when `skipBuildEntry` is `true`.

Developers can specify variants of their bundles by appending URI fragments with query parameters representing the desired variants in the file paths of the `entry` option in their `webpack.config.js`:

```js
import { VariantResolverPlugin } from '@amzn/webpack-variants';

export default {
    entry: {
        'main': './src/main.js#device_type=mobile&locale=fr_FR',
        // ...
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        // ...
    },
    plugins: [
        new VariantResolverPlugin({
            priority: [ 'device_type', 'locale', 'weblab.*' ],
            skipBuildEntry: true
        }),
    ],
    // ...
};
```

In this example `webpack.config.js`, the `main` bundle (specified by the `entry` option) includes the `device_type=mobile` and `locale=fr_FR` variants of individual modules in its dependency closure.

## APIs

### VariantBuilderPlugin

The following options may be passed to `VariantBuilderPlugin`:

* `priority: (String | RegExp)[]`: A list of strings/regular expressions that specify the variants to expect during the build, along with their respective priority.
  * **Variants not included in this list are ignored by `VariantBuilderPlugin`.**
  * Strings are be converted into regular expressions after concatenating start and end tokens, i.e. a value of `STRING` becomes `^STRING$` as a regular expression.
  * Default value: `[ 'secure', 'marketplace', 'locale', 'device_type', 'weblab.*' ]`.
* `manifestPath: String`: A filename or file path to the manifest file to be produced by `VariantBuilderPlugin`.
  * If no path (absolute or relative) is included in `manifestPath`, then the manifest is be written to the directory specified by the `output.path` property on the `webpack.config.js`.
  * Default value: `webpack.variants.json`.

### VariantResolverPlugin

The following options may be passed to `VariantResolverPlugin`:

* `priority: (String | RegExp)[]`: A list of strings/regular expressions that specify the variants to expect during the build, along with their respective priority.
  * **Variants not included in this list are ignored by `VariantResolverPlugin`.**
  * Strings are be converted into regular expressions after concatenating start and end tokens, i.e. a value of `STRING` becomes `^STRING$` as a regular expression.
  * Default value: `[ 'secure', 'marketplace', 'locale', 'device_type', 'weblab.*' ]`.
* `manifestPath: String`: A filename or file path to the manifest file to be produced by `VariantResolverPlugin`.
  * If no path (absolute or relative) is included in `manifestPath`, then the manifest is be written to the directory specified by the `output.path` property on the `webpack.config.js`.
  * Default value: `webpack.variants.json`.
* `skipBuildEntry: Boolean`: Whether to skip building variants of bundles specified in the `entry` option of the `webpack.config.js`.
  * Enable this option when running `webpack-dev-server` or manually specifying variants in the `entry` option of the `webpack.config.js`
  * Default value: `false`

## NpmPrettyMuch

The NPM package name should always start with `@amzn/` to cleanly separate from public packages, avoid accidental publish to public repository, and allow publishing to CodeArtifact.

The package is built with [NpmPrettyMuch](https://w.amazon.com/bin/view/NpmPrettyMuch/GettingStarted/v1) and allows using internal (first-party) dependencies as well as external npmjs.com packages.

Add external dependencies with `brazil-build install` exactly the same as [`npm install`](https://docs.npmjs.com/cli-commands/install.html). You can check latest state of external dependencies on https://npmpm.corp.amazon.com/ Important: Never mix Brazil and NPM install since different package sources are used.

Add internal packages to `test-dependencies` in the Brazil Config file to avoid [transitive conflicts](https://builderhub.corp.amazon.com/docs/brazil/user-guide/concepts-dependencies.html#how-do-i-build-against-a-dependency-in-a-way-that-doesn-t-pollute-my-consumers-dependency-graph) and declare a dependency in your `package.json` with a `*` as version since Brazil is determining latest.

NpmPrettyMuch 1.0 has special behavior for running tests during build. The option `"runTest": "never"` disabled this and instead tests are wired up in `prepublishOnly`. NpmPrettyMuch will invoke `prepublishOnly` and everything can configured in there the [same as with external npm](https://docs.npmjs.com/misc/scripts). Files to published are configured using [`files` in `package.json`](https://docs.npmjs.com/configuring-npm/package-json.html#files). The option `ciBuild` uses [`npm ci`](https://docs.npmjs.com/cli-commands/ci.html) instead of `npm install` and results in faster install times and guarantees all of your dependencies are locked appropriately.

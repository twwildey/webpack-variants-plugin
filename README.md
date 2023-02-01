# `@amzn/webpack-variants`

This package provides the `VariantBuilderPlugin` and `VariantResolverPlugin` plugins, which can be used to find and build variants for `webpack` bundles and chunks.

## Overview

### What are variants?

Variants represent a way for differentiated versions of a file/module to provide specific functionality for specific environments, features, or behavior.  A `webpack` project may want to vend different experiences to different users, based on qualities of the user or features they have access to.  For example, a `webpack` project may want to vend different assets for their application/website to:

* Launch new features or experiment with different behaviors
* Support internationalization and translations for different languages/locales
* Provide specific views or components for desktop, tablet, or mobile devices
    * While application/web developers should integrate responsive design, bundling views/components for all device types can bloat chunk sizes, which can impair page latencies for users.

The convention for specifying variants for a file/module is to add `.` delimited key/value pairs after the filename, but before the file extension.

For example, one might want to create different versions of a component module for a new experiment.  To do so, one could create multiple versions of the file for the component module using the following filenames:

```
Component.js
Component.experiment:CoolNewExperiment=T1.js
Component.experiment:CoolNewExperiment=T2.js
```

Here, the unvaried `Component.js` corresponds to the control treatment for the experiment.

As another example, one might want a module responsible for rendering a webpage to contain more functionality/widgets for a desktop device, compared to a mobile experience.  More so, one might want the tablet experience to have fewer widgets than the desktop experience, but more widgets than the mobile experience.  In this example, one might create multiple versions of the file for the page module using the following filenames:

```
Page.js
Page.device_type=desktop.js
Page.device_type=tablet.js
```

Here, the unvaried `Page.js` corresponds to the mobile view for the page, in alignment with mobile-first development principals.

### Demonstration of `webpack-variants` to build entrypoint variants for `webpack`

The `webpack-variants` plugin enables developers to create variants of their `webpack` bundles.  Using a specified set of variants/dimensions, `VariantBuilderPlugin` builds the closure of all variants found within a bundle produced by `webpack`, according to the variants of individual files included in that bundle.

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

In a `webpack` bundle, the root file for an `entry` includes a tree of dependencies.  By default, each dependency found in the tree corresponds to one file in source code.  With the `VariantResolverPlugin`, it is possible for a variant of a dependency to be included instead of the original file.  `VariantResolverPlugin` uses query parameters in URI queries to encode which variants should be included in a `webpack` bundle.  When query parameters are specified in the query of a URI for a module, `VariantResolverPlugin` modifies which variant of a file gets bundled according to those query parameters.

When a query is specified in the URI of the `entry` file for a bundle, `VariantResolverPlugin` transitively updates the URI of every module in that bundle to include the same query.  Using the variants found in `webpack.variants.json`, the `VariantResolverPlugin` modifies the `entry` provided by the `webpack.config.js` to produce the variants of bundles.

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

### Requirements

Projects using `webpack-variants` **cannot** use the `webpackChunkName` hint for dynamic imports in their codebase for `webpack` projects.  Explicitly setting the `webpackChunkName` for dynamic imports will cause `webpack` to merge chunks that *should* be separated for different variants.  **Do not use  `webpackChunkName` hints in `webpack` projects that use the `webpack-variants` plugin.**

Additionally, `webpack-variants` does not work with transitive style modules loaded with `css-loader` at this time.  `webpack-variants` **can** resolve varied CSS modules that are imported directly from JavaScript modules.  However, `css-loader` does not use the `NormalModuleFactory` nor `enhanced-resolve` to resolve `@import` statements within CSS/styles files, which are used to resolve variants for modules in `webpack-variants`.

Support for variants of transitive CSS module dependencies may be added in the future.  `css-loader` uses PostCSS under the hood, which handles resolving modules from `@import` statements in CSS modules.  An existing PostCSS plugin [called `postcss-import-plugin`](https://github.com/nuxt-contrib/postcss-import-resolver) exists, which supports importing modules using `enhanced-resolve`.  Using `postcss-import-plugin`, `webpack-variants` could be extended to support variants of CSS modules in the future.

### Building for production

Projects using `webpack-variants` need to build bundles using `webpack` twice.  Typically, projects can achieve this by invoking two different NPM scripts defined in their `package.json`, though projects can use any mechanism of their choosing to invoke `webpack` twice.

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
            priority: [ 'device_type', 'locale', 'experiment.*' ]
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
            priority: [ 'device_type', 'locale', 'experiment.*' ]
        }),
    ],
    // ...
};
```

### Running `webpack-dev-server`

Rebuild speed is critical when running `webpack-dev-server`.  Projects can disable building all variants of bundles to accelerate re-builds by setting `skipBuildEntry` to `true`.  However, developers may need to author specific variants of their bundles when `skipBuildEntry` is `true`.

Developers can specify variants of their bundles by appending URI queries with query parameters representing the desired variants in the file paths of the `entry` option in their `webpack.config.js`:

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
            priority: [ 'device_type', 'locale', 'experiment.*' ],
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

* `priority: String[]`: A list of strings that specify the variants to expect during the build, in order of their respective priority.
    * **Variants not included in this list are ignored by `VariantBuilderPlugin`.**
    * Strings are converted into regular expressions after concatenating start and end tokens, i.e. a value of `STRING` becomes `^STRING$` as a regular expression.
    * Default value: `[ 'locale', 'device_type', 'experiment.*' ]`.
* `manifestPath: String`: A filename or file path to the manifest file to be produced by `VariantBuilderPlugin`.
    * If no path (absolute or relative) is included in `manifestPath`, then the manifest is be written to the directory specified by the `output.path` property on the `webpack.config.js`.
    * Default value: `webpack.variants.json`.

### VariantResolverPlugin

The following options may be passed to `VariantResolverPlugin`:

* `priority: String[]`: A list of strings that specify the variants to expect during the build, in order of their respective priority.
    * **Variants not included in this list are ignored by `VariantResolverPlugin`.**
    * Strings are converted into regular expressions after concatenating start and end tokens, i.e. a value of `STRING` becomes `^STRING$` as a regular expression.
    * Default value: `[ 'locale', 'device_type', 'experiment.*' ]`.
* `manifestPath: String`: A filename or file path to the manifest file to be produced by `VariantResolverPlugin`.
    * If no path (absolute or relative) is included in `manifestPath`, then the manifest is be written to the directory specified by the `output.path` property on the `webpack.config.js`.
    * Default value: `webpack.variants.json`.
* `skipBuildEntry: Boolean`: Whether to skip building variants of bundles specified in the `entry` option of the `webpack.config.js`.
    * Enable this option when running `webpack-dev-server` or manually specifying variants in the `entry` option of the `webpack.config.js`
    * Default value: `false`

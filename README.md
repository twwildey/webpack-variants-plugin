# NodeJS-webpack-variants - `@amzn/node-js-webpack-variants`

The NPM package name should always start with `@amzn/` to cleanly separate from public packages, avoid accidental publish to public repository, and allow publishing to CodeArtifact.

The package is built with [NpmPrettyMuch](https://w.amazon.com/bin/view/NpmPrettyMuch/GettingStarted/v1) and allows using internal (first-party) dependencies as well as external npmjs.com packages.

Add external dependencies with `brazil-build install` exactly the same as [`npm install`](https://docs.npmjs.com/cli-commands/install.html). You can check latest state of external dependencies on https://npmpm.corp.amazon.com/ Important: Never mix Brazil and NPM install since different package sources are used.

Add internal packages to `test-dependencies` in the Brazil Config file to avoid [transitive conflicts](https://builderhub.corp.amazon.com/docs/brazil/user-guide/concepts-dependencies.html#how-do-i-build-against-a-dependency-in-a-way-that-doesn-t-pollute-my-consumers-dependency-graph) and declare a dependency in your `package.json` with a `*` as version since Brazil is determining latest.

NpmPrettyMuch 1.0 has special behavior for running tests during build. The option `"runTest": "never"` disabled this and instead tests are wired up in `prepublishOnly`. NpmPrettyMuch will invoke `prepublishOnly` and everything can configured in there the [same as with external npm](https://docs.npmjs.com/misc/scripts). Files to published are configured using [`files` in `package.json`](https://docs.npmjs.com/configuring-npm/package-json.html#files). The option `ciBuild` uses [`npm ci`](https://docs.npmjs.com/cli-commands/ci.html) instead of `npm install` and results in faster install times and guarantees all of your dependencies are locked appropriately.

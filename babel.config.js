module.exports = function babelConfig(api) {
  const nodeTargets = {
    node: 'current',
  };

  const presets = [
    [
      '@babel/preset-env',
      {
        modules: api.env(['cjs']) ? 'commonjs' : false,
        useBuiltIns: 'entry',
        corejs: '2',
        targets: nodeTargets,
        debug: false,
        exclude: [ 'transform-typeof-symbol' ]
      },
    ],
  ];

  const plugins = [
    ['babel-plugin-macros', {}],
    ['@babel/plugin-proposal-class-properties', {}],
    ['@babel/plugin-syntax-object-rest-spread', {}],
    ['@babel/plugin-transform-runtime', {}],
    ['babel-plugin-replace-import-extension', {
       'extMapping': {
        '.js': api.env(['cjs']) ? '.cjs' : '.mjs'
        }
    }]
  ];

  return {
    presets,
    plugins,
  };
};
const path = require('path');
const webpack = require('webpack');
const { version } = require('./package.json');

// Terminal banner
try {
  console.log(`\n[WebChat] v${version} - Turned OFF`);
} catch (_) {}

module.exports = {
  entry: './stub.js',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: 'chat-off.js',
    library: {
      name: 'WebChat',
      type: 'umd',
      export: 'default',
    },
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'string-replace-loader',
            options: {
              search: 'PACKAGE_VERSION_TO_BE_REPLACED',
              replace: version,
            },
          },
          { loader: 'babel-loader' },
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.ENVIRONMENT': JSON.stringify('stub'),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version),
    }),
  ],
};

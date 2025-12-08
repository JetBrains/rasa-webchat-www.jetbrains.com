const path = require('path');
const { version } = require('./package.json');
const webpack = require('webpack');

// Terminal banner
try {
  console.log(`\n[WebChat] v${version} - Turned OFF`);
} catch (_) {}

module.exports = {
  entry: './stub.js',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: 'chat-off.js',
    library: 'WebChat',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['.js']
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'string-replace-loader',
            options: {
              search: 'PACKAGE_VERSION_TO_BE_REPLACED',
              replace: version
            }
          },
          { loader: 'babel-loader' }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.ENVIRONMENT': JSON.stringify('stub'),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version)
    })
  ]
};

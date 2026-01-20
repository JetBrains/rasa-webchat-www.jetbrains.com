const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const dotenv = require('dotenv');
const webpack = require('webpack');
const { version } = require('./package.json');
// eslint-disable-next-line import/no-extraneous-dependencies

const env = dotenv.config({ path: path.resolve(process.cwd(), '.env') }).parsed || {};

const envKeys = Object.fromEntries(
  Object.entries(env).map(([key, val]) => [`process.env.${key}`, JSON.stringify(val)])
);

const envName = process.env.ENVIRONMENT || 'staging';

// Terminal banner with version + environment on dev server start
try {
  // eslint-disable-next-line no-console
  console.log(`\n[WebChat] v${version} (ENVIRONMENT=${envName}) — dev server`);
} catch (_) {}

module.exports = {
  // entry: ['babel-polyfill', './index.js'],
  entry: './umd.js',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: 'index.js',
    library: {
      name: 'WebChat',
      type: 'umd',
      export: 'default',
    },
    clean: true,
  },
  devServer: {
    hot: true,
    host: process.env.HOST, // Defaults to `localhost`
    port: process.env.PORT || 8080,
    open: false,
    static: {
      directory: path.resolve(__dirname, 'lib'),
    },
    devMiddleware: {
      stats: 'errors-only',
    },
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  mode: 'development',
  devtool: 'eval-source-map',
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
      {
        test: /\.scss$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: [path.resolve(__dirname, 'src/scss/')],
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(jpg|png|gif|svg|woff|ttf|eot)$/,
        use: {
          loader: 'url-loader',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Web Chat Widget Test',
      filename: 'index.html',
      inject: false,
      template: 'dev/src/index.html',
      showErrors: true,
    }),
    new webpack.DefinePlugin({
      ...envKeys,
      'process.env.ENVIRONMENT': JSON.stringify(envName),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version),
    }),
  ],
};

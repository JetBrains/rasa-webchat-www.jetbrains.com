const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const webpack = require('webpack');
const dotenv = require('dotenv');
const TerserPlugin = require('terser-webpack-plugin');
const { version } = require('./package.json');

const env = dotenv.config({ path: path.resolve(process.cwd(), '.env') }).parsed || {};

const envKeys = Object.fromEntries(
  Object.entries(env).map(([key, val]) => [`process.env.${key}`, JSON.stringify(val)])
);

const envName = process.env.ENVIRONMENT || 'production';

// Generate filename based on environment
const getFilename = env => {
  const envMap = {
    development: 'chat-dev.js',
    staging: 'chat-stage.js',
    production: 'chat.js',
  };
  return envMap[env] || 'chat.js';
};

// Terminal banner with version on production builds
try {
  // eslint-disable-next-line no-console
  const envSuffix = envName === 'production' ? '' : ` (ENVIRONMENT=${envName})`;
  console.log(`\n[WebChat] v${version}${envSuffix}`);
} catch (_) {}

module.exports = {
  // entry: ['babel-polyfill', './index.js'],
  entry: './umd.js',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: getFilename(envName),
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
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
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
        type: 'asset/inline',
      },
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.DefinePlugin({
      ...envKeys,
      'process.env.ENVIRONMENT': JSON.stringify(envName),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version),
    }),
  ],
};

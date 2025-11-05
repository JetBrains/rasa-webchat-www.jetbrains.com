const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const CleanWebpackPlugin = require('clean-webpack-plugin');
const { version } = require('./package.json');
const webpack = require('webpack');
const dotenv = require('dotenv');

const env = dotenv.config({ path: path.resolve(process.cwd(), '.env') }).parsed || {};

const envKeys = Object.fromEntries(
  Object.entries(env).map(([key, val]) => [`process.env.${key}`, JSON.stringify(val)])
);

const envName = process.env.ENVIRONMENT || 'production';

// Terminal banner with version on production builds
try {
  // eslint-disable-next-line no-console
  const envSuffix = envName === 'production' ? '' : ` (ENVIRONMENT=${envName})`;
  console.log(`\n[WebChat] v${version}${envSuffix}`);
} catch (_) {}

module.exports = [{
  // entry: ['babel-polyfill', './index.js'],
  entry: './umd.js',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: 'index.js',
    library: 'WebChat',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
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
      },
      {
        test: /\.scss$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'sass-loader',
            options: {
              includePaths: [path.resolve(__dirname, 'src/scss/')]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(jpg|png|gif|svg|woff|ttf|eot)$/,
        use: {
          loader: 'url-loader'
        }
      }
    ]
  },
  plugins: [new CleanWebpackPlugin(['lib']),
    new webpack.DefinePlugin({
      ...envKeys,
      'process.env.ENVIRONMENT': JSON.stringify(envName),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version)
    })
  ]
}, {
  entry: './index.js',
  externals: {
    react: {
      root: 'React',
      commonjs2: 'react',
      commonjs: 'react',
      amd: 'react',
      umd: 'react'
    },
    'react-dom': {
      root: 'ReactDOM',
      commonjs2: 'react-dom',
      commonjs: 'react-dom',
      amd: 'react-dom',
      umd: 'react-dom'
    }
  },
  output: {
    path: path.join(__dirname, '/module'),
    filename: 'index.js',
    library: 'WebChat',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
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
      },
      {
        test: /\.scss$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'sass-loader',
            options: {
              includePaths: [path.resolve(__dirname, 'src/scss/')]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(jpg|png|gif|svg|woff|ttf|eot)$/,
        use: {
          loader: 'url-loader'
        }
      }
    ]
  },
  plugins: [new CleanWebpackPlugin(['module']),
    new webpack.DefinePlugin({
      ...envKeys,
      'process.env.ENVIRONMENT': JSON.stringify(envName),
      'process.env.WEBCHAT_PKG_VERSION': JSON.stringify(version)
    })
  ]
}
];

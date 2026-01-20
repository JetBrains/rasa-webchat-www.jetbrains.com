module.exports = {
  env: {
    es6: true,
    node: true,
    browser: true,
    jest: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks', 'prettier'],
  extends: [
    'eslint:recommended',
    'airbnb',
    'plugin:react/recommended',
    'plugin:prettier/recommended',
  ],
  globals: {
    __DEV__: true,
  },
  rules: {
    // 'prettier/prettier': ['error', { arrowParens: 'always' }],
    'prettier/prettier': 'off',
    'arrow-parens': ['error', 'always'],
    'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
    'react/prop-types': [2, { ignore: ['style', 'children', 'dispatch'] }],
    'import/extensions': ['error', { js: 'never' }],
    'import/namespace': 'error',
    'import/default': 'error',
    'import/no-unresolved': 'error',
    'import/no-absolute-path': 'error',
  },
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};

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
    'prettier/prettier': ['error', { arrowParens: 'always' }],
    'no-param-reassign': 'off', // 6 errors
    'no-nested-ternary': 'off', // 1 error
    'consistent-return': 'off', // 3 errors
    'array-callback-return': 'off', // 1 error
    'default-param-last': 'off', // 4 errors
    'import/named': 'off', // 1 error
    camelcase: 'off', // 23 errors
    'import/no-cycle': 'off', // 1 error
    'react/no-this-in-sfc': 'off', // 54 errors
    'prefer-destructuring': 'off', // 8 errors
    'react/require-default-props': 'off', // 134 errors
    'react/jsx-filename-extension': ['error', { extensions: ['.js'] }],
    // 'react/prop-types': [2, { ignore: ['style', 'children', 'dispatch'] }],
    'react/prop-types': 'off', // 92 errorrs
    'react/jsx-props-no-spreading': 'off', // 4 errors
    'react/sort-comp': 'off', // 2 errors
    'react/destructuring-assignment': 'off', // 120 errors
    'react/button-has-type': 'off', // 5 errors
    'react/jsx-no-bind': 'off', // 2 errors
    'jsx-a11y/click-events-have-key-events': 'off', // 7 errors
    'react/no-array-index-key': 'off', // 6 errors
    'react/default-props-match-prop-types': 'off', // 4 errors
    'import/prefer-default-export': 'off', // 5 errors
    'react/forbid-prop-types': 'off', // 2 errors
    'react/no-unused-prop-types': 'off', // 1 error
    'import/no-unresolved': 'error',
    'no-constructor-return': 'off', // 2 errors
    'arrow-parens': ['error', 'always'],
    'jsx-a11y/iframe-has-title': 'off', // 1 error
    'jsx-a11y/alt-text': 'off', // 1 error
    'react/jsx-no-constructed-context-values': 'off', // 1 error
    'import/no-named-as-default': 'off', // 1 error
    'jsx-a11y/control-has-associated-label': 'off', // 1 error
    'jsx-a11y/no-static-element-interactions': 'off', // 1 error
    'import/extensions': 'off', // 1 error
    // 'import/extensions': ['error', { js: 'never' }], // add back after solving error
    'import/default': 'error',
    'import/namespace': 'error',
    'import/no-absolute-path': 'error',
  },
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};

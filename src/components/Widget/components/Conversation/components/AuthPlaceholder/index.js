import React from 'react';
import PropTypes from 'prop-types';

import './styles.scss';

// eslint-disable-next-line import/prefer-default-export, react/function-component-definition
export const AuthPlaceholder = ({ onClick }) => <div className="auth-placeholder__container">
  <div className="auth-placeholder__message">
    <p className="auth-placeholder__text">
    Hi! To proceed with AI Assistant Chat Bot you need to authenticate first
    </p>
    {/* eslint-disable-next-line react/button-has-type */}
    <button className="auth-placeholder__button" onClick={onClick}>Authenticate here</button>
  </div>
</div>;

AuthPlaceholder.propTypes = {
  // eslint-disable-next-line react/require-default-props
  onClick: PropTypes.func
};

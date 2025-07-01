import React from 'react';
import PropTypes from 'prop-types';

import './styles.scss';

export const AuthPlaceholder = ({ onClick }) => <div className="auth-placeholder__container">
  <button className="auth-placeholder__button" onClick={onClick}>click to auth</button>
</div>;

AuthPlaceholder.propTypes = {
  onClick: PropTypes.func
};

import React from 'react';
import PropTypes from 'prop-types';

import './style.scss';

function Badge({ badge }) {
  return badge > 0 && <span className="rw-badge">{badge}</span>;
}

Badge.propTypes = {
  badge: PropTypes.number,
};

export default Badge;

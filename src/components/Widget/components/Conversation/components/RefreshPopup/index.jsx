import React from 'react';
import PropTypes from 'prop-types';

import './style.scss';


// eslint-disable-next-line import/prefer-default-export, react/function-component-definition
export const RefreshPopup = ({ onRefresh, onCancel }) => (<div>
  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
  <div className="rw-popup-overlay" onClick={onCancel} />
  <div className="rw-popup-container">
    <p>
                Refreshing this chat will clear all the history from the current chat. Continue?
    </p>
    <div className="rw-popup-buttons">
      <button type="button" className="rw-popup-button" onClick={onRefresh}>
                    Refresh
      </button>
      <button type="button" className="rw-popup-button" onClick={onCancel}>
                    Cancel
      </button>
    </div>
  </div>
</div>);

RefreshPopup.propTypes = {
  // eslint-disable-next-line react/require-default-props
  onRefresh: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  onCancel: PropTypes.func
};

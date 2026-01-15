import React from 'react';
import PropTypes from 'prop-types';

import './style.scss';

export function RefreshPopup({ onRefresh, onCancel }) {
  return (
    <div>
      <div className="rw-popup-overlay" onClick={onCancel} />
      <div className="rw-popup-container">
        <p>Refreshing this chat will clear all the history from the current chat. Continue?</p>
        <div className="rw-popup-buttons">
          <button type="button" className="rw-popup-button" onClick={onRefresh}>
            Refresh
          </button>
          <button type="button" className="rw-popup-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

RefreshPopup.propTypes = {
  onRefresh: PropTypes.func,
  onCancel: PropTypes.func,
};

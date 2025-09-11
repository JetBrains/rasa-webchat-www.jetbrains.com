import React from 'react';
import PropTypes from 'prop-types';

import './style.scss';


export const RefreshPopup = ({ onRefresh, onCancel }) => (<div>
  <div className="rw-popup-overlay" onClick={onCancel} />
  <div className="rw-popup-container">
    <p>
                Refreshing this chat will clear all the history from the current chat. Continue?
    </p>
    <div className="rw-popup-buttons">
      <button type="button" className="rw-popup-button" onClick={onRefresh}>
                    refresh
      </button>
      <button type="button" className="rw-popup-button" onClick={onCancel}>
                    cancel
      </button>
    </div>
  </div>
</div>);

RefreshPopup.propTypes = {
  onRefresh: PropTypes.func,
  onCancel: PropTypes.func
};

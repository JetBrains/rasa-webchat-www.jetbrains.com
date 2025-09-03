import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import close from 'assets/clear-button.svg';
import refreshIcon from 'assets/refresh.svg';
import fullscreen from 'assets/fullscreen_button.svg';
import fullscreenExit from 'assets/fullscreen_exit_button.svg';
import ThemeContext from '../../../../ThemeContext';

import './style.scss';

const Header = ({
  title,
  subtitle,
  fullScreenMode,
  toggleFullScreen,
  toggleChat,
  refreshSession,
  showCloseButton,
  showFullScreenButton,
  closeImage,
  profileAvatar
}) => {
  const { mainColor } = useContext(ThemeContext);
  return (
    <div className="rw-header-and-loading">
      <div style={{ backgroundColor: mainColor }} className={`rw-header ${subtitle ? 'rw-with-subtitle' : ''}`}>
        {
          profileAvatar && (
            <img src={profileAvatar} className="rw-avatar" alt="chat avatar" />
          )
        }
        <div className="rw-header-buttons">
          {
            showFullScreenButton &&
            <button className="rw-toggle-fullscreen-button" onClick={toggleFullScreen}>
              <img
                className={`rw-toggle-fullscreen ${fullScreenMode ? 'rw-fullScreenExitImage' : 'rw-fullScreenImage'}`}
                src={fullScreenMode ? fullscreenExit : fullscreen}
                alt="toggle fullscreen"
              />
            </button>
          }
          {
            showCloseButton &&
            <button className="rw-close-button" onClick={toggleChat}>
              <img
                className={`rw-close ${closeImage ? '' : 'rw-default'}`}
                src={closeImage || close}
                alt="close"
              />
            </button>
          }
        </div>
        <div className="rw-title-wrap">
          <h4 className={`rw-title ${profileAvatar && 'rw-with-avatar'}`}>{title}</h4>
          {subtitle && <span className={profileAvatar && 'rw-with-avatar'}>{subtitle}</span>}
          <button className="rw-close-header-button" type="button" onClick={refreshSession}>
            <img alt="" src={refreshIcon} />
          </button>
        </div>
      </div>
    </div>);
};

Header.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  fullScreenMode: PropTypes.bool,
  toggleFullScreen: PropTypes.func,
  toggleChat: PropTypes.func,
  refreshSession: PropTypes.func,
  showCloseButton: PropTypes.bool,
  showFullScreenButton: PropTypes.bool,
  closeImage: PropTypes.string,
  profileAvatar: PropTypes.string
};

export default Header;

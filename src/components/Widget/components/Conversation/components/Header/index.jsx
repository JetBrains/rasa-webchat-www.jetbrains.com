import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import close from 'assets/clear-button.svg';
import refreshIcon from 'assets/refresh.svg';
import fullscreen from 'assets/fullscreen_button.svg';
import fullscreenExit from 'assets/fullscreen_exit_button.svg';
import jetbrainsLogo from 'assets/jetbrains-logo.svg';
import ThemeContext from '../../../../ThemeContext';

import './style.scss';

// eslint-disable-next-line react/function-component-definition
const Header = ({
  title,
  subtitle,
  fullScreenMode,
  toggleFullScreen,
  toggleChat,
  refreshSession,
  showCloseButton,
  showFullScreenButton,
  showRefreshButton,
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
            // eslint-disable-next-line react/button-has-type
            <button className="rw-toggle-fullscreen-button" onClick={toggleFullScreen}>
              <img
                className={`rw-toggle-fullscreen ${fullScreenMode ? 'rw-fullScreenExitImage' : 'rw-fullScreenImage'}`}
                src={fullScreenMode ? fullscreenExit : fullscreen}
                alt="toggle fullscreen"
              />
            </button>
          }
        </div>
        <div className="rw-title-wrap">
          <h4 className={`rw-title ${profileAvatar && 'rw-with-avatar'}`}>
            <img src={jetbrainsLogo} alt="JetBrains" className="rw-title-icon" />
            {title}
          </h4>
          {subtitle && <span className={profileAvatar && 'rw-with-avatar'}>{subtitle}</span>}
          <div className="rw-header-buttons">
            {
              showRefreshButton &&
              <button className="rw-header-button rw-header-button_refresh" type="button" onClick={refreshSession}>
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                <img alt="" src={refreshIcon} />
              </button>
            }
            {
              showCloseButton &&
              <button className="rw-header-button" type="button" onClick={toggleChat}>
                <img
                  className={closeImage ? '' : 'rw-default'}
                  alt="close"
                  src={closeImage || close}
                />
              </button>
            }
          </div>
        </div>
      </div>
    </div>);
};

Header.propTypes = {
  // eslint-disable-next-line react/require-default-props
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  // eslint-disable-next-line react/require-default-props
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  // eslint-disable-next-line react/require-default-props
  fullScreenMode: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  toggleFullScreen: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  toggleChat: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  refreshSession: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  showCloseButton: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  showFullScreenButton: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  showRefreshButton: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  closeImage: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  profileAvatar: PropTypes.string
};

export default Header;

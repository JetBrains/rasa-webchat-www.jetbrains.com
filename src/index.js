import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';

import PropTypes from 'prop-types';
import { Provider } from 'react-redux';

import Widget from './components/Widget';
import { initStore } from './store/store';
import socket from './socket';
import ThemeContext from '../src/components/Widget/ThemeContext';
import logger from './utils/logger';
import {
  exchangeTokenReq,
  getAuthCode,
  getIsTokenValid,
  refreshTokenReq,
  getTokenExpirationTime,
  state
} from './utils/auth-utils';

const tokenKey = 'chat_token';
const tokenRefreshKey = 'chat_refresh_token';

const environment = process.env.ENVIRONMENT || 'staging';

// Function to get URL based on environment
const getEnvUrl = (localUrl, devUrl, stageUrl, prodUrl) => {
  if (environment === 'production') return prodUrl;
  if (environment === 'staging') return stageUrl;
  if (environment === 'development') return devUrl;
  if (environment === 'local') return localUrl;
  return stageUrl; // default to staging
};

// Rasa socket URL
const rasaSocketUrl = getEnvUrl(
  process.env.RASA_URL_LOCAL,
  process.env.RASA_URL_DEV,
  process.env.RASA_URL_STAGE,
  process.env.RASA_URL_PROD
);

const socketTemplate = {
  isInitialized: () => false,
  on: () => {
  },
  emit: () => {
  },
  close: () => {
  },
  createSocket: () => {
  },
  marker: Math.random(),
  isDummy: true
};

const ConnectedWidget = forwardRef((props, ref) => {
  class Socket {
    constructor(
      url,
      customData,
      path,
      protocol,
      protocolOptions,
      onSocketEvent,
      onConnectionError
    ) {
      this.url = url;
      this.customData = customData;
      this.path = path;
      this.protocol = protocol;
      this.protocolOptions = protocolOptions;
      this.onSocketEvent = onSocketEvent;
      this.socket = null;
      this.onEvents = [];
      this.marker = Math.random();
      this.onConnectionError = onConnectionError;
    }

    updateProtocolOptions(newProtocolOptions) {
      this.protocolOptions = newProtocolOptions;
    }

    isInitialized() {
      return this.socket !== null && this.socket.connected;
    }

    on(event, callback) {
      if (!this.socket) {
        this.onEvents.push({ event, callback });
      } else {
        this.socket.on(event, callback);
      }
    }

    emit(message, data) {
      if (this.socket) {
        // CRITICAL: Always use the most current socket
        logger.debug('🔍 EMIT: Using socket ID:', this.socket.id, 'connected:', this.socket.connected);

        if (!this.socket.connected) {
          logger.error('❌ EMIT: Socket not connected, cannot send message');
          return;
        }

        this.socket.emit(message, data);
      } else {
        logger.error('❌ EMIT: No socket available');
      }
    }

    close() {
      if (this.socket) {
        this.socket.close();
      }
    }

    createSocket() {
      // Check if socket exists and is connected
      if (this.socket && this.socket.connected) {
        logger.debug('⚠️ Socket already connected, skipping creation. ID:', this.socket.id);
        return;
      }
      
      // If socket exists but disconnected, clean it up
      if (this.socket) {
        logger.debug('🧹 Cleaning up disconnected socket...');
        try {
          this.socket.removeAllListeners();
          this.socket.close();
        } catch (e) {
          logger.error('Error cleaning socket:', e);
        }
        this.socket = null;
      }

      logger.info('🔄 Creating new socket...');
      this.socket = socket(
        this.url,
        this.customData,
        this.path,
        this.protocol,
        this.protocolOptions,
        this.onConnectionError
      );


      this.socket.customData = this.customData;

      // We set a function on session_confirm here so as to avoid any race condition
      // this will be called first and will set those parameters for everyone to use.
      this.socket.on('session_confirm', (sessionObject) => {
        this.sessionConfirmed = true;
        const newSessionId = (sessionObject && sessionObject.session_id)
          ? sessionObject.session_id
          : sessionObject;

        // Check if we have a preserved session ID from reconnection
        if (this.socket.preservedSessionId) {
          logger.debug('🔄 Using preserved session ID:', this.socket.preservedSessionId);
          this.sessionId = this.socket.preservedSessionId;
          // Store in localStorage for persistence
          localStorage.setItem('chat_session_id', this.socket.preservedSessionId);
        } else {
          // Check if we have a stored session ID
          const storedSessionId = localStorage.getItem('chat_session_id');
          if (storedSessionId) {
            logger.debug('🔄 Using stored session ID:', storedSessionId);
            this.sessionId = storedSessionId;
          } else {
            logger.debug('🆕 New session ID:', newSessionId);
            this.sessionId = newSessionId;
            localStorage.setItem('chat_session_id', newSessionId);
          }
        }
      });
      this.onEvents.forEach((event) => {
        this.socket.on(event.event, event.callback);
      });

      this.onEvents = [];
      Object.keys(this.onSocketEvent).forEach((event) => {
        this.socket.on(event, this.onSocketEvent[event]);
      });
    }
  }

  const instanceSocket = useRef(null);
  const store = useRef(null);
  const refreshTimerRef = useRef(null);
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [isAuth, setIsAuth] = useState(() => {
    const chatToken = localStorage.getItem(tokenKey);
    return getIsTokenValid(chatToken);
  });

  const scheduleTokenRefresh = (rToken) => {
    logger.debug('🕐 Scheduling token refresh...');

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      logger.debug('🕐 Cleared existing refresh timer');
    }

    if (!rToken) {
      logger.debug('🕐 No token provided, skipping refresh schedule');
      return;
    }

    const expirationTime = getTokenExpirationTime(rToken);
    if (!expirationTime) {
      logger.debug('🕐 Could not get token expiration time');
      return;
    }

    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;

    logger.debug('🕐 Token expires in:', Math.round(timeUntilExpiration / 1000), 'seconds');

    // TEST MODE: Refresh after n seconds for testing
    // const refreshTime = 15 * 1000; // n seconds

    // PRODUCTION: Uncomment this line and remove the line above
    const refreshTime = timeUntilExpiration - (5 * 60 * 1000);

    const timeToRefresh = Math.max(refreshTime, 5 * 1000);

    logger.debug('🕐 Will refresh token in:', Math.round(timeToRefresh / 1000), 'seconds');


    refreshTimerRef.current = setTimeout(() => {
      logger.debug('🔄 Token refresh timer triggered!');

      const currentToken = localStorage.getItem(tokenKey);
      if (!currentToken || !getIsTokenValid(currentToken)) {
        logger.debug('🔄 Current token is invalid, skipping refresh');
        return;
      }

      logger.debug('🔄 Starting token refresh process...');
      
      const refreshToken = localStorage.getItem(tokenRefreshKey);
      if (refreshToken) {
        refreshTokenReq(refreshToken)
          .then((data) => {
            // eslint-disable-next-line camelcase
            const { id_token, refresh_token } = data;
            // eslint-disable-next-line camelcase
            if (id_token) {
              localStorage.setItem(tokenKey, id_token);
              // eslint-disable-next-line camelcase
              if (refresh_token) {
                localStorage.setItem(tokenRefreshKey, refresh_token);
              }

              logger.info('🔄 Token refreshed automatically, updating socket in-place...');

              // Update socket immediately with new token (NO destruction)
              if (instanceSocket.current && instanceSocket.current.socket && instanceSocket.current.socket.connected) {
                const newCustomData = { ...props.customData, auth_header: id_token };
                instanceSocket.current.customData = newCustomData;

                if (instanceSocket.current.socket.updateAuthHeaders) {
                  instanceSocket.current.socket.updateAuthHeaders(id_token);
                }

                // Update socket customData for future use
                if (instanceSocket.current.socket.customData) {
                  instanceSocket.current.socket.customData = newCustomData;
                }
                
                logger.info('✅ Socket updated in-place, ID:', instanceSocket.current.socket.id);
              }

              setToken(id_token);
              logger.info('✅ Token refreshed and socket updated');
              scheduleTokenRefresh(id_token);
            }
          })
          .catch((err) => {
            logger.error(err);
            setIsAuth(false);
          });
      }
    }, timeToRefresh);
  };

  // Manual token refresh, can be triggered from UI (header refresh button)
  // Returns a Promise to allow callers to await completion before further actions
  const refreshTokenNow = useCallback(() => {
    logger.info('🔄 Manual token refresh triggered...');

    // Clear any pending timer to avoid double refreshes
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      logger.debug('🕐 Cleared existing refresh timer before manual refresh');
    }

    const refreshToken = localStorage.getItem(tokenRefreshKey);
    if (!refreshToken) {
      logger.warn('❌ No refresh token available; cannot refresh manually');
      return Promise.resolve(false);
    }

    return refreshTokenReq(refreshToken)
      .then((data) => {
        const { id_token, refresh_token } = data || {};
        if (!id_token) {
          logger.error('❌ Manual refresh did not return id_token');
          return false;
        }

        localStorage.setItem(tokenKey, id_token);
        if (refresh_token) {
          localStorage.setItem(tokenRefreshKey, refresh_token);
        }

        // Update socket immediately with new token (NO destruction)
        if (instanceSocket.current && instanceSocket.current.socket && instanceSocket.current.socket.connected) {
          const newCustomData = { ...props.customData, auth_header: id_token };
          instanceSocket.current.customData = newCustomData;

          if (instanceSocket.current.socket.updateAuthHeaders) {
            instanceSocket.current.socket.updateAuthHeaders(id_token);
          }

          if (instanceSocket.current.socket.customData) {
            instanceSocket.current.socket.customData = newCustomData;
          }

          logger.info('✅ Manual refresh: socket updated in-place, ID:', instanceSocket.current.socket.id);
        }

        setToken(id_token);
        setIsAuth(true);
        scheduleTokenRefresh(id_token);
        logger.info('✅ Manual token refresh complete');
        return true;
      })
      .catch((err) => {
        logger.error('❌ Manual token refresh failed:', err);
        setIsAuth(false);
        return false;
      });
  }, [props.customData, scheduleTokenRefresh]);

  const checkAndRefreshToken = (resetAuth) => {
    if (isAuth) return;
    const chatToken = localStorage.getItem(tokenKey);
    const refreshToken = localStorage.getItem(tokenRefreshKey);
    const isTokenValid = getIsTokenValid(chatToken);

    if (chatToken && !isTokenValid) {
      refreshTokenReq(refreshToken)
        .then((data) => {
          // eslint-disable-next-line camelcase
          const { id_token, refresh_token } = data;
          // eslint-disable-next-line camelcase
          if (!id_token) return;
          localStorage.setItem(tokenKey, id_token);
          localStorage.setItem(tokenRefreshKey, refresh_token);
          setToken(id_token);
          setIsAuth(true);
          scheduleTokenRefresh(id_token);
        })
        .catch((err) => {
          if (resetAuth) {
            setIsAuth(false);
          }
          logger.error(err);
        });
    } else if (resetAuth) {
      setIsAuth(false);
    }
  };

  useEffect(() => {
    checkAndRefreshToken();

    const chatToken = localStorage.getItem(tokenKey);
    if (chatToken && getIsTokenValid(chatToken)) {
      scheduleTokenRefresh(chatToken);
    }
  }, []);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Cleanup all socket managers on unmount
    if (window.io && window.io.managers) {
      logger.debug('🧹 Cleaning up Socket.IO managers on unmount...');
      Object.keys(window.io.managers).forEach(key => {
        const manager = window.io.managers[key];
        if (manager && manager.close) {
          manager.close();
        }
        delete window.io.managers[key];
      });
    }
  }, []);

  const [socketKey, setSocketKey] = useState('initial'); // For a forced re-render
  const storage = props.params.storage === 'session' ? sessionStorage : localStorage;

  const authCallback = useCallback((event) => {
    if (isAuth) {
      logger.debug('Already authenticated, ignoring message');
      return;
    }

    if (event.data?.type === 'oauth-code') {
      const code = event.data.code;
      const popupState = event.data.popupState;

      logger.debug('📨 Received OAuth callback:', { code: code?.substring(0, 10) + '...', popupState });

      if (state !== popupState) {
        logger.error('❌ State mismatch:', { received: popupState, expected: state });
        return;
      }

      const getChatToken = async () => {
        try {
          logger.debug('🔄 Exchanging code for token...');
          const data = await exchangeTokenReq(code);
          const { id_token, refresh_token } = data;

          if (!id_token) {
            logger.error('❌ No id_token in response:', data);
            return;
          }

          logger.info('✅ Token received, storing...');
          localStorage.setItem(tokenKey, id_token);
          localStorage.setItem(tokenRefreshKey, refresh_token);
          setToken(id_token);
          setIsAuth(true);
          scheduleTokenRefresh(id_token);
          logger.info('✅ Auth completed successfully');
        } catch (error) {
          logger.error('❌ Token exchange error:', error);
        }
      };

      getChatToken();
    }
  }, [isAuth, scheduleTokenRefresh]);

  useEffect(() => {
    window.addEventListener('message', authCallback);
    logger.debug('👂 Message listener added');

    return () => {
      window.removeEventListener('message', authCallback);
      logger.debug('👋 Message listener removed');
    };
  }, [authCallback]);


  const onConnectionError = () => {
    logger.info('🔌 Connection error detected, checking token...');
    checkAndRefreshToken(true);
  };

  const handleSocketDisconnect = (reason) => {
    logger.info('🔌 Socket disconnected, reason:', reason);

    // Prevent multiple disconnect handlers
    if (instanceSocket.current?.isDisconnecting) {
      logger.debug('🔌 Already handling disconnect, ignoring...');
      return;
    }

    // If disconnected due to token expiration, refresh token before reconnecting
    if (reason === 'transport error' || reason === 'io server disconnect') {
      logger.info('🔄 Disconnect likely due to token expiration, refreshing token...');

      if (instanceSocket.current) {
        instanceSocket.current.isDisconnecting = true;
      }

      const refreshToken = localStorage.getItem(tokenRefreshKey);
      if (refreshToken) {
        refreshTokenReq(refreshToken)
          .then((data) => {
            const { id_token, refresh_token } = data;
            if (id_token) {
              logger.info('✅ Token refreshed on disconnect, updating socket...');
              localStorage.setItem(tokenKey, id_token);
              if (refresh_token) {
                localStorage.setItem(tokenRefreshKey, refresh_token);
              }
              setToken(id_token);
              scheduleTokenRefresh(id_token);

              // CRITICAL: Update store socket reference after token refresh
              if (store.current && store.current.updateSocket) {
                store.current.updateSocket(instanceSocket.current);
                logger.debug('🔄 Store socket updated after disconnect token refresh');
              }
            }
          })
          .catch((err) => {
            logger.error('❌ Failed to refresh token on disconnect:', err);
            setIsAuth(false);
          })
          .finally(() => {
            if (instanceSocket.current) {
              instanceSocket.current.isDisconnecting = false;
            }
          });
      }
    }
  };

  useEffect(() => {
    if (isAuth && token && instanceSocket.current) {
      const newCustomData = { ...props.customData, auth_header: token };

      if (instanceSocket.current.isDummy) {
        // First time creating socket after login
        logger.info('Creating initial socket with token');
        logger.debug('Initial customData:', newCustomData);

        const newProtocolOptions = { ...props.protocolOptions, token };

        instanceSocket.current = new Socket(
          rasaSocketUrl,
          newCustomData,
          props.socketPath,
          props.protocol,
          newProtocolOptions,
          { ...props.onSocketEvent, disconnect: handleSocketDisconnect },
          onConnectionError
        );

        // Recreate store with the new socket
        store.current = initStore(
          props.connectingText,
          instanceSocket.current,
          storage,
          props.docViewer,
          props.onWidgetEvent
        );
        store.current.socketRef = instanceSocket.current.marker;
        store.current.socket = instanceSocket.current;

        logger.info('✅ Socket and store created, updating key');
        setSocketKey(`authenticated-${instanceSocket.current.marker}`);
      } else {
        // Token changed - just update customData, DON'T destroy socket
        logger.debug('🔄 Token updated, refreshing socket customData...');
        
        instanceSocket.current.customData = newCustomData;
        
        if (instanceSocket.current.socket && instanceSocket.current.socket.connected) {
          instanceSocket.current.socket.customData = newCustomData;
          
          if (instanceSocket.current.socket.updateAuthHeaders) {
            instanceSocket.current.socket.updateAuthHeaders(token);
          }
          
          logger.info('✅ Socket customData updated, ID:', instanceSocket.current.socket.id);
        }
        
        const updatedProtocolOptions = { ...props.protocolOptions, token };
        instanceSocket.current.updateProtocolOptions(updatedProtocolOptions);
        
        if (store.current && store.current.updateSocket) {
          store.current.updateSocket(instanceSocket.current);
        }
      }
    }
  }, [isAuth, token]);


  if (!store.current && !instanceSocket.current) {
    instanceSocket.current = socketTemplate;
  }

  if (!store.current) {
    store.current = initStore(
      props.connectingText,
      instanceSocket.current,
      storage,
      props.docViewer,
      props.onWidgetEvent
    );
    store.current.socketRef = instanceSocket.current.marker;
    store.current.socket = instanceSocket.current;
  }

  const logIn = async () => {
    // setIsAuth(true);
    await getAuthCode();
  };
  return (
    <Provider store={store.current}>
      <ThemeContext.Provider
        value={{
          mainColor: props.mainColor,
          conversationBackgroundColor: props.conversationBackgroundColor,
          userTextColor: props.userTextColor,
          userBackgroundColor: props.userBackgroundColor,
          assistTextColor: props.assistTextColor,
          assistBackgoundColor: props.assistBackgoundColor
        }}
      >
        <Widget
          key={socketKey}
          ref={ref}
          onAuthButtonClick={!isAuth ? logIn : null}
          onRefreshToken={refreshTokenNow}
          initPayload={props.initPayload}
          title={props.title}
          subtitle={props.subtitle}
          customData={{ ...props.customData, auth_header: token }}
          handleNewUserMessage={props.handleNewUserMessage}
          profileAvatar={props.profileAvatar}
          showCloseButton={props.showCloseButton}
          showFullScreenButton={props.showFullScreenButton}
          hideWhenNotConnected={props.hideWhenNotConnected}
          connectOn={props.connectOn}
          autoClearCache={props.autoClearCache}
          fullScreenMode={props.fullScreenMode}
          badge={props.badge}
          embedded={props.embedded}
          params={props.params}
          storage={storage}
          inputTextFieldHint={props.inputTextFieldHint}
          openLauncherImage={props.openLauncherImage}
          closeImage={props.closeImage}
          customComponent={props.customComponent}
          displayUnreadCount={props.displayUnreadCount}
          socket={instanceSocket.current}
          showMessageDate={props.showMessageDate}
          customMessageDelay={props.customMessageDelay}
          tooltipPayload={props.tooltipPayload}
          tooltipDelay={props.tooltipDelay}
          disableTooltips={props.disableTooltips}
          defaultHighlightCss={props.defaultHighlightCss}
          defaultHighlightAnimation={props.defaultHighlightAnimation}
          defaultHighlightClassname={props.defaultHighlightClassname}
        />
      </ThemeContext.Provider>
    </Provider>
  );
});

ConnectedWidget.propTypes = {
  initPayload: PropTypes.string,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  protocol: PropTypes.string,
  socketUrl: PropTypes.string,
  socketPath: PropTypes.string,
  protocolOptions: PropTypes.shape({}),
  customData: PropTypes.shape({}),
  handleNewUserMessage: PropTypes.func,
  profileAvatar: PropTypes.string,
  inputTextFieldHint: PropTypes.string,
  connectingText: PropTypes.string,
  showCloseButton: PropTypes.bool,
  showFullScreenButton: PropTypes.bool,
  hideWhenNotConnected: PropTypes.bool,
  connectOn: PropTypes.oneOf(['mount', 'open']),
  autoClearCache: PropTypes.bool,
  onSocketEvent: PropTypes.objectOf(PropTypes.func),
  fullScreenMode: PropTypes.bool,
  badge: PropTypes.number,
  embedded: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  params: PropTypes.object,
  openLauncherImage: PropTypes.string,
  closeImage: PropTypes.string,
  docViewer: PropTypes.bool,
  customComponent: PropTypes.func,
  displayUnreadCount: PropTypes.bool,
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  customMessageDelay: PropTypes.func,
  tooltipPayload: PropTypes.string,
  tooltipDelay: PropTypes.number,
  onWidgetEvent: PropTypes.shape({
    onChatOpen: PropTypes.func,
    onChatClose: PropTypes.func,
    onChatVisible: PropTypes.func,
    onChatHidden: PropTypes.func
  }),
  disableTooltips: PropTypes.bool,
  defaultHighlightCss: PropTypes.string,
  defaultHighlightAnimation: PropTypes.string,
  mainColor: PropTypes.string,
  conversationBackgroundColor: PropTypes.string,
  userTextColor: PropTypes.string,
  userBackgroundColor: PropTypes.string,
  assistTextColor: PropTypes.string,
  assistBackgoundColor: PropTypes.string
};

ConnectedWidget.defaultProps = {
  title: 'JetBrains Support Assistant',
  customData: {},
  inputTextFieldHint: 'Type a message...',
  connectingText: 'Waiting for server...',
  fullScreenMode: false,
  hideWhenNotConnected: false,
  autoClearCache: false,
  connectOn: 'mount',
  onSocketEvent: {},
  protocol: 'socketio',
  protocolOptions: {},
  badge: 0,
  embedded: false,
  params: {
    storage: 'local'
  },
  docViewer: false,
  showCloseButton: true,
  showFullScreenButton: false,
  displayUnreadCount: false,
  showMessageDate: false,
  customMessageDelay: (message) => {
    let delay = message.length * 30;
    if (delay > 3 * 1000) delay = 3 * 1000;
    if (delay < 800) delay = 800;
    return delay;
  },
  tooltipPayload: null,
  tooltipDelay: 500,
  onWidgetEvent: {},
  disableTooltips: true,
  mainColor: '',
  conversationBackgroundColor: '',
  userTextColor: '',
  userBackgroundColor: '',
  assistTextColor: '',
  assistBackgoundColor: '',
  showAuthButton: null
};

export default ConnectedWidget;

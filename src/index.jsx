/* eslint-disable react/no-this-in-sfc, react/jsx-no-constructed-context-values, react/require-default-props, camelcase, prefer-template */
import React, { forwardRef, useEffect, useRef, useState } from 'react';

import PropTypes from 'prop-types';
import { Provider } from 'react-redux';

import { TOKEN_KEY , TOKEN_REFRESH_KEY } from 'constants';
import useAuthCallback from 'hooks/auth/useAuthCallback';
import useCheckAndRefreshToken from 'hooks/auth/useCheckAndRefreshToken';
import useRefreshTokenNow from 'hooks/auth/useRefreshTokenNow';
import useScheduleTokenRefresh from 'hooks/auth/useScheduleTokenRefresh';
import { getIsTokenValid, refreshTokenReq, getAuthCode, getInitialToken, getIsUserAuthenticated } from 'utils/auth/index.ts';
import rasaSocketUrl from 'utils/environment/rasaSocketUrl.ts';

import Widget from './components/Widget';
import { initStore } from './store/store';
import socket from './socket';
import ThemeContext from "./components/Widget/ThemeContext";
import logger from './utils/logger';

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

      // Store pending events before cleanup
      const pendingEvents = [...this.onEvents];

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

      // Apply pending events (these were registered via socket.on() before socket was created)
      pendingEvents.forEach((event) => {
        this.socket.on(event.event, event.callback);
      });

      // Apply previously registered events from onSocketEvent (includes connect, disconnect, etc.)
      Object.keys(this.onSocketEvent).forEach((event) => {
        this.socket.on(event, this.onSocketEvent[event]);
      });

      this.onEvents = [];

      logger.debug('✅ Socket created with all event handlers attached');
    }
  }

  const instanceSocket = useRef(null);
  const store = useRef(null);
  const refreshTimerRef = useRef(null);
  const [token, setToken] = useState(getInitialToken);
  const [isAuth, setIsAuth] = useState(getIsUserAuthenticated);

  const [socketKey, setSocketKey] = useState('initial'); // For a forced re-render

  const scheduleTokenRefresh = useScheduleTokenRefresh({refreshTimerRef, instanceSocket, customData: props.customData, store, setSocketKey, setToken, setIsAuth });

  const refreshTokenNow = useRefreshTokenNow({refreshTimerRef, instanceSocket, props, setToken, setIsAuth, scheduleTokenRefresh});

  const checkAndRefreshToken = useCheckAndRefreshToken({isAuth, setIsAuth, setToken, scheduleTokenRefresh})

  useEffect(() => {
    checkAndRefreshToken();

    const chatToken = localStorage.getItem(TOKEN_KEY);
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
      Object.keys(window.io.managers).forEach((key) => {
        const manager = window.io.managers[key];
        if (manager && manager.close) {
          manager.close();
        }
        delete window.io.managers[key];
      });
    }
  }, []);

  const storage = props.params.storage === 'session' ? sessionStorage : localStorage;

  useAuthCallback({isAuth, setIsAuth, setToken, scheduleTokenRefresh});
  
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

      // CRITICAL: Preserve session_id before reconnect
      const sessionId = instanceSocket.current?.sessionId;
      if (sessionId && instanceSocket.current) {
        instanceSocket.current.preservedSessionId = sessionId;
        logger.debug('🔒 Preserved session_id before reconnect:', sessionId);
      }

      if (instanceSocket.current) {
        instanceSocket.current.isDisconnecting = true;
      }

      const refreshToken = localStorage.getItem(TOKEN_REFRESH_KEY);
      logger.debug('🔄 Disconnect-refresh: using refresh_token from localStorage:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'NULL');

      if (refreshToken) {
        refreshTokenReq(refreshToken)
          .then((data) => {
            const { id_token, refresh_token } = data;
            if (id_token) {
              logger.info('✅ Token refreshed on disconnect, updating socket...');
              localStorage.setItem(TOKEN_KEY, id_token);
              logger.info('✅ Disconnect-refresh: id_token updated');

              if (refresh_token) {
                localStorage.setItem(TOKEN_REFRESH_KEY, refresh_token);
                logger.info('✅ Disconnect-refresh: refresh_token updated');
              } else {
                logger.warn('⚠️ Disconnect-refresh: Server did NOT return new refresh_token, keeping old one');
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
    logger.info('🔍 useEffect [isAuth, token]: isAuth=', isAuth, 'token=', token ? `${token.substring(0, 30)}...` : 'null');
    logger.info('🔍 localStorage token:', localStorage.getItem(TOKEN_KEY) ? 'EXISTS' : 'NULL');
    
    if (isAuth && token && instanceSocket.current) {
      const newCustomData = { ...props.customData, auth_header: token };
      logger.info('🔍 Creating customData with auth_header:', newCustomData.auth_header ? 'TOKEN_SET' : 'NO_TOKEN');

      if (instanceSocket.current.isDummy) {
        // First time creating socket after login
        logger.info('Creating initial socket with token');
        logger.debug('Initial customData:', newCustomData);

        const newProtocolOptions = { ...props.protocolOptions, token };

        // Handle reconnect - copy preservedSessionId to socket object
        const handleSocketConnect = () => {
          if (instanceSocket.current?.preservedSessionId && instanceSocket.current.socket) {
            instanceSocket.current.socket.preservedSessionId = instanceSocket.current.preservedSessionId;
            logger.debug('✅ Reconnected: copied preservedSessionId to socket:', instanceSocket.current.preservedSessionId);
          }

          // Call original connect handler if it exists
          if (props.onSocketEvent?.connect) {
            props.onSocketEvent.connect();
          }
        };

        instanceSocket.current = new Socket(
          rasaSocketUrl,
          newCustomData,
          props.socketPath,
          props.protocol,
          newProtocolOptions,
          {
            ...props.onSocketEvent,
            disconnect: handleSocketDisconnect,
            connect: handleSocketConnect
          },
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
          // eslint-disable-next-line react/prop-types
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
  title: 'Support Assistant',
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
  // eslint-disable-next-line react/default-props-match-prop-types
  showAuthButton: null
};

export default ConnectedWidget;

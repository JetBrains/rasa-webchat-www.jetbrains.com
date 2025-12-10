import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';

import PropTypes from 'prop-types';
import { Provider } from 'react-redux';

import Widget from './components/Widget';
import { initStore } from './store/store';
import socket from './sockets/socket';
import ThemeContext from './components/Widget/ThemeContext';
import logger from './utils/logger';
import {
  getAuthCode,
  getIsTokenValid
} from './utils/auth-utils';
import { getEnvUrl } from './utils/environment';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from './constants/token';
import { SOCKET_TEMPLATE } from './constants/socket';
import { TokenManager } from './services/TokenManager';
import { SocketWrapper } from './services/SocketWrapper';
import { OAuthManager } from './services/OAuthManager';
import { SocketLifecycleManager } from './services/SocketLifecycleManager';
import { updateSocketAuth, updateSocketProtocolOptions } from './sockets/SocketAuthUpdater';
import { reconnectSocketWithNewToken } from './sockets/SocketReconnection';
import { createSocketEventHandlers } from './sockets/SocketEventHandlers';
import { useOAuthCallback } from './hooks/useOAuthCallback';

const tokenKey = TOKEN_KEY;
const tokenRefreshKey = REFRESH_TOKEN_KEY;

// Rasa socket URL
const rasaSocketUrl = getEnvUrl(
  process.env.RASA_URL_LOCAL,
  process.env.RASA_URL_DEV,
  process.env.RASA_URL_STAGE,
  process.env.RASA_URL_PROD
);

const ConnectedWidget = forwardRef((props, ref) => {
  const instanceSocket = useRef(null);
  const store = useRef(null);
  const tokenManagerRef = useRef(null);
  const oauthManagerRef = useRef(null);
  const socketLifecycleManagerRef = useRef(null);
  const [socketKey, setSocketKey] = useState('initial');

  // Initialize state from OAuthManager
  const [token, setToken] = useState(() => {
    const initialToken = localStorage.getItem(tokenKey);
    logger.info('🔍 INIT: Token from localStorage:', initialToken ? `${initialToken.substring(0, 30)}...` : 'NULL');
    return initialToken;
  });
  const [isAuth, setIsAuth] = useState(() => {
    const chatToken = localStorage.getItem(tokenKey);
    const isValid = getIsTokenValid(chatToken);
    logger.info('🔍 INIT: isAuth:', isValid);
    return isValid;
  });

  // Initialize managers once
  useEffect(() => {
    if (!tokenManagerRef.current) {
      // Initialize TokenManager
      tokenManagerRef.current = new TokenManager({
        tokenKey: TOKEN_KEY,
        refreshTokenKey: REFRESH_TOKEN_KEY,
        useTestMode: false,
        onTokenRefreshed: (newIdToken, newRefreshToken, options = {}) => {
          setToken(newIdToken);
          setIsAuth(true);

          // Reconnect socket with new token (unless skipSocketReconnect is true for manual refresh before /restart)
          if (!options.skipSocketReconnect && instanceSocket.current && instanceSocket.current.socket && instanceSocket.current.socket.connected) {
            reconnectSocketWithNewToken(instanceSocket.current, newIdToken, props.customData, store.current, setSocketKey);
          } else if (options.skipSocketReconnect) {
            logger.info('⏭️ Skipping socket reconnect (manual refresh before /restart)');
            // Just update the socket auth without destroying/recreating
            if (instanceSocket.current && instanceSocket.current.socket) {
              // Update customData with new token
              const updatedCustomData = { ...props.customData, auth_header: newIdToken };

              // Update socket.auth (Socket.IO handshake auth)
              instanceSocket.current.socket.auth = updatedCustomData;

              // CRITICAL: Update socket.customData for polling transport and future requests
              instanceSocket.current.socket.customData = updatedCustomData;
              instanceSocket.current.customData = updatedCustomData;
              logger.info('✅ Updated socket.customData with new token');

              // Update all auth header locations using the dedicated updater
              if (instanceSocket.current.socket.updateAuthHeaders) {
                instanceSocket.current.socket.updateAuthHeaders(newIdToken);
              }

              logger.info('✅ Updated socket auth with new token (no reconnect)');
            }
          }
        },
        onTokenRefreshFailed: (error) => {
          logger.error('Token refresh failed:', error);
          setIsAuth(false);
        }
      });

      // Initialize OAuthManager
      oauthManagerRef.current = new OAuthManager({
        tokenManager: tokenManagerRef.current,
        storage: localStorage,
        onTokenChange: setToken,
        onAuthChange: setIsAuth
      });

      // Initialize SocketLifecycleManager
      socketLifecycleManagerRef.current = new SocketLifecycleManager({
        tokenManager: tokenManagerRef.current,
        storage: localStorage,
        onTokenRefreshed: (newToken) => {
          setToken(newToken);
          // Socket will reconnect automatically
        }
      });
    }
  }, []);

  // Delegate to OAuthManager
  const scheduleTokenRefresh = (rToken) => {
    if (oauthManagerRef.current) {
      oauthManagerRef.current.scheduleTokenRefresh(rToken);
    }
  };

  // Manual token refresh, can be triggered from UI (header refresh button)
  // Returns a Promise to allow callers to await completion before further actions
  const refreshTokenNow = useCallback(async () => {
    if (!tokenManagerRef.current) {
      logger.warn('TokenManager not initialized');
      return false;
    }

    // IMPORTANT: Skip socket reconnection during manual refresh
    // Socket will remain alive for the subsequent /restart message
    const success = await tokenManagerRef.current.refreshManually({ skipSocketReconnect: true });

    if (success) {
      const newToken = localStorage.getItem(tokenKey);
      setToken(newToken);
      setIsAuth(true);

      logger.info('✅ Manual refresh completed - socket auth updated, no reconnection');
    }

    return success;
  }, [props.customData]);

  // Delegate to OAuthManager
  const checkAndRefreshToken = async (resetAuth) => {
    if (isAuth) return;

    if (!oauthManagerRef.current) {
      logger.warn('OAuthManager not initialized');
      return;
    }

    const isValid = await oauthManagerRef.current.checkAndRefreshToken(resetAuth);
    // State updates handled by OAuthManager callbacks
  };

  useEffect(() => {
    checkAndRefreshToken();

    const chatToken = localStorage.getItem(tokenKey);
    if (chatToken && getIsTokenValid(chatToken)) {
      scheduleTokenRefresh(chatToken);
    }
  }, []);

  useEffect(() => () => {
    // Cleanup managers
    if (oauthManagerRef.current) {
      oauthManagerRef.current.destroy();
    }
    if (socketLifecycleManagerRef.current) {
      socketLifecycleManagerRef.current.cleanupSocketManagers();
    }
  }, []);

  const storage = props.params.storage === 'session' ? sessionStorage : localStorage;

  // Use OAuth callback hook
  useOAuthCallback({
    isAuth,
    setToken,
    setIsAuth,
    scheduleTokenRefresh
  });


  const onConnectionError = () => {
    logger.info('🔌 Connection error detected, checking token...');
    checkAndRefreshToken(true);
  };

  // Delegate to SocketLifecycleManager
  const handleSocketDisconnect = async (reason) => {
    if (!socketLifecycleManagerRef.current || !instanceSocket.current) {
      return;
    }

    const success = await socketLifecycleManagerRef.current.handleDisconnect(
      instanceSocket.current,
      reason
    );

    // Update store socket reference after successful token refresh
    if (success && store.current && store.current.updateSocket) {
      store.current.updateSocket(instanceSocket.current);
      logger.debug('🔄 Store socket updated after disconnect token refresh');
    }

    // Update auth state based on disconnect handling result
    if (!success && (reason === 'transport error' || reason === 'io server disconnect')) {
      setIsAuth(false);
    }
  };

  useEffect(() => {
    logger.info('🔍 useEffect [isAuth, token]: isAuth=', isAuth, 'token=', token ? `${token.substring(0, 30)}...` : 'null');
    logger.info('🔍 localStorage token:', localStorage.getItem(tokenKey) ? 'EXISTS' : 'NULL');
    
    if (isAuth && token && instanceSocket.current) {
      const newCustomData = { ...props.customData, auth_header: token };
      logger.info('🔍 Creating customData with auth_header:', newCustomData.auth_header ? 'TOKEN_SET' : 'NO_TOKEN');

      if (instanceSocket.current.isDummy) {
        // First time creating socket after login
        logger.info('Creating initial socket with token');
        logger.debug('Initial customData:', newCustomData);

        const newProtocolOptions = { ...props.protocolOptions, token };

        // Create socket event handlers with disconnect/connect logic
        const socketEventHandlers = createSocketEventHandlers({
          onDisconnect: handleSocketDisconnect,
          onConnect: props.onSocketEvent?.connect,
          userHandlers: props.onSocketEvent,
          instanceSocket: instanceSocket.current
        });

        instanceSocket.current = new SocketWrapper(
          rasaSocketUrl,
          newCustomData,
          props.socketPath,
          props.protocol,
          newProtocolOptions,
          socketEventHandlers,
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

        updateSocketAuth(instanceSocket.current, token, props.customData);
        updateSocketProtocolOptions(instanceSocket.current, token, props.protocolOptions);

        if (store.current && store.current.updateSocket) {
          store.current.updateSocket(instanceSocket.current);
        }
      }
    }
  }, [isAuth, token]);


  if (!store.current && !instanceSocket.current) {
    instanceSocket.current = SOCKET_TEMPLATE;
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
  showAuthButton: null
};

export default ConnectedWidget;

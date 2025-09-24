import React, { forwardRef, useEffect, useRef, useState } from 'react';

import PropTypes from 'prop-types';
import { Provider } from 'react-redux';

import Widget from './components/Widget';
import { initStore } from './store/store';
import socket from './socket';
import ThemeContext from '../src/components/Widget/ThemeContext';
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

const isProduction = process.env.ENVIRONMENT === 'production';
const envSocketUrl = isProduction ? 'https://rasa-prod-jb.labs.jb.gg' : 'https://rasa-stage-jb.labs.jb.gg';

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
        this.socket.emit(message, data);
      }
    }

    close() {
      if (this.socket) {
        this.socket.close();
      }
    }

    createSocket() {
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
        this.sessionId = (sessionObject && sessionObject.session_id)
          ? sessionObject.session_id
          : sessionObject;
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
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!rToken) return;

    const expirationTime = getTokenExpirationTime(rToken);
    if (!expirationTime) return;

    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;

    // update 5 mins before expiration
    const refreshTime = timeUntilExpiration - (5 * 60 * 1000);

    // update immediately if it's less than a minute
    const timeToRefresh = Math.max(refreshTime, 60 * 1000);


    refreshTimerRef.current = setTimeout(() => {
      const currentToken = localStorage.getItem(tokenKey);
      if (!currentToken || !getIsTokenValid(currentToken)) {
        return;
      }

      console.log('refreshing token');
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
              setToken(id_token);
              console.log('token refreshed');
              scheduleTokenRefresh(id_token);
            }
          })
          .catch((err) => {
            console.error(err);
            setIsAuth(false);
          });
      }
    }, timeToRefresh);
  };

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
          console.error(err);
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
  }, []);

  const [socketKey, setSocketKey] = useState('initial'); // Для принудительного ререндера
  const storage = props.params.storage === 'session' ? sessionStorage : localStorage;

  const authCallback = () => {
    if (isAuth) return;
    if (event.data?.type === 'oauth-code') {
      const code = event.data.code;
      const popupState = event.data.popupState;

      if (state !== popupState) {
        throw Error('states don\'t match');
      }

      const getChatToken = async () => {
        const data = await exchangeTokenReq(code);
        // eslint-disable-next-line camelcase
        const { id_token, refresh_token } = data;
        localStorage.setItem(tokenKey, id_token);
        localStorage.setItem(tokenRefreshKey, refresh_token);
        setToken(id_token);
        setIsAuth(true);
        scheduleTokenRefresh(id_token);
      };

      getChatToken();
    }
  };

  useEffect(() => {
    window.addEventListener('message', authCallback);

    return () => window.removeEventListener('message', authCallback);
  }, []);


  const onConnectionError = () => {
    checkAndRefreshToken(true);
  };

  useEffect(() => {
    if (isAuth && token && instanceSocket.current) {
      const newCustomData = { ...props.customData, auth_header: token };

      if (instanceSocket.current.isDummy) {
        // First time creating socket after login
        console.log('Creating initial socket with token');

        const newProtocolOptions = { ...props.protocolOptions, token };

        instanceSocket.current = new Socket(
          // props.socketUrl,
          envSocketUrl,
          newCustomData,
          props.socketPath,
          props.protocol,
          newProtocolOptions,
          props.onSocketEvent,
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

        setSocketKey(`authenticated-${instanceSocket.current.marker}`);
      } else {
        // Token refresh - update customData only to avoid chat blinking
        console.log('Updating socket customData with refreshed token (no reconnection)');

        // Update customData in all places
        instanceSocket.current.customData = newCustomData;
        if (instanceSocket.current.socket) {
          instanceSocket.current.socket.customData = newCustomData;
        }

        // Update store socket reference to use new customData
        if (store.current && store.current.socket) {
          store.current.socket.customData = newCustomData;
        }

        // Update protocolOptions for next reconnection (Authorization header)
        const newProtocolOptions = { ...props.protocolOptions, token };
        instanceSocket.current.updateProtocolOptions(newProtocolOptions);

        console.log('Token updated in customData, Authorization header will update on next reconnection');
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
        value={{ mainColor: props.mainColor,
          conversationBackgroundColor: props.conversationBackgroundColor,
          userTextColor: props.userTextColor,
          userBackgroundColor: props.userBackgroundColor,
          assistTextColor: props.assistTextColor,
          assistBackgoundColor: props.assistBackgoundColor }}
      >
        <Widget
          key={socketKey}
          ref={ref}
          onAuthButtonClick={!isAuth ? logIn : null}
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
  socketUrl: PropTypes.string.isRequired,
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
  socketUrl: 'http://localhost',
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

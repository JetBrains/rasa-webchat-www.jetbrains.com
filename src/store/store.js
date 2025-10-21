import { createStore, combineReducers, compose, applyMiddleware } from 'redux';

import { SESSION_NAME } from 'constants';

import behavior from './reducers/behaviorReducer';
import messages from './reducers/messagesReducer';
import metadata from './reducers/metadataReducer';

import { getLocalSession } from './reducers/helper';
import * as actionTypes from './actions/actionTypes';

const cleanURL = (url) => {
  const regexProtocolHostPort = /https?:\/\/(([A-Za-z0-9-])+(\.?))+[a-z]+(:[0-9]+)?/;
  const regexLastTrailingSlash = /\/$|\/(?=\?)/;
  return url.replace(regexProtocolHostPort, '').replace(regexLastTrailingSlash, '');
};

const trimQueryString = (url) => {
  const regexQueryString = /\?.+$/;
  return url.replace(regexQueryString, '');
};

function initStore(
  connectingText,
  socket,
  storage,
  docViewer = false,
  onWidgetEvent,
) {
  // Store reference to current socket that can be updated
  let currentSocketRef = socket;
  
  const customMiddleWare = store => next => (action) => {
    const emitMessage = (payload) => {
      const emit = () => {
        // CRITICAL: Always use the most current socket reference
        const activeSocket = currentSocketRef;
        
        // Get fresh session ID each time
        const localSession = getLocalSession(storage, SESSION_NAME);
        let sessionId = localSession?.session_id;
        
        // Try multiple sources for session ID
        if (!sessionId && activeSocket.sessionId) {
          sessionId = activeSocket.sessionId;
        }
        
        if (!sessionId) {
          sessionId = localStorage.getItem('chat_session_id');
        }
        
        // Get fresh customData and socket reference
        const realSocket = activeSocket.socket || activeSocket;
        const currentCustomData = activeSocket.customData || {};
        
        console.log('📤 MIDDLEWARE: Using socket reference:', activeSocket.marker || 'unknown');
        console.log('📤 Sending message with token:', currentCustomData?.auth_header ? currentCustomData.auth_header.substring(0, 30) + '...' : 'none');
        console.log('📤 Session ID:', sessionId);
        console.log('📤 Real Socket ID:', realSocket?.id || 'N/A');
        console.log('📤 Socket connected:', realSocket?.connected || false);
        
        if (!realSocket || !realSocket.connected) {
          console.error('❌ Socket not connected, cannot send message');
          return;
        }
        
        // Use activeSocket.emit, not socket.emit
        activeSocket.emit(
          'user_uttered', {
            message: payload,
            customData: currentCustomData,
            session_id: sessionId
          }
        );
        
        store.dispatch({
          type: actionTypes.ADD_NEW_USER_MESSAGE,
          text: 'text',
          nextMessageIsTooltip: false,
          hidden: true
        });
      };
      
      if (currentSocketRef.sessionConfirmed) {
        emit();
      } else {
        currentSocketRef.on('session_confirm', () => {
          emit();
        });
      }
    };
    switch (action.type) {
      case actionTypes.EMIT_NEW_USER_MESSAGE: {
        emitMessage(action.text);
        break;
      }
      case actionTypes.GET_OPEN_STATE: {
        return store.getState().behavior.get('isChatOpen');
      }
      case actionTypes.GET_VISIBLE_STATE: {
        return store.getState().behavior.get('isChatVisible');
      }
      case actionTypes.GET_FULLSCREEN_STATE: {
        return store.getState().behavior.get('fullScreenMode');
      }
      case actionTypes.EVAL_URL: {
        const pageCallbacks = store.getState().behavior.get('pageChangeCallbacks');
        const pageCallbacksJs = pageCallbacks ? pageCallbacks.toJS() : {};

        const newUrl = action.url;

        if (!pageCallbacksJs.pageChanges) break;

        if (store.getState().behavior.get('oldUrl') !== newUrl) {
          const { pageChanges, errorIntent } = pageCallbacksJs;
          const matched = pageChanges.some((callback) => {
            if (callback.regex) {
              if (newUrl.match(callback.url)) {
                emitMessage(callback.callbackIntent);
                return true;
              }
            } else {
              let cleanCurrentUrl = cleanURL(newUrl);
              let cleanCallBackUrl = cleanURL(callback.url);
              if (!cleanCallBackUrl.match(/\?.+$/)) { // the callback does not have a querystring
                cleanCurrentUrl = trimQueryString(cleanCurrentUrl);
                cleanCallBackUrl = trimQueryString(cleanCallBackUrl);
              }
              if (cleanCurrentUrl === cleanCallBackUrl) {
                emitMessage(callback.callbackIntent);
                return true;
              }
              return false;
            }
          });
          if (!matched) emitMessage(errorIntent);
        }
        break;
      }
      default: {
        break;
      }
    }
    // console.log('Middleware triggered:', action);
    next(action);
  };
  const reducer = combineReducers({
    behavior: behavior(connectingText, storage, docViewer, onWidgetEvent),
    messages: messages(storage),
    metadata: metadata(storage)
  });


  // eslint-disable-next-line no-underscore-dangle
  const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

  const store = createStore(
    reducer,
    composeEnhancer(applyMiddleware(customMiddleWare)),
  );
  
  // Add method to update socket reference in middleware
  store.updateSocket = (newSocket) => {
    console.log('🔄 CRITICAL: Updating socket reference from', currentSocketRef.marker || 'unknown', 'to', newSocket.marker || 'unknown');
    currentSocketRef = newSocket;
    console.log('✅ Store socket reference updated successfully');
  };
  
  return store;
}


export { initStore };

import ImmutablePropTypes from 'react-immutable-proptypes';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
  toggleFullScreen,
  toggleChat,
  openChat,
  closeChat,
  showChat,
  addUserMessage,
  emitUserMessage,
  addResponseMessage,
  addCarousel,
  addVideoSnippet,
  addImageSnippet,
  addButtons,
  renderCustomComponent,
  initialize,
  connectServer,
  disconnectServer,
  pullSession,
  clearMessages,
  newUnreadMessage,
  triggerMessageDelayed,
  triggerTooltipSent,
  showTooltip,
  clearMetadata,
  setUserInput,
  setLinkTarget,
  setPageChangeCallbacks,
  changeOldUrl,
  setDomHighlight,
  evalUrl,
  setCustomCss,
  setFirstChatStarted,
  setBotProcessing
} from 'actions';
import { safeQuerySelectorAll } from 'utils/dom';
import { SESSION_NAME, NEXT_MESSAGE } from 'constants';
import { isVideo, isImage, isButtons, isText, isCarousel } from './msgProcessor';
import WidgetLayout from './layout';
import { storeLocalSession, getLocalSession } from '../../store/reducers/helper';
import logger from '../../utils/logger';
import { startBotProcessingTimeout, clearBotProcessingTimeout } from '../../utils/botProcessingTimeout';

class Widget extends Component {
  constructor(props) {
    super(props);
    this.messages = [];
    this.delayedMessage = null;
    this.messageDelayTimeout = null;
    this.onGoingMessageDelay = false;
    this.lastIsFinal = true; // Track last is_final value from bot_uttered
    this.sendMessage = this.sendMessage.bind(this);
    this.getSessionId = this.getSessionId.bind(this);
    this.getSessionIdWithFallback = this.getSessionIdWithFallback.bind(this);
    this.intervalId = null;
    this.eventListenerCleaner = () => { };
    this.socketHandlersRegistered = false; // Track if socket handlers are already registered
  }

  componentDidMount() {
    const { connectOn, autoClearCache, storage, dispatch, defaultHighlightAnimation } = this.props;
    // add the default highlight css to the document
    const styleNode = document.createElement('style');
    styleNode.innerHTML = defaultHighlightAnimation;
    document.body.appendChild(styleNode);

    dispatch(evalUrl(window.location.href));
    if (connectOn === 'mount') {
      this.initializeWidget();
      return;
    }


    const localSession = getLocalSession(storage, SESSION_NAME);
    const lastUpdate = localSession ? localSession.lastUpdate : 0;

    if (autoClearCache) {
      if (Date.now() - lastUpdate < 30 * 60 * 1000) {
        this.initializeWidget();
      } else {
        localStorage.removeItem(SESSION_NAME);
      }
    } else {
      this.checkVersionBeforePull();
      dispatch(pullSession());
      if (lastUpdate) this.initializeWidget();
    }
  }

  componentDidUpdate() {
    const { socket } = this.props;

    // Check if socket was recreated after token refresh
    if (socket && socket.needsReinitialization) {
      logger.info('🔄 Socket was recreated, re-registering event handlers...');
      // Clear the flag immediately to prevent multiple calls
      socket.needsReinitialization = false;
      // Re-register event handlers for the new socket
      this.registerSocketHandlers();
    }
  }

  componentWillUnmount() {
    const { socket } = this.props;

    if (socket) {
      socket.close();
    }
    clearTimeout(this.tooltipTimeout);
    clearInterval(this.intervalId);
    clearBotProcessingTimeout();
  }

  getSessionId() {
    const { storage } = this.props;
    // Get the local session, check if there is an existing session_id
    const localSession = getLocalSession(storage, SESSION_NAME);
    const localId = localSession ? localSession.session_id : null;
    return localId;
  }

  getSessionIdWithFallback() {
    const { storage, socket } = this.props;
    // Get the local session, check if there is an existing session_id
    const localSession = getLocalSession(storage, SESSION_NAME);
    let localId = localSession ? localSession.session_id : null;

    // If no sessionId in localStorage, try to get it from socket (same logic as in store.js)
    if (!localId && socket && socket.sessionId) {
      localId = socket.sessionId;
    }

    // If still no sessionId, check for preserved session_id (during token refresh)
    if (!localId && socket && socket.preservedSessionId) {
      localId = socket.preservedSessionId;
    }

    return localId;
  }

  sendMessage(payload, text = '', when = 'always', tooltipSelector = false) {
    const { dispatch, initialized, messages } = this.props;
    const emit = () => {
      const send = () => {
        dispatch(emitUserMessage(payload));
        if (text !== '') {
          dispatch(addUserMessage(text, tooltipSelector));
        } else {
          dispatch(addUserMessage('hidden', tooltipSelector, true));
        }
        if (tooltipSelector) {
          dispatch(closeChat());
          showTooltip(true);
        }
        // Mark that first chat has started
        dispatch(setFirstChatStarted());
        // Set bot processing state when user sends a message
        dispatch(setBotProcessing(true));
        // Start 30-second timeout to reset bot processing if backend hangs
        startBotProcessingTimeout(dispatch);
      };
      if (when === 'always') {
        send();
      } else if (when === 'init') {
        if (messages.size === 0) {
          send();
        }
      }
    };
    if (!initialized) {
      this.initializeWidget(false);
      dispatch(initialize());
      emit();
    } else {
      emit();
    }
  }

  handleMessageReceived(messageWithMetadata) {
    const { dispatch, isChatOpen, disableTooltips } = this.props;

    // we extract metadata so we are sure it does not interfer with type checking of the message
    const { metadata, ...message } = messageWithMetadata;
    if (!isChatOpen) {
      this.dispatchMessage(message);
      dispatch(newUnreadMessage());
      if (!disableTooltips) {
        dispatch(showTooltip(true));
        this.applyCustomStyle();
      }
    } else if (!this.onGoingMessageDelay) {
      this.onGoingMessageDelay = true;
      dispatch(triggerMessageDelayed(true));
      this.newMessageTimeout(message);
    } else {
      this.messages.push(message);
    }
  }

  popLastMessage() {
    const { dispatch } = this.props;
    if (this.messages.length) {
      this.onGoingMessageDelay = true;
      dispatch(triggerMessageDelayed(true));
      this.newMessageTimeout(this.messages.shift());
    }
  }

  newMessageTimeout(message) {
    const { dispatch, customMessageDelay } = this.props;
    this.delayedMessage = message;
    this.messageDelayTimeout = setTimeout(() => {
      this.dispatchMessage(message);
      this.delayedMessage = null;
      this.applyCustomStyle();
      dispatch(triggerMessageDelayed(false));
      this.onGoingMessageDelay = false;
      this.popLastMessage();
      // Hide WIP bubble only if:
      // 1. No more messages in queue
      // 2. Last bot_uttered had is_final:true
      // Add small delay to allow React to render buttons/replies before hiding WIP
      logger.debug('newMessageTimeout check:', {
        messagesLength: this.messages.length,
        lastIsFinal: this.lastIsFinal,
        willHideWIP: this.messages.length === 0 && this.lastIsFinal
      });
      if (this.messages.length === 0 && this.lastIsFinal) {
        setTimeout(() => {
          logger.debug('Hiding WIP after message displayed');
          dispatch(setBotProcessing(false));
          // Clear timeout when hiding WIP after final message
          clearBotProcessingTimeout();
        }, 100);
      }
    }, customMessageDelay(message.text || ''));
  }

  propagateMetadata(metadata) {
    const {
      dispatch
    } = this.props;
    const { linkTarget,
      userInput,
      pageChangeCallbacks,
      domHighlight,
      forceOpen,
      forceClose,
      pageEventCallbacks
    } = metadata;
    if (linkTarget) {
      dispatch(setLinkTarget(linkTarget));
    }
    if (userInput) {
      dispatch(setUserInput(userInput));
    }
    if (pageChangeCallbacks) {
      dispatch(changeOldUrl(window.location.href));
      dispatch(setPageChangeCallbacks(pageChangeCallbacks));
    }
    if (domHighlight) {
      dispatch(setDomHighlight(domHighlight));
    }
    if (forceOpen) {
      dispatch(openChat());
    }
    if (forceClose) {
      dispatch(closeChat());
    }
    if (pageEventCallbacks) {
      this.eventListenerCleaner = this.addCustomsEventListeners(pageEventCallbacks.pageEvents);
    }
  }

  handleBotUtterance(botUtterance) {
    const { dispatch, isChatOpen } = this.props;
    this.clearCustomStyle();
    this.eventListenerCleaner();
    dispatch(clearMetadata());

    // Handle is_final parameter for bot processing state
    // If is_final is explicitly set to false, keep WIP active
    // If is_final is explicitly set to true or missing, hide WIP after message is shown
    const isFinal = botUtterance.metadata?.is_final ?? botUtterance.is_final ?? true;

    logger.debug('handleBotUtterance:', {
      text: botUtterance.text?.substring(0, 50),
      isFinal,
      isChatOpen
    });

    // Store last is_final value to check in newMessageTimeout
    this.lastIsFinal = isFinal;

    // If chat is not open, message is displayed immediately without delay
    // So we can set isBotProcessing based on is_final immediately
    // If chat is open, message will have delay, so keep WIP active until message is shown
    if (!isChatOpen) {
      dispatch(setBotProcessing(!isFinal));
      if (isFinal) {
        // Clear timeout when receiving final message
        clearBotProcessingTimeout();
      } else {
        // Start timeout when receiving non-final message
        startBotProcessingTimeout(dispatch);
      }
    } else if (!isFinal) {
      // If not final and chat is open, keep showing WIP
      dispatch(setBotProcessing(true));
      // Start timeout when receiving non-final message
      startBotProcessingTimeout(dispatch);
    } else {
      // If final and chat is open, clear the timeout (WIP will be hidden after message delay)
      clearBotProcessingTimeout();
    }
    // If isFinal and chat is open, WIP will be hidden after message delay in newMessageTimeout

    if (botUtterance.metadata) this.propagateMetadata(botUtterance.metadata);

    // Fix: Convert \n to hard breaks (2 spaces + \n) for proper Markdown rendering
    // This ensures single line breaks are preserved in the output
    const fixedText = String(botUtterance.text).replace(/\n/g, '  \n');

    const newMessage = { ...botUtterance, text: fixedText };
    if (botUtterance.metadata && botUtterance.metadata.customCss) {
      newMessage.customCss = botUtterance.metadata.customCss;
    }
    this.handleMessageReceived(newMessage);
  }

  addCustomsEventListeners(pageEventCallbacks) {
    const eventsListeners = [];

    pageEventCallbacks.forEach((pageEvent) => {
      const { event, payload, selector } = pageEvent;
      const sendPayload = () => {
        this.sendMessage(payload);
      };

      if (event && payload && selector) {
        const elemList = document.querySelectorAll(selector);
        if (elemList.length > 0) {
          elemList.forEach((elem) => {
            eventsListeners.push({ elem, event, sendPayload });
            elem.addEventListener(event, sendPayload);
          });
        }
      }
    });

    const cleaner = () => {
      eventsListeners.forEach((eventsListener) => {
        eventsListener.elem.removeEventListener(eventsListener.event, eventsListener.sendPayload);
      });
    };

    return cleaner;
  }

  clearCustomStyle() {
    const { domHighlight, defaultHighlightClassname } = this.props;
    const domHighlightJS = domHighlight.toJS() || {};
    if (domHighlightJS.selector) {
      const elements = safeQuerySelectorAll(domHighlightJS.selector);
      elements.forEach((element) => {
        switch (domHighlightJS.style) {
          case 'custom':
            element.setAttribute('style', '');
            break;
          case 'class':
            element.classList.remove(domHighlightJS.css);
            break;
          default:
            if (defaultHighlightClassname !== '') {
              element.classList.remove(defaultHighlightClassname);
            } else {
              element.setAttribute('style', '');
            }
        }
      });
    }
  }

  applyCustomStyle() {
    const { domHighlight, defaultHighlightCss, defaultHighlightClassname } = this.props;
    const domHighlightJS = domHighlight.toJS() || {};
    if (domHighlightJS.selector) {
      const elements = safeQuerySelectorAll(domHighlightJS.selector);
      elements.forEach((element) => {
        switch (domHighlightJS.style) {
          case 'custom':
            element.setAttribute('style', domHighlightJS.css);
            break;
          case 'class':
            element.classList.add(domHighlightJS.css);
            break;
          default:
            if (defaultHighlightClassname !== '') {
              element.classList.add(defaultHighlightClassname);
            } else {
              element.setAttribute('style', defaultHighlightCss);
            }
        }
      });
      // We check that the method is here to prevent crashes on unsupported browsers.
      if (elements[0] && elements[0].scrollIntoView) {
        // If I don't use a timeout, the scrollToBottom in messages.jsx
        // seems to override that scrolling
        setTimeout(() => {
          if (/Mobi/.test(navigator.userAgent)) {
            elements[0].scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          } else {
            const rectangle = elements[0].getBoundingClientRect();

            const ElemIsInViewPort = (
              rectangle.top >= 0 &&
                rectangle.left >= 0 &&
                rectangle.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rectangle.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            if (!ElemIsInViewPort) {
              elements[0].scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }
          }
        }, 50);
      }
    }
  }

  checkVersionBeforePull() {
    const { storage } = this.props;
    const localSession = getLocalSession(storage, SESSION_NAME);
    if (localSession && (localSession.version !== 'PACKAGE_VERSION_TO_BE_REPLACED')) {
      storage.removeItem(SESSION_NAME);
    }
  }

  registerSocketHandlers(sendInitPayload = true) {
    const {
      storage,
      socket,
      dispatch,
      connectOn,
      tooltipPayload,
      tooltipDelay,
      customData
    } = this.props;

    // Skip if handlers already registered to prevent duplicates
    if (this.socketHandlersRegistered) {
      logger.info('⏭️ Socket handlers already registered, skipping...');
      return;
    }

    logger.info('📝 Registering socket event handlers...');

    // Register bot_uttered handler
    socket.on('bot_uttered', (botUttered) => {
      this.handleBotUtterance(botUttered);
    });

    // Register connect handler - CRITICAL for session_request
    const sendSessionRequest = () => {
      // Try to get existing session_id, including preserved one during token refresh
      let localId = this.getSessionId();

      // If no session in localStorage but socket has preservedSessionId, use it
      if (!localId && socket.preservedSessionId) {
        localId = socket.preservedSessionId;
        logger.debug('Using preserved session_id for token refresh:', localId);
      }

      logger.info('📤 Sending session_request', {
        session_id: localId || 'null (requesting new)',
        hasAuth: !!customData?.auth_header,
        socketId: socket.socket?.id
      });

      // DIAGNOSTIC: Check token expiration before session_request
      if (customData?.auth_header) {
        try {
          const tokenPayload = customData.auth_header.split('.')[1];
          const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
          const now = Date.now() / 1000;
          const timeLeft = decoded.exp - now;
          logger.info('🔍 SESSION_REQUEST: Access token expires in:', Math.round(timeLeft / 60), 'minutes');
          if (timeLeft < 0) {
            logger.error('❌ SESSION_REQUEST: Using EXPIRED access token! Expired', Math.round(-timeLeft / 60), 'minutes ago');
          }
        } catch (e) {
          logger.error('❌ SESSION_REQUEST: Failed to decode access token:', e);
        }
      }

      // Only include session_id if we have one, otherwise let backend create new one
      const payload = { customData };
      if (localId) {
        payload.session_id = localId;
      }

      socket.emit('session_request', payload);
    };

    socket.on('connect', sendSessionRequest);

    // CRITICAL: If socket is already connected, send session_request immediately
    if (socket.isInitialized()) {
      logger.info('🔄 Socket already connected, sending session_request immediately');
      sendSessionRequest();
    }

    // Register session_confirm handler
    socket.on('session_confirm', (sessionObject) => {
      const remoteId = (sessionObject && sessionObject.session_id)
        ? sessionObject.session_id
        : sessionObject;

      logger.info(`session_confirm:${socket.socket.id} session_id:${remoteId}`);

      // Store the initial state to both the redux store and the storage, set connected to true
      dispatch(connectServer());

      let localId = this.getSessionId();

      // If we were trying to preserve a session_id during token refresh
      if (!localId && socket.preservedSessionId) {
        localId = socket.preservedSessionId;
        logger.info(`Token refresh: requested preserved session_id ${localId}, server returned ${remoteId}`);
      }

      if (localId !== remoteId) {
        // Store the received session_id to storage
        storeLocalSession(storage, SESSION_NAME, remoteId);
        dispatch(pullSession());
        if (sendInitPayload) {
          this.trySendInitPayload();
        }
      } else {
        logger.info('Session_id preserved successfully during token refresh');

        // If this is an existing session, it's possible we changed pages and want to send a
        // user message when we land.
        const nextMessage = window.localStorage.getItem(NEXT_MESSAGE);

        if (nextMessage !== null) {
          const { message, expiry } = JSON.parse(nextMessage);
          window.localStorage.removeItem(NEXT_MESSAGE);

          if (expiry === 0 || expiry > Date.now()) {
            dispatch(addUserMessage(message));
            dispatch(emitUserMessage(message));
            dispatch(setBotProcessing(true));
            // Start 30-second timeout to reset bot processing if backend hangs
            startBotProcessingTimeout(dispatch);
          }
        }
      }

      // Clear preserved session_id after use
      if (socket.preservedSessionId) {
        delete socket.preservedSessionId;
      }

      if (connectOn === 'mount' && tooltipPayload) {
        this.tooltipTimeout = setTimeout(() => {
          this.trySendTooltipPayload();
        }, parseInt(tooltipDelay, 10));
      }
    });

    // Register disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('Disconnected:', reason);
      if (reason !== 'io client disconnect') {
        dispatch(disconnectServer());
      }
    });

    // Mark handlers as registered
    this.socketHandlersRegistered = true;

    logger.info('✅ Socket event handlers registered');
  }

  initializeWidget(sendInitPayload = true) {
    const {
      socket,
      dispatch,
      embedded,
      initialized
    } = this.props;

    if (!socket.isInitialized()) {
      socket.createSocket();

      this.checkVersionBeforePull();
      dispatch(pullSession());

      // Register all socket event handlers
      this.registerSocketHandlers(sendInitPayload);
    }

    if (embedded && initialized) {
      dispatch(showChat());
      dispatch(openChat());
    }
  }

  // TODO: Need to erase redux store on load if localStorage
  // is erased. Then behavior on reload can be consistent with
  // behavior on first load

  trySendInitPayload() {
    const {
      customData,
      socket,
      initialized,
      isChatOpen,
      isChatVisible,
      embedded,
      connected,
      dispatch
    } = this.props;

    // Send initial payload when chat is opened or widget is shown
    if (!initialized && connected && ((isChatOpen && isChatVisible) || embedded)) {
      // Only send initial payload if the widget is connected to the server but not yet initialized

      const sessionId = this.getSessionId();
      // check that session_id is confirmed
      if (!sessionId) return;

      // DIAGNOSTIC: Check token expiration before /session_start
      if (customData?.auth_header) {
        try {
          const tokenPayload = customData.auth_header.split('.')[1];
          const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
          const now = Date.now() / 1000;
          const timeLeft = decoded.exp - now;
          logger.info('🔍 INIT_PAYLOAD (/session_start): Access token expires in:', Math.round(timeLeft / 60), 'minutes');
          if (timeLeft < 0) {
            logger.error('❌ INIT_PAYLOAD: Sending /session_start with EXPIRED access token! Expired', Math.round(-timeLeft / 60), 'minutes ago');
          }
        } catch (e) {
          logger.error('❌ INIT_PAYLOAD: Failed to decode access token:', e);
        }
      }

      socket.emit('user_uttered', { message: '/session_start', customData, session_id: sessionId });
      dispatch(initialize());
      // Show WIP bubble while waiting for bot's response to /session_start
      dispatch(setBotProcessing(true));
      // Start 30-second timeout to reset bot processing if backend hangs
      startBotProcessingTimeout(dispatch);
    }
  }

  trySendTooltipPayload() {
    const {
      tooltipPayload,
      socket,
      customData,
      connected,
      isChatOpen,
      dispatch,
      tooltipSent
    } = this.props;

    if (connected && !isChatOpen && !tooltipSent.get(tooltipPayload)) {
      const sessionId = this.getSessionId();

      if (!sessionId) return;

      // DIAGNOSTIC: Check token expiration before tooltip
      if (customData?.auth_header) {
        try {
          const tokenPayload = customData.auth_header.split('.')[1];
          const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
          const now = Date.now() / 1000;
          const timeLeft = decoded.exp - now;
          logger.info('🔍 TOOLTIP: Access token expires in:', Math.round(timeLeft / 60), 'minutes');
          if (timeLeft < 0) {
            logger.error('❌ TOOLTIP: Sending tooltip with EXPIRED access token! Expired', Math.round(-timeLeft / 60), 'minutes ago');
          }
        } catch (e) {
          logger.error('❌ TOOLTIP: Failed to decode access token:', e);
        }
      }

      socket.emit('user_uttered', { message: tooltipPayload, customData, session_id: sessionId });

      dispatch(triggerTooltipSent(tooltipPayload));
      dispatch(initialize());
    }
  }

  toggleConversation() {
    const {
      isChatOpen,
      dispatch,
      disableTooltips
    } = this.props;
    if (isChatOpen && this.delayedMessage) {
      if (!disableTooltips) dispatch(showTooltip(true));
      clearTimeout(this.messageDelayTimeout);
      this.dispatchMessage(this.delayedMessage);
      dispatch(newUnreadMessage());
      this.onGoingMessageDelay = false;
      dispatch(triggerMessageDelayed(false));
      this.messages.forEach((message) => {
        this.dispatchMessage(message);
        dispatch(newUnreadMessage());
      });
      this.applyCustomStyle();

      this.messages = [];
      this.delayedMessage = null;
    } else {
      this.props.dispatch(showTooltip(false));
    }
    clearTimeout(this.tooltipTimeout);
    dispatch(toggleChat());
  }

  toggleFullScreen() {
    this.props.dispatch(toggleFullScreen());
  }

  dispatchMessage(message) {
    if (Object.keys(message).length === 0) {
      return;
    }
    const { customCss, ...messageClean } = message;

    if (isText(messageClean)) {
      this.props.dispatch(addResponseMessage(messageClean.text));
    } else if (isButtons(messageClean)) {
      this.props.dispatch(addButtons(messageClean));
    } else if (isCarousel(messageClean)) {
      this.props.dispatch(
        addCarousel(messageClean)
      );
    } else if (isVideo(messageClean)) {
      const element = messageClean.attachment.payload;
      this.props.dispatch(
        addVideoSnippet({
          title: element.title,
          video: element.src
        })
      );
    } else if (isImage(messageClean)) {
      const element = messageClean.attachment.payload;
      this.props.dispatch(
        addImageSnippet({
          title: element.title,
          image: element.src
        })
      );
    } else {
      // some custom message
      const props = messageClean;
      if (this.props.customComponent) {
        this.props.dispatch(renderCustomComponent(this.props.customComponent, props, true));
      }
    }
    if (customCss) {
      this.props.dispatch(setCustomCss(message.customCss));
    }
  }

  handleMessageSubmit(event) {
    event.preventDefault();
    const userUttered = event.target.message.value;

    if (userUttered && userUttered.trim()) {
      const result = userUttered.replace(/(?:start[_]?flows?|set[_]?slots?)\([^)]*\)/gi, '');
      this.props.dispatch(addUserMessage(result));
      this.props.dispatch(emitUserMessage(result));
      // Mark that first chat has started
      this.props.dispatch(setFirstChatStarted());
      // Set bot processing state when user sends a message
      this.props.dispatch(setBotProcessing(true));
      // Start 30-second timeout to reset bot processing if backend hangs
      startBotProcessingTimeout(this.props.dispatch);
    }
    event.target.message.value = '';
  }


  // Compose behavior: first try to refresh token (new feature), then perform legacy restart (old behavior)
  refreshTokenAndRestart = () => {
    const { onRefreshToken } = this.props;
    try {
      const maybePromise = onRefreshToken ? onRefreshToken() : null;
      if (maybePromise && typeof maybePromise.then === 'function') {
        return maybePromise
          .catch((err) => {
            logger.error('Manual token refresh failed before restart:', err);
          })
          .finally(() => {
            this.refresh();
          });
      }
      // If refresh function not provided or doesn't return a promise, proceed with legacy restart immediately
      this.refresh();
      return Promise.resolve();
    } catch (e) {
      // Ensure legacy behavior even if something goes wrong
      this.refresh();
      return Promise.resolve();
    }
  }

  refresh = () => {
    const { socket, customData } = this.props;
    const sessionId = this.getSessionIdWithFallback();

    {
      logger.info('=== SESSION RESTART ===');
      logger.debug('Session ID (must not change):', sessionId);
      logger.debug('Socket ID (sender, must not change):', socket.socket ? socket.socket.id : 'N/A');
      logger.debug('customData.auth_header:', customData.auth_header ? customData.auth_header.substring(0, 20) + '...' : 'N/A');

      // DIAGNOSTIC: Check token expiration during restart
      if (customData.auth_header) {
        try {
          const tokenPayload = customData.auth_header.split('.')[1];
          const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
          const now = Date.now() / 1000;
          const timeLeft = decoded.exp - now;
          logger.info('🔍 RESTART: Access token expires in:', Math.round(timeLeft / 60), 'minutes');
          if (timeLeft < 0) {
            logger.error('❌ RESTART: Using EXPIRED access token! Expired', Math.round(-timeLeft / 60), 'minutes ago');
          }
        } catch (e) {
          logger.error('❌ RESTART: Failed to decode access token:', e);
        }
      }
    }

    // Reset socket handlers registration flag to allow re-registration
    this.socketHandlersRegistered = false;

    // Remove session_id from customData if it exists to avoid duplication
    const cleanCustomData = { ...customData };
    delete cleanCustomData.session_id;

    {
      logger.debug('Cleaned customData:', cleanCustomData);
    }

    this.props.dispatch(clearMessages());

    // First send /restart
    socket.emit('user_uttered', {
      message: '/restart',
      customData: cleanCustomData,
      session_id: sessionId // TODO: here
    });

    logger.info('Restart payload sent with session_id:', sessionId);
    logger.info('=== END SESSION RESTART ===');
  }

  render() {
    return (
      <WidgetLayout
        onAuthButtonClick={this.props.onAuthButtonClick}
        toggleChat={() => this.toggleConversation()}
        refreshSession={this.refreshTokenAndRestart}
        toggleFullScreen={() => this.toggleFullScreen()}
        onSendMessage={event => this.handleMessageSubmit(event)}
        title={this.props.title}
        subtitle={this.props.subtitle}
        customData={this.props.customData}
        profileAvatar={this.props.profileAvatar}
        showCloseButton={this.props.showCloseButton}
        showFullScreenButton={this.props.showFullScreenButton}
        hideWhenNotConnected={this.props.hideWhenNotConnected}
        fullScreenMode={this.props.fullScreenMode}
        isChatOpen={this.props.isChatOpen}
        isChatVisible={this.props.isChatVisible}
        badge={this.props.badge}
        embedded={this.props.embedded}
        params={this.props.params}
        openLauncherImage={this.props.openLauncherImage}
        inputTextFieldHint={this.props.inputTextFieldHint}
        closeImage={this.props.closeImage}
        customComponent={this.props.customComponent}
        displayUnreadCount={this.props.displayUnreadCount}
        showMessageDate={this.props.showMessageDate}
        tooltipPayload={this.props.tooltipPayload}
        firstChatStarted={this.props.firstChatStarted}
      />
    );
  }
}

const mapStateToProps = state => ({
  initialized: state.behavior.get('initialized'),
  connected: state.behavior.get('connected'),
  isChatOpen: state.behavior.get('isChatOpen'),
  isChatVisible: state.behavior.get('isChatVisible'),
  fullScreenMode: state.behavior.get('fullScreenMode'),
  tooltipSent: state.metadata.get('tooltipSent'),
  oldUrl: state.behavior.get('oldUrl'),
  pageChangeCallbacks: state.behavior.get('pageChangeCallbacks'),
  domHighlight: state.metadata.get('domHighlight'),
  messages: state.messages,
  firstChatStarted: state.behavior.get('firstChatStarted')
});

Widget.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  customData: PropTypes.shape({}),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  profileAvatar: PropTypes.string,
  showCloseButton: PropTypes.bool,
  showFullScreenButton: PropTypes.bool,
  hideWhenNotConnected: PropTypes.bool,
  connectOn: PropTypes.oneOf(['mount', 'open']),
  autoClearCache: PropTypes.bool,
  fullScreenMode: PropTypes.bool,
  isChatVisible: PropTypes.bool,
  isChatOpen: PropTypes.bool,
  badge: PropTypes.number,
  socket: PropTypes.shape({}),
  embedded: PropTypes.bool,
  params: PropTypes.shape({}),
  connected: PropTypes.bool,
  initialized: PropTypes.bool,
  openLauncherImage: PropTypes.string,
  closeImage: PropTypes.string,
  inputTextFieldHint: PropTypes.string,
  customComponent: PropTypes.func,
  displayUnreadCount: PropTypes.bool,
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  customMessageDelay: PropTypes.func.isRequired,
  tooltipPayload: PropTypes.string,
  tooltipSent: PropTypes.shape({}),
  tooltipDelay: PropTypes.number.isRequired,
  domHighlight: PropTypes.shape({}),
  storage: PropTypes.shape({}),
  disableTooltips: PropTypes.bool,
  defaultHighlightAnimation: PropTypes.string,
  defaultHighlightCss: PropTypes.string,
  defaultHighlightClassname: PropTypes.string,
  messages: ImmutablePropTypes.listOf(ImmutablePropTypes.map),
  onAuthButtonClick: PropTypes.func,
  onRefreshToken: PropTypes.func,
  firstChatStarted: PropTypes.bool
};

Widget.defaultProps = {
  isChatOpen: false,
  isChatVisible: true,
  fullScreenMode: false,
  connectOn: 'mount',
  autoClearCache: false,
  displayUnreadCount: false,
  tooltipPayload: null,
  refreshSessoin: null,
  inputTextFieldHint: 'Type a message...',
  oldUrl: '',
  disableTooltips: true,
  defaultHighlightClassname: '',
  defaultHighlightCss: 'animation: 0.5s linear infinite alternate default-botfront-blinker-animation; outline-style: solid;',
  // unfortunately it looks like outline-style is not an animatable property on Safari
  defaultHighlightAnimation: `@keyframes default-botfront-blinker-animation {
    0% {
      outline-color: rgba(0,255,0,0);
    }
    49% {
      outline-color: rgba(0,255,0,0);
    }
    50% {
      outline-color:green;
    }
    100% {
      outline-color: green;
    }
  }`
};

export default connect(mapStateToProps, null, null, { forwardRef: true })(Widget);

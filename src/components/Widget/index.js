import ImmutablePropTypes from 'react-immutable-proptypes';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { logTokenExpiration } from '../../utils/TokenDiagnostics';
import {
  toggleFullScreen,
  toggleChat,
  openChat,
  closeChat,
  showChat,
  addUserMessage,
  emitUserMessage,
  initialize,
  pullSession,
  clearMessages,
  newUnreadMessage,
  triggerMessageDelayed,
  triggerTooltipSent,
  showTooltip,
  evalUrl,
  setFirstChatStarted,
  setBotProcessing
} from '../../store/actions';
import { SESSION_NAME, NEXT_MESSAGE } from '../../constants';
import WidgetLayout from './layout';
import { storeLocalSession } from '../../store/reducers/helper';
import logger from '../../utils/logger';
import { MessageQueueManager } from '../../services/MessageQueueManager';
import { MessageDispatcher } from '../../utils/MessageDispatcher';
import { SocketEventManager } from '../../services/SocketEventManager';
import { SessionManager } from '../../services/SessionManager';
import { DomHighlightManager } from '../../services/DomHighlightManager';
import { CustomEventManager } from '../../utils/CustomEventManager';
import { MetadataPropagator } from '../../utils/MetadataPropagator';
import { BotUtteranceHandler } from '../../handlers/BotUtteranceHandler';


class Widget extends Component {
  constructor(props) {
    super(props);

    // Initialize managers
    this.messageDispatcher = new MessageDispatcher(props.dispatch, props.customComponent);

    this.messageQueueManager = new MessageQueueManager({
      customMessageDelay: props.customMessageDelay,
      onMessageReady: (message) => {
        this.messageDispatcher.dispatchMessage(message);
        props.dispatch(triggerMessageDelayed(false));
      },
      onQueueEmpty: () => {
        props.dispatch(setBotProcessing(false));
      }
    });

    this.sessionManager = new SessionManager(props.storage);

    this.domHighlightManager = new DomHighlightManager({
      defaultHighlightCss: props.defaultHighlightCss,
      defaultHighlightClassname: props.defaultHighlightClassname
    });

    this.customEventManager = new CustomEventManager();

    this.metadataPropagator = new MetadataPropagator(props.dispatch);

    this.botUtteranceHandler = new BotUtteranceHandler({
      dispatch: props.dispatch,
      getIsChatOpen: () => this.props.isChatOpen,
      metadataPropagator: this.metadataPropagator,
      domHighlightManager: this.domHighlightManager,
      messageQueueManager: this.messageQueueManager,
      customEventManager: this.customEventManager,
      sendMessage: (payload) => this.sendMessage(payload),
      domHighlight: props.domHighlight
    });

    this.socketEventManager = null; // Initialized in componentDidMount

    this.sendMessage = this.sendMessage.bind(this);
    this.tooltipTimeout = null;
  }

  componentDidMount() {
    const { connectOn, autoClearCache, dispatch, defaultHighlightAnimation, socket, storage, customData, connectOn: connectOnProp, tooltipPayload, tooltipDelay } = this.props;

    // Add the default highlight css to the document
    const styleNode = document.createElement('style');
    styleNode.innerHTML = defaultHighlightAnimation;
    document.body.appendChild(styleNode);

    // Initialize socket event manager
    this.socketEventManager = new SocketEventManager({
      socket,
      storage,
      customData,
      dispatch,
      connectOn: connectOnProp,
      tooltipPayload,
      tooltipDelay,
      onBotUtterance: (botUtterance) => this.handleBotUtterance(botUtterance),
      onSessionConfirm: (sessionId, isNewSession, shouldSendInitPayload, shouldSendTooltip) => {
        this.handleSessionConfirm(sessionId, isNewSession, shouldSendInitPayload, shouldSendTooltip);
      },
      onDisconnect: (reason) => {
        // Additional disconnect handling if needed
      }
    });

    dispatch(evalUrl(window.location.href));

    if (connectOn === 'mount') {
      this.initializeWidget();
      return;
    }

    if (autoClearCache) {
      if (this.sessionManager.shouldInitialize(true)) {
        this.initializeWidget();
      } else {
        this.sessionManager.clearSession();
      }
    } else {
      this.sessionManager.checkVersion();
      dispatch(pullSession());
      if (this.sessionManager.getLastUpdate()) {
        this.initializeWidget();
      }
    }
  }

  componentDidUpdate(prevProps) {
    const { socket, customData, domHighlight } = this.props;

    // Check if socket was recreated after token refresh
    if (socket && socket.needsReinitialization) {
      logger.info('🔄 Socket was recreated, re-registering event handlers...');
      // Clear the flag immediately to prevent multiple calls
      socket.needsReinitialization = false;
      // Re-register event handlers for the new socket
      this.socketEventManager.resetHandlers();
      this.socketEventManager.register(true);
    }

    // Update customData in socket event manager if changed
    if (customData !== prevProps.customData) {
      this.socketEventManager.updateCustomData(customData);
    }

    // Update domHighlight in bot utterance handler if changed
    if (domHighlight !== prevProps.domHighlight) {
      this.botUtteranceHandler.updateDomHighlight(domHighlight);
    }
  }

  componentWillUnmount() {
    const { socket } = this.props;

    if (socket) {
      socket.close();
    }

    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    // Cleanup managers
    this.messageQueueManager.clear();
    this.customEventManager.clearAll();
    if (this.socketEventManager) {
      this.socketEventManager.unregister();
    }
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

  handleBotUtterance(botUtterance) {
    const { dispatch, isChatOpen, disableTooltips } = this.props;

    // Use BotUtteranceHandler to process the utterance
    const message = this.botUtteranceHandler.handle(botUtterance);

    // Extract metadata to avoid interference with type checking
    const { metadata, ...messageClean } = message;

    // Add message to queue
    this.messageQueueManager.addMessage(
      messageClean,
      isChatOpen,
      () => dispatch(newUnreadMessage()),
      !disableTooltips ? () => dispatch(showTooltip(true)) : null,
      () => this.applyCustomStyle()
    );

    // Trigger message delayed state if chat is open
    if (isChatOpen && !this.messageQueueManager.isProcessing) {
      dispatch(triggerMessageDelayed(true));
    }
  }

  applyCustomStyle() {
    const { domHighlight } = this.props;
    this.domHighlightManager.applyHighlight(domHighlight);
  }

  handleSessionConfirm(sessionId, isNewSession, shouldSendInitPayload, shouldSendTooltip) {
    const { dispatch, storage } = this.props;

    if (isNewSession) {
      // Store the received session_id to storage
      storeLocalSession(storage, SESSION_NAME, sessionId);
      dispatch(pullSession());
      if (shouldSendInitPayload) {
        this.trySendInitPayload();
      }
    } else {
      // Existing session - check for queued message
      const nextMessage = window.localStorage.getItem(NEXT_MESSAGE);

      if (nextMessage !== null) {
        const { message, expiry } = JSON.parse(nextMessage);
        window.localStorage.removeItem(NEXT_MESSAGE);

        if (expiry === 0 || expiry > Date.now()) {
          dispatch(addUserMessage(message));
          dispatch(emitUserMessage(message));
          dispatch(setBotProcessing(true));
        }
      }
    }

    // Handle tooltip
    if (shouldSendTooltip) {
      this.trySendTooltipPayload();
    }
  }

  initializeWidget(sendInitPayload = true) {
    const { socket, dispatch, embedded, initialized } = this.props;

    if (!socket.isInitialized()) {
      socket.createSocket();

      this.sessionManager.checkVersion();
      dispatch(pullSession());

      // Register all socket event handlers
      this.socketEventManager.register(sendInitPayload);
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

      const sessionId = this.sessionManager.getSessionId();
      // check that session_id is confirmed
      if (!sessionId) return;

      // DIAGNOSTIC: Check token expiration before /session_start
      if (customData?.auth_header) {
        logTokenExpiration(customData.auth_header, '🔍 INIT_PAYLOAD (/session_start)');
      }

      socket.emit('user_uttered', { message: '/session_start', customData, session_id: sessionId });
      dispatch(initialize());
      // Show WIP bubble while waiting for bot's response to /session_start
      dispatch(setBotProcessing(true));
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
      const sessionId = this.sessionManager.getSessionId();

      if (!sessionId) return;

      // DIAGNOSTIC: Check token expiration before tooltip
      if (customData?.auth_header) {
        logTokenExpiration(customData.auth_header, '🔍 TOOLTIP');
      }

      socket.emit('user_uttered', { message: tooltipPayload, customData, session_id: sessionId });

      dispatch(triggerTooltipSent(tooltipPayload));
      dispatch(initialize());
    }
  }

  toggleConversation() {
    const { dispatch, disableTooltips } = this.props;

    // Flush delayed messages if chat is being closed
    if (this.props.isChatOpen && this.messageQueueManager.getDelayedMessage()) {
      if (!disableTooltips) dispatch(showTooltip(true));

      this.messageQueueManager.flushAll(
        (message) => this.messageDispatcher.dispatchMessage(message),
        () => dispatch(newUnreadMessage()),
        () => this.applyCustomStyle()
      );
    } else {
      dispatch(showTooltip(false));
    }

    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    dispatch(toggleChat());
  }

  toggleFullScreen() {
    this.props.dispatch(toggleFullScreen());
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
    const { socket, customData: propsCustomData } = this.props;
    const sessionId = this.sessionManager.getSessionIdWithFallback(socket);

    // CRITICAL: Use socket.customData if available (contains fresh token after manual refresh)
    // Otherwise fall back to props.customData
    const customData = (socket && socket.socket && socket.socket.customData) || propsCustomData;

    {
      logger.info('=== SESSION RESTART ===');
      logger.debug('Using customData from:', socket?.socket?.customData ? 'socket.customData (fresh)' : 'props.customData');
      logger.debug('Session ID (must not change):', sessionId);
      logger.debug('Socket ID (sender, must not change):', socket.socket ? socket.socket.id : 'N/A');
      logger.debug('customData.auth_header:', customData.auth_header ? customData.auth_header.substring(0, 20) + '...' : 'N/A');

      // DIAGNOSTIC: Check token expiration during restart
      if (customData.auth_header) {
        logTokenExpiration(customData.auth_header, '🔍 RESTART');
      }
    }

    // IMPORTANT: Do NOT reset handlers on refresh!
    // Socket remains the same, only sending /restart message to backend
    // Handlers were already registered and should stay registered

    // CRITICAL: Preserve session_id for potential reconnect after restart
    if (sessionId && socket) {
      socket.preservedSessionId = sessionId;
      logger.debug('🔒 Preserved session_id for potential reconnect:', sessionId);
    }

    // Remove session_id from customData if it exists to avoid duplication
    const cleanCustomData = { ...customData };
    delete cleanCustomData.session_id;

    {
      logger.debug('Cleaned customData:', cleanCustomData);
    }

    // Clear Redux store messages
    this.props.dispatch(clearMessages());

    // IMPORTANT: Clear message queue to prevent old delayed messages from appearing
    this.messageQueueManager.clear();

    // Send /restart to backend (backend will send greeting messages again)
    const restartPayload = {
      message: '/restart',
      customData: cleanCustomData,
      session_id: sessionId
    };

    logger.info('📤 RESTART: Payload to send:', {
      message: restartPayload.message,
      session_id: restartPayload.session_id,
      customData_keys: Object.keys(cleanCustomData),
      customData_auth_header_prefix: cleanCustomData.auth_header ? cleanCustomData.auth_header.substring(0, 30) + '...' : 'NULL'
    });

    socket.emit('user_uttered', restartPayload);

    logger.info('✅ RESTART: Payload sent with session_id:', sessionId);
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
  initPayload: PropTypes.string,
  profileAvatar: PropTypes.string,
  refreshSession: PropTypes.func,
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

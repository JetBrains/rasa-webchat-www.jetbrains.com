/**
 * SocketEventManager - Manages socket.io event handlers
 * Extracted from Widget component to improve code organization
 */

import logger from '../utils/logger';
import { logTokenExpiration } from '../utils/TokenDiagnostics';
import { connectServer, disconnectServer } from 'actions';
import { SESSION_NAME, NEXT_MESSAGE } from 'constants';
import { getLocalSession, storeLocalSession } from '../store/reducers/helper';

export class SocketEventManager {
  constructor(config) {
    this.socket = config.socket;
    this.storage = config.storage;
    this.customData = config.customData;
    this.dispatch = config.dispatch;
    this.connectOn = config.connectOn;
    this.tooltipPayload = config.tooltipPayload;
    this.tooltipDelay = config.tooltipDelay;

    // Callbacks
    this.onBotUtterance = config.onBotUtterance;
    this.onSessionConfirm = config.onSessionConfirm;
    this.onDisconnect = config.onDisconnect;

    // State
    this.handlersRegistered = false;
    this.sendInitPayload = true;
    this.tooltipTimeout = null;
  }

  /**
   * Update custom data (for token refresh)
   * @param {Object} newCustomData - New custom data
   */
  updateCustomData(newCustomData) {
    this.customData = newCustomData;
  }

  /**
   * Register all socket event handlers
   * @param {boolean} sendInitPayload - Whether to send init payload on session confirm
   */
  register(sendInitPayload = true) {
    if (this.handlersRegistered) {
      logger.info('⏭️ Socket handlers already registered, skipping...');
      return;
    }

    logger.info('📝 Registering socket event handlers...');

    this.sendInitPayload = sendInitPayload;

    // Register bot_uttered handler
    this.socket.on('bot_uttered', (botUttered) => {
      this.handleBotUttered(botUttered);
    });

    // Register connect handler - CRITICAL for session_request
    this.socket.on('connect', () => {
      this.handleConnect();
    });

    // Register session_confirm handler
    this.socket.on('session_confirm', (sessionObject) => {
      this.handleSessionConfirm(sessionObject);
    });

    // Register disconnect handler
    this.socket.on('disconnect', (reason) => {
      this.handleDisconnect(reason);
    });

    // Mark handlers as registered
    this.handlersRegistered = true;

    // CRITICAL: If socket is already connected, send session_request immediately
    if (this.socket.isInitialized()) {
      logger.info('🔄 Socket already connected, sending session_request immediately');
      this.sendSessionRequest();
    }

    logger.info('✅ Socket event handlers registered');
  }

  /**
   * Unregister handlers (for cleanup)
   */
  unregister() {
    this.handlersRegistered = false;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  /**
   * Reset handlers flag (for socket recreation)
   */
  resetHandlers() {
    this.handlersRegistered = false;
  }

  /**
   * Handle bot_uttered event
   * @param {Object} botUttered - Bot utterance data
   */
  handleBotUttered(botUttered) {
    if (this.onBotUtterance) {
      this.onBotUtterance(botUttered);
    }
  }

  /**
   * Handle connect event
   */
  handleConnect() {
    this.sendSessionRequest();
  }

  /**
   * Send session_request to server
   */
  sendSessionRequest() {
    // Try to get existing session_id
    let localId = this.getSessionId();

    // If no session in localStorage but socket has preservedSessionId, use it
    if (!localId && this.socket.preservedSessionId) {
      localId = this.socket.preservedSessionId;
      logger.debug('Using preserved session_id for token refresh:', localId);
    }

    logger.info('📤 Sending session_request', {
      session_id: localId || 'null (requesting new)',
      hasAuth: !!this.customData?.auth_header,
      socketId: this.socket.socket?.id
    });

    // DIAGNOSTIC: Check token expiration before session_request
    if (this.customData?.auth_header) {
      logTokenExpiration(this.customData.auth_header, '🔍 SESSION_REQUEST');
    }

    // Only include session_id if we have one, otherwise let backend create new one
    const payload = { customData: this.customData };
    if (localId) {
      payload.session_id = localId;
    }

    this.socket.emit('session_request', payload);
  }

  /**
   * Handle session_confirm event
   * @param {Object|string} sessionObject - Session object or session_id string
   */
  handleSessionConfirm(sessionObject) {
    const remoteId = (sessionObject && sessionObject.session_id)
      ? sessionObject.session_id
      : sessionObject;

    logger.info(`session_confirm:${this.socket.socket.id} session_id:${remoteId}`);

    // Store the initial state to both the redux store and the storage, set connected to true
    this.dispatch(connectServer());

    let localId = this.getSessionId();

    // If we were trying to preserve a session_id during token refresh
    if (!localId && this.socket.preservedSessionId) {
      localId = this.socket.preservedSessionId;
      logger.info(`Token refresh: requested preserved session_id ${localId}, server returned ${remoteId}`);
    }

    if (localId !== remoteId) {
      // New session - store it and trigger init payload
      if (this.onSessionConfirm) {
        this.onSessionConfirm(remoteId, true, this.sendInitPayload);
      }
    } else {
      logger.info('Session_id preserved successfully during token refresh');

      // Existing session - check for queued message
      if (this.onSessionConfirm) {
        this.onSessionConfirm(remoteId, false, this.sendInitPayload);
      }
    }

    // Clear preserved session_id after use
    if (this.socket.preservedSessionId) {
      delete this.socket.preservedSessionId;
    }

    // Schedule tooltip if needed
    if (this.connectOn === 'mount' && this.tooltipPayload) {
      this.tooltipTimeout = setTimeout(() => {
        if (this.onSessionConfirm) {
          // Signal tooltip should be sent
          this.onSessionConfirm(remoteId, false, false, true);
        }
      }, parseInt(this.tooltipDelay, 10));
    }
  }

  /**
   * Handle disconnect event
   * @param {string} reason - Disconnect reason
   */
  handleDisconnect(reason) {
    logger.info('Disconnected:', reason);
    if (reason !== 'io client disconnect') {
      this.dispatch(disconnectServer());
    }
    if (this.onDisconnect) {
      this.onDisconnect(reason);
    }
  }

  /**
   * Get session_id from storage
   * @returns {string|null}
   */
  getSessionId() {
    const localSession = getLocalSession(this.storage, SESSION_NAME);
    return localSession ? localSession.session_id : null;
  }
}

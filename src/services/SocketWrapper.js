/**
 * SocketWrapper - Socket.IO connection wrapper
 * Encapsulates socket lifecycle management and event handling
 * Extracted from index.js to improve code organization and testability
 */

import logger from '../utils/logger';
import socket from '../sockets/socket';

/**
 * Socket wrapper class that manages Socket.IO connection lifecycle
 */
export class SocketWrapper {
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
    this.sessionId = null;
    this.sessionConfirmed = false;
    this.preservedSessionId = null;
    this.isDisconnecting = false;
    this.needsReinitialization = false;
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

      // Detailed logging for debugging
      logger.info(`📤 EMIT: Event="${message}"`);
      if (data) {
        const safeData = { ...data };
        if (safeData.customData && safeData.customData.auth_header) {
          safeData.customData = {
            ...safeData.customData,
            auth_header: safeData.customData.auth_header.substring(0, 30) + '...'
          };
        }
        logger.info(`📤 EMIT: Data keys:`, Object.keys(data));
        logger.info(`📤 EMIT: Data (sanitized):`, safeData);
      }

      // Check current socket auth state
      logger.debug('🔍 EMIT: socket.auth:', this.socket.auth);
      logger.debug('🔍 EMIT: engine.opts.extraHeaders:', this.socket.io?.engine?.opts?.extraHeaders);

      this.socket.emit(message, data);
      logger.info(`✅ EMIT: "${message}" sent successfully`);
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

    // Set up session_confirm handler to preserve session continuity
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

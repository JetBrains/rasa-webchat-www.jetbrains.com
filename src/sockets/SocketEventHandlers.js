/**
 * Socket Event Handlers Factory
 * Creates consistent socket event handlers with token refresh logic
 * Extracted from index.js to improve code organization and testability
 */

import logger from '../utils/logger';

/**
 * Creates socket event handlers with integrated token refresh on disconnect
 * @param {Object} config - Configuration object
 * @param {Function} config.onDisconnect - Custom disconnect handler (optional)
 * @param {Function} config.onConnect - Custom connect handler (optional)
 * @param {Object} config.userHandlers - Additional user-provided handlers (optional)
 * @param {Object} config.instanceSocket - Socket instance reference
 * @returns {Object} Complete set of socket event handlers
 */
export const createSocketEventHandlers = (config = {}) => {
  const {
    onDisconnect,
    onConnect,
    userHandlers = {},
    instanceSocket
  } = config;

  /**
   * Enhanced disconnect handler with session preservation
   */
  const handleDisconnect = async (reason) => {
    logger.info('🔌 Socket disconnected, reason:', reason);

    // Prevent multiple disconnect handlers
    if (instanceSocket?.isDisconnecting) {
      logger.debug('🔌 Already handling disconnect, ignoring...');
      return;
    }

    // Preserve session_id before handling disconnect
    const sessionId = instanceSocket?.sessionId;
    if (sessionId && instanceSocket) {
      instanceSocket.preservedSessionId = sessionId;
      logger.debug('🔒 Preserved session_id before disconnect handling:', sessionId);
    }

    // Call custom disconnect handler if provided
    if (onDisconnect) {
      await onDisconnect(reason);
    }
  };

  /**
   * Enhanced connect handler with session restoration
   */
  const handleConnect = () => {
    logger.info('🔌 Socket connected, ID:', instanceSocket?.socket?.id);

    // Restore preserved session ID if available
    if (instanceSocket?.preservedSessionId && instanceSocket.socket) {
      instanceSocket.socket.preservedSessionId = instanceSocket.preservedSessionId;
      logger.debug('✅ Reconnected: copied preservedSessionId to socket:', instanceSocket.preservedSessionId);
    }

    // Call custom connect handler if provided
    if (onConnect) {
      onConnect();
    }
  };

  // Merge user handlers with enhanced handlers
  return {
    ...userHandlers,
    disconnect: handleDisconnect,
    connect: handleConnect
  };
};

import logger from '../utils/logger';
import { updateAndVerifySocketAuth } from './SocketAuthUpdater';
import { SOCKET_RECONNECT_DELAY } from '../constants/token';

/**
 * Reconnect socket with new token after token refresh
 * Handles complete socket destruction and recreation with fresh token
 *
 * @param {Object} instanceSocket - Socket instance wrapper
 * @param {string} newToken - New JWT token
 * @param {Object} baseCustomData - Base custom data (without auth_header)
 * @param {Object} store - Redux store reference
 * @param {Function} setSocketKey - Function to trigger re-render
 */
export const reconnectSocketWithNewToken = (instanceSocket, newToken, baseCustomData, store, setSocketKey) => {
  if (!instanceSocket || !instanceSocket.socket || !instanceSocket.socket.connected) {
    logger.debug('No connected socket to reconnect');
    return;
  }

  logger.info('🔄 Token refreshed automatically, reconnecting socket with new token...');

  const oldSocketId = instanceSocket.socket.id;
  const sessionId = instanceSocket.sessionId;

  // Preserve session_id for reconnection - save to instanceSocket, not socket (which will be destroyed)
  instanceSocket.preservedSessionId = sessionId;
  logger.debug('🔒 Preserved session_id:', sessionId, 'from socket:', oldSocketId);

  // CRITICAL: Completely destroy old Socket.IO Manager and connection
  logger.debug('🧹 Destroying old Socket.IO connection and Manager...');

  // 1. Get the Manager URL before closing
  const oldManagerUrl = instanceSocket.socket.io ? instanceSocket.socket.io.uri : null;

  // 2. Close the socket first
  try {
    instanceSocket.socket.close();
  } catch (e) {
    logger.error('Error closing socket:', e);
  }

  // 3. Close Manager from global cache (if it has the close method)
  // Note: In Socket.IO v4, Manager may already be closed or not have close() method
  if (instanceSocket.socket.io && typeof instanceSocket.socket.io.close === 'function') {
    try {
      instanceSocket.socket.io.close();
      logger.debug('✅ Manager closed successfully');
    } catch (e) {
      logger.debug('Manager close skipped (may already be closed):', e.message);
    }
  } else {
    logger.debug('Manager already closed or unavailable');
  }

  // 4. Manually delete Manager from window.io.managers cache
  if (typeof window !== 'undefined' && window.io && window.io.managers && oldManagerUrl) {
    logger.debug('🧹 Removing Manager from cache:', oldManagerUrl);
    Object.keys(window.io.managers).forEach(key => {
      if (key === oldManagerUrl || key.startsWith(oldManagerUrl.split('?')[0])) {
        logger.debug('🗑️ Deleting Manager:', key);
        try {
          window.io.managers[key].close();
        } catch (e) {
          // Already closed
        }
        delete window.io.managers[key];
      }
    });
  }

  instanceSocket.socket = null;

  // Update customData with new token
  const newCustomData = { ...baseCustomData, auth_header: newToken };
  instanceSocket.customData = newCustomData;

  // Add timestamp to force new Manager creation with fresh token
  const originalUrl = instanceSocket.url;
  const timestamp = Date.now();
  instanceSocket.url = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
  logger.debug('🔌 Using timestamped URL to force new Manager:', instanceSocket.url);

  // Small delay to ensure old connection is fully closed before creating new one
  logger.debug(`⏱️ Waiting ${SOCKET_RECONNECT_DELAY}ms for old connection cleanup...`);
  setTimeout(() => {
    // Create new socket with new token (preservedSessionId will be used)
    logger.debug('🔌 Creating new socket with refreshed token...');

    // CRITICAL: Mark socket as needing reinitialization BEFORE creating it
    // This will trigger componentDidUpdate in Widget to call initializeWidget
    instanceSocket.needsReinitialization = true;

    instanceSocket.createSocket();

    // Copy preservedSessionId to the new socket object
    if (instanceSocket.preservedSessionId && instanceSocket.socket) {
      instanceSocket.socket.preservedSessionId = instanceSocket.preservedSessionId;
      logger.debug('✅ Copied preservedSessionId to new socket:', instanceSocket.preservedSessionId);
    }

    // CRITICAL: Update socket.customData with fresh token for future reconnections
    if (instanceSocket.socket) {
      instanceSocket.socket.customData = newCustomData;
      logger.info('✅ Updated socket.customData with new token for reconnections');
    }

    // CRITICAL FIX: Force update auth headers in Socket.IO engine to prevent stale token caching
    updateAndVerifySocketAuth(instanceSocket, newToken, baseCustomData);

    // CRITICAL: Update store's socket reference after creating new socket
    if (store && store.updateSocket) {
      store.updateSocket(instanceSocket);
      logger.debug('✅ Store socket reference updated');
    }

    // Restore original URL for next refresh
    instanceSocket.url = originalUrl;

    logger.info('✅ Socket reconnected with new token, old ID:', oldSocketId, 'new ID:', instanceSocket.socket?.id);

    // Trigger a re-render to call componentDidUpdate
    if (setSocketKey) {
      setSocketKey(`token-refresh-${Date.now()}`);
    }
  }, SOCKET_RECONNECT_DELAY);
};

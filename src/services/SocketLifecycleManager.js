/**
 * SocketLifecycleManager - Manages socket lifecycle and reconnection
 * Extracted from index.js to improve code organization
 */

import logger from '../utils/logger';
import { SOCKET_RECONNECT_DELAY } from '../constants/token';

export class SocketLifecycleManager {
  constructor(config) {
    this.tokenManager = config.tokenManager;
    this.storage = config.storage;
    this.onTokenRefreshed = config.onTokenRefreshed; // (newToken) => void
    this.onSocketRecreated = config.onSocketRecreated; // () => void
  }

  /**
   * Handle socket disconnect with token refresh
   * @param {Object} socket - Socket instance
   * @param {string} reason - Disconnect reason
   * @returns {Promise<boolean>} Success status
   */
  async handleDisconnect(socket, reason) {
    logger.info('🔌 Socket disconnected, reason:', reason);

    // Prevent multiple disconnect handlers
    if (socket?.isDisconnecting) {
      logger.debug('🔌 Already handling disconnect, ignoring...');
      return false;
    }

    // If disconnected due to token expiration, refresh token before reconnecting
    if (reason === 'transport error' || reason === 'io server disconnect') {
      logger.info('🔄 Disconnect likely due to token expiration, refreshing token...');

      // CRITICAL: Preserve session_id before reconnect
      const sessionId = socket?.sessionId;
      if (sessionId && socket) {
        socket.preservedSessionId = sessionId;
        logger.debug('🔒 Preserved session_id before reconnect:', sessionId);
      }

      if (socket) {
        socket.isDisconnecting = true;
      }

      try {
        if (this.tokenManager) {
          const success = await this.tokenManager.refreshOnDisconnect();

          if (success) {
            const newToken = this.storage.getItem('chat_token');

            if (this.onTokenRefreshed) {
              this.onTokenRefreshed(newToken);
            }

            logger.info('✅ Token refreshed after disconnect, socket will reconnect automatically');

            if (socket) {
              socket.isDisconnecting = false;
            }

            return true;
          } else {
            logger.error('❌ Token refresh failed after disconnect');
            if (socket) {
              socket.isDisconnecting = false;
            }
            return false;
          }
        }
      } catch (error) {
        logger.error('❌ Error during disconnect token refresh:', error);
        if (socket) {
          socket.isDisconnecting = false;
        }
        return false;
      }
    }

    return false;
  }

  /**
   * Handle connection error
   * @param {Function} checkAndRefreshToken - Function to check and refresh token
   */
  handleConnectionError(checkAndRefreshToken) {
    logger.info('🔌 Connection error detected, checking token...');
    if (checkAndRefreshToken) {
      checkAndRefreshToken(true);
    }
  }

  /**
   * Cleanup Socket.IO managers
   */
  cleanupSocketManagers() {
    if (window.io && window.io.managers) {
      logger.debug('🧹 Cleaning up Socket.IO managers...');
      Object.keys(window.io.managers).forEach(key => {
        const manager = window.io.managers[key];
        if (manager && manager.close) {
          manager.close();
        }
        delete window.io.managers[key];
      });
    }
  }
}

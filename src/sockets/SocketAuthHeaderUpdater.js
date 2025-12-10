/**
 * SocketAuthHeaderUpdater - Updates Socket.IO auth headers for token refresh
 * Extracted from socket-socketio.js to improve code organization
 */

import logger from '../utils/logger';

export class SocketAuthHeaderUpdater {
  /**
   * Add method to socket to update auth headers (Socket.IO v4 compatible)
   * @param {Object} socket - Socket.IO socket instance
   */
  static addUpdateMethod(socket) {
    socket.updateAuthHeaders = function(newToken) {
      if (newToken && this.io) {
        logger.warn('🔧 Socket.IO v4: AGGRESSIVELY updating ALL auth header locations with new token');
        logger.debug('🔧 NEW Authorization header:', `Bearer ${newToken.substring(0, 30)}...`);

        const newAuthHeader = `Bearer ${newToken}`;
        let updateCount = 0;

        // 1. Update socket.auth
        if (this.auth) {
          this.auth.auth_header = newToken;
          updateCount++;
          logger.debug('✅ Updated: socket.auth.auth_header');
        }

        // 2. Update engine.opts.extraHeaders (CRITICAL for polling transport!)
        if (this.io.engine && this.io.engine.opts) {
          if (!this.io.engine.opts.extraHeaders) {
            this.io.engine.opts.extraHeaders = {};
          }
          this.io.engine.opts.extraHeaders.Authorization = newAuthHeader;
          updateCount++;
          logger.debug('✅ Updated: socket.io.engine.opts.extraHeaders');
        }

        // 3. Update manager.opts.extraHeaders
        if (this.io.opts) {
          if (!this.io.opts.extraHeaders) {
            this.io.opts.extraHeaders = {};
          }
          this.io.opts.extraHeaders.Authorization = newAuthHeader;
          updateCount++;
          logger.debug('✅ Updated: socket.io.opts.extraHeaders');

          if (!this.io.opts.auth) {
            this.io.opts.auth = {};
          }
          this.io.opts.auth.auth_header = newToken;
          updateCount++;
          logger.debug('✅ Updated: socket.io.opts.auth.auth_header');
        }

        // 4. REMOVED: transport.query.auth_header
        // Security concern: Tokens should not be passed via query params (visible in logs/URLs)
        // Using extraHeaders.Authorization is more secure and sufficient for all transports

        // 5. Update global manager cache if it exists
        if (typeof window !== 'undefined' && window.io && window.io.managers && this.io.uri) {
          const managerKey = this.io.uri;
          if (window.io.managers[managerKey]) {
            const manager = window.io.managers[managerKey];
            if (manager.opts) {
              if (!manager.opts.extraHeaders) {
                manager.opts.extraHeaders = {};
              }
              manager.opts.extraHeaders.Authorization = newAuthHeader;
              updateCount++;
              logger.debug('✅ Updated: global manager.opts.extraHeaders');
            }
          }
        }

        logger.info(`✅ Socket.IO v4: Updated ${updateCount} auth header locations`);

        // Verification
        const verifyHeader = this.io.engine?.opts?.extraHeaders?.Authorization;
        if (verifyHeader === newAuthHeader) {
          logger.info('✅ VERIFICATION PASSED: Engine has correct new token');
        } else {
          logger.error('❌ VERIFICATION FAILED after updateAuthHeaders!');
          logger.error('❌ Expected:', newAuthHeader.substring(0, 50));
          logger.error('❌ Got:', verifyHeader || 'NULL');
        }
      }
    };
  }

  /**
   * Force-update headers on connection
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} customData - Custom data with auth_header
   */
  static updateOnConnect(socket, customData) {
    if (customData && customData.auth_header) {
      logger.warn('🔧 ON CONNECT: Force-updating engine extraHeaders to ensure fresh token');

      // Update extraHeaders in engine opts
      if (socket.io.engine && socket.io.engine.opts) {
        if (!socket.io.engine.opts.extraHeaders) {
          socket.io.engine.opts.extraHeaders = {};
        }
        socket.io.engine.opts.extraHeaders.Authorization = `Bearer ${customData.auth_header}`;
        logger.info('✅ ON CONNECT: Engine extraHeaders updated');
      }

      // Update in manager opts
      if (socket.io.opts) {
        if (!socket.io.opts.extraHeaders) {
          socket.io.opts.extraHeaders = {};
        }
        socket.io.opts.extraHeaders.Authorization = `Bearer ${customData.auth_header}`;
        logger.info('✅ ON CONNECT: Manager extraHeaders updated');
      }

      // Verify the update
      const currentHeader = socket.io.engine?.opts?.extraHeaders?.Authorization;
      if (currentHeader && currentHeader.includes(customData.auth_header.substring(0, 20))) {
        logger.info('✅ ON CONNECT: Verification PASSED - fresh token in engine');
      } else {
        logger.error('❌ ON CONNECT: Verification FAILED - stale token detected!');
        logger.error('❌ Expected:', `Bearer ${customData.auth_header.substring(0, 30)}...`);
        logger.error('❌ Got:', currentHeader || 'NULL');
      }
    }
  }

  /**
   * Force-update headers on reconnection
   * @param {Object} socket - Socket.IO socket instance
   */
  static updateOnReconnect(socket) {
    if (socket.customData && socket.customData.auth_header) {
      logger.warn('🔧 ON RECONNECT: Force-updating all auth headers to prevent stale token');
      socket.updateAuthHeaders(socket.customData.auth_header);

      // Manually update engine headers as extra safety
      if (socket.io.engine && socket.io.engine.opts) {
        if (!socket.io.engine.opts.extraHeaders) {
          socket.io.engine.opts.extraHeaders = {};
        }
        socket.io.engine.opts.extraHeaders.Authorization = `Bearer ${socket.customData.auth_header}`;
        logger.info('✅ ON RECONNECT: Engine extraHeaders force-updated');
      }
    } else {
      logger.error('❌ ON RECONNECT: No customData.auth_header available!');
    }
  }
}

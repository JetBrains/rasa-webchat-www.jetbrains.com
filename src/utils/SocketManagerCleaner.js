/**
 * SocketManagerCleaner - Cleans up existing Socket.IO managers
 * Extracted from socket-socketio.js to improve code organization
 */

import logger from './logger';

export class SocketManagerCleaner {
  /**
   * Close any existing managers for the given URL to prevent duplicates and stale tokens
   * @param {string} socketUrl - Socket.IO server URL
   */
  static cleanup(socketUrl) {
    if (typeof window !== 'undefined' && window.io && window.io.managers) {
      // Extract base URL without query params for manager key matching
      const baseUrl = socketUrl.split('?')[0];

      // Close all managers that match the base URL (including those with timestamps)
      Object.keys(window.io.managers).forEach(managerKey => {
        if (managerKey.startsWith(baseUrl)) {
          logger.debug('🧹 Closing existing manager for:', managerKey);
          try {
            window.io.managers[managerKey].close();
            delete window.io.managers[managerKey];
          } catch (e) {
            logger.error('Error closing manager:', e);
          }
        }
      });
    }
  }
}

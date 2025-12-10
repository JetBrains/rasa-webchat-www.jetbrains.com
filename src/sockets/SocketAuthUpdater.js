import logger from '../utils/logger';

/**
 * Update authentication data in socket instance
 * Single source of truth for updating socket auth headers and customData
 *
 * @param {Object} instanceSocket - Socket instance wrapper
 * @param {string} token - New JWT token
 * @param {Object} baseCustomData - Base custom data object (without auth_header)
 * @returns {boolean} True if update was successful
 */
export const updateSocketAuth = (instanceSocket, token, baseCustomData) => {
  if (!instanceSocket) {
    logger.warn('updateSocketAuth: No socket instance to update');
    return false;
  }

  const newCustomData = { ...baseCustomData, auth_header: token };

  // Update instanceSocket wrapper
  instanceSocket.customData = newCustomData;

  // Update active socket connection if exists
  if (instanceSocket.socket && instanceSocket.socket.connected) {
    instanceSocket.socket.customData = newCustomData;

    // Update Socket.IO engine headers if method exists
    if (instanceSocket.socket.updateAuthHeaders) {
      instanceSocket.socket.updateAuthHeaders(token);
    }

    logger.debug('✅ Socket auth updated, ID:', instanceSocket.socket.id);
    return true;
  }

  logger.debug('Socket not connected, auth will be used on next connect');
  return false;
};

/**
 * Update socket auth and verify the update was successful
 *
 * @param {Object} instanceSocket - Socket instance wrapper
 * @param {string} token - New JWT token
 * @param {Object} baseCustomData - Base custom data object
 * @returns {boolean} True if update and verification passed
 */
export const updateAndVerifySocketAuth = (instanceSocket, token, baseCustomData) => {
  const updated = updateSocketAuth(instanceSocket, token, baseCustomData);

  // Verify Socket.IO engine headers were updated
  if (updated && instanceSocket.socket?.io?.engine?.opts) {
    const currentAuthHeader = instanceSocket.socket.io.engine.opts.extraHeaders?.Authorization;

    if (currentAuthHeader && currentAuthHeader.includes(token.substring(0, 20))) {
      logger.info('✅ VERIFIED: Socket auth headers updated correctly');
      return true;
    }

    logger.error('❌ VERIFICATION FAILED: Socket still has old token!');
    logger.error('❌ Expected token start:', token.substring(0, 30));
    logger.error('❌ Current header:', currentAuthHeader ? currentAuthHeader.substring(0, 50) : 'NULL');
    return false;
  }

  return updated;
};

/**
 * Update protocol options with new token
 *
 * @param {Object} instanceSocket - Socket instance wrapper
 * @param {string} token - New JWT token
 * @param {Object} baseProtocolOptions - Base protocol options (without token)
 */
export const updateSocketProtocolOptions = (instanceSocket, token, baseProtocolOptions) => {
  if (!instanceSocket) {
    logger.warn('updateSocketProtocolOptions: No socket instance');
    return;
  }

  const updatedProtocolOptions = { ...baseProtocolOptions, token };

  if (instanceSocket.updateProtocolOptions) {
    instanceSocket.updateProtocolOptions(updatedProtocolOptions);
    logger.debug('✅ Socket protocol options updated');
  }
};

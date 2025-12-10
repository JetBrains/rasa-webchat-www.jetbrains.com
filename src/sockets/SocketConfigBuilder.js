/**
 * SocketConfigBuilder - Builds Socket.IO configuration options
 * Extracted from socket-socketio.js to improve code organization
 */

import logger from '../utils/logger';
import { logTokenExpiration } from '../utils/TokenDiagnostics';

export class SocketConfigBuilder {
  static build(customData, path, protocolOptions) {
    const options = {
      path: '/custom-socket.io',
      transports: ["polling"]
    };

    // Pass customData in Socket.IO connection options
    logger.debug('Socket.IO: customData:', customData);
    if (customData) {
      options.auth = customData;
      logger.info('🔍 Socket.IO: customData.auth_header:', customData.auth_header ? `${customData.auth_header.substring(0, 30)}...` : 'NULL');

      // Diagnostic: Check token validity
      if (customData.auth_header) {
        logTokenExpiration(customData.auth_header, '🔍 Socket.IO');
      }

      // Pass token via extraHeaders for HTTP polling transport
      if (customData.auth_header) {
        options.extraHeaders = {
          Authorization: `Bearer ${customData.auth_header}`
        };
        logger.info('🔍 Socket.IO: extraHeaders.Authorization SET:', `Bearer ${customData.auth_header.substring(0, 30)}...`);
      } else {
        logger.warn('⚠️ Socket.IO: customData.auth_header is MISSING!');
      }
    } else {
      logger.warn('⚠️ Socket.IO: customData is NULL!');
    }

    // Add X-Client-Page-URL header with current page URL
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      if (!options.extraHeaders) {
        options.extraHeaders = {};
      }
      options.extraHeaders['X-Client-Page-URL'] = window.location.href;
      logger.info('🔍 Socket.IO: X-Client-Page-URL SET:', window.location.href);
    }

    // Add protocol options if provided
    if (protocolOptions) {
      Object.assign(options, protocolOptions);

      // Update Authorization header if token is provided in protocolOptions
      if (protocolOptions.token) {
        if (!options.extraHeaders) {
          options.extraHeaders = {};
        }
        options.extraHeaders.Authorization = `Bearer ${protocolOptions.token}`;
      }
    }

    logger.debug('Socket.IO: Token will be sent via auth options and extraHeaders');
    logger.debug('Socket.IO: customData:', customData);
    logger.debug('Socket.IO: options:', options);

    return options;
  }
}

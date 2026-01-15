import io from 'socket.io-client';
import logger from './utils/logger';

export default (socketUrl, customData, path, protocolOptions, onError) => {
  // const options = path ? { path } : {};
  const options = {
    path: '/custom-socket.io',
    transports: ['polling'],
    // transports: ["websocket", "polling"],  // Try WebSocket first, fallback to polling if blocked
    // upgrade: true,  // Allow upgrade from polling to websocket after successful auth
  };

  // Pass customData in Socket.IO connection options so it's sent during handshake
  // Rasa expects token in customData.auth_header (via metadata_key: customData config)
  logger.debug('Socket.IO: customData:', customData);
  if (customData) {
    options.auth = customData;
    logger.info(
      '🔍 Socket.IO: customData.auth_header:',
      customData.auth_header ? `${customData.auth_header.substring(0, 30)}...` : 'NULL'
    );

    // DIAGNOSTIC: Check token validity
    if (customData.auth_header) {
      try {
        const tokenPayload = customData.auth_header.split('.')[1];
        const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
        const now = Date.now() / 1000;
        const timeLeft = decoded.exp - now;
        logger.info('🔍 Socket.IO: Access token EXPIRES IN:', Math.round(timeLeft / 60), 'minutes');
        if (timeLeft < 0) {
          logger.error(
            '❌ Socket.IO: Access token is ALREADY EXPIRED!',
            Math.round(-timeLeft / 60),
            'minutes ago'
          );
        }
      } catch (e) {
        logger.error('❌ Socket.IO: Failed to decode access token:', e);
      }
    }

    // Also pass token via extraHeaders for HTTP polling transport
    if (customData.auth_header) {
      options.extraHeaders = {
        Authorization: `Bearer ${customData.auth_header}`,
      };
      logger.info(
        '🔍 Socket.IO: extraHeaders.Authorization SET:',
        `Bearer ${customData.auth_header.substring(0, 30)}...`
      );
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

  // Add protocol options if provided (for token updates)
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

  logger.debug('Socket.IO: Creating connection to', socketUrl);
  logger.debug('Socket.IO: Token will be sent via auth options and extraHeaders');
  logger.debug('Socket.IO: customData:', customData);
  logger.debug('Socket.IO: options:', options);

  // CRITICAL: Close any existing managers for this URL to prevent duplicates and stale tokens
  if (typeof window !== 'undefined' && window.io && window.io.managers) {
    // Extract base URL without query params for manager key matching
    const baseUrl = socketUrl.split('?')[0];

    // Close all managers that match the base URL (including those with timestamps)
    Object.keys(window.io.managers).forEach((managerKey) => {
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

  const socket = io(socketUrl, options);

  // Add method to update auth headers for token refresh (Socket.IO v4 compatible)
  socket.updateAuthHeaders = (newToken) => {
    if (newToken && this.io) {
      logger.warn(
        '🔧 Socket.IO v4: AGGRESSIVELY updating ALL auth header locations with new token'
      );
      logger.debug('🔧 NEW Authorization header:', `Bearer ${newToken.substring(0, 30)}...`);

      const newAuthHeader = `Bearer ${newToken}`;
      let updateCount = 0;

      // 1. Update socket.auth
      if (this.auth) {
        this.auth.auth_header = newToken;
        updateCount += 1;
        logger.debug('✅ Updated: socket.auth.auth_header');
      }

      // 2. Update engine.opts.extraHeaders (CRITICAL for polling transport!)
      if (this.io.engine && this.io.engine.opts) {
        if (!this.io.engine.opts.extraHeaders) {
          this.io.engine.opts.extraHeaders = {};
        }
        this.io.engine.opts.extraHeaders.Authorization = newAuthHeader;
        updateCount += 1;
        logger.debug('✅ Updated: socket.io.engine.opts.extraHeaders');
      }

      // 3. Update manager.opts.extraHeaders
      if (this.io.opts) {
        if (!this.io.opts.extraHeaders) {
          this.io.opts.extraHeaders = {};
        }
        this.io.opts.extraHeaders.Authorization = newAuthHeader;
        updateCount += 1;
        logger.debug('✅ Updated: socket.io.opts.extraHeaders');

        if (!this.io.opts.auth) {
          this.io.opts.auth = {};
        }
        this.io.opts.auth.auth_header = newToken;
        updateCount += 1;
        logger.debug('✅ Updated: socket.io.opts.auth.auth_header');
      }

      // 4. Update transport-level headers if transport is active
      // NOTE: Do NOT use transport.query - it puts auth_header in GET params (security issue)
      // For polling transport, extraHeaders (set above) is the correct way

      // 5. NUCLEAR OPTION: Update global manager cache if it exists
      if (typeof window !== 'undefined' && window.io && window.io.managers && this.io.uri) {
        const managerKey = this.io.uri;
        if (window.io.managers[managerKey]) {
          const manager = window.io.managers[managerKey];
          if (manager.opts) {
            if (!manager.opts.extraHeaders) {
              manager.opts.extraHeaders = {};
            }
            manager.opts.extraHeaders.Authorization = newAuthHeader;
            updateCount += 1;
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

  // Log transport changes
  socket.io.on('reconnect_attempt', () => {
    logger.debug('Socket.IO: Reconnect attempt');
  });

  socket.io.on('reconnect', () => {
    logger.info('Socket.IO: Reconnected successfully');

    // CRITICAL: Force-update headers after reconnection
    if (socket.customData && socket.customData.auth_header) {
      logger.warn('🔧 ON RECONNECT: Force-updating all auth headers to prevent stale token');
      socket.updateAuthHeaders(socket.customData.auth_header);

      // Also manually update engine headers as extra safety
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
  });

  socket.on('connect', () => {
    logger.info(`Socket.IO: Connected with socket.id: ${socket.id}`);
    logger.debug(`Socket.IO: Transport: ${socket.io.engine.transport.name}`);
    socket.customData = customData;
    logger.debug('Socket.IO: customData set on socket');

    // CRITICAL FIX: Force-update extraHeaders on connect to prevent stale token in polling requests
    if (customData && customData.auth_header) {
      logger.warn('🔧 ON CONNECT: Force-updating engine extraHeaders to ensure fresh token');

      // Update extraHeaders in engine opts (where polling transport reads them)
      if (socket.io.engine && socket.io.engine.opts) {
        if (!socket.io.engine.opts.extraHeaders) {
          socket.io.engine.opts.extraHeaders = {};
        }
        socket.io.engine.opts.extraHeaders.Authorization = `Bearer ${customData.auth_header}`;
        logger.info('✅ ON CONNECT: Engine extraHeaders updated');
      }

      // Also update in manager opts
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
  });

  // Log when transport upgrades
  socket.io.engine.on('upgrade', (transport) => {
    logger.info(`Socket.IO: Transport upgraded to: ${transport.name}`);
  });

  socket.on('connect_error', (error) => {
    logger.error('Socket.IO: Connection error:', error);
    logger.error('Socket.IO: Error message:', error.message);
    if (error.type) {
      logger.error('Socket.IO: Error type:', error.type);
    }
    onError();
  });

  socket.on('disconnect', (reason) => {
    logger.info('Socket.IO: Disconnected, reason:', reason);
  });

  // Log polling errors for debugging
  socket.io.engine.on('upgradeError', (error) => {
    logger.error('Socket.IO: WebSocket upgrade failed:', error);
  });

  socket.io.engine.on('error', (error) => {
    logger.error('Socket.IO: Engine error:', error);
  });

  return socket;
};

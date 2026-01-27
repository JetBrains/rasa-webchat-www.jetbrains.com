/* eslint-disable camelcase, no-param-reassign */
import { TOKEN_KEY, TOKEN_REFRESH_KEY } from 'constants';
import { getIsTokenValid, getTokenExpirationTime, refreshTokenReq } from 'utils/auth/index.ts';
import logger from 'utils/logger';

const useScheduleTokenRefresh = ({refreshTimerRef, instanceSocket, customData, store, setSocketKey, setToken, setIsAuth }) => {

  const scheduleTokenRefresh = (rToken) => {
      logger.debug('🕐 Scheduling token refresh...');

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
        logger.debug('🕐 Cleared existing refresh timer');
      }

      if (!rToken) {
        logger.debug('🕐 No token provided, skipping refresh schedule');
        return;
      }

      const expirationTime = getTokenExpirationTime(rToken);
      if (!expirationTime) {
        logger.debug('🕐 Could not get token expiration time');
        return;
      }

      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;

      logger.debug('🕐 Token expires in:', Math.round(timeUntilExpiration / 1000), 'seconds');

      // TEST MODE: Refresh after n seconds for testing
      // const refreshTime = 15 * 1000; // n seconds

      // PRODUCTION: Uncomment this line and remove the line above
      const refreshTime = timeUntilExpiration - (5 * 60 * 1000);

      const timeToRefresh = Math.max(refreshTime, 5 * 1000);

      logger.debug('🕐 Will refresh token in:', Math.round(timeToRefresh / 1000), 'seconds');

      refreshTimerRef.current = setTimeout(() => {
        logger.debug('🔄 Token refresh timer triggered!');

        const currentToken = localStorage.getItem(TOKEN_KEY);
        if (!currentToken || !getIsTokenValid(currentToken)) {
          logger.debug('🔄 Current token is invalid, skipping refresh');
          return;
        }

        logger.debug('🔄 Starting token refresh process...');
        
        const refreshToken = localStorage.getItem(TOKEN_REFRESH_KEY);
        logger.debug('🔄 Auto-refresh: using refresh_token from localStorage:', refreshToken ? `${refreshToken.substring(0, 20)  }...` : 'NULL');
        if (refreshToken) {
          refreshTokenReq(refreshToken)
            .then((data) => {
              // eslint-disable-next-line camelcase
              const { id_token, refresh_token } = data;
              // eslint-disable-next-line camelcase
              if (!id_token) {
                logger.error('❌ Auto-refresh: No id_token in response');
                return;
              }

              // CRITICAL: If server uses rotating refresh tokens, it MUST return new refresh_token
              // If it doesn't return new token, the old one is likely invalidated
              // eslint-disable-next-line camelcase
              if (!refresh_token) {
                logger.warn('⚠️ Auto-refresh: Server did NOT return new refresh_token');
                logger.warn('⚠️ This may indicate rotating refresh tokens - old token may be invalidated');
                logger.warn('⚠️ Keeping old refresh_token and hoping it still works...');
                // IMPORTANT: Some OAuth servers don't return new refresh_token on every refresh
                // Old refresh_token should still be valid in this case
                // If your server uses rotating tokens, this is a SERVER BUG
              } else {
                const oldToken = localStorage.getItem(TOKEN_REFRESH_KEY);
                logger.info('✅ Auto-refresh: OLD refresh_token in localStorage:', oldToken ? `${oldToken.substring(0, 40)  }...` : 'NULL');
                logger.info('✅ Auto-refresh: NEW refresh_token from server:', `${refresh_token.substring(0, 40)  }...`);
                logger.info('✅ Auto-refresh: Full OLD token:', oldToken);
                logger.info('✅ Auto-refresh: Full NEW token:', refresh_token);
                logger.info('✅ Auto-refresh: Are they SAME?', oldToken === refresh_token);

                localStorage.setItem(TOKEN_REFRESH_KEY, refresh_token);
                const storedToken = localStorage.getItem(TOKEN_REFRESH_KEY);
                logger.info('✅ Auto-refresh: Verification - saved correctly?', refresh_token === storedToken);
              }

              localStorage.setItem(TOKEN_KEY, id_token);
              logger.info('✅ Auto-refresh: id_token updated');

              // DIAGNOSTIC: Verify token was actually updated in localStorage
              const verifyToken = localStorage.getItem(TOKEN_KEY);
              if (verifyToken === id_token) {
                logger.info('✅ Auto-refresh: Token verification PASSED - localStorage updated correctly');
              } else {
                logger.error('❌ Auto-refresh: Token verification FAILED!');
                logger.error('❌ Expected:', `${id_token.substring(0, 40)  }...`);
                logger.error('❌ Got from localStorage:', verifyToken ? `${verifyToken.substring(0, 40)  }...` : 'NULL');
              }

              // DIAGNOSTIC: Check expiration of new token
              try {
                const tokenPayload = id_token.split('.')[1];
                const decoded = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
                const now = Date.now() / 1000;
                const timeLeft = decoded.exp - now;
                logger.info('✅ Auto-refresh: New access token expires in:', Math.round(timeLeft / 60), 'minutes');
                if (timeLeft < 0) {
                  logger.error('❌ Auto-refresh: Server returned ALREADY EXPIRED token! Expired', Math.round(-timeLeft / 60), 'minutes ago');
                }
              } catch (e) {
                logger.error('❌ Auto-refresh: Failed to decode new access token:', e);
              }

              logger.info('🔄 Token refreshed automatically, reconnecting socket with new token...');

              // Reconnect socket to ensure fresh token in all requests
              if (instanceSocket.current && instanceSocket.current.socket && instanceSocket.current.socket.connected) {
                  const oldSocketId = instanceSocket.current.socket.id;
                  const { sessionId } = instanceSocket.current;

                  // Preserve session_id for reconnection - save to instanceSocket, not socket (which will be destroyed)
                  instanceSocket.current.preservedSessionId = sessionId;
                  logger.debug('🔒 Preserved session_id:', sessionId, 'from socket:', oldSocketId);

                  // CRITICAL: Completely destroy old Socket.IO Manager and connection
                  logger.debug('🧹 Destroying old Socket.IO connection and Manager...');

                  // 1. Get the Manager URL before closing
                  const oldManagerUrl = instanceSocket.current.socket.io ? instanceSocket.current.socket.io.uri : null;

                  // 2. Close the socket first
                  try {
                    instanceSocket.current.socket.close();
                  } catch (e) {
                    logger.error('Error closing socket:', e);
                  }

                  // 3. Close and delete Manager from global cache
                  if (instanceSocket.current.socket.io) {
                    try {
                      instanceSocket.current.socket.io.close();
                    } catch (e) {
                      logger.error('Error closing manager:', e);
                    }
                  }

                  // 4. Manually delete Manager from window.io.managers cache
                  if (typeof window !== 'undefined' && window.io && window.io.managers && oldManagerUrl) {
                    logger.debug('🧹 Removing Manager from cache:', oldManagerUrl);
                    Object.keys(window.io.managers).forEach((key) => {
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

                  instanceSocket.current.socket = null;

                  // Update customData with new token
                  const newCustomData = { ...customData, auth_header: id_token };
                  instanceSocket.current.customData = newCustomData;

                  // Add timestamp to force new Manager creation with fresh token
                  const originalUrl = instanceSocket.current.url;
                  const timestamp = Date.now();
                  instanceSocket.current.url = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
                  logger.debug('🔌 Using timestamped URL to force new Manager:', instanceSocket.current.url);

                  // Small delay to ensure old connection is fully closed before creating new one
                  logger.debug('⏱️ Waiting 100ms for old connection cleanup...');
                  setTimeout(() => {
                    // Create new socket with new token (preservedSessionId will be used)
                    logger.debug('🔌 Creating new socket with refreshed token...');

                    // CRITICAL: Mark socket as needing reinitialization BEFORE creating it
                    // This will trigger componentDidUpdate in Widget to call initializeWidget
                    instanceSocket.current.needsReinitialization = true;

                    instanceSocket.current.createSocket();

                    // Copy preservedSessionId to the new socket object
                    if (instanceSocket.current.preservedSessionId && instanceSocket.current.socket) {
                      instanceSocket.current.socket.preservedSessionId = instanceSocket.current.preservedSessionId;
                      logger.debug('✅ Copied preservedSessionId to new socket:', instanceSocket.current.preservedSessionId);
                    }

                    // CRITICAL: Update socket.customData with fresh token for future reconnections
                    if (instanceSocket.current.socket) {
                      instanceSocket.current.socket.customData = newCustomData;
                      logger.info('✅ Updated socket.customData with new token for reconnections');
                    }

                    // CRITICAL FIX: Force update auth headers in Socket.IO engine to prevent stale token caching
                    if (instanceSocket.current.socket && instanceSocket.current.socket.updateAuthHeaders) {
                      logger.warn('🔧 FORCE UPDATING Socket.IO engine headers with new token to prevent caching issue');
                      instanceSocket.current.socket.updateAuthHeaders(id_token);

                      // Double-check: Verify headers were actually updated
                      if (instanceSocket.current.socket.io && instanceSocket.current.socket.io.engine && instanceSocket.current.socket.io.engine.opts) {
                        const currentAuthHeader = instanceSocket.current.socket.io.engine.opts.extraHeaders?.Authorization;
                        if (currentAuthHeader && currentAuthHeader.includes(id_token.substring(0, 20))) {
                          logger.info('✅ VERIFIED: Socket.IO engine headers updated with new token');
                        } else {
                          logger.error('❌ VERIFICATION FAILED: Socket.IO engine still has OLD token!');
                          logger.error('❌ Expected token start:', id_token.substring(0, 30));
                          logger.error('❌ Current header:', currentAuthHeader ? currentAuthHeader.substring(0, 50) : 'NULL');
                        }
                      }
                    }

                    // CRITICAL: Update store's socket reference after creating new socket
                    if (store.current && store.current.updateSocket) {
                      store.current.updateSocket(instanceSocket.current);
                      logger.debug('✅ Store socket reference updated');
                    }

                    // Restore original URL for next refresh
                    instanceSocket.current.url = originalUrl;

                    logger.info('✅ Socket reconnected with new token, old ID:', oldSocketId, 'new ID:', instanceSocket.current.socket?.id);

                    // Trigger a re-render to call componentDidUpdate
                    // eslint-disable-next-line no-use-before-define
                    setSocketKey(`token-refresh-${Date.now()}`);
                  }, 100);
              }

              setToken(id_token);
              logger.info('✅ Token refreshed and socket updated');
              scheduleTokenRefresh(id_token);
            })
            .catch((err) => {
              logger.error(err);
              setIsAuth(false);
            });
        }
      }, timeToRefresh);
    };

  return scheduleTokenRefresh
}

export default useScheduleTokenRefresh
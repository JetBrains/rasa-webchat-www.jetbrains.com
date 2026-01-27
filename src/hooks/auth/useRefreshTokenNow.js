import { TOKEN_KEY,TOKEN_REFRESH_KEY } from 'constants';
import { useCallback } from 'react';
import { refreshTokenReq } from 'utils/auth/index.ts';
import logger from 'utils/logger';

const useRefreshTokenNow = ({refreshTimerRef, instanceSocket, props, setToken, setIsAuth, scheduleTokenRefresh}) => {
  // Manual token refresh, can be triggered from UI (header refresh button)
  // Returns a Promise to allow callers to await completion before further actions
  const refreshTokenNow = useCallback(() => {
    logger.info('🔄 Manual token refresh triggered...');

    // Clear any pending timer to avoid double refreshes
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      // eslint-disable-next-line no-param-reassign
      refreshTimerRef.current = null;
      logger.debug('🕐 Cleared existing refresh timer before manual refresh');
    }

    const refreshToken = localStorage.getItem(TOKEN_REFRESH_KEY);
    logger.debug('🔄 Manual-refresh: using refresh_token from localStorage:', refreshToken ? `${refreshToken.substring(0, 20)  }...` : 'NULL');

    if (!refreshToken) {
      logger.warn('❌ No refresh token available; cannot refresh manually');
      return Promise.resolve(false);
    }

    return refreshTokenReq(refreshToken)
      .then((data) => {
        const { id_token: newIdToken, refresh_token: newRefreshToken } = data || {};
        if (!newIdToken) {
          logger.error('❌ Manual refresh did not return id_token');
          return false;
        }

        localStorage.setItem(TOKEN_KEY, newIdToken);
        logger.info('✅ Manual-refresh: id_token updated');

        if (newRefreshToken) {
          localStorage.setItem(TOKEN_REFRESH_KEY, newRefreshToken);
          logger.info('✅ Manual-refresh: refresh_token updated');
        } else {
          logger.warn('⚠️ Manual-refresh: Server did NOT return new refresh_token, keeping old one');
        }

        // Update socket with new token (NO destruction - manual refresh uses /restart)
        if (instanceSocket.current && instanceSocket.current.socket && instanceSocket.current.socket.connected) {
          const newCustomData = { ...props.customData, auth_header: newIdToken };
          // eslint-disable-next-line no-param-reassign
          instanceSocket.current.customData = newCustomData;

          if (instanceSocket.current.socket.updateAuthHeaders) {
            instanceSocket.current.socket.updateAuthHeaders(newIdToken);
          }

          if (instanceSocket.current.socket.customData) {
            // eslint-disable-next-line no-param-reassign
            instanceSocket.current.socket.customData = newCustomData;
          }

          logger.info('✅ Manual refresh: socket updated in-place, ID:', instanceSocket.current.socket.id);
        }

        setToken(newIdToken);
        setIsAuth(true);
        scheduleTokenRefresh(newIdToken);
        logger.info('✅ Manual token refresh complete');
        return true;
      })
      .catch((err) => {
        logger.error('❌ Manual token refresh failed:', err);
        setIsAuth(false);
        return false;
      });
  }, [props.customData, scheduleTokenRefresh]);

  return refreshTokenNow
}

export default useRefreshTokenNow;
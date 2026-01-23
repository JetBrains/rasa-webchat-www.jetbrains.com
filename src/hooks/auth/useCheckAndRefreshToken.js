import { TOKEN_KEY, TOKEN_REFRESH_KEY } from 'constants';
import { getIsTokenValid, refreshTokenReq } from 'utils/auth/index.ts';
import logger from 'utils/logger';

const useCheckAndRefreshToken = ({ isAuth, setIsAuth, setToken, scheduleTokenRefresh }) => {
  const checkAndRefreshToken = (resetAuth) => {
    if (isAuth) return;
    const chatToken = localStorage.getItem(TOKEN_KEY);
    const oldRefreshToken = localStorage.getItem(TOKEN_REFRESH_KEY);
    const isTokenValid = getIsTokenValid(chatToken);

    logger.debug(
      '🔄 Check-refresh: using refresh_token from localStorage:',
      oldRefreshToken ? `${oldRefreshToken.substring(0, 20)}...` : 'NULL'
    );

    if (chatToken && !isTokenValid) {
      refreshTokenReq(oldRefreshToken)
        .then((data) => {
          const { id_token: newIdToken, refresh_token: newRefreshToken } = data;
          if (!newIdToken) return;

          localStorage.setItem(TOKEN_KEY, newIdToken);
          logger.info('✅ Check-refresh: id_token updated');

          if (newRefreshToken) {
            localStorage.setItem(TOKEN_REFRESH_KEY, newRefreshToken);
            logger.info('✅ Check-refresh: refresh_token updated');
          } else {
            logger.warn(
              '⚠️ Check-refresh: Server did NOT return new refresh_token, keeping old one'
            );
          }

          setToken(newIdToken);
          setIsAuth(true);
          scheduleTokenRefresh(newIdToken);
        })
        .catch((err) => {
          if (resetAuth) {
            setIsAuth(false);
          }
          logger.error('❌ Check-refresh failed:', err);
        });
    } else if (resetAuth) {
      setIsAuth(false);
    }
  };

  return checkAndRefreshToken;
};

export default useCheckAndRefreshToken;

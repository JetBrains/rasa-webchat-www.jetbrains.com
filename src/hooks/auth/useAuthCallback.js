import { useCallback, useEffect, useRef } from 'react';
import logger from 'utils/logger';

import {
  state,
  exchangeTokenReq,
} from 'utils/auth/index.ts';
import { TOKEN_KEY, TOKEN_REFRESH_KEY } from 'constants.js';

 const useAuthCallback = ({ isAuth, setIsAuth, setToken, scheduleTokenRefresh}) => {
  const processedCodesRef = useRef(new Set()); // Track processed OAuth codes to prevent duplicates

  const authCallback = useCallback(
    (event) => {
      logger.info('🔍 authCallback: Received message event, type:', event.data?.type);

      if (isAuth) {
        logger.debug('Already authenticated, ignoring message');
        return;
      }

      if (event.data?.type === 'oauth-code') {
        const { code, popupState } = event.data;

        // eslint-disable-next-line no-unsafe-optional-chaining
        logger.debug('📨 Received OAuth callback:', {
          code: `${code?.substring(0, 10)  }...`,
          popupState,
        });

        // Prevent duplicate processing of the same OAuth code
        if (processedCodesRef.current.has(code)) {
          logger.warn('⚠️ OAuth code already processed, ignoring duplicate message');
          return;
        }
        processedCodesRef.current.add(code);

        if (state !== popupState) {
          logger.error('❌ State mismatch:', { received: popupState, expected: state });
          return;
        }

        const getChatToken = async () => {
          try {
            logger.debug('🔄 Exchanging code for token...');
            const data = await exchangeTokenReq(code);
            /* eslint-disable-next-line camelcase */
            const { id_token, refresh_token } = data;

            /* eslint-disable-next-line camelcase */
            if (!id_token) {
              logger.error('❌ No id_token in response:', data);
              return;
            }

            logger.info('✅ Token received, storing with key:', TOKEN_KEY);
            /* eslint-disable-next-line camelcase */
            logger.info('🔍 Token value (first 30 chars):', `${id_token.substring(0, 30)  }...`);
            localStorage.setItem(TOKEN_KEY, id_token);
            localStorage.setItem(TOKEN_REFRESH_KEY, refresh_token);
            logger.info('🔍 Token stored, verifying...');
            const storedToken = localStorage.getItem(TOKEN_KEY);
            logger.info(
              '🔍 Verification - token in localStorage:',
              storedToken ? 'EXISTS' : 'NULL'
            );
            setToken(id_token);
            setIsAuth(true);
            scheduleTokenRefresh(id_token);
            logger.info('✅ Auth completed successfully');
          } catch (error) {
            logger.error('❌ Token exchange error:', error);
          }
        };

        getChatToken();
      }
    },
    [isAuth, scheduleTokenRefresh]
  );

  useEffect(() => {
    window.addEventListener('message', authCallback);
    logger.debug('👂 Message listener added');

    return () => {
      window.removeEventListener('message', authCallback);
      logger.debug('👋 Message listener removed');
    };
  }, [authCallback]);
};

export default useAuthCallback;
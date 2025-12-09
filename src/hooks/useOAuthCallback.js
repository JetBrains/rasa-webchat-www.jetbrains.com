/**
 * useOAuthCallback Hook
 * Handles OAuth callback messages from popup window
 * Extracted from index.js to improve code organization and reusability
 */

import { useEffect, useCallback, useRef } from 'react';
import logger from '../utils/logger';
import { exchangeTokenReq, state } from '../utils/auth-utils';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/token';

/**
 * Custom hook for handling OAuth callback
 * @param {Object} config - Configuration object
 * @param {boolean} config.isAuth - Current authentication status
 * @param {Function} config.setToken - Function to update token state
 * @param {Function} config.setIsAuth - Function to update auth status
 * @param {Function} config.scheduleTokenRefresh - Function to schedule token refresh
 * @returns {null} This hook only sets up side effects
 */
export const useOAuthCallback = (config) => {
  const {
    isAuth,
    setToken,
    setIsAuth,
    scheduleTokenRefresh
  } = config;

  const processedCodesRef = useRef(new Set());

  const authCallback = useCallback((event) => {
    logger.info('🔍 authCallback: Received message event, type:', event.data?.type);

    if (isAuth) {
      logger.debug('Already authenticated, ignoring message');
      return;
    }

    if (event.data?.type === 'oauth-code') {
      const code = event.data.code;
      const popupState = event.data.popupState;

      logger.debug('📨 Received OAuth callback:', { code: code?.substring(0, 10) + '...', popupState });

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
          const { id_token, refresh_token } = data;

          if (!id_token) {
            logger.error('❌ No id_token in response:', data);
            return;
          }

          logger.info('✅ Token received, storing with key:', TOKEN_KEY);
          logger.info('🔍 Token value (first 30 chars):', id_token.substring(0, 30) + '...');
          localStorage.setItem(TOKEN_KEY, id_token);
          localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
          logger.info('🔍 Token stored, verifying...');
          const storedToken = localStorage.getItem(TOKEN_KEY);
          logger.info('🔍 Verification - token in localStorage:', storedToken ? 'EXISTS' : 'NULL');
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
  }, [isAuth, scheduleTokenRefresh, setToken, setIsAuth]);

  useEffect(() => {
    window.addEventListener('message', authCallback);
    logger.debug('👂 Message listener added');

    return () => {
      window.removeEventListener('message', authCallback);
      logger.debug('👋 Message listener removed');
    };
  }, [authCallback]);

  return null;
};

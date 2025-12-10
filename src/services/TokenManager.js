import logger from '../utils/logger';
import { refreshTokenReq, getIsTokenValid, getTokenExpirationTime } from '../utils/auth-utils';
import { logTokenExpiration, verifyTokenInStorage } from '../utils/TokenDiagnostics';
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_REFRESH_TEST_INTERVAL,
  TOKEN_REFRESH_BEFORE_EXPIRY,
  TOKEN_REFRESH_MIN_INTERVAL
} from '../constants/token';

/**
 * TokenManager - Centralized token management service
 * Handles all token refresh operations, scheduling, and storage
 */
export class TokenManager {
  constructor(config = {}) {
    this.tokenKey = config.tokenKey || TOKEN_KEY;
    this.refreshTokenKey = config.refreshTokenKey || REFRESH_TOKEN_KEY;
    this.refreshTimerRef = null;
    this.onTokenRefreshed = config.onTokenRefreshed;
    this.onTokenRefreshFailed = config.onTokenRefreshFailed;
    this.useTestMode = config.useTestMode !== undefined ? config.useTestMode : true;
  }

  /**
   * Single source of truth for token refresh logic
   * Used by: auto-refresh, manual refresh, check-and-refresh, disconnect-refresh
   *
   * @param {string} refreshToken - Refresh token to use
   * @param {string} context - Context label for logging
   * @param {Object} options - Additional options
   * @param {boolean} options.skipSocketReconnect - If true, don't trigger socket reconnection
   * @returns {Promise<Object>} Token data {id_token, refresh_token}
   */
  async refreshToken(refreshToken, context = 'Token refresh', options = {}) {
    logger.debug(`🔄 ${context}: using refresh_token from localStorage:`,
      refreshToken ? refreshToken.substring(0, 20) + '...' : 'NULL');

    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }

    try {
      const data = await refreshTokenReq(refreshToken);
      const { id_token, refresh_token } = data;

      if (!id_token) {
        logger.error(`❌ ${context}: No id_token in response`);
        throw new Error('No id_token in response');
      }

      // Update tokens in localStorage
      this.updateTokensInStorage(id_token, refresh_token, context);

      // Verify token was stored correctly
      verifyTokenInStorage(id_token, this.tokenKey, context);

      // Log new token expiration
      logTokenExpiration(id_token, `✅ ${context}`);

      // Notify listeners (but allow skipping socket reconnect for manual refresh before /restart)
      if (this.onTokenRefreshed) {
        this.onTokenRefreshed(id_token, refresh_token, options);
      }

      logger.info(`✅ ${context} completed successfully`);
      return { id_token, refresh_token };
    } catch (err) {
      logger.error(`❌ ${context} failed:`, err);

      if (this.onTokenRefreshFailed) {
        this.onTokenRefreshFailed(err);
      }

      throw err;
    }
  }

  /**
   * Update tokens in localStorage with proper logging
   *
   * @param {string} idToken - New access token
   * @param {string} refreshToken - New refresh token (optional)
   * @param {string} context - Context for logging
   */
  updateTokensInStorage(idToken, refreshToken, context = '') {
    localStorage.setItem(this.tokenKey, idToken);
    logger.info(`✅ ${context}: id_token updated in localStorage`);

    if (refreshToken) {
      const oldRefreshToken = localStorage.getItem(this.refreshTokenKey);

      logger.info(`✅ ${context}: OLD refresh_token:`, oldRefreshToken ? oldRefreshToken.substring(0, 40) + '...' : 'NULL');
      logger.info(`✅ ${context}: NEW refresh_token:`, refreshToken.substring(0, 40) + '...');
      logger.info(`✅ ${context}: Tokens are SAME?`, oldRefreshToken === refreshToken);

      localStorage.setItem(this.refreshTokenKey, refreshToken);

      const storedToken = localStorage.getItem(this.refreshTokenKey);
      logger.info(`✅ ${context}: Verification - refresh_token saved correctly?`, refreshToken === storedToken);
    } else {
      logger.warn(`⚠️ ${context}: Server did NOT return new refresh_token`);
      logger.warn(`⚠️ This may indicate rotating refresh tokens - old token may be invalidated`);
      logger.warn(`⚠️ Keeping old refresh_token and hoping it still works...`);
    }
  }

  /**
   * Schedule automatic token refresh before expiration
   *
   * @param {string} token - Current access token
   */
  scheduleAutoRefresh(token) {
    logger.debug('🕐 Scheduling token refresh...');

    this.clearSchedule();

    if (!token) {
      logger.debug('🕐 No token provided, skipping refresh schedule');
      return;
    }

    const expirationTime = getTokenExpirationTime(token);
    if (!expirationTime) {
      logger.debug('🕐 Could not get token expiration time');
      return;
    }

    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;

    logger.debug('🕐 Token expires in:', Math.round(timeUntilExpiration / 1000), 'seconds');

    // Calculate refresh time
    const refreshTime = this.useTestMode
      ? TOKEN_REFRESH_TEST_INTERVAL  // Test mode: 2 seconds
      : timeUntilExpiration - TOKEN_REFRESH_BEFORE_EXPIRY; // Production: 5 min before expiry

    const timeToRefresh = Math.max(refreshTime, TOKEN_REFRESH_MIN_INTERVAL);

    logger.debug('🕐 Will refresh token in:', Math.round(timeToRefresh / 1000), 'seconds',
      this.useTestMode ? '(TEST MODE)' : '(PRODUCTION)');

    this.refreshTimerRef = setTimeout(() => {
      this.handleAutoRefresh();
    }, timeToRefresh);
  }

  /**
   * Handle automatic token refresh (called by timer)
   */
  async handleAutoRefresh() {
    logger.debug('🔄 Token refresh timer triggered!');

    const currentToken = localStorage.getItem(this.tokenKey);
    if (!currentToken || !getIsTokenValid(currentToken)) {
      logger.debug('🔄 Current token is invalid, skipping auto-refresh');
      return;
    }

    logger.debug('🔄 Starting auto-refresh process...');

    const refreshToken = localStorage.getItem(this.refreshTokenKey);

    if (!refreshToken) {
      logger.warn('⚠️ No refresh token available for auto-refresh');
      return;
    }

    try {
      const { id_token } = await this.refreshToken(refreshToken, 'Auto-refresh');

      // Schedule next refresh
      this.scheduleAutoRefresh(id_token);
    } catch (err) {
      logger.error('❌ Auto-refresh failed:', err);
      // Don't schedule next refresh on failure
    }
  }

  /**
   * Manual token refresh (triggered by user action)
   *
   * @param {Object} options - Additional options
   * @param {boolean} options.skipSocketReconnect - If true, don't trigger socket reconnection
   * @returns {Promise<boolean>} True if refresh succeeded
   */
  async refreshManually(options = {}) {
    logger.info('🔄 Manual token refresh triggered...');

    // Clear any pending auto-refresh to avoid conflicts
    this.clearSchedule();

    const refreshToken = localStorage.getItem(this.refreshTokenKey);

    if (!refreshToken) {
      logger.warn('❌ No refresh token available for manual refresh');
      return false;
    }

    try {
      const { id_token } = await this.refreshToken(refreshToken, 'Manual-refresh', options);

      // Schedule next auto-refresh
      this.scheduleAutoRefresh(id_token);

      return true;
    } catch (err) {
      logger.error('❌ Manual refresh failed:', err);
      return false;
    }
  }

  /**
   * Check token validity and refresh if needed
   * Used on component mount / initialization
   *
   * @param {boolean} setAuthOnFailure - Whether to update auth state on failure
   * @returns {Promise<boolean>} True if token is valid or was refreshed
   */
  async checkAndRefreshIfNeeded(setAuthOnFailure = false) {
    const chatToken = localStorage.getItem(this.tokenKey);
    const refreshToken = localStorage.getItem(this.refreshTokenKey);
    const isTokenValid = getIsTokenValid(chatToken);

    logger.debug('🔍 Check-and-refresh: Token valid?', isTokenValid);

    if (chatToken && !isTokenValid && refreshToken) {
      try {
        await this.refreshToken(refreshToken, 'Check-refresh');
        return true;
      } catch (err) {
        logger.error('❌ Check-refresh failed:', err);

        if (setAuthOnFailure && this.onTokenRefreshFailed) {
          this.onTokenRefreshFailed(err);
        }

        return false;
      }
    }

    if (!chatToken && setAuthOnFailure && this.onTokenRefreshFailed) {
      this.onTokenRefreshFailed(new Error('No token found'));
    }

    return isTokenValid;
  }

  /**
   * Refresh token on disconnect (network error, auth error, etc.)
   *
   * @returns {Promise<boolean>} True if refresh succeeded
   */
  async refreshOnDisconnect() {
    logger.info('🔄 Disconnect-triggered token refresh...');

    const refreshToken = localStorage.getItem(this.refreshTokenKey);

    if (!refreshToken) {
      logger.warn('❌ No refresh token available for disconnect-refresh');
      return false;
    }

    try {
      await this.refreshToken(refreshToken, 'Disconnect-refresh');
      return true;
    } catch (err) {
      logger.error('❌ Disconnect-refresh failed:', err);
      return false;
    }
  }

  /**
   * Clear scheduled auto-refresh
   */
  clearSchedule() {
    if (this.refreshTimerRef) {
      clearTimeout(this.refreshTimerRef);
      this.refreshTimerRef = null;
      logger.debug('🕐 Cleared existing refresh timer');
    }
  }

  /**
   * Cleanup on unmount
   */
  destroy() {
    this.clearSchedule();
    logger.debug('🧹 TokenManager destroyed');
  }
}

/**
 * OAuthManager - Manages OAuth authentication state and token lifecycle
 * Extracted from index.js to improve code organization
 */

import logger from '../utils/logger';
import { getIsTokenValid } from '../utils/auth-utils';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/token';

export class OAuthManager {
  constructor(config) {
    this.tokenManager = config.tokenManager;
    this.storage = config.storage || localStorage;
    this.onTokenChange = config.onTokenChange; // (token) => void
    this.onAuthChange = config.onAuthChange; // (isAuth) => void
  }

  /**
   * Initialize OAuth state from storage
   * @returns {Object} { token, isAuth }
   */
  initializeFromStorage() {
    const token = this.storage.getItem(TOKEN_KEY);
    const isAuth = getIsTokenValid(token);

    logger.info('🔍 INIT: Token from storage:', token ? `${token.substring(0, 30)}...` : 'NULL');
    logger.info('🔍 INIT: isAuth:', isAuth);

    return { token, isAuth };
  }

  /**
   * Check and refresh token if needed
   * @param {boolean} resetAuth - Whether to reset auth on failure
   */
  async checkAndRefreshToken(resetAuth = false) {
    if (!this.tokenManager) {
      logger.warn('TokenManager not initialized');
      return false;
    }

    const isValid = await this.tokenManager.checkAndRefreshIfNeeded(resetAuth);

    if (isValid) {
      const newToken = this.storage.getItem(TOKEN_KEY);
      if (this.onTokenChange) {
        this.onTokenChange(newToken);
      }
      if (this.onAuthChange) {
        this.onAuthChange(true);
      }
    }

    return isValid;
  }

  /**
   * Schedule token refresh for a given token
   * @param {string} token - Token to schedule refresh for
   */
  scheduleTokenRefresh(token) {
    if (this.tokenManager && token) {
      this.tokenManager.scheduleAutoRefresh(token);
    }
  }

  /**
   * Initialize token refresh on mount
   */
  initializeTokenRefresh() {
    const token = this.storage.getItem(TOKEN_KEY);
    if (token && getIsTokenValid(token)) {
      this.scheduleTokenRefresh(token);
    }
  }

  /**
   * Handle token refresh after successful authentication
   * @param {string} newToken - New access token
   * @param {string} newRefreshToken - New refresh token
   */
  handleTokenRefreshed(newToken, newRefreshToken) {
    if (this.onTokenChange) {
      this.onTokenChange(newToken);
    }
    if (this.onAuthChange) {
      this.onAuthChange(true);
    }
  }

  /**
   * Handle token refresh failure
   * @param {Error} error - Error that occurred
   */
  handleTokenRefreshFailed(error) {
    logger.error('Token refresh failed:', error);
    if (this.onAuthChange) {
      this.onAuthChange(false);
    }
  }

  /**
   * Cleanup on unmount
   */
  destroy() {
    if (this.tokenManager) {
      this.tokenManager.destroy();
    }
  }
}

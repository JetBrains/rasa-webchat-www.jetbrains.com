/**
 * StorageManager - Token storage abstraction
 * Provides consistent interface for token storage operations
 * Supports both localStorage and sessionStorage
 */

import logger from '../utils/logger';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/token';

export class StorageManager {
  constructor(storageType = 'local') {
    this.storage = storageType === 'session' ? sessionStorage : localStorage;
    this.tokenKey = TOKEN_KEY;
    this.refreshTokenKey = REFRESH_TOKEN_KEY;
  }

  /**
   * Get access token from storage
   * @returns {string|null} Access token or null if not found
   */
  getToken() {
    return this.storage.getItem(this.tokenKey);
  }

  /**
   * Get refresh token from storage
   * @returns {string|null} Refresh token or null if not found
   */
  getRefreshToken() {
    return this.storage.getItem(this.refreshTokenKey);
  }

  /**
   * Store access token
   * @param {string} token - Access token to store
   */
  setToken(token) {
    if (!token) {
      logger.warn('StorageManager: Attempted to store null/undefined token');
      return;
    }
    this.storage.setItem(this.tokenKey, token);
    logger.debug('✅ StorageManager: Token stored');
  }

  /**
   * Store refresh token
   * @param {string} refreshToken - Refresh token to store
   */
  setRefreshToken(refreshToken) {
    if (!refreshToken) {
      logger.warn('StorageManager: Attempted to store null/undefined refresh token');
      return;
    }
    this.storage.setItem(this.refreshTokenKey, refreshToken);
    logger.debug('✅ StorageManager: Refresh token stored');
  }

  /**
   * Store both tokens at once
   * @param {string} token - Access token
   * @param {string} refreshToken - Refresh token
   */
  setTokens(token, refreshToken) {
    this.setToken(token);
    this.setRefreshToken(refreshToken);
  }

  /**
   * Clear access token from storage
   */
  clearToken() {
    this.storage.removeItem(this.tokenKey);
    logger.debug('🧹 StorageManager: Token cleared');
  }

  /**
   * Clear refresh token from storage
   */
  clearRefreshToken() {
    this.storage.removeItem(this.refreshTokenKey);
    logger.debug('🧹 StorageManager: Refresh token cleared');
  }

  /**
   * Clear both tokens from storage
   */
  clearAll() {
    this.clearToken();
    this.clearRefreshToken();
    logger.debug('🧹 StorageManager: All tokens cleared');
  }

  /**
   * Get session ID from storage
   * @returns {string|null} Session ID or null if not found
   */
  getSessionId() {
    return this.storage.getItem('chat_session_id');
  }

  /**
   * Store session ID
   * @param {string} sessionId - Session ID to store
   */
  setSessionId(sessionId) {
    if (!sessionId) {
      logger.warn('StorageManager: Attempted to store null/undefined session ID');
      return;
    }
    this.storage.setItem('chat_session_id', sessionId);
    logger.debug('✅ StorageManager: Session ID stored');
  }

  /**
   * Clear session ID from storage
   */
  clearSessionId() {
    this.storage.removeItem('chat_session_id');
    logger.debug('🧹 StorageManager: Session ID cleared');
  }
}

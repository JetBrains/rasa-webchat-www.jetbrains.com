/**
 * SessionManager - Manages session_id and versioning
 * Extracted from Widget component to improve code organization
 */

import { SESSION_NAME } from 'constants';
import { getLocalSession, storeLocalSession } from '../store/reducers/helper';

export class SessionManager {
  constructor(storage) {
    this.storage = storage;
    this.sessionName = SESSION_NAME;
  }

  /**
   * Get session_id from storage
   * @returns {string|null}
   */
  getSessionId() {
    const localSession = getLocalSession(this.storage, this.sessionName);
    return localSession ? localSession.session_id : null;
  }

  /**
   * Get session_id with fallback to socket
   * @param {Object} socket - Socket instance
   * @returns {string|null}
   */
  getSessionIdWithFallback(socket) {
    let sessionId = this.getSessionId();

    // Fallback to socket session
    if (!sessionId && socket?.sessionId) {
      sessionId = socket.sessionId;
    }

    // Fallback to preserved session (during token refresh)
    if (!sessionId && socket?.preservedSessionId) {
      sessionId = socket.preservedSessionId;
    }

    return sessionId;
  }

  /**
   * Store session_id to storage
   * @param {string} sessionId - Session ID to store
   */
  storeSession(sessionId) {
    storeLocalSession(this.storage, this.sessionName, sessionId);
  }

  /**
   * Clear session from storage
   */
  clearSession() {
    this.storage.removeItem(this.sessionName);
  }

  /**
   * Check version and clear if outdated
   * @returns {boolean} - True if version is current, false if cleared
   */
  checkVersion() {
    const localSession = getLocalSession(this.storage, this.sessionName);
    if (localSession && (localSession.version !== 'PACKAGE_VERSION_TO_BE_REPLACED')) {
      this.clearSession();
      return false;
    }
    return true;
  }

  /**
   * Check if widget should initialize based on cache settings
   * @param {boolean} autoClearCache - Whether to auto-clear cache
   * @returns {boolean} - True if should initialize
   */
  shouldInitialize(autoClearCache) {
    const localSession = getLocalSession(this.storage, this.sessionName);
    const lastUpdate = localSession ? localSession.lastUpdate : 0;

    if (autoClearCache) {
      // Session expires after 30 minutes
      return Date.now() - lastUpdate < 30 * 60 * 1000;
    }

    return !!lastUpdate;
  }

  /**
   * Get last update timestamp
   * @returns {number}
   */
  getLastUpdate() {
    const localSession = getLocalSession(this.storage, this.sessionName);
    return localSession ? localSession.lastUpdate : 0;
  }
}

import logger from './logger';
import { getTokenPayload, getIsTokenValid } from './auth-utils';

/**
 * Log token expiration information with context
 * @param {string} token - JWT token to analyze
 * @param {string} context - Context label for logging (e.g., "Auto-refresh", "Manual-refresh")
 * @returns {Object|null} Token info or null if invalid
 */
export const logTokenExpiration = (token, context = '') => {
  if (!token) {
    logger.warn(`${context}: No token provided`);
    return null;
  }

  try {
    const payload = getTokenPayload(token);
    if (!payload) {
      logger.warn(`${context}: Could not decode token payload`);
      return null;
    }

    const decoded = JSON.parse(payload);
    const now = Date.now() / 1000;
    const timeLeft = decoded.exp - now;
    const minutesLeft = Math.round(timeLeft / 60);

    if (timeLeft > 0) {
      logger.info(`${context}: Access token expires in ${minutesLeft} minutes`);
    } else {
      logger.error(`${context}: Token EXPIRED ${Math.abs(minutesLeft)} minutes ago!`);
    }

    return {
      isValid: timeLeft > 0,
      minutesLeft,
      expiresAt: new Date(decoded.exp * 1000),
      exp: decoded.exp
    };
  } catch (e) {
    logger.error(`${context}: Failed to decode token:`, e);
    return null;
  }
};

/**
 * Validate token with detailed logging
 * @param {string} token - JWT token to validate
 * @param {string} context - Context label for logging
 * @returns {Object} Validation result with details
 */
export const validateTokenDetailed = (token, context = '') => {
  if (!token) {
    logger.warn(`${context}: No token provided`);
    return { valid: false, reason: 'missing' };
  }

  if (!getIsTokenValid(token)) {
    const info = logTokenExpiration(token, context);
    return {
      valid: false,
      reason: 'expired',
      info
    };
  }

  const info = logTokenExpiration(token, context);
  return { valid: true, info };
};

/**
 * Log token verification after update
 * @param {string} expectedToken - Token that should be in localStorage
 * @param {string} tokenKey - localStorage key to check
 * @param {string} context - Context label for logging
 * @returns {boolean} True if verification passed
 */
export const verifyTokenInStorage = (expectedToken, tokenKey, context = '') => {
  const storedToken = localStorage.getItem(tokenKey);

  if (storedToken === expectedToken) {
    logger.info(`✅ ${context}: Token verification PASSED - localStorage updated correctly`);
    return true;
  }

  logger.error(`❌ ${context}: Token verification FAILED!`);
  logger.error(`❌ Expected: ${expectedToken.substring(0, 40)}...`);
  logger.error(`❌ Got from localStorage: ${storedToken ? storedToken.substring(0, 40) + '...' : 'NULL'}`);
  return false;
};

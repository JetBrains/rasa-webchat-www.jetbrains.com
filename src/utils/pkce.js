/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Extracted from auth-utils.js to improve code organization and testability
 */

/**
 * Generates a random code verifier for PKCE flow
 * @param {number} length - Length of the code verifier (default: 64)
 * @returns {string} Base64URL-encoded random string
 */
export function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '')
    .slice(0, length);
}

/**
 * Generates SHA-256 hash of input and returns as Base64URL string
 * @param {string} input - String to hash
 * @returns {Promise<string>} Base64URL-encoded hash
 */
export async function hashToBase64Url(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/, '');
}

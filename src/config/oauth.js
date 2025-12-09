/**
 * OAuth 2.0 configuration
 * Centralized configuration for OAuth endpoints and parameters
 * Extracted from auth-utils.js to improve maintainability
 */

import { getEnvUrl } from '../utils/environment';

// Auth URLs
export const authBaseUrl = getEnvUrl(
  process.env.AUTH_BASE_URL_LOCAL,
  process.env.AUTH_BASE_URL_DEV,
  process.env.AUTH_BASE_URL_STAGE,
  process.env.AUTH_BASE_URL_PROD
);

export const tokenEndpoint = getEnvUrl(
  process.env.TOKEN_ENDPOINT_LOCAL,
  process.env.TOKEN_ENDPOINT_DEV,
  process.env.TOKEN_ENDPOINT_STAGE,
  process.env.TOKEN_ENDPOINT_PROD
);

// Client ID
export const clientId = getEnvUrl(
  process.env.CLIENT_ID_LOCAL,
  process.env.CLIENT_ID_DEV,
  process.env.CLIENT_ID_STAGE,
  process.env.CLIENT_ID_PROD
);

// Redirect URI
export const redirectUri = getEnvUrl(
  process.env.REDIRECT_URI_LOCAL,
  process.env.REDIRECT_URI_DEV,
  process.env.REDIRECT_URI_STAGE,
  process.env.REDIRECT_URI_PROD
);

// Scope
export const scope = process.env.SCOPE || 'openid offline_access r_assets';

// OAuth popup window features
export const OAUTH_POPUP_FEATURES = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';

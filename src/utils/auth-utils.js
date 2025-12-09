import logger from './logger';
import { environment, getEnvUrl } from './environment';
import { generateCodeVerifier, hashToBase64Url } from './pkce';
import {
  authBaseUrl,
  tokenEndpoint,
  clientId,
  redirectUri,
  scope,
  OAUTH_POPUP_FEATURES
} from '../config/oauth';

// 🔍 DIAGNOSTIC LOGGING
logger.info('🔍 AUTH-UTILS: Current environment:', environment);
logger.info('🔍 AUTH-UTILS: process.env.ENVIRONMENT:', process.env.ENVIRONMENT);
logger.log('🔍 Current environment:', environment);
logger.log('🔍 RASA_URL_STAGE:', process.env.RASA_URL_STAGE);

// Rasa endpoint with automatic /webhooks/rest/webhook suffix
const rasaBaseUrl = getEnvUrl(
  process.env.RASA_URL_LOCAL,
  process.env.RASA_URL_DEV,
  process.env.RASA_URL_STAGE,
  process.env.RASA_URL_PROD
);
export const rasaEndpoint = `${rasaBaseUrl}/webhooks/rest/webhook`;

// Generate PKCE code verifier and state
const codeVerifier = generateCodeVerifier();
export const state = crypto.randomUUID();

export const getAuthCode = async () => {
  const codeChallenge = await hashToBase64Url(codeVerifier);

  const params = {
    response_type: 'code id_token',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state
  };

  const queryString = new URLSearchParams(params).toString();
  window.open(`${authBaseUrl}?${queryString}`, 'popup', OAUTH_POPUP_FEATURES);
};

export const exchangeTokenReq = async (code) => {
  const body = new URLSearchParams([
    ['code', code],
    ['grant_type', 'authorization_code'],
    ['client_id', clientId],
    ['redirect_uri', redirectUri],
    ['code_verifier', codeVerifier],
    ['state', state]
  ]);

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  return res.json();
};

export const refreshTokenReq = async (refreshToken) => {
  logger.debug('🔄 refreshTokenReq called with token:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'NULL');

  const body = new URLSearchParams([
    ['refresh_token', refreshToken],
    ['grant_type', 'refresh_token'],
    ['client_id', clientId]
  ]);

  try {
    const response = await fetch(tokenEndpoint, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      body: body.toString()
    });

    logger.debug('🔄 refreshTokenReq response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ refreshTokenReq failed:', response.status, response.statusText, errorText);
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.debug('🔄 refreshTokenReq response data:', {
      has_id_token: !!data.id_token,
      has_refresh_token: !!data.refresh_token
    });

    return data;
  } catch (err) {
    logger.error('❌ refreshTokenReq request failed:', err);
    throw err;
  }
};

export const getTokenPayload = (token) => {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    return atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (e) {
    return null;
  }
};

export const getIsTokenValid = (token) => {
  if (!token) return false;

  try {
    const payload = getTokenPayload(token);
    const { exp } = JSON.parse(payload) || {};

    if (!exp) return false;

    const now = Date.now() / 1000;
    return exp > now;
  } catch (e) {
    return false;
  }
};

export const getTokenExpirationTime = (token) => {
  if (!token) return null;

  try {
    const payload = getTokenPayload(token);
    const { exp } = JSON.parse(payload) || {};

    return exp ? exp * 1000 : null;
  } catch (e) {
    return null;
  }
};


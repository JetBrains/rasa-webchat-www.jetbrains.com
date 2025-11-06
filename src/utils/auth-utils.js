import logger from './logger';

const environment = process.env.ENVIRONMENT || 'staging';

// Function to get URL based on environment
const getEnvUrl = (localUrl, devUrl, stageUrl, prodUrl) => {
  if (environment === 'production') return prodUrl;
  if (environment === 'staging') return stageUrl;
  if (environment === 'development') return devUrl;
  if (environment === 'local') return localUrl;
  return stageUrl; // default to staging
};

// Rasa endpoint with automatic /webhooks/rest/webhook suffix
const rasaBaseUrl = getEnvUrl(
  process.env.RASA_URL_LOCAL,
  process.env.RASA_URL_DEV,
  process.env.RASA_URL_STAGE,
  process.env.RASA_URL_PROD
);
export const rasaEndpoint = `${rasaBaseUrl}/webhooks/rest/webhook`;

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

const strWindowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';

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

export function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '')
    .slice(0, length);
}


const codeVerifier = generateCodeVerifier();

export const state = crypto.randomUUID();

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
  window.open(`${authBaseUrl}?${queryString}`, 'popup', strWindowFeatures);
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

export const authInRasa = async (idToken) => {
  try {
    const response = await fetch(rasaEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: 'test_user',
        message: '/session_start',
        metadata: {
          auth_header: idToken
        }
      })
    });

    return await response.json();
  } catch (err) {
    logger.error('authInRasa request failed:', err);
  }

  return null;
};

export const refreshTokenReq = async (refreshToken) => {
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

    return await response.json();
  } catch (err) {
    logger.error('refreshTokenReq request failed:', err);
  }

  return null;
};

const getTokenPayload = (token) => {
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

export const getEmailFromToken = (token) => {
  if (!token) return null;

  try {
    const payload = getTokenPayload(token);
    const { email } = JSON.parse(payload) || {};

    return email || null;
  } catch (e) {
    return null;
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


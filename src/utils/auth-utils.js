export const authBaseUrl1 =
  'https://active.jetprofile-stgn.intellij.net/oauth/login';
export const tokenEndpoint =
  'https://public.staging.oauth.intservices.aws.intellij.net/oauth2/token';
export const rasaEndpoint =
    'https://rasa-dev-jb.labs.jb.gg/webhooks/rest/webhook';
// const rasaEndpoint2 = 'https://rasa-dev.labs.jb.gg/webhooks/rest/webhook';
const strWindowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';


export const clientId = 'support-chat-staging';
// our stage
// for local dev please use http://localhost:9000/support
// todo: change for prod
export const redirectUri = 'https://entry.i18n.w3jbcom.aws.intellij.net/support/?switch-to-branch=JS-22926-chat-bot';
export const scope = 'openid offline_access r_assets';

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
  window.open(`${authBaseUrl1}?${queryString}`, 'popup', strWindowFeatures);
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
    console.error(err);
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

export const isTokenValid = (token) => {
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


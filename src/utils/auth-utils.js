export const authBaseUrl1 =
  'https://active.jetprofile-stgn.intellij.net/oauth/login';
export const tokenEndpoint =
  'https://public.staging.oauth.intservices.aws.intellij.net/oauth2/token';
export const rasaEndpoint =
    'https://rasa-dev-jb.labs.jb.gg/webhooks/rest/webhook';
// const rasaEndpoint2 = 'https://rasa-dev.labs.jb.gg/webhooks/rest/webhook';
const strWindowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';


export const clientId = 'support-chat-staging';
export const redirectUri = 'http://localhost:9000/support';
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

export const isTokenValid = (token) => {
  if (!token) return false;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return false;

    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(payloadJson) || {};

    if (!exp) return false;

    const now = Date.now() / 1000; // текущий момент в секундах

    return exp > now;
  } catch (e) {
    return false;
  }
};

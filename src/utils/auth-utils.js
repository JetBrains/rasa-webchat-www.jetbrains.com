export const authBaseUrl1 =
  'https://active.jetprofile-stgn.intellij.net/oauth/login';
export const tokenEndpoint =
  'https://public.staging.oauth.intservices.aws.intellij.net/oauth2/token';
export const rasaEndpoint =
  'https://rasa-dev-jb.labs.jb.gg/webhooks/rest/webhook';
// const rasaEndpoint2 = 'https://rasa-dev.labs.jb.gg/webhooks/rest/webhook';
const strWindowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';
export const codeStatic = 'OmmxIlFVy-vEdYn05v7nEBzgI6HwxlzrfEhV5hy8zWE.60PLBQBc8S2mzqPLX0KFv0J6GEb0Yh3oUuarcslRjD8';


export const clientId = 'support-chat-staging';
export const redirectUri = 'http://localhost:9000/support';
export const scope = 'openid offline_access r_assets';
// const codeVerifier = generateCodeVerifier();
// export const codeVerifier =
//   'SoQrv596CYq3WGdgezWy6HdUuZp_2QCJH-h9eVFfs3XPOzf-Ybdvy2TokO0xDMaq';
const codeVerifier = 'minimum64bytesminimum64bytesminimum64bytesminimum64bytesminimum6';

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

export function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '')
    .slice(0, length);
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

  // todo: open in a small window
  // window.open(`${authBaseUrl1}?${queryString}`, 'popup', strWindowFeatures);
  window.location.href = `${authBaseUrl1}?${queryString}`;
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

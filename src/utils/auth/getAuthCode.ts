import scope from 'utils/environment/constants.ts';

import hashToBase64Url from './hashToBase64Url.ts';
import clientId from './clientId.ts';
import redirectUri from './redirectUri.ts';
import codeVerifier from './codeVerifier.ts';
import state from './state.ts';
import authBaseUrl from './authBaseUrl.ts';

const strWindowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';

const getAuthCode = async () => {
  const codeChallenge = await hashToBase64Url(codeVerifier);

  const params = {
    response_type: 'code id_token',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  };

  const queryString = new URLSearchParams(params).toString();

  window.open(`${authBaseUrl}?${queryString}`, 'popup', strWindowFeatures);
};

export default getAuthCode;

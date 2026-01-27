import clientId from './clientId.ts';
import codeVerifier from './codeVerifier.ts';
import redirectUri from './redirectUri.ts';
import state from './state.ts';
import tokenEndpoint from './tokenEndpoint.ts';

const exchangeTokenReq = async (code: string) => {
  const body = new URLSearchParams([
    ['code', code],
    ['grant_type', 'authorization_code'],
    ['client_id', clientId],
    ['redirect_uri', redirectUri],
    ['code_verifier', codeVerifier],
    ['state', state],
  ]);

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  return res.json();
};

export default exchangeTokenReq;

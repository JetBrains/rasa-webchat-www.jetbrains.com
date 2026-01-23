import logger from 'utils/logger';
import clientId from './clientId.ts';
import tokenEndpoint from './tokenEndpoint.ts';

const refreshTokenReq = async (refreshToken: string) => {
  logger.debug(
    '🔄 refreshTokenReq called with token:',
    refreshToken ? `${refreshToken.substring(0, 20)}...` : 'NULL'
  );

  const body = new URLSearchParams([
    ['refresh_token', refreshToken],
    ['grant_type', 'refresh_token'],
    ['client_id', clientId],
  ]);

  try {
    const response = await fetch(tokenEndpoint, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      body: body.toString(),
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
      has_refresh_token: !!data.refresh_token,
    });

    return data;
  } catch (err) {
    logger.error('❌ refreshTokenReq request failed:', err);
    throw err;
  }
};

export default refreshTokenReq;

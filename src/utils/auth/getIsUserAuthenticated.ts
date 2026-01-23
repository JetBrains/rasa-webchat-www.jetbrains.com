import { TOKEN_KEY } from 'constants.js';
import { getIsTokenValid } from './tokenPayload';
import logger from 'utils/logger';

const getIsUserAuthenticated = () => {
  const chatToken = localStorage.getItem(TOKEN_KEY);

  const isValid = chatToken ? getIsTokenValid(chatToken) : false;
  logger.info('🔍 INIT: is token valid:', isValid);

  return isValid;
};

export default getIsUserAuthenticated;

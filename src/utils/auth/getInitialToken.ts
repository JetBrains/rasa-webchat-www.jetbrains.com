import { TOKEN_KEY } from 'constants.js';
import logger from 'utils/logger';

const getInitialToken = () => {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  logger.info(
    '🔍 INIT: Token from localStorage:',
    initialToken ? `${initialToken.substring(0, 30)}...` : 'NULL'
  );
  logger.info('🔍 INIT: TOKEN_KEY used:', TOKEN_KEY);

  return initialToken;
};

export default getInitialToken;

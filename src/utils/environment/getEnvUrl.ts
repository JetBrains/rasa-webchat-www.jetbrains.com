import logger from 'utils/logger';

const environment = process.env.ENVIRONMENT || 'staging';

// 🔍 DIAGNOSTIC LOGGING
logger.info('🔍process.env.ENVIRONMENT:', process.env.ENVIRONMENT);
logger.log('🔍 Current environment:', environment);
logger.log('🔍 RASA_URL_STAGE:', process.env.RASA_URL_STAGE);

const getEnvUrl = (localUrl: string, devUrl: string, stageUrl: string, prodUrl: string) => {
  if (environment === 'production') return prodUrl;
  if (environment === 'staging') return stageUrl;
  if (environment === 'development') return devUrl;
  if (environment === 'local') return localUrl;

  return stageUrl;
};

export default getEnvUrl;

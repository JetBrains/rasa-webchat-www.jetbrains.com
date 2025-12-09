export const environment = process.env.ENVIRONMENT || 'staging';

/**
 * Get URL based on current environment
 * @param {string} localUrl - URL for local environment
 * @param {string} devUrl - URL for development environment
 * @param {string} stageUrl - URL for staging environment
 * @param {string} prodUrl - URL for production environment
 * @returns {string} URL for current environment
 */
export const getEnvUrl = (localUrl, devUrl, stageUrl, prodUrl) => {
  if (environment === 'production') return prodUrl;
  if (environment === 'staging') return stageUrl;
  if (environment === 'development') return devUrl;
  if (environment === 'local') return localUrl;
  return stageUrl; // default to staging
};

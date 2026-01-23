import getEnvUrl from 'utils/environment/getEnvUrl.ts';

const authBaseUrl = getEnvUrl(
  process.env.AUTH_BASE_URL_LOCAL!,
  process.env.AUTH_BASE_URL_DEV!,
  process.env.AUTH_BASE_URL_STAGE!,
  process.env.AUTH_BASE_URL_PROD!
);

export default authBaseUrl;

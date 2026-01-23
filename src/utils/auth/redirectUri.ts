import getEnvUrl from 'utils/environment/getEnvUrl.ts';

const redirectUri = getEnvUrl(
  process.env.REDIRECT_URI_LOCAL!,
  process.env.REDIRECT_URI_DEV!,
  process.env.REDIRECT_URI_STAGE!,
  process.env.REDIRECT_URI_PROD!
);

export default redirectUri;

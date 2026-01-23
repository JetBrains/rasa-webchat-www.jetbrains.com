import getEnvUrl from 'utils/environment/getEnvUrl.ts';

const tokenEndpoint = getEnvUrl(
  process.env.TOKEN_ENDPOINT_LOCAL!,
  process.env.TOKEN_ENDPOINT_DEV!,
  process.env.TOKEN_ENDPOINT_STAGE!,
  process.env.TOKEN_ENDPOINT_PROD!
);

export default tokenEndpoint;

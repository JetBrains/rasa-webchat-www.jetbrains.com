import getEnvUrl from 'utils/environment/getEnvUrl.ts';

const clientId = getEnvUrl(
  process.env.CLIENT_ID_LOCAL!,
  process.env.CLIENT_ID_DEV!,
  process.env.CLIENT_ID_STAGE!,
  process.env.CLIENT_ID_PROD!
);

export default clientId;

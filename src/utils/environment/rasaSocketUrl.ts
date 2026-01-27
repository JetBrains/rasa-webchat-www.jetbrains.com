import getEnvUrl from './getEnvUrl.ts';

const rasaSocketUrl = getEnvUrl(
  process.env.RASA_URL_LOCAL!,
  process.env.RASA_URL_DEV!,
  process.env.RASA_URL_STAGE!,
  process.env.RASA_URL_PROD!
);

export default rasaSocketUrl;
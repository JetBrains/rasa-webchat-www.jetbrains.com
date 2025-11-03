// Centralized logger utility for rasa-webchat
// - Verbose logs (debug/info/log) are disabled by default in production
// - warn/error are always enabled
// - You can enable verbose logs on production at runtime via:
//   localStorage.setItem('webchat:debug', '1')  // and reload
//   or by adding ?webchat_debug=1 to the page URL

const ENV = process.env.ENVIRONMENT;
const isProd = ENV === 'production';

function makeLogger() {
  const hasWindow = typeof window !== 'undefined';
  let debugEnabled = false;

  if (hasWindow) {
    try {
      const ls = window.localStorage && window.localStorage.getItem('webchat:debug');
      if (ls === '1' || ls === 'true') debugEnabled = true;
      if (/([?&])webchat_debug=(1|true)\b/i.test(window.location.search)) debugEnabled = true;
    } catch (_) {
      // ignore access errors
    }
  }

  // In production, detailed logs are disabled unless debug is explicitly enabled
  const detailed = !isProd || debugEnabled;

  const noop = () => {};
  const base = detailed
    ? console
    : {
        log: noop,
        info: noop,
        debug: noop,
        // keep warnings and errors visible in production
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };

  // Optional prefix to make filtering easier
  const prefix = '[WebChat]';
  const wrap = (fn) => (...args) => fn(prefix, ...args);

  return {
    debug: wrap(base.debug || base.log),
    info: wrap(base.info || base.log),
    log: wrap(base.log),
    warn: wrap(base.warn),
    error: wrap(base.error)
  };
}

const logger = makeLogger();
export default logger;

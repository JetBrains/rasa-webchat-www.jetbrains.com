// Centralized logger utility for rasa-webchat
// - Verbose logs (debug/info/log) are disabled by default in production
// - warn/error are always enabled
// - You can enable verbose logs on production at runtime via:
//   localStorage.setItem('webchat:debug', '1')  // and reload
//   or by adding ?webchat_debug=1 to the page URL
// - All log entries are prefixed with version first (e.g., v1.2.3) and then widget tag
//   Version is resolved in this order:
//     1) process.env.WEBCHAT_VERSION (from .env/CI)
//     2) package.json version injected at build time via string-replace-loader

const ENV = process.env.ENVIRONMENT;
const isProd = ENV === 'production';

function makeLogger() {
  const hasWindow = typeof window !== 'undefined';
  let debugEnabled = false;

  // Determine version string
  // NOTE: 'PACKAGE_VERSION_TO_BE_REPLACED' is replaced by webpack string-replace-loader
  const PKG_VERSION = 'PACKAGE_VERSION_TO_BE_REPLACED';
  const envVersion =
    typeof process !== 'undefined' && process.env && process.env.WEBCHAT_VERSION
      ? process.env.WEBCHAT_VERSION
      : undefined;
  const definedPkgVersion =
    typeof process !== 'undefined' && process.env && process.env.WEBCHAT_PKG_VERSION
      ? process.env.WEBCHAT_PKG_VERSION
      : undefined;
  let version = envVersion || definedPkgVersion || PKG_VERSION || '0.0.0';
  // Fallback in case string replace didn't happen
  if (version === 'PACKAGE_VERSION_TO_BE_REPLACED') {
    version = definedPkgVersion || '0.0.0';
  }
  // Final safety net: try to read version directly from package.json at build time
  if (!version || version === '0.0.0') {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const pkg = require('../../package.json');
      if (pkg && pkg.version) version = pkg.version;
    } catch (_) {
      // ignore if bundler disallows requiring JSON here
    }
  }

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
        error: console.error.bind(console),
      };

  // Optional prefix to make filtering easier
  // For regular logs show only the widget tag (no version)
  const prefixParts = ['[WebChat]'];
  const wrap = (fn) => (...args) => fn(...prefixParts, ...args);

  // One-time startup banner — always visible in browser and SSR/Node
  try {
    // Use plain console.log to bypass production suppression for this single line
    const envLabel = ENV || 'unknown';
    const showEnv = !isProd; // never show env on production, even if debug is enabled
    const suffix = showEnv ? ` (env: ${envLabel})` : '';
    console.log(`[WebChat] v${version}${suffix}`);
  } catch (_) {
    // ignore
  }

  return {
    debug: wrap(base.debug || base.log),
    info: wrap(base.info || base.log),
    log: wrap(base.log),
    warn: wrap(base.warn),
    error: wrap(base.error),
  };
}

const logger = makeLogger();
export default logger;

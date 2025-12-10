/**
 * UrlTracker - Manages URL history tracking and navigation events
 * Extracted from RulesHandler to improve code organization
 */

import logger from '../../utils/logger';

export const LOCAL_STORAGE_ACCESS_STRING = 'rasaWebchatPro';

export class UrlTracker {
  constructor() {
    this.url = window.location.host + window.location.pathname;
    this.protocol = window.location.protocol;
    this.lastLocationChange = Date.now();
    this.history = {};

    // Supersede history methods to dispatch custom events
    this.setupHistoryInterception();
    this.setupLocationChangeListener();
  }

  setupHistoryInterception() {
    window.history.pushState = (f =>
      function pushState() {
        const ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('pushstate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
      })(window.history.pushState);

    window.history.replaceState = (f =>
      function replaceState() {
        const ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('replacestate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
      })(window.history.replaceState);

    this.popstateCallback = () => {
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', this.popstateCallback);
  }

  setupLocationChangeListener() {
    this.locationChangeCallback = (onLocationChange) => {
      const now = Date.now();
      if ((now - this.lastLocationChange) < 150) {
        return;
      }
      this.lastLocationChange = now;
      this.url = window.location.host + window.location.pathname;

      if (onLocationChange) {
        onLocationChange(this.url);
      }
    };
  }

  registerLocationChangeHandler(callback) {
    const wrappedCallback = () => this.locationChangeCallback(callback);
    window.addEventListener('locationchange', wrappedCallback);
    return wrappedCallback; // Return for later cleanup
  }

  getCurrentUrl() {
    return this.url;
  }

  fetchHistory() {
    const storageHistory = localStorage.getItem(LOCAL_STORAGE_ACCESS_STRING);
    this.history = storageHistory ? JSON.parse(storageHistory) : {};
    if (!this.history.path) this.history.path = [];
    if (!this.history.timePerPage) this.history.timePerPage = {};
    if (!this.history.rulesTriggered) this.history.rulesTriggered = [];
    return this.history;
  }

  storeHistory(url) {
    if (this.history && this.history.lastTimeInDomain) {
      const timeSinceLastSession = Date.now() - Date.parse(this.history.lastTimeInDomain);
      const minutesSinceLastSession = timeSinceLastSession / (60 * 1000);
      if (minutesSinceLastSession > 30) {
        this.history.timesInDomain =
          this.history && this.history.timesInDomain ? this.history.timesInDomain + 1 : 1;
        this.history.path = [];
      }
    }
    if (url) this.history.path.push(url);
    localStorage.setItem(
      LOCAL_STORAGE_ACCESS_STRING,
      JSON.stringify({
        path: this.history.path,
        lastTimeInDomain: new Date(),
        timesInDomain: (this.history && this.history.timesInDomain) || 1,
        timePerPage: this.history.timePerPage,
        rulesTriggered: this.history.rulesTriggered
      })
    );
  }

  static cleanURL(url) {
    const regexProtocolHostPort = /(https?:\/\/)?(([A-Za-z0-9-])+(\.?))+[a-z]+(:[0-9]+)?/;
    const regexLastTrailingSlash = /\/$|\/(?=\?)/;
    const regexQueryString = /\?.+$/;
    const cleanUrl = url
      .replace(regexProtocolHostPort, '')
      .replace(regexLastTrailingSlash, '')
      .replace(regexQueryString, '');
    return cleanUrl;
  }

  static compareUrls(urlWindow, urlCompare, partialMatch = false) {
    if (partialMatch) {
      return UrlTracker.cleanURL(urlWindow).includes(UrlTracker.cleanURL(urlCompare));
    }
    return UrlTracker.cleanURL(urlWindow) === UrlTracker.cleanURL(urlCompare);
  }

  verifyUrlSequence(trigger, history) {
    let sequenceMatched = true;
    if (history.path.length >= trigger.url.length) {
      let historyPosition = history.path.length - 1;
      trigger.url.forEach((triggerUrl, index) => {
        if (sequenceMatched === false || historyPosition < 0) return;
        const historyUrl = history.path[historyPosition];
        if (!UrlTracker.compareUrls(historyUrl, triggerUrl.path, triggerUrl.partialMatch)) {
          if (index === 0) {
            sequenceMatched = false;
            return;
          }
          let matchedTrigger = false;
          let matchedFirstAndLast = true;
          let tries = 0;
          while (matchedFirstAndLast && !matchedTrigger && historyPosition >= 0) {
            historyPosition -= 1;
            if (tries > 8) {
              sequenceMatched = false;
              break;
            }
            tries += 1;
            matchedTrigger = UrlTracker.compareUrls(
              history.path[historyPosition],
              triggerUrl.path,
              trigger.partialMatch
            );
            if (!matchedTrigger) {
              matchedFirstAndLast = UrlTracker.compareUrls(
                history.path[historyPosition],
                historyUrl
              );
            }
          }
          sequenceMatched = matchedTrigger;
        } else {
          historyPosition -= 1;
        }
      });
    } else {
      sequenceMatched = false;
    }
    return sequenceMatched;
  }

  verifyUrl(trigger, history) {
    if (!trigger.url) return true;

    let urlToUse = {};
    if (trigger.url && Array.isArray(trigger.url) && trigger.url.length === 1) {
      urlToUse = trigger.url[0];
    } else {
      urlToUse = trigger.url;
    }

    // one url
    if (typeof urlToUse === 'object' && typeof urlToUse.path === 'string') {
      return UrlTracker.compareUrls(this.url, urlToUse.path, urlToUse.partialMatch);
    }

    // multiple urls
    if (Array.isArray(urlToUse)) {
      if (trigger.urlIsSequence) {
        return this.verifyUrlSequence(trigger, history);
      }
      return urlToUse.every(url =>
        history.path.some(historyUrl =>
          UrlTracker.compareUrls(historyUrl, url.path, url.partialMatch)
        )
      );
    }

    return false;
  }

  cleanup() {
    if (this.popstateCallback) {
      window.removeEventListener('popstate', this.popstateCallback);
    }
  }
}

/**
 * MetadataPropagator - Propagates metadata from bot_uttered to Redux store
 * Extracted from Widget component to improve code organization
 */

import {
  setLinkTarget,
  setUserInput,
  setPageChangeCallbacks,
  changeOldUrl,
  setDomHighlight,
  openChat,
  closeChat
} from 'actions';

export class MetadataPropagator {
  constructor(dispatch) {
    this.dispatch = dispatch;
  }

  /**
   * Propagate metadata to Redux store
   * @param {Object} metadata - Metadata from bot_uttered
   * @returns {Object|null} pageEventCallbacks if present
   */
  propagate(metadata) {
    const {
      linkTarget,
      userInput,
      pageChangeCallbacks,
      domHighlight,
      forceOpen,
      forceClose,
      pageEventCallbacks
    } = metadata;

    if (linkTarget) {
      this.dispatch(setLinkTarget(linkTarget));
    }

    if (userInput) {
      this.dispatch(setUserInput(userInput));
    }

    if (pageChangeCallbacks) {
      this.dispatch(changeOldUrl(window.location.href));
      this.dispatch(setPageChangeCallbacks(pageChangeCallbacks));
    }

    if (domHighlight) {
      this.dispatch(setDomHighlight(domHighlight));
    }

    if (forceOpen) {
      this.dispatch(openChat());
    }

    if (forceClose) {
      this.dispatch(closeChat());
    }

    // Return pageEventCallbacks for separate handling
    return pageEventCallbacks || null;
  }
}

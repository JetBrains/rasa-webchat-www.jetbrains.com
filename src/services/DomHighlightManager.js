/**
 * DomHighlightManager - Manages DOM element highlighting
 * Extracted from Widget component to improve code organization
 */

import { safeQuerySelectorAll } from '../utils/dom';

export class DomHighlightManager {
  constructor(config) {
    this.defaultHighlightCss = config.defaultHighlightCss;
    this.defaultHighlightClassname = config.defaultHighlightClassname;
    this.currentHighlight = null;
  }

  /**
   * Apply highlighting to DOM elements
   * @param {Object} domHighlight - Highlight configuration from metadata
   */
  applyHighlight(domHighlight) {
    const domHighlightJS = domHighlight.toJS ? domHighlight.toJS() : domHighlight;

    if (!domHighlightJS.selector) return;

    const elements = safeQuerySelectorAll(domHighlightJS.selector);

    elements.forEach((element) => {
      this.applyStyleToElement(element, domHighlightJS);
    });

    // Scroll to highlighted element
    if (elements[0] && elements[0].scrollIntoView) {
      this.scrollToElement(elements[0]);
    }

    this.currentHighlight = { selector: domHighlightJS.selector, elements };
  }

  /**
   * Clear highlighting from DOM elements
   * @param {Object} domHighlight - Highlight configuration from metadata
   */
  clearHighlight(domHighlight) {
    const domHighlightJS = domHighlight.toJS ? domHighlight.toJS() : domHighlight;

    if (!domHighlightJS.selector) return;

    const elements = safeQuerySelectorAll(domHighlightJS.selector);

    elements.forEach((element) => {
      this.clearStyleFromElement(element, domHighlightJS);
    });

    this.currentHighlight = null;
  }

  /**
   * Apply style to single element
   * @param {HTMLElement} element - DOM element
   * @param {Object} domHighlight - Highlight configuration
   */
  applyStyleToElement(element, domHighlight) {
    switch (domHighlight.style) {
      case 'custom':
        element.setAttribute('style', domHighlight.css);
        break;
      case 'class':
        element.classList.add(domHighlight.css);
        break;
      default:
        if (this.defaultHighlightClassname !== '') {
          element.classList.add(this.defaultHighlightClassname);
        } else {
          element.setAttribute('style', this.defaultHighlightCss);
        }
    }
  }

  /**
   * Clear style from single element
   * @param {HTMLElement} element - DOM element
   * @param {Object} domHighlight - Highlight configuration
   */
  clearStyleFromElement(element, domHighlight) {
    switch (domHighlight.style) {
      case 'custom':
        element.setAttribute('style', '');
        break;
      case 'class':
        element.classList.remove(domHighlight.css);
        break;
      default:
        if (this.defaultHighlightClassname !== '') {
          element.classList.remove(this.defaultHighlightClassname);
        } else {
          element.setAttribute('style', '');
        }
    }
  }

  /**
   * Scroll to highlighted element
   * @param {HTMLElement} element - DOM element to scroll to
   */
  scrollToElement(element) {
    // Add delay to prevent conflict with scrollToBottom in messages.jsx
    setTimeout(() => {
      if (/Mobi/.test(navigator.userAgent)) {
        // Mobile device
        element.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth'
        });
      } else {
        // Desktop - check if element is in viewport first
        const rectangle = element.getBoundingClientRect();
        const isInViewPort = this.isElementInViewport(rectangle);

        if (!isInViewPort) {
          element.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
        }
      }
    }, 50);
  }

  /**
   * Check if element is in viewport
   * @param {DOMRect} rect - Element bounding rectangle
   * @returns {boolean}
   */
  isElementInViewport(rect) {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Get current highlight info
   * @returns {Object|null}
   */
  getCurrentHighlight() {
    return this.currentHighlight;
  }
}

/**
 * CustomEventManager - Manages custom DOM event listeners
 * Extracted from Widget component to improve code organization
 */

export class CustomEventManager {
  constructor() {
    this.listeners = [];
  }

  /**
   * Register page event listeners from metadata
   * @param {Array} pageEventCallbacks - Array of page event configurations
   * @param {Function} sendMessageFn - Function to send message when event triggers
   * @returns {Function} Cleanup function
   */
  registerPageEvents(pageEventCallbacks, sendMessageFn) {
    // Clear previous listeners first
    this.clearAll();

    pageEventCallbacks.forEach((pageEvent) => {
      const { event, payload, selector } = pageEvent;

      if (event && payload && selector) {
        const elements = document.querySelectorAll(selector);

        if (elements.length > 0) {
          elements.forEach((elem) => {
            const handler = () => {
              sendMessageFn(payload);
            };

            this.listeners.push({ elem, event, handler });
            elem.addEventListener(event, handler);
          });
        }
      }
    });

    // Return cleanup function
    return () => this.clearAll();
  }

  /**
   * Clear all registered event listeners
   */
  clearAll() {
    this.listeners.forEach(({ elem, event, handler }) => {
      elem.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  /**
   * Get number of active listeners
   * @returns {number}
   */
  getListenerCount() {
    return this.listeners.length;
  }
}

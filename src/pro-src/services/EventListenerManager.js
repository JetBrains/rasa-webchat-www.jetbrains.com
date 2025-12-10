/**
 * EventListenerManager - Manages DOM event listeners for rule triggers
 * Extracted from RulesHandler to improve code organization
 */

import logger from '../../utils/logger';
import { onRemove } from '../utils';

export class EventListenerManager {
  constructor(config) {
    this.triggerEventListenerUpdateRate = config.triggerEventListenerUpdateRate || 500;
    this.verifyConditions = config.verifyConditions; // (rules, boolMode, tooltipSelector, removeViz) => void
    this.addViz = config.addViz; // (listener, elem) => removalMethod
    this.eventListeners = [];
    this.resetListenersTimeouts = [];
  }

  static removeEventListeners(eventListeners) {
    eventListeners.forEach((eventListener) => {
      eventListener.elem.removeEventListener(
        eventListener.event,
        eventListener.conditionChecker
      );
    });
  }

  initEventHandler(rules, withViz = true) {
    const trigger = rules.trigger || {};
    const eventListenersForThisTrigger = [];

    trigger.eventListeners.forEach((listener) => {
      if (!listener.selector || !listener.event) {
        logger.warn("You're missing a selector or an event on an event listener");
        return;
      }
      let elemList = null;
      try {
        elemList = document.querySelectorAll(listener.selector);
      } catch (e) {
        logger.warn(`${listener.selector} is not a valid selector string`);
      }
      if (elemList.length > 0) {
        elemList.forEach((elem) => {
          let removalMethod = () => {};
          const conditionChecker = () => {
            this.verifyConditions(
              rules,
              false,
              listener.visualization ? listener.selector : undefined,
              removalMethod
            );
          };

          const eventListener = {
            elem,
            event: listener.event,
            conditionChecker,
            id: Math.random()
          };

          this.eventListeners.push(eventListener);
          eventListenersForThisTrigger.push(eventListener);

          elem.addEventListener(listener.event, conditionChecker);

          if (this.verifyConditions(rules, true) && listener.visualization !== 'none' && withViz) {
            removalMethod = this.addViz(listener, elem);
            onRemove(elem, removalMethod);
          }
        });
      }
    });

    const timeoutId = Math.random();

    this.resetListenersTimeouts.push({
      timeout: setTimeout(() => {
        // Remove the timeout that just triggered
        this.resetListenersTimeouts = this.resetListenersTimeouts
          .filter(timeout => timeout.id !== timeoutId);

        EventListenerManager.removeEventListeners(eventListenersForThisTrigger);

        // Remove the event listeners from the cleanup list
        this.eventListeners = this.eventListeners
          .filter(listener => !eventListenersForThisTrigger
            .some(eListener => eListener.id === listener.id)
          );

        // Recall this method without placing the vizs to replace listeners on new elements
        this.initEventHandler(rules, false);
      }, this.triggerEventListenerUpdateRate),
      id: timeoutId
    });
  }

  cleanUp() {
    EventListenerManager.removeEventListeners(this.eventListeners);
    this.resetListenersTimeouts.forEach(({ timeout }) => {
      clearTimeout(timeout);
    });
    this.eventListeners = [];
    this.resetListenersTimeouts = [];
  }
}

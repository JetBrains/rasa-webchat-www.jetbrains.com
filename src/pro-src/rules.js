/* eslint-disable no-mixed-operators */
/* eslint-disable prefer-rest-params */
/* eslint-disable class-methods-use-this */
import logger from '../utils/logger';

import { UrlTracker } from '../services/proactive/UrlTracker';
import { EventListenerManager } from '../services/proactive/EventListenerManager';
import { BubbleCreator } from '../services/proactive/BubbleCreator';
import { RuleEvaluator } from '../services/proactive/RuleEvaluator';

export const RULES_HANDLER_SINGLETON = 'rasaWebchatRulesHandler';

export default class RulesHandler {
  constructor(rules, sendMethod, triggerEventListenerUpdateRate = 500) {
    this.rules = rules;
    this.timeoutIds = [];

    // Initialize services
    this.urlTracker = new UrlTracker();
    this.bubbleCreator = new BubbleCreator();
    this.ruleEvaluator = new RuleEvaluator({
      sendMethod,
      urlTracker: this.urlTracker
    });
    this.eventListenerManager = new EventListenerManager({
      triggerEventListenerUpdateRate,
      verifyConditions: (rules, boolMode, tooltipSelector, removeViz) =>
        this.verifyConditions(rules, boolMode, tooltipSelector, removeViz),
      addViz: (listener, elem) => this.bubbleCreator.addViz(listener, elem)
    });

    // Register location change handler via UrlTracker
    this.locationChangeCallback = this.urlTracker.registerLocationChangeHandler((url) => {
      // We use the window object that was set in the react component
      if (window[RULES_HANDLER_SINGLETON]) {
        // Clean up timeouts to prevent race conditions
        window[RULES_HANDLER_SINGLETON].cleanUp();
        window[RULES_HANDLER_SINGLETON].initHandler();
      }
    });
  }

  updateRules(newRules) {
    window[RULES_HANDLER_SINGLETON].cleanUp();
    window[RULES_HANDLER_SINGLETON].rules = newRules;
  }

  // Delegate to RuleEvaluator
  storeRuleHash(rule) {
    this.ruleEvaluator.storeRuleHash(rule, this.history, () => this.storeHistory());
  }

  // Initialize handler - verify conditions if no timeOnPage rule, or schedule check if there is one
  initHandler() {
    this.fetchHistory();
    const url = this.urlTracker.getCurrentUrl();
    const visitsOnThisPage = this.history.timePerPage[url];
    this.history.timePerPage[url] = visitsOnThisPage ? visitsOnThisPage + 1 : 1;
    this.storeHistory(url);

    this.rules.forEach((rules) => {
      const trigger = rules.trigger || {};

      if (trigger && (trigger.when === 'limited' || trigger.timeLimit)) {
        this.storeRuleHash(rules);
      }

      if (trigger.eventListeners) {
        if (trigger.timeOnPage) {
          this.timeoutIds.push(
            setTimeout(
              () => window[RULES_HANDLER_SINGLETON].initEventHandler(rules),
              trigger.timeOnPage * 1000
            )
          );
        } else {
          this.initEventHandler(rules);
        }
        // Don't continue and verify the conditions in that case
        return;
      }
      if (!trigger.timeOnPage) {
        this.verifyConditions(rules);
      } else {
        this.timeoutIds.push(
          setTimeout(
            () => window[RULES_HANDLER_SINGLETON].verifyConditions(rules),
            trigger.timeOnPage * 1000
          )
        );
      }
    });
  }

  // Delegate to EventListenerManager
  initEventHandler(rules, withViz = true) {
    this.eventListenerManager.initEventHandler(rules, withViz);
  }

  // Delegate to RuleEvaluator
  verifyConditions(rules, boolMode, tooltipSelector = false, removeViz = () => {}) {
    const url = this.urlTracker.getCurrentUrl();
    return this.ruleEvaluator.verifyConditions(
      rules,
      this.history,
      url,
      boolMode,
      tooltipSelector,
      removeViz,
      () => this.storeHistory()
    );
  }

  // Delegate to UrlTracker
  storeHistory(url) {
    // Keep reference for RuleEvaluator
    this.urlTracker.history = this.history;
    this.urlTracker.storeHistory(url);
    // Update local reference
    this.history = this.urlTracker.history;
  }

  // Delegate to UrlTracker
  fetchHistory() {
    this.history = this.urlTracker.fetchHistory();
  }

  // Clean up timeouts and event listeners to prevent leaks
  cleanUp(alsoClearWindowEventListners = false) {
    // Clean up event listeners via EventListenerManager
    this.eventListenerManager.cleanUp();

    // Clean up window event listeners if requested
    if (alsoClearWindowEventListners) {
      this.urlTracker.cleanup();
      if (this.locationChangeCallback) {
        window.removeEventListener('locationchange', this.locationChangeCallback);
      }
    }

    // Clean up timeOnPage timeouts
    this.timeoutIds.forEach((id) => {
      clearTimeout(id);
    });
    this.timeoutIds = [];
  }
}

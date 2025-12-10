/**
 * RuleEvaluator - Evaluates rule conditions and manages rule triggers
 * Extracted from RulesHandler to improve code organization
 */

import hash from 'object-hash';
import logger from '../../utils/logger';

export class RuleEvaluator {
  constructor(config) {
    this.sendMethod = config.sendMethod; // (payload, when, tooltipSelector) => void
    this.urlTracker = config.urlTracker; // UrlTracker instance
  }

  storeRuleHash(rule, history, onStoreHistory) {
    const rulesHash = hash(rule.trigger);
    rule.hash = rulesHash;

    const ruleTriggered = history.rulesTriggered.find(
      ruleInStorage => ruleInStorage.hash === rulesHash
    );
    if (!(ruleTriggered && ruleTriggered.triggerLimit)) {
      history.rulesTriggered.push({
        hash: rulesHash,
        triggerLimit: rule.trigger.triggerLimit,
        triggered: 0
      });
      if (onStoreHistory) {
        onStoreHistory();
      }
    }
  }

  verifyMobile(trigger) {
    if (!trigger.device) return true;
    if (
      (/Mobi/.test(navigator.userAgent) && trigger.device === 'mobile') ||
      (!/Mobi/.test(navigator.userAgent) && trigger.device !== 'mobile')
    ) {
      return true;
    }
    return false;
  }

  verifyTimeLimit(trigger, ruleTriggeredIndex, history) {
    if (!trigger.timeLimit) return true;
    if (
      !history.rulesTriggered[ruleTriggeredIndex].lastTimeTriggered ||
      (Date.now() -
        Date.parse(history.rulesTriggered[ruleTriggeredIndex].lastTimeTriggered)) /
        (60 * 1000) >
        trigger.timeLimit
    ) {
      return true;
    }
    return false;
  }

  verifyQueryStringAndAddEntities(encodedQueryString, queryObject, payload) {
    const queryStringJson = this.convertQueryStringToJson(encodedQueryString);
    const { param, value } = queryObject;
    if (!queryObject.sendAsEntity) {
      return queryStringJson[param] && queryStringJson[param] === value;
    }
    if (queryStringJson[param]) {
      payload.entities.push({
        entity: queryObject.param,
        value: queryStringJson[param]
      });
      return true;
    }
    return false;
  }

  convertQueryStringToJson(query = window.location.search) {
    return query
      .replace(/^\?/, '')
      .split('&')
      .reduce((json, item) => {
        if (item) {
          item = item.split('=').map(value => decodeURIComponent(value));
          json[item[0]] = item[1];
        }
        return json;
      }, {});
  }

  verifyConditions(rules, history, url, boolMode, tooltipSelector = false, removeViz = () => {}, onStoreHistory) {
    const trigger = rules.trigger || {};
    const payload = {
      intent: rules.payload,
      text: rules.text,
      entities: []
    };

    let ruleTriggeredIndex = -1;

    if (trigger && (trigger.when === 'limited' || trigger.timeLimit)) {
      ruleTriggeredIndex = history.rulesTriggered.findIndex(
        rule => rule.hash === rules.hash
      );
    }

    const mobileCondition = this.verifyMobile(trigger);
    const urlCondition = this.urlTracker.verifyUrl(trigger, history);
    const triggerLimitCondition =
      !(trigger.triggerLimit && trigger.when === 'limited') ||
      history.rulesTriggered[ruleTriggeredIndex].triggered <
        history.rulesTriggered[ruleTriggeredIndex].triggerLimit;

    const timeLimitCondition = this.verifyTimeLimit(trigger, ruleTriggeredIndex, history);
    const numberOfPageVisitsCondition =
      !trigger.numberOfPageVisits ||
      (history.timePerPage[url] &&
        history.timePerPage[url] >= parseInt(trigger.numberOfPageVisits, 10));

    const queryString = window.location.search;
    const queryStringCondition =
      !trigger.queryString ||
      trigger.queryString.every(queryObject =>
        this.verifyQueryStringAndAddEntities(queryString, queryObject, payload)
      );

    if (
      urlCondition &&
      mobileCondition &&
      numberOfPageVisitsCondition &&
      triggerLimitCondition &&
      queryStringCondition &&
      timeLimitCondition &&
      (!trigger.numberOfVisits ||
        parseInt(trigger.numberOfVisits, 10) === parseInt(history.timesInDomain, 10))
    ) {
      if (boolMode) {
        return true;
      }
      this.sendMessage(payload, rules.trigger.when, tooltipSelector);
      if (ruleTriggeredIndex !== -1) {
        const triggered = history.rulesTriggered[ruleTriggeredIndex].triggered;
        history.rulesTriggered[ruleTriggeredIndex] = {
          ...history.rulesTriggered[ruleTriggeredIndex],
          triggered: triggered + 1,
          lastTimeTriggered: new Date()
        };
        if (triggered + 1 === trigger.triggerLimit) {
          removeViz();
        }
        if (onStoreHistory) {
          onStoreHistory();
        }
      }
    } else if (boolMode) {
      return false;
    }
  }

  sendMessage(payload, when = 'always', tooltipSelector = false) {
    if (payload.intent) {
      let entities = '';
      payload.entities.forEach((entity, index) => {
        const ent = `"${entity.entity}":"${entity.value}"${
          index === payload.entities.length - 1 ? '' : ','
        }`;
        entities += ent;
      });
      const sentPayload = `${payload.intent}{${entities}}`;
      const whenToSend = when === 'limited' ? 'always' : when;
      if (payload.text) {
        this.sendMethod(sentPayload, payload.text, whenToSend, tooltipSelector);
      } else {
        this.sendMethod(sentPayload, undefined, whenToSend, tooltipSelector);
      }
    } else {
      logger.warn('You forgot to give a payload to your ruleset.');
    }
  }
}

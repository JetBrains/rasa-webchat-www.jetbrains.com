/**
 * BubbleCreator - Creates and positions DOM visualization elements
 * Extracted from RulesHandler to improve code organization
 */

import logger from '../../utils/logger';
import QuestionMark from '../question-solid.svg';

export class BubbleCreator {
  // Returns a method to remove the visualization element
  addViz(listener, elem) {
    if (listener.event && listener.event.includes && listener.event.includes('click')) {
      elem.classList.add('rw-cursor-pointer');
    }

    const vizRemoval = visualisationObject => () => {
      try {
        document.body.removeChild(visualisationObject);
      } catch (e) {
        logger.error(e);
      }
    };

    if (listener.visualization === 'pulsating') {
      elem.classList.add('rw-pulsating');
      return () => elem.classList.remove('rw-pulsating');
    } else if (listener.visualization === 'questionMark') {
      const questionMark = document.createElement('img');
      questionMark.src = QuestionMark;
      document.body.appendChild(questionMark);
      questionMark.classList.add('rw-question-mark');
      this.placeQuestionMark(elem, questionMark);
      return vizRemoval(questionMark);
    } else if (listener.visualization === 'pulsatingDot') {
      const dot = document.createElement('div');
      document.body.appendChild(dot);
      dot.classList.add('rw-pulsating-dot');
      this.placeDot(elem, dot);
      return vizRemoval(dot);
    }

    return () => {};
  }

  placeDot(receptacle, dot) {
    const rect = receptacle.getBoundingClientRect();
    dot.setAttribute(
      'style',
      `top: ${rect.top + window.pageYOffset - 12}px; left: ${rect.right +
        window.pageXOffset -
        16}px`
    );
  }

  placeQuestionMark(receptacle, questionMark) {
    const rect = receptacle.getBoundingClientRect();
    questionMark.setAttribute(
      'style',
      `top: ${rect.top +
        (rect.bottom - rect.top) / 2 +
        window.pageYOffset -
        9}px; left: ${rect.right + window.pageXOffset + 5}px;`
    );
  }
}

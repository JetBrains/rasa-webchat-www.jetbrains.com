/**
 * useTooltipReference - Custom hook to manage tooltip reference element
 * Extracted from Launcher component to improve code organization
 */

import { useState, useEffect } from 'react';
import { onRemove } from 'utils/dom';
import { safeQuerySelectorAll } from 'utils/dom';

export const useTooltipReference = (lastUserMessage, domHighlight) => {
  const [referenceElement, setReferenceElement] = useState(null);

  useEffect(() => {
    const setReference = (selector) => {
      const reference = safeQuerySelectorAll(selector);
      if (reference && reference.length === 1) {
        onRemove(reference[0], () => setReferenceElement(null));
        setReferenceElement(reference[0]);
      } else {
        setReferenceElement(null);
      }
    };

    if (lastUserMessage && lastUserMessage.get('nextMessageIsTooltip')) {
      setReference(lastUserMessage.get('nextMessageIsTooltip'));
    } else if (domHighlight && domHighlight.get('selector')) {
      setReference(domHighlight.get('selector'));
    } else {
      setReferenceElement(null);
    }
  }, [lastUserMessage, domHighlight]);

  return referenceElement;
};

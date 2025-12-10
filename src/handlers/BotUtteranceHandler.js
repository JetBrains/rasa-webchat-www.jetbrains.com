/**
 * BotUtteranceHandler - Handles bot_uttered events
 * Coordinates between multiple managers for bot message processing
 * Extracted from Widget component to improve code organization
 */

import logger from '../utils/logger';
import { clearMetadata, setBotProcessing } from 'actions';

export class BotUtteranceHandler {
  constructor(config) {
    this.dispatch = config.dispatch;
    this.getIsChatOpen = config.getIsChatOpen;
    this.metadataPropagator = config.metadataPropagator;
    this.domHighlightManager = config.domHighlightManager;
    this.messageQueueManager = config.messageQueueManager;
    this.customEventManager = config.customEventManager;
    this.sendMessage = config.sendMessage;
    this.domHighlight = config.domHighlight;
  }

  /**
   * Update domHighlight prop (for clearing)
   * @param {Object} newDomHighlight - New domHighlight from props
   */
  updateDomHighlight(newDomHighlight) {
    this.domHighlight = newDomHighlight;
  }

  /**
   * Handle bot_uttered event
   * @param {Object} botUtterance - Bot utterance data
   */
  handle(botUtterance) {
    // Clear previous styling and event listeners
    this.domHighlightManager.clearHighlight(this.domHighlight);
    this.customEventManager.clearAll();
    this.dispatch(clearMetadata());

    // Extract is_final parameter
    const isFinal = botUtterance.metadata?.is_final ?? botUtterance.is_final ?? true;

    logger.debug('handleBotUtterance:', {
      text: botUtterance.text?.substring(0, 50),
      isFinal,
      isChatOpen: this.getIsChatOpen()
    });

    // Update message queue manager
    this.messageQueueManager.setLastIsFinal(isFinal);

    // Handle bot processing state based on is_final and chat open state
    const isChatOpen = this.getIsChatOpen();
    if (!isChatOpen) {
      // If chat is not open, message is displayed immediately
      this.dispatch(setBotProcessing(!isFinal));
    } else if (!isFinal) {
      // If not final and chat is open, keep showing WIP
      this.dispatch(setBotProcessing(true));
    }
    // If isFinal and chat is open, WIP will be hidden after message delay in queue manager

    // Propagate metadata
    if (botUtterance.metadata) {
      const pageEventCallbacks = this.metadataPropagator.propagate(botUtterance.metadata);

      // Register page event callbacks if present
      if (pageEventCallbacks && pageEventCallbacks.pageEvents) {
        this.customEventManager.registerPageEvents(
          pageEventCallbacks.pageEvents,
          this.sendMessage
        );
      }
    }

    // Prepare message
    const newMessage = {
      ...botUtterance,
      text: String(botUtterance.text)
    };

    if (botUtterance.metadata?.customCss) {
      newMessage.customCss = botUtterance.metadata.customCss;
    }

    // Message will be handled by message queue manager through widget
    return newMessage;
  }
}

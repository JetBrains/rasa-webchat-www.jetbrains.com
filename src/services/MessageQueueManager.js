/**
 * MessageQueueManager - Manages message queue and delays
 * Extracted from Widget component to improve code organization
 */

import logger from '../utils/logger';

export class MessageQueueManager {
  constructor(config) {
    this.queue = [];
    this.delayedMessage = null;
    this.messageDelayTimeout = null;
    this.isProcessing = false;
    this.lastIsFinal = true;
    this.customMessageDelay = config.customMessageDelay;
    this.onMessageReady = config.onMessageReady; // callback when message should be displayed
    this.onQueueEmpty = config.onQueueEmpty; // callback when queue is empty
  }

  /**
   * Add message to queue or process immediately
   * @param {Object} message - Message to add
   * @param {boolean} isChatOpen - Whether chat is currently open
   * @param {Function} onNewUnreadMessage - Callback for unread message
   * @param {Function} onShowTooltip - Callback to show tooltip
   * @param {Function} onApplyCustomStyle - Callback to apply custom styling
   */
  addMessage(message, isChatOpen, onNewUnreadMessage, onShowTooltip, onApplyCustomStyle) {
    if (!isChatOpen) {
      // Chat is closed - display immediately
      if (this.onMessageReady) {
        this.onMessageReady(message);
      }
      if (onNewUnreadMessage) {
        onNewUnreadMessage();
      }
      if (onShowTooltip) {
        onShowTooltip();
      }
      if (onApplyCustomStyle) {
        onApplyCustomStyle();
      }
    } else if (!this.isProcessing) {
      // Chat is open and no message being processed - start delay
      this.isProcessing = true;
      this.scheduleMessageDisplay(message, onApplyCustomStyle);
    } else {
      // Chat is open and processing another message - queue it
      this.queue.push(message);
    }
  }

  /**
   * Schedule message display with delay
   * @param {Object} message - Message to display
   * @param {Function} onApplyCustomStyle - Callback to apply styling
   */
  scheduleMessageDisplay(message, onApplyCustomStyle) {
    this.delayedMessage = message;
    const delay = this.customMessageDelay(message.text || '');

    this.messageDelayTimeout = setTimeout(() => {
      // Display the message
      if (this.onMessageReady) {
        this.onMessageReady(message);
      }

      this.delayedMessage = null;

      if (onApplyCustomStyle) {
        onApplyCustomStyle();
      }

      this.isProcessing = false;

      // Process next message in queue
      this.processNextInQueue(onApplyCustomStyle);

      // Check if we should hide WIP bubble
      this.checkWipBubble();
    }, delay);
  }

  /**
   * Process next message in queue
   * @param {Function} onApplyCustomStyle - Callback to apply styling
   */
  processNextInQueue(onApplyCustomStyle) {
    if (this.queue.length > 0) {
      this.isProcessing = true;
      const nextMessage = this.queue.shift();
      this.scheduleMessageDisplay(nextMessage, onApplyCustomStyle);
    }
  }

  /**
   * Check if WIP bubble should be hidden
   */
  checkWipBubble() {
    logger.debug('checkWipBubble:', {
      queueLength: this.queue.length,
      lastIsFinal: this.lastIsFinal,
      willHideWIP: this.queue.length === 0 && this.lastIsFinal
    });

    // Hide WIP bubble only if:
    // 1. No more messages in queue
    // 2. Last bot_uttered had is_final:true
    if (this.queue.length === 0 && this.lastIsFinal) {
      // Add small delay to allow React to render buttons/replies before hiding WIP
      setTimeout(() => {
        logger.debug('Hiding WIP after message displayed');
        if (this.onQueueEmpty) {
          this.onQueueEmpty();
        }
      }, 100);
    }
  }

  /**
   * Set the last is_final flag value
   * @param {boolean} isFinal - Whether last message was final
   */
  setLastIsFinal(isFinal) {
    this.lastIsFinal = isFinal;
  }

  /**
   * Check if there are messages in queue
   * @returns {boolean}
   */
  hasMessages() {
    return this.queue.length > 0;
  }

  /**
   * Get delayed message if exists
   * @returns {Object|null}
   */
  getDelayedMessage() {
    return this.delayedMessage;
  }

  /**
   * Flush all pending messages immediately
   * @param {Function} onMessageFlushed - Callback for each flushed message
   * @param {Function} onNewUnreadMessage - Callback for unread message
   * @param {Function} onApplyCustomStyle - Callback to apply styling
   */
  flushAll(onMessageFlushed, onNewUnreadMessage, onApplyCustomStyle) {
    // Flush delayed message first
    if (this.delayedMessage) {
      clearTimeout(this.messageDelayTimeout);
      if (onMessageFlushed) {
        onMessageFlushed(this.delayedMessage);
      }
      if (onNewUnreadMessage) {
        onNewUnreadMessage();
      }
      this.delayedMessage = null;
      this.isProcessing = false;
    }

    // Flush all queued messages
    this.queue.forEach((message) => {
      if (onMessageFlushed) {
        onMessageFlushed(message);
      }
      if (onNewUnreadMessage) {
        onNewUnreadMessage();
      }
    });

    if (onApplyCustomStyle) {
      onApplyCustomStyle();
    }

    this.queue = [];
  }

  /**
   * Clear all messages and timeouts
   */
  clear() {
    this.queue = [];
    this.delayedMessage = null;
    this.isProcessing = false;

    if (this.messageDelayTimeout) {
      clearTimeout(this.messageDelayTimeout);
      this.messageDelayTimeout = null;
    }
  }
}

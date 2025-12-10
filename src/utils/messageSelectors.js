/**
 * messageSelectors - Utility functions for selecting messages from state
 * Extracted from Launcher mapStateToProps to improve code organization
 */

import { Map } from 'immutable';

/**
 * Get last N bot messages (up to 10)
 * Stops when it hits a user message or runs out of messages
 */
export const getLastBotMessages = (state) => {
  if (!state.messages) return [];

  const messages = [];
  for (let i = 1; i <= 10; i += 1) {
    const message = state.messages.get(-i);
    if (!message) break;
    if (message.get('sender') !== 'response') break;
    messages.unshift(message);
  }
  return messages;
};

/**
 * Get last user message (searches back up to 10 messages)
 */
export const getLastUserMessage = (state) => {
  if (!state.messages) return false;

  let index = -1;
  while (index > -10) {
    const lastMessage = state.messages.get(index);
    if (lastMessage) {
      if (lastMessage.get('sender') === 'client') {
        return lastMessage;
      }
    } else {
      return false;
    }
    index -= 1;
  }
  return false;
};

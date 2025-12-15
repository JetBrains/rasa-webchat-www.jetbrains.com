import { setBotProcessing } from 'actions';
import logger from './logger';

// Global timeout for bot processing to handle backend hangs
let globalBotProcessingTimeout = null;

// Export helper function to start bot processing timeout
export function startBotProcessingTimeout(dispatch) {
  // Clear any existing timeout
  clearTimeout(globalBotProcessingTimeout);

  // Set 30-second timeout to reset isBotProcessing if backend hangs
  globalBotProcessingTimeout = setTimeout(() => {
    logger.warn('Bot processing timeout reached (30s). Force resetting isBotProcessing to false.');
    dispatch(setBotProcessing(false));
  }, 30000);
}

// Export helper function to clear bot processing timeout
export function clearBotProcessingTimeout() {
  clearTimeout(globalBotProcessingTimeout);
  globalBotProcessingTimeout = null;
}

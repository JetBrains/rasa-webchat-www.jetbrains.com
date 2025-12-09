/**
 * Socket-related constants
 * Extracted from index.js to eliminate magic objects and improve reusability
 */

export const SOCKET_TEMPLATE = {
  isInitialized: () => false,
  on: () => {
  },
  emit: () => {
  },
  close: () => {
  },
  createSocket: () => {
  },
  marker: Math.random(),
  isDummy: true
};

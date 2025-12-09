// Token storage keys
export const TOKEN_KEY = 'chat_token';
export const REFRESH_TOKEN_KEY = 'chat_refresh_token';

// Token refresh timing (in milliseconds)
export const TOKEN_REFRESH_TEST_INTERVAL = 2 * 1000; // 2 seconds for testing
export const TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000; // 5 minutes before expiry in production
export const TOKEN_REFRESH_MIN_INTERVAL = 5 * 1000; // Minimum 5 seconds between refreshes

// Socket reconnection timing
export const SOCKET_RECONNECT_DELAY = 100; // milliseconds to wait before reconnecting socket

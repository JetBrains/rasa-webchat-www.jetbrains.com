/**
 * Helper функции для авторизации в E2E тестах
 */

/**
 * Создает mock JWT токен с заданным expiry
 */
function createMockToken(expiryInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: 'test-user',
    exp: Math.floor(Date.now() / 1000) + expiryInSeconds,
    iat: Math.floor(Date.now() / 1000)
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'mock-signature';

  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Устанавливает токены в localStorage через page
 */
async function setAuthTokens(page, options = {}) {
  const token = options.token || createMockToken(options.expiryInSeconds);
  const refreshToken = options.refreshToken || 'mock-refresh-token';

  await page.evaluate(([t, rt]) => {
    localStorage.setItem('chatToken', t);
    localStorage.setItem('refreshToken', rt);
  }, [token, refreshToken]);

  return { token, refreshToken };
}

/**
 * Очищает токены из localStorage
 */
async function clearAuthTokens(page) {
  await page.evaluate(() => {
    localStorage.removeItem('chatToken');
    localStorage.removeItem('refreshToken');
  });
}

/**
 * Проверяет наличие токенов в localStorage
 */
async function getAuthTokens(page) {
  return await page.evaluate(() => {
    return {
      chatToken: localStorage.getItem('chatToken'),
      refreshToken: localStorage.getItem('refreshToken')
    };
  });
}

/**
 * Ждет установки WebSocket соединения
 */
async function waitForWebSocketConnection(page, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, timeout);

    page.on('websocket', ws => {
      clearTimeout(timeoutId);
      resolve(ws);
    });
  });
}

module.exports = {
  createMockToken,
  setAuthTokens,
  clearAuthTokens,
  getAuthTokens,
  waitForWebSocketConnection
};

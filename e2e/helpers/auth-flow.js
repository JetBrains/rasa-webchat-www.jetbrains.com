/**
 * ========================================================================
 * OAuth Authentication Helper для E2E тестов
 * ========================================================================
 *
 * BEST PRACTICE: Использовать API вместо UI для авторизации
 *
 * Использует переменные окружения из .env файла:
 * - TOKEN_ENDPOINT_STAGE  - для получения токенов через API
 * - AUTH_BASE_URL_STAGE   - для OAuth popup URL
 * - CLIENT_ID_STAGE       - клиент ID приложения
 *
 * Примеры использования:
 *
 * 1. Авторизация через API (рекомендуется):
 *    const token = await authenticateWithToken(page);
 *
 * 2. Авторизация через UI (для тестирования OAuth flow):
 *    const token = await authenticateViaUI(page, context, credentials);
 *
 * 3. Fixture для beforeEach:
 *    test.beforeEach(async ({ page }) => {
 *      await createAuthenticatedSession(page);
 *    });
 */

// Загружаем переменные окружения из .env
require('dotenv').config();

// Определяем окружение (по умолчанию staging)
const ENV = process.env.ENVIRONMENT || 'staging';
const ENV_SUFFIX = ENV.toUpperCase();

// Получаем URL'ы из .env в зависимости от окружения
const TOKEN_ENDPOINT = process.env[`TOKEN_ENDPOINT_${ENV_SUFFIX}`];
const CLIENT_ID = process.env[`CLIENT_ID_${ENV_SUFFIX}`];
const AUTH_BASE_URL = process.env[`AUTH_BASE_URL_${ENV_SUFFIX}`];

// Для отладки (можно раскомментировать)
// console.log(`[auth-flow] Environment: ${ENV}`);
// console.log(`[auth-flow] TOKEN_ENDPOINT: ${TOKEN_ENDPOINT}`);
// console.log(`[auth-flow] CLIENT_ID: ${CLIENT_ID}`);

/**
 * Получает токен через OAuth API (без UI)
 * Это быстрее и надежнее чем UI flow
 *
 * @param {Object} credentials - Учётные данные
 * @param {string} credentials.username - Email пользователя
 * @param {string} credentials.password - Пароль
 * @returns {Promise<{token: string, refreshToken: string}>}
 */
async function getAuthTokenViaAPI(credentials) {
  if (!TOKEN_ENDPOINT) {
    throw new Error(`TOKEN_ENDPOINT_${ENV_SUFFIX} не задан в .env файле`);
  }

  // OAuth2 password grant (для тестового окружения)
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      client_id: CLIENT_ID,
      scope: 'openid offline_access r_assets'
    })
  });

  if (!response.ok) {
    throw new Error(`OAuth API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    token: data.id_token || data.access_token,
    refreshToken: data.refresh_token
  };
}

/**
 * Авторизует пользователя через установку токена
 * Пропускает OAuth UI flow
 */
async function authenticateWithToken(page, token = null) {
  // Если токен не передан, получаем через API
  if (!token) {
    const tokens = await getAuthTokenViaAPI({
      username: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    });
    token = tokens.token;
  }

  // Устанавливаем токен в localStorage
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('chat_token', t); // Виджет использует 'chat_token'
  }, token);

  return token;
}

/**
 * Полный OAuth flow через UI (для тестирования самого OAuth)
 * Используйте только для тестов авторизации
 */
async function authenticateViaUI(page, context, credentials) {
  await page.goto('/');
  await page.locator('.rw-launcher').click();

  // Кликаем на Authenticate
  const authButton = page.locator('.auth-placeholder__button');
  await authButton.click();

  // Ждем открытия OAuth popup
  const popup = await context.waitForEvent('page');

  // ===== ВАЖНО: Здесь логика для вашего OAuth провайдера =====

  // Для JetBrains OAuth
  if (popup.url().includes('jetprofile')) {
    // Заполняем форму входа
    await popup.fill('input[name="username"]', credentials.email);
    await popup.fill('input[name="password"]', credentials.password);
    await popup.click('button[type="submit"]');

    // Ждем редиректа обратно
    await popup.waitForURL(/callback|redirect/);
  }

  // Для Google OAuth
  if (popup.url().includes('accounts.google.com')) {
    await popup.fill('input[type="email"]', credentials.email);
    await popup.click('#identifierNext');
    await popup.fill('input[type="password"]', credentials.password);
    await popup.click('#passwordNext');
  }

  // Ждем пока popup закроется (означает успешную авторизацию)
  await popup.waitForEvent('close');

  // Ждем пока токен появится в localStorage
  await page.waitForFunction(() => {
    return localStorage.getItem('chat_token') !== null;
  }, { timeout: 10000 });

  const token = await page.evaluate(() => localStorage.getItem('chat_token'));
  return token;
}

/**
 * Fixture для тестов - создает авторизованную сессию
 */
async function createAuthenticatedSession(page) {
  const token = await authenticateWithToken(page);
  await page.reload();
  return { token };
}

module.exports = {
  getAuthTokenViaAPI,
  authenticateWithToken,
  authenticateViaUI,
  createAuthenticatedSession
};

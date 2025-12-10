/**
 * E2E тесты для авторизации в Rasa Webchat
 *
 * ⚠️ ВАЖНО: Большинство тестов используют сохранённую сессию!
 * Перед запуском выполни ОДИН РАЗ:
 *   npx playwright test --headed -g "setup-auth"
 */

const { test, expect } = require('@playwright/test');
const { authenticateWithToken, authenticateViaUI, createAuthenticatedSession } = require('../helpers/auth-flow');
const path = require('path');
const fs = require('fs');

const LAUNCHER_SELECTOR = '.rw-launcher';
const AUTH_BUTTON_SELECTOR = '.auth-placeholder__button';
const MESSAGE_INPUT_SELECTOR = '.rw-new-message';
const HEADER_SELECTOR = '.rw-header';

// Путь к сохранённой сессии
const authFile = path.join(__dirname, '../.auth/user.json');

// Test credentials (используйте переменные окружения!)
const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'test-password'
};

test.describe('Widget Authorization Tests (without saved session)', () => {

  /**
   * ТЕСТ 1: OAuth popup открывается
   */
  test('должен открыть OAuth login page', async ({ page, context }) => {
    await page.goto('/');
    await page.locator(LAUNCHER_SELECTOR).click();

    const authButton = page.locator(AUTH_BUTTON_SELECTOR);
    await expect(authButton).toBeVisible();

    // Отслеживаем popup
    const popupPromise = context.waitForEvent('page');
    await authButton.click();

    const popup = await popupPromise;

    // ✅ Проверяем что открылся правильный URL
    expect(popup.url()).toMatch(/login|oauth|auth|jetprofile|accounts\.google/i);

    console.log('OAuth URL:', popup.url());

    // Закрываем popup (не логинимся в этом тесте)
    await popup.close();
  });

  /**
   * ТЕСТ 2: Полный OAuth flow через UI
   * ⚠️ Требует реальных credentials
   */
  test.skip('должен успешно авторизоваться через OAuth UI', async ({ page, context }) => {
    const token = await authenticateViaUI(page, context, TEST_CREDENTIALS);

    expect(token).toBeTruthy();

    // Проверяем что виджет показывает chat
    await page.locator(LAUNCHER_SELECTOR).click();
    await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible({ timeout: 5000 });
  });

  /**
   * ТЕСТ 3: Авторизация через API token (РЕКОМЕНДУЕТСЯ)
   * ✅ Быстро, надежно, не требует UI
   */
  test('должен работать с токеном из API', async ({ page }) => {
    // Создаём валидный JWT токен для теста (exp: год 2099)
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjQxMDI0NDQ4MDAsImlhdCI6MTYxNjE2MTYwMCwibmFtZSI6IlRlc3QgVXNlciJ9.test';

    await authenticateWithToken(page, validToken);
    await page.reload();

    // Открываем виджет
    await page.locator(LAUNCHER_SELECTOR).click();

    // AuthPlaceholder НЕ должен показываться
    const authPlaceholder = page.locator(AUTH_BUTTON_SELECTOR);
    await expect(authPlaceholder).not.toBeVisible({ timeout: 2000 });
  });
});

/**
 * Тесты которые требуют авторизации
 * Используем сохранённую сессию из setup-auth
 */
test.describe('Tests with Authentication (using saved session)', () => {

  // Используем сохранённую сессию

  // Пропускаем если нет сессии
  test.beforeAll(() => {
    if (!fs.existsSync(authFile)) {
      throw new Error('Run "setup-auth" test first!');
    }
  });

  test('должен отправить сообщение', async ({ page }) => {
    await page.locator(LAUNCHER_SELECTOR).click();

    // Проверяем что input виден (значит авторизованы)
    const input = page.locator(MESSAGE_INPUT_SELECTOR);
    await expect(input).toBeVisible({ timeout: 5000 });

    // Отправляем сообщение
    await input.fill('Hello bot!');
    await page.locator('.rw-send').click();

    // Проверяем что сообщение появилось
    await expect(page.locator('.rw-message').filter({ hasText: 'Hello bot!' }))
      .toBeVisible({ timeout: 3000 });
  });

  test('должен показывать header', async ({ page }) => {
    await page.locator(LAUNCHER_SELECTOR).click();

    const header = page.locator(HEADER_SELECTOR);
    await expect(header).toBeVisible();
  });

  test('должен сохранять токен после reload', async ({ page }) => {
    await page.reload();

    // Токен должен остаться в localStorage
    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();

    // Виджет должен работать
    await page.locator(LAUNCHER_SELECTOR).click();
    await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible();
  });
});

// ========================================================================
// 🎯 MANUAL OAUTH TEST - перенесён в widget-auth-persistent.spec.js
// Используй: npx playwright test --headed -g "setup-auth"
// ========================================================================

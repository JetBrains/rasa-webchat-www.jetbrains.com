/**
 * E2E тесты для авторизации в Rasa Webchat
 * Best Practice: Используем API для авторизации вместо UI
 */

const { test, expect } = require('@playwright/test');
const { authenticateWithToken, authenticateViaUI, createAuthenticatedSession } = require('../helpers/auth-flow');

const LAUNCHER_SELECTOR = '.rw-launcher';
const AUTH_BUTTON_SELECTOR = '.auth-placeholder__button';
const MESSAGE_INPUT_SELECTOR = '.rw-new-message';
const HEADER_SELECTOR = '.rw-header';

// Test credentials (используйте переменные окружения!)
const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'test-password'
};

test.describe('Widget Authorization Tests', () => {

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
 * Используем fixture для создания авторизованной сессии
 */
test.describe('Tests with Authentication', () => {

  /**
   * Before each test - создаем авторизованную сессию
   */
  test.beforeEach(async ({ page }) => {
    // ✅ BEST PRACTICE: Используем API вместо UI
    await createAuthenticatedSession(page);
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
// 🎯 MANUAL OAUTH TEST - для ручной авторизации в браузере
// ========================================================================
test.describe('Manual OAuth Testing', () => {

  // Увеличиваем timeout для ручной авторизации (10 минут)
  test('должен авторизоваться ВРУЧНУЮ через OAuth popup', async ({ page, context }) => {
    test.setTimeout(600000); // 10 минут на весь тест

    await page.goto('/');
    await page.waitForSelector('.rw-widget-container');

    const launcher = page.locator(LAUNCHER_SELECTOR);
    await launcher.click();

    // Кликаем на кнопку авторизации
    const authButton = page.locator(AUTH_BUTTON_SELECTOR);
    await expect(authButton).toBeVisible();

    console.log('\n🔐 Сейчас откроется popup для авторизации...');

    // Ждём popup
    const popupPromise = context.waitForEvent('page');
    await authButton.click();
    const popup = await popupPromise;

    console.log('✅ Popup открылся:', popup.url());
    console.log('\n' + '='.repeat(60));
    console.log('👉 АВТОРИЗУЙСЯ ВРУЧНУЮ В POPUP ОКНЕ!');
    console.log('👉 У тебя есть 10 МИНУТ');
    console.log('👉 После авторизации popup закроется автоматически');
    console.log('👉 Тест продолжится...');
    console.log('='.repeat(60) + '\n');

    // ⏸️ ПАУЗА - авторизуйся вручную!
    // Popup окно останется открытым 10 минут
    // После успешной авторизации popup закроется автоматически

    // Ждём когда popup закроется (значит авторизация прошла)
    await popup.waitForEvent('close', { timeout: 600000 }); // 10 минут

    console.log('✅ Popup закрылся - проверяем токен...');

    // Проверяем что токен сохранился
    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();
    console.log('✅ Токен получен:', token.substring(0, 20) + '...');

    // Перезагружаем страницу
    await page.reload();
    await page.waitForSelector('.rw-widget-container');

    // Открываем чат - должен быть доступен input
    await launcher.click();
    await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible({ timeout: 10000 });

    console.log('✅ Чат доступен - авторизация успешна!');
  });
});

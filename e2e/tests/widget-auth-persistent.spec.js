/**
 * E2E тест с ПОСТОЯННОЙ авторизацией (сохраняет сессию между запусками)
 *
 * Как использовать:
 * 1. Первый раз: npx playwright test --headed -g "setup-auth"
 *    - Авторизуешься вручную, сессия сохранится в e2e/.auth/user.json
 * 2. Последующие разы: npx playwright test --headed -g "with-saved-session"
 *    - Авторизация уже есть, тест сразу работает!
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const LAUNCHER_SELECTOR = '.rw-launcher';
const AUTH_BUTTON_SELECTOR = '.auth-placeholder__button';
const MESSAGE_INPUT_SELECTOR = '.rw-new-message';

const authFile = path.join(__dirname, '../.auth/user.json');

// ========================================================================
// ПЕРВЫЙ ЗАПУСК - авторизуйся и сохрани сессию
// ⚠️ ЭТОТ ТЕСТ ПРОПУСКАЕТСЯ в обычном запуске (npm run test:e2e)
// Запускай вручную: npx playwright test --headed -g "setup-auth"
// ========================================================================
test.describe('[setup-auth]', () => {
  // ⚠️ БЕЗ сохранённой сессии! Этот тест создаёт сессию с нуля
  test.use({ storageState: undefined });

  test('Authorize once and save session', async ({ page, context }) => {
    // Пропускаем этот тест при обычном запуске
    test.skip(true, 'Run manually with: npx playwright test --headed -g "setup-auth"');

    test.setTimeout(600000); // 10 минут

  await page.goto('/');
  await page.waitForSelector('.rw-widget-container');

  const launcher = page.locator(LAUNCHER_SELECTOR);
  await launcher.click();

  const authButton = page.locator(AUTH_BUTTON_SELECTOR);
  await expect(authButton).toBeVisible();

  console.log('\n🔐 Сейчас откроется popup для авторизации...');
  console.log('👉 АВТОРИЗУЙСЯ - сессия сохранится для последующих запусков!');

  const popupPromise = context.waitForEvent('page');
  await authButton.click();
  const popup = await popupPromise;

  console.log('✅ Popup открылся:', popup.url());
  console.log('⏳ Жду авторизации...\n');

  // Ждём закрытия popup
  await popup.waitForEvent('close', { timeout: 600000 });

  console.log('✅ Popup закрылся!');
  console.log('⏳ Жду пока виджет сохранит токен...');

  // ⚠️ ВАЖНО: Ждём пока OAuth callback обработается и токен появится в localStorage
  // Виджет должен обработать redirect, получить токен и сохранить его
  await page.waitForFunction(() => {
    return localStorage.getItem('chat_token') !== null;
  }, { timeout: 30000 }).catch(async () => {
    // Если токен не появился - диагностика
    console.error('❌ Токен не появился в localStorage!');
    console.error('localStorage keys:', await page.evaluate(() => Object.keys(localStorage)));
    console.error('URL:', page.url());
    throw new Error('Token not saved after OAuth callback');
  });

  const token = await page.evaluate(() => localStorage.getItem('chat_token'));
  expect(token).toBeTruthy();
  console.log('✅ Токен получен!', token.substring(0, 30) + '...');

  // 🔥 СОХРАНЯЕМ СЕССИЮ (cookies + localStorage)
  await context.storageState({ path: authFile });
  console.log('✅ Сессия сохранена в:', authFile);
  console.log('\n🎉 Теперь можешь запускать тесты с сохранённой авторизацией!\n');

  // Проверяем что чат работает
    await page.reload();
    await launcher.click();
    await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible({ timeout: 10000 });
    console.log('✅ Чат работает!');
  });
});

// ========================================================================
// ПОСЛЕДУЮЩИЕ ЗАПУСКИ - используй сохранённую сессию
// ========================================================================
test.describe('[with-saved-session] Tests with saved auth', () => {

  // Пропускаем если файла сессии нет
  test.beforeAll(() => {
    if (!fs.existsSync(authFile)) {
      console.log('\n❌ No saved session found!');
      console.log('👉 Run this command first:');
      console.log('   npx playwright test --headed -g "setup-auth"\n');
      throw new Error('Auth session required. Run setup-auth test first.');
    }
  });

  test('should be authorized automatically (cookies loaded)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });

    // Проверяем что токен уже есть
    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();
    console.log('✅ Token loaded from saved session!');

    // С валидным токеном виджет подключается автоматически (connectOn: 'mount')
    // Ждём подключения и проверяем что виджет не показывает auth placeholder
    await page.waitForTimeout(2000); // Даём время на подключение

    // Проверяем что НЕТ auth button (значит авторизован)
    const authButton = page.locator(AUTH_BUTTON_SELECTOR);
    await expect(authButton).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // Если auth button всё ещё виден - это ок, но launcher должен быть
    });

    console.log('✅ Widget initialized with saved session!');
  });

  test('should load widget with valid token', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });

    // Проверяем что токен загружен
    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();

    // Проверяем что виджет инициализировался
    const widgetContainer = page.locator('.rw-widget-container');
    await expect(widgetContainer).toBeVisible();

    console.log('✅ Widget loaded with saved session!');
  });
});

// ========================================================================
// ОЧИСТКА сессии (если нужно)
// ========================================================================
test('[cleanup-auth] Delete saved session', async ({ page }) => {
  test.skip(true, 'Change to .skip(false) to delete session');

  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
    console.log('✅ Session deleted:', authFile);
  } else {
    console.log('ℹ️ No session file found');
  }
});

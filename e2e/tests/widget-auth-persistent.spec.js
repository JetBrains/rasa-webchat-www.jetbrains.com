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
// ========================================================================
test('[setup-auth] Authorize once and save session', async ({ page, context }) => {
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

// ========================================================================
// ПОСЛЕДУЮЩИЕ ЗАПУСКИ - используй сохранённую сессию
// ========================================================================
test.describe('[with-saved-session] Tests with saved auth', () => {

  test.use({
    storageState: authFile  // 🔥 Загружаем сохранённую сессию!
  });

  test.skip(({ }, testInfo) => {
    // Пропускаем если файла сессии нет
    if (!fs.existsSync(authFile)) {
      console.log('❌ Run "setup-auth" test first to create session!');
      return true;
    }
    return false;
  });

  test('should be authorized automatically (cookies loaded)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.rw-widget-container');

    // Проверяем что токен уже есть
    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();
    console.log('✅ Token loaded from saved session!');

    // Открываем чат - должен быть сразу доступен
    await page.locator(LAUNCHER_SELECTOR).click();
    await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible({ timeout: 5000 });
    console.log('✅ Chat available without re-authentication!');
  });

  test('should send message (with saved session)', async ({ page }) => {
    await page.goto('/');
    await page.locator(LAUNCHER_SELECTOR).click();

    const input = page.locator(MESSAGE_INPUT_SELECTOR);
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.fill('Test message');
    await page.locator('.rw-send').click();

    // Проверяем что сообщение появилось
    await expect(page.locator('.rw-message').filter({ hasText: 'Test message' }))
      .toBeVisible({ timeout: 3000 });

    console.log('✅ Message sent!');
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

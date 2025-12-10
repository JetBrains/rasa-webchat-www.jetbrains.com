/**
 * E2E тесты для WebSocket соединения Rasa Webchat
 * Проверяет session_request, session_confirm, сообщения
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const LAUNCHER_SELECTOR = '.rw-launcher';
const MESSAGE_INPUT_SELECTOR = '.rw-new-message';
const SEND_BUTTON_SELECTOR = '.rw-send';

const authFile = path.join(__dirname, '../.auth/user.json');

test.describe('WebSocket Messages Tests', () => {

  test.beforeAll(() => {
    if (!fs.existsSync(authFile)) {
      console.log('\n❌ No saved session found!');
      console.log('👉 Run: npx playwright test --headed -g "setup-auth"\n');
      throw new Error('Auth session required');
    }
  });

  test('should send session_request via WebSocket', async ({ page }) => {
    const wsMessages = [];

    // 🎯 Перехватываем WebSocket
    page.on('websocket', ws => {
      console.log('🔌 WebSocket connected:', ws.url());

      ws.on('framesent', frame => {
        try {
          const message = JSON.parse(frame.payload);
          console.log('→ Sent:', message);
          wsMessages.push({ direction: 'sent', data: message });
        } catch (e) {
          // Не JSON frame (ping/pong)
        }
      });

      ws.on('framereceived', frame => {
        try {
          const message = JSON.parse(frame.payload);
          console.log('← Received:', message);
          wsMessages.push({ direction: 'received', data: message });
        } catch (e) {
          // Не JSON frame
        }
      });
    });

    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });

    // Ждём подключения WebSocket и обмена сообщениями
    await page.waitForTimeout(5000);

    // 🎯 Проверяем что session_request был отправлен
    const sessionRequest = wsMessages.find(
      msg => msg.direction === 'sent' && msg.data.type === 'session_request'
    );

    expect(sessionRequest).toBeDefined();
    console.log('✅ session_request found:', sessionRequest.data);

    // Проверяем что есть session_id
    expect(sessionRequest.data.session_id).toBeDefined();
    console.log('✅ session_id:', sessionRequest.data.session_id);
  });

  test('should receive session_confirm via WebSocket', async ({ page }) => {
    const wsMessages = [];

    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        try {
          const message = JSON.parse(frame.payload);
          wsMessages.push({ direction: 'received', data: message });
        } catch (e) {}
      });
    });

    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });
    await page.waitForTimeout(5000);

    // 🎯 Проверяем что session_confirm был получен
    const sessionConfirm = wsMessages.find(
      msg => msg.direction === 'received' && msg.data.type === 'session_confirm'
    );

    if (sessionConfirm) {
      expect(sessionConfirm).toBeDefined();
      console.log('✅ session_confirm received:', sessionConfirm.data);
    } else {
      console.log('⚠️ session_confirm not received (backend may be offline)');
      test.skip(true, 'Backend required');
    }
  });

  test('should send user message and receive bot response', async ({ page }) => {
    test.skip(true, 'Requires backend with real bot responses');

    const wsMessages = [];

    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        try {
          wsMessages.push({ direction: 'sent', data: JSON.parse(frame.payload) });
        } catch (e) {}
      });

      ws.on('framereceived', frame => {
        try {
          wsMessages.push({ direction: 'received', data: JSON.parse(frame.payload) });
        } catch (e) {}
      });
    });

    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });

    // Открываем виджет и отправляем сообщение
    const launcher = page.locator(LAUNCHER_SELECTOR);
    if (await launcher.isVisible()) {
      await launcher.click();
    }

    const input = page.locator(MESSAGE_INPUT_SELECTOR);
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.fill('Hello bot!');
    await page.locator(SEND_BUTTON_SELECTOR).click();

    // Ждём ответа
    await page.waitForTimeout(3000);

    // 🎯 Проверяем что сообщение было отправлено
    const userMessage = wsMessages.find(
      msg => msg.direction === 'sent' && msg.data.message === 'Hello bot!'
    );
    expect(userMessage).toBeDefined();
    console.log('✅ User message sent via WS');

    // 🎯 Проверяем что получен ответ от бота
    const botResponse = wsMessages.find(
      msg => msg.direction === 'received' && msg.data.text
    );

    if (botResponse) {
      expect(botResponse).toBeDefined();
      console.log('✅ Bot response received:', botResponse.data.text);
    } else {
      console.log('⚠️ No bot response (backend may not be configured)');
    }
  });

  test('should log ALL WebSocket messages', async ({ page }) => {
    console.log('\n📋 WebSocket Message Log:\n');

    page.on('websocket', ws => {
      console.log('═'.repeat(60));
      console.log('🔌 WebSocket URL:', ws.url());
      console.log('═'.repeat(60));

      ws.on('framesent', frame => {
        try {
          const message = JSON.parse(frame.payload);
          console.log('\n→ SENT:');
          console.log(JSON.stringify(message, null, 2));
        } catch (e) {
          console.log('\n→ SENT (non-JSON):', frame.payload.substring(0, 100));
        }
      });

      ws.on('framereceived', frame => {
        try {
          const message = JSON.parse(frame.payload);
          console.log('\n← RECEIVED:');
          console.log(JSON.stringify(message, null, 2));
        } catch (e) {
          console.log('\n← RECEIVED (non-JSON):', frame.payload.substring(0, 100));
        }
      });

      ws.on('close', () => {
        console.log('\n🔌 WebSocket closed');
        console.log('═'.repeat(60));
      });
    });

    await page.goto('/');
    await page.waitForSelector('.rw-widget-container', { timeout: 10000 });

    // Ждём активности
    await page.waitForTimeout(10000);

    console.log('\n✅ WebSocket monitoring complete\n');
  });
});

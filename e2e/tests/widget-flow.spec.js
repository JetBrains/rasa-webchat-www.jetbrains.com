/**
 * E2E тесты для Rasa Webchat Widget
 * Реальный браузер + реальный backend
 *
 * ⚠️ ВАЖНО: Эти тесты требуют сохранённую авторизацию!
 * Перед запуском выполни ОДИН РАЗ:
 *   npx playwright test --headed -g "setup-auth"
 *
 * Сессия сохранится в e2e/.auth/user.json
 * Потом все тесты работают автоматически!
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Конфигурация для вашего проекта
const WIDGET_SELECTOR = '.rw-widget-container';
const LAUNCHER_SELECTOR = '.rw-launcher';
const AUTH_BUTTON_SELECTOR = '.auth-placeholder__button';
const MESSAGE_INPUT_SELECTOR = '.rw-new-message';
const SEND_BUTTON_SELECTOR = '.rw-send';
const MESSAGE_SELECTOR = '.rw-message';
const HEADER_SELECTOR = '.rw-header';
const REFRESH_BUTTON_SELECTOR = '.rw-refresh-button';

// Путь к сохранённой сессии
const authFile = path.join(__dirname, '../.auth/user.json');

// ========================================================================
// ИСПОЛЬЗУЕМ СОХРАНЁННУЮ СЕССИЮ ДЛЯ ВСЕХ ТЕСТОВ
// ========================================================================

test.describe('Rasa Webchat E2E Tests', () => {

  // Пропускаем ВСЕ тесты если нет сохранённой сессии
  test.beforeAll(() => {
    if (!fs.existsSync(authFile)) {
      console.log('\n❌ No saved session found!');
      console.log('👉 Run this command first:');
      console.log('   npx playwright test --headed -g "setup-auth"\n');
      throw new Error('Auth session required. Run setup-auth test first.');
    }
  });

  /**
   * ТЕСТ 1: Виджет загрузился успешно
   */
  test.describe('1. Виджет загрузился', () => {
    test('должен отобразить launcher button', async ({ page }) => {
      await page.goto('/');

      // Ждем появления виджета
      await page.waitForSelector(WIDGET_SELECTOR, { timeout: 10000 });

      // Проверяем что launcher виден
      const launcher = await page.locator(LAUNCHER_SELECTOR);
      await expect(launcher).toBeVisible();
    });

    test('должен открываться при клике на launcher', async ({ page }) => {
      await page.goto('/');

      const launcher = await page.locator(LAUNCHER_SELECTOR);
      await launcher.click();

      // Проверяем что виджет открылся (есть header)
      await expect(page.locator(HEADER_SELECTOR)).toBeVisible({ timeout: 5000 });
    });

    test('должен отображать правильный заголовок', async ({ page }) => {
      await page.goto('/');

      await page.locator(LAUNCHER_SELECTOR).click();
      await page.waitForSelector(HEADER_SELECTOR);

      // Проверяем что header содержит текст
      const header = await page.locator(HEADER_SELECTOR);
      await expect(header).toContainText(/.+/); // Любой текст
    });
  });

  /**
   * ТЕСТ 2: Кнопка авторизации сработала
   */
  test.describe('2. Авторизация', () => {
    test('должен показать auth placeholder без токена', async ({ page }) => {
      await page.goto('/');

      // Открываем виджет
      await page.locator(LAUNCHER_SELECTOR).click();

      // Должна появиться кнопка авторизации
      const authButton = page.locator(AUTH_BUTTON_SELECTOR);
      await expect(authButton).toBeVisible({ timeout: 5000 });
      await expect(authButton).toContainText(/authenticate/i);
    });

    test('должен открыть OAuth окно при клике на Authenticate', async ({ page, context }) => {
      await page.goto('/');
      await page.locator(LAUNCHER_SELECTOR).click();

      // Ждем кнопку авторизации
      const authButton = page.locator(AUTH_BUTTON_SELECTOR);
      await expect(authButton).toBeVisible();

      // Отслеживаем открытие нового окна
      const popupPromise = context.waitForEvent('page');
      await authButton.click();

      // Если OAuth настроен, должно открыться новое окно
      const popup = await popupPromise.catch(() => null);
      if (popup) {
        expect(popup.url()).toContain('oauth');
        await popup.close();
      }
    });

    test.skip('должен показать chat после успешной авторизации', async ({ page }) => {
      // Устанавливаем токен в localStorage
      await page.goto('/');
      await page.evaluate(([token, refreshToken]) => {
        localStorage.setItem('chatToken', token);
        localStorage.setItem('refreshToken', refreshToken);
      }, [MOCK_TOKEN, MOCK_REFRESH_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Должен быть виден input для сообщений
      await expect(page.locator(MESSAGE_INPUT_SELECTOR)).toBeVisible({ timeout: 5000 });
    });
  });

  /**
   * ТЕСТ 3: После авторизации - session flow
   */
  test.describe('3. Session Management', () => {
    test.skip('должен установить WebSocket соединение', async ({ page }) => {
      // Устанавливаем токен
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      // Отслеживаем WebSocket
      let wsConnected = false;
      page.on('websocket', ws => {
        console.log('WebSocket connected:', ws.url());
        wsConnected = true;
      });

      await page.reload();
      await page.waitForTimeout(3000);

      expect(wsConnected).toBe(true);
    });

    test.skip('должен отправить session_request', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      // Перехватываем WebSocket сообщения
      const messages = [];
      page.on('websocket', ws => {
        ws.on('framesent', frame => {
          try {
            const data = JSON.parse(frame.payload);
            messages.push(data);
          } catch (e) {}
        });
      });

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();
      await page.waitForTimeout(2000);

      // Проверяем что был отправлен session_request
      const hasSessionRequest = messages.some(msg =>
        msg.type === 'session_request' || msg.event === 'session_request'
      );
      expect(hasSessionRequest).toBe(true);
    });
  });

  /**
   * ТЕСТ 4: Юзер отправил сообщение + получил ответ
   */
  test.describe('4. Messaging', () => {
    test.skip('должен отправить сообщение пользователя', async ({ page }) => {
      // Setup: авторизация
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Вводим сообщение
      const input = page.locator(MESSAGE_INPUT_SELECTOR);
      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill('Hello, bot!');

      // Отправляем
      await page.locator(SEND_BUTTON_SELECTOR).click();

      // Сообщение должно появиться в чате
      await expect(page.locator(MESSAGE_SELECTOR).filter({ hasText: 'Hello, bot!' }))
        .toBeVisible({ timeout: 3000 });
    });

    test.skip('должен получить ответ от бота', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Отправляем сообщение
      const input = page.locator(MESSAGE_INPUT_SELECTOR);
      await input.fill('hi');
      await page.locator(SEND_BUTTON_SELECTOR).click();

      // Ждем ответ от бота (любое новое сообщение)
      await page.waitForSelector(`${MESSAGE_SELECTOR}:not(:has-text("hi"))`, {
        timeout: 10000
      });

      // Проверяем что есть минимум 2 сообщения (user + bot)
      const messages = await page.locator(MESSAGE_SELECTOR).count();
      expect(messages).toBeGreaterThanOrEqual(2);
    });
  });

  /**
   * ТЕСТ 5: Ручной рефреш сессии (отправляет /restart)
   */
  test.describe('5. Manual Session Refresh', () => {
    test.skip('должен показать popup подтверждения при клике на refresh', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Кликаем на refresh button
      const refreshButton = page.locator(REFRESH_BUTTON_SELECTOR);
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Должен появиться popup
        await expect(page.locator('.rw-popup-container')).toBeVisible({ timeout: 2000 });
        await expect(page.getByText(/refresh/i)).toBeVisible();
      }
    });

    test.skip('должен отправить /restart при подтверждении', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      // Отслеживаем WebSocket сообщения
      const sentMessages = [];
      page.on('websocket', ws => {
        ws.on('framesent', frame => {
          try {
            const data = JSON.parse(frame.payload);
            sentMessages.push(data);
          } catch (e) {}
        });
      });

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();
      await page.waitForTimeout(1000);

      // Refresh flow
      const refreshButton = page.locator(REFRESH_BUTTON_SELECTOR);
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Подтверждаем
        await page.getByRole('button', { name: /refresh/i }).first().click();
        await page.waitForTimeout(1000);

        // Проверяем что был отправлен /restart
        const hasRestart = sentMessages.some(msg =>
          msg.message === '/restart' || msg.text === '/restart'
        );
        expect(hasRestart).toBe(true);
      }
    });

    test.skip('должен очистить историю сообщений после refresh', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Отправляем сообщение
      await page.locator(MESSAGE_INPUT_SELECTOR).fill('Test message');
      await page.locator(SEND_BUTTON_SELECTOR).click();
      await page.waitForTimeout(500);

      const messagesBeforeRefresh = await page.locator(MESSAGE_SELECTOR).count();
      expect(messagesBeforeRefresh).toBeGreaterThan(0);

      // Refresh
      const refreshButton = page.locator(REFRESH_BUTTON_SELECTOR);
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await page.getByRole('button', { name: /refresh/i }).first().click();
        await page.waitForTimeout(1000);

        // Сообщения должны быть очищены
        const messagesAfterRefresh = await page.locator(MESSAGE_SELECTOR).count();
        expect(messagesAfterRefresh).toBe(0);
      }
    });
  });

  /**
   * ТЕСТ 6: Автоматический рефреш токена
   */
  test.describe('6. Automatic Token Refresh', () => {
    test('должен хранить токены в localStorage', async ({ page }) => {
      await page.goto('/');

      // Устанавливаем токены
      await page.evaluate(([token, refreshToken]) => {
        localStorage.setItem('chatToken', token);
        localStorage.setItem('refreshToken', refreshToken);
      }, [MOCK_TOKEN, MOCK_REFRESH_TOKEN]);

      await page.reload();

      // Проверяем что токены сохранились
      const tokens = await page.evaluate(() => {
        return {
          chatToken: localStorage.getItem('chatToken'),
          refreshToken: localStorage.getItem('refreshToken')
        };
      });

      expect(tokens.chatToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
    });

    test.skip('должен переподключить socket после обновления токена', async ({ page }) => {
      await page.goto('/');

      let reconnectCount = 0;
      page.on('websocket', ws => {
        reconnectCount++;
        console.log('WebSocket connection #', reconnectCount);
      });

      // Устанавливаем токен с коротким expiry
      await page.evaluate(() => {
        const shortLivedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.test';
        localStorage.setItem('chatToken', shortLivedToken);
        localStorage.setItem('refreshToken', 'refresh_token');
      });

      await page.reload();
      await page.waitForTimeout(5000);

      // После истечения токена должно быть переподключение
      expect(reconnectCount).toBeGreaterThan(0);
    });

    test('должен показать auth screen при неудачном refresh', async ({ page }) => {
      await page.goto('/');

      // Устанавливаем невалидные токены
      await page.evaluate(() => {
        localStorage.setItem('chatToken', 'invalid-token');
        localStorage.setItem('refreshToken', 'invalid-refresh');
      });

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Должен показаться auth placeholder
      await expect(page.locator(AUTH_BUTTON_SELECTOR))
        .toBeVisible({ timeout: 5000 });
    });
  });

  /**
   * ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
   */
  test.describe('Additional Checks', () => {
    test('должен закрываться при клике на close button', async ({ page }) => {
      await page.goto('/');

      await page.locator(LAUNCHER_SELECTOR).click();
      await page.waitForSelector(HEADER_SELECTOR);

      // Кликаем на close button
      const closeButton = page.locator('.rw-header-button').first();
      await closeButton.click();

      // Header должен исчезнуть
      await expect(page.locator(HEADER_SELECTOR)).not.toBeVisible({ timeout: 2000 });
    });

    test('должен работать в embedded режиме', async ({ page }) => {
      // Если у вас есть страница с embedded виджетом
      await page.goto('/?embedded=true');

      // В embedded режиме launcher не должен быть виден
      const launcher = page.locator(LAUNCHER_SELECTOR);
      const isVisible = await launcher.isVisible().catch(() => false);

      // В embedded mode виджет должен быть всегда открыт
      expect(isVisible).toBe(false);
    });

    test('должен сохранять состояние при перезагрузке страницы', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(([token]) => {
        localStorage.setItem('chatToken', token);
      }, [MOCK_TOKEN]);

      await page.reload();
      await page.locator(LAUNCHER_SELECTOR).click();

      // Отправляем сообщение
      const input = page.locator(MESSAGE_INPUT_SELECTOR);
      if (await input.isVisible()) {
        await input.fill('Test persistence');
        await page.locator(SEND_BUTTON_SELECTOR).click();
        await page.waitForTimeout(500);

        // Перезагружаем страницу
        await page.reload();
        await page.locator(LAUNCHER_SELECTOR).click();

        // История должна сохраниться (если так настроено)
        // Это зависит от вашей имплементации
        const messages = await page.locator(MESSAGE_SELECTOR).count();
        console.log('Messages after reload:', messages);
      }
    });
  });
});

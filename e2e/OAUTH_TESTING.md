# 🔐 OAuth Testing в Playwright

## ⚙️ Конфигурация окружения

Все E2E тесты автоматически используют переменные из `.env` файла:

```bash
# Staging (по умолчанию)
TOKEN_ENDPOINT_STAGE=https://public.staging.oauth.intservices.aws.intellij.net/oauth2/token
AUTH_BASE_URL_STAGE=https://active.jetprofile-stgn.intellij.net/oauth/login
CLIENT_ID_STAGE=support-chat-staging

# Production
TOKEN_ENDPOINT_PROD=https://oauth.account.jetbrains.com/oauth2/token
AUTH_BASE_URL_PROD=https://account.jetbrains.com/oauth/login
CLIENT_ID_PROD=support-chat-public
```

**Для тестов с другим окружением:**

```bash
# Staging (по умолчанию)
npm run test:e2e

# Production
ENVIRONMENT=prod npm run test:e2e
```

Все URL'ы берутся из `.env` - не нужно хардкодить! ✅

## Проблема

OAuth flow требует **реального входа через Google/JetBrains** в popup окне.
Это создает проблемы:
- ❌ Нельзя автоматизировать без credentials
- ❌ Медленно (каждый тест ждет OAuth)
- ❌ Нестабильно (popup может не открыться)
- ❌ Проблемы с 2FA/CAPTCHA

## ✅ Решение: 3 подхода

### Подход 1: Исправить проверку URL (быстро)

```javascript
test('должен открыть OAuth popup', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('.rw-launcher').click();
  await page.locator('.auth-placeholder__button').click();

  const popup = await context.waitForEvent('page');

  // ✅ Гибкая проверка URL
  expect(popup.url()).toMatch(/login|oauth|auth|jetprofile/i);

  await popup.close();
});
```

### Подход 2: API токен (РЕКОМЕНДУЕТСЯ) ⭐

**Best Practice**: Получайте токен через API, не через UI!

```javascript
// e2e/helpers/auth-flow.js
async function getAuthToken() {
  // Вариант A: Через API вашего backend
  const response = await fetch('https://your-api.com/test-token', {
    method: 'POST',
    body: JSON.stringify({
      username: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    })
  });

  const { token } = await response.json();
  return token;
}

// В тесте
test('messaging test', async ({ page }) => {
  const token = await getAuthToken();

  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('chatToken', t);
  }, token);

  await page.reload();

  // Теперь пользователь авторизован!
  await page.locator('.rw-launcher').click();
  await expect(page.locator('.rw-new-message')).toBeVisible();
});
```

**Преимущества**:
- ⚡ Быстро (секунды вместо минут)
- ✅ Надежно (нет popup, нет 2FA)
- 🎯 Тестирует реальную логику (не OAuth UI)
- 🔧 Легко менять test users

### Подход 3: Полный OAuth UI flow (для тестов авторизации)

Используйте **только** для тестирования самого OAuth:

```javascript
// e2e/helpers/auth-flow.js
async function authenticateViaUI(page, context, credentials) {
  await page.goto('/');
  await page.locator('.rw-launcher').click();
  await page.locator('.auth-placeholder__button').click();

  const popup = await context.waitForEvent('page');

  // Для JetBrains OAuth
  if (popup.url().includes('jetprofile')) {
    await popup.fill('input[name="username"]', credentials.email);
    await popup.fill('input[name="password"]', credentials.password);
    await popup.click('button[type="submit"]');

    // Если есть 2FA
    if (await popup.locator('input[name="code"]').isVisible()) {
      // Получите код из process.env или mock
      await popup.fill('input[name="code"]', process.env.TEST_2FA_CODE);
      await popup.click('button[type="submit"]');
    }
  }

  // Для Google OAuth
  if (popup.url().includes('accounts.google.com')) {
    await popup.fill('input[type="email"]', credentials.email);
    await popup.click('#identifierNext');
    await popup.waitForSelector('input[type="password"]');
    await popup.fill('input[type="password"]', credentials.password);
    await popup.click('#passwordNext');
  }

  // Ждем редиректа и закрытия popup
  await popup.waitForEvent('close', { timeout: 30000 });

  // Проверяем что токен появился
  await page.waitForFunction(() => {
    return localStorage.getItem('chatToken') !== null;
  });

  return await page.evaluate(() => localStorage.getItem('chatToken'));
}
```

## 🎯 Рекомендуемая стратегия

### 1. Для большинства тестов: Используйте API token

```javascript
test.beforeEach(async ({ page }) => {
  // Получаем токен через API (быстро!)
  const token = await getAuthToken();
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('chatToken', t);
  }, token);
  await page.reload();
});

test('test 1', async ({ page }) => { /* авторизован! */ });
test('test 2', async ({ page }) => { /* авторизован! */ });
test('test 3', async ({ page }) => { /* авторизован! */ });
```

### 2. Для тестов OAuth: Отдельный файл

```javascript
// e2e/tests/oauth-flow.spec.js
test.describe('OAuth Flow Tests', () => {
  test('должен авторизоваться через Google', async ({ page, context }) => {
    const token = await authenticateViaUI(page, context, {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    });

    expect(token).toBeTruthy();
  });
});
```

### 3. Для CI/CD: Mock OAuth responses

```javascript
// Перехватываем OAuth redirect
await page.route('**/oauth/callback*', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({
      token: 'mock-token',
      refreshToken: 'mock-refresh'
    })
  });
});
```

## 🔧 Setup

### 1. Создайте .env файл

```bash
cp .env.example .env
```

### 2. Заполните credentials

```env
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-secure-password
```

### 3. Создайте API endpoint для test tokens

```javascript
// На вашем backend
app.post('/api/test/auth-token', async (req, res) => {
  // Только для test environment!
  if (process.env.NODE_ENV !== 'test') {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const { username, password } = req.body;

  // Валидируйте test user
  if (username === process.env.TEST_USER_EMAIL &&
      password === process.env.TEST_USER_PASSWORD) {

    const token = generateJWT({ sub: username });
    const refreshToken = generateRefreshToken();

    return res.json({ token, refreshToken });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});
```

## 📊 Сравнение подходов

| Подход | Скорость | Надежность | Сложность | Когда использовать |
|--------|----------|------------|-----------|-------------------|
| **API Token** | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Легко | Все тесты (90%) |
| **OAuth UI** | ⚡ | ⭐⭐ | Сложно | Тесты OAuth (5%) |
| **Mock Responses** | ⚡⚡⚡ | ⭐⭐⭐ | Средне | CI/CD (5%) |

## 💡 Best Practices

### ✅ DO

1. **Используйте API для авторизации в тестах**
   ```javascript
   const token = await getAuthToken();
   await page.evaluate((t) => localStorage.setItem('chatToken', t), token);
   ```

2. **Создайте fixture для авторизованной сессии**
   ```javascript
   test.beforeEach(async ({ page }) => {
     await createAuthenticatedSession(page);
   });
   ```

3. **Храните credentials в .env**
   ```javascript
   const email = process.env.TEST_USER_EMAIL;
   ```

4. **Тестируйте OAuth UI отдельно**
   ```javascript
   test.describe('OAuth Flow', () => { /* один тест OAuth */ });
   test.describe('Features', () => { /* все остальное с токеном */ });
   ```

### ❌ DON'T

1. **Не делайте OAuth UI в каждом тесте**
   ```javascript
   // ❌ Медленно!
   test('test 1', async () => { await fullOAuthFlow(); });
   test('test 2', async () => { await fullOAuthFlow(); });
   ```

2. **Не хардкодите credentials**
   ```javascript
   // ❌ Опасно!
   const password = 'my-real-password-123';
   ```

3. **Не игнорируйте 2FA/CAPTCHA**
   ```javascript
   // ❌ Упадет!
   await popup.click('#login-button'); // А там 2FA!
   ```

## 🐛 Troubleshooting

### Popup не открывается

```javascript
// Проверьте что popup разрешен
const popup = await context.waitForEvent('page', { timeout: 10000 });
```

### OAuth redirect не работает

```javascript
// Проверьте redirect URI в настройках OAuth
// Должен быть: http://localhost:8080/callback
```

### 2FA блокирует тесты

```javascript
// Вариант 1: Создайте test user без 2FA
// Вариант 2: Используйте API token (пропустите OAuth)
// Вариант 3: Mock OAuth response
```

### CAPTCHA появляется

```javascript
// Используйте API token - нет CAPTCHA!
const token = await getAuthToken();
```

## 📝 Примеры

### Полный пример: Widget tests с авторизацией

```javascript
const { test, expect } = require('@playwright/test');
const { createAuthenticatedSession } = require('../helpers/auth-flow');

test.describe('Widget Features (Authenticated)', () => {

  test.beforeEach(async ({ page }) => {
    // ✅ Быстрая авторизация через API
    await createAuthenticatedSession(page);
  });

  test('отправка сообщения', async ({ page }) => {
    await page.locator('.rw-launcher').click();
    await page.fill('.rw-new-message', 'Hello!');
    await page.click('.rw-send');

    await expect(page.locator('.rw-message'))
      .toContainText('Hello!');
  });

  test('получение ответа', async ({ page }) => {
    // ... тест
  });

  test('refresh сессии', async ({ page }) => {
    // ... тест
  });
});
```

## 🎯 Итог

**Для вашего проекта рекомендую**:

1. ✅ Создайте API endpoint для получения test token
2. ✅ Используйте `authenticateWithToken()` в `beforeEach`
3. ✅ Один тест для OAuth UI (проверка что popup открывается)
4. ✅ Все остальные тесты с готовым токеном

**Результат**: Быстрые, надежные, стабильные E2E тесты! 🚀

---

**См. также**:
- `e2e/helpers/auth-flow.js` - готовые helper функции
- `e2e/tests/widget-auth.spec.js` - примеры тестов
- `.env.example` - настройки credentials

// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');

// Загружаем .env переменные
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e/tests',

  /* Максимальное время на один тест */
  timeout: 30 * 1000,

  /* Ожидание assertions */
  expect: {
    timeout: 5000
  },

  /* Fail тест после первого падения */
  fullyParallel: false,

  /* Retry failed tests */
  retries: process.env.CI ? 2 : 0,

  /* Параллельные workers */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter для результатов */
  reporter: [
    ['html', { outputFolder: 'e2e/reports' }],
    ['list']
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL для тестов */
    baseURL: 'http://localhost:8080',

    /* User-Agent для MacOS (опционально - для корректного определения ОС) */
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    /* Скриншоты при падении */
    screenshot: 'only-on-failure',

    /* Видео при падении */
    video: 'retain-on-failure',

    /* Трейс при падении */
    trace: 'on-first-retry',
  },

  /* Configure projects for different browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run dev server before tests */
  webServer: {
    command: 'npm run stage',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

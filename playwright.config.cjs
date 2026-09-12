const path = require('path');
const { defineConfig } = require('@playwright/test');

// CI sets PLAYWRIGHT_ARTIFACTS_DIR and uploads that directory when the run
// fails, so everything a failure leaves behind goes under it.
const artifactsDir = process.env.PLAYWRIGHT_ARTIFACTS_DIR;

module.exports = defineConfig({
  testDir: './e2e-tests',
  reporter: artifactsDir
    ? [['list'], ['html', { open: 'never', outputFolder: path.join(artifactsDir, 'playwright-report') }]]
    : 'list',
  outputDir: artifactsDir ? path.join(artifactsDir, 'test-results') : undefined,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

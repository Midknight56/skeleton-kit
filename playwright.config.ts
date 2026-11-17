import { defineConfig } from '@playwright/test';

// Headless only, with sound muted. The tests read the built site in dist/, so run `npm run build` first.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: { args: ['--mute-audio'] },
  },
  webServer: {
    command: 'node tools/serve-dist.mjs 4173',
    url: 'http://127.0.0.1:4173/garden/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

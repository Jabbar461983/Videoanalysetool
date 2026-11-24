import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    permissions: ['microphone'],
    baseURL: 'http://localhost:4173/Videoanalysetool/',
    trace: 'off',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM || undefined,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        ...(process.env.PW_ARGS ? process.env.PW_ARGS.split(' ') : []),
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/Videoanalysetool/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

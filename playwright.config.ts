import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5184',
  },
  webServer: {
    // Dedicated port so this never picks up (or gets shadowed by) an
    // unrelated dev server the user may already have running on 5173,
    // and doesn't clash with the botc grimoire-companion app's 5183.
    command: 'npm run dev -- --port 5184 --strictPort',
    url: 'http://localhost:5184',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

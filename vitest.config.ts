import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds timeout for tests
    hookTimeout: 90000, // 90 seconds timeout for hooks (30s wait + navigation time)
  },
});

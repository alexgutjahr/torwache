import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const TEST_DEV_SERVER_PORT = 3000;

export default defineConfig({
  plugins: [
    WxtVitest({
      dev: {
        server: {
          host: '127.0.0.1',
          port: TEST_DEV_SERVER_PORT,
          strictPort: true,
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
  },
});

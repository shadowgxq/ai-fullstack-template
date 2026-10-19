import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  define: {
    __API_BASE_URL__: JSON.stringify('https://api.example.test'),
    __APP_VERSION__: JSON.stringify('0.1.0'),
  },
  resolve: {
    alias: { '@tarojs/taro': fileURLToPath(new URL('./tests/taro-mock.ts', import.meta.url)) },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], clearMocks: true },
});

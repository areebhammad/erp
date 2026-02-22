import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
        'src/store/**': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'src/lib/api/**': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
        'src/lib/ws/**': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
      },
    },
  },
});

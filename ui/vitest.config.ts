import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Unit tests only (pure logic). No DOM env — the DOM-touching orchestrator
// (`optimizeImage`) is exercised by the Playwright quality/perf checks, not here.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*Test.ts', 'src/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/lib/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*Test.ts', '**/types.ts', '**/*Mock*.ts', '**/*mock*.ts'],
    },
  },
});

/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@cml/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});

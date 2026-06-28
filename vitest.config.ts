import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    // Vitest 4 switched the default pool to 'forks' (native Node child processes).
    // Without "type": "module" in package.json (which Next.js can't have), Node treats
    // transformed files as CJS and require('vitest') loads index.cjs which throws.
    // 'vmForks' uses Node VM contexts with Vite's ESM transform pipeline instead.
    pool: 'vmForks',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['lib/supabase*', 'lib/dusupay/client.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

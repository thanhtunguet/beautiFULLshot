import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      include: [
        'src/stores/**/*.ts',
        'src/data/**/*.ts'
      ],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts'
      ]
    }
  }
});

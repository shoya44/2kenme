import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** F/E（src）向け。Worker側は vitest.worker.config.ts。 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The theory module is pure. The audio engine's bookkeeping is too — it talks to
// Tone through a narrow interface, so it can be tested against a fake instrument
// without a browser or an AudioContext.
export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/theory/**/*.test.ts', 'src/audio/**/*.test.ts'],
  },
});

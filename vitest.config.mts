import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Tests live beside the code they cover, as `*.test.ts`.
 *
 * Node environment, not jsdom: what is worth testing here is logic whose
 * failures are silent — an idempotency key that stops matching, an overlap
 * rule that flips at a boundary, a decrypt that quietly returns rubbish. A
 * broken component is visible the moment somebody opens the page; a broken
 * dedup rule is invisible until there are two of everything.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/web/src/**/*.test.ts', 'packages/core/src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      // Longest first: Vite matches string aliases by prefix, so a bare
      // '@lensello/core' entry would swallow the '/integrations' subpath, and
      // a bare '@' would swallow both.
      {
        find: '@lensello/core/integrations',
        replacement: `${root}packages/core/src/integrations/index.ts`,
      },
      { find: '@lensello/core/ai', replacement: `${root}packages/core/src/ai/index.ts` },
      { find: '@lensello/core', replacement: `${root}packages/core/src/index.ts` },
      { find: '@/', replacement: `${root}apps/web/src/` },
    ],
  },
});

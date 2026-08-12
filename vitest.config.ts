import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'conformance/**/*.test.ts'],
    // The conformance suite walks 6,236 ayahs against 174 compiled patterns.
    testTimeout: 300_000,
  },
})

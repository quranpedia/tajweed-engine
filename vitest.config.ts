import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'conformance/**/*.test.ts'],
    // The conformance suite walks every ayah of the mushaf against every
    // compiled pattern, so it is slow by construction rather than by accident.
    testTimeout: 300_000,
  },
})

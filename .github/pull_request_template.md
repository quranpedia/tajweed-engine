## What this changes

<!-- One or two sentences. -->

---

**Delete the section below if this PR does not touch `packages/rules/`,
or `packages/core/src/normalize.ts`.**

## Rule / normalisation change

A change here is a claim about how the Quran is recited, and normalisation
decides what the text is understood to say before any rule sees it.

- [ ] **Source.** Which scholar or work the ruling comes from. Another library's
      implementation is not a source, and neither is "it looked wrong".
- [ ] **Fixtures.** At least one passage that must match and one that must not,
      added to `scripts/verify-rules.ts` or `conformance/`.
- [ ] **Before and after counts.** How many occurrences and ayahs changed, over
      the whole mushaf. A one-character edit to a pattern can silently add or
      remove thousands of matches.
- [ ] **`corrections` entry** recording the previous value and the evidence, with
      `needsReview: true`, if an existing rule is being altered.
- [ ] **Re-frozen conformance** (`pnpm conformance:freeze`) with the diff read,
      not just regenerated. A refactor should move nothing.

### Counts

| | ayahs | occurrences |
|---|---|---|
| before | | |
| after | | |

### Evidence

<!-- Passages, with references. Never paste Quranic text into an issue or a
     commit message — cite surah:ayah. -->

---

- [ ] No Quranic text is added to the repository by this PR.

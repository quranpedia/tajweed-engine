/**
 * The fixtures in `scripts/verify-rules.ts` are watched by nothing.
 *
 * Delete the entire `imalah-kubra.1` expectation — the only thing pinning this
 * repository's sole imāla rule to its sole location, and the exact fixture whose
 * failure was offered as proof that the gate bites — and the gate says:
 *
 *     all 22 pinned rules behave as expected on 2 edition(s)
 *     EXIT=0
 *
 * Green. The count slides from 23 to 22 in prose, and nothing compares it to
 * anything: `EXPECTATIONS.length` appears once in the whole codebase, inside a
 * `console.log`.
 *
 * `docs/checks-that-report-success.md` names the test this fails: *ask what a
 * check would say if the thing it watches were deleted. If the answer is
 * "nothing", it is not watching.* Here the answer is "22", which is worse than
 * nothing, because it is a number that looks like a measurement.
 *
 * This matters more than a missing assertion usually would. `verify-rules.ts`
 * is modified by three open branches; this repository has ALREADY lost a
 * correction to a three-way merge of a single file; and these fixtures are the
 * only protection the byte-literal `matchAgainst: "original"` rules have — rules
 * that match raw edition bytes, compile fine, and silently match nothing when
 * the text underneath them changes.
 *
 * WHY THIS READS THE SOURCE RATHER THAN IMPORTING IT. `verify-rules.ts` runs its
 * checks at import time, so importing it here would execute the whole suite as a
 * side effect of a test. Extracting the array into a module is the tidier fix and
 * is deliberately not done: three branches modify that file, and widening its
 * diff to add a gate that guards it would be trading one merge hazard for
 * another. Reading the source is also exactly what `readme.test.ts` does to
 * prose, and the first assertion below is the same safeguard — if the file stops
 * being readable in this shape, this test fails rather than quietly passing over
 * a file it no longer understands.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const typed = corpus as unknown as Corpus
const source = readFileSync(join(here, '..', 'scripts', 'verify-rules.ts'), 'utf8')

const pinnedRules = [...source.matchAll(/rule:\s*'([^']+)'/g)].map((match) => match[1]!)
const pinned = new Set(pinnedRules)

/**
 * The expectation count, pinned the way the README counts are pinned.
 *
 * Raising it is expected and requires this line to move with it. LOWERING it is
 * the case this exists for: it is what deleting a fixture looks like.
 */
const EXPECTED_FIXTURE_COUNT = 8

/**
 * Rules that SHOULD have a fixture and do not. Pinned by name, not waved through.
 *
 * `matchAgainst: "original"` rules match raw edition bytes, so they are the ones
 * that go silent when the text is migrated — precisely the rules this repository
 * is migrating right now. That eight of them are unpinned is a real gap, and it
 * is recorded here rather than fixed, because writing a fixture means asserting
 * where a ruling falls, and that is a reviewer's call.
 *
 * Exact set equality, both directions: a new unpinned rule fails, and pinning
 * one of these without removing it from this list also fails, so the debt cannot
 * quietly grow or quietly shrink.
 */
const KNOWN_UNPINNED_ORIGINAL = [
  'madd-silah-sughra.1',
  'madd-silah-sughra.2',
  'seven-alefs.1',
  'seven-alefs.2',
  'seven-alefs.3',
  'seven-alefs.4',
  'seven-alefs.5',
  'seven-alefs.6',
]

const KNOWN_UNPINNED_NEEDS_REVIEW = [
  'madd-munfasil.2',
  'madd-munfasil.4',
  'madd-muttasil.2',
  'madd-muttasil.3',
]

describe('the fixtures in scripts/verify-rules.ts', () => {
  it('are still written in the form this test reads', () => {
    // If the file is restructured, this test must be rewritten with it rather
    // than silently passing over a file it can no longer parse. A parse that
    // finds nothing would otherwise satisfy every assertion below.
    expect(pinnedRules.length).toBeGreaterThan(0)
  })

  it('has not lost one', () => {
    expect(
      pinnedRules.length,
      'the number of pinned fixtures changed — if a fixture was deliberately ' +
        'added or removed, move EXPECTED_FIXTURE_COUNT with it',
    ).toBe(EXPECTED_FIXTURE_COUNT)
  })

  it('pins each rule once, so a duplicate cannot stand in for a deleted fixture', () => {
    expect(pinned.size).toBe(pinnedRules.length)
  })

  it('pins a rule that exists in the corpus', () => {
    const strays = [...pinned].filter((id) => !typed.rules.some((rule) => rule.id === id))
    expect(strays, 'a fixture pins a rule id the corpus does not have').toEqual([])
  })

  it('covers every byte-literal rule, or records exactly which it does not', () => {
    const unpinned = typed.rules
      .filter((rule) => rule.matchAgainst === 'original' && !pinned.has(rule.id))
      .map((rule) => rule.id)
      .sort()

    expect(
      unpinned,
      'a rule matching raw edition bytes has no fixture. Those are the rules ' +
        'that go silent when the text changes, which is what this repository ' +
        'is doing to its text right now.',
    ).toEqual([...KNOWN_UNPINNED_ORIGINAL].sort())
  })

  it('covers every rule awaiting review, or records exactly which it does not', () => {
    const unpinned = typed.rules
      .filter((rule) => rule.needsReview && !pinned.has(rule.id))
      .map((rule) => rule.id)
      .sort()

    expect(
      unpinned,
      'a rule shipping with needsReview has no fixture holding it to a known ' +
        'location — so nothing would report it going silent before a reviewer ' +
        'ever sees it',
    ).toEqual([...KNOWN_UNPINNED_NEEDS_REVIEW].sort())
  })
})

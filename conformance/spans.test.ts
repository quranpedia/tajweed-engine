/**
 * A span must index the text it was computed from. That is the one invariant
 * that has to hold whatever normalisation does to the characters in between.
 *
 * It was measured once, by hand, over the rules that produce published spans —
 * where it holds — and never committed. Under `includeDisabled: true`, which is
 * what `freeze-conformance.ts` and `frozen.test.ts` both use, it does NOT hold:
 * `always-tarqeeq.1` emits 277 zero-width spans, and they sit inside its frozen
 * incidence, currently asserted as correct.
 *
 * So the invariant is committed here over the wider configuration, with that one
 * rule exempted by name and by count. Anything new fails; the known defect is
 * pinned rather than waved through, and shrinking it fails too, so nobody fixes
 * it quietly.
 *
 * The mechanism matters because the pipeline creates more of it. A character
 * inserted during normalisation takes the source index of the character that
 * FOLLOWS it, so it is zero-width by design — that is what stops a match ending
 * at an implied sukoon from swallowing the letter before it. A rule whose whole
 * match is such a character therefore reports start === end. The hamza passes
 * insert and move characters in exactly this way.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed, sliceSpan } from '../packages/core/src/engine.js'
import { orderedReferences, type Edition } from '../packages/core/src/edition.js'
import { toCodePoints } from '../packages/core/src/unicode.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const typed = corpus as unknown as Corpus

/**
 * `always-tarqeeq.1` is `disabled`, so it never reaches a published annotation
 * set — but it is compiled and frozen, and it is the only rule that breaks this.
 * Its case is a bare letter class with a stated exception the notation cannot
 * express ("عدا لام لفظ الجلالة"), which is why it is disabled; the zero-width
 * matches are a symptom of that, not a separate defect.
 *
 * Exempted by count as well as by name. If it produces a different number the
 * test fails, so neither a regression nor a quiet fix passes unnoticed.
 */
const KNOWN_ZERO_WIDTH = new Map([['always-tarqeeq.1', 277]])

const editions = ['uthmani-hafs', 'hafs-quran-text']
  .map((id) => ({ id, path: join(here, '..', 'editions', `${id}.json`) }))
  .filter((e) => {
    try {
      readFileSync(e.path)
      return true
    } catch {
      return false
    }
  })

describe.each(editions)('spans index the text they were computed from — $id', ({ path }) => {
  const edition = JSON.parse(readFileSync(path, 'utf8')) as Edition
  const references = orderedReferences(edition)

  // The configuration freeze-conformance.ts and frozen.test.ts use, not the
  // narrower one the invariant was first measured over.
  const engine = new Tajweed(typed, { includeDisabled: true })

  it('never reports a span outside the ayah, or an empty slice', () => {
    const problems: string[] = []
    for (const reference of references) {
      const text = edition.ayahs[reference]!
      const length = toCodePoints(text).length
      for (const span of engine.analyze(text)) {
        if (span.start < 0 || span.end > length) {
          problems.push(`${reference} ${span.ruleId} ${span.start}..${span.end} outside 0..${length}`)
        }
        if (span.end > span.start && sliceSpan(text, span) === '') {
          problems.push(`${reference} ${span.ruleId} has width but slices to nothing`)
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  })

  it('reports a zero-width span only from the one rule known to, and only as often', () => {
    const zeroWidth = new Map<string, number>()
    for (const reference of references) {
      for (const span of engine.analyze(edition.ayahs[reference]!)) {
        if (span.end <= span.start) {
          zeroWidth.set(span.ruleId, (zeroWidth.get(span.ruleId) ?? 0) + 1)
        }
      }
    }

    const unexpected = [...zeroWidth.keys()].filter((id) => !KNOWN_ZERO_WIDTH.has(id))
    expect(unexpected, 'a rule that did not produce zero-width spans now does').toEqual([])

    for (const [id, count] of KNOWN_ZERO_WIDTH) {
      expect(zeroWidth.get(id) ?? 0, `${id} changed its zero-width count`).toBe(count)
    }
  })
})

/**
 * Tests for the public API, driven by the real corpus.
 *
 * The text used here is constructed from named code points, so these tests
 * exercise the API without a Quranic text dependency. Behaviour over the mushaf
 * is what conformance/ is for.
 */

import { describe, expect, it } from 'vitest'

import corpus from '../../rules/rules.json' with { type: 'json' }
import { Tajweed, resolveOverlaps, sliceSpan } from '../src/engine.js'
import type { Corpus, Span } from '../src/types.js'
import { BA_TEST_TEXT } from './fixtures.js'

const typed = corpus as unknown as Corpus

describe('Tajweed', () => {
  it('uses only stable rules by default', () => {
    const engine = new Tajweed(typed)
    const stable = typed.rules.filter((rule) => rule.status === 'stable')
    expect(engine.rules).toHaveLength(stable.length)
    expect(engine.rules.every((rule) => rule.status === 'stable')).toBe(true)
  })

  it('includes disabled rules only when asked', () => {
    const all = new Tajweed(typed, { includeDisabled: true })
    expect(all.rules).toHaveLength(typed.rules.length)
    expect(all.rules.length).toBeGreaterThan(new Tajweed(typed).rules.length)
  })

  it('declares its riwayah', () => {
    // Applying a Hafs corpus to a Warsh text is a data error, so the riwayah has
    // to be inspectable rather than assumed.
    expect(new Tajweed(typed).riwayah).toBe('hafs-an-asim')
  })

  it('compiles every stable rule in the corpus', () => {
    // A rule whose pattern does not compile would otherwise fail at the first
    // ayah that reaches it, in production.
    expect(() => new Tajweed(typed)).not.toThrow()
  })

  it('throws on a disabled rule that holds prose rather than a pattern only if asked for it', () => {
    // Constructing with includeDisabled compiles every rule. That this does not
    // throw shows even the prose rules produce a (meaningless) valid regex, which
    // is exactly why they need the explicit `disabled` marker to stay out.
    expect(() => new Tajweed(typed, { includeDisabled: true })).not.toThrow()
  })

  describe('filtering', () => {
    it('selects by rule, hukum, category or topic id', () => {
      expect(new Tajweed(typed, { only: ['madd-muttasil.1'] }).rules).toHaveLength(1)
      expect(new Tajweed(typed, { only: ['madd-muttasil'] }).rules).toHaveLength(3)

      const byTopic = new Tajweed(typed, { only: ['madd'] })
      expect(byTopic.rules.length).toBeGreaterThan(3)
    })

    it('selects one school where two are modelled', () => {
      const jazari = new Tajweed(typed, { only: ['tafkheem-ranks'], school: 'ibn-al-jazari' })
      const tahhan = new Tajweed(typed, { only: ['tafkheem-ranks'], school: 'ibn-al-tahhan' })

      expect(jazari.rules.length).toBeGreaterThan(0)
      expect(tahhan.rules.length).toBeGreaterThan(0)
      // The two scholars count the ranks of tafkheem differently; the corpus
      // keeps both rather than choosing.
      expect(jazari.rules.map((rule) => rule.id)).not.toEqual(tahhan.rules.map((rule) => rule.id))
    })
  })

  describe('analyze', () => {
    it('returns spans that index the text that was passed in', () => {
      const engine = new Tajweed(typed)
      const spans = engine.analyze(BA_TEST_TEXT)

      for (const span of spans) {
        expect(span.start).toBeGreaterThanOrEqual(0)
        expect(span.end).toBeLessThanOrEqual(Array.from(BA_TEST_TEXT).length)
        expect(span.end).toBeGreaterThan(span.start)
        expect(sliceSpan(BA_TEST_TEXT, span)).not.toBe('')
      }
    })

    it('carries the whole lineage on every span', () => {
      const engine = new Tajweed(typed)
      const [span] = engine.analyze(BA_TEST_TEXT)

      expect(span).toBeDefined()
      expect(span!.ruleId).toBeTruthy()
      expect(span!.hukumId).toBeTruthy()
      expect(span!.categoryId).toBeTruthy()
      expect(span!.topicId).toBeTruthy()
    })

    it('returns spans in document order', () => {
      const spans = new Tajweed(typed).analyze(BA_TEST_TEXT)
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i]!.start).toBeGreaterThanOrEqual(spans[i - 1]!.start)
      }
    })

    it('is stable across repeated calls', () => {
      // Compiled patterns are reused between calls, so a leaked lastIndex would
      // make the second call return less than the first.
      const engine = new Tajweed(typed)
      expect(engine.analyze(BA_TEST_TEXT)).toEqual(engine.analyze(BA_TEST_TEXT))
    })

    it('returns nothing for text with no Arabic in it', () => {
      expect(new Tajweed(typed).analyze('')).toEqual([])
    })
  })
})

describe('resolveOverlaps', () => {
  const span = (start: number, end: number, ruleId: string): Span => ({
    start,
    end,
    ruleId,
    hukumId: 'h',
    categoryId: 'c',
    topicId: 't',
  })

  it('keeps the earliest span and drops what overlaps it', () => {
    expect(resolveOverlaps([span(0, 5, 'a'), span(3, 8, 'b'), span(8, 10, 'c')])).toEqual([
      span(0, 5, 'a'),
      span(8, 10, 'c'),
    ])
  })

  it('prefers the longer span where two start together', () => {
    expect(resolveOverlaps([span(0, 2, 'short'), span(0, 6, 'long')])).toEqual([span(0, 6, 'long')])
  })

  it('leaves non-overlapping spans alone', () => {
    const spans = [span(0, 2, 'a'), span(2, 4, 'b')]
    expect(resolveOverlaps(spans)).toEqual(spans)
  })
})

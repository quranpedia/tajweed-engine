/**
 * The engine: given Quranic text, report where each rule of the corpus applies.
 *
 * The output is offsets, never markup. Rendering differs per platform and per
 * purpose — a mushaf page, a teaching aid, a terminal, a research query — and an
 * engine that returns HTML is useful only to the last person who needed HTML.
 */

import { compileRule } from './compile.js'
import { normalize, type Normalized } from './normalize.js'
import { toSourceRange } from './mapped.js'
import { toCodePoints } from './unicode.js'
import type { Corpus, Rule, Span } from './types.js'

export interface TajweedOptions {
  /**
   * Restrict matching to these rules, ahkam, categories or topics. Ids at any
   * level of the hierarchy are accepted. Omit to use every stable rule.
   */
  readonly only?: readonly string[]
  /**
   * Where two scholars are modelled as separate ahkam, keep only this school's.
   * Ahkam with no school attribution are always kept.
   */
  readonly school?: string
  /**
   * Include rules marked `disabled`. They are disabled because the notation
   * cannot express them and they are known to match wrongly or not at all —
   * this exists for working ON the corpus, not for reading with it.
   */
  readonly includeDisabled?: boolean
}

interface Prepared {
  readonly rule: Rule
  readonly pattern: RegExp
  readonly hukumId: string
  readonly categoryId: string
  readonly topicId: string
}

export class Tajweed {
  private readonly prepared: readonly Prepared[]

  private readonly cache = new Map<string, Normalized>()

  private readonly byRuleId = new Map<string, Prepared>()

  constructor(
    private readonly corpus: Corpus,
    options: TajweedOptions = {},
  ) {
    const categoryById = new Map(corpus.categories.map((category) => [category.id, category]))
    const hukumById = new Map(corpus.hukums.map((hukum) => [hukum.id, hukum]))

    const selected = new Set(options.only ?? [])
    const prepared: Prepared[] = []

    for (const rule of corpus.rules) {
      if (rule.status === 'disabled' && !options.includeDisabled) {
        continue
      }

      const hukum = hukumById.get(rule.hukum)
      if (!hukum) {
        throw new Error(`Rule ${rule.id} references unknown hukum ${rule.hukum}`)
      }
      const category = categoryById.get(hukum.category)
      if (!category) {
        throw new Error(`Hukum ${hukum.id} references unknown category ${hukum.category}`)
      }

      if (options.school && hukum.school && hukum.school.id !== options.school) {
        continue
      }

      const lineage = [rule.id, hukum.id, category.id, category.topic]
      if (selected.size > 0 && !lineage.some((id) => selected.has(id))) {
        continue
      }

      prepared.push({
        rule,
        pattern: compileRule(rule),
        hukumId: hukum.id,
        categoryId: category.id,
        topicId: category.topic,
      })
    }

    this.prepared = prepared
    for (const entry of prepared) {
      this.byRuleId.set(entry.rule.id, entry)
    }
  }

  /** The rules this instance will match with, after filtering. */
  get rules(): readonly Rule[] {
    return this.prepared.map((entry) => entry.rule)
  }

  get riwayah(): string {
    return this.corpus.riwayah
  }

  /**
   * Finds every occurrence of every selected rule in `ayahText`.
   *
   * Spans may overlap — a single letter can demonstrate more than one ruling, and
   * deciding which to show is a presentation question. Use `resolveOverlaps` when
   * a single non-overlapping layer is needed.
   */
  analyze(ayahText: string): Span[] {
    const normalized = this.normalized(ayahText)
    const spans: Span[] = []

    for (const entry of this.prepared) {
      // A rule declaring `original` is written against the text as the mushaf
      // has it, so its match offsets are already the caller's offsets and need
      // no mapping back.
      const onOriginal = entry.rule.matchAgainst === 'original'
      const subject = onOriginal ? ayahText : normalized.text

      entry.pattern.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = entry.pattern.exec(subject)) !== null) {
        // `match.index` is a UTF-16 index; the map is indexed by code point.
        // They differ only outside the Basic Multilingual Plane, which Quranic
        // text does not reach.
        const start = codePointIndex(subject, match.index)
        const end = start + toCodePoints(match[0]).length

        const range = onOriginal
          ? { start, end }
          : toSourceRange(normalized, start, end, normalized.sourceLength)

        spans.push({
          ...range,
          ruleId: entry.rule.id,
          hukumId: entry.hukumId,
          categoryId: entry.categoryId,
          topicId: entry.topicId,
        })

        // A pattern that can match empty would otherwise loop forever.
        if (match[0].length === 0) {
          entry.pattern.lastIndex += 1
        }
      }
    }

    spans.sort((a, b) => a.start - b.start || b.end - a.end || a.ruleId.localeCompare(b.ruleId))
    return spans
  }

  /** True if any selected rule matches — cheaper than `analyze` when counting. */
  matches(ayahText: string, ruleId: string): boolean {
    const entry = this.byRuleId.get(ruleId)
    if (!entry) {
      return false
    }
    entry.pattern.lastIndex = 0
    return entry.pattern.test(
      entry.rule.matchAgainst === 'original' ? ayahText : this.normalized(ayahText).text,
    )
  }

  private normalized(ayahText: string): Normalized {
    let cached = this.cache.get(ayahText)
    if (!cached) {
      cached = normalize(ayahText)
      this.cache.set(ayahText, cached)
    }
    return cached
  }
}

/**
 * Reduces overlapping spans to a single non-overlapping layer, keeping the
 * earliest span and, where two start together, the longer one.
 *
 * This is a rendering convenience, not a ruling: dropping a span does not mean
 * that rule does not apply, only that something else is drawn there. Anything
 * teaching tajweed should show the overlaps rather than hide them.
 */
export function resolveOverlaps(spans: readonly Span[]): Span[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: Span[] = []
  let lastEnd = -1

  for (const span of ordered) {
    if (span.start >= lastEnd) {
      kept.push(span)
      lastEnd = span.end
    }
  }

  return kept
}

/** Extracts the text a span covers, correctly for any code point. */
export function sliceSpan(ayahText: string, span: Pick<Span, 'start' | 'end'>): string {
  return toCodePoints(ayahText).slice(span.start, span.end).join('')
}

/** Converts a UTF-16 index into a code-point index. */
function codePointIndex(text: string, utf16Index: number): number {
  let count = 0
  for (let i = 0; i < utf16Index; ) {
    const code = text.codePointAt(i)!
    i += code > 0xffff ? 2 : 1
    count += 1
  }
  return count
}

/**
 * Precomputed annotations.
 *
 * The Quran is a fixed corpus, so running the compiled patterns over an ayah on
 * every request computes the same answer every time. The engine is better used
 * once, at build time, with the offsets shipped as data.
 *
 * That is also what makes the result publishable: offsets carry no text, so an
 * annotation set can be distributed where the mushaf it describes cannot.
 */

import type { Corpus, Span } from './types.js'

/** `[start, end, ruleIndex]` — indices into `ruleIds`. */
export type PackedSpan = readonly [start: number, end: number, rule: number]

export interface Annotations {
  readonly corpusVersion: string
  readonly riwayah: string
  readonly edition: {
    readonly id: string
    readonly sha256: string
    readonly ayahCount: number
  }
  /**
   * The rule id for each index used in `spans`. Rule ids repeat tens of
   * thousands of times across the mushaf; indices keep the file to a size worth
   * downloading.
   */
  readonly ruleIds: readonly string[]
  /** Packed spans by `surah:ayah`. Ayahs with no annotations are omitted. */
  readonly spans: Readonly<Record<string, readonly PackedSpan[]>>
}

/**
 * Expands the packed spans for one ayah into the same shape `analyze` returns,
 * so code can move between live analysis and precomputed data without changing.
 */
export function unpack(annotations: Annotations, corpus: Corpus, reference: string): Span[] {
  const packed = annotations.spans[reference]
  if (!packed) {
    return []
  }

  const lineage = lineageIndex(corpus)

  return packed.map(([start, end, ruleIndex]) => {
    const ruleId = annotations.ruleIds[ruleIndex]
    if (ruleId === undefined) {
      throw new Error(
        `Annotations for ${reference} reference rule index ${ruleIndex}, ` +
          `but only ${annotations.ruleIds.length} rule ids are declared.`,
      )
    }
    const found = lineage.get(ruleId)
    if (!found) {
      throw new Error(
        `Annotations reference rule ${ruleId}, which is not in corpus ` +
          `v${corpus.version}. These annotations were computed against ` +
          `v${annotations.corpusVersion}.`,
      )
    }
    return { start, end, ruleId, ...found }
  })
}

interface Lineage {
  readonly hukumId: string
  readonly categoryId: string
  readonly topicId: string
}

const lineageCache = new WeakMap<Corpus, Map<string, Lineage>>()

function lineageIndex(corpus: Corpus): Map<string, Lineage> {
  let cached = lineageCache.get(corpus)
  if (cached) {
    return cached
  }

  const categoryById = new Map(corpus.categories.map((category) => [category.id, category]))
  const hukumById = new Map(corpus.hukums.map((hukum) => [hukum.id, hukum]))

  cached = new Map()
  for (const rule of corpus.rules) {
    const hukum = hukumById.get(rule.hukum)
    const category = hukum ? categoryById.get(hukum.category) : undefined
    if (!hukum || !category) {
      continue
    }
    cached.set(rule.id, {
      hukumId: hukum.id,
      categoryId: category.id,
      topicId: category.topic,
    })
  }

  lineageCache.set(corpus, cached)
  return cached
}

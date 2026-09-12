/**
 * The corpus README states four counts, and a reader takes them on trust.
 *
 * Every other count in this repository has been removed rather than corrected,
 * because a number written by hand goes stale silently and a corrected one is
 * the same defect with a fresher value. These four stay, because they are the
 * first thing a reader wants and a package README cannot compute anything — so
 * they are guarded instead: the numbers are read back out of the prose and
 * checked against the corpus, and drift fails the build rather than shipping.
 *
 * `conformance/frozen.json` carried `corpusVersion: 0.4.1` for two corpus
 * versions for want of exactly this.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import corpus from '../rules.json' with { type: 'json' }
import annotations from '../../annotations/uthmani-hafs.json' with { type: 'json' }
import type { Corpus } from '../../core/src/types.js'

const typed = corpus as unknown as Corpus
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const readme = readFileSync(join(root, 'packages', 'rules', 'README.md'), 'utf8')
const coverage = readFileSync(join(root, 'docs', 'coverage.md'), 'utf8')

describe('the counts in packages/rules/README.md', () => {
  const headline = /\*\*(\d+) topics → (\d+) categories → (\d+) ahkam → (\d+) rules\*\*/.exec(readme)

  it('are still stated in the form this test reads', () => {
    // If the sentence is rewritten, this test must be rewritten with it rather
    // than silently passing over prose it no longer understands.
    expect(headline).not.toBeNull()
  })

  it('match the corpus', () => {
    const [, topics, categories, hukums, rules] = headline!
    expect({
      topics: Number(topics),
      categories: Number(categories),
      hukums: Number(hukums),
      rules: Number(rules),
    }).toEqual({
      topics: typed.topics.length,
      categories: typed.categories.length,
      hukums: typed.hukums.length,
      rules: typed.rules.length,
    })
  })
})

describe('the claims docs/coverage.md makes about what is annotated', () => {
  // A one-line fix stops one instance. This stops the class.
  //
  // coverage.md said, sixty lines apart, that 20:1 is the only ayah with no
  // ruling AND that every ayah has at least one annotation. Both are valid
  // markdown, the merge that reinstated the wrong one was clean, and nothing
  // anywhere reported a problem — it was a statement about the Qur'an, undone
  // by an integration nobody was running. Asserted against the data now, not
  // against a string.
  const annotated = Object.keys(annotations.spans).length
  const total = annotations.edition.ayahCount
  const unannotated = total - annotated

  it('states the count of annotated ayahs, and states it correctly', () => {
    expect(coverage).toContain(`${annotated.toLocaleString('en-US')} of the`)
    expect(coverage).toContain(`${total.toLocaleString('en-US')} ayahs`)
  })

  it('does not also claim every ayah is annotated', () => {
    // The sentence that keeps coming back. It is only true if nothing is
    // unannotated, and something is.
    if (unannotated > 0) {
      expect(coverage).not.toMatch(/every ayah of the mushaf has at\s+least one annotation/)
      expect(coverage).not.toContain('in practice nothing is left out')
    }
  })

  it('names every unannotated ayah it claims exists', () => {
    const missing = Object.keys(
      JSON.parse(readFileSync(join(root, 'editions', `${annotations.edition.id}.json`), 'utf8')).ayahs,
    ).filter((reference) => !(reference in annotations.spans))

    expect(missing).toHaveLength(unannotated)
    for (const reference of missing) {
      expect(coverage).toContain(reference)
    }
  })
})

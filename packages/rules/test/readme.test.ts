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
import type { Corpus } from '../../core/src/types.js'

const typed = corpus as unknown as Corpus
const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8')

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

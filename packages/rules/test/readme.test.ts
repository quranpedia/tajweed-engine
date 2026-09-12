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

  it('does not make the same claim in different words, anywhere in the file', () => {
    // The two assertions above match two exact sentences, and that is the same
    // mistake one level up: it stops the wordings that have already been caught
    // and nothing else. The claim came back once after being fixed; it came
    // back the second time phrased differently, and a literal match would have
    // let it through.
    //
    // So this reads the file as sentences and looks for the SHAPE of the
    // claim — a totality word, about ayahs, about being annotated — rather
    // than any particular way of saying it. A sentence is cleared if it names
    // an ayah that is actually unannotated, or states the real annotated
    // count, because then it is telling the truth and the exception with it.
    if (unannotated === 0) return

    const unannotatedReferences = Object.keys(
      JSON.parse(readFileSync(join(root, 'editions', `${annotations.edition.id}.json`), 'utf8')).ayahs,
    ).filter((reference) => !(reference in annotations.spans))

    // Positive universals only. An earlier draft of this test also treated
    // "no" and "any" as totality words, and it flagged two sentences that
    // ADMIT a gap — "the saktah in 18:1-2 gets no annotation", "ayahs with no
    // annotations are left out of a generated set". Those say the true thing.
    // The claim being hunted is the assertion that nothing is missing, so the
    // pattern has to be the assertion and not merely the vocabulary.
    const totality = /\b(every|all|each)\b/i
    const aboutAyahs = /\bayah|\bāyah|\bayat/i
    const aboutAnnotation = /annotat|ruling|covered|coverage|nothing to say/i
    const deniesAnyException = /\bnothing\b[^.]*\bleft out\b|\bwithout exception\b|\bnone are (?:left out|missing)\b/i

    const offenders = coverage
      .split(/(?<=[.!?])\s+|\n\n/)
      .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
      .filter(
        (sentence) =>
          (totality.test(sentence) && aboutAyahs.test(sentence) && aboutAnnotation.test(sentence)) ||
          deniesAnyException.test(sentence),
      )
      .filter(
        (sentence) =>
          !unannotatedReferences.some((reference) => sentence.includes(reference)) &&
          !sentence.includes(annotated.toLocaleString('en-US')) &&
          !sentence.includes(String(annotated)),
      )

    expect(
      offenders,
      'a sentence claims total coverage without naming the exception — ' +
        `${unannotatedReferences.join(', ')} ${unannotatedReferences.length === 1 ? 'is' : 'are'} not annotated`,
    ).toEqual([])
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

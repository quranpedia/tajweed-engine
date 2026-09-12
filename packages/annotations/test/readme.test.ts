/**
 * The annotations README states four counts and one worked example, and a
 * reader takes them on trust. Guarded for the same reason the corpus README's
 * counts are guarded in `packages/rules/test/readme.test.ts`: a package README
 * cannot compute anything, so the numbers are read back out of the prose and
 * checked against the data, and drift fails the build rather than shipping.
 *
 * The worked example is included because an offset example that has gone stale
 * is worse than no example — it teaches the reader the wrong indexing.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import annotations from '../uthmani-hafs.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(join(here, '..', 'README.md'), 'utf8')

const spanTotal = Object.values(annotations.spans).reduce((sum, spans) => sum + spans.length, 0)
const annotated = Object.keys(annotations.spans).length
const total = annotations.edition.ayahCount

describe('the counts in packages/annotations/README.md', () => {
  const headline =
    /\*\*([\d,]+) spans\*\* from\s+\*\*(\d+) rules\*\*, across\s+\*\*([\d,]+) of the ([\d,]+) āyāt\*\*/.exec(
      readme,
    )

  it('are still stated in the form this test reads', () => {
    // If the sentence is rewritten, rewrite this test with it rather than let
    // it pass silently over prose it no longer understands.
    expect(headline).not.toBeNull()
  })

  it('match the data', () => {
    const [, spans, rules, covered, ayahs] = headline!
    expect({ spans, rules: Number(rules), covered, ayahs }).toEqual({
      spans: spanTotal.toLocaleString('en-US'),
      rules: annotations.ruleIds.length,
      covered: annotated.toLocaleString('en-US'),
      ayahs: total.toLocaleString('en-US'),
    })
  })
})

describe('the claims packages/annotations/README.md makes about omitted ayahs', () => {
  const missing = Object.keys(
    JSON.parse(
      readFileSync(
        join(here, '..', '..', '..', 'editions', `${annotations.edition.id}.json`),
        'utf8',
      ),
    ).ayahs,
  ).filter((reference) => !(reference in annotations.spans))

  it('names every ayah that carries no spans', () => {
    expect(missing).toHaveLength(total - annotated)
    for (const reference of missing) {
      expect(readme).toContain(reference)
    }
  })

  it('claims exactly one, only while exactly one is true', () => {
    if (missing.length !== 1) {
      expect(readme).not.toContain('Exactly one is')
    }
  })
})

describe('the worked example in packages/annotations/README.md', () => {
  it('shows the spans 1:1 actually has', () => {
    const shown = /annotations\.spans\['1:1'\]\n\/\/ (\[\[.*?\]\])/.exec(readme)
    expect(shown).not.toBeNull()
    expect(JSON.parse(shown![1])).toEqual(annotations.spans['1:1'])
  })

  it('names the rule the example index really resolves to', () => {
    const [, , rule] = annotations.spans['1:1'][0]!
    expect(readme).toContain(`'${annotations.ruleIds[rule]}'`)
  })

  it('states the digest the offsets are pinned to', () => {
    expect(readme).toContain(annotations.edition.sha256.slice(0, 8))
  })
})

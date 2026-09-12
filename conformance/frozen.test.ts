/**
 * Regression check against frozen digests.
 *
 * Unlike conformance.test.ts, this needs no PHP engine — only a local copy of the
 * text edition. It is what keeps the guarantee alive once the engine this one was
 * ported from is retired.
 *
 * A failure here means behaviour changed. That is not automatically wrong, but it
 * must be deliberate: regenerate with `pnpm conformance:freeze` and the diff shows
 * exactly which ayahs and which rules moved.
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed } from '../packages/core/src/engine.js'
import { normalize } from '../packages/core/src/normalize.js'
import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const editionPath = join(here, '..', 'editions', 'uthmani-hafs.json')
const frozenPath = join(here, 'frozen.json')

interface Frozen {
  corpusVersion: string
  edition: { id: string; sha256: string; ayahCount: number }
  normalization: Record<string, string>
  incidence: Record<string, { ayahs: number; occurrences: number; digest: string }>
}

// A missing edition used to skip this entire suite, so `pnpm test` went green
// having verified nothing at all. Renaming one file was enough to do it, and the
// migration off this edition will move it for real — so absence is a failure
// now, and moving the edition means updating this path deliberately.
const available = existsSync(editionPath)
const describeIfAvailable = describe

const frozen = JSON.parse(readFileSync(frozenPath, 'utf8')) as Frozen
const edition: Edition = available
  ? (JSON.parse(readFileSync(editionPath, 'utf8')) as Edition)
  : { id: '', riwayah: '', script: '', ayahs: {} }

async function digest(value: string, length = 16): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

describeIfAvailable('frozen conformance', () => {
  const typed = corpus as unknown as Corpus

  it('is pinned to the edition it was frozen against', async () => {
    // Every digest below is a claim about a specific string. If the text differs,
    // the failures that follow would be about the text, not about the engine.
    expect(await editionDigest(edition)).toBe(frozen.edition.sha256)
  })

  it('normalises every ayah to the frozen digest', async () => {
    const moved: string[] = []

    for (const reference of orderedReferences(edition)) {
      const actual = await digest(normalize(edition.ayahs[reference]!).text)
      if (actual !== frozen.normalization[reference]) {
        moved.push(reference)
      }
    }

    expect(
      moved.length,
      moved.length === 0
        ? ''
        : `normalisation changed for ${moved.length} ayahs, first: ${moved.slice(0, 20).join(', ')}. ` +
          'If intended, run `pnpm conformance:freeze` and review the diff.',
    ).toBe(0)
  })

  it('matches the frozen set of ayahs for every rule', async () => {
    const engine = new Tajweed(typed, { includeDisabled: true })
    const matched = new Map<string, string[]>()
    const occurrences = new Map<string, number>()

    for (const reference of orderedReferences(edition)) {
      const seenHere = new Set<string>()
      for (const span of engine.analyze(edition.ayahs[reference]!)) {
        occurrences.set(span.ruleId, (occurrences.get(span.ruleId) ?? 0) + 1)
        if (!seenHere.has(span.ruleId)) {
          seenHere.add(span.ruleId)
          matched.set(span.ruleId, [...(matched.get(span.ruleId) ?? []), reference])
        }
      }
    }

    const problems: string[] = []
    for (const rule of engine.rules) {
      const expected = frozen.incidence[rule.id]
      if (!expected) {
        problems.push(`${rule.id}: not in the frozen set — new rule, needs a re-freeze`)
        continue
      }
      const actualDigest = await digest((matched.get(rule.id) ?? []).join(','))
      const actualOccurrences = occurrences.get(rule.id) ?? 0
      // The digest is over the LIST of ayahs, so a rule that fires a different
      // number of times inside the same ayahs leaves it unchanged. That is not
      // hypothetical: recovering the hamza written below the line moved
      // mutamathilain-izhar.1 by -1 and .2 by -7 with byte-identical digests,
      // and this suite reported nothing. The count is frozen too; compare it.
      if (actualDigest !== expected.digest || actualOccurrences !== expected.occurrences) {
        problems.push(
          `${rule.id}: matched ${(matched.get(rule.id) ?? []).length} ayahs / ` +
            `${actualOccurrences} occurrences, frozen at ` +
            `${expected.ayahs} / ${expected.occurrences}`,
        )
      }
    }

    expect(problems.length, problems.slice(0, 30).join('\n')).toBe(0)
  })

  it('was frozen against the corpus that is here now', () => {
    // frozen.json declares the corpus version it was generated from, and nothing
    // compared it to anything — which is how main came to ship a file labelled
    // 0.4.1 against a corpus at 0.4.2 for two releases. The digests happened to
    // be current; the label was not, and no test could tell.
    expect(frozen.corpusVersion).toBe(typed.version)
  })

  it('was frozen against the edition that is here now', () => {
    // Same failure, one step along: a frozen set describes one exact text, and
    // the digest of that text is recorded. If the edition moves underneath it,
    // every normalisation digest below is measuring something else.
    expect(frozen.edition.ayahCount).toBe(orderedReferences(edition).length)
  })

  it('covers every rule in the corpus', () => {
    // Guards against the file going stale by omission rather than by conflict.
    for (const rule of typed.rules) {
      expect(frozen.incidence[rule.id], `${rule.id} is missing from frozen.json`).toBeDefined()
    }
  })
})

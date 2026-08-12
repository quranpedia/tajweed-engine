/**
 * Freezes the current engine behaviour as a committable, text-free artifact.
 *
 *   pnpm conformance:freeze
 *
 * The conformance suite was built against a snapshot of the PHP engine this one
 * was ported from. That snapshot embeds the mushaf, so it cannot be committed,
 * and the engine that produces it is being retired — which would leave the port
 * with nothing to regress against.
 *
 * What is actually needed to catch a regression is not the text but a fingerprint
 * of what the engine did to it: a digest of each ayah's normalised form, and a
 * digest of the set of ayahs each rule matches. Those carry no Quranic text, so
 * they can be committed and kept indefinitely, and any change to normalisation or
 * to a rule's matching shows up as a changed digest.
 *
 * Run this only when a change to behaviour is intended, and read the diff: a
 * refactor should move none of these, and a rule change should move exactly one.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed } from '../packages/core/src/engine.js'
import { normalize } from '../packages/core/src/normalize.js'
import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const edition = JSON.parse(
  readFileSync(join(here, '..', 'editions', 'uthmani-hafs.json'), 'utf8'),
) as Edition
const typed = corpus as unknown as Corpus

/** Short digests: enough to detect a change, short enough to keep the file small. */
async function digest(value: string, length = 16): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

const references = orderedReferences(edition)

const normalization: Record<string, string> = {}
for (const reference of references) {
  normalization[reference] = await digest(normalize(edition.ayahs[reference]!).text)
}

const engine = new Tajweed(typed, { includeDisabled: true })
const incidence: Record<string, { ayahs: number; occurrences: number; digest: string }> = {}

const matchedByRule = new Map<string, string[]>()
const occurrencesByRule = new Map<string, number>()

for (const reference of references) {
  const seenHere = new Set<string>()
  for (const span of engine.analyze(edition.ayahs[reference]!)) {
    occurrencesByRule.set(span.ruleId, (occurrencesByRule.get(span.ruleId) ?? 0) + 1)
    if (!seenHere.has(span.ruleId)) {
      seenHere.add(span.ruleId)
      const list = matchedByRule.get(span.ruleId) ?? []
      list.push(reference)
      matchedByRule.set(span.ruleId, list)
    }
  }
}

for (const rule of engine.rules) {
  const matched = matchedByRule.get(rule.id) ?? []
  incidence[rule.id] = {
    ayahs: matched.length,
    occurrences: occurrencesByRule.get(rule.id) ?? 0,
    digest: await digest(matched.join(',')),
  }
}

const frozen = {
  corpusVersion: typed.version,
  edition: { id: edition.id, sha256: await editionDigest(edition), ayahCount: references.length },
  note:
    'Digests only — no Quranic text. Regenerate with `pnpm conformance:freeze` and read the diff.',
  normalization,
  incidence,
}

const outPath = join(here, '..', 'conformance', 'frozen.json')
writeFileSync(outPath, `${JSON.stringify(frozen, null, 1)}\n`, 'utf8')

console.log(
  `wrote ${outPath}\n` +
    `  ${references.length} ayah normalisation digests\n` +
    `  ${Object.keys(incidence).length} rule incidence digests`,
)

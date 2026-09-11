/**
 * Reports whether an edition of the Uthmani script is one this engine can read.
 *
 *   pnpm edition:check path/to/edition.json
 *
 * Only one edition has been verified against the corpus. Others will very likely
 * work, because the differences between Uthmani editions are mostly in which
 * optional marks are used and how a few characters are encoded — but "very likely"
 * is not a claim worth making about sacred text, and the failure mode is silent:
 * a missing mark does not raise an error, it just quietly stops a rule matching.
 *
 * So rather than assert compatibility, this measures it. It checks the characters
 * the normaliser depends on, then runs the corpus and compares rule by rule
 * against the frozen baseline. A rule that matches 1,300 ayahs in the reference
 * edition and 4 in yours has found something else.
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed } from '../packages/core/src/engine.js'
import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const typed = corpus as unknown as Corpus

const path = process.argv[2]
if (!path) {
  console.error('usage: pnpm edition:check <edition.json>')
  process.exit(1)
}

const edition = JSON.parse(readFileSync(resolve(path), 'utf8')) as Edition
const references = orderedReferences(edition)
const allText = references.map((reference) => edition.ayahs[reference]!).join('')

interface Expectation {
  readonly char: string
  readonly name: string
  readonly matters: string
  /** Roughly how many occurrences the reference edition has. */
  readonly reference: number
  /** An edition may legitimately not use this at all. */
  readonly optional?: boolean
}

/**
 * The characters the normalisation passes are written around. An edition missing
 * one is not broken, but every rule that depends on it will silently find less.
 */
const EXPECTED: readonly Expectation[] = [
  { char: '\u{06E1}', name: 'Quranic sukoon', matters: 'sakin letters; folded onto U+0652', reference: 15000 },
  { char: '\u{0671}', name: 'alef wasla', matters: 'kept distinct so madd rules do not fire on it', reference: 8000 },
  { char: '\u{0670}', name: 'superscript alef', matters: 'read as a madd alef', reference: 3000 },
  { char: '\u{0653}', name: 'maddah above', matters: 'identifies المد اللازم الحرفي; composes آ', reference: 5000 },
  { char: '\u{0640}', name: 'tatweel', matters: 'bears a hamza in editions that write it that way', reference: 500, optional: true },
  { char: '\u{0654}', name: 'hamza above', matters: 'a hamza written on its letter rather than seated', reference: 500, optional: true },
  { char: '\u{06E2}', name: 'small high meem', matters: 'iqlab, read as tanween', reference: 500 },
  { char: '\u{06ED}', name: 'small low meem', matters: 'iqlab after a kasra', reference: 100, optional: true },
  { char: '\u{0657}', name: 'inverted damma', matters: 'positional tanween; one of the two families', reference: 500, optional: true },
  { char: '\u{065E}', name: 'fathatan vertical', matters: 'positional tanween; one of the two families', reference: 100, optional: true },
  { char: '\u{0656}', name: 'subscript alef', matters: 'positional tanween; one of the two families', reference: 500, optional: true },
  { char: '\u{08F0}', name: 'open fathatan', matters: 'open tanween; the other family, used by KFGQPC', reference: 0, optional: true },
  { char: '\u{08F1}', name: 'open dammatan', matters: 'open tanween; the other family, used by KFGQPC', reference: 0, optional: true },
  { char: '\u{08F2}', name: 'open kasratan', matters: 'open tanween; the other family, used by KFGQPC', reference: 0, optional: true },
  { char: '\u{06DC}', name: 'small high seen', matters: 'marks a saktah, which blocks matching across it', reference: 20, optional: true },
  { char: '\u{06E5}', name: 'small waw', matters: 'مد الصلة', reference: 100, optional: true },
  { char: '\u{06E6}', name: 'small yeh', matters: 'مد الصلة', reference: 100, optional: true },
]

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

console.log(`edition   ${edition.id ?? '(unnamed)'}`)
console.log(`riwayah   ${edition.riwayah ?? '(undeclared)'}`)
console.log(`ayahs     ${references.length}`)
console.log(`sha256    ${await editionDigest(edition)}\n`)

const problems: string[] = []
const warnings: string[] = []

if (edition.riwayah !== typed.riwayah) {
  problems.push(
    `The corpus is ${typed.riwayah}; this edition declares ${edition.riwayah ?? 'nothing'}. ` +
      'Rulings and orthography both differ between riwayat.',
  )
}

if (references.length !== 6236) {
  warnings.push(
    `${references.length} ayahs, not the 6,236 of the Hafs counting. ` +
      'Ayah counts differ between counting systems; check which one this edition uses.',
  )
}

console.log('Characters the normaliser depends on:\n')
for (const expectation of EXPECTED) {
  const found = count(allText, expectation.char)
  const status = found === 0 ? (expectation.optional ? 'absent ' : 'MISSING') : 'present'
  console.log(
    `  ${status}  ${expectation.name.padEnd(20)} ${String(found).padStart(6)}  ${expectation.matters}`,
  )
  if (found === 0 && !expectation.optional) {
    problems.push(`No ${expectation.name} (U+${expectation.char.codePointAt(0)!.toString(16).toUpperCase()}) anywhere. Rules relying on it will find nothing.`)
  }
}

// Precomposed آ where the reference uses the decomposed pair is the single most
// common encoding difference between Uthmani editions, and it changes what the
// madd rules see.
const precomposed = count(allText, '\u{0622}')
if (precomposed > 0) {
  warnings.push(
    `${precomposed} precomposed آ (U+0622). The reference edition writes these decomposed ` +
      '(U+0627 U+0653). Both are handled, but any rule written as a literal will only match one of them.',
  )
}

const frozenPath = join(here, '..', 'conformance', 'frozen.json')
if (existsSync(frozenPath)) {
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8')) as {
    incidence: Record<string, { ayahs: number }>
  }

  const engine = new Tajweed(typed)
  const matched = new Map<string, number>()

  for (const reference of references) {
    for (const ruleId of new Set(engine.analyze(edition.ayahs[reference]!).map((span) => span.ruleId))) {
      matched.set(ruleId, (matched.get(ruleId) ?? 0) + 1)
    }
  }

  const drifted: Array<{ id: string; here: number; reference: number }> = []
  for (const rule of engine.rules) {
    const baseline = frozen.incidence[rule.id]?.ayahs ?? 0
    const actual = matched.get(rule.id) ?? 0
    if (baseline < 20) {
      continue
    }
    const ratio = actual / baseline
    if (ratio < 0.5 || ratio > 2) {
      drifted.push({ id: rule.id, here: actual, reference: baseline })
    }
  }

  console.log(`\nRules, against the reference edition:\n`)
  console.log(`  ${engine.rules.length} rules run, ${drifted.length} matching a very different number of ayahs`)

  for (const entry of drifted.slice(0, 20)) {
    console.log(`    ${entry.id.padEnd(34)} ${String(entry.here).padStart(5)} here vs ${entry.reference} in the reference`)
  }

  if (drifted.length > 0) {
    warnings.push(
      `${drifted.length} rules match a very different number of ayahs here. ` +
        'That is expected for a different riwayah and suspicious for another Hafs edition.',
    )
  }
} else {
  warnings.push('No conformance/frozen.json, so rule counts were not compared.')
}

console.log()
for (const warning of warnings) {
  console.log(`warning: ${warning}`)
}
for (const problem of problems) {
  console.error(`problem: ${problem}`)
}

if (problems.length > 0) {
  console.error('\nThis edition is not one the engine can read as it stands.')
  process.exit(1)
}

console.log(
  warnings.length === 0
    ? '\nNo problems found. Annotate it, then have the result reviewed by someone qualified — this checks shape, not rulings.'
    : '\nNo blocking problems, but read the warnings before trusting the output.',
)

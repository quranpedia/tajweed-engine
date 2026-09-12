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
import { ALLOWED_MARKS } from '../packages/core/src/unicode.js'
import { normalize } from '../packages/core/src/normalize.js'
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

const count2 = (haystack: string, needle: string): number => count(haystack, needle)

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

// Marks the edition contains that this engine has no opinion about.
//
// EXPECTED above enumerates the marks the normaliser depends on and reports the
// ones it does NOT find. It never reports the reverse: a mark that is present in
// the text and that nothing in the pipeline recognises. Such a mark is neither
// folded, nor stripped as decoration, nor allowed through as a waqf sign — it
// simply sits in the normalised text, where it can wedge an implied sukoon onto
// the letter before it or stop a rule matching across it.
//
// U+06E3, the small low seen at 52:37, is exactly that: it is in neither
// OPTIONAL_MARKS nor ALLOWED_MARKS, and the check reported "No problems found".
//
// They are listed, not counted, because a count tells a reader nothing they can
// act on.
//
// WHAT COUNTS AS "KNOWN" IS DERIVED, NOT LISTED, AND THAT MATTERS.
//
// The first version of this gate asked whether a mark appeared in
// OPTIONAL_MARKS, ALLOWED_MARKS or EXPECTED. That model was correct the hour it
// was written and false a day later: PR #10 removed U+0655 from OPTIONAL_MARKS
// because the hamza below stopped being decoration to strip and became a
// consonant recovered by a dedicated pass. It is handled better than before,
// and the gate began reporting it as unknown — failing both editions the
// repository ships, on a mark that is fully consumed.
//
// A mark handled by a PASS is invisible to a model built on LISTS. So the
// question asked here is the one that actually matters, and it is asked of the
// pipeline rather than of a list: after normalisation, is this mark still in
// the text?
//
//   - It does not survive  -> the pipeline has an opinion. Folded, stripped or
//     consumed, by a list or by a pass, it does not reach a rule. Known.
//   - It survives and is declared  -> deliberate. The vowels, shaddah, sukoon
//     and superscript alef MUST survive, because the rules match on them, and
//     ALLOWED_MARKS are the waqf signs passed through on purpose. Known.
//   - It survives and is not declared -> nothing put it there and nothing will
//     read it. It sits in the normalised text wedging an implied sukoon onto
//     the letter before it, or stopping a rule matching across it. Unknown.
//
// U+06E3, the small low seen at 52:37, is the third case and is why this gate
// exists. U+0655 is the first, and is why it is no longer written as a list.
// This is `docs/checks-that-report-success.md` applied to a gate that document
// produced: prefer deriving a number to writing one down.

/** Marks that are SUPPOSED to survive normalisation, because rules read them. */
const declaredToSurvive = new Set<string>([
  ...ALLOWED_MARKS,
  ...EXPECTED.map((expectation) => expectation.char),
  '\u{0651}', '\u{0652}', '\u{064B}', '\u{064C}', '\u{064D}',
  '\u{064E}', '\u{064F}', '\u{0650}', '\u{0670}', '\u{0653}',
])

const normalisedText = references.map((reference) => normalize(edition.ayahs[reference]!).text).join('')
const survives = (character: string) => normalisedText.includes(character)

const unknown = new Map<string, number>()
for (const character of allText) {
  const code = character.codePointAt(0)!
  const isMark =
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06ed) ||
    (code >= 0x08f0 && code <= 0x08f2)
  if (isMark && !declaredToSurvive.has(character) && survives(character)) {
    unknown.set(character, (unknown.get(character) ?? 0) + 1)
  }
}
if (unknown.size > 0) {
  console.log('\nMarks this engine has no opinion about:\n')
  for (const [character, count] of [...unknown].sort((a, b) => b[1] - a[1])) {
    console.log(
      `  U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` +
        `  ${String(count).padStart(5)} in the edition,` +
        ` ${String(count2(normalisedText, character)).padStart(5)} still there after normalisation` +
        '  — nothing folds it, strips it or reads it',
    )
  }
  problems.push(
    `${unknown.size} mark(s) present in this edition are unknown to the normaliser: ` +
      [...unknown.keys()]
        .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
        .join(', ') +
      '. An unrecognised mark is not dropped and not read — it stays in the ' +
      'normalised text, where it can give the letter before it an implied sukoon ' +
      'or stop a rule matching across it.',
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

  // A rule that moves is worth a look. A rule that stops matching ENTIRELY is a
  // different thing: it is what a stripped or unrecognised mark looks like from
  // here, and it is the failure this whole check exists to catch. Removing the
  // open tanween from a valid edition silences twenty-four rules at once, and
  // this used to report that and exit 0.
  const collapsed: Array<{ id: string; here: number; reference: number }> = []
  const drifted: Array<{ id: string; here: number; reference: number }> = []
  for (const rule of engine.rules) {
    const baseline = frozen.incidence[rule.id]?.ayahs ?? 0
    const actual = matched.get(rule.id) ?? 0
    if (baseline < 20) {
      continue
    }
    if (actual === 0) {
      collapsed.push({ id: rule.id, here: actual, reference: baseline })
      continue
    }
    const ratio = actual / baseline
    if (ratio < 0.5 || ratio > 2) {
      drifted.push({ id: rule.id, here: actual, reference: baseline })
    }
  }

  console.log(`\nRules, against the reference edition:\n`)
  console.log(
    `  ${engine.rules.length} rules run, ${collapsed.length} matching nothing at all, ` +
      `${drifted.length} matching a very different number of ayahs`,
  )

  for (const entry of [...collapsed, ...drifted].slice(0, 20)) {
    console.log(`    ${entry.id.padEnd(34)} ${String(entry.here).padStart(5)} here vs ${entry.reference} in the reference`)
  }

  if (collapsed.length > 0) {
    problems.push(
      `${collapsed.length} rules match nothing at all here, against ${collapsed[0]!.reference} ` +
        `and more in the reference — ${collapsed.slice(0, 4).map((c) => c.id).join(', ')}` +
        `${collapsed.length > 4 ? ', …' : ''}. A rule that finds nothing is what an unreadable ` +
        'mark looks like from here, and it reports no ruling where there is one.',
    )
  }

  if (drifted.length > 0) {
    warnings.push(
      `${drifted.length} rules match a very different number of ayahs here. ` +
        'That is expected for a different riwayah and suspicious for another Hafs edition.',
    )
  }
} else {
  // The rule comparison is the substance of this check, not an extra. Without a
  // reference set the script can report that the characters are present and
  // still miss twenty-four rules matching nothing — which is the failure it
  // exists for. It is a problem, never a warning: this is pointed at arbitrary
  // editions, and the base-text migration is exactly when frozen.json is in flux.
  problems.push(
    'No conformance/frozen.json, so no rule was compared against anything. ' +
      'That is the substance of this check; without it the result means only ' +
      'that the characters are present.',
  )
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

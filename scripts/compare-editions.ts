/**
 * Measures the distance between two editions, and writes it down.
 *
 *   pnpm edition:diff editions/uthmani-hafs.json editions/hafs-quran-text.json
 *
 * `edition:check` answers "can the engine read this text at all". This answers
 * the harder question: given two editions a reader would call the same muṣḥaf,
 * exactly where do they disagree, how much of that is encoding, and what is
 * left over that is a real difference in the text.
 *
 * It exists because the answer has to be a number in a file rather than a
 * paragraph in a README. Every difference between two editions moves offsets,
 * and offsets are the entire product here; a divergence nobody has counted is a
 * divergence that will be discovered by a reader seeing the wrong letter
 * coloured. So the report is committed, versioned, and re-generated on demand,
 * and the diff is the review.
 *
 * The classes below are descriptive, not corrective. Nothing here rewrites an
 * edition — this measures, and the normaliser is where a difference is actually
 * handled.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed } from '../packages/core/src/engine.js'
import { normalize } from '../packages/core/src/normalize.js'
import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'
import type { Corpus } from '../packages/core/src/types.js'

const [leftPath, rightPath, ...rest] = process.argv.slice(2)
if (!leftPath || !rightPath) {
  console.error('usage: pnpm edition:diff <reference.json> <other.json> [--out <report.json>]')
  process.exit(1)
}
const outIndex = rest.indexOf('--out')
const outPath = outIndex === -1 ? undefined : rest[outIndex + 1]

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8')) as Edition
const left = read(leftPath)
const right = read(rightPath)

/**
 * A mark, for the purpose of deciding what is stacked on a letter. Wider than
 * `isDiacritic`, because the difference between two Uthmani editions is mostly
 * in the marks that are not harakat.
 */
function isMark(char: string): boolean {
  const code = char.codePointAt(0)!
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06ed) ||
    (code >= 0x08f0 && code <= 0x08f2)
  )
}

/**
 * One letter and everything written on it, in a form that does not depend on
 * the order the marks were typed in or on whether a letter and the mark above
 * it were stored as one character or two.
 *
 * Both are things two editions of the same muṣḥaf disagree about while printing
 * identically, so folding them is what separates "written differently" from
 * "different text". The seats are decomposed rather than composed so that the
 * two directions meet in one place.
 */
function fold(text: string): string {
  const SEATS: Record<string, [base: string, mark: string]> = {
    '\u{0622}': ['\u{0627}', '\u{0653}'], // آ
    '\u{0623}': ['\u{0627}', '\u{0654}'], // أ
    '\u{0624}': ['\u{0648}', '\u{0654}'], // ؤ
    '\u{0626}': ['\u{064A}', '\u{0654}'], // ئ
  }
  let out = ''
  let base: string | null = null
  let marks: string[] = []

  const flush = () => {
    if (base === null) return
    const seat = SEATS[base]
    if (seat) {
      out += seat[0] + [...marks, seat[1]].sort().join('')
    } else {
      out += base + marks.sort().join('')
    }
    base = null
    marks = []
  }

  for (const char of text) {
    if (isMark(char) && base !== null) marks.push(char)
    else if (isMark(char)) out += char
    else {
      flush()
      base = char
    }
  }
  flush()
  return out
}

/**
 * The character-level differences between Uthmani editions that are choices of
 * encoding rather than of text. Each is applied to the LEFT edition only, to
 * bring it towards the right; the order they are listed in is the order they
 * are reported in.
 */
const CLASSES: ReadonlyArray<{ id: string; what: string; apply: (text: string) => string }> = [
  {
    id: 'tanween',
    what: 'positional tanween (U+0657 U+065E U+0656) against open tanween (U+08F0 U+08F1 U+08F2)',
    apply: (text) => text.replace(/\u{0657}/gu, '\u{08F0}').replace(/\u{065E}/gu, '\u{08F1}').replace(/\u{0656}/gu, '\u{08F2}'),
  },
]

/**
 * Two classes that are folded rather than substituted, and one that is gone.
 *
 * `order` and `composition` are handled by fold() below. Neither now does any
 * work on these two editions: quran-ws/quran-text stopped applying NFC in #21
 * and publishes the release's own code points, which write a shaddah before its
 * vowel and ا + ٓ uncomposed — the same as the edition here. They are still
 * declared because they are real differences between Uthmani editions in
 * general, and because a future edition may reintroduce them.
 *
 * `bearer` — a hamza on a tatweel against one written on its letter — is no
 * longer a class at all. quran-text#21 restored the kashida the build had been
 * deleting, so both editions now carry 535 of them and 495 borne hamzas. This
 * script used to strip the tatweel from the left-hand side to bring it towards
 * the right; against the corrected data that transformation INVENTED 494
 * differences that are not there. A class that describes an old shape of the
 * data is worse than no class, because it reports with confidence.
 */
const FOLDED_CLASSES = [
  { id: 'order', what: 'the order of the marks stacked on one letter' },
  { id: 'composition', what: 'a precomposed letter (آ أ ؤ ئ) against a base letter plus a combining mark' },
]

const references = orderedReferences(left)
const rightReferences = new Set(orderedReferences(right))
const shared = references.filter((reference) => rightReferences.has(reference))

const identical = shared.filter((reference) => left.ayahs[reference] === right.ayahs[reference])

// Applied cumulatively, because the classes overlap inside one ayah: an ayah can
// carry both a tatweel and an open tanween, and neither alone reconciles it.
const cumulative: Array<{ id: string; what: string; reconciled: number }> = []
let applied: Array<(text: string) => string> = []
const transform = (reference: string) => applied.reduce((text, fn) => fn(text), left.ayahs[reference]!)
const agrees = (reference: string) => fold(transform(reference)) === fold(right.ayahs[reference]!)

cumulative.push({ ...FOLDED_CLASSES[0]!, reconciled: shared.filter(agrees).length })
cumulative.push({ ...FOLDED_CLASSES[1]!, reconciled: shared.filter(agrees).length })
for (const cls of CLASSES) {
  applied = [...applied, cls.apply]
  cumulative.push({ id: cls.id, what: cls.what, reconciled: shared.filter(agrees).length })
}

const differing = shared.filter((reference) => !agrees(reference))

/** Where two ayahs first disagree, as code points, so the report can be read without the fonts. */
function firstDifference(reference: string): { at: number; left: string; right: string } {
  const a = fold(right.ayahs[reference]!)
  const b = fold(transform(reference))
  let at = 0
  while (at < a.length && at < b.length && a[at] === b[at]) at++
  const codePoints = (text: string, from: number) =>
    [...text.slice(Math.max(0, from - 10), from + 10)]
      .map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
      .join(' ')
  return { at, left: codePoints(b, at), right: codePoints(a, at) }
}

// How each rule behaves on each edition. A rule that matches a very different
// number of ayahs on two editions of the same riwayah has found something else.
const engine = new Tajweed(corpus as unknown as Corpus)
function incidence(edition: Edition): { ayahs: Map<string, number>; spans: number } {
  const ayahs = new Map<string, number>()
  let spans = 0
  for (const reference of orderedReferences(edition)) {
    const found = engine.analyze(edition.ayahs[reference]!)
    spans += found.length
    for (const ruleId of new Set(found.map((span) => span.ruleId))) {
      ayahs.set(ruleId, (ayahs.get(ruleId) ?? 0) + 1)
    }
  }
  return { ayahs, spans }
}

const leftIncidence = incidence(left)
const rightIncidence = incidence(right)
const rules = engine.rules
  .map((rule) => ({
    id: rule.id,
    reference: leftIncidence.ayahs.get(rule.id) ?? 0,
    other: rightIncidence.ayahs.get(rule.id) ?? 0,
  }))
  .map((row) => ({ ...row, delta: row.other - row.reference }))

// The measure that decides whether a rule can behave the same on both: two
// ayahs that are the same text differently encoded must arrive at the matchers
// as the same string. Anything left here is a difference the normaliser cannot
// see through, and every rule that depends on it will silently disagree.
const normalisedAlike = shared.filter(
  (reference) => normalize(left.ayahs[reference]!).text === normalize(right.ayahs[reference]!).text,
)
const normalisedApart = shared.filter(
  (reference) => normalize(left.ayahs[reference]!).text !== normalize(right.ayahs[reference]!).text,
)

const report = {
  // Deliberately no timestamp. The report is committed and CI re-generates it and
  // fails on any diff, so a date that changed on every run would be the only
  // thing that ever changed.
  corpusVersion: (corpus as unknown as Corpus).version,
  note:
    'Two editions of one riwayah, and the distance between them. Regenerate with ' +
    '`pnpm edition:diff` and read the diff. A change in these numbers is a change ' +
    'in where every annotation lands.',
  editions: {
    reference: { id: left.id, path: relative(process.cwd(), resolve(leftPath)), sha256: await editionDigest(left), source: left.source ?? null },
    other: { id: right.id, path: relative(process.cwd(), resolve(rightPath)), sha256: await editionDigest(right), source: right.source ?? null },
  },
  text: {
    ayahsCompared: shared.length,
    onlyInReference: references.filter((reference) => !rightReferences.has(reference)),
    identical: identical.length,
    reconciledBy: cumulative,
    differing: differing.length,
    differences: differing.map((reference) => ({ reference, ...firstDifference(reference) })),
  },
  normalisation: {
    note:
      'Ayahs that reach the matchers as the same string. The four real textual ' +
      'differences are included in the remainder and cannot be normalised away.',
    alike: normalisedAlike.length,
    apart: normalisedApart,
  },
  rules: {
    compiled: rules.length,
    spans: { reference: leftIncidence.spans, other: rightIncidence.spans },
    matchingDifferently: rules.filter((row) => row.delta !== 0),
  },
}

const target = resolve(outPath ?? `reports/${right.id}-vs-${left.id}.json`)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`${left.id}  vs  ${right.id}\n`)
console.log(`  ${shared.length} ayahs compared`)
console.log(`  ${identical.length} byte-identical as they stand`)
for (const row of cumulative) {
  console.log(`  ${String(row.reconciled).padStart(5)} once ${row.id} is allowed for — ${row.what}`)
}
console.log(`  ${differing.length} left over, and those are real differences in the text:`)
for (const reference of differing) {
  console.log(`      ${reference}`)
}
console.log(`\n  ${normalisedAlike.length} of ${shared.length} normalise to the identical string; ${normalisedApart.length} do not`)
console.log(`\n  spans: ${leftIncidence.spans} on ${left.id}, ${rightIncidence.spans} on ${right.id}`)
console.log(`  ${report.rules.matchingDifferently.length} of ${rules.length} rules match a different number of ayahs`)
for (const row of report.rules.matchingDifferently.slice(0, 20)) {
  console.log(`      ${row.id.padEnd(34)} ${String(row.reference).padStart(5)} -> ${String(row.other).padStart(5)}`)
}
console.log(`\nwrote ${target}`)

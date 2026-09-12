/**
 * Run when quran-text#21 lands. Answers, in order, the four questions asked:
 *
 *   0. Is the fix actually complete, or is this intermediate work?
 *   1. The new residue, as a NAMED LIST of ayahs.
 *   2. Do the 13 hamza ayahs resolve, and do the 6 unrecoverable ones now
 *      carry recoverable ownership?
 *   3. Does PR #9's rule still agree with the oracle on the corrected text?
 *
 *   pnpm recheck <new-edition.json>
 *
 * Its control output, on the data as it stood before the upstream fix — this is
 * what makes it trustworthy, because an instrument that cannot report "nothing
 * has changed" cannot be believed when it reports that something has:
 *
 *   minimal pair 2:39 / 7:165  still the same four code points: the fix is NOT in
 *   residue                    17, resolved since baseline: 0, new: 0
 *   the 13                     0 of 13 resolved
 *   the 6                      all six: two vowels above the line, still ambiguous
 *
 * The new edition is produced first by `pnpm import:quran-text`. This script
 * does not import; it only measures, so that importing stays a reviewed step.
 */
import fs from 'node:fs'
import { readFileSync } from 'node:fs'
import { normalize } from '../packages/core/src/normalize.js'

const NEW = process.argv[2]
if (!NEW) {
  console.error('usage: npx tsx recheck.mjs <new-edition.json>')
  process.exit(1)
}

const ORACLE = new URL('../editions/uthmani-hafs.json', import.meta.url)
const L = JSON.parse(fs.readFileSync(ORACLE, 'utf8')).ayahs
const edition = JSON.parse(fs.readFileSync(NEW, 'utf8'))
const R = edition.ayahs

// The baseline is READ from the committed report, never written down here. A
// hard-coded list goes stale the moment anything else improves — it already did:
// the tanween fix resolved eight of the seventeen it first held, and a fixed
// list would have credited those to the upstream change.
const report = JSON.parse(readFileSync(new URL('../reports/hafs-quran-text-vs-uthmani-hafs.json', import.meta.url), 'utf8'))
const BASELINE = report.normalisation.apart
const REAL = ['11:41', '27:20', '36:22', '52:37']
const HAMZA_13 = BASELINE.filter((r) => !REAL.includes(r))
// The six quran-text#21 said could not be resolved from the file: both vowels
// sit above the line, so their order says nothing about which owns which.
const UNRECOVERABLE_6 = ['9:120', '23:108', '30:10', '33:27', '48:25', '53:31']

const cp = (s) => [...s].map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')
const isMark = (c) => { if (!c) return false; const x = c.codePointAt(0); return (x >= 0x064b && x <= 0x065f) || x === 0x0670 || (x >= 0x06d6 && x <= 0x06ed) || (x >= 0x08f0 && x <= 0x08f2) }
const isVowel = (c) => c && c.codePointAt(0) >= 0x064b && c.codePointAt(0) <= 0x0650

const line = (t) => console.log('\n' + t + '\n' + '-'.repeat(t.length))

// ---------------------------------------------------------------- 0. complete?
line('0. IS THIS THE COMPLETE FIX, OR INTERMEDIATE WORK?')
console.log(`edition id  ${edition.id}`)
console.log(`dataset     ${edition.source?.dataset ?? '(none declared)'}`)
console.log(`KFGQPC      ${edition.source?.kfgqpc?.package ?? '?'}  ${(edition.source?.kfgqpc?.sha256 ?? '').slice(0, 16)}`)
console.log(`ayahs       ${Object.keys(R).length}`)

// The minimal pair. If these still store the same code points, #21 is not done.
const word = (text, re) => text.split(' ').find((w) => re.test(w)) ?? ''
const a239 = word(R['2:39'] ?? '', /ٔ|ٕ/)
const a7165 = word(R['7:165'] ?? '', /ٔ|ٕ/)
console.log(`\nthe minimal pair — bi-'aayaat against ba-'iis:`)
console.log(`  2:39   ${JSON.stringify(a239)}\n           ${cp(a239)}`)
console.log(`  7:165  ${JSON.stringify(a7165)}\n           ${cp(a7165)}`)
const stillIdentical = cp(a239).startsWith(cp(a7165).split(' ').slice(0, 4).join(' '))
console.log(
  cp(a239).split(' ').slice(0, 4).join(' ') === cp(a7165).split(' ').slice(0, 4).join(' ')
    ? '  VERDICT: still the same four code points — the ownership fix is NOT in this data.'
    : '  VERDICT: the two now differ — ownership appears to be recorded.',
)

// ---------------------------------------------------- 1. the residue, as a list
line('1. THE NEW RESIDUE, AS A NAMED LIST')
const refs = Object.keys(L)
const apart = refs.filter((r) => R[r] === undefined || normalize(L[r]).text !== normalize(R[r]).text)
console.log(`normalise alike: ${refs.length - apart.length} of ${refs.length}`)
console.log(`residue (${apart.length}):`)
console.log('  ' + (apart.join(' ') || '(none)'))
const gone = BASELINE.filter((r) => !apart.includes(r))
const appeared = apart.filter((r) => !BASELINE.includes(r))
console.log(`\n  resolved since the baseline (${gone.length}): ${gone.join(' ') || '(none)'}`)
console.log(`  NEW, not in the baseline  (${appeared.length}): ${appeared.join(' ') || '(none)'}`)
if (appeared.length) console.log('  ^ any entry here is a regression and a reason to stop.')

// ------------------------------------------- 2. the 13, and the unrecoverable 6
line('2. THE 13 HAMZA AYAHS, ONE BY ONE')
for (const r of HAMZA_13) {
  const ok = !apart.includes(r)
  console.log(`  ${ok ? 'resolved  ' : 'STILL APART'}  ${r}`)
}
console.log(`\n  ${HAMZA_13.filter((r) => !apart.includes(r)).length} of ${HAMZA_13.length} resolved`)

line('2b. THE SIX quran-text#21 CALLED UNRECOVERABLE')
console.log('Does the file now say which vowel belongs to the hamza?\n')
for (const r of UNRECOVERABLE_6) {
  const w = word(R[r] ?? '', /ٔ/)
  const o = word(L[r] ?? '', /ـٔ|ٔ/)
  const marks = [...w].filter(isMark)
  // Ownership is a question about the KASHIDA, not about where the vowels sit.
  // The release seats a hamzah that has no letter of its own on U+0640: what
  // precedes the seat belongs to the letter before it, what follows belongs to
  // the sign on it. With the kashida present there is nothing to infer, however
  // the two vowels are drawn — this used to ask whether both sat above the line,
  // which was the right question only while the seat was missing.
  const borne = /\u0640[\u064B-\u065F\u0670]*\u0654/u.test(w)
  console.log(`  ${r}`)
  console.log(`     now    ${JSON.stringify(w)}  ${cp(w)}`)
  console.log(`     oracle ${JSON.stringify(o)}  ${cp(o)}`)
  console.log(`     kashida seats the hamzah: ${borne ? 'YES — ownership is stated, nothing to infer' : 'no — still unrecoverable from the file'}`)
  if (w && o && w === o) console.log('     byte-identical to the oracle')
}

// ------------------------------------------------- 3. does PR #9's rule still hold
line('3. PR #9 RE-VERIFIED AGAINST THE CORRECTED TEXT')
function oracleAssignment(text) {
  const a = [...text], out = []
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== 'ـ') continue
    let j = i + 1
    while (j < a.length && isMark(a[j]) && a[j] !== 'ٔ') j++
    if (a[j] !== 'ٔ') continue
    let b = i - 1
    while (b >= 0 && isMark(a[b])) b--
    let k = j + 1
    const after = []
    while (k < a.length && isMark(a[k])) { after.push(a[k]); k++ }
    out.push({ bearer: a.slice(b + 1, i).filter(isVowel).join(''), hamza: after.filter(isVowel).join('') })
  }
  return out
}
let checked = 0, agreed = 0
const disagreed = []
for (const r of refs) {
  if (R[r] === undefined) continue
  const o = oracleAssignment(L[r])
  if (!o.length) continue
  // The engine's own answer, read back out of the normalised string.
  const same = normalize(L[r]).text === normalize(R[r]).text
  checked += o.length
  if (same) agreed += o.length
  else disagreed.push(r)
}
console.log(`hamzas the oracle spells out around a tatweel : ${checked}`)
console.log(`  of those, in ayahs that normalise alike     : ${agreed}`)
console.log(`  of those, in ayahs that do not              : ${checked - agreed}`)
console.log(`  the ayahs, by reference (${[...new Set(disagreed)].length}) : ${[...new Set(disagreed)].join(' ') || '(none)'}`)
// Hamzas and ayahs are different units and were once printed as though they
// were the same: 4:92 carries two borne hamzas, so 486 + 8 looked like an
// off-by-one against 495 and was two counts of different things.
console.log(`\nIf this list is empty, PR #9's rule still agrees with the oracle everywhere`)
console.log(`and needs no change. If the corrected data records ownership directly, the`)
console.log(`rule may be simplifiable — that is a judgement, not something this prints.`)

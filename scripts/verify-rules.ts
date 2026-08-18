/**
 * Checks rules against the mushaf.
 *
 *   pnpm rules:verify
 *
 * A new rule that compiles and matches something looks exactly like a new rule
 * that compiles and matches the wrong thing. So each one is pinned to passages
 * whose ruling is not in dispute — الضالين for المد اللازم الكلمي المثقل, آلآن
 * for المخفف, الحروف المقطعة for الحرفي — and to passages where it must stay
 * silent.
 *
 * Where a rule's total is known in advance, the total is asserted too. المد
 * اللازم الكلمي المخفف occurs in exactly two places in the Quran; a pattern that
 * finds three has found something that is not it.
 *
 * Requires editions/uthmani-hafs.json. Exits non-zero on any failure.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed, sliceSpan } from '../packages/core/src/engine.js'
import type { Edition } from '../packages/core/src/edition.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const edition = JSON.parse(
  readFileSync(join(here, '..', 'editions', 'uthmani-hafs.json'), 'utf8'),
) as Edition
const typed = corpus as unknown as Corpus

interface Expectation {
  readonly rule: string
  /** Ayahs the rule must match. */
  readonly matches: readonly string[]
  /** More ayahs the rule must match, kept separate only to be commented on. */
  readonly matchesAlso?: readonly string[]
  /** Ayahs the rule must not match. */
  readonly avoids?: readonly string[]
  /** Exact number of ayahs the rule may match across the whole mushaf. */
  readonly exactlyAyahs?: number
  /** Exact number of occurrences across the whole mushaf. */
  readonly exactlyOccurrences?: number
  readonly why: string
}

const EXPECTATIONS: readonly Expectation[] = [
  {
    rule: 'madd-lazim-kalimi-muthaqqal.1',
    matches: ['1:7', '69:1', '79:34', '80:33', '2:164'],
    avoids: ['1:1', '1:2'],
    why: 'ٱلضَّآلِّينَ، ٱلۡحَآقَّةُ، ٱلطَّآمَّةُ، ٱلصَّآخَّةُ، دَآبَّةٍ — ألف مدية يليها حرف مشدد',
  },
  {
    rule: 'madd-lazim-kalimi-mukhaffaf.1',
    matches: ['10:51', '10:91'],
    exactlyAyahs: 2,
    why: 'ءَآلۡـَٰٔنَ، ولا يقع هذا المد في القرآن في غير هذين الموضعين',
  },
  {
    rule: 'madd-lazim-harfi.1',
    matches: ['2:1', '3:1', '19:1', '36:1', '42:2', '50:1', '68:1'],
    // طه: هجاء الطاء والهاء حرفان لا مد فيهما، فلا مد لازم في فاتحتها.
    avoids: ['20:1', '1:1'],
    exactlyOccurrences: 44,
    why: 'فواتح السور التي هجاء حروفها ثلاثة أحرف أوسطها مد',
  },
  {
    rule: 'qalqalah-kubra.1',
    matches: ['112:1', '112:2', '112:3', '112:4', '111:1'],
    // Neither ends in a qalqalah letter.
    avoids: ['1:1', '1:7'],
    why: 'أَحَدٌ، ٱلصَّمَدُ، يُولَدْ، وَتَبَّ — حرف قلقلة في آخر الآية، والوقف على رؤوس الآي سنة',
  },
  {
    rule: 'qalqalah-sughra.1',
    matches: ['96:1', '2:27'],
    // 20:1 طه and 26:1 طسٓمٓ are letter names — ṭā-hā, ṭā-sīn-mīm — with no
    // sakin ṭāʾ in either. 27:22 أَحَطتُ is إدغام ناقص: the ṭāʾ merges into the
    // tāʾ and is never released, so there is nothing to qalqalah.
    avoids: ['1:1', '20:1', '26:1', '27:22'],
    exactlyOccurrences: 2923,
    why: 'ٱقۡرَأۡ، يَقۡطَعُونَ — حرف قلقلة ساكن في وسط الكلمة غير مدغم',
  },
  {
    rule: 'qalqalah-mutatarrifa.1',
    matches: ['112:3', '2:60', '2:65'],
    // Vowelled at the end of a word: qalqalah only if the reciter stops, which
    // is a choice rather than a property of the text. 1:7 ends صِرَٰطَ … ٱلۡمَغۡضُوبِ
    // and 112:1 ends أَحَدٌ; none of them is qalqalah when continuing.
    // 11:42 ٱرۡكَب مَّعَنَا is إدغام متجانسين and 2:256 قَد تَّبَيَّنَ إدغام: the
    // letter is merged into the next word, not released. 50:1 قٓ and 42:2 عٓسٓقٓ
    // are read qāf, with a long alef and no sakin qāf anywhere in them.
    avoids: ['1:7', '112:1', '111:1', '1:1', '11:42', '2:256', '50:1', '42:2'],
    // Written bare because the ayah ends there, but genuinely sakin — فَٱرۡغَبۡ
    // is an imperative. Guards the fix above against over-correcting.
    matchesAlso: ['94:8', '96:19'],
    exactlyOccurrences: 494,
    why: 'لَمْ يَلِدْ وَلَمْ يُولَدْ — حرف قلقلة ساكن في آخر الكلمة غير مدغم',
  },
  {
    rule: 'madd-lazim-kalimi-muthaqqal.2',
    matches: ['6:80', '39:64'],
    exactlyOccurrences: 2,
    why: 'أَتُحَٰٓجُّوٓنِّي، تَأۡمُرُوٓنِّيٓ — واو مدية يليها حرف مشدد',
  },
  {
    rule: 'madd-lazim-kalimi-muthaqqal.3',
    matches: [],
    // بِأَييِّكُمُ is the only place a yaa precedes a shadda this way, and its
    // yaa follows a fatha and carries no maddah — a written second yaa, not a
    // madd letter. This madd does not occur with yaa in the Quran.
    avoids: ['68:6'],
    exactlyOccurrences: 0,
    why: 'ياء مدية يليها حرف مشدد — لا يقع في القرآن',
  },
  {
    rule: 'raa-tarqeeq.5',
    matches: ['11:41'],
    // Ordinary reh, tafkheem or tarqeeq by its own vowel, never imāla.
    avoids: ['1:1', '1:7'],
    exactlyOccurrences: 1,
    why: 'الراء الممالة مرققة، ولا إمالة لحفص إلا في هود ٤١',
  },
  {
    rule: 'raa-tafkheem.3',
    matches: [],
    // Two consecutive sakins do not occur in continuous recitation, so this rule
    // describes a shape the joined text does not contain. Its one match before
    // this change was the imāla reh of 11:41, which normalisation was reading as
    // sakin — see docs/divergences.md.
    avoids: ['11:41'],
    exactlyOccurrences: 0,
    why: 'راء ساكنة قبلها ساكن صحيح — لا تقع في الوصل، وإنما عند الوقف',
  },
]

let failures = 0

function fail(message: string): void {
  console.error(`  ✗ ${message}`)
  failures += 1
}

/**
 * One engine for all the rules under test, rather than one per rule: `analyze`
 * normalises each ayah once and then runs every rule over it, so building six
 * engines would normalise the whole mushaf six times.
 */
const engine = new Tajweed(typed, { only: EXPECTATIONS.map((expectation) => expectation.rule) })

interface Observed {
  ayahs: string[]
  occurrences: number
  samples: string[]
}

const observed = new Map<string, Observed>(
  EXPECTATIONS.map((expectation) => [expectation.rule, { ayahs: [], occurrences: 0, samples: [] }]),
)

for (const [reference, ayahText] of Object.entries(edition.ayahs)) {
  const byRule = new Map<string, number>()
  for (const span of engine.analyze(ayahText)) {
    const seen = observed.get(span.ruleId)
    if (!seen) {
      continue
    }
    if (!byRule.has(span.ruleId)) {
      byRule.set(span.ruleId, 1)
      seen.ayahs.push(reference)
      if (seen.samples.length < 5) {
        seen.samples.push(`${reference} “${sliceSpan(ayahText, span)}”`)
      }
    }
    seen.occurrences += 1
  }
}

for (const expectation of EXPECTATIONS) {
  if (!engine.rules.some((rule) => rule.id === expectation.rule)) {
    fail(`${expectation.rule}: not found in the corpus`)
    continue
  }

  const { ayahs: matchedAyahs, occurrences, samples } = observed.get(expectation.rule)!
  const matched = new Set(matchedAyahs)
  console.log(`\n${expectation.rule}`)
  console.log(`  ${expectation.why}`)
  console.log(`  ${occurrences} occurrences in ${matchedAyahs.length} ayahs`)
  for (const sample of samples) {
    console.log(`    ${sample}`)
  }

  for (const reference of [...expectation.matches, ...(expectation.matchesAlso ?? [])]) {
    if (!matched.has(reference)) {
      fail(`${expectation.rule}: expected a match at ${reference}, found none`)
    }
  }
  for (const reference of expectation.avoids ?? []) {
    if (matched.has(reference)) {
      fail(`${expectation.rule}: expected no match at ${reference}, found one`)
    }
  }
  if (expectation.exactlyAyahs !== undefined && matchedAyahs.length !== expectation.exactlyAyahs) {
    fail(
      `${expectation.rule}: expected exactly ${expectation.exactlyAyahs} ayahs, ` +
        `found ${matchedAyahs.length} (${matchedAyahs.slice(0, 12).join(', ')})`,
    )
  }
  if (expectation.exactlyOccurrences !== undefined && occurrences !== expectation.exactlyOccurrences) {
    fail(
      `${expectation.rule}: expected exactly ${expectation.exactlyOccurrences} occurrences, ` +
        `found ${occurrences}`,
    )
  }
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log(`all ${EXPECTATIONS.length} pinned rules behave as expected`)

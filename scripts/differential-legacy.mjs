/**
 * Re-runs the differential against the legacy PHP engine.
 *
 *   node scripts/differential-legacy.mjs [--rules spreadsheet|deployed]
 *                                       [--spans] [--no-trailing] [--start-from]
 *                                       [--edition <path>] [--annotations <path>]
 *
 * Run this when the text base moves — the quran-text migration is the next one —
 * or when a rule changes and you want to know whether it moved away from the
 * implementation this engine was ported from. It needs `php` on PATH and nothing
 * else; there is no database and no Laravel.
 *
 * WHY THIS EXISTS AS A SCRIPT AND NOT AS A NOTE
 *
 * The oracle is recoverable but not obvious, and two traps sit in front of it.
 * Anyone rebuilding this from scratch will hit both and get different numbers.
 *
 *   TRAP 1 — the obvious sources are not independent. qaws-net/tajweed holds
 *   resources/tajweed/rules.json (a copy of our corpus) and
 *   resources/tajweed/annotations.json (OUR ENGINE'S OUTPUT, imported by
 *   `php artisan tajweed:import-annotations`). So is the production database:
 *   tajweed_ayah_spans has 147,255 rows, which is our published span count,
 *   because it was populated from our file. Comparing against any of them
 *   compares our output to itself. It agrees, and the agreement means nothing.
 *   The only independent oracle is the matching engine that was deleted in
 *   5ea1f79 — see conformance/legacy/matcher.php.
 *
 *   TRAP 2 — the two span files look 100% different when they are 83% identical.
 *   The legacy engine reports BYTE offsets (PHP strlen, PREG_OFFSET_CAPTURE).
 *   This engine reports CODE POINT offsets. Diff them naively and you get zero
 *   agreement on 147,000 spans and conclude the port is broken. It is not; the
 *   units differ. convertToCodePoints below is the whole fix.
 *
 * WHICH RULE TABLE IS THE ORACLE
 *
 * There are two, and they are not the same. `--rules spreadsheet` (the default)
 * uses the authored spreadsheet, which is what a rule was *meant* to say.
 * `--rules deployed` uses the table the legacy engine actually ran with in
 * production, which for eight rules had been hand-edited in the database and the
 * spreadsheet never updated to match. Use `deployed` to ask "did we faithfully
 * port what was running"; use `spreadsheet` to ask "does a rule still say what
 * its author wrote". Both are legitimate questions and they have different
 * answers. See docs/divergences.md.
 *
 * CONTROL OUTPUT
 *
 * Measured at f6ecb27 on editions/uthmani-hafs.json. An instrument that cannot
 * reproduce a known result cannot be trusted on an unknown one, so if these
 * numbers do not come back, stop and find out why before believing anything else
 * it says.
 *
 *   --rules deployed            exact agreement  147 / 154
 *
 *     The seven that differ are every deliberate change this engine has made:
 *       167 madd-muttasil.2    onlyOurs 54,  onlyLegacy 0
 *       168 madd-muttasil.3    onlyOurs 25,  onlyLegacy 7
 *       172 madd-munfasil.4    onlyOurs 73,  onlyLegacy 3   } the madd corrections
 *       8   tafkheem-rank-4-jazari.1     onlyLegacy 9   }
 *       145 izhar-shafawi-meem.1         onlyLegacy 2   } stopped misreading
 *       117 idgham-bi-ghunnah-noon.1     onlyLegacy 1   } الحروف المقطعة
 *       129 idgham-naqis-noon.1          onlyLegacy 1   }
 *
 *   --rules spreadsheet         exact agreement  139 / 154
 *
 *     The extra eight are NOT ours. seven-alefs.1-.6, seven-alefs-khulf.1 and
 *     raa-either-permissible.2 were hand-edited in the legacy database in Feb
 *     2026 and the workbook was never updated. Our corpus carries the database
 *     value, so against `deployed` they agree and against `spreadsheet` they do
 *     not. If you are asking "is the port faithful", `deployed` is your number.
 *
 *   --rules spreadsheet --spans
 *     identical    90,234      only ours  46,330      only legacy  45,399
 *
 *   --rules spreadsheet --spans --no-trailing
 *     identical   122,254      only ours  14,310      only legacy  13,379
 *
 *     The jump from 90,234 to 122,254 is the whole point of --no-trailing: it
 *     turns off the legacy trailing-diacritic walk (commit 36456fa) and shows
 *     that most span disagreement is that one rendering decision, not tajweed.
 *     The ~14,000 that remain "only ours" are highlights the legacy engine
 *     computed and then failed to render — a repair, NOT over-matching. See
 *     "The legacy engine reported rulings it then failed to highlight" in
 *     docs/divergences.md before reading that number as a regression.
 *
 * WHY "comparable" IS 154 AND NOT 164
 *
 * 182 corpus rules, minus 18 the legacy engine never ran (its
 * ExcludeUnprocessedRulesScope, which our corpus mirrors as status "disabled"),
 * minus 8 authored here with no legacy counterpart, minus 2 hand-inserted into
 * the legacy database with no spreadsheet row (raa-either-permissible.3/.4).
 * 164 is the count of *enabled* rules and is the wrong denominator.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = new URL('.', import.meta.url)
const at = (p) => new URL(p, HERE).pathname

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

const EDITION = flag('edition', at('../editions/uthmani-hafs.json'))
const ANNOTATIONS = flag('annotations', at('../packages/annotations/uthmani-hafs.json'))
const TABLE = flag('rules', 'spreadsheet')
const WITH_SPANS = argv.includes('--spans')

const LEGACY_MAP = at('../conformance/legacy/legacy-id-map.json')
const RUNNER = at('../conformance/legacy/run.php')
const START_FROM = at('../conformance/legacy/start-from.php')

// --start-from answers a different question from the rest of this script: not
// "do we match what the legacy engine matched" but "should a span be as long as
// the match". See conformance/legacy/start-from.php and
// docs/legacy-audit-questions.md.
if (argv.includes('--start-from')) {
  execFileSync('php', ['-d', 'memory_limit=4G', START_FROM, EDITION], { stdio: ['ignore', 'inherit', 'inherit'] })
  process.exit(0)
}

/** The 18 the legacy engine's global scope suppressed. Mirrored as "disabled". */
const EXCLUDED = new Set([4, 5, 13, 16, 19, 20, 29, 30, 34, 35, 40, 42, 43, 73, 74, 75, 76, 142])
/** Legacy ids with no spreadsheet row — hand-inserted, no pattern to run. */
const NO_SHEET_ROW = new Set([173, 174])

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))

/**
 * Byte offsets to code point offsets. See TRAP 2.
 *
 * Built per ayah rather than by a global rule, because the map depends entirely
 * on which characters that ayah contains — Arabic letters are two bytes, the
 * ornate marks are three, and a wrong assumption here is silent.
 */
function convertToCodePoints(text, spans) {
  const byteToCp = new Map()
  let byte = 0
  let cp = 0
  for (const ch of text) {
    byteToCp.set(byte, cp)
    byte += Buffer.byteLength(ch, 'utf8')
    cp += 1
  }
  byteToCp.set(byte, cp)
  const out = []
  for (const [s, e] of spans) {
    const a = byteToCp.get(s)
    const b = byteToCp.get(e)
    // A span that does not land on a character boundary means the two sides
    // disagree about the text itself, not about tajweed. Never silently drop it.
    if (a === undefined || b === undefined) {
      throw new Error(`span [${s},${e}] is not on a character boundary — the edition does not match what the legacy engine was run on`)
    }
    out.push([a, b])
  }
  return out
}

function runLegacy() {
  const dir = mkdtempSync(join(tmpdir(), 'differential-'))
  const out = join(dir, 'legacy.json')
  try {
    execFileSync('php', ['-d', 'memory_limit=4G', RUNNER, EDITION, out, '--rules', TABLE, ...(argv.includes('--no-trailing') ? ['--no-trailing'] : [])], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    return read(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const edition = read(EDITION).ayahs
const annotations = read(ANNOTATIONS)
const legacyIds = read(LEGACY_MAP).rules
const slugToLegacy = new Map(Object.entries(legacyIds))
const legacyToSlug = new Map([...slugToLegacy].map(([k, v]) => [v, k]))

const comparable = new Set()
for (const [slug, id] of slugToLegacy) {
  if (!EXCLUDED.has(id) && !NO_SHEET_ROW.has(id) && annotations.ruleIds.includes(slug)) {
    comparable.add(id)
  }
}

const legacy = runLegacy()

// ---- ours, keyed by legacy id ----
const oursAyahs = new Map()
const oursSpans = new Map()
for (const [ref, spans] of Object.entries(annotations.spans)) {
  for (const [start, end, ruleIndex] of spans) {
    const id = slugToLegacy.get(annotations.ruleIds[ruleIndex])
    if (!comparable.has(id)) continue
    if (!oursAyahs.has(id)) oursAyahs.set(id, new Set())
    oursAyahs.get(id).add(ref)
    const key = `${ref}|${id}`
    if (!oursSpans.has(key)) oursSpans.set(key, new Set())
    oursSpans.get(key).add(`${start},${end}`)
  }
}

const theirsAyahs = new Map()
for (const [ref, ids] of Object.entries(legacy.ayah)) {
  for (const id of ids) {
    if (!comparable.has(Number(id))) continue
    if (!theirsAyahs.has(Number(id))) theirsAyahs.set(Number(id), new Set())
    theirsAyahs.get(Number(id)).add(ref)
  }
}

const diff = (a = new Set(), b = new Set()) => ({
  both: [...a].filter((x) => b.has(x)).length,
  onlyOurs: [...a].filter((x) => !b.has(x)).length,
  onlyTheirs: [...b].filter((x) => !a.has(x)).length,
})

console.log(`\n=== ayah level — ours vs the legacy engine (${TABLE} rule table) ===`)
const moved = []
for (const id of [...comparable].sort((x, y) => x - y)) {
  const d = diff(oursAyahs.get(id), theirsAyahs.get(id))
  if (d.onlyOurs || d.onlyTheirs) moved.push([id, d])
}
console.log(`exact agreement: ${comparable.size - moved.length} / ${comparable.size} comparable rules`)
for (const [id, d] of moved.sort((a, b) => b[1].onlyOurs + b[1].onlyTheirs - (a[1].onlyOurs + a[1].onlyTheirs))) {
  console.log(
    `  ${String(id).padEnd(5)} ${legacyToSlug.get(id).padEnd(34)} both=${String(d.both).padEnd(6)} onlyOurs=${String(d.onlyOurs).padEnd(5)} onlyLegacy=${d.onlyTheirs}`,
  )
}

if (WITH_SPANS) {
  let identical = 0
  let onlyOurs = 0
  let onlyTheirs = 0
  for (const [ref, byRule] of Object.entries(legacy.spans)) {
    for (const [id, spans] of Object.entries(byRule)) {
      if (!comparable.has(Number(id))) continue
      const theirs = new Set(convertToCodePoints(edition[ref], spans).map(([s, e]) => `${s},${e}`))
      const ours = oursSpans.get(`${ref}|${id}`) ?? new Set()
      for (const s of ours) (theirs.has(s) ? identical++ : onlyOurs++)
      for (const s of theirs) if (!ours.has(s)) onlyTheirs++
    }
  }
  console.log('\n=== span level (legacy byte offsets converted to code points) ===')
  console.log(`identical   : ${identical}`)
  console.log(`only ours   : ${onlyOurs}   <- mostly legacy's own missing highlights, see docs/divergences.md`)
  console.log(`only legacy : ${onlyTheirs}   <- mostly legacy's greedy trailing-mark extension`)
}

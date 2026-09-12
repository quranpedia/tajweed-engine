/**
 * Runs the engine over a text edition once and writes the offsets.
 *
 *   pnpm annotate editions/uthmani-hafs.json
 *
 * The edition file holds Quranic text and stays local. The output holds offsets
 * and a digest of the text they refer to, and is the thing that gets committed
 * and released.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import corpus from '../packages/rules/rules.json' with { type: 'json' }
import { Tajweed } from '../packages/core/src/engine.js'
import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'
import { sameRiwayah } from '../packages/core/src/aliases.js'
import type { Annotations, PackedSpan } from '../packages/core/src/annotations.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))

const editionPath = process.argv[2]
if (!editionPath) {
  console.error('usage: pnpm annotate <edition.json> [out.json]')
  process.exit(1)
}

const edition = JSON.parse(readFileSync(resolve(editionPath), 'utf8')) as Edition
const typed = corpus as unknown as Corpus

if (!sameRiwayah(edition.riwayah, typed.riwayah)) {
  // Both the rulings and the orthography differ between riwayat, so this is a
  // data error rather than a warning to be stepped over.
  //
  // Compared through the alias table rather than by string equality: the same
  // riwayah is written `hafs-an-asim` here and `hafs_an_asim` in the guidelines,
  // and an edition is not wrong for using either.
  console.error(
    `Refusing to annotate: the corpus is ${typed.riwayah} but the edition is ${edition.riwayah}.`,
  )
  process.exit(1)
}

const engine = new Tajweed(typed)
const ruleIds = engine.rules.map((rule) => rule.id)
const ruleIndex = new Map(ruleIds.map((id, index) => [id, index]))

const references = orderedReferences(edition)
const spans: Record<string, PackedSpan[]> = {}

let total = 0
let annotatedAyahs = 0

for (const reference of references) {
  const found = engine.analyze(edition.ayahs[reference]!)
  if (found.length === 0) {
    continue
  }

  spans[reference] = found.map((span) => [span.start, span.end, ruleIndex.get(span.ruleId)!])
  total += found.length
  annotatedAyahs += 1
}

const annotations: Annotations = {
  corpusVersion: typed.version,
  riwayah: typed.riwayah,
  edition: {
    id: edition.id,
    sha256: await editionDigest(edition),
    ayahCount: references.length,
  },
  ruleIds,
  spans,
}

const outPath = resolve(process.argv[3] ?? join(here, '..', 'data', `${edition.id}.annotations.json`))
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(annotations)}\n`, 'utf8')

const bytes = Buffer.byteLength(JSON.stringify(annotations))
console.log(
  `wrote ${outPath}\n` +
    `  edition ${edition.id} sha256 ${annotations.edition.sha256.slice(0, 16)}…\n` +
    `  ${total.toLocaleString()} spans across ${annotatedAyahs.toLocaleString()} of ` +
    `${references.length.toLocaleString()} ayahs, ${ruleIds.length} rules\n` +
    `  ${(bytes / 1024 / 1024).toFixed(1)} MB`,
)

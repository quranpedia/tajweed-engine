/**
 * Converts a text source into the edition format the engine reads.
 *
 *   pnpm make-edition input.json out/my-edition.json --id my-uthmani
 *
 * Quran text arrives in a handful of shapes depending on where it came from, and
 * all of them are trivially convertible — this exists so that converting is not
 * a step people write themselves, badly, with a `.trim()` in it.
 *
 * The text is copied through untouched. No trimming, no normalising, no
 * re-encoding: a transformation applied here would be invisible and would move
 * every offset computed afterwards.
 *
 * Recognised inputs:
 *
 *   { "1:1": "…", "1:2": "…" }                        a flat reference map
 *   [ { "surah": 1, "ayah": 1, "text": "…" }, … ]      a list of records
 *   [ { "chapter": 1, "verse": 1, "text": "…" }, … ]   the same, named differently
 *   { "1": { "1": "…" } }                             nested by surah
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'

const [inputPath, outputPath, ...rest] = process.argv.slice(2)

if (!inputPath || !outputPath) {
  console.error('usage: pnpm make-edition <input.json> <out.json> [--id <id>] [--riwayah <riwayah>]')
  process.exit(1)
}

function flag(name: string, fallback: string): string {
  const index = rest.indexOf(`--${name}`)
  return index === -1 ? fallback : (rest[index + 1] ?? fallback)
}

const raw: unknown = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
const ayahs: Record<string, string> = {}

function put(surah: unknown, ayah: unknown, text: unknown): void {
  const reference = `${Number(surah)}:${Number(ayah)}`
  if (typeof text !== 'string' || !Number.isFinite(Number(surah)) || !Number.isFinite(Number(ayah))) {
    throw new Error(`Could not read a record at ${reference}.`)
  }
  ayahs[reference] = text
}

if (Array.isArray(raw)) {
  for (const record of raw as Array<Record<string, unknown>>) {
    put(
      record['surah'] ?? record['chapter'] ?? record['sura'] ?? record['surah_number'],
      record['ayah'] ?? record['verse'] ?? record['aya'] ?? record['ayah_number'],
      record['text'] ?? record['arabic'] ?? record['ayah_text'],
    )
  }
} else if (raw && typeof raw === 'object') {
  const entries = Object.entries(raw as Record<string, unknown>)
  const nested = entries.every(([, value]) => value !== null && typeof value === 'object')

  if (nested) {
    for (const [surah, verses] of entries) {
      for (const [ayah, text] of Object.entries(verses as Record<string, unknown>)) {
        put(surah, ayah, text)
      }
    }
  } else {
    for (const [reference, text] of entries) {
      const [surah, ayah] = reference.split(':')
      put(surah, ayah, text)
    }
  }
} else {
  throw new Error('Unrecognised input. Expected an object or an array of records.')
}

const edition: Edition = {
  id: flag('id', 'custom-uthmani'),
  riwayah: flag('riwayah', 'hafs-an-asim'),
  script: flag('script', 'uthmani'),
  ayahs,
}

const references = orderedReferences(edition)
if (references.length === 0) {
  throw new Error('No ayahs were read from the input.')
}

const out = resolve(outputPath)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(edition, null, 2)}\n`, 'utf8')

console.log(
  `wrote ${out}\n` +
    `  ${references.length} ayahs, ${references[0]} … ${references[references.length - 1]}\n` +
    `  sha256 ${await editionDigest(edition)}\n\n` +
    'Next: pnpm edition:check ' +
    outputPath,
)

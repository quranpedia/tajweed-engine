/**
 * Builds an edition from quran-ws/quran-text.
 *
 *   pnpm import:quran-text                       # from https://text.quran.ws
 *   pnpm import:quran-text --from ../quran-text  # from a local checkout
 *
 * quran-text is where the Qurʾānic text in this organisation comes from: seven
 * printed muṣḥafs taken unedited from the KFGQPC digital packages, each file
 * naming the package it was read from and that package's SHA-256. This script
 * exists so that the text this repository annotates has that provenance too,
 * instead of arriving from somewhere nobody can name.
 *
 * What it writes is the text exactly as quran-text serves it. Nothing is
 * trimmed, normalised or re-encoded on the way through: every transformation
 * belongs in the normaliser, where it is visible in the offset map, and none
 * belongs here, where it would silently move every offset computed afterwards.
 *
 * The provenance recorded in the output is quran-text's own, copied verbatim —
 * the KFGQPC package, its digest, and the dataset date — so a consumer can
 * follow the chain from a span back to a printed muṣḥaf without taking this
 * repository's word for any link in it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { editionDigest, orderedReferences, type Edition } from '../packages/core/src/edition.js'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)

function flag(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? undefined : argv[index + 1]
}

const SERVICE = flag('service') ?? 'https://text.quran.ws'
const EDITION = flag('edition') ?? 'hafs'
const RIWAYAH = flag('riwayah') ?? 'hafs-an-asim'
const from = flag('from')
const output = flag('out') ?? join(here, '..', 'editions', `${EDITION}-quran-text.json`)

/** What quran-text publishes about where one of its muṣḥafs came from. */
interface QuranTextProvenance {
  readonly package?: string
  readonly member?: string
  readonly release_year?: number
  readonly sha256?: string
}

interface Imported {
  readonly ayahs: Record<string, string>
  readonly dataset?: string
  readonly provenance?: QuranTextProvenance
  readonly fileDigest?: string
  readonly read: string
}

/**
 * From the service. The download endpoint already returns waqf, sajdah and
 * division marks inside the ayah text, which is the form the muṣḥaf prints and
 * the form the annotations have to describe — an ayah stripped of them is a
 * different string, and every offset in it is a different number.
 */
async function fromService(): Promise<Imported> {
  const versionUrl = `${SERVICE}/version`
  const downloadUrl = `${SERVICE}/download?edition=${EDITION}&format=json`

  const [versionResponse, downloadResponse] = await Promise.all([fetch(versionUrl), fetch(downloadUrl)])
  for (const [url, response] of [
    [versionUrl, versionResponse],
    [downloadUrl, downloadResponse],
  ] as const) {
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status} ${response.statusText}.`)
    }
  }

  const version = (await versionResponse.json()) as {
    dataset?: string
    editions?: Record<string, { source?: string; source_sha256?: string; file?: string; file_sha256?: string }>
  }
  const download = (await downloadResponse.json()) as {
    meta?: { source?: QuranTextProvenance }
    ayahs?: Array<{ surah: number; ayah: number; text: string }>
  }

  if (!download.ayahs?.length) {
    throw new Error(`${downloadUrl} returned no ayahs.`)
  }

  const ayahs: Record<string, string> = {}
  for (const record of download.ayahs) {
    ayahs[`${record.surah}:${record.ayah}`] = record.text
  }

  return {
    ayahs,
    dataset: version.dataset,
    provenance: download.meta?.source,
    fileDigest: version.editions?.[EDITION]?.file_sha256,
    read: downloadUrl,
  }
}

/**
 * From a checkout. `data/mushaf/<edition>.json` stores words rather than ayahs,
 * because a word number is what ties the seven muṣḥafs together — so an ayah is
 * its slice of that array, joined by the single space that separates words.
 *
 * The waqf, sajdah and division signs are not in those words; they are a
 * separate layer of `[word index, mark type]` pairs. They have to be put back,
 * because the muṣḥaf prints them and an ayah without them is a different string
 * in which every offset is a different number — reading the words alone gives a
 * text whose digest is 66aeabcb…, not the a347fc57… the service serves.
 *
 * Two conventions, both taken from the served text rather than assumed: a mark
 * whose side is `after` is appended to its word with no space, and one whose
 * side is `before` — in Ḥafṣ only ۞ — is separated from it by a space. With
 * both, all 6,236 rebuilt ayahs are byte-identical to the service's.
 */
function fromCheckout(directory: string): Imported {
  const path = join(resolve(directory), 'data', 'mushaf', `${EDITION}.json`)
  const mushaf = JSON.parse(readFileSync(path, 'utf8')) as {
    generated?: string
    provenance?: { text?: QuranTextProvenance }
    words: string[]
    ayah_starts: number[]
    surahs: Array<{ number: number; ayah_count: number }>
    marks?: Array<readonly [word: number, type: number]>
    mark_types?: Array<{ side?: string; sign?: string }>
  }

  const references: string[] = []
  for (const surah of mushaf.surahs) {
    for (let ayah = 1; ayah <= surah.ayah_count; ayah++) {
      references.push(`${surah.number}:${ayah}`)
    }
  }
  if (references.length !== mushaf.ayah_starts.length) {
    throw new Error(
      `${path} lists ${mushaf.ayah_starts.length} ayah starts but ${references.length} ayah numbers. ` +
        'One of the two is wrong, and guessing which would put every offset somewhere else.',
    )
  }

  const marksByWord = new Map<number, number[]>()
  for (const [word, type] of mushaf.marks ?? []) {
    const existing = marksByWord.get(word)
    if (existing) existing.push(type)
    else marksByWord.set(word, [type])
  }

  const ayahs: Record<string, string> = {}
  references.forEach((reference, index) => {
    const start = mushaf.ayah_starts[index]!
    const end = mushaf.ayah_starts[index + 1] ?? mushaf.words.length
    const words: string[] = []
    for (let position = start; position < end; position++) {
      let word = mushaf.words[position]!
      for (const type of marksByWord.get(position) ?? []) {
        const markType = mushaf.mark_types?.[type]
        if (!markType?.sign) {
          throw new Error(`${path} puts mark type ${type} on word ${position} but declares no sign for it.`)
        }
        word = markType.side === 'before' ? `${markType.sign} ${word}` : `${word}${markType.sign}`
      }
      words.push(word)
    }
    ayahs[reference] = words.join(' ')
  })

  return { ayahs, dataset: mushaf.generated, provenance: mushaf.provenance?.text, read: path }
}

const imported = from ? fromCheckout(from) : await fromService()

const edition: Edition = {
  id: `${EDITION}-quran-text`,
  riwayah: RIWAYAH,
  script: 'uthmani',
  source: {
    repository: 'quran-ws/quran-text',
    read: imported.read,
    dataset: imported.dataset,
    edition: EDITION,
    file_sha256: imported.fileDigest,
    kfgqpc: imported.provenance,
  },
  ayahs: imported.ayahs,
}

const references = orderedReferences(edition)
if (references.length === 0) {
  throw new Error('No ayahs were read.')
}

const out = resolve(output)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(edition, null, 2)}\n`, 'utf8')

console.log(
  `wrote ${out}\n` +
    `  ${references.length} ayahs, ${references[0]} … ${references[references.length - 1]}\n` +
    `  read from ${imported.read}\n` +
    `  KFGQPC package ${imported.provenance?.package ?? '(not declared)'} ` +
    `sha256 ${imported.provenance?.sha256 ?? '(not declared)'}\n` +
    `  edition sha256 ${await editionDigest(edition)}\n\n` +
    `Next: pnpm edition:check ${output}`,
)

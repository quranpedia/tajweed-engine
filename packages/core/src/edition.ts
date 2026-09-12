/**
 * Text editions, and why annotations are useless without naming one.
 *
 * A tajweed annotation is a pair of offsets into a specific string. Editions of
 * the Uthmani script that a reader would call identical are not identical as
 * data: they disagree about where a small high seen is placed, whether a hamza
 * is carried on a tatweel or written standalone, and how tanween is drawn at a
 * word end. Any of those shifts every offset after it.
 *
 * So an annotation set records the digest of the text it was computed against,
 * and a consumer checks its own copy against that digest before trusting a
 * single offset. Getting a mismatch is useful information; getting silently
 * wrong highlighting is not.
 */

export interface Edition {
  /** Stable identifier, e.g. `hafs-quran-text`. */
  readonly id: string
  readonly riwayah: string
  readonly script: string
  /**
   * Where this text came from.
   *
   * A sentence is accepted because some editions have nothing better, but a
   * sentence is not provenance: "legacy application export" names no file, no
   * release and no digest, and cannot be checked by anyone. Prefer the object
   * form, which records the repository, what was read, and the digest of the
   * package underneath it — see `scripts/import-quran-text.ts`.
   */
  readonly source?: string | Readonly<Record<string, unknown>>
  /** Ayah text keyed by `surah:ayah`. */
  readonly ayahs: Readonly<Record<string, string>>
}

/**
 * The bytes separating a reference from its text, and one ayah from the next, in
 * the canonical form.
 *
 * Control characters are used because neither can occur in a reference or in
 * Quranic text, so no pairing can be confused with another. They are written as
 * escapes rather than as literals: a raw NUL in source is invisible, and an
 * editor or formatter that quietly dropped one would change every digest this
 * function has ever produced without changing anything a reviewer could see.
 *
 * Any reimplementation must use the same two bytes — see the
 * tajweed:verify-annotations command in the tajweed application.
 */
const FIELD_SEPARATOR = '\u{0000}'
const RECORD_SEPARATOR = '\u{0001}'

/**
 * A digest of an edition's text, independent of how the file happens to be
 * formatted.
 *
 * Hashing the JSON file itself would make the digest depend on key order,
 * indentation and escaping, so re-serialising the same text would look like a
 * different edition. This hashes the content: each reference and its text, in
 * mushaf order, separated by characters that cannot occur in either.
 */
export async function editionDigest(edition: Edition): Promise<string> {
  const canonical = orderedReferences(edition)
    .map((reference) => `${reference}${FIELD_SEPARATOR}${edition.ayahs[reference]}`)
    .join(RECORD_SEPARATOR)

  const bytes = new TextEncoder().encode(canonical)
  const hash = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Ayah references in mushaf order, which is not the order JSON keys arrive in. */
export function orderedReferences(edition: Edition): string[] {
  return Object.keys(edition.ayahs).sort((a, b) => {
    const [surahA, ayahA] = a.split(':').map(Number)
    const [surahB, ayahB] = b.split(':').map(Number)
    return surahA! - surahB! || ayahA! - ayahB!
  })
}

export class EditionMismatchError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
    readonly editionId: string,
  ) {
    super(
      `Edition ${editionId} does not match the text these annotations were computed against.\n` +
        `  expected sha256 ${expected}\n` +
        `  actual   sha256 ${actual}\n` +
        'Offsets from these annotations would land in the wrong place. Regenerate them ' +
        'against this text, or obtain the edition the digest refers to.',
    )
  }
}

/** Throws unless `edition` is the exact text `expectedDigest` was taken from. */
export async function assertEdition(edition: Edition, expectedDigest: string): Promise<void> {
  const actual = await editionDigest(edition)
  if (actual !== expectedDigest) {
    throw new EditionMismatchError(expectedDigest, actual, edition.id)
  }
}

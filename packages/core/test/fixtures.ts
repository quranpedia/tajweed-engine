/**
 * Test input for the engine's public API.
 *
 * These are real ayahs, read from the edition in `editions/`, and referenced by
 * `surah:ayah` rather than written out.
 *
 * Not composed Arabic. An invented phrase standing in for Quranic text reads as
 * Quran to anyone who sees it — in a failure message, in a snapshot, in a demo —
 * and that is a worse problem than the one it avoids. Where a test needs to
 * exercise one specific mechanism rather than a whole passage, it builds its
 * input from named code points instead, which is unambiguous about what is being
 * tested and is not text at all.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import type { Edition } from '../src/edition.js'

const here = dirname(fileURLToPath(import.meta.url))

export const edition = JSON.parse(
  readFileSync(join(here, '..', '..', '..', 'editions', 'uthmani-hafs.json'), 'utf8'),
) as Edition

/** The text of one ayah, by reference. Throws rather than returning undefined. */
export function ayah(reference: string): string {
  const text = edition.ayahs[reference]
  if (text === undefined) {
    throw new Error(`${reference} is not in edition ${edition.id}.`)
  }
  return text
}

/**
 * Al-Fatiha 1:7 — long enough to carry many rulings at once, and it ends with
 * ٱلضَّآلِّينَ, the standard example of المد اللازم الكلمي المثقل.
 */
export const RICH_AYAH = '1:7'

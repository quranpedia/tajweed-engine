/**
 * The two encodings of the Uthmani script, read side by side.
 *
 * Editions of one riwayah that print identically are not identical as data.
 * They disagree about which characters draw tanween, whether a hamza rides a
 * tatweel or sits on its letter, and the order the marks stacked on a letter are
 * stored in. None of those is a difference in the text, and none of them may be
 * a difference in what the engine reads — a rule that fires on one edition and
 * not the other is a bug whichever edition it fires on.
 *
 * So every case here is written twice, once in each encoding, and asserted to
 * normalise to the same string. The failure these guard against is silent: a
 * mark the normaliser does not recognise is not an error, it is a rule that
 * quietly matches nothing.
 *
 * `editions/uthmani-hafs.json` is the first form; `editions/hafs-quran-text.json`,
 * built from the KFGQPC packages by way of quran-ws/quran-text, is the second.
 * The corpus-wide measurement is `pnpm edition:diff`.
 */

import { describe, expect, it } from 'vitest'

import { normalize } from '../src/normalize.js'
import {
  ALEF,
  DAMMA,
  FATHA,
  FATHATAN,
  HAMZA,
  HAMZA_ABOVE,
  KASRA,
  KASRATAN,
  LAM,
  OPEN_FATHATAN,
  OPEN_KASRATAN,
  QURANIC_SUKOON,
  SHADDA,
  SMALL_HIGH_MEEM,
  SUBSCRIPT_ALEF,
  SUKOON,
  SUPERSCRIPT_ALEF,
  TATWEEL,
  WAW,
  YEH,
} from '../src/unicode.js'

const BA = '\u{0628}'
const MEEM = '\u{0645}'
const NOON = '\u{0646}'

describe('tanween, drawn two ways', () => {
  it('reads the open tanween as the standalone tanween', () => {
    // Without this the whole tanween family — idghaam, ikhfaa, iqlab, izhar —
    // matches nothing at all on a KFGQPC-derived edition.
    expect(normalize(MEEM + OPEN_FATHATAN).text).toBe(normalize(MEEM + FATHATAN).text)
    expect(normalize(MEEM + OPEN_KASRATAN).text).toBe(normalize(MEEM + SUBSCRIPT_ALEF).text)
  })

  it('reads an iqlab written with a shadda between the haraka and the small meem', () => {
    const stacked = MEEM + FATHA + SHADDA + SMALL_HIGH_MEEM + ALEF
    const contiguous = MEEM + SHADDA + FATHA + SMALL_HIGH_MEEM + ALEF

    expect(normalize(stacked).text).toBe(normalize(contiguous).text)
    expect(normalize(stacked).text).toContain(FATHATAN)
  })
})

describe('a hamza, borne and unborne', () => {
  it('recovers a hamza written straight onto its letter', () => {
    // بِـَٔا against بَِٔا. The kasra is the letter's, the fatha is the hamza's,
    // and the second form writes the hamza's vowel first.
    const borne = BA + KASRA + TATWEEL + HAMZA_ABOVE + FATHA + ALEF
    const unborne = BA + FATHA + KASRA + HAMZA_ABOVE + ALEF

    expect(normalize(borne).text).toBe(normalize(unborne).text)
    expect(normalize(unborne).text).toContain(HAMZA)
  })

  it('leaves a vowel already written after the hamza where it is', () => {
    const borne = BA + FATHA + TATWEEL + HAMZA_ABOVE + QURANIC_SUKOON
    const unborne = BA + FATHA + HAMZA_ABOVE + QURANIC_SUKOON

    expect(normalize(borne).text).toBe(normalize(unborne).text)
  })

  it('reads a sukoon immediately before the hamza as the letter’s own', () => {
    // ٱلۡـَٰٔنَ: a sakin laam, then a hamza with a fatha and a long alef.
    const borne = LAM + QURANIC_SUKOON + TATWEEL + HAMZA_ABOVE + FATHA + SUPERSCRIPT_ALEF + NOON
    const unborne = LAM + FATHA + SUPERSCRIPT_ALEF + QURANIC_SUKOON + HAMZA_ABOVE + NOON

    expect(normalize(borne).text).toBe(normalize(unborne).text)
  })

  it('keeps the mapping non-decreasing when the hamza’s vowel is moved past it', () => {
    // The vowel is written before the hamza and read after it. A span built on a
    // decreasing map would have its end before its start.
    const result = normalize(BA + FATHA + KASRA + HAMZA_ABOVE + ALEF)
    for (let i = 1; i < result.srcStart.length; i++) {
      expect(result.srcStart[i]!).toBeGreaterThanOrEqual(result.srcStart[i - 1]!)
    }
  })
})

describe('marks stacked in either order', () => {
  it('does not read a long vowel after a shadda as a sakin consonant', () => {
    // ٱلدِّينِ. The muṣḥaf writes daal + shadda + kasra; quran-text writes daal +
    // kasra + shadda. Looking only at the character before the yeh finds the
    // kasra in one and the shadda in the other, and the second grew a sukoon.
    const mushafOrder = BA + SHADDA + KASRA + YEH + NOON
    const stackedOrder = BA + KASRA + SHADDA + YEH + NOON

    expect(normalize(mushafOrder).text).toBe(normalize(stackedOrder).text)
    expect(normalize(stackedOrder).text).not.toContain(YEH + SUKOON)
  })

  it('does the same for a waw after a damma', () => {
    expect(normalize(LAM + SHADDA + DAMMA + WAW + NOON).text).toBe(
      normalize(LAM + DAMMA + SHADDA + WAW + NOON).text,
    )
  })
})

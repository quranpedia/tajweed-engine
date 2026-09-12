/**
 * Unit tests for the normalisation passes.
 *
 * Inputs are assembled from the named code points in unicode.ts rather than
 * typed as Arabic. That is partly discipline — hand-typing text that appears in
 * the mushaf risks introducing a transposed mark that no reviewer would notice —
 * and partly precision: `ALEF + MADDAH_ABOVE` states which of the two visually
 * identical encodings of آ is under test, where the glyph would not.
 *
 * Behaviour over the real mushaf is covered by conformance/, which compares
 * against the engine these passes were ported from.
 */

import { describe, expect, it } from 'vitest'

import { normalize } from '../src/normalize.js'
import { sliceSpan } from '../src/engine.js'
import {
  ALEF,
  ALEF_HAMZA_ABOVE,
  ALEF_MADDA,
  ALEF_WASLA,
  BOM,
  DAMMA,
  DAMMATAN,
  FATHA,
  FATHATAN,
  HAMZA,
  HAMZA_ABOVE,
  IMALAH_MARK,
  IMALAH_MARK_KFGQPC,
  KASRA,
  KASRATAN,
  LAM,
  MADDAH_ABOVE,
  QURANIC_SUKOON,
  SHADDA,
  SMALL_HIGH_MEEM,
  SMALL_HIGH_SEEN,
  SUKOON,
  SUPERSCRIPT_ALEF,
  TATWEEL,
  WAW,
  YEH,
  ZWSP,
  INVERTED_DAMMA,
} from '../src/unicode.js'

const BA = '\u{0628}'
const TA = '\u{062A}'
const NOON = '\u{0646}'
const KAF = '\u{0643}'
const MEEM = '\u{0645}'
const REH = '\u{0631}'

const normalized = (text: string) => normalize(text).text

describe('normalize', () => {
  it('drops a byte order mark', () => {
    expect(normalized(BOM + BA + FATHA)).toBe(BA + FATHA)
  })

  it('folds the Quranic sukoon onto the standard one', () => {
    expect(normalized(BA + QURANIC_SUKOON)).toBe(BA + SUKOON)
  })

  it('composes a decomposed alef-madda, then folds it to a plain alef', () => {
    expect(normalized(BA + FATHA + ALEF + MADDAH_ABOVE)).toBe(BA + FATHA + ALEF)
    expect(normalized(BA + FATHA + ALEF_MADDA)).toBe(BA + FATHA + ALEF)
  })

  it('folds the superscript alef onto a plain alef', () => {
    expect(normalized(BA + SUPERSCRIPT_ALEF)).toBe(BA + ALEF)
  })

  it('leaves alef wasla distinct from alef', () => {
    // Alef wasla is a connective hamza, dropped when reciting continuously. If it
    // folded into a plain alef, every madd rule would fire on it.
    expect(normalized(ALEF_WASLA + LAM + SUKOON)).toContain(ALEF_WASLA)
    expect(normalized(ALEF_WASLA + LAM + SUKOON)).not.toContain(ALEF)
  })

  it('folds the Uthmani tanween marks onto the standard ones', () => {
    expect(normalized(BA + INVERTED_DAMMA)).toBe(BA + FATHATAN)
  })

  it('reads a haraka with a small high meem as tanween', () => {
    // How the mushaf draws iqlab: the meem records that the tanween is read as a
    // meem before a following ba, but the underlying mark is still tanween.
    expect(normalized(BA + DAMMA + SMALL_HIGH_MEEM)).toBe(BA + DAMMATAN)
    expect(normalized(BA + FATHA + SMALL_HIGH_MEEM)).toBe(BA + FATHATAN)
    expect(normalized(BA + KASRA + SMALL_HIGH_MEEM)).toBe(BA + KASRATAN)
  })

  it('recovers a hamza carried by a tatweel', () => {
    // Both the bearer and the combining hamza are stripped as decoration later,
    // so without this the consonant would vanish entirely.
    expect(normalized(BA + FATHA + TATWEEL + HAMZA_ABOVE)).toBe(BA + FATHA + HAMZA + SUKOON)
  })

  it('keeps a haraka sitting between the bearer and its hamza', () => {
    expect(normalized(TATWEEL + FATHA + HAMZA_ABOVE)).toBe(HAMZA + FATHA)
  })

  it('breaks the text at a saktah so no rule matches across it', () => {
    expect(normalized(NOON + SUKOON + SMALL_HIGH_SEEN + ' ' + BA)).toContain(ZWSP)
  })

  it('strips a small high seen inside a word, where it is only a spelling marker', () => {
    expect(normalized(BA + FATHA + SMALL_HIGH_SEEN + TA + FATHA)).toBe(BA + FATHA + TA + FATHA)
  })

  it('silences the written but unpronounced waw of the أُوْل demonstratives', () => {
    // Written in the Uthmani script, never recited — the same convention as the
    // alef of الصلوٰة. Its sukoon becomes a fatha so madd rules cannot see a sakin
    // waw after a damma.
    const written = ALEF_HAMZA_ABOVE + DAMMA + WAW + SUKOON + LAM
    // The lam picks up an implied sukoon of its own, being bare.
    expect(normalized(written)).toBe(ALEF_HAMZA_ABOVE + DAMMA + WAW + FATHA + LAM + SUKOON)
  })

  describe('implied sukoon', () => {
    it('is written onto a bare consonant', () => {
      expect(normalized(BA + FATHA + TA)).toBe(BA + FATHA + TA + SUKOON)
    })

    it('is not written onto a consonant that already has a diacritic', () => {
      expect(normalized(BA + FATHA)).toBe(BA + FATHA)
      expect(normalized(BA + SHADDA + FATHA)).toBe(BA + FATHA + SHADDA)
    })

    it('is not written onto the second half of a long vowel', () => {
      // A waw after a damma and a yeh after a kasra are vowels, not sakin
      // consonants that happen to have lost their mark.
      expect(normalized(BA + DAMMA + WAW)).toBe(BA + DAMMA + WAW)
      expect(normalized(BA + KASRA + YEH)).toBe(BA + KASRA + YEH)
    })

    it('is not written onto an alef, which is never sakin', () => {
      expect(normalized(BA + FATHA + ALEF)).toBe(BA + FATHA + ALEF)
    })

    it('is not written onto a letter carrying the imāla mark', () => {
      // The mark is the letter's vowel: an inclined fatha, written as a mark
      // instead of a haraka. Reading it as bare makes a vowelled reh sakin, and
      // the rulings of a sakin reh then apply to it.
      expect(normalized(REH + IMALAH_MARK)).toBe(REH)
      expect(normalized(REH)).toBe(REH + SUKOON)
    })

    it('reads either character an edition draws the imāla with', () => {
      // Editions disagree: this corpus's first edition marks the reh of Hūd 41
      // with U+06EA, the KFGQPC mushafs with U+065C. Each occurs exactly once
      // in Hafs, in that one place, and neither has any other use — so both are
      // read, and the rule is right on either edition without a later change.
      expect(normalized(REH + IMALAH_MARK_KFGQPC)).toBe(REH)
      expect(normalized(REH + IMALAH_MARK)).toBe(normalized(REH + IMALAH_MARK_KFGQPC))
    })
  })

  it('puts a shadda after the vowel it shares a letter with', () => {
    // The mushaf writes letter + shadda + haraka; CASE patterns are written
    // letter + haraka + shadda.
    expect(normalized(NOON + SHADDA + FATHA)).toBe(NOON + FATHA + SHADDA)
  })

  it('never returns the input string unchanged by reference or mutated', () => {
    const input = BA + QURANIC_SUKOON + TA
    const before = input
    normalize(input)
    expect(input).toBe(before)
  })
})

describe('offset mapping', () => {
  it('maps a match back across a dropped mark', () => {
    // The tatweel disappears during normalisation, so the normalised offsets and
    // the source offsets diverge from that point on.
    const source = KAF + FATHA + TATWEEL + BA + FATHA
    const result = normalize(source)

    const index = result.text.indexOf(BA)
    expect(index).toBeGreaterThan(-1)
    expect(sliceSpan(source, { start: result.srcStart[index]!, end: result.srcStart[index]! + 1 })).toBe(BA)
  })

  it('gives an inserted sukoon no width of its own', () => {
    // The sukoon on the final consonant is implied, not written. A span ending at
    // it must not reach backwards and swallow the letter before it.
    const source = BA + FATHA + MEEM
    const result = normalize(source)

    expect(result.text).toBe(BA + FATHA + MEEM + SUKOON)
    const sukoonIndex = result.text.length - 1
    expect(result.srcStart[sukoonIndex]).toBe(source.length)
  })

  it('keeps the mapping non-decreasing', () => {
    const source = BA + SHADDA + FATHA + TATWEEL + HAMZA_ABOVE + MEEM + QURANIC_SUKOON
    const result = normalize(source)

    for (let i = 1; i < result.srcStart.length; i++) {
      expect(result.srcStart[i]!).toBeGreaterThanOrEqual(result.srcStart[i - 1]!)
    }
  })
})

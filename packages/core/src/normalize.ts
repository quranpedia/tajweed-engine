/**
 * Normalising Uthmani text into the form CASE patterns are written against.
 *
 * The Uthmani script records how a word is WRITTEN; a tajweed rule describes how
 * it is READ. The two disagree in ways that no single transformation covers:
 * sukoon is left implicit where a letter is assimilated, tanween is drawn with
 * positional marks that differ from the standalone ones, a hamza may be carried
 * by a tatweel, and some letters are written but not pronounced at all.
 *
 * Each disagreement is one pass below, in an order that matters and is called out
 * where it does. Passes are kept separate and readable rather than folded into a
 * single scanner: this is the part of the engine where a subtle mistake changes
 * what the text is understood to say, so it is optimised for being audited.
 *
 * No pass mutates the caller's string. The result is a new string plus a map back
 * to the original — see mapped.ts.
 */

import {
  ALEF,
  ALEF_HAMZA_ABOVE,
  ALEF_MADDA,
  ALEF_MAQSURA,
  ALEF_WASLA,
  BOM,
  DAMMA,
  DAMMATAN,
  FATHA,
  FATHATAN,
  FATHATAN_VERTICAL,
  HAMZA,
  HAMZA_ABOVE,
  IMALAH_MARK,
  INVERTED_DAMMA,
  KASRA,
  KASRATAN,
  LAM,
  MADDAH_ABOVE,
  OPTIONAL_MARKS,
  QURANIC_SUKOON,
  SHADDA,
  SMALL_HIGH_MEEM,
  SMALL_HIGH_SEEN,
  SMALL_LOW_MEEM,
  SUBSCRIPT_ALEF,
  SUKOON,
  SUPERSCRIPT_ALEF,
  TASHIL_MARK,
  TATWEEL,
  TEH_MARBUTA,
  WAW,
  YEH,
  ZWSP,
  isDiacritic,
  isVowelMark,
  toCodePoints,
} from './unicode.js'
import { MappedBuilder, runPasses, type Mapped, type Pass } from './mapped.js'

/** Builds a pass that drops the given characters wherever they appear. */
function dropping(chars: readonly string[]): Pass {
  const dropped = new Set(chars)
  return (input) => {
    const out = new MappedBuilder()
    for (let i = 0; i < input.length; i++) {
      const char = input[i]!
      if (!dropped.has(char)) {
        out.emit(char, i)
      }
    }
    return out.build()
  }
}

/**
 * Builds a pass that rewrites fixed sequences. Longer sequences win, so a rule
 * for `damma + small meem` is not pre-empted by one for `damma` alone.
 */
function substituting(rules: ReadonlyArray<readonly [from: string, to: string]>): Pass {
  // Split into code points once, when the pass is built, rather than once per
  // rule per character position. Every ayah goes through twelve of these.
  const prepared = rules
    .map(([from, to]) => ({ from: toCodePoints(from), to: toCodePoints(to) }))
    .sort((a, b) => b.from.length - a.from.length)

  return (input) => {
    const out = new MappedBuilder()
    let i = 0
    outer: while (i < input.length) {
      for (const { from, to } of prepared) {
        let matched = true
        for (let offset = 0; offset < from.length; offset++) {
          if (input[i + offset] !== from[offset]) {
            matched = false
            break
          }
        }
        if (matched) {
          out.emitAll(to, i)
          i += from.length
          continue outer
        }
      }
      out.emit(input[i]!, i)
      i += 1
    }
    return out.build()
  }
}

/**
 * A hamza written as tatweel + combining hamza above becomes a standalone hamza.
 *
 * The Uthmani text draws what older orthography wrote as ئ/أ/ؤ using a bearer
 * tatweel with the hamza floating over it. Both of those characters are stripped
 * later as decoration, which would delete the consonant entirely — so it has to
 * be recovered first. Any harakat sitting between the two are kept in place.
 */
const recoverBorneHamza: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (input[i] === TATWEEL) {
      let j = i + 1
      while (j < input.length && (isDiacritic(input[j]) || input[j] === SUPERSCRIPT_ALEF)) {
        j += 1
      }
      if (input[j] === HAMZA_ABOVE) {
        out.emit(HAMZA, i)
        for (let k = i + 1; k < j; k++) {
          out.emit(input[k]!, k)
        }
        i = j + 1
        continue
      }
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/**
 * A small high seen at the end of a word marks a saktah — a deliberate pause
 * without breathing. It is replaced with a zero-width space, which no rule can
 * match across, so that a rule such as idghaam does not join the two words the
 * reciter is required to keep apart.
 *
 * The same character inside a word is a variant-spelling marker with no bearing
 * on recitation, and is left to be stripped with the other decoration.
 */
const saktahToBreak: Pass = (input) => {
  const out = new MappedBuilder()
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    const next = input[i + 1]
    const atWordEnd = next === undefined || /\s/u.test(next)
    out.emit(char === SMALL_HIGH_SEEN && atWordEnd ? ZWSP : char, i)
  }
  return out.build()
}

/**
 * The waw in the demonstrative family أُوْلَٰئِكَ, أُوْلِي, أُوْلُوا is written but not
 * pronounced — the same convention as the alef in الصلوٰة and الزكوٰة.
 *
 * Its sukoon is replaced with a fatha so that madd rules, which look for a sakin
 * waw after a damma, do not treat this silent letter as an elongation.
 */
const silenceOrthographicWaw: Pass = (input) => {
  const shape = [ALEF_HAMZA_ABOVE, DAMMA, WAW, SUKOON, LAM]
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (shape.every((char, offset) => input[i + offset] === char)) {
      out.emit(ALEF_HAMZA_ABOVE, i)
      out.emit(DAMMA, i + 1)
      out.emit(WAW, i + 2)
      out.emit(FATHA, i + 3)
      out.emit(LAM, i + 4)
      i += shape.length
      continue
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/** Alef forms that are never sakin and so never take an implied sukoon. */
const NEVER_SAKIN = new Set([ALEF_MADDA, '\u{0625}', ALEF, ALEF_MAQSURA, ALEF_WASLA])

function isConsonant(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }
  const code = char.codePointAt(0)!
  const inRange =
    (code >= 0x0621 && code <= 0x063a) || (code >= 0x0641 && code <= 0x064a) || code === 0x0629
  return inRange && !NEVER_SAKIN.has(char)
}

/**
 * Writes out the sukoon the Uthmani script leaves implicit.
 *
 * Where a letter is assimilated into the next, the mushaf simply omits its
 * sukoon; CASE patterns, being written phonetically, expect it. The inserted
 * character has no counterpart in the source, so it is mapped zero-width onto the
 * position of the following character.
 *
 * Runs before the alef forms are folded together, because a superscript alef is
 * what tells this pass that the letter beneath it is already vowelled.
 */
const insertImpliedSukoon: Pass = (input) => {
  const out = new MappedBuilder()
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    out.emit(char, i)

    if (!isConsonant(char)) {
      continue
    }

    // Already carries a diacritic of its own.
    const next = input[i + 1]
    if (isDiacritic(next) || next === SUPERSCRIPT_ALEF) {
      continue
    }

    // A maddah over a consonant lengthens it; it does not silence it. The
    // disjoined letters are written this way — قٓ is read qāf, with a long alef
    // and no sakin qaf anywhere in it. The maddah is stripped further down the
    // pipeline as decoration, so without this the letter arrives at the
    // matchers looking like a sakin consonant, and قٓ and عٓسٓقٓ were being
    // reported as قلقلة متطرفة.
    //
    // The imāla and tashīl marks say the same thing in a different way: they
    // record how the letter is performed, so the letter is vowelled even though
    // no haraka is written. The reh in Hūd 41 carries the imāla mark and nothing
    // else — its fatha is inclined towards a kasra, not absent — and reading it
    // as bare handed it the rulings of a sakin reh. In this edition only the
    // imāla mark reaches here, since the other two places write a haraka as
    // well, but both are handled: what makes this true is the mark, not the
    // place.
    if (next === MADDAH_ABOVE || next === IMALAH_MARK || next === TASHIL_MARK) {
      continue
    }

    // A waw after a damma or a yeh after a kasra is the second half of a long
    // vowel, not a sakin consonant.
    const previous = input[i - 1]
    if (char === WAW && previous === DAMMA) {
      continue
    }
    if (char === YEH && previous === KASRA) {
      continue
    }

    // Two consonants in a row with no vowel between them is not an Arabic
    // word — a syllable cannot begin with two sakins. It is the disjoined
    // letters, where each character is read as its own name: طه is ṭā-hā and
    // طسٓمٓ is ṭā-sīn-mīm, with no sakin ṭāʾ in either. Left alone, the ṭāʾ
    // collected an implied sukoon and was reported as قلقلة. A maddah does not
    // count as a vowel here; it is what marks سٓ and مٓ as letter names.
    const following = input[i + 1]
    if (isConsonant(following)) {
      const afterFollowing = input[i + 2]
      const vowelled =
        isDiacritic(afterFollowing) || afterFollowing === SUPERSCRIPT_ALEF
      if (!vowelled) {
        continue
      }
    }

    out.emit(SUKOON, i + 1)
  }
  return out.build()
}

/**
 * Puts a shadda after the vowel it shares a letter with.
 *
 * The mushaf writes letter + shadda + haraka; CASE patterns are written
 * letter + haraka + shadda. Both characters are mapped onto the position of the
 * first of the pair, so the reordering cannot produce a span whose end precedes
 * its start, and so a match landing on either half reports the whole cluster —
 * which is what renders as a single stacked mark above the letter anyway.
 */
const orderShaddaAfterVowel: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (input[i] === SHADDA && isVowelMark(input[i + 1])) {
      out.emit(input[i + 1]!, i)
      out.emit(SHADDA, i)
      i += 2
      continue
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/**
 * The pipeline. Order is load-bearing; the comments say where and why.
 *
 * Alef wasla (ٱ) is deliberately NOT folded into a plain alef. It is a connective
 * hamza, dropped when reciting continuously, not a long vowel — keeping it
 * distinct is what stops madd rules from firing on it.
 */
const PASSES: readonly Pass[] = [
  dropping([BOM]),

  substituting([[QURANIC_SUKOON, SUKOON]]),

  // Before the maddah is stripped as decoration, resolve the two ways the script
  // writes آ.
  //
  // On a plain alef it is the decomposed form of the precomposed character.
  //
  // On a hamza-carrying alef it is a hamza followed by a long a — أٓ in ٱلۡأٓخِرَة
  // is read hamza + alef, which is مد بدل. Writing that out as hamza, fatha,
  // alef is what lets a madd rule see it. Left alone, the maddah is stripped as
  // decoration and the bare hamza then collects an implied sukoon, turning a
  // madd letter into a sakin consonant.
  substituting([
    [ALEF + MADDAH_ABOVE, ALEF_MADDA],
    [ALEF_HAMZA_ABOVE + MADDAH_ABOVE, ALEF_HAMZA_ABOVE + FATHA + ALEF],
  ]),

  // Uthmani draws tanween with positional marks at word end.
  substituting([
    [INVERTED_DAMMA, FATHATAN],
    [FATHATAN_VERTICAL, DAMMATAN],
    [SUBSCRIPT_ALEF, KASRATAN],
  ]),

  // Iqlab is drawn as a haraka with a small meem rather than as tanween.
  substituting([
    [DAMMA + SMALL_HIGH_MEEM, DAMMATAN],
    [FATHA + SMALL_HIGH_MEEM, FATHATAN],
    [KASRA + SMALL_HIGH_MEEM, KASRATAN],
    [KASRA + SMALL_LOW_MEEM, KASRATAN],
  ]),

  recoverBorneHamza,
  saktahToBreak,
  silenceOrthographicWaw,
  insertImpliedSukoon,

  // After insertImpliedSukoon, which needs the superscript alef intact.
  substituting([
    [ALEF_MADDA, ALEF],
    [SUPERSCRIPT_ALEF, ALEF],
  ]),

  dropping(OPTIONAL_MARKS),
  orderShaddaAfterVowel,
]

export interface Normalized extends Mapped {
  /** The normalised text as a string, for matching against. */
  readonly text: string
  /** Length of the original text in code points. */
  readonly sourceLength: number
}

/**
 * Normalises Quranic text for matching, returning the result together with a map
 * back to the code-point offsets of `ayahText`.
 */
export function normalize(ayahText: string): Normalized {
  const source = toCodePoints(ayahText)
  const mapped = runPasses(source, PASSES)
  return {
    ...mapped,
    text: mapped.chars.join(''),
    sourceLength: source.length,
  }
}

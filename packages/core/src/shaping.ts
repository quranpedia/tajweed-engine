/**
 * Drawing Arabic that has been cut into pieces.
 *
 * Nothing here is about the text or about a ruling. It exists because a renderer
 * that wraps a span in its own element hands the shaper a boundary the reader
 * never asked for: a browser shapes each inline element on its own, so the
 * letters either side of a colour change never see each other and are drawn in
 * their isolated or final forms. The word comes apart, the text is still exactly
 * right, and nothing errors — which is why it reads as a font problem.
 *
 * Two things have to be true at every cut, and they are separate defects:
 * the cut must not land inside a letter's marks (`clusterEnd`), and the cursive
 * join across it has to be asked for explicitly (`bridgeJoins`).
 *
 * The joiners belong to the drawing and to nothing else. Offsets, `sliceSpan`,
 * counts and anything copied back out stay on the original string.
 */

import {
  ALEF,
  ALEF_HAMZA_ABOVE,
  ALEF_HAMZA_BELOW,
  ALEF_MADDA,
  ALEF_WASLA,
  DAL,
  HAMZA,
  REH,
  TEH_MARBUTA,
  THAL,
  WAW,
  WAW_HAMZA,
  ZAIN,
  isStackedMark,
  toCodePoints,
} from './unicode.js'

/** ZERO WIDTH JOINER, U+200D — asks the shaper for a joined form on that side. */
export const ZWJ = '\u{200D}'

/**
 * The letters that never join to the letter that follows them.
 *
 * This is why the joiner has to be conditional. A joiner after one of these asks
 * for a medial form that does not exist, and the shaper answers with a visible
 * tatweel stub — the word is then broken a second way rather than repaired.
 * ء joins on neither side, so it appears here and is refused a joiner before it
 * as well.
 */
const NO_JOIN_FORWARD: ReadonlySet<string> = new Set([
  HAMZA,
  ALEF_MADDA,
  ALEF_HAMZA_ABOVE,
  WAW_HAMZA,
  ALEF_HAMZA_BELOW,
  ALEF,
  TEH_MARBUTA,
  DAL,
  THAL,
  REH,
  ZAIN,
  WAW,
  ALEF_WASLA,
])

const ARABIC_LETTER = /\p{L}/u
const ARABIC_SCRIPT = /\p{Script=Arabic}/u

function isArabicLetter(char: string | undefined): boolean {
  return char !== undefined && ARABIC_LETTER.test(char) && ARABIC_SCRIPT.test(char)
}

/** True if `char` can join to whatever is drawn after it. */
function joinsForward(char: string | undefined): boolean {
  return isArabicLetter(char) && !NO_JOIN_FORWARD.has(char!)
}

/** True if `char` can join to whatever is drawn before it. */
function joinsBack(char: string | undefined): boolean {
  return isArabicLetter(char) && char !== HAMZA
}

/**
 * True of anything the shaper draws ON a letter rather than beside it, and so
 * of anything the join looks straight through.
 *
 * Deliberately wider than `isStackedMark`: a waqf sign is a nonspacing mark and
 * the cursive join runs through it, but it is not part of the letter's cluster —
 * which is exactly why `clusterEnd` must not treat the two alike.
 */
const TRANSPARENT = /[\p{Mn}\p{Me}]/u

function isTransparent(char: string): boolean {
  return char === ZWJ || TRANSPARENT.test(char)
}

/**
 * Moves `end` past the marks written on the letter it lands after.
 *
 * A span may end on the letter a ruling concerns while the shadda or harakah
 * that letter carries is written next — `ٱلرَّحۡمَٰن` has the ruling on the ر and
 * the shadda after it. Cutting at the raw offset puts that mark at the start of
 * the next element, where it has no letter to sit on and is drawn on a dotted
 * circle or floating in the gap.
 *
 * `isStackedMark` is what decides, so this and normalisation agree on where a
 * cluster ends. Waqf signs are deliberately not stacked marks: they sit between
 * words, and a cluster ends at one.
 *
 * Indices are code-point indices, the same ones a `Span` carries.
 */
export function clusterEnd(text: string, end: number): number {
  return clusterEndIn(toCodePoints(text), end)
}

/** `clusterEnd` for a caller that has already split the text. */
export function clusterEndIn(chars: readonly string[], end: number): number {
  let out = end
  while (out < chars.length && isStackedMark(chars[out]!)) {
    out += 1
  }
  return out
}

/**
 * Inserts joiners at every cut, for the chunks a renderer is about to emit as
 * separate elements.
 *
 * Pass the chunks in the order they will be drawn — the plain text between
 * spans, the text of each span, and anything a renderer breaks out on its own,
 * such as a waqf mark it wants left uncoloured. What comes back is the same
 * chunks with a `ZWJ` appended and prepended at each cut where the letters
 * either side would have joined had nothing been between them.
 *
 * The letters either side are the last and first BASE characters, looked for
 * through the marks and through any chunk that carries no letter at all. That
 * last part is what keeps a word together across a waqf mark broken out into its
 * own element: the mark's chunk is bridged on both sides, so it also gains a
 * joiner to sit on instead of a dotted circle.
 */
export function bridgeJoins(chunks: readonly string[]): string[] {
  const out = [...chunks]
  if (out.length < 2) {
    return out
  }

  const prefix: boolean[] = new Array(out.length).fill(false)
  const suffix: boolean[] = new Array(out.length).fill(false)

  for (let cut = 0; cut < out.length - 1; cut++) {
    const before = lastBase(chunks, cut)
    const after = firstBase(chunks, cut + 1)
    if (joinsForward(before) && joinsBack(after)) {
      suffix[cut] = true
      prefix[cut + 1] = true
    }
  }

  for (let index = 0; index < out.length; index++) {
    out[index] = `${prefix[index] ? ZWJ : ''}${out[index]!}${suffix[index] ? ZWJ : ''}`
  }
  return out
}

/** The last base character at or before chunk `index`, marks skipped. */
function lastBase(chunks: readonly string[], index: number): string | undefined {
  for (let i = index; i >= 0; i--) {
    const chars = toCodePoints(chunks[i]!)
    for (let k = chars.length - 1; k >= 0; k--) {
      if (!isTransparent(chars[k]!)) {
        return chars[k]
      }
    }
  }
  return undefined
}

/** The first base character at or after chunk `index`, marks skipped. */
function firstBase(chunks: readonly string[], index: number): string | undefined {
  for (let i = index; i < chunks.length; i++) {
    for (const char of toCodePoints(chunks[i]!)) {
      if (!isTransparent(char)) {
        return char
      }
    }
  }
  return undefined
}

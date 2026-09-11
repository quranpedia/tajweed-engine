/**
 * Named code points, so the normalisation passes read as Arabic orthography
 * rather than as hex.
 */

export const BOM = '\u{FEFF}'
export const ZWSP = '\u{200B}'

/** Letters */
export const HAMZA = '\u{0621}' // ء
export const ALEF_MADDA = '\u{0622}' // آ
export const ALEF_HAMZA_ABOVE = '\u{0623}' // أ
export const ALEF_HAMZA_BELOW = '\u{0625}' // إ
export const ALEF = '\u{0627}' // ا
export const LAM = '\u{0644}' // ل
export const WAW = '\u{0648}' // و
export const ALEF_MAQSURA = '\u{0649}' // ى
export const YEH = '\u{064A}' // ي
export const TEH_MARBUTA = '\u{0629}' // ة
export const ALEF_WASLA = '\u{0671}' // ٱ

/** Diacritics */
export const FATHATAN = '\u{064B}' // ً
export const DAMMATAN = '\u{064C}' // ٌ
export const KASRATAN = '\u{064D}' // ٍ
export const FATHA = '\u{064E}' // َ
export const DAMMA = '\u{064F}' // ُ
export const KASRA = '\u{0650}' // ِ
export const SHADDA = '\u{0651}' // ّ
export const SUKOON = '\u{0652}' // ْ
export const SUPERSCRIPT_ALEF = '\u{0670}' // ٰ  (الألف الخنجرية)

/** Uthmani-specific marks */
export const QURANIC_SUKOON = '\u{06E1}' // ۡ
export const SMALL_HIGH_MEEM = '\u{06E2}' // ۢ
export const SMALL_LOW_MEEM = '\u{06ED}' // ۭ
export const SMALL_WAW = '\u{06E5}' // ۥ
export const SMALL_YEH = '\u{06E6}' // ۦ
export const SMALL_HIGH_SEEN = '\u{06DC}' // ۜ
export const MADDAH_ABOVE = '\u{0653}' // ٓ
export const HAMZA_ABOVE = '\u{0654}' // ٔ
export const HAMZA_BELOW = '\u{0655}' // ٕ
export const TATWEEL = '\u{0640}' // ـ
export const INVERTED_DAMMA = '\u{0657}' // ٗ
export const SUBSCRIPT_ALEF = '\u{0656}' // ٖ
export const FATHATAN_VERTICAL = '\u{065E}' // ٞ
export const RECTANGULAR_ZERO = '\u{06E0}' // ۠

/**
 * The open tanween of the Arabic Extended-A block.
 *
 * The two families are the same three marks drawn differently, and an edition
 * uses one or the other throughout. The KFGQPC digital muṣḥafs — and so
 * quran-ws/quran-text — write these; the older positional marks above are what
 * the first edition read here used. Both fold onto the standalone tanween, so a
 * CASE pattern is written once and matches either.
 */
export const OPEN_FATHATAN = '\u{08F0}' // ࣰ
export const OPEN_DAMMATAN = '\u{08F1}' // ࣱ
export const OPEN_KASRATAN = '\u{08F2}' // ࣲ

/**
 * Marks that appear in mushaf text but never in a CASE pattern. They are removed
 * during normalisation so a pattern written without them still matches, and the
 * offset map is what puts them back inside the reported span.
 *
 * This list is deliberately explicit rather than a range. The Quranic annotation
 * block also contains waqf marks, which carry recitation instructions and must
 * survive — see ALLOWED_MARKS.
 */
export const OPTIONAL_MARKS: readonly string[] = [
  SMALL_WAW,
  SMALL_YEH,
  SMALL_HIGH_MEEM,
  SMALL_LOW_MEEM,
  '\u{06E4}', // ۤ small high madda
  '\u{06E7}', // ۧ small high yeh
  '\u{06E8}', // ۨ small high noon
  RECTANGULAR_ZERO,
  '\u{06EA}', // ۪ empty centre low stop
  '\u{06EC}', // ۬ rounded high stop with filled centre
  HAMZA_ABOVE,
  TATWEEL,
  '\u{06DB}', // ۛ small high three dots
  SMALL_HIGH_SEEN,
  MADDAH_ABOVE,
]

/**
 * Waqf and sajda marks. These sit between letters in the mushaf and must not
 * prevent a rule from matching across them, but they are part of the text and
 * are never removed.
 */
export const ALLOWED_MARKS: readonly string[] = [
  '\u{06DA}', // ۚ
  '\u{06D7}', // ۗ
  '\u{06D6}', // ۖ
  '\u{06D9}', // ۙ
  '\u{06D8}', // ۘ
  '\u{06DE}', // ۞
  '\u{06E9}', // ۩
]

/** Harakat, tanween, shadda and sukoon — U+064B..U+0652. */
export function isDiacritic(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }
  const code = char.codePointAt(0)!
  return code >= 0x064b && code <= 0x0652
}

/**
 * Marks that are written on a letter rather than between letters: harakat,
 * tanween, sukoon, and the small signs the Uthmani script stacks above and below.
 * Waqf signs are deliberately excluded — they sit between words, and a cluster
 * ends at one.
 */
export function isStackedMark(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }
  const code = char.codePointAt(0)!
  return (
    (code >= 0x064b && code <= 0x0656) ||
    code === 0x0657 ||
    code === 0x0658 ||
    code === 0x065c ||
    code === 0x065e ||
    code === 0x0670 ||
    code === 0x06e1 ||
    code === 0x06e2 ||
    code === 0x06e4 ||
    code === 0x06e5 ||
    code === 0x06e6 ||
    code === 0x06e7 ||
    code === 0x06e8 ||
    code === 0x06ed ||
    (code >= 0x08f0 && code <= 0x08f2)
  )
}

/** Vowel marks only — excludes shadda and sukoon. U+064B..U+0650. */
export function isVowelMark(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }
  const code = char.codePointAt(0)!
  return code >= 0x064b && code <= 0x0650
}

/** Splits a string into code points. */
export function toCodePoints(text: string): string[] {
  return Array.from(text)
}

/** Formats a code point as a `\u{...}` escape for embedding in a RegExp source. */
export function escapeCodePoint(char: string): string {
  return `\\u{${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}}`
}

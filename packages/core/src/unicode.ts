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
export const TATWEEL = '\u{0640}' // ـ
export const INVERTED_DAMMA = '\u{0657}' // ٗ
export const SUBSCRIPT_ALEF = '\u{0656}' // ٖ
export const FATHATAN_VERTICAL = '\u{065E}' // ٞ
export const RECTANGULAR_ZERO = '\u{06E0}' // ۠
/**
 * Marks that record a performance rather than a letter: the imāla of Hūd 41,
 * and the tashīl of Fuṣṣilat 44 / the ishmām of Yūsuf 11. A letter carrying one
 * is being given a vowel by it, which is why normalisation must not then treat
 * the letter as bare — see insertImpliedSukoon.
 */
export const IMALAH_MARK = '\u{06EA}' // ۪
export const TASHIL_MARK = '\u{06EC}' // ۬

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
  IMALAH_MARK,
  TASHIL_MARK,
  HAMZA_ABOVE,
  '\u{0655}', // ٕ hamza below
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

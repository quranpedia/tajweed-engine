/**
 * Compiling the CASE notation into a regular expression.
 *
 * CASE is the corpus's authoring notation. It exists so that a rule can be
 * written and checked by someone qualified in tajweed but not in programming:
 *
 *     نْ + [ذ ث ك ج ش س د ز ف ت]
 *
 * reads as "a sakin noon, followed by any of these letters". Groups are joined by
 * `+`, alternatives within a group are separated by spaces, brackets are
 * decoration, `ــ` is a wildcard letter, and three marks that are awkward to type
 * are spelled out by name.
 *
 * The notation's limits are as much a part of it as its features — it has no
 * negation, no optional groups and no exceptions, which is why eighteen rules in
 * the corpus are disabled rather than expressed. See packages/rules/README.md.
 */

import {
  ALLOWED_MARKS,
  MADDAH_ABOVE,
  OPTIONAL_MARKS,
  QURANIC_SUKOON,
  SHADDA,
  SUPERSCRIPT_ALEF,
  SMALL_WAW,
  SMALL_YEH,
  SUKOON,
  WAW,
  YEH,
  escapeCodePoint,
} from './unicode.js'

export type Scope = 'within-word' | 'across-words' | 'either'

export interface CompilableRule {
  readonly case: string
  readonly scope: Scope
  /**
   * Which text the pattern is written against.
   *
   * Almost every rule matches the normalised form, which is the point of
   * normalising. A few concern marks that normalisation removes precisely
   * because no ordinary rule should see them — the maddah that identifies مد
   * لازم حرفي is one — and those declare `original` and are matched against the
   * caller's string as written.
   */
  readonly matchAgainst?: 'normalized' | 'original'
}

/** Named marks the notation spells out because they are hard to type. */
const NAMED_MARKS: ReadonlyArray<readonly [string, string]> = [
  ['الألف الخنجرية', SUPERSCRIPT_ALEF],
  ['واو صغيرة', SMALL_WAW],
  ['ياء صغيرة', SMALL_YEH],
  ['علامة المد', MADDAH_ABOVE],
]

/**
 * Groups that are a position rather than a character.
 *
 * A rule about a letter at the end of a word cannot be written by listing what
 * follows it, because what follows is nothing. Without an anchor the only way to
 * express it is negatively — "not followed by a letter" — which the notation
 * cannot do, and which is why قلقلة متطرفة could not be written before.
 *
 * These consume no text, so a rule ending in one matches up to the last real
 * character and no further.
 */
/** Arabic letters that can carry a shadda. */
const LETTER_CLASS = '[\\u{0621}-\\u{063A}\\u{0641}-\\u{064A}\\u{0629}]'

const ANCHORS: Readonly<Record<string, string>> = {
  'نهاية الكلمة': '(?=\\s|$)',
  'بداية الكلمة': '(?<=^|\\s)',
  // End of the passage being analysed. Given one ayah at a time — which is how
  // the engine is used — this is رأس الآية, where stopping is the norm and a
  // ruling that depends on stopping is therefore realised.
  'نهاية الآية': `(?=[\\s${ALLOWED_MARKS.map(escapeCodePoint).join('')}]*$)`,
  // The letter that follows is not doubled, so this one is released rather than
  // merged into it.
  //
  // The mushaf leaves a letter bare where it is assimilated, and
  // insertImpliedSukoon gives it a sukoon so that the إدغام rules — written
  // `بْ + ب` — can find it. That is right for them and wrong for قلقلة, which
  // does not occur on a merged letter: ٱضۡرِب بِّعَصَاكَ and أَرَدتُّمۡ are read
  // straight through the ب and the د. Written as a lookahead because the
  // notation has no negation, and as an anchor because it consumes nothing and
  // so can sit between two groups.
  //
  // Two shapes of merging to reject. A doubled following letter is إدغام كامل
  // and carries a shadda. طاء before تاء is إدغام ناقص — the tongue merges
  // while إطباق and استعلاء remain — and is written with no shadda at all,
  // which is why بَسَطتَ، أَحَطتُ and فَرَّطتُمۡ need naming separately.
  'غير مدغم':
    `(?!\\s?${LETTER_CLASS}[\\u{064B}-\\u{0650}]?${escapeCodePoint(SHADDA)})` +
    `(?!(?<=\\u{0637}\\u{0652})\\u{062A})`,
}

/**
 * Diacritics and decoration that may sit between two groups without breaking a
 * match — the harakat block, the superscript alef, both sukoon forms, and every
 * mark the normaliser strips.
 */
const BETWEEN_MARKS = `[\\u{064B}-\\u{0652}${escapeCodePoint(SUPERSCRIPT_ALEF)}${escapeCodePoint(
  QURANIC_SUKOON,
)}${OPTIONAL_MARKS.map(escapeCodePoint).join('')}]`

/** Waqf and sajda marks, which a rule may also span. */
const ALLOWED_ALTERNATION = ALLOWED_MARKS.map(escapeCodePoint).join('|')

/**
 * What may appear between two groups, by scope.
 *
 * `across-words` is a faithful port of the legacy engine and is looser than its
 * name: it requires at least one separator, but a diacritic satisfies that just
 * as a space does, so it does not actually oblige the groups to be in different
 * words. Tightening it would change what 22 rules match and is left for a change
 * that can be reviewed on its own.
 */
function separatorFor(scope: Scope): string {
  switch (scope) {
    case 'within-word':
      return `(?:${ALLOWED_ALTERNATION}|${BETWEEN_MARKS})*`
    case 'either':
      return `(?:\\s|${ALLOWED_ALTERNATION}|${BETWEEN_MARKS})*`
    case 'across-words':
      return `(?:\\s+|${ALLOWED_ALTERNATION}|${BETWEEN_MARKS})+`
  }
}


/**
 * Parses one group of a CASE pattern into its alternatives.
 *
 * The order of these steps is inherited from the original implementation and is
 * significant — collapsing whitespace before stripping brackets, in particular,
 * is what lets `[ ا ب ]` and `[ا ب]` parse identically.
 *
 * Named marks are substituted first, which also stops their Arabic spelling from
 * being read as letters of the pattern: `الألف الخنجرية` contains a yeh, and any
 * analysis that works on the raw text will find it there.
 */
export function parseGroup(group: string): string[] {
  let text = group

  const anchor = ANCHORS[stripBrackets(text)]
  if (anchor !== undefined) {
    return [text.trim()]
  }

  for (const [name, mark] of NAMED_MARKS) {
    text = text.replaceAll(name, mark)
  }

  // A run of tatweel is a wildcard letter. The trailing-bracket fixup undoes the
  // case where the run sat immediately before the closing bracket and would
  // otherwise leave a stray wildcard at the end of the group.
  text = text.replace(/\u{0640}+/gu, '.')
  text = text.replaceAll('.]', ']')

  text = text.replace(/\s+/gu, ' ')
  text = text.trim().replaceAll('[', '').replaceAll(']', '').trim()

  return text.split(' ')
}

/** Parses a whole CASE pattern into its groups, each a list of alternatives. */
export function parseCase(caseText: string): string[][] {
  return caseText.split('+').map(parseGroup)
}

function stripBrackets(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().replaceAll('[', '').replaceAll(']', '').trim()
}

/** Compiles one group of a CASE pattern into a regex alternation. */
export function compileGroup(group: string): string {
  const anchor = ANCHORS[stripBrackets(group)]
  if (anchor !== undefined) {
    return anchor
  }

  let alternatives = parseGroup(group)

  // Normalisation moves a shadda after the vowel it shares a letter with, so a
  // pattern written as نّ has to tolerate the vowel appearing in between.
  alternatives = alternatives.map((alternative) =>
    alternative.replace(
      new RegExp(`(${LETTER_CLASS})(${escapeCodePoint(SHADDA)})`, 'gu'),
      '$1[\\u{064B}-\\u{0650}]?$2',
    ),
  )

  // A group listing both the bare and the sakin form of waw or yeh is describing
  // a madd or leen letter, which is by definition unvowelled. Without this, the
  // bare alternative would match any waw at all — including the vowelled waw of
  // هُوَ — and colour it as an elongation.
  alternatives = withSakinOnlyLongVowels(alternatives, WAW)
  alternatives = withSakinOnlyLongVowels(alternatives, YEH)

  return alternatives.join('|')
}

function withSakinOnlyLongVowels(alternatives: string[], letter: string): string[] {
  const hasBare = alternatives.includes(letter)
  const hasSakin = alternatives.includes(letter + SUKOON)
  if (!hasBare || !hasSakin) {
    return alternatives
  }
  return alternatives.map((alternative) =>
    alternative === letter ? `${letter}(?![\\u{064B}-\\u{0650}])` : alternative,
  )
}

/**
 * Compiles a rule's CASE pattern into a global RegExp over normalised text.
 *
 * Throws if the pattern does not compile. A rule whose `case` holds prose rather
 * than a pattern is marked `disabled` in the corpus and must be filtered out
 * before reaching here.
 */
export function compileRule(rule: CompilableRule): RegExp {
  const groups = rule.case.split('+')

  if (groups.length === 1) {
    // The group is bracketed before the trailing waqf marks are appended. The
    // legacy engine did not bracket it, so with a group of more than one
    // alternative the `*` bound to the last alternative only, and whether a
    // trailing waqf mark fell inside the match depended on which alternative
    // matched. This is a deliberate divergence; it changes span extents, never
    // which positions match. See docs/divergences.md.
    const group = compileGroup(groups[0]!)
    return new RegExp(`(?:${group})(?:${ALLOWED_ALTERNATION})*`, 'gu')
  }

  const separator = separatorFor(rule.scope)
  const source = groups
    .map((group) => `(?:${compileGroup(group)})`)
    .join(separator)

  return new RegExp(source, 'gu')
}

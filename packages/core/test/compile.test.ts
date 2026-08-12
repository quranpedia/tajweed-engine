/**
 * Unit tests for the CASE notation.
 *
 * These check what the notation MEANS, by compiling small patterns and running
 * them against constructed text — not by asserting on the generated regex source,
 * which is an implementation detail nobody should depend on.
 */

import { describe, expect, it } from 'vitest'

import { compileRule, parseCase, parseGroup } from '../src/compile.js'
import { normalize } from '../src/normalize.js'
import {
  ALEF,
  DAMMA,
  FATHA,
  KASRA,
  SHADDA,
  SMALL_WAW,
  SUKOON,
  SUPERSCRIPT_ALEF,
  TATWEEL,
  WAW,
  YEH,
} from '../src/unicode.js'

const BA = '\u{0628}'
const TA = '\u{062A}'
const NOON = '\u{0646}'
const HA = '\u{0647}'

/** Compiles a pattern and reports what it finds in normalised text. */
function findIn(caseText: string, text: string, scope: 'within-word' | 'across-words' | 'either' = 'within-word') {
  const pattern = compileRule({ case: caseText, scope })
  pattern.lastIndex = 0
  return normalize(text).text.match(pattern) ?? []
}

describe('parsing', () => {
  it('treats brackets as decoration and spaces as alternation', () => {
    expect(parseGroup('[ا ب ت]')).toEqual([ALEF, BA, TA])
    expect(parseGroup('[ ا  ب ]')).toEqual([ALEF, BA])
    expect(parseGroup('ا ب')).toEqual([ALEF, BA])
  })

  it('splits groups on +', () => {
    expect(parseCase('نْ + [ي و]')).toEqual([[NOON + SUKOON], [YEH, WAW]])
  })

  it('substitutes marks that are spelled out by name', () => {
    expect(parseGroup('[الألف الخنجرية]')).toEqual([SUPERSCRIPT_ALEF])
    expect(parseGroup('[واو صغيرة]')).toEqual([SMALL_WAW])
  })

  it('substitutes named marks before anything reads the text as letters', () => {
    // الخنجرية contains a yeh. Any analysis that inspects the raw pattern text
    // will find one there and conclude the rule is about yaa — which is how a
    // defective madd rule went unnoticed.
    expect(parseGroup('[الألف الخنجرية]')).not.toContain(YEH)
  })

  it('reads a run of tatweel as a wildcard letter', () => {
    expect(parseGroup(TATWEEL.repeat(6) + FATHA)).toEqual([`.${FATHA}`])
  })
})

describe('compiled behaviour', () => {
  it('matches any one alternative of a group', () => {
    expect(findIn('[ب ت]', BA + FATHA)).toHaveLength(1)
    expect(findIn('[ب ت]', TA + FATHA)).toHaveLength(1)
    expect(findIn('[ب ت]', NOON + FATHA)).toHaveLength(0)
  })

  it('tolerates the vowel that normalisation moves in front of a shadda', () => {
    // Written نّ, the pattern must still match نَّ once normalisation has put the
    // fatha between the letter and its shadda.
    expect(findIn(NOON + SHADDA, NOON + SHADDA + FATHA)).toHaveLength(1)
  })

  it('does not match a vowelled waw when the group means a madd letter', () => {
    // A group listing both و and وْ describes an unvowelled madd or leen letter.
    // Without the guard the bare alternative matches any waw at all, including
    // the vowelled waw of هُوَ, and colours it as an elongation.
    expect(findIn(`[${WAW} ${WAW + SUKOON}]`, HA + DAMMA + WAW + FATHA)).toHaveLength(0)
    expect(findIn(`[${WAW} ${WAW + SUKOON}]`, BA + FATHA + WAW + SUKOON)).toHaveLength(1)
  })

  it('does not match a vowelled yeh when the group means a madd letter', () => {
    expect(findIn(`[${YEH} ${YEH + SUKOON}]`, BA + FATHA + YEH + KASRA)).toHaveLength(0)
  })

  it('leaves a bare letter unguarded when the group is not a madd group', () => {
    // Only a group holding BOTH forms is read as a madd group; a group with just
    // the bare letter still matches it however it is vowelled.
    expect(findIn(WAW, HA + DAMMA + WAW + FATHA)).toHaveLength(1)
  })

  describe('scope', () => {
    const twoGroups = `${NOON + SUKOON} + [${BA}]`

    it('within-word does not match across a space', () => {
      expect(findIn(twoGroups, NOON + SUKOON + ' ' + BA + FATHA, 'within-word')).toHaveLength(0)
      expect(findIn(twoGroups, NOON + SUKOON + BA + FATHA, 'within-word')).toHaveLength(1)
    })

    it('either matches with or without a space', () => {
      expect(findIn(twoGroups, NOON + SUKOON + ' ' + BA + FATHA, 'either')).toHaveLength(1)
      expect(findIn(twoGroups, NOON + SUKOON + BA + FATHA, 'either')).toHaveLength(1)
    })
  })

  it('matches across the marks normalisation strips', () => {
    expect(findIn(`${NOON + SUKOON} + [${BA}]`, NOON + SUKOON + TATWEEL + BA + FATHA)).toHaveLength(1)
  })
})

/**
 * Drawing a cut ayah: where a cut may land, and what has to be added across it.
 *
 * Every input here is a real ayah read from `editions/`, cut at offsets the
 * engine itself reports. Nothing is composed: a made-up phrase standing in for
 * Quranic text reads as Quran to whoever sees it, in a failure message as much
 * as anywhere else. Where a letter or a mark has to be named, it is named by
 * code point rather than written out, which is unambiguous about what is being
 * tested and is not text at all.
 */

import { describe, expect, it } from 'vitest'

import corpus from '../../rules/rules.json' with { type: 'json' }
import { Tajweed, sliceSpan } from '../src/engine.js'
import { toAnsi, toHtml } from '../src/render.js'
import { ZWJ, bridgeJoins, clusterEnd } from '../src/shaping.js'
import { toCodePoints } from '../src/unicode.js'
import type { Corpus } from '../src/types.js'
import { RICH_AYAH, ayah } from './fixtures.js'

const typed = corpus as unknown as Corpus
const engine = new Tajweed(typed)

const REH = '\u{0631}'
const ALEF = '\u{0627}'
const SAD = '\u{0635}'
const SHADDA = '\u{0651}'
const FATHA = '\u{064E}'
const KASRA = '\u{0650}'
const SUPERSCRIPT_ALEF = '\u{0670}'
const WAQF_SALA = '\u{06D6}'
const ANSI_CODE = new RegExp(`${'\u{001B}'}\\[[0-9;]*m`, 'gu')

/** Cuts `text` at the code-point offsets given, as a renderer would. */
function cut(text: string, ...at: readonly number[]): string[] {
  const chars = toCodePoints(text)
  const bounds = [0, ...at, chars.length]
  return bounds.slice(0, -1).map((start, index) => chars.slice(start, bounds[index + 1]).join(''))
}

/** What the drawing reads as once the markup and the joiners are taken back out. */
function undrawn(html: string): string {
  return html.replace(/<[^>]*>/g, '').replaceAll(ZWJ, '').replaceAll('&amp;', '&')
}

describe('clusterEnd', () => {
  it('pushes an end past the marks written on the letter it lands after', () => {
    // 1:1 ٱلرَّحۡمَٰنِ — the tafkheem is on the rāʾ, and the span ends on the rāʾ
    // itself, with the shadda and the fatha it carries written next.
    const text = ayah('1:1')
    const span = engine.analyze(text).find((found) => found.ruleId === 'raa-tafkheem.1')!
    expect(sliceSpan(text, span)).toBe(REH)

    const end = clusterEnd(text, span.end)
    expect(end).toBeGreaterThan(span.end)
    expect(sliceSpan(text, { start: span.start, end })).toBe(`${REH}${SHADDA}${FATHA}`)
  })

  it('leaves an end that already falls between letters where it is', () => {
    const text = ayah('112:1')
    const span = engine.analyze(text).find((found) => found.ruleId === 'qalqalah-kubra.1')!
    // The last word of the ayah: the span ends where the text does.
    expect(clusterEnd(text, span.end)).toBe(span.end)
    expect(clusterEnd(text, 0)).toBe(0)
  })

  it('stops at a waqf mark, which sits between words rather than on a letter', () => {
    // 2:5 ...رَّبِّهِمۡۖ وَأُوْلَٰٓئِكَ — the pause mark follows the sukoon on the mīm.
    const text = ayah('2:5')
    const waqf = toCodePoints(text).indexOf(WAQF_SALA)
    expect(waqf).toBeGreaterThan(-1)
    // The sukoon before it is swallowed into the cluster; the waqf mark is not.
    expect(clusterEnd(text, waqf - 1)).toBe(waqf)
    expect(clusterEnd(text, waqf)).toBe(waqf)
  })
})

describe('bridgeJoins', () => {
  it('joins a word cut between two letters that join', () => {
    // 1:1 بِسۡمِ — cut between the sīn and the mīm, both of which join.
    const chunks = cut(ayah('1:1'), 4)
    const bridged = bridgeJoins(chunks)

    expect(bridged[0]!.endsWith(ZWJ)).toBe(true)
    expect(bridged[1]!.startsWith(ZWJ)).toBe(true)
    expect(bridged.join('').replaceAll(ZWJ, '')).toBe(chunks.join(''))
  })

  it('adds nothing after a letter that never joins forward', () => {
    // 1:7 صِرَٰطَ — cut after the rāʾ and its marks. A joiner here would ask for
    // a medial rāʾ, which does not exist, and the shaper would answer with a
    // visible tatweel stub: the word broken a second way rather than repaired.
    const text = ayah(RICH_AYAH)
    expect(toCodePoints(text)[2]).toBe(REH)
    expect(bridgeJoins(cut(text, 5)).some((chunk) => chunk.includes(ZWJ))).toBe(false)
  })

  it('adds nothing after an alef', () => {
    // 1:7 وَلَا ٱلضَّآلِّينَ — cut after the alef of لَا.
    const text = ayah(RICH_AYAH)
    const alef = toCodePoints(text).indexOf(ALEF)
    expect(alef).toBeGreaterThan(-1)
    expect(bridgeJoins(cut(text, alef + 1)).some((chunk) => chunk.includes(ZWJ))).toBe(false)
  })

  it('adds nothing at a space', () => {
    const text = ayah(RICH_AYAH)
    const space = toCodePoints(text).indexOf(' ')
    expect(bridgeJoins(cut(text, space)).some((chunk) => chunk.includes(ZWJ))).toBe(false)
    expect(bridgeJoins(cut(text, space + 1)).some((chunk) => chunk.includes(ZWJ))).toBe(false)
  })

  it('looks through a chunk that carries no letter of its own', () => {
    // A renderer may give an element to something that is not a letter at all —
    // a waqf mark it wants left uncoloured, or nothing. The letters either side
    // still have to find each other, and the chunk between gains a joiner to sit
    // on rather than a dotted circle.
    const [before, after] = cut(ayah('1:1'), 4) as [string, string]
    const bridged = bridgeJoins([before, '', after])

    expect(bridged[0]!.endsWith(ZWJ)).toBe(true)
    expect(bridged[1]).toBe(`${ZWJ}${ZWJ}`)
    expect(bridged[2]!.startsWith(ZWJ)).toBe(true)
  })

  it('leaves a single chunk alone', () => {
    const text = ayah('1:1')
    expect(bridgeJoins([text])).toEqual([text])
  })
})

describe('toHtml', () => {
  const text = ayah(RICH_AYAH)
  const html = toHtml(text, engine.analyze(text), typed)

  it('draws the text it was given, and nothing else', () => {
    expect(undrawn(html)).toBe(text)
  })

  it('bridges a word cut by a change of colour', () => {
    // 1:7 صِرَٰطَ — the ṣād carries one ruling and the rāʾ the next, so the word
    // is cut between them. Before this, the ṣād was drawn in isolated form.
    expect(html).toContain(`${SAD}${KASRA}${ZWJ}`)
    expect(html).toContain(`${ZWJ}${REH}${FATHA}${SUPERSCRIPT_ALEF}`)
  })

  it('never opens an element on a mark left behind by the one before it', () => {
    const pieces = html.split(/<[^>]*>/).filter((piece) => piece !== '')
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) {
      const first = toCodePoints(piece.replaceAll(ZWJ, ''))[0]
      expect(first !== undefined && isStacked(first)).toBe(false)
    }
  })

  it('leaves a waqf mark uncoloured, and joined', () => {
    // 2:5 ...رَّبِّهِمۡۖ — the mīm is inside a span; the pause mark after it is an
    // instruction to the reciter, not part of the letter the ruling concerns.
    const marked = ayah('2:5')
    const drawn = toHtml(marked, engine.analyze(marked), typed)
    expect(drawn).toContain(`</span>${WAQF_SALA}`)
    expect(undrawn(drawn)).toBe(marked)
  })

  it('adds a joiner only where a cut was made', () => {
    // Every joiner in the output sits against markup. One in the middle of a
    // chunk would be a joiner in the text, which is what must never happen.
    for (const piece of html.split(/<[^>]*>/)) {
      const inner = piece.slice(ZWJ.length, piece.length - ZWJ.length)
      expect(inner.includes(ZWJ)).toBe(false)
    }
  })
})

describe('toAnsi', () => {
  it('adds no joiners: a terminal does not shape across an escape code', () => {
    const text = ayah(RICH_AYAH)
    const drawn = toAnsi(text, engine.analyze(text))
    expect(drawn).not.toContain(ZWJ)
    expect(drawn.replace(ANSI_CODE, '')).toBe(text)
  })
})

/**
 * Whether a mark is written on the letter before it.
 *
 * Spelled out rather than imported, so the assertion above is a check on
 * `clusterEnd` rather than a restatement of it.
 */
function isStacked(char: string): boolean {
  const code = char.codePointAt(0)!
  return (
    (code >= 0x064b && code <= 0x0658) ||
    code === 0x065c ||
    code === 0x065e ||
    code === 0x0670 ||
    (code >= 0x06e1 && code <= 0x06e8) ||
    code === 0x06ed ||
    (code >= 0x08f0 && code <= 0x08f2)
  )
}

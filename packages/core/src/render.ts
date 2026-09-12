/**
 * Turning spans into something a person can look at.
 *
 * This is a convenience, not the engine's purpose — the output of `analyze` is
 * offsets, and most consumers should render them themselves. What is worth
 * sharing is the decisions that are easy to get wrong: which marks must never be
 * coloured, where a span may and may not be cut, and how many colours a reader
 * can actually tell apart.
 */

import { resolveOverlaps } from './engine.js'
import { bridgeJoins, clusterEndIn } from './shaping.js'
import { ALLOWED_MARKS, toCodePoints } from './unicode.js'
import type { Corpus, Span } from './types.js'

/**
 * Colours keyed by TOPIC — one entry per topic in the corpus, and a test holds
 * the two sets equal so a new topic cannot ship without a colour.
 *
 * The corpus has far more ahkam than a reader can hold apart by colour, and the
 * application this came from gave each its own colour. One colour per hukum is
 * not one distinction per hukum — past roughly a dozen, a reader stops decoding
 * the colour and starts ignoring it, and the palette necessarily contains pairs
 * no one can separate, least of all on a phone or with a colour vision
 * deficiency.
 *
 * A colour per topic is legible. Anything needing finer granularity should say
 * so in words: a tooltip, a legend, a label. Colour carries the category; text
 * carries the ruling — which is also why every renderer here writes the ruling
 * into aria-label, so colour is never the only thing carrying meaning.
 *
 * This comment used to state the number of topics and the number of ahkam. Both
 * were written by hand, and the second was wrong for four branches. The argument
 * does not need either, so it no longer carries them; the palette is held to the
 * corpus by a test instead.
 *
 * Chosen for contrast against both light and dark backgrounds.
 */
export const TOPIC_COLORS: Readonly<Record<string, string>> = {
  'tafkheem-tarqeeq': '#c2410c',
  'letter-relations': '#7e22ce',
  'noon-tanween': '#0369a1',
  'meem-sakinah': '#0f766e',
  mushaddadatan: '#a16207',
  madd: '#be123c',
  qalqalah: '#15803d',
}

export interface RenderOptions {
  /**
   * Resolve overlapping spans to a single layer first. On by default, because
   * nested markup for overlapping spans is rarely what a caller wants.
   */
  readonly flatten?: boolean
  /** Colour per topic id. Defaults to TOPIC_COLORS. */
  readonly colors?: Readonly<Record<string, string>>
  /** Supplies the tooltip text for a span. Defaults to the rule's Arabic label. */
  readonly describe?: (span: Span) => string
}

/**
 * Wraps each span in a `<span>` carrying its colour and its ruling.
 *
 * Four things this does that a naive implementation does not:
 *
 * Waqf and sajda marks inside a span are left uncoloured. They are instructions
 * to the reciter about where to stop, not part of the letter the rule concerns,
 * and colouring them implies they are.
 *
 * The ruling is written into `aria-label` as well as `title`, so a screen reader
 * reaches it. Colour alone conveys nothing to a reader who cannot see it, which
 * for a tool meant to teach is a failure of the whole exercise.
 *
 * Every boundary is pushed past the marks of the letter it lands on, so a shadda
 * or a harakah is never separated from the letter it is written on.
 *
 * Every boundary is then bridged with a zero-width joiner where the letters
 * either side would have joined. A browser shapes each element on its own, so
 * without that the word comes apart at each change of colour — the text
 * unaltered, nothing raised, and the reader sent looking at their font.
 */
export function toHtml(ayahText: string, spans: readonly Span[], corpus: Corpus, options: RenderOptions = {}): string {
  const { flatten = true, colors = TOPIC_COLORS, describe } = options
  const label = describe ?? defaultDescribe(corpus)
  const chars = toCodePoints(ayahText)
  const ordered = flatten ? resolveOverlaps(spans) : [...spans].sort((a, b) => a.start - b.start)

  // Each piece becomes its own element, so each piece is a cut the shaper has to
  // be told about. They are collected before anything is written, because a
  // joiner is decided by the letters on BOTH sides of its cut.
  const pieces: { readonly text: string; readonly span?: Span }[] = []
  let cursor = 0

  for (const span of ordered) {
    const start = clusterEndIn(chars, span.start)
    const end = clusterEndIn(chars, span.end)
    if (start < cursor) {
      continue
    }
    if (start > cursor) {
      pieces.push({ text: chars.slice(cursor, start).join('') })
    }

    // A waqf mark is broken out so it keeps the default colour.
    let run = ''
    for (const char of chars.slice(start, end)) {
      if (!ALLOWED_MARKS.includes(char)) {
        run += char
        continue
      }
      if (run !== '') {
        pieces.push({ text: run, span })
        run = ''
      }
      pieces.push({ text: char })
    }
    if (run !== '') {
      pieces.push({ text: run, span })
    }

    cursor = end
  }

  if (cursor < chars.length) {
    pieces.push({ text: chars.slice(cursor).join('') })
  }

  const bridged = bridgeJoins(pieces.map((piece) => piece.text))

  return pieces
    .map((piece, index) => {
      const text = escapeHtml(bridged[index]!)
      if (!piece.span) {
        return text
      }
      const color = colors[piece.span.topicId] ?? 'currentColor'
      const description = escapeHtml(label(piece.span))
      return (
        `<span class="tajweed" data-rule="${escapeHtml(piece.span.ruleId)}" data-topic="${escapeHtml(
          piece.span.topicId,
        )}" style="color:${color}" title="${description}" aria-label="${description}">` + `${text}</span>`
      )
    })
    .join('')
}

const ANSI: Readonly<Record<string, string>> = {
  'tafkheem-tarqeeq': '[38;5;166m',
  'letter-relations': '[38;5;98m',
  'noon-tanween': '[38;5;32m',
  'meem-sakinah': '[38;5;30m',
  mushaddadatan: '[38;5;136m',
  madd: '[38;5;161m',
  qalqalah: '[38;5;28m',
}
const RESET = '[0m'

/** The same colouring for a terminal. */
export function toAnsi(ayahText: string, spans: readonly Span[]): string {
  const chars = toCodePoints(ayahText)
  const out: string[] = []
  let cursor = 0

  for (const span of resolveOverlaps(spans)) {
    if (span.start < cursor) {
      continue
    }
    out.push(chars.slice(cursor, span.start).join(''))
    out.push(`${ANSI[span.topicId] ?? ''}${chars.slice(span.start, span.end).join('')}${RESET}`)
    cursor = span.end
  }

  out.push(chars.slice(cursor).join(''))
  return out.join('')
}

function defaultDescribe(corpus: Corpus): (span: Span) => string {
  const ruleById = new Map(corpus.rules.map((rule) => [rule.id, rule]))
  const hukumById = new Map(corpus.hukums.map((hukum) => [hukum.id, hukum]))

  return (span) => {
    const hukum = hukumById.get(span.hukumId)?.label.ar
    const rule = ruleById.get(span.ruleId)?.label.ar
    return hukum && rule ? `${hukum} — ${rule}` : (hukum ?? rule ?? span.ruleId)
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

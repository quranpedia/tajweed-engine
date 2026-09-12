/**
 * A React component for rendering Quranic text with its tajweed rulings marked.
 *
 * This is a thin layer over the engine, and deliberately so — most of what makes
 * a mushaf reader good is typography, spacing and page layout, none of which
 * belongs in a shared package. What is worth sharing is the handful of decisions
 * that are easy to get wrong: never altering the text, never colouring a waqf
 * mark, and never letting colour be the only thing that carries meaning.
 */

import { useMemo, type CSSProperties, type ReactElement, type ReactNode } from 'react'

import {
  Tajweed,
  TOPIC_COLORS,
  resolveOverlaps,
  sliceSpan,
  type Corpus,
  type Span,
  type TajweedOptions,
} from '@quran-ws/tajwid'

const WAQF_MARKS = new Set(['\u{06DA}', '\u{06D7}', '\u{06D6}', '\u{06D9}', '\u{06D8}', '\u{06DE}', '\u{06E9}'])

export interface TajweedTextProps {
  /** The ayah text, exactly as your source has it. It is never modified. */
  readonly text: string
  /** The rule corpus. Pass `@quran-ws/tajwid-rules`. */
  readonly corpus: Corpus
  /**
   * Precomputed spans. Supply these from `@quran-ws/tajwid-annotations` in production —
   * the Quran is a fixed corpus, so there is no reason to analyse it in a
   * browser. Omit to analyse `text` on the fly, which is what a playground or an
   * arbitrary passage needs.
   */
  readonly spans?: readonly Span[]
  /** Passed to the engine when `spans` is omitted. */
  readonly options?: TajweedOptions
  /** Colour per topic id. Defaults to the six-colour palette in @quran-ws/tajwid. */
  readonly colors?: Readonly<Record<string, string>>
  /** Show all overlapping rulings rather than the topmost. Off by default. */
  readonly overlapping?: boolean
  /** Called when a marked stretch is clicked. */
  readonly onSpanClick?: (span: Span) => void
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Renders `text` with each annotated stretch wrapped in a coloured span.
 *
 * The text is emitted character for character; nothing is normalised, escaped
 * away or reordered. React escapes it on output, so the string that reaches the
 * DOM is the string that was passed in.
 */
export function TajweedText({
  text,
  corpus,
  spans,
  options,
  colors = TOPIC_COLORS,
  overlapping = false,
  onSpanClick,
  className,
  style,
}: TajweedTextProps): ReactElement {
  const engine = useMemo(
    () => (spans ? null : new Tajweed(corpus, options ?? {})),
    [corpus, options, spans],
  )

  const resolved = useMemo(() => {
    const found = spans ?? engine?.analyze(text) ?? []
    return overlapping ? [...found].sort((a, b) => a.start - b.start) : resolveOverlaps(found)
  }, [spans, engine, text, overlapping])

  const describe = useMemo(() => describer(corpus), [corpus])

  const children: ReactNode[] = []
  const characters = Array.from(text)
  let cursor = 0

  for (const [index, span] of resolved.entries()) {
    if (span.start < cursor) {
      continue
    }

    if (span.start > cursor) {
      children.push(characters.slice(cursor, span.start).join(''))
    }

    const label = describe(span)

    children.push(
      <span
        key={`${span.ruleId}-${span.start}-${index}`}
        className="tajweed-span"
        data-rule={span.ruleId}
        data-hukum={span.hukumId}
        data-topic={span.topicId}
        style={{ color: colors[span.topicId] ?? 'currentColor' }}
        title={label}
        // Colour alone conveys nothing to a reader who cannot see it, which for
        // something meant to teach recitation defeats the purpose.
        aria-label={label}
        role={onSpanClick ? 'button' : undefined}
        tabIndex={onSpanClick ? 0 : undefined}
        onClick={onSpanClick ? () => onSpanClick(span) : undefined}
        onKeyDown={
          onSpanClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSpanClick(span)
                }
              }
            : undefined
        }
      >
        {renderInner(characters.slice(span.start, span.end))}
      </span>,
    )

    cursor = span.end
  }

  if (cursor < characters.length) {
    children.push(characters.slice(cursor).join(''))
  }

  return (
    <span className={className} style={{ direction: 'rtl', unicodeBidi: 'isolate', ...style }} lang="ar">
      {children}
    </span>
  )
}

/**
 * Waqf and sajda marks keep the surrounding text's colour.
 *
 * They tell the reciter where to pause; they are not part of the letter the
 * ruling concerns, and colouring them says otherwise.
 */
function renderInner(characters: readonly string[]): ReactNode {
  const parts: ReactNode[] = []
  let run = ''

  for (const [index, character] of characters.entries()) {
    if (!WAQF_MARKS.has(character)) {
      run += character
      continue
    }
    if (run !== '') {
      parts.push(run)
      run = ''
    }
    parts.push(
      <span key={`waqf-${index}`} style={{ color: 'initial' }}>
        {character}
      </span>,
    )
  }

  if (run !== '') {
    parts.push(run)
  }

  return parts
}

function describer(corpus: Corpus): (span: Span) => string {
  const ruleById = new Map(corpus.rules.map((rule) => [rule.id, rule]))
  const hukumById = new Map(corpus.hukums.map((hukum) => [hukum.id, hukum]))

  return (span) => {
    const hukum = hukumById.get(span.hukumId)?.label.ar
    const rule = ruleById.get(span.ruleId)?.label.ar
    return hukum && rule ? `${hukum} — ${rule}` : (hukum ?? rule ?? span.ruleId)
  }
}

export interface TajweedLegendProps {
  readonly corpus: Corpus
  /** Restrict to the topics actually present in what is being shown. */
  readonly topics?: readonly string[]
  readonly colors?: Readonly<Record<string, string>>
  readonly className?: string
}

/**
 * A legend of what the colours mean.
 *
 * Worth rendering rather than skipping: the corpus covers a fixed set of topics
 * and is silent outside them, and an unlabelled wash of colour implies a completeness
 * the data does not have. See docs/coverage.md.
 */
export function TajweedLegend({ corpus, topics, colors = TOPIC_COLORS, className }: TajweedLegendProps): ReactElement {
  const shown = corpus.topics.filter((topic) => !topics || topics.includes(topic.id))

  return (
    <ul className={className} style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: 0 }}>
      {shown.map((topic) => (
        <li key={topic.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span
            aria-hidden="true"
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '2px',
              background: colors[topic.id] ?? 'currentColor',
              display: 'inline-block',
            }}
          />
          <span lang="ar">{topic.label.ar}</span>
        </li>
      ))}
    </ul>
  )
}

export { TOPIC_COLORS } from '@quran-ws/tajwid'
export type { Span, Corpus } from '@quran-ws/tajwid'

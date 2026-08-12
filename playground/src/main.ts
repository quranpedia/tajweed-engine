/**
 * The playground's behaviour.
 *
 * Everything runs in the browser: the corpus is bundled in, and the text never
 * leaves the page. That is partly a privacy property and partly the point — the
 * page is a way to see what a rule actually matches, and a round trip to a server
 * would make it feel like a search engine rather than a lens.
 *
 * No Quranic text is bundled. The sample below is ordinary vocalised Arabic
 * composed for this purpose; paste in whatever you want to look at.
 */

import corpus from '@tajweed/rules' with { type: 'json' }
import {
  Tajweed,
  TOPIC_COLORS,
  resolveOverlaps,
  sliceSpan,
  type Corpus,
  type Span,
} from '@tajweed/core'

const typed = corpus as unknown as Corpus

const SAMPLE = 'مَنْ تَكَلَّمَ سُوءًا فَقَدْ أَخْطَأَ وَٱلضَّآلِّينَ'

const input = document.querySelector<HTMLTextAreaElement>('#input')!
const output = document.querySelector<HTMLDivElement>('#output')!
const summary = document.querySelector<HTMLDivElement>('#summary')!
const topicFilter = document.querySelector<HTMLDivElement>('#topics')!
const overlapToggle = document.querySelector<HTMLInputElement>('#overlapping')!
const details = document.querySelector<HTMLDivElement>('#details')!

const enabledTopics = new Set(typed.topics.map((topic) => topic.id))

const ruleById = new Map(typed.rules.map((rule) => [rule.id, rule]))
const hukumById = new Map(typed.hukums.map((hukum) => [hukum.id, hukum]))
const topicById = new Map(typed.topics.map((topic) => [topic.id, topic]))

function buildTopicFilter(): void {
  for (const topic of typed.topics) {
    const label = document.createElement('label')
    label.className = 'chip'
    label.style.setProperty('--chip', TOPIC_COLORS[topic.id] ?? '#666')

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        enabledTopics.add(topic.id)
      } else {
        enabledTopics.delete(topic.id)
      }
      render()
    })

    const swatch = document.createElement('span')
    swatch.className = 'swatch'

    const text = document.createElement('span')
    text.textContent = topic.label.ar
    text.lang = 'ar'

    label.append(checkbox, swatch, text)
    topicFilter.append(label)
  }
}

function describe(span: Span): string {
  const hukum = hukumById.get(span.hukumId)?.label.ar ?? span.hukumId
  const rule = ruleById.get(span.ruleId)?.label.ar ?? span.ruleId
  return `${hukum} — ${rule}`
}

function render(): void {
  const text = input.value
  const engine = new Tajweed(typed, { only: [...enabledTopics] })
  const found = enabledTopics.size === 0 ? [] : engine.analyze(text)
  const shown = overlapToggle.checked
    ? [...found].sort((a, b) => a.start - b.start)
    : resolveOverlaps(found)

  output.replaceChildren()
  const characters = Array.from(text)
  let cursor = 0

  for (const span of shown) {
    if (span.start < cursor) {
      continue
    }
    if (span.start > cursor) {
      output.append(characters.slice(cursor, span.start).join(''))
    }

    const mark = document.createElement('span')
    mark.className = 'mark'
    mark.style.color = TOPIC_COLORS[span.topicId] ?? 'currentColor'
    mark.textContent = characters.slice(span.start, span.end).join('')
    mark.title = describe(span)
    mark.setAttribute('aria-label', describe(span))
    mark.addEventListener('click', () => showDetails(span, text))
    output.append(mark)

    cursor = span.end
  }

  if (cursor < characters.length) {
    output.append(characters.slice(cursor).join(''))
  }

  const ahkam = new Set(found.map((span) => span.hukumId))
  summary.textContent =
    found.length === 0
      ? 'No rule matched. That means no modelled rule matched — the corpus is silent outside the topics it covers.'
      : `${found.length} occurrences, ${ahkam.size} ahkam, ${new Set(found.map((s) => s.ruleId)).size} rules.`

  details.replaceChildren()
}

function showDetails(span: Span, text: string): void {
  const rule = ruleById.get(span.ruleId)
  const hukum = hukumById.get(span.hukumId)
  const topic = topicById.get(span.topicId)

  details.replaceChildren()

  const heading = document.createElement('h2')
  heading.lang = 'ar'
  heading.textContent = hukum?.label.ar ?? span.hukumId
  heading.style.color = TOPIC_COLORS[span.topicId] ?? 'inherit'

  const matched = document.createElement('p')
  matched.className = 'matched'
  matched.lang = 'ar'
  matched.textContent = sliceSpan(text, span)

  const rows = document.createElement('dl')
  const add = (term: string, value: string, isArabic = false): void => {
    const dt = document.createElement('dt')
    dt.textContent = term
    const dd = document.createElement('dd')
    dd.textContent = value
    if (isArabic) {
      dd.lang = 'ar'
    }
    rows.append(dt, dd)
  }

  add('rule', span.ruleId)
  add('topic', topic?.label.ar ?? span.topicId, true)
  if (rule) {
    add('description', rule.label.ar, true)
    add('case', rule.case, true)
    add('scope', rule.scope)
    if (rule.needsReview) {
      add('status', 'awaiting reviewer sign-off')
    }
    if (rule.notes) {
      add('notes', rule.notes.ar, true)
    }
  }
  if (hukum?.school) {
    add('school', hukum.school.scholar, true)
  }
  add('offsets', `${span.start}–${span.end} (code points)`)

  details.append(heading, matched, rows)
}

input.value = SAMPLE
input.addEventListener('input', render)
overlapToggle.addEventListener('change', render)
buildTopicFilter()
render()

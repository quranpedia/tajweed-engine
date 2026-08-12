/**
 * The playground's behaviour.
 *
 * Everything runs in the browser: the corpus, the engine and the text are all
 * bundled in, so nothing is sent anywhere and the page works offline. That is
 * partly a privacy property and partly the point — it is a lens on the corpus,
 * not a service.
 *
 * The ayah shown is real, selected from the edition, and rendered read-only.
 * Two rules meet here and only one arrangement satisfies both: Quranic text must
 * not be presented as editable, and text that is not from the mushaf must never
 * be shown where a reader would take it for Quran. So the mushaf is a pair of
 * dropdowns over verified text, and anything a user wants to try themselves goes
 * in a separate box that says what it is.
 */

import corpus from '@tajweed/rules' with { type: 'json' }
import edition from '../../editions/uthmani-hafs.json' with { type: 'json' }
import surahNames from './surahs.json' with { type: 'json' }
import {
  Tajweed,
  TOPIC_COLORS,
  orderedReferences,
  resolveOverlaps,
  sliceSpan,
  type Corpus,
  type Edition,
  type Span,
} from '@tajweed/core'

const typed = corpus as unknown as Corpus
const mushaf = edition as unknown as Edition
const names = surahNames as Array<{ number: number; name: string }>

const surahSelect = document.querySelector<HTMLSelectElement>('#surah')!
const ayahSelect = document.querySelector<HTMLSelectElement>('#ayah')!
const customInput = document.querySelector<HTMLTextAreaElement>('#custom')!
const output = document.querySelector<HTMLDivElement>('#output')!
const reference = document.querySelector<HTMLSpanElement>('#reference')!
const summary = document.querySelector<HTMLDivElement>('#summary')!
const topicFilter = document.querySelector<HTMLDivElement>('#topics')!
const overlapToggle = document.querySelector<HTMLInputElement>('#overlapping')!
const details = document.querySelector<HTMLDivElement>('#details')!

/** Ayah numbers per surah, counted from the edition rather than hardcoded. */
const ayahNumbers = new Map<number, number[]>()
for (const ref of orderedReferences(mushaf)) {
  const [surah, ayah] = ref.split(':').map(Number)
  ayahNumbers.set(surah!, [...(ayahNumbers.get(surah!) ?? []), ayah!])
}

const enabledTopics = new Set(typed.topics.map((topic) => topic.id))
const ruleById = new Map(typed.rules.map((rule) => [rule.id, rule]))
const hukumById = new Map(typed.hukums.map((hukum) => [hukum.id, hukum]))
const topicById = new Map(typed.topics.map((topic) => [topic.id, topic]))

function buildSurahs(): void {
  for (const { number, name } of names) {
    const option = document.createElement('option')
    option.value = String(number)
    option.textContent = `${number}. ${name}`
    option.lang = 'ar'
    surahSelect.append(option)
  }
}

function buildAyahs(): void {
  const surah = Number(surahSelect.value)
  const previous = Number(ayahSelect.value)
  ayahSelect.replaceChildren()

  for (const number of ayahNumbers.get(surah) ?? []) {
    const option = document.createElement('option')
    option.value = String(number)
    option.textContent = String(number)
    ayahSelect.append(option)
  }

  const available = ayahNumbers.get(surah) ?? []
  ayahSelect.value = String(available.includes(previous) ? previous : (available[0] ?? 1))
}

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

/** What is being analysed: the selected ayah, or the reader's own text. */
function subject(): { text: string; label: string } {
  const custom = customInput.value.trim()
  if (custom !== '') {
    return { text: custom, label: 'your text' }
  }
  const ref = `${surahSelect.value}:${ayahSelect.value}`
  return { text: mushaf.ayahs[ref] ?? '', label: ref }
}

function render(): void {
  const { text, label } = subject()
  const engine = new Tajweed(typed, { only: [...enabledTopics] })
  const found = enabledTopics.size === 0 || text === '' ? [] : engine.analyze(text)
  const shown = overlapToggle.checked
    ? [...found].sort((a, b) => a.start - b.start)
    : resolveOverlaps(found)

  reference.textContent = label
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
    mark.tabIndex = 0
    mark.addEventListener('click', () => showDetails(span, text))
    mark.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        showDetails(span, text)
      }
    })
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

surahSelect.addEventListener('change', () => {
  buildAyahs()
  render()
})
ayahSelect.addEventListener('change', render)
customInput.addEventListener('input', render)
overlapToggle.addEventListener('change', render)

buildSurahs()
// Al-Fatiha 1:7 to open on: long enough to carry several rulings at once, and it
// ends with the standard example of المد اللازم الكلمي المثقل.
surahSelect.value = '1'
buildAyahs()
ayahSelect.value = '7'
buildTopicFilter()
render()

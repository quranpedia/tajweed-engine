# @tajweed/core

Compiles the [tajweed rule corpus](../rules) and reports where each rule applies
in Quranic text.

```bash
npm install @tajweed/core @tajweed/rules
```

```ts
import corpus from '@tajweed/rules'
import { Tajweed, sliceSpan } from '@tajweed/core'

const tajweed = new Tajweed(corpus)

for (const span of tajweed.analyze(ayahText)) {
  console.log(span.hukumId, sliceSpan(ayahText, span))
}
```

## It returns offsets, not markup

```ts
interface Span {
  start: number      // code-point offset into the text YOU passed in
  end: number        // half-open
  ruleId: string     // 'madd-muttasil.1'
  hukumId: string    // 'madd-muttasil'
  categoryId: string // 'madd-far-hamz'
  topicId: string    // 'madd'
}
```

Colours, HTML, ANSI, SVG overlays and mushaf-page coordinates are all downstream
of this and all differ per platform. An engine that returns HTML is useful only
to the last person who needed HTML.

`start` and `end` count **code points**, not bytes and not UTF-16 units, so the
same offsets mean the same thing in PHP, Python and Swift. All Arabic and all
Quranic annotation marks are in the Basic Multilingual Plane, so for Quranic text
they are also valid JavaScript string indices — `sliceSpan` handles the general
case.

## Spans overlap, on purpose

One letter can demonstrate more than one ruling. `analyze` reports all of them;
deciding what to draw is a presentation question:

```ts
import { resolveOverlaps } from '@tajweed/core'

resolveOverlaps(spans) // earliest wins, longest wins on a tie
```

Anything teaching tajweed probably wants the overlaps rather than one layer.

## Choosing rules

```ts
new Tajweed(corpus, { only: ['madd'] })                    // a topic
new Tajweed(corpus, { only: ['madd-muttasil'] })           // a hukum
new Tajweed(corpus, { only: ['madd-muttasil.1'] })         // one rule
new Tajweed(corpus, { school: 'ibn-al-jazari' })           // pick a school
new Tajweed(corpus, { includeDisabled: true })             // for working ON the corpus
```

`school` matters where two authorities are modelled side by side — Ibn al-Jazarī
counts five ranks of tafkheem, Ibn al-Ṭaḥḥān counts three, and the corpus
represents both. Ahkam with no school attribution are always kept.

## Your text is never modified

Matching runs against an internal normalised form. Nothing in the pipeline
applies Unicode normalisation, strips diacritics, or drops waqf marks, and
`analyze` never returns a modified copy of your string — only offsets into it.

## Run it at build time

The Quran is a fixed corpus, so for production the expected shape is to annotate
every ayah once and ship the offsets, rather than compiling 174 patterns on every
request. Pin the text edition you computed against: the same rule lands on
different offsets in different editions of the Uthmani script.

## Licence

MIT. The rule corpus is a separate work under CC BY 4.0.

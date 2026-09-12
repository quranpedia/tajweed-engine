# @tajweed/core

Compiles the [tajweed rule corpus](../rules) and reports where each rule
applies in Quranic text.

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

## It returns positions, not markup

```ts
interface Span {
  start: number      // code-point position in the text YOU passed in
  end: number        // half-open
  ruleId: string     // 'madd-muttasil.1'
  hukumId: string    // 'madd-muttasil'
  categoryId: string // 'madd-far-hamz'
  topicId: string    // 'madd'
}
```

For example, analysing ayah 112:1 (قُلۡ هُوَ ٱللَّهُ أَحَدٌ) returns four spans, one
of which is:

```js
{ start: 22, end: 24, ruleId: 'qalqalah-kubra.1', hukumId: 'qalqalah-kubra', ... }
// sliceSpan(text, span) === 'دٌ'  — the final د of أَحَدٌ, with its tanween
```

Colours, HTML, ANSI, SVG overlays and mushaf-page coordinates all build on top
of this, and each platform needs a different one. Returning positions keeps the
engine useful for all of them; returning HTML would serve only one.

`start` and `end` count **code points**, not bytes and not UTF-16 units, so the
same numbers mean the same thing in PHP, Python and Swift. All Arabic and all
Quranic annotation marks sit in the Basic Multilingual Plane, so for Quranic
text the positions also work directly as JavaScript string indices —
`sliceSpan` handles the general case anyway.

## Spans overlap, on purpose

One letter can demonstrate more than one ruling, and `analyze` reports all of
them. Choosing what to draw is a display decision, not an engine decision:

```ts
import { resolveOverlaps } from '@tajweed/core'

resolveOverlaps(spans) // earliest wins, longest wins on a tie
```

An app that teaches tajweed probably wants to keep the overlaps rather than
flatten them to one layer.

## Choosing rules

```ts
new Tajweed(corpus, { only: ['madd'] })                    // a topic
new Tajweed(corpus, { only: ['madd-muttasil'] })           // a hukum
new Tajweed(corpus, { only: ['madd-muttasil.1'] })         // one rule
new Tajweed(corpus, { school: 'ibn-al-jazari' })           // pick a school
new Tajweed(corpus, { includeDisabled: true })             // for working ON the corpus
```

`school` matters where the corpus models two authorities side by side — Ibn
al-Jazarī counts five ranks of tafkheem, Ibn al-Ṭaḥḥān counts three, and both
are present. Ahkam with no school attribution are always kept.

## Your text is never changed

Matching runs on an internal normalised copy. Nothing in the pipeline applies
Unicode normalisation, strips diacritics, or drops waqf marks, and `analyze`
never returns a modified copy of your string — only positions into it.

## Run it at build time

The Quran is a fixed text, so for production the expected setup is: annotate
every ayah once and ship the positions, instead of compiling every pattern on
every request. Record which text edition you computed against — the same rule
lands on different positions in different editions of the Uthmani script.

## Licence

MIT. The rule corpus is a separate work under CC BY 4.0.

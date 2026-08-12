# @tajweed/react

```bash
npm install @tajweed/react @tajweed/rules @tajweed/annotations
```

```tsx
import corpus from '@tajweed/rules'
import annotations from '@tajweed/annotations'
import { TajweedText, TajweedLegend } from '@tajweed/react'
import { unpack } from '@tajweed/core'

<TajweedText text={ayahText} corpus={corpus} spans={unpack(annotations, corpus, '2:255')} />
<TajweedLegend corpus={corpus} />
```

Pass `spans` in production. The Quran is a fixed corpus, so there is no reason to
run a matching engine in a browser — look the ayah up in
[`@tajweed/annotations`](../annotations) instead. Omit `spans` and the component
analyses the text itself, which is what a playground or an arbitrary passage
needs.

## What it does that a `dangerouslySetInnerHTML` would not

**The text is never altered.** Characters are emitted exactly as given and React
escapes them on output, so what reaches the DOM is what you passed in.

**Waqf marks keep the surrounding colour.** They tell the reciter where to pause;
they are not part of the letter the ruling concerns.

**Every marked stretch carries its ruling in `aria-label`.** Colour alone conveys
nothing to a reader who cannot see it, which for something meant to teach
recitation defeats the point.

**Colour is keyed by topic, of which there are seven** — not by hukum, of which
there are 57. Past roughly a dozen, colours stop being distinctions.

Render `<TajweedLegend />`. The corpus covers seven topics and is silent outside
them, and an unlabelled wash of colour implies a completeness the data does not
have — see [docs/coverage.md](../../docs/coverage.md).

## Props

| Prop | |
|---|---|
| `text` | the ayah text, unmodified |
| `corpus` | pass `@tajweed/rules` |
| `spans` | precomputed spans; omit to analyse on the fly |
| `options` | engine options when `spans` is omitted (`only`, `school`) |
| `colors` | override the palette, keyed by topic id |
| `overlapping` | show every ruling rather than the topmost |
| `onSpanClick` | called with the span; makes each mark focusable |

MIT.

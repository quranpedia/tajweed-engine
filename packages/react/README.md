# @quran-ws/tajwid-react

```bash
npm install @quran-ws/tajwid-react @quran-ws/tajwid-rules @quran-ws/tajwid-annotations
```

```tsx
import corpus from '@quran-ws/tajwid-rules'
import annotations from '@quran-ws/tajwid-annotations'
import { TajweedText, TajweedLegend } from '@quran-ws/tajwid-react'
import { unpack } from '@quran-ws/tajwid'

<TajweedText text={ayahText} corpus={corpus} spans={unpack(annotations, corpus, '2:255')} />
<TajweedLegend corpus={corpus} />
```

Pass `spans` in production. The Quran is a fixed text, so there is no reason to
run a matching engine in the browser — look the ayah up in
[`@quran-ws/tajwid-annotations`](../annotations) instead. If you leave `spans` out, the
component analyses the text itself, which is what a playground or an arbitrary
passage needs.

## What it does that `dangerouslySetInnerHTML` would not

**The text is never altered.** Characters are emitted exactly as given, and
React escapes them on output, so what reaches the DOM is what you passed in.

**The word does not come apart where the colour changes.** A browser shapes
each element on its own, so a coloured stretch is drawn without seeing its
neighbours: `عَلَيۡهِمۡ` becomes `عَ` `لَيۡهِ` `مۡ`. Every cut is bridged with a
zero-width joiner where the letters either side join, and pushed past the marks
written on the letter it lands on. Both belong to the drawing: nothing reaches
the offsets or the text. `clusterEnd` and `bridgeJoins` are exported from
[`@quran-ws/tajwid`](../core) for anyone rendering this some other way — see
[docs/rendering.md](../../docs/rendering.md).

**Waqf marks keep the colour around them.** They tell the reciter where to
pause; they are not part of the letter the ruling is about.

**Every coloured stretch carries its ruling in `aria-label`.** Colour alone
says nothing to a reader who cannot see it — a serious flaw in something meant
to teach recitation.

**Colour is keyed by topic, of which there are seven** — not by hukum, of which
there are 57. Past roughly a dozen colours, readers stop being able to tell
them apart.

Render `<TajweedLegend />`. The corpus covers seven topics and says nothing
outside them; colour without a legend suggests the colouring is complete when
it is not — see [docs/coverage.md](../../docs/coverage.md).

## Props

| Prop | |
|---|---|
| `text` | the ayah text, unmodified |
| `corpus` | pass `@quran-ws/tajwid-rules` |
| `spans` | precomputed spans; leave out to analyse on the fly |
| `options` | engine options when `spans` is left out (`only`, `school`) |
| `colors` | override the palette, keyed by topic id |
| `overlapping` | show every ruling rather than only the topmost |
| `onSpanClick` | called with the span; makes each mark focusable |

MIT.

# Drawing an ayah that has been cut

The engine returns offsets, so every renderer built on it cuts the ayah into
pieces and gives each piece its own element. That is the only way to colour a
stretch of it — and it is also where Arabic breaks, twice, silently, with the
text still exactly right.

Both defects look like a font problem and send whoever meets them looking in the
wrong place. Neither raises anything.

## 1. The word comes apart at each change of colour

A browser shapes each inline element independently. A coloured stretch is its own
element, so the letters either side of the boundary never see each other and are
drawn in their isolated or final forms.

1:7 rendered without the fix reads `عَلَيۡهِمۡ` as `عَ` `لَيۡهِ` `مۡ` — three
detached pieces of one word.

The repair is a ZERO WIDTH JOINER on **both** sides of the cut, and it has to be
**conditional**:

- ء آ أ ؤ إ ا ة د ذ ر ز و ٱ never join to the letter after them. A joiner there
  asks for a medial form that does not exist, and the shaper answers with a
  visible tatweel stub — the word is then broken a second way rather than
  repaired.
- ء joins on neither side, so it is refused a joiner before it as well.

So a joiner pair is emitted only when the last base letter before the cut joins
forward **and** the first base letter after it joins back. At a space, at the end
of a word, after a rāʾ or an alef: nothing.

## 2. The cut lands inside a letter

A span ends on the letter its ruling concerns, and in the Uthmani script the
shadda or the harakah that letter carries is written after it. `ٱلرَّحۡمَٰنِ` has
the tafkheem on the rāʾ, and cutting at the raw offset puts the shadda at the
start of the next element, where it has no letter to sit on: it is drawn on a
dotted circle, or floating in the gap.

Every boundary — the start of a span as much as its end — is pushed past the
marks written on the letter it lands after.

Waqf signs are deliberately not part of a cluster. They sit between words, and a
cluster ends at one. The join still runs through them, which is why a waqf mark
broken out into its own element is bridged on both sides.

## Both are exported

```ts
import { bridgeJoins, clusterEnd } from '@quran.ws/tajwid'

const start = clusterEnd(text, span.start)
const end = clusterEnd(text, span.end)

// The chunks a renderer is about to emit, in the order they will be drawn.
const [before, coloured, after] = bridgeJoins([
  text.slice(0, start),
  text.slice(start, end),
  text.slice(end),
])
```

`toHtml` and `@quran.ws/tajwid-react` use both, so a consumer of either gets this
for free. They are exported because anyone writing their own renderer — an SVG
overlay, a canvas, a native view — meets exactly the same two problems, and
neither is discoverable from the symptom.

## The joiners belong to the drawing, and to nothing else

Offsets, `sliceSpan`, counts and anything copied back out stay on the original
string. A joiner is a request to a shaper; it is not part of the text, it must
never reach a clipboard as though it were, and it must never be counted.

`toAnsi` therefore adds none: a terminal does not shape across an escape code.

## Where this came from

Found building the tajwīd demos on quran.ws — the first consumption of this
package from outside. Both renderers there shipped the bug, and both renderers
here did too. See issue #31.

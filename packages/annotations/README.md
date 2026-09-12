# @quran.ws/tajwid-annotations

Precomputed tajweed annotations for the whole muṣḥaf: **147,255 spans** from
**164 rules**, across **6,235 of the 6,236 āyāt** of the riwāyah of
**Ḥafṣ ʿan ʿĀṣim**.

This package is data only. It has no dependencies and no code. It exists so an
app can render tajweed without shipping the engine — the engine that produced
it is [`@quran.ws/tajwid`](../core), running the corpus in
[`@quran.ws/tajwid-rules`](../rules).

```bash
npm install @quran.ws/tajwid-annotations
```

```js
import annotations from '@quran.ws/tajwid-annotations'

annotations.corpusVersion   // '0.4.2'
annotations.riwayah         // 'hafs-an-asim'
annotations.edition.sha256  // 'b5d29736…' — the text these offsets are measured against
annotations.ruleIds.length  // 164
```

## The shape

`spans` is keyed by `"surah:ayah"`, and each span is a packed triple:

```js
annotations.spans['1:1']
// [[8, 10, 52], [17, 18, 22], [22, 25, 129], [30, 31, 22], [33, 36, 131]]
//    ↑   ↑   ↑
//    │   │   └─ index into annotations.ruleIds
//    │   └───── end, half-open
//    └───────── start — a code-point position, not a UTF-16 index
```

```js
const [start, end, rule] = annotations.spans['1:1'][0]
annotations.ruleIds[rule]                  // 'mutamathilain-idgham-kamil.23'
[...ayahText].slice(start, end).join('')   // 'لل'
```

Offsets are **code-point positions**, so index with `[...text]` or
`Array.from(text)`, never with `text.slice`. Arabic text at these positions is
full of combining marks, and a UTF-16 index will cut through one.

An āyah with no rulings is **omitted from `spans` entirely** rather than stored
as an empty array. Exactly one is: `20:1` (طه), whose disjoined letters the
corpus does not yet match. Treat a missing key as "no spans", not as an error.

## What the offsets are measured against

Everything here is pinned to one text. `edition.sha256` is the digest of the
Uthmani Ḥafṣ edition in [`editions/`](../../editions), and `edition.ayahCount`
is 6,236.

**Check that digest before you use these offsets.** If your text differs from
that edition by a single code point — a different normalisation, a stripped
mark, a different waqf convention — every span after that point is wrong, and
nothing will tell you. If the digests do not match, run
[`@quran.ws/tajwid`](../core) over your own text instead of using this package.

## No Quranic text is distributed here

This package contains offsets and rule ids. The text itself is not in it, by
design — bring your own, matching the digest above.

## Licence

CC BY 4.0 — see [LICENSE](./LICENSE). The code in this repository is MIT; the
corpus and these annotations are not.

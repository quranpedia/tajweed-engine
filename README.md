# tajweed-engine

Tajweed annotations for Quranic text.

Most tajweed libraries hard-code a few rules and output coloured HTML. This
project splits the work in two parts:

- **A rule corpus**: 182 tajweed rules, written by scholars in a compact Arabic
  notation.
- **An engine** that reads those rules and reports where each one applies in the
  text — as positions in the text, not markup.

The engine has already been run over the whole mushaf, and the results are
published as a dataset. So for most uses, you never need to run the engine at
all.

## Start here

**If you want to display coloured text**, use the pre-computed dataset. It holds
149,223 spans covering all 6,236 ayahs, tied to a digest of the exact text it
was computed from. No engine, no Arabic processing, no regular expressions at
runtime — look up an ayah and you have its positions.

```bash
npm install @tajweed/annotations @tajweed/rules @tajweed/core
```

```js
import annotations from '@tajweed/annotations'
import corpus from '@tajweed/rules'
import { unpack } from '@tajweed/core' // unpack is a small reader; it runs no matching

const spans = unpack(annotations, corpus, '112:1')
// [ { start: 0, end: 2, ruleId: 'tafkheem-rank-2-tahhan.1', ... },
//   ...
//   { start: 22, end: 24, ruleId: 'qalqalah-kubra.1', ... } ]
```

**If you want to ask questions about the rules** — for example, *which ayahs
show madd munfaṣil?* — or annotate your own text edition, use the engine
([`@tajweed/core`](./packages/core)).

Either way, read [what the rules cover and what they do not](./docs/coverage.md)
first. The corpus goes deep in seven topics and says nothing outside them. If
your UI does not say so, a reader cannot tell "no rule applies here" apart from
"this rule was never included".

## Packages

| Package | What it is |
|---|---|
| [`@tajweed/annotations`](./packages/annotations) | The pre-computed dataset. Positions only, no text. CC BY 4.0. |
| [`@tajweed/rules`](./packages/rules) | The rule corpus. Versioned JSON + schema, no code. CC BY 4.0. |
| [`@tajweed/core`](./packages/core) | The engine: normalise → match → spans. MIT. |
| [`@tajweed/react`](./packages/react) | `<TajweedText />` and a legend. MIT. |
| [`@tajweed/cli`](./packages/cli) | Query the rules, annotate text, check an edition. MIT. |
| [`tajweed`](./python) | Python reader for the dataset. Stdlib only. MIT. |

There is also a **[playground](https://quranpedia.github.io/tajweed-engine/)**
where you can pick a rule and see what it actually matches. It is one
self-contained HTML file with no build step and no network calls, so it also
works offline and straight from disk.

## Design

**You must say which riwayah your text is.** The corpus is for Hafs ʿan ʿĀsim.
Other riwayat differ in both the rulings and the spelling of the text, so
running these rules on a Warsh text produces wrong answers. The tools treat
that as an error, not as a setting you can flip.

**The output is positions, not HTML.** `analyze()` returns
`{ start, end, ruleId, … }` measured against the text you passed in. For
example, for ayah 112:1 one of the spans is `{ start: 22, end: 24, ruleId:
'qalqalah-kubra.1' }` — the final د of `أَحَدٌ`, with its tanween. Rendering is a
separate layer you can replace, so the engine is just as useful outside a web
page.

**Your text is never changed.** Matching runs on an internal normalised copy,
and every match is mapped back to positions in *your* string. The normaliser
builds that mapping as it works, instead of searching for the match a second
time. Nothing in the pipeline applies Unicode normalisation, strips diacritics,
or drops waqf marks.

**Positions count code points**, so the same numbers mean the same thing in
every language — not bytes (PHP), not UTF-16 units (JavaScript).

**The Quran is a fixed text**, so the engine is as much a build-time tool as a
runtime one. The expected production setup is: annotate all 6,236 ayahs once,
ship the positions, and never run the engine in front of a user.

## Using your own text edition

The published annotations describe one specific edition. If your text differs
even slightly, the positions point at different letters. Run
`pnpm edition:check <file>` to measure the difference instead of guessing.
See [docs/editions.md](./docs/editions.md).

## Quranic text in this repository

**None of the published packages contain any.** `@tajweed/rules` is patterns,
`@tajweed/annotations` is positions, `@tajweed/core` is code. This is on
purpose: the packages make no claim to distribute a mushaf, and the question
*which edition is this?* stays explicit — the same rule lands on different
positions in different editions of the Uthmani script.

The **repository** does contain one edition, at
[`editions/uthmani-hafs.json`](./editions/uthmani-hafs.json) — the text
published at [tajweed.quranpedia.net](https://tajweed.quranpedia.net). The
playground shows real ayahs, and the conformance suite needs real text to check
against, so the edition lives here instead of being fetched.

Wherever text is shown, it is read-only and taken from that edition. Nothing in
this project makes up Arabic to stand in for Quranic text: made-up text in that
position would read as Quran to whoever sees it, which is worse than the
problem it avoids. Tests that need a specific character sequence build it from
named code points instead, which no one can mistake for text.

## Where this comes from

The rules and the engine are a port of the tajweed system behind
[tajweed.quranpedia.net](https://tajweed.quranpedia.net), where the rules were
compiled and have been in use. The port was checked against that implementation
over the whole mushaf — the normalised text compared character by character,
and each rule's set of matching ayahs compared set by set — and the results are
frozen in [`conformance/`](./conformance).

It powers
[the tajweed researcher](https://tajweed.quranpedia.net/tajweed-researcher):
pick a ruling and see every ayah that shows it, with the relevant letters
marked. That use case shaped the whole project, and it is why the engine
reports positions rather than markup — the same annotations drive a reader, a
search, and a lesson.

Differences introduced by the port, and corrections made along the way, are
recorded in [docs/divergences.md](./docs/divergences.md).

## Licence

Code is MIT. The rule corpus is CC BY 4.0 and is a separate work — see
[`packages/rules/LICENSE`](./packages/rules/LICENSE).

# tajweed-engine

A rule-driven tajweed engine for Quranic text.

Most tajweed libraries hard-code a handful of rules and colour the result. This
one separates the two halves of the problem: a **scholar-authored corpus** of 182
rules written in a compact Arabic notation, and an **engine** that compiles those
rules and reports where they match — as offsets, not markup.

Then it runs the engine over the whole mushaf once and ships the answer, so that
using it does not require running it.

## Start here

**If you want to display coloured text**, take the pre-annotated dataset. It is
149,223 spans over all 6,236 ayahs, computed by the engine below and pinned to
the digest of the text it was computed against. No engine, no Arabic processing, no
regular expressions at runtime — look up `2:255` and you have your offsets.

```bash
npm install @tajweed/annotations @tajweed/rules
```

**If you want to ask questions of the corpus** — *which ayahs demonstrate madd
munfaṣil?* — or annotate a text edition of your own, use the engine.

Either way, read [what the corpus does and does not cover](./docs/coverage.md)
first. It is deep in seven topics and silent outside them, and silence is
indistinguishable from "no rule applies here" unless you say so in your UI.

## Packages

| Package | What it is |
|---|---|
| [`@tajweed/annotations`](./packages/annotations) | The precomputed dataset. Offsets only, no text. CC BY 4.0. |
| [`@tajweed/rules`](./packages/rules) | The corpus. Versioned JSON + schema, no code. CC BY 4.0. |
| [`@tajweed/core`](./packages/core) | The engine: normalise → match → spans. MIT. |
| [`@tajweed/react`](./packages/react) | `<TajweedText />` and a legend. MIT. |
| [`@tajweed/cli`](./packages/cli) | Query the corpus, annotate text, verify an edition. MIT. |
| [`tajweed`](./python) | Python reader for the dataset. Stdlib only. MIT. |

There is also a **[playground](https://quranpedia.github.io/tajweed-engine/)** for
looking at what a rule actually matches — one self-contained HTML file, no build
step and no network, so it works offline and from disk too.

## Design

**Riwayah is declared, not assumed.** The corpus is Hafs ʿan ʿĀsim. Both the
rulings and the underlying orthography differ between riwayat, so applying it to
a Warsh text is a data error rather than a configuration option.

**Output is spans, not HTML.** `analyze()` returns `{ start, end, ruleId, … }`
against the text you passed in. Rendering is a separate, replaceable layer —
otherwise the engine is useless to anyone not building a web page.

**The source text is never modified.** Matching runs against an internal
normalised form, and every match is mapped back to offsets in *your* string. The
normaliser builds that mapping as it goes rather than searching for the match a
second time. Nothing in the pipeline applies Unicode normalisation, strips
diacritics, or drops waqf marks.

**Offsets are code-point indices**, so they mean the same thing in every
language. Not bytes (PHP), not UTF-16 units (JavaScript).

**The Quran is a fixed corpus**, so the engine is a build-time tool as much as a
runtime one. Annotating all 6,236 ayahs once and shipping the offsets is the
expected way to use this in production.

## Using your own text edition

The annotations describe one edition. If yours differs, the offsets point at
different letters — `pnpm edition:check <file>` measures that rather than assuming
it. See [docs/editions.md](./docs/editions.md).

## Quranic text in this repository

**None of the published packages contain any.** `@tajweed/rules` is patterns,
`@tajweed/annotations` is offsets, `@tajweed/core` is code. That is deliberate:
it keeps them free of any claim to distribute a mushaf, and it makes the question
*which edition?* explicit rather than assumed, since the same rule lands on
different offsets in different editions of the Uthmani script.

The **repository** does contain one edition, at
[`editions/uthmani-hafs.json`](./editions/uthmani-hafs.json) — the text published
at [tajweed.quranpedia.net](https://tajweed.quranpedia.net). The playground shows
real ayahs, and the conformance suite needs real text to check against, so it is
here rather than fetched.

Wherever text is shown, it is shown read-only and taken from that edition.
Nothing in this project invents Arabic to stand in for Quranic text: a composed
phrase in that position reads as Quran to whoever sees it, which is worse than
the problem it avoids. Tests that need to exercise one mechanism build their
input from named code points instead, which is not text at all.

## Where this comes from

The corpus and the engine are a port of the tajweed system behind
[tajweed.quranpedia.net](https://tajweed.quranpedia.net), which is where the
rules were compiled and where they have been in use. The port was checked against
that implementation over the whole mushaf — normalised text compared character
for character, and rule-to-ayah incidence compared set for set — and the results
are frozen in [`conformance/`](./conformance).

It powers
[the tajweed researcher](https://tajweed.quranpedia.net/tajweed-researcher):
pick a ruling and see every ayah that demonstrates it, with the relevant letters
marked. That is the question this project is shaped around, and it is why the
engine reports offsets rather than markup — the same annotations drive a reader,
a search, and a lesson.

Differences introduced by the port, and the corrections made along the way, are
recorded in [docs/divergences.md](./docs/divergences.md).

## Licence

Code MIT. The rule corpus is CC BY 4.0 and is a separate work — see
[`packages/rules/LICENSE`](./packages/rules/LICENSE).

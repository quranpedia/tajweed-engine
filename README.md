# Quran Tajweed

Where every recitation rule applies in the muṣḥaf, published as character
positions rather than coloured markup — so the Qurʾānic text you hold is never
rewritten.

| Package | Version | Spans | Rules |
|---|---|---|---|
| `@tajweed/annotations` — **not yet published to npm** | `0.1.0`, corpus `0.4.2` | 147,255 | 182 authored, 164 compiled, 127 producing spans |

*Tajwīd* is the set of rules that govern how the Qurʾān is pronounced when it is
recited: where a sound is lengthened, merged into the next, held silent, or read
with a heavier articulation. Plain-English definitions of every term used below
are at <https://quran.ws/docs/concepts/glossary/#tajweed>.

Most tajwīd libraries hard-code a handful of rules and return coloured HTML.
This one separates the two halves of the problem: a corpus of rules written by
scholars in a compact Arabic notation, and an engine that reports *where* each
rule applies. The engine has already been run over the whole muṣḥaf, so for most
uses you never run it — you read the result.

---

## What it provides

| File | What it is | Contains Qurʾānic text? |
|---|---|---|
| `packages/annotations/uthmani-hafs.json` | 147,255 precomputed spans for the whole muṣḥaf, plus a SHA-256 digest of the exact text they were measured against | No — positions only |
| `packages/rules/rules.json` | The corpus: 7 topics → 27 categories → 58 aḥkām → 182 rules, with Arabic labels and a JSON schema | No — patterns only |
| `packages/core` | The engine: normalise → match → spans. Also unpacks the precomputed file | No |
| `packages/react` | `<TajweedText />` and a legend | No |
| `packages/cli` | Query the rules, annotate your own edition, check an edition | No |
| `python/` | Stdlib-only reader for the precomputed dataset | No |
| `editions/uthmani-hafs.json` | The one text edition the published positions describe, keyed `"1:1"` | **Yes** |

The split is deliberate. Positions carry no text, so an annotation set can be
distributed where a muṣḥaf cannot, and the question *which edition is this?*
stays explicit instead of assumed.

Counts read from the data, not from prose — run these in a clone:

```console
$ node -e 'const a=require("./packages/annotations/uthmani-hafs.json");
  let n=0; for (const k in a.spans) n+=a.spans[k].length;
  console.log(a.corpusVersion, n, Object.keys(a.spans).length, a.ruleIds.length)'
0.4.2 147255 6235 164
```

```console
$ node -e 'const r=require("./packages/rules/rules.json");
  console.log(r.topics.length, r.categories.length, r.hukums.length, r.rules.length)'
7 27 58 182
```

### The spans are offsets into *this* edition's text, and nothing warns you

This is the one thing to get right before you render anything.

`[start, end, ruleIndex]` counts **code points into
`editions/uthmani-hafs.json`**, not into your own text and not into words you
assembled yourself. If your string differs by a single code point, every
position after it lands on the wrong letter — and you get wrong colours, not an
error.

We shipped exactly that bug. Joining [Quran Text](https://quran.ws/blocks/quran-text/)'s
Ḥafṣ words with a single space produces a string identical to this edition in
**319 of 6,236 ayahs**:

```
quran-text Hafs words joined by " "  vs  editions/uthmani-hafs.json
ayahs 6236   identical 319   different 5917
```

Al-Fātiḥah is one of the ayahs where the result looks close enough to pass a
demo — which is why it passed ours. It does not survive checking:

```
al-Fatiha: 59 spans, 11 landing on different characters when indexed into the join
```

The join was also the wrong way to read quran-text: its waqf, sajdah and
division signs are a separate layer, and the words alone are a text those signs
have been removed from. Asking quran-text for the Ḥafṣ it serves, rather than
assembling one, brings the two editions to within **4 āyahs**:

```
$ pnpm import:quran-text
$ pnpm edition:diff editions/uthmani-hafs.json editions/hafs-quran-text.json
  6236 ayahs compared
  2715 byte-identical as they stand
  6232 once tanween is allowed for — positional tanween against open tanween
  4 left over — what the classes above do not account for:
      11:41  U+06EA -> U+065C ; U+065E -> U+08F1 ; U+065E -> U+08F1
      27:20  — -> U+0020 (word separation only)
      36:22  — -> U+0020 (word separation only)
      52:37  U+06DC -> U+06E3
```

The declared classes are the order the marks stacked on one letter are stored in,
precomposed letters against a base plus a combining mark, and the two families of
tanwīn. All are handled in the normaliser; none is a difference in the text. On
these two editions only the tanwīn class does any work — quran-text stopped
applying NFC, so the other two reconcile nothing and are kept because they are
real differences between Uthmani editions in general.

The four left over are **not** differences in the letters, and the earlier
wording here said they were. Two are word separation, one is the same ruling
written with two different code points, and one is unresolved. Strip every
combining mark, annotation sign, tatweel and hamza mark and compare the bare
skeletons across all 6,236 āyahs, and the two editions differ in **2** places
with spaces significant and in **0** ignoring spaces. The two that remain —
27:20 and 36:22 — are a question about word division, raised upstream rather
than decided here.

The fix is still not normalising your own text. Either render the edition's own
text, or run yours through `pnpm edition:check`, and check the digest either way.
See [`docs/editions.md`](./docs/editions.md) and, for where the text itself comes
from, [`docs/text-source.md`](./docs/text-source.md).

### What the corpus does not cover

The corpus goes deep in seven topics and says **nothing at all** outside them,
so silence never means "no rule applies here". Read
[`docs/coverage.md`](./docs/coverage.md) before you ship a reader.

- Exactly one ayah carries no annotation: **20:1** `طه`. Its ruling is a
  madd on a disjoined letter's spelled name, which no rule in the corpus
  describes. That is why the file has 6,235 keys, not 6,236 — ayahs with no
  match are omitted rather than stored empty, so "no rule matched" stays
  distinguishable from "not computed".
- **18 of the 182 rules are disabled** and produce no spans. Each ships with the
  reason the notation cannot yet express it, rather than being deleted.
- **12 rules are flagged `needsReview`** and travel with that flag, so you can
  tell what has not been signed off without reading commit history.
- Not covered at all: mid-ayah qalqalah on a stop the reciter chooses, مد الفرق,
  مد الصلة الكبرى, السكت, waqf and ibtidāʾ rulings, and the rules of the
  isti'ādhah and basmalah.

If your interface colours text without saying which rules are shown, a reader
cannot tell an absent rule from an absent ruling.

## Use it when you need

- Tajwīd highlighting over text you do not want modified
- To ask which ayahs demonstrate a given ruling — a lesson, a search, a drill
- To annotate your own text edition, and know how far it diverges from this one
- Positions that mean the same thing in JavaScript, Python, PHP and Swift

## Not for

| You want | Use |
|---|---|
| The Qurʾānic text itself — no published package here contains any | [Quran Text](https://quran.ws/blocks/quran-text/) |
| To colour a printed, vectorised page rather than a string | [Quran SVG Elements](https://quran.ws/blocks/quran-svg-elements/), which addresses the word and the mark inside a page |
| To draw those spans over a page on a phone, fast | [Quran Engine](https://quran.ws/blocks/quran-engine/) |
| Ready-made coloured HTML | Nothing here returns markup. `@tajweed/react` renders; everything else reports positions |
| Tajwīd for Warsh, Qālūn, al-Dūrī or any other riwayah | Nothing yet. The corpus is Ḥafṣ only, and the tools refuse other riwayāt rather than produce plausible-looking wrong answers |

## See it work

- **[quran.ws/blocks/quran-tajweed/](https://quran.ws/blocks/quran-tajweed/)** —
  the real spans over al-Fātiḥah, rendered on the edition's own text. Hover a
  span and the corpus names the ruling in its own Arabic; a second view lists
  every rule that fires and how often; a third shows the offsets beside the
  text, with nothing wrapped around the Qurʾān.
- **[The playground](https://quran-ws.github.io/quran-tajweed/)** — pick a
  rule, see what it actually matches. One self-contained HTML file, no build
  step and no network calls, so it works offline and straight from disk.

The colours in any such demo are a **presentation choice**, not data. The corpus
assigns no colours, and the scholarly colour conventions of a printed tajwīd
muṣḥaf are not reproduced here. A UI that colours text should say which scheme
it follows, or a reader cannot tell what a colour means.

## Supported riwayat

One: **Ḥafṣ ʿan ʿĀṣim** — the reading transmitted by Ḥafṣ from his teacher ʿĀṣim,
and the one most printed muṣḥafs use
([riwayah](https://quran.ws/docs/concepts/glossary/#riwayah)).

Other riwayāt differ in both the rulings and the spelling of the text, so
pointing these rules at a Warsh or Qālūn edition gives wrong answers. The tools
treat that as an error, not a setting you can flip.

## Provenance

| | |
|---|---|
| Source | The tajwīd system behind [tajweed.quranpedia.net](https://tajweed.quranpedia.net), where the rules were compiled and have been in use |
| Port check | Every rule compared against that implementation over the whole muṣḥaf — normalised text character by character, each rule's matching ayahs set by set — frozen in [`conformance/`](./conformance) |
| Edition | `uthmani-hafs`, 6,236 ayahs, exported from tajweed.quranpedia.net. Where that text came from before it was not recorded — see [`docs/text-source.md`](./docs/text-source.md) |
| Second edition | `hafs-quran-text`, built by `pnpm import:quran-text` from [Quran Text](https://quran.ws/blocks/quran-text/), which records the KFGQPC package and its SHA-256. The published spans are not measured against it yet |
| Edition digest | `b5d29736bb3ef49d9d331c4e60a59d83fe899b921e9e8dc35911bd4a18ce55f3` |
| Divergences | Recorded in [`docs/divergences.md`](./docs/divergences.md) |

The digest is reproducible in a dozen lines: hash `ref` + `NUL` + `text` for
every ayah in muṣḥaf order, joined by `\x01`, as SHA-256. If your edition
reproduces that value, the published positions describe your text exactly.

**No published package contains Qurʾānic text.** The repository holds one
edition because the playground shows real ayahs and the conformance suite needs
real text to check against. Nothing in the project invents Arabic to stand in
for Qurʾānic text: made-up text in that position would read as Qurʾān to whoever
sees it, which is worse than the problem it avoids. Tests that need a specific
character sequence build it from named code points.

## Quick start

**There is no install line, because none of the packages are published.**
`@tajweed/annotations`, `@tajweed/rules`, `@tajweed/core`, `@tajweed/react` and
`@tajweed/cli` all return 404 on the npm registry today, and `tajweed` returns
404 on PyPI. Publication is intended; until then, read the files directly.

The most recent release is `v0.4.0`, and it is behind `main`: it carries corpus
`0.4.0` and 145,105 spans, against `0.4.2` and 147,255 in the repository. Both
describe the same edition, so both agree with the digest above.

```sh
# the precomputed spans and the rule corpus, from the release
curl -LO https://github.com/quran-ws/quran-tajweed/releases/download/v0.4.0/tajweed-annotations-uthmani-hafs-v0.4.0.json
curl -LO https://github.com/quran-ws/quran-tajweed/releases/download/v0.4.0/tajweed-rules-v0.4.0.json

# the text the offsets are measured against — repository only, not a release asset
curl -L -o edition.json https://raw.githubusercontent.com/quran-ws/quran-tajweed/v0.4.0/editions/uthmani-hafs.json
```

```js
// tajweed.mjs
import { readFileSync } from "node:fs";
const read = (f) => JSON.parse(readFileSync(f, "utf8"));

const ann = read("tajweed-annotations-uthmani-hafs-v0.4.0.json");
const text = read("edition.json").ayahs["112:1"];   // the edition the offsets describe

for (const [start, end, rule] of ann.spans["112:1"]) {
  console.log([...text].slice(start, end).join(""), "\t", ann.ruleIds[rule]);
}
```

```console
$ node tajweed.mjs
قُ 	 tafkheem-rank-2-tahhan.1
قُ 	 tafkheem-rank-3-jazari.1
لل 	 mutamathilain-idgham-kamil.23
دٌ 	 qalqalah-kubra.1
```

Three things that catch everyone:

1. The third element is an **index into `ruleIds`**, not a rule id. Treating it
   as an id returns `undefined` for every span.
2. **Spans overlap on purpose** — one letter can demonstrate more than one
   ruling, and all of them are reported. Which to draw is a display decision;
   `resolveOverlaps` in `@tajweed/core` flattens them if you want that.
3. **Every label in the corpus is Arabic only.** There are no English or
   transliterated labels on the 7 topics, the 58 aḥkām or the 182 rules, so a
   non-Arabic interface has to supply its own mapping — and that mapping is a
   translation of scholarly terms, which deserves review.

To go the other way — run the rules over your own text rather than read
precomputed positions — clone the repository and use `@tajweed/core`:
`new Tajweed(corpus).analyze(text)` returns `{ start, end, ruleId, hukumId,
categoryId, topicId }`, measured against the string you passed in. Your text is
never modified: matching runs on an internal normalised copy and every match is
mapped back.

## Works with

| Block | Why |
|---|---|
| [Quran Text](https://quran.ws/blocks/quran-text/) | The text the rules describe — but join it through the edition check above, never by concatenating words |
| [Quran Engine](https://quran.ws/blocks/quran-engine/) | Projects spans as layered styles over a rendered page on mobile, where SVG does not perform |
| [Quran SVG Elements](https://quran.ws/blocks/quran-svg-elements/) | Colour a mark inside a printed page rather than a stretch of a string |

## Documentation

- [What the rules cover, and what they do not](./docs/coverage.md) — read first
- [Using a different text edition](./docs/editions.md)
- [The CASE notation](./docs/case-notation.md)
- [Divergences from the source system](./docs/divergences.md)
- Long form, with no Qurʾānic background assumed:
  [quran.ws/docs/reference/quran-tajweed/](https://quran.ws/docs/reference/quran-tajweed/)

## Licence

| What | Licence |
|---|---|
| Code — `@tajweed/core`, `@tajweed/react`, `@tajweed/cli`, `python/` | MIT |
| The rule corpus — `@tajweed/rules` | CC BY 4.0, as a separate work ([`packages/rules/LICENSE`](./packages/rules/LICENSE)) |
| The precomputed annotations — `@tajweed/annotations` | CC BY 4.0 |

The text edition in `editions/` is not covered by either and is not published as
a package.

# @tajweed/rules

The tajweed rule corpus: **7 topics → 27 categories → 58 ahkam → 183 rules**, for the riwayah of **Hafs ʿan ʿĀsim**.

This package is data only. It has no dependencies and no code. The engine that
runs it lives in [`@tajweed/core`](../core).

```bash
npm install @tajweed/rules
```

```js
import corpus from '@tajweed/rules'

corpus.riwayah // 'hafs-an-asim'
corpus.rules.filter((rule) => rule.status === 'stable').length // 164
```

## Shape

```
topics      →  categories  →  hukums      →  rules
التفخيم والترقيق  مراتب التفخيم   مرتبة التفخيم الأولى  [ خَ صَ ضَ غَ طَ قَ ظَ] + ا
```

A **rule** is one matchable pattern. A **hukum** is the ruling those patterns
demonstrate. Rules are what an engine runs; ahkam are what a reader is taught.
For example, the hukum `madd-muttasil` (المد الواجب المتصل) is one ruling, but it
takes three rules to match it — one each for madd by alef, waw and yaa.

Every id is a stable slug (`madd-muttasil.2`), namespaced under its hukum.
These slugs are the only identifiers in the corpus, and they are the contract:
join on them, store them, and expect them not to change.

## The CASE notation

Documented in full in [docs/case-notation.md](../../docs/case-notation.md).
`case` is a compact Arabic notation, designed so that someone qualified in
tajweed but not in programming can write and check a rule:

| Notation | Meaning |
|---|---|
| `[ا ب ت]` | any one of these — space separates alternatives |
| `+` | followed by |
| `ــــ` | a wildcard — any single character |
| `نهاية الكلمة` | end of a word — a position, not a character |
| `بداية الكلمة` | start of a word |
| `الألف الخنجرية` | ٰ (U+0670), named because it is hard to type |
| `واو صغيرة` / `ياء صغيرة` | ۥ (U+06E5) / ۦ (U+06E6) |

So `نْ + [ذ ث ك ج ش س د ز ف ت]` reads as "a sakin noon, followed by any one of
these letters" — one of the إخفاء rules.

`scope` says what may sit between two groups: `within-word` allows no space at
all, `across-words` requires a separator, `either` allows one. Diacritics and
Quranic annotation marks are always allowed between groups, in every scope.

## Status, and why disabled rules ship anyway

164 rules are `stable`. 18 are `disabled` — published, but not matched by
default.

They are kept rather than deleted because a silently missing rule looks exactly
like a rule that was never written. Each disabled rule records a `gap` naming
what the CASE notation cannot yet say:

| Gap | Rules | What is missing |
|---|---|---|
| `ambiguous-wildcard` | 6 | A group mixing `ــ` with a multi-part sequence compiles as alternatives, because space separates alternatives |
| `unsupported-optional-group` | 3 | `[همزة وصل أو بدون]` — an optional part |
| `unsupported-exception` | 2 | `باستثناء كلمة فرق` — excluding one case from a group |
| `unsupported-negation` | 2 | `وليس بعده ألف` — a rule defined by what does *not* follow |
| `needs-rule-composition` | 2 | "any letter ruled tafkheem" — depends on other rules' results |
| `not-a-pattern` | 2 | Prose naming specific words at specific places |
| `unsupported-token` | 1 | Hamzat wasl as a named group |

Together, this table is the to-do list for the next version of the notation,
not a list of bugs.

## Scholarly disagreement is modelled, not resolved

Where authorities differ, each position is its own hukum, tagged with a
`school`. The clearest case is the ranks of tafkheem: Ibn al-Jazarī counts
five, Ibn al-Ṭaḥḥān al-Andalusī counts three. Both are in the corpus. An app
that needs a single answer must pick a school; an app that teaches tajweed may
want to show that the disagreement exists.

## Corrections

A rule that was changed from its source carries a `corrections` entry recording
the previous value and the evidence, and is flagged `needsReview: true` until a
qualified reviewer signs it off. The rule still matches in the meantime — the
flag exists so the change stays visible instead of being buried in a diff.

Four rules currently carry corrections, and eight more were newly written
rather than migrated. All twelve are flagged `needsReview`. See
[CONTRIBUTING.md](../../CONTRIBUTING.md) for what changing a rule requires.

## Reading the text as printed

A rule may set `matchAgainst: "original"`, meaning its pattern is written
against the mushaf as printed rather than against the engine's normalised form.
Only two rules do. المد اللازم الحرفي is identified by a maddah sitting over a
consonant, which happens nowhere except the disjoined letters — and
normalisation removes that mark on purpose, exactly so that no ordinary rule
sees it.

## Licence

CC BY 4.0 — see [LICENSE](./LICENSE). The code in this repository is MIT; the
corpus is not.

No Quranic text is distributed in this package.

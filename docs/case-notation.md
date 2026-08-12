# The CASE notation

`case` is how a rule says what it matches. It exists so that a rule can be
written and audited by someone qualified in tajweed but not in programming:

```
نْ + [ذ ث ك ج ش س د ز ف ت]
```

reads as "a sakin noon, followed by any one of these letters".

## Syntax

| | |
|---|---|
| `[ا ب ت]` | any one of these — **space separates alternatives** |
| `+` | followed by |
| `ــــ` | a wildcard letter (any run of tatweel) |
| `نهاية الكلمة` | the end of a word — a position, not a character |
| `بداية الكلمة` | the start of a word |
| `الألف الخنجرية` | ٰ U+0670 |
| `واو صغيرة` / `ياء صغيرة` | ۥ U+06E5 / ۦ U+06E6 |
| `علامة المد` | ٓ U+0653 |

Brackets are decoration and may be omitted. Whitespace inside a group is
collapsed, so `[ ا  ب ]` and `[ا ب]` are the same.

Because **space is the alternation separator**, a group cannot contain a
sequence. `[ــــَ وْ]` does not mean "any letter with a fatha, then a sakin waw";
it means "any letter with a fatha" *or* "a sakin waw". Six rules in the corpus
are disabled for exactly this reason.

## scope

`scope` says what may sit between two groups.

| | |
|---|---|
| `within-word` | no space at all — the groups are in one word |
| `across-words` | a separator is required |
| `either` | a space is permitted |

Diacritics and Quranic annotation marks are permitted between groups in every
scope, which is what lets a pattern be written phonetically while the text
carries marks the pattern does not mention.

`across-words` is looser than its name: a diacritic satisfies its "required
separator" as well as a space does, so it does not actually oblige the groups to
be in different words. This is inherited behaviour, it affects 22 rules, and
tightening it is a corpus change that needs its own review — see
[divergences.md](./divergences.md).

## matchAgainst

Almost every rule matches the **normalised** form of the text, which is the point
of normalising: a pattern written phonetically should not have to know that this
edition draws tanween positionally or carries a hamza on a tatweel.

A rule declares `matchAgainst: "original"` when it concerns a mark that
normalisation removes *because* no ordinary rule should see it. Two rules do.

The clearest is المد اللازم الحرفي. In the mushaf, a maddah sits over a consonant
in exactly one situation — the disjoined letters opening a surah, whose spelled-out
names contain a madd followed by a sukoon (لام، ميم، سين، صاد، عين، قاف، كاف، نون).
Over a madd letter the same mark means ordinary secondary madd, and appears 5,605
times; over a consonant it appears 44 times and means this and nothing else. So
the rule is written against the text as printed:

```
[لٓ مٓ سٓ صٓ عٓ قٓ كٓ نٓ]
```

## Writing a literal word

A ruling confined to specific words is written as the words themselves. Two
things bite here.

**Encoding.** The same glyph often has more than one encoding, and the wrong one
matches nothing while looking correct. المد اللازم الكلمي المخفف occurs in exactly
two places, both spelled ءَآلۡـَٰٔنَ — where the آ is the *decomposed* pair
U+0627 U+0653, not the precomposed U+0622, and the hamza is borne on a tatweel
rather than written standalone. Typed by hand it matched zero occurrences.

Spell such literals out in code points, and pin them with a fixture that asserts
the exact number of places they occur. That is what catches the mistake.

**Tatweel.** A run of tatweel compiles to a wildcard, so a literal containing one
matches any single character in that position. Harmless in a long literal;
something to know about in a short one.

## What the notation cannot express

18 rules are published but `disabled`, each recording which limitation blocks it.
Run `npx @tajweed/cli gaps` for the current list.

| Gap | What is missing |
|---|---|
| `ambiguous-wildcard` | a group mixing `ــ` with a multi-part sequence |
| `unsupported-optional-group` | `[همزة وصل أو بدون]` — an optional group |
| `unsupported-exception` | `باستثناء كلمة فرق` — subtracting a case from a group |
| `unsupported-negation` | `وليس بعده ألف` — defining a rule by what does *not* follow |
| `needs-rule-composition` | "any letter ruled tafkheem" — depends on other rules' outcomes |
| `not-a-pattern` | prose naming specific words at specific locations |
| `unsupported-token` | hamzat wasl as a named group |

This is the specification backlog, not a list of bugs. Word-boundary anchors and
`matchAgainst` were both added by working through it — القلقلة المتطرفة needed an
anchor because "at the end of a word" can otherwise only be said negatively, and
the notation has no negation.

## Adding a rule

Rules live in [`packages/rules/rules.json`](../packages/rules/rules.json), which
is the source of truth. A change there is a claim about how the Quran is recited;
[CONTRIBUTING.md](../CONTRIBUTING.md) says what it needs. In short: a source, a
fixture that must match, a fixture that must not, and before-and-after counts
over the whole mushaf.

Add fixtures to `scripts/verify-rules.ts`, which pins each rule to passages whose
ruling is not in dispute, and to an exact total wherever the total is known.

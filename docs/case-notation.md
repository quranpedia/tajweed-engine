# The CASE notation

`case` is how a rule describes what it matches. It exists so that a rule can be
written and checked by someone qualified in tajweed but not in programming:

```
نْ + [ذ ث ك ج ش س د ز ف ت]
```

reads as "a sakin noon, followed by any one of these letters". Run against
مِن تَحۡتِهَا (from 2:25), it matches ن ت — the sakin noon and the taa after it,
which is إخفاء. Note that the mushaf writes that noon with no sukoon mark at
all: patterns are written as sounds and matched against the normalised form of
the text, as described below.

## Syntax

| | |
|---|---|
| `[ا ب ت]` | any one of these — **space separates alternatives** |
| `+` | followed by |
| `ــــ` | a wildcard — any single character (written as a run of tatweel) |
| `نهاية الكلمة` | the end of a word — a position, not a character |
| `بداية الكلمة` | the start of a word |
| `الألف الخنجرية` | ٰ U+0670 |
| `واو صغيرة` / `ياء صغيرة` | ۥ U+06E5 / ۦ U+06E6 |
| `علامة المد` | ٓ U+0653 |

Brackets are decoration and may be left out. Whitespace inside a group is
collapsed, so `[ ا  ب ]` and `[ا ب]` mean the same thing.

Because **space separates alternatives**, a group cannot contain a sequence.
`[ــــَ وْ]` does not mean "any letter with a fatha, then a sakin waw"; it means
"any letter with a fatha" *or* "a sakin waw". Six rules in the corpus are
disabled for exactly this reason.

## scope

`scope` says what is allowed between two groups.

| | |
|---|---|
| `within-word` | no space at all — both groups are in one word |
| `across-words` | a separator is required |
| `either` | a space is allowed but not required |

Diacritics and Quranic annotation marks are always allowed between groups, in
every scope. That is what lets a pattern be written phonetically — as sounds —
while the actual text carries marks the pattern never mentions.

`across-words` is looser than its name suggests: a diacritic counts as its
"required separator" just as well as a space does, so it does not actually
force the groups into different words. This behaviour is inherited from the
original system, it affects 22 rules, and tightening it would change the corpus
— that needs its own review. See [divergences.md](./divergences.md).

## matchAgainst

Almost every rule matches the **normalised** form of the text. That is the
point of normalising: a pattern written as sounds should not need to know that
this edition draws tanween positionally or puts a hamza on a tatweel.

A rule sets `matchAgainst: "original"` when it is about a mark that
normalisation removes *on purpose*, so that no ordinary rule sees it. Two rules
do this.

The clearest example is المد اللازم الحرفي. In the mushaf, a maddah sits over a
consonant in exactly one situation — the disjoined letters that open some
surahs, whose spelled-out names contain a madd followed by a sukoon
(لام، ميم، سين، صاد، عين، قاف، كاف، نون). Over a madd letter, the same mark means
ordinary secondary madd and appears 5,605 times; over a consonant it appears 44
times and means this one thing. So the rule is written against the text as
printed:

```
[لٓ مٓ سٓ صٓ عٓ قٓ كٓ نٓ]
```

## Writing an exact word

A ruling that applies only in specific words is written as those words. Two
things go wrong here.

**Encoding.** The same glyph often has more than one possible encoding, and the
wrong one matches nothing while looking correct on screen. المد اللازم الكلمي
المخفف occurs in exactly two places, both spelled ءَآلۡـَٰٔنَ — where the آ is the
*two-code-point* pair U+0627 U+0653, not the single U+0622, and the hamza sits
on a tatweel instead of standing alone. Typed by hand, the rule matched zero
places.

So: spell such words out as code points, and pin them with a test that asserts
the exact number of places they occur. That test is what catches the mistake.

**Tatweel.** A run of tatweel compiles to a wildcard, so an exact word
that contains a real tatweel will match any character in that position.
Harmless in a long word; worth knowing about in a short one.

## What the notation cannot say

18 rules are published but `disabled`, and each records which limitation blocks
it. Run `npx @quran.ws/tajwid-cli gaps` for the current list.

| Gap | What is missing |
|---|---|
| `ambiguous-wildcard` | a group mixing `ــ` with a multi-part sequence |
| `unsupported-optional-group` | `[همزة وصل أو بدون]` — an optional part |
| `unsupported-exception` | `باستثناء كلمة فرق` — excluding one case from a group |
| `unsupported-negation` | `وليس بعده ألف` — a rule defined by what does *not* follow |
| `needs-rule-composition` | "any letter ruled tafkheem" — depends on other rules' results |
| `not-a-pattern` | prose naming specific words at specific places |
| `unsupported-token` | hamzat wasl as a named group |

This is the to-do list for the next version of the notation, not a list of
bugs. Word-boundary anchors and `matchAgainst` were both added by working
through it — القلقلة المتطرفة needed an anchor because "at the end of a word"
can otherwise only be said as a negation, and the notation has no negation.

## Adding a rule

Rules live in [`packages/rules/rules.json`](../packages/rules/rules.json),
which is the source of truth. A change there is a statement about how the Quran
is recited; [CONTRIBUTING.md](../CONTRIBUTING.md) says what such a change
needs. In short: a source, a test case that must match, a test case that must
not, and before-and-after match counts over the whole mushaf.

Add test cases to `scripts/verify-rules.ts`, which pins each rule to passages
whose ruling is not in dispute, and to an exact total wherever the total is
known.

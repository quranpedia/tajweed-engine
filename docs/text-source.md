# Where the text comes from

A tajwīd annotation is a pair of offsets into a string. It carries no text of its
own, so it is only as trustworthy as the answer to one question: *offsets into
which text, and where did that text come from?*

This repository ships two editions of Ḥafṣ ʿan ʿĀṣim, and only one of them can
answer it.

| | `editions/uthmani-hafs.json` | `editions/hafs-quran-text.json` |
|---|---|---|
| Provenance | exported from the tajweed application; the step before that was not recorded | quran-ws/quran-text → KFGQPC `UthmanicHafs-v-3.0.zip`, with its SHA-256 |
| Checkable | no | yes, to a published package digest |
| What the published annotations are measured against | **this one** | not yet |

The second is built by

```sh
pnpm import:quran-text                       # from https://text.quran.ws
pnpm import:quran-text --from ../quran-text  # from a checkout
```

Both routes produce the same edition, digest `a347fc57…` — which is itself worth
knowing, because reading quran-text's `data/mushaf/hafs.json` naively does not:
the waqf, sajdah and division signs live in a separate layer there and have to be
put back, and a text without them is a different string in which every offset is a
different number. The importer does that, and the two routes agreeing is the check.

## What the two editions disagree about

Regenerate with `pnpm edition:diff`; the numbers below are read from
[`reports/hafs-quran-text-vs-uthmani-hafs.json`](../reports/hafs-quran-text-vs-uthmani-hafs.json),
which is committed so that a change in them arrives as a diff.

Of **6,236** ayahs, **2,715** are byte-identical as they stand. **6,232** are the
same text written differently — and since quran-ws/quran-text#21 that is **one
class**, not four:

| Class | What differs |
|---|---|
| **tanween** | positional tanween U+0657 U+065E U+0656 against open tanween U+08F0 U+08F1 U+08F2 |

Three classes that used to be here are gone, and it is worth saying why rather
than quietly dropping them. **bearer** — a hamza riding a tatweel against one
written on its letter — existed because quran-text's build was deleting the
kashida the KFGQPC release uses to seat a hamza that has no letter of its own.
#21 restored it: both editions now carry 535 kashidas and 495 borne hamzas.
**order** and **composition** existed because quran-text applied NFC, which
reorders a shaddah past its vowel and composes ا + ٓ into آ. It no longer does;
the releases' own code points are published, and they agree with this edition.

Neither is a change in the text. Both are the upstream file coming to say what
the printed page already said.

It prints identically. It is not a difference in the text, and it may not be a
difference in what the engine reads — so each is handled in
`packages/core/src/normalize.ts`, and `packages/core/test/encodings.test.ts`
writes every case twice, once in each encoding, and asserts the two normalise to
the same string.

**4 ayahs still differ, and they are not one kind of thing.** Two are the same
ruling recorded with a different code point — the same shape of difference as
the tanween class above, a further normalisation class rather than a
disagreement about the text. Two are word division. One of those four is filed
as unresolved rather than explained.

This paragraph used to say three were mark encoding and one was "a genuine
difference in the rasm". Both halves were wrong: 52:37 is not established as
mark encoding, and word division is a question this repository has raised
upstream, not a difference in the letters it has found. Nothing here decides
any of them:

| | |
|---|---|
| **11:41** | *mark encoding.* The imāla on the rāʾ: U+065C here, U+06EA there — **the same ruling, recorded with two different code points**. PR #2 now reads either. This file cannot say the printed glyphs are identical: U+06EA is an empty-centre low stop and U+065C a dot below, and neither this repository nor its tooling renders them. |
| **27:20**, **36:22** | *word division.* مَا لِيَ is written as two words in quran-text and as one here. This is the only place the two editions disagree about anything but marks, and it is **a question, not a finding** — raised upstream at quran-text rather than decided here. It is not cosmetic: a rule can match across a word boundary or fail to. |
| **52:37** | **unresolved**, and the normaliser's treatment of it is **provisional**. U+06E3 is now stripped as a non-reading mark, exactly as its sibling U+06DC is stripped away from a word end. That is a statement about this pipeline — the engine does not read this mark — and **it does not answer the question below.** It was done because leaving the mark unhandled did not leave the question open either: it silently wedged an implied sukoon onto the ṣād and told nobody. If a qualified reviewer rules that the small sīn's position is readable, the change is one line — `SMALL_LOW_SEEN` in `packages/core/src/unicode.ts`. The question itself: U+06DC above the ṣād here, U+06E3 below it there. Filed for a while as mark encoding, and that was wrong: position is what carries meaning for the small sīn, and KFGQPC moved **only** 52:37 from above to below while leaving 2:245 and 7:69 alone. A re-encoding does not produce that asymmetry, so something else is going on and this file does not know what. Note also that U+06DC is what the normaliser reads as a saktah at a word end, so the two are not interchangeable in code. |

**None of these four is a difference in the letters.** Strip every combining
mark, annotation sign, tatweel and hamza mark, decompose every seat, and compare
the bare skeletons across all 6,236 āyahs: the two editions differ in **2**
places with spaces significant and in **0** ignoring spaces — and the two are
27:20 and 36:22 above. Decomposing the seats is load-bearing in that
measurement, not a detail: without it 35:43's آ counts as a different letter
from ا plus its madd, and the answer comes back 3 and 1.

## What that costs, measured

With the one class handled, **6,231** of 6,236 ayahs normalise to a
byte-identical string, and the engine finds **147,257** spans on quran-text's
Ḥafṣ against **147,255** on this edition — two apart, with **1** of 164 rules
moving.

Before the normaliser was taught the open tanween, every rule in the tanween
family — idghām, ikhfāʾ, iqlāb, iẓhār — matched **zero** ayahs on quran-text's
text, because U+08F0 U+08F1 U+08F2 were unrecognised and stripped as decoration.
`pnpm edition:check` reported 24 rules drifting and exited 0; it now reports none
and, since the gate was fixed, would exit 1 if it did. Nothing raised an error at
any point. That is the failure mode this whole file exists to describe: a missing
mark is not an error, it is a ruling that quietly stops being reported.

## What is still open

**5 ayahs do not normalise alike**: the 4 above, and **35:43**.

35:43 is the only unborne hamza left in the muṣḥaf. quran-text writes
ٱلسَّيِّئُ as yāʾ + U+0654 + ḍammah where this edition writes the precomposed ئ,
and the normaliser keeps the seat, producing a yāʾ before a hamza — which reads
as a madd and is not one. It costs **two spurious spans**, `madd-muttasil.3` and
`madd-tabee-kalimi.3`.

It looks like an upstream inconsistency rather than an encoding choice: the same
word-shape occurs in **11 ayahs in this edition and 10 in quran-text**, and
35:43 is the single place it is decomposed, out of 907 ئ seats. Raised rather
than worked around.

**Five rules match nothing on quran-text's Ḥafṣ** — `seven-alefs.1`, `.3`, `.4`,
`.5` and `madd-lazim-kalimi-mukhaffaf.1`. All five carry `matchAgainst: "original"`,
which matches the raw edition text rather than the normalised form, so they are
written against one edition's encoding by construction. There are 10 such rules in
the corpus. This is the caveat [`editions.md`](editions.md) describes, in numbers.

## The decision this repository has not made

The published annotations in `@quran-ws/tajwid-annotations` are still measured against
`editions/uthmani-hafs.json`. Moving them onto quran-text's Ḥafṣ would give every
span a provenance that reaches a printed muṣḥaf — and would move every offset in
the file, change `conformance/frozen.json`, and invalidate the generated files in
every open rule pull request. It is a decision about ordering, not about
engineering, and it is not taken here.

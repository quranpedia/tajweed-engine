# Where the text comes from

A tajwīd annotation is a pair of offsets into a string. It carries no text of its
own, so it is only as trustworthy as the answer to one question: *offsets into
which text, and where did that text come from?*

This repository ships two editions of Ḥafṣ ʿan ʿĀṣim, and only one of them can
answer it.

| | `editions/uthmani-hafs.json` | `editions/hafs-quran-text.json` |
|---|---|---|
| Provenance | KFGQPC `UthmanicHafs_v2-0` (2022), measured — see below | quran-ws/quran-text → KFGQPC `UthmanicHafs-v-3.0.zip`, with its SHA-256 |
| Checkable | yes, to a published package digest | yes, to a published package digest |
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

## Where this edition came from, answered

For a long time the honest answer was that nobody knew. The file said `"source":
"legacy application export"`, the README said it was the text published at
tajweed.quranpedia.net, and `LICENSE` asserted a KFGQPC derivation that nobody
had checked — three claims, none of them verifiable.

It is the **KFGQPC `UthmanicHafs_v2-0` release of 2022**, the `aya_text` column
of `UthmanicHafs_v2-0 data/hafsData_v2-0.csv`, package SHA-256
`a7b0e559…`. All **6,236 of 6,236** āyahs are byte-identical to it after three
mechanical steps:

1. strip the CSV's surrounding quotes;
2. strip the trailing āyah-number presentation glyph;
3. replace the 199 non-breaking spaces after ۞ with ordinary spaces.

Nothing else differs anywhere. That is measured and reproducible, not inferred.

quran-ws/quran-text found the thread: 35:43 ٱلسَّيِّئُ is composed in the 2022
package and decomposed in the 2026 one, and this edition has it composed. So the
two files in `editions/` are the same muṣḥaf from two different KFGQPC releases —
which is also why only 2,715 of 6,236 āyahs are byte-identical between them.

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

**4 ayahs still differ, and they are not one kind of thing.** Three are the same
printed mark drawn with a different code point — the same shape of difference as
the tanween class above, a fifth normalisation class rather than a disagreement
about the text. One is a genuine difference in the rasm. Nothing here decides
any of them:

| | |
|---|---|
| **11:41** | *mark encoding.* The imāla on the rāʾ of مَجۡرٜىٰهَا: U+065C here, U+06EA there. Both draw the same mark, and PR #2 now reads either. |
| **27:20**, **36:22** | *rasm.* مَا لِيَ is two words in quran-text and one, مَالِيَ, here — the only genuine difference in the written text of the two editions. A rule can match across a word boundary or not, so this is not cosmetic. |
| **52:37** | *mark encoding.* The ṣād/sīn variant on ٱلۡمُصَۣيۡطِرُونَ: U+06E3 below there, U+06DC above here. Note U+06DC is also what the normaliser reads as a saktah at a word end, so the two are not interchangeable in code. |

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

The published annotations in `@tajweed/annotations` are still measured against
`editions/uthmani-hafs.json`. Moving them onto quran-text's Ḥafṣ would give every
span a provenance that reaches a printed muṣḥaf — and would move every offset in
the file, change `conformance/frozen.json`, and invalidate the generated files in
every open rule pull request. It is a decision about ordering, not about
engineering, and it is not taken here.

---

## A note for issue #5, not an argument for anything here

This corpus is Ḥafṣ only. `scripts/annotate.ts` refuses any other riwayah by
design, and everything above is measured on Ḥafṣ.

One fact is worth leaving for whoever takes up
[#5](https://github.com/quran-ws/quran-tajweed/issues/5), support for other
riwayat. The KFGQPC releases differ in how consistently they compose a seated
hamza. In Ḥafṣ, ئ is written as يـ + U+0654 **once in 909** — 35:43, which is why
this repository composes before analysing. In the other published editions the
same inconsistency runs from once to twenty-two times each.

So the composition step is load-bearing rather than cosmetic the moment this
corpus is pointed at a second riwayah, and it would be worth re-measuring rather
than assuming it carries over. That is all: a fact recorded where it will be
found, not a reason for anything being done today.

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

Of **6,236** ayahs, **345** are byte-identical as they stand. **6,232** are the
same text written differently, in four classes:

| Class | What differs |
|---|---|
| **order** | which order the marks stacked on one letter are stored in — the muṣḥaf writes letter + shadda + haraka, quran-text writes letter + haraka + shadda |
| **composition** | a precomposed letter (آ أ ؤ ئ) against a base letter plus a combining mark |
| **tanween** | positional tanween U+0657 U+065E U+0656 against open tanween U+08F0 U+08F1 U+08F2 |
| **bearer** | a hamza riding a tatweel U+0640 against one written straight onto its letter |

All four print identically. None of them is a difference in the text, and none of
them may be a difference in what the engine reads — so each is handled in
`packages/core/src/normalize.ts`, and `packages/core/test/encodings.test.ts`
writes every case twice, once in each encoding, and asserts the two normalise to
the same string.

**4 ayahs are a real difference in the text.** They are not normalisation, and
nothing here decides them:

| | |
|---|---|
| **11:41** | quran-text marks the rāʾ of مَجۡرٜىٰهَا with U+065C (vowel sign dot below); this repository's edition uses U+06EA. The imāla. |
| **27:20**, **36:22** | مَا لِيَ is two words in quran-text and one, مَالِيَ, here. A rule can match across a word boundary or not, so this is not cosmetic. |
| **52:37** | ٱلۡمُصَۣيۡطِرُونَ carries U+06E3 (small low seen) in quran-text and U+06DC (small high seen) here — the ṣād/sīn variant, and U+06DC is the character the normaliser reads as a saktah. |

## What that costs, measured

With all four classes handled, **6,168** of 6,236 ayahs normalise to a
byte-identical string, and the engine finds **147,233** spans on quran-text's Ḥafṣ
against **147,255** on the current reference — 22 spans apart, with **18** of 164
rules moving.

Before the normaliser was taught the open tanween, that number was not 22. Every
rule in the tanween family — idghām, ikhfāʾ, iqlāb, iẓhār — matched **zero** ayahs
on quran-text's text, because U+08F0 U+08F1 U+08F2 were unrecognised and stripped
as decoration. `pnpm edition:check` reported 24 rules drifting; it now reports
none. Nothing raised an error at any point. That is the failure mode this whole
file exists to describe: a missing mark is not an error, it is a ruling that
quietly stops being reported.

## What is still open

**68 ayahs do not normalise alike**: the 4 above, and 64 more. Every one of the
64 is the same question — how a hamza and the letter it sits on are stored — in
three shapes:

- **38** where quran-text writes a precomposed ئ (U+0626) and this edition writes
  a yāʾ plus a borne hamza: سَيِّـَٔاتِ against سَئَِّاتِ, يَـُٔودُهُۥ against
  ئَُودُهُۥ. One stores two consonants, the other one. That is a reading of the
  orthography, not an encoding detail, so it is not decided here.
- **6** — يَطَـُٔونَ, ٱخۡسَـُٔواْ, أَسَـٰٓـُٔواْ — where the letter's vowel and the
  hamza's both sit *above* the line, and quran-text stores them in the order they
  are drawn rather than by which of the two they belong to. There the owner
  cannot be recovered from the file, and the two can be assigned the wrong way
  round. Wherever the two marks fall on opposite sides of the line the order does
  resolve it, which is why the other 449 of the 455 unborne hamzas read correctly.
- **20** in the remaining shapes of the same family — تِلۡقَآيِٕ, هَنِيءًا,
  خَطِيءَاتِ, ٱمۡرِيٍْ — of which 7 write the hamza below the line as U+0655. The
  normaliser recovers only a hamza written above, so on those the consonant is
  dropped on **both** editions and they differ only in the incidental sukoon one
  mark order provokes. That is a pre-existing gap rather than a migration issue,
  and closing it would move published offsets.

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

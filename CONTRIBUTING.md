# Contributing

Two kinds of change live in this repository, and they are held to different
standards.

## Changing code

Normal software rules apply. Open a PR, keep it focused, make the tests pass.

## Changing a rule

A change to `packages/rules/rules.json` is a claim about how the Quran is
recited. It is reviewed as such.

A PR that changes a rule's matching behaviour must include:

1. **A source.** Which scholar or work the ruling comes from. "It looked wrong"
   is not a source; neither is another library's implementation.
2. **Fixtures.** At least one ayah the rule must match and one it must not, added
   to `conformance/`. A rule with no fixture cannot be regression-tested and will
   silently rot.
3. **A `corrections` entry** recording the previous value and the evidence, with
   `needsReview: true`, if you are altering an existing rule rather than adding
   one.
4. **A diff of what it matches.** Run the corpus before and after and report how
   many occurrences changed. A one-character edit to a pattern can silently add
   or remove thousands of matches.

Rules are approved by a reviewer qualified in tajweed, not by whoever has merge
rights. If you are not that person, `needsReview: true` stays set.

### Do not delete a rule to make it work

If a rule cannot be expressed, mark it `disabled` and record a `gap` naming what
the notation is missing. A deleted rule is indistinguishable from a rule nobody
ever wrote; a disabled rule is a specification for the next version of the
notation.

## Handling the text

These are not style preferences.

- **Never type Quranic text by hand**, in code, tests, or fixtures. Copy it from
  a verified edition. A single transposed diacritic is a corruption of the text
  that will not look wrong to most reviewers.
- **Never add another copy of the Quranic text.** One edition lives in
  `editions/`, identified by digest. Reference ayahs as `surah:ayah` against it;
  do not paste passages into code, tests, issues or commit messages.
- **Never invent Arabic to stand in for Quranic text.** In a tajweed tool a
  composed phrase reads as Quran to whoever sees it. Use a real ayah by
  reference, or build the input from named code points, which is unambiguous
  about what is being tested.
- **Never log Quranic text.** Error messages, debug output and test failure
  messages use the reference (`2:255`), not the text.
- **Never apply Unicode normalisation** to the source text anywhere in the
  pipeline. NFC will silently rewrite Uthmani codepoints. The engine's own
  normalisation produces a separate string and never mutates the input.
- **Never strip a mark you do not recognise.** The Quranic annotation range
  (U+06D6–U+06ED) carries waqf marks and recitation instructions that are part of
  the text.

## Naming

Use `ayahText`, `surahNumber`, `mushafPage`. Not `rawText`, `verseBlob`,
`quranString`.

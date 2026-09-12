# Using a different text edition

The published annotations describe one specific edition. If your text is not
byte-for-byte identical to it, the positions point at different letters — and
nothing will warn you, because a wrong position produces wrong highlighting,
not an error.

For example: if your edition writes آ as one precomposed character where the
reference writes it as two (alef + maddah), every position after that letter is
shifted by one, and every colour from there to the end of the ayah lands on the
wrong letter.

So check before you trust it:

```bash
pnpm edition:check path/to/your-edition.json
```

## The edition format

```json
{
  "id": "my-uthmani",
  "riwayah": "hafs-an-asim",
  "script": "uthmani",
  "ayahs": { "1:1": "…", "1:2": "…" }
}
```

Copy the text exactly as it comes from a verified source. Do not trim it, do
not normalise it, do not re-encode it, and do not type it by hand — a swapped
diacritic corrupts the text in a way most reviewers will not see.

## What the check tells you

**Which characters the normaliser depends on.** Editions of the Uthmani script
can read identically and still differ in which optional marks they use and how
a few characters are encoded. A missing mark does not fail loudly; it quietly
stops a rule from matching. The check counts each such character and says what
depends on it.

**How the rules behave on your text.** Every rule runs over your edition and
the results are compared to the frozen baseline. If a rule matches 1,300 ayahs
in the reference edition and 4 in yours, it is matching something else, and you
want to know that before anyone reads the output.

The check verifies *shape*, not rulings. A clean report means the engine can
read your edition — not that the output is correct for it.

## The differences that come up most

**Precomposed آ.** The reference edition writes this as two code points, U+0627
followed by U+0653. Many editions use the single precomposed U+0622. Both
normalise the same way, but a rule written as an exact word will only match one
of them — this exact mistake made `madd-lazim-kalimi-mukhaffaf.1` match nothing
when it was first written.

**Quranic sukoon.** U+06E1 instead of U+0652. Handled; an edition that only
uses U+0652 also works.

**Positional tanween.** U+0657, U+065E and U+0656 instead of the standalone
marks. Handled, and an edition without them is fine.

**Ayah count.** 6,236 is the Hafs count. If your total is different, your
edition uses a different counting system, and ayah references will not line up
with the annotations at all.

## Then annotate it

```bash
pnpm annotate path/to/your-edition.json out/my-uthmani.annotations.json
```

The output records a digest of your edition, so anyone using it can check
whether the text they hold is the text the positions describe.

## A different riwayah is not an edition change

The corpus is for Hafs ʿan ʿĀsim. Other riwayat differ in both the rulings and
the spelling of the text, so pointing this at a Warsh or Qālūn edition gives
wrong answers — the tools refuse it rather than produce output that merely
looks right.

## A dependency worth knowing before you try to regenerate anything

`scripts/compare-editions.ts` (`pnpm edition:diff`) and `docs/text-source.md` do
**not exist on `main`**. They live on the branch that introduces the quran-text
edition, which is held pending review.

Three documents are generated from that tool — this repository's `README.md`
section on edition distance, `docs/text-source.md`, and the figures quoted in
`docs/coverage.md`. **None of them can be regenerated until that branch lands.**

This is written down because it was rediscovered rather than known: a correction
was made to the sentence that tool prints, and the copies downstream could not
be brought back into line from `main`, because the generator was not there. If
you are looking at a stale number in one of those three documents and cannot
find the script that produced it, this is why — the fix belongs on that branch,
not on a copy.

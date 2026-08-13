# Using a different text edition

The annotations shipped here describe one edition. If your text is not
byte-identical to it, the offsets point at different letters — and nothing will
tell you so unless you check, because a wrong offset produces wrong highlighting
rather than an error.

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

Copy the text verbatim from a verified source. Do not trim it, do not normalise
it, do not re-encode it, and do not type it by hand — a transposed diacritic is a
corruption of the text that will not look wrong to most reviewers.

## What the check tells you

**The characters the normaliser depends on.** Editions of the Uthmani script that
read identically differ in which optional marks they use and how a few characters
are encoded. A missing mark does not break anything loudly; it quietly stops a
rule matching. The check counts each one and says what depends on it.

**How the rules behave against the reference.** Every rule is run over your text
and compared to the frozen baseline. A rule matching 1,300 ayahs in the reference
edition and 4 in yours has found something else, and that is worth knowing before
anyone reads it.

The check verifies *shape*, not rulings. A clean report means the engine can read
your edition, not that the output is correct for it.

## The differences that come up most

**Precomposed آ.** The reference edition writes this decomposed, as U+0627
followed by U+0653. Many editions use the precomposed U+0622. Both normalise the
same way, but a rule written as a literal word will only match one of them — this
is exactly the mistake that made `madd-lazim-kalimi-mukhaffaf.1` match nothing
when it was first written.

**Quranic sukoon.** U+06E1 rather than U+0652. Handled; an edition using only
U+0652 also works.

**Positional tanween.** U+0657, U+065E and U+0656 rather than the standalone
marks. Handled, and an edition without them is fine.

**The marks that carry a ruling on their own.** U+06EA (الإمالة, one place) and
U+06EC (التسهيل and الإشمام, two places). An edition that omits them drops three
rules to zero matches without any other symptom, which is why the check counts them.

**Ayah counting.** 6,236 is the Hafs count. A different total means a different
counting system, and references will not line up with the annotations at all.

## Then annotate it

```bash
pnpm annotate path/to/your-edition.json out/my-uthmani.annotations.json
```

The result records your edition's digest, so a consumer can tell whether the text
they hold is the text the offsets describe.

## A different riwayah is not an edition change

The corpus is Hafs ʿan ʿĀsim. Both the rulings and the underlying orthography
differ between riwayat, so pointing this at a Warsh or Qālūn text is a data error
rather than a configuration option — the tooling refuses it rather than producing
plausible-looking output.

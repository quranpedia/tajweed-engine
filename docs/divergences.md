# Divergences from the legacy engine

The TypeScript engine is a port, and conformance/ holds it to producing the same
normalised text and the same rule-to-ayah incidence as the PHP engine it came
from. Where it deliberately does something different, it is recorded here.

Nothing on this list changes *which* ayahs a rule matches. Everything on it
changes the extent of a span, or the corpus, and each was verified against the
whole mushaf before being accepted.

---

## Span extents are derived from an offset map, not by searching again

**Legacy:** match against normalised text, then build a second, looser pattern
from the matched fragment and search the *original* text for it, to find out
where to highlight.

**Port:** the normaliser records, for each character it emits, the code-point
index it came from. A match's extent follows from that map directly.

**Why:** searching again is ambiguous. When the same normalised fragment occurs
more than once in an ayah — which is common, since normalisation removes exactly
the marks that distinguish occurrences — the second search finds all of them and
cannot tell which one matched. The legacy code works around this with a
duplicate-suppression list keyed on the matched text, which suppresses genuine
repeat occurrences along with spurious ones. It also has to walk forward from
each match to absorb trailing diacritics, because a span that ends between a
letter and its haraka splits a rendered glyph cluster.

The offset map removes all three: the extent is exact, repeat occurrences are
distinct, and marks dropped inside the match sit in the gap between mapped
indices, so they are inside the span already.

---

## Trailing waqf marks bind uniformly across a single-group rule's alternatives

**Legacy:** a single-group rule compiles to `group(?:waqf)*` with `group`
unbracketed. Alternation binds loosest, so `ا|ب(?:waqf)*` means "an alef, or a
baa followed by waqf marks" — whether a trailing waqf mark fell inside the match
depended on which alternative matched.

**Port:** the group is bracketed, so the suffix applies to every alternative.

**Why:** the legacy behaviour is a precedence slip rather than a decision, and it
makes a rule's spans inconsistent with themselves. Multi-group rules were already
bracketed in the legacy engine, so this makes the two paths agree.

---

## `across-words` scope does not actually require whitespace

**Legacy and port both:** the separator between groups compiles to
`(?:\s+|waqf|marks)+`, which is satisfied by a diacritic just as well as by a
space.

**Not changed.** This is recorded as a divergence-in-waiting rather than a
divergence: the name says one thing and the behaviour does another, but
tightening it would change what 22 rules match. That is a corpus change, not a
port detail, and belongs in a pull request that can be reviewed on its own with
before-and-after match counts.

---

## A normalisation bug was fixed in both engines

`أ` followed by a maddah above is آ — a hamza followed by a long a, which is مد
بدل. Only `ا` followed by a maddah was being resolved, so on the hamza-carrying
form the maddah was stripped with the other annotation marks and the bare hamza
then collected an implied sukoon, turning a madd letter into a sakin consonant.
It affects 272 ayahs, and recovers 212 ayahs of مد بدل that were invisible.

This was fixed **in the PHP engine as well**, so the two still produce identical
normalised text and the conformance check stays exact rather than acquiring an
exception list. It is recorded here because it changes published behaviour, not
because the two engines disagree.

## The imāla mark is read as a vowel, not as decoration

**Legacy and port both, before this change:** the imāla mark (U+06EA) is stripped
with the other annotation marks, and the letter beneath it — carrying no written
haraka — then collects an implied sukoon.

**Port, after:** a letter carrying the imāla mark, or the tashīl/ishmām mark, is
treated as vowelled, so no sukoon is inserted.

**Why:** the mark *is* the vowel. The reh of Hūd 41 is read with a fatha inclined
towards a kasra; the mushaf writes that inclination as a mark instead of a haraka,
and nothing else. Reading the letter as bare makes a vowelled reh sakin, and the
rulings of a sakin reh then apply to it — which is exactly what happened:
`raa-tafkheem.3` ruled that reh مفخمة, and الراء الممالة is مرققة.

It affects **one position in the whole mushaf**. The other two places carrying a
performance mark write a haraka as well, so they were never bare. `raa-tafkheem.3`
goes from 1 occurrence to 0 — its only match in the entire Quran was this
artefact — and `raa-tarqeeq.5` picks up the same position with the correct
ruling. Both are visible in `conformance/frozen.json` as the same incidence digest
moving from one rule to the other.

**This has not been applied to the PHP engine.** Until it is, the two engines
normalise 11:41 differently and the conformance comparison is exact everywhere
else. The alternative — leaving a vowelled letter to be ruled as sakin so the two
agree — is not worth it.

## Four rules were corrected

Four rules described one madd letter and searched for another. See
`packages/rules/rules.json` — each carries a `corrections` entry with the previous
value, the evidence, and `needsReview: true`.

| Rule | Described | Searched for | Effect of the correction |
|---|---|---|---|
| `madd-muttasil.2` | sakin waw | alef | 0 matches → 54 |
| `madd-muttasil.3` | sakin yaa | alef | 10 matches, all wrong → 28 correct |
| `madd-munfasil.2` | sakin waw | alef | 0 → 0 (corrected for consistency) |
| `madd-munfasil.4` | sakin yaa | alef | 3 matches, all wrong → 79 correct |

Each is one of a three-rule alef/waw/yaa series where the leading group's harakat
were updated from the sibling rule and the madd letter itself was not. The
corrected groups are taken either from the row's own editorial `start_from`
column or from مد البدل, which is the same series written correctly.

`scripts/audit-corpus.ts` checks for this class of defect mechanically, by
comparing each rule's Arabic description against the letters its pattern actually
contains.

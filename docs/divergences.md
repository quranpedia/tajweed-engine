# Divergences from the legacy engine

The TypeScript engine is a port. The conformance suite holds it to producing
the same normalised text and the same rule-to-ayah matches as the PHP engine it
came from. Where it deliberately does something different, that difference is
recorded here.

Nothing on this list changes *which* ayahs a rule matches. Everything on it
changes either how far a span extends, or the corpus itself, and each item was
checked over the whole mushaf before being accepted.

---

## Span extents come from an offset map, not from a second search

**Legacy:** match against the normalised text, then build a second, looser
pattern from the matched fragment and search the *original* text for it, to
find out where to highlight.

**Port:** while normalising, the engine records for each character it produces
which position in the original text it came from. A match's extent is read
straight off that map.

**Why:** searching again is ambiguous. The same normalised fragment often
appears more than once in an ayah — normalisation removes exactly the marks
that told the occurrences apart — so the second search finds all of them and
cannot tell which one actually matched. The legacy code worked around this with
a duplicate-suppression list keyed on the matched text, which also suppressed
genuine repeats. It also had to walk forward from each match to pick up
trailing diacritics, because a span that ends between a letter and its haraka
splits a rendered glyph in half.

The offset map removes all three problems: the extent is exact, repeated
occurrences stay separate, and marks that normalisation dropped inside the
match sit between mapped positions, so they are inside the span already.

---

## Trailing waqf marks attach the same way to every alternative

**Legacy:** a single-group rule compiled to `group(?:waqf)*` with the group
unbracketed. Because alternation binds loosest, `ا|ب(?:waqf)*` means "an alef,
or (a baa followed by waqf marks)" — so whether a trailing waqf mark ended up
inside the match depended on which alternative matched.

**Port:** the group is bracketed, so the waqf suffix applies to every
alternative equally.

**Why:** the legacy behaviour was an operator-precedence slip, not a decision,
and it made one rule's spans inconsistent with each other. Multi-group rules
were already bracketed in the legacy engine; this makes the two paths agree.

---

## `across-words` scope does not actually require whitespace

**Legacy and port both:** the separator between groups compiles to
`(?:\s+|waqf|marks)+`, and a diacritic satisfies it just as well as a space
does.

**Not changed.** The name says one thing and the behaviour does another, but
tightening it would change what 22 rules match. That is a corpus change, not a
porting detail, and it belongs in its own pull request with before-and-after
match counts.

---

## A normalisation bug was fixed in both engines

`أ` followed by a maddah is آ — a hamza followed by a long *a*, which is مد
بدل. Only `ا` followed by a maddah was being resolved. On the hamza-carrying
form, the maddah was stripped along with the other annotation marks, and the
bare hamza then received an implied sukoon — turning a madd letter into a sakin
consonant. This affected 272 ayahs, and the fix recovered 212 ayahs of مد بدل
that had been invisible.

The fix was applied **in the PHP engine as well**, so the two engines still
produce identical normalised text and the conformance check stays exact, with
no exception list. It is recorded here because it changed published behaviour,
not because the engines disagree.

## Four rules were corrected

Four rules described one madd letter in their text but searched for another.
See `packages/rules/rules.json` — each carries a `corrections` entry with the
previous value, the evidence, and `needsReview: true`.

| Rule | Described | Searched for | Effect of the correction |
|---|---|---|---|
| `madd-muttasil.2` | sakin waw | alef | 0 matches → 54 |
| `madd-muttasil.3` | sakin yaa | alef | 10 matches, all wrong → 28 correct |
| `madd-munfasil.2` | sakin waw | alef | 0 → 0 (corrected for consistency) |
| `madd-munfasil.4` | sakin yaa | alef | 3 matches, all wrong → 79 correct |

Each belongs to a three-rule alef/waw/yaa series where the first group's
harakat were copied and updated from the sibling rule, but the madd letter
itself was not. The corrected groups come either from the row's own editorial
`start_from` column or from مد البدل, which is the same series written
correctly.

`scripts/audit-corpus.ts` checks for this class of mistake mechanically, by
comparing each rule's Arabic description against the letters its pattern
actually contains.

## Eight rules matched nothing because normalisation removed what they look for

`OPTIONAL_MARKS` removes the marks that never appear in a CASE pattern — which
is right for almost every rule, and wrong for the few whose pattern *is* one of
those marks. Eight such rules compiled cleanly, ran against text the mark had
already been stripped from, and matched nothing at all:

| Rule | Looks for | Was | Now |
|---|---|---|---|
| `madd-silah-sughra.1` | ۥ U+06E5 small waw | 0 ayahs | 969 |
| `madd-silah-sughra.2` | ۦ U+06E6 small yeh | 0 ayahs | 791 |
| `seven-alefs.1`–`.5` | ۠ U+06E0 rectangular zero | 0 ayahs each | 1 each |
| `seven-alefs.6` | ۠ U+06E0 rectangular zero | 0 ayahs | 60 |

مد الصلة الصغرى is not a marginal ruling — it is one of the most frequent madd
in the mushaf, and `docs/coverage.md` listed it as covered throughout. Nothing
errored, no test failed, and the corpus reported the rule as `stable`: the only
visible symptom was a colour that never appeared.

The mechanism to express this already existed. Each of the eight now declares
`matchAgainst: "original"`, the same escape hatch `madd-lazim-harfi.1` uses, and
each returns exactly the set of ayahs the PHP engine returned — 969, 791, and
1/1/1/1/1/60 — so this restores parity rather than changing behaviour.

`scripts/validate-rules.ts` now rejects any rule whose pattern contains a mark
normalisation strips unless it declares `matchAgainst: "original"`, so a rule
cannot silently match nothing this way again.

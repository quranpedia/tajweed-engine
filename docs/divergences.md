# Divergences from the legacy engine

The TypeScript engine is a port. The conformance suite holds it to producing
the same normalised text and the same rule-to-ayah matches as the PHP engine it
came from. Where it deliberately does something different, that difference is
recorded here.

Nothing on this list changes *which* ayahs a rule matches. Everything on it
changes either how far a span extends, or the corpus itself, and each item was
checked over the whole mushaf before being accepted.

---

## There are two legacy rule tables, and they disagree

Before reading anything below as a divergence, check which legacy rule table it
was measured against. There are two and they are not the same.

- **The authored spreadsheet**, `resources/tajweed_rules.xlsx` in qaws-net/tajweed.
  What a rule was *meant* to say.
- **The legacy database**, which is what the PHP engine actually *ran* with.

They agree on 164 of 172 rules. On eight they do not, because those eight were
hand-edited in the database and the workbook was never updated to match:

| Rule | Spreadsheet | Database (and this corpus) | Edited |
|---|---|---|---|
| `seven-alefs.1` | `لكنا` | `لَّٰكِنَّا۠` | 2026-02-24 |
| `seven-alefs.2` | `قواريرا` | `قَوَارِيرَا۠` | 2026-02-24 |
| `seven-alefs.3` | `الظنونا` | `ٱلظُّنُونَا۠` | 2026-02-24 |
| `seven-alefs.4` | `الرسولا` | `ٱلرَّسُولَا۠` | 2026-02-24 |
| `seven-alefs.5` | `السبيلا` | `ٱلسَّبِيلَا۠` | 2026-02-24 |
| `seven-alefs.6` | `أنا + [...]` | `أَنَا۠` | 2026-02-24 |
| `seven-alefs-khulf.1` | `سلاسلا` | `سَلَاسِلَاْ` | 2026-02-24 |
| `raa-either-permissible.2` | `[ــــِـــ] + [خْ صْ ...] + رْ` | `فِرْقٍ` | 2026-02-25 |

**This corpus carries the database value for all eight.** They are *inherited*,
not authored here — which matters, because measured against the spreadsheet they
look like eight corrections this port invented, and measured against the database
they are eight rules we transcribed faithfully. The second reading is the correct
one. The spreadsheet's unvocalised forms could never have matched vocalised
Uthmānī text at all; someone noticed that in February 2026 and fixed it in the
only place the running application read from.

VERIFIED: `node scripts/differential-legacy.mjs` reports **147 of 154** comparable
rules in exact ayah-level agreement against `--rules deployed`, and 139 against
`--rules spreadsheet`. The eight above are the entire difference between those two
numbers. Quote the first when the question is whether the port is faithful.

`raa-either-permissible.2` is worth one more line: `فِرْقٍ` is exactly the
exception written in the spreadsheet's own notes column on a *different* row
(`raa-tafkheem.5`: "باستثناء كلمة فرق - الشعراء 63"). The notation cannot subtract
a case from a group, so whoever made that edit expressed the exception as its own
rule instead. `raa-tafkheem.5` remains `disabled` for the reason its
`statusReason` gives.

---

## The legacy engine reported rulings it then failed to highlight

This is the largest behavioural difference between the two engines, and it is not
a disagreement about tajweed. The legacy engine contradicted *itself*.

It decided two different things in two different places. `CacheAyahRules` asked
"does this rule match this ayah" by running the compiled pattern over the
normalised text. `HighlightAyahs` then had to find that match again in the
*original* text in order to know where to colour, and it did so by building a
second, looser pattern from the matched fragment. That second pattern ends with a
negative lookahead when the fragment's last character is a bare wāw or yāʾ —
added to stop false madd highlights, and correct for madd. Applied to every rule,
it also rejects matches that were never in doubt.

VERIFIED on 10:107, rule `idgham-bi-ghunnah-noon.1` (`نْ + [ي ن م و]`), by running
the recovered matcher (`conformance/legacy/`):

```
matches on NORMALIZED text        : 3  →  "نْ ي"  "نْ ي"  "نْ ي"
re-find in ORIGINAL text          : 0 hits
same, without the final wāw/yāʾ lookahead : 3 hits
```

So the legacy application **listed 10:107 under إدغام بغنة in the researcher, and
then rendered the ayah with nothing highlighted**. Nothing errored. The rule was
`stable`, the ayah was in the result set, and the colour simply never appeared.

Affected rules: `idgham-bi-ghunnah-noon.1`, `idgham-naqis-noon.1`,
`izhar-mutlaq.1`, `mutamathilain-izhar.29`, `izhar-shafawi-meem.1`, and
`idgham-bi-ghunnah-tanween.1`–`.3` and `idgham-naqis-tanween.1`–`.3`.
`madd-badal.1` fails the same way for a different reason: normalisation produces
`أَا`, which cannot be found in text that reads `أٓ`.

**This accounts for roughly 21,000 of the spans this engine produces that the
legacy engine did not.** That bulk is the legacy engine's missing highlights
being restored, not this engine over-matching — the two engines agree at ayah
level on every one of those rules. Anyone comparing span counts between the two
should read that number as a repair.

It belongs to a class worth naming, because it is not rare: **a check or a
feature that reports success while doing nothing.** The eight rules that matched
nothing because normalisation had already removed the mark they look for, further
down this page, are the same shape — compiled cleanly, ran, returned zero, and
reported `stable`. The lesson both times is that "no error" and "no output" are
indistinguishable unless something asserts the output is non-empty.
`scripts/validate-rules.ts` now makes that assertion for the second case; the
first is structural, and the port removed it by deriving extents from an offset
map instead of searching twice.

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

## قلقلة was being marked on letters that are never released

Three defects with one shape: a letter that is not sakin was being treated as
sakin, because `insertImpliedSukoon` supplies a sukoon to any bare consonant.
That pass exists for the إدغام rules, which are written `بْ + ب` and need the
merged letter to look sakin in order to find it. قلقلة needs the opposite — it
does not occur on a letter that merges into the next.

| | Was | Now |
|---|---|---|
| `qalqalah-sughra.1` | 2,970 | 2,923 |
| `qalqalah-mutatarrifa.1` | 512 | 494 |
| `madd-lazim-kalimi-muthaqqal.3` | 1 | 0 |

**Merged letters.** `ٱضۡرِب بِّعَصَاكَ`, `قَد تَّبَيَّنَ`, `ٱرۡكَب مَّعَنَا`,
`أَرَدتُّمۡ`, `عَٰهَدتُّمۡ` — the mushaf leaves the letter bare precisely because
it is assimilated. A new anchor, `غير مدغم`, rejects them: a doubled following
letter for إدغام كامل, and طاء before تاء for إدغام ناقص, which carries no
shadda and so needs naming separately (`بَسَطتَ`, `أَحَطتُ`, `فَرَّطتُمۡ`).

**Disjoined letters.** `قٓ` and `عٓسٓقٓ` were reported as قلقلة متطرفة, and the
ṭāʾ of `طه`, `طسٓ` and `طسٓمٓ` as قلقلة صغرى. These are letter names — *qāf*,
*ṭā-hā* — with no sakin qāf or ṭāʾ anywhere in them. Two passes now decline to
imply a sukoon: on a consonant carrying a maddah, and on one followed by another
consonant with no vowel, which no Arabic word can contain.

**A yaa that is not a madd letter.** `madd-lazim-kalimi-muthaqqal.3` matched only
`بِأَييِّكُمُ` (68:6), where the yaa follows a fatha and carries no maddah. Its
label says الياء المدية; the pattern now requires the kasra that makes one, and
the count is zero, which is the correct answer for this madd in Hafs.

### What else moved, and why

The two normalisation passes change 32 ayahs, all of them disjoined-letter
openings. Four other rules move with them:

- `tafkheem-rank-4-jazari.1` loses 9. It wants a **sakin** حرف استعلاء, and the
  ṣād of `الٓمٓصٓ` is read *ṣād*, with a fatha. Those nine were wrong.
- `idgham-bi-ghunnah-noon.1` and `idgham-naqis-noon.1` each lose 68:1,
  `نٓۚ وَٱلۡقَلَمِ`. The written nūn opens the name *nūn* and is not sakin, and
  Hafs reads that junction with إظهار rather than إدغام. Also wrong.
- `izhar-shafawi-meem.1` loses 7:1 and 13:1. This one is a real loss: إظهار
  شفوي does occur there, but on the final mīm of the spelled name *mīm*, which
  is not a character in the text. The notation cannot see spelled-out names —
  the same limit that keeps المد اللازم الحرفي from splitting into مثقل and
  مخفف. Right ruling, wrong letter; it is no longer claimed.

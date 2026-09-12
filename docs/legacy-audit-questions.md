# Three questions from the legacy differential

Raised by re-running the original PHP engine against this one over all 6,236
āyahs. The oracle and the command are in `conformance/legacy/` and
`scripts/differential-legacy.mjs`, so none of this has to be taken on trust.

Every claim below is marked **VERIFIED** (I ran it) or **ASSUMED** (I did not).
There is no CI in this org — the Actions billing block means nothing here has
been checked by anything but a local run.

These belong next to the nine in `QUESTIONS-FOR-ABDULLAH.md`; the first is an
extension of its §8 rather than a new question.

---

## A. The twelve unreviewed rules are not waiting to ship. They shipped on 18 August.

**The question.** Is unreviewed-but-live acceptable while a reviewer is found, or
should the twelve be pulled from production until someone qualified clears them?

**Evidence.** VERIFIED from the production `tajweed_rules` table. A single write
at **`2026-08-18 11:48:40`** created hukums 53–58 and rules 175–182 — the eight
rules authored here — and in the same second updated `madd-muttasil.2`,
`madd-muttasil.3`, `madd-munfasil.2` and `madd-munfasil.4`, the four madd
corrections. A second write at `11:49:23` updated the three `tahhan.3` rules.

```
created_at = 2026-08-18 11:48:40   ids 175-182   (qalqalah x3, madd lazim x5)
updated_at = 2026-08-18 11:48:40   ids 167, 168, 170, 172
updated_at = 2026-08-18 11:49:23   ids 13, 16, 19
```

So every rule this corpus marks `needsReview: true` has been live on
tajweed.quranpedia.net for about three weeks.

**Why it matters.** `needsReview` is not functioning as a pre-release gate. It is
a note attached to something readers are already being shown. The line in
`packages/rules/README.md` — *"The rule still matches in the meantime"* — reads
differently once "the meantime" is production. §8 of the other document measures
their weight: 4,144 of 147,255 spans, 2.81%, with the three qalqalah rules
carrying most of it.

This does not make the rules wrong. The differential shows the four madd
corrections fixing patterns that searched for the wrong madd letter, and the
qalqalah and madd lāzim rules filling a gap the spreadsheet never covered — which
is why every āyah of الحروف المقطعة used to come back with no ruling at all.

**Recommendation.** None on the scholarship; I am not qualified to give one. Only
this: the honest options are to accept it explicitly or to revert it, and leaving
it undecided is the one option that gets worse with time.

---

## B. The workbook says where a ruling starts, and neither engine ever read it

**The question.** Should a span cover the whole match, or only the letter the
ruling is *about*? The workbook has a column that answers this — `بداية الحكم` /
`start_from` — and **29 rules and 6,260 published spans turn on the answer.**

This is the only open item that would change **published offsets on rules nobody
has flagged as wrong**.

**Evidence.** VERIFIED — `pnpm differential --start-from`, which is committed and
reproduces this in about a minute:

```
rules with start_from != case (enabled) : 74
rules of those producing any matches    : 35
rules whose spans would SHRINK          : 29
matches over those rules                : 21,972
matches that would shrink               :  6,260  (28.5%)
code points highlighted now             : 69,746
code points highlighted via start_from  : 60,798  (12.8% less)
```

### The 29 where the column reads as an instruction

One coherent family — every two-group إدغام/إظهار rule, where `start_from` holds
only the **first** group:

| Rule | `CASE` | `بداية الحكم` | Matches | Today | Would be |
|---|---|---|---|---|---|
| `mutamathilain-idgham-kamil.23` | `لْ + ل` | `لْ` | 2,672 | `لْل` | `لْ` |
| `mutamathilain-izhar.29` | `مْ + و` | `مْ` | 1,089 | `مْ و` | `مْ` |
| `mutamathilain-izhar.27` | `وْ + م` | `وْ` | 863 | `وْم` | `وْ` |
| `mutamathilain-idgham-kamil.24` | `مْ + م` | `مْ` | 832 | `مْ م` | `مْ` |
| `mutajanisain-ikhfa-shafawi.1` | `مْ + ب` | `مْ` | 496 | `مْ ب` | `مْ` |
| `mutamathilain-idgham-kamil.25` | `نْ + ن` | `نْ` | 150 | `نْ ن` | `نْ` |
| … 23 more, 45 matches down to 1 | | | | | |

Read as an instruction that is coherent and defensible: **colour the sākin letter
the ruling is about, not the letter that triggers it.** إدغام happens *to* the
لام in `لْل`; the second lām is the environment, not the event.

### The 6 where it looks like an undeleted draft — and these decide it

The rules where `start_from` differs but nothing shrinks are not a footnote. They
are what shows the column doing **five different jobs**, which is the real
finding — more than "29 rules would change" ever was:

| Rule | Matches | What `start_from` actually is |
|---|---|---|
| `madd-tabee-kalimi.3` | 9,668 | identical to `CASE` but for one space |
| `izhar-mutlaq.1` | 125 | identical to `CASE` but for one space |
| `leen-yaa.1` | 3,285 | a **smaller letter set** — `CASE` lists `أَ ؤَ ئَ ءَ`, this does not |
| `leen-waw.1` | 2,630 | a **smaller letter set** — same four hamza forms missing |
| `madd-munfasil.4` | 3 | **more correct than `CASE`** — see below |
| `seven-alefs-khulf.1` | 1 | `سلاسلا`, the stale pre-2026-02-24 form; `CASE` is `سَلَاسِلَاْ` |

So: an extent instruction in 29 rows, whitespace noise in 2, a disagreement with
`CASE` about which letters the rule covers in 2, stale in 1, and **more correct
than `CASE` in 1**. **A column that is authoritative in 29 rows, vestigial in 4
and better than the pattern column in 1 cannot be adopted by a single rule** —
and that is the finding, not a caveat on it. The answer cannot be "yes, use the
column". It can only be "use it for this family, having decided what each of the
other six is."

### Two rows that pay for the whole exercise

`madd-munfasil.4`'s own `start_from` reads `[ي يْ]` while its `CASE` reads
`[ا ى الألف الخنجرية]`, and `madd-munfasil.2`'s reads `[و وْ]` against a `CASE`
of `[ا ى]`. Both are exactly the corrections this port made to those rules.

So on those two rows **the author's own editorial column disagrees with the
author's own pattern column, and the editorial column is the one we
independently arrived at** — corroboration from the authored source rather than
from our reading of the rule's Arabic.

**Two of the four, not four.** `madd-muttasil.2` and `.3` carry the same wrong
alef group in *both* columns, so the error was copied into the editorial column
as well. `start_from` is not a general independent check on `case`; it is right
twice and wrong twice, and anyone tempted to use it to audit the rest of the
corpus should read those two rows first.

**This also kills the "undeleted draft" reading I gave these rows earlier, and
the correction strengthens the case rather than weakening it.** A draft does not
contain the right answer where the final version has the wrong one. On the two
منفصل rows the column is not *older* than `CASE` — it is *better* than `CASE`.
Which makes the four-jobs finding above sharper, not softer: the column is an
extent instruction in 29 rows, noise in 2, a coverage disagreement in 2, stale in
1, and **more authoritative than the pattern column in 2**. Five jobs, on the
evidence, and that is the reason it cannot be adopted by a single rule.

All four corrections keep `needsReview: true`. Corroboration from a spreadsheet
is not scholarly review.

### What cuts against adopting it

VERIFIED by reading the recovered engine: `start_from` appears **zero times** in
`conformance/legacy/matcher.php`. `TajweedRulesImport` stores the column and
`ImportAndStoreTajweedRules` writes it to the database, but neither
`DetectTajweedPattern` nor `HighlightAyahs` ever reads it. The legacy application
highlighted the whole match, exactly as this engine does.

So adopting it is **a change from legacy behaviour, not a restoration of it** —
the opposite direction to every other entry in `docs/divergences.md`, where the
port either matches the legacy engine or documents why it deliberately does not.
It is worth seeing stated that way before deciding.

**Recommendation.** Answer one narrow question — is `بداية الحكم` an extent
instruction or an editorial note? — and the 29 follow from it. If it is an
instruction, that is its own PR against 29 rules with before-and-after span
counts, and a corpus decision rather than a porting one. If it is editorial,
record that in `docs/case-notation.md` so nobody has to ask again. Either way the
six need a separate answer, and `madd-munfasil.4` suggests the column is worth
keeping as evidence even if it is never executed.

---

## C. Two rules were typed into the database and nobody wrote down why

**The question.** Should `raa-either-permissible.3` and `.4` carry a
`statusReason` saying they rest on nobody's signature, or does someone remember
the reasoning?

**Evidence.** VERIFIED from the production table. The 172 spreadsheet rows were
imported in one transaction at `2026-02-24 09:35:07`–`09:35:08`. These two were
created the next morning:

```
id 173  raa-either-permissible.3  created 2026-02-25 09:48:15  updated 09:48:58
id 174  raa-either-permissible.4  created 2026-02-25 09:48:15  updated 09:48:15
```

Both on hukum 16, `.3` revised 43 seconds after it was written. At the same
instant `raa-either-permissible.2` (id 41) was rewritten to `فِرْقٍ`. So this was
one deliberate sitting of work on ر rulings the morning after the import — not
stray rows and not an import artifact.

What is **not** recoverable: who, and why. `tajweed_rules` has no author column
and no note, and no migration or commit corresponds to the change. The
spreadsheet was never updated, which is why they look like orphans from this
side.

**Recommendation.** Give both a `statusReason` recording exactly that — hand-added
2026-02-25, one day after the authored import, no spreadsheet row, no recorded
rationale. Deleting them would be wrong; they are deliberate. Leaving them
unmarked is also wrong, because a reader has no way to tell them apart from rules
that have an authored source. If you remember the reasoning, it belongs in that
field instead.

The same treatment is worth considering for the eight rules in "There are two
legacy rule tables" in `docs/divergences.md` — `seven-alefs.1`–`.6`,
`seven-alefs-khulf.1` and `raa-either-permissible.2` — hand-edited in the database
in February 2026 and never written back to the workbook. Those at least have an
obvious motive: the spreadsheet forms are unvocalised and could never have
matched. But they have no more recorded authorship than these two do.

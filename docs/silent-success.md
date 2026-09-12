# Four times something reported success while doing nothing

This repository has hit the same failure four times in its short life, in four
different materials: a regex, a rule corpus, a spreadsheet, and a git checkout.
Each time the mechanism was invisible, each time the output looked reasonable,
and each time the thing that eventually exposed it was a number somebody
bothered to check against a second source.

The class is worth naming because the instinct it corrects is a strong one. When
a program does not error, we read that as evidence it worked. **It is not. "No
error" and "no output" are indistinguishable unless something asserts the output
is non-empty**, and none of the four below raised anything at all.

They are recorded here rather than in `docs/divergences.md` because they are not
divergences from the legacy engine. Three of them were *inherited* from it, and
the fourth was ours.

---

## 1. A rule matched, and then highlighted nothing

**Where:** the legacy PHP engine, `HighlightAyahs` + `DetectTajweedPattern`.

The engine decided twice. `CacheAyahRules` asked "does this rule match this
āyah?" by running the compiled pattern over the normalised text. `HighlightAyahs`
then had to find that match *again* in the original text in order to know where
to colour, and built a second, looser pattern to do it. That second pattern ends
with a negative lookahead when the fragment's last character is a bare wāw or
yāʾ — correct for madd, applied to every rule.

```
10:107, idgham-bi-ghunnah-noon.1 (نْ + [ي ن م و])
  matches on NORMALIZED text                : 3  →  "نْ ي" ×3
  re-find in ORIGINAL text                  : 0 hits
  same, without the final wāw/yāʾ lookahead : 3 hits
```

So the application **listed 10:107 under إدغام بغنة in the researcher, and then
rendered the āyah with nothing highlighted.** The rule was `stable`, the āyah was
in the result set, and the colour simply never appeared. Ten rules were affected;
roughly 14,000 spans this engine now publishes are that repair.

**Why nobody saw it:** the two stages were never compared with each other. Each
was individually plausible.

**Fixed by:** structure, not a test. This engine derives extents from an offset
map built during normalisation, so there is no second search to disagree with the
first. A whole category of bug is gone rather than guarded.

---

## 2. Eight rules matched nothing, and reported `stable`

**Where:** this engine, `OPTIONAL_MARKS` in `normalize.ts`.

Normalisation strips the marks that never appear in a CASE pattern — right for
almost every rule, wrong for the few whose pattern *is* one of those marks. Eight
rules compiled cleanly, ran against text the mark had already been removed from,
and matched nothing.

| Rule | Looks for | Was | Now |
|---|---|---|---|
| `madd-silah-sughra.1` | ۥ U+06E5 | 0 āyahs | 969 |
| `madd-silah-sughra.2` | ۦ U+06E6 | 0 āyahs | 791 |
| `seven-alefs.1`–`.6` | ۠ U+06E0 | 0 āyahs | 1/1/1/1/1/60 |

مد الصلة الصغرى is one of the most frequent madd in the muṣḥaf, and
`docs/coverage.md` listed it as covered throughout. Nothing errored, no test
failed, and the corpus reported the rules as `stable`. The only visible symptom
was a colour that never appeared.

**Why nobody saw it:** a rule that matches zero āyahs and a rule that matches
zero āyahs *because its input was destroyed* produce byte-identical output.

**Fixed by:** an assertion. `scripts/validate-rules.ts` now rejects any rule whose
pattern contains a mark normalisation strips unless it declares
`matchAgainst: "original"`. That is the general remedy for this class — make the
empty output illegal rather than merely unusual.

---

## 3. A workbook that the application had stopped reading from

**Where:** `resources/tajweed_rules.xlsx` versus the production database.

Eight rules — `seven-alefs.1`–`.6`, `seven-alefs-khulf.1` and
`raa-either-permissible.2` — were hand-edited **in the database** on 2026-02-24
and -25, hours after the workbook was imported. The workbook was never updated.
For seven months two rule tables disagreed and nothing anywhere said so.

The consequence is the sharpest in this document. The first differential run of
this audit used the workbook as its oracle and reported **139 of 154** rules
agreeing, with eight apparent corrections credited to this port. Every one of
those numbers was correct. All of them answered a question nobody had asked.
Against the table the engine actually ran with, the figure is **147 of 154**, and
the eight were not corrections at all — they were faithful transcription.

**Why nobody saw it:** *a spreadsheet cannot report that it has been overtaken.*
It has no way to know it is no longer the source of truth, and it goes on
answering in the same confident tone it always had.

**Fixed by:** keeping both and refusing to let either travel alone. `pnpm
differential --rules deployed|spreadsheet` reports each, and
`conformance/README.md` quotes both with the note that they answer different
questions — *does the engine match what ran* and *does a rule still say what its
author wrote*.

---

## 4. Two agents measuring a working tree the other was editing

**Where:** this repository's checkout, during this audit.

This one is different in kind and is kept separate for that reason. Nothing was
silent. Nothing returned empty. Two correct instruments each measured a shared
directory that the other was concurrently modifying, and both produced internally
consistent numbers describing a state that nobody owned.

I ran `pnpm test` against the checkout and reported three failures as the state
of the repository. They were another agent's uncommitted experiment, already
measured and rejected by its author. Meanwhile my own uncommitted files were
blocking that agent from checking out the branch it needed, and a later
inspection of the same tree by a third party read as stale within minutes.

**The tell was in my own output and I walked past it:**

```
AssertionError: expected 79 to be greater than 79
```

That is not what a stale baseline looks like. A stale baseline gives you a moved
*count* — `matched 1745, frozen at 1746`. **An assertion failing against itself is
what a live edit looks like.** I had the evidence to ask "whose tree is this?"
and instead wrote "the working tree", as though the repository had one state and
I was its reader.

**Why checking `git status` did not help:** it was checked. It answered honestly.
It reports what is in the tree, not who put it there or whether they are done.

**The rule:**

> **A shared mutable resource has an owner, and if you cannot name the owner you
> cannot cite the measurement.**

**Fixed by:** `git worktree`. Every agent works in its own checkout, and a
measurement names the SHA it was taken at. Nothing in the code changed, because
nothing in the code was wrong.

---

## What generalises

For the first three: **make emptiness illegal.** A pipeline stage that can
legitimately return nothing needs something downstream that says how often
"nothing" is acceptable. `validate-rules.ts` does this for one case, the offset
map removed the possibility in another, and `--rules` surfaces the third by
refusing to have a single answer.

For all four: **a number is only as good as the second source you checked it
against.** Every one of these was found by comparison, never by inspection — the
legacy engine against itself, a rule's output against its description, the
database against the workbook, one agent's test run against another's. A
measurement with nothing to disagree with is not evidence, however precise it
looks.

And the habit that would have caught three of the four earliest: when a number is
suspiciously clean — 0 āyahs, 100% agreement, exactly the expected count — treat
it as a question rather than a result. `tajweed_ayah_spans` holding exactly
147,255 rows, our own published span count, is what revealed that the production
database is downstream of this engine and cannot be used to check it.

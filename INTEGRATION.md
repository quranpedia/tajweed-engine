# `integration/the-set` — what this branch is, and what to check hardest

This branch is an **instrument, not a delivery**. It exists so that the thing
that would ship can be measured, rather than ten branches that each pass alone.
Nothing here is proposed for `main`.

Everything below was run on one machine. **There is no CI on any of it** —
GitHub Actions has been failing org-wide on a billing problem since 2026-09-11,
so no pull request in this repository has been checked by anything but a person.

**And these two bodies of evidence are not one body of evidence.** Both audits
were run against **individual branch heads**; nobody has independently measured
the merged artefact. The verdicts in this file that come from auditors attach to
the branches they name, at the commits they named. Everything about the
integration itself — the union, the resolutions, the totals — is **self-reported
by the person who built it**, which is me. Read the two accordingly, and do not
let the audits lend their authority to the merge.

**An audited head is a specific tree.** Several branches moved after the
auditors recorded their heads, so those verdicts describe trees that no longer
exist. Where a figure here is attributed to an audit, it describes the commit
the auditor named and not necessarily the branch tip today.

---

## Lead with this: a gate added tonight caught four branches contradicting each other

`packages/rules/test/readme.test.ts` reads the four corpus counts back out of
`packages/rules/README.md` and compares them to `rules.json`. On this branch, on
its first real outing, it failed immediately:

```
README said   7 topics → 27 categories → 58 ahkam → 182 rules
corpus had    9 topics → 33 categories → 68 ahkam → 199 rules
```

**It could not have fired anywhere else.** On the branch that adds the guard the
corpus is unchanged; on the three branches that change the corpus the guard does
not exist. Four branches, each green, contradicting each other only in
combination — which is the exact failure this branch was built to look for,
found by the exact instrument built to look for it.

A second instance, found the same way: the three-way merge of
`docs/coverage.md` **silently reverted a correction**. Three of the four rule
branches carry a sentence saying every āyah has at least one annotation; one
branch had corrected it to say 6,235 of 6,236, because 20:1 طه has none. Merging
reinstated the wrong sentence. The fix still existed on its own branch and was
gone from the thing that ships.

Both are recorded in [`docs/checks-that-report-success.md`](docs/checks-that-report-success.md),
which is the general case: a check that runs, passes, and cannot report the thing
it was written for.

---

## Check this hardest: `packages/rules/rules.json` was built programmatically

Every pair of the four rule branches conflicts on `rules.json` itself — the
corpus, not a derived file. Rather than hand-merge eight hunks of Qurʾānic rule
data, it was rebuilt as a **union**, and the safety of that rests on two claims.

**These are claims requiring independent verification, not findings.** Both are
mine, both are checkable, and neither has been checked by anyone else:

1. **All four rule PRs are purely additive.** No topic, category, hukum or rule
   that exists on `main` is modified or removed by any of them.
2. **No added id collides**, except the topic `waqf`, which #3 and #4 both add
   and which is **byte-identical** between them — as is its colour in
   `render.ts`. That is mechanical confirmation of the scholarly ruling that #3
   and #4 are one piece of work and merge together or not at all.

**How the union was built, so it can be rebuilt a different way and compared:**
for each of `topics`, `categories`, `hukums`, `rules`, start from the state after
`#1` and `#2` are merged, then append from `#3` and `#4` every entry whose `id`
is not already present. Order within each array is main's, then #1's, then #3's,
then #4's. No entry is edited, none is dropped, and no id appears twice.

**One correction to that description.** It is not quite what happened, and an
auditor chased the difference as a possible defect before establishing it was
benign. #2's `raa-tarqeeq.5` is **inserted at index 39**, beside the other
`raa-tarqeeq` rules, rather than appended — which is why `madd-lazim-harfi.1`
sits at 182. Arguably better than appending, and not what the paragraph above
says. The described construction is not the one used.

`rules:validate`, `rules:audit` and `rules:verify` all pass on the result — but
**all three were written here**, and a validator that does not test for a
duplicate topic id cannot report one. Please rebuild the union independently and
diff, rather than taking the passing gates as proof.

---

## The result

| | |
|---|---|
| spans | **150,096** |
| compiled / producing / authored rules | **178 / 140 / 199** |
| spans, edition against edition | **150,096 and 150,096 — identical** |
| rules matching a different number of āyahs | **0 of 178** |
| āyahs normalising alike | **6,233 of 6,236** |
| residue | **3** |
| tests | **83** |

**The residue of three is the best single number here.** On any branch alone it
is four. #2's imāla alternation resolves 11:41 — but only once #7's second
edition is present to exercise it, and neither branch shows that by itself.

Per-branch totals, for attribution: `main` 147,255 · `#1` 147,259 · `#2` 147,255
· `#3` 149,175 · `#4` 148,166 · `#10` 147,261. **No branch carries a rule id this
branch lacks**, so nothing was dropped by the union.

---

## Merge order, and why it is not the one that was set

```
#11 → #13 → #14 → #7 → #9 → #2 → #1 → #3 → #4 → #10
```

The agreed order was `#11 → #7 → #9 → #2 → #1 → #3 → #4 → #10`. **#13 and #14
were inserted after #11 because neither existed when that order was set.** They
are independent of `main` and low-conflict, and putting **#14 (the gates) in
early means every branch merged afterwards is measured by them** — which is how
the README contradiction above was caught at all. Nothing else moved, and #3 and
#4 went in as a unit.

Read the deviation as deliberate, not drift.

---

## Resolutions, and the rule applied to each

- **Derived files** — `packages/annotations/uthmani-hafs.json`,
  `conformance/frozen.json`, `reports/*.json` — were **regenerated on this
  branch**, never resolved by choosing a side and never edited by hand. That file
  conflicts in all six pairs and it is the artefact consumers download.
- **`scripts/verify-rules.ts`** is modified by three branches, and a gate
  resolved badly still runs, still prints, and no longer fires. After merging it,
  the injected-fault test was re-run **on this branch** — reverting
  `imalah-kubra.1` to its single spelling produces:
  ```
  ✗ [hafs-quran-text.json] imalah-kubra.1: expected a match at 11:41, found none
  ✗ [hafs-quran-text.json] imalah-kubra.1: expected exactly 1 occurrences, found 0
  2 check(s) failed        exit 1
  ```
  It bites, and it names the edition. It now runs **23 pinned rules across 2
  editions** — #1's multi-edition machinery exercising #3 and #4's fixtures
  against a text they were never tested on.
- **Source conflicts** — the import list in `normalize.ts`, the fixture array in
  `verify-rules.ts` — were resolved by keeping both sides, then checked
  functionally rather than visually: `raa-tarqeeq.5` still matches once on each
  edition and `raa-tafkheem.3` still matches zero, which is what #2 exists to do.

## Review debt

**26 rules carry `needsReview: true`, and every one ships `status: "stable"`** —
up from 12 on `main`, with the 14 new ones not overlapping. That assumption was
computed per branch and is now tested here. The 26 ids are listed in the message
accompanying this branch; a consumer reading `status`, which is what `status` is
for, is told all 26 are settled.

Nothing here changes any status. Doubling a frozen debt is a decision, not a
merge conflict.

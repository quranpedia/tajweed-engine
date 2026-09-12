# Checks that report success while doing nothing

Every defect found in this repository over one long night was the same defect.
Not the same code — the same *shape*. A check exists, runs, passes, and cannot
report the thing it was written for.

This is worse than having no check. No check is a known gap. A check that cannot
fire is a gap that someone has already decided is covered, and the green tick is
the evidence they will cite.

Eight instances follow. Each is recorded with what it would have cost, because
the cost is the argument.

## The three in the repository's own gates

**`edition:check` exited 0 after every tanwīn was stripped.** Removing U+08F0–U+08F2
from all 6,236 āyahs of a valid edition silenced twenty-four rules — the whole
idghām, ikhfāʾ, iqlāb and iẓhār family. The script printed all twenty-four, said
*"No blocking problems"*, and exited **0**, because rule drift was a warning and
warnings do not gate. The CI step that ran it carried a comment saying it caught
exactly this failure.

*Cost if unfixed:* the migration to a new text edition would have reported a
clean bill while every tanwīn ruling silently vanished.

**The conformance suite never compared occurrence counts.** The frozen digest is
taken over the *list* of āyahs a rule matches, so a rule that fires a different
number of times inside the same āyahs leaves it unchanged. Demonstrated live:
recovering the hamza written below the line moved `mutamathilain-izhar.1` by −1
and `.2` by −7 with **byte-identical digests**. The counts were in `frozen.json`
all along; nothing read them.

*Cost if unfixed:* any change to how often a rule fires, anywhere, passes review.

**`rules:validate` accepted a malformed CASE.** `compile.ts` strips brackets
rather than parsing them, so a nested class does not fail — it degrades into a
literal. `[ر[زس]]` becomes the three-letter sequence `رزس`, which occurs nowhere.
It validates, compiles, matches nothing, and freezes at `digest("")`, where the
conformance test asserts *still nothing* forever.

*Cost if unfixed:* a rule that is wrong and looks correct from every angle this
repository has. It is the most plausible way the eight rules PR #6 found had
rotted.

## The two in how work was checked

**`verify-rules.ts` was pinned to one edition.** A fixture is only as portable as
the text it is pinned against, and this one hard-coded
`editions/uthmani-hafs.json`. Four rules written as raw byte literals passed it
while matching **nothing** on the other edition in the same directory, because
the other edition was never run.

*Cost if unfixed:* rules that are correct on the text being retired and silent on
the text replacing it — discovered after the migration, not before.

**A missing edition skipped the whole conformance suite.** `existsSync ? describe
: describe.skip` meant renaming one file made `pnpm test` green having verified
nothing at all. This matters beyond tidiness: the migration *moves that file*.

*Cost if unfixed:* the suite goes quiet at precisely the moment the text changes
underneath it.

## The three in the tooling built to measure all of the above

These are the uncomfortable ones. Each was written during this work, by someone
who had just spent hours finding the others.

**A transformation class that described an old shape of the data invented 494
differences that do not exist.** `edition:diff` modelled the two editions as
differing in four classes, one of which stripped a kashida from the left-hand
side. When the upstream fix restored the kashida to the right-hand side, that
transformation began manufacturing differences, and the report called them
*differences in the text*. It was caught only because 498 was an implausible
number to see in Qurʾānic text and worth stopping on.

*Cost if unfixed:* a report, in this repository's voice, claiming 498 āyahs of
the Qurʾān differ between two editions of one riwāyah.

**A re-check instrument carried a hard-coded baseline.** It listed the seventeen
unresolved āyahs as a constant. By the time it ran, eight had been resolved by
this repository's own later work — and a fixed list would have credited those
eight to the upstream change.

*Cost if unfixed:* an upstream fix reported as more effective than it was, in the
report written to evaluate it.

**A check kept asking a question that had stopped being the right one.** To decide
whether ownership of a mark was recoverable, an instrument asked whether two
vowels sat above the line. That was correct while the seat was missing. After the
seat was restored it was the wrong question, and the check would have reported
all six cases as still ambiguous — confidently — on data where they had become
byte-identical to the reference.

*Cost if unfixed:* the answer to the question the whole upstream investigation
was for, reported backwards.

## What they have in common

1. **Every one produced a passing result.** None errored, none warned, none was
   slow or noisy. The signal that something was wrong was always a *number that
   was too good, too round, or too implausible* — never a failure.
2. **Most were introduced by someone who understood the system.** The four-class
   model was right when written. The hard-coded baseline was accurate when typed.
   The two-vowel test was the correct test for the data that existed that hour.
   **They did not become wrong by being careless; they became wrong by being
   left alone while the world moved.**
3. **The measurement always existed.** `frozen.json` already recorded the
   occurrence counts. The annotation file already recorded the edition digest.
   The information needed to catch these was present and unread.

## What to do about it

- **A check must be shown to fail.** Every gate added during this work was
  verified in both directions — the real input passes, an injected fault fails.
  A gate that has never been seen to fire is not known to be a gate.
- **Prefer deriving a number to writing one down.** Where a figure cannot be
  derived — a README's prose — guard it with a test that reads it back and
  compares. Seven counts in this repository were stale; the one with a generator
  went stale too, because nothing re-ran it.
- **Record a set, not a count.** "Seventeen āyahs differ" survives nothing. The
  seventeen references survive being copied, re-run, and argued with.
- **When a number is implausible, stop.** Three of the eight above were caught
  that way and no other.
- **Ask what a check would say if the thing it watches were deleted.** If the
  answer is "nothing", it is not watching.

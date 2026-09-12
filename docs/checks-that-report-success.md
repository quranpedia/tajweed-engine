# Checks that report success while doing nothing

Every defect found in this repository over one long night was the same defect.
Not the same code — the same *shape*. A check exists, runs, passes, and cannot
report the thing it was written for.

This is worse than having no check. No check is a known gap. A check that cannot
fire is a gap that someone has already decided is covered, and the green tick is
the evidence they will cite.

Thirteen instances follow. Each is recorded with what it would have cost,
because the cost is the argument.

The last five were found after the first eight were written down, by people who
had just written them down. That is not an embarrassment to be trimmed out of
the document — it is the strongest evidence in it that the pattern is not about
carelessness.

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

## The five found after this document was written

These were all found while fixing the eight above, by people holding this list
in their heads. Four of them are mine.

**A check reported success from a command that never ran.** `annotate.ts` was
invoked without its arguments, printed its usage banner, and exited. The next
line, `git diff --exit-code`, passed — against an artefact that nothing had
regenerated — and the run was reported as "NO DRIFT". Every part was true. The
command ran, the diff was clean, the exit code was 0. The only false thing was
the sentence joining them.

It has three siblings from the same night, and they are one mistake: reading
`$?` after a pipeline, so the exit status belongs to `tail` rather than to the
gate; and reading `$?` inside `echo "$(basename "$f") EXIT=$?"`, where the
command substitution runs first and the status belongs to `basename`. In every
case a real gate ran and produced a real verdict, and the verdict reported was
somebody else's.

*Cost if unfixed:* every "all gates pass" in every report built on them. Four
separate green results, none of which was the green of the thing being claimed.

*The fix is not care.* It is to confirm the run executed before reading its
result — check that the output looks like output, capture the status into a
variable before anything else can touch it, and treat a gate that printed
nothing as a gate that did not run. Two of the four were caught only because a
gate printed *"This edition is not one the engine can read"* immediately above
an `EXIT=0` that had been printed by hand.

**A verification run in the wrong tree produced the expected output for the
opposite reason.** To prove that a fix to the unknown-marks gate removed a false
positive on U+0655, the mark was deleted from `OPTIONAL_MARKS` on `main` alone.
The gate flagged it, which is what the broken version did, and it looked like a
clean reproduction. It was the reverse: on `main` there is no pass that recovers
that mark, so it genuinely does survive normalisation, and the gate was right to
flag it. The condition being tested only exists where the other branch's
recovery pass and the gate are in the same tree.

*Cost if unfixed:* a proof, in a pull request, demonstrating the opposite of
what it claimed — and a fix merged on the strength of it.

*What it teaches:* the output of a verification is not evidence until you can
say which tree produced it. An expected result from the wrong base is
indistinguishable from a correct one.

**A defect that lived only in the text a human reads.** `edition:diff` printed
`4 left over, and those are real differences in the text`. Not one of the four
was a difference in the letters: two were word separation, one was the same
ruling written with two different code points, and one was unresolved. The
sentence was wrong about all four.

The committed JSON report — the thing consumers actually read — **never carried
that phrase**. It was print-only. So no test could fail, no consumer could
notice, and no downstream check could contradict it. The only place the defect
existed was the summary a person reads, and every copy of it downstream was
correct about its source and wrong about the world, because the tool supplied
the sentence.

*Cost if unfixed:* a claim, in this repository's voice, that four āyahs of the
Qurʾān differ between two editions of one riwāyah.

*What it teaches:* prose emitted by a tool is not documentation, it is output,
and it needs the same suspicion. A defect no consumer can see is not a small
defect; it is an undetectable one.

**A gate that watched a set and reported a count.** Deleting an expectation from
`verify-rules.ts` — including the single fixture pinning the repository's only
imāla rule to its only location — leaves it printing `all 22 pinned rules behave
as expected` and exiting 0. `EXPECTATIONS.length` appeared once in the codebase,
inside a `console.log`.

This is the document's own test — *ask what a check would say if the thing it
watches were deleted* — and the answer was not "nothing". It was a number, which
is worse, because a number looks like a measurement.

*Cost if unfixed:* the only protection the byte-literal rules have, removable in
a merge without a single failing check, in a file three branches modify.

*One thing came free.* While proving the replacement gate fires, a fault
injection truncated `verify-rules.ts` to zero bytes — Python opens a file for
writing before evaluating what to write — and the new gate caught that too,
through the assertion that exists to check the file is still readable in the
shape the test parses. A gate whose only proof is a deliberate test is weaker
than one that has also failed by surprise.

**An approval names a tree, and a branch that moves is no longer the approved
thing.** A pull request was audited at one commit, two further commits were
pushed to it, and it was merged at the later tree under the earlier
authorisation. Both commits had been requested and nothing moved that could not
be explained — which is precisely why it is worth recording, because the
instance that costs nothing is the one that establishes the habit.

It bit in both directions the same night: a stale SHA was handed to auditors and
their verdicts attached to a tree that had already moved.

*Cost if unfixed:* every audit verdict in the repository silently describing
something other than what ships.

*What it teaches:* an approval, an audit verdict and a measured number all name
a specific tree. Quote the SHA with the number, and re-measure when the base
moves rather than carrying the figure forward.

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
4. **Several were not wrong about anything.** The command ran. The diff was
   clean. The exit code was 0. The count was accurate. What failed was the
   sentence joining two true things, or the assumption about which tree, which
   process or which file the true thing described. A defect does not have to
   live inside a measurement to survive every check — it can live in the space
   between two of them.

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
  answer is "nothing", it is not watching. If the answer is a number, it is
  worse than not watching, because a number looks like a measurement. Watch the
  set, and pin its size.
- **Confirm a command ran before reading its result.** A gate that printed
  nothing did not run. Capture an exit status into a variable before anything
  else can touch it — not after a pipe, and never inside a string that also
  contains a command substitution.
- **Say which tree a number came from.** An approval, an audit verdict and a
  measured figure all name a specific commit. An expected result produced from
  the wrong base is indistinguishable from a correct one, and can be expected
  for the opposite reason.
- **Treat prose a tool prints as output, not as documentation.** It is the one
  place a defect can live where no consumer, no test and no downstream check can
  see it — and every copy of it downstream will be faithful to its source and
  wrong about the world.
- **Fix the tool, never the copies.** Where a wrong sentence is emitted, the
  copies are consequences. Correcting them while the generator keeps producing
  the sentence is this entire document performed as a single action.

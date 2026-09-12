# Conformance

The engine's behaviour is pinned by digests, so any change to what it matches
shows up as a failing test rather than as a quiet difference in output.

## Running it

```bash
pnpm test
```

The suite reads the text edition at `editions/uthmani-hafs.json`, which is in the
repository, so it runs everywhere including CI.

## What is pinned

[`frozen.json`](./frozen.json) holds two things, and no Quranic text:

- **A digest of every ayah's normalised form.** Normalisation is where a mistake
  changes what the text is understood to say, and it is deterministic, so there
  is no reason to accept anything less than exact agreement across all 6,236
  ayahs.
- **A digest of the set of ayahs each rule matches**, with counts. A rule whose
  matches move at all fails, and the message says by how much.

Regenerate deliberately, never reflexively:

```bash
pnpm conformance:freeze
```

Then **read the diff**. A refactor should move nothing. A rule change should move
exactly the rule you changed. Anything else means something happened that you did
not intend.

## What is not pinned, and why

**Span extents.** The engine derives them from an offset map built during
normalisation; the tests assert they are well-formed and inside the text, not
that they equal any particular previous value. Pinning them would freeze
presentation decisions that are allowed to change.

## Where these digests came from

This engine is a port. At the migration snapshot it was checked against the
implementation it replaced, over the whole mushaf, in two ways: normalised text
compared character for character, and rule-to-ayah incidence compared set for
set. Both agreed exactly, for every ayah and for every comparable rule.

**That was the state at the snapshot, and it is no longer the state at HEAD.**
The current figure, and the one to quote:

> **147 of 154 comparable rules agree set-for-set with the legacy engine as it
> actually ran** (`pnpm differential --rules deployed`). The seven that differ are
> every deliberate change this engine has made and nothing else: three madd rules
> whose patterns searched for the wrong madd letter, and four that stopped
> reading the letter names of الحروف المقطعة as sakin consonants.

Each of the seven is recorded in [docs/divergences.md](../docs/divergences.md). A
reader who quotes "agreed exactly" about today's engine is quoting the wrong
sentence.

The same run against the *authored workbook* reports **139 of 154**, and both
numbers have to travel together or neither means anything. The difference is
eight rules — `seven-alefs.1`–`.6`, `seven-alefs-khulf.1` and
`raa-either-permissible.2` — which **production stopped matching in February
2026**: they were hand-edited in the legacy database on 2026-02-24 and -25, nine
hours after the workbook was imported, and the workbook was never updated to
match. This corpus carries the database value for all eight, so they are
inherited rather than authored here. 139 is not a worse 147; it is the answer to
a different question — *does a rule still say what its author wrote* — and on
eight rules the author's last word was typed into a database, not a spreadsheet.

**Comparable is 154 rules, not 164.** 164 is the number of *enabled* rules
(182 − 18 disabled), and it is the wrong denominator for a comparison against the
PHP: 8 of those 164 were authored for this corpus and have no legacy counterpart,
and 2 more (`raa-either-permissible.3` and `.4`) were hand-inserted into the
legacy database with no spreadsheet row behind them. 182 − 18 − 8 − 2 = 154.

That comparison needs the original implementation to be present. It is no longer
part of the application it came from, but it is recoverable and it has been
recovered: see [`legacy/`](./legacy/), which holds the matcher and a script that
re-runs the whole differential. `frozen.json` remains the cheap guarantee — being
digests rather than text, it can be committed and it runs in a second.

## Digests, not text

`frozen.json` holds no Quranic text — only hashes of what the engine did to it.
Fixtures reference ayahs as `surah:ayah`, and failure messages name references
rather than quoting passages.

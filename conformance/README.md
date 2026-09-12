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
Seven rules have deliberately moved since: three madd rules whose patterns
searched for the wrong letter, and four that stopped mis-reading الحروف المقطعة.
Each is recorded in [docs/divergences.md](../docs/divergences.md). A reader who
quotes "agreed exactly" about today's engine is quoting the wrong sentence.

Seven, not fifteen, and which number you get depends on which legacy rule table
you compare against — so say which. Eight further rules (`seven-alefs.1`–`.6`,
`seven-alefs-khulf.1`, `raa-either-permissible.2`) differ from the authored
spreadsheet but **match the legacy database exactly**: they were hand-edited
there in February 2026 and the workbook was never updated. This corpus carries
the database value, so those eight are inherited rather than authored here.
`node scripts/differential-legacy.mjs` reports both numbers — 147/154 against
`--rules deployed`, 139/154 against `--rules spreadsheet`.

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

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

This engine is a port. During the migration it was checked against the
implementation it replaced, over the whole mushaf, in two ways: normalised text
compared character for character, and rule-to-ayah incidence compared set for
set. Both agreed exactly, for every ayah and for all 164 comparable rules.

That comparison needed the original implementation to be present, and it no
longer is. `frozen.json` is the same guarantee in a form that outlives it — and
being digests rather than text, it can be committed.

Deliberate differences from the original are recorded in
[docs/divergences.md](../docs/divergences.md).

## Digests, not text

`frozen.json` holds no Quranic text — only hashes of what the engine did to it.
Fixtures reference ayahs as `surah:ayah`, and failure messages name references
rather than quoting passages.

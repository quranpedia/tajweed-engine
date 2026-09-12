# @quran.ws/tajwid-cli

```bash
npx @quran.ws/tajwid-cli rules qalqalah
npx @quran.ws/tajwid-cli explain madd-lazim-harfi.1
npx @quran.ws/tajwid-cli gaps
```

The CLI does two kinds of thing.

**Asking questions about the rules** needs no Quranic text and works right
away — which rules exist, what a rule says, and which rules the notation still
cannot express.

**Annotating** needs text, which this tool does not ship and will not fetch:

```bash
tajweed annotate --text "مَنْ تَكَلَّمَ سُوءًا"
echo "…" | tajweed annotate --format json
tajweed annotate --edition ./my-edition.json --ref 2:255 --only madd
```

`--format` is `ansi` (default), `json`, `html` or `text` (tab-separated
positions, for piping into something else).

`tajweed verify --edition <file>` prints an edition's digest — the value an
annotation set records to say which text it describes. If the digests do not
match, the positions in that set describe different text.

## Why an edition file

A tajweed annotation is a pair of positions into one specific string, and two
editions of the Uthmani script can read identically while differing as data.
Rather than guess which text you have, the tool takes the one you point it at.
The format is `{ id, riwayah, script, ayahs: { "1:1": "…" } }`.

MIT. The rule corpus it reads is CC BY 4.0.

# @tajweed/cli

```bash
npx @tajweed/cli rules qalqalah
npx @tajweed/cli explain madd-lazim-harfi.1
npx @tajweed/cli gaps
```

Two kinds of thing live here.

**Asking questions of the corpus** needs no Quranic text and works immediately —
which rules exist, what one says, and which rules the notation still cannot
express.

**Annotating** needs text, which this tool does not ship and will not fetch:

```bash
tajweed annotate --text "مَنْ تَكَلَّمَ سُوءًا"
echo "…" | tajweed annotate --format json
tajweed annotate --edition ./my-edition.json --ref 2:255 --only madd
```

`--format` is `ansi` (default), `json`, `html` or `text` (tab-separated
offsets, for piping into something else).

`tajweed verify --edition <file>` prints an edition's digest, which is what an
annotation set pins itself to. If it does not match, the offsets in that set
describe different text.

## Why an edition file

A tajweed annotation is a pair of offsets into a specific string, and editions of
the Uthmani script that read identically are not identical as data. Rather than
guess which one you have, this takes the one you point it at. The format is
`{ id, riwayah, script, ayahs: { "1:1": "…" } }`.

MIT. The rule corpus it reads is CC BY 4.0.

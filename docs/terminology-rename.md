# The terminology rename, and what it costs

**Nothing is renamed yet.** What exists is the alias table that makes renaming
survivable — `packages/rules/aliases.json`, resolved on the way in by
`packages/core/src/aliases.ts`. The table at the bottom is what the rename would
do, and it is here so it can be read before it happens rather than after.

Snapshot `499bc74667765196` of `quran-ws/guidelines`, 180 entries, **all of them
`draft`** — proposals, not rulings. `update_check.py` could not reach the
repository (it is private), so this is the snapshot the skill shipped with.

## The finding that changes the shape of this

`data/registries/tajwid_rules.tsv` in the guidelines **was generated from this
corpus**. Its header says so, and every row cites `tajweed_engine <slug>` as its
source with the current slug listed under `alternative_spellings`.

So this is not a rename anyone has to invent. Every target name already exists,
is already authoritative, and already knows what it is replacing:

```
idgham_al_mutamathilayn_kamil  …  alts: mutamathilain-idgham-kamil  ref: tajweed_engine mutamathilain-idgham-kamil
```

**58 of 58 hukums map. Nothing is unmapped, and nothing is ambiguous.**

## The cost

| | |
|---|---|
| hukum ids that change | **58 of 58** |
| rule ids that change | **182 of 182** |
| rule ids unchanged | **0** |
| published spans carried by changing ids | **147,261 — all of them** |

Rule ids are `<hukum>.<n>`, so every rule id moves when its hukum does. There is
no partial version of this change.

Eight are cosmetic, hyphen to underscore only: `noon-mushaddadah`,
`meem-mushaddadah`, `qalqalah-sughra`, `qalqalah-kubra`, `izhar-mutlaq`,
`madd-lazim-kalimi-muthaqqal`, `madd-lazim-harfi`, `madd-lazim-kalimi-mukhaffaf`.
The other fifty are substantive.

## What breaks, and what it needs

**1. `ruleIds` in every published annotation set.** `packages/annotations/uthmani-hafs.json`
carries the ids as data; a consumer joins on them. `packages/rules/README.md`
states this plainly: *"they are the contract: join on them, store them, and
expect them not to change."* This change breaks that contract, which is what
makes it a major version rather than a rename.

**2. `scripts/annotate.ts:32`, and the riwayah key.** The refusal is string
equality:

```ts
if (edition.riwayah !== typed.riwayah) {
  console.error(`Refusing to annotate: the corpus is ${typed.riwayah} but the edition is ${edition.riwayah}.`)
```

The corpus says `hafs-an-asim`. The guidelines code is **`hafs_an_asim`**, and
`hafs-an-asim` is a recorded alternative spelling of it — so the current value
resolves correctly but is not canonical. Changing `rules.json` alone makes every
existing edition file fail that check, including
`editions/uthmani-hafs.json` and `editions/hafs-quran-text.json`.

**The alias table is what stops that**, and it is now in place:

```
riwayah:  hafs-an-asim, hafs_an_aasim, hafs  ->  hafs_an_asim
rule id:  <58 hukum slugs>                  ->  <58 guidelines codes>
```

It resolves on the way IN, at the two places a name arrives from outside:

- `scripts/annotate.ts` compares the riwayah through `sameRiwayah()` rather than
  by string equality, so an edition is not refused for spelling the same riwayah
  a different way;
- `unpack()` in `packages/core/src/annotations.ts` falls back to
  `resolveRuleId()`, so an annotation set published under the old ids still
  unpacks against a renamed corpus instead of throwing. An id that is *not* a
  rename still throws, so a real error is not swallowed.

Note the guidelines' own rule 11: *deprecated is not incorrect — a deprecated
name keeps resolving so old data is not stranded.* The alias table is that
mechanism, not a workaround.

**3. Everything else is smaller.** The npm scope `@tajweed/*`, the `Tajweed`
class and `TajweedText` are `display_in_code` **warnings**, not errors: the
standard derives `code: tajwid` and `display: Tajweed`, and treats using the
display form in an identifier as a judgement call. The repo name
`quran-tajweed` is also the block name on quran.ws, so it is a site-wide
decision rather than this repo's.

## Two things I did not decide

- **Whether `hukum` becomes `tajwid_ruling`.** The registry entry says the
  canonical name for the concept is `tajwid_ruling`, and `hukum` is a recorded
  spelling of it. That is a field name in `rules.json` and in the schema, so it
  is a third breaking surface on top of the two above.
- **When.** The four open rule PRs all add rules using the existing convention.
  Doing this before they land means rewriting them; doing it after means one
  rename instead of five.

## The full table, by published weight

| spans | current hukum id | guidelines code |
|---:|---|---|
| 46,137 | `madd-tabee-kalimi` | `madd_tabii_kalimi` |
| 8,844 | `tafkheem-rank-1-tahhan` | `martabat_al_tafkhim_ula_ind_ibn_al_tahhan` |
| 8,183 | `raa-tafkheem` | `tafkhim_al_raa` |
| 6,154 | `izhar-shafawi-meem` | `izhar_al_meem_sakinah` |
| 4,389 | `ikhfa-ghunnah-tarqeeq` | `ghunnat_al_ikhfa_haqiqi_muraqqaqah` |
| 4,098 | `noon-mushaddadah` | `noon_mushaddadah` |
| 3,791 | `mutamathilain-idgham-kamil` | `idgham_al_mutamathilayn_kamil` |
| 3,780 | `ikhfa-haqiqi-noon` | `ikhfa_haqiqi_li_al_noon` |
| 3,285 | `leen-yaa` | `yaa_layyinah` |
| 3,244 | `meem-mushaddadah` | `meem_mushaddadah` |
| 3,088 | `tafkheem-rank-5-relative-jazari` | `martabat_al_tafkhim_nisbi_khamisah_ind_ibn_al_jazari` |
| 3,088 | `tafkheem-rank-3-relative-tahhan` | `martabat_al_tafkhim_nisbi_thalithah_ind_ibn_al_tahhan` |
| 2,985 | `tafkheem-rank-1-jazari` | `martabat_al_tafkhim_ula_ind_ibn_al_jazari` |
| 2,969 | `tafkheem-rank-3-jazari` | `martabat_al_tafkhim_thalithah_ind_ibn_al_jazari` |
| 2,969 | `tafkheem-rank-2-tahhan` | `martabat_al_tafkhim_thaniyah_ind_ibn_al_tahhan` |
| 2,923 | `qalqalah-sughra` | `qalqalah_sughra` |
| 2,895 | `madd-iwad` | `madd_al_iwad_an_al_tanwin` |
| 2,825 | `idgham-bi-ghunnah-tanween` | `idgham_al_tanwin_bighunnah` |
| 2,630 | `leen-waw` | `waw_layyinah` |
| 2,303 | `raa-tarqeeq` | `tarqiq_al_raa` |
| 2,281 | `tafkheem-rank-4-jazari` | `martabat_al_tafkhim_rabiah_ind_ibn_al_jazari` |
| 2,182 | `madd-muttasil` | `madd_wajib_muttasil` |
| 2,163 | `madd-silah-sughra` | `madd_al_silah_sughra` |
| 2,022 | `mutamathilain-izhar` | `izhar_al_mutamathilayn` |
| 1,876 | `madd-badal` | `madd_al_badal_washibh_al_badal` |
| 1,871 | `idgham-kamil-tanween` | `idgham_al_tanwin_kamil` |
| 1,628 | `idgham-naqis-tanween` | `idgham_al_tanwin_naqis` |
| 1,590 | `izhar-halqi-noon` | `izhar_al_noon_halqi` |
| 1,477 | `ikhfa-haqiqi-tanween` | `ikhfa_haqiqi_li_al_tanwin` |
| 1,383 | `izhar-halqi-tanween` | `izhar_al_tanwin_halqi` |
| 1,022 | `idgham-bi-ghunnah-noon` | `idgham_al_noon_bighunnah` |
| 868 | `ikhfa-ghunnah-tafkheem` | `ghunnat_al_ikhfa_haqiqi_mufakhkhamah` |
| 832 | `idgham-shafawi-meem` | `idgham_al_meem_sakinah` |
| 736 | `idgham-naqis-noon` | `idgham_al_noon_naqis` |
| 674 | `idgham-bila-ghunnah-tanween` | `idgham_al_tanwin_bighayr_ghunnah` |
| 624 | `idgham-kamil-noon` | `idgham_al_noon_kamil` |
| 496 | `mutajanisain-ikhfa-shafawi` | `ikhfa_shafawi_fi_al_mutajanisayn` |
| 496 | `ikhfa-shafawi-meem` | `ikhfa_al_meem_sakinah` |
| 494 | `qalqalah-mutatarrifa` | `qalqalah_mutatarrifah` |
| 422 | `qalqalah-kubra` | `qalqalah_kubra` |
| 338 | `idgham-bila-ghunnah-noon` | `idgham_al_noon_bighayr_ghunnah` |
| 292 | `madd-munfasil` | `madd_jaiz_munfasil` |
| 285 | `iqlab-tanween` | `qalb_al_tanwin` |
| 270 | `iqlab-noon` | `qalb_al_noon_sakinah` |
| 125 | `izhar-mutlaq` | `izhar_mutlaq` |
| 98 | `madd-lazim-kalimi-muthaqqal` | `madd_lazim_kalimi_muthaqqal` |
| 66 | `seven-alefs` | `alifat_saba` |
| 44 | `madd-lazim-harfi` | `madd_lazim_harfi` |
| 19 | `raa-either-permissible` | `jawaz_al_wajhayn_fi_al_raa` |
| 4 | `mutajanisain-idgham-naqis` | `idgham_al_mutajanisayn_naqis` |
| 2 | `madd-lazim-kalimi-mukhaffaf` | `madd_lazim_kalimi_mukhaffaf` |
| 1 | `seven-alefs-khulf` | `alifat_saba_bikhulf` |
| 0 | `tafkheem-rank-2-jazari` | `martabat_al_tafkhim_thaniyah_ind_ibn_al_jazari` |
| 0 | `always-tarqeeq` | `huruf_muraqqaqah_daima` |
| 0 | `lam-jalalah-tafkheem` | `laam_lafz_al_jalalah_mufakhkhamah` |
| 0 | `lam-jalalah-tarqeeq` | `laam_lafz_al_jalalah_muraqqaqah` |
| 0 | `alef-tafkheem` | `alif_mufakhkhamah` |
| 0 | `alef-tarqeeq` | `alif_muraqqaqah` |

Generated by joining `packages/rules/rules.json` hukums against
`data/registries/tajwid_rules.tsv` on `alternative_spellings`, with span counts
read from `packages/annotations/uthmani-hafs.json`.

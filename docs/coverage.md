# What the corpus covers, and what it does not

Read this before shipping anything that colours text with these rules.

The corpus is deep in the areas it covers and silent outside them. Silence looks
identical to "this rule does not apply here", so a reader shown only these
annotations will conclude that rules the corpus never modelled do not exist.
For a tool that teaches recitation, that is the more damaging kind of error.

## Covered

| Topic | Ahkam | Notes |
|---|---|---|
| التفخيم والترقيق | 18 | Includes both Ibn al-Jazarī's five ranks and Ibn al-Ṭaḥḥān's three |
| علاقات الحروف | 4 | المتماثلين and المتجانسين, الصغير only |
| النون والتنوين | 15 | إظهار، إدغام بغنة وبغيرها، إقلاب، إخفاء حقيقي |
| الميم الساكنة | 3 | إدغام، إخفاء، إظهار شفوي |
| المشددتان | 2 | النون والميم المشددتان |
| المد | 13 | طبيعي، عوض، صلة صغرى، لين، بدل، واجب متصل، جائز منفصل، **لازم** |
| القلقلة | 2 | صغرى في وسط الكلمة، ومتطرفة على حرف ساكن في آخرها |

القلقلة and المد اللازم were authored for this corpus rather than inherited from
the source; both were absent, and المد اللازم's absence was why every ayah of الحروف
المقطعة came back with nothing to say about it. Every rule in those two areas is
flagged `needsReview` until a qualified reviewer signs it off, and each is pinned
to passages whose ruling is not in dispute — see `scripts/verify-rules.ts`.

One of them is deliberately coarser than the classical division:

- **المد اللازم الحرفي** does not distinguish مثقل from مخفف. That turns on
  whether the letter's spelled-out name assimilates into the next, which the CASE
  notation cannot see.

## Not covered

These are absent from the corpus entirely — not disabled, not partial, absent.

- **القلقلة عند الوقف على حرف متحرك.** A qalqalah letter carrying a vowel at the
  end of a word — the ط of صِرَٰطَ, the ب of ٱلۡمَغۡضُوبِ, the د of أَحَدٌ — is not
  qalqalah while the reciter continues. It becomes qalqalah only if they stop on
  it, and where a reciter stops is their choice, not something the text records.
  Marking every such letter would colour thousands of positions that are usually
  read straight through, so only letters written sakin are annotated.
- **مد الفرق** — ءَآللَّهُ، ءَآلذَّكَرَيۡنِ. Six places, and structurally close enough to
  المد اللازم الكلمي that a pattern written loosely will swallow them; the rule
  for المخفف is deliberately written as a literal to avoid exactly that.
- **مد الصلة الكبرى.** The صغرى is covered; the كبرى is not.
- **السكت.** Normalisation recognises the saktah mark and uses it to stop rules
  matching across it, but there is no rule that reports a saktah as a ruling of
  its own.
- **الوقف والابتداء.** Waqf marks are preserved and never coloured, but they are
  not annotated.
- **أحكام الاستعاذة والبسملة.**
- **المتباعدين**, and the **الكبير** forms of المتماثلين والمتجانسين.

## Disabled within covered areas

18 further rules are present but disabled, because the CASE notation cannot
express them. Two of those are the ones that would identify راء in فِرْق and the
two مواضع of الإظهار المطلق. See [packages/rules/README.md](../packages/rules/README.md).

## What this means for a consumer

**Do not present this as complete tajweed colouring.** If you build a reader,
say which rules are shown. A legend listing the covered topics is honest; an
unlabelled wash of colour implies completeness the data does not have.

**Do not infer absence.** `analyze()` returning nothing for an ayah means no
*modelled* rule matched, not that the ayah is free of tajweed.

**Ayahs with no annotations are omitted** from a generated annotation set rather
than stored as an empty list, so that "no rules matched" and "not computed" stay
distinguishable. As of the current corpus every ayah of the mushaf carries at
least one annotation, so the omitted set is empty.

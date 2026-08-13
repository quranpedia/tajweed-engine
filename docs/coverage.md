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
| القلقلة | 3 | صغرى في وسط الكلمة، متطرفة على حرف ساكن في آخرها، وكبرى على رأس الآية |
| أداءات خاصة عند حفص | 4 | الإمالة، التسهيل، والإشمام والاختلاس في تأمنا — ثلاثة مواضع بأعيانها |

القلقلة، المد اللازم and أداءات خاصة were authored for this corpus rather than
inherited from the source. All three were absent, and المد اللازم's absence was why
every ayah of الحروف المقطعة came back with nothing to say about it. Every rule in
those three areas is flagged `needsReview` until a qualified reviewer signs it off,
and each is pinned to passages whose ruling is not in dispute — see
`scripts/verify-rules.ts`.

The three أداءات خاصة are rulings of specific words at specific places rather than
patterns: الإمالة in Hūd 41, التسهيل in Fuṣṣilat 44, and الإشمام in Yūsuf 11, which
also carries a second accepted wajh, الاختلاس. Each is written as the word itself and
matched against the text as printed, because the mushaf records all three with a mark
of its own — U+06EA and U+06EC — that normalisation strips. An edition without those
marks silently loses the rules; `pnpm edition:check` reports it.

One ruling is deliberately coarser than the classical division:

- **المد اللازم الحرفي** does not distinguish مثقل from مخفف. That turns on
  whether the letter's spelled-out name assimilates into the next, which the CASE
  notation cannot see.

## Not covered

These are absent from the corpus entirely — not disabled, not partial, absent.

- **القلقلة عند الوقف في وسط الآية.** A qalqalah letter carrying a vowel at the
  end of a word — the ط of صِرَٰطَ, the ب of ٱلۡمَغۡضُوبِ — is not qalqalah while the
  reciter continues, and whether they stop mid-ayah is their choice rather than
  something the text records. Marking every such letter would colour 4,470
  positions that are usually read straight through.

  Ayah endings are the exception, and they *are* annotated: stopping at رأس الآية
  is sunnah and usual, so the ruling is realised there. That is
  `qalqalah-kubra`, 422 ayahs — أَحَدٌ، ٱلصَّمَدُ، وَتَبَّ. A reciter who joins one ayah
  to the next would not pronounce it on a vowelled letter, which is why the rule
  is scoped to ayah ends rather than applied to every stop a reciter might make.
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

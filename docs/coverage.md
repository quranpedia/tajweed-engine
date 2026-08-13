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
| أحكام الوقف | 3 | الروم على رؤوس الآي: في المضموم والمكسور والمنون بهما، وفي الهاء على مذهب التفصيل |

القلقلة، المد اللازم and الروم were authored for this corpus rather than inherited
from the source; all three were absent, and المد اللازم's absence was why every ayah
of الحروف المقطعة came back with nothing to say about it. Every rule in those three
areas is flagged `needsReview` until a qualified reviewer signs it off, and each is
pinned to passages whose ruling is not in dispute — see `scripts/verify-rules.ts`.

الروم is annotated **only at رؤوس الآي**, on the same reasoning that confined
القلقلة الكبرى there: stopping at a رأس آية is sunnah and usual, while stopping
anywhere else is the reciter's choice and not something the text records. Written
for every word end it would mark 22,197 positions instead of 1,920 — a permission
the reciter usually does not take, on nearly every word. Two of the four موانع —
ميم الجمع and الحركة العارضة — cannot arise at a رأس آية at all, since both need a
following word.

One of them is deliberately coarser than the classical division:

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
- **الوقف والابتداء**, apart from الروم. Waqf marks are preserved and never
  coloured, and where a reciter may stop is not annotated. الإشمام عند الوقف is
  not modelled either, so a رأس آية ending in a damma reports that روم is
  permitted there and says nothing about إشمام, which is permitted too.
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

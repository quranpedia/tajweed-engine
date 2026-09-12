# What the rules cover, and what they do not

Read this before you ship anything that colours text with these rules.

The corpus covers seven topics in depth and says nothing outside them. The
problem: "nothing" looks exactly like "no rule applies here". A reader who sees
only these colours will assume that rules the corpus never included simply do
not exist. For a tool that teaches recitation, that is the more damaging kind
of mistake.

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

القلقلة and المد اللازم were written for this corpus; the source system did not
have them. Before المد اللازم was added, the engine had nothing to say about
الحروف المقطعة — the disjoined letters that open some surahs. Every rule in
these two areas is flagged `needsReview` until
a qualified reviewer signs it off, and each is tested against passages whose
ruling is not in dispute — see `scripts/verify-rules.ts`.

Two consequences of the same limit are worth knowing before you rely on the
output:

- **إظهار شفوي at `الٓمٓصٓ` (7:1) and `الٓمٓرۚ` (13:1) is not marked.** It is
  real, but it falls on the last mīm of the spelled name *mīm*, and the spelled
  name is not in the text. Marking it would mean marking the written mīm, which
  is a different letter.

One of them is deliberately less detailed than the classical books:

- **المد اللازم الحرفي** does not split into مثقل and مخفف. The split depends on
  whether the letter's spelled-out name merges into the next letter, and the
  CASE notation cannot see spelled-out names.

## Not covered

These are missing from the corpus entirely — not disabled, not partial, missing.

- **المد الطبيعي الحرفي.** The disjoined letters whose names hold a two-count
  madd — ط، ه، ي، ح، ر — carry one, and no rule describes it. It is why 20:1
  `طه` is the single ayah in the mushaf with no ruling at all: it is ṭā-hā and
  nothing else. Until this was corrected the ṭāʾ was marked قلقلة, which made
  the gap invisible rather than absent.

- **القلقلة عند الوقف في وسط الآية.** A qalqalah letter that carries a vowel at
  the end of a word — the ط of صِرَٰطَ, the ب of ٱلۡمَغۡضُوبِ — only becomes qalqalah
  if the reciter stops there. Whether they stop mid-ayah is their choice; the
  text does not record it. Marking every such letter would colour 4,470
  positions that are usually read straight through.

  Ayah endings are different, and they *are* annotated: stopping at the end of
  an ayah is sunnah and the normal way to recite, so the ruling actually happens
  there. That is `qalqalah-kubra`, 422 ayahs — أَحَدٌ، ٱلصَّمَدُ، وَتَبَّ. A reciter
  who joins one ayah into the next would not pronounce it on a vowelled letter,
  which is why the rule covers ayah ends only, and not every place a reciter
  might choose to stop.
- **مد الفرق** — ءَآللَّهُ، ءَآلذَّكَرَيۡنِ. Six places in the mushaf. Its shape is so
  close to المد اللازم الكلمي that a loosely written pattern would swallow it by
  accident; the rule for المخفف is written as an exact word for exactly this
  reason.
- **مد الصلة الكبرى.** The صغرى is covered; the كبرى is not.
- **السكت.** The normaliser recognises the saktah mark and uses it to stop rules
  from matching across it, but no rule reports a saktah as a ruling of its own.
- **الوقف والابتداء.** Waqf marks are kept in the text and never coloured, but
  they are not annotated.
- **أحكام الاستعاذة والبسملة.**
- **المتباعدين**, and the **الكبير** forms of المتماثلين والمتجانسين.

## Disabled within covered areas

18 more rules exist in the corpus but are disabled, because the CASE notation
cannot express them yet. Two of those are the rules that would identify the راء
in فِرْق and the two places of الإظهار المطلق. See
[packages/rules/README.md](../packages/rules/README.md).

## What this means for you

**Do not present this as complete tajweed colouring.** If you build a reader,
say which rules are shown. A legend listing the covered topics is honest; an
unlabelled wash of colour claims a completeness the data does not have.

**Do not treat silence as "no rule applies".** When `analyze()` returns nothing
for a stretch of text, it means no rule *in the corpus* matched — not that the
text is free of tajweed. For example, the corpus has no rule for السكت, so the
saktah in 18:1–2 gets no annotation; that is a gap in the corpus, not a fact
about the ayah.

**Ayahs with no annotations are left out** of a generated annotation set, not
stored as an empty list. That keeps "no rules matched" and "not computed"
distinguishable. **6,235 of the muṣḥaf's 6,236 ayahs carry at least one
annotation; 20:1 طه carries none**, for the reason given above, and is therefore
absent from the file rather than present with an empty list.

A consumer that looks up an ayah and finds nothing should read that as "no rule
in this corpus describes anything here", not as an error — and should not assume
the key exists.

# The rules that match nothing

Thirty-seven rules in this corpus carry `status: "stable"` and match no āyah in
the muṣḥaf. A rule that finds nothing looks exactly like a rule that is broken,
and the conformance tests cannot tell the two apart: for a rule with no matches
the frozen digest is the digest of an empty list, so the test asserts only *still
nothing*.

That is not idle worry. [#6](https://github.com/quran-ws/quran-tajweed/pull/6)
fixed eight rules that had rotted undetected with `status: "stable"` on every
one. So each of the thirty-seven was checked, two ways.

```sh
node -e 'const c=require("./packages/rules/rules.json"), f=require("./conformance/frozen.json");
  console.log(c.rules.filter(r => (f.incidence[r.id]?.ayahs ?? 0) === 0 && r.status !== "disabled").length)'
37
```

## First: is the pattern the one that was written?

The rules were authored in a spreadsheet,
`resources/tajweed_rules.xlsx` in the tajweed application, one row per rule with
a `CASE` column. Comparing each of the thirty-seven against that column:

| | |
|---|---|
| byte-identical to the authored CASE | **35** |
| deliberately corrected, and the correction recorded | **1** |
| authored for this corpus, so not in the spreadsheet | **1** |

**No rule among the thirty-seven was transcribed wrongly.** The two that are not
byte-identical both explain themselves:

- **`madd-munfasil.2`** — the spreadsheet's CASE searches for an alef while its
  own القاعدة says الواو الساكنة. It is a slip made by copying the sibling alef
  rule, and it was corrected both here (the rule's own `corrections` entry says
  so, and notes it matched 0 either way) and in the application it came from
  (migration `2026_08_12_151629_fix_madd_rules_matching_wrong_madd_letter`,
  which names four rules with the same defect).
- **`madd-lazim-kalimi-muthaqqal.3`** — the المد اللازم family is not in the
  spreadsheet at all. Its `statusReason` already says it was authored for this
  corpus rather than inherited.

## Second: does the thing the rule describes occur at all?

The stronger question, and one the matcher is not involved in answering: take the
letter pair a rule looks for and search the normalised muṣḥaf for it directly.

| | |
|---|---|
| absence provable — the pair never occurs anywhere | **34** |
| pair occurs, but the rule stays silent | **0** |
| not a letter pair, so not answerable this way | **3** |

**There is no rule in the corpus that is silent about something that is in the
text.** The thirty-four are absences of the text, not of the engine:

```
mutamathilain-idgham-kamil  ثْ+ث  جْ+ج  حْ+ح  خْ+خ  زْ+ز  سْ+س  شْ+ش  صْ+ص
                            ضْ+ض  طْ+ط  ظْ+ظ  غْ+غ  قْ+ق   and ءْ + hamza
mutamathilain-izhar         عْ+ح  غْ+خ  خْ+غ  جْ+ش  جْ+ي  يْ+ج  شْ+ج  دْ+ط
                            طْ+د  سْ+ز  سْ+ص  زْ+س  زْ+ص  صْ+ز  صْ+س  ذْ+ث
                            ثْ+ظ  ظْ+ذ  ظْ+ث
raa-tarqeeq.3               يْ + رْ
```

A sākin letter immediately followed by the same letter is rare, and for most
pairs the Qurʾān simply does not contain one. The rules are right to be silent,
and the corpus is right to carry them: the ruling exists whether or not the
muṣḥaf happens to exercise it, and a reader asking "what would apply here" is
entitled to an answer.

The three not answerable this way are `raa-tarqeeq.4`, `madd-munfasil.2` and
`madd-lazim-kalimi-muthaqqal.3`, whose patterns are long letter-class groups
rather than a pair. The last two are among the twelve rules marked
`needsReview`, so they are a reviewer's question rather than an engineering one.

## What this does not settle

That a pattern is faithfully transcribed and that its letter pair does not occur
are both facts about transcription and about the text. **Neither says the ruling
is right.** A pattern can be exactly what was written down and still describe the
wrong condition, and nothing here can detect that — only a reviewer can.

What it does settle is that the thirty-seven are not rot, and that the eight
rules #6 found are not a sign of thirty-seven more waiting.

## Keeping it that way

The gap that let #6's eight rules rot is still open: nothing requires a stable
rule with no matches to say why. A `statusReason` on each, enforced by
`pnpm rules:validate`, would turn a silent absence into a claim someone signed —
and only one of the thirty-seven, `madd-lazim-kalimi-muthaqqal.3`, carries one
today (`لا يقع في القرآن`).

Whether to require it, and what each of the other thirty-six should say, is a
decision for the corpus's reviewers rather than for this document.

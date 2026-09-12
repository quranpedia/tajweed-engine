---
name: A rule is wrong, missing, or over-matching
about: Report a tajweed rule that does not behave correctly
labels: corpus
---

**Which rule** — the id, e.g. `madd-muttasil.2`, or "missing: قلقلة" if there is
no rule for it.

**What should happen**

**What happens instead**

**Where** — ayah references, e.g. `2:30`, `10:51`. Please cite references rather
than pasting Quranic text.

**Source for the ruling** — which scholar or work.

---

Before filing, worth checking:

- [`docs/coverage.md`](../../docs/coverage.md) — the corpus is deep in seven
  topics and silent outside them. مد الفرق, مد الصلة الكبرى and السكت are among
  the things it does not model at all, and silence there is expected.
- `npx @quran.ws/tajwid-cli explain <rule-id>` — a rule may already be `disabled`, with a
  recorded reason, or flagged `needsReview`.
- `npx @quran.ws/tajwid-cli gaps` — 18 rules exist but cannot be expressed yet, and each
  records which limitation of the notation blocks it.

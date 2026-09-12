<div align="center">

<img src=".github/banner.svg" alt="Quran Tajweed — Annotations, Stable" width="820">

**Tajweed rules applied to their exact places in the Quran, reviewed by specialists and ready for use in applications.**

<a href="https://quran.ws/blocks/quran-tajweed"><img alt="See it work" src="https://img.shields.io/badge/See_it_work-15705D?style=for-the-badge&labelColor=102F29"></a>
<a href="https://quran.ws/docs/reference/quran-tajweed"><img alt="Documentation" src="https://img.shields.io/badge/Documentation-102F29?style=for-the-badge&labelColor=102F29"></a>

</div>

Use it for Tajweed colouring, explaining rules while reading, and building recitation and Tajweed-learning tools.

> قواعد التجويد مطبّقة على مواضعها في القرآن، ومراجعة من مختصين لتكون جاهزة للاستخدام في التطبيقات.
>
> استخدمها لتلوين الأحكام، وشرحها أثناء القراءة، وبناء أدوات تعليم التلاوة والتجويد.

| | |
|---|---|
| **Package** | `@quran.ws/tajwid-annotations` · `0.1.0` |
| **Rules** | 182 authored · 127 produce spans |
| **Spans** | 147,255 precomputed |
| **Licence** | CC BY 4.0 (the corpus, annotations and editions) · MIT (the engine and tools) |

```sh
# Not published yet: every package name in this repository 404s on the npm
# registry today, and `tajweed` 404s on PyPI. Publication is intended.
# Until then, take the data from a release — the assets are the whole dataset:
gh release download v0.4.3 -R quran-ws/quran-tajweed
```

## Where the documentation is

Everything about using it lives on the site. This repository is the source.

| | |
|---|---|
| **Overview and demo** | [quran.ws/blocks/quran-tajweed](https://quran.ws/blocks/quran-tajweed) |
| **Reference** | [quran.ws/docs/reference/quran-tajweed](https://quran.ws/docs/reference/quran-tajweed) |
| **Add Tajwīd highlighting** | [quran.ws/docs/build/tajweed](https://quran.ws/docs/build/tajweed) |
| **Work offline** | [quran.ws/docs/build/offline](https://quran.ws/docs/build/offline) |
| **Licensing in full** | [quran.ws/docs/reference/licensing](https://quran.ws/docs/reference/licensing) |

## What is in here

| | |
|---|---|
| `packages/` | `rules` (the corpus), `annotations` (the precomputed spans), `core`, `react`, `cli` |
| `editions/` | the exact texts the spans are measured against |
| `python/` | the reference implementation of the matcher |
| `playground/` | the local harness; the published one is on the site |
| `conformance/` | the gates that must stay green, including `edition:check` |
| `reports/` | edition comparisons |
| `docs/` | the rule notation, and how to work on this repository |

Issues and pull requests are welcome here. Everything that is not about *changing* this repository is on the site.

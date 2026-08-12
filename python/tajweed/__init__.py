"""Read precomputed tajweed annotations.

This package reads the dataset; it does not run the engine. The Quran is a fixed
corpus, so the matching has already been done — what a consumer needs is a way to
look the answers up and to check that they describe the text it actually has.

    from tajweed import Corpus, Annotations

    corpus = Corpus.load("rules.json")
    annotations = Annotations.load("uthmani-hafs.json", corpus)

    for span in annotations.spans("2:255"):
        print(span.start, span.end, span.hukum_id)

Nothing here contains Quranic text, and nothing here modifies any text you pass
in. Offsets are code-point indices, which in Python means they index a `str`
directly.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Mapping, Sequence

__all__ = [
    "Span",
    "Rule",
    "Corpus",
    "Annotations",
    "EditionMismatch",
    "edition_digest",
]

# Separators for the canonical form an edition digest is taken over. Control
# characters, because neither can occur in a reference or in Quranic text. These
# must match editionDigest in @tajweed/core exactly; a different byte on either
# side makes every edition look like a different edition.
_FIELD_SEPARATOR = "\u0000"
_RECORD_SEPARATOR = "\u0001"


class EditionMismatch(RuntimeError):
    """Raised when text is not the text some annotations were computed against."""


@dataclass(frozen=True)
class Span:
    """One occurrence of one rule.

    ``start`` and ``end`` are half-open code-point offsets into the ayah text as
    the edition has it, so ``ayah_text[span.start:span.end]`` is the stretch the
    ruling concerns.
    """

    start: int
    end: int
    rule_id: str
    hukum_id: str
    category_id: str
    topic_id: str


@dataclass(frozen=True)
class Rule:
    id: str
    hukum: str
    case: str
    scope: str
    status: str
    label_ar: str
    needs_review: bool = False


class Corpus:
    """The rule corpus: topics, categories, ahkam and rules."""

    def __init__(self, data: Mapping[str, object]) -> None:
        self._data = data
        self.version: str = str(data["version"])
        self.riwayah: str = str(data["riwayah"])

        self.topics = {t["id"]: t for t in data["topics"]}  # type: ignore[index,union-attr]
        self.categories = {c["id"]: c for c in data["categories"]}  # type: ignore[index,union-attr]
        self.hukums = {h["id"]: h for h in data["hukums"]}  # type: ignore[index,union-attr]

        self.rules: dict[str, Rule] = {}
        self._lineage: dict[str, tuple[str, str, str]] = {}

        for entry in data["rules"]:  # type: ignore[union-attr]
            rule = Rule(
                id=entry["id"],
                hukum=entry["hukum"],
                case=entry["case"],
                scope=entry["scope"],
                status=entry["status"],
                label_ar=entry["label"]["ar"],
                needs_review=bool(entry.get("needsReview", False)),
            )
            self.rules[rule.id] = rule

            hukum = self.hukums.get(rule.hukum)
            if hukum is None:
                continue
            category = self.categories.get(hukum["category"])
            if category is None:
                continue
            self._lineage[rule.id] = (hukum["id"], category["id"], category["topic"])

    @classmethod
    def load(cls, path: str | Path) -> "Corpus":
        with Path(path).open(encoding="utf-8") as handle:
            return cls(json.load(handle))

    def lineage(self, rule_id: str) -> tuple[str, str, str]:
        """The hukum, category and topic ids a rule belongs to."""
        try:
            return self._lineage[rule_id]
        except KeyError:
            raise KeyError(
                f"{rule_id} is not in corpus v{self.version}. "
                "These annotations may have been computed against a different version."
            ) from None

    def label(self, identifier: str) -> str:
        """The Arabic label of a rule, hukum, category or topic."""
        for table in (self.rules, self.hukums, self.categories, self.topics):
            entry = table.get(identifier)
            if entry is None:
                continue
            return entry.label_ar if isinstance(entry, Rule) else entry["label"]["ar"]
        raise KeyError(identifier)

    def stable(self) -> Iterator[Rule]:
        """Rules that may be matched. Disabled rules are published but must not be."""
        return (rule for rule in self.rules.values() if rule.status == "stable")


class Annotations:
    """Precomputed spans for one text edition."""

    def __init__(self, data: Mapping[str, object], corpus: Corpus) -> None:
        self.corpus = corpus
        self.corpus_version: str = str(data["corpusVersion"])
        self.riwayah: str = str(data["riwayah"])
        edition = data["edition"]
        self.edition_id: str = str(edition["id"])  # type: ignore[index]
        self.edition_sha256: str = str(edition["sha256"])  # type: ignore[index]
        self.ayah_count: int = int(edition["ayahCount"])  # type: ignore[index]

        self._rule_ids: Sequence[str] = data["ruleIds"]  # type: ignore[assignment]
        self._spans: Mapping[str, Sequence[Sequence[int]]] = data["spans"]  # type: ignore[assignment]

        if self.riwayah != corpus.riwayah:
            raise ValueError(
                f"These annotations are {self.riwayah} but the corpus is {corpus.riwayah}. "
                "Rulings and orthography both differ between riwayat."
            )

    @classmethod
    def load(cls, path: str | Path, corpus: Corpus) -> "Annotations":
        with Path(path).open(encoding="utf-8") as handle:
            return cls(json.load(handle), corpus)

    def references(self) -> Iterator[str]:
        """Every annotated ayah, in mushaf order."""
        return iter(sorted(self._spans, key=_reference_order))

    def spans(self, reference: str) -> list[Span]:
        """Spans for one ayah, e.g. ``"2:255"``. Empty if nothing applies."""
        packed = self._spans.get(reference)
        if not packed:
            return []

        spans = []
        for start, end, rule_index in packed:
            rule_id = self._rule_ids[rule_index]
            hukum_id, category_id, topic_id = self.corpus.lineage(rule_id)
            spans.append(
                Span(
                    start=start,
                    end=end,
                    rule_id=rule_id,
                    hukum_id=hukum_id,
                    category_id=category_id,
                    topic_id=topic_id,
                )
            )
        return spans

    def verify(self, ayahs: Mapping[str, str]) -> None:
        """Check that ``ayahs`` is the text these annotations describe.

        Offsets are meaningless against different text, and the failure mode is
        not an error but silently wrong output, so this is worth calling before
        the first lookup rather than trusting that the text is right.
        """
        actual = edition_digest(ayahs)
        if actual != self.edition_sha256:
            raise EditionMismatch(
                f"Text does not match edition {self.edition_id}.\n"
                f"  expected sha256 {self.edition_sha256}\n"
                f"  actual   sha256 {actual}\n"
                "Offsets from these annotations would land in the wrong place."
            )


def edition_digest(ayahs: Mapping[str, str]) -> str:
    """The digest of a text edition, as ``@tajweed/core`` computes it.

    Hashes the content rather than the file, so it does not depend on key order,
    indentation or escaping: each reference and its text, in mushaf order,
    separated by control characters that cannot occur in either.
    """
    canonical = _RECORD_SEPARATOR.join(
        f"{reference}{_FIELD_SEPARATOR}{ayahs[reference]}"
        for reference in sorted(ayahs, key=_reference_order)
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _reference_order(reference: str) -> tuple[int, int]:
    surah, ayah = reference.split(":")
    return int(surah), int(ayah)

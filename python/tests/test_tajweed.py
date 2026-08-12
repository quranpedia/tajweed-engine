"""Tests for the annotations reader.

The digest test is the one that matters most: it pins the Python implementation
to the same canonical form as the TypeScript and PHP ones. If those three ever
disagree, consumers of one of them start rejecting valid text or, worse,
accepting the wrong text and reporting offsets into it.
"""

import hashlib
import unittest
from pathlib import Path

from tajweed import Annotations, Corpus, EditionMismatch, edition_digest

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / "packages" / "rules" / "rules.json"
ANNOTATIONS = ROOT / "packages" / "annotations" / "uthmani-hafs.json"


class DigestTest(unittest.TestCase):
    def test_matches_the_typescript_canonical_form(self):
        # Two entries is enough to exercise both separators: the NUL between a
        # reference and its text, and the SOH between records. Written as
        # escapes, because a literal control character in source is invisible
        # and an editor that dropped one would change every digest silently.
        ayahs = {"1:1": "alpha", "1:2": "beta"}
        expected_canonical = "1:1\u0000alpha\u00011:2\u0000beta"

        self.assertEqual(
            edition_digest(ayahs),
            hashlib.sha256(expected_canonical.encode("utf-8")).hexdigest(),
        )

    def test_orders_by_mushaf_not_lexically(self):
        # "10:1" sorts before "2:1" as a string and after it in the mushaf, so a
        # lexical sort would give a different digest for the same text.
        ordered = {"2:1": "a", "10:1": "b"}
        reversed_insertion = {"10:1": "b", "2:1": "a"}

        self.assertEqual(edition_digest(ordered), edition_digest(reversed_insertion))
        self.assertEqual(
            edition_digest(ordered),
            hashlib.sha256("2:1\u0000a\u000110:1\u0000b".encode("utf-8")).hexdigest(),
        )


class CorpusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.corpus = Corpus.load(RULES)

    def test_declares_its_riwayah(self):
        self.assertEqual(self.corpus.riwayah, "hafs-an-asim")

    def test_disabled_rules_are_published_but_excluded_from_stable(self):
        stable = list(self.corpus.stable())
        self.assertLess(len(stable), len(self.corpus.rules))
        self.assertTrue(all(rule.status == "stable" for rule in stable))

    def test_lineage_reaches_the_topic(self):
        hukum, category, topic = self.corpus.lineage("madd-lazim-harfi.1")
        self.assertEqual(hukum, "madd-lazim-harfi")
        self.assertEqual(category, "madd-lazim")
        self.assertEqual(topic, "madd")

    def test_unknown_rule_says_which_corpus_version_it_looked_in(self):
        with self.assertRaises(KeyError) as caught:
            self.corpus.lineage("not-a-rule.1")
        self.assertIn(self.corpus.version, str(caught.exception))


class AnnotationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.corpus = Corpus.load(RULES)
        cls.annotations = Annotations.load(ANNOTATIONS, cls.corpus)

    def test_covers_the_whole_mushaf(self):
        self.assertEqual(self.annotations.ayah_count, 6236)
        self.assertEqual(len(list(self.annotations.references())), 6236)

    def test_spans_carry_the_whole_lineage(self):
        span = self.annotations.spans("1:7")[0]
        self.assertTrue(span.rule_id)
        self.assertTrue(span.hukum_id)
        self.assertTrue(span.category_id)
        self.assertTrue(span.topic_id)
        self.assertLess(span.start, span.end)

    def test_unannotated_reference_gives_an_empty_list(self):
        self.assertEqual(self.annotations.spans("999:1"), [])

    def test_verify_rejects_text_it_does_not_describe(self):
        with self.assertRaises(EditionMismatch) as caught:
            self.annotations.verify({"1:1": "not the mushaf"})
        # The message has to say what goes wrong, not just that something did.
        self.assertIn("wrong place", str(caught.exception))


if __name__ == "__main__":
    unittest.main()

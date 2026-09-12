<?php
/**
 * THE LEGACY MATCHER, RECOVERED. Do not "improve" anything in this file.
 *
 * Recovered verbatim from the application this engine was ported from:
 *
 *   repo   qaws-net/tajweed
 *   path   app/Traits/DetectTajweedPattern.php
 *   commit 5ea1f79^  (the commit itself, 5ea1f79, is the one that deleted it:
 *          "refactor: serve tajweed from precomputed annotations, drop the
 *          matching engine")
 *
 *   git -C <tajweed> show 5ea1f79^:app/Traits/DetectTajweedPattern.php
 *
 * This is the ONLY independent oracle for what the original engine did. The
 * other candidates in that repository are not independent and cannot adjudicate
 * anything:
 *
 *   resources/tajweed/rules.json        a copy of our corpus, same 182 ids
 *   resources/tajweed/annotations.json  OUR engine's own output, imported by
 *                                       `php artisan tajweed:import-annotations`
 *   app/Services/TajweedAnnotations.php reads that imported data; says so in
 *                                       its own docblock
 *
 * Comparing against any of those compares our output to itself. It will agree,
 * and the agreement will mean nothing.
 *
 * TWO EDITS were made to the recovered source, both mechanical, neither touching
 * matching behaviour:
 *
 *   1. `trait DetectTajweedPattern` -> `class LegacyMatcher`, and the namespace
 *      dropped, so it can run without Laravel. It never used Laravel: it reads
 *      only `$rule->case` and `$rule->white_spaces_pattern` off a plain object.
 *   2. `private` -> `public` on the members, so a driver can call them.
 *
 * Verify both, ignoring this header and blank lines:
 *
 *   diff <(git -C <tajweed> show 5ea1f79^:app/Traits/DetectTajweedPattern.php \
 *          | grep -v '^[[:space:]]*$') \
 *        <(sed -n '/^class LegacyMatcher/,$p' matcher.php | grep -v '^[[:space:]]*$')
 *
 * VERIFIED: that prints exactly 28 differing lines and no others —
 *   3 removed, 1 added   the `<?php`, `namespace` and `trait` header becoming `class`
 *   12 pairs             `private` -> `public` on 1 property, 1 const and 10 methods
 *
 * Not one line of matching logic differs. If you get anything else, this file has
 * been edited since and is no longer an oracle.
 */




class LegacyMatcher
{
    public array $ALLOWED_CHARACTERS = ['ۚ', 'ۗ', 'ۖ', 'ۙ', 'ۘ', '۞', '۩'];

    /**
     * Quranic annotation marks that appear in mushaf text but not in CASE patterns.
     * Stripped during normalization and allowed optionally during flexible highlighting.
     */
    public const QURANIC_OPTIONAL_MARKS = [
        "\u{06E5}", // ۥ small waw (واو صغيرة)
        "\u{06E6}", // ۦ small yaa (ياء صغيرة)
        "\u{06E2}", // ۢ small high meem isolated
        "\u{06ED}", // ۭ small low meem
        "\u{06E4}", // ۤ small high madda
        "\u{06E7}", // ۧ small high yaa
        "\u{06E8}", // ۨ small high noon
        "\u{06E0}", // ۠ small high upright rectangular zero
        "\u{06EA}", // ۪ empty centre low stop
        "\u{06EC}", // ۬ rounded high stop with filled centre
        "\u{0654}", // ٔ hamza above (combining)
        "\u{0655}", // ٕ hamza below (combining)
        "\u{0640}", // ـ tatweel/kashida
        "\u{06DB}", // ۛ small high three dots
        "\u{06DC}", // ۜ small high seen
        "\u{0653}", // ٓ maddah above (standalone, after alef→آ replacement)
    ];

    /**
     * Normalize Quranic text (quranpedia format) to match the format expected by CASE patterns.
     */
    public function normalizeText(string $text): string
    {
        // Remove BOM
        $text = str_replace("\u{FEFF}", '', $text);

        // Note: alef wasla (ٱ U+0671) is intentionally NOT normalized to regular alef.
        // Alef wasla is a connective hamza (dropped in wasl), not a long vowel,
        // so it must remain distinct to avoid false madd matches.

        // Replace Quranic sukoon → regular sukoon
        $text = str_replace("\u{06E1}", "\u{0652}", $text);

        // Replace decomposed alef-madda (alef + maddah above) → precomposed آ
        // Must happen BEFORE stripping maddah above (ٓ)
        $text = str_replace("\u{0627}\u{0653}", "\u{0622}", $text);

        // Resolve آ written on a hamza-carrying alef (أ + maddah above).
        // This is a hamza followed by a long a — أٓ in ٱلۡأٓخِرَة is read hamza + alef,
        // which is مد بدل. Writing it out as hamza + fatha + alef is what lets a
        // madd rule see it.
        //
        // Without this the maddah is stripped with the other annotation marks and
        // the bare hamza then collects an implied sukoon from insertImpliedSukoon,
        // turning a madd letter into a sakin consonant. Affects 272 ayahs.
        $text = str_replace("\u{0623}\u{0653}", "\u{0623}\u{064E}\u{0627}", $text);

        // Replace uthmanic tanween variants → standard tanween
        // Quranpedia uses positional marks for tanween at word-end:
        $text = str_replace("\u{0657}", "\u{064B}", $text); // ٗ inverted damma → ً fathatan
        $text = str_replace("\u{065E}", "\u{064C}", $text); // ٞ fathatan vertical → ٌ dammatan
        $text = str_replace("\u{0656}", "\u{064D}", $text); // ٖ subscript alef → ٍ kasratan

        // Convert haraka + small meem → tanween (إقلاب representation in quranpedia)
        // Quranpedia uses ۢ (small HIGH meem U+06E2) after damma/fatha,
        // and ۭ (small LOW meem U+06ED) after kasra to indicate tanween before ba.
        $text = str_replace("\u{064F}\u{06E2}", "\u{064C}", $text); // ُ+ۢ → ٌ
        $text = str_replace("\u{064E}\u{06E2}", "\u{064B}", $text); // َ+ۢ → ً
        $text = str_replace("\u{0650}\u{06E2}", "\u{064D}", $text); // ِ+ۢ → ٍ
        $text = str_replace("\u{0650}\u{06ED}", "\u{064D}", $text); // ِ+ۭ → ٍ

        // Convert tatweel+hamza_above (ـٔ) → standalone hamza (ء).
        // Quranpedia uses ـ+ٔ to represent hamza (was ئ/أ/ؤ in old mushaf).
        // Without this, stripping tatweel and hamza_above loses the consonant entirely.
        $text = preg_replace('/\x{0640}([\x{064B}-\x{0652}\x{0670}]*)\x{0654}/u', "\u{0621}$1", $text);

        // Handle سكتة: ۜ (small high seen) before whitespace marks a mandatory stop.
        // Replace with ZWSP (U+200B) to block cross-word pattern matching (e.g., prevent إدغام).
        // Inside-word ۜ (variant spelling markers) is stripped normally with other optional marks.
        $text = preg_replace('/\x{06DC}(?=\s|$)/u', "\u{200B}", $text);

        // Neutralize واو رسمية (orthographic waw) in the أُوْلـ demonstrative family.
        // In أُوْلَٰئِكَ, أُوْلِي, أُوْلُوا, etc., the waw is written in Uthmani script
        // but NOT pronounced — the same convention as الصلوٰة and الزكوٰة.
        // Replace its sukoon with fatha so madd patterns won't match it.
        $text = preg_replace('/(\x{0623}\x{064F})\x{0648}\x{0652}(\x{0644})/u', "$1\u{0648}\u{064E}$2", $text);

        // Insert implied sukoon on bare consonants.
        // Quranpedia drops sukoon for idghaam and on sakin letters; CASE patterns expect it.
        $text = $this->insertImpliedSukoon($text);

        // Normalize alef variants → regular alef (ا)
        // Quranpedia uses آ (alef madda) and ٰ (superscript alef/الألف الخنجرية)
        // where old text had regular ا. CASE patterns expect ا.
        // Must run AFTER insertImpliedSukoon so ٰ (combining mark) prevents wrong sukoon insertion.
        $text = str_replace("\u{0622}", "\u{0627}", $text); // آ → ا
        $text = str_replace("\u{0670}", "\u{0627}", $text); // ٰ superscript alef → ا

        // Strip Quranic annotation marks
        $text = str_replace(self::QURANIC_OPTIONAL_MARKS, '', $text);

        // Normalize shadda ordering: swap shadda+haraka → haraka+shadda
        // Quranpedia text: letter + shadda(0651) + haraka(064B-0650)
        // CASE patterns:   letter + haraka(064B-0650) + shadda(0651)
        $text = preg_replace('/(\x{0651})([\x{064B}-\x{0650}])/u', '$2$1', $text);

        return $text;
    }

    /**
     * Insert sukoon (U+0652) on Arabic consonants that have no diacritic mark.
     * Quranpedia drops sukoon for idghaam and on sakin letters; CASE patterns expect explicit sukoon.
     * Runs on text that still has Quranic annotation marks (before stripping).
     */
    public function insertImpliedSukoon(string $text): string
    {
        // Alef variants that never take sukoon
        static $alefCodes = [0x0622, 0x0625, 0x0627, 0x0649, 0x0671]; // آ إ ا ى ٱ

        // Split once into array — O(n) instead of O(n²) from repeated mb_substr
        $chars = mb_str_split($text);
        $len = count($chars);
        $result = '';

        for ($i = 0; $i < $len; $i++) {
            $char = $chars[$i];
            $code = mb_ord($char);
            $result .= $char;

            // Only process Arabic consonants (ء-غ U+0621-063A, ف-ي U+0641-064A, ة U+0629)
            $isConsonant = (($code >= 0x0621 && $code <= 0x063A)
                || ($code >= 0x0641 && $code <= 0x064A)
                || $code === 0x0629)
                && ! in_array($code, $alefCodes);

            if (! $isConsonant) {
                continue;
            }

            // Check if next character is a real diacritic (not Quranic annotation marks)
            // Real diacritics: U+064B-U+0652 (harakat, shadda, sukoon), U+0670 (superscript alef)
            if ($i + 1 < $len) {
                $nextCode = mb_ord($chars[$i + 1]);
                if (($nextCode >= 0x064B && $nextCode <= 0x0652) || $nextCode === 0x0670) {
                    continue;
                }
            }

            // Skip long vowels: waw after damma, yaa after kasra
            if ($i > 0) {
                $prev = mb_ord($chars[$i - 1]);
                if ($code === 0x0648 && $prev === 0x064F) {
                    continue; // وُو long vowel
                }
                if ($code === 0x064A && $prev === 0x0650) {
                    continue; // ـِي long vowel
                }
            }

            // Consonant has no diacritic → insert sukoon
            $result .= "\u{0652}";
        }

        return $result;
    }

    /**
     * Build a flexible regex from a normalized match text that can find the
     * corresponding text in the original (non-normalized) Quranic text.
     *
     * Handles: alef/alef-wasla, sukoon variants, decomposed آ,
     * shadda order differences, and optional Quranic marks between characters.
     */
    public function createFlexiblePattern(string $normalizedMatch): string
    {
        $marksClass = implode('', array_map(
            fn ($m) => sprintf('\x{%04X}', mb_ord($m)),
            self::QURANIC_OPTIONAL_MARKS
        ));
        // Include shadda (U+0651) as optionally skippable between characters.
        // In the original text, shadda may appear between a base letter and its
        // haraka (e.g., ض+ّ+َ) while the normalized match has it reordered (ض+َ+ّ).
        // Greedy matching + backtracking handles both cases correctly.
        $marksClass .= '\x{0651}';
        $opt = "[{$marksClass}]*";

        $pattern = '';
        $len = mb_strlen($normalizedMatch);
        $i = 0;

        while ($i < $len) {
            $char = mb_substr($normalizedMatch, $i, 1);
            $code = mb_ord($char);

            // Detect haraka+shadda pair (normalized order) → allow both orders in original
            if ($i + 1 < $len) {
                $nextChar = mb_substr($normalizedMatch, $i + 1, 1);
                $nextCode = mb_ord($nextChar);

                if ($code >= 0x064B && $code <= 0x0650 && $nextCode === 0x0651) {
                    // For tanween, use expanded alternatives (uthmanic variants + haraka+ۢ)
                    $h = match ($code) {
                        0x064B => "(?:[\x{064B}\x{0657}]|\x{064E}\x{06E2})",
                        0x064C => "(?:[\x{064C}\x{065E}]|\x{064F}\x{06E2})",
                        0x064D => "(?:[\x{064D}\x{0656}]|\x{0650}[\x{06E2}\x{06ED}])",
                        default => preg_quote($char, '~'),
                    };
                    $s = preg_quote($nextChar, '~');
                    $pattern .= "(?:{$h}{$opt}{$s}|{$s}{$opt}{$h})";
                    $pattern .= $opt;
                    $i += 2;

                    continue;
                }
            }

            // Character-level substitutions
            if ($code === 0x0621) {
                // ء → match standalone hamza or tatweel+hamza_above (quranpedia representation)
                $pattern .= "(?:\x{0621}|\x{0640}\x{0654})";
            } elseif ($code === 0x0627) {
                // ا → match alef, alef madda, decomposed alef-madda, superscript alef
                // Note: alef wasla (ٱ) is excluded — it stays as ٱ in normalized text
                // and should not be matched as a long vowel alef.
                $pattern .= "(?:[\x{0627}\x{0622}\x{0670}]|\x{0627}\x{0653})";
            } elseif ($code === 0x0652) {
                // ْ → match regular or Quranic sukoon, or absent sukoon (idghaam)
                // but NOT when a haraka follows (prevents matching e.g. غَ as ساكن)
                $pattern .= "(?:[\x{0652}\x{06E1}]|(?![\x{064B}-\x{0651}]))";
            } elseif ($code === 0x064B) {
                // ً → match standard fathatan, uthmanic variant (inverted damma), or fatha+ۢ (إقلاب)
                $pattern .= "(?:[\x{064B}\x{0657}]|\x{064E}\x{06E2})";
            } elseif ($code === 0x064C) {
                // ٌ → match standard dammatan, uthmanic variant (fathatan vertical), or damma+ۢ (إقلاب)
                $pattern .= "(?:[\x{064C}\x{065E}]|\x{064F}\x{06E2})";
            } elseif ($code === 0x064D) {
                // ٍ → match standard kasratan, uthmanic variant (subscript alef), or kasra+meem (إقلاب)
                $pattern .= "(?:[\x{064D}\x{0656}]|\x{0650}[\x{06E2}\x{06ED}])";
            } else {
                $pattern .= preg_quote($char, '~');
            }

            $pattern .= $opt;
            $i++;
        }

        // If match ends with bare waw or ya (madd/leen letter without sukoon),
        // add a negative lookahead so the flexible pattern won't match occurrences
        // where that waw/ya has a haraka in the original text (e.g., يَ in لتأتيَنّكم).
        $lastCode = mb_ord(mb_substr($normalizedMatch, -1, 1));
        if ($lastCode === 0x0648 || $lastCode === 0x064A) {
            $pattern .= "(?![\x{064B}-\x{0650}])";
        }

        return $pattern;
    }

    /**
     * Check if a pattern requires matching against original (non-normalized) text.
     * Rules that match small waw (ۥ), small yaa (ۦ), or rectangular zero (۠)
     * must use original text because normalization strips these characters.
     */
    public function patternNeedsOriginalText(string $pattern): bool
    {
        return str_contains($pattern, "\u{06E5}")
            || str_contains($pattern, "\u{06E6}")
            || str_contains($pattern, "\u{06E0}");
    }

    /**
     * Regex character class for diacritics and Quranic marks allowed between groups.
     */
    public function getBetweenGroupsMarksPattern(): string
    {
        $marks = implode('', array_map(
            fn ($m) => sprintf('\x{%04X}', mb_ord($m)),
            self::QURANIC_OPTIONAL_MARKS
        ));

        // Standard diacritics (064B-0652), superscript alef (0670), shadda (0651),
        // Quranic sukoon (06E1), plus all Quranic optional marks
        return "[\x{064B}-\x{0652}\x{0670}\x{06E1}{$marks}]";
    }

    public function getTargetPattern($rule): string
    {
        if (str_contains($rule->case, '+')) {
            $pattern = $this->groupWithGroup($rule);
        } else {
            $pattern = $this->singleGroup($rule);
        }

        return $pattern;
    }

    public function groupWithGroup($rule): string
    {
        $case = $rule->case;
        $white_spaces_pattern = $rule->white_spaces_pattern;
        $groups = explode('+', $case);
        $pattern = '';
        $ignore_specific_keyword = '' /* "(?!ahmad|sara)" */ /* فِرْقٍ */;
        $diacMarks = $this->getBetweenGroupsMarksPattern();

        foreach ($groups as $group_item) {
            $group = $this->getFormattedGroup($group_item);
            $pattern .= "(?:{$group})";

            if ($group_item !== end($groups)) {
                $pattern .= "(?:{$white_spaces_pattern}|{$this->getFormattedAllowedCharacters()}|{$diacMarks})+";
            }
        }

        return "~{$ignore_specific_keyword}{$pattern}~u";
    }

    public function getFormattedAllowedCharacters(): string
    {
        return implode('|', array_map('preg_quote', $this->ALLOWED_CHARACTERS));
    }

    public function singleGroup($rule): string
    {
        $case = $rule->case;
        $group = $this->getFormattedGroup($case);

        return "/{$group}(?:{$this->getFormattedAllowedCharacters()})*/u";
    }

    public function getFormattedGroup($group): array|string
    {
        /* WARNING : DON'T TOUCH THE ORDER :) */

        // Replace named Quranic marks with actual Unicode characters
        $group = str_replace('الألف الخنجرية', "\u{0670}", $group);
        $group = str_replace('واو صغيرة', "\u{06E5}", $group);
        $group = str_replace('ياء صغيرة', "\u{06E6}", $group);

        $group = preg_replace('/ـ+/u', '.', $group); // replace all dashed to only one dot
        $group = str_replace('.]', ']', $group); // to fix bug -> sometimes it returns an extra point at the end
        $group = preg_replace('/\s+/', ' ', $group);  // replace multi spaces to only one space
        $group = str_replace(' ', '|', trim(str_replace(['[', ']'], '', trim($group)))); // divided characters into groups

        // Allow optional haraka between consonant and shadda.
        // Normalization reorders shadda+haraka → haraka+shadda, so patterns like نّ
        // need to match نَّ (noon + fatha + shadda) in normalized text.
        $group = preg_replace('/([\x{0621}-\x{063A}\x{0641}-\x{064A}\x{0629}])(\x{0651})/u',
            '$1[\x{064B}-\x{0650}]?$2', $group);

        // Prevent bare waw/ya from matching when followed by harakaat (vowel diacritics).
        // In madd/leen groups, both bare and sukoon variants appear (e.g., [وْ و] or [ي يْ]).
        // Without this, bare و/ي matches any waw/ya regardless of its vowel (e.g., وَ in هُوَ).
        // A madd/leen waw/ya is sakin (no vowel), so we add a negative lookahead.
        $alternatives = explode('|', $group);
        $hasWawSukoon = in_array("\u{0648}\u{0652}", $alternatives);
        $hasBareWaw = in_array("\u{0648}", $alternatives);
        $hasYaSukoon = in_array("\u{064A}\u{0652}", $alternatives);
        $hasBareYa = in_array("\u{064A}", $alternatives);

        if ($hasWawSukoon && $hasBareWaw) {
            $alternatives = array_map(
                fn ($alt) => $alt === "\u{0648}" ? "\u{0648}(?![\x{064B}-\x{0650}])" : $alt,
                $alternatives
            );
        }
        if ($hasYaSukoon && $hasBareYa) {
            $alternatives = array_map(
                fn ($alt) => $alt === "\u{064A}" ? "\u{064A}(?![\x{064B}-\x{0650}])" : $alt,
                $alternatives
            );
        }

        $group = implode('|', $alternatives);

        return $group;
    }
}

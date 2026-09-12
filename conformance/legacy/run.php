<?php
/**
 * Drives the recovered legacy matcher over a whole edition.
 *
 *   php -d memory_limit=4G run.php <edition.json> <out.json> [--rules spreadsheet|deployed] [--no-trailing]
 *
 * Called by `node scripts/differential-legacy.mjs`; runnable on its own.
 *
 * Emits BOTH of the legacy engine's answers, because the legacy engine gave two
 * and they do not agree with each other:
 *
 *   "ayah"  which rules matched which ayahs. This is what CacheAyahRules and
 *           AyahsWithRules computed, and it is the trustworthy oracle: one
 *           preg_match against the normalised text, nothing else.
 *
 *   "spans" where the highlights went. This is HighlightAyahs, and it is a
 *           SECOND search: the matched fragment is turned into a looser pattern
 *           and hunted for in the original text. That search drops matches the
 *           first one found — see "The legacy engine reported rulings it then
 *           failed to highlight" in docs/divergences.md. Do not read "spans" as
 *           the legacy engine's opinion about tajweed. It is its opinion about
 *           rendering, and it was wrong.
 *
 * Offsets in "spans" are BYTE offsets, because that is what PHP's
 * PREG_OFFSET_CAPTURE and strlen produce. This engine's are code point offsets.
 * They are not comparable without conversion; differential-legacy.mjs converts.
 *
 * TWO RULE TABLES, and they are not the same:
 *
 *   --rules spreadsheet  rules-from-spreadsheet.json — what a rule was MEANT to
 *                        say, rebuilt from the authored workbook.
 *   --rules deployed     rules-as-deployed.json — what the legacy engine ACTUALLY
 *                        ran with. Eight rules were hand-edited in the database
 *                        in Feb 2026 and the workbook was never updated to match.
 *
 * Use `deployed` to ask whether the port is faithful. Use `spreadsheet` to ask
 * whether a rule still says what its author wrote. Different questions, different
 * answers; see docs/divergences.md.
 *
 * The 18 ids in excludedByLegacyScope are skipped by default, exactly as
 * ExcludeUnprocessedRulesScope skipped them — the legacy engine never ran them,
 * so including them would compare our output against nothing.
 */

require __DIR__ . '/matcher.php';

$editionPath = $argv[1] ?? null;
$outPath = $argv[2] ?? null;
if (! $editionPath || ! $outPath) {
    fwrite(STDERR, "usage: php run.php <edition.json> <out.json> [--rules spreadsheet|deployed] [--include-excluded]\n");
    exit(1);
}
$includeExcluded = in_array('--include-excluded', $argv, true);
// Isolates the legacy trailing-diacritic extension (commit 36456fa). With it off,
// span agreement with this engine rises from 90,234 to 122,254 — which is how we
// know that extension, and not a rule disagreement, is what moves most spans.
$trailing = ! in_array('--no-trailing', $argv, true);

$which = 'spreadsheet';
$i = array_search('--rules', $argv, true);
if ($i !== false && isset($argv[$i + 1])) {
    $which = $argv[$i + 1];
}
if (! in_array($which, ['spreadsheet', 'deployed'], true)) {
    fwrite(STDERR, "--rules must be 'spreadsheet' or 'deployed', got '{$which}'\n");
    exit(1);
}
$tablePath = __DIR__ . ($which === 'deployed' ? '/rules-as-deployed.json' : '/rules-from-spreadsheet.json');

$m = new LegacyMatcher();
$table = json_decode(file_get_contents($tablePath), true);
fwrite(STDERR, "rule table: {$which}\n");
$edition = json_decode(file_get_contents($editionPath), true);
$ayahs = $edition['ayahs'] ?? null;
if (! $ayahs) {
    fwrite(STDERR, "no ayahs in {$editionPath}\n");
    exit(1);
}
$excluded = $table['excludedByLegacyScope']['ids'];

/**
 * HighlightAyahs::collectHighlightPositions, ported unchanged.
 *
 * Every quirk here is deliberate and load-bearing for fidelity:
 *  - $processedTexts dedupes by matched TEXT, so a fragment appearing twice in an
 *    ayah is searched once and both occurrences are recorded — and a genuine
 *    repeat that happens to look identical is collapsed.
 *  - the trailing walk extends each span over following diacritics, so a span
 *    never ends between a letter and its haraka.
 */
function collectSpans(LegacyMatcher $m, string $original, array $matches, bool $matchedOnOriginal, bool $trailing = true): array
{
    $out = [];
    $processedTexts = [];
    foreach ($matches as $match) {
        $matchText = $match[0];
        if (in_array($matchText, $processedTexts, true)) {
            continue;
        }
        $processedTexts[] = $matchText;

        $searchPattern = $matchedOnOriginal
            ? "/\Q{$matchText}\E/u"
            : '~' . $m->createFlexiblePattern($matchText) . '~u';

        if (@preg_match_all($searchPattern, $original, $found, PREG_OFFSET_CAPTURE)) {
            foreach ($found[0] as $hit) {
                $text = $hit[0];
                $start = $hit[1];
                $length = strlen($text);
                $pos = $start + $length;
                while ($trailing && $pos < strlen($original)) {
                    if (preg_match('/\A[\x{064B}-\x{0652}\x{0670}\x{06E1}\x{0651}]/u', substr($original, $pos), $tm)) {
                        $length += strlen($tm[0]);
                        $pos += strlen($tm[0]);
                    } else {
                        break;
                    }
                }
                $out[] = [$start, $start + $length];
            }
        }
    }

    return $out;
}

$compiled = [];
foreach ($table['rules'] as $r) {
    if (! $includeExcluded && in_array($r['id'], $excluded, true)) {
        continue;
    }
    $rule = new stdClass();
    $rule->case = $r['case'];
    $rule->white_spaces_pattern = $r['white_spaces_pattern'];
    $pattern = $m->getTargetPattern($rule);
    $compiled[$r['id']] = ['pattern' => $pattern, 'onOriginal' => $m->patternNeedsOriginalText($pattern)];
}
fwrite(STDERR, 'compiled ' . count($compiled) . " rules\n");

$byAyah = [];
$bySpan = [];
$errors = [];
foreach ($ayahs as $key => $original) {
    $normalized = $m->normalizeText($original);
    foreach ($compiled as $id => $c) {
        $text = $c['onOriginal'] ? $original : $normalized;
        $count = @preg_match_all($c['pattern'], $text, $hits, PREG_OFFSET_CAPTURE);
        if ($count === false) {
            $errors[$id] = preg_last_error_msg();

            continue;
        }
        if (! $count) {
            continue;
        }
        $byAyah[$key][] = $id;
        $spans = collectSpans($m, $original, $hits[0], $c['onOriginal'], $trailing);
        if ($spans) {
            $bySpan[$key][$id] = $spans;
        }
    }
}

if ($errors) {
    fwrite(STDERR, 'REGEX ERRORS: ' . json_encode($errors) . "\n");
}

file_put_contents($outPath, json_encode([
    'offsets' => 'byte',
    'ruleTable' => $which,
    'trailingExtension' => $trailing,
    'rulesRun' => count($compiled),
    'regexErrors' => (object) $errors,
    'ayah' => $byAyah,
    'spans' => $bySpan,
], JSON_UNESCAPED_UNICODE));

fwrite(STDERR, 'wrote ' . $outPath . ' — ' . count($byAyah) . " ayahs with at least one rule\n");

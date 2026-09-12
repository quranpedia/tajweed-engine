<?php
/**
 * Measures what adopting the spreadsheet's بداية الحكم column would change.
 *
 *   php -d memory_limit=4G start-from.php <edition.json>
 *   node scripts/differential-legacy.mjs --start-from     (same thing)
 *
 * WHY THIS IS A QUESTION AT ALL
 *
 * The authored workbook has a column, `بداية الحكم` / `start_from`, that differs
 * from `CASE` on 74 enabled rules. For the two-group إدغام and إظهار rules it
 * holds only the FIRST group — `لْ` where CASE says `لْ + ل` — which reads as an
 * instruction: match on both, but colour only the sakin letter the ruling is
 * about, not the letter that triggers it.
 *
 * Neither engine has ever read it. `TajweedRulesImport` stores the column and
 * `ImportAndStoreTajweedRules` writes it to the database, but it appears nowhere
 * in matcher.php and nowhere in this engine. Adopting it would therefore be a
 * change FROM legacy behaviour, not a restoration of it — the opposite direction
 * to every other entry in docs/divergences.md.
 *
 * WHAT THIS MEASURES
 *
 * For every enabled rule where start_from differs from case: match with the full
 * CASE pattern, then anchor the start_from pattern at the head of each match and
 * see how much shorter the result is. That is exactly the span this engine would
 * publish if the column were treated as the extent.
 *
 * CONTROL OUTPUT, on editions/uthmani-hafs.json:
 *
 *   rules with start_from != case (enabled) : 74
 *   rules of those producing any matches    : 35
 *   rules whose spans would SHRINK          : 29
 *   matches over those rules                : 21,972
 *   matches that would shrink               :  6,260  (28.5%)
 *   code points highlighted now             : 69,746
 *   code points highlighted via start_from  : 60,798  (12.8% less)
 *
 * The six that do not shrink matter as much as the 29 that do: on those the
 * column is either pure whitespace noise or a strictly smaller letter set than
 * CASE, which looks like an earlier draft nobody deleted. A column that is
 * authoritative in 29 rows and vestigial in 6 cannot be adopted wholesale.
 */

require __DIR__ . '/matcher.php';

$edition = $argv[1] ?? __DIR__ . '/../../editions/uthmani-hafs.json';
$m = new LegacyMatcher();
$table = json_decode(file_get_contents(__DIR__ . '/rules-as-deployed.json'), true);
$ayahs = json_decode(file_get_contents($edition), true)['ayahs'];
$excluded = $table['excludedByLegacyScope']['ids'];

$differ = 0;
$rows = [];
foreach ($table['rules'] as $r) {
    if (in_array($r['id'], $excluded, true)) {
        continue;
    }
    $sf = $r['start_from'] ?? '';
    if ($sf === '' || $sf === $r['case']) {
        continue;
    }
    $differ++;

    $full = new stdClass();
    $full->case = $r['case'];
    $full->white_spaces_pattern = $r['white_spaces_pattern'];
    $fullPattern = $m->getTargetPattern($full);

    $head = new stdClass();
    $head->case = $sf;
    $head->white_spaces_pattern = $r['white_spaces_pattern'];
    $headPattern = $m->getTargetPattern($head);
    // strip the delimiters and the trailing /u so it can be re-anchored
    $headBody = substr($headPattern, 1, strlen($headPattern) - 3);

    $matches = 0;
    $shrunk = 0;
    $cpNow = 0;
    $cpThen = 0;
    $sample = null;
    foreach ($ayahs as $ref => $text) {
        if (! preg_match_all($fullPattern, $m->normalizeText($text), $hits, PREG_OFFSET_CAPTURE)) {
            continue;
        }
        foreach ($hits[0] as $hit) {
            $matches++;
            $whole = mb_strlen($hit[0]);
            $cpNow += $whole;
            if (preg_match('~^(?:'.$headBody.')~u', $hit[0], $head_m)) {
                $part = mb_strlen($head_m[0]);
                $cpThen += $part;
                if ($part < $whole) {
                    $shrunk++;
                    if (! $sample) {
                        $sample = [$ref, $hit[0], $head_m[0]];
                    }
                }
            } else {
                $cpThen += $whole;
            }
        }
    }
    if ($matches) {
        $rows[] = compact('r', 'sf', 'matches', 'shrunk', 'cpNow', 'cpThen', 'sample');
    }
}

usort($rows, fn ($a, $b) => $b['matches'] <=> $a['matches']);
$shrinkers = array_values(array_filter($rows, fn ($x) => $x['shrunk'] > 0));
$inert = array_values(array_filter($rows, fn ($x) => $x['shrunk'] === 0));
$M = array_sum(array_column($rows, 'matches'));
$S = array_sum(array_column($rows, 'shrunk'));
$N = array_sum(array_column($rows, 'cpNow'));
$T = array_sum(array_column($rows, 'cpThen'));

printf("rules with start_from != case (enabled) : %d\n", $differ);
printf("rules of those producing any matches    : %d\n", count($rows));
printf("rules whose spans would SHRINK          : %d\n", count($shrinkers));
printf("matches over those rules                : %s\n", number_format($M));
printf("matches that would shrink               : %s  (%.1f%%)\n", number_format($S), 100 * $S / max(1, $M));
printf("code points highlighted now             : %s\n", number_format($N));
printf("code points highlighted via start_from  : %s  (%.1f%% less)\n", number_format($T), 100 * (1 - $T / max(1, $N)));

echo "\n== THE ".count($shrinkers)." WHERE THE COLUMN IS AN INSTRUCTION ==\n";
foreach ($shrinkers as $x) {
    printf("  %-34s %6s matches   %s -> %s\n", $x['r']['slug'], number_format($x['matches']), $x['r']['case'], $x['sf']);
    if ($x['sample']) {
        printf("      %-9s %s  =>  %s\n", $x['sample'][0], $x['sample'][1], $x['sample'][2]);
    }
}

echo "\n== THE ".count($inert)." WHERE IT LOOKS LIKE AN UNDELETED DRAFT ==\n";
foreach ($inert as $x) {
    $c = $x['r']['case'];
    $s = $x['sf'];
    $kind = str_replace(' ', '', $c) === str_replace(' ', '', $s)
        ? 'whitespace only'
        : 'DIFFERENT LETTER SET';
    printf("  %-34s %6s matches   [%s]\n", $x['r']['slug'], number_format($x['matches']), $kind);
    if ($kind !== 'whitespace only') {
        printf("      case      : %s\n      start_from: %s\n", $c, $s);
    }
}

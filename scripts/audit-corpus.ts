/**
 * Cross-checks each rule's Arabic description against the pattern it actually
 * compiles to.
 *
 *   pnpm rules:audit
 *
 * The ahkam of madd are written as series — one rule for alef, one for waw, one
 * for yaa — and the rules are authored by copying a sibling and editing it. Twice
 * in this corpus the harakat were updated and the madd letter was not, leaving a
 * rule that says "the sakin waw" while searching for an alef. Nothing about such
 * a rule looks wrong: it compiles, it matches something, and its description
 * reads correctly.
 *
 * So the check is the obvious one, done mechanically: if the description names a
 * madd letter, the pattern had better contain it.
 *
 * This is a heuristic and reports suspicions, not failures. It does not gate CI.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCase } from '../packages/core/src/compile.js'
import { ALEF, ALEF_MAQSURA, SUKOON, SUPERSCRIPT_ALEF, WAW, YEH } from '../packages/core/src/unicode.js'
import type { Corpus } from '../packages/core/src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const corpus = JSON.parse(
  readFileSync(join(here, '..', 'packages', 'rules', 'rules.json'), 'utf8'),
) as Corpus

interface LetterCheck {
  readonly name: string
  /** Phrases in a rule's description that mean the rule is about this letter. */
  readonly mentions: readonly string[]
  /** Base letters that satisfy the mention. */
  readonly letters: readonly string[]
}

const CHECKS: readonly LetterCheck[] = [
  {
    name: 'waw',
    mentions: ['الواو الساكنة', 'واو ساكنة', 'الواو اللينة'],
    letters: [WAW, '\u{06E5}'],
  },
  {
    name: 'yaa',
    mentions: ['الياء الساكنة', 'ياء ساكنة', 'الياء اللينة'],
    letters: [YEH, '\u{06E6}'],
  },
  {
    name: 'alef',
    mentions: ['الألف الساكنة', 'ألف ساكنة'],
    letters: [ALEF, ALEF_MAQSURA, SUPERSCRIPT_ALEF],
  },
]

/**
 * A rule about a sakin letter must have that letter somewhere as its own
 * alternative, either bare or carrying a sukoon.
 *
 * Matching the bare or sakin form specifically is what makes the check work. The
 * leading group of these rules lists the whole alphabet vowelled — وُ, يِ and so on
 * — so a test for "contains a waw" is satisfied by the context group and never
 * fires, which is exactly how the two defective rules survived review.
 */
function satisfies(alternatives: readonly string[], letters: readonly string[]): boolean {
  return alternatives.some(
    (alternative) =>
      letters.includes(alternative) || letters.some((letter) => alternative === letter + SUKOON),
  )
}

const suspicions: string[] = []

for (const rule of corpus.rules) {
  if (rule.status === 'disabled') {
    continue
  }

  const description = rule.label.ar
  const alternatives = parseCase(rule.case).flat()

  for (const check of CHECKS) {
    const mentioned = check.mentions.some((phrase) => description.includes(phrase))
    if (!mentioned || satisfies(alternatives, check.letters)) {
      continue
    }
    suspicions.push(
      `${rule.id}\n` +
        `    describes: ${description}\n` +
        `    but no group has a bare or sakin ${check.name}: ${rule.case}`,
    )
  }
}

if (suspicions.length === 0) {
  console.log(`audited ${corpus.rules.length} rules — no description/pattern mismatches`)
} else {
  console.log(`${suspicions.length} rule(s) describe a letter their pattern does not contain:\n`)
  for (const suspicion of suspicions) {
    console.log(`  ${suspicion}\n`)
  }
}

/**
 * Prints the code points of an ayah, and optionally its normalised form.
 *
 *   pnpm inspect 2:1
 *   pnpm inspect 1:7 --normalized
 *
 * Authoring a rule means knowing exactly which characters the text uses, not
 * which characters it appears to use — several Uthmani marks are invisible at
 * normal size, and several pairs render identically.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { normalize } from '../packages/core/src/normalize.js'
import { toCodePoints } from '../packages/core/src/unicode.js'
import type { Edition } from '../packages/core/src/edition.js'

const here = dirname(fileURLToPath(import.meta.url))
const editionPath = process.env.EDITION ?? join(here, '..', 'editions', 'uthmani-hafs.json')
const edition = JSON.parse(readFileSync(editionPath, 'utf8')) as Edition

const references = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const showNormalized = process.argv.includes('--normalized')

for (const reference of references) {
  const text = edition.ayahs[reference]
  if (!text) {
    console.error(`${reference}: not in edition ${edition.id}`)
    continue
  }

  const subject = showNormalized ? normalize(text).text : text
  console.log(`\n${reference}${showNormalized ? ' (normalised)' : ''}`)
  console.log(`  ${subject}`)
  console.log(
    `  ${toCodePoints(subject)
      .map((char) => (char === ' ' ? '␣' : `${char}=${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`))
      .join(' ')}`,
  )
}

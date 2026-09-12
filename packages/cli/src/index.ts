#!/usr/bin/env node

/**
 * A command line for the corpus and the engine.
 *
 * Two kinds of thing live here. Asking questions of the corpus — which rules
 * exist, what does this one say, which gaps are still open — needs no Quranic
 * text and works out of the box. Annotating needs text, which this tool does not
 * ship and will not fetch: point it at an edition you already have, or pipe text
 * in.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import corpus from '@tajweed/rules' with { type: 'json' }
import {
  Tajweed,
  editionDigest,
  orderedReferences,
  resolveOverlaps,
  sliceSpan,
  toAnsi,
  toHtml,
  type Corpus,
  type Edition,
  type Rule,
  type Span,
} from '@tajweed/core'

const typed = corpus as unknown as Corpus

const USAGE = `tajweed — rule-driven tajweed for Quranic text

  tajweed rules [query]              list rules, optionally filtered by Arabic or by id
  tajweed explain <rule-id>          everything the corpus records about one rule
  tajweed gaps                       rules the notation cannot express yet, grouped
  tajweed annotate [options]         report where rules apply in a piece of text
  tajweed verify --edition <file>    check an edition against the shipped annotations

Options for annotate:
  --text <text>        analyse this text
  --edition <file>     read text from an edition file
  --ref <surah:ayah>   which ayah of the edition (repeatable; default all)
  --only <id>          restrict to a rule, hukum, category or topic (repeatable)
  --school <id>        where two scholars are modelled, pick one
  --format <fmt>       ansi (default), json, html, text
  --                   read text from stdin

No Quranic text is shipped with this tool.`

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

interface Options {
  readonly flags: Map<string, string[]>
  readonly positional: string[]
}

function parseArgs(argv: readonly string[]): Options {
  const flags = new Map<string, string[]>()
  const positional: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]!
    if (!argument.startsWith('--')) {
      positional.push(argument)
      continue
    }
    const name = argument.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.set(name, [...(flags.get(name) ?? []), ''])
    } else {
      flags.set(name, [...(flags.get(name) ?? []), next])
      i += 1
    }
  }

  return { flags, positional }
}

function first(options: Options, name: string): string | undefined {
  const values = options.flags.get(name)
  return values?.[0] === '' ? undefined : values?.[0]
}

function all(options: Options, name: string): string[] {
  return (options.flags.get(name) ?? []).filter((value) => value !== '')
}

function commandRules(options: Options): void {
  const query = options.positional[0]?.toLowerCase()

  const matching = typed.rules.filter((rule) => {
    if (!query) {
      return true
    }
    return (
      rule.id.toLowerCase().includes(query) ||
      rule.hukum.toLowerCase().includes(query) ||
      rule.label.ar.includes(options.positional[0]!)
    )
  })

  if (matching.length === 0) {
    fail(`No rule matches ${JSON.stringify(options.positional[0])}.`)
  }

  for (const rule of matching) {
    // A dispute outranks the review flag: `?` means nobody has checked, `!` means
    // somebody checked and disagreed. Both rules carry needsReview too, so without
    // this they would render as merely unreviewed.
    const mark =
      rule.status === 'disabled' ? '✗' : rule.status === 'disputed' ? '!' : rule.needsReview ? '?' : ' '
    console.log(`${mark} ${rule.id.padEnd(34)} ${rule.label.ar}`)
  }

  const disabled = matching.filter((rule) => rule.status === 'disabled').length
  const disputed = matching.filter((rule) => rule.status === 'disputed').length
  const review = matching.filter((rule) => rule.needsReview).length
  console.log(
    `\n${matching.length} rules  (✗ ${disabled} disabled, ! ${disputed} disputed, ? ${review} awaiting review)  ` +
      `riwayah ${typed.riwayah}`,
  )
}

function commandExplain(options: Options): void {
  const id = options.positional[0]
  if (!id) {
    fail('usage: tajweed explain <rule-id>')
  }

  const rule = typed.rules.find((candidate) => candidate.id === id)
  if (!rule) {
    fail(`No rule with id ${id}. Try \`tajweed rules ${id}\`.`)
  }

  const hukum = typed.hukums.find((candidate) => candidate.id === rule.hukum)
  const category = typed.categories.find((candidate) => candidate.id === hukum?.category)
  const topic = typed.topics.find((candidate) => candidate.id === category?.topic)

  console.log(`${rule.id}\n`)
  console.log(`  ${rule.label.ar}\n`)
  console.log(`  topic     ${topic?.label.ar ?? '—'} (${topic?.id ?? '—'})`)
  console.log(`  category  ${category?.label.ar ?? '—'} (${category?.id ?? '—'})`)
  console.log(`  hukum     ${hukum?.label.ar ?? '—'} (${hukum?.id ?? '—'})`)
  if (hukum?.school) {
    console.log(`  school    ${hukum.school.scholar} (${hukum.school.id})`)
  }
  console.log(`  case      ${rule.case}`)
  console.log(`  scope     ${rule.scope}`)
  if (rule.matchAgainst === 'original') {
    console.log('  matches   the text as written, not the normalised form')
  }
  console.log(`  status    ${rule.status}${rule.needsReview ? ' (awaiting reviewer sign-off)' : ''}`)
  if (rule.disputed) {
    // Printed in full, not summarised. Someone reading `tajweed show <id>` to
    // decide whether to trust a span needs the objection itself, not a flag
    // telling them one exists somewhere.
    console.log(`\n  DISPUTED — raised by ${rule.disputed.raised_by}`)
    console.log(`  bears on: ${rule.disputed.occurrences.join(', ')}`)
    console.log(`\n  ${rule.disputed.finding}`)
    if (rule.disputed.resolved_by) {
      console.log(`\n  resolved by ${rule.disputed.resolved_by}`)
    }
  }
  if (rule.gap) {
    console.log(`  gap       ${rule.gap}`)
  }
  if (rule.statusReason) {
    console.log(`\n  ${rule.statusReason}`)
  }
  if (rule.notes) {
    console.log(`\n  ${rule.notes.ar}`)
  }
  for (const correction of rule.corrections ?? []) {
    console.log(`\n  corrected ${correction.field}, was:\n    ${correction.was}\n  because: ${correction.reason}`)
  }
}

function commandGaps(): void {
  const byGap = new Map<string, Rule[]>()
  for (const rule of typed.rules) {
    if (rule.status !== 'disabled' || !rule.gap) {
      continue
    }
    byGap.set(rule.gap, [...(byGap.get(rule.gap) ?? []), rule])
  }

  console.log('Rules the CASE notation cannot express yet.\n')
  for (const [gap, rules] of [...byGap].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${gap}  (${rules.length})`)
    console.log(`  ${rules[0]!.statusReason ?? ''}`)
    for (const rule of rules) {
      console.log(`    ${rule.id.padEnd(34)} ${rule.label.ar}`)
    }
    console.log()
  }
}

function readEdition(path: string): Edition {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8')) as Edition
  } catch (error) {
    fail(`Could not read edition ${path}: ${(error as Error).message}`)
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

async function commandAnnotate(options: Options): Promise<void> {
  const format = first(options, 'format') ?? 'ansi'
  const only = all(options, 'only')
  const school = first(options, 'school')

  const engine = new Tajweed(typed, {
    ...(only.length > 0 ? { only } : {}),
    ...(school ? { school } : {}),
  })

  const passages: Array<{ reference: string; text: string }> = []
  const editionPath = first(options, 'edition')
  const inlineText = first(options, 'text')

  if (editionPath) {
    const edition = readEdition(editionPath)
    const references = all(options, 'ref')
    for (const reference of references.length > 0 ? references : orderedReferences(edition)) {
      const text = edition.ayahs[reference]
      if (text === undefined) {
        fail(`${reference} is not in edition ${edition.id}.`)
      }
      passages.push({ reference, text })
    }
  } else if (inlineText) {
    passages.push({ reference: '-', text: inlineText })
  } else if (!process.stdin.isTTY) {
    passages.push({ reference: '-', text: await readStdin() })
  } else {
    fail('Nothing to annotate. Pass --text, --edition, or pipe text in.\n\n' + USAGE)
  }

  if (format === 'json') {
    const output = passages.map(({ reference, text }) => ({
      ref: reference,
      spans: engine.analyze(text),
    }))
    console.log(JSON.stringify(output, null, 2))
    return
  }

  for (const { reference, text } of passages) {
    const spans = engine.analyze(text)

    if (format === 'html') {
      console.log(toHtml(text, spans, typed))
      continue
    }
    if (format === 'text') {
      for (const span of resolveOverlaps(spans)) {
        console.log(`${reference}\t${span.start}\t${span.end}\t${span.ruleId}\t${sliceSpan(text, span)}`)
      }
      continue
    }

    console.log(`\n${reference === '-' ? '' : `${reference}  `}${toAnsi(text, spans)}`)
    console.log(`  ${spans.length} spans, ${new Set(spans.map((span) => span.hukumId)).size} ahkam`)
    for (const hukumId of new Set(resolveOverlaps(spans).map((span: Span) => span.hukumId))) {
      const hukum = typed.hukums.find((candidate) => candidate.id === hukumId)
      console.log(`    ${hukum?.label.ar ?? hukumId}`)
    }
  }
}

async function commandVerify(options: Options): Promise<void> {
  const editionPath = first(options, 'edition')
  if (!editionPath) {
    fail('usage: tajweed verify --edition <file>')
  }

  const edition = readEdition(editionPath)
  const digest = await editionDigest(edition)
  const count = orderedReferences(edition).length

  console.log(`edition   ${edition.id}`)
  console.log(`riwayah   ${edition.riwayah}`)
  console.log(`ayahs     ${count}`)
  console.log(`sha256    ${digest}`)

  if (edition.riwayah !== typed.riwayah) {
    fail(
      `\nThis corpus is ${typed.riwayah}; the edition is ${edition.riwayah}. ` +
        'Both the rulings and the orthography differ between riwayat.',
    )
  }

  console.log(`\nMatches the corpus riwayah. Compare the sha256 against an annotation set's edition.sha256.`)
}

const [, , command, ...rest] = process.argv
const options = parseArgs(rest)

switch (command) {
  case 'rules':
    commandRules(options)
    break
  case 'explain':
    commandExplain(options)
    break
  case 'gaps':
    commandGaps()
    break
  case 'annotate':
    await commandAnnotate(options)
    break
  case 'verify':
    await commandVerify(options)
    break
  case undefined:
  case '--help':
  case '-h':
  case 'help':
    console.log(USAGE)
    break
  default:
    fail(`Unknown command ${command}.\n\n${USAGE}`)
}

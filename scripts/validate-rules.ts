/**
 * Validates packages/rules/rules.json against its JSON Schema, and then against
 * the invariants a schema cannot express: referential integrity, unique ids, and
 * agreement between a rule's CASE shape and its declared scope/whitespace.
 *
 *   pnpm rules:validate
 *
 * Runs in CI. The corpus is the product; a broken corpus is worse than a broken
 * build, so this fails loudly rather than warning.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import Ajv2020 from 'ajv/dist/2020.js'

const here = dirname(fileURLToPath(import.meta.url))
const rulesDir = join(here, '..', 'packages', 'rules')

const schema = JSON.parse(readFileSync(join(rulesDir, 'schema', 'rules.schema.json'), 'utf8'))
const corpus = JSON.parse(readFileSync(join(rulesDir, 'rules.json'), 'utf8'))

const problems: string[] = []

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(schema)
if (!validate(corpus)) {
  for (const error of validate.errors ?? []) {
    problems.push(`schema: ${error.instancePath || '/'} ${error.message}`)
  }
}

interface Entry {
  id: string
}
const ids = (entries: Entry[]) => new Set(entries.map((entry) => entry.id))

const topicIds = ids(corpus.topics)
const categoryIds = ids(corpus.categories)
const hukumIds = ids(corpus.hukums)

function assertUnique(entries: Entry[], what: string): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      problems.push(`duplicate ${what} id: ${entry.id}`)
    }
    seen.add(entry.id)
  }
}

assertUnique(corpus.topics, 'topic')
assertUnique(corpus.categories, 'category')
assertUnique(corpus.hukums, 'hukum')
assertUnique(corpus.rules, 'rule')

for (const category of corpus.categories) {
  if (!topicIds.has(category.topic)) {
    problems.push(`category ${category.id} references unknown topic ${category.topic}`)
  }
}

for (const hukum of corpus.hukums) {
  if (!categoryIds.has(hukum.category)) {
    problems.push(`hukum ${hukum.id} references unknown category ${hukum.category}`)
  }
}

const hukumsWithRules = new Set<string>()

for (const rule of corpus.rules) {
  if (!hukumIds.has(rule.hukum)) {
    problems.push(`rule ${rule.id} references unknown hukum ${rule.hukum}`)
  }
  hukumsWithRules.add(rule.hukum)

  if (!rule.id.startsWith(`${rule.hukum}.`)) {
    problems.push(`rule ${rule.id} is not namespaced under its hukum ${rule.hukum}`)
  }

  // `scope` describes what may appear BETWEEN groups, so it only means something
  // for a multi-group rule. A single-group rule that claims to span words is a
  // data error — there is no second group for the boundary to sit between.
  // Rules flagged `not-a-pattern` hold prose in `case`, so its shape says nothing.
  const isMultiGroup = rule.case.includes('+')
  if (rule.gap !== 'not-a-pattern' && !isMultiGroup && rule.scope !== 'within-word') {
    problems.push(`rule ${rule.id} is single-group but is scoped ${rule.scope}`)
  }

  if (rule.corrections && !rule.needsReview) {
    problems.push(`rule ${rule.id} carries corrections but is not flagged needsReview`)
  }

  if (rule.status === 'disabled' && !rule.gap) {
    problems.push(`rule ${rule.id} is disabled but records no gap explaining why`)
  }
  if (rule.status === 'stable' && rule.gap) {
    problems.push(`rule ${rule.id} is stable but records a gap`)
  }
}

for (const hukum of corpus.hukums) {
  if (!hukumsWithRules.has(hukum.id)) {
    problems.push(`hukum ${hukum.id} has no rules`)
  }
}

if (problems.length > 0) {
  console.error(`rules.json is invalid — ${problems.length} problem(s):\n`)
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  process.exit(1)
}

const byStatus = corpus.rules.reduce((acc: Record<string, number>, rule: { status: string }) => {
  acc[rule.status] = (acc[rule.status] ?? 0) + 1
  return acc
}, {})
const needsReview = corpus.rules.filter((rule: { needsReview?: boolean }) => rule.needsReview)

console.log(
  `rules.json v${corpus.version} (${corpus.riwayah}) is valid\n` +
    `  ${corpus.topics.length} topics, ${corpus.categories.length} categories, ` +
    `${corpus.hukums.length} ahkam, ${corpus.rules.length} rules ` +
    `(${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')})`,
)
if (needsReview.length > 0) {
  console.log(`\n  awaiting reviewer sign-off:`)
  for (const rule of needsReview) {
    console.log(`    ${rule.id} — ${rule.label.ar}`)
  }
}

/**
 * Builds the playground into a single self-contained HTML file.
 *
 *   pnpm playground:build
 *
 * Everything is inlined — the engine, the corpus, the styles — so the result can
 * be opened from disk, committed, or served from anywhere without a build step or
 * a network request. That also means it works offline, which for a tool people
 * reach for while studying is worth more than it sounds.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const result = await build({
  entryPoints: [join(root, 'playground', 'src', 'main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  // Keep Arabic as UTF-8 rather than \u-escaping every character, which roughly
  // triples the size of a page that is mostly Arabic text.
  charset: 'utf8',
  write: false,
  loader: { '.json': 'json' },
  logLevel: 'warning',
  // The playground is not a workspace package — it is one page, built from the
  // sources directly, so there is nothing to install or keep in step.
  alias: {
    '@tajweed/core': join(root, 'packages', 'core', 'src', 'index.ts'),
    '@tajweed/rules': join(root, 'packages', 'rules', 'rules.json'),
  },
})

const script = result.outputFiles[0]?.text
if (!script) {
  throw new Error('esbuild produced no output')
}

const template = readFileSync(join(root, 'playground', 'src', 'index.html'), 'utf8')

// The bundle is inserted as the body of the existing module script rather than
// as a new tag, so the page keeps exactly one script element and no external
// references — a strict Content-Security-Policy will still run it.
const page = template.replace(
  '<script type="module">/* bundle */</script>',
  `<script type="module">\n${script}\n</script>`,
)

if (page === template) {
  throw new Error('Could not find the script placeholder in the playground template')
}

if (page.includes('src=') || page.includes('href="http')) {
  throw new Error('The playground must not reference anything external')
}

const outPath = join(root, 'playground', 'index.html')
writeFileSync(outPath, page, 'utf8')

console.log(`wrote ${outPath}\n  ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB, self-contained`)

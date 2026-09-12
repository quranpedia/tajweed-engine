/**
 * The gate has to be able to fail.
 *
 * `edition:check` exists to catch a mark the normaliser cannot read, and what
 * that looks like from here is rules that stop matching. It used to report
 * twenty-four rules matching nothing and then exit 0 — which is not a gate, it
 * is a log line. This builds that exact situation and asserts the exit code.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'scripts', 'check-edition.ts')

function check(editionPath: string): number {
  try {
    execFileSync('npx', ['tsx', script, editionPath], { cwd: root, stdio: 'pipe' })
    return 0
  } catch (error) {
    return (error as { status?: number }).status ?? 1
  }
}

describe('edition:check', () => {
  it('passes the editions this repository ships', () => {
    expect(check(join(root, 'editions', 'hafs-quran-text.json'))).toBe(0)
    expect(check(join(root, 'editions', 'uthmani-hafs.json'))).toBe(0)
  })

  it('fails an edition whose tanween the normaliser cannot read', () => {
    // Exactly the failure the tanween work in this PR fixed, reintroduced: strip
    // the open tanween and the whole idgham/ikhfa/iqlab/izhar family goes quiet.
    const edition = JSON.parse(readFileSync(join(root, 'editions', 'hafs-quran-text.json'), 'utf8')) as {
      ayahs: Record<string, string>
    }
    for (const reference of Object.keys(edition.ayahs)) {
      edition.ayahs[reference] = edition.ayahs[reference]!.replace(/[\u{08F0}-\u{08F2}]/gu, '')
    }
    const path = join(mkdtempSync(join(tmpdir(), 'edition-')), 'stripped.json')
    writeFileSync(path, JSON.stringify(edition))

    expect(check(path)).toBe(1)
  }, 300_000)
})

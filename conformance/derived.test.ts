/**
 * Every generated file must name the text it was generated from, and that name
 * must still be true.
 *
 * Both `packages/annotations/uthmani-hafs.json` and `conformance/frozen.json`
 * already record `edition.sha256`. Nothing compared it to the edition on disk,
 * so a branch could regenerate one of them, have its base re-imported
 * underneath, and go on shipping offsets measured against a text that is no
 * longer there. That happened during this work — twice — and nothing said so.
 *
 * The failure is invisible in the usual places. The two generated files stay
 * self-consistent with each other, `pnpm test` passes, and the span totals look
 * exactly as plausible as they did before. The only thing that has changed is
 * which text the numbers describe.
 *
 * This is the cheapest gate available for that: the digest is already written
 * down, and reading it back costs nothing.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { editionDigest, type Edition } from '../packages/core/src/edition.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (...parts: string[]) => JSON.parse(readFileSync(join(here, '..', ...parts), 'utf8'))

const annotations = read('packages', 'annotations', 'uthmani-hafs.json') as {
  edition: { id: string; sha256: string; ayahCount: number }
}
const frozen = read('conformance', 'frozen.json') as {
  edition: { id: string; sha256: string; ayahCount: number }
}

describe('the generated files name the text they were generated from', () => {
  it('and the annotations still describe the edition on disk', async () => {
    const edition = read('editions', `${annotations.edition.id}.json`) as Edition
    expect(await editionDigest(edition)).toBe(annotations.edition.sha256)
  })

  it('and the frozen conformance still describes the edition on disk', async () => {
    const edition = read('editions', `${frozen.edition.id}.json`) as Edition
    expect(await editionDigest(edition)).toBe(frozen.edition.sha256)
  })

  it('and the two agree with each other about which text that is', () => {
    // They can each be current against a different edition, which is the shape
    // the annotations/frozen drift took: one regenerated, the other not.
    expect(annotations.edition.id).toBe(frozen.edition.id)
    expect(annotations.edition.sha256).toBe(frozen.edition.sha256)
  })
})

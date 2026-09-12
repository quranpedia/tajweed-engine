/**
 * The alias table exists so that a rename does not strand published data.
 * These tests are about that property, not about any particular name.
 */

import { describe, expect, it } from 'vitest'

import { resolveRiwayah, resolveRuleId, ruleIdSpellings, sameRiwayah } from '../src/aliases.js'
import { unpack } from '../src/annotations.js'
import corpus from '../../rules/rules.json' with { type: 'json' }
import type { Corpus } from '../src/types.js'

const typed = corpus as unknown as Corpus

describe('riwayah names', () => {
  it('resolves every spelling this corpus has used to one name', () => {
    expect(resolveRiwayah('hafs-an-asim')).toBe('hafs_an_asim')
    expect(resolveRiwayah('hafs')).toBe('hafs_an_asim')
    expect(sameRiwayah('hafs-an-asim', 'hafs_an_asim')).toBe(true)
  })

  it('does not claim a different riwayah is the same one', () => {
    expect(sameRiwayah('hafs-an-asim', 'warsh-an-nafi')).toBe(false)
  })

  it('leaves a name it does not know alone rather than guessing', () => {
    expect(resolveRiwayah('shubah-an-asim')).toBe('shubah-an-asim')
  })
})

describe('rule ids', () => {
  it('carries the numeric suffix across the rename', () => {
    expect(resolveRuleId('mutamathilain-idgham-kamil.11')).toBe('idgham_al_mutamathilayn_kamil.11')
  })

  it('resolves a bare hukum id too', () => {
    expect(resolveRuleId('raa-tafkheem')).toBe('tafkhim_al_raa')
  })

  it('offers both spellings, current first', () => {
    expect(ruleIdSpellings('raa-tafkheem.1')).toEqual(['raa-tafkheem.1', 'tafkhim_al_raa.1'])
  })

  it('leaves an id it does not know alone', () => {
    expect(resolveRuleId('not-a-rule.1')).toBe('not-a-rule.1')
  })

  it('covers every hukum in the corpus, so no rule id is left behind', () => {
    const unresolved = typed.hukums.filter((h) => resolveRuleId(h.id) === h.id)
    expect(unresolved).toEqual([])
  })
})

describe('annotations published under an older name', () => {
  it('still unpack against a renamed corpus, instead of throwing', () => {
    // The case that matters: a consumer stored spans keyed on the ids that were
    // published, and the corpus has since been renamed. The spans are still
    // right; only the names moved.
    const rule = typed.rules[0]!
    const renamed = {
      ...typed,
      hukums: typed.hukums.map((h) => ({ ...h, id: resolveRuleId(h.id) })),
      rules: typed.rules.map((r) => ({ ...r, id: resolveRuleId(r.id), hukum: resolveRuleId(r.hukum) })),
    } as Corpus

    const published = {
      corpusVersion: typed.version,
      riwayah: typed.riwayah,
      edition: { id: 'test', sha256: 'x', ayahCount: 1 },
      ruleIds: [rule.id],                       // the OLD id, as published
      spans: { '1:1': [[0, 2, 0] as const] },
    }

    const spans = unpack(published, renamed, '1:1')
    expect(spans).toHaveLength(1)
    expect(spans[0]!.hukumId).toBe(resolveRuleId(rule.hukum))
  })

  it('still throws for an id that is not a rename, so a real error is not swallowed', () => {
    const published = {
      corpusVersion: typed.version,
      riwayah: typed.riwayah,
      edition: { id: 'test', sha256: 'x', ayahCount: 1 },
      ruleIds: ['invented-rule.1'],
      spans: { '1:1': [[0, 2, 0] as const] },
    }

    expect(() => unpack(published, typed, '1:1')).toThrow(/not in corpus/)
  })
})

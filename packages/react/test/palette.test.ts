/**
 * `packages/rules/test/readme.test.ts` guards the corpus README's four counts.
 * Nothing guarded the same counts where they were repeated — and they were
 * repeated, in three places, and all three went stale.
 *
 * PR #20 corrected `packages/rules/README.md` from 57 ahkam to 58 and left
 * `packages/react/README.md` saying 57, `packages/react/src/index.tsx` calling
 * TOPIC_COLORS a "six-colour palette" against seven entries, and
 * `packages/core/src/render.ts` arguing about "fifty-seven colours". The prose
 * has now been rewritten to carry the argument without the numbers, which is
 * what `docs/checks-that-report-success.md` asks for. This test holds the one
 * fact that is not prose: the palette and the corpus must describe the same
 * topics.
 *
 * That is the invariant a hand-written count was standing in for. A topic added
 * to the corpus without a colour renders uncoloured; a colour left behind after
 * a topic is removed is dead weight nobody notices. Either fails here.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { TOPIC_COLORS } from '../../core/src/render.js'
import corpus from '../../rules/rules.json' with { type: 'json' }

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const topicIds = corpus.topics.map((topic) => topic.id).sort()

describe('TOPIC_COLORS against the corpus', () => {
  it('gives every topic in the corpus a colour', () => {
    expect(Object.keys(TOPIC_COLORS).sort()).toEqual(topicIds)
  })

  it('gives each topic a distinct colour', () => {
    const colours = Object.values(TOPIC_COLORS)
    expect(new Set(colours).size).toBe(colours.length)
  })
})

describe('the prose that used to state these counts', () => {
  // Read back as strings, because the defect was a string. Each of these files
  // said a number that the data disagreed with, and nothing failed.
  const files = {
    'packages/react/README.md': readFileSync(join(root, 'packages', 'react', 'README.md'), 'utf8'),
    'packages/react/src/index.tsx': readFileSync(
      join(root, 'packages', 'react', 'src', 'index.tsx'),
      'utf8',
    ),
    'packages/core/src/render.ts': readFileSync(
      join(root, 'packages', 'core', 'src', 'render.ts'),
      'utf8',
    ),
  }

  // The rule: in these three files, a number must not appear near topics, ahkam
  // or colours. Not "before" — the sentence that actually went stale was
  // *"not by hukum, of which there are 57"*, where the number comes last and is
  // followed by a full stop. A guard that only read "57 ahkam" would have let
  // the real defect through, so this looks both ways.
  //
  // "one" and "two" are deliberately absent from the number list. Neither is
  // ever a count of the corpus's topics or ahkam, and "one colour per topic" is
  // the phrasing this change is trying to arrive at rather than one to ban.
  const N =
    '(?:\\d+|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|twenty|thirty|forty|fifty|sixty|(?:twenty|thirty|forty|fifty|sixty)-(?:one|two|three|four|five|six|seven|eight|nine))'
  const NOUN = '(?:topics?|ahkam|aḥkām|hukums?|colours?|colors?)'

  // Both shapes that actually occurred, and no more. A looser rule — any number
  // within n characters of the word "colour" — flags the palette's own hex
  // values and unrelated prose, and a gate that cries wolf gets deleted.
  const SHAPES = [
    // "six-colour palette", "seven topics", "fifty-seven colours"
    new RegExp(`\\b${N}[- ]${NOUN}\\b`, 'i'),
    // "of which there are 57.", "of which there are seven"
    new RegExp(`\\b${NOUN}\\b[^.\\n]{0,60}?\\bthere are\\s+${N}\\b`, 'is'),
  ]

  for (const [name, text] of Object.entries(files)) {
    it(`${name} states no count of topics, ahkam or colours`, () => {
      const hit = SHAPES.map((shape) => shape.exec(text)).find(Boolean)
      expect(
        hit?.[0],
        hit
          ? `${name} writes "${hit[0].replace(/\s+/g, ' ')}" by hand. Derive it, or make the sentence not need it.`
          : undefined,
      ).toBeUndefined()
    })
  }

  it('still mentions the legend, which is what carries the topics to a reader', () => {
    expect(files['packages/react/README.md']).toContain('<TajweedLegend />')
  })
})

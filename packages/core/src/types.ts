import type { Scope } from './compile.js'

export interface Label {
  readonly ar: string
  readonly [language: string]: string
}

export interface Topic {
  readonly id: string
  readonly label: Label
}

export interface Category {
  readonly id: string
  readonly topic: string
  readonly label: Label
  readonly empty?: boolean
}

export interface Hukum {
  readonly id: string
  readonly category: string
  readonly label: Label
  readonly school?: { readonly id: string; readonly scholar: string }
}

export type RuleStatus = 'stable' | 'disabled'

export interface Rule {
  readonly id: string
  readonly hukum: string
  readonly case: string
  readonly scope: Scope
  /** Which text the pattern is written against. Defaults to `normalized`. */
  readonly matchAgainst?: 'normalized' | 'original'
  readonly status: RuleStatus
  readonly gap?: string
  readonly statusReason?: string
  readonly needsReview?: boolean
  readonly corrections?: ReadonlyArray<{ field: string; was: string; reason: string }>
  readonly label: Label
  readonly notes?: Label
  readonly startFrom?: string
}

export interface Corpus {
  readonly version: string
  readonly riwayah: string
  readonly topics: readonly Topic[]
  readonly categories: readonly Category[]
  readonly hukums: readonly Hukum[]
  readonly rules: readonly Rule[]
}

/**
 * One occurrence of one rule in a piece of text.
 *
 * `start` and `end` are half-open CODE-POINT offsets into the exact string that
 * was passed to `analyze` — not into the engine's internal normalised form, and
 * not byte or UTF-16 offsets. For text confined to the Basic Multilingual Plane,
 * which includes all Arabic and all Quranic annotation marks, they coincide with
 * JavaScript string indices; `sliceSpan` handles the general case.
 */
export interface Span {
  readonly start: number
  readonly end: number
  readonly ruleId: string
  readonly hukumId: string
  readonly categoryId: string
  readonly topicId: string
}

export { Tajweed, resolveOverlaps, sliceSpan, type TajweedOptions } from './engine.js'
export { normalize, type Normalized } from './normalize.js'
export { compileRule, compileGroup, parseCase, parseGroup, type Scope, type CompilableRule } from './compile.js'
export { toSourceRange, type Mapped } from './mapped.js'
export { toHtml, toAnsi, TOPIC_COLORS, type RenderOptions } from './render.js'
export {
  editionDigest,
  orderedReferences,
  assertEdition,
  EditionMismatchError,
  type Edition,
} from './edition.js'
export { unpack, type Annotations, type PackedSpan } from './annotations.js'
export type { Corpus, Rule, Hukum, Category, Topic, Span, Label, RuleStatus } from './types.js'

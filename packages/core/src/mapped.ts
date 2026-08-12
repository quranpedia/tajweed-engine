/**
 * A transformed string that remembers where each of its characters came from.
 *
 * Normalising Quranic text for matching is destructive: marks are dropped,
 * sequences are collapsed, and sukoon is inserted where the orthography leaves it
 * implicit. Once a rule matches the normalised form, the match has to be reported
 * against the caller's original string — which no longer has the same length or
 * the same characters.
 *
 * The approach taken here is to record the provenance during the transformation
 * rather than reconstruct it afterwards by searching the original text for
 * something that looks like the match. Searching is both slower and ambiguous:
 * the same normalised fragment can occur several times in one ayah, and picking
 * the wrong occurrence silently highlights the wrong word.
 *
 * Everything here counts in CODE POINTS, never UTF-16 units or bytes, so that
 * offsets mean the same thing in every language that consumes them.
 */

export interface Mapped {
  /** The transformed text, as an array of code points. */
  readonly chars: readonly string[]
  /**
   * `srcStart[i]` is the code-point index in this pass's INPUT at which output
   * character `i` begins.
   *
   * Two invariants make the mapping usable:
   *
   *  - It is non-decreasing. Passes may delete, insert and substitute, but never
   *    reorder — except for the shadda pass, which is documented where it breaks
   *    this and is the last pass to run.
   *  - A character that was INSERTED (has no counterpart in the input, such as an
   *    implied sukoon) takes the index of the character that follows it, making it
   *    zero-width. A match ending at an inserted character therefore reports an
   *    end offset that excludes it, rather than swallowing the preceding letter.
   */
  readonly srcStart: Int32Array
}

export class MappedBuilder {
  private readonly chars: string[] = []

  private readonly srcStart: number[] = []

  /** Append a character that came from the input at `srcIndex`. */
  emit(char: string, srcIndex: number): void {
    this.chars.push(char)
    this.srcStart.push(srcIndex)
  }

  /** Append several characters that all derive from the input at `srcIndex`. */
  emitAll(chars: readonly string[], srcIndex: number): void {
    for (const char of chars) {
      this.emit(char, srcIndex)
    }
  }

  build(): Mapped {
    return { chars: this.chars, srcStart: Int32Array.from(this.srcStart) }
  }
}

/** A normalisation step: consumes code points, produces code points plus a map. */
export type Pass = (input: readonly string[]) => Mapped

/**
 * Runs `passes` in order, composing their maps into a single map back to the
 * original input.
 *
 * Composition is the reason each pass can stay a faithful, readable port of one
 * source transformation instead of being folded into a single hand-optimised
 * scanner. If pass A maps its output into the original and pass B maps its output
 * into A's output, then B's output maps into the original at `a[b[i]]`.
 */
export function runPasses(source: readonly string[], passes: readonly Pass[]): Mapped {
  let chars = source
  let toSource = Int32Array.from({ length: source.length }, (_unused, i) => i)

  for (const pass of passes) {
    const result = pass(chars)
    const composed = new Int32Array(result.srcStart.length)
    for (let i = 0; i < result.srcStart.length; i++) {
      // `srcStart[i]` indexes the pass's input; `toSource` maps that input back
      // to the original. Reading through gives the original index directly.
      composed[i] = toSource[result.srcStart[i]!] ?? source.length
    }
    chars = result.chars
    toSource = composed
  }

  return { chars, srcStart: toSource }
}

/**
 * Translates a half-open range over the transformed text into a half-open range
 * over the original.
 *
 * The end offset is taken from the START of the character after the match, not
 * from the end of the last matched character. That is deliberate: anything the
 * normaliser dropped between the two — a small high seen, a tatweel, a hamza
 * that was folded into the preceding letter — sits in that gap and belongs
 * inside the reported span. Without it, a highlight would split a base letter
 * from a mark that renders on top of it, which in Arabic means the mark visibly
 * changes colour independently of its letter.
 */
export function toSourceRange(
  mapped: Mapped,
  start: number,
  end: number,
  sourceLength: number,
): { start: number; end: number } {
  const from = mapped.srcStart[start] ?? sourceLength
  const to = end < mapped.srcStart.length ? mapped.srcStart[end]! : sourceLength
  return { start: from, end: Math.max(from, to) }
}

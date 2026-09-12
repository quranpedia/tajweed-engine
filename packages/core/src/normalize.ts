/**
 * Normalising Uthmani text into the form CASE patterns are written against.
 *
 * The Uthmani script records how a word is WRITTEN; a tajweed rule describes how
 * it is READ. The two disagree in ways that no single transformation covers:
 * sukoon is left implicit where a letter is assimilated, tanween is drawn with
 * positional marks that differ from the standalone ones, a hamza may be carried
 * by a tatweel, and some letters are written but not pronounced at all.
 *
 * Each disagreement is one pass below, in an order that matters and is called out
 * where it does. Passes are kept separate and readable rather than folded into a
 * single scanner: this is the part of the engine where a subtle mistake changes
 * what the text is understood to say, so it is optimised for being audited.
 *
 * No pass mutates the caller's string. The result is a new string plus a map back
 * to the original — see mapped.ts.
 */

import {
  ALEF,
  ALEF_HAMZA_ABOVE,
  ALEF_MADDA,
  ALEF_MAQSURA,
  ALEF_WASLA,
  BOM,
  DAMMA,
  DAMMATAN,
  FATHA,
  FATHATAN,
  FATHATAN_VERTICAL,
  HAMZA,
  HAMZA_ABOVE,
  HAMZA_BELOW,
  INVERTED_DAMMA,
  KASRA,
  KASRATAN,
  LAM,
  MADDAH_ABOVE,
  OPEN_DAMMATAN,
  OPEN_FATHATAN,
  OPEN_KASRATAN,
  OPTIONAL_MARKS,
  QURANIC_SUKOON,
  SHADDA,
  SMALL_HIGH_MEEM,
  SMALL_HIGH_SEEN,
  SMALL_LOW_MEEM,
  SUBSCRIPT_ALEF,
  SUKOON,
  SUPERSCRIPT_ALEF,
  TASHIL_MARK,
  TATWEEL,
  TEH_MARBUTA,
  WAW,
  YEH,
  ZWSP,
  isDiacritic,
  isImalahMark,
  isStackedMark,
  isTanween,
  isVowelMark,
  toCodePoints,
} from './unicode.js'
import { MappedBuilder, runPasses, type Mapped, type Pass } from './mapped.js'

/** Builds a pass that drops the given characters wherever they appear. */
function dropping(chars: readonly string[]): Pass {
  const dropped = new Set(chars)
  return (input) => {
    const out = new MappedBuilder()
    for (let i = 0; i < input.length; i++) {
      const char = input[i]!
      if (!dropped.has(char)) {
        out.emit(char, i)
      }
    }
    return out.build()
  }
}

/**
 * Builds a pass that rewrites fixed sequences. Longer sequences win, so a rule
 * for `damma + small meem` is not pre-empted by one for `damma` alone.
 */
function substituting(rules: ReadonlyArray<readonly [from: string, to: string]>): Pass {
  // Split into code points once, when the pass is built, rather than once per
  // rule per character position. Every ayah goes through twelve of these.
  const prepared = rules
    .map(([from, to]) => ({ from: toCodePoints(from), to: toCodePoints(to) }))
    .sort((a, b) => b.from.length - a.from.length)

  return (input) => {
    const out = new MappedBuilder()
    let i = 0
    outer: while (i < input.length) {
      for (const { from, to } of prepared) {
        let matched = true
        for (let offset = 0; offset < from.length; offset++) {
          if (input[i + offset] !== from[offset]) {
            matched = false
            break
          }
        }
        if (matched) {
          out.emitAll(to, i)
          i += from.length
          continue outer
        }
      }
      out.emit(input[i]!, i)
      i += 1
    }
    return out.build()
  }
}

/**
 * A hamza written as tatweel + combining hamza above becomes a standalone hamza.
 *
 * The Uthmani text draws what older orthography wrote as ئ/أ/ؤ using a bearer
 * tatweel with the hamza floating over it. Both of those characters are stripped
 * later as decoration, which would delete the consonant entirely — so it has to
 * be recovered first. Any harakat sitting between the two are kept in place.
 */
const recoverBorneHamza: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (input[i] === TATWEEL) {
      let j = i + 1
      while (j < input.length && (isDiacritic(input[j]) || input[j] === SUPERSCRIPT_ALEF)) {
        j += 1
      }
      if (input[j] === HAMZA_ABOVE) {
        out.emit(HAMZA, i)
        for (let k = i + 1; k < j; k++) {
          out.emit(input[k]!, k)
        }
        i = j + 1
        continue
      }
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/**
 * A hamza written below its letter is a hamza, and its seat is not pronounced.
 *
 * The muṣḥaf writes a hamza under the line when the hamza takes a kasra —
 * تِلۡقَآيِٕ, ٱمۡرِيٕٖ, ٱللُّؤۡلُوِٕ — on a yāʾ or wāw that is a seat and nothing more,
 * exactly as ئ and ؤ are elsewhere. Fourteen places in Ḥafṣ.
 *
 * Until now U+0655 was stripped with the decoration, which lost the consonant
 * and left the seat behind. Worse, the seat then had no haraka of its own, so
 * insertImpliedSukoon gave it one: تِلۡقَآيِٕ reached the matchers as a sakin yāʾ
 * followed by a kasra, which is not a possible Arabic word, and any leen or madd
 * rule reading that yāʾ was reading something that is not there.
 *
 * Runs before insertImpliedSukoon, which is what was inventing the sukoon.
 */
const seatHamzaBelow: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    // The seat is whatever letter the hamza is written under; it is replaced by
    // the hamza rather than kept, because it is not sounded.
    if (input[i] === YEH || input[i] === WAW || input[i] === ALEF) {
      // The editions disagree about where the hamza sits in the stack: one
      // writes it straight after the seat and the other after the seat's
      // vowel. Either way every mark in the cluster is the hamza's, because
      // the seat has nothing of its own to carry.
      let end = i + 1
      while (end < input.length && isStackedMark(input[end]!) && input[end] !== HAMZA_BELOW) {
        end += 1
      }
      if (input[end] === HAMZA_BELOW) {
        out.emit(HAMZA, i)
        for (let k = i + 1; k < end; k++) {
          out.emit(input[k]!, k)
        }
        i = end + 1
        continue
      }
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/** The haraka a madd letter must be preceded by: fatha before alef, kasra before yeh, damma before waw. */
function homogeneousVowel(next: string | undefined): string | undefined {
  switch (next) {
    case ALEF:
    case ALEF_MAQSURA:
    case SUPERSCRIPT_ALEF:
      return FATHA
    case YEH:
      return KASRA
    case WAW:
      return DAMMA
    default:
      return undefined
  }
}

/**
 * A seated hamza carrying two vowels is two letters, and is split into them.
 *
 * ئ ؤ أ normally stand for a hamza alone: the seat is a writing convention and
 * is not pronounced. But where the bearer letter is itself sounded — a doubled
 * yāʾ in سَيِّئَاتِ, a plain one in يَئُودُهُۥ — the muṣḥaf has two letters to vowel
 * and only one character to hang them on, so the seat carries both harakāt.
 *
 * The editions differ on how they write it, and only one of them needs this
 * pass: where this repository's first edition wrote the two letters out (yāʾ,
 * then a hamza borne on a tatweel), the KFGQPC muṣḥafs compose them onto the
 * seat. Left alone, the second vowel lands on a letter that is not there, the
 * hamza is never a consonant, and every ruling that turns on it is lost.
 *
 * Which vowel belongs to which is read off the shadda. A hamza is not doubled
 * here, so a shadda is the bearer's, and the vowel written with it is the
 * bearer's too — leaving the other for the hamza. With no shadda the pair is
 * written bearer first. That covers all 40 occurrences in Ḥafṣ, 36 of one shape
 * and 4 of the other, and each was checked against the same word spelled out in
 * the other edition rather than reasoned about.
 *
 * A seat carrying one vowel, or none, is untouched: it is a hamza alone, which
 * is what the other 10,790 of them are.
 *
 * Only ئ is attested: all 40 two-vowel seats in Hafs are ئ, and none is ؤ or أ.
 * Those two branches therefore never run, on either edition. They are written
 * for symmetry and they are UNTESTED against the mushaf — and the أ branch in
 * particular says an alef can be a sounded bearer, which is not true of an alef
 * that is a hamza seat. If either ever fires, it should be reviewed before it is
 * trusted rather than assumed correct because it is here.
 */
const splitSeatedHamza: Pass = (input) => {
  const SEATS: Record<string, string> = {
    '\u{0626}': YEH,
    '\u{0624}': WAW,
    '\u{0623}': ALEF,
  }
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    const bearer = SEATS[input[i]!]
    if (bearer === undefined) {
      out.emit(input[i]!, i)
      i += 1
      continue
    }

    let end = i + 1
    while (end < input.length && isStackedMark(input[end]!)) {
      end += 1
    }
    const marks: number[] = []
    for (let k = i + 1; k < end; k++) {
      marks.push(k)
    }
    const vowels = marks.filter((k) => isVowelMark(input[k]))
    if (vowels.length < 2) {
      out.emit(input[i]!, i)
      i += 1
      continue
    }

    // The shadda names the bearer's vowel; with no shadda the bearer's is first.
    const shadda = marks.find((k) => input[k] === SHADDA)
    const hamzaVowel =
      shadda === undefined
        ? vowels[1]!
        : vowels.reduce((furthest, k) => (Math.abs(k - shadda) > Math.abs(furthest - shadda) ? k : furthest))

    out.emit(bearer, i)
    for (const k of marks) {
      if (k !== hamzaVowel) {
        out.emit(input[k]!, k)
      }
    }
    out.emit(HAMZA, i)
    out.emit(input[hamzaVowel]!, i)
    i = end
  }
  return out.build()
}

/**
 * A hamza written directly on its letter, with no tatweel to bear it, becomes a
 * standalone hamza — and its vowel is moved to the far side of it.
 *
 * Editions of the Uthmani script draw the same hamza two ways. Where this one
 * writes a bearer tatweel with the hamza floating over it, the KFGQPC digital
 * muṣḥafs — and so quran-ws/quran-text — write the hamza straight onto the
 * preceding letter, with nothing between. `recoverBorneHamza` above cannot see
 * that form, and without this pass the hamza is stripped as decoration and the
 * consonant disappears: بِـَٔايَٰتِ normalises with its hamza, بَِٔايَٰتِ without
 * one, and every madd al-badal on it is lost. It is 455 hamzas.
 *
 * The two marks are not written in the same order either. The tatweel form puts
 * the bearer letter's marks before the tatweel and the hamza's vowel after the
 * hamza, so reading it is a matter of following the stream. The un-borne form
 * stacks them: the hamza's own vowel is written FIRST, ahead of the marks that
 * belong to the letter underneath, unless the hamza is sakin — in which case its
 * sukoon stays on the far side, where it already reads correctly.
 *
 * All of it is measured rather than assumed, against the same words spelled out
 * in the edition that writes them around a tatweel. An earlier version of this
 * pass read the FIRST mark as the hamza's, which is right for بَِٔايَٰتِ and wrong
 * for بَِٔيسٍ — the same four code points — and was wrong on 35 of the 455.
 *
 * `pnpm edition:diff` is what measures the whole of it: with this pass and the
 * other encoding gaps closed, 6,213 of 6,236 ayahs normalise to byte-identical
 * strings across the two editions, against 2,357 before any of them.
 */
const seatUnborneHamza: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    const char = input[i]!

    // Only a base letter starts a cluster worth inspecting. A hamza already
    // borne on a tatweel is left for recoverBorneHamza.
    if (isDiacritic(char) || char === SUPERSCRIPT_ALEF || char === TATWEEL || char === HAMZA_ABOVE) {
      out.emit(char, i)
      i += 1
      continue
    }

    let end = i + 1
    while (end < input.length && input[end] !== undefined && isStackedMark(input[end]!)) {
      end += 1
    }
    const hamza = input.indexOf(HAMZA_ABOVE, i + 1)
    if (hamza === -1 || hamza >= end || input[hamza - 1] === TATWEEL) {
      out.emit(char, i)
      i += 1
      continue
    }

    let before: number[] = []
    for (let k = i + 1; k < hamza; k++) {
      before.push(k)
    }
    // Which of the marks before the hamza are the hamza's own, and which belong
    // to the letter underneath. Three cases, and all three are read off the
    // tatweel form of the same words rather than assumed:
    //
    //   a vowel after the hamza is already the hamza's, and already in place —
    //   تَ‍ٔۡ, where the fatha is the taa's and the sukoon is the hamza's;
    //
    //   otherwise a sukoon immediately before the hamza is the letter's, and
    //   everything ahead of it is the hamza's — ٱلَٰۡٔنَ is a sakin laam, then a
    //   hamza with a fatha and a long alef;
    //
    //   otherwise the first mark is the hamza's alone — بَِٔا is a kasra on the
    //   baa and a fatha on the hamza.
    const carriesItsOwnAfter = isDiacritic(input[hamza + 1])

    // Which of the vowels written before the hamza is the hamza's own.
    //
    // The order they are stored in does not say. بَِٔايَٰتِ and بَِٔيسٍ are the
    // same four code points — baa, fatha, kasra, hamza — and are read bi-'aayaat
    // and ba-'iis, the vowels the other way round. Arabic phonology does say: a
    // madd letter is preceded by its own haraka, so the hamza before an alef
    // took a fatha, before a yaa a kasra, and before a waw a damma. The letter
    // after the hamza names the hamza's vowel, and the bearer keeps the rest.
    //
    // Where only one vowel is written, it belongs to the hamza if the bearer
    // cannot hold one — it is already sakin, or carries a maddah or a dagger
    // alef, which make it a madd letter rather than a vowelled consonant.
    let moved: number[] = []
    if (!carriesItsOwnAfter && before.length > 0) {
      const vowels = before.filter((k) => isVowelMark(input[k]))
      const bearerIsLong = before.some(
        (k) => input[k] === MADDAH_ABOVE || input[k] === SUPERSCRIPT_ALEF,
      )
      if (input[before[before.length - 1]!] === SUKOON) {
        // A sukoon written last is the bearer's, and it is all the bearer has:
        // ٱلَٰۡٔنَ is a sakin laam, then a hamza with a fatha and a long alef.
        //
        // A maddah written last does NOT behave this way, though it looks as
        // though it should: يَٰٓـَٔادَمُ gives the bearer its fatha, its dagger
        // alef AND its maddah, and only the first mark to the hamza. Treating a
        // maddah like a sukoon here moved seven ayahs the wrong way.
        moved = before.slice(0, -1)
        before = before.slice(-1)
      } else if (vowels.length >= 2) {
        // A tanween sits only on the last letter of a word, and of the two
        // letters here the hamza is the later — so a tanween among the pair is
        // the hamza's, and nothing else needs consulting. مَلۡجًَٔا is maljaʾan:
        // the jeem takes the fatha, the hamza the fathatan. Read the other way
        // it puts a tanween mid-word and a bare fatha on a final hamza, and
        // manufactures a madd al-badal where the reading is madd al-ʿiwad.
        const tanween = vowels.filter((k) => isTanween(input[k]))
        // The letter after the hamza names the hamza's vowel — but only while it
        // is a BARE madd letter. A yeh carrying a haraka is a consonant and says
        // nothing about what came before it. Every occurrence in Hafs is bare,
        // so this changes nothing here; the rule is wrong without it.
        const wanted = isDiacritic(input[hamza + 2]) ? undefined : homogeneousVowel(input[hamza + 1])
        const chosen =
          tanween.length === 1
            ? tanween[0]!
            : wanted === undefined
              ? vowels[0]!
              : (vowels.find((k) => input[k] === wanted) ?? vowels[0]!)
        moved = [chosen]
        before = before.filter((k) => k !== chosen)
      } else if (bearerIsLong) {
        // One vowel, and a bearer that cannot hold it: the bearer is already a
        // madd letter. The vowel is the hamza's, and so is a dagger alef, which
        // is the hamza's own madd — خَطِيَٰٓٔتِ is a madd yeh, then hamza + fatha
        // + long alef. The maddah written last is the bearer's own and stays.
        //
        // This is only safe here, below the two-vowel case. Applied before it,
        // يَٰٓـَٔادَمُ — which writes the bearer's fatha AND the hamza's — loses
        // its bearer's vowel to the hamza, and seven ayahs move the wrong way.
        moved =
          input[before[before.length - 1]!] === MADDAH_ABOVE ? before.slice(0, -1) : vowels
        before = before.filter((k) => !moved.includes(k))
      }
    }

    out.emit(char, i)
    for (const k of before) {
      out.emit(input[k]!, k)
    }
    out.emit(HAMZA, hamza)
    for (const k of moved) {
      // Mapped onto the hamza's own position, not the source position they were
      // read from, so the reordering cannot produce a span whose end precedes
      // its start.
      out.emit(input[k]!, hamza)
    }
    i = hamza + 1
  }
  return out.build()
}

/**
 * A small high seen at the end of a word marks a saktah — a deliberate pause
 * without breathing. It is replaced with a zero-width space, which no rule can
 * match across, so that a rule such as idghaam does not join the two words the
 * reciter is required to keep apart.
 *
 * The same character inside a word is a variant-spelling marker with no bearing
 * on recitation, and is left to be stripped with the other decoration.
 */
const saktahToBreak: Pass = (input) => {
  const out = new MappedBuilder()
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    const next = input[i + 1]
    const atWordEnd = next === undefined || /\s/u.test(next)
    out.emit(char === SMALL_HIGH_SEEN && atWordEnd ? ZWSP : char, i)
  }
  return out.build()
}

/**
 * The waw in the demonstrative family أُوْلَٰئِكَ, أُوْلِي, أُوْلُوا is written but not
 * pronounced — the same convention as the alef in الصلوٰة and الزكوٰة.
 *
 * Its sukoon is replaced with a fatha so that madd rules, which look for a sakin
 * waw after a damma, do not treat this silent letter as an elongation.
 */
const silenceOrthographicWaw: Pass = (input) => {
  const shape = [ALEF_HAMZA_ABOVE, DAMMA, WAW, SUKOON, LAM]
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (shape.every((char, offset) => input[i + offset] === char)) {
      out.emit(ALEF_HAMZA_ABOVE, i)
      out.emit(DAMMA, i + 1)
      out.emit(WAW, i + 2)
      out.emit(FATHA, i + 3)
      out.emit(LAM, i + 4)
      i += shape.length
      continue
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/** Alef forms that are never sakin and so never take an implied sukoon. */
const NEVER_SAKIN = new Set([ALEF_MADDA, '\u{0625}', ALEF, ALEF_MAQSURA, ALEF_WASLA])

function isConsonant(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }
  const code = char.codePointAt(0)!
  const inRange =
    (code >= 0x0621 && code <= 0x063a) || (code >= 0x0641 && code <= 0x064a) || code === 0x0629
  return inRange && !NEVER_SAKIN.has(char)
}

/**
 * Writes out the sukoon the Uthmani script leaves implicit.
 *
 * Where a letter is assimilated into the next, the mushaf simply omits its
 * sukoon; CASE patterns, being written phonetically, expect it. The inserted
 * character has no counterpart in the source, so it is mapped zero-width onto the
 * position of the following character.
 *
 * Runs before the alef forms are folded together, because a superscript alef is
 * what tells this pass that the letter beneath it is already vowelled.
 */
const insertImpliedSukoon: Pass = (input) => {
  const out = new MappedBuilder()
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    out.emit(char, i)

    if (!isConsonant(char)) {
      continue
    }

    // Already carries a diacritic of its own.
    const next = input[i + 1]
    if (isDiacritic(next) || next === SUPERSCRIPT_ALEF) {
      continue
    }

    // A maddah over a consonant lengthens it; it does not silence it. The
    // disjoined letters are written this way — قٓ is read qāf, with a long alef
    // and no sakin qaf anywhere in it. The maddah is stripped further down the
    // pipeline as decoration, so without this the letter arrives at the
    // matchers looking like a sakin consonant, and قٓ and عٓسٓقٓ were being
    // reported as قلقلة متطرفة.
    //
    // The imāla and tashīl marks say the same thing in a different way: they
    // record how the letter is performed, so the letter is vowelled even though
    // no haraka is written. The reh in Hūd 41 carries the imāla mark and nothing
    // else — its fatha is inclined towards a kasra, not absent — and reading it
    // as bare handed it the rulings of a sakin reh. In this edition only the
    // imāla mark reaches here, since the other two places write a haraka as
    // well, but both are handled: what makes this true is the mark, not the
    // place.
    if (next === MADDAH_ABOVE || isImalahMark(next) || next === TASHIL_MARK) {
      continue
    }

    // A waw after a damma or a yeh after a kasra is the second half of a long
    // vowel, not a sakin consonant.
    //
    // A shadda on the letter before is stepped over rather than read. Editions
    // disagree about the order of the two: the muṣḥaf writes letter + shadda +
    // haraka, quran-ws/quran-text writes letter + haraka + shadda, and both
    // render as the one stacked mark a reader sees. Looking only at the
    // immediately preceding character finds the haraka in the first and the
    // shadda in the second, so on quran-text every long ī and ū in a doubled
    // syllable — ٱلدِّينِ, تُوَلُّواْ, يُزَكِّيهِمْ — collected a sukoon it does not
    // have, and was read as a sakin consonant.
    const previous = input[i - 1] === SHADDA ? input[i - 2] : input[i - 1]
    if (char === WAW && previous === DAMMA) {
      continue
    }
    if (char === YEH && previous === KASRA) {
      continue
    }

    // Two consonants in a row with no vowel between them is not an Arabic
    // word — a syllable cannot begin with two sakins. It is the disjoined
    // letters, where each character is read as its own name: طه is ṭā-hā and
    // طسٓمٓ is ṭā-sīn-mīm, with no sakin ṭāʾ in either. Left alone, the ṭāʾ
    // collected an implied sukoon and was reported as قلقلة. A maddah does not
    // count as a vowel here; it is what marks سٓ and مٓ as letter names.
    const following = input[i + 1]
    if (isConsonant(following)) {
      const afterFollowing = input[i + 2]
      const vowelled =
        isDiacritic(afterFollowing) || afterFollowing === SUPERSCRIPT_ALEF
      if (!vowelled) {
        continue
      }
    }

    out.emit(SUKOON, i + 1)
  }
  return out.build()
}

/**
 * Puts a shadda after the vowel it shares a letter with.
 *
 * The mushaf writes letter + shadda + haraka; CASE patterns are written
 * letter + haraka + shadda. Both characters are mapped onto the position of the
 * first of the pair, so the reordering cannot produce a span whose end precedes
 * its start, and so a match landing on either half reports the whole cluster —
 * which is what renders as a single stacked mark above the letter anyway.
 */
const orderShaddaAfterVowel: Pass = (input) => {
  const out = new MappedBuilder()
  let i = 0
  while (i < input.length) {
    if (input[i] === SHADDA && isVowelMark(input[i + 1])) {
      out.emit(input[i + 1]!, i)
      out.emit(SHADDA, i)
      i += 2
      continue
    }
    out.emit(input[i]!, i)
    i += 1
  }
  return out.build()
}

/**
 * The pipeline. Order is load-bearing; the comments say where and why.
 *
 * Alef wasla (ٱ) is deliberately NOT folded into a plain alef. It is a connective
 * hamza, dropped when reciting continuously, not a long vowel — keeping it
 * distinct is what stops madd rules from firing on it.
 */
const PASSES: readonly Pass[] = [
  dropping([BOM]),

  substituting([[QURANIC_SUKOON, SUKOON]]),

  // Compose a hamza onto the seat it is written on.
  //
  // quran-ws/quran-text publishes the KFGQPC release's own code points, and the
  // release disagrees with itself: 35:43 ٱلسَّيِّئُ is يَ + U+0654 where the other
  // 908 occurrences of ئ are the precomposed character. It is composed in the
  // 2022 package and decomposed in the 2026 one, so it is not something upstream
  // will correct — quran-text has recorded it rather than edit a muṣḥaf. Left
  // alone it cost two spurious spans, because a yāʾ kept as a seat reads as a
  // madd letter before a hamza and is not one.
  //
  // This is the COMPOSITION half of NFC and deliberately not the rest of it.
  // Applying NFC whole also re-sorts the marks on a letter by combining class,
  // which this pipeline does not need — the passes below already read either
  // order — and which costs a great deal: measured over this edition, a full NFC
  // pass moved 12,484 spans across 3,838 ayahs, because a re-sorted cluster can
  // no longer map each character to its own source index. Composing without
  // re-sorting fixes 35:43 and moves nothing else.
  //
  // ا + ٓ is composed further down, where the two readings of آ are separated.
  substituting([
    [YEH + HAMZA_ABOVE, '\u{0626}'],
    [WAW + HAMZA_ABOVE, '\u{0624}'],
    [ALEF + HAMZA_ABOVE, ALEF_HAMZA_ABOVE],
  ]),

  // Before the maddah is stripped as decoration, resolve the two ways the script
  // writes آ.
  //
  // On a plain alef it is the decomposed form of the precomposed character.
  //
  // On a hamza-carrying alef it is a hamza followed by a long a — أٓ in ٱلۡأٓخِرَة
  // is read hamza + alef, which is مد بدل. Writing that out as hamza, fatha,
  // alef is what lets a madd rule see it. Left alone, the maddah is stripped as
  // decoration and the bare hamza then collects an implied sukoon, turning a
  // madd letter into a sakin consonant.
  substituting([
    [ALEF + MADDAH_ABOVE, ALEF_MADDA],
    [ALEF_HAMZA_ABOVE + MADDAH_ABOVE, ALEF_HAMZA_ABOVE + FATHA + ALEF],
  ]),

  // Uthmani draws tanween with positional marks at word end, and editions do not
  // agree on which characters those are. Both families are folded onto the
  // standalone tanween so that a CASE pattern is written once and matches either.
  //
  // The positional marks are what the first edition read here used. The open
  // tanween is what the KFGQPC digital mushafs use, and therefore what
  // quran-ws/quran-text carries; without these three lines every tanween rule
  // silently matches nothing on that text, which is the failure this repository
  // exists to make impossible.
  substituting([
    [INVERTED_DAMMA, FATHATAN],
    [FATHATAN_VERTICAL, DAMMATAN],
    [SUBSCRIPT_ALEF, KASRATAN],
    [OPEN_FATHATAN, FATHATAN],
    [OPEN_DAMMATAN, DAMMATAN],
    [OPEN_KASRATAN, KASRATAN],
  ]),

  // Iqlab is drawn as a haraka with a small meem rather than as tanween.
  //
  // The four longer forms are the same thing with a shadda written between the
  // two, which is where quran-ws/quran-text puts it — غَمَّۢا is meem, fatha,
  // shadda, small meem there and meem, shadda, fatha, small meem here. Matching
  // only the contiguous pair left the small meem to be stripped as decoration
  // and the iqlab with it, on nine ayahs.
  substituting([
    // …and where the hamza, with its maddah, sits between them: هَنِيَٓٔۢا writes
    // fatha, maddah, hamza, small meem, and the tanween is the hamza's.
    [FATHA + MADDAH_ABOVE + HAMZA_ABOVE + SMALL_HIGH_MEEM, FATHATAN + MADDAH_ABOVE + HAMZA_ABOVE],
    [DAMMA + SHADDA + SMALL_HIGH_MEEM, DAMMATAN + SHADDA],
    [FATHA + SHADDA + SMALL_HIGH_MEEM, FATHATAN + SHADDA],
    [KASRA + SHADDA + SMALL_HIGH_MEEM, KASRATAN + SHADDA],
    [KASRA + SHADDA + SMALL_LOW_MEEM, KASRATAN + SHADDA],
    [DAMMA + SMALL_HIGH_MEEM, DAMMATAN],
    [FATHA + SMALL_HIGH_MEEM, FATHATAN],
    [KASRA + SMALL_HIGH_MEEM, KASRATAN],
    [KASRA + SMALL_LOW_MEEM, KASRATAN],
  ]),

  recoverBorneHamza,
  splitSeatedHamza,
  seatHamzaBelow,
  seatUnborneHamza,
  saktahToBreak,
  silenceOrthographicWaw,
  insertImpliedSukoon,

  // After insertImpliedSukoon, which needs the superscript alef intact.
  substituting([
    [ALEF_MADDA, ALEF],
    [SUPERSCRIPT_ALEF, ALEF],
  ]),

  dropping(OPTIONAL_MARKS),
  orderShaddaAfterVowel,
]

export interface Normalized extends Mapped {
  /** The normalised text as a string, for matching against. */
  readonly text: string
  /** Length of the original text in code points. */
  readonly sourceLength: number
}

/**
 * Normalises Quranic text for matching, returning the result together with a map
 * back to the code-point offsets of `ayahText`.
 */
export function normalize(ayahText: string): Normalized {
  const source = toCodePoints(ayahText)
  const mapped = runPasses(source, PASSES)
  return {
    ...mapped,
    text: mapped.chars.join(''),
    sourceLength: source.length,
  }
}

/**
 * Test input for the engine's public API.
 *
 * This is ordinary vocalised Arabic, composed for these tests. It is deliberately
 * NOT a Quranic verse: adab forbids using Quranic text as sample data for
 * something that is not about the Quran, and API-shape tests — does `analyze`
 * return spans in order, do repeated calls agree — are not about the Quran.
 *
 * What the engine actually does to the mushaf is covered by conformance/, which
 * runs against the real text and compares against the engine this one was ported
 * from.
 *
 * The phrase is chosen to exercise several ahkam at once: a sakin noon before a
 * taa (ikhfa haqiqi), a shadda, a damma followed by a sakin waw before a hamza
 * (madd muttasil), and a tanween.
 */
export const BA_TEST_TEXT = 'مَنْ تَكَلَّمَ سُوءًا'

/**
 * Chunking for the app loader's wordmark light wave. Each chunk carries the stagger step
 * the CSS reads as `--app-loader-letter-step`.
 */

/** Past this length a per-letter stagger outruns the breath cycle, so long names wave per word. */
export const MAX_LETTER_WAVE_LENGTH = 24;

/** Caps the stagger so the light still clears the wordmark inside one cycle. */
export const MAX_LETTER_STEP = 14;

export type WordmarkChunk = { key: string; text: string; step: number };
export type WordmarkWord = { key: string; accent: boolean; chunks: WordmarkChunk[] };

export function buildWordmarkWave(parts: { primary: string; accent: string }): WordmarkWord[] {
  const words = [
    { text: parts.primary, accent: false },
    ...(parts.accent ? [{ text: parts.accent, accent: true }] : []),
  ].filter((word) => word.text.length > 0);

  const totalLength = words.reduce((total, word) => total + word.text.length, 0);
  const perLetter = totalLength <= MAX_LETTER_WAVE_LENGTH;

  let step = 0;
  return words.map((word, wordIndex) => {
    // `Array.from` splits by code point, so an emoji or astral glyph stays one chunk.
    const units = perLetter ? Array.from(word.text) : [word.text];
    return {
      key: `word-${wordIndex}`,
      accent: word.accent,
      chunks: units.map((text, unitIndex) => ({
        key: `${wordIndex}-${unitIndex}`,
        text,
        step: Math.min(step++, MAX_LETTER_STEP),
      })),
    };
  });
}

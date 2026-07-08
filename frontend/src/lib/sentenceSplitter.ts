/**
 * Incrementally extracts complete sentences out of a growing text buffer
 * (used to fire one TTS request per sentence as SSE tokens stream in,
 * instead of waiting for the whole answer).
 */

// Common Spanish abbreviations that end in a period but are NOT a sentence
// boundary (e.g. "Dr. Pérez", "Núm. 4", "Av. Colombia").
const ABBREVIATIONS = new Set([
  "dr", "dra", "sr", "sra", "srta", "ing", "lic", "prof", "profa",
  "núm", "num", "art", "av", "avda", "cra", "cll", "no", "vs", "etc",
  "ej", "p", "pág", "pp", "ud", "uds", "esp", "depto", "aprox",
]);

const MIN_SENTENCE_LEN = 12;

function lastWord(s: string): string {
  const m = s.trimEnd().match(/([\p{L}]+)$/u);
  return m ? m[1].toLowerCase() : "";
}

/**
 * @param buffer full text accumulated so far (including already-flushed parts)
 * @param consumed number of chars from the start of `buffer` already emitted as sentences
 * @returns newly completed sentences and the updated `consumed` cursor
 */
export function extractSentences(
  buffer: string,
  consumed: number
): { sentences: string[]; consumed: number } {
  const sentences: string[] = [];
  const pending = buffer.slice(consumed);
  const boundaryRe = /[.!?…]+|\n+/g;
  let match: RegExpExecArray | null;
  let sliceStart = 0;

  while ((match = boundaryRe.exec(pending)) !== null) {
    const boundaryEnd = match.index + match[0].length;
    const isNewline = match[0].includes("\n");
    const candidate = pending.slice(sliceStart, boundaryEnd);

    if (!isNewline) {
      const punct = match[0];
      const beforePunct = pending.slice(0, match.index);

      // Skip decimal numbers like "3.5"
      const charBefore = beforePunct.slice(-1);
      const charAfter = pending.slice(boundaryEnd, boundaryEnd + 1);
      if (punct === "." && /\d/.test(charBefore) && /\d/.test(charAfter)) {
        continue;
      }

      // Skip known abbreviations ("Dr.", "Núm.")
      if (punct === "." && ABBREVIATIONS.has(lastWord(beforePunct))) {
        continue;
      }
    }

    if (candidate.trim().length >= MIN_SENTENCE_LEN) {
      sentences.push(candidate.trim());
      sliceStart = boundaryEnd;
    }
  }

  return { sentences, consumed: consumed + sliceStart };
}

/** Flushes whatever is left in the buffer as a final "sentence" (call on stream end). */
export function flushRemainder(buffer: string, consumed: number): string | null {
  const rest = buffer.slice(consumed).trim();
  return rest.length > 0 ? rest : null;
}

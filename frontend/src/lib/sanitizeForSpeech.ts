/**
 * Strips markdown formatting and other symbols that a TTS engine would
 * otherwise read literally out loud ("asterisco", "numeral", "guion"...).
 * The chat UI keeps rendering the original markdown — this only cleans the
 * copy of the text that gets sent to /audio/tts.
 */
export function sanitizeForSpeech(text: string): string {
  let t = text;

  // Fenced/inline code — speak the content, drop the backticks
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]*)`/g, "$1");

  // Images/links — keep only the visible label
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Bold / italic / strikethrough markers
  t = t.replace(/(\*\*\*|___)(.*?)\1/g, "$2");
  t = t.replace(/(\*\*|__)(.*?)\1/g, "$2");
  t = t.replace(/(?<![\w*])\*(?!\s)(.*?)(?<!\s)\*(?!\w)/g, "$1");
  t = t.replace(/~~(.*?)~~/g, "$1");

  // Headings, blockquotes, horizontal rules
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^>\s?/gm, "");
  t = t.replace(/^\s*([-*_])\s*(\1\s*){2,}$/gm, "");

  // List markers ("- ", "* ", "1. ", "2) ")
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+[.)]\s+/gm, "");

  // Table pipes and stray symbols left over
  t = t.replace(/\|/g, " ");
  t = t.replace(/[#*_~`]/g, "");

  // Collapse whitespace produced by the removals above
  t = t.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  return t;
}

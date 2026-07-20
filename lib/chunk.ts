// Pure text chunker: splits content into paragraph-aware windows of at most
// `maxChars`, so a chunk boundary lands on a blank line where possible
// instead of mid-sentence. No DB/network dependency.

export interface ChunkOptions {
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 1000;

export function chunkText(content: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    flush();

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    // A single paragraph longer than maxChars: hard-split it.
    for (let i = 0; i < paragraph.length; i += maxChars) {
      chunks.push(paragraph.slice(i, i + maxChars).trim());
    }
  }

  flush();
  return chunks.filter(Boolean);
}

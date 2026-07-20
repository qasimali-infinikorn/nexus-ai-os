// Embedding generation for the Knowledge Base's pgvector semantic search.
// Only OpenAI is supported for now (matches EMBEDDING_DIMENSIONS = 1536 in
// lib/db/schema.ts) — adding another provider means adding its dimension
// and a migration to match.

export const EMBEDDING_MODEL = "text-embedding-3-small";
export type EmbeddingProvider = "openai";

// OpenAI's embeddings endpoint accepts an array input, but very large
// documents can produce more chunks than fit in one request comfortably, so
// batch to stay well under its input-array limits.
const BATCH_SIZE = 100;

export async function getEmbeddings(provider: EmbeddingProvider, key: string, texts: string[]): Promise<number[][]> {
  if (provider !== "openai") {
    throw new Error(`Unsupported embedding provider: ${provider}`);
  }
  if (!key) {
    throw new Error("API key for openai is missing.");
  }
  if (texts.length === 0) return [];

  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI embeddings API returned error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const items: { embedding: number[]; index: number }[] = data.data ?? [];
    const batchVectors = items.sort((a, b) => a.index - b.index).map((item) => item.embedding);
    vectors.push(...batchVectors);
  }

  return vectors;
}

export async function readNdjson(response: Response): Promise<any[]> {
  const events: any[] = [];
  const reader = response.body?.getReader();
  if (!reader) return events;

  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) events.push(JSON.parse(line));
      }
    }
  }

  if (buffer.trim()) events.push(JSON.parse(buffer));
  return events;
}

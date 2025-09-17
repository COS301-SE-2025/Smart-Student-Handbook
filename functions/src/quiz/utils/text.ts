// functions/src/quiz/utils/text.ts
export function extractPlainText(input: string | undefined | null): string {
  const s = (input ?? "").toString();
  if (!s) return "";

  // Try to parse JSON-like editors
  try {
    const parsed = JSON.parse(s);
    const out: string[] = [];

    const walk = (node: any) => {
      if (node == null) return;
      if (typeof node === "string") {
        out.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        // Most editors have "text" fields in leaves
        if (typeof node.text === "string") out.push(node.text);
        // Some put raw text in "content"
        if (typeof node.content === "string") out.push(node.content);
        // Traverse children/props generically
        for (const v of Object.values(node)) walk(v);
      }
    };

    walk(parsed);
    return out.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    // Not JSON—strip HTML tags and collapse whitespace
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

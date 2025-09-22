// functions/src/quiz/utils/text.ts

/**
 * Flattens your editor JSON (or HTML/string) into plain text that LLMs can read.
 * - Walks arbitrary JSON trees (id/type/props/content/children/etc.)
 * - Collects "text" and "content" fields
 * - Strips tags, URLs, wiki-artifacts, and collapses whitespace
 */
export function extractPlainText(input: unknown): string {
  const s = (input ?? "").toString();
  if (!s) return "";

  try {
    const parsed = JSON.parse(s);
    const bucket: string[] = [];

    const walk = (node: any) => {
      if (node == null) return;
      if (typeof node === "string") {
        bucket.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        if (typeof node.text === "string") bucket.push(node.text);
        if (typeof node.content === "string") bucket.push(node.content);
        for (const v of Object.values(node)) walk(v);
      }
    };

    walk(parsed);

    return bucket
      .join(" ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bcite_note[-\w]*/gi, " ")
      .replace(/\blink\b/gi, " ")
      .replace(/\[\d+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    // Not JSON — treat as HTML/plain
    return s
      .replace(/<[^>]*>/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bcite_note[-\w]*/gi, " ")
      .replace(/\blink\b/gi, " ")
      .replace(/\[\d+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

/**
 * Post-process a single line for display (question/option/explanation).
 * Removes meta prefixes models sometimes emit, trims aggressively, and bounds length.
 */
export function cleanLine(input: string, maxLen = 180): string {
  let t = (input ?? "").toString().trim();

  // Strip editor artifacts if they slip in
  t = t.replace(/\[\s*{\s*"id"\s*:[\s\S]*$/g, "");
  t = t.replace(/"id"\s*:\s*".*?"/g, "");
  t = t.replace(/"type"\s*:\s*".*?"/g, "");
  t = t.replace(/"props"\s*:\s*{[^}]*}/g, "");
  t = t.replace(/<[^>]+>/g, " ");

  // Strip URLs/citations/wiki/link artifacts
  t = t.replace(/\bhttps?:\/\/\S+/gi, " ");
  t = t.replace(/\bcite_note[-\w]*/gi, " ");
  t = t.replace(/\blink\b/gi, " ");
  t = t.replace(/\[\d+\]/g, " ");

  // Strip those meta “Key principle implied by:” style prefixes
  t = t.replace(
    /^(Key principle implied by|Most defensible statement from|Opposite claim to|Partially true but misleading view of|Tangential trivia about|Ambiguous\/unverifiable note on|Incorrect causal link from|Speculative claim beyond)\s*:\s*/i,
    ""
  );

  t = t.replace(/\s+/g, " ").trim();
  if (t.length > maxLen) t = t.slice(0, maxLen - 3) + "...";
  return t;
}

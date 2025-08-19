type BlockContent = {
  type: string;
  text?: string;
  styles?: Record<string, any>;
};

type Block = {
  id: string;
  type: string;
  props: Record<string, any>;
  content: BlockContent[];
  children: Block[];
};

export function extractNoteTextFromString(jsonString: string): string {
  if (!jsonString) return ""; // return early if empty string

  let blocks: Block[];

  try {
    blocks = JSON.parse(jsonString);
  } catch (error) {
    console.error("Invalid JSON input:", error);
    return "";
  }

  function extract(blocks: Block[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      let line = "";

      for (const item of block.content) {
        if (item.type === "text" && item.text) {
          line += item.text;
        }
      }

      if (line.trim().length > 0) {
        lines.push(line);
      }

      if (block.children && block.children.length > 0) {
        lines.push(extract(block.children));
      }
    }

    return lines.join("\n");
  }

  return extract(blocks);
}

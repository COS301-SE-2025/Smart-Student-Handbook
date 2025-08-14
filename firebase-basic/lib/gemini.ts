import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function summarizeNote(content: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-1.5-pro",
  });

  const prompt = `Summarize the following note:\n\n${content}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function generateFlashcards(note: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `
  Generate concise flashcards from the following notes. Each flashcard should be in this format:
  Q: [question] 
  A: [answer]

NOTES:
${note}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text.trim();
}


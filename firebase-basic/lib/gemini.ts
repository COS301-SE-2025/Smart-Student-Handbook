import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function summarizeNote(content: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-1.5-pro", // ✅ Use full model ID
  });

  const prompt = `Summarize the following note in 3-5 bullet points:\n\n${content}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

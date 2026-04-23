import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge', // Using Edge Runtime for better performance on Vercel
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { model, contents, config: genConfig } = await req.json();
    
    // Use GOOGLE_GENAI_API_KEY (AI Studio) or GEMINI_API_KEY (Vercel/Local)
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: "API key is not configured in the environment variables." 
      }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents,
      config: genConfig
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to call Gemini API" }), { status: 500 });
  }
}

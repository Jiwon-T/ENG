import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini Proxy
  app.post("/api/gemini", async (req, res) => {
    const { model: requestedModel, contents, config } = req.body;
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "API key is not configured in the environment variables." 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const maxRetries = 3;
    let attempt = 0;

    async function tryGenerate(modelName: string): Promise<any> {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config
        });
        return response;
      } catch (error: any) {
        // Check for 503 (Service Unavailable / High Demand) or 429 (Too Many Requests)
        const isRetryable = error.message?.includes("503") || 
                           error.message?.includes("Service Unavailable") || 
                           error.message?.includes("429") || 
                           error.message?.includes("high demand");

        if (isRetryable && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.warn(`Gemini API busy (Attempt ${attempt}). retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return tryGenerate(modelName);
        }

        // If fallback is possible
        if (modelName === "gemini-3-flash-preview" && attempt >= maxRetries) {
           console.warn("Falling back to gemini-3.1-flash-lite-preview due to high demand...");
           attempt = 0; // Reset attempt for fallback
           return tryGenerate("gemini-3.1-flash-lite-preview");
        }

        throw error;
      }
    }

    try {
      const modelToUse = requestedModel || "gemini-3-flash-preview";
      const response = await tryGenerate(modelToUse);
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error after retries:", error);
      
      let status = 500;
      if (error.message?.includes("503")) status = 503;
      if (error.message?.includes("429")) status = 429;
      if (error.message?.includes("401") || error.message?.includes("403")) status = 403;

      res.status(status).json({ 
        error: error.message || "Failed to call Gemini API",
        code: status
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

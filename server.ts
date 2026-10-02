import express from "express";
import cookieParser from "cookie-parser";
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
  app.use(cookieParser());

  // Security Headers for APIs
  app.use("/api", (req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  // ----------------------------------------------------
  // Vercel Serverless Functions Bridge for Local Development Server
  // (개발 환경과 Vercel 운영 환경 간의 코드 불일치(Drift)를 완전히 없애기 위해
  //  동일한 Vercel Functions 핸들러를 직접 바인딩하여 실행)
  // ----------------------------------------------------
  app.post("/api/webhooks/notion-report", async (req, res) => {
    const handler = (await import("./api/webhooks/notion-report.ts")).default;
    await handler(req as any, res as any);
  });

  app.post("/api/webhooks/notion-schedule", async (req, res) => {
    const handler = (await import("./api/webhooks/notion-schedule.ts")).default;
    await handler(req as any, res as any);
  });

  app.all("/api/teacher/report-slug", async (req, res) => {
    const handler = (await import("./api/teacher/report-slug.ts")).default;
    await handler(req as any, res as any);
  });

  app.post("/api/parent/verify-pin", async (req, res) => {
    const handler = (await import("./api/_lib/parent/verify-pin.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/parent/lesson-reports", async (req, res) => {
    const handler = (await import("./api/_lib/parent/lesson-reports.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/parent/schedules", async (req, res) => {
    const handler = (await import("./api/_lib/parent/schedules.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/parent/report-status", async (req, res) => {
    const handler = (await import("./api/_lib/parent/report-status.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/student/lesson-reports", async (req, res) => {
    const handler = (await import("./api/_lib/student/lesson-reports.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/student/schedules", async (req, res) => {
    const handler = (await import("./api/_lib/student/schedules.ts")).default;
    await handler(req as any, res as any);
  });

  app.all("/api/teacher/student-link", async (req, res) => {
    const handler = (await import("./api/teacher/student-link.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/teacher/notion-students", async (req, res) => {
    const handler = (await import("./api/teacher/notion-students.ts")).default;
    await handler(req as any, res as any);
  });

  app.patch("/api/student/assignment-completion", async (req, res) => {
    const handler = (await import("./api/_lib/student/assignment-completion.ts")).default;
    await handler(req as any, res as any);
  });

  app.post("/api/webhooks/notion-academic", async (req, res) => {
    const handler = (await import("./api/webhooks/notion-academic.ts")).default;
    await handler(req as any, res as any);
  });

  app.post("/api/teacher/import-academic", async (req, res) => {
    const handler = (await import("./api/teacher/import-academic.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/student/academic", async (req, res) => {
    const handler = (await import("./api/_lib/student/academic.ts")).default;
    await handler(req as any, res as any);
  });

  app.get("/api/parent/academic", async (req, res) => {
    const handler = (await import("./api/_lib/parent/academic.ts")).default;
    await handler(req as any, res as any);
  });

  // Unmatched API route -> JSON 404 (prevent SPA HTML)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ ok: false, error: "API_ENDPOINT_NOT_FOUND" });
  });

  // ----------------------------------------------------
  // Existing Gemini API Proxy
  // ----------------------------------------------------
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
        const isRetryable = error.message?.includes("503") ||
                            error.message?.includes("Service Unavailable") ||
                            error.message?.includes("429") ||
                            error.message?.includes("high demand");

        if (isRetryable && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return tryGenerate(modelName);
        }

        if (modelName === "gemini-3-flash-preview" && attempt >= maxRetries) {
          attempt = 0;
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

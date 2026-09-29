import express from "express";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { NotionReportWebhookSchema } from "./src/types/lessonReport.js";
import {
  hashToken,
  hashPin,
  generateSecureToken,
  upsertLessonReport,
  getLessonReport,
  getReportsForStudent,
  findStudentByNotionKey,
  saveMagicLinkRecord,
  getMagicLinkRecord,
  updateMagicLinkRecord,
  saveParentSession,
  getParentSession,
  toStudentDTO,
  toParentDTO
} from "./src/lib/serverReportService.js";

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
  // 1. Make 전용 Webhook API: POST /api/webhooks/notion-report
  // ----------------------------------------------------
  app.post("/api/webhooks/notion-report", async (req, res) => {
    try {
      // 1) 인증: x-webhook-secret 검증
      const expectedSecret = process.env.MAKE_NOTION_WEBHOOK_SECRET;
      const clientSecret = req.headers["x-webhook-secret"];

      if (!expectedSecret || !clientSecret || clientSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      }

      // 2) Zod 페이로드 검증
      const parseResult = NotionReportWebhookSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues || [];
        return res.status(400).json({
          ok: false,
          error: "INVALID_PAYLOAD",
          details: issues.map(e => ({ field: e.path.join("."), message: e.message }))
        });
      }

      const payload = parseResult.data;

      // 3) 학생 매핑 검증 ('테스트 (복제고1)' 등)
      const student = await findStudentByNotionKey(payload.studentKey);
      if (!student) {
        return res.status(404).json({
          ok: false,
          error: "STUDENT_NOT_FOUND",
          studentKey: payload.studentKey
        });
      }

      // 4) Firestore Upsert 준비 (점수 미입력 시 0이 아닌 null 유지)
      const now = new Date().toISOString();
      const storedReport = {
        schemaVersion: 1,
        notionPageId: payload.notionPageId,
        studentKey: payload.studentKey,
        studentId: student.studentId,
        lessonDateStart: payload.lessonDateStart,
        lessonDateEnd: payload.lessonDateEnd || null,
        lessonTime: payload.lessonTime || "",
        selfStudyTime: payload.selfStudyTime || "",
        category: payload.category,
        attendance: payload.attendance || "미확인",
        attitude: payload.attitude || "미확인",
        homework: payload.homework || "미확인",
        test: payload.test || "미확인",
        vocabularyScore: typeof payload.vocabularyScore === "number" ? payload.vocabularyScore : null,
        schoolExamScore: typeof payload.schoolExamScore === "number" ? payload.schoolExamScore : null,
        feedback: payload.feedback || "",
        sourceUpdatedAt: payload.updatedAt || now,
        serverReceivedAt: now,
        serverUpdatedAt: now,
      };

      const { ok, isNew } = await upsertLessonReport(storedReport);

      return res.status(200).json({
        ok: true,
        reportId: payload.notionPageId,
        studentId: student.studentId,
        upserted: true,
        isNew
      });
    } catch (err: any) {
      console.error("Webhook processing error:", err.message);
      return res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
    }
  });

  // ----------------------------------------------------
  // 2. 학생용 리포트 API: GET /api/student/lesson-reports
  // 학생 로그인 본인의 점수 DTO만 반환 (출결/태도/피드백/숙제 원천 배제)
  // ----------------------------------------------------
  app.get("/api/student/lesson-reports", async (req, res) => {
    try {
      const studentId = (req.query.studentId as string) || (req.headers["x-student-id"] as string);

      if (!studentId) {
        return res.status(400).json({ ok: false, error: "STUDENT_ID_REQUIRED" });
      }

      const allReports = await getReportsForStudent(studentId);
      // StudentLessonReportDTO 변환 (피드백/출결/태도 원천 배제)
      const studentDTOs = allReports.map(toStudentDTO);

      return res.json({
        ok: true,
        reports: studentDTOs
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ----------------------------------------------------
  // 3. 학부모 매직 링크 검증 & 세션 생성 API
  // ----------------------------------------------------

  // 3-1) 매직 링크 토큰 상태 확인 (PIN 입력 화면용)
  app.get("/api/parent/access/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

      const tokenHash = hashToken(token);
      const record = await getMagicLinkRecord(tokenHash);

      if (!record || !record.active) {
        return res.status(403).json({ ok: false, error: "INVALID_OR_REVOKED_TOKEN" });
      }

      // 잠금 상태 확인 (5회 실패 시 15분 잠금)
      if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
        return res.status(429).json({
          ok: false,
          error: "TEMPORARILY_LOCKED",
          lockedUntil: record.lockedUntil
        });
      }

      return res.json({
        ok: true,
        studentName: record.studentDisplayName,
        requiresPin: true
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // 3-2) 전화번호 뒤 4자리 검증 & 세션 쿠키 발급
  app.post("/api/parent/access/:token/verify", async (req, res) => {
    try {
      const { token } = req.params;
      const { pin } = req.body;

      if (!token || !pin || typeof pin !== "string" || pin.trim().length !== 4) {
        return res.status(400).json({ ok: false, error: "INVALID_PIN_FORMAT" });
      }

      const tokenHash = hashToken(token);
      const record = await getMagicLinkRecord(tokenHash);

      if (!record || !record.active) {
        return res.status(403).json({ ok: false, error: "INVALID_OR_REVOKED_TOKEN" });
      }

      // 잠금 확인
      if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
        return res.status(429).json({ ok: false, error: "TEMPORARILY_LOCKED" });
      }

      // HMAC-SHA256 비교 (보호자 전화번호 뒤 4자리 우선 검증)
      const inputPinHash = hashPin(pin.trim());
      const isParentMatch = inputPinHash === record.parentPhonePinHash;
      const isStudentMatch = record.studentPhonePinHash && inputPinHash === record.studentPhonePinHash;

      if (!isParentMatch && !isStudentMatch) {
        const failedAttempts = (record.failedAttempts || 0) + 1;
        const updates: Partial<any> = { failedAttempts };

        if (failedAttempts >= 5) {
          // 15분 잠금
          updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        await updateMagicLinkRecord(tokenHash, updates);

        return res.status(401).json({
          ok: false,
          error: "INCORRECT_PIN",
          remainingAttempts: Math.max(0, 5 - failedAttempts)
        });
      }

      // 성공 시 실패 횟수 리셋
      await updateMagicLinkRecord(tokenHash, { failedAttempts: 0, lockedUntil: null });

      // 짧은 유효기간(24시간)의 안전한 학부모 세션 생성
      const rawSessionToken = generateSecureToken(32);
      const sessionHash = hashToken(rawSessionToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await saveParentSession({
        sessionHash,
        studentId: record.studentId,
        studentKey: record.studentKey,
        tokenHash,
        createdAt: new Date().toISOString(),
        expiresAt
      });

      // HttpOnly, Secure, SameSite=Lax 쿠키 발급
      res.cookie("parent_session", rawSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/"
      });

      return res.json({
        ok: true,
        redirectUrl: "/report"
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // 3-3) 학부모 전용 전체 리포트 조회: GET /api/parent/lesson-reports
  app.get("/api/parent/lesson-reports", async (req, res) => {
    try {
      const rawSessionToken = req.cookies["parent_session"];
      if (!rawSessionToken) {
        return res.status(401).json({ ok: false, error: "SESSION_REQUIRED" });
      }

      const sessionHash = hashToken(rawSessionToken);
      const session = await getParentSession(sessionHash);

      if (!session) {
        return res.status(401).json({ ok: false, error: "INVALID_OR_EXPIRED_SESSION" });
      }

      const allReports = await getReportsForStudent(session.studentId);
      const parentDTOs = allReports.map(toParentDTO);

      return res.json({
        ok: true,
        student: {
          studentKey: session.studentKey,
        },
        reports: parentDTOs
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ----------------------------------------------------
  // 4. 관리자/선생님 전용 매직 링크 관리 API
  // ----------------------------------------------------
  app.post("/api/teacher/magic-links", async (req, res) => {
    try {
      const { studentKey, parentPhoneLast4, studentPhoneLast4 } = req.body;
      if (!studentKey || !parentPhoneLast4) {
        return res.status(400).json({ ok: false, error: "STUDENT_KEY_AND_PIN_REQUIRED" });
      }

      const student = await findStudentByNotionKey(studentKey);
      if (!student) {
        return res.status(404).json({ ok: false, error: "STUDENT_NOT_FOUND" });
      }

      // Generate CSPRNG token
      const rawToken = generateSecureToken(24);
      const tokenHash = hashToken(rawToken);

      const record = {
        tokenHash,
        studentId: student.studentId,
        studentKey,
        studentDisplayName: student.displayName,
        parentPhonePinHash: hashPin(parentPhoneLast4),
        studentPhonePinHash: studentPhoneLast4 ? hashPin(studentPhoneLast4) : undefined,
        active: true,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        failedAttempts: 0,
        lockedUntil: null
      };

      await saveMagicLinkRecord(record);

      // 원본 토큰은 생성 직후 1회만 전달 (DB에는 해시만 저장)
      return res.json({
        ok: true,
        magicToken: rawToken,
        accessUrl: `/report?token=${rawToken}`,
        studentId: student.studentId
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
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

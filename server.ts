import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase config safely so the server can boot even when the JSON file
// is missing (e.g. fresh deployment before the file is uploaded). Without this
// guard a missing file used to crash the entire server with "Internal Server
// Error" before any request could reach the /api/health endpoint.
function loadFirebaseConfig(): { projectId?: string; storageBucket?: string; firestoreDatabaseId?: string } {
  try {
    const cfgPath = path.join(__dirname, "firebase-applet-config.json");
    if (!fs.existsSync(cfgPath)) {
      console.warn("[INIT] firebase-applet-config.json not found — running without Firebase config.");
      return {};
    }
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e: any) {
    console.error("[INIT] Failed to read firebase-applet-config.json:", e.message);
    return {};
  }
}

const firebaseConfig = loadFirebaseConfig();

// Resolve the owner email (kept configurable so it can be changed without code edits)
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "lotfyshaban2211@gmail.com").toLowerCase();

// ---------------------------------------------------------------------------
// Gemini client (lazy, with primary + backup-key failover)
// ---------------------------------------------------------------------------
const isRealKey = (k: string | undefined) =>
  !!k && k.startsWith("AIzaSy") && k.length > 20 && !k.includes("YOUR_API_KEY");

function loadKeyForSlot(slot: 0 | 1): string | undefined {
  if (slot === 0) {
    const k = process.env.GEMINI_API_KEY;
    if (isRealKey(k)) return k;
    const v = process.env.VITE_GEMINI_API_KEY;
    if (isRealKey(v)) return v;
    return undefined;
  }
  const k2 = process.env.GEMINI_API_KEY_2;
  return isRealKey(k2) ? k2 : undefined;
}

let aiKeySlot: 0 | 1 = 0;
const aiClients: Array<GoogleGenerativeAI | null> = [null, null];

function getAiClient() {
  // If the active slot has no usable key, fall through to the other slot.
  if (!loadKeyForSlot(aiKeySlot) && loadKeyForSlot(aiKeySlot === 0 ? 1 : 0)) {
    aiKeySlot = aiKeySlot === 0 ? 1 : 0;
  }
  if (!aiClients[aiKeySlot]) {
    const apiKey = loadKeyForSlot(aiKeySlot);
    if (!apiKey) {
      console.error("[GEMINI] FATAL: No valid API key detected. Set GEMINI_API_KEY (and optionally GEMINI_API_KEY_2) in Replit secrets.");
      return null;
    }
    aiClients[aiKeySlot] = new GoogleGenerativeAI(apiKey);
  }
  return aiClients[aiKeySlot];
}

/**
 * Detects auth/quota/rate errors that warrant rotating to the backup Gemini
 * key. Returns true when a rotation actually happened so the caller can retry.
 */
function rotateAiKeyOnFailure(err: any): boolean {
  if (aiKeySlot !== 0) return false;            // already on backup
  if (!loadKeyForSlot(1)) return false;         // no backup configured
  const code = err?.status ?? err?.statusCode ?? err?.code;
  const msg = String(err?.message || "");
  const looksLikeKeyIssue =
    code === 401 || code === 403 || code === 429 ||
    /API key|api_key|quota|RESOURCE_EXHAUSTED|PERMISSION_DENIED|invalid/i.test(msg);
  if (!looksLikeKeyIssue) return false;
  console.warn("[GEMINI] Primary key failed — rotating to GEMINI_API_KEY_2.", { code, msg });
  aiKeySlot = 1;
  aiClients[0] = null;
  return true;
}

// ---------------------------------------------------------------------------
// Firebase Admin initialization
// ---------------------------------------------------------------------------
function buildAdminCredential(): admin.credential.Credential | undefined {
  // Prefer an explicit service account JSON via env (single line or base64)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim().length > 0) {
    try {
      let jsonStr = raw.trim();
      if (!jsonStr.startsWith("{")) {
        // Assume base64-encoded JSON
        jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
      }
      const parsed = JSON.parse(jsonStr);
      return admin.credential.cert(parsed);
    } catch (e: any) {
      console.error("[INIT] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
    }
  }
  return undefined;
}

let adminApp: admin.app.App;
const adminConfig = {
  projectId: firebaseConfig.projectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    firebaseConfig.storageBucket ||
    `${firebaseConfig.projectId}.firebasestorage.app`,
};

// Candidate bucket names to try in order when the primary bucket 404s.
// Firebase projects can use either the legacy .appspot.com bucket or the
// newer .firebasestorage.app bucket — we probe both so the server works
// regardless of which one is provisioned.
function buildBucketCandidates(primary: string | undefined, projectId: string | undefined): string[] {
  const candidates: string[] = [];
  if (primary) candidates.push(primary);
  if (projectId) {
    const legacy = `${projectId}.appspot.com`;
    const modern = `${projectId}.firebasestorage.app`;
    if (!candidates.includes(legacy)) candidates.push(legacy);
    if (!candidates.includes(modern)) candidates.push(modern);
  }
  return candidates;
}

let resolvedBucket: string | null = null;

async function getWorkingBucket(): Promise<any> {
  const projectId = adminConfig.projectId;
  const candidates = buildBucketCandidates(adminConfig.storageBucket, projectId || undefined);

  // Return previously discovered working bucket
  if (resolvedBucket) {
    return admin.storage().bucket(resolvedBucket);
  }

  for (const name of candidates) {
    try {
      const b = admin.storage().bucket(name);
      // Quick existence probe: list at most 1 file
      await b.getFiles({ maxResults: 1 });
      resolvedBucket = name;
      return b;
    } catch (e: any) {
      const msg = String(e?.message || "");
      const is404 = msg.includes("does not exist") || msg.includes("404") || msg.includes("notFound");
      console.warn(`[STORAGE] Bucket ${name} not available${is404 ? " (404)" : ""}: ${msg.slice(0, 120)}`);
    }
  }
  // Nothing worked — fall back to first candidate so the real error surfaces
  const fallback = candidates[0] || "unknown";
  console.error(`[STORAGE] All bucket candidates failed. Using ${fallback} (expect upload errors).`);
  return admin.storage().bucket(fallback);
}

try {
  if (admin.apps.length > 0) {
    adminApp = admin.app() as admin.app.App;
  } else {
    const credential = buildAdminCredential();
    if (credential) {
      adminApp = admin.initializeApp({ ...adminConfig, credential });
    } else if (adminConfig.projectId && adminConfig.projectId !== "YOUR_PROJECT_ID") {
      console.warn(
        "[INIT] No FIREBASE_SERVICE_ACCOUNT_KEY found. Admin SDK will run without explicit credentials and most write operations will fail."
      );
      adminApp = admin.initializeApp(adminConfig);
    } else {
      console.warn("[INIT] No valid project ID in config. Using ADC defaults.");
      adminApp = admin.initializeApp();
    }
  }
} catch (e: any) {
  console.error("[INIT] FATAL: Firebase initialization failed:", e.message);
  adminApp = (admin.apps.length ? admin.app() : admin.initializeApp()) as admin.app.App;
}

const auth = adminApp.auth();
let db: admin.firestore.Firestore | undefined;

async function initializeFirestore() {
  if (db) return db;
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  // Try the explicitly-configured non-default DB first. We deliberately do NOT
  // fall back to "(default)" because this Firebase project has no default DB
  // (only named DBs exist), and probing default just wastes ~4s on timeout.
  const candidates = dbId ? [dbId] : ["(default)"];

  for (const id of candidates) {
    try {
      const targetId = id === "(default)" ? undefined : id;
      const pDb = getFirestore(adminApp, targetId);

      await Promise.race([
        pDb.collection("users").limit(1).get(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Probe Timeout")), 4000)
        ),
      ]);

      db = pDb;
      return db;
    } catch (e: any) {
      console.warn(`[INIT] Database ${id || "(default)"} not available: ${e.message}`);
    }
  }

  console.warn("[INIT] All candidates failed. Falling back to default database object.");
  db = getFirestore(adminApp);
  return db;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function startServer() {
  initializeFirestore().catch((err) => {
    console.error("[INIT] Non-critical Firestore init background error:", err);
  });

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ---- Health -------------------------------------------------------------
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      dbConnected: !!db,
      aiClientReady: !!getAiClient(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasFirebaseAdminCreds: !!(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ),
      time: new Date().toISOString(),
    });
  });

  // ---- Admin bootstrap ----------------------------------------------------
  app.post("/api/admin/bootstrap", async (req, res) => {
    const { uid, email } = req.body;
    if ((email || "").toLowerCase() !== OWNER_EMAIL) {
      res.status(403).json({ error: "Only the designated owner can bootstrap." }); return;
    }

    try {
      if (!db) await initializeFirestore();
      const userRef = db!.collection("users").doc(uid);
      const doc = await userRef.get();

      if (!doc.exists) {
        await userRef.set({
          uid,
          email,
          name: "Manager",
          role: "admin",
          createdAt: new Date().toISOString(),
        });
        res.json({ success: true, message: "Admin doc created." }); return;
      }

      if (doc.data()?.role !== "admin") {
        await userRef.update({ role: "admin" });
      }

      res.json({ success: true, message: "Admin doc already exists." });
    } catch (error: any) {
      console.error("[BOOTSTRAP] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---- Create client ------------------------------------------------------
  app.post("/api/admin/create-client", async (req, res) => {
    const { email, password, name, gender, packages, adminUid } = req.body;
    try {
      if (!adminUid) throw new Error("Admin UID is missing in request");

      const adminDoc = await db!.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      const isAuthorized =
        adminData?.role === "admin" ||
        (adminData?.email || "").toLowerCase() === OWNER_EMAIL;

      if (!adminDoc.exists || !isAuthorized) {
        console.error(`[API] Unauthorized: UID ${adminUid} is not an admin. Role: ${adminData?.role}`);
        res.status(403).json({ error: "Unauthorized: Admin privileges required" }); return;
      }

      const userRecord = await auth.createUser({ email, password, displayName: name });

      const userData = {
        uid: userRecord.uid,
        email,
        name,
        gender,
        role: "client",
        packages,
        onboardingComplete: false,
        isActivated: false,
        createdAt: new Date().toISOString(),
      };

      await db!.collection("users").doc(userRecord.uid).set(userData);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating client:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---- Activate client ----------------------------------------------------
  app.post("/api/admin/activate-client", async (req, res) => {
    const { targetUid, adminUid, isActivated } = req.body;
    try {
      const adminDoc = await db!.collection("users").doc(adminUid).get();
      if (!adminDoc.exists || adminDoc.data()?.role !== "admin") {
        console.error(`Admin verification failed for UID: ${adminUid}`);
        res.status(403).json({ error: "Unauthorized: Admin privileges required" }); return;
      }
      await db!.collection("users").doc(targetUid).update({ isActivated });
      res.json({ success: true });
    } catch (error: any) {
      console.error(`Error activating client ${targetUid}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // ---- Delete client ------------------------------------------------------
  app.post("/api/admin/delete-client", async (req, res) => {
    const { targetUid, adminUid } = req.body;
    try {
      if (!adminUid || !targetUid) {
        res.status(400).json({ error: "Missing required UID parameters" }); return;
      }

      let isAdminAuthorized = false;
      try {
        const adminDoc = await db!.collection("users").doc(adminUid).get();
        if (adminDoc.exists) {
          const d = adminDoc.data();
          isAdminAuthorized =
            d?.role === "admin" || (d?.email || "").toLowerCase() === OWNER_EMAIL;
        } else {
          const adminUser = await auth.getUser(adminUid);
          isAdminAuthorized = (adminUser.email || "").toLowerCase() === OWNER_EMAIL;
        }
      } catch (e: any) {
        try {
          const adminUser = await auth.getUser(adminUid);
          isAdminAuthorized = (adminUser.email || "").toLowerCase() === OWNER_EMAIL;
        } catch {
          throw e;
        }
      }

      if (!isAdminAuthorized) {
        res.status(403).json({ error: "Unauthorized: You do not have admin privileges." }); return;
      }

      try {
        await auth.deleteUser(targetUid);
      } catch (err: any) {
        console.warn(`[API] Auth deletion warn:`, err.message);
      }

      try {
        const bucket = await getWorkingBucket();
        await bucket.deleteFiles({ prefix: `users/${targetUid}/` });
      } catch (err: any) {
        console.warn(`[API] Storage cleanup warn:`, err.message);
      }

      for (const col of ["questionnaires", "measurements", "client_uploads"]) {
        try {
          await db!.collection(col).doc(targetUid).delete();
        } catch (err: any) {
          console.error(`[API] ${col} deletion error:`, err.message);
        }
      }

      await db!.collection("users").doc(targetUid).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error("[API] Deletion failed:", error);
      res.status(500).json({
        error: error.message,
        code: error.code,
        note: "If PERMISSION_DENIED, ensure the Firebase Service Account has 'Cloud Datastore User' role.",
      });
    }
  });

  // ---- Storage status check -----------------------------------------------
  app.get("/api/storage-status", async (_req, res) => {
    const projectId = adminConfig.projectId;
    const candidates = buildBucketCandidates(adminConfig.storageBucket, projectId || undefined);
    const results: Record<string, string> = {};

    for (const name of candidates) {
      try {
        const b = admin.storage().bucket(name);
        await b.getFiles({ maxResults: 1 });
        results[name] = "ok";
        if (!resolvedBucket) {
          resolvedBucket = name;
        }
      } catch (e: any) {
        results[name] = e?.message?.slice(0, 100) || "error";
      }
    }

    res.json({
      resolvedBucket,
      candidates,
      results,
      ready: !!resolvedBucket,
    });
  });

  // ---- Gemini proxy -------------------------------------------------------
  app.post("/api/ai-service", async (req, res) => {
    req.setTimeout(180000);
    const { contents, config } = req.body;
    try {
      const ai = getAiClient();
      if (!ai)
        throw new Error("AI Engine not initialized: GEMINI_API_KEY is missing or invalid.");

      let parts: any[] = [];
      if (typeof contents === "string" && contents.trim().length > 0) {
        parts.push({ text: contents });
      } else if (Array.isArray(contents)) {
        contents.forEach((item: any) => {
          if (typeof item === "string") parts.push({ text: item });
          else if (item && item.parts && Array.isArray(item.parts))
            parts = [...parts, ...item.parts];
          else if (item && item.text) parts.push({ text: item.text });
        });
      }

      if (parts.length === 0) parts.push({ text: "Hello. Please provide a response." });

      // Default cap is large; we clamp per-model below since older models
      // (gemini-2.0-flash family) only support up to 8192 output tokens.
      const requestedMaxTokens = config?.maxOutputTokens ?? 32768;
      const generationConfig: any = {
        temperature: config?.temperature ?? 0.7,
        topP: config?.topP ?? 0.95,
        topK: config?.topK ?? 40,
      };
      if (config?.responseMimeType) generationConfig.responseMimeType = config.responseMimeType;

      // Per-model output token caps (from generativelanguage.googleapis.com/v1beta/models)
      const modelOutputCap = (m: string): number => {
        if (m.startsWith("gemini-2.5")) return 65536;
        if (m.startsWith("gemini-2.0")) return 8192;
        return 8192;
      };

      const startTime = Date.now();
      let lastErr: any = null;
      let text = "";

      const modelCandidates = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-lite",
        "gemini-2.5-pro",
        // Lightweight fallbacks — when the heavier models hit 429 (the
        // free tier for gemini-2.5-pro is often capped at 0 RPD), these
        // lite/latest aliases usually still have quota and keep clients
        // unblocked. They're listed last so quality models are tried first.
        "gemini-2.5-flash-lite",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
      ];

      // Outer key-rotation loop: try the model list under the primary key,
      // and on auth/quota errors rotate to GEMINI_API_KEY_2 once and retry.
      let activeAi = ai;
      for (let keyAttempt = 0; keyAttempt < 2 && !text; keyAttempt++) {
      for (const mId of modelCandidates) {
        try {
          const genModel = activeAi.getGenerativeModel({
            model: mId,
            systemInstruction:
              typeof config?.systemInstruction === "string"
                ? config.systemInstruction
                : undefined,
          });

          const safetySettings = [
            { category: "HARM_CATEGORY_HARASSMENT" as any, threshold: "BLOCK_NONE" as any },
            { category: "HARM_CATEGORY_HATE_SPEECH" as any, threshold: "BLOCK_NONE" as any },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any, threshold: "BLOCK_NONE" as any },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any, threshold: "BLOCK_NONE" as any },
          ];

          const cap = modelOutputCap(mId);
          const perModelGenConfig = {
            ...generationConfig,
            maxOutputTokens: Math.min(requestedMaxTokens, cap),
          };

          const result = await genModel.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig: perModelGenConfig,
            safetySettings,
          });

          const response = await result.response;
          if (!response.candidates || response.candidates.length === 0)
            throw new Error("No candidates returned from model");

          const finishReason = response.candidates[0]?.finishReason;
          text = response.text();
          if (text) {
            if (finishReason === "MAX_TOKENS") {
              console.warn(
                `[API AI] Output hit MAX_TOKENS cap (${generationConfig.maxOutputTokens}). Consider raising maxOutputTokens.`
              );
            }
            break;
          }
        } catch (mErr: any) {
          const msg = mErr?.message || String(mErr);
          const is429 = msg.includes("429") || msg.toLowerCase().includes("quota");
          const is404 = msg.includes("404") || msg.toLowerCase().includes("not found");
          console.warn(
            `[API AI] Candidate ${mId} failed${is429 ? " (429/quota → falling back)" : ""}:`,
            msg.slice(0, 240)
          );
          lastErr = mErr;
          // 429 (quota) and 404 (model not available for this key) → try
          // the next candidate immediately, no backoff.
          if (is429 || is404) continue;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
        // If nothing worked AND the failure looks key-related, rotate once.
        if (!text && lastErr && rotateAiKeyOnFailure(lastErr)) {
          const rotated = getAiClient();
          if (rotated) {
            activeAi = rotated;
            continue; // retry the model loop with the backup key
          }
        }
        break;
      }

      if (!text) throw lastErr || new Error("All model candidates failed.");
      res.json({ text: text.trim() });
    } catch (error: any) {
      console.error(`[API AI] FATAL ERROR:`, error);
      let userFriendlyMsg = "AI Engine error. Please try again.";
      if (error.message?.includes("quota") || error.message?.includes("429")) {
        userFriendlyMsg = "تم تجاوز الحد المسموح للاستخدام. يرجى الانتظار دقيقة.";
      }
      res.status(500).json({
        error: userFriendlyMsg,
        details: error.message || String(error),
        tech: "GEMINI_PROXY_ERROR",
      });
    }
  });

  // ---- AI test ------------------------------------------------------------
  app.get("/api/ai-test", async (_req, res) => {
    try {
      const ai = getAiClient();
      if (!ai) { res.status(500).json({ error: "No AI client" }); return; }
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent("Hello, are you there?");
      res.json({ success: true, text: result.response.text() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Storage upload -----------------------------------------------------
  // ---- Voice transcription + summarization (Gemini multimodal) ---------
  // Body: { audioBase64: string (data URL or raw b64), mimeType?: string,
  //         language?: 'ar'|'en', summarize?: boolean }
  // Resp: { transcript: string, summary?: string }
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType, language = "ar", summarize = true } = req.body || {};
      if (!audioBase64) { res.status(400).json({ error: "audioBase64 is required" }); return; }

      const ai = getAiClient();
      if (!ai) { res.status(500).json({ error: "AI client unavailable. Set GEMINI_API_KEY." }); return; }

      // Strip a possible data: URL prefix
      const cleanB64 = String(audioBase64).includes(",")
        ? String(audioBase64).split(",")[1]
        : String(audioBase64);
      const inferredMime = mimeType
        || (audioBase64.startsWith("data:")
            ? audioBase64.substring(5, audioBase64.indexOf(";"))
            : "audio/webm");

      const langLabel = language === "ar" ? "Arabic (Egyptian dialect ok)" : "English";
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

      const transcribeResp = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: cleanB64, mimeType: inferredMime } },
            { text: `Transcribe this voice note verbatim in ${langLabel}. Return ONLY the transcript — no preamble, no quotes.` },
          ],
        }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
      });
      const transcript = transcribeResp.response.text().trim();

      let summary: string | undefined;
      if (summarize && transcript) {
        const summaryResp = await model.generateContent({
          contents: [{
            role: "user",
            parts: [{
              text: `أنت كوتش رياضي. لخّص الرسالة الصوتية التالية للعميل في قائمة قصيرة بالعربي على شكل bullet points يفصل بين:
- نقاط الألم / الشكاوى
- التحديثات الإيجابية
- الأسئلة أو الطلبات
نص الرسالة:
"""
${transcript}
"""
أعد الإجابة فقط بدون مقدمة.`,
            }],
          }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
        });
        summary = summaryResp.response.text().trim();
      }

      res.json({ transcript, summary });
    } catch (err: any) {
      console.error("[API TRANSCRIBE] Error:", err?.message || err);
      res.status(500).json({ error: err?.message || "Transcription failed" });
    }
  });

  app.post("/api/upload", async (req, res) => {
    const { base64, path: storagePath, contentType, allowBase64Fallback } = req.body;
    if (!base64 || !storagePath) {
      res.status(400).json({ error: "Missing data" }); return;
    }

    // ── Primary: try Firebase Storage ────────────────────────────────────────
    try {
      const bucket = await getWorkingBucket();
      const file = bucket.file(storagePath);
      const buffer = Buffer.from(base64.split(",")[1] || base64, "base64");

      await file.save(buffer, {
        metadata: { contentType: contentType || "image/jpeg" },
        public: true,
      });
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      res.json({ url: publicUrl, path: storagePath, stored: "firebase" });
      return;
    } catch (storageErr: any) {
      const msg = String(storageErr?.message || "");
      const isStorageMissing =
        msg.includes("does not exist") ||
        msg.includes("notFound") ||
        msg.includes("404") ||
        msg.includes("bucket");

      if (!isStorageMissing) {
        // A genuine upload error (permissions, network, etc.) — don't fall back.
        console.error("[API UPLOAD] Storage error (non-bucket):", msg);
        res.status(500).json({
          error: "فشل رفع الصورة. يرجى المحاولة مرة أخرى.",
          details: msg,
        });
        return;
      }

      // Reset cache so next request re-probes
      resolvedBucket = null;
      console.warn("[API UPLOAD] Firebase Storage bucket not available — checking fallback.");
    }

    // ── Fallback: return data URL directly so Firestore stores it ────────────
    // Only allowed when the caller explicitly opts in (avatars, small images).
    if (allowBase64Fallback) {
      // Ensure we return a proper data URL
      const dataUrl = base64.startsWith("data:") ? base64 : `data:${contentType || "image/jpeg"};base64,${base64}`;
      const approxKB = Math.round(dataUrl.length * 0.75 / 1024);
      if (approxKB > 400) {
        res.status(413).json({
          error: "الصورة كبيرة جداً للحفظ بدون Firebase Storage. يرجى اختيار صورة أصغر.",
        });
        return;
      }
      res.json({ url: dataUrl, path: storagePath, stored: "inline" });
      return;
    }

    res.status(503).json({
      error: "تخزين الصور غير مفعّل بعد. يرجى تفعيل Firebase Storage من Firebase Console ثم حاول مجدداً.",
      hint: "firebase-storage-not-provisioned",
    });
  });

  // ---- Global error -------------------------------------------------------
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[SERVER ERROR] Unhandled:", err);
    res.status(err.status || 500).json({
      error: "حدث خطأ فني غير متوقع. يرجى المحاولة لاحقاً.",
      details: err.message || String(err),
      tech: "EXPRESS_GLOBAL_CATCH",
    });
  });

  // ── Bind the port FIRST so the workspace port-detection passes quickly,
  // THEN attach Vite middleware (which can spend ~30s on cold start).
  // Requests that arrive before Vite is ready are deferred via a small queue.
  let viteReady = false;
  const pending: Array<{ req: any; res: any; next: any }> = [];
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/")) return next();
    if (viteReady) return next();
    pending.push({ req, res, next });
  });

  app.listen(PORT, "0.0.0.0");

  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        root: __dirname,
        server: {
          middlewareMode: true,
          host: "0.0.0.0",
          allowedHosts: true,
          hmr: { server: undefined },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      viteReady = true;
      while (pending.length) {
        const { next } = pending.shift()!;
        next();
      }
    } catch (e) {
      console.error("[SERVER] Vite startup failed:", e);
      viteReady = true;
      while (pending.length) {
        const { res } = pending.shift()!;
        res.status(503).send("Frontend not ready");
      }
    }
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    viteReady = true;
    while (pending.length) {
      const { next } = pending.shift()!;
      next();
    }
  }
}

startServer().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

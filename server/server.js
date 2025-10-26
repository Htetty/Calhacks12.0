import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { config } from "./config/index.js";

import * as authRoutes from "./routes/auth.js";
import * as toolsRoutes from "./routes/tools.js";
import { chat } from "./routes/chat.js";
import * as ttsRoutes from "./routes/tts.js";
import * as asrRoutes from "./routes/asr.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "development" });
});

app.get("/api/auth/gmail/start", authRoutes.startGmailAuth);
app.get("/api/auth/gcalendar/start", authRoutes.startGoogleCalendarAuth);
app.get("/api/auth/gmeetings/start", authRoutes.startGoogleMeetingsAuth);
app.post("/api/auth/canvas/start", authRoutes.startCanvasAuth);
app.get("/api/auth/gmail/callback", authRoutes.gmailCallback);
app.get("/api/auth/gcalendar/callback", authRoutes.googleCalendarCallback);
app.get("/api/auth/gmeetings/callback", authRoutes.googleMeetingsCallback);
app.get("/api/auth/gmeet/callback", authRoutes.googleMeetingsCallback);
app.get("/api/auth/canvas/callback", authRoutes.canvasCallback);
app.get("/api/auth/status", authRoutes.checkAuthStatus);
app.post("/api/auth/gmail/unlink", authRoutes.unlinkGmail);

app.get("/api/tools/count", toolsRoutes.getToolsCount);
app.get("/api/tools/search", toolsRoutes.searchTools);
app.get("/api/tools/canvas/search", toolsRoutes.searchCanvasTools);

app.post("/api/tts", ttsRoutes.generateTTS);

app.post("/api/asr", asrRoutes.upload.single("audio"), asrRoutes.transcribe);
app.post(
  "/api/asr/detailed",
  asrRoutes.upload.single("audio"),
  asrRoutes.transcribeDetailed
);

app.post("/api/chat", async (req, res) => {
  try {
    await chat(req, res);
  } catch (error) {
    res.status(500).json({ ok: false, error: "Chat function failed" });
  }
});

app.use("/api", (req, res) => {
  res
    .status(404)
    .json({ ok: false, error: "Not found", path: req.originalUrl });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
}

app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.sendFile(path.resolve(__dirname, "../client/index.html"));
  } else {
    res.redirect("http://localhost:5174");
  }
});

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});

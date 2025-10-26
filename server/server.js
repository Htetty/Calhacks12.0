import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// Import configuration and services
import { config } from "./config/index.js";

// Import route handlers
import * as authRoutes from "./routes/auth.js";
import * as toolsRoutes from "./routes/tools.js";
import { chat } from "./routes/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// Only serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
}

// Auth routes
app.get("/api/auth/gmail/start", authRoutes.startGmailAuth);
app.get("/api/auth/gcalendar/start", authRoutes.startGoogleCalendarAuth);
app.get("/api/auth/zoom/start", authRoutes.startZoomAuth);
app.post("/api/auth/canvas/start", authRoutes.startCanvasAuth);
app.get("/api/auth/gmail/callback", authRoutes.gmailCallback);
app.get("/api/auth/gcalendar/callback", authRoutes.googleCalendarCallback);
app.get("/api/auth/zoom/callback", authRoutes.zoomCallback);
app.get("/api/auth/canvas/callback", authRoutes.canvasCallback);
app.get("/api/auth/status", authRoutes.checkAuthStatus);
app.post("/api/auth/gmail/unlink", authRoutes.unlinkGmail);

// Tools routes
app.get("/api/tools/count", toolsRoutes.getToolsCount);
app.get("/api/tools/search", toolsRoutes.searchTools);
app.get("/api/tools/canvas/search", toolsRoutes.searchCanvasTools);

// Chat route - handles everything through AI
app.post("/api/chat", async (req, res) => {
  console.log("🔥🔥🔥 API CHAT ROUTE HIT! 🔥🔥🔥");
  try {
    await chat(req, res);
  } catch (error) {
    console.error("❌ Chat function error:", error);
    res.status(500).json({ ok: false, error: "Chat function failed" });
  }
});

// 404 handler for API routes
app.use("/api", (req, res) => {
  res
    .status(404)
    .json({ ok: false, error: "Not found", path: req.originalUrl });
});

// Serve React app
app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
  } else {
    // In development, redirect to Vite dev server
    res.redirect("http://localhost:5174");
  }
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});

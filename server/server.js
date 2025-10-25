import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// Import configuration and services
import { config } from "./config/index.js";

// Import route handlers
import * as authRoutes from "./routes/auth.js";
import * as toolsRoutes from "./routes/tools.js";
import * as canvasRoutes from "./routes/canvas.js";
import { chat } from "./routes/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/dist")));

// Auth routes
app.get("/api/auth/gmail/start", authRoutes.startGmailAuth);
app.post("/api/auth/canvas/start", authRoutes.startCanvasAuth);
app.get("/api/auth/gmail/callback", authRoutes.gmailCallback);
app.get("/api/auth/canvas/callback", authRoutes.canvasCallback);
app.get("/api/auth/status", authRoutes.checkAuthStatus);
app.post("/api/auth/gmail/unlink", authRoutes.unlinkGmail);

// Tools routes
app.get("/api/tools/count", toolsRoutes.getToolsCount);
app.get("/api/tools/search", toolsRoutes.searchTools);
app.get("/api/tools/canvas/search", toolsRoutes.searchCanvasTools);

// Canvas routes
app.post("/api/assignments/:courseId", canvasRoutes.getAssignments);
app.get("/api/discussions", canvasRoutes.getDiscussions);

// Chat route
app.post("/api/chat", chat);

// 404 handler for API routes
app.use("/api", (req, res) => {
  res
    .status(404)
    .json({ ok: false, error: "Not found", path: req.originalUrl });
});

// Serve React app
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});

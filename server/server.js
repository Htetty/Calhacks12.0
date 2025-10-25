import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "./config/dotenv.js";
import { createConnectionRequest, sendWelcomeEmail } from "./lib/composio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/public")));

app.post("/api/composio/link", async (req, res) => {
  const { externalUserId } = req.body || {};

  try {
    const connectionRequest = await createConnectionRequest(externalUserId);
    res.json({ redirectUrl: connectionRequest.redirectUrl });
  } catch (error) {
    console.error("Failed to start Composio link flow", error);
    res.status(500).json({ message: "Unable to start Composio link flow" });
  }
});

app.post("/api/composio/send-welcome", async (req, res) => {
  const { externalUserId } = req.body || {};

  try {
    await sendWelcomeEmail(externalUserId);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to send welcome email", error);
    res.status(500).json({ message: "Unable to send welcome email" });
  }
});

app.get("/", (req, res) => {
  res.status(200).sendFile(path.resolve(__dirname, "../client"));
});

app.listen(PORT, () => {
  console.log(`Server is running http://localhost:${PORT}`);
});

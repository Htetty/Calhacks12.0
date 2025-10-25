import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  PORT: process.env.PORT ?? 3000,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  COMPOSIO_EXTERNAL_USER_ID: process.env.COMPOSIO_EXTERNAL_USER_ID,
  GMAIL_AUTH_CONFIG_ID: process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID,
  GMAIL_LINK_CALLBACK_URL: process.env.COMPOSIO_LINK_CALLBACK_URL,
  CANVAS_API_KEY: process.env.CANVAS_API_KEY,
  CANVAS_BASE_URL: process.env.CANVAS_BASE_URL,
  CANVAS_AUTH_CONFIG_ID: process.env.COMPOSIO_CANVAS_AUTH_CONFIG_ID,
};

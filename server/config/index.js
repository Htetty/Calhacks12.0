import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: process.env.PORT || "3000",

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  COMPOSIO_EXTERNAL_USER_ID: process.env.COMPOSIO_EXTERNAL_USER_ID,

  GOOGLEMEETINGS_AUTH_CONFIG_ID:
    process.env.COMPOSIO_GOOGLEMEETINGS_AUTH_CONFIG_ID,
  GOOGLEMEETINGS_LINK_CALLBACK_URL:
    process.env.COMPOSIO_LINK_CALLBACK_URL_GOOGLEMEETINGS,

  GMAIL_AUTH_CONFIG_ID: process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID,
  GCALENDAR_AUTH_CONFIG_ID: process.env.COMPOSIO_GCALENDAR_AUTH_CONFIG_ID,
  GMAIL_LINK_CALLBACK_URL_GMAIL: process.env.COMPOSIO_LINK_CALLBACK_URL_GMAIL,
  GCALENDAR_LINK_CALLBACK_URL: process.env.COMPOSIO_LINK_CALLBACK_URL_GCAL,

  CANVAS_AUTH_CONFIG_ID: process.env.COMPOSIO_CANVAS_AUTH_CONFIG_ID,
  CANVAS_BASE_URL: process.env.CANVAS_BASE_URL,
  CANVAS_API_KEY: process.env.CANVAS_API_KEY,

  FISH_API_KEY: process.env.VITE_FISHAI_SECRET_KEY,
  FISH_VOICE_MODEL_ID: process.env.FISH_VOICE_MODEL_ID,
};

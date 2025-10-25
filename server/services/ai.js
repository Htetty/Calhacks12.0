import { Composio, AuthScheme } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/index.js";

export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export const composio = new Composio({
  apiKey: config.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
  toolkitVersions: {
    GMAIL: "20251024_00",
    CANVAS: "20251023_01",
  },
});

export const DEFAULT_EXTERNAL_USER_ID = config.COMPOSIO_EXTERNAL_USER_ID;

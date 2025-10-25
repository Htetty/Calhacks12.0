import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import "../config/dotenv.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
  toolkitVersions: {
    gmail: "20251024_00",
  },
});

const DEFAULT_EXTERNAL_USER_ID =
  process.env.COMPOSIO_EXTERNAL_USER_ID ||
  "pg-test-1434803e-a3dd-4458-b954-2c0c312cad87";

const COMPOSIO_APP_CONNECTION_ID =
  process.env.COMPOSIO_APP_CONNECTION_ID || "ac_6OceWwd6HFWf";

const COMPOSIO_LINK_CALLBACK_URL =
  process.env.COMPOSIO_LINK_CALLBACK_URL || "http://localhost:5173/connected";

export async function createConnectionRequest(
  externalUserId = DEFAULT_EXTERNAL_USER_ID
) {
  return composio.connectedAccounts.link(
    externalUserId,
    COMPOSIO_APP_CONNECTION_ID,
    {
      callbackUrl: COMPOSIO_LINK_CALLBACK_URL,
    }
  );
}

export async function sendWelcomeEmail(
  externalUserId = DEFAULT_EXTERNAL_USER_ID
) {
  const tools = await composio.tools.get(externalUserId, {
    tools: ["GMAIL_SEND_EMAIL"],
  });

  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
      {
        role: "user",
        content: `Send an email to htetswork@gmail.com with the subject 'Hello from composio 👋🏻' and the body 'Congratulations on sending your first email using AI Agents and Composio!'`,
      },
    ],
    tools,
    max_tokens: 1000,
  });

  await composio.provider.handleToolCalls(externalUserId, msg);
}

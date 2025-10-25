import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

// env: ANTHROPIC_API_KEY
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

// Id of the user in your system
const externalUserId = "pg-test-1434803e-a3dd-4458-b954-2c0c312cad87";

async function main() {
  try {
    const connectionRequest = await composio.connectedAccounts.link(
      externalUserId,
      "ac_6OceWwd6HFWf"
    );

    // redirect the user to the OAuth flow
    const redirectUrl = connectionRequest.redirectUrl;
    console.log(
      `Please authorize the app by visiting this URL: ${redirectUrl}`
    );

    // wait for connection to be established
    const connectedAccount = await connectionRequest.waitForConnection();
    console.log(
      `Connection established successfully! Connected account id: ${connectedAccount.id}`
    );

    // Fetch tools for your user and execute
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
      tools: tools,
      max_tokens: 1000,
    });

    const res = await composio.provider.handleToolCalls(externalUserId, msg);

    console.log("Email sent successfully!");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Run the main function
main();

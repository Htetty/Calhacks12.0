// routes/chat.js (or controllers/chat.js)

import {
  anthropic,
  composio,
  DEFAULT_EXTERNAL_USER_ID,
} from "../services/ai.js";

/**
 * Utility: check if an Anthropic message content array includes any tool_use blocks
 */
function hasToolUse(contentBlocks) {
  return (
    Array.isArray(contentBlocks) &&
    contentBlocks.some((b) => b.type === "tool_use")
  );
}

/**
 * Utility: check if a text response is trivial (just "OK", "Sure", etc.)
 */
function isTrivial(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    t.length <= 12 && /^(ok(ay)?|sure|got it|alright|k|yes|yep)[.!]*$/.test(t)
  );
}

/**
 * Utility: safe normalize toolkit slug from Composio connection objects
 */
function normalizeSlug(conn) {
  return String(
    conn?.toolkit?.slug || conn?.toolkit_slug || conn?.toolkit || ""
  ).toLowerCase();
}

/**
 * Utility: active connection predicate
 */
function isActive(conn) {
  return String(conn?.status || "").toUpperCase() === "ACTIVE";
}

/**
 * Utility: does a connection belong to the external user
 */
function matchesUser(conn, externalUserId) {
  const id =
    conn?.external_user_id ||
    conn?.externalUserId ||
    conn?.external_userID ||
    conn?.externalUserID;
  return id === externalUserId;
}

// Simple chat function - let Claude + Composio handle the complexity
export const chat = async (req, res) => {
  console.log("🔥🔥🔥 API CHAT ROUTE HIT! 🔥🔥🔥");
  console.log("🚀 CHAT FUNCTION CALLED!");
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  try {
    const { userMessage, conversationHistory = [], userId } = req.body;
    const externalUserId = userId || DEFAULT_EXTERNAL_USER_ID;

    console.log("═══════════════════════════════════════");
    console.log("📝 User message:", userMessage);
    console.log("📊 Conversation history length:", conversationHistory.length);
    console.log("🆔 Frontend user ID:", userId);
    console.log("👤 External user ID:", externalUserId);
    console.log("═══════════════════════════════════════");

    // Env checks
    console.log("🔐 Environment check:");
    console.log(
      "  - COMPOSIO_API_KEY:",
      process.env.COMPOSIO_API_KEY ? "✓ Set" : "✗ Missing"
    );
    console.log(
      "  - ANTHROPIC_API_KEY:",
      process.env.ANTHROPIC_API_KEY ? "✓ Set" : "✗ Missing"
    );

    if (!process.env.COMPOSIO_API_KEY) {
      console.error("❌ COMPOSIO_API_KEY missing");
      return res.status(500).json({
        ok: false,
        error:
          "Composio API key not configured. Please set COMPOSIO_API_KEY in your .env file.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("❌ ANTHROPIC_API_KEY missing");
      return res.status(500).json({
        ok: false,
        error:
          "Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your .env file.",
      });
    }

    // Basic validation
    if (!userMessage || typeof userMessage !== "string") {
      console.error("❌ Invalid user message:", userMessage);
      return res.status(400).json({ ok: false, error: "Invalid user message" });
    }

    console.log("✅ Validation passed");

    // Determine which services are connected for this user
    console.log("🔍 Fetching connected accounts...");
    let connectionItems = [];
    try {
      const allConnections = await composio.connectedAccounts.list();
      connectionItems = Array.isArray(allConnections?.items)
        ? allConnections.items
        : [];
      console.log(`📋 Found ${connectionItems.length} total connections`);
    } catch (connectionError) {
      if (
        connectionError?.message &&
        connectionError.message.includes("Connected account not found")
      ) {
        console.warn(
          "⚠️ No connected accounts found. Proceeding without tools."
        );
      } else {
        console.error(
          "❌ Error fetching connections:",
          connectionError.message
        );
        throw connectionError;
      }
    }

    let userConnections = connectionItems.filter(
      (conn) => matchesUser(conn, externalUserId) && isActive(conn)
    );

    console.log(`🔐 User-specific connections: ${userConnections.length}`);

    // Fallback: any active connections if external_user_id was not set during auth
    if (userConnections.length === 0) {
      console.log(
        "⚠️ No user-specific connections; falling back to any ACTIVE connections."
      );
      userConnections = connectionItems.filter(isActive);
      console.log(`📌 Fallback connections: ${userConnections.length}`);
    }

    const hasGmail = userConnections.some((c) => normalizeSlug(c) === "gmail");
    const hasGoogleCalendar = userConnections.some((c) => {
      const s = normalizeSlug(c);
      return s === "googlecalendar" || s === "gcal";
    });
    const hasCanvas = userConnections.some(
      (c) => normalizeSlug(c) === "canvas"
    );
    const hasZoom = userConnections.some((c) => normalizeSlug(c) === "zoom");

    console.log("🔌 User connection status:", {
      userId: externalUserId,
      gmail: hasGmail,
      googlecalendar: hasGoogleCalendar,
      canvas: hasCanvas,
      zoom: hasZoom,
      totalConnections: userConnections.length,
    });

    // Load tools only for connected services
    const tools = [];

    console.log("🛠️  Starting tool loading process...");

    if (hasGmail) {
      console.log("🔄 Loading Gmail tools...");
      try {
        const gmailTools = await composio.tools.get(externalUserId, {
          tools: [
            "GMAIL_FETCH_EMAILS",
            "GMAIL_SEND_EMAIL",
            "GMAIL_GET_PROFILE",
          ],
        });
        console.log("✅ Gmail tools loaded:", gmailTools.length);
        tools.push(...gmailTools);
      } catch (err) {
        console.error("❌ Failed to load Gmail tools:", err.message);
      }
    } else {
      console.log("⏭️  Skipping Gmail tools (not connected)");
    }

    if (hasGoogleCalendar) {
      console.log("🔄 Loading Google Calendar tools...");
      try {
        const calendarTools = await composio.tools.get(externalUserId, {
          tools: ["GOOGLECALENDAR_LIST_EVENTS", "GOOGLECALENDAR_FIND_EVENT"],
        });
        console.log("✅ Google Calendar tools loaded:", calendarTools.length);
        tools.push(...calendarTools);
      } catch (err) {
        console.error("❌ Failed to load Calendar tools:", err.message);
      }
    } else {
      console.log("⏭️  Skipping Calendar tools (not connected)");
    }

    if (hasCanvas) {
      console.log("🔄 Loading Canvas tools...");
      try {
        const canvasTools = await composio.tools.get(externalUserId, {
          tools: [
            "CANVAS_LIST_COURSES",
            "CANVAS_GET_ALL_ASSIGNMENTS",
            "CANVAS_GET_ASSIGNMENT",
          ],
        });
        console.log("✅ Canvas tools loaded:", canvasTools.length);
        tools.push(...canvasTools);
      } catch (canvasError) {
        console.error(
          "⚠️ Canvas tools failed with user. Trying DEFAULT_EXTERNAL_USER_ID:",
          canvasError?.message
        );
        try {
          const canvasTools = await composio.tools.get(
            DEFAULT_EXTERNAL_USER_ID,
            {
              tools: [
                "CANVAS_LIST_COURSES",
                "CANVAS_GET_ALL_ASSIGNMENTS",
                "CANVAS_GET_ASSIGNMENT",
              ],
              toolkits: ["CANVAS"],
            }
          );
          console.log(
            "✅ Canvas tools loaded with default user:",
            canvasTools.length
          );
          tools.push(...canvasTools);
        } catch (retryError) {
          console.error(
            "❌ Canvas tools failed with default user:",
            retryError?.message
          );
        }
      }
    } else {
      console.log("⏭️  Skipping Canvas tools (not connected)");
    }

    console.log("═══════════════════════════════════════");
    console.log(`🔧 TOTAL TOOLS LOADED: ${tools.length}`);
    console.log(
      "🔧 Tool names:",
      tools.map((t) => t.name)
    );
    console.log("═══════════════════════════════════════");

    console.log("🔗 ALL CONNECTED ACCOUNTS:");
    console.log(
      JSON.stringify(
        connectionItems.map((c) => ({
          toolkit: c.toolkit?.slug,
          status: c.status,
          external_user_id: c.external_user_id,
        })),
        null,
        2
      )
    );
    console.log("═══════════════════════════════════════");

    const connectionStatus = {
      gmail: hasGmail,
      googlecalendar: hasGoogleCalendar,
      canvas: hasCanvas,
      zoom: hasZoom,
    };

    // Generate current date string like "October 25, 2025"
    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Human-like, friendly system prompt that still enforces correctness and formatting
    const systemPrompt = `
You are a warm, intelligent personal assistant who speaks like a real human.
You help students manage time, tasks, and communication using real data from Gmail, Google Calendar, Canvas, and Zoom via tools.

VOICE & STYLE (strict)
- Answer in short, natural paragraphs with complete sentences.
- Do not use bullets, numbered lists, tables, code blocks, or label-style formatting.
- Do not use symbols like "•", "|" or colons-as-labels. Do not use em dashes.
- Do not mention tools, services, connections, accounts, or permissions.
- Begin with the answer itself. Never reply with only "OK" (VERY IMPORTANT), "Sure", "Got it", or similar acknowledgments.

TOOL USAGE CONTRACT (strict)
- If the user asks about any date/day/time/schedule/events, you MUST call the calendar tool first and then answer with the results in natural sentences.
  - Interpret dates in the America/Los_Angeles time zone.
  - If a specific calendar date is given (e.g., "October 29"), check that 24-hour local window (00:00–24:00).
  - If the date is ambiguous (e.g., "next Friday"), use the nearest future date in America/Los_Angeles.
- If the user asks to email/draft/send, you MUST call the Gmail tool first and then present the email in natural sentences (include subject and a concise body summary in prose).
- If the user asks about assignments/courses, you MUST call the Canvas tool first and only include assignments due today or later.
- Do not guess. Only describe information returned by the tools.

OUTPUT SHAPE (strict)
- One or two compact paragraphs maximum.
- Integrate details naturally in sentences (title, date, time range, location woven into prose).
- If nothing relevant is found, say so plainly in one sentence (e.g., "I didn't find anything scheduled for that day.").
- Do not suggest connecting accounts, pressing buttons, or changing settings.
- Do not show raw data, JSON, IDs, or technical descriptions. No meta-process narration.

ERROR/EMPTY RESULTS
- If a tool returns no results or fails, respond naturally without mentioning tools or connections. Provide the best direct answer you can from available results.
- Do not speculate about why something is missing.

CONTENT PATTERNS (guidance only — never copy literally)
- "You have {EventTitle} on {Date} from {StartTime} to {EndTime} in {Location}."
- "You have a couple of things that day. In the morning, {EventA} at {TimeA} in {PlaceA}. Later, {EventB} at {TimeB}."
- "I didn't find anything scheduled for that day."

COMPLETENESS & TONE
- Always produce a complete, helpful answer in your first message after a user request.
- Keep answers concise, friendly, and confident.
- Avoid filler like "fetching" or "retrieving".

ENVIRONMENT HINTS
- TODAY: ${currentDate}
- TIME ZONE: America/Los_Angeles
`.trim();

    // Build the first request
    console.log("🎯 Building first Claude request...");
    console.log(`  - System prompt length: ${systemPrompt.length} chars`);
    console.log(
      `  - Conversation history messages: ${conversationHistory.length}`
    );
    console.log(`  - Tools available: ${tools.length}`);

    const request = {
      model: "claude-3-5-sonnet-20241022",
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      ...(tools.length > 0 ? { tools } : {}),
    };

    // First model response
    console.log("📡 Calling Claude API...");
    let firstResponse = await anthropic.messages.create(request);
    console.log("🤖 Claude first response received");
    console.log(`  - Response type: ${firstResponse.content?.[0]?.type}`);
    console.log(`  - Has tool_use: ${hasToolUse(firstResponse.content)}`);

    const firstTextOnly =
      firstResponse?.content?.find?.((b) => b.type === "text")?.text ?? "";
    console.log(
      `  - First text response: "${firstTextOnly.substring(0, 50)}..."`
    );

    // If tools exist but model did not emit tool_use OR returned trivial response, force a retry
    if (
      tools.length > 0 &&
      (!hasToolUse(firstResponse.content) || isTrivial(firstTextOnly))
    ) {
      console.log(
        `⚠️ Response is ${
          !hasToolUse(firstResponse.content) ? "missing tool_use" : "trivial"
        }; forcing retry`
      );
      console.log("📡 Calling Claude API with forced tool usage...");
      const nudge =
        "Call the appropriate tool now. Return the actual answer in short paragraphs—no acknowledgments.";
      firstResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user", content: userMessage },
          { role: "user", content: nudge },
        ],
        max_tokens: 2000,
        tools,
      });
      console.log("🤖 Claude forced-tool response received");
      console.log(`  - Has tool_use now: ${hasToolUse(firstResponse.content)}`);
    }

    // Execute tools if any tool_use blocks are present
    let toolResults = [];
    if (tools.length > 0 && hasToolUse(firstResponse.content)) {
      console.log("🔧 Executing tools...");
      try {
        console.log(`📞 Calling tools with externalUserId: ${externalUserId}`);
        toolResults = await composio.provider.handleToolCalls(
          externalUserId,
          firstResponse
        );
        console.log(
          "✅ Tool execution succeeded:",
          toolResults?.length || 0,
          "tools called"
        );
        console.log(
          "Tool result types:",
          toolResults.map((r) => r.role)
        );
      } catch (toolError) {
        console.error(
          "❌ Tool execution failed with user ID:",
          toolError?.message
        );
        if (
          toolError?.message?.includes("No connected account found") &&
          externalUserId !== DEFAULT_EXTERNAL_USER_ID
        ) {
          console.log("🔄 Retrying tool calls with DEFAULT_EXTERNAL_USER_ID");
          try {
            toolResults = await composio.provider.handleToolCalls(
              DEFAULT_EXTERNAL_USER_ID,
              firstResponse
            );
            console.log(
              "✅ Tool results (retry):",
              toolResults?.length || 0,
              "tools called"
            );
          } catch (retryError) {
            console.error(
              "❌ Tool execution failed with default user:",
              retryError?.message
            );
          }
        }
      }
    } else if (tools.length > 0) {
      console.log("⏭️  No tool_use detected, skipping tool execution");
    } else {
      console.log("⏭️  No tools available, skipping tool execution");
    }

    // If tools were used, follow up to format results in the required style
    if (toolResults && toolResults.length > 0) {
      console.log("📝 Formatting tool results with follow-up...");
      const followUp = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user", content: userMessage },
          // Pass the assistant turn that contains tool_use blocks
          { role: "assistant", content: firstResponse.content },
          // Then the executed tool outputs
          ...toolResults,
        ],
        max_tokens: 3000,
      });

      console.log("✅ Final response ready (with tools)");

      return res.json({
        ok: true,
        result: followUp,
        toolResults,
        connectionStatus,
      });
    }

    // No tool execution or no tools available
    // Build friendly, human fallbacks that never leak "Let me check" meta-text
    if (tools.length === 0) {
      console.log("⚠️  No tools available, returning fallback message");
      const lines = [];
      if (!hasGoogleCalendar) lines.push("• Google Calendar not connected");
      if (!hasGmail) lines.push("• Gmail not connected");
      if (!hasCanvas) lines.push("• Canvas not connected");
      if (!hasZoom) lines.push("• Zoom not connected");

      return res.json({
        ok: true,
        result: {
          content: [
            {
              type: "text",
              text:
                lines.length > 0
                  ? `Looks like I need access first:\n${lines.join(
                      "\n"
                    )}\n\nTap the matching Connect button above, then ask me again.`
                  : "I could not load your data right now. Try reconnecting your account and ask me again.",
            },
          ],
        },
        connectionStatus,
      });
    }

    // Tools exist but no tool_use and no tool results
    console.log(
      "⚠️  Tools exist but no tool execution occurred, returning fallback"
    );
    return res.json({
      ok: true,
      result: {
        content: [
          {
            type: "text",
            text: "Hmm, I could not load that right now. Try reconnecting your account, then ask me again.",
          },
        ],
      },
      connectionStatus,
    });
  } catch (error) {
    console.error("═══════════════════════════════════════");
    console.error("❌ CHAT FUNCTION ERROR:", error);
    console.error("Error stack:", error.stack);
    console.error("═══════════════════════════════════════");

    if (error?.message && error.message.includes("prompt is too long")) {
      return res.status(400).json({
        ok: false,
        error:
          "The request contains too much data. Please try asking for more specific information or fewer assignments at once.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Chat function failed: " + (error?.message || "Unknown error"),
    });
  }
};

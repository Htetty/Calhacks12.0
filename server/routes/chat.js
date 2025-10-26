// routes/chat.js (or controllers/chat.js)

import {
  anthropic,
  composio,
  DEFAULT_EXTERNAL_USER_ID,
} from "../services/mcp.js";

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
  try {
    const { userMessage, conversationHistory = [], userId } = req.body;
    const externalUserId = userId || DEFAULT_EXTERNAL_USER_ID;

    if (!process.env.COMPOSIO_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "Composio API key not configured. Please set COMPOSIO_API_KEY in your .env file.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your .env file.",
      });
    }

    // Basic validation
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid user message" });
    }

    // Determine which services are connected for this user
    let connectionItems = [];
    try {
      const allConnections = await composio.connectedAccounts.list();
      connectionItems = Array.isArray(allConnections?.items)
        ? allConnections.items
        : [];
    } catch (connectionError) {
      if (
        connectionError?.message &&
        connectionError.message.includes("Connected account not found")
      ) {
        // No connected accounts, proceed without tools
      } else {
        throw connectionError;
      }
    }

    let userConnections = connectionItems.filter(
      (conn) => matchesUser(conn, externalUserId) && isActive(conn)
    );

    // Fallback: any active connections if external_user_id was not set during auth
    if (userConnections.length === 0) {
      userConnections = connectionItems.filter(isActive);
    }

    const hasGmail = userConnections.some((c) => normalizeSlug(c) === "gmail");
    const hasGoogleCalendar = userConnections.some((c) => {
      const s = normalizeSlug(c);
      return s === "googlecalendar" || s === "gcal";
    });
    const hasCanvas = userConnections.some(
      (c) => normalizeSlug(c) === "canvas"
    );
    const hasGoogleMeetings = userConnections.some((c) => {
      const s = normalizeSlug(c);
      return s === "googlemeetings" || s === "gmeet" || s === "googlemeet";
    });

    // Load tools only for connected services
    const tools = [];

    if (hasGmail) {
      try {
        const gmailTools = await composio.tools.get(externalUserId, {
          tools: [
            "GMAIL_FETCH_EMAILS",
            "GMAIL_SEND_EMAIL",
            "GMAIL_GET_PROFILE",
          ],
        });
        tools.push(...gmailTools);
      } catch (err) {
        // Failed to load Gmail tools
      }
    }

    if (hasGoogleCalendar) {
      try {
        const calendarTools = await composio.tools.get(externalUserId, {
          tools: [
            "GOOGLECALENDAR_LIST_EVENTS",
            "GOOGLECALENDAR_FIND_EVENT",
            "GOOGLECALENDAR_CREATE_EVENT",
          ],
        });
        console.log(
          "Loaded Google Calendar tools:",
          calendarTools.map((t) => t.name)
        );
        tools.push(...calendarTools);
      } catch (err) {
        console.error("Failed to load Calendar tools:", err.message);
      }
    }

    if (hasCanvas) {
      try {
        const canvasTools = await composio.tools.get(externalUserId, {
          tools: [
            "CANVAS_LIST_COURSES",
            "CANVAS_GET_ALL_ASSIGNMENTS",
            "CANVAS_GET_ASSIGNMENT",
          ],
        });
        tools.push(...canvasTools);
      } catch (canvasError) {
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
          tools.push(...canvasTools);
        } catch (retryError) {
          // Failed to load Canvas tools
        }
      }
    }

    if (hasGoogleMeetings) {
      try {
        // Try loading with different toolkit names
        let meetingsTools = [];
        const toolkitsToTry = ["GOOGLEMEETINGS", "GOOGLEMEET", "GMEET"];

        for (const toolkit of toolkitsToTry) {
          try {
            const tools = await composio.tools.get(externalUserId, {
              toolkits: [toolkit],
            });
            console.log(
              `Google Meetings tools from ${toolkit}:`,
              tools.map((t) => t.name)
            );
            meetingsTools = tools;
            break; // Stop if we found tools
          } catch (err) {
            console.log(`Failed to load ${toolkit}:`, err.message);
          }
        }

        tools.push(...meetingsTools);
      } catch (err) {
        console.error("Failed to load Google Meetings tools:", err);
      }
    }

    const connectionStatus = {
      gmail: hasGmail,
      googlecalendar: hasGoogleCalendar,
      googlemeetings: hasGoogleMeetings,
      canvas: hasCanvas,
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
You help students manage time, tasks, and communication using real data from Gmail, Google Calendar, Google Meetings, and Canvas via tools.

VOICE & STYLE (strict)
- Answer in short, natural paragraphs with complete sentences.
- Do not use bullets, numbered lists, tables, code blocks, or label-style formatting.
- Do not use symbols like "•", "|" or colons-as-labels. Do not use em dashes.
- Do not mention tools, services, connections, accounts, or permissions.
- Begin with the answer itself. Never reply with trivial one-word acknowledgments (such as a single word of agreement).

TOOL USAGE CONTRACT (strict)
- If the user asks about any date/day/time/schedule/events, you MUST call the calendar tool first and then answer with the results in natural sentences.
- If the user asks to create/schedule/start a meeting or meeting link, you MUST use the Google Calendar tools to create a calendar event with video conferencing enabled. Do not use Gmail for meeting creation and do not show the meeting URL.
- If the user asks to email/draft/send (and NOT about meetings), you MUST call the Gmail tool first and then present the email in natural sentences (include subject and a concise body summary in prose).
- If the user asks about assignments/courses, you MUST call the Canvas tool first and only include assignments due today or later.
- Do not guess. Only describe information returned by the tools.

TIME & DATE HANDLING (AMERICA/LOS_ANGELES)
- Timezone is America/Los_Angeles for interpretation and scheduling.
- If ONLY a time is given (e.g., "7 PM"), schedule for TODAY at that time.
- "Tomorrow" means the next calendar day local time.
- Weekday-only requests (e.g., "Friday") use the nearest future occurrence.
- If a date is given (e.g., "October 29"), treat it as 00:00–24:00 local for queries.
- Default duration is 30 minutes unless the user specifies a duration.
- If the user says a range (e.g., "2–3 PM"), use that range.
- If the user gives a time without AM/PM and it is ambiguous, choose the most reasonable interpretation based on context (usually PM for afternoon/evening class or meeting requests).

MEETING CREATION RULES
- Title: short and human, e.g., "Meeting with <Name>" or the topic if given.
- Video: enable conferencing.
- Attendees: include normalized emails (see Email Normalization). If none can be confidently extracted, create the event without attendees.
- Output: confirm in one sentence with date/time and attendee name(s) if known. Do not include the URL or IDs.

GMAIL HANDLING
- When asked to email/draft/send: compose a concise subject and a short, clear body summary in natural sentences.
- Respect instructions about recipients, CC, BCC, and attachments if provided. If only a recipient is given, send a simple, polite message confirming the user’s stated intent.
- Do NOT use Gmail to create meetings or meeting links.
- If an email address is spoken or noisy, normalize it (see Email Normalization) and proceed if the result is valid.

EMAIL NORMALIZATION (NOISY "AT/DOT" INPUT)
- Normalize common dictation patterns before using emails:
  - Replace " at " → "@", " dot " or " do " → ".", " underscore " → "_", " dash " or " hyphen " → "-".
  - Remove commas and spaces around "@", ".", "_", "-".
  - Collapse digit lists like "3,2,1" → "321".
- Valid email must match: [a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}
- If multiple candidates appear, choose the last one in the utterance.
- If no valid email can be formed, proceed without that recipient and state that you sent the message to the available recipients.

OUTPUT SHAPE (strict)
- One or two compact paragraphs maximum.
- Integrate details naturally in sentences (title, date, time range, location woven into prose).
- Never include raw URLs, links, or technical IDs in your response.
- Do not show Google Meet URLs, meeting IDs, calendar event IDs, or any technical identifiers.
- If a meeting was created, just say "I've created the meeting" with the scheduled date/time and attendees if known; never show the URL.
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
- After creating a meeting: "I've created the meeting for today at {Time} Pacific with {Name}."
- After sending an email: "I've sent an email to {Recipient} with the subject '{Subject}'."

COMPLETENESS & TONE
- Always produce a complete, helpful answer in your first message after a user request.
- Keep answers concise, friendly, and confident.
- Avoid filler like "fetching" or "retrieving".

ENVIRONMENT HINTS
- TODAY: \${currentDate}
- TIME ZONE: America/Los_Angeles
`.trim();

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
    let firstResponse = await anthropic.messages.create(request);

    const firstTextOnly =
      firstResponse?.content?.find?.((b) => b.type === "text")?.text ?? "";

    // If tools exist but model did not emit tool_use OR returned trivial response, force a retry
    if (
      tools.length > 0 &&
      (!hasToolUse(firstResponse.content) || isTrivial(firstTextOnly))
    ) {
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
    }

    // Execute tools if any tool_use blocks are present
    let toolResults = [];
    if (tools.length > 0 && hasToolUse(firstResponse.content)) {
      try {
        toolResults = await composio.provider.handleToolCalls(
          externalUserId,
          firstResponse
        );
      } catch (toolError) {
        if (
          toolError?.message?.includes("No connected account found") &&
          externalUserId !== DEFAULT_EXTERNAL_USER_ID
        ) {
          try {
            toolResults = await composio.provider.handleToolCalls(
              DEFAULT_EXTERNAL_USER_ID,
              firstResponse
            );
          } catch (retryError) {
            // Tool execution failed
          }
        }
      }
    }

    // If tools were used, follow up to format results in the required style
    if (toolResults && toolResults.length > 0) {
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
      const lines = [];
      if (!hasGoogleCalendar) lines.push("• Google Calendar not connected");
      if (!hasGmail) lines.push("• Gmail not connected");
      if (!hasGoogleMeetings) lines.push("• Google Meetings not connected");
      if (!hasCanvas) lines.push("• Canvas not connected");

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

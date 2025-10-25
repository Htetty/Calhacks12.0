import {
  anthropic,
  composio,
  DEFAULT_EXTERNAL_USER_ID,
} from "../services/ai.js";

// Direct assignment fetching endpoint
export const getAssignments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const externalUserId = req.body.userId || DEFAULT_EXTERNAL_USER_ID;

    const tools = await composio.tools.get(externalUserId, {
      tools: ["CANVAS_GET_ALL_ASSIGNMENTS"],
    });

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Get all assignments for course ID ${courseId} and tell me when the next assignment is due.`,
        },
      ],
      tools,
      max_tokens: 1200,
    });

    const toolResults = await composio.provider.handleToolCalls(
      externalUserId,
      message
    );

    if (!toolResults || toolResults.length === 0) {
      return res.json({ ok: true, result: message });
    }

    const followUp = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Get all assignments for course ID ${courseId} and tell me when the next assignment is due.`,
        },
        { role: "assistant", content: message.content },
        ...toolResults,
      ],
      max_tokens: 1200,
    });

    res.json({ ok: true, result: followUp, toolResults });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Direct discussion fetching endpoint
export const getDiscussions = async (req, res) => {
  try {
    const externalUserId = DEFAULT_EXTERNAL_USER_ID;

    const tools = await composio.tools.get(externalUserId, {
      tools: ["CANVAS_LIST_DISCUSSION_TOPICS"],
    });

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Check discussion topics for courses 65734 (Computer Architecture) and 65759 (Data Structures). Provide a complete summary of any discussions that require participation, including due dates, point values, and reply requirements.`,
        },
      ],
      tools,
      max_tokens: 3000,
    });

    const toolResults = await composio.provider.handleToolCalls(
      externalUserId,
      message
    );

    if (!toolResults || toolResults.length === 0) {
      return res.json({ ok: true, result: message });
    }

    const followUp = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Check discussion topics for courses 65734 (Computer Architecture) and 65759 (Data Structures). Provide a complete summary of any discussions that require participation, including due dates, point values, and reply requirements.`,
        },
        { role: "assistant", content: message.content },
        ...toolResults,
      ],
      max_tokens: 3000,
    });

    res.json({ ok: true, result: followUp, toolResults });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

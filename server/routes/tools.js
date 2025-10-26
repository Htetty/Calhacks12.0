import { composio, DEFAULT_EXTERNAL_USER_ID } from "../services/mcp.js";

// Check available tools count for each service
export const getToolsCount = async (req, res) => {
  try {
    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID;

    const gmailTools = await composio.tools.get(externalUserId, {
      toolkits: ["GMAIL"],
    });

    const canvasTools = await composio.tools.get(externalUserId, {
      toolkits: ["CANVAS"],
    });

    const allTools = await composio.tools.get(externalUserId, {
      toolkits: ["GMAIL", "CANVAS"],
    });

    res.json({
      ok: true,
      toolCounts: {
        gmail: gmailTools.length,
        canvas: canvasTools.length,
        total: allTools.length,
        combined: gmailTools.length + canvasTools.length,
      },
      tools: {
        gmail: gmailTools.map((tool) => tool.name),
        canvas: canvasTools.map((tool) => tool.name),
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Search and explore tools with custom queries
export const searchTools = async (req, res) => {
  try {
    const { query, toolkit = "GMAIL", limit = 10 } = req.query;
    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID;

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "Query parameter is required",
        example: "/api/tools/search?query=send%20email&toolkit=GMAIL&limit=5",
      });
    }

    const tools = await composio.tools.get(externalUserId, {
      search: query,
      toolkits: [toolkit.toUpperCase()],
      limit: parseInt(limit),
    });

    res.json({
      ok: true,
      query,
      toolkit,
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Canvas-specific search endpoint
export const searchCanvasTools = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID;

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "Query parameter is required",
        example: "/api/tools/canvas/search?query=assignment&limit=5",
      });
    }

    const tools = await composio.tools.get(externalUserId, {
      search: query,
      toolkits: ["CANVAS"],
      limit: parseInt(limit),
    });

    res.json({
      ok: true,
      query,
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

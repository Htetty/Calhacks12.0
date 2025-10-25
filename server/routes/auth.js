import { AuthScheme } from "@composio/core";
import { composio, DEFAULT_EXTERNAL_USER_ID } from "../services/ai.js";
import { config } from "../config/index.js";

// Start Gmail authentication
export const startGmailAuth = async (req, res) => {
  try {
    const externalUserId = DEFAULT_EXTERNAL_USER_ID; // Always use the default user ID
    const r = await composio.connectedAccounts.link(
      externalUserId,
      config.GMAIL_AUTH_CONFIG_ID,
      { callbackUrl: config.GMAIL_LINK_CALLBACK_URL }
    );
    const url = r.linkUrl || r.redirectUrl;
    if (!url)
      return res.status(500).json({ ok: false, error: "Missing linkUrl" });
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Start Canvas authentication
export const startCanvasAuth = async (req, res) => {
  try {
    const externalUserId = DEFAULT_EXTERNAL_USER_ID; // Always use the default user ID
    const apiKey = req.body.apiKey || config.CANVAS_API_KEY;
    const baseUrl = req.body.baseUrl || config.CANVAS_BASE_URL;
    const resp = await composio.connectedAccounts.initiate(
      externalUserId,
      config.CANVAS_AUTH_CONFIG_ID,
      {
        config: AuthScheme.APIKey({
          api_key: apiKey,
          generic_api_key: apiKey,
          full: baseUrl,
          base_url: baseUrl,
        }),
      }
    );
    res.json({ ok: true, data: resp });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
};

// Handle Gmail authentication callback
export const gmailCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      console.error("Gmail auth error:", error);
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      console.log("✅ Gmail authentication successful!");
      return res.redirect("/?auth=success&account_id=" + connected_account_id);
    }

    if (!connected_account_id) {
      console.error("No connected account ID received");
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=success");
  } catch (e) {
    console.error("Callback error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Handle Canvas authentication callback
export const canvasCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      console.error("Canvas auth error:", error);
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      console.log("✅ Canvas authentication successful!");
      return res.redirect(
        "/?auth=canvas_success&account_id=" + connected_account_id
      );
    }

    if (!connected_account_id) {
      console.error("No connected account ID received");
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=canvas_success");
  } catch (e) {
    console.error("Canvas callback error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Check authentication status
export const checkAuthStatus = async (req, res) => {
  try {
    const allConnections = await composio.connectedAccounts.list();
    const gmailConns = allConnections.items.filter(
      (c) => c.toolkit?.slug === "gmail" && c.status === "ACTIVE"
    );

    const canvasConns = allConnections.items.filter(
      (c) => c.toolkit?.slug === "canvas" && c.status === "ACTIVE"
    );

    res.json({
      ok: true,
      connectedAccounts: {
        gmail: gmailConns.length > 0,
        gmailConnections: gmailConns,
        canvas: canvasConns.length > 0,
        canvasConnections: canvasConns,
        totalConnections: allConnections.items.length,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Unlink Gmail account
export const unlinkGmail = async (req, res) => {
  try {
    const externalUserId = DEFAULT_EXTERNAL_USER_ID;

    let conns = [];
    try {
      conns = await composio.connectedAccounts.get(externalUserId);
    } catch (error) {
      if (
        error.message &&
        error.message.includes("Connected account not found")
      ) {
        return res.json({ ok: true, removed: 0 });
      }
      throw error;
    }

    const gmailConns = (conns || []).filter(
      (c) => (c.toolkit || c.toolkit_slug) === "GMAIL"
    );

    for (const c of gmailConns) {
      await composio.connectedAccounts.unlink(
        externalUserId,
        c.connection_id || c.id
      );
    }

    res.json({ ok: true, removed: gmailConns.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

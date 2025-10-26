import { AuthScheme } from "@composio/core";
import { composio, DEFAULT_EXTERNAL_USER_ID } from "../services/mcp.js";
import { config } from "../config/index.js";

export const startGmailAuth = async (req, res) => {
  try {
    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID; // Use userId from query or default
    const r = await composio.connectedAccounts.link(
      externalUserId,
      config.GMAIL_AUTH_CONFIG_ID,
      { callbackUrl: config.GMAIL_LINK_CALLBACK_URL_GMAIL }
    );
    const url = r.linkUrl || r.redirectUrl;
    if (!url)
      return res.status(500).json({ ok: false, error: "Missing linkUrl" });
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

export const startCanvasAuth = async (req, res) => {
  try {
    const externalUserId = req.body.userId || DEFAULT_EXTERNAL_USER_ID; // Use userId from body or default
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

export const startGoogleMeetingsAuth = async (req, res) => {
  try {
    if (!config.GOOGLEMEETINGS_AUTH_CONFIG_ID) {
      return res.status(500).json({
        ok: false,
        error:
          "Google Meetings auth config ID not configured. Please set COMPOSIO_GOOGLEMEETINGS_AUTH_CONFIG_ID in your .env file.",
      });
    }

    if (!config.GOOGLEMEETINGS_LINK_CALLBACK_URL) {
      return res.status(500).json({
        ok: false,
        error:
          "Google Meetings callback URL not configured. Please set COMPOSIO_LINK_CALLBACK_URL_GOOGLEMEETINGS in your .env file.",
      });
    }

    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID;
    const r = await composio.connectedAccounts.link(
      externalUserId,
      config.GOOGLEMEETINGS_AUTH_CONFIG_ID,
      { callbackUrl: config.GOOGLEMEETINGS_LINK_CALLBACK_URL }
    );
    const url = r.linkUrl || r.redirectUrl;
    if (!url)
      return res.status(500).json({ ok: false, error: "Missing linkUrl" });
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

export const startGoogleCalendarAuth = async (req, res) => {
  try {
    const externalUserId = req.query.userId || DEFAULT_EXTERNAL_USER_ID;
    const r = await composio.connectedAccounts.link(
      externalUserId,
      config.GCALENDAR_AUTH_CONFIG_ID,
      { callbackUrl: config.GCALENDAR_LINK_CALLBACK_URL }
    );
    const url = r.linkUrl || r.redirectUrl;
    if (!url)
      return res.status(500).json({ ok: false, error: "Missing linkUrl" });
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Handle Gmail authentication callback
export const gmailCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      const redirectUrl =
        process.env.NODE_ENV === "production"
          ? "/?auth=success&account_id=" + connected_account_id
          : "http://localhost:5174/?auth=success&account_id=" +
            connected_account_id;
      return res.redirect(redirectUrl);
    }

    if (!connected_account_id) {
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=success");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Handle Google Calendar authentication callback
export const googleCalendarCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      const redirectUrl =
        process.env.NODE_ENV === "production"
          ? "/?auth=success&account_id=" + connected_account_id
          : "http://localhost:5174/?auth=success&account_id=" +
            connected_account_id;
      return res.redirect(redirectUrl);
    }

    if (!connected_account_id) {
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=success");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Handle Google Meetings authentication callback
export const googleMeetingsCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      const redirectUrl =
        process.env.NODE_ENV === "production"
          ? "/?auth=success&account_id=" + connected_account_id
          : "http://localhost:5174/?auth=success&account_id=" +
            connected_account_id;
      return res.redirect(redirectUrl);
    }

    if (!connected_account_id) {
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=success");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
// Handle Canvas authentication callback
export const canvasCallback = async (req, res) => {
  try {
    const { error, status, connected_account_id } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ ok: false, error: `Authentication failed: ${error}` });
    }

    if (status === "success" && connected_account_id) {
      return res.redirect(
        "/?auth=canvas_success&account_id=" + connected_account_id
      );
    }

    if (!connected_account_id) {
      return res.status(400).json({ ok: false, error: "Missing account ID" });
    }

    res.redirect("/?auth=canvas_success");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

// Check authentication status
export const checkAuthStatus = async (req, res) => {
  try {
    // Check if required environment variables are configured
    if (!config.COMPOSIO_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "Composio API key not configured. Please set COMPOSIO_API_KEY in your .env file.",
      });
    }

    const allConnections = await composio.connectedAccounts.list();
    const gmailConns = allConnections.items.filter(
      (c) => c.toolkit?.slug === "gmail" && c.status === "ACTIVE"
    );

    const googleCalendarConns = allConnections.items.filter(
      (c) =>
        (c.toolkit?.slug === "googlecalendar" || c.toolkit?.slug === "gcal") &&
        c.status === "ACTIVE"
    );

    const canvasConns = allConnections.items.filter(
      (c) => c.toolkit?.slug === "canvas" && c.status === "ACTIVE"
    );

    const googleMeetingsConns = allConnections.items.filter(
      (c) =>
        (c.toolkit?.slug === "googlemeetings" ||
          c.toolkit?.slug === "gmeet" ||
          c.toolkit?.slug === "googlemeet") &&
        c.status === "ACTIVE"
    );

    res.json({
      ok: true,
      connectedAccounts: {
        gmail: gmailConns.length > 0,
        gmailConnections: gmailConns,
        googlecalendar: googleCalendarConns.length > 0,
        googlecalendarConnections: googleCalendarConns,
        googlemeetings: googleMeetingsConns.length > 0,
        googlemeetingsConnections: googleMeetingsConns,
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

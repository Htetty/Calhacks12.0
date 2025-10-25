import { useMemo, useState } from "react";
import "./App.css";

const DEFAULT_EXTERNAL_USER_ID = "pg-test-1434803e-a3dd-4458-b954-2c0c312cad87";

function App() {
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  const view = useMemo(() => {
    if (typeof window === "undefined") return "connect";

    const normalizedPath = window.location.pathname.replace(/\/$/, "");
    if (normalizedPath === "/connected") {
      return "post-connect";
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      return "post-connect";
    }

    return "connect";
  }, []);

  const handleConnectClick = async () => {
    setLinkError("");
    setIsLinking(true);

    try {
      const response = await fetch("/api/composio/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          externalUserId: DEFAULT_EXTERNAL_USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start the Composio link flow");
      }

      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    } catch (err) {
      setIsLinking(false);
      setLinkError(err.message || "Something went wrong");
    }
  };

  const handleSendClick = async () => {
    setSendError("");
    setSendSuccess(false);
    setIsSending(true);

    try {
      const response = await fetch("/api/composio/send-welcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          externalUserId: DEFAULT_EXTERNAL_USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send the welcome email");
      }

      setSendSuccess(true);
    } catch (err) {
      setSendError(err.message || "Something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  if (view === "post-connect") {
    return (
      <main className="connect-card">
        <h1>Account linked ✅</h1>
        <p>
          Click the button to have Claude trigger the Composio Gmail tool using
          your newly connected account.
        </p>
        <button onClick={handleSendClick} disabled={isSending}>
          {isSending ? "Sending..." : "Send the welcome email"}
        </button>
        {sendSuccess && <p className="success">Email sent!</p>}
        {sendError && <p className="error">{sendError}</p>}
      </main>
    );
  }

  return (
    <main className="connect-card">
      <h1>Connect your Gmail</h1>
      <p>
        Start the Composio OAuth flow to grant access so we can send emails on
        your behalf.
      </p>
      <button onClick={handleConnectClick} disabled={isLinking}>
        {isLinking ? "Redirecting..." : "Connect with Composio"}
      </button>
      {linkError && <p className="error">{linkError}</p>}
      <p className="hint">
        Set the Composio redirect URL to <code>http://localhost:5173/connected</code>
        so we can show the send-email button afterwards.
      </p>
    </main>
  );
}

export default App;

import { useEffect, useRef, useState } from "react";

export default function App() {
  const [userId] = useState(() => {
    // Use a consistent user ID stored in localStorage, or generate one
    const stored = localStorage.getItem('userId');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('userId', newId);
    return newId;
  });
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me about your Canvas assignments or Gmail." }
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    gmail: false,
    googlecalendar: false,
    canvas: false,
    zoom: false,
    loading: true
  });
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    checkConnectionStatus();
    
    // Handle authentication callback
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const accountId = urlParams.get('account_id');
    
    if (auth === 'success' && accountId) {
      console.log('Authentication successful, account ID:', accountId);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Check connection status again after successful auth
      setTimeout(checkConnectionStatus, 1000);
    }
  }, []);

  async function checkConnectionStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      if (data?.ok) {
        setConnectionStatus({
          gmail: data.connectedAccounts.gmail,
          googlecalendar: data.connectedAccounts.googlecalendar,
          canvas: data.connectedAccounts.canvas,
          zoom: data.connectedAccounts.zoom,
          loading: false
        });
      }
    } catch (e) {
      console.error("Failed to check connection status:", e);
      setConnectionStatus(prev => ({ ...prev, loading: false }));
    }
  }

  function extractAssistantText(result) {
    if (!result?.content || !Array.isArray(result.content)) return "";
    return result.content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  async function connectGmail() {
    try {
      const res = await fetch(`/api/auth/gmail/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Check status after a delay to see if connection was successful
        setTimeout(checkConnectionStatus, 5000);
      }
    } catch (e) {
      console.error("Failed to start Gmail auth:", e);
    }
  }

  async function connectCanvas() {
    try {
      const res = await fetch("/api/auth/canvas/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data?.ok) {
        // Canvas uses API key authentication, so it should connect immediately
        checkConnectionStatus();
      }
    } catch (e) {
      console.error("Failed to start Canvas auth:", e);
    }
  }

  async function connectGoogleCalendar() {
    try {
      const res = await fetch(`/api/auth/gcalendar/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Check status after a delay to see if connection was successful
        setTimeout(checkConnectionStatus, 5000);
      }
    } catch (e) {
      console.error("Failed to start Google Calendar auth:", e);
    }
  }

  async function connectZoom() {
    try {
      const res = await fetch(`/api/auth/zoom/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Check status after a delay to see if connection was successful
        setTimeout(checkConnectionStatus, 5000);
      }
    } catch (e) {
      console.error("Failed to start Zoom auth:", e);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userMessage: text })
      });
      const data = await res.json();

      if (data?.ok) {
        const replyText = extractAssistantText(data.result);
        const fallback =
          typeof data?.reply === "string" ? data.reply : "";
        const reply = replyText || fallback || "OK.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Error: ${data?.error || "Unknown error"}` }
        ]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Network error: ${e.message}` }]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div>
      <h1>Chat</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={connectGmail}
          disabled={connectionStatus.gmail}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionStatus.gmail ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionStatus.gmail ? 'not-allowed' : 'pointer',
            opacity: connectionStatus.gmail ? 0.7 : 1
          }}
        >
          Gmail: {connectionStatus.gmail ? 'Connected' : 'Not Connected'}
        </button>
        <button 
          onClick={connectGoogleCalendar}
          disabled={connectionStatus.googlecalendar}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionStatus.googlecalendar ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionStatus.googlecalendar ? 'not-allowed' : 'pointer',
            opacity: connectionStatus.googlecalendar ? 0.7 : 1
          }}
        >
          Calendar: {connectionStatus.googlecalendar ? 'Connected' : 'Not Connected'}
        </button>
        <button 
          onClick={connectCanvas}
          disabled={connectionStatus.canvas}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionStatus.canvas ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionStatus.canvas ? 'not-allowed' : 'pointer',
            opacity: connectionStatus.canvas ? 0.7 : 1
          }}
        >
          Canvas: {connectionStatus.canvas ? 'Connected' : 'Not Connected'}
        </button>
        <button 
          onClick={connectZoom}
          disabled={connectionStatus.zoom}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionStatus.zoom ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionStatus.zoom ? 'not-allowed' : 'pointer',
            opacity: connectionStatus.zoom ? 0.7 : 1
          }}
        >
          Zoom: {connectionStatus.zoom ? 'Connected' : 'Not Connected'}
        </button>
        {connectionStatus.loading && <span>Loading...</span>}
      </div>

      <div>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.role === "user" ? "You" : "Assistant"}: </strong>
            <span>{m.content}</span>
          </div>
        ))}
        {pending && (
          <div>
            <strong>Assistant: </strong>
            <span>…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message"
          disabled={pending}
        />
        <div>
          <button onClick={send} disabled={pending || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./OnboardingScreen.css";

function useBodyModalClass(hasModal) {
  useEffect(() => {
    if (hasModal) {
      document.body.classList.add("has-modal");
    } else {
      document.body.classList.remove("has-modal");
    }
    return () => document.body.classList.remove("has-modal");
  }, [hasModal]);
}

function useFocusTrap(active, containerRef) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const focusables = () =>
      Array.from(container.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null || el.getAttribute("aria-hidden") !== "true"
      );

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;

      const first = els[0];
      const last = els[els.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (current === last || !container.contains(current)) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    const focusFirst = () => {
      const els = focusables();
      if (els[0]) els[0].focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    focusFirst();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);
}

export default function OnboardingScreen({ onComplete }) {
  // Auth state from App.jsx
  const [userId] = useState(() => {
    const stored = localStorage.getItem('userId');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('userId', newId);
    return newId;
  });

  const [connectionStatus, setConnectionStatus] = useState({
    gmail: false,
    googlecalendar: false,
    googlemeetings: false,
    canvas: false,
    loading: true
  });

  // Visual-only simulated states (keeping for UI continuity)
  const [canvasState, setCanvasState] = useState("idle"); // idle | connecting | connected | error
  const [googleState, setGoogleState] = useState("idle"); // idle | connecting | connected | error
  const [calendarState, setCalendarState] = useState("idle"); // idle | connecting | connected | error
  const [meetingsState, setMeetingsState] = useState("idle"); // idle | connecting | connected | error
  const [canvasName] = useState("student@university.edu");
  const [googleName] = useState("student@gmail.com");

  // Chat state
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me about your Canvas assignments, Gmail, Google Calendar, or Google Meetings." }
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const endRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Right card UI
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  // Data management
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Modal refs for focus trap
  const previewRef = useRef(null);
  const exportRef = useRef(null);
  const deleteRef = useRef(null);

  const modalOpen =
    previewOpen || exportOpen || deleteOpen;

  // Lock background scroll & interactions
  useBodyModalClass(modalOpen);

  // Focus trap on whichever modal is open
  const activeModalRef = useMemo(() => {
    if (previewOpen) return previewRef;
    if (exportOpen) return exportRef;
    if (deleteOpen) return deleteRef;
    return null;
  }, [previewOpen, exportOpen, deleteOpen]);
  useFocusTrap(!!activeModalRef, activeModalRef || { current: null });

  // Auth functions from App.jsx
  async function checkConnectionStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      if (data?.ok) {
        const newStatus = {
          gmail: data.connectedAccounts.gmail,
          googlecalendar: data.connectedAccounts.googlecalendar,
          googlemeetings: data.connectedAccounts.googlemeetings,
          canvas: data.connectedAccounts.canvas,
          loading: false
        };
        setConnectionStatus(newStatus);
        return newStatus;
      }
      return null;
    } catch (e) {
      console.error("Failed to check connection status:", e);
      setConnectionStatus(prev => ({ ...prev, loading: false }));
      return null;
    }
  }

  async function connectGmail() {
    try {
      setGoogleState("connecting");
      const res = await fetch(`/api/auth/gmail/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Poll for connection status after OAuth callback
        let attempts = 0;
        const checkInterval = setInterval(async () => {
          attempts++;
          const status = await checkConnectionStatus();
          // Stop after 30 checks (60 seconds total)
          if (attempts >= 30 || status?.gmail) {
            clearInterval(checkInterval);
            if (!status?.gmail && attempts >= 30) {
              setGoogleState("error");
            }
          }
        }, 2000);
      }
    } catch (e) {
      console.error("Failed to start Gmail auth:", e);
      setGoogleState("error");
    }
  }

  async function connectCanvas() {
    try {
      setCanvasState("connecting");
      const res = await fetch("/api/auth/canvas/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data?.ok) {
        await checkConnectionStatus();
        if (connectionStatus.canvas) setCanvasState("connected");
        else setCanvasState("error");
      }
    } catch (e) {
      console.error("Failed to start Canvas auth:", e);
      setCanvasState("error");
    }
  }

  async function connectGoogleCalendar() {
    try {
      setCalendarState("connecting");
      const res = await fetch(`/api/auth/gcalendar/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Poll for connection status after OAuth callback
        let attempts = 0;
        const checkInterval = setInterval(async () => {
          attempts++;
          const status = await checkConnectionStatus();
          if (attempts >= 30 || status?.googlecalendar) {
            clearInterval(checkInterval);
            if (!status?.googlecalendar && attempts >= 30) {
              setCalendarState("error");
            }
          }
        }, 2000);
      }
    } catch (e) {
      console.error("Failed to start Google Calendar auth:", e);
      setCalendarState("error");
    }
  }

  async function connectGoogleMeetings() {
    try {
      setMeetingsState("connecting");
      const res = await fetch(`/api/auth/gmeetings/start?userId=${userId}`);
      const data = await res.json();
      if (data?.ok && data.url) {
        window.open(data.url, '_blank');
        // Poll for connection status after OAuth callback
        let attempts = 0;
        const checkInterval = setInterval(async () => {
          attempts++;
          const status = await checkConnectionStatus();
          if (attempts >= 30 || status?.googlemeetings) {
            clearInterval(checkInterval);
            if (!status?.googlemeetings && attempts >= 30) {
              setMeetingsState("error");
            }
          }
        }, 2000);
      }
    } catch (e) {
      console.error("Failed to start Google Meetings auth:", e);
      setMeetingsState("error");
    }
  }

  // Handle authentication callback from URL params
  useEffect(() => {
    checkConnectionStatus();
    
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const accountId = urlParams.get('account_id');
    
    if (auth === 'success' && accountId) {
      console.log('Authentication successful, account ID:', accountId);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(checkConnectionStatus, 1000);
    }
  }, []);

  // Sync visual states with actual connection status
  useEffect(() => {
    // Only set to connected when the connection status is true
    if (connectionStatus.gmail) {
      setGoogleState("connected");
    }
    if (connectionStatus.googlecalendar) {
      setCalendarState("connected");
    }
    if (connectionStatus.googlemeetings) {
      setMeetingsState("connected");
    }
    if (connectionStatus.canvas) {
      setCanvasState("connected");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Chat functions
  function extractAssistantText(result) {
    if (!result?.content || !Array.isArray(result.content)) return "";
    return result.content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  async function playTTS(text) {
    try {
      setIsPlayingAudio(true);
      
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!res.ok) {
        throw new Error("TTS request failed");
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audioRef.current.play();
    } catch (error) {
      console.error("Failed to play TTS:", error);
      setIsPlayingAudio(false);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        speechSynthesis.speak(utterance);
      }
    }
  }

  function stopTTS() {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  async function handleRecordStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  }

  function handleRecordStop() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob) {
    try {
      setIsTranscribing(true);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch("/api/asr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data?.ok && data.text) {
        setInput(data.text);
        
        const transcript = data.text;
        if (transcript && transcript.trim()) {
          setMessages((m) => [...m, { role: "user", content: transcript }]);
          setPending(true);
          
          try {
            const chatRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, userMessage: transcript })
            });
            
            const chatData = await chatRes.json();

            if (chatData?.ok) {
              const replyText = extractAssistantText(chatData.result);
              const fallback = typeof chatData?.reply === "string" ? chatData.reply : "";
              const reply = replyText || fallback || "OK.";
              
              setMessages((m) => [...m, { role: "assistant", content: reply }]);
              
              if (reply && reply.trim().length > 0) {
                await playTTS(reply);
              }
            } else {
              setMessages((m) => [
                ...m,
                { role: "assistant", content: `Error: ${chatData?.error || "Unknown error"}` }
              ]);
            }
          } catch (e) {
            setMessages((m) => [...m, { role: "assistant", content: `Network error: ${e.message}` }]);
          } finally {
            setPending(false);
          }
        }
      } else {
        alert("Failed to transcribe audio: " + (data?.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to transcribe audio:", error);
      alert("Failed to transcribe audio");
    } finally {
      setIsTranscribing(false);
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
        const fallback = typeof data?.reply === "string" ? data.reply : "";
        const reply = replyText || fallback || "OK.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        
        if (reply && reply.trim().length > 0) {
          await playTTS(reply);
        }
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

  function handleDone() {
    setShowOnboarding(false);
  }

  // Simulated UI flows (kept for now)
  function simulateConnect(service) {
    if (service === "canvas") {
      setCanvasState("connecting");
      setTimeout(() => setCanvasState("connected"), 1200);
    } else {
      setGoogleState("connecting");
      setTimeout(() => setGoogleState("connected"), 1200);
    }
  }
  function simulateError(service) {
    if (service === "canvas") setCanvasState("error");
    else setGoogleState("error");
  }
  function resetService(service) {
    if (service === "canvas") setCanvasState("idle");
    else setGoogleState("idle");
  }

  // Show chat interface if onboarding is complete
  if (!showOnboarding) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top left, #eef2f3 0%, #dfe9f3 100%)",
          padding: "40px 20px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1600px",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 28px",
              borderRadius: "20px",
              backdropFilter: "blur(16px)",
              background: "rgba(255, 255, 255, 0.5)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
            }}
          >
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#4A4A4A",
                margin: 0,
              }}
            >
              ClassMate
            </h1>
            <span
              style={{
                fontSize: "14px",
                color: "#6b7280",
                letterSpacing: "0.4px",
              }}
            >
              Connected Services Active ✅
            </span>
          </div>
  
          {/* Chat Messages */}
          <div
            style={{
              flex: "1",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              minHeight: "400px",
              maxHeight: "650px",
              overflowY: "auto",
              padding: "30px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.7)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
              backdropFilter: "blur(12px)",
              scrollBehavior: "smooth",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                  gap: "14px",
                  alignItems: "flex-start",
                  animation: "fadeIn 0.4s ease",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background:
                      m.role === "user"
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "linear-gradient(135deg, #7AD1E6 0%, #3A8EE6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  {m.role === "user" ? "🧑" : "🤖"}
                </div>
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "14px 18px",
                    borderRadius:
                      m.role === "user"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    background:
                      m.role === "user"
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "rgba(255,255,255,0.9)",
                    color: m.role === "user" ? "white" : "#333",
                    fontSize: "15px",
                    lineHeight: "1.6",
                    boxShadow:
                      "0 3px 12px rgba(0,0,0,0.05), inset 0 -1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  {m.content}
                  {m.role === "assistant" && (
                    <button
                      onClick={() => playTTS(m.content)}
                      disabled={isPlayingAudio}
                      style={{
                        marginLeft: "10px",
                        fontSize: "14px",
                        padding: "4px 8px",
                        borderRadius: "8px",
                        border: "none",
                        color: "white",
                        background: isPlayingAudio
                          ? "rgba(150,150,150,0.7)"
                          : "linear-gradient(135deg, #34D399 0%, #059669 100%)",
                        cursor: isPlayingAudio ? "not-allowed" : "pointer",
                        transition: "opacity 0.2s ease",
                      }}
                    >
                      🔊
                    </button>
                  )}
                </div>
              </div>
            ))}
  
            {pending && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #7AD1E6 0%, #3A8EE6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "20px",
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: "18px 18px 18px 4px",
                    background: "rgba(255,255,255,0.8)",
                    color: "#555",
                    fontSize: "14px",
                  }}
                >
                  <span className="typing-dots">● ● ●</span>
                </div>
              </div>
            )}
  
            {isPlayingAudio && (
              <div
                style={{
                  alignSelf: "center",
                  padding: "8px 16px",
                  background: "rgba(76, 175, 80, 0.1)",
                  borderRadius: "20px",
                  color: "#16A34A",
                  fontSize: "14px",
                }}
              >
                🎵 Playing response...
                <button
                  onClick={stopTTS}
                  style={{
                    marginLeft: "10px",
                    padding: "4px 10px",
                    fontSize: "13px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                  }}
                >
                  Stop
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>
  
          {/* Input Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "20px",
              background: "rgba(255,255,255,0.6)",
              borderRadius: "20px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message ClassMate..."
              disabled={pending}
              style={{
                flex: 1,
                padding: "14px 18px",
                borderRadius: "16px",
                border: "1.5px solid #ddd",
                fontSize: "15px",
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
                background: "rgba(255,255,255,0.8)",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#667eea")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            />
  
            <button
              onMouseDown={handleRecordStart}
              onMouseUp={handleRecordStop}
              onMouseLeave={handleRecordStop}
              onTouchStart={handleRecordStart}
              onTouchEnd={handleRecordStop}
              disabled={pending || isTranscribing}
              title="Hold to record audio"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                border: "none",
                background: isRecording
                  ? "linear-gradient(135deg, #f5576c 0%, #f093fb 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                fontSize: "24px",
                cursor: "pointer",
                boxShadow: isRecording
                  ? "0 0 25px rgba(245, 87, 108, 0.5)"
                  : "0 6px 15px rgba(102, 126, 234, 0.3)",
                transform: isRecording ? "scale(1.05)" : "scale(1)",
                transition: "all 0.25s ease",
              }}
            >
              {isRecording ? "🔴" : "🎤"}
            </button>
  
            <button
              onClick={send}
              disabled={pending || !input.trim()}
              style={{
                padding: "14px 28px",
                borderRadius: "16px",
                border: "none",
                fontSize: "15px",
                fontWeight: "600",
                color: "white",
                background: input.trim()
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  : "#bbb",
                boxShadow: input.trim()
                  ? "0 4px 12px rgba(102, 126, 234, 0.4)"
                  : "none",
                cursor: (pending || !input.trim()) ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Send
            </button>
          </div>
        </div>
  
        {/* Local animation styles */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .typing-dots {
            letter-spacing: 4px;
            animation: blink 1.2s infinite;
          }
          @keyframes blink {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }  

  return (
    <div className="onboarding-container" role="main" aria-label="Onboarding">
      {/* Wrap page content so we can aria-hide while any modal is open */}
      <div
        className="page-content"
        aria-hidden={modalOpen ? "true" : "false"}
      >
        {/* Left Card */}
        <div className="onboarding-card left-card" aria-labelledby="left-card-title">
          <div className="onboarding-header">
            <div className="logo-and-title">
              {/* Placeholder decorative logo */}
              <svg
                className="decorative-logo"
                viewBox="0 0 68 68"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="StudyAI decorative logo"
              >
                <title>StudyAI decorative logo</title>
                <path d="M10 30 Q25 10, 40 30" stroke="#7AD1E6" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M15 40 Q35 20, 55 40" stroke="#FFB36C" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M8 45 Q25 25, 45 45" stroke="#C67BE6" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M20 50 Q40 30, 60 50" stroke="#FF6B6B" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>

              <div className="title-text">
                <h1 id="left-card-title">Welcome to</h1>
                <h2>ClassMate</h2>
              </div>
            </div>

            <p className="subheader" style={{ fontSize: '15px', marginTop: '12px' }}>Connect services to get started:</p>
            <div className="divider"></div>

            {(canvasState === "connecting" || googleState === "connecting" || calendarState === "connecting" || meetingsState === "connecting") && (
              <div className="micro-progress" aria-hidden="true">
                <div className="micro-progress-bar" />
              </div>
            )}
          </div>

          <div className="connection-buttons">
            {/* Canvas */}
            <div className="connect-row">
              <button
                className={`connect-btn ${canvasState === "connected" ? "is-connected" : ""}`}
                aria-label={canvasState === "connected" ? `Connected as ${canvasName}` : "Connect with Canvas"}
                disabled={canvasState === "connecting"}
                onClick={connectCanvas}
                onContextMenu={(e) => { e.preventDefault(); simulateError("canvas"); }}
              >
                <div className="btn-icon" aria-hidden="true">
                  {/* Canvas icon with dot pattern */}
                  <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-label="Canvas icon">
                    <title>Canvas</title>
                    <circle cx="12" cy="12" r="10" fill="#E13E3B" />
                    <circle cx="12" cy="12" r="2" fill="#fff" />
                    <circle cx="12" cy="5.2" r="1.2" fill="#fff" />
                    <circle cx="12" cy="18.8" r="1.2" fill="#fff" />
                    <circle cx="5.2" cy="12" r="1.2" fill="#fff" />
                    <circle cx="18.8" cy="12" r="1.2" fill="#fff" />
                    <circle cx="7.2" cy="7.2" r="1.2" fill="#fff" />
                    <circle cx="16.8" cy="7.2" r="1.2" fill="#fff" />
                    <circle cx="7.2" cy="16.8" r="1.2" fill="#fff" />
                    <circle cx="16.8" cy="16.8" r="1.2" fill="#fff" />
                  </svg>
                </div>

                <span className="btn-label">
                  {canvasState === "connected" ? `Connected as ${canvasName}` : "Connect with Canvas"}
                </span>

                {canvasState === "connecting" && <span className="left-spinner" aria-hidden="true"></span>}

                {canvasState === "connected" ? (
                  <span className="right-adornment">
                    <span className="check" aria-hidden="true">✓</span>
                    <span className="manage" role="button" tabIndex={0} aria-label="Manage Canvas connection">Manage ▸</span>
                  </span>
                ) : (
                  <span className="chevron" aria-hidden="true">›</span>
                )}
              </button>
            </div>

            {canvasState === "error" && (
              <div className="inline-error" role="alert">
                Connection failed. <button className="retry-link" onClick={() => resetService("canvas")}>Try again</button>.
              </div>
            )}

            {/* Google */}
            <div className="connect-row">
              <button
                className={`connect-btn ${googleState === "connected" ? "is-connected" : ""}`}
                aria-label={googleState === "connected" ? `Connected as ${googleName}` : "Connect with Google"}
                disabled={googleState === "connecting"}
                onClick={connectGmail}
                onContextMenu={(e) => { e.preventDefault(); simulateError("google"); }}
              >
                <div className="btn-icon" aria-hidden="true">
                  {/* Google G */}
                  <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-label="Google icon">
                    <title>Google</title>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>

                <span className="btn-label">
                  {googleState === "connected" ? `Connected as ${googleName}` : "Connect with Google"}
                </span>

                {googleState === "connecting" && <span className="left-spinner" aria-hidden="true"></span>}

                {googleState === "connected" ? (
                  <span className="right-adornment">
                    <span className="check" aria-hidden="true">✓</span>
                    <span className="manage" role="button" tabIndex={0} aria-label="Manage Google connection">Manage ▸</span>
                  </span>
                ) : (
                  <span className="chevron" aria-hidden="true">›</span>
                )}
              </button>
            </div>

            {googleState === "error" && (
              <div className="inline-error" role="alert">
                Connection failed. <button className="retry-link" onClick={() => resetService("google")}>Try again</button>.
              </div>
            )}

            {/* Google Calendar */}
            <div className="connect-row">
              <button
                className={`connect-btn ${calendarState === "connected" ? "is-connected" : ""}`}
                aria-label={calendarState === "connected" ? "Connected to Google Calendar" : "Connect with Google Calendar"}
                disabled={calendarState === "connecting"}
                onClick={connectGoogleCalendar}
              >
                <div className="btn-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-label="Calendar icon">
                    <title>Google Calendar</title>
                    <rect x="4" y="5" width="16" height="14" rx="1" fill="#4285F4" />
                    <path d="M8 9v6l4-2 4 2V9" fill="white" opacity="0.9" />
                  </svg>
                </div>

                <span className="btn-label">
                  {calendarState === "connected" ? "Connected to Calendar" : "Connect with Google Calendar"}
                </span>

                {calendarState === "connecting" && <span className="left-spinner" aria-hidden="true"></span>}

                {calendarState === "connected" ? (
                  <span className="right-adornment">
                    <span className="check" aria-hidden="true">✓</span>
                    <span className="manage" role="button" tabIndex={0} aria-label="Manage Calendar connection">Manage ▸</span>
                  </span>
                ) : (
                  <span className="chevron" aria-hidden="true">›</span>
                )}
              </button>
            </div>

            {calendarState === "error" && (
              <div className="inline-error" role="alert">
                Connection failed. <button className="retry-link" onClick={() => setCalendarState("idle")}>Try again</button>.
              </div>
            )}

            {/* Google Meetings */}
            <div className="connect-row">
              <button
                className={`connect-btn ${meetingsState === "connected" ? "is-connected" : ""}`}
                aria-label={meetingsState === "connected" ? "Connected to Google Meetings" : "Connect with Google Meetings"}
                disabled={meetingsState === "connecting"}
                onClick={connectGoogleMeetings}
              >
                <div className="btn-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-label="Meetings icon">
                    <title>Google Meetings</title>
                    <circle cx="12" cy="12" r="10" fill="#34A853" />
                    <path d="M8 10l4 3 4-3v6H8v-6z" fill="white" />
                  </svg>
                </div>

                <span className="btn-label">
                  {meetingsState === "connected" ? "Connected to Meetings" : "Connect with Google Meetings"}
                </span>

                {meetingsState === "connecting" && <span className="left-spinner" aria-hidden="true"></span>}

                {meetingsState === "connected" ? (
                  <span className="right-adornment">
                    <span className="check" aria-hidden="true">✓</span>
                    <span className="manage" role="button" tabIndex={0} aria-label="Manage Meetings connection">Manage ▸</span>
                  </span>
                ) : (
                  <span className="chevron" aria-hidden="true">›</span>
                )}
              </button>
            </div>

            {meetingsState === "error" && (
              <div className="inline-error" role="alert">
                Connection failed. <button className="retry-link" onClick={() => setMeetingsState("idle")}>Try again</button>.
              </div>
            )}
          </div>

          {/* Done button */}
          <div style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '20px' }}>
            <button
              onClick={handleDone}
              className="primary-btn"
              style={{
                padding: '14px 42px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#45a049';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#4CAF50';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
              }}
              type="button"
              aria-label="Continue to app"
            >
              Done
            </button>
          </div>

          <div className="bottom-section">
            <div className="divider"></div>
            <p className="footer-text">
              Built with Creao.
            </p>
          </div>
        </div>

        {/* Right Card */}
        <div className="onboarding-card right-card" aria-labelledby="right-card-title">
          <div className="right-card-grid">
            <div className="right-card-header">
              <p className="rc-line1">An AI assistant built by</p>
              <p className="rc-line2">
                students,{" "}
                {/* Button-styled link to prevent page navigation */}
                <button
                  className="underlined-link as-button"
                  type="button"
                  aria-label="Learn how this is made for students"
                >
                  for students.
                </button>
              </p>
            </div>

            {/* Mock preview */}
            <button
              className="mock-preview"
              onClick={() => setPreviewOpen(true)}
              aria-label="Open preview modal"
              type="button"
            >
              <div className="mock-browser-header" aria-hidden="true">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="mock-center">
                <span className="tiny-spinner" aria-hidden="true"></span>
                <span className="mock-text">How can I help you today?</span>
              </div>
              <div className="mock-play" aria-hidden="true">▶</div>
            </button>

            <p className="mock-caption">
              View and access your Gmail inbox and Canvas assignments
            </p>

            {/* Carousel */}
            <div className="carousel-dots" role="tablist" aria-label="Preview slides">
              <button
                role="tab"
                aria-selected={slide === 0}
                className={`dot-btn ${slide === 0 ? "active" : ""}`}
                onClick={() => setSlide(0)}
                aria-label="Slide 1"
                type="button"
              />
              <button
                role="tab"
                aria-selected={slide === 1}
                className={`dot-btn ${slide === 1 ? "inactive" : ""}`}
                onClick={() => setSlide(1)}
                aria-label="Slide 2"
                type="button"
              />
            </div>
          </div>
        </div>
      </div>

      {/* === Modals (each traps focus, background is aria-hidden & inert) === */}

      {previewOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Preview modal">
          <div className="modal-card" ref={previewRef}>
            <div className="modal-header">
              <h4>App Preview</h4>
              <button className="icon-btn" aria-label="Close preview" onClick={() => setPreviewOpen(false)} type="button">✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-mock" role="img" aria-label="Preview mockup">
                <div className="mock-browser-header">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="mock-center">
                  <span className="tiny-spinner"></span>
                  <span className="mock-text">How can I help you today?</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setPreviewOpen(false)} aria-label="Close" type="button">Close</button>
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Export data">
          <div className="modal-card" ref={exportRef}>
            <div className="modal-header">
              <h4>Export your data</h4>
              <button className="icon-btn" aria-label="Close" onClick={() => setExportOpen(false)} type="button">✕</button>
            </div>
            <div className="modal-body">
              <p>This front-end demo would generate a portable export (e.g., JSON/ZIP) of your saved settings and cached content.</p>
              <p>In a real app, you could choose a format and download it securely.</p>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setExportOpen(false)} aria-label="Close" type="button">Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete data">
          <div className="modal-card" ref={deleteRef}>
            <div className="modal-header">
              <h4>Delete your data</h4>
              <button className="icon-btn" aria-label="Close" onClick={() => setDeleteOpen(false)} type="button">✕</button>
            </div>
            <div className="modal-body">
              <p>This front-end demo would permanently erase your locally stored data and request deletion of any server-side copies.</p>
              <p>In a real app, you'd confirm this action and receive a deletion receipt.</p>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setDeleteOpen(false)} aria-label="Close" type="button">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

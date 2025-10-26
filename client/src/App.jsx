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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const endRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

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
      // Fallback to browser's Web Speech API
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
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Transcribe the audio
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
        // Add the transcribed text to the input
        setInput(data.text);
        
        // Automatically send the transcribed text
        const transcript = data.text;
        if (transcript && transcript.trim()) {
          // Add user message
          setMessages((m) => [...m, { role: "user", content: transcript }]);
          
          // Start the chat request
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
              const fallback =
                typeof chatData?.reply === "string" ? chatData.reply : "";
              const reply = replyText || fallback || "OK.";
              
              setMessages((m) => [...m, { role: "assistant", content: reply }]);
              
              // Automatically play TTS for assistant responses
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
        const fallback =
          typeof data?.reply === "string" ? data.reply : "";
        const reply = replyText || fallback || "OK.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        
        // Automatically play TTS for assistant responses
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
            {m.role === "assistant" && (
              <button
                onClick={() => playTTS(m.content)}
                disabled={isPlayingAudio}
                style={{
                  marginLeft: '10px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: isPlayingAudio ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPlayingAudio ? 'not-allowed' : 'pointer'
                }}
              >
                🔊
              </button>
            )}
          </div>
        ))}
        {pending && (
          <div>
            <strong>Assistant: </strong>
            <span>…</span>
          </div>
        )}
        {isPlayingAudio && (
          <div style={{ color: '#4CAF50', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🎵 Playing audio...</span>
            <button
              onClick={stopTTS}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ⏹️ Stop
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message or record audio..."
            disabled={pending}
            style={{ flex: 1 }}
          />
          <button
            onMouseDown={handleRecordStart}
            onMouseUp={handleRecordStop}
            onMouseLeave={handleRecordStop}
            onTouchStart={handleRecordStart}
            onTouchEnd={handleRecordStop}
            disabled={pending || isTranscribing}
            style={{
              padding: '10px',
              backgroundColor: isRecording ? '#f44336' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (pending || isTranscribing) ? 'not-allowed' : 'pointer',
              minWidth: '50px',
              opacity: (pending || isTranscribing) ? 0.5 : 1,
              userSelect: 'none'
            }}
            title={isRecording ? "Recording... (Release to stop)" : "Hold to record audio"}
          >
            {isRecording ? '🔴' : '🎤'}
          </button>
        </div>
        {(isRecording || isTranscribing) && (
          <div style={{ color: '#2196F3', fontStyle: 'italic', margin: '5px 0' }}>
            {isRecording && '🔴 Recording...'}
            {isTranscribing && '📝 Transcribing...'}
          </div>
        )}
        <div>
          <button onClick={send} disabled={pending || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

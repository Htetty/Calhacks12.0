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

export default function OnboardingScreen() {
  // Visual-only simulated states
  const [canvasState, setCanvasState] = useState("idle"); // idle | connecting | connected | error
  const [googleState, setGoogleState] = useState("idle"); // idle | connecting | connected | error
  const [canvasName] = useState("student@university.edu");
  const [googleName] = useState("student@gmail.com");

  // Right card UI
  const [previewOpen, setPreviewOpen] = useState(false);
  const [howWorksOpen, setHowWorksOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  // FERPA & data management
  const [showFerpa, setShowFerpa] = useState(false);
  const [ferpaChecked, setFerpaChecked] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Modal refs for focus trap
  const previewRef = useRef(null);
  const howWorksRef = useRef(null);
  const ferpaRef = useRef(null);
  const exportRef = useRef(null);
  const deleteRef = useRef(null);

  const modalOpen =
    previewOpen || howWorksOpen || showFerpa || exportOpen || deleteOpen;

  // Lock background scroll & interactions
  useBodyModalClass(modalOpen);

  // Focus trap on whichever modal is open
  const activeModalRef = useMemo(() => {
    if (showFerpa) return ferpaRef;
    if (previewOpen) return previewRef;
    if (howWorksOpen) return howWorksRef;
    if (exportOpen) return exportRef;
    if (deleteOpen) return deleteRef;
    return null;
  }, [showFerpa, previewOpen, howWorksOpen, exportOpen, deleteOpen]);
  useFocusTrap(!!activeModalRef, activeModalRef || { current: null });

  // First-use FERPA
  useEffect(() => {
    const accepted = localStorage.getItem("ferpaConsentAccepted") === "true";
    if (!accepted) setShowFerpa(true);
  }, []);

  function acceptFerpa() {
    localStorage.setItem("ferpaConsentAccepted", "true");
    setShowFerpa(false);
  }

  // Simulated UI flows
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

  return (
    <div className="onboarding-container" role="main" aria-label="Onboarding">
      {/* Wrap page content so we can aria-hide + inert while any modal is open */}
      <div
        className="page-content"
        aria-hidden={modalOpen ? "true" : "false"}
        {...(modalOpen ? { inert: "" } : {})}
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
                <h2>StudyAI</h2>
              </div>
            </div>

            <p className="subheader">Connect a service to get started:</p>
            <div className="divider"></div>

            {(canvasState === "connecting" || googleState === "connecting") && (
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
                onClick={() => (canvasState === "idle" ? simulateConnect("canvas") : null)}
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

              {/* Privacy tooltip */}
              <div className="info-tooltip" role="button" tabIndex={0} aria-label="Privacy information">
                i
                <div className="tooltip-panel" role="tooltip">
                  We may request permission to read Canvas assignments and Gmail messages.
                  You must approve scopes. We will never send messages without your confirmation.
                </div>
              </div>
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
                onClick={() => (googleState === "idle" ? simulateConnect("google") : null)}
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

              {/* Privacy tooltip */}
              <div className="info-tooltip" role="button" tabIndex={0} aria-label="Privacy information">
                i
                <div className="tooltip-panel" role="tooltip">
                  We may request permission to read Canvas assignments and Gmail messages.
                  You must approve scopes. We will never send messages without your confirmation.
                </div>
              </div>
            </div>

            {googleState === "error" && (
              <div className="inline-error" role="alert">
                Connection failed. <button className="retry-link" onClick={() => resetService("google")}>Try again</button>.
              </div>
            )}
          </div>

          <div className="bottom-section">
            <div className="divider"></div>
            <p className="footer-text">
              Built with Creao.{" "}
              {/* Button, not anchor, to avoid accidental navigation */}
              <button
                className="footer-link"
                onClick={() => setHowWorksOpen(true)}
                aria-label="Open How it works modal"
                type="button"
              >
                How it works
              </button>
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

      {howWorksOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="How it works modal">
          <div className="modal-card" ref={howWorksRef}>
            <div className="modal-header">
              <h4>How it works</h4>
              <button className="icon-btn" aria-label="Close" onClick={() => setHowWorksOpen(false)} type="button">✕</button>
            </div>
            <div className="modal-body">
              <p>
                You can connect learning tools so the assistant can read assignments and draft emails on your behalf —
                only after you review and approve requested permissions. You’re always in control.
              </p>
              <ul className="bullet-list">
                <li>Review exactly what’s requested before you proceed.</li>
                <li>Read-only by default; sending actions require explicit confirmation.</li>
                <li>You can disconnect any time from the Manage menu.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setHowWorksOpen(false)} aria-label="Close" type="button">Got it</button>
            </div>
          </div>
        </div>
      )}

      {showFerpa && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="FERPA consent">
          <div className="modal-card" ref={ferpaRef}>
            <div className="modal-header">
              <h4>Consent & Student Privacy</h4>
              <button className="icon-btn" aria-label="Close" onClick={() => setShowFerpa(false)} type="button">✕</button>
            </div>
            <div className="modal-body">
              <p className="ferpa-copy">
                I consent to allow <strong>StudyAI</strong> to read my Canvas assignments and Gmail content
                for the purpose of generating suggestions. I understand nothing will be sent or posted
                without my explicit approval.
              </p>
              <div className="ferpa-controls">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={ferpaChecked}
                    onChange={(e) => setFerpaChecked(e.target.checked)}
                  />
                  <span>
                    I agree to the above and the{" "}
                    <button
                      className="policy-link"
                      type="button"
                      onClick={() => setHowWorksOpen(true)}
                      aria-label="Open Privacy Policy details"
                    >
                      Privacy Policy
                    </button>.
                  </span>
                </label>
              </div>
              <div className="ferpa-actions">
                <button className="secondary-btn" onClick={() => setExportOpen(true)} aria-label="Export my data" type="button">
                  Export my data
                </button>
                <button className="secondary-btn danger" onClick={() => setDeleteOpen(true)} aria-label="Delete my data" type="button">
                  Delete my data
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="primary-btn"
                onClick={acceptFerpa}
                disabled={!ferpaChecked}
                aria-disabled={!ferpaChecked}
                aria-label="Accept"
                type="button"
              >
                Accept
              </button>
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
              <p>In a real app, you’d confirm this action and receive a deletion receipt.</p>
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

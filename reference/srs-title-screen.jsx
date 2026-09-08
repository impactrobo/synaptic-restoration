import React, { useState, useEffect } from "react";

const VOID = "#06070B";
const PLATE = "#12161F";
const STEEL = "#2A3342";
const BONE = "#E6EEF7";
const DIM = "#5B6980";
const AMBER = "#FFAE1A";
const MAGENTA = "#FF2E88";
const CYAN = "#31E5FF";

function MenuButton({ label, hint, edge, fill, text, onClick }) {
  const [down, setDown] = useState(false);
  return (
    <button
      className="mb"
      onClick={onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        width: "100%",
        background: fill,
        border: `2px solid ${edge}`,
        borderRadius: 4,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
        transform: down ? "translateX(4px)" : "translateX(0)",
        transition: "transform 90ms linear",
      }}
    >
      <span
        style={{
          color: text,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 3,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {label}
      </span>
      <span style={{ color: edge, fontSize: 10, letterSpacing: 1.5, fontFamily: "ui-monospace, monospace" }}>
        {hint}
      </span>
    </button>
  );
}

export default function TitleScreen() {
  const [reviews, setReviews] = useState(0);
  const [note, setNote] = useState(null);
  const target = 12480;

  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1100);
      const eased = 1 - Math.pow(1 - p, 3);
      setReviews(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ping = (m) => {
    setNote(m);
    setTimeout(() => setNote(null), 1300);
  };

  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

  return (
    <div
      style={{
        background: VOID,
        minHeight: "100vh",
        padding: "18px 16px 24px",
        fontFamily: mono,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        .mb:focus-visible { outline:2px solid #E6EEF7; outline-offset:3px; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes spinrev { to { transform: rotate(-360deg) } }
        @keyframes breathe { 0%,100%{opacity:.35} 50%{opacity:.9} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:.15} }
        .ring { animation: spin 22s linear infinite; }
        .ring2 { animation: spinrev 34s linear infinite; }
        .breathe { animation: breathe 3.4s ease-in-out infinite; }
        .blink { animation: blink 1.4s step-end infinite; }
        .grid { position:absolute; inset:0; pointer-events:none;
          background-image: linear-gradient(#31E5FF14 1px, transparent 1px), linear-gradient(90deg, #31E5FF14 1px, transparent 1px);
          background-size: 32px 32px; mask-image: radial-gradient(ellipse at 50% 42%, #000 20%, transparent 72%); }
        .scan { position:absolute; inset:0; pointer-events:none;
          background: repeating-linear-gradient(to bottom, #ffffff08 0 1px, transparent 1px 3px); }
        @media (prefers-reduced-motion: reduce) { .ring,.ring2,.breathe,.blink { animation: none } }
      `}</style>

      <div className="grid" />
      <div className="scan" />

      <div style={{ position: "relative", maxWidth: 420, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: DIM, letterSpacing: 1.5 }}>
          <span>
            <span className="blink" style={{ color: CYAN }}>
              ●
            </span>{" "}
            LINK STABLE
          </span>
          <span>SRS v0.1.0 // NODE-01</span>
        </div>

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <div style={{ color: MAGENTA, fontSize: 10, letterSpacing: 6 }}>SYNAPTIC</div>
          <div
            style={{
              color: BONE,
              fontSize: 46,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 0.92,
              marginTop: 2,
              textShadow: `2px 0 ${MAGENTA}, -2px 0 ${CYAN}`,
            }}
          >
            RESTORATION
          </div>
          <div style={{ color: BONE, fontSize: 22, fontWeight: 700, letterSpacing: 12, marginTop: 4 }}>SYSTEM</div>
        </div>

        <div style={{ position: "relative", height: 220, margin: "18px 0 22px" }}>
          <svg viewBox="0 0 220 220" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <g className="ring" style={{ transformOrigin: "110px 110px" }}>
              <circle cx="110" cy="110" r="96" fill="none" stroke={STEEL} strokeWidth="1" />
              <circle
                cx="110"
                cy="110"
                r="96"
                fill="none"
                stroke={CYAN}
                strokeWidth="2"
                strokeDasharray="34 26 8 40"
                opacity="0.85"
              />
            </g>
            <g className="ring2" style={{ transformOrigin: "110px 110px" }}>
              <circle
                cx="110"
                cy="110"
                r="78"
                fill="none"
                stroke={MAGENTA}
                strokeWidth="1.5"
                strokeDasharray="4 14"
                opacity="0.7"
              />
            </g>
            <polygon
              points="110,32 178,71 178,149 110,188 42,149 42,71"
              fill="#0A0E16"
              stroke={AMBER}
              strokeWidth="2"
            />
            <polygon
              points="110,44 168,77 168,143 110,176 52,143 52,77"
              fill="none"
              stroke={STEEL}
              strokeWidth="1"
            />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: AMBER, fontSize: 9, letterSpacing: 3 }}>TOTAL RECALL EVENTS</div>
            <div style={{ color: BONE, fontSize: 44, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>
              {reviews.toLocaleString()}
            </div>
            <div className="breathe" style={{ color: CYAN, fontSize: 10, letterSpacing: 2, marginTop: 4 }}>
              NEURAL INTEGRITY 94%
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MenuButton
            label="JACK IN"
            hint="61 DUE"
            fill="#0C1E2A"
            edge={CYAN}
            text={BONE}
            onClick={() => ping("Loading deck select")}
          />
          <MenuButton
            label="DECK BUILDER"
            hint="FORGE"
            fill="#22111C"
            edge={MAGENTA}
            text={BONE}
            onClick={() => ping("Opening deck builder")}
          />
          <MenuButton
            label="OPTIONS"
            hint="CONFIG"
            fill={PLATE}
            edge={STEEL}
            text={DIM}
            onClick={() => ping("Opening options")}
          />
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: DIM,
            letterSpacing: 1.5,
            borderTop: `1px solid ${STEEL}`,
            paddingTop: 10,
          }}
        >
          <span>OPERATOR / NAKK</span>
          <span style={{ color: AMBER }}>STREAK 06</span>
        </div>
      </div>

      {note && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 22,
            background: PLATE,
            border: `2px solid ${CYAN}`,
            color: BONE,
            fontSize: 12,
            letterSpacing: 2,
            padding: "10px 20px",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

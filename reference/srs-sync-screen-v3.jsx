import React, { useState, useRef, useEffect } from "react";

const VOID = "#06040D";
const PANEL = "#100B1C";
const STEEL = "#2E2545";
const BONE = "#DCF3FF";
const DIM = "#6E5F91";
const ACID = "#7CFF3E";
const VIOLET = "#A46BFF";
const CYAN = "#5EE9FF";
const FLARE = "#FFB03A";
const BLOOD = "#FF3B5C";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const RATINGS = {
  again: { label: "REJECT", calmLabel: "RETRY", code: "R-01", sub: "RESYNC <1m", edge: BLOOD, fill: "#210B14", calmEdge: DIM, calmFill: "#161022" },
  hard: { label: "STRAIN", calmLabel: "REACH", code: "R-02", sub: "T+2d", edge: FLARE, fill: "#231605", calmEdge: DIM, calmFill: "#161022" },
  good: { label: "SYNC", code: "R-03", sub: "T+6d", edge: ACID, fill: "#0D2005", calmEdge: ACID, calmFill: "#0D2005" },
  easy: { label: "ABSORB", code: "R-04", sub: "T+14d", edge: CYAN, fill: "#061F2A", calmEdge: ACID, calmFill: "#0D2005" },
};

const DECK = [
  { front: "木", reading: "ki / moku", meaning: "tree, wood" },
  { front: "山", reading: "yama / san", meaning: "mountain" },
  { front: "川", reading: "kawa / sen", meaning: "river" },
  { front: "火", reading: "hi / ka", meaning: "fire" },
  { front: "水", reading: "mizu / sui", meaning: "water" },
];

function Readout({ label, value, color, punch, critical }) {
  return (
    <div
      style={{
        flex: 1,
        background: PANEL,
        border: `1px solid ${STEEL}`,
        borderTop: `2px solid ${color}`,
        padding: "7px 10px",
        transform: punch ? "scale(1.05)" : "scale(1)",
        transition: "transform 130ms cubic-bezier(.2,1.6,.4,1)",
      }}
    >
      <div style={{ fontSize: 9, color: DIM, letterSpacing: 2 }}>{label}</div>
      <div className={critical ? "critical" : ""} style={{ fontSize: 23, fontWeight: 700, color, lineHeight: 1.15 }}>
        {value}
      </div>
    </div>
  );
}

function HazardBar() {
  return (
    <div className="hazard" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 34, overflow: "hidden", pointerEvents: "none" }}>
      <div
        className="stripes"
        style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, #FFB03A 0 10px, transparent 10px 22px)", opacity: 0.55 }}
      />
      <svg viewBox="0 0 40 36" style={{ position: "absolute", left: "50%", top: 2, width: 30, height: 28, transform: "translateX(-50%)" }}>
        <polygon points="20,3 37,33 3,33" fill={VOID} stroke={FLARE} strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points="20,11 30,29 10,29" fill="none" stroke="#FF7A2F" strokeWidth="2" strokeLinejoin="round" />
        <rect x="18.6" y="15" width="2.8" height="8" rx="1.4" fill={FLARE} />
        <circle cx="20" cy="26" r="1.7" fill={FLARE} />
      </svg>
    </div>
  );
}

function Toggle({ on, onClick, color }) {
  return (
    <button
      className="b"
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 52,
        height: 25,
        border: `1px solid ${on ? color : STEEL}`,
        background: on ? "#0D2005" : "#181125",
        cursor: "pointer",
        padding: 3,
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 17, height: 17, background: on ? color : DIM, transition: "background 130ms" }} />
    </button>
  );
}

export default function SyncScreen() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [due, setDue] = useState(61);
  const [streak, setStreak] = useState(6);
  const [reviewed, setReviewed] = useState(0);
  const [integrity, setIntegrity] = useState(94);
  const [pressed, setPressed] = useState(null);
  const [alarm, setAlarm] = useState(false);
  const [punch, setPunch] = useState(false);
  const [glow, setGlow] = useState(false);
  const [pops, setPops] = useState([]);
  const [showOpts, setShowOpts] = useState(false);
  const [binary, setBinary] = useState(false);
  const [calm, setCalm] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [elapsed, setElapsed] = useState(0);
  const [lost, setLost] = useState(false);
  const [recovery, setRecovery] = useState(0);
  const [lostFlash, setLostFlash] = useState(false);
  const popId = useRef(0);

  const card = DECK[idx % DECK.length];
  const keys = binary ? ["again", "good"] : ["again", "hard", "good", "easy"];
  const overtime = !calm && threshold > 0 && elapsed >= threshold;
  const integColor = integrity <= 30 ? BLOOD : integrity <= 60 ? FLARE : ACID;
  const integCritical = integrity <= 15;

  useEffect(() => {
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [idx, flipped]);

  useEffect(() => {
    if (!punch) return;
    const t = setTimeout(() => setPunch(false), 150);
    return () => clearTimeout(t);
  }, [punch]);

  useEffect(() => {
    if (!alarm) return;
    const t = setTimeout(() => setAlarm(false), 520);
    return () => clearTimeout(t);
  }, [alarm]);

  useEffect(() => {
    if (!glow) return;
    const t = setTimeout(() => setGlow(false), 700);
    return () => clearTimeout(t);
  }, [glow]);

  useEffect(() => {
    if (!lostFlash) return;
    const t = setTimeout(() => setLostFlash(false), 1600);
    return () => clearTimeout(t);
  }, [lostFlash]);

  const addPop = (text, color) => {
    const id = popId.current++;
    setPops((p) => [...p, { id, text, color }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 850);
  };

  const rate = (key) => {
    setPressed(key);
    setTimeout(() => setPressed(null), 110);
    if (key === "again") {
      setStreak(0);
      setRecovery(0);
      if (!lost) {
        setIntegrity((v) => {
          const next = Math.max(0, v - 6);
          if (next === 0) {
            setLost(true);
            if (!calm) setLostFlash(true);
          }
          return next;
        });
      }
      if (!calm) {
        setAlarm(true);
        addPop(lost ? "NO SIGNAL" : "SYNC LOST", BLOOD);
      }
    } else {
      const next = streak + 1;
      setStreak(next);
      if (lost) {
        const r = recovery + 1;
        if (r >= 3) {
          setLost(false);
          setRecovery(0);
          setIntegrity(25);
          if (calm) setGlow(true);
          else addPop("LINK RESTORED", ACID);
        } else {
          setRecovery(r);
          if (calm) setGlow(true);
          else addPop(`RELINK ${r}/3`, CYAN);
        }
      } else {
        setIntegrity((v) => Math.min(100, v + 1));
        if (calm) {
          setGlow(true);
        } else {
          setPunch(true);
          addPop(next % 5 === 0 ? `CHAIN ×${next}` : "+1 TRACE", RATINGS[key].edge);
        }
      }
    }
    setReviewed((r) => r + 1);
    setDue((d) => Math.max(0, d - 1));
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  const cardTop = calm ? (flipped ? ACID : STEEL) : flipped ? ACID : VIOLET;

  return (
    <div style={{ background: VOID, minHeight: "100vh", padding: "14px 14px 22px", fontFamily: MONO, position: "relative", overflow: "hidden" }}>
      <style>{`
        .b:focus-visible { outline:2px solid #DCF3FF; outline-offset:3px; }
        @keyframes jolt { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-6px)} 35%{transform:translateX(5px)} 55%{transform:translateX(-3px)} 75%{transform:translateX(2px)} }
        @keyframes flash { 0%,100%{opacity:0} 20%,60%{opacity:.45} }
        @keyframes rise { 0%{opacity:0;transform:translate(-50%,12px)} 25%{opacity:1;transform:translate(-50%,-4px)} 100%{opacity:0;transform:translate(-50%,-44px)} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:.2} }
        @keyframes slide { to { background-position: 44px 0 } }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.85} }
        @keyframes edgeglow { 0%{opacity:0} 22%{opacity:1} 100%{opacity:0} }
        @keyframes critflash { 0%,100%{opacity:1} 50%{opacity:.15} }
        @keyframes lostin { 0%{opacity:0} 8%{opacity:1} 82%{opacity:1} 100%{opacity:0} }
        @keyframes glitch { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,1px)} 40%{transform:translate(3px,-1px)} 60%{transform:translate(-2px,-2px)} 80%{transform:translate(2px,2px)} }
        @keyframes bars { to { background-position: 0 18px } }
        .lost { position:fixed; inset:0; z-index:20; pointer-events:none; background:#06040DEE; display:flex; align-items:center; justify-content:center; animation: lostin 1600ms ease-out forwards; }
        .lostbars { position:absolute; inset:0; background: repeating-linear-gradient(to bottom, #FF3B5C22 0 2px, transparent 2px 9px); animation: bars 340ms linear infinite; }
        .losttext { animation: glitch 220ms steps(2,end) infinite; text-align:center; }
        .critical { animation: critflash 700ms steps(1,end) infinite; }
        .jolt { animation: jolt 300ms ease-in-out; }
        .alarm { position:absolute; inset:0; pointer-events:none; background:#FF3B5C; animation: flash 520ms ease-out; mix-blend-mode:screen; }
        .edge { position:fixed; inset:0; pointer-events:none; z-index:9; animation: edgeglow 700ms ease-out forwards;
          box-shadow: inset 0 0 3px #7CFF3E, inset 0 0 22px #7CFF3E88, inset 0 0 70px #7CFF3E33; }
        .pop { position:absolute; left:50%; top:2px; animation: rise 850ms ease-out forwards; font-size:15px; font-weight:700; letter-spacing:2px; pointer-events:none; z-index:5; }
        .blink { animation: blink 1.5s step-end infinite; }
        .stripes { animation: slide 1.1s linear infinite; }
        .hazard { animation: pulse 1.6s ease-in-out infinite; }
        .scan { position:absolute; inset:0; pointer-events:none; background: repeating-linear-gradient(to bottom, #ffffff06 0 1px, transparent 1px 3px); }
        @media (prefers-reduced-motion: reduce) { .jolt,.alarm,.pop,.blink,.stripes,.hazard,.edge,.critical,.lostbars,.losttext { animation:none } }
      `}</style>

      <div className="scan" />
      {alarm && <div className="alarm" />}
      {glow && <div className="edge" />}
      {lostFlash && (
        <div className="lost">
          <div className="lostbars" />
          <div className="losttext" style={{ position: "relative" }}>
            <div style={{ color: BLOOD, fontSize: 11, letterSpacing: 6, marginBottom: 8 }}>◤ SIGNAL FAILURE ◥</div>
            <div style={{ color: BONE, fontSize: 30, fontWeight: 800, letterSpacing: 2, textShadow: `2px 0 ${BLOOD}, -2px 0 ${CYAN}` }}>
              CONNECTION LOST
            </div>
            <div style={{ color: DIM, fontSize: 10, letterSpacing: 3, marginTop: 12 }}>
              3 CLEAN RECALLS TO RELINK
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 420, margin: "0 auto", position: "relative" }} className={alarm ? "jolt" : ""}>
        {pops.map((p) => (
          <div key={p.id} className="pop" style={{ color: p.color }}>
            {p.text}
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 10 }}>
          <span>
            <span className="blink" style={{ color: calm ? ACID : lost ? BLOOD : alarm ? BLOOD : ACID }}>■</span>{" "}
            {calm ? "QUIET SESSION" : lost ? "LINK SEVERED" : "SESSION ACTIVE"}
          </span>
          <button
            className="b"
            onClick={() => setShowOpts((s) => !s)}
            style={{ background: "none", border: `1px solid ${STEEL}`, color: showOpts ? CYAN : DIM, fontSize: 9, letterSpacing: 2, padding: "4px 9px", cursor: "pointer", fontFamily: MONO }}
          >
            CONFIG
          </button>
        </div>

        {showOpts && (
          <div style={{ background: PANEL, border: `1px solid ${STEEL}`, borderLeft: `3px solid ${calm ? ACID : VIOLET}`, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ color: calm ? ACID : VIOLET, fontSize: 9, letterSpacing: 3, marginBottom: 12 }}>OPERATOR CONFIG</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ paddingRight: 10 }}>
                <div style={{ color: BONE, fontSize: 11, letterSpacing: 2 }}>BINARY LOG MODE</div>
                <div style={{ color: DIM, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>REJECT / SYNC ONLY</div>
              </div>
              <Toggle on={binary} onClick={() => setBinary((v) => !v)} color={ACID} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ paddingRight: 10 }}>
                <div style={{ color: BONE, fontSize: 11, letterSpacing: 2 }}>CALM INTERFACE</div>
                <div style={{ color: DIM, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>NO CHAINS, NO ALARMS, NO HAZARDS</div>
              </div>
              <Toggle on={calm} onClick={() => setCalm((v) => !v)} color={ACID} />
            </div>

            <div style={{ borderTop: `1px solid ${STEEL}`, paddingTop: 10, opacity: calm ? 0.35 : 1, pointerEvents: calm ? "none" : "auto" }}>
              <div style={{ color: BONE, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>HAZARD THRESHOLD</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[15, 60, 0].map((v) => (
                  <button
                    key={v}
                    className="b"
                    onClick={() => setThreshold(v)}
                    style={{
                      flex: 1,
                      background: threshold === v ? "#231605" : "#181125",
                      border: `1px solid ${threshold === v ? FLARE : STEEL}`,
                      color: threshold === v ? FLARE : DIM,
                      fontSize: 10,
                      letterSpacing: 1,
                      padding: "7px 0",
                      cursor: "pointer",
                      fontFamily: MONO,
                    }}
                  >
                    {v === 0 ? "OFF" : `${v}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <Readout label="QUEUE" value={due} color={calm ? DIM : CYAN} />
          {calm ? (
            <Readout label="DONE" value={reviewed} color={ACID} />
          ) : (
            <Readout label="CHAIN" value={streak} color={VIOLET} punch={punch} />
          )}
          {!calm &&
            (lost ? (
              <Readout label="RELINK" value={`${recovery}/3`} color={BLOOD} critical />
            ) : (
              <Readout label="INTEG" value={`${integrity}%`} color={integColor} critical={integCritical} />
            ))}
        </div>

        <button
          className="b"
          onClick={() => setFlipped((f) => !f)}
          style={{
            width: "100%",
            background: PANEL,
            border: `1px solid ${STEEL}`,
            borderTop: overtime ? "none" : `3px solid ${cardTop}`,
            minHeight: 250,
            padding: overtime ? "44px 22px 22px" : 22,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)",
          }}
        >
          {overtime && <HazardBar />}

          <div style={{ position: "absolute", top: overtime ? 40 : 8, left: 10, fontSize: 9, color: DIM, letterSpacing: 2 }}>
            NODE {String(idx + 1).padStart(3, "0")}
          </div>
          <div style={{ position: "absolute", top: overtime ? 40 : 8, right: 10, fontSize: 9, color: overtime ? FLARE : calm ? DIM : flipped ? ACID : VIOLET, letterSpacing: 2 }}>
            {overtime ? `LATENCY ${elapsed}s` : flipped ? "DECRYPTED" : "ENCRYPTED"}
          </div>

          {flipped ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, color: BONE, letterSpacing: 1 }}>{card.reading}</div>
              <div style={{ fontSize: 15, color: DIM, marginTop: 8, letterSpacing: 1 }}>{card.meaning}</div>
            </>
          ) : (
            <div style={{ fontSize: 76, fontWeight: 700, color: BONE, lineHeight: 1 }}>{card.front}</div>
          )}

          <div style={{ position: "absolute", bottom: 10, fontSize: 9, color: overtime ? FLARE : DIM, letterSpacing: 2 }}>
            {overtime ? "LONG RESPONSE DETECTED" : flipped ? "LOG RECALL QUALITY" : "TAP TO DECRYPT"}
          </div>
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: 6,
            marginTop: 12,
            opacity: flipped ? 1 : 0.28,
            pointerEvents: flipped ? "auto" : "none",
            transition: "opacity 150ms",
          }}
        >
          {keys.map((k) => {
            const r = RATINGS[k];
            const edge = calm ? r.calmEdge : r.edge;
            const fill = calm ? r.calmFill : r.fill;
            return (
              <button
                key={k}
                className="b"
                onClick={() => rate(k)}
                style={{
                  background: fill,
                  border: `1px solid ${STEEL}`,
                  borderLeft: `3px solid ${edge}`,
                  padding: "12px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                  transform: pressed === k ? "translateX(5px)" : "translateX(0)",
                  transition: "transform 90ms linear",
                }}
              >
                <div style={{ fontSize: 8, color: DIM, letterSpacing: 2 }}>{r.code}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: edge, letterSpacing: 2 }}>
                  {calm && r.calmLabel ? r.calmLabel : r.label}
                </div>
                <div style={{ fontSize: 9, color: DIM, letterSpacing: 1, marginTop: 2 }}>{r.sub}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: `1px solid ${STEEL}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: DIM,
            letterSpacing: 2,
          }}
        >
          <span>OPERATOR / NAKK</span>
          <span>FSRS-6 // ADAPTIVE</span>
        </div>
      </div>
    </div>
  );
}

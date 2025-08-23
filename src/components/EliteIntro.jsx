// src/components/EliteIntro.jsx
import React from "react";

/**
 * Props:
 *  - duration (ms)       default 2600
 *  - onFinish(fn)
 *  - logoSrc (string)    optional PNG/SVG; else uses inline crest
 *  - appName (string)
 *  - primary, secondary (colors)
 *  - tagline (string)
 *  - defaultOpen (bool)
 *  - autoDismiss (bool)  default true — set false to require click
 *  - forceFullscreen (bool) default false — if true, requests fullscreen on click
 */
export default function EliteIntro({
  duration = 2600,
  onFinish,
  logoSrc,
  appName = "Elite Player Manager",
  primary = "#111111",
  secondary = "#6EC1FF",
  tagline = "ELITE PLAYER MANAGER",
  defaultOpen = true,
  autoDismiss = true,
  forceFullscreen = false,
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [progress, setProgress] = React.useState(0);

  // progress bar
  React.useEffect(() => {
    if (!open) return;
    const total = Math.max(duration, 800);
    const start = performance.now();
    let raf = 0;
    const tick = (t) => {
      const pct = Math.min(100, ((t - start) / total) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, duration]);

  // auto close (only if allowed)
  React.useEffect(() => {
    if (!open || !autoDismiss) return;
    const timer = setTimeout(() => handleFinish(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration, autoDismiss]);

  function attemptFullscreen() {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) return; // already fullscreen
      const req =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen;
      if (req) req.call(el);
    } catch (_) {}
  }

  function handleFinish(viaClick) {
    if (viaClick && forceFullscreen) attemptFullscreen(); // user gesture => allowed
    setOpen(false);
    onFinish && onFinish();
  }

  if (!open) return null;

  return (
    <div style={styles.backdrop()}>
      <div style={styles.sheet(primary, secondary)} aria-hidden />

      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <Logo primary={primary} secondary={secondary} logoSrc={logoSrc} />
            <div style={styles.logoGlow(primary)} aria-hidden />
          </div>

          <h1 style={styles.title}>{appName}</h1>
          {tagline ? <p style={styles.tagline}>{tagline}</p> : null}

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressBar,
                background: primary,
                width: `${Math.round(progress)}%`,
              }}
            />
          </div>

          <div style={styles.btnRow}>
            <button style={styles.btnPrimary} onClick={() => handleFinish(true)}>
              Enter app
            </button>
            <button style={styles.btnGhost} onClick={() => handleFinish(true)}>
              Skip
            </button>
          </div>
        </div>
      </div>

      <Particles primary={primary} />
      <style>{keyframes}</style>
    </div>
  );
}

function Logo({ logoSrc, primary, secondary }) {
  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt="App logo"
        draggable={false}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          filter: "drop-shadow(0 6px 24px rgba(0,0,0,.45))",
        }}
      />
    );
  }
  return (
    <svg viewBox="0 0 128 128" role="img" aria-label="EPM logo" style={{ width: 128, height: 128 }}>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M64 8l40 12v36c0 31.5-20.6 48.7-39.3 56.9a6 6 0 0 1-4.9 0C41.1 104.7 24 87.5 24 56V20l40-12z"
        fill="#0b1220" stroke="url(#g1)" strokeWidth="3" filter="url(#glow)" />
      <path d="M64 30l4.2 12.9h13.6L70.8 51l4.2 12.9L64 56.1 52.9 63.9 57.2 51 46.2 42.9h13.6L64 30z"
        fill="url(#g1)" opacity="0.9" />
      <g fill="none" stroke="white" strokeWidth="5" strokeLinecap="round">
        <path d="M38 84h18c6 0 10-4 10-10s-4-10-10-10H38v20z" />
        <path d="M66 64h24" />
        <path d="M66 84h24" />
      </g>
    </svg>
  );
}

function Particles({ primary }) {
  const items = Array.from({ length: 16 });
  return (
    <div style={styles.particlesWrap} aria-hidden>
      {items.map((_, i) => {
        const delay = i * 0.15;
        const duration = 6 + (i % 5);
        return (
          <span
            key={i}
            style={{
              ...styles.particle(primary),
              left: `${(i * 61) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animation: `epm_float_${i} ${duration}s ease-in-out ${delay}s infinite alternate`,
            }}
          />
        );
      })}
      <style>
        {Array.from({ length: 16 })
          .map((_, i) => {
            const dx = ((i * 13) % 18) + 6;
            const dy = ((i * 17) % 22) + 8;
            return `@keyframes epm_float_${i}{
              from{ transform: translate3d(0,0,0); opacity:.35 }
              to{ transform: translate3d(${dx}px, -${dy}px, 0); opacity:.7 }
            }`;
          })
          .join("\n")}
      </style>
    </div>
  );
}

/* ---------- styles ---------- */
const styles = {
  backdrop: () => ({
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    color: "#fff",
    overflow: "hidden",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,255,255,0.06), transparent 60%), radial-gradient(1200px 800px at 80% 80%, rgba(255,255,255,0.05), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.8))",
    animation: "epm_fade_in 320ms ease-out",
  }),
  sheet: (primary, secondary) => ({
    position: "absolute",
    left: "-96px",
    right: "-96px",
    top: "-96px",
    bottom: "-96px",
    pointerEvents: "none",
    opacity: 0.5,
    filter: "blur(40px)",
    background: `conic-gradient(from 140deg at 50% 50%, ${primary}, ${secondary}, ${primary})`,
    WebkitMaskImage:
      "radial-gradient(closest-side, rgba(0,0,0,0.33) 40%, transparent 65%)",
    maskImage:
      "radial-gradient(closest-side, rgba(0,0,0,0.33) 40%, transparent 65%)",
  }),
  center: {
    position: "relative",
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
  },
  logoWrap: {
    position: "relative",
    animation: "epm_pop 480ms cubic-bezier(.2,.9,.25,1)",
  },
  logoGlow: (primary) => ({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    borderRadius: "999px",
    filter: "blur(32px)",
    opacity: 0.6,
    background: `radial-gradient(40% 40% at 50% 50%, ${primary}, transparent)`,
  }),
  title: {
    fontSize: "clamp(22px, 2.5vw, 28px)",
    fontWeight: 600,
    letterSpacing: 0.2,
    textShadow: "0 1px 12px rgba(255,255,255,0.08)",
    animation: "epm_slide_up 420ms ease-out 120ms both",
    margin: 0,
  },
  tagline: {
    color: "rgba(229,231,235,.9)",
    fontSize: "clamp(13px, 2vw, 16px)",
    margin: 0,
    animation: "epm_slide_up 420ms ease-out 220ms both",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,.12)",
    overflow: "hidden",
    marginTop: 4,
    animation: "epm_fade_in 300ms ease-out 250ms both",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    width: "0%",
    transition: "width 120ms linear",
  },
  btnRow: {
    display: "flex",
    gap: 12,
    marginTop: 8,
    animation: "epm_fade_in 300ms ease-out 380ms both",
  },
  btnPrimary: {
    padding: "10px 16px",
    borderRadius: 16,
    background: "#fff",
    color: "#111",
    fontWeight: 600,
    border: "none",
    boxShadow: "0 10px 20px rgba(0,0,0,.2)",
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    fontWeight: 600,
    border: "none",
    backdropFilter: "blur(6px)",
    cursor: "pointer",
  },
  particlesWrap: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  particle: (primary) => ({
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 999,
    opacity: 0.4,
    background: primary,
  }),
};

const keyframes = `
@keyframes epm_fade_in { from { opacity: 0 } to { opacity: 1 } }
@keyframes epm_pop {
  0% { opacity: 0; transform: scale(.9); filter: blur(4px) }
  100% { opacity: 1; transform: scale(1); filter: blur(0) }
}
@keyframes epm_slide_up {
  0% { opacity: 0; transform: translateY(12px) }
  100% { opacity: 1; transform: translateY(0) }
}
`;

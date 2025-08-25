// src/components/designer/ItemGraphic.jsx
import React from "react";

const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const pctToPx = (pct, stageW) => (stageW * (Number(pct || 0) / 100));
const rgba = (hex, a = 1) => {
  const m = String(hex || "#ffffff").replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0").slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// safety helpers to avoid negative/zero SVG sizes
const clamp = (n, min, max = Infinity) => Math.max(min, Math.min(max, Number(n) || 0));
const safePx = (px, min = 4) => clamp(px, min);

// alias mapping so legacy type strings render
const aliasType = (t) => {
  const s = String(t || "").toLowerCase();
  if (s === "pole" || s === "agility" || s === "agility-pole" || s === "slalom") return "slalom";
  if (s === "hurdle" || s === "hurdles") return "hurdle";
  if (s === "arrow") return "shape-arrow";
  if (s === "arrow-dashed" || s === "shape-arrow-dashed") return "shape-arrow-dashed";
  if (s === "arrow-2head" || s === "shape-arrow-2head" || s === "arrow-twohead") return "shape-arrow-2head";
  if (s === "curve-arrow" || s === "curve") return "shape-curve";
  if (s === "s-curve-arrow" || s === "curve2" || s === "s-curve") return "shape-curve2";
  return s;
};

// >>> NEW: dash helper (supports boolean `dashed` or `-dashed` type)
const dashArrayFor = (item) => {
  const sw = Math.max(1, Number(item?.strokeWidth) || 2);
  const dashed = !!item?.dashed || /-dashed$/i.test(String(item?.type || ""));
  if (!dashed) return undefined;
  const dash = Math.max(18, Math.round(sw * 6));
  const gap  = Math.max(12, Math.round(sw * 3.5));
  return `${dash} ${gap}`;
};

export default function ItemGraphic({ item, stageWidth = 800 }) {
  const t = aliasType(item?.type);
  const color = item?.color || item?.stroke || "#ffffff";
  const sw = Math.max(2, isNum(item?.strokeWidth) ? item.strokeWidth : 3);

  const Svg = ({ w, h, viewW = w, viewH = h, children }) => (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width={w} height={h}>
      {children}
    </svg>
  );

  /* ========= KIT ========= */
  if (t === "player") {
    const size = isNum(item.size) ? item.size : 36;
    return (
      <div
        style={{
          width: size, height: size, borderRadius: 9999, background: color,
          boxShadow: "0 2px 0 rgba(0,0,0,.25), inset 0 0 0 3px #fff",
          display: "grid", placeItems: "center", fontWeight: 700, fontSize: Math.max(10, size * 0.42), color: "#0b1a2b",
        }}
      >
        {item.label || ""}
      </div>
    );
  }

  // Telstar-style football (black/white with gloss)
  if (t === "ball") {
    const size = isNum(item.size) ? item.size : 18;
    const r = size / 2; const cx = r, cy = r;
    const pentagon = (RR, rot = -Math.PI / 2) => {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = rot + (i * 2 * Math.PI) / 5;
        pts.push(`${cx + Math.cos(a) * RR},${cy + Math.sin(a) * RR}`);
      }
      return pts.join(" ");
    };
    const surround = [];
    const outerR = r * 0.78; const patchR = r * 0.24;
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = cx + Math.cos(ang) * outerR; const py = cy + Math.sin(ang) * outerR;
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const a = ang + (k * 2 * Math.PI) / 5;
        pts.push(`${px + Math.cos(a) * patchR},${py + Math.sin(a) * patchR}`);
      }
      surround.push(<polygon key={i} points={pts.join(" ")} fill="#111" opacity="0.95" />);
    }
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="gBall" cx="30%" cy="28%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0f0f0" />
            <stop offset="100%" stopColor="#d6d6d6" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r - 0.5} fill="url(#gBall)" stroke="rgba(0,0,0,.55)" strokeWidth="0.8" />
        <polygon points={pentagon(r * 0.42)} fill="#111" opacity="0.98" />
        {surround}
        <ellipse cx={cx - r * 0.25} cy={cy - r * 0.28} rx={r * 0.42} ry={r * 0.28} fill="#ffffff" opacity="0.28" />
      </svg>
    );
  }

  if (t === "cone") {
    const size = isNum(item.size) ? item.size : 22;
    const w = size * 1.2, h = size * 1.1;
    return (
      <Svg w={w} h={h}>
        <path d={`M ${w/2} 2 L ${w-2} ${h-2} L 2 ${h-2} Z`} fill={item.color || "#ff8a34"} stroke="#00000055" strokeWidth="2" />
      </Svg>
    );
  }

  if (t === "marker") {
    const size = isNum(item.size) ? item.size : 14;
    return <div style={{ width: size, height: size, borderRadius: 9999, background: item.color || "#f4c430", boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,.35)" }} />;
  }

  if (t === "goal") {
    const w0 = isNum(item.size) ? item.size : 64;
    const w = Math.max(36, w0);
    const h = Math.round(w * 0.55);
    const post = Math.max(3, Math.round(w * 0.06));
    const netGap = Math.max(6, Math.round(w * 0.12));
    const netLines = [];
    for (let x = post + netGap; x <= w - post - 1; x += netGap) netLines.push(<line key={`nx${x}`} x1={x} y1={post} x2={x} y2={h - post} stroke="rgba(255,255,255,.35)" strokeWidth="1" />);
    for (let y = post + netGap; y <= h - post - 1; y += netGap) netLines.push(<line key={`ny${y}`} x1={post} y1={y} x2={w - post} y2={y} stroke="rgba(255,255,255,.35)" strokeWidth="1" />);
    return (
      <Svg w={w} h={h}>
        <rect x={post / 2} y={post / 2} width={w - post} height={h - post} fill="none" stroke="#ffffff" strokeWidth={post} style={{ vectorEffect: "non-scaling-stroke" }} />
        <g opacity={0.85}>
          <rect x={post} y={post} width={w - post*2} height={h - post*2} fill="none" stroke="#ffffff" strokeWidth={Math.max(1, post * 0.25)} style={{ vectorEffect: "non-scaling-stroke" }} />
          {netLines}
        </g>
      </Svg>
    );
  }

  if (t === "slalom") {
    const h = isNum(item.size) ? item.size : 56;
    const w = Math.max(6, Math.round(h * 0.11));
    return <div style={{ width: w, height: h, background: item.color || "#ffb703", borderRadius: Math.min(3, w / 2), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)" }} />;
  }

  if (t === "hurdle") {
    const w = isNum(item.size) ? item.size : 72;
    const bar = Math.max(6, Math.round(w * 0.08));
    const leg = Math.max(6, Math.round(w * 0.12));
    const h = bar + leg;
    return (
      <Svg w={w} h={h}>
        <rect x={0} y={0} width={w} height={bar} fill={item.color || "#e5e7eb"} />
        <rect x={2} y={bar} width={Math.max(4, w * 0.06)} height={leg} fill={item.color || "#e5e7eb"} />
        <rect x={w - Math.max(4, w * 0.06) - 2} y={bar} width={Math.max(4, w * 0.06)} height={leg} fill={item.color || "#e5e7eb"} />
      </Svg>
    );
  }

  /* ========= SHAPES (clamped) ========= */
  if (t === "shape-rect" || t === "shape-rect-outline") {
    const w0 = pctToPx(item.widthPct ?? 18, stageWidth);
    const h0 = pctToPx(item.heightPct ?? 10, stageWidth);
    const w = safePx(w0, 6), h = safePx(h0, 6);
    const r = Math.min(w, h) * 0.12;
    const fill = t === "shape-rect" ? rgba(item.fill || "#ffffff", item.fillAlpha ?? 0.12) : "none";
    return (
      <Svg w={w} h={h}>
        <rect
          x="1.5" y="1.5"
          width={safePx(w - 3, 1)}
          height={safePx(h - 3, 1)}
          rx={r}
          fill={fill} stroke={color} strokeWidth={sw}
          style={{ vectorEffect: "non-scaling-stroke" }}
          strokeDasharray={dashArrayFor(item)}   // ← added
        />
      </Svg>
    );
  }

  if (t === "shape-circle") {
    const r0 = pctToPx(item.sizePct ?? 10, stageWidth);
    const r = clamp(r0, sw + 2);
    const d = r * 2;
    return (
      <Svg w={d} h={d}>
        <circle cx={r} cy={r} r={Math.max(1, r - sw)}
          fill={rgba(item.fill || "#ffffff", item.fillAlpha ?? 0.12)}
          stroke={color} strokeWidth={sw}
          style={{ vectorEffect: "non-scaling-stroke" }}
          strokeDasharray={dashArrayFor(item)}   // ← added
        />
      </Svg>
    );
  }

  if (t === "shape-triangle") {
    const s0 = pctToPx(item.sizePct ?? 10, stageWidth);
    const s = safePx(s0, 8), w = s, h = Math.max(6, s * 0.88);
    const pts = `${w/2},2 ${w-2},${h-2} 2,${h-2}`;
    return (
      <Svg w={w} h={h}>
        <polygon points={pts}
          fill={rgba(item.fill || "#ffffff", item.fillAlpha ?? 0.12)}
          stroke={color} strokeWidth={sw}
          style={{ vectorEffect: "non-scaling-stroke" }}
          strokeDasharray={dashArrayFor(item)}   // ← added
        />
      </Svg>
    );
  }

  if (t === "shape-line" || t === "shape-line-dashed") {
  const len0 = pctToPx(item.lengthPct ?? 14, stageWidth);
  const len = safePx(len0, 8);
  const hh = Math.max(8, sw * 4);
  const dash = dashArrayFor(item); // <<< use same dash for halo + shaft
  return (
    <Svg w={len} h={hh}>
      {/* halo (also dashed so gaps are real) */}
      <line
        x1="0" y1={hh/2} x2={len} y2={hh/2}
        stroke="rgba(255,255,255,.65)"
        strokeWidth={sw + 2}
        strokeLinecap="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
        strokeDasharray={dash}
      />
      {/* shaft */}
      <line
        x1="0" y1={hh/2} x2={len} y2={hh/2}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
        strokeDasharray={dash}
      />
    </Svg>
  );
}


  const ArrowStraight = ({ dashed = false, twoHead = false }) => {
  const len = safePx(pctToPx(item.lengthPct ?? 14, stageWidth), 12);
  const hh = Math.max(10, sw * 5);
  const halo = sw + 2;
  const id = `arr_${item.id || Math.random().toString(36).slice(2)}`;
  const dash = dashArrayFor({ ...item, dashed }); // <<< use helper
  return (
    <Svg w={len} h={hh}>
      <defs>
        <marker id={`${id}_end`} markerUnits="strokeWidth" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill={color} />
        </marker>
        <marker id={`${id}_start`} markerUnits="strokeWidth" markerWidth="6" markerHeight="6" refX="0.5" refY="3" orient="auto">
          <polygon points="6,0 0,3 6,6" fill={color} />
        </marker>
      </defs>

      {/* halo (dashed too) */}
      <line
        x1="2" y1={hh/2} x2={len - 2} y2={hh/2}
        stroke="rgba(255,255,255,.65)"
        strokeWidth={halo}
        strokeLinecap="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
        strokeDasharray={dash}
      />

      {/* shaft */}
      <line
        x1="2" y1={hh/2} x2={len - 2} y2={hh/2}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
        strokeDasharray={dash}
        markerEnd={`url(#${id}_end)`}
        markerStart={twoHead ? `url(#${id}_start)` : undefined}
      />
    </Svg>
  );
};


  const ArrowCurve = ({ sCurve = false }) => {
    const len = safePx(pctToPx(item.lengthPct ?? 18, stageWidth), 12);
    const hh = Math.max(20, sw * 6);
    const mid = hh / 2;
    const halo = sw + 2;
    const id = `carr_${item.id || Math.random().toString(36).slice(2)}`;
    const d = sCurve
      ? `M 2 ${mid} C ${len*0.22} ${mid - mid*0.7}, ${len*0.22} ${mid + mid*0.7}, ${len*0.5} ${mid} S ${len*0.82} ${mid - mid*0.7}, ${len - 2} ${mid}`
      : `M 2 ${mid} Q ${len * 0.5} ${mid - mid * 0.7}, ${len - 2} ${mid}`;
    return (
      <Svg w={len} h={hh}>
        <defs>
          <marker id={`${id}_end`} markerUnits="strokeWidth" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
            <polygon points="0,0 6,3 0,6" fill={color} />
          </marker>
        </defs>
        <path d={d} fill="none" stroke="rgba(255,255,255,.65)" strokeWidth={halo} style={{ vectorEffect: "non-scaling-stroke" }} />
        <path d={d} fill="none" stroke={color} strokeWidth={sw} markerEnd={`url(#${id}_end)`} style={{ vectorEffect: "non-scaling-stroke" }} />
      </Svg>
    );
  };

  if (t === "shape-arrow")        return <ArrowStraight dashed={false} twoHead={false} />;
  if (t === "shape-arrow-dashed") return <ArrowStraight dashed={true}  twoHead={false} />;
  if (t === "shape-arrow-2head")  return <ArrowStraight dashed={false} twoHead={true}  />;
  if (t === "shape-curve")        return <ArrowCurve sCurve={false} />;
  if (t === "shape-curve2")       return <ArrowCurve sCurve={true}  />;

  return null;
}

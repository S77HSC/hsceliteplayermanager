import React from "react";
import { layoutById } from "../../utils/designer";

export default function PitchSVG({ pitchId, showGrid }) {
  const m = layoutById(pitchId);
  const { L, W } = m;
  const mid = W / 2;

  let L_TOP, L_BOT, R_TOP, R_BOT;
  if (m.drawStandard) {
    const R = m.circle, S = m.spot, d = m.paDepth;
    const dy = Math.sqrt(Math.max(0, R * R - (d - S) * (d - S)));
    L_TOP = { x: d, y: mid - dy }; L_BOT = { x: d, y: mid + dy };
    R_TOP = { x: L - d, y: mid - dy }; R_BOT = { x: L - d, y: mid + dy };
  }

  const V = 10, H = 6;

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${L} ${W}`} preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width={L} height={W} fill="#0b7d3b" />
      {m.drawStandard && (
        <g stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.96" shapeRendering="geometricPrecision">
          <rect x="0.5" y="0.5" width={L - 1} height={W - 1} />
          <line x1={L / 2} y1="0.5" x2={L / 2} y2={W - 0.5} />
          <circle cx={L / 2} cy={mid} r={m.circle} />
          <circle cx={L / 2} cy={mid} r="0.3" fill="#fff" />
          <rect x="0.5" y={mid - m.paWidth / 2} width={m.paDepth - 0.5} height={m.paWidth} />
          <rect x={L - m.paDepth} y={mid - m.paWidth / 2} width={m.paDepth - 0.5} height={m.paWidth} />
          <rect x="0.5" y={mid - m.gaWidth / 2} width={m.gaDepth - 0.5} height={m.gaWidth} />
          <rect x={L - m.gaDepth} y={mid - m.gaWidth / 2} width={m.gaDepth - 0.5} height={m.gaWidth} />
          <circle cx={m.spot} cy={mid} r="0.3" fill="#fff" />
          <circle cx={L - m.spot} cy={mid} r="0.3" fill="#fff" />
          <path d={`M ${L_TOP.x} ${L_TOP.y} A ${m.circle} ${m.circle} 0 0 1 ${L_BOT.x} ${L_BOT.y}`} />
          <path d={`M ${R_TOP.x} ${R_TOP.y} A ${m.circle} ${m.circle} 0 0 0 ${R_BOT.x} ${R_BOT.y}`} />
        </g>
      )}
      {m.drawFutsal && (
        <g stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.96" shapeRendering="geometricPrecision">
          <rect x="0.5" y="0.5" width={L - 1} height={W - 1} />
          <line x1={L / 2} y1="0.5" x2={L / 2} y2={W - 0.5} />
          <circle cx={L / 2} cy={mid} r={m.circle} />
          <rect x="5" y={mid - 12} width="10" height="24" />
          <rect x={L - 15} y={mid - 12} width="10" height="24" />
        </g>
      )}
      {showGrid && (
        <g opacity="0.2" stroke="#ffffff" strokeWidth="0.3" shapeRendering="crispEdges">
          {Array.from({ length: V - 1 }).map((_, i) => <line key={`v${i}`} x1={((i + 1) * L) / V} y1="0" x2={((i + 1) * L) / V} y2={W} />)}
          {Array.from({ length: H - 1 }).map((_, i) => <line key={`h${i}`} x1="0" y1={((i + 1) * W) / H} x2={L} y2={((i + 1) * W) / H} />)}
        </g>
      )}
    </svg>
  );
}

import React from "react";
import { hexToRGBA } from "../../utils/designer";

export function ArrowDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}

export default function ItemGraphic({ item, stageWidth }) {
  const px = (n) => n * (stageWidth / 1000);
  const pxW = (pct) => (pct / 100) * stageWidth;

  if (item.type?.startsWith("shape-")) {
    if (["shape-arrow","shape-curve","shape-curve2"].includes(item.type)) {
      const len = pxW(item.lengthPct || 24);
      const stroke = item.stroke || "#ffffff";
      const strokeWidth = Math.max(1, item.strokeWidth || 3);
      const dash = item.dashed ? "8 8" : "0";

      if (item.type === "shape-arrow") {
        return (
          <svg width={len} height={strokeWidth * 8} viewBox={`0 0 ${len} ${strokeWidth * 8}`} style={{ color: stroke }}>
            <line x1="0" y1={strokeWidth * 4} x2={len - 6} y2={strokeWidth * 4}
              stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash}
              markerEnd="url(#arrowHead)" strokeLinecap="round" />
          </svg>
        );
      }

      // curves
      const h = strokeWidth * 20;
      const mid = h / 2;
      const bend = (item.bendPct ?? 18) / 100 * h;
      let d = `M 0 ${mid} Q ${len/2} ${mid - bend}, ${len - 6} ${mid}`;
      if (item.type === "shape-curve2") {
        d = `M 0 ${mid} C ${len/4} ${mid - bend}, ${len/4} ${mid + bend}, ${len/2} ${mid}
             S ${len*3/4} ${mid - bend}, ${len - 6} ${mid}`;
      }
      return (
        <svg width={len} height={h} viewBox={`0 0 ${len} ${h}`} style={{ color: stroke }}>
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash}
            markerEnd="url(#arrowHead)" strokeLinecap="round" />
        </svg>
      );
    }

    // basic shapes
    if (["shape-line","shape-line-dashed"].includes(item.type)) {
      const len = pxW(item.lengthPct || 20);
      const stroke = item.stroke || "#ffffff";
      const strokeWidth = Math.max(1, item.strokeWidth || 2);
      const dash = item.dashed ? "8 8" : "0";
      return (
        <svg width={len} height={strokeWidth * 8} viewBox={`0 0 ${len} ${strokeWidth * 8}`}>
          <line x1="0" y1={strokeWidth * 4} x2={len} y2={strokeWidth * 4}
            stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" />
        </svg>
      );
    }
    if (["shape-rect","shape-rect-outline"].includes(item.type)) {
      const w = pxW(item.widthPct || 20);
      const h = pxW(item.heightPct || 12);
      const stroke = item.stroke || "#ffffff";
      const strokeWidth = Math.max(1, item.strokeWidth || 2);
      const fill = hexToRGBA(item.fill || "#ffffff", item.fillAlpha ?? 0.2);
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x="0" y="0" width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    }
    if (item.type === "shape-circle") {
      const r = pxW(item.radiusPct || 8);
      const d = r * 2;
      const stroke = item.stroke || "#ffffff";
      const strokeWidth = Math.max(1, item.strokeWidth || 2);
      const fill = hexToRGBA(item.fill || "#ffffff", item.fillAlpha ?? 0.2);
      return (
        <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
          <circle cx={r} cy={r} r={r - strokeWidth / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    }
    if (item.type === "shape-triangle") {
      const s = pxW(item.sizePct || 12);
      const stroke = item.stroke || "#ffffff";
      const strokeWidth = Math.max(1, item.strokeWidth || 2);
      const fill = hexToRGBA(item.fill || "#ffffff", item.fillAlpha ?? 0.2);
      const h = (Math.sqrt(3) / 2) * s;
      return (
        <svg width={s} height={h} viewBox={`0 0 ${s} ${h}`}>
          <polygon points={`${s / 2},0 ${s},${h} 0,${h}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    }
    return null;
  }

  // kit
  switch (item.type) {
    case "player":
      return (
        <div className="flex items-center justify-center rounded-full border-2 border-black/30 text-white font-bold"
             style={{ width: px(item.size), height: px(item.size), background: item.color }}>
          <span className="text-xs select-none" style={{ transform: "translateY(1px)" }}>{item.label || ""}</span>
        </div>
      );
    case "ball":
      return (
        <div className="rounded-full border border-black/70"
             style={{ width: px(item.size), height: px(item.size), background: item.color }}>
          <div className="w-full h-full grid place-items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black/70" />
          </div>
        </div>
      );
    case "cone":
      return (
        <div style={{ width: px(item.size), height: px(item.size) }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M50 5 L85 85 H15 Z" fill={item.color} stroke="#00000055" strokeWidth="3" />
            <rect x="10" y="85" width="80" height="10" fill={item.color} stroke="#00000055" strokeWidth="3" />
          </svg>
        </div>
      );
    case "goal":
      return (
        <div style={{ width: px(item.size), height: px(item.size * 0.6) }}>
          <svg viewBox="0 0 200 120" className="w-full h-full">
            <rect x="5" y="40" width="190" height="60" fill="#e5e7eb" stroke="#00000066" strokeWidth="4" />
            <g stroke="#00000022" strokeWidth="2">
              {Array.from({ length: 10 }).map((_, i) => <line key={i} x1={5 + i * 19} y1={40} x2={5 + i * 19} y2={100} />)}
              {Array.from({ length: 5 }).map((_, i) => <line key={i} x1={5} y1={40 + i * 12} x2={195} y2={40 + i * 12} />)}
            </g>
          </svg>
        </div>
      );
    case "slalom":
      return <div style={{ width: px(item.size), height: px(item.meta?.height || 72) }} className="bg-green-500" />;
    case "hurdle":
      return (
        <div style={{ width: px(item.size), height: px(item.size * 0.25) }}>
          <svg viewBox="0 0 200 50" className="w-full h-full">
            <rect x="15" y="8" width="170" height="10" fill={item.color} />
            <rect x="10" y="18" width="10" height="24" fill={item.color} />
            <rect x="180" y="18" width="10" height="24" fill={item.color} />
          </svg>
        </div>
      );
    case "marker":
      return <div className="rounded-full" style={{ width: px(item.size), height: px(item.size), background: item.color }} />;
    default:
      return null;
  }
}

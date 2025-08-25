import React from "react";
import { PALETTE } from "./constants";
import ItemGraphic from "./ItemGraphic";

/**
 * Compact icon grid palette with high-contrast previews and tiny badges.
 * - Drag to place
 * - Double-click to add
 * - Uses ItemGraphic so previews match stage visuals
 */
export default function Palette({ onDragStart, onAdd }) {
  const handleDragStart = (e, entry) => {
    try {
      e.dataTransfer.setData("application/json", JSON.stringify(entry));
      e.dataTransfer.effectAllowed = "copy";
      onDragStart?.(e, entry);
    } catch (err) { console.error("Palette dragStart error:", err); }
  };
  const handleDoubleClick = (entry) => { try { onAdd?.(entry); } catch (err) { console.error(err); } };

  return (
    <div className="p-2 grid gap-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
      {PALETTE.map((entry) => (
        <button
          key={entry.id}
          type="button"
          draggable
          onDragStart={(e) => handleDragStart(e, entry)}
          onDoubleClick={() => handleDoubleClick(entry)}
          title={entry.name || entry.id}
          aria-label={entry.name || entry.id}
          className="aspect-square rounded-md ring-1 ring-slate-200 bg-white hover:bg-slate-50 transition relative overflow-hidden"
        >
          <div className="absolute inset-1 rounded-md" style={{ background: "linear-gradient(180deg, rgba(22,101,52,.22) 0%, rgba(13,79,43,.22) 100%)" }} />
          <div className="relative w-full h-full grid place-items-center" style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,.6)) drop-shadow(0 1px 0 rgba(0,0,0,.35))" }}>
            <PreviewFromItemGraphic entry={entry} />
          </div>
          <Badge type={entry.type} name={entry.name} />
        </button>
      ))}
    </div>
  );
}

function PreviewFromItemGraphic({ entry }) {
  const item = {
    id: `pal-${entry.id}`,
    type: entry.type,
    ...entry.defaults,
  };
  // Scale + safety mins for pct-based shapes
  if (typeof item.size === "number") item.size = Math.max(12, Math.min(38, item.size));
  if (typeof item.widthPct === "number")  item.widthPct  = Math.max(4, Math.min(24, item.widthPct));
  if (typeof item.heightPct === "number") item.heightPct = Math.max(4, Math.min(16, item.heightPct));
  if (typeof item.sizePct === "number")   item.sizePct   = Math.max(4, Math.min(14, item.sizePct));
  if (typeof item.lengthPct === "number") item.lengthPct = Math.max(6, Math.min(20, item.lengthPct));
  if (typeof item.strokeWidth === "number") item.strokeWidth = Math.max(3, item.strokeWidth + 1); else item.strokeWidth = 3;

  return <ItemGraphic item={item} stageWidth={120} />;
}

function Badge({ type, name }) {
  const t = String(type || "").toLowerCase();
  const map = {
    player: "PL", ball: "Ball", cone: "Cone", marker: "Mk", goal: "Goal", slalom: "Pole", hurdle: "Hrd",
    "shape-rect": "Box", "shape-rect-outline": "Box○", "shape-circle": "○", "shape-triangle": "△",
    "shape-line": "—", "shape-line-dashed": "– –", "shape-arrow": "→", "shape-arrow-dashed": "→ ⋯",
    "shape-arrow-2head": "⇄", "shape-curve": "↝", "shape-curve2": "S↝",
  };
  const text = map[t] || (name?.split(" ")[0] ?? "");
  return (
    <span
      className="absolute bottom-0.5 left-0.5 px-1 py-[2px] rounded text-[10px] font-medium"
      style={{ background: "rgba(255,255,255,.85)", color: "#0f172a", border: "1px solid rgba(0,0,0,.06)" }}
    >
      {text}
    </span>
  );
}

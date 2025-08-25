// src/components/designer/Stage.jsx
import React from "react";
import PitchSVG from "./PitchSVG";
import ItemGraphic from "./ItemGraphic";

// Isolated error boundary so a bad item can't white-screen the app
class ItemBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("Item render error:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div
          title={String(this.state.err?.message || this.state.err)}
          style={{ width: 8, height: 8, borderRadius: 9999, background: "#ef4444", border: "2px solid #fff" }}
        />
      );
    }
    return this.props.children;
  }
}

const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const safePct = (n, d = 50) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return d;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
};

export default function Stage({
  // layout & pitch
  stageSize,               // { w, h }
  pitch,                   // "full" | "half" | "blank"
  pitchStyle,              // { turf,line,lineWidth,showGrid,gridSize,gridThickness,gridOpacity }

  // items & selection
  items = [],
  selectedId,
  setSelectedId = () => {},

  // pointer & DnD
  onPointerDownItem = () => {},
  onStageDrop = () => {},
  stageRef,

  // playback (optional)
  timeline = 0,
  playing = false, setPlaying = () => {},
  loop = true, setLoop = () => {},
  rate = 1, setRate = () => {},
  time = 0, setTime = () => {},
  evalAt = () => {},

  // undo (optional)
  onUndo,
  canUndo = false,
}) {
  const {
    turf = "#0b7d3b",
    line = "#ffffff",
    lineWidth = 3,
    showGrid = true,
    gridSize = 10,
    gridThickness = 1,
    gridOpacity = 0.16,
  } = pitchStyle || {};

  return (
    <div
      ref={stageRef}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDrop={(e) => { try { onStageDrop(e); } catch (err) { console.error("onStageDrop error", err); } }}
      onPointerDown={(e) => {
        if (e.button === 0 || e.pointerType === "touch" || e.pointerType === "pen") setSelectedId?.(null);
      }}
      className="relative rounded-xl overflow-hidden"
      style={{
        width: `${stageSize?.w ?? 800}px`,
        height: `${stageSize?.h ?? 520}px`,
        background: turf,
        userSelect: "none",
        touchAction: "none",
        margin: "0 auto", // center the canvas inside tile
      }}
    >
      {/* Pitch */}
      <PitchSVG
        pitchId={pitch}
        orientation={/half/i.test(String(pitch)) ? "portrait" : "landscape"}
        showGrid={showGrid}
        gridSize={gridSize}
        gridThickness={gridThickness}
        gridOpacity={gridOpacity}
        turf={turf}
        line={line}
        lineWidth={lineWidth}
      />

      {/* Items */}
      {(Array.isArray(items) ? items : [])
        .slice()
        .sort((a, b) => (a.z || 0) - (b.z || 0))
        .map((it) => {
          const x = safePct(it?.x);
          const y = safePct(it?.y);
          const rot = isNum(it?.rot) ? it.rot : 0;
          const z = isNum(it?.z) ? it.z : 0;

          return (
            <div
              key={it.id}
              draggable={false}
              className={`absolute select-none ${selectedId === it.id ? "ring-2 ring-yellow-400 rounded-full" : ""}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%,-50%) rotate(${rot}deg)`,
                zIndex: z,
                willChange: "transform,left,top",
              }}
              onPointerDown={(e) => {
                try {
                  if (!isNum(e.clientX) || !isNum(e.clientY)) return;
                  onPointerDownItem(e, it);
                } catch (err) { console.error("onPointerDownItem error", err); }
              }}
            >
              <ItemBoundary>
                <ItemGraphic item={it} stageWidth={stageSize?.w ?? 800} />
              </ItemBoundary>
            </div>
          );
        })}

      {/* Floating Undo button (only if provided) */}
      {onUndo && (
        <button
          type="button"
          onClick={() => { try { onUndo(); } catch (e) { console.error(e); } }}
          disabled={!canUndo}
          className="absolute top-2 left-2 px-3 py-1.5 text-sm rounded-lg border bg-white/80 backdrop-blur hover:bg-white transition disabled:opacity-50"
          title="Undo (Ctrl/Cmd+Z)"
        >
          Undo
        </button>
      )}

      {/* Timeline controls (optional) */}
      {timeline > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/30 text-white px-3 py-1 flex items-center gap-2">
          <button className="px-2 py-1 rounded border bg-white/10" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
          </label>
          <select
            className="text-xs border rounded px-2 py-1"
            value={rate}
            onChange={(e) => { const r = Number(e.target.value); if (Number.isFinite(r)) setRate(r); }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
          <input
            type="range"
            min={0}
            max={Math.max(0.01, timeline)}
            step={0.01}
            value={time}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (!Number.isFinite(t)) return;
              setTime(t);
              try { evalAt(t); } catch (err) { console.error("evalAt error", err); }
            }}
            className="w-full"
          />
          <div className="text-xs tabular-nums w-[64px] text-right">
            {Number.isFinite(time) ? time.toFixed(2) : "0.00"}s
          </div>
        </div>
      )}
    </div>
  );
}

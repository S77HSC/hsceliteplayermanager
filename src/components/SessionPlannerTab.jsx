import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import PitchSVG from "./designer/PitchSVG";
import ItemGraphic, { ArrowDefs } from "./designer/ItemGraphic";
import Palette from "./designer/Palette";
import PropertiesPanel from "./designer/PropertiesPanel";
import TimelinePanel from "./designer/TimelinePanel";
import { TEMPLATES } from "./designer/templates";
import { clamp, lerp, uid, isTypingEl, layoutById } from "../utils/designer";
import { exportNodeAs } from "../services/exportImage";

// palette + pitches (can be moved to its own file later)
const PALETTE = [
  { type: "player", name: "Player (Red)",   defaults: { color: "#ef4444", label: "10", size: 46 } },
  { type: "player", name: "Player (Blue)",  defaults: { color: "#3b82f6", label: "8",  size: 46 } },
  { type: "ball",   name: "Ball",           defaults: { color: "#ffffff", size: 28 } },
  { type: "cone",   name: "Cone",           defaults: { color: "#f97316", size: 28 } },
  { type: "goal",   name: "Goal",           defaults: { color: "#d1d5db", size: 120, meta: { orientation: "horizontal" } } },
  { type: "slalom", name: "Slalom",         defaults: { color: "#22c55e", size: 8,   meta: { height: 72 } } },
  { type: "hurdle", name: "Hurdle",         defaults: { color: "#a855f7", size: 70 } },
  { type: "marker", name: "Marker",         defaults: { color: "#eab308", size: 18,  label: "" } },
  { type: "shape-line",          name: "Line",          defaults: { stroke: "#ffffff", strokeWidth: 2, dashed: false, lengthPct: 20, rot: 0 } },
  { type: "shape-line-dashed",   name: "Line (— —)",    defaults: { stroke: "#ffffff", strokeWidth: 2, dashed: true,  lengthPct: 20, rot: 0 } },
  { type: "shape-rect",          name: "Box",           defaults: { stroke: "#111827", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.3, widthPct: 20, heightPct: 12, rot: 0 } },
  { type: "shape-rect-outline",  name: "Box (◻︎)",      defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.0, widthPct: 20, heightPct: 12, rot: 0 } },
  { type: "shape-circle",        name: "Circle",        defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.2, radiusPct: 8 } },
  { type: "shape-triangle",      name: "Triangle",      defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.2, sizePct: 12, rot: 0 } },
  { type: "shape-arrow",         name: "Arrow →",       defaults: { stroke: "#ffffff", strokeWidth: 3, dashed: false, lengthPct: 24, rot: 0 } },
  { type: "shape-curve",         name: "Curve ⤳",       defaults: { stroke: "#ffffff", strokeWidth: 3, dashed: false, lengthPct: 24, bendPct: 18, rot: 0 } },
  { type: "shape-curve2",        name: "S-Curve",       defaults: { stroke: "#ffffff", strokeWidth: 3, dashed: false, lengthPct: 28, bendPct: 16, rot: 0 } },
];

const PITCHES = [
  { id: "full",  name: "Full Pitch (11v11)" },
  { id: "9v9",   name: "9v9 Pitch" },
  { id: "7v7",   name: "7v7 Pitch" },
  { id: "futsal",name: "Futsal / Indoor" },
  { id: "blank", name: "Blank Area" },
];

export default function SessionPlannerTab({ mode = "designer", fixedHeight = 520 }) {
  const isPreview = mode === "preview";

  // layout refs / state
  const [compact, setCompact] = useState(true);
  const [dock, setDock] = useState("right");
  const topBarRef = useRef(null);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const timelineRef = useRef(null);

  const [availableH, setAvailableH] = useState(isPreview ? fixedHeight : 600);
  const [stageSize, setStageSize] = useState({ w: 800, h: 518 });

  // design state
  const [pitch, setPitch] = useState("full");
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(false);
  const [snapStep, setSnapStep] = useState(2);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // animation
  const [timeline, setTimeline] = useState(10);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [keyframesById, setKeyframesById] = useState({});

  // notes & local save
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [notes, setNotes] = useState("");
  const STORAGE_KEY = "epm_sessions_v1";
  const loadIndex = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
  const [sessionList, setSessionList] = useState(() => loadIndex());

  // aspect ratio fit
  const { L, W } = layoutById(pitch);
  const ratio = L / W;

  const recalcAvailable = () => {
    if (isPreview) return;
    const vpTop = viewportRef.current?.getBoundingClientRect().top ?? 0;
    const tlH   = dock === "bottom"
      ? (timelineRef.current?.getBoundingClientRect().height ?? (compact ? 60 : 120))
      : 0;
    const pad   = 12;
    const vh    = window.innerHeight;
    setAvailableH(Math.max(360, vh - vpTop - tlH - pad));
  };
  useLayoutEffect(() => { recalcAvailable(); }, [compact, dock, isPreview]);
  useEffect(() => {
    if (isPreview) return;
    const onResize = () => recalcAvailable();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    const ro = new ResizeObserver(onResize);
    if (timelineRef.current) ro.observe(timelineRef.current);
    if (topBarRef.current)  ro.observe(topBarRef.current);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize); ro.disconnect(); };
  }, [isPreview, dock]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const vw = entry.contentRect.width;
      const vh = isPreview ? fixedHeight : availableH;
      let w = vw, h = w / ratio;
      if (h > vh) { h = vh; w = h * ratio; }
      setStageSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, availableH, fixedHeight, isPreview]);

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  /* palette: click-to-add + drag */
  const spawnIdx = useRef(0);
  const addFromPalette = (entry, at) => {
    const i = spawnIdx.current++;
    const offsets = [ {dx:0,dy:0},{dx:6,dy:0},{dx:-6,dy:0},{dx:0,dy:6},{dx:0,dy:-6},{dx:8,dy:6} ];
    const off = offsets[i % offsets.length];
    const x = clamp((at?.x ?? 50) + off.dx, 0, 100);
    const y = clamp((at?.y ?? 50) + off.dy, 0, 100);
    const id = uid();
    const base = { id, x, y, rot: 0 };

    if (entry.type?.startsWith("shape-")) {
      setItems(p => [...p, {
        ...base, type: entry.type,
        stroke: entry.defaults?.stroke || "#ffffff",
        strokeWidth: entry.defaults?.strokeWidth || 2,
        dashed: !!entry.defaults?.dashed,
        fill: entry.defaults?.fill || "#ffffff",
        fillAlpha: entry.defaults?.fillAlpha ?? 0.2,
        widthPct: entry.defaults?.widthPct,
        heightPct: entry.defaults?.heightPct,
        radiusPct: entry.defaults?.radiusPct,
        sizePct: entry.defaults?.sizePct,
        lengthPct: entry.defaults?.lengthPct,
        bendPct: entry.defaults?.bendPct,
      }]); setSelectedId(id); return;
    }
    setItems(p => [...p, {
      ...base, type: entry.type,
      size: entry.defaults?.size ?? 40,
      color: entry.defaults?.color ?? "#ffffff",
      label: entry.defaults?.label ?? "",
      meta: entry.defaults?.meta || {},
    }]); setSelectedId(id);
  };
  const onDragStartPalette = (ev, entry) => {
    ev.dataTransfer.setData("application/json", JSON.stringify(entry));
    ev.dataTransfer.effectAllowed = "copy";
  };
  const getStagePoint = (cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: clamp(((cx - r.left) / r.width) * 100, 0, 100), y: clamp(((cy - r.top) / r.height) * 100, 0, 100) };
  };
  const onStageDrop = (ev) => {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("application/json");
    if (!data) return;
    addFromPalette(JSON.parse(data), getStagePoint(ev.clientX, ev.clientY));
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  /* drag existing items */
  const drag = useRef({ id: null, sx: 0, sy: 0, ox: 0, oy: 0 });
  const onPointerDownItem = (e, it) => {
    e.stopPropagation();
    setSelectedId(it.id);
    drag.current = { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.id) return;
    const r = stageRef.current.getBoundingClientRect();
    let nx = d.ox + ((e.clientX - d.sx) / r.width) * 100;
    let ny = d.oy + ((e.clientY - d.sy) / r.height) * 100;
    if (snap) { nx = Math.round(nx / snapStep) * snapStep; ny = Math.round(ny / snapStep) * snapStep; }
    setItems(prev => prev.map(it => it.id === d.id ? { ...it, x: clamp(nx,0,100), y: clamp(ny,0,100) } : it));
  };
  const onPointerUp   = () => {
    drag.current = { id: null, sx: 0, sy: 0, ox: 0, oy: 0 };
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };
  const updateSelected = (patch) => selected && setItems(prev => prev.map(it => it.id === selected.id ? { ...it, ...patch } : it));

  /* keyboard (with typing guard) */
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingEl(document.activeElement)) return;
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        setItems(prev => prev.filter(it => it.id !== selected.id));
        setSelectedId(null);
      } else if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const delta = (e.shiftKey ? 1 : 0.5) * (snap ? snapStep : 1);
        const dx = e.key === "ArrowRight" ? delta : e.key === "ArrowLeft" ? -delta : 0;
        const dy = e.key === "ArrowDown" ? delta : e.key === "ArrowUp" ? -delta : 0;
        updateSelected({ x: clamp(selected.x + dx, 0, 100), y: clamp(selected.y + dy, 0, 100) });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const copy = { ...selected, id: uid(), x: clamp(selected.x + 2,0,100), y: clamp(selected.y + 2,0,100) };
        setItems(p => [...p, copy]); setSelectedId(copy.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, snap, snapStep]);

  /* animation */
  const addKeyframe = () => {
    if (!selected) return;
    setKeyframesById(prev => {
      const arr = [...(prev[selected.id] || [])];
      arr.push({ t: time, x: selected.x, y: selected.y, rot: selected.rot });
      arr.sort((a,b)=>a.t-b.t);
      return { ...prev, [selected.id]: arr };
    });
  };
  const evalAt = (t) => setItems(prev => prev.map(it => {
    const kfs = keyframesById[it.id];
    if (!kfs || kfs.length === 0) return it;
    let a=null,b=null;
    for (let i=0;i<kfs.length;i++){ if(kfs[i].t<=t) a=kfs[i]; if(kfs[i].t>=t){ b=kfs[i]; break; } }
    if (!a && b) return { ...it, x:b.x, y:b.y, rot:b.rot };
    if (a && !b) return { ...it, x:a.x, y:a.y, rot:a.rot };
    const f = Math.max(0, Math.min(1, (t-a.t)/Math.max(0.0001,b.t-a.t)));
    return { ...it, x: lerp(a.x,b.x,f), y: lerp(a.y,b.y,f), rot: lerp(a.rot,b.rot,f) };
  }));
  useEffect(() => {
    if (!playing) return;
    let raf, start;
    const loopFn = (ts) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const t = loop ? elapsed % timeline : Math.min(elapsed, timeline);
      evalAt(t); setTime(t);
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline, loop]);
  useEffect(() => { if (!playing) evalAt(time); }, [time, playing]);

  /* local sessions */
  function saveSession(toNew=false) {
    const sess = { id: toNew ? uid() : (sessionList.find(s=>s.name===sessionName)?.id || uid()),
      name: sessionName, notes, pitch, grid: showGrid, items, keyframesById, timeline };
    const idx = loadIndex(); const i = idx.findIndex(s => s.id === sess.id);
    if (i>=0) idx[i] = sess; else idx.unshift(sess);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(idx)); setSessionList(idx);
    alert("Session saved.");
  }
  function loadSession(id){
    const s = loadIndex().find(x=>x.id===id); if (!s) return;
    setSessionName(s.name); setNotes(s.notes||""); setPitch(s.pitch||"full");
    setShowGrid(!!s.grid); setItems(s.items||[]); setKeyframesById(s.keyframesById||{});
    setTimeline(s.timeline||10); setSelectedId(null); setTime(0);
  }
  function deleteSession(id){
    const idx = loadIndex().filter(s=>s.id!==id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(idx)); setSessionList(idx);
    if (sessionList.find(s=>s.id===id)?.name===sessionName){
      setSessionName("Untitled Session"); setItems([]); setKeyframesById({}); setNotes(""); setSelectedId(null); setTime(0);
    }
  }

  /* templates */
  function applyTemplate(templateId, { clear=false } = {}) {
    const t = TEMPLATES.find(x=>x.id===templateId);
    if (!t) return;
    const made = t.make("#ef4444");
    setItems(prev => clear ? made : [...prev, ...made]);
  }

  /* canvas viewport */
  const pitchViewport = (
    <div
      ref={viewportRef}
      className="relative rounded-xl border bg-emerald-700/40 overflow-hidden grid place-items-center w-full"
      style={{ height: isPreview ? fixedHeight : availableH, minHeight: 0 }}
    >
      <ArrowDefs />
      <div
        ref={stageRef}
        onDragOver={(e)=>{e.preventDefault(); e.dataTransfer.dropEffect="copy";}}
        onDrop={onStageDrop}
        onPointerDown={() => setSelectedId(null)}
        className="relative"
        style={{ width: `${stageSize.w}px`, height: `${stageSize.h}px` }}
      >
        <PitchSVG pitchId={pitch} showGrid={showGrid} />
        {items.map((it) => (
          <div
            key={it.id}
            className={`absolute select-none ${selectedId===it.id ? "ring-2 ring-yellow-400" : ""}`}
            style={{ left:`${it.x}%`, top:`${it.y}%`, transform:`translate(-50%,-50%) rotate(${it.rot||0}deg)` }}
            onPointerDown={(e)=>onPointerDownItem(e,it)}
          >
            <ItemGraphic item={it} stageWidth={stageSize.w} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-slate-900">
      {/* Top bar */}
      <div ref={topBarRef} className="flex flex-wrap items-center gap-2 p-3 border-b bg-white/80">
        <input className="px-3 py-2 rounded-xl border w-[240px]" value={sessionName}
          onChange={(e)=>setSessionName(e.target.value)} placeholder="Session name" />
        <select className="px-3 py-2 rounded-xl border" value={pitch} onChange={(e)=>setPitch(e.target.value)}>
          {PITCHES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-2 ml-2">
          <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> Grid
        </label>
        <label className="flex items-center gap-2 ml-2">
          <input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} /> Snap
        </label>
        {snap && (
          <div className="flex items-center gap-2">
            <span className="text-sm">step</span>
            <input type="range" min={1} max={10} value={snapStep} onChange={e=>setSnapStep(parseInt(e.target.value))} />
            <span className="text-sm w-6 text-center">{snapStep}</span>
          </div>
        )}
        <label className="flex items-center gap-2 ml-2">
          <input type="checkbox" checked={compact} onChange={(e)=>setCompact(e.target.checked)} /> Compact UI
        </label>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm">Dock</span>
          <select className="px-2 py-1 rounded-lg border" value={dock} onChange={(e)=>setDock(e.target.value)}>
            <option value="right">Right</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>

        {/* Templates */}
        <div className="relative">
          <details className="group">
            <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Templates</summary>
            <div className="absolute left-0 mt-1 w-64 bg-white border rounded-xl shadow-lg p-2 z-10">
              <div className="text-xs text-slate-500 mb-2">Set-pieces (click to add)</div>
              {TEMPLATES.map(t=>(
                <div key={t.id} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg">
                  <button className="text-left" onClick={()=>applyTemplate(t.id, { clear:false })}>{t.name}</button>
                  <button className="text-xs text-slate-500" onClick={()=>applyTemplate(t.id, { clear:true })}>replace</button>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white"
            onClick={()=>{ setItems([]); setKeyframesById({}); setSelectedId(null); setTime(0); setSessionName("Untitled Session"); setNotes(""); }}>
            New
          </button>

          {/* Local sessions */}
          <div className="relative">
            <details className="group">
              <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Sessions</summary>
              <div className="absolute right-0 mt-1 w-80 max-h-80 overflow-auto bg-white border rounded-xl shadow-lg p-2 z-10">
                {sessionList.length===0 && <div className="text-sm p-2 text-slate-500">No saved sessions yet.</div>}
                {sessionList.map(s=>(
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-lg">
                    <button className="text-left" onClick={()=>loadSession(s.id)}>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.pitch}</div>
                    </button>
                    <button className="text-red-600 text-sm" onClick={()=>confirm("Delete this session?")&&deleteSession(s.id)}>Delete</button>
                  </div>
                ))}
              </div>
            </details>
          </div>
          <button className="px-3 py-2 rounded-xl border" onClick={()=>saveSession(false)}>Save</button>
          <button className="px-3 py-2 rounded-xl border" onClick={()=>saveSession(true)}>Save as</button>

          {/* Export */}
          <div className="relative">
            <details className="group">
              <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Export</summary>
              <div className="absolute right-0 mt-1 w-44 bg-white border rounded-xl shadow-lg p-2 z-10">
                <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={()=>exportNodeAs(stageRef.current, "png", sessionName.replace(/\s+/g,"_"))}>PNG</button>
                <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={()=>exportNodeAs(stageRef.current, "jpeg", sessionName.replace(/\s+/g,"_"))}>JPEG</button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div
        className="flex-1 min-h-0"
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "260px 1fr 320px" : "300px 1fr 360px",
          gap: compact ? "10px" : "12px",
          padding: compact ? "10px" : "12px",
        }}
      >
        {/* Left: palette + notes */}
        <div className="flex flex-col gap-3" style={{ maxHeight: availableH, overflow: "auto" }}>
          <Palette palette={PALETTE} onAdd={addFromPalette} onDragStart={onDragStartPalette} />
          <div className="p-3 rounded-2xl border bg-white shadow-sm">
            <div className="font-semibold mb-2">Notes</div>
            <textarea className="w-full h-40 p-2 rounded-xl border"
              value={notes} onChange={(e)=>setNotes(e.target.value)}
              placeholder="Coaching points, progressions, timings..." />
          </div>
        </div>

        {/* Center: canvas */}
        {pitchViewport}

        {/* Right: properties + timeline */}
        <div style={{ maxHeight: availableH, overflow: "auto" }}>
          <PropertiesPanel selected={selected} updateSelected={updateSelected} />
          {dock === "right" && (
            <TimelinePanel
              playing={playing} setPlaying={setPlaying}
              loop={loop} setLoop={setLoop}
              timeline={timeline} setTimeline={setTimeline}
              time={time} setTime={setTime}
              addKeyframe={addKeyframe} selected={selected}
            />
          )}
        </div>
      </div>

      {/* Bottom dock timeline */}
      {dock === "bottom" && (
        <div ref={timelineRef} className={`${compact ? "p-2" : "p-3"} rounded-2xl border bg-white shadow-sm mx-3 mb-3`}>
          <TimelinePanel
            playing={playing} setPlaying={setPlaying}
            loop={loop} setLoop={setLoop}
            timeline={timeline} setTimeline={setTimeline}
            time={time} setTime={setTime}
            addKeyframe={addKeyframe} selected={selected}
          />
        </div>
      )}

      <div className="px-3 pb-3 text-xs text-slate-500">Tip: Click a tile to add (or drag). Deselect before export to hide the yellow ring.</div>
    </div>
  );
}

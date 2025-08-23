// src/components/SessionPlannerTab.jsx
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import * as htmlToImage from "html-to-image";
import PitchSVG from "./designer/PitchSVG";
import ItemGraphic, { ArrowDefs } from "./designer/ItemGraphic";
import Palette from "./designer/Palette";
import PropertiesPanel from "./designer/PropertiesPanel";
import TimelinePanel from "./designer/TimelinePanel";
import { TEMPLATES } from "./designer/templates";
import { clamp, lerp, uid, isTypingEl, layoutById } from "../utils/designer";
import { exportNodeAs } from "../services/exportImage";
import { supabase } from "../lib/supabase";

/* ───────────────────────── constants ───────────────────────── */
const THUMBS_BUCKET = "designer-thumbs";      // storage bucket (optional)
const LOCAL_KEY     = "epm_sessions_v1";      // local mirror (for Plans tab & Sessions menu)
const OPEN_KEY      = "epm_open_design_id";   // Plans tab passes a design id here

// Always produce a valid UUID v4 (fallback if crypto.randomUUID is missing)
function uuidv4() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ───────────────────────── Save As modal ───────────────────────── */
function SaveAsModal({ open, defaultName, onCancel, onConfirm }) {
  const [name, setName] = useState(defaultName || "");
  useEffect(() => { if (open) setName(defaultName || ""); }, [open, defaultName]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[420px] rounded-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Save As</div>
        <div className="p-4 space-y-2">
          <label className="text-sm text-slate-600">New session name</label>
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-2"
            placeholder="My session copy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? onConfirm(name.trim()) : null)}
          />
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border">Cancel</button>
          <button
            onClick={() => onConfirm(name.trim())}
            className="px-3 py-1.5 rounded-lg bg-black text-white disabled:opacity-50"
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Toast banner ───────────────────────── */
function Toast({ message, kind="info", onClose }) {
  if (!message) return null;
  const color = kind === "error" ? "bg-red-600" : kind === "success" ? "bg-emerald-600" : "bg-slate-800";
  return (
    <div className={`fixed bottom-4 right-4 z-[110] text-white ${color} px-3 py-2 rounded-lg shadow-lg`}>
      <div className="flex items-center gap-3">
        <span className="text-sm">{message}</span>
        <button className="text-xs bg-white/20 px-2 py-0.5 rounded" onClick={onClose}>Dismiss</button>
      </div>
    </div>
  );
}

/* ───────────────────────── timeline markers ───────────────────────── */
function TimelineMarkersBar({ keyframesById, selectedId, timeline, time, setTime }) {
  const all = keyframesById || {};
  const sel = selectedId ? all[selectedId] || [] : [];
  const times = useMemo(() => {
    if (selectedId && sel.length) return sel.map(k => k.t);
    // merge all times (unique) when no selection
    const set = new Set();
    Object.values(all).forEach(arr => (arr || []).forEach(k => set.add(k.t)));
    // cap to avoid overdraw
    return Array.from(set).sort((a,b)=>a-b).slice(0, 200);
  }, [all, sel, selectedId]);

  return (
    <div className="mt-2 relative h-6">
      <div className="absolute inset-0 rounded bg-slate-100" />
      {/* current time indicator */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-slate-700"
        style={{ left: `${(Math.max(0, Math.min(time, timeline)) / Math.max(0.0001, timeline)) * 100}%` }}
      />
      {/* ticks */}
      {times.map((t, i) => {
        const left = `${(Math.max(0, Math.min(t, timeline)) / Math.max(0.0001, timeline)) * 100}%`;
        const isSel = !!selectedId && sel.find(k => Math.abs(k.t - t) < 1e-6);
        return (
          <button
            key={`${t}-${i}`}
            className="absolute -translate-x-1/2 top-0 h-full"
            style={{ left }}
            title={`Go to ${t.toFixed(2)}s`}
            onClick={() => setTime(Math.max(0, Math.min(t, timeline)))}
          >
            <div className={`w-[6px] h-[10px] rounded-b ${isSel ? "bg-emerald-600" : "bg-slate-400"}`} />
          </button>
        );
      })}
      <div className="absolute inset-x-0 bottom-0 px-1 text-[10px] text-slate-500 flex justify-between pointer-events-none">
        <span>0s</span><span>{timeline.toFixed(0)}s</span>
      </div>
    </div>
  );
}

/* ───────────────────────── palette + pitches ───────────────────────── */
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

/* ───────────────────────── component ───────────────────────── */
export default function SessionPlannerTab({ mode = "designer", fixedHeight = 520 }) {
  const isPreview = mode === "designer" ? false : true;

  /* fullscreen helpers */
  const rootRef = useRef(null);
  const [isFs, setIsFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const enterFullscreen = () => rootRef.current?.requestFullscreen?.();

  /* layout refs / state */
  const [compact, setCompact] = useState(true);
  const [dock, setDock] = useState("right");
  const topBarRef = useRef(null);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);     // pitch-only (thumbnail source)
  const exportRef = useRef(null);    // wrapper (pitch + notes) for export-with-notes
  const timelineRef = useRef(null);

  const [availableH, setAvailableH] = useState(isPreview ? fixedHeight : 600);
  const [stageSize, setStageSize] = useState({ w: 800, h: 518 });

  /* design state */
  const [pitch, setPitch] = useState("full");
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(false);
  const [snapStep, setSnapStep] = useState(2);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  /* animation */
  const [timeline, setTimeline] = useState(10);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [keyframesById, setKeyframesById] = useState({});

  /* notes & ids */
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [notes, setNotes] = useState("");
  const [designId, setDesignId] = useState(null);

  /* local sessions list */
  const loadIndex = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; } };
  const [sessionList, setSessionList] = useState(() => loadIndex());

  /* toast */
  const [toast, setToast] = useState({ message: "", kind: "info" });
  const notify = (message, kind = "info") => {
    setToast({ message, kind });
    window.clearTimeout((notify)._t);
    (notify)._t = window.setTimeout(() => setToast({ message: "", kind: "info" }), 2600);
  };

  /* aspect ratio fit */
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

  /* keyboard with typing guard */
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

  /* supabase helpers */
  async function getUid() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }
  function dataUrlToBlob(dataUrl) {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:(.*);base64/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function makeThumbnailPng() {
    // Prefer pitch node; fallback to export wrapper
    const node = stageRef.current || exportRef.current;
    if (!node) return null;

    const rect = node.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    try {
      return await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height,
        style: { transform: "none", borderRadius: "12px" },
      });
    } catch (e) {
      console.warn("makeThumbnailPng failed:", e);
      return null;
    }
  }
  async function uploadThumb(userId, id, dataUrl) {
    if (!dataUrl) return null;
    try {
      const file = dataUrlToBlob(dataUrl);
      const path = `${userId}/${id}.png`;
      const { error } = await supabase.storage.from(THUMBS_BUCKET).upload(path, file, {
        upsert: true, contentType: "image/png",
      });
      if (error) throw error;
      const { data } = supabase.storage.from(THUMBS_BUCKET).getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (e) {
      console.warn("thumb upload skipped:", e.message || e);
      return null;
    }
  }

  // local mirror (keeps a dataURL fallback for thumbnails)
  function mirrorLocal(row) {
    try {
      const prev = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      const without = prev.filter((d) => d.id !== row.id);
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify([
          {
            id: row.id,
            name: row.name,
            pitch: row.pitch,
            items: row.data?.items || [],
            keyframesById: row.data?.keyframesById || {},
            timeline: row.data?.timeline || 10,
            grid: row.data?.meta?.grid ?? true,
            notes: row.data?.meta?.notes || "",
            thumbnail_url: row.thumbnail_url || null,
            thumb_dataurl: row.thumb_dataurl || null,
          },
          ...without,
        ])
      );
      setSessionList(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
    } catch {}
  }

  /* save / save-as (cloud first, mirror local always) */
  async function saveSession({ toNew = false, nameOverride = null } = {}) {
    // remember FS state and restore later (alerts or internal behavior can drop FS on some browsers)
    const wasFs = !!document.fullscreenElement;

    try {
      // Auth (RLS requires a signed-in user for cloud save)
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData?.user?.id || null;

      // New or existing id
      const id = toNew || !designId ? (globalThis.crypto?.randomUUID?.() || uuidv4()) : designId;

      // 1) Generate a thumbnail (never block if it fails)
      let thumbDataUrl = null;
      try {
        thumbDataUrl = await makeThumbnailPng();
      } catch (e) {
        console.warn("Thumbnail render failed:", e);
      }

      // 2) Try Storage upload (optional). If it fails, we’ll inline the data URL in DB.
      let uploadedThumbUrl = null;
      try {
        if (user_id && thumbDataUrl) {
          uploadedThumbUrl = await uploadThumb(user_id, id, thumbDataUrl);
        }
      } catch (e) {
        console.warn("Thumb upload skipped:", e?.message || e);
      }

      // 3) Prepare row
      const rowBase = {
        id,
        user_id,
        name: nameOverride || sessionName || "Untitled Session",
        pitch,
        data: {
          items,
          keyframesById,
          timeline,
          meta: { notes: notes || "", grid: showGrid },
        },
        // IMPORTANT: if upload failed, store the inline data URL in DB so Vercel can show it
        thumbnail_url: uploadedThumbUrl || thumbDataUrl || null,
        updated_at: new Date().toISOString(),
      };

      // 4) Cloud upsert (works for insert + update). If not signed in, skip cloud.
      let cloudOk = false;
      if (user_id) {
        const { error } = await supabase
          .from("session_designs")
          .upsert(rowBase, { onConflict: "id" })
          .select()
          .single();

        if (error) {
          console.error("Supabase upsert error:", error);
          notify(`Cloud save failed: ${error.code || ""} ${error.message || ""}`, "error");
        } else {
          cloudOk = true;
          setDesignId(id);
        }
      } else {
        console.warn("Not signed in – cloud save skipped (RLS).");
      }

      // reflect name change in UI if Save As
      if (nameOverride) setSessionName(nameOverride);

      // 5) Mirror locally so the Plans tab has a thumb immediately
      mirrorLocal({ ...rowBase, thumb_dataurl: thumbDataUrl || null });

      notify(
        cloudOk
          ? (toNew || !designId ? "Design saved to cloud" : "Design updated in cloud")
          : "Design saved locally"
        , cloudOk ? "success" : "info"
      );
    } catch (err) {
      console.error("saveSession fatal:", err);
      notify(`Save crashed: ${err?.message || err}`, "error");
    } finally {
      // restore fullscreen if user was in it
      if (wasFs && !document.fullscreenElement) enterFullscreen();
    }
  }

  function loadSession(id){
    const s = loadIndex().find(x=>x.id===id); if (!s) return;
    setDesignId(id);
    setSessionName(s.name);
    setNotes(s.notes || "");
    setPitch(s.pitch || "full");
    setShowGrid(!!s.grid);
    setItems(s.items || []);
    setKeyframesById(s.keyframesById || {});
    setTimeline(s.timeline || 10);
    setSelectedId(null);
    setTime(0);
  }

  function deleteSession(id){
    const idx = loadIndex().filter(s=>s.id!==id);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(idx));
    setSessionList(idx);
    if (id===designId){ setDesignId(null); }
    if (sessionList.find(s=>s.id===id)?.name===sessionName){
      setSessionName("Untitled Session");
      setItems([]); setKeyframesById({});
      setNotes(""); setSelectedId(null); setTime(0);
    }
  }

  /* load by id from Plans tab (if provided) */
  useEffect(() => {
    (async () => {
      let id = null;
      try { id = localStorage.getItem(OPEN_KEY); localStorage.removeItem(OPEN_KEY); } catch {}
      if (!id) return;

      // Try cloud
      const { data, error } = await supabase
        .from("session_designs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (data && !error) {
        setDesignId(data.id);
        setSessionName(data.name || "Untitled Session");
        setPitch(data.pitch || "full");
        setItems(data.data?.items || []);
        setKeyframesById(data.data?.keyframesById || {});
        setTimeline(data.data?.timeline || 10);
        setNotes(data.data?.meta?.notes || "");
        setShowGrid(!!data.data?.meta?.grid);
        setSelectedId(null); setTime(0);
        return;
      }

      // Fallback: local
      const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      const row = local.find((d) => d.id === id);
      if (row) {
        setDesignId(row.id);
        setSessionName(row.name || "Untitled Session");
        setPitch(row.pitch || "full");
        setItems(row.items || []);
        setKeyframesById(row.keyframesById || {});
        setTimeline(row.timeline || 10);
        setNotes(row.notes || "");
        setShowGrid(!!row.grid);
        setSelectedId(null); setTime(0);
      }
    })();
  }, []);

  /* templates */
  function applyTemplate(templateId, { clear=false } = {}) {
    const t = TEMPLATES.find(x=>x.id===templateId);
    if (!t) return;
    const made = t.make("#ef4444");
    setItems(prev => clear ? made : [...prev, ...made]);
  }

  /* export WITH notes (exportRef wrapper) */
  const handleExport = (fmt) => {
    const node = exportRef.current || stageRef.current;
    if (!node) return;
    exportNodeAs(node, fmt, sessionName.replace(/\s+/g,"_"));
  };

  /* Save As modal control */
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const onSaveAsClick = () => setSaveAsOpen(true);
  const onConfirmSaveAs = async (newName) => {
    if (!newName) return setSaveAsOpen(false);
    setSaveAsOpen(false);
    await saveSession({ toNew: true, nameOverride: newName });
  };

  /* canvas viewport */
  const pitchViewport = (
    <div
      ref={viewportRef}
      className="relative rounded-xl border bg-emerald-700/40 overflow-hidden grid place-items-center w-full"
      style={{ height: isPreview ? fixedHeight : availableH, minHeight: 0 }}
    >
      <ArrowDefs />
      {/* Export wrapper → includes pitch + printable notes */}
      <div ref={exportRef} className="w-full" style={{ maxWidth: `${stageSize.w}px` }}>
        {/* PITCH */}
        <div
          ref={stageRef}
          onDragOver={(e)=>{e.preventDefault(); e.dataTransfer.dropEffect="copy";}}
          onDrop={onStageDrop}
          onPointerDown={() => setSelectedId(null)}
          className="relative rounded-xl overflow-hidden bg-[#0b7d3b]"
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

        {/* NOTES (included in export & used for PNG) */}
        <div className="mt-3 p-3 rounded-lg bg-white/95 text-sm leading-5 text-slate-800 border">
          <div className="font-semibold mb-1">Notes</div>
          <div className="whitespace-pre-wrap">{notes || "—"}</div>
        </div>
      </div>
    </div>
  );

  /* UI */
  return (
    <div ref={rootRef} className="w-full h-full flex flex-col overflow-hidden text-slate-900">
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
            onClick={()=>{ setItems([]); setKeyframesById({}); setSelectedId(null); setTime(0); setSessionName("Untitled Session"); setNotes(""); setDesignId(null); }}>
            New
          </button>

          {/* Local sessions menu */}
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

          <button className="px-3 py-2 rounded-xl border" onClick={()=>saveSession({ toNew: false })}>Save</button>
          <button className="px-3 py-2 rounded-xl border" onClick={onSaveAsClick}>Save as</button>
          {!isFs && (
            <button className="px-3 py-2 rounded-xl border" onClick={enterFullscreen}>Fullscreen</button>
          )}

          <div className="relative">
            <details className="group">
              <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Export</summary>
              <div className="absolute right-0 mt-1 w-44 bg-white border rounded-xl shadow-lg p-2 z-10">
                <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={()=>handleExport("png")}>PNG (with notes)</button>
                <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={()=>handleExport("jpeg")}>JPEG (with notes)</button>
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
        {/* Left: palette + notes editor */}
        <div className="flex flex-col gap-3" style={{ maxHeight: availableH, overflow: "auto" }}>
          <Palette palette={PALETTE} onAdd={addFromPalette} onDragStart={onDragStartPalette} />
          <div className="p-3 rounded-2xl border bg-white shadow-sm">
            <div className="font-semibold mb-2">Notes</div>
            <textarea className="w-full h-40 p-2 rounded-xl border"
              value={notes} onChange={(e)=>setNotes(e.target.value)}
              placeholder="Coaching points, progressions, timings..." />
          </div>
        </div>

        {/* Center: canvas (export wrapper contains pitch + printable notes) */}
        {pitchViewport}

        {/* Right: properties + timeline */}
        <div style={{ maxHeight: availableH, overflow: "auto" }}>
          <PropertiesPanel selected={selected} updateSelected={updateSelected} />
          {dock === "right" && (
            <div className={`${compact ? "p-2" : "p-3"} rounded-2xl border bg-white shadow-sm mt-3`}>
              <TimelinePanel
                playing={playing} setPlaying={setPlaying}
                loop={loop} setLoop={setLoop}
                timeline={timeline} setTimeline={setTimeline}
                time={time} setTime={setTime}
                addKeyframe={addKeyframe} selected={selected}
              />
              <TimelineMarkersBar
                keyframesById={keyframesById}
                selectedId={selectedId}
                timeline={timeline}
                time={time}
                setTime={setTime}
              />
            </div>
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
          <TimelineMarkersBar
            keyframesById={keyframesById}
            selectedId={selectedId}
            timeline={timeline}
            time={time}
            setTime={setTime}
          />
        </div>
      )}

      <div className="px-3 pb-3 text-xs text-slate-500">
        Tip: Deselect before export to hide the yellow ring.
      </div>

      <SaveAsModal
        open={saveAsOpen}
        defaultName={`${sessionName || "Session"} Copy`}
        onCancel={() => setSaveAsOpen(false)}
        onConfirm={onConfirmSaveAs}
      />

      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ message: "", kind: "info" })} />
    </div>
  );
}

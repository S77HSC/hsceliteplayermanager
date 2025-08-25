// src/hooks/useSessionPlanner.jsx
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import * as htmlToImage from "html-to-image";
import { clamp, lerp, uid, isTypingEl, layoutById } from "../utils/designer";
import { exportNodeAs } from "../services/exportImage";
import { exportAnimationWebM } from "../services/exportAnimation";
import { supabase } from "../lib/supabase";

const THUMBS_BUCKET = "designer-thumbs";
const LOCAL_KEY = "epm_sessions_v1";

/* ===================== helpers (module scope) ===================== */

// deepCloneItems must be null/array safe
const deepCloneItems = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((i) => ({ ...i, meta: { ...(i?.meta || {}) } }));
};

// Parse .data safely (it might be TEXT in some rows)
function parseMaybeJson(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function normalizeRow(raw) {
  const parsed = parseMaybeJson(raw?.data);
  const data = parsed || raw?.data || raw;

  const items = data?.items || raw?.items || [];
  const keyframesById = data?.keyframesById || raw?.keyframesById || {};
  const timeline = Number(data?.timeline ?? raw?.timeline ?? 0) || 0;
  const notes = data?.meta?.notes || raw?.notes || "";
  const steps = data?.steps || raw?.steps || []; // include steps if present

  return {
    id: raw.id || raw.uuid || raw._id || Math.random().toString(36).slice(2),
    user_id: raw.user_id || null,
    name: raw.name || raw.title || "Untitled Session",
    pitch: raw.pitch || data?.pitch || "full",
    items,
    keyframesById,
    timeline,
    notes,
    steps,
    thumbnail_url: raw.thumbnail_url || raw.thumb_dataurl || null,
    updated_at: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    data,
  };
}

function readJsonSafe(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}

function loadIndexLegacyAware() {
  const candidates = [LOCAL_KEY, "epm_sessions", "session_plans", "designer_sessions", "sessions"];
  let out = [];
  for (const k of candidates) {
    const val = readJsonSafe(k);
    if (!val) continue;
    if (Array.isArray(val)) out = out.concat(val.map(normalizeRow));
    else if (val && (val.items || val.data?.items)) out.push(normalizeRow(val));
  }
  if (!out.length) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = readJsonSafe(k);
      if (v && (Array.isArray(v) || v.items || v.data?.items)) {
        if (Array.isArray(v)) out = out.concat(v.map(normalizeRow));
        else out.push(normalizeRow(v));
      }
    }
  }
  const byId = {};
  out.forEach((r) => {
    const prev = byId[r.id];
    if (!prev || new Date(r.updated_at || 0) > new Date(prev.updated_at || 0)) byId[r.id] = r;
  });
  return Object.values(byId).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

// Tiny toast
function Toast({ message, kind = "info", onClose }) {
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

// Rebuild steps from existing keyframes (for legacy rows)
function reconstructStepsFromKeyframes(kf = {}, tl = 0) {
  try {
    const timesSet = new Set();
    Object.values(kf || {}).forEach(arr => (arr || []).forEach(k => {
      if (typeof k.t === "number" && isFinite(k.t) && k.t >= 0) timesSet.add(k.t);
    }));
    const times = Array.from(timesSet).sort((a, b) => a - b);
    if (times.length < 2) return [];
    const ids = Object.keys(kf || {});
    const interp = (id, t) => {
      const arr = kf?.[id] || [];
      if (!arr.length) return { x: 50, y: 50, rot: 0 };
      if (t <= arr[0].t) return { x: arr[0].x, y: arr[0].y, rot: arr[0].rot || 0 };
      if (t >= arr[arr.length - 1].t) return { x: arr[arr.length - 1].x, y: arr[arr.length - 1].y, rot: arr[arr.length - 1].rot || 0 };
      let a = arr[0], b = arr[arr.length - 1];
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].t <= t && t <= arr[i + 1].t) { a = arr[i]; b = arr[i + 1]; break; }
      }
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const L = (x, y) => x + (y - x) * f;
      return { x: L(a.x, b.x), y: L(a.y, b.y), rot: L(a.rot || 0, b.rot || 0) };
    };
    const out = [];
    for (let i = 0; i < times.length - 1; i++) {
      const t0 = times[i], t1 = times[i + 1];
      if (t1 - t0 <= 1e-6) continue;
      const start = {}, end = {};
      ids.forEach(id => { start[id] = interp(id, t0); end[id] = interp(id, t1); });
      out.push({
        id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
        name: `Step ${out.length + 1}`,
        duration: Math.max(0.2, t1 - t0),
        start, end
      });
    }
    return out;
  } catch { return []; }
}

/* ===================== the hook ===================== */

export default function useSessionPlanner({ mode = "designer", fixedHeight = 520 }) {
  const isPreview = mode !== "designer";

  // refs
  const rootRef = useRef(null);
  const topBarRef = useRef(null);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const exportRef = useRef(null);
  const timelineRef = useRef(null);

  // fullscreen (guard)
  const [isFs, setIsFs] = useState(() => !!(typeof document !== "undefined" && document.fullscreenElement));
  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const onFullscreen = () => rootRef.current?.requestFullscreen?.();

  // layout
  const [compact, setCompact] = useState(true);
  const [dock, setDock] = useState("right");
  const [availableH, setAvailableH] = useState(isPreview ? fixedHeight : 600);
  const [stageSize, setStageSize] = useState({ w: 800, h: 518 });

  // design state
  const [pitch, setPitch] = useState("full");
  const [items, setItems] = useState([]); // always an array
  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(() => (Array.isArray(items) ? items.find((i) => i.id === selectedId) : null) || null, [items, selectedId]);

  // pitch style
  const [pitchStyle, setPitchStyle] = useState({
    turf: "#0b7d3b",
    line: "#ffffff",
    lineWidth: 3,
    showGrid: true,
    gridSize: 10,
    gridThickness: 1,
    gridOpacity: 0.16,
  });

  // playback
  const [timeline, setTimeline] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [keyframesById, setKeyframesById] = useState({});
  const [rate, setRate] = useState(1);

  // steps/editing
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editPhase, setEditPhase] = useState(null); // "start" | "end"
  const [editIndex, setEditIndex] = useState(-1);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // global history (null-safe)
  const [globalUndoStack, setGlobalUndoStack] = useState([]);
  const [globalRedoStack, setGlobalRedoStack] = useState([]);
  const pushGlobalUndoSnapshot = (prevItems) => {
    const base = Array.isArray(prevItems) ? prevItems : (Array.isArray(items) ? items : []);
    const snap = deepCloneItems(base);
    setGlobalUndoStack((p) => [...p, snap]);
    setGlobalRedoStack([]);
  };
  const doGlobalUndo = () => {
    if (!globalUndoStack.length) return;
    const prev = globalUndoStack[globalUndoStack.length - 1];
    setGlobalUndoStack((p) => p.slice(0, -1));
    setGlobalRedoStack((p) => [...p, deepCloneItems(items)]);
    setItems(deepCloneItems(prev));
  };
  const doGlobalRedo = () => {
    if (!globalRedoStack.length) return;
    const nxt = globalRedoStack[globalRedoStack.length - 1];
    setGlobalRedoStack((p) => p.slice(0, -1));
    setGlobalUndoStack((p) => [...p, deepCloneItems(items)]);
    setItems(deepCloneItems(nxt));
  };
  const history = {
    undo: doGlobalUndo,
    redo: doGlobalRedo,
    canUndo: globalUndoStack.length > 0,
    canRedo: globalUndoStack.length > 0,
    push: (snapshot) => pushGlobalUndoSnapshot(snapshot),
  };

  // side tab
  const [sideTab, setSideTab] = useState("animation");

  // notes / identity
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [notes, setNotes] = useState("");
  const [designId, setDesignId] = useState(null);

  // sessions index (legacy-aware)
  const [sessionList, setSessionList] = useState(() => loadIndexLegacyAware());

  // toast
  const [toast, setToast] = useState({ message: "", kind: "info" });
  const notify = (message, kind = "info") => {
    setToast({ message, kind });
    clearTimeout((notify)._t);
    (notify)._t = setTimeout(() => setToast({ message: "", kind: "info" }), 2600);
  };
  const toastEl = <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ message: "", kind: "info" })} />;

  // aspect fit with fallbacks
  const layout = layoutById(pitch) || { L: 105, W: 68 };
  const { L, W } = layout;
  const ratio = L / W;
  const RO = typeof ResizeObserver !== "undefined" ? ResizeObserver : class { constructor(){} observe(){} disconnect(){} };

  const recalcAvailable = () => {
    if (isPreview) return;
    const vpTop = viewportRef.current?.getBoundingClientRect().top ?? 0;
    const tlH = dock === "bottom" ? (timelineRef.current?.getBoundingClientRect().height ?? (compact ? 60 : 120)) : 0;
    const pad = 12;
    const vh = window.innerHeight;
    setAvailableH(Math.max(360, vh - vpTop - tlH - pad));
  };
  useLayoutEffect(() => { recalcAvailable(); }, [compact, dock, isPreview]);
  useEffect(() => {
    if (isPreview) return;
    const onResize = () => recalcAvailable();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    const ro = new RO(() => onResize());
    if (timelineRef.current) ro.observe(timelineRef.current);
    if (topBarRef.current) ro.observe(topBarRef.current);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize); ro.disconnect(); };
  }, [isPreview, dock]);

  useEffect(() => {
    const el = viewportRef.current; if (!el) return;
    const ro = new RO((entries) => {
      const entry = entries?.[0];
      const vw = entry?.contentRect?.width ?? el.clientWidth;
      const vh = isPreview ? fixedHeight : availableH;
      let w = vw, h = w / ratio;
      if (h > vh) { h = vh; w = h * ratio; }
      setStageSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, availableH, fixedHeight, isPreview]);

  // palette add
  const nextZ = useRef(10);
  const spawnIdx = useRef(0);
  const addFromPalette = (entry, at) => {
    history.push();
    const i = spawnIdx.current++;
    const offsets = [{ dx: 0, dy: 0 }, { dx: 6, dy: 0 }, { dx: -6, dy: 0 }, { dx: 0, dy: 6 }, { dx: 0, dy: -6 }, { dx: 8, dy: 6 }];
    const off = offsets[i % offsets.length];
    const x = clamp((at?.x ?? 50) + off.dx, 0, 100);
    const y = clamp((at?.y ?? 50) + off.dy, 0, 100);
    const id = uid();
    const base = { id, x, y, rot: 0, z: nextZ.current++ };

    if (entry.type?.startsWith("shape-")) {
      setItems((p) => [
        ...p,
        {
          ...base,
          type: entry.type,
          stroke: entry.defaults?.stroke || "#ffffff",
          strokeWidth: entry.defaults?.strokeWidth || 2,
          fill: entry.defaults?.fill || "#ffffff",
          fillAlpha: entry.defaults?.fillAlpha ?? 0.2,
          dashed: !!entry.defaults?.dashed,
          widthPct: entry.defaults?.widthPct,
          heightPct: entry.defaults?.heightPct,
          radiusPct: entry.defaults?.radiusPct,
          sizePct: entry.defaults?.sizePct,
          lengthPct: entry.defaults?.lengthPct,
        },
      ]);
      setSelectedId(id);
      return;
    }

    setItems((p) => [
      ...p,
      {
        ...base,
        type: entry.type,
        size: entry.defaults?.size ?? 40,
        color: entry.defaults?.color ?? "#ffffff",
        label: entry.defaults?.label ?? "",
        meta: entry.defaults?.meta || {},
      },
    ]);
    setSelectedId(id);
  };
  const onDragStartPalette = (ev, entry) => {
    ev.dataTransfer.setData("application/json", JSON.stringify(entry));
    ev.dataTransfer.effectAllowed = "copy";
  };
  const getStagePoint = (cx, cy) => {
    const el = stageRef.current; if (!el || !el.getBoundingClientRect) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 50, y: 50 };
    return { x: clamp(((cx - r.left) / r.width) * 100, 0, 100), y: clamp(((cy - r.top) / r.height) * 100, 0, 100) };
  };
  const onStageDrop = (ev) => {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("application/json");
    if (!data) return;
    addFromPalette(JSON.parse(data), getStagePoint(ev.clientX, ev.clientY));
  };

  // dragging existing items (crash-proof)
  const dragStartSnapshotRef = useRef(null);
  const dragRef = useRef({ id: null, sx: 0, sy: 0, ox: 0, oy: 0 });

  const onPointerDownItem = (e, it) => {
    try {
      e.stopPropagation();
      setSelectedId(it.id);
      // null-safe snapshot
      dragStartSnapshotRef.current = deepCloneItems(Array.isArray(items) ? items : []);
      dragRef.current = { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y };
      document.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerup", onPointerUp, { passive: true });
      window.addEventListener("mouseup", onPointerUp, { passive: true });
      window.addEventListener("blur", onPointerUp, { passive: true });
    } catch (err) {
      console.error("onPointerDownItem error", err);
    }
  };

  const onPointerMove = (e) => {
    try {
      const d = dragRef.current; if (!d.id) return;
      const el = stageRef.current; if (!el || !el.getBoundingClientRect) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = clamp(d.ox + ((e.clientX - d.sx) / r.width) * 100, 0, 100);
      const ny = clamp(d.oy + ((e.clientY - d.sy) / r.height) * 100, 0, 100);
      setItems((prev) => (Array.isArray(prev) ? prev.map((it) => (it.id === d.id ? { ...it, x: nx, y: ny } : it)) : prev));
    } catch (err) {
      console.error("onPointerMove error", err);
    }
  };

  const onPointerUp = () => {
    try {
      if (dragStartSnapshotRef.current) {
        setGlobalUndoStack((p) => [...p, deepCloneItems(dragStartSnapshotRef.current)]);
        setGlobalRedoStack([]);
        if (isEditing) {
          setUndoStack((p) => [...p, deepCloneItems(dragStartSnapshotRef.current)]);
          setRedoStack([]);
        }
        dragStartSnapshotRef.current = null;
      }
    } finally {
      dragRef.current = { id: null, sx: 0, sy: 0, ox: 0, oy: 0 };
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    }
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    };
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingEl(document.activeElement)) return;

      // global undo/redo
      if (!isEditing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault(); if (e.shiftKey) doGlobalRedo(); else doGlobalUndo(); return;
      }
      if (!isEditing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); doGlobalRedo(); return;
      }

      // edit-mode undo/redo
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return;
      }
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); doRedo(); return;
      }

      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        history.push(); setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== selected.id) : prev)); setSelectedId(null);
      } else if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault(); history.push();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
        setItems((prev) => (Array.isArray(prev)
          ? prev.map((it) => it.id === selected.id ? { ...it, x: clamp(it.x + dx, 0, 100), y: clamp(it.y + dy, 0, 100) } : it)
          : prev));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault(); history.push();
        const copy = { ...selected, id: uid(), x: clamp(selected.x + 2, 0, 100), y: clamp(selected.y + 2, 0, 100), z: (selected.z || 0) + 1 };
        setItems((p) => (Array.isArray(p) ? [...p, copy] : p)); setSelectedId(copy.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, isEditing, items]);

  // animation sampling + playback
  const samplePose = (id, t, fallback) => {
    const arr = keyframesById[id]; if (!arr || !arr.length) return fallback || null;
    if (t <= arr[0].t) return { x: arr[0].x, y: arr[0].y, rot: arr[0].rot || 0 };
    if (t >= arr[arr.length - 1].t) return { x: arr[arr.length - 1].x, y: arr[arr.length - 1].y, rot: arr[arr.length - 1].rot || 0 };
    let a = arr[0], b = arr[arr.length - 1];
    for (let i = 0; i < arr.length - 1; i++) if (arr[i].t <= t && t <= arr[i + 1].t) { a = arr[i]; b = arr[i + 1]; break; }
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), rot: lerp(a.rot || 0, b.rot || 0, f) };
  };
  const evalAt = (t) => setItems((prev) => (Array.isArray(prev)
    ? prev.map((it) => ({ ...it, ...samplePose(it.id, t, { x: it.x, y: it.y, rot: it.rot || 0 }) }))
    : prev));
  useEffect(() => { if (!playing) evalAt(time); }, [time, playing]);
  useEffect(() => {
    if (!playing) return; let raf, start;
    const loopFn = (ts) => {
      if (!start) start = ts;
      const elapsed = ((ts - start) / 1000) * rate;
      const t = loop ? (timeline ? elapsed % timeline : 0) : Math.min(elapsed, timeline);
      evalAt(t); setTime(t);
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline, loop, rate]);

  // steps -> keyframes whenever steps change
  const snapshotAll = () => {
    const map = {};
    (Array.isArray(items) ? items : []).forEach((it) => { map[it.id] = { x: it.x, y: it.y, rot: it.rot || 0 }; });
    return map;
  };
  function buildKeyframesFromSteps(nextSteps = steps) {
    const idSet = new Set((Array.isArray(items) ? items : []).map((i) => i.id));
    (nextSteps || []).forEach((st) => {
      Object.keys(st.start || {}).forEach((id) => idSet.add(id));
      Object.keys(st.end || {}).forEach((id) => idSet.add(id));
    });
    const firstStart = nextSteps[0]?.start || null;
    const initial = {};
    Array.from(idSet).forEach((id) => {
      if (firstStart && firstStart[id]) initial[id] = { ...firstStart[id] };
      else {
        const it = (Array.isArray(items) ? items : []).find((i) => i.id === id);
        initial[id] = it ? { x: it.x, y: it.y, rot: it.rot ?? 0 } : { x: 50, y: 50, rot: 0 };
      }
    });
    const kf = {}; Object.keys(initial).forEach((id) => (kf[id] = [{ t: 0, ...initial[id] }]));
    let tAccum = 0;
    (nextSteps || []).forEach((st) => {
      const duration = Math.max(0.2, Number(st.duration) || 0.2);
      const tStart = tAccum, tEnd = tStart + duration;
      const idList = Array.from(new Set([
        ...Object.keys(initial),
        ...Object.keys(st.start || {}),
        ...Object.keys(st.end || {}),
      ]));
      idList.forEach((id) => {
        const last = (kf[id] && kf[id][kf[id].length - 1]) || { t: 0, x: initial[id].x, y: initial[id].y, rot: initial[id].rot || 0 };
        const lastPose = { x: last.x, y: last.y, rot: (last.rot ?? 0) };
        const sPose = (st.start && st.start[id]) ? st.start[id] : lastPose;
        const ePose = (st.end && st.end[id]) ? st.end[id] : sPose;
        if (!kf[id]) kf[id] = [{ t: 0, ...lastPose }];
        if (!kf[id].some((k) => Math.abs(k.t - tStart) < 1e-6)) kf[id].push({ t: tStart, ...lastPose });
        kf[id].push({ t: tStart, x: sPose.x, y: sPose.y, rot: (sPose.rot ?? 0) });
        kf[id].push({ t: tEnd,   x: ePose.x, y: ePose.y, rot: (ePose.rot ?? 0) });
      });
      tAccum = tEnd;
    });
    Object.values(kf).forEach((arr) => arr.sort((a, b) => a.t - b.t));
    setKeyframesById(kf); setTimeline(Math.max(0, tAccum));
  }
  useEffect(() => { buildKeyframesFromSteps(steps); }, [JSON.stringify(steps), items?.length]);

  // step helpers + editing
  const stepStartTime = (i) => { let t = 0; for (let k = 0; k < i; k++) t += Math.max(0.2, Number(steps[k]?.duration) || 0.2); return t; };
  const stepEndTime   = (i) => stepStartTime(i) + Math.max(0.2, Number(steps[i]?.duration) || 0.2);
  const setItemsToSnapshot = (snap) => { if (!snap) return; setItems((prev) => (Array.isArray(prev) ? prev.map((it) => snap[it.id] ? { ...it, ...snap[it.id] } : it) : prev)); };
  const goToStepStart = (i) => { const j = Math.max(0, Math.min(i, steps.length - 1)); setPlaying(false); setTime(stepStartTime(j)); setItemsToSnapshot(steps[j]?.start); setCurrentStep(j); };
  const goToStepEnd   = (i) => { const j = Math.max(0, Math.min(i, steps.length - 1)); setPlaying(false); setTime(stepEndTime(j));   setItemsToSnapshot(steps[j]?.end);   setCurrentStep(j); };

  const beginAddStep = () => {
    const id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
    const newStep = { id, name: `Step ${steps.length + 1}`, duration: 2, start: null, end: null };
    const next = [...steps, newStep]; setSteps(next); beginEdit(next.length - 1, "start");
  };
  const beginEdit = (i, phase) => {
    const j = Math.max(0, Math.min(i, steps.length - 1));
    setCurrentStep(j); setPlaying(false); setIsEditing(true); setEditPhase(phase); setEditIndex(j);
    setUndoStack([]); setRedoStack([]); if (phase === "start") goToStepStart(j); if (phase === "end") goToStepEnd(j);
  };
  const confirmPhase = () => {
    if (!isEditing || editIndex < 0) return;
    const j = editIndex; const snap = snapshotAll(); const next = steps.slice();
    if (editPhase === "start") { next[j] = { ...next[j], start: snap }; setSteps(next); setEditPhase("end"); }
    else if (editPhase === "end") { next[j] = { ...next[j], end: snap }; setSteps(next); setIsEditing(false); setEditPhase(null); setEditIndex(-1); setTimeout(() => goToStepEnd(j), 0); }
  };
  const cancelEditing = () => { setIsEditing(false); setEditPhase(null); setEditIndex(-1); setUndoStack([]); setRedoStack([]); };

  const doUndo = () => {
    if (!isEditing || !undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((p) => p.slice(0, -1));
    setRedoStack((p) => [...p, deepCloneItems(items)]);
    setItems(deepCloneItems(prev));
  };
  const doRedo = () => {
    if (!isEditing || !redoStack.length) return;
    const nxt = redoStack[redoStack.length - 1];
    setRedoStack((p) => p.slice(0, -1));
    setUndoStack((p) => [...p, deepCloneItems(items)]);
    setItems(deepCloneItems(nxt));
  };
  const resetToStepStart = () => { if (!isEditing || editIndex < 0) return; const snap = steps[editIndex]?.start; if (snap) setItemsToSnapshot(snap); };
  const canUndo = undoStack.length > 0;
  const canRedo = undoStack.length > 0;

  // export helpers
  const onExportImage = (fmt) => {
    const node = exportRef.current || stageRef.current; if (!node) return;
    exportNodeAs(node, fmt, (sessionName || "session").replace(/\s+/g, "_"));
  };
  const onExportVideo = async () => {
    await exportAnimationWebM({
      node: stageRef.current,
      duration: timeline,
      fps: 12,
      pixelRatio: 2,
      seek: (t) => { setTime(t); evalAt(t); },
      filename: (sessionName || "session").replace(/\s+/g, "_") + ".webm",
    });
  };

  // thumbnails + save/load
  function dataUrlToBlob(dataUrl) {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:(.*);base64/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function makeThumbnailPng() {
    const node = stageRef.current || exportRef.current; if (!node) return null;
    const rect = node.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    try {
      return await htmlToImage.toPng(node, {
        cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff", width, height,
        style: { transform: "none", borderRadius: "12px" },
      });
    } catch { return null; }
  }
  async function uploadThumb(userId, id, dataUrl) {
    if (!dataUrl) return null;
    const file = dataUrlToBlob(dataUrl);
    const path = `${userId}/${id}.png`;
    const { error } = await supabase?.storage?.from(THUMBS_BUCKET).upload(path, file, { upsert: true, contentType: "image/png" }) || {};
    if (error) throw error;
    const { data } = supabase?.storage?.from(THUMBS_BUCKET).getPublicUrl(path) || {};
    return data?.publicUrl || null;
  }
  function mirrorLocal(row) {
    try {
      const prev = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      const without = prev.filter((d) => d.id !== row.id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify([
        {
          id: row.id, name: row.name, pitch: row.pitch,
          items: row.data?.items || [], keyframesById: row.data?.keyframesById || {},
          steps: row.data?.steps || [],
          timeline: row.data?.timeline || 0,
          grid: row.data?.meta?.grid ?? true, notes: row.data?.meta?.notes || "",
          thumbnail_url: row.thumbnail_url || null, thumb_dataurl: row.thumb_dataurl || null,
          updated_at: row.updated_at || new Date().toISOString(),
        },
        ...without,
      ]));
      setSessionList(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
    } catch {}
  }

  async function getUserId() {
    try { const { data } = await (supabase?.auth?.getUser?.() || Promise.resolve({ data: null })); return data?.user?.id || null; }
    catch { return null; }
  }

  async function refreshSessionsList() {
    try {
      const uid = await getUserId();
      let remote = [];
      if (uid && supabase?.from) {
        const { data, error } = await supabase
          .from("session_designs")
          .select("id,user_id,name,pitch,data,thumbnail_url,updated_at")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(500);
        if (!error) remote = (data || []).map(normalizeRow);
      }
      const local = loadIndexLegacyAware();
      const byId = {};
      [...remote, ...local].forEach((s) => {
        const prev = byId[s.id];
        if (!prev || new Date(s.updated_at || 0) > new Date(prev.updated_at || 0)) byId[s.id] = s;
      });
      setSessionList(Object.values(byId).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)));
    } catch {
      setSessionList(loadIndexLegacyAware());
    }
  }

  // Save core helper (cloud/local)
  async function saveCore({ forceLocal = false, toNew = false, nameOverride = null } = {}) {
    const wasFs = !!document.fullscreenElement;

    try {
      const user_id = await getUserId();
      const id = toNew || !designId
        ? (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
        : designId;

      // ensure steps persisted (rebuild if user didn't finalize)
      const stepsToSave = (Array.isArray(steps) && steps.length)
        ? steps
        : reconstructStepsFromKeyframes(keyframesById || {}, timeline || 0);

      // thumbnail (best effort)
      let thumbDataUrl = null;
      try { thumbDataUrl = await makeThumbnailPng(); } catch {}
      let uploadedThumbUrl = null;
      try { if (user_id && thumbDataUrl && !forceLocal) uploadedThumbUrl = await uploadThumb(user_id, id, thumbDataUrl); } catch {}

      const rowBase = {
        id, user_id, name: nameOverride || sessionName || "Untitled Session", pitch,
        data: { items, keyframesById, timeline, steps: stepsToSave, meta: { notes: notes || "", grid: pitchStyle?.showGrid ?? true } },
        thumbnail_url: uploadedThumbUrl || thumbDataUrl || null,
        updated_at: new Date().toISOString(),
      };

      let cloudOk = false;
      if (!forceLocal && user_id && supabase?.from) {
        const { error } = await supabase
          .from("session_designs")
          .upsert(rowBase, { onConflict: "id" })
          .select()
          .single();
        if (!error) { cloudOk = true; setDesignId(id); }
      }

      mirrorLocal({ ...rowBase, thumb_dataurl: thumbDataUrl || null });
      await refreshSessionsList();

      if (nameOverride) setSessionName(nameOverride);
      notify(cloudOk ? "Saved to cloud" : "Saved locally", cloudOk ? "success" : "info");
    } catch (err) {
      notify(`Save failed: ${err?.message || err}`, "error");
    } finally {
      if (wasFs && !document.fullscreenElement) onFullscreen?.();
    }
  }

  // Save: popup choice Local or Server
  const onSave = async (opts = {}) => {
    const wantCloud = window.confirm("Save to SERVER?\n\nOK = Server (Supabase)\nCancel = Local only");
    await saveCore({ ...opts, forceLocal: !wantCloud });
  };
  // optional direct handlers for separate buttons
  const onSaveCloud = (opts = {}) => saveCore({ ...opts, forceLocal: false });
  const onSaveLocal = (opts = {}) => saveCore({ ...opts, forceLocal: true });

  // Load: use sessionList first; else local; else remote; set steps if present
  const loadSession = async (id) => {
    // 1) try in-memory list (already merged with remote on mount)
    let s = (sessionList || []).find((x) => x.id === id);

    // 2) fallback to local mirror
    if (!s) {
      const list = loadIndexLegacyAware();
      s = list.find((x) => x.id === id);
    }

    // 3) final fallback: fetch remote
    if (!s && supabase?.from) {
      try {
        const { data, error } = await supabase.from("session_designs").select("*").eq("id", id).single();
        if (!error && data) s = normalizeRow(data);
      } catch {}
    }

    if (!s) { notify("Could not load that design (not found)", "error"); return; }

    setDesignId(id); setSessionName(s.name); setNotes(s.notes || "");
    setPitch(s.pitch || "full"); setItems(Array.isArray(s.items) ? s.items : []);
    setSelectedId(null); setTime(0);

    // Prefer steps if present; else reconstruct steps from existing keyframes
    const nextSteps = (Array.isArray(s.steps) && s.steps.length)
      ? s.steps
      : reconstructStepsFromKeyframes(s.keyframesById || {}, s.timeline || 0);

    setSteps(nextSteps);

    // Also set keyframes/timeline directly in case no effect yet
    setKeyframesById(s.keyframesById || {});
    setTimeline(s.timeline || 0);
  };

  // Delete (cloud + local) and refresh list
  const deleteSession = async (id) => {
    const uid = await getUserId();
    if (uid && supabase?.from) {
      try { await supabase.from("session_designs").delete().eq("id", id).eq("user_id", uid); } catch {}
    }
    // remove from local mirror
    try {
      const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]").filter((r) => r.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
    } catch {}
    await refreshSessionsList();

    if (id === designId) {
      setDesignId(null);
      setSessionName("Untitled Session"); setItems([]); setKeyframesById({}); setNotes("");
      setSelectedId(null); setTime(0); setSteps([]); setTimeline(0);
    }
    notify("Deleted", "success");
  };

  // merge remote sessions on mount (soft-fail)
  useEffect(() => { refreshSessionsList(); }, []);

  // property updates + layers
  const updateSelected = (patch) =>
    selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.map((it) => (it.id === selected.id ? { ...it, ...patch } : it)) : prev)));
  const layerOps = {
    toFront: () =>
      selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.map((it) =>
        it.id === selected.id ? { ...it, z: (Math.max(...prev.map((p) => p.z || 0)) + 1) } : it) : prev))),
    toBack: () =>
      selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.map((it) =>
        it.id === selected.id ? { ...it, z: (Math.min(...prev.map((p) => p.z || 0)) - 1) } : it) : prev))),
    up: () =>
      selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.map((it) =>
        it.id === selected.id ? { ...it, z: (it.z || 0) + 1 } : it) : prev))),
    down: () =>
      selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.map((it) =>
        it.id === selected.id ? { ...it, z: (it.z || 0) - 1 } : it) : prev))),
    deleteSel: () => selected && (history.push(), setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== selected.id) : prev))),
  };

  // new/reset
  const onNew = () => {
    history.push();
    setItems([]); setKeyframesById({}); setSelectedId(null); setTime(0);
    setSessionName("Untitled Session"); setNotes(""); setDesignId(null); setSteps([]); setTimeline(0);
  };

  // expose
  return {
    // refs
    rootRef, topBarRef, viewportRef, stageRef, exportRef, timelineRef,
    // layout
    isPreview, isFs, onFullscreen, availableH, stageSize, compact, setCompact, dock, setDock,
    // design
    pitch, setPitch, pitchStyle, setPitchStyle, items, setItems, selectedId, setSelectedId, selected,
    // palette + dragging
    addFromPalette, onDragStartPalette, onStageDrop, onPointerDownItem,
    // playback
    timeline, setTimeline, time, setTime, playing, setPlaying, loop, setLoop, rate, setRate, evalAt,
    // steps/editing
    steps, setSteps, currentStep, setCurrentStep, beginAddStep, beginEdit, confirmPhase, cancelEditing,
    isEditing, editPhase, editIndex, doUndo, doRedo, canUndo, canRedo, resetToStepStart,
    stepStartTime, stepEndTime, goToStepStart, goToStepEnd,
    // history
    history,
    // properties + layers
    updateSelected, layerOps,
    // notes + sessions
    sessionName, setSessionName, notes, setNotes,
    sessions: { list: sessionList, load: loadSession, del: deleteSession, refresh: refreshSessionsList },
    onSave, onSaveCloud, onSaveLocal, onNew,
    // exports
    onExportImage, onExportVideo,
    // tabs
    sideTab, setSideTab,
    // toast
    toastEl,
  };
}

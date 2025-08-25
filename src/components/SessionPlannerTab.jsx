import React, { useEffect, useRef, useState } from "react";
import Palette from "./designer/Palette";
import PropertiesPanel from "./designer/PropertiesPanel";
import TimelinePanel from "./designer/TimelinePanel";
import AnimationStudio from "./designer/AnimationStudio";
import Stage from "./designer/Stage";
import TopBar from "./designer/TopBar";
import FieldStylePanel from "./designer/FieldStylePanel";
import { PALETTE, PITCHES } from "./designer/constants";
import useSessionPlanner from "../hooks/useSessionPlanner";

/* --------------------------------------------------------------------------
 * Two-finger pinch + pan wrapper (mobile-friendly)
 * - Single finger: untouched — lets Stage handle selection/drag as before.
 * - Two fingers: pinch to zoom, move both fingers to pan the canvas.
 * - Double‑tap (single finger): quick reset to 1x.
 * -------------------------------------------------------------------------- */
function TwoFingerZoomPan({ children, className = "", minScale = 0.75, maxScale = 3 }) {
  const hostRef = useRef(null);
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });
  const pts = useRef(new Map()); // pointerId -> PointerEvent
  const gesture = useRef(null); // baseline for current 2‑finger gesture
  const lastTap = useRef(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    el.style.touchAction = "none"; // allow custom pinch/pan inside the host

    const onPointerDown = (e) => {
      el.setPointerCapture?.(e.pointerId);
      pts.current.set(e.pointerId, e);

      // double‑tap to reset (only when starting with 1 finger)
      const now = Date.now();
      if (pts.current.size === 1 && now - lastTap.current < 280) {
        setT({ x: 0, y: 0, scale: 1 });
        lastTap.current = 0;
      } else if (pts.current.size === 1) {
        lastTap.current = now;
      }

      // Begin baseline if we now have 2 pointers
      if (pts.current.size === 2) {
        const [a, b] = [...pts.current.values()];
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        const dist = Math.hypot(dx, dy);
        gesture.current = { baseScale: t.scale, baseX: t.x, baseY: t.y, baseCx: cx, baseCy: cy, baseDist: dist };
      }
    };

    const onPointerMove = (e) => {
      if (!pts.current.has(e.pointerId)) return;
      pts.current.set(e.pointerId, e);

      if (pts.current.size >= 2 && gesture.current) {
        // prevent page scroll during 2‑finger gesture
        e.preventDefault?.();
        const [a, b] = [...pts.current.values()].slice(0, 2);
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        const dist = Math.hypot(dx, dy) || 1;

        const scale = Math.max(minScale, Math.min(maxScale, gesture.current.baseScale * (dist / gesture.current.baseDist)));
        const x = gesture.current.baseX + (cx - gesture.current.baseCx);
        const y = gesture.current.baseY + (cy - gesture.current.baseCy);
        setT({ x, y, scale });
      }
    };

    const endPointer = (e) => {
      pts.current.delete(e.pointerId);
      if (pts.current.size < 2) gesture.current = null; // finish gesture when fewer than 2 pointers
    };

    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);
    el.addEventListener("pointerleave", endPointer);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPointer);
      el.removeEventListener("pointercancel", endPointer);
      el.removeEventListener("pointerleave", endPointer);
    };
  }, [minScale, maxScale, t.scale]);

  return (
    <div ref={hostRef} className={"relative w-full h-full overflow-hidden " + className}>
      <div
        style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`,
          transformOrigin: "50% 50%",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      {/* Subtle hint for touch devices */}
      <div className="pointer-events-none absolute right-2 bottom-2 text-[10px] px-2 py-1 rounded bg-white/70 border">
        ⌘ Two‑finger pinch to zoom
      </div>
    </div>
  );
}

export default function SessionPlannerTab({ mode = "designer", fixedHeight = 520 }) {
  const sp = useSessionPlanner({ mode, fixedHeight });

  // Defensive aliases so missing props never crash the tree
  const onUndo = sp.doUndo || sp.history?.undo || (() => {});
  const canUndo = (typeof sp.canUndo === "boolean" ? sp.canUndo : !!sp.history?.canUndo);

  // Map id → actual selected item for panels
  const selectedId = sp.selectedId ?? sp.selected ?? null;
  const selectedItem = selectedId ? sp.items.find((it) => it.id === selectedId) || null : null;

  return (
    <div ref={sp.rootRef} className="w-full h-full flex flex-col overflow-hidden text-slate-900">
      <TopBar
        sessionName={sp.sessionName}
        setSessionName={sp.setSessionName}
        pitch={sp.pitch}
        setPitch={sp.setPitch}
        PITCHES={PITCHES}
        compact={sp.compact}
        setCompact={sp.setCompact}
        dock={sp.dock}
        setDock={sp.setDock}
        onUndo={onUndo}
        canUndo={canUndo}
        onNew={sp.onNew}
        sessions={sp.sessions}
        onSave={sp.onSave}
        isFs={sp.isFs}
        onFullscreen={sp.onFullscreen}
        onExportImage={sp.onExportImage}
        onExportVideo={sp.onExportVideo}
      />

      <div
        className="flex-1 min-h-0"
        style={{
          display: "grid",
          gridTemplateColumns: sp.compact ? "260px 1fr 320px" : "300px 1fr 360px",
          gap: sp.compact ? "10px" : "12px",
          padding: sp.compact ? "10px" : "12px",
        }}
      >
        {/* Left: palette + field style + notes */}
        <div className="flex flex-col gap-3" style={{ maxHeight: sp.availableH, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
          <Palette palette={PALETTE} onAdd={sp.addFromPalette} onDragStart={sp.onDragStartPalette} />
          <FieldStylePanel pitchStyle={sp.pitchStyle} setPitchStyle={sp.setPitchStyle} />

          <div className="p-3 rounded-2xl border bg-white shadow-sm">
            <label htmlFor="session-notes" className="font-semibold mb-2 block">Notes</label>
            <textarea
              id="session-notes"
              name="notes"
              className="w-full h-40 p-2 rounded-xl border"
              value={sp.notes}
              onChange={(e) => sp.setNotes(e.target.value)}
              placeholder="Coaching points, progressions, timings..."
              autoComplete="off"
            />
          </div>
        </div>

        {/* Center: stage + notes (included in exports) */}
        <div
          ref={sp.viewportRef}
          className="relative rounded-xl border bg-emerald-700/40 overflow-hidden grid place-items-center w-full"
          style={{ height: sp.isPreview ? fixedHeight : sp.availableH, minHeight: 0, touchAction: "manipulation" }}
        >
          <div ref={sp.exportRef} className="w-full" style={{ maxWidth: `${sp.stageSize.w}px` }}>
            {/*
              Only the Stage is wrapped in the zoom/pan container so the exported notes remain crisp.
              Single-finger interactions are unchanged (drag/select).
             */}
            <TwoFingerZoomPan>
              <Stage
                stageSize={sp.stageSize}
                pitch={sp.pitch}
                pitchStyle={sp.pitchStyle}
                items={sp.items}
                selectedId={selectedId}
                setSelectedId={sp.setSelectedId}
                onPointerDownItem={sp.onPointerDownItem}
                onStageDrop={sp.onStageDrop}
                stageRef={sp.stageRef}
                timeline={sp.timeline}
                playing={sp.playing}
                setPlaying={sp.setPlaying}
                loop={sp.loop}
                setLoop={sp.setLoop}
                rate={sp.rate}
                setRate={sp.setRate}
                time={sp.time}
                setTime={sp.setTime}
                evalAt={sp.evalAt}
              />
            </TwoFingerZoomPan>

            <div className="mt-3 p-3 rounded-lg bg-white/95 text-sm leading-5 text-slate-800 border">
              <div className="font-semibold mb-1">Notes</div>
              <div className="whitespace-pre-wrap">{sp.notes || "—"}</div>
            </div>
          </div>
        </div>

        {/* Right: properties / animation */}
        <div style={{ maxHeight: sp.availableH, display: "grid", gridTemplateRows: "auto 1fr", gap: 8, overflow: "hidden" }}>
          <div className="flex gap-1">
            <button
              className={`px-3 py-2 rounded-xl border ${sp.sideTab === "properties" ? "bg-slate-900 text-white" : ""}`}
              onClick={() => sp.setSideTab("properties")}
            >
              Properties
            </button>
            <button
              className={`px-3 py-2 rounded-xl border ${sp.sideTab === "animation" ? "bg-slate-900 text-white" : ""}`}
              onClick={() => sp.setSideTab("animation")}
            >
              Animation
            </button>
          </div>

          <div className="min-h-0 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {sp.sideTab === "properties" ? (
              <>
                <PropertiesPanel
                  selected={selectedItem}
                  updateSelected={(patch) => sp.updateSelected(patch)}
                  layerOps={sp.layerOps}
                />
                {sp.dock === "right" && (
                  <div className={`${sp.compact ? "p-2" : "p-3"} rounded-2xl border bg-white shadow-sm mt-3`}>
                    <TimelinePanel
                      playing={sp.playing}
                      setPlaying={sp.setPlaying}
                      loop={sp.loop}
                      setLoop={sp.setLoop}
                      timeline={sp.timeline}
                      setTimeline={sp.setTimeline}
                      time={sp.time}
                      setTime={sp.setTime}
                      selected={selectedId}
                    />
                  </div>
                )}
              </>
            ) : (
              <AnimationStudio
                items={sp.items}
                steps={sp.steps}
                setSteps={sp.setSteps}
                currentStep={sp.currentStep}
                setCurrentStep={sp.setCurrentStep}
                playback={{ playing: sp.playing, loop: sp.loop, rate: sp.rate, time: sp.time }}
                setPlayback={(p) => { sp.setPlaying(p.playing); sp.setLoop(p.loop); sp.setRate(p.rate); }}
                setTime={sp.setTime}
                stepStartTime={sp.stepStartTime}
                stepEndTime={sp.stepEndTime}
                goToStepStart={sp.goToStepStart}
                goToStepEnd={sp.goToStepEnd}
                beginAddStep={sp.beginAddStep}
                beginEdit={sp.beginEdit}
                confirmPhase={sp.confirmPhase}
                cancelEditing={sp.cancelEditing}
                isEditing={sp.isEditing}
                editPhase={sp.editPhase}
                editIndex={sp.editIndex}
                undo={sp.doUndo}
                redo={sp.doRedo}
                canUndo={sp.canUndo}
                canRedo={sp.canRedo}
                resetToStepStart={sp.resetToStepStart}
              />
            )}
          </div>
        </div>
      </div>

      {sp.dock === "bottom" && (
        <div ref={sp.timelineRef} className={`${sp.compact ? "p-2" : "p-3"} rounded-2xl border bg-white shadow-sm mx-3 mb-3`}>
          <TimelinePanel
            playing={sp.playing}
            setPlaying={sp.setPlaying}
            loop={sp.loop}
            setLoop={sp.setLoop}
            timeline={sp.timeline}
            setTimeline={sp.setTimeline}
            time={sp.time}
            setTime={sp.setTime}
            selected={selectedId}
          />
        </div>
      )}

      <div className="px-3 pb-3 text-xs text-slate-500">
        Tips: Two‑finger pinch to zoom & pan the pitch. Double‑tap to reset zoom. Edit workflow: Add Step → Confirm Start → move pieces → Confirm End. Undo with the top‑bar button or ⌘/Ctrl‑Z.
      </div>

      {sp.toastEl}
    </div>
  );
}

import React from "react";
import Palette from "./designer/Palette";
import PropertiesPanel from "./designer/PropertiesPanel";
import TimelinePanel from "./designer/TimelinePanel";
import AnimationStudio from "./designer/AnimationStudio";
import Stage from "./designer/Stage";
import TopBar from "./designer/TopBar";
import FieldStylePanel from "./designer/FieldStylePanel";
import { PALETTE, PITCHES } from "./designer/constants";
import useSessionPlanner from "../hooks/useSessionPlanner";

export default function SessionPlannerTab({ mode = "designer", fixedHeight = 520 }) {
  const sp = useSessionPlanner({ mode, fixedHeight });

  // Defensive aliases so missing props never crash the tree
  const onUndo = sp.doUndo || sp.history?.undo || (() => {});
  const canUndo = (typeof sp.canUndo === "boolean" ? sp.canUndo : !!sp.history?.canUndo);

  // 🔧 FIX: PropertiesPanel expects the actual selected ITEM (object),
  // but sp.selected / sp.selectedId are strings (IDs). Map to the item here.
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
        <div className="flex flex-col gap-3" style={{ maxHeight: sp.availableH, overflow: "auto" }}>
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
          style={{ height: sp.isPreview ? fixedHeight : sp.availableH, minHeight: 0 }}
        >
          <div ref={sp.exportRef} className="w-full" style={{ maxWidth: `${sp.stageSize.w}px` }}>
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

          <div className="min-h-0 overflow-auto">
            {sp.sideTab === "properties" ? (
              <>
                <PropertiesPanel
                  // ✅ pass the actual item (object), not the id string
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
                      // TimelinePanel likely only needs the id; keep sending id
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
        Edit workflow: Add Step → Confirm Start → move pieces → Confirm End. Undo with the top-bar button or ⌘/Ctrl-Z.
      </div>

      {sp.toastEl}
    </div>
  );
}

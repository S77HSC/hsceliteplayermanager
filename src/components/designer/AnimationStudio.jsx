// src/components/designer/AnimationStudio.jsx
import React, { useMemo } from "react";

/**
 * Two-phase steps:
 *  Add Step → Confirm Start → move → Confirm End.
 * Now includes Undo/Redo & Reset to Step Start when editing.
 */
export default function AnimationStudio({
  items,
  steps, setSteps,
  currentStep, setCurrentStep,
  playback, setPlayback,        // { playing, loop, rate, time }
  setTime,

  /* timing / nav */
  stepStartTime, stepEndTime,
  goToStepStart, goToStepEnd,

  /* editing (two-phase) */
  beginAddStep,
  beginEdit,          // (index, "start"|"end")
  confirmPhase,       // confirm current edit phase
  cancelEditing,
  isEditing,
  editPhase,
  editIndex,

  /* new: undo/redo/reset inside edit mode */
  undo, redo, canUndo, canRedo,
  resetToStepStart,
}) {
  const totalDuration = useMemo(
    () => steps.reduce((s, st) => s + (Math.max(0.2, Number(st.duration) || 0.2)), 0),
    [steps]
  );

  const removeStep = (idx) => {
    const next = steps.slice(); next.splice(idx, 1);
    setSteps(next);
    setCurrentStep(Math.max(0, Math.min(idx, next.length - 1)));
  };
  const duplicateStep = (idx) => {
    const c = steps[idx];
    const copy = { ...c, id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2)), name: `${c.name} copy` };
    const next = steps.slice(); next.splice(idx + 1, 0, copy);
    setSteps(next); setCurrentStep(idx + 1);
  };
  const move = (idx, dir) => {
    const j = idx + dir; if (j < 0 || j >= steps.length) return;
    const next = steps.slice(); [next[idx], next[j]] = [next[j], next[idx]];
    setSteps(next); setCurrentStep(j);
  };
  const rename = (idx, name) => { const next = steps.slice(); next[idx] = { ...next[idx], name }; setSteps(next); };
  const setDur = (idx, sec) => { const next = steps.slice(); next[idx] = { ...next[idx], duration: Math.max(0.2, Number(sec)||0) }; setSteps(next); };

  return (
    <div className="rounded-2xl border bg-white shadow-sm grid" style={{ gridTemplateRows: "auto 1fr auto" }}>
      {/* Header */}
      <div className="p-2 border-b grid gap-2" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="font-semibold">Animation</div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button className="px-2 py-1 rounded-lg border" onClick={() => setPlayback({ ...playback, playing: !playback.playing })}>
            {playback.playing ? "⏸" : "▶︎"}
          </button>
          <button className="px-2 py-1 rounded-lg border" onClick={() => { setTime(0); setPlayback({ ...playback, playing: true }); }}>▶ From Start</button>
          <button className="px-2 py-1 rounded-lg border" onClick={() => { goToStepStart(currentStep); setPlayback({ ...playback, playing: true }); }}>▶ From Step</button>
          <label className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border">
            <input type="checkbox" checked={playback.loop} onChange={(e)=>setPlayback({ ...playback, loop: e.target.checked })} />
            Loop
          </label>
          <select className="text-xs border rounded-lg px-2 py-1" value={playback.rate} onChange={(e)=>setPlayback({ ...playback, rate: Number(e.target.value) })}>
            {[0.5,0.75,1,1.25,1.5,2,3].map(r => <option key={r} value={r}>{r}×</option>)}
          </select>
          <div className="text-[11px] text-slate-600 pl-1">Total {totalDuration.toFixed(2)}s</div>
        </div>
      </div>

      {/* Steps list */}
      <div className="min-h-0 overflow-auto p-2 sm:p-3 space-y-2">
        {steps.length === 0 && (
          <div className="text-sm text-slate-500">
            No steps yet. Click <em>Add step</em>, then <em>Confirm start</em> → move pieces → <em>Confirm end</em>.
          </div>
        )}
        {steps.map((st, i) => {
          const isCur = i === currentStep;
          const editingThis = isEditing && i === editIndex;
          return (
            <div key={st.id}
                 className={"p-2 rounded-xl border flex flex-wrap items-center gap-2 " +
                            (isCur ? "bg-slate-50 ring-1 ring-slate-200" : "")}>
              <button className="px-2 py-1 rounded-lg border" onClick={() => move(i, -1)} title="Move up">↑</button>
              <button className="px-2 py-1 rounded-lg border" onClick={() => move(i, +1)} title="Move down">↓</button>
              <input className="flex-1 px-2 py-1 rounded-lg border" value={st.name} onChange={(e)=>rename(i, e.target.value)} />
              <label className="flex items-center gap-1 text-sm">
                <span className="text-slate-500">Duration</span>
                <input type="number" min="0.2" step="0.1" className="w-20 px-2 py-1 rounded-lg border" value={st.duration} onChange={(e)=>setDur(i, e.target.value)} />
                <span className="text-slate-500">s</span>
              </label>

              {/* Navigate to exact hard snapshots */}
              <button className="px-2 py-1 rounded-lg border" title="Go to START (hard snapshot)" onClick={() => { setCurrentStep(i); goToStepStart(i); }}>⟸ Start</button>
              <button className="px-2 py-1 rounded-lg border" title="Go to END (hard snapshot)"   onClick={() => { setCurrentStep(i); goToStepEnd(i); }}>End ⟹</button>

              {/* Two-phase editing controls */}
              {!editingThis && (
                <>
                  <button className="px-2 py-1 rounded-lg border" onClick={() => { setCurrentStep(i); beginEdit(i, "start"); }}>
                    Confirm Start
                  </button>
                  <button className="px-2 py-1 rounded-lg border" onClick={() => { setCurrentStep(i); beginEdit(i, "end"); }}>
                    Confirm End
                  </button>
                </>
              )}
              {editingThis && (
                <>
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-800">
                    Editing {editPhase === "start" ? "START" : "END"} — move items then ✓ Confirm
                  </span>
                  <button className="px-2 py-1 rounded-lg border bg-emerald-600 text-white" onClick={confirmPhase}>✓ Confirm</button>
                  <button className="px-2 py-1 rounded-lg border" onClick={cancelEditing}>✕ Cancel</button>
                  <div className="ml-2 flex items-center gap-1">
                    <button className="px-2 py-1 rounded-lg border disabled:opacity-40" onClick={undo} disabled={!canUndo}>↶ Undo</button>
                    <button className="px-2 py-1 rounded-lg border disabled:opacity-40" onClick={redo} disabled={!canRedo}>↷ Redo</button>
                    {editPhase === "end" && (
                      <button className="px-2 py-1 rounded-lg border" title="Reset to step's START snapshot" onClick={resetToStepStart}>↺ Reset to Start</button>
                    )}
                  </div>
                </>
              )}

              <button className="px-2 py-1 rounded-lg border" onClick={() => duplicateStep(i)}>Duplicate</button>
              <button className="px-2 py-1 rounded-lg border text-red-600" onClick={() => removeStep(i)}>Delete</button>

              <span className="ml-auto text-[10px] text-slate-500">{st.start ? "start ✓" : "start —"} • {st.end ? "end ✓" : "end —"}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 sm:p-3 border-t flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={beginAddStep}>+ Add step</button>
        {isEditing && (
          <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
            Use Undo/Redo while editing. Ctrl/⌘+Z, Shift+Ctrl/⌘+Z.
          </span>
        )}
      </div>
    </div>
  );
}

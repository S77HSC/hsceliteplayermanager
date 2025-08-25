import React from "react";

export default function TopBar({
  sessionName, setSessionName,
  pitch, setPitch, PITCHES,
  compact, setCompact,
  dock, setDock,
  onUndo, canUndo,
  onNew,
  sessions, // { list, load, del }
  onSave,
  isFs, onFullscreen,
  onExportImage, onExportVideo,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-white/80">
      <input
        className="px-3 py-2 rounded-xl border w-[240px]"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        placeholder="Session name"
      />

      <select className="px-3 py-2 rounded-xl border" value={pitch} onChange={(e) => setPitch(e.target.value)}>
        {PITCHES.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
      </select>

      <label className="flex items-center gap-2 ml-2">
        <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> Compact UI
      </label>

      <div className="flex items-center gap-2 ml-2">
        <span className="text-sm">Dock</span>
        <select className="px-2 py-1 rounded-lg border" value={dock} onChange={(e) => setDock(e.target.value)}>
          <option value="right">Right</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          className={`px-3 py-2 rounded-xl border ${!canUndo ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘/Ctrl-Z)"
        >
          Undo
        </button>

        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white" onClick={onNew}>New</button>

        <div className="relative">
          <details className="group">
            <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Sessions</summary>
            <div className="absolute right-0 mt-1 w-80 max-h-80 overflow-auto bg-white border rounded-xl shadow-lg p-2 z-10">
              {sessions.list.length === 0 && <div className="text-sm p-2 text-slate-500">No saved sessions yet.</div>}
              {sessions.list.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-lg">
                  <button className="text-left" onClick={() => sessions.load(s.id)}>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.pitch}</div>
                  </button>
                  <button className="text-red-600 text-sm" onClick={() => confirm("Delete this session?") && sessions.del(s.id)}>Delete</button>
                </div>
              ))}
            </div>
          </details>
        </div>

        <button className="px-3 py-2 rounded-xl border" onClick={() => onSave({ toNew: false })}>Save</button>
        {!isFs && <button className="px-3 py-2 rounded-xl border" onClick={onFullscreen}>Fullscreen</button>}

        <div className="relative">
          <details className="group">
            <summary className="px-3 py-2 rounded-xl border cursor-pointer select-none">Export</summary>
            <div className="absolute right-0 mt-1 w-56 bg-white border rounded-xl shadow-lg p-2 z-10">
              <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={() => onExportImage("png")}>PNG (with notes)</button>
              <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={() => onExportImage("jpeg")}>JPEG (with notes)</button>
              <button className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded" onClick={onExportVideo}>Video (WebM)</button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

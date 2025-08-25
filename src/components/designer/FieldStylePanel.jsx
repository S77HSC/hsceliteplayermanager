import React from "react";

export default function FieldStylePanel({ pitchStyle, setPitchStyle }) {
  return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm space-y-2">
      <div className="font-semibold">Field</div>
      <div className="grid grid-cols-2 gap-2 items-center">
        <label className="text-sm text-slate-600">Pitch color</label>
        <input type="color" value={pitchStyle.turf} onChange={(e)=>setPitchStyle(s=>({...s,turf:e.target.value}))} />

        <label className="text-sm text-slate-600">Line color</label>
        <input type="color" value={pitchStyle.line} onChange={(e)=>setPitchStyle(s=>({...s,line:e.target.value}))} />

        <label className="text-sm text-slate-600">Line width</label>
        <input type="range" min={1} max={8} value={pitchStyle.lineWidth} onChange={(e)=>setPitchStyle(s=>({...s,lineWidth:+e.target.value}))} />

        <label className="text-sm text-slate-600">Show grid</label>
        <input type="checkbox" checked={pitchStyle.showGrid} onChange={(e)=>setPitchStyle(s=>({...s,showGrid:e.target.checked}))} />

        <label className="text-sm text-slate-600">Grid size (%)</label>
        <input type="range" min={4} max={20} value={pitchStyle.gridSize} onChange={(e)=>setPitchStyle(s=>({...s,gridSize:+e.target.value}))} />

        <label className="text-sm text-slate-600">Grid thickness</label>
        <input type="range" min={1} max={6} value={pitchStyle.gridThickness} onChange={(e)=>setPitchStyle(s=>({...s,gridThickness:+e.target.value}))} />

        <label className="text-sm text-slate-600">Grid opacity</label>
        <input type="range" min={0} max={1} step={0.01} value={pitchStyle.gridOpacity} onChange={(e)=>setPitchStyle(s=>({...s,gridOpacity:+e.target.value}))} />
      </div>
      {/* Logo uploader intentionally removed */}
    </div>
  );
}

import React from "react";

export default function TimelinePanel({
  playing, setPlaying, loop, setLoop,
  timeline, setTimeline, time, setTime,
  addKeyframe, selected
}) {
  return (
    <div className="p-2 rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Animation</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={loop} onChange={(e)=>setLoop(e.target.checked)} /> Loop
        </label>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button className={`px-3 py-1.5 rounded-lg ${playing ? "bg-slate-200" : "bg-slate-900 text-white"}`} onClick={()=>setPlaying(true)}>Play</button>
        <button className="px-3 py-1.5 rounded-lg border" onClick={()=>setPlaying(false)}>Pause</button>
        <button className="px-3 py-1.5 rounded-lg border" onClick={()=>{ setPlaying(false); setTime(0); }}>Stop</button>
      </div>
      <div className="space-y-2">
        <label className="text-sm block">
          Length ({timeline}s)
          <input type="range" min={3} max={60} value={timeline} onChange={(e)=>setTimeline(parseInt(e.target.value))} className="w-full" />
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={timeline} step={0.01} value={time} onChange={(e)=>setTime(parseFloat(e.target.value))} className="flex-1" />
          <div className="w-14 text-right text-sm tabular-nums">{time.toFixed(2)}s</div>
          <button className="px-3 py-1.5 rounded-lg border" onClick={addKeyframe} disabled={!selected}>+ Keyframe</button>
        </div>
      </div>
    </div>
  );
}

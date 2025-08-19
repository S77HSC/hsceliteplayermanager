import React from "react";

function PalettePreview({ type, color = "#fff" }) {
  switch (type) {
    case "player": return <div className="w-8 h-8 rounded-full border-2 border-black/30" style={{ background: color }} />;
    case "ball":   return <div className="w-7 h-7 rounded-full border border-black/70 bg-white grid place-items-center"><div className="w-1.5 h-1.5 rounded-full bg-black/70" /></div>;
    case "cone":   return <svg viewBox="0 0 100 100" className="w-8 h-8"><path d="M50 5 L85 85 H15 Z" fill={color} stroke="#00000055" strokeWidth="3" /></svg>;
    case "goal":   return <svg viewBox="0 0 200 120" className="w-10 h-7"><rect x="5" y="40" width="190" height="60" fill="#e5e7eb" stroke="#00000066" strokeWidth="4" /></svg>;
    case "slalom": return <div className="w-1.5 h-8" style={{ background: color }} />;
    case "hurdle": return <div className="w-10 h-2" style={{ background: color }} />;
    case "marker": return <div className="w-4 h-4 rounded-full" style={{ background: color }} />;
    case "shape-line": return <svg viewBox="0 0 40 8" className="w-10 h-4"><line x1="0" y1="4" x2="40" y2="4" stroke="#111" strokeWidth="3" /></svg>;
    case "shape-line-dashed": return <svg viewBox="0 0 40 8" className="w-10 h-4"><line x1="0" y1="4" x2="40" y2="4" stroke="#111" strokeWidth="3" strokeDasharray="6 6" /></svg>;
    case "shape-rect":
    case "shape-rect-outline": return <svg viewBox="0 0 40 28" className="w-10 h-7"><rect x="3" y="3" width="34" height="22" rx="5" fill={type==="shape-rect" ? "#94a3b84d" : "none"} stroke="#111" strokeWidth="2" /></svg>;
    case "shape-circle":   return <svg viewBox="0 0 28 28" className="w-7 h-7"><circle cx="14" cy="14" r="12" fill="#94a3b84d" stroke="#111" strokeWidth="2" /></svg>;
    case "shape-triangle": return <svg viewBox="0 0 32 28" className="w-8 h-7"><polygon points="16,2 30,26 2,26" fill="#94a3b84d" stroke="#111" strokeWidth="2" /></svg>;
    case "shape-arrow":  return <svg viewBox="0 0 40 12" className="w-10 h-4"><defs><marker id="m1" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><polygon points="0 0, 10 5, 0 10" fill="#111" /></marker></defs><line x1="0" y1="6" x2="34" y2="6" stroke="#111" strokeWidth="3" markerEnd="url(#m1)" /></svg>;
    case "shape-curve":  return <svg viewBox="0 0 40 20" className="w-10 h-5"><defs><marker id="m2" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><polygon points="0 0, 10 5, 0 10" fill="#111" /></marker></defs><path d="M0 10 Q 20 2, 34 10" fill="none" stroke="#111" strokeWidth="3" markerEnd="url(#m2)"/></svg>;
    case "shape-curve2": return <svg viewBox="0 0 40 20" className="w-10 h-5"><defs><marker id="m3" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><polygon points="0 0, 10 5, 0 10" fill="#111" /></marker></defs><path d="M0 10 C 10 2, 10 18, 20 10 S 30 2, 34 10" fill="none" stroke="#111" strokeWidth="3" markerEnd="url(#m3)"/></svg>;
    default: return null;
  }
}

export default function Palette({ palette, onAdd, onDragStart }) {
  return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm">
      <div className="font-semibold mb-2">Kit Palette</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
        {palette.map((p,i)=>(
          <button
            key={i}
            onClick={()=>onAdd(p)}
            draggable
            onDragStart={(e)=>onDragStart(e,p)}
            title={`${p.name} (click to add, drag to place)`}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:bg-slate-50 active:scale-[0.98] transition"
          >
            <PalettePreview type={p.type} color={p.defaults.color || p.defaults.stroke} />
            <div className="text-[11px] leading-none text-slate-700">{p.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

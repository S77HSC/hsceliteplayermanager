// src/components/designer/PropertiesPanel.jsx
import React from "react";

export default function PropertiesPanel({ selected, updateSelected, layerOps }) {
  if (!selected) {
    return (
      <div className="p-3 rounded-2xl border bg-white shadow-sm text-sm text-slate-600">
        Select an item on the field to edit its properties.
      </div>
    );
  }

  const set = (k, v) => updateSelected({ [k]: v });

  return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm space-y-3">
      <div className="font-semibold">Properties</div>

      {/* Common */}
      <div className="grid grid-cols-2 gap-2 items-center text-sm">
        <label className="text-slate-600">Rotation</label>
        <input type="number" value={selected.rot || 0} onChange={(e)=>set("rot", parseFloat(e.target.value)||0)} />

        {"size" in selected && (
          <>
            <label className="text-slate-600">Size</label>
            <input type="range" min={12} max={160} value={selected.size} onChange={(e)=>set("size", parseInt(e.target.value))} />
          </>
        )}

        {"color" in selected && (
          <>
            <label className="text-slate-600">Color</label>
            <input type="color" value={selected.color} onChange={(e)=>set("color", e.target.value)} />
          </>
        )}

        {"label" in selected && (
          <>
            <label className="text-slate-600">Label</label>
            <input type="text" value={selected.label} onChange={(e)=>set("label", e.target.value)} />
          </>
        )}

        {"stroke" in selected && (
          <>
            <label className="text-slate-600">Stroke</label>
            <input type="color" value={selected.stroke} onChange={(e)=>set("stroke", e.target.value)} />
            <label className="text-slate-600">Stroke width</label>
            <input type="range" min={1} max={10} value={selected.strokeWidth || 2} onChange={(e)=>set("strokeWidth", parseInt(e.target.value))} />
          </>
        )}

        {"fillAlpha" in selected && (
          <>
            <label className="text-slate-600">Fill</label>
            <input type="color" value={selected.fill || "#ffffff"} onChange={(e)=>set("fill", e.target.value)} />
            <label className="text-slate-600">Fill opacity</label>
            <input type="range" min={0} max={1} step={0.01} value={selected.fillAlpha ?? 0.2} onChange={(e)=>set("fillAlpha", parseFloat(e.target.value))} />
          </>
        )}
      </div>

      {/* Layering */}
      <div className="border-t pt-2">
        <div className="font-medium text-sm mb-1">Layer</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded-lg border" onClick={layerOps?.toBack}>Send to back</button>
          <button className="px-2 py-1 rounded-lg border" onClick={layerOps?.down}>↓</button>
          <button className="px-2 py-1 rounded-lg border" onClick={layerOps?.up}>↑</button>
          <button className="px-2 py-1 rounded-lg border" onClick={layerOps?.toFront}>Bring to front</button>
        </div>
      </div>
    </div>
  );
}

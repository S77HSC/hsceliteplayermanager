import React from "react";

export default function PropertiesPanel({ selected, updateSelected }) {
  if (!selected) return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm mb-3">
      <div className="font-semibold mb-2">Properties</div>
      <div className="text-sm text-slate-500">Select an object on the pitch.</div>
    </div>
  );

  return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm mb-3">
      <div className="font-semibold mb-2">Properties</div>
      <div className="space-y-3">
        <div className="text-sm"><span className="font-medium">Type:</span> {selected.type.replace("shape-","")}</div>

        {"size" in selected && (
          <label className="text-sm block">Size
            <input type="range" min={12} max={180} className="w-full"
              value={selected.size} onChange={(e)=>updateSelected({ size: parseInt(e.target.value) })} />
          </label>
        )}
        <label className="text-sm block">Rotation
          <input type="range" min={-180} max={180} className="w-full"
            value={selected.rot || 0} onChange={(e)=>updateSelected({ rot: parseInt(e.target.value) })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">X (%)
            <input type="number" step="0.1" className="w-full mt-1 px-2 py-1 rounded-lg border"
              value={selected.x.toFixed(1)} onChange={(e)=>updateSelected({ x: parseFloat(e.target.value)||0 })} />
          </label>
          <label className="text-sm">Y (%)
            <input type="number" step="0.1" className="w-full mt-1 px-2 py-1 rounded-lg border"
              value={selected.y.toFixed(1)} onChange={(e)=>updateSelected({ y: parseFloat(e.target.value)||0 })} />
          </label>
        </div>

        {"color" in selected && (
          <label className="text-sm block">Color
            <input type="color" className="w-full mt-1 h-9 rounded-lg border"
              value={selected.color} onChange={(e)=>updateSelected({ color: e.target.value })} />
          </label>
        )}
        {"label" in selected && (
          <label className="text-sm block">Label / #
            <input
              className="w-full mt-1 px-2 py-1 rounded-lg border"
              value={selected.label || ""}
              onChange={(e)=>updateSelected({ label: e.target.value })}
              onKeyDown={(e)=>e.stopPropagation()} // protect Delete
            />
          </label>
        )}

        {/* shape props */}
        {selected.type?.startsWith("shape-") && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Stroke
                <input type="color" className="w-full mt-1 h-9 rounded-lg border"
                  value={selected.stroke || "#ffffff"} onChange={(e)=>updateSelected({ stroke: e.target.value })} />
              </label>
              <label className="text-sm">Width
                <input type="range" min={1} max={12} className="w-full"
                  value={selected.strokeWidth || 2} onChange={(e)=>updateSelected({ strokeWidth: parseInt(e.target.value) })} />
              </label>
            </div>
            {"dashed" in selected && (
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={!!selected.dashed}
                  onChange={(e)=>updateSelected({ dashed: e.target.checked })} /> Dashed
              </label>
            )}
            {["shape-rect","shape-rect-outline","shape-circle","shape-triangle"].includes(selected.type) && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Fill
                  <input type="color" className="w-full mt-1 h-9 rounded-lg border"
                    value={selected.fill || "#ffffff"} onChange={(e)=>updateSelected({ fill: e.target.value })} />
                </label>
                <label className="text-sm">Opacity
                  <input type="range" min={0} max={1} step={0.05} className="w-full"
                    value={selected.fillAlpha ?? 0.2} onChange={(e)=>updateSelected({ fillAlpha: parseFloat(e.target.value) })} />
                </label>
              </div>
            )}
            {["shape-rect","shape-rect-outline"].includes(selected.type) && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Width (%)
                  <input type="range" min={4} max={80} className="w-full"
                    value={selected.widthPct ?? 20} onChange={(e)=>updateSelected({ widthPct: parseInt(e.target.value) })} />
                </label>
                <label className="text-sm">Height (%)
                  <input type="range" min={4} max={60} className="w-full"
                    value={selected.heightPct ?? 12} onChange={(e)=>updateSelected({ heightPct: parseInt(e.target.value) })} />
                </label>
              </div>
            )}
            {selected.type === "shape-circle" && (
              <label className="text-sm block">Radius (%)
                <input type="range" min={2} max={30} className="w-full"
                  value={selected.radiusPct ?? 8} onChange={(e)=>updateSelected({ radiusPct: parseInt(e.target.value) })} />
              </label>
            )}
            {selected.type === "shape-triangle" && (
              <label className="text-sm block">Size (%)
                <input type="range" min={4} max={40} className="w-full"
                  value={selected.sizePct ?? 12} onChange={(e)=>updateSelected({ sizePct: parseInt(e.target.value) })} />
              </label>
            )}
            {["shape-line","shape-line-dashed","shape-arrow","shape-curve","shape-curve2"].includes(selected.type) && (
              <label className="text-sm block">Length (%)
                <input type="range" min={6} max={90} className="w-full"
                  value={selected.lengthPct ?? 24} onChange={(e)=>updateSelected({ lengthPct: parseInt(e.target.value) })} />
              </label>
            )}
            {["shape-curve","shape-curve2"].includes(selected.type) && (
              <label className="text-sm block">Bend
                <input type="range" min={-40} max={40} className="w-full"
                  value={selected.bendPct ?? 18} onChange={(e)=>updateSelected({ bendPct: parseInt(e.target.value) })} />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React from "react";

export default function PropertiesPanel({ selected, updateSelected, layerOps }) {
  if (!selected) {
    return (
      <div className="p-3 rounded-2xl border bg-white shadow-sm text-sm text-slate-600">
        Select an item on the field to edit its properties.
      </div>
    );
  }

  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const set = (k, v) => updateSelected({ [k]: v });

  const t = String(selected.type || "").toLowerCase();
  const isRect = /^(shape-rect|shape-rect-outline)$/.test(t);
  const isTriangle = /^shape-triangle$/.test(t);
  const isCircle = /^shape-circle$/.test(t);
  const isLine = /^shape-line(-dashed)?$/.test(t);
  const isArrow = /^(shape-arrow(-dashed)?|shape-arrow-2head)$/.test(t);

  // Show Dashed for all five shapes
  const canDash = isRect || isTriangle || isCircle || isLine || isArrow;
  const isDashedType = /-dashed$/.test(t);
  const toggleDashed = (checked) => {
    const patch = { dashed: !!checked };
    // keep legacy type variants for line/arrow so either renderer path works
    if (/^shape-line/.test(t)) patch.type = checked ? "shape-line-dashed" : "shape-line";
    if (/^shape-arrow(?!-2head)/.test(t)) patch.type = checked ? "shape-arrow-dashed" : "shape-arrow";
    updateSelected(patch);
  };

  // length for line/arrow; mirror to sizePct so either code path reacts
  const setLengthPct = (v) => {
    const val = num(v, selected.lengthPct ?? selected.sizePct ?? 20);
    updateSelected({ lengthPct: val, sizePct: val });
  };

  // circle size control; mirror sizePct <-> radiusPct
  const setCircleSize = (v) => {
    const val = num(v, selected.sizePct ?? selected.radiusPct ?? 10);
    updateSelected({ sizePct: val, radiusPct: val });
  };

  return (
    <div className="p-3 rounded-2xl border bg-white shadow-sm space-y-3">
      <div className="font-semibold">Properties</div>

      <div className="grid grid-cols-2 gap-2 items-center text-sm">
        {/* Rotation */}
        <label className="text-slate-600">Rotation</label>
        <input
          type="number"
          value={num(selected.rot, 0)}
          onChange={(e) => set("rot", num(e.target.value, 0))}
        />

        {/* Pixel size for non-shape icons (players/markers/labels etc.) */}
        {"size" in selected && !isCircle && !isRect && !isTriangle && !isLine && !isArrow && (
          <>
            <label className="text-slate-600">Size</label>
            <input
              type="range"
              min={12}
              max={200}
              step={1}
              value={num(selected.size, 40)}
              onChange={(e) => set("size", num(e.target.value, 40))}
            />
          </>
        )}

        {/* Color */}
        {"color" in selected && (
          <>
            <label className="text-slate-600">Color</label>
            <input
              type="color"
              value={selected.color || "#ffffff"}
              onChange={(e) => set("color", e.target.value)}
            />
          </>
        )}

        {/* Label text */}
        {"label" in selected && (
          <>
            <label className="text-slate-600">Label</label>
            <input
              type="text"
              value={selected.label || ""}
              onChange={(e) => set("label", e.target.value)}
            />
          </>
        )}

        {/* Stroke / Fill for shapes */}
        {"stroke" in selected && (
          <>
            <label className="text-slate-600">Stroke</label>
            <input
              type="color"
              value={selected.stroke || "#ffffff"}
              onChange={(e) => set("stroke", e.target.value)}
            />
            <label className="text-slate-600">Stroke width</label>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={num(selected.strokeWidth, 2)}
              onChange={(e) => set("strokeWidth", num(e.target.value, 2))}
            />
          </>
        )}

        {"fillAlpha" in selected && (
          <>
            <label className="text-slate-600">Fill</label>
            <input
              type="color"
              value={selected.fill || "#ffffff"}
              onChange={(e) => set("fill", e.target.value)}
            />
            <label className="text-slate-600">Fill opacity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={num(selected.fillAlpha, 0.2)}
              onChange={(e) => set("fillAlpha", num(e.target.value, 0.2))}
            />
          </>
        )}

        {/* ===== Shape-specific sizing ===== */}

        {/* Box / Triangle: width & height only */}
        {(isRect || isTriangle) && (
          <>
            <label className="text-slate-600">Width (%)</label>
            <input
              type="range"
              min={4}
              max={200}
              step={1}
              value={num(selected.widthPct, 20)}
              onChange={(e) => set("widthPct", num(e.target.value, 20))}
            />

            <label className="text-slate-600">Height (%)</label>
            <input
              type="range"
              min={4}
              max={200}
              step={1}
              value={num(selected.heightPct, 12)}
              onChange={(e) => set("heightPct", num(e.target.value, 12))}
            />
          </>
        )}

        {/* Circle: single size control */}
        {isCircle && (
          <>
            <label className="text-slate-600">Size (%)</label>
            <input
              type="range"
              min={4}
              max={200}
              step={1}
              value={num(selected.sizePct ?? selected.radiusPct, 10)}
              onChange={(e) => setCircleSize(e.target.value)}
            />
          </>
        )}

        {/* Line / Arrow: length + dashed */}
        {(isLine || isArrow) && (
          <>
            <label className="text-slate-600">Length (%)</label>
            <input
              type="range"
              min={4}
              max={200}
              step={1}
              value={num(selected.lengthPct ?? selected.sizePct, 24)}
              onChange={(e) => setLengthPct(e.target.value)}
            />

            <label className="text-slate-600">Dashed</label>
            <input
              type="checkbox"
              checked={!!selected.dashed || isDashedType}
              onChange={(e) => toggleDashed(e.target.checked)}
            />
          </>
        )}

        {/* Dashed for box / circle / triangle */}
        {(isRect || isTriangle || isCircle) && !isLine && !isArrow && (
          <>
            <label className="text-slate-600">Dashed</label>
            <input
              type="checkbox"
              checked={!!selected.dashed}
              onChange={(e) => updateSelected({ dashed: e.target.checked })}
            />
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
          <button className="ml-auto px-2 py-1 rounded-lg border text-red-600" onClick={layerOps?.deleteSel}>Delete</button>
        </div>
      </div>
    </div>
  );
}

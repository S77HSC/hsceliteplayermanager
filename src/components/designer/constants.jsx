// src/components/designer/constants.js

// ---- Palette entries shown in the left sidebar ----
export const PALETTE = [
  // Players / kit
  { id: "player-blue",   type: "player", name: "Player (Blue)",   defaults: { color: "#4aa3ff", size: 36, label: "8"  } },
  { id: "player-red",    type: "player", name: "Player (Red)",    defaults: { color: "#ff5252", size: 36, label: "10" } },
  { id: "player-keeper", type: "player", name: "Goalkeeper",      defaults: { color: "#ffd84a", size: 36, label: "1"  } },

  { id: "ball",          type: "ball",   name: "Ball",            defaults: { size: 16 } },
  { id: "cone",          type: "cone",   name: "Cone",            defaults: { color: "#ff8a34", size: 22 } },
  { id: "marker",        type: "marker", name: "Marker",          defaults: { color: "#f4c430", size: 14 } },
  { id: "goal",          type: "goal",   name: "Goal",            defaults: { size: 64 } },

  // Training kit that was missing
  { id: "slalom",        type: "slalom", name: "Agility Pole",    defaults: { color: "#ffb703", size: 56 } },
  { id: "hurdle",        type: "hurdle", name: "Hurdle",          defaults: { color: "#e5e7eb", size: 72 } },

  // Lines & Shapes
  { id: "shape-line",         type: "shape-line",         name: "Line",               defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 14 } },
  { id: "shape-line-dashed",  type: "shape-line-dashed",  name: "Dashed Line",        defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 14 } },

  { id: "shape-rect",         type: "shape-rect",         name: "Box (Filled)",       defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.12, widthPct: 18, heightPct: 10 } },
  { id: "shape-rect-outline", type: "shape-rect-outline", name: "Box (Outline)",      defaults: { stroke: "#ffffff", strokeWidth: 2, widthPct: 18, heightPct: 10 } },

  { id: "shape-circle",       type: "shape-circle",       name: "Circle",             defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.12, sizePct: 10 } },
  { id: "shape-triangle",     type: "shape-triangle",     name: "Triangle",           defaults: { stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff", fillAlpha: 0.12, sizePct: 10 } },

  // Arrows (all variants)
  { id: "shape-arrow",        type: "shape-arrow",        name: "Arrow →",            defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 14 } },
  { id: "shape-arrow-dashed", type: "shape-arrow-dashed", name: "Arrow (Dashed) →",   defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 14 } },
  { id: "shape-arrow-2head",  type: "shape-arrow-2head",  name: "Arrow ⇄ (Two-head)", defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 14 } },

  // Curved arrows
  { id: "shape-curve",        type: "shape-curve",        name: "Curve ↝",            defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 18 } },
  { id: "shape-curve2",       type: "shape-curve2",       name: "S-Curve ↝",          defaults: { stroke: "#ffffff", strokeWidth: 3, lengthPct: 18 } },
];

// ---- Pitch choices (kept minimal per your request) ----
export const PITCHES = [
  { id: "full",  name: "Full Pitch (11v11)" },
  { id: "half",  name: "Half Pitch" },
  { id: "blank", name: "Blank Area" },
];

// ---- Default field styling ----
export const DEFAULT_PITCH_STYLE = {
  turf: "#0b7d3b",
  line: "#ffffff",
  lineWidth: 3,
  showGrid: true,
  gridSize: 10,
  gridThickness: 1,
  gridOpacity: 0.16,
};

// Optional color swatch used by some UIs
export const SWATCH = [
  "#ffffff", "#f4c430", "#ff8a34", "#ff5252",
  "#4aa3ff", "#00c2a8", "#b476ff", "#222222",
];

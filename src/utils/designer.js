// utils/designer.js
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (x, y, t) => x + (y - x) * t;

let _uid_i = 0;
export const uid = () => `id_${Date.now().toString(36)}_${_uid_i++}`;

export const hexToRGBA = (hex, a = 1) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#ffffff");
  const r = parseInt(m?.[1] || "ff", 16);
  const g = parseInt(m?.[2] || "ff", 16);
  const b = parseInt(m?.[3] || "ff", 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
};

export const isTypingEl = (el) =>
  !!el &&
  (el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable);

// FA-ish dimensions (stable & consistent)
export function layoutById(id) {
  const LAYOUTS = {
    full:   { L: 105, W: 68, spot: 11,   paDepth: 16.5, paWidth: 40.32, gaDepth: 5.5, gaWidth: 18.32, circle: 9.15, drawStandard: true },
    "9v9":  { L: 73,  W: 46, spot: 8.23, paDepth: 11.88,paWidth: 29.26, gaDepth: 4.57, gaWidth: 10.97, circle: 7.5,  drawStandard: true },
    "7v7":  { L: 55,  W: 37, spot: 7.32, paDepth: 9.14, paWidth: 16.46, gaDepth: 4.57, gaWidth: 10.97, circle: 6,    drawStandard: true },
    futsal: { L: 40,  W: 20, circle: 6, drawFutsal: true },
    blank:  { L: 60,  W: 40, drawBlank: true },
  };
  return LAYOUTS[id] || LAYOUTS.full;
}

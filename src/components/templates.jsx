// src/components/designer/formationTemplates.js
// Two-team formation templates (11v11, 9v9, 7v7, 5v5, 3v3)
// Red (left→right) vs Blue (right→left) with classic jersey numbers.

import { uid as makeId } from "../../utils/designer";

// Fallback uid if the util changes
const uid = () =>
  typeof makeId === "function" ? makeId() : Math.random().toString(36).slice(2, 10);

const RED = "#ef4444";
const BLUE = "#3b82f6";
const SIZE = 46;

function P(x, y, label, color) {
  return { id: uid(), type: "player", x, y, rot: 0, size: SIZE, color, label: String(label), meta: {} };
}
function mirror(pt) {
  return { ...pt, x: 100 - pt.x, y: 100 - pt.y };
}
function twoTeams(leftPts) {
  const left = leftPts.map((p) => P(p.x, p.y, p.label, RED));
  const right = leftPts.map((p) => {
    const m = mirror(p);
    return P(m.x, m.y, p.label, BLUE);
  });
  return [...left, ...right];
}

/* ───────── 11v11 – 4-3-3 vs 4-3-3 (Full pitch) ───────── */
function F_11v11_433() {
  const GKX = 7, DEF = 20, MID = 40, FWD = 65, ST = 75;
  const pts = [
    // GK
    { x: GKX, y: 50, label: 1 },
    // Back four (RB, RCB, LCB, LB)
    { x: DEF, y: 25, label: 2 },
    { x: DEF, y: 40, label: 4 },
    { x: DEF, y: 60, label: 5 },
    { x: DEF, y: 75, label: 3 },
    // Mid three (8, 6, 10)
    { x: MID, y: 35, label: 8 },
    { x: MID - 3, y: 50, label: 6 },
    { x: MID, y: 65, label: 10 },
    // Front three (7, 9, 11)
    { x: FWD, y: 25, label: 7 },
    { x: ST,  y: 50, label: 9 },
    { x: FWD, y: 75, label: 11 },
  ];
  return twoTeams(pts);
}

/* ───────── 9v9 – 3-3-2 vs 3-3-2 (9v9 pitch) ───────── */
function F_9v9_332() {
  const GKX = 7, DEF = 22, MID = 40, FWD = 62;
  const pts = [
    { x: GKX, y: 50, label: 1 },
    // Back 3 (RB, CB, LB)
    { x: DEF, y: 30, label: 2 },
    { x: DEF, y: 50, label: 4 },
    { x: DEF, y: 70, label: 3 },
    // Mid 3 (6, 8, 10)
    { x: MID, y: 35, label: 6 },
    { x: MID, y: 50, label: 8 },
    { x: MID, y: 65, label: 10 },
    // Front 2 (7, 9)
    { x: FWD, y: 42, label: 7 },
    { x: FWD, y: 58, label: 9 },
  ];
  return twoTeams(pts);
}

/* ───────── 7v7 – 2-3-1 vs 2-3-1 (7v7 pitch) ───────── */
function F_7v7_231() {
  const GKX = 7, DEF = 25, MID = 45, ST = 65;
  const pts = [
    { x: GKX, y: 50, label: 1 },
    // Back 2
    { x: DEF, y: 35, label: 2 },
    { x: DEF, y: 65, label: 3 },
    // Mid 3
    { x: MID, y: 30, label: 6 },
    { x: MID, y: 50, label: 4 },
    { x: MID, y: 70, label: 7 },
    // ST
    { x: ST, y: 50, label: 9 },
  ];
  return twoTeams(pts);
}

/* ───────── 5v5 – 2-2 vs 2-2 (Futsal/indoor) ───────── */
function F_5v5_22() {
  const GKX = 7, DEF = 30, FWD = 60;
  const pts = [
    { x: GKX, y: 50, label: 1 },
    // Back 2
    { x: DEF, y: 40, label: 2 },
    { x: DEF, y: 60, label: 3 },
    // Front 2
    { x: FWD, y: 42, label: 7 },
    { x: FWD, y: 58, label: 9 },
  ];
  return twoTeams(pts);
}

/* ───────── 3v3 – 1-2 vs 1-2 (Futsal/indoor) ───────── */
function F_3v3_12() {
  const GKX = 7, FWD = 60;
  const pts = [
    { x: GKX, y: 50, label: 1 },
    { x: FWD, y: 40, label: 7 },
    { x: FWD, y: 60, label: 9 },
  ];
  return twoTeams(pts);
}

export const FORMATION_TEMPLATES = [
  { id: "form_11v11_433_v_433", name: "11v11 – 4-3-3 vs 4-3-3", pitchId: "full",   make: () => F_11v11_433() },
  { id: "form_9v9_332_v_332",   name: "9v9 – 3-3-2 vs 3-3-2",   pitchId: "9v9",    make: () => F_9v9_332() },
  { id: "form_7v7_231_v_231",   name: "7v7 – 2-3-1 vs 2-3-1",   pitchId: "7v7",    make: () => F_7v7_231() },
  { id: "form_5v5_22_v_22",     name: "5v5 – 2-2 vs 2-2",       pitchId: "futsal", make: () => F_5v5_22() },
  { id: "form_3v3_12_v_12",     name: "3v3 – 1-2 vs 1-2",       pitchId: "futsal", make: () => F_3v3_12() },
];

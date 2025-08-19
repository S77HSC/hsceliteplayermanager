import { uid } from "../../utils/designer";

const p = (color, x, y, label="") => ({ id: uid(), type: "player", color, x, y, size: 46, rot: 0, label });
const ballAt = (x, y) => ({ id: uid(), type: "ball", x, y, size: 28, color: "#ffffff" });
const arrow = (x, y, lengthPct, rot=0, stroke="#ffffff") =>
  ({ id: uid(), type: "shape-arrow", x, y, lengthPct, rot, stroke, strokeWidth: 3, dashed: false });

function ring(cx, cy, color, labels) {
  const r = 12;
  return labels.map((lab, i) => {
    const t = (i / labels.length) * Math.PI * 2;
    return p(color, cx + r * Math.cos(t), cy + r * Math.sin(t), String(lab));
  });
}

export const TEMPLATES = [
  {
    id: "kickoff",
    name: "Kick-off (4-3-3)",
    make: (color = "#ef4444") => ([ ...ring(50, 65, color, [9,10,11,7,8,6,3,4,5,2,1]), ballAt(50, 50) ]),
  },
  {
    id: "corner-left",
    name: "Corner – left",
    make: (color = "#ef4444") => ([
      p(color, 8, 8, '11'),  p(color, 16, 10, '9'),  p(color, 20, 16, '10'),
      p(color, 24, 20, '8'),  p(color, 12, 16, '7'),  p(color, 28, 24, '6'),
      p(color, 34, 30, '5'),  p(color, 30, 20, '4'),  p(color, 26, 30, '3'),
      p(color, 40, 42, '2'),  p(color, 15, 55, '1'),
      ballAt(4, 4),
    ]),
  },
  {
    id: "free-kick-wall",
    name: "Free-kick + wall",
    make: (color = "#ef4444") => ([
      p(color, 65, 60, '10'), p(color, 60, 58, '8'),
      ...ring(68, 38, "#3b82f6", ["W","W","W","W","W"]).map((it,i)=>({ ...it, x: 76 + i*2, y: 40 })),
      p("#3b82f6", 96, 36, 'GK'),
      ballAt(64, 55),
      arrow(64, 55, 24, 0, "#fff"),
    ]),
  },
  {
    id: "goal-kick",
    name: "Goal-kick build",
    make: (color = "#ef4444") => ([
      p(color, 8, 36, '3'), p(color, 8, 64, '2'),
      p(color, 16, 22, '6'), p(color, 18, 50, '5'), p(color, 16, 78, '4'),
      p(color, 28, 30, '8'), p(color, 28, 50, '10'), p(color, 28, 70, '7'),
      p(color, 40, 40, '9'),  p(color, 40, 60, '11'), p(color, 6, 50, '1'),
      ballAt(6, 50), arrow(6, 50, 20, 0, "#fff"),
    ]),
  },
];

import React, { useMemo } from "react";
import { layoutById } from "../../utils/designer";

/** Football pitch renderer (full | half | blank) */
export default function PitchSVG({
  pitchId = "full",
  orientation = "landscape", // set to "portrait" for Half Pitch in Stage.jsx
  turf = "#0b7d3b",
  line = "#ffffff",
  lineWidth = 3,
  showGrid = false,
  gridSize = 10,
  gridThickness = 1,
  gridOpacity = 0.16,
}) {
  const { L, W } = useMemo(() => layoutById(pitchId) || { L: 105, W: 68 }, [pitchId]);

  const isBlank = /blank/i.test(pitchId);
  const isHalf  = /half/i.test(pitchId);
  const DL = isHalf ? L / 2 : L; // drawn length (x axis)
  const cx = DL / 2;
  const cy = W / 2;

  const S = (w = lineWidth) => ({
    stroke: line, fill: "none",
    vectorEffect: "non-scaling-stroke", strokeWidth: w,
    strokeLinecap: "round", strokeLinejoin: "round",
  });
  const fillSpot = { fill: line, stroke: "none" };

  // Laws of the Game metrics (scaled)
  const scaleW = (vOn68) => (W * (vOn68 / 68));
  const scaleL = (vOn105) => (L * (vOn105 / 105));

  const circleR = 9.15 * (W / 68);
  const cornerR = 1.0;
  const paW      = scaleW(40.32);
  const paDepth  = scaleL(16.5);
  const sixW     = scaleW(18.32);
  const sixDepth = scaleL(5.5);
  const spotDist = scaleL(11);

  const penaltyArcPath = (side) => {
    const cxSpot = side === "left" ? spotDist : DL - spotDist;
    const r = circleR;
    thetaclip: {
      const dx = Math.abs(paDepth - spotDist);
      var theta = Math.acos(Math.min(1, Math.max(0, dx / r)));
    }
    const a1 = side === "left" ? -theta : Math.PI - theta;
    const a2 = side === "left" ?  theta : Math.PI + theta;
    const p = (a) => [cxSpot + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x1, y1] = p(a1);
    const [x2, y2] = p(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  const cornerArcPath = (x, y, signX, signY, r) => {
    const x1 = x,           y1 = y + signY * r;
    const x2 = x + signX*r, y2 = y;
    const sweep = signX * signY > 0 ? 0 : 1;
    return `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`;
  };

  // stripes sized to DL so they rotate correctly with half pitch
  const stripes = (() => {
    const bands = 12, h = W / bands, arr = [];
    for (let i = 0; i < bands; i++) {
      arr.push(
        <rect
          key={i}
          x={0}
          y={i * h}
          width={DL}
          height={h}
          fill={i % 2 ? "transparent" : "rgba(255,255,255,0.035)"}
        />
      );
    }
    return arr;
  })();

  const gridLines = (() => {
    if (!showGrid) return null;
    const stepX = (gridSize / 100) * DL;
    const stepY = (gridSize / 100) * W;
    const lines = [];
    for (let x = stepX; x < DL; x += stepX) {
      lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={W} stroke="rgba(255,255,255,1)" strokeWidth={gridThickness} opacity={gridOpacity} vectorEffect="non-scaling-stroke" />);
    }
    for (let y = stepY; y < W; y += stepY) {
      lines.push(<line key={`gy${y}`} x1={0} y1={y} x2={DL} y2={y} stroke="rgba(255,255,255,1)" strokeWidth={gridThickness} opacity={gridOpacity} vectorEffect="non-scaling-stroke" />);
    }
    return lines;
  })();

  const rot = orientation === "portrait" ? `rotate(90 ${cx} ${cy})` : null;

  return (
    <svg
      viewBox={`0 0 ${DL} ${W}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Football pitch"
    >
      {/* Turf base */}
      <rect x={0} y={0} width={DL} height={W} fill={turf} />
      {/* Everything rotates together */}
      <g transform={rot || undefined}>
        {/* Stripes */}
        {stripes}

        {isBlank ? (
          <>{gridLines}</>
        ) : isHalf ? (
          <>
            <rect x={0} y={0} width={DL} height={W} {...S()} />
            {/* half-circle at halfway edge */}
            <path d={`M ${DL} ${cy - circleR} A ${circleR} ${circleR} 0 0 0 ${DL} ${cy + circleR}`} {...S()} />
            <circle cx={DL} cy={cy} r={0.3} style={fillSpot} />

            {/* Left PA + 6yd */}
            <rect x={0} y={(W - paW) / 2} width={paDepth} height={paW} {...S()} />
            <rect x={0} y={(W - sixW) / 2} width={sixDepth} height={sixW} {...S()} />
            <circle cx={spotDist} cy={cy} r={0.3} style={fillSpot} />
            <path d={penaltyArcPath("left")} {...S()} />

            {/* Goal-line corners */}
            <path d={cornerArcPath(0, 0, +1, +1, cornerR)} {...S(lineWidth)} />
            <path d={cornerArcPath(0, W, +1, -1, cornerR)} {...S(lineWidth)} />

            {gridLines}
          </>
        ) : (
          <>
            <rect x={0} y={0} width={DL} height={W} {...S()} />
            <line x1={DL/2} y1={0} x2={DL/2} y2={W} {...S()} />
            <circle cx={DL/2} cy={W/2} r={circleR} {...S()} />
            <circle cx={DL/2} cy={W/2} r={0.3} style={fillSpot} />

            {/* Left */}
            <rect x={0} y={(W - paW) / 2} width={paDepth} height={paW} {...S()} />
            <rect x={0} y={(W - sixW) / 2} width={sixDepth} height={sixW} {...S()} />
            <circle cx={spotDist} cy={W/2} r={0.3} style={fillSpot} />
            <path d={penaltyArcPath("left")} {...S()} />

            {/* Right */}
            <rect x={DL - paDepth} y={(W - paW) / 2} width={paDepth} height={paW} {...S()} />
            <rect x={DL - sixDepth} y={(W - sixW) / 2} width={sixDepth} height={sixW} {...S()} />
            <circle cx={DL - spotDist} cy={W/2} r={0.3} style={fillSpot} />
            <path d={penaltyArcPath("right")} {...S()} />

            {/* Corners */}
            <path d={cornerArcPath(0, 0, +1, +1, cornerR)} {...S(lineWidth)} />
            <path d={cornerArcPath(0, W, +1, -1, cornerR)} {...S(lineWidth)} />
            <path d={cornerArcPath(DL, 0, -1, +1, cornerR)} {...S(lineWidth)} />
            <path d={cornerArcPath(DL, W, -1, -1, cornerR)} {...S(lineWidth)} />

            {gridLines}
          </>
        )}
      </g>
    </svg>
  );
}

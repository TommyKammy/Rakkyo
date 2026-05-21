"use client";

import React, { useEffect, useState } from "react";

// ==========================================
// 1. NUMBER LINE DIAGRAM (数直線)
// ==========================================
interface NumberLineProps {
  expression: string; // 例: "-5 + 3" or "-4 - 7"
}

export function NumberLineDiagram({ expression }: NumberLineProps) {
  // Parse expression to find numbers and operators
  // We want to extract start value and final value.
  // Standard format: -5 + 3, or -4 - 3, etc.
  const [steps, setSteps] = useState<number[]>([0]);

  useEffect(() => {
    try {
      // Very simple parsing of something like "-5 + 3"
      // Clean up spaces
      const clean = expression.replace(/\s+/g, "");
      // Regex to match signed numbers
      const matches = clean.match(/([+-]?\d+)/g);
      if (matches && matches.length >= 2) {
        const first = parseInt(matches[0]);
        const second = parseInt(matches[1]);
        const finalVal = first + second;
        setSteps([0, first, finalVal]);
      } else if (matches && matches.length === 1) {
        const val = parseInt(matches[0]);
        setSteps([0, val]);
      } else {
        // Fallback for default demonstration
        setSteps([0, -5, -2]);
      }
    } catch (e) {
      setSteps([0, -5, -2]);
    }
  }, [expression]);

  const minVal = -10;
  const maxVal = 10;
  const range = maxVal - minVal;

  const getX = (val: number) => {
    // Map val between minVal and maxVal to percentage width (e.g. 5% to 95%)
    const clamped = Math.min(maxVal, Math.max(minVal, val));
    const ratio = (clamped - minVal) / range;
    return 40 + ratio * 320; // SVG width is 400, leave 40px padding on each side
  };

  const yLine = 75;

  return (
    <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border-2 border-slate-700/60 bubbly-shadow relative overflow-hidden">
      <style>{`
        @keyframes drawArrow {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulseDot {
          0%, 100% { r: 5; opacity: 0.8; }
          50% { r: 8; opacity: 1; }
        }
        .animate-arrow {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: drawArrow 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
      <div className="absolute top-2 left-3 text-3xs font-extrabold tracking-widest text-slate-400 uppercase">
        🔢 数直線ビジュアライザ
      </div>
      <div className="absolute top-2 right-3 text-2xs font-bold text-pastel-blue-dark bg-pastel-blue/20 px-2 py-0.5 rounded-md border border-pastel-blue-border/30">
        {expression}
      </div>

      <div className="w-full flex justify-center items-center mt-4">
        <svg viewBox="0 0 400 150" className="w-full max-w-[360px] h-auto drop-shadow-md">
          <defs>
            <linearGradient id="arrowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <linearGradient id="arrowGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#f43f5e" />
            </marker>
            <marker id="arrowhead-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#10b981" />
            </marker>
          </defs>

          {/* Background Grid Lines */}
          <line x1="20" y1={yLine} x2="380" y2={yLine} stroke="#475569" strokeWidth="3" strokeLinecap="round" />

          {/* Number Line Ticks and Labels */}
          {Array.from({ length: maxVal - minVal + 1 }).map((_, idx) => {
            const val = minVal + idx;
            const x = getX(val);
            const isZero = val === 0;
            const isFiveMultiplier = val % 5 === 0;

            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={yLine - (isZero ? 8 : isFiveMultiplier ? 6 : 4)}
                  x2={x}
                  y2={yLine + (isZero ? 8 : isFiveMultiplier ? 6 : 4)}
                  stroke={isZero ? "#38bdf8" : isFiveMultiplier ? "#94a3b8" : "#64748b"}
                  strokeWidth={isZero ? "2.5" : "1.5"}
                />
                {(isZero || isFiveMultiplier) && (
                  <text
                    x={x}
                    y={yLine + 22}
                    textAnchor="middle"
                    fill={isZero ? "#38bdf8" : "#94a3b8"}
                    className="text-[10px] font-extrabold font-mono"
                  >
                    {val}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render Arrow Vectors */}
          {steps.map((val, idx) => {
            if (idx === 0) return null;
            const prev = steps[idx - 1];
            const startX = getX(prev);
            const endX = getX(val);
            const distance = Math.abs(endX - startX);
            const isForward = endX > startX;

            // Height of control point for Bezier curve to make elegant arches
            const archHeight = 25 + idx * 12;
            const midX = (startX + endX) / 2;
            const controlY = yLine - archHeight;

            // Red for first step, Green for subsequent steps
            const color = idx === 1 ? "#f43f5e" : "#10b981";
            const marker = idx === 1 ? "url(#arrowhead-red)" : "url(#arrowhead-green)";

            return (
              <g key={idx}>
                {/* Dotted helper line from ticks */}
                <line
                  x1={startX}
                  y1={yLine}
                  x2={startX}
                  y2={yLine - 15}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <line
                  x1={endX}
                  y1={yLine}
                  x2={endX}
                  y2={yLine - 15}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />

                {/* Elegant arched arrow */}
                <path
                  d={`M ${startX} ${yLine - 4} Q ${midX} ${controlY} ${endX} ${yLine - 4}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  markerEnd={marker}
                  className="animate-arrow"
                  style={{ animationDelay: `${(idx - 1) * 1.5}s` }}
                />

                {/* Math text helper inside arch */}
                <text
                  x={midX}
                  y={controlY - 4}
                  textAnchor="middle"
                  fill={color}
                  className="text-[9px] font-extrabold font-mono"
                  style={{
                    animation: `fadeIn 0.5s ease-out ${(idx - 1) * 1.5 + 0.5}s both`,
                  }}
                >
                  {isForward ? `+${val - prev}` : `${val - prev}`}
                </text>
              </g>
            );
          })}

          {/* Anchor Points dots */}
          {steps.map((val, idx) => {
            const x = getX(val);
            const isFinal = idx === steps.length - 1;
            return (
              <circle
                key={idx}
                cx={x}
                cy={yLine}
                r="4.5"
                fill={idx === 0 ? "#38bdf8" : isFinal ? "#10b981" : "#f43f5e"}
                className={isFinal ? "animate-pulse" : ""}
                style={isFinal ? { animation: "pulseDot 1.5s infinite" } : {}}
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-2 text-3xs text-center text-slate-400 font-semibold leading-relaxed">
        {steps.length > 2 ? (
          <span>
            <strong className="text-pastel-pink-dark">0</strong> から左へ{" "}
            <strong className="text-pastel-pink-dark">{Math.abs(steps[1])}</strong> 進み（{steps[1]}）、そこから右へ{" "}
            <strong className="text-pastel-green-dark">{steps[2] - steps[1]}</strong> 進むと{" "}
            <strong className="text-pastel-blue-dark">{steps[2]}</strong> に着くね！
          </span>
        ) : (
          <span>数直線の目盛りをみて、矢印の方向を確かめてみよう！</span>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. ALGEBRA SCALE DIAGRAM (天秤)
// ==========================================
interface AlgebraScaleProps {
  leftExpr: string; // "2x + 3"
  rightExpr: string; // "11"
}

export function AlgebraScaleDiagram({ leftExpr, rightExpr }: AlgebraScaleProps) {
  // Parse leftExpr for number of x's and consts
  // e.g. "2x + 3" -> 2 x blocks, 3 spherical weights
  const [leftX, setLeftX] = useState(2);
  const [leftConst, setLeftConst] = useState(3);
  const [rightX, setRightX] = useState(0);
  const [rightConst, setRightConst] = useState(11);

  useEffect(() => {
    const parseSide = (expr: string) => {
      const clean = expr.replace(/\s+/g, "").toLowerCase();
      // Match something like "2x" or "x" or "-2x"
      const xMatch = clean.match(/(-?\d*)x/);
      let numX = 0;
      if (xMatch) {
        if (xMatch[1] === "" || xMatch[1] === "+") numX = 1;
        else if (xMatch[1] === "-") numX = -1;
        else numX = parseInt(xMatch[1]);
      }
      // Match trailing constant, e.g. "+3" or "11"
      const constExpr = clean.replace(/(-?\d*)x/, "");
      let numConst = 0;
      if (constExpr) {
        const val = parseInt(constExpr);
        if (!isNaN(val)) numConst = val;
      } else if (!xMatch) {
        // pure number
        const val = parseInt(clean);
        if (!isNaN(val)) numConst = val;
      }
      return { xCount: numX, constCount: numConst };
    };

    try {
      const left = parseSide(leftExpr);
      const right = parseSide(rightExpr);
      setLeftX(Math.max(0, left.xCount));
      setLeftConst(Math.max(0, left.constCount));
      setRightX(Math.max(0, right.xCount));
      setRightConst(Math.max(0, right.constCount));
    } catch (e) {
      // Default fallback
      setLeftX(2);
      setLeftConst(3);
      setRightX(0);
      setRightConst(11);
    }
  }, [leftExpr, rightExpr]);

  return (
    <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border-2 border-slate-700/60 bubbly-shadow relative overflow-hidden">
      <style>{`
        @keyframes balanceSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(0.8deg); }
        }
        .animate-swing {
          animation: balanceSwing 4s ease-in-out infinite;
          transform-origin: 200px 65px;
        }
      `}</style>
      <div className="absolute top-2 left-3 text-3xs font-extrabold tracking-widest text-slate-400 uppercase">
        ⚖️ 天秤ビジュアライザ (等式の性質)
      </div>
      <div className="absolute top-2 right-3 text-2xs font-bold text-pastel-purple-dark bg-pastel-purple/20 px-2 py-0.5 rounded-md border border-pastel-purple-border/30">
        {leftExpr} ＝ {rightExpr}
      </div>

      <div className="w-full flex justify-center items-center mt-6">
        <svg viewBox="0 0 400 200" className="w-full max-w-[360px] h-auto drop-shadow-md">
          {/* Base Stand */}
          <path d="M 180 190 L 220 190 L 210 120 L 190 120 Z" fill="#475569" stroke="#334155" strokeWidth="2" />
          <rect x="150" y="190" width="100" height="8" rx="4" fill="#334155" />
          {/* Center Pillar */}
          <line x1="200" y1="120" x2="200" y2="65" stroke="#64748b" strokeWidth="5" />
          <circle cx="200" cy="65" r="7" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5" />

          {/* SWINGING PART */}
          <g className="animate-swing">
            {/* Main beam */}
            <line x1="80" y1="65" x2="320" y2="65" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
            <circle cx="80" cy="65" r="4.5" fill="#d97706" />
            <circle cx="320" cy="65" r="4.5" fill="#d97706" />

            {/* Left Hanger cords */}
            <line x1="80" y1="65" x2="50" y2="120" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="80" y1="65" x2="110" y2="120" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Left Plate */}
            <path d="M 40 120 L 120 120 Q 80 135 40 120 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />

            {/* Right Hanger cords */}
            <line x1="320" y1="65" x2="290" y2="120" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="320" y1="65" x2="350" y2="120" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Right Plate */}
            <path d="M 280 120 L 360 120 Q 320 135 280 120 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />

            {/* Left Plate Items */}
            <g transform="translate(80, 118)">
              {/* Render X boxes (purple cuboid styles) */}
              {Array.from({ length: Math.min(3, leftX) }).map((_, idx) => {
                const xOff = (idx - (Math.min(3, leftX) - 1) / 2) * 22 - (leftConst > 0 ? 10 : 0);
                return (
                  <g key={idx} transform={`translate(${xOff}, -14)`}>
                    <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.5" />
                    <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" className="text-[10px] font-extrabold font-serif italic">x</text>
                  </g>
                );
              })}
              {/* Render constants (green spheres) */}
              {Array.from({ length: Math.min(6, leftConst) }).map((_, idx) => {
                const row = Math.floor(idx / 3);
                const col = idx % 3;
                const xOff = (col - 1) * 12 + (leftX > 0 ? 18 : 0);
                const yOff = -6 - row * 10;
                return (
                  <circle
                    key={idx}
                    cx={xOff}
                    cy={yOff}
                    r="4.5"
                    fill="#34d399"
                    stroke="#059669"
                    strokeWidth="1"
                  />
                );
              })}
              {leftConst > 6 && (
                <text x="32" y="-5" fill="#34d399" className="text-[8px] font-extrabold">+{leftConst - 6}</text>
              )}
            </g>

            {/* Right Plate Items */}
            <g transform="translate(320, 118)">
              {/* Render X boxes */}
              {Array.from({ length: Math.min(3, rightX) }).map((_, idx) => {
                const xOff = (idx - (Math.min(3, rightX) - 1) / 2) * 22 - (rightConst > 0 ? 10 : 0);
                return (
                  <g key={idx} transform={`translate(${xOff}, -14)`}>
                    <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.5" />
                    <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" className="text-[10px] font-extrabold font-serif italic">x</text>
                  </g>
                );
              })}
              {/* Render constants */}
              {Array.from({ length: Math.min(10, rightConst) }).map((_, idx) => {
                const row = Math.floor(idx / 4);
                const col = idx % 4;
                const xOff = (col - 1.5) * 10 + (rightX > 0 ? 18 : 0);
                const yOff = -5 - row * 9;
                return (
                  <circle
                    key={idx}
                    cx={xOff}
                    cy={yOff}
                    r="4"
                    fill="#34d399"
                    stroke="#059669"
                    strokeWidth="1"
                  />
                );
              })}
              {rightConst > 10 && (
                <text x="25" y="-5" fill="#34d399" className="text-[8px] font-extrabold">+{rightConst - 10}</text>
              )}
            </g>
          </g>
        </svg>
      </div>

      <div className="mt-3 text-3xs text-center text-slate-400 font-semibold leading-relaxed">
        天秤の両側はつり合っているね！
        <br />
        両方の皿から同じものを引いたり足したりしても、天秤のつり合い（イコール＝）は崩れないんだよ。
      </div>
    </div>
  );
}

// ==========================================
// 3. COORDINATE PLANE DIAGRAM (座標平面)
// ==========================================
interface CoordinatePlaneProps {
  equation: string; // 例: "y = 2x" or "y = -x" or "y = 6/x"
}

export function CoordinatePlaneDiagram({ equation }: CoordinatePlaneProps) {
  // Parse linear coefficients
  // Default values for y = ax
  const [a, setA] = useState(2);
  const [isInverse, setIsInverse] = useState(false);

  useEffect(() => {
    try {
      const clean = equation.replace(/\s+/g, "").toLowerCase();
      
      // Check for inverse proportionality, e.g. "6/x" or "y=6/x"
      if (clean.includes("/x")) {
        setIsInverse(true);
        const invMatch = clean.match(/y?=?(-?\d+)\/x/);
        if (invMatch) {
          setA(parseInt(invMatch[1]));
        } else {
          setA(6);
        }
      } else {
        setIsInverse(false);
        // Standard proportionality, e.g. "y = 2x" or "y = -3x"
        const propMatch = clean.match(/y?=?(-?\d*)x/);
        if (propMatch) {
          if (propMatch[1] === "" || propMatch[1] === "+") setA(1);
          else if (propMatch[1] === "-") setA(-1);
          else setA(parseInt(propMatch[1]));
        } else {
          setA(2);
        }
      }
    } catch (e) {
      setA(2);
      setIsInverse(false);
    }
  }, [equation]);

  // Map coordinates to SVG pixels
  // Center is at (100, 100). Grid ranges from -5 to 5.
  const size = 200;
  const half = size / 2;
  const scale = 16; // 16 pixels per 1 unit

  const getSvgCoords = (x: number, y: number) => {
    return {
      x: half + x * scale,
      y: half - y * scale, // SVG y-axis is inverted
    };
  };

  // Generate path coordinates
  const getPathD = () => {
    if (isInverse) {
      // Draw double curves for y = a/x
      // Curve 1: x > 0 (e.g. x from 0.5 to 5)
      const points1: string[] = [];
      for (let x = 0.5; x <= 5; x += 0.2) {
        const y = a / x;
        const coords = getSvgCoords(x, y);
        if (coords.y >= 10 && coords.y <= 190) {
          points1.push(`${coords.x},${coords.y}`);
        }
      }
      // Curve 2: x < 0 (e.g. x from -5 to -0.5)
      const points2: string[] = [];
      for (let x = -5; x <= -0.5; x += 0.2) {
        const y = a / x;
        const coords = getSvgCoords(x, y);
        if (coords.y >= 10 && coords.y <= 190) {
          points2.push(`${coords.x},${coords.y}`);
        }
      }
      
      const d1 = points1.length > 0 ? "M " + points1.join(" L ") : "";
      const d2 = points2.length > 0 ? "M " + points2.join(" L ") : "";
      return { d1, d2 };
    } else {
      // Draw single line from x = -5 to x = 5 for y = ax
      const pStart = getSvgCoords(-5, -5 * a);
      const pEnd = getSvgCoords(5, 5 * a);
      
      // Clamp values inside SVG window nicely
      const clampLine = (x1: number, y1: number, x2: number, y2: number) => {
        // Line equation: y = a * x
        // Find x where y = 5 or y = -5
        let startX = -5;
        let startY = -5 * a;
        let endX = 5;
        let endY = 5 * a;

        if (startY > 5) { startY = 5; startX = 5 / a; }
        if (startY < -5) { startY = -5; startX = -5 / a; }
        if (endY > 5) { endY = 5; endX = 5 / a; }
        if (endY < -5) { endY = -5; endX = -5 / a; }

        const p1 = getSvgCoords(startX, startY);
        const p2 = getSvgCoords(endX, endY);
        return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      };
      
      return { d1: clampLine(-5, -5 * a, 5, 5 * a), d2: "" };
    }
  };

  const { d1, d2 } = getPathD();

  // Pick some integer points to display as beautiful glowing nodes
  const displayPoints = isInverse
    ? [
        { x: 1, y: a },
        { x: 2, y: a / 2 },
        { x: -1, y: -a },
        { x: -2, y: -a / 2 },
      ].filter(p => Number.isInteger(p.y))
    : [
        { x: 0, y: 0 },
        { x: 1, y: a },
        { x: 2, y: 2 * a },
        { x: -1, y: -a },
        { x: -2, y: -2 * a },
      ].filter(p => Math.abs(p.y) <= 5);

  return (
    <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border-2 border-slate-700/60 bubbly-shadow relative overflow-hidden">
      <style>{`
        @keyframes drawGridLine {
          to { stroke-dashoffset: 0; }
        }
        .animate-draw-path {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: drawGridLine 2s ease-out forwards;
        }
        @keyframes popNode {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-pop-node {
          animation: popNode 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
      <div className="absolute top-2 left-3 text-3xs font-extrabold tracking-widest text-slate-400 uppercase">
        📈 座標平面グラフ
      </div>
      <div className="absolute top-2 right-3 text-2xs font-bold text-pastel-green-dark bg-pastel-green/20 px-2 py-0.5 rounded-md border border-pastel-green-border/30">
        {equation}
      </div>

      <div className="w-full flex justify-center items-center mt-6">
        <svg viewBox="0 0 200 200" className="w-full max-w-[200px] h-auto bg-slate-950/80 rounded-lg p-2 border border-slate-800">
          <defs>
            <marker id="axishead" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <polygon points="0 0, 4 2, 0 4" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Grid lines */}
          {Array.from({ length: 11 }).map((_, idx) => {
            const val = idx - 5;
            const xCoord = getSvgCoords(val, 0).x;
            const yCoord = getSvgCoords(0, val).y;
            return (
              <g key={idx}>
                {val !== 0 && (
                  <>
                    <line x1={xCoord} y1="0" x2={xCoord} y2="200" stroke="#1e293b" strokeWidth="0.8" />
                    <line x1="0" y1={yCoord} x2="200" y2={yCoord} stroke="#1e293b" strokeWidth="0.8" />
                  </>
                )}
              </g>
            );
          })}

          {/* Axes */}
          <line x1="10" y1="100" x2="192" y2="100" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#axishead)" />
          <line x1="100" y1="190" x2="100" y2="12" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#axishead)" />

          {/* Labels */}
          <text x="190" y="112" fill="#94a3b8" className="text-[8px] font-extrabold font-mono">x</text>
          <text x="108" y="14" fill="#94a3b8" className="text-[8px] font-extrabold font-mono">y</text>
          <text x="92" y="110" fill="#94a3b8" className="text-[7px] font-extrabold font-mono">O</text>

          {/* Plotting functions path */}
          {isInverse ? (
            <>
              {d1 && (
                <path
                  d={d1}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="animate-draw-path"
                />
              )}
              {d2 && (
                <path
                  d={d2}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="animate-draw-path"
                />
              )}
            </>
          ) : (
            d1 && (
              <path
                d={d1}
                fill="none"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-draw-path"
              />
            )
          )}

          {/* Render point markers */}
          {displayPoints.map((pt, idx) => {
            const coords = getSvgCoords(pt.x, pt.y);
            return (
              <g key={idx} className="animate-pop-node" style={{ animationDelay: `${idx * 0.15 + 1}s` }}>
                <circle cx={coords.x} cy={coords.y} r="3.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.8" />
                {pt.x !== 0 && (
                  <text
                    x={coords.x + 5}
                    y={coords.y - 3}
                    fill="#94a3b8"
                    className="text-[6px] font-extrabold font-mono bg-slate-950 px-0.5 rounded"
                  >
                    ({pt.x},{pt.y})
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 text-3xs text-center text-slate-400 font-semibold leading-relaxed">
        {isInverse ? (
          <span>
            反比例のグラフ（双曲線）を描いたよ！
            <br />
            比例定数 <strong className="text-pastel-blue-dark">a＝{a}</strong> のとき、点を通っているね！
          </span>
        ) : (
          <span>
            比例のグラフ（直線）を描いたよ！
            <br />
            xが1増えると、yは <strong className="text-pastel-green-dark">{a}</strong> 増えるね（傾き＝{a}）。
          </span>
        )}
      </div>
    </div>
  );
}

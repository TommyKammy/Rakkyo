"use client";

import React from "react";
import { NumberLineDiagram, AlgebraScaleDiagram, CoordinatePlaneDiagram } from "../../../../components/diagrams";

interface MathDiagramProps {
  prompt: string;
  explanation?: string;
}

export function MathDiagram({ prompt, explanation = "" }: MathDiagramProps) {
  const text = (prompt + " " + explanation).toLowerCase();
  
  // 1. Coordinate plane (y=ax, 比例, 反比例, 座標)
  if (text.includes("比例") || text.includes("座標") || text.includes("グラフ") || text.includes("y=") || text.includes("y =") || text.includes("比例定数")) {
    const eqMatch = text.match(/y\s*=\s*[-]?\d*x/i) || text.match(/y\s*=\s*[-]?\d+\/x/i);
    const equation = eqMatch ? eqMatch[0] : "y = 2x";
    return <CoordinatePlaneDiagram equation={equation} />;
  }
  
  // 2. Algebra Scale (方程式, 等式)
  if (text.includes("=") && text.includes("x")) {
    const parts = text.split("=");
    if (parts.length === 2) {
      const lhs = parts[0].replace(/.*?[は\：]/, "").trim();
      const rhs = parts[1].replace(/[。を解きなさい].*/, "").trim();
      return <AlgebraScaleDiagram leftExpr={lhs || "2x+3"} rightExpr={rhs || "11"} />;
    }
    return <AlgebraScaleDiagram leftExpr="2x + 3" rightExpr="11" />;
  }
  
  // 3. Number Line (正負の数, 計算)
  if (text.includes("計算") || text.includes("＋") || text.includes("ー") || text.includes("+") || text.includes("-") || text.includes("負")) {
    const cleanExpr = prompt.replace(/.*?[は\：]/, "").replace(/[。を計算しなさい].*/, "").trim();
    return <NumberLineDiagram expression={cleanExpr || "-5 + 3"} />;
  }
  
  return null;
}

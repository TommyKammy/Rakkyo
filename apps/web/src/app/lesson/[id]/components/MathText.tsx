"use client";

import React from "react";

interface MathTextProps {
  text: string;
}

export function MathText({ text }: MathTextProps) {
  if (!text) return null;
  
  const segments = text.split("$");
  
  return (
    <span className="leading-relaxed">
      {segments.map((segment, idx) => {
        // Odd segments are inside $...$ (math equations)
        if (idx % 2 === 1) {
          // Replace LaTeX operators with nice child-friendly Unicode equivalents
          let formatted = segment
            .replace(/\\times/g, " × ")
            .replace(/\\div/g, " ÷ ")
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2") // Simple fractions
            .replace(/\^3/g, "³")
            .replace(/\^2/g, "²")
            .replace(/\\text\{([^{}]+)\}/g, "$1"); // Clear text wrappers
            
          return (
            <span
              key={idx}
              className="font-serif italic font-bold text-pastel-purple-dark bg-pastel-purple px-2 py-0.5 rounded-lg mx-0.5 inline-block border border-pastel-purple-border"
            >
              {formatted}
            </span>
          );
        }
        return <span key={idx}>{segment}</span>;
      })}
    </span>
  );
}

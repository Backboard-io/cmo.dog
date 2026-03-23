"use client";

import { useState, useEffect, useRef } from "react";

type PawPrint = { x: number; y: number; rotate: number; delay: number };
type PawTrail = { id: number; prints: PawPrint[] };

export function PawPrints() {
  const [trails, setTrails] = useState<PawTrail[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    function spawn() {
      const angle = Math.random() * 2 * Math.PI;
      const startX = 5 + Math.random() * 75;
      const startY = 5 + Math.random() * 80;
      const stepCount = 5 + Math.floor(Math.random() * 4);
      const stepLen = 44;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const perpX = -sin;
      const perpY = cos;
      const sway = 11;

      const prints: PawPrint[] = Array.from({ length: stepCount }, (_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        return {
          x: startX + ((cos * i * stepLen + perpX * side * sway) / window.innerWidth) * 100,
          y: startY + ((sin * i * stepLen + perpY * side * sway) / window.innerHeight) * 100,
          rotate: (angle * 180) / Math.PI + 90 + (Math.random() - 0.5) * 20,
          delay: i * 0.22,
        };
      });

      const trail: PawTrail = { id: idRef.current++, prints };
      setTrails((t: PawTrail[]) => [...t, trail]);

      setTimeout(() => {
        setTrails((t: PawTrail[]) => t.filter((tr: PawTrail) => tr.id !== trail.id));
      }, (stepCount * 0.22 + 4) * 1000);
    }

    spawn();
    const intervalId = setInterval(spawn, 2800);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
      {trails.flatMap((trail: PawTrail) =>
        trail.prints.map((p: PawPrint, i: number) => (
          <div
            key={`${trail.id}-${i}`}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 100 100"
              className="text-bb-phantom/25 dark:text-bb-phantomLight/20"
              style={{
                display: "block",
                opacity: 0,
                animation: `pawFade 3.5s ${p.delay}s both`,
              }}
              aria-hidden
            >
              <ellipse cx="50" cy="72" rx="24" ry="20" fill="currentColor" />
              <ellipse cx="24" cy="50" rx="11" ry="13" fill="currentColor" />
              <ellipse cx="42" cy="40" rx="11" ry="13" fill="currentColor" />
              <ellipse cx="60" cy="40" rx="11" ry="13" fill="currentColor" />
              <ellipse cx="77" cy="50" rx="11" ry="13" fill="currentColor" />
            </svg>
          </div>
        ))
      )}
      <style jsx>{`
        @keyframes pawFade {
          0%   { opacity: 0; transform: scale(0.3); }
          10%  { opacity: 0.45; transform: scale(1.08); }
          25%  { opacity: 0.32; transform: scale(1); }
          75%  { opacity: 0.22; }
          100% { opacity: 0; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}

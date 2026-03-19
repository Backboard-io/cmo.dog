"use client";

import { useEffect, useRef, useState } from "react";

type TerminalProps = {
  runId: string | null;
  initialLines?: string[];
  className?: string;
};

export function Terminal({ runId, initialLines = [], className = "" }: TerminalProps) {
  const [lines, setLines] = useState<string[]>(initialLines);
  const [typingLine, setTypingLine] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const typingIdx = useRef(0);

  useEffect(() => {
    if (!runId) return;
    setLines([]);
    setTypingLine("");
    const url = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/runs/${runId}/stream`
      : `http://localhost:8000/api/runs/${runId}/stream`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { line?: string };
        const line = data.line ?? "";
        if (line) {
          setLines((prev) => [...prev, line]);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [runId]);

  useEffect(() => {
    if (lines.length === 0) return;
    const last = lines[lines.length - 1];
    if (typingLine === last) return;
    setTypingLine("");
    typingIdx.current = 0;
    const chars = last.split("");
    if (chars.length === 0) return;
    const id = setInterval(() => {
      typingIdx.current += 1;
      setTypingLine(chars.slice(0, typingIdx.current).join(""));
      if (typingIdx.current >= chars.length) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [lines]);

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [lines, typingLine]);

  const displayLines = lines.length > 0 ? lines.slice(0, -1) : [];
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";
  const isTypingDone = typingLine === lastLine;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded-lg bg-[#0A0F1E] p-4 font-mono text-[0.7rem] text-terminal-green selection:bg-terminal-green/20 ${className}`}
      style={{ minHeight: "112px", maxHeight: "176px" }}
    >
      {displayLines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-words">
          {line}
        </div>
      ))}
      {lines.length > 0 && (
        <div className="whitespace-pre-wrap break-words">
          {isTypingDone ? lastLine : typingLine}
          <span className="animate-pulse bg-terminal-green inline-block w-2 h-4 ml-0.5 align-middle" />
        </div>
      )}
    </div>
  );
}

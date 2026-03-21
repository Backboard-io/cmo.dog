"use client";

import { useEffect, useRef, useState } from "react";

type TerminalProps = {
  runId: string | null;
  initialLines?: string[];
  className?: string;
  isComplete?: boolean;
};

type AgentEntry = { key: string; line: string };

function parseAgentKey(line: string): string | null {
  const text = line.startsWith("> ") ? line.slice(2) : line;
  const m = text.match(/^([A-Za-z][A-Za-z\s]{0,20}):/);
  return m ? m[1].trim() : null;
}

const TerminalPaw = () => (
  <svg className="inline-block w-3 h-3 mr-1 align-middle" viewBox="0 0 100 100" fill="currentColor" aria-hidden>
    <ellipse cx="50" cy="72" rx="23" ry="19" />
    <ellipse cx="21" cy="46" rx="10" ry="13" transform="rotate(-18, 21, 46)" />
    <ellipse cx="38" cy="32" rx="10" ry="13" transform="rotate(-6, 38, 32)" />
    <ellipse cx="62" cy="32" rx="10" ry="13" transform="rotate(6, 62, 32)" />
    <ellipse cx="79" cy="46" rx="10" ry="13" transform="rotate(18, 79, 46)" />
  </svg>
);

// Renders a single terminal line with styled label and ✓ prefix
function LineContent({ line, isActive }: { line: string; isActive?: boolean }) {
  const isDone = line.includes("✓");
  const text = line.startsWith("> ") ? line.slice(2) : line;
  const labelMatch = text.match(/^([A-Za-z][A-Za-z\s]{0,20}):\s(.+)$/);

  if (labelMatch) {
    const [, label, rest] = labelMatch;
    const isOnni = label.trim() === "Onni";
    const labelColor = isDone ? "text-emerald-400" : isActive ? "text-amber-400" : isOnni ? "text-emerald-300" : "text-sky-400";
    return (
      <span>
        {isOnni ? (
          <span className="text-emerald-300"><TerminalPaw /></span>
        ) : (
          <span className="text-gray-500">&gt; </span>
        )}
        <span className={`font-semibold ${labelColor}`}>{label}:</span>
        <span className={isDone ? " text-emerald-400" : ""}> {rest}</span>
      </span>
    );
  }

  return <span className="opacity-70">{text}</span>;
}

export function Terminal({ runId, initialLines = [], className = "", isComplete = false }: TerminalProps) {
  const [entries, setEntries] = useState<AgentEntry[]>(() =>
    initialLines.map((line, i) => ({ key: parseAgentKey(line) ?? `sys-${i}`, line }))
  );
  // key of the newest (first-time) agent row being typed in; updates don't change this
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);
  const [typingText, setTypingText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const typingIdx = useRef(0);
  const animatingLineRef = useRef("");
  // tracks which agent keys have already appeared so we never re-animate them
  const seenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!runId) return;
    setEntries([]);
    setAnimatingKey(null);
    setTypingText("");
    seenKeysRef.current = new Set();

    const url = `/stream/${runId}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { line?: string };
        const line = data.line ?? "";
        if (!line) return;

        const agent = parseAgentKey(line);
        const key = agent ?? `sys-${Date.now()}`;
        const isNew = !seenKeysRef.current.has(key);

        if (isNew) {
          seenKeysRef.current.add(key);
          animatingLineRef.current = line;
          setAnimatingKey(key);
        }

        setEntries((prev) => {
          if (agent) {
            const idx = prev.findIndex((e) => e.key === agent);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { key: agent, line };
              return next;
            }
          }
          return [...prev, { key, line }];
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => es.close();
    return () => es.close();
  }, [runId]);

  // Typing animation — only fires when a brand-new agent row appears
  useEffect(() => {
    if (!animatingKey) return;
    const target = animatingLineRef.current;
    if (!target) return;
    setTypingText("");
    typingIdx.current = 0;
    const chars = target.split("");
    const id = setInterval(() => {
      typingIdx.current += 1;
      setTypingText(chars.slice(0, typingIdx.current).join(""));
      if (typingIdx.current >= chars.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [animatingKey]);

  const prevCompleteRef = useRef(false);
  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      prevCompleteRef.current = true;
      const doneKey = "onni-all-done";
      setEntries((prev) => {
        if (prev.some((e) => e.key === doneKey)) return prev;
        return [...prev, { key: doneKey, line: "> Onni: All done!" }];
      });
      animatingLineRef.current = "> Onni: All done!";
      setAnimatingKey(doneKey);
    }
  }, [isComplete]);

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [entries, typingText]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded-lg bg-[#0A0F1E] p-4 font-mono text-[0.7rem] text-terminal-green selection:bg-terminal-green/20 ${className}`}
      style={{ height: "160px" }}
    >
      {entries.map((entry) => {
        const isAnimating = entry.key === animatingKey;
        const displayLine = isAnimating ? typingText : entry.line;
        return (
          <div key={entry.key} className="whitespace-pre-wrap break-words">
            <LineContent line={displayLine || entry.line} isActive={isAnimating} />
            {isAnimating && (
              <span className="animate-pulse bg-terminal-green inline-block w-2 h-4 ml-0.5 align-middle" />
            )}
          </div>
        );
      })}
    </div>
  );
}

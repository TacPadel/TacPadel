import React, { useRef, useState, useCallback, useEffect } from "react";

interface DraggableItem {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  isPlayer: boolean;
}

const INITIAL_ITEMS = (w: number, h: number): DraggableItem[] => [
  { id: "a1", x: 100 / 760 * w, y: 120 / 380 * h, color: "#e74c3c", label: "A1", isPlayer: true },
  { id: "a2", x: 100 / 760 * w, y: 260 / 380 * h, color: "#e74c3c", label: "A2", isPlayer: true },
  { id: "b1", x: (760 - 140) / 760 * w, y: 120 / 380 * h, color: "#f1c40f", label: "B1", isPlayer: true },
  { id: "b2", x: (760 - 140) / 760 * w, y: 260 / 380 * h, color: "#f1c40f", label: "B2", isPlayer: true },
  { id: "ball", x: w / 2 - 20, y: h / 2, color: "#2ecc71", label: "●", isPlayer: false },
];

export default function TacticsBoard() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 760, h: 380 });
  const [items, setItems] = useState<DraggableItem[]>(() => INITIAL_ITEMS(760, 380));
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = entry.contentRect.width;
      const h = Math.round(w * (380 / 760));
      setSize({ w, h });
      setItems(INITIAL_ITEMS(w, h));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const client =
      "touches" in e
        ? e.touches[0] ?? e.changedTouches[0]
        : e;
    return {
      x: ((client as React.MouseEvent).clientX - rect.left) * (size.w / rect.width),
      y: ((client as React.MouseEvent).clientY - rect.top) * (size.h / rect.height),
    };
  }, [size]);

  const onPointerDown = useCallback(
    (id: string, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pt = getPoint(e);
      const item = items.find((i) => i.id === id);
      if (!item) return;
      dragRef.current = { id, ox: pt.x - item.x, oy: pt.y - item.y };
    },
    [items, getPoint]
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const pt = getPoint(e);
      const { id, ox, oy } = dragRef.current;
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                x: Math.max(14, Math.min(size.w - 14, pt.x - ox)),
                y: Math.max(14, Math.min(size.h - 14, pt.y - oy)),
              }
            : item
        )
      );
    },
    [getPoint, size]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const reset = () => setItems(INITIAL_ITEMS(size.w, size.h));

  const w = size.w;
  const h = size.h;
  const netX = w / 2;
  const offsetX = 10 + (w - 20) * 0.15;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div ref={containerRef} className="w-full max-w-3xl">
        <svg
          ref={svgRef}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="rounded-xl shadow-2xl border-2 border-border w-full touch-none select-none"
          style={{ background: "#2980b9", display: "block" }}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          {/* Court boundary */}
          <rect x={10} y={10} width={w - 20} height={h - 20} fill="none" stroke="white" strokeWidth={3} />

          {/* Back walls (glass) */}
          <line x1={10} y1={10} x2={10} y2={h - 10} stroke="#7f8c8d" strokeWidth={6} />
          <line x1={w - 10} y1={10} x2={w - 10} y2={h - 10} stroke="#7f8c8d" strokeWidth={6} />

          {/* Service lines */}
          <line x1={offsetX} y1={10} x2={offsetX} y2={h - 10} stroke="white" strokeWidth={2} />
          <line x1={w - offsetX} y1={10} x2={w - offsetX} y2={h - 10} stroke="white" strokeWidth={2} />

          {/* Center line between service boxes */}
          <line x1={offsetX} y1={h / 2} x2={w - offsetX} y2={h / 2} stroke="white" strokeWidth={2} />

          {/* Net */}
          <line x1={netX} y1={10} x2={netX} y2={h - 10} stroke="#1a252f" strokeWidth={4} strokeDasharray="6 3" />
          <ellipse cx={netX} cy={10} rx={5} ry={5} fill="black" />
          <ellipse cx={netX} cy={h - 10} rx={5} ry={5} fill="black" />

          {/* NET label */}
          <text x={netX} y={h / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity={0.25} fontSize={Math.max(10, w * 0.022)} fontWeight="bold" letterSpacing="4">
            NET
          </text>

          {/* Team labels */}
          <text x={offsetX / 2 + 5} y={h - 18} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={Math.max(8, w * 0.015)} fontWeight="bold">TEAM A</text>
          <text x={w - offsetX / 2 - 5} y={h - 18} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={Math.max(8, w * 0.015)} fontWeight="bold">TEAM B</text>

          {/* Draggable items — rendered last so they're on top */}
          {items.map((item) => {
            const r = item.isPlayer ? Math.max(14, w * 0.022) : Math.max(9, w * 0.014);
            const fontSize = item.isPlayer ? Math.max(8, w * 0.016) : Math.max(10, w * 0.02);
            return (
              <g
                key={item.id}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => onPointerDown(item.id, e)}
                onTouchStart={(e) => onPointerDown(item.id, e)}
              >
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={r}
                  fill={item.color}
                  stroke="white"
                  strokeWidth={2}
                  filter="url(#shadow)"
                />
                <text
                  x={item.x}
                  y={item.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={item.color === "#f1c40f" ? "black" : "white"}
                  fontSize={fontSize}
                  fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {item.label}
                </text>
              </g>
            );
          })}

          <defs>
            <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.4)" />
            </filter>
          </defs>
        </svg>
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-card-border px-3 py-1.5 rounded-lg">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span>Team A</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-card-border px-3 py-1.5 rounded-lg">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
          <span>Team B</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-card-border px-3 py-1.5 rounded-lg">
          <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
          <span>Ball</span>
        </div>
        <button
          onClick={reset}
          className="px-4 py-1.5 bg-destructive text-destructive-foreground text-sm font-semibold rounded-lg hover:bg-destructive/80 active:scale-95 transition-all"
        >
          Positionen zurücksetzen
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Spieler und Ball per Drag &amp; Drop auf dem Spielfeld positionieren
      </p>
    </div>
  );
}

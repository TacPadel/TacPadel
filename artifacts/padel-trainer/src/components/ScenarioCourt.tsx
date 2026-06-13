import React from "react";

export interface PlayerPositions {
  you: string;
  partner: string;
  opp1: string;
  opp2: string;
  ball: { side: "left" | "right"; zone: string };
}

interface Props {
  positions: PlayerPositions;
  selectedZone: string | null;
  hasSubmitted: boolean;
  bestZones: string[];
  onZoneClick: (id: string) => void;
  profiMode?: boolean;
  selectedLaufZone?: string | null;
  correctLaufZone?: string | null;
  onLaufZoneClick?: (id: string) => void;
}

const LETTERS = ["A", "B", "C", "D"];
const NUMBERS = [1, 2, 3, 4];

function zoneCenter(side: "left" | "right", zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const y = 10 + innerH * (letterIdx + 0.5) / 4;

  if (side === "left") {
    const leftWidth = netX - 10;
    const x = 10 + leftWidth * (num - 0.5) / 4;
    return { x, y };
  } else {
    const rightWidth = w - 10 - netX;
    const x = netX + rightWidth * (4.5 - num) / 4;
    return { x, y };
  }
}

function zoneBoundsLeft(zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const leftWidth = netX - 10;

  const y1 = 10 + innerH * letterIdx / 4;
  const y2 = 10 + innerH * (letterIdx + 1) / 4;
  const x1 = 10 + leftWidth * (num - 1) / 4;
  const x2 = 10 + leftWidth * num / 4;

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function zoneBounds(zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const rightWidth = w - 10 - netX;

  const y1 = 10 + innerH * letterIdx / 4;
  const y2 = 10 + innerH * (letterIdx + 1) / 4;
  const x1 = netX + rightWidth * (4 - num) / 4;
  const x2 = netX + rightWidth * (4 - num + 1) / 4;

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

export default function ScenarioCourt({
  positions,
  selectedZone,
  hasSubmitted,
  bestZones,
  onZoneClick,
  profiMode = false,
  selectedLaufZone = null,
  correctLaufZone = null,
  onLaufZoneClick,
}: Props) {
  const W = 760;
  const H = 380;
  const netX = W / 2;
  const offsetX = 10 + (W - 20) * 0.15;
  const playerR = 17;
  const ballR = 9;
  const fontSize = 10;

  const allZoneIds = LETTERS.flatMap((l) => NUMBERS.map((n) => `${l}${n}`));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-xl shadow-2xl border-2 border-border"
      style={{ background: "#2980b9", display: "block" }}
    >
      {/* Court boundary */}
      <rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke="white" strokeWidth={3} />

      {/* Back walls */}
      <line x1={10} y1={10} x2={10} y2={H - 10} stroke="#7f8c8d" strokeWidth={6} />
      <line x1={W - 10} y1={10} x2={W - 10} y2={H - 10} stroke="#7f8c8d" strokeWidth={6} />

      {/* Service lines */}
      <line x1={offsetX} y1={10} x2={offsetX} y2={H - 10} stroke="white" strokeWidth={2} />
      <line x1={W - offsetX} y1={10} x2={W - offsetX} y2={H - 10} stroke="white" strokeWidth={2} />

      {/* Center line */}
      <line x1={offsetX} y1={H / 2} x2={W - offsetX} y2={H / 2} stroke="white" strokeWidth={2} />

      {/* Net */}
      <line x1={netX} y1={10} x2={netX} y2={H - 10} stroke="#1a252f" strokeWidth={4} strokeDasharray="6 3" />
      <ellipse cx={netX} cy={10} rx={5} ry={5} fill="black" />
      <ellipse cx={netX} cy={H - 10} rx={5} ry={5} fill="black" />

      {/* Left half — faint grid OR profi clickable zones */}
      {LETTERS.map((l, li) =>
        NUMBERS.map((n) => {
          const zoneId = `${l}${n}`;
          const b = zoneBoundsLeft(zoneId, W, H);
          const isSelected = profiMode && selectedLaufZone === zoneId;
          const isCorrect = profiMode && hasSubmitted && correctLaufZone === zoneId;
          const isWrong = profiMode && hasSubmitted && isSelected && correctLaufZone !== zoneId;

          let fill = "rgba(255,255,255,0.04)";
          let stroke = "rgba(255,255,255,0.08)";
          let sw = 1;

          if (profiMode) {
            if (!hasSubmitted) {
              if (isSelected) {
                fill = "rgba(139,92,246,0.35)";
                stroke = "#a78bfa";
                sw = 2;
              } else {
                fill = "rgba(255,255,255,0.07)";
                stroke = "rgba(255,255,255,0.18)";
              }
            } else {
              if (isCorrect) {
                fill = "rgba(52,211,153,0.4)";
                stroke = "#34d399";
                sw = 2;
              } else if (isWrong) {
                fill = "rgba(239,68,68,0.4)";
                stroke = "#ef4444";
                sw = 2;
              } else {
                fill = "rgba(255,255,255,0.03)";
                stroke = "rgba(255,255,255,0.08)";
              }
            }
          }

          return (
            <g
              key={`left-${zoneId}`}
              onClick={() => profiMode && !hasSubmitted && onLaufZoneClick && onLaufZoneClick(zoneId)}
              style={{ cursor: profiMode && !hasSubmitted ? "pointer" : "default" }}
            >
              <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={fill} stroke={stroke} strokeWidth={sw} rx={profiMode ? 3 : 0} />
              {profiMode && (
                <text
                  x={b.cx} y={b.cy}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isCorrect ? "#34d399" : isWrong ? "#ef4444" : isSelected ? "#a78bfa" : "rgba(255,255,255,0.35)"}
                  fontSize={9} fontWeight="bold" fontFamily="monospace"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {zoneId}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Right half — clickable target zones */}
      {allZoneIds.map((zoneId) => {
        const b = zoneBounds(zoneId, W, H);
        const isSelected = selectedZone === zoneId;
        const isBest = hasSubmitted && bestZones.includes(zoneId);
        const isWrong = hasSubmitted && isSelected && !isBest;

        let fill = "rgba(255,255,255,0.04)";
        let stroke = "rgba(255,255,255,0.15)";
        let strokeWidth = 1;

        if (!hasSubmitted) {
          if (isSelected) {
            fill = "rgba(52,211,153,0.35)";
            stroke = "#34d399";
            strokeWidth = 2;
          }
        } else {
          if (isBest) {
            fill = "rgba(52,211,153,0.4)";
            stroke = "#34d399";
            strokeWidth = 2;
          } else if (isWrong) {
            fill = "rgba(239,68,68,0.4)";
            stroke = "#ef4444";
            strokeWidth = 2;
          } else {
            fill = "rgba(255,255,255,0.02)";
            stroke = "rgba(255,255,255,0.08)";
          }
        }

        return (
          <g key={zoneId} onClick={() => !hasSubmitted && onZoneClick(zoneId)} style={{ cursor: hasSubmitted ? "default" : "pointer" }}>
            <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={3} />
            <text
              x={b.cx} y={b.cy}
              textAnchor="middle" dominantBaseline="central"
              fill={isBest ? "#34d399" : isWrong ? "#ef4444" : "rgba(255,255,255,0.45)"}
              fontSize={9} fontWeight="bold" fontFamily="monospace"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {zoneId}
            </text>
          </g>
        );
      })}

      {/* Profi hints when nothing selected yet */}
      {profiMode && !selectedLaufZone && !hasSubmitted && (
        <text x={netX / 2} y={H / 2} textAnchor="middle" dominantBaseline="central"
          fill="rgba(167,139,250,0.5)" fontSize={11} fontWeight="bold" letterSpacing="1"
          style={{ pointerEvents: "none", userSelect: "none" }}>
          LAUFZIEL WÄHLEN
        </text>
      )}
      {!selectedZone && !hasSubmitted && (
        <text x={netX + (W - 10 - netX) / 2} y={H / 2} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.18)" fontSize={13} fontWeight="bold" letterSpacing="2"
          style={{ pointerEvents: "none", userSelect: "none" }}>
          ZIELZONE WÄHLEN
        </text>
      )}

      {/* Side labels */}
      <text x={netX / 2} y={H - 16} textAnchor="middle"
        fill="rgba(255,255,255,0.3)" fontSize={9} fontWeight="bold" letterSpacing="2"
        style={{ pointerEvents: "none", userSelect: "none" }}>
        {profiMode ? "LAUFZIEL (DEINE SEITE)" : "DEINE SEITE"}
      </text>
      <text x={netX + (W - 10 - netX) / 2} y={H - 16} textAnchor="middle"
        fill="rgba(255,255,255,0.3)" fontSize={9} fontWeight="bold" letterSpacing="2"
        style={{ pointerEvents: "none", userSelect: "none" }}>
        GEGNER
      </text>

      {/* Drop shadow filter */}
      <defs>
        <filter id="sc-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
        </filter>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="rgba(52,211,153,0.85)" />
        </marker>
        <marker id="arrowhead-lauf" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="rgba(167,139,250,0.85)" />
        </marker>
      </defs>

      {/* Ball */}
      {(() => {
        const bPos = zoneCenter(positions.ball.side, positions.ball.zone, W, H);
        const offset = positions.ball.side === "left" ? 16 : -16;
        return (
          <g filter="url(#sc-shadow)">
            <circle cx={bPos.x + offset} cy={bPos.y - 12} r={ballR} fill="#2ecc71" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} />
            <text x={bPos.x + offset} y={bPos.y - 12} textAnchor="middle" dominantBaseline="central"
              fill="rgba(0,0,0,0.6)" fontSize={8} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
              ●
            </text>
          </g>
        );
      })()}

      {/* Opponent 1 */}
      {(() => {
        const pos = zoneCenter("right", positions.opp1, W, H);
        return (
          <g filter="url(#sc-shadow)">
            <circle cx={pos.x} cy={pos.y} r={playerR} fill="#f1c40f" stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              fill="black" fontSize={fontSize} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
              GEG1
            </text>
          </g>
        );
      })()}

      {/* Opponent 2 */}
      {(() => {
        const pos = zoneCenter("right", positions.opp2, W, H);
        return (
          <g filter="url(#sc-shadow)">
            <circle cx={pos.x} cy={pos.y} r={playerR} fill="#f39c12" stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              fill="black" fontSize={fontSize} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
              GEG2
            </text>
          </g>
        );
      })()}

      {/* Your partner */}
      {(() => {
        const pos = zoneCenter("left", positions.partner, W, H);
        return (
          <g filter="url(#sc-shadow)">
            <circle cx={pos.x} cy={pos.y} r={playerR} fill="#c0392b" stroke="white" strokeWidth={2} />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={fontSize} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
              PTNER
            </text>
          </g>
        );
      })()}

      {/* You */}
      {(() => {
        const pos = zoneCenter("left", positions.you, W, H);
        return (
          <g filter="url(#sc-shadow)">
            <circle cx={pos.x} cy={pos.y} r={playerR} fill="#e74c3c" stroke="white" strokeWidth={2.5} />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={fontSize} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
              DU
            </text>
          </g>
        );
      })()}

      {/* Arrow: DU → selected lauf zone (profi mode) */}
      {profiMode && selectedLaufZone && !hasSubmitted && (() => {
        const from = zoneCenter("left", positions.you, W, H);
        const to = zoneBoundsLeft(selectedLaufZone, W, H);
        const dx = to.cx - from.x;
        const dy = to.cy - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        const ux = dx / len;
        const uy = dy / len;
        return (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={from.x + ux * (playerR + 2)} y1={from.y + uy * (playerR + 2)}
              x2={to.cx - ux * 10} y2={to.cy - uy * 10}
              stroke="rgba(167,139,250,0.7)" strokeWidth={2.5} strokeDasharray="6 3"
              markerEnd="url(#arrowhead-lauf)"
            />
          </g>
        );
      })()}

      {/* Arrow: ball → selected target zone */}
      {selectedZone && !hasSubmitted && (() => {
        const ballPos = zoneCenter(positions.ball.side, positions.ball.zone, W, H);
        const bOffset = positions.ball.side === "left" ? 16 : -16;
        const bx = ballPos.x + bOffset;
        const by = ballPos.y - 12;
        const target = zoneBounds(selectedZone, W, H);
        const tx = target.cx;
        const ty = target.cy;
        const dx = tx - bx;
        const dy = ty - by;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        return (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={bx + ux * (ballR + 2)} y1={by + uy * (ballR + 2)}
              x2={tx - ux * 12} y2={ty - uy * 12}
              stroke="rgba(52,211,153,0.7)" strokeWidth={2.5} strokeDasharray="6 3"
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      })()}
    </svg>
  );
}

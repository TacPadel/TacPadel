import React, { useRef, useState, useCallback, useMemo } from "react";
// DEIN NEUER COURT IMPORT
import ScenarioCourt4D from "./ScenarioCourt4D";

interface DraggableItem {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  isPlayer: boolean;
}

interface TacticalFilters {
  showBallVector: boolean;
  showMovements: boolean;
  showWeaknessZones: boolean;
  showTeamLines: boolean;
  showPulse: boolean;
  showAttackArc: boolean;
}

// Virtuelle Konstanten für stabiles Scaling
const V_WIDTH = 760;
const V_HEIGHT = 380;

// Globale Taktik-Schwellenwerte für Analyse
const GAP_THRESHOLD = 120;
const WIDE_GAP_THRESHOLD = 130;
const DEEP_DEF_THRESHOLD = 80;
const SHORT_DEF_THRESHOLD = 70;

// Hilfsfunktion zur Berechnung der magnetischen Bogen-Kurve (Parabel)
const getArcX = (y: number, isTeamA: boolean) => {
  const cy = V_HEIGHT / 2;
  const aVal = 80 / Math.pow((V_HEIGHT / 2) - 20, 2);
  const netX = V_WIDTH / 2;
  
  if (isTeamA) {
    return (aVal * Math.pow(y - cy, 2)) + (netX - 140);
  } else {
    return -(aVal * Math.pow(y - cy, 2)) + (netX + 140);
  }
};

const getControlPointX = (isTeamA: boolean) => {
  const apexX = getArcX(V_HEIGHT / 2, isTeamA);
  const edgeX = getArcX(20, isTeamA);
  return 2 * apexX - edgeX;
};

// VORDEFINIERTE TAKTISCHE AUFSTELLUNGEN (SZENARIOS)
const SCENARIOS: Record<string, {
  name: string;
  items: DraggableItem[];
  customAnalysis?: { targetX: number; targetY: number; recommendation: string };
}> = {
  initial: {
    name: "Standard Startaufstellung",
    items: [
      { id: "a1", x: 120, y: 130, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 120, y: 250, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 120, y: 130, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 120, y: 250, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: (V_WIDTH / 2) - 0, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },
    ]
  },
  angriff_dynamisch: {
    name: "Taktik: Dynamischer Angriff (Scheibenwischer)",
    items: [
      { id: "a1", x: getArcX(140, true), y: 140, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: getArcX(240, true), y: 240, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 140, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 70, y: 240, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH / 2 - 40, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 60,
      recommendation: "Volley in die Ecke! Verschieb das Team wie einen Scheibenwischer zur Ballseite."
    }
  },
  aufschlag_a: {
    name: "Taktik: Eigener Aufschlag (Team A)",
    items: [
      { id: "a1", x: 60, y: 290, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 320, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },      
      { id: "b1", x: V_WIDTH - 80, y: 100, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 240, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 85, y: 285, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 660,
      targetY: 100,
      recommendation: "Tiefer Aufschlag in die Rückhand oder auf die T-Linie."
    }
  },
  return_a: {
    name: "Taktik: Return-Abwehr (Gegner schlägt auf)",
    items: [
      { id: "a1", x: 80, y: 280, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 90, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },      
      { id: "b1", x: V_WIDTH - 60, y: 100, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 440, y: 260, color: "#f1c40f", label: "B2", isPlayer: true },      
      { id: "ball", x: V_WIDTH - 90, y: 120, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 100,
      targetY: 280,
      recommendation: "Bereite dich auf einen tiefen Slice-Aufschlag vor."
    }
  },
  angriff_netz_a: {
    name: "Taktik: Team A besetzt das Netz",
    items: [
      { id: "a1", x: 310, y: 130, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 310, y: 250, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 80, y: 280, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 335, y: 135, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 195,
      recommendation: "Aggressiver Volley tief durch die goldene Mitte!"
    }
  }
};

const getTacticalAnalysis = (
  items: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null
) => {
  const teamA = items.filter((i) => i.id.startsWith("a"));
  const teamB = items.filter((i) => i.id.startsWith("b"));
  const ball = items.find((i) => i.id === "ball");
  if (!ball || teamA.length < 2 || teamB.length < 2) return null;

  const netX = V_WIDTH / 2;
  const teamA_X = (teamA[0].x + teamA[1].x) / 2;
  const teamB_X = (teamB[0].x + teamB[1].x) / 2;

  const isBallOnSideA = ball.x <= netX;

  const closestA = teamA.reduce((prev, curr) =>
    Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y) ? curr : prev
  );
  const closestB = teamB.reduce((prev, curr) =>
    Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y) ? curr : prev
  );

  const movements: Record<string, { tx: number; ty: number }> = {};
  let targetX = 0;
  let targetY = 0;
  let recommendation = "";

  if (customTarget) {
    targetX = customTarget.x;
    targetY = customTarget.y;
    recommendation = "Manueller Zielpunkt gesetzt! Die Taktikketten verschieben sich zum Landepunkt.";
  } else if (scenarioKey !== "custom" && SCENARIOS[scenarioKey]?.customAnalysis) {
    const custom = SCENARIOS[scenarioKey].customAnalysis;
    targetX = custom!.targetX;
    targetY = custom!.targetY;
    recommendation = custom!.recommendation;
  } else {
    if (isBallOnSideA) {
      targetX = V_WIDTH - 80;
      targetY = V_HEIGHT / 2;
      recommendation = "Befreiungsschlag: Versuche einen Lob oder spiele flach in die Ecke.";
      
      const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD;
      
      if (teamB_X < netX + DEEP_DEF_THRESHOLD) {
        recommendation = "Die Gegner kleben am Netz. Zeit für einen hohen Lob in den Rückraum!";
        targetX = V_WIDTH - 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isBMiddleOpen && filters.showWeaknessZones) {
        recommendation = "Lücke erkannt! Spiel den Ball scharf durch die gegnerische Mitte.";
        targetX = (teamB[0].x + teamB[1].x) / 2;
        targetY = (teamB[0].y + teamB[1].y) / 2;
      }
    } else {
      targetX = 80;
      targetY = V_HEIGHT / 2;
      recommendation = "Gegner am Ball. Halte die Netzposition und decke die Winkel.";
      
      const isAMiddleOpen = Math.abs(teamA[0].y - teamA[1].y) > GAP_THRESHOLD;
      const isAAtNet = teamA_X > netX - DEEP_DEF_THRESHOLD;
      
      if (isAAtNet) {
        recommendation = "Gefahr eines Lobs! Ihr seid weit vorne am Netz, bereitet euch auf den Rückzug vor.";
        targetX = 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isAMiddleOpen && filters.showWeaknessZones) {
        recommendation = "Achtung: Eure Mitte ist zu offen! Der Gegner kann durchspielen.";
        targetX = (teamA[0].x + teamA[1].x) / 2;
        targetY = (teamA[0].y + teamA[1].y) / 2;
      }
    }
  }

  let title = "";
  let bodyText = "";
  let color = "";
  let activePlayerId = "";

  if (isBallOnSideA) {
    const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD;
    const isAInTransition = teamA_X > V_WIDTH * 0.25 && teamA_X < netX - 80;

    teamA.forEach(p => {
      if (p.id === closestA.id) {
        const angle = Math.atan2(ball.y - p.y, ball.x - p.x);
        const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
        const step = Math.max(0, dist - 28);
        movements[p.id] = { tx: p.x + Math.cos(angle) * step, ty: p.y + Math.sin(angle) * step };
      } else {
        movements[p.id] = { tx: p.x, ty: ball.y };
      }
    });

    teamB.forEach(p => {
      if (filters.showAttackArc) {
        const ballYPercent = Math.max(0, Math.min(1, ball.y / V_HEIGHT));
        const optY = p.id === "b1" ? 90 + (ballYPercent * 100) : 190 + (ballYPercent * 100);
        movements[p.id] = { tx: getArcX(optY, false), ty: optY };
      } else {
        const targetNetX = netX + 50;
        const targetNetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.65 : V_HEIGHT * 0.35;
        movements[p.id] = { tx: p.x * 0.4 + targetNetX * 0.6, ty: p.y * 0.4 + targetNetY * 0.6 };
      }
    });

    bodyText = `Der Ball liegt in eurer Hälfte. Spieler ${closestA.label} führt den Schlag aus.`;
    title = `Abwehr-Modus — Spieler ${closestA.label} schlägt`;
    color = isAInTransition ? "bg-red-700" : (isBMiddleOpen && filters.showWeaknessZones) ? "bg-emerald-600" : "bg-indigo-700";
    activePlayerId = closestA.id;
  } else {
    teamB.forEach(p => {
      if (p.id === closestB.id) {
        const angle = Math.atan2(ball.y - p.y, ball.x - p.x);
        const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
        const step = Math.max(0, dist - 28);
        movements[p.id] = { tx: p.x + Math.cos(angle) * step, ty: p.y + Math.sin(angle) * step };
      } else {
        movements[p.id] = { tx: p.x, ty: ball.y };
      }
    });

    teamA.forEach(p => {
      if (filters.showAttackArc) {
        const ballYPercent = Math.max(0, Math.min(1, ball.y / V_HEIGHT));
        const optY = p.id === "a1" ? 90 + (ballYPercent * 100) : 190 + (ballYPercent * 100);
        movements[p.id] = { tx: getArcX(optY, true), ty: optY };
      } else {
        const targetNetX = netX - 50;
        const targetNetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.65 : V_HEIGHT * 0.35;
        movements[p.id] = { tx: p.x * 0.4 + targetNetX * 0.6, ty: p.y * 0.4 + targetNetY * 0.6 };
      }
    });

    bodyText = `Der Ball befindet sich in der gegnerischen Hälfte. Spieler ${closestB.label} bereitet den Schlag vor.`;
    title = `Defensiv-Modus — Gegner ${closestB.label} am Ball`;
    color = "bg-blue-900";
    activePlayerId = closestB.id;
  }

  return { title, body: bodyText, color, recommendation, targetX, targetY, activePlayerId, movements };
};

// ==========================================
// 3D ANSICHT MIT TAKTIK-RADAR HUD (MOBILE OPTIMIERT)
// ==========================================
function TrajectoryView3D() {
  const [shotType, setShotType] = useState("BAJADA");
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [playerPos, setPlayerPos] = useState({ x: 140, y: 260 }); 
  const [targetPos, setTargetPos] = useState({ x: 620, y: 120 }); 
  const [activeDrag, setActiveDrag] = useState<"player" | "target" | null>(null);

  const sniperSvgRef = useRef<SVGSVGElement>(null);
  const NET_X = V_WIDTH / 2;

  // 1. Die klassische Zonen-Rechnung (Das "Alibi" für TacticalData.tsx)
  const getZoneFromXY = (x: number, y: number, isTeamA: boolean) => {
    const clampedY = Math.max(0, Math.min(V_HEIGHT - 0.1, y));
    const colIndex = Math.floor((clampedY / V_HEIGHT) * 5); 
    const cols = ["A", "B", "C", "D", "E"];
    const col = cols[colIndex];

    let row = "3";
    if (isTeamA) {
      const clampedX = Math.max(0, Math.min(NET_X - 0.1, x));
      const rowIndex = Math.floor((clampedX / NET_X) * 5); 
      row = (rowIndex + 1).toString(); 
    } else {
      const clampedX = Math.max(NET_X, Math.min(V_WIDTH - 0.1, x));
      const relativeX = clampedX - NET_X; 
      const rowIndex = Math.floor((relativeX / NET_X) * 5); 
      row = (5 - rowIndex).toString();
    }
    return `${col}${row}`;
  };

  // 2. Die neue millimetergenaue Umrechnung (Die "Wahrheit" für den Ballflug)
  const getMetersFromXY = (svgX: number, svgY: number) => {
    const z = 10 - ((svgX / V_WIDTH) * 20); 
    const x = ((svgY / V_HEIGHT) * 10) - 5; 
    return { 
      x: Number(x.toFixed(2)), 
      z: Number(z.toFixed(2)) 
    };
  };

  const playerZone = getZoneFromXY(playerPos.x, playerPos.y, true);
  const targetZone = getZoneFromXY(targetPos.x, targetPos.y, false);
  
  const playerCoords = getMetersFromXY(playerPos.x, playerPos.y);
  const targetCoords = getMetersFromXY(targetPos.x, targetPos.y);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = sniperSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    
    let clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    let clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const SVG_VIEW_X = -60;
    const SVG_VIEW_Y = -60;
    const SVG_VIEW_W = 880;
    const SVG_VIEW_H = 500;

    return {
      x: ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X,
      y: ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y,
    };
  }, []);

  const onPointerDown = useCallback((id: "player" | "target", e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); 
    if (e.cancelable) e.preventDefault();
    setActiveDrag(id);
  }, []);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!activeDrag) return;
    if (e.cancelable) e.preventDefault();
    const pt = getPoint(e);

    if (activeDrag === "player") {
      setPlayerPos({ x: Math.max(16, Math.min(NET_X - 16, pt.x)), y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)) });
    } else if (activeDrag === "target") {
      setTargetPos({ x: Math.max(NET_X + 16, Math.min(V_WIDTH - 16, pt.x)), y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)) });
    }
  }, [activeDrag, getPoint]);

  const onPointerUp = useCallback(() => setActiveDrag(null), []);

  const handleSimulate = () => {
    setIsSimulating(true); 
    setTimeout(() => setHasSubmitted(true), 1500); 
  };

  const handleBack = () => {
    setHasSubmitted(false);
    setIsSimulating(false);
  };

  return (
    <div className="w-full max-w-5xl flex-1 flex flex-col h-full px-2 mb-4">
      <div className="w-full flex-1 h-full min-h-[400px] bg-[#02040a] rounded-xl shadow-2xl border-4 border-[#111] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-auto">
          <ScenarioCourt4D
            level="Schlagrichtung"
            isPreparingShot={isSimulating && !hasSubmitted} 
            
            positions={{
              you: `EXACT_${playerCoords.x}_${playerCoords.z}`,
              partner: "EXACT_1000_1000",
              opp1: "EXACT_1000_1000",
              opp2: "EXACT_1000_1000",
              
              // HIER GEÄNDERT: Nutzt jetzt ebenfalls die exakten Koordinaten statt des Rasters!
              ball: { 
                side: "left", 
                zone: `EXACT_${playerCoords.x}_${playerCoords.z}`, 
                type: shotType 
              },
            }}
            
            selectedZone={`EXACT_${targetCoords.x}_${targetCoords.z}`}
            
            exactCoords={{
              you: playerCoords,
              target: targetCoords
            }}
            
            hidePlayerLabels={true}
            hasSubmitted={hasSubmitted}
            bestZones={[`EXACT_${targetCoords.x}_${targetCoords.z}`]}
            onZoneClick={() => {}}
            activeChar="you"
            hitterId="you"
            playIntro={false}
            turnResult="perfect" 
          />
        </div>

        {!isSimulating && (
          <div className="absolute top-2 left-2 z-10 w-[calc(100%-16px)] max-w-[300px] sm:max-w-none sm:w-72 bg-black/80 sm:bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2 sm:gap-3 pointer-events-auto transition-opacity animate-in fade-in">
            <div className="flex justify-between items-center sm:block">
              <div>
                <span className="text-[#5cd6ff] text-[9px] sm:text-[10px] font-black uppercase tracking-widest block mb-0.5">Taktik Radar</span>
                <h3 className="text-white text-xs sm:text-sm font-bold">Start & Ziel wählen</h3>
              </div>
            </div>
            
            <div className="w-full bg-[#050505] rounded-xl border border-white/10 shadow-inner overflow-hidden">
              <svg ref={sniperSvgRef} viewBox="-60 -60 880 500" className="w-full h-auto touch-none select-none block cursor-crosshair" onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp} onTouchMove={onPointerMove} onTouchEnd={onPointerUp} onTouchCancel={onPointerUp}>
                <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
                
                {/* Padel Feld Linien (Maßstabsgetreu 1 Meter = 38 Pixel) */}
                <line x1={NET_X} y1={10} x2={NET_X} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="6 4" />
                <line x1={NET_X - (6.95 * 38)} y1={10} x2={NET_X - (6.95 * 38)} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                <line x1={NET_X + (6.95 * 38)} y1={10} x2={NET_X + (6.95 * 38)} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                <line x1={NET_X - (6.95 * 38)} y1={V_HEIGHT / 2} x2={NET_X} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                <line x1={NET_X} y1={V_HEIGHT / 2} x2={NET_X + (6.95 * 38)} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                
                <line x1={playerPos.x} y1={playerPos.y} x2={targetPos.x} y2={targetPos.y} stroke="#f1c40f" strokeWidth="6" strokeDasharray="8 6" opacity={0.8} />
                <g style={{ cursor: activeDrag === "target" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("target", e)} onTouchStart={(e) => onPointerDown("target", e)}>
                  <circle cx={targetPos.x} cy={targetPos.y} r={40} fill="transparent" />
                  <circle cx={targetPos.x} cy={targetPos.y} r="16" fill="none" stroke="#f1c40f" strokeWidth="3" className="animate-pulse" />
                  <circle cx={targetPos.x} cy={targetPos.y} r="6" fill="#f1c40f" />
                </g>
                <g style={{ cursor: activeDrag === "player" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("player", e)} onTouchStart={(e) => onPointerDown("player", e)}>
                  <circle cx={playerPos.x} cy={playerPos.y} r={40} fill="transparent" />
                  <circle cx={playerPos.x} cy={playerPos.y} r={activeDrag === "player" ? 22 : 18} fill="#e74c3c" stroke="#ffffff" strokeWidth="3" />
                  <text x={playerPos.x} y={playerPos.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>DU</text>
                </g>
              </svg>
            </div>

            <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-white/80 font-bold px-1">
              <span>Pos: <span className="text-[#e74c3c] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">X:{playerCoords.x} Z:{playerCoords.z}</span></span>
              <span>Ziel: <span className="text-[#f1c40f] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">X:{targetCoords.x} Z:{targetCoords.z}</span></span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <select value={shotType} onChange={(e) => setShotType(e.target.value)} className="w-full bg-white/10 text-white text-xs font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                <option value="BAJADA" className="text-black">Topspin (Bajada / Chiquita)</option>
                <option value="VIBORA" className="text-black">Slice (Vibora / Bandeja)</option>
                <option value="SMASH" className="text-black">Flat (Smash - Finisher)</option>
                <option value="LOB" className="text-black">Lob (Defensiv)</option>
              </select>
              <button onClick={handleSimulate} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold py-2 px-3 rounded-lg shadow-md transition-transform active:scale-95 whitespace-nowrap">
                Simulieren
              </button>
            </div>
          </div>
        )}

        {isSimulating && (
          <button onClick={handleBack} className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors pointer-events-auto animate-in fade-in">
            ← Zurück zur Planung
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// HAUPT-KOMPONENTE
// ==========================================
export default function TacticsBoard() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<DraggableItem[]>(SCENARIOS.initial.items);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const dragRef = useRef<{ id: string; ox: number; oy: number; gapY: number; partnerId: string | null } | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  
  const [selectedScenarioKey, setSelectedScenarioKey] = useState("initial");
  const [customTarget, setCustomTarget] = useState<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Toggle für die Modi
  const [activeMode, setActiveMode] = useState<"tactics" | "3d">("tactics");

  const [filters, setFilters] = useState<TacticalFilters>({
    showBallVector: true,
    showMovements: true,
    showWeaknessZones: true,
    showTeamLines: true,
    showPulse: true,
    showAttackArc: false,
  });

  const toggleFilter = (key: keyof TacticalFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setSelectedScenarioKey(key);
    setCustomTarget(null);
    if (SCENARIOS[key]) {
      setItems(SCENARIOS[key].items);
      if (key === "angriff_dynamisch") {
        setFilters(prev => ({ ...prev, showAttackArc: true }));
      }
    }
  };

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const SVG_VIEW_X = -60;
    const SVG_VIEW_Y = -60;
    const SVG_VIEW_W = 880;
    const SVG_VIEW_H = 500;

    return {
      x: ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X,
      y: ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y,
    };
  }, []);

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    const pt = getPoint(e);
    setCustomTarget({ x: pt.x, y: pt.y });
    setSelectedScenarioKey("custom");
  };

  const handleSvgTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const pt = getPoint(e);
      setCustomTarget({ x: pt.x, y: pt.y });
      setSelectedScenarioKey("custom");
    }
    lastTapRef.current = now;
  };

  const onPointerDown = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const pt = getPoint(e);
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const partnerId = id === "a1" ? "a2" : id === "a2" ? "a1" : id === "b1" ? "b2" : id === "b2" ? "b1" : null;
    const partner = items.find(i => i.id === partnerId);
    const gapY = partner ? partner.y - item.y : 0;

    dragRef.current = { id, ox: pt.x - item.x, oy: pt.y - item.y, gapY, partnerId };
    setActiveId(id);
    setSelectedScenarioKey("custom");
  }, [items, getPoint]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault();
    const pt = getPoint(e);
    const { id, ox, oy, gapY, partnerId } = dragRef.current;

    setItems((prev) => {
      const itemToMove = prev.find(i => i.id === id);
      if (!itemToMove) return prev;

      let minX = 16;
      let maxX = V_WIDTH - 16;
      const netX = V_WIDTH / 2;

      if (id === "ball" && filters.showAttackArc) {
        const newX = Math.max(16, Math.min(V_WIDTH - 16, pt.x - ox));
        const newY = Math.max(16, Math.min(V_HEIGHT - 16, pt.y - oy));
        const ballRatio = Math.max(0, Math.min(1, newY / V_HEIGHT));
        
        const isTeamAAttacking = newX > netX;

        return prev.map((item) => {
          if (item.id === "ball") return { ...item, x: newX, y: newY };
          
          if (item.isPlayer) {
            const isAttacker = isTeamAAttacking ? item.id.startsWith("a") : item.id.startsWith("b");
            
            if (isAttacker) {
              const targetY = (item.id === "a1" || item.id === "b1") ? 90 + ballRatio * 100 : 190 + ballRatio * 100;
              return { ...item, x: getArcX(targetY, item.id.startsWith("a")), y: targetY };
            } else {
              const targetX = isTeamAAttacking ? V_WIDTH - 80 : 80;
              const isPlayer1 = item.id === "a1" || item.id === "b1";
              const targetY = isPlayer1 ? 90 + ballRatio * 100 : 190 + ballRatio * 100;
              return { ...item, x: targetX, y: targetY };
            }
          }
          return item;
        });
      }

      if (id.startsWith("a")) {
        maxX = netX - 15;
      } else if (id.startsWith("b") && id !== "ball") {
        minX = netX + 15;
      }

      let newX = Math.max(minX, Math.min(maxX, pt.x - ox));
      let newY = Math.max(16, Math.min(V_HEIGHT - 16, pt.y - oy));

      if (filters.showAttackArc && itemToMove.isPlayer) {
        const ballItem = prev.find(i => i.id === "ball");
        const isTeamAAttacking = ballItem ? ballItem.x > netX : false;
        const isTeamA = id.startsWith("a");
        
        if ((isTeamA && isTeamAAttacking) || (!isTeamA && !isTeamAAttacking)) {
          let partnerNewY = newY + gapY;

          if (partnerNewY < 16) {
            partnerNewY = 16;
            newY = partnerNewY - gapY;
          } else if (partnerNewY > V_HEIGHT - 16) {
            partnerNewY = V_HEIGHT - 16;
            newY = partnerNewY - gapY;
          }

          newX = getArcX(newY, isTeamA);
          const partnerNewX = getArcX(partnerNewY, isTeamA);

          return prev.map((item) => {
            if (item.id === id) return { ...item, x: newX, y: newY };
            if (item.id === partnerId) return { ...item, x: partnerNewX, y: partnerNewY };
            return item;
          });
        }
      }

      return prev.map((item) => {
        if (item.id === id) return { ...item, x: newX, y: newY };
        return item;
      });
    });
  }, [getPoint, filters.showAttackArc]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setActiveId(null);
  }, []);

  const reset = () => {
    setSelectedScenarioKey("initial");
    setCustomTarget(null);
    setItems(SCENARIOS.initial.items);
  };

  const netX = V_WIDTH / 2;
  const offsetX = 10 + (V_WIDTH - 20) * 0.15;

  const analysis = useMemo(() => getTacticalAnalysis(items, filters, selectedScenarioKey, customTarget), [items, filters, selectedScenarioKey, customTarget]);

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full flex-1 py-4 overflow-hidden">
      
      {/* --- DER TOGGLE-SCHALTER --- */}
      <div className="w-full max-w-5xl flex flex-col items-center mb-2 px-3">
        <div className="bg-white p-1.5 rounded-full shadow-sm border border-gray-200 inline-flex relative w-full max-w-md">
          <div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] bg-indigo-600 rounded-full transition-transform duration-300 ease-in-out shadow-md`}
            style={{ transform: activeMode === "tactics" ? "translateX(0)" : "translateX(100%)" }}
          />
          <button
            onClick={() => setActiveMode("tactics")}
            className={`relative flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors z-10 ${
              activeMode === "tactics" ? "text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            2D Taktik & Positionen
          </button>
          <button
            onClick={() => setActiveMode("3d")}
            className={`relative flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors z-10 ${
              activeMode === "3d" ? "text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            3D Flugkurven & Glas
          </button>
        </div>
      </div>

      {/* --- RENDERN BASIEREND AUF DEM SCHALTER --- */}
      {activeMode === "3d" ? (
        <TrajectoryView3D />
      ) : (
        <>
          {/* --- FILTER PANEL --- */}
          {showTactics && (
            <div className="w-full max-w-5xl px-3 flex flex-col gap-3">
              <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-widest font-bold block text-gray-400 mb-0.5">Taktik-Vorlage</span>
                  <h4 className="text-sm font-bold text-gray-800">Szenario auf dem Platz laden:</h4>
                </div>
                <div className="relative w-full sm:w-72">
                  <select
                    value={selectedScenarioKey}
                    onChange={handleScenarioChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8 shadow-inner"
                  >
                    {Object.entries(SCENARIOS).map(([key, value]) => (
                      <option key={key} value={key}>{value.name}</option>
                    ))}
                    <option value="custom" disabled>Freies Board / Eigene Platzierung</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">▼</div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-md w-full">
                <span className="text-xs uppercase tracking-widest font-bold block mb-3 text-gray-500">Taktische Overlays filtern:</span>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
                  <label className="flex items-center gap-2 sm:gap-3 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg border border-indigo-200 cursor-pointer select-none transition-all shadow-sm">
                    <input type="checkbox" checked={filters.showAttackArc} onChange={() => toggleFilter("showAttackArc")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-indigo-500 inline-block" />
                      <span className="font-bold text-indigo-900">Angriffs-Bogen (Scheibenwischer)</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showBallVector} onChange={() => toggleFilter("showBallVector")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-yellow-400 inline-block" />
                      <span className="font-medium text-gray-800">Ballbahn &amp; Zielpunkt</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showMovements} onChange={() => toggleFilter("showMovements")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-[#5cd6ff] inline-block" />
                      <span className="font-medium text-gray-800">Laufrichtungen</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showWeaknessZones} onChange={() => toggleFilter("showWeaknessZones")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-red-400/50 border border-red-500 rounded inline-block" />
                      <span className="font-medium text-gray-800">Schwächen-Zonen</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showTeamLines} onChange={() => toggleFilter("showTeamLines")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                      <span className="font-medium text-gray-800">Team-Abstände</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showPulse} onChange={() => toggleFilter("showPulse")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-gray-400 bg-white inline-block animate-pulse" />
                      <span className="font-medium text-gray-800">Aktiver Spieler</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SPIELFELD - SVG */}
          {/* Fügen Sie hier "flex-col" hinzu, damit alles untereinander statt nebeneinander angeordnet wird */}
          <div ref={containerRef} className="w-full max-w-5xl px-3 flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <svg
              ref={svgRef}
              viewBox="-60 -60 880 500"
              className="rounded-xl shadow-2xl border-4 border-[#111] w-full h-auto max-h-[100%] touch-none select-none overflow-hidden"
              style={{ background: "#050505", display: "block", touchAction: "none" }}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
              onTouchCancel={onPointerUp}
              onDoubleClick={handleSvgDoubleClick}
              onTouchStart={handleSvgTouchStart}  
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="yellow" />
                </marker>
                <marker id="moveArrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#5cd6ff" />
                </marker>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.5)" />
                </filter>
                <filter id="activeShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="rgba(0,0,0,0.6)" />
                </filter>
                
                <pattern id="turf" width="4" height="4" patternUnits="userSpaceOnUse">
                  <rect width="2" height="2" fill="rgba(0,0,0,0.06)" />
                  <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,0.06)" />
                </pattern>
                
                <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <path d="M 0 6 L 6 0 M 0 0 L 6 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                </pattern>
                
                <linearGradient id="glassGradTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradBottom" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradLeft" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradRight" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
              </defs>

              <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="#1034A6" />
              <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="url(#turf)" />
              <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.9} />
              <line x1={offsetX} y1={10} x2={offsetX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
              <line x1={V_WIDTH - offsetX} y1={10} x2={V_WIDTH - offsetX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
              <line x1={offsetX} y1={V_HEIGHT / 2} x2={V_WIDTH - offsetX} y2={V_HEIGHT / 2} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
              <rect x={netX - 2} y={10} width={4} height={V_HEIGHT - 20} fill="#111" />
              <line x1={netX} y1={10} x2={netX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />

              <g stroke="#555" strokeWidth="2" strokeLinejoin="round">
                <polygon points="-30,-30 125,-30 150,10 10,10" fill="url(#glassGradTop)" />
                <polygon points="125,-30 635,-30 610,10 150,10" fill="url(#mesh)" />      
                <polygon points="635,-30 790,-30 750,10 610,10" fill="url(#glassGradTop)" />
                <polygon points="-30,410 125,410 150,370 10,370" fill="url(#glassGradBottom)" />
                <polygon points="125,410 635,410 610,370 150,370" fill="url(#mesh)" />      
                <polygon points="635,410 790,410 750,370 610,370" fill="url(#glassGradBottom)" />
                <polygon points="-30,-30 -30,410 10,370 10,10" fill="url(#glassGradLeft)" /> 
                <polygon points="790,-30 790,410 750,370 750,10" fill="url(#glassGradRight)" /> 
              </g>

              <g stroke="#666" strokeWidth="3" strokeLinecap="round">
                <rect x="-30" y="-30" width="820" height="440" fill="none" strokeWidth="4" />
                <line x1="150" y1="10" x2="125" y2="-30" />
                <line x1="610" y1="10" x2="635" y2="-30" />
                <line x1="150" y1="370" x2="125" y2="410" />
                <line x1="610" y1="370" x2="635" y2="410" />
                <line x1={netX} y1="10" x2={netX} y2="-30" />
                <line x1={netX} y1="370" x2={netX} y2="410" />
              </g>

              <g stroke="#7f8c8d" strokeWidth="3">
                <line x1="-30" y1="-30" x2="-50" y2="-50" />
                <line x1="-55" y1="-45" x2="-45" y2="-55" stroke="#fff" strokeWidth="6" />
                <line x1="790" y1="-30" x2="810" y2="-50" />
                <line x1="805" y1="-55" x2="815" y2="-45" stroke="#fff" strokeWidth="6" />
                <line x1="-30" y1="410" x2="-50" y2="430" />
                <line x1="-55" y1="425" x2="-45" y2="435" stroke="#fff" strokeWidth="6" />
                <line x1="790" y1="410" x2="810" y2="430" />
                <line x1="805" y1="435" x2="815" y2="425" stroke="#fff" strokeWidth="6" />
              </g>

              <text x={netX} y={V_HEIGHT / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity={0.25} fontSize={16} fontWeight="bold" letterSpacing="4">NETZ</text>
              <text x={offsetX / 2 + 5} y={V_HEIGHT - 18} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">TEAM A</text>
              <text x={V_WIDTH - offsetX / 2 - 5} y={V_HEIGHT - 18} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">TEAM B</text>

              {showTactics && (
                <>
                  {filters.showAttackArc && (
                    <>
                      <path d={`M ${getArcX(20, true)} 20 Q ${getControlPointX(true)} ${V_HEIGHT/2} ${getArcX(V_HEIGHT-20, true)} ${V_HEIGHT-20}`} fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="4" strokeDasharray="8 6" />
                      <path d={`M ${getArcX(20, false)} 20 Q ${getControlPointX(false)} ${V_HEIGHT/2} ${getArcX(V_HEIGHT-20, false)} ${V_HEIGHT-20}`} fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="4" strokeDasharray="8 6" />
                    </>
                  )}

                  <line x1={V_WIDTH * 0.25} y1={10} x2={V_WIDTH * 0.25} y2={V_HEIGHT - 10} stroke="white" strokeWidth={1} strokeDasharray="4 4" opacity="0.3" />
                  <line x1={netX - 80} y1={10} x2={netX - 80} y2={V_HEIGHT - 10} stroke="white" strokeWidth={1} strokeDasharray="4 4" opacity="0.3" />

                  {filters.showWeaknessZones && (() => {
                    const ball = items.find((i) => i.id === "ball");
                    if (!ball) return null;
                    if (ball.x <= netX) {
                      const b1 = items.find((i) => i.id === "b1"); const b2 = items.find((i) => i.id === "b2"); if (!b1 || !b2) return null;
                      const gap = Math.abs(b1.y - b2.y); const avgX = (b1.x + b2.x) / 2; const avgY = (b1.y + b2.y) / 2;
                      return (
                        <>
                          {gap > GAP_THRESHOLD && <rect x={avgX - 30} y={avgY - 60} width={60} height={120} fill="red" opacity="0.35" rx="8" />}
                          {avgX < netX + DEEP_DEF_THRESHOLD && <rect x={netX + 10} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />}
                        </>
                      );
                    } else {
                      const a1 = items.find((i) => i.id === "a1"); const a2 = items.find((i) => i.id === "a2"); if (!a1 || !a2) return null;
                      const gap = Math.abs(a1.y - a2.y); const avgX = (a1.x + a2.x) / 2; const avgY = (a1.y + a2.y) / 2;
                      return (
                        <>
                          {gap > GAP_THRESHOLD && <rect x={avgX - 30} y={avgY - 60} width={60} height={120} fill="red" opacity="0.35" rx="8" />}
                          {avgX > netX - DEEP_DEF_THRESHOLD && <rect x={netX - 60} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />}
                        </>
                      );
                    }
                  })()}

                  {filters.showTeamLines && (() => {
                    const teamA = items.filter((i) => i.id.startsWith("a")); if (teamA.length < 2) return null;
                    const distA = Math.hypot(teamA[0].x - teamA[1].x, teamA[0].y - teamA[1].y);
                    const isGapTooWide = distA > GAP_THRESHOLD;
                    return <line x1={teamA[0].x} y1={teamA[0].y} x2={teamA[1].x} y2={teamA[1].y} stroke={isGapTooWide ? "#e74c3c" : "#2ecc71"} strokeWidth={4} />;
                  })()}

                  {filters.showTeamLines && (() => {
                    const teamB = items.filter((i) => i.id.startsWith("b")); if (teamB.length < 2) return null;
                    const distB = Math.hypot(teamB[0].x - teamB[1].x, teamB[0].y - teamB[1].y);
                    const isGapTooWide = distB > GAP_THRESHOLD;
                    return <line x1={teamB[0].x} y1={teamB[0].y} x2={teamB[1].x} y2={teamB[1].y} stroke={isGapTooWide ? "#e74c3c" : "#2ecc71"} strokeWidth={4} />;
                  })()}

                  {filters.showTeamLines && (
                    <line x1={((items.find((i) => i.id === "a1")?.x || 0) + (items.find((i) => i.id === "a2")?.x || 0)) / 2} y1={V_HEIGHT / 2} x2={items.find((i) => i.id === "ball")?.x || 0} y2={items.find((i) => i.id === "ball")?.y || 0} stroke="#3498db" strokeWidth="2" strokeDasharray="4 2" />
                  )}

                  {analysis && filters.showBallVector && (
                    <>
                      <line x1={items.find((i) => i.id === "ball")?.x || 0} y1={items.find((i) => i.id === "ball")?.y || 0} x2={analysis.targetX} y2={analysis.targetY} stroke="yellow" strokeWidth="4" strokeDasharray="6 2" markerEnd="url(#arrowhead)" />
                      <g className="animate-pulse">
                        <circle cx={analysis.targetX} cy={analysis.targetY} r="14" fill="none" stroke="yellow" strokeWidth="2" opacity="0.85" />
                        <circle cx={analysis.targetX} cy={analysis.targetY} r="4" fill="yellow" />
                      </g>
                    </>
                  )}

                  {analysis && filters.showMovements && items.filter(item => item.isPlayer).map(player => {
                    const move = analysis.movements?.[player.id]; if (!move) return null;
                    const angle = Math.atan2(move.ty - player.y, move.tx - player.x);
                    const startX = player.x + Math.cos(angle) * 17; const startY = player.y + Math.sin(angle) * 17;
                    if (Math.hypot(move.tx - player.x, move.ty - player.y) < 12) return null;
                    return <line key={`move-${player.id}`} x1={startX} y1={startY} x2={move.tx} y2={move.ty} stroke="#5cd6ff" strokeWidth="3" strokeDasharray="4 3" markerEnd="url(#moveArrowhead)" />;
                  })}
                </>
              )}

              {/* Figuren */}
              {items.map((item) => {
                const isDragging = activeId === item.id;
                const baseR = item.isPlayer ? 16 : 10;
                const r = isDragging ? baseR * 1.15 : baseR;
                const isActivePlayer = showTactics && analysis && analysis.activePlayerId === item.id;

                return (
                  <g key={item.id} style={{ cursor: isDragging ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown(item.id, e)} onTouchStart={(e) => onPointerDown(item.id, e)}>
                    <circle cx={item.x} cy={item.y} r={baseR + 12} fill="transparent" />
                    {isActivePlayer && filters.showPulse && (
                      <circle cx={item.x} cy={item.y} r={r + 6} fill="none" stroke={item.id.startsWith("a") ? "#ffffff" : "#f1c40f"} strokeWidth="3" className="animate-ping" style={{ transformOrigin: `${item.x}px ${item.y}px`, opacity: 0.6 }} />
                    )}
                    <circle cx={item.x} cy={item.y} r={r} fill={item.color} stroke={isActivePlayer ? "#ffffff" : "white"} strokeWidth={isActivePlayer ? 4 : 2} filter={isDragging ? "url(#activeShadow)" : "url(#shadow)"} />
                    <text x={item.x} y={item.y} textAnchor="middle" dominantBaseline="central" fill={item.color === "#f1c40f" ? "black" : "white"} fontSize={item.isPlayer ? 11 : 12} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>{item.label}</text>
                  </g>
                );
              })}
            </svg>

            {showTactics && analysis && (
              <div className={`mt-4 p-4 sm:p-6 rounded-2xl text-white shadow-2xl border-2 border-white/20 w-full transition-all duration-500 ${analysis.color}`}>
                <h3 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2"><span className="text-xl sm:text-2xl">📋</span> {analysis.title}</h3>
                <p className="text-sm sm:text-lg leading-relaxed font-medium opacity-90">{analysis.body}</p>
                <div className="mt-4 bg-white/20 p-3 sm:p-4 rounded-xl border border-white/30 backdrop-blur-sm">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold block mb-1">{items.find((i) => i.id === "ball")!.x < netX ? "Deine Angriffs-Empfehlung:" : "Gegner-Gefahrenzone / Deine Stellungs-Aufgabe:"}</span>
                  <span className="text-lg sm:text-2xl font-black">{analysis.recommendation}</span>
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/20">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold block mb-3 text-white/80">Aktive Legende:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-xs bg-black/20 p-3 rounded-xl border border-white/10">
                    {filters.showAttackArc && (<div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-indigo-300 border-dashed inline-block" /><span><strong className="text-indigo-200">Bogen:</strong> Scheibenwischer</span></div>)}
                    {filters.showMovements && (<div className="flex items-center gap-2"><span className="w-5 h-0.5 border-t-2 border-dashed border-[#5cd6ff] inline-block" /><span><strong className="text-[#5cd6ff]">Blauer Pfeil:</strong> Laufrichtung</span></div>)}
                    {filters.showPulse && (<div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white inline-block animate-pulse bg-white/20" /><span><strong className="text-white">Pulsierend:</strong> Am Ball</span></div>)}
                    {filters.showBallVector && (<><div className="flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full border border-yellow-400 border-dashed text-[9px] font-bold text-yellow-300">◎</span><span><strong className="text-yellow-300">Fadenkreuz:</strong> Ziel</span></div><div className="flex items-center gap-2"><span className="w-5 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" /><span><strong className="text-yellow-300">Gelb:</strong> Flugbahn</span></div></>)}
                    {filters.showWeaknessZones && (<><div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500/30 rounded inline-block border border-red-500/40" /><span><strong className="text-red-300">Rot:</strong> Offene Mitte</span></div><div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-500/30 rounded inline-block border border-orange-500/40" /><span><strong className="text-orange-300">Orange:</strong> Tiefe</span></div></>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-3 mb-6">
            <button onClick={reset} className="px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md">Positionen zurücksetzen</button>
            <button onClick={() => setShowTactics(!showTactics)} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all shadow-md ${showTactics ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>{showTactics ? "Analyse aus" : "Analyse ein"}</button>
          </div>
        </>
      )}
    </div>
  );
}
import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import ScenarioCourt4D from "./ScenarioCourt4D";
import { supabase } from "../lib/supabase";
import { useTranslation, TranslationKey } from "../lib/i18n";

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

// Typen für das Tactical Studio (Zeichnungen & Rekorder)
type StudioTool = "move" | "arrow_run" | "arrow_ball" | "zone_circle";

interface StudioDrawing {
  id: string;
  type: "arrow_run" | "arrow_ball" | "zone_circle";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Virtuelle Konstanten für stabiles Scaling (Logik bleibt 16:9, Ansicht wird 9:16 gedreht!)
const V_WIDTH = 760;
const V_HEIGHT = 380;

// Globale Taktik-Schwellenwerte für Analyse
const GAP_THRESHOLD = 160;
const WIDE_GAP_THRESHOLD = 180;
const DEEP_DEF_THRESHOLD = 80;

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
  nameKey: TranslationKey;
  items: DraggableItem[];
  customAnalysis?: { targetX: number; targetY: number; recommendationKey: TranslationKey };
}> = {
  initial: {
    nameKey: "tb_scen_initial_name",
    items: [
      { id: "a1", x: 120, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 120, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 120, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 120, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: (V_WIDTH / 2) - 0, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },
    ]
  },
  angriff_dynamisch: {
    nameKey: "tb_scen_wiper_name",
    items: [
      { id: "a1", x: getArcX(110, true), y: 110, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: getArcX(270, true), y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 70, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH / 2 - 40, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 60,
      recommendationKey: "tb_scen_wiper_rec"
    }
  },
  aufschlag_a: {
    nameKey: "tb_scen_serve_name",
    items: [
      { id: "a1", x: 60, y: 270, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 320, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },      
      { id: "b1", x: V_WIDTH - 80, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 100, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 85, y: 270, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 660,
      targetY: 100,
      recommendationKey: "tb_scen_serve_rec"
    }
  },
  return_a: {
    nameKey: "tb_scen_return_name",
    items: [
      { id: "a1", x: 80, y: 270, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 90, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },      
      { id: "b1", x: V_WIDTH - 60, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 440, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },      
      { id: "ball", x: V_WIDTH - 90, y: 110, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 100,
      targetY: 280,
      recommendationKey: "tb_scen_return_rec"
    }
  },
  angriff_netz_a: {
    nameKey: "tb_scen_net_name",
    items: [
      { id: "a1", x: 310, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },      
      { id: "a2", x: 310, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 80, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 335, y: 135, color: "#2ecc71", label: "●", isPlayer: false },    
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 195,
      recommendationKey: "tb_scen_net_rec"
    }
  }
};

// HILFSFUNKTION: Kapselt die Ziel-Berechnung für beide Systeme
const getTacticalTargetAndRec = (
  ball: { x: number; y: number },
  teamA: DraggableItem[],
  teamB: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string
) => {
  const netX = V_WIDTH / 2;
  const isBallOnSideA = ball.x <= netX;
  const teamA_X = (teamA[0].x + teamA[1].x) / 2;
  const teamB_X = (teamB[0].x + teamB[1].x) / 2;

  let targetX = 0; let targetY = 0; let recommendation = "";

  if (customTarget) {
    targetX = customTarget.x;
    targetY = customTarget.y;
    recommendation = t("tb_rec_custom_target");
  } else if (scenarioKey !== "custom" && SCENARIOS[scenarioKey]?.customAnalysis) {
    const custom = SCENARIOS[scenarioKey].customAnalysis;
    targetX = custom.targetX;
    targetY = custom.targetY;
    recommendation = t(custom.recommendationKey);
  } else {
    if (isBallOnSideA) {
      targetX = V_WIDTH - 80;
      targetY = V_HEIGHT / 2;
      recommendation = t("tb_rec_clear_lob");
      
      const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD + 2;
      if (teamB_X < netX + DEEP_DEF_THRESHOLD) {
        recommendation = t("tb_rec_opp_at_net");
        targetX = V_WIDTH - 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isBMiddleOpen && filters.showWeaknessZones) {
        recommendation = t("tb_rec_gap_middle");
        targetX = (teamB[0].x + teamB[1].x) / 2;
        targetY = (teamB[0].y + teamB[1].y) / 2;
      }
    } else {
      targetX = 80;
      targetY = V_HEIGHT / 2;
      recommendation = t("tb_rec_hold_net");
      
      const isAMiddleOpen = Math.abs(teamA[0].y - teamA[1].y) > GAP_THRESHOLD + 2;
      const isAAtNet = teamA_X > netX - DEEP_DEF_THRESHOLD;
      if (isAAtNet) {
        recommendation = t("tb_rec_lob_danger");
        targetX = 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isAMiddleOpen && filters.showWeaknessZones) {
        recommendation = t("tb_rec_own_middle_open");
        targetX = (teamA[0].x + teamA[1].x) / 2;
        targetY = (teamA[0].y + teamA[1].y) / 2;
      }
    }
  }
  return { targetX, targetY, recommendation };
};

const getTacticalAnalysis = (
  items: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string
) => {
  const teamA = items.filter((i) => i.id.startsWith("a"));
  const teamB = items.filter((i) => i.id.startsWith("b"));
  const ball = items.find((i) => i.id === "ball");
  if (!ball || teamA.length < 2 || teamB.length < 2) return null;

  const netX = V_WIDTH / 2;
  const teamA_X = (teamA[0].x + teamA[1].x) / 2;
  const isBallOnSideA = ball.x <= netX;

  const closestA = teamA.reduce((prev, curr) => Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y) ? curr : prev);
  const closestB = teamB.reduce((prev, curr) => Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y) ? curr : prev);

  const { targetX, targetY, recommendation } = getTacticalTargetAndRec(ball, teamA, teamB, filters, scenarioKey, customTarget, t);

  const movements: Record<string, { tx: number; ty: number }> = {};
  let title = ""; let bodyText = ""; let color = ""; let activePlayerId = "";

  const targetYPercent = Math.max(0, Math.min(1, targetY / V_HEIGHT));
  const targetLateralShift = (targetYPercent - 0.5) * 160;

  if (isBallOnSideA) {
    const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD + 2;
    const isAInTransition = teamA_X > V_WIDTH * 0.25 && teamA_X < netX - 80;

    const hitterAngle = Math.atan2(ball.y - closestA.y, ball.x - closestA.x);
    const hitterDist = Math.hypot(ball.x - closestA.x, ball.y - closestA.y);
    const hitterStep = Math.max(0, hitterDist - 28);
    const hitterTx = closestA.x + Math.cos(hitterAngle) * hitterStep;
    const hitterTy = closestA.y + Math.sin(hitterAngle) * hitterStep;

    teamA.forEach(p => {
      if (p.id === closestA.id) {
        movements[p.id] = { tx: hitterTx, ty: hitterTy };
      } else {
        const idealSpacing = p.id === "a1" ? -160 : 160;
        const targetYBall = Math.max(40, Math.min(V_HEIGHT - 40, ball.y + idealSpacing));
        let partnerTx = p.x;
        if (hitterTx > p.x) partnerTx = hitterTx;
        movements[p.id] = { tx: partnerTx, ty: p.y * 0.4 + targetYBall * 0.6 };
      }
    });

    const defBaseX = (teamB[0].x + teamB[1].x) / 2;
    teamB.forEach(p => {
      if (filters.showAttackArc) {
        const optY = p.id === "b1" ? 110 + targetLateralShift : 270 + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: optY }; 
      } else {
        const baseY = p.id === "b1" ? 110 : 270;
        const targetNetY = baseY + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: p.y * 0.4 + targetNetY * 0.6 }; 
      }
    });

    bodyText = `${t("tb_body_side_a_1")} ${closestA.label} ${t("tb_body_side_a_2")}`;
    title = `${t("tb_title_side_a_1")} ${closestA.label} ${t("tb_title_side_a_2")}`;
    color = isAInTransition ? "bg-red-700" : (isBMiddleOpen && filters.showWeaknessZones) ? "bg-emerald-600" : "bg-indigo-700";
    activePlayerId = closestA.id;
  } else {
    const hitterAngle = Math.atan2(ball.y - closestB.y, ball.x - closestB.x);
    const hitterDist = Math.hypot(ball.x - closestB.x, ball.y - closestB.y);
    const hitterStep = Math.max(0, hitterDist - 28);
    const hitterTx = closestB.x + Math.cos(hitterAngle) * hitterStep;
    const hitterTy = closestB.y + Math.sin(hitterAngle) * hitterStep;

    teamB.forEach(p => {
      if (p.id === closestB.id) {
        movements[p.id] = { tx: hitterTx, ty: hitterTy };
      } else {
        const idealSpacing = p.id === "b1" ? -160 : 160;
        const targetYBall = Math.max(40, Math.min(V_HEIGHT - 40, ball.y + idealSpacing));
        let partnerTx = p.x;
        if (hitterTx < p.x) partnerTx = hitterTx;
        movements[p.id] = { tx: partnerTx, ty: p.y * 0.4 + targetYBall * 0.6 };
      }
    });

    const defBaseX = (teamA[0].x + teamA[1].x) / 2;
    teamA.forEach(p => {
      if (filters.showAttackArc) {
        const optY = p.id === "a1" ? 110 + targetLateralShift : 270 + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: optY }; 
      } else {
        const baseY = p.id === "a1" ? 110 : 270;
        const targetNetY = baseY + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: p.y * 0.4 + targetNetY * 0.6 }; 
      }
    });

    bodyText = `${t("tb_body_side_b_1")} ${closestB.label} ${t("tb_body_side_b_2")}`;
    title = `${t("tb_title_side_b_1")} ${closestB.label} ${t("tb_title_side_b_2")}`;
    color = "bg-blue-900";
    activePlayerId = closestB.id;
  }

  return { title, body: bodyText, color, recommendation, targetX, targetY, activePlayerId, movements };
};

// ==========================================
// 3D ANSICHT MIT TAKTIK-RADAR HUD
// ==========================================
function TrajectoryView3D() {
  const { t } = useTranslation();

  const [shotType, setShotType] = useState("BAJADA");
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [playerPos, setPlayerPos] = useState({ x: 140, y: 260 }); 
  const [targetPos, setTargetPos] = useState({ x: 620, y: 120 }); 
  const [activeDrag, setActiveDrag] = useState<"player" | "target" | null>(null);

  const sniperSvgRef = useRef<SVGSVGElement>(null);
  const NET_X = V_WIDTH / 2;

  const getMetersFromXY = (svgX: number, svgY: number) => {
    const z = 10 - ((svgX / V_WIDTH) * 20); 
    const x = ((svgY / V_HEIGHT) * 10) - 5; 
    return { 
      x: Number(x.toFixed(2)), 
      z: Number(z.toFixed(2)) 
    };
  };

  const playerCoords = getMetersFromXY(playerPos.x, playerPos.y);
  const targetCoords = getMetersFromXY(targetPos.x, targetPos.y);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = sniperSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    
    let clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    let clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const SVG_VIEW_X = -40;
    const SVG_VIEW_Y = -40;
    const SVG_VIEW_W = 460;
    const SVG_VIEW_H = 840;

    const vX = ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X;
    const vY = ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y;

    return {
      x: V_WIDTH - vY,
      y: vX,
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
  }, [activeDrag, getPoint, NET_X]);

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
      <div className="w-full flex-1 h-full min-h-[450px] bg-[#02040a] rounded-xl shadow-2xl border-4 border-[#111] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-auto">
          <ScenarioCourt4D
            level="Schlagrichtung"
            isPreparingShot={isSimulating && !hasSubmitted} 
            positions={{
              you: `EXACT_${playerCoords.x}_${playerCoords.z}`,
              partner: "EXACT_1000_1000",
              opp1: "EXACT_1000_1000",
              opp2: "EXACT_1000_1000",
              ball: { side: "left", zone: `EXACT_${playerCoords.x}_${playerCoords.z}`, type: shotType },
            }}
            selectedZone={`EXACT_${targetCoords.x}_${targetCoords.z}`}
            exactCoords={{ you: playerCoords, target: targetCoords }}
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
                <span className="text-[#5cd6ff] text-[9px] sm:text-[10px] font-black uppercase tracking-widest block mb-0.5">{t("tb_radar_badge")}</span>
                <h3 className="text-white text-xs sm:text-sm font-bold">{t("tb_radar_title")}</h3>
              </div>
            </div>
            
            <div className="w-full bg-[#050505] rounded-xl border border-white/10 shadow-inner overflow-hidden flex justify-center py-2">
              <svg ref={sniperSvgRef} viewBox="-40 -40 460 840" className="w-auto h-[180px] sm:h-[220px] touch-none select-none block cursor-crosshair" onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp} onTouchMove={onPointerMove} onTouchEnd={onPointerUp} onTouchCancel={onPointerUp}>
                <g transform="matrix(0 -1 1 0 0 760)">
                  <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
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
                    <text x={playerPos.x} y={playerPos.y} transform={`rotate(90 ${playerPos.x} ${playerPos.y})`} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>{t("tb_radar_you")}</text>
                  </g>
                </g>
              </svg>
            </div>

            <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-white/80 font-bold px-1">
              <span>{t("tb_radar_pos")} <span className="text-[#e74c3c] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">X:{playerCoords.x} Z:{playerCoords.z}</span></span>
              <span>{t("tb_radar_target")} <span className="text-[#f1c40f] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">X:{targetCoords.x} Z:{targetCoords.z}</span></span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <select value={shotType} onChange={(e) => setShotType(e.target.value)} className="w-full bg-white/10 text-white text-xs font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                <option value="BAJADA" className="text-black">{t("tb_shot_topspin")}</option>
                <option value="VIBORA" className="text-black">{t("tb_shot_slice")}</option>
                <option value="SMASH" className="text-black">{t("tb_shot_flat")}</option>
                <option value="LOB" className="text-black">{t("tb_shot_lob")}</option>
              </select>
              <button onClick={handleSimulate} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold py-2 px-3 rounded-lg shadow-md transition-transform active:scale-95 whitespace-nowrap">
                {t("tb_btn_simulate")}
              </button>
            </div>
          </div>
        )}

        {isSimulating && (
          <button onClick={handleBack} className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors pointer-events-auto animate-in fade-in">
            {t("tb_btn_back_plan")}
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// HAUPT-KOMPONENTE (INKL. TACTICAL STUDIO PRO)
// ==========================================
export default function TacticsBoard() {
  const { lang, t } = useTranslation();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<DraggableItem[]>(SCENARIOS.initial.items);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const dragRef = useRef<{ id: string; ox: number; oy: number; gapY: number; partnerId: string | null } | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  
  const [selectedScenarioKey, setSelectedScenarioKey] = useState("initial");
  const [customTarget, setCustomTarget] = useState<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // --- DYNAMISCHER SCHALTER: 2D | [STUDIO PRO] | 3D ---
  const [activeMode, setActiveMode] = useState<"tactics" | "studio" | "3d">("tactics");

  // --- PRO-USER STATUS (Steuert die Sichtbarkeit von Studio Pro) ---
  const [isProUser, setIsProUser] = useState<boolean>(false);

  useEffect(() => {
    async function checkProStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsProUser(false);
        return;
      }

      const emailLower = session.user.email?.toLowerCase().trim() || "";
      const isAdmin = emailLower === "caposion@gmail.com" || emailLower === "admin@tacpadel.com";
      if (isAdmin) {
        const localOverride = localStorage.getItem("tacpadel_is_pro");
        setIsProUser(localOverride === null ? true : localOverride === "true");
        return;
      }

      const { data: statsData } = await supabase
        .from("user_stats")
        .select("is_pro")
        .eq("id", session.user.id)
        .maybeSingle();

      const dbPro = Boolean(statsData?.is_pro);
      setIsProUser(dbPro);
      localStorage.setItem("tacpadel_is_pro", String(dbPro));
    }
    checkProStatus();
  }, []);

  // --- TACTICAL STUDIO STATES (Zeichnen, Aufnehmen, Teilen) ---
  const [studioTool, setStudioTool] = useState<StudioTool>("move");
  const [studioTitle, setStudioTitle] = useState<string>(() => t("tb_default_studio_title"));
  const [drawings, setDrawings] = useState<StudioDrawing[]>([]);
  const [currentDraft, setCurrentDraft] = useState<StudioDrawing | null>(null);

  // Rekorder & Export States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recSeconds, setRecSeconds] = useState<number>(0);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [exportMedia, setExportMedia] = useState<{
    url: string;
    file: File;
    type: "image" | "video";
  } | null>(null);

  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState<TacticalFilters>({
    showBallVector: true,
    showMovements: true,
    showWeaknessZones: true,
    showTeamLines: true,
    showPulse: true,
    showAttackArc: false,
  });

  const netX = V_WIDTH / 2;
  const offsetX = 10 + (V_WIDTH - 20) * 0.15;

  const analysis = useMemo(
    () => getTacticalAnalysis(items, filters, selectedScenarioKey, customTarget, t),
    [items, filters, selectedScenarioKey, customTarget, lang]
  );

  const allDrawingsToRender = currentDraft ? [...drawings, currentDraft] : drawings;

  const liveStateRef = useRef({
    items,
    drawings: allDrawingsToRender,
    showTactics,
    filters,
    analysis,
    studioTitle,
  });

  useEffect(() => {
    liveStateRef.current = {
      items,
      drawings: allDrawingsToRender,
      showTactics,
      filters,
      analysis,
      studioTitle,
    };
  }, [items, allDrawingsToRender, showTactics, filters, analysis, studioTitle]);

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

  // === VISUELLE UMRECHNUNG FÜR VERTIKAL-TOUCH ===
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
    const SVG_VIEW_W = 500; 
    const SVG_VIEW_H = 880; 

    const vX = ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X;
    const vY = ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y;

    return {
      x: V_WIDTH - vY,
      y: vX,
    };
  }, []);

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    if (activeMode === "studio" && studioTool !== "move") return;
    const pt = getPoint(e);
    setCustomTarget({ x: pt.x, y: pt.y });
    setSelectedScenarioKey("custom");
  };

  const handleSvgPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeMode === "studio" && studioTool !== "move") {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      setCurrentDraft({
        id: `draw-${Date.now()}`,
        type: studioTool,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
      });
      return;
    }

    if ("touches" in e) {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        const pt = getPoint(e);
        setCustomTarget({ x: pt.x, y: pt.y });
        setSelectedScenarioKey("custom");
      }
      lastTapRef.current = now;
    }
  };

  const onPointerDown = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    if (activeMode === "studio" && studioTool !== "move") {
      handleSvgPointerDown(e);
      return;
    }

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
  }, [items, getPoint, activeMode, studioTool]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (currentDraft) {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      setCurrentDraft((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
      return;
    }

    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault();
    const pt = getPoint(e);
    const { id, ox, oy, gapY, partnerId } = dragRef.current;

    setItems((prev) => {
      const itemToMove = prev.find(i => i.id === id);
      if (!itemToMove) return prev;

      let minX = 16;
      let maxX = V_WIDTH - 16;

      if (id === "ball" && filters.showAttackArc) {
        const newX = Math.max(16, Math.min(V_WIDTH - 16, pt.x - ox));
        const newY = Math.max(16, Math.min(V_HEIGHT - 16, pt.y - oy));
        const ballRatio = Math.max(0, Math.min(1, newY / V_HEIGHT));
        
        const isTeamAAttacking = newX > netX;

        const pTeamA = prev.filter(i => i.id.startsWith("a"));
        const pTeamB = prev.filter(i => i.id.startsWith("b"));
        const simBall = { x: newX, y: newY };
        const { targetY: simTargetY } = getTacticalTargetAndRec(simBall, pTeamA, pTeamB, filters, selectedScenarioKey, customTarget, t);
        const targetRatio = Math.max(0, Math.min(1, simTargetY / V_HEIGHT));

        return prev.map((item) => {
          if (item.id === "ball") return { ...item, x: newX, y: newY };
          
          if (item.isPlayer) {
            const isAttacker = isTeamAAttacking ? item.id.startsWith("a") : item.id.startsWith("b");
            
            if (isAttacker) {
              const targetYPos = (item.id === "a1" || item.id === "b1") ? 110 + (targetRatio - 0.5) * 160 : 270 + (targetRatio - 0.5) * 160;
              return { ...item, x: getArcX(targetYPos, item.id.startsWith("a")), y: targetYPos };
            } else {
              const targetX = isTeamAAttacking ? V_WIDTH - 80 : 80;
              const isPlayer1 = item.id === "a1" || item.id === "b1";
              const targetYPos = isPlayer1 ? 110 + (ballRatio - 0.5) * 160 : 270 + (ballRatio - 0.5) * 160;
              return { ...item, x: targetX, y: targetYPos };
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
  }, [getPoint, filters, selectedScenarioKey, customTarget, currentDraft, netX, t]);

  const onPointerUp = useCallback(() => {
    if (currentDraft) {
      const dist = Math.hypot(currentDraft.x2 - currentDraft.x1, currentDraft.y2 - currentDraft.y1);
      if (dist > 12 || currentDraft.type === "zone_circle") {
        const finalDraft =
          currentDraft.type === "zone_circle" && dist < 20
            ? { ...currentDraft, x2: currentDraft.x1 + 32, y2: currentDraft.y1 }
            : currentDraft;
        setDrawings((prev) => [...prev, finalDraft]);
      }
      setCurrentDraft(null);
    }
    dragRef.current = null;
    setActiveId(null);
  }, [currentDraft]);

  const reset = () => {
    setSelectedScenarioKey("initial");
    setCustomTarget(null);
    setItems(SCENARIOS.initial.items);
  };

  // =========================================================================
  // SYNCHRONER 30-FPS CANVAS-RENDERER
  // =========================================================================
  const drawBoardFrameSynchronously = useCallback((): HTMLCanvasElement | null => {
    let canvas = recCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 880;
      recCanvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const state = liveStateRef.current;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(60, 60);
    ctx.transform(0, -1, 1, 0, 0, 760);

    ctx.fillStyle = "#1034A6";
    ctx.fillRect(10, 10, V_WIDTH - 20, V_HEIGHT - 20);

    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 4;
    ctx.strokeRect(-30, -30, 820, 440);

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, V_WIDTH - 20, V_HEIGHT - 20);

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offsetX, 10);
    ctx.lineTo(offsetX, V_HEIGHT - 10);
    ctx.moveTo(V_WIDTH - offsetX, 10);
    ctx.lineTo(V_WIDTH - offsetX, V_HEIGHT - 10);
    ctx.moveTo(offsetX, V_HEIGHT / 2);
    ctx.lineTo(V_WIDTH - offsetX, V_HEIGHT / 2);
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.fillRect(netX - 2, 10, 4, V_HEIGHT - 20);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(netX, 10);
    ctx.lineTo(netX, V_HEIGHT - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawArrowhead = (x1: number, y1: number, x2: number, y2: number, color: string, size: number = 12) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    };

    if (state.showTactics) {
      if (state.filters.showWeaknessZones) {
        const ball = state.items.find((i) => i.id === "ball");
        if (ball) {
          const pair = ball.x <= netX
            ? [state.items.find((i) => i.id === "b1"), state.items.find((i) => i.id === "b2")]
            : [state.items.find((i) => i.id === "a1"), state.items.find((i) => i.id === "a2")];
          if (pair[0] && pair[1]) {
            const gap = Math.abs(pair[0].y - pair[1].y);
            const avgX = (pair[0].x + pair[1].x) / 2;
            const avgY = (pair[0].y + pair[1].y) / 2;
            if (gap > GAP_THRESHOLD + 2) {
              ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
              ctx.fillRect(avgX - 30, avgY - 80, 60, 160);
            }
          }
        }
      }

      if (state.filters.showTeamLines) {
        const teamA = state.items.filter((i) => i.id.startsWith("a"));
        if (teamA.length >= 2) {
          const distA = Math.hypot(teamA[0].x - teamA[1].x, teamA[0].y - teamA[1].y);
          ctx.strokeStyle = distA > WIDE_GAP_THRESHOLD ? "#e74c3c" : "#2ecc71";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(teamA[0].x, teamA[0].y);
          ctx.lineTo(teamA[1].x, teamA[1].y);
          ctx.stroke();
        }
        const teamB = state.items.filter((i) => i.id.startsWith("b"));
        if (teamB.length >= 2) {
          const distB = Math.hypot(teamB[0].x - teamB[1].x, teamB[0].y - teamB[1].y);
          ctx.strokeStyle = distB > WIDE_GAP_THRESHOLD ? "#e74c3c" : "#2ecc71";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(teamB[0].x, teamB[0].y);
          ctx.lineTo(teamB[1].x, teamB[1].y);
          ctx.stroke();
        }
      }

      if (state.analysis && state.filters.showBallVector) {
        const ball = state.items.find((i) => i.id === "ball");
        if (ball) {
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 4;
          ctx.setLineDash([6, 2]);
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(state.analysis.targetX, state.analysis.targetY);
          ctx.stroke();
          ctx.setLineDash([]);
          drawArrowhead(ball.x, ball.y, state.analysis.targetX, state.analysis.targetY, "#facc15", 13);
        }
      }

      if (state.analysis && state.filters.showMovements) {
        state.items.filter((item) => item.isPlayer).forEach((player) => {
          const move = state.analysis?.movements?.[player.id];
          if (!move || Math.hypot(move.tx - player.x, move.ty - player.y) < 12) return;
          const angle = Math.atan2(move.ty - player.y, move.tx - player.x);
          const startX = player.x + Math.cos(angle) * 17;
          const startY = player.y + Math.sin(angle) * 17;
          ctx.strokeStyle = "#5cd6ff";
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(move.tx, move.ty);
          ctx.stroke();
          ctx.setLineDash([]);
          drawArrowhead(startX, startY, move.tx, move.ty, "#5cd6ff", 11);
        });
      }
    }

    state.drawings.forEach((d) => {
      if (d.type === "zone_circle") {
        const radius = Math.max(18, Math.hypot(d.x2 - d.x1, d.y2 - d.y1));
        ctx.fillStyle = "rgba(236, 72, 153, 0.22)";
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(d.x1, d.y1, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      const isRun = d.type === "arrow_run";
      const color = isRun ? "#00f0ff" : "#fbbf24";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.setLineDash(isRun ? [] : [8, 5]);
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowhead(d.x1, d.y1, d.x2, d.y2, color, 14);
    });

    state.items.forEach((item) => {
      const r = item.isPlayer ? 16 : 10;
      ctx.fillStyle = item.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = item.color === "#f1c40f" ? "#000000" : "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();

    ctx.fillStyle = "rgba(4, 9, 20, 0.94)";
    ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 48);
    ctx.lineTo(canvas.width, canvas.height - 48);
    ctx.stroke();

    ctx.fillStyle = "#22d3ee";
    ctx.font = "900 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("TACPADEL • TACTICAL STUDIO", 16, canvas.height - 19);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText((state.studioTitle || t("tb_watermark_fallback")).toUpperCase(), canvas.width - 16, canvas.height - 19);

    return canvas;
  }, [netX, offsetX, t]);

  // 📸 1. FOTO SNAPSHOT ERSTELLEN
  const handleTakeSnapshot = () => {
    const canvas = drawBoardFrameSynchronously();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `tacpadel-tactic-${Date.now()}.png`, {
        type: "image/png",
        lastModified: Date.now(),
      });
      const url = URL.createObjectURL(blob);
      setExportMedia({ url, file, type: "image" });
    }, "image/png");
  };

  // 🔴 2. VIDEO-AUFNAHME (SHORTCLIP) MIT ECHTEN 30 FPS STARTEN / STOPPEN
  const startVideoRecording = () => {
    const canvas = drawBoardFrameSynchronously();
    if (!canvas || typeof MediaRecorder === "undefined") {
      alert(t("tb_alert_no_video"));
      return;
    }

    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
    if (!stream) {
      alert(t("tb_alert_no_stream"));
      return;
    }

    const mimeCandidates = [
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp8",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    const supportedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

    recChunksRef.current = [];
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: 1500000,
    };
    if (supportedMime) options.mimeType = supportedMime;

    const recorder = new MediaRecorder(stream, options);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const rawMime = recorder.mimeType || supportedMime || "video/webm";
      const isMp4 = rawMime.toLowerCase().includes("mp4");
      const cleanMime = isMp4 ? "video/mp4" : "video/webm";
      const ext = isMp4 ? "mp4" : "webm";

      const blob = new Blob(recChunksRef.current, { type: cleanMime });
      const file = new File([blob], `tacpadel-clip-${Date.now()}.${ext}`, {
        type: cleanMime,
        lastModified: Date.now(),
      });
      const url = URL.createObjectURL(blob);
      setExportMedia({ url, file, type: "video" });
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setRecSeconds(0);

    recFrameIntervalRef.current = setInterval(() => {
      drawBoardFrameSynchronously();
    }, 33);

    recTimerRef.current = setInterval(() => {
      setRecSeconds((s) => s + 1);
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (recFrameIntervalRef.current) clearInterval(recFrameIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (recFrameIntervalRef.current) clearInterval(recFrameIntervalRef.current);
    };
  }, []);

  // 📲 3. ROBUSTES TEILEN FÜR FOTOS & VIDEOS
  const handleNativeShare = async () => {
    if (!exportMedia || isSharing) return;
    setIsSharing(true);

    const shareText = `${t("tb_share_text_1")} "${studioTitle}" ${t("tb_share_text_2")}`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        const canShareFile = !navigator.canShare || navigator.canShare({ files: [exportMedia.file] });

        if (canShareFile) {
          try {
            if (exportMedia.type === "video") {
              await navigator.share({
                files: [exportMedia.file],
                title: studioTitle || "TacPadel",
              });
            } else {
              await navigator.share({
                files: [exportMedia.file],
                title: studioTitle || "TacPadel",
                text: shareText,
              });
            }
            setIsSharing(false);
            return;
          } catch (innerErr: any) {
            if (innerErr?.name === "AbortError") {
              setIsSharing(false);
              return;
            }
            try {
              await navigator.share({ files: [exportMedia.file] });
              setIsSharing(false);
              return;
            } catch (retryErr: any) {
              if (retryErr?.name === "AbortError") {
                setIsSharing(false);
                return;
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setIsSharing(false);
        return;
      }
    }

    handleDownloadMedia();
    setIsSharing(false);
    alert(t("tb_alert_video_saved"));
  };

  const handleDownloadMedia = () => {
    if (!exportMedia) return;
    const a = document.createElement("a");
    a.href = exportMedia.url;
    a.download = exportMedia.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full flex-1 py-4 overflow-hidden">
      
      {/* ================================================================= */}
      {/* EXPORT & SHARE VORSCHAU-MODAL (Für aufgenommene Fotos & Videos)   */}
      {/* ================================================================= */}
      {exportMedia && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#050b18] border border-cyan-500/50 p-5 sm:p-6 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] max-w-md w-full flex flex-col items-center gap-4 relative overflow-hidden">
            <div className="flex justify-between items-center w-full border-b border-slate-800 pb-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 block">
                  {t("tb_export_badge")}
                </span>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {exportMedia.type === "video" ? t("tb_export_video_title") : t("tb_export_img_title")}
                </h3>
              </div>
              <button
                onClick={() => setExportMedia(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="w-full max-h-[52vh] bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {exportMedia.type === "video" ? (
                <video
                  src={exportMedia.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[50vh] w-auto object-contain"
                />
              ) : (
                <img
                  src={exportMedia.url}
                  alt="Taktik Snapshot"
                  className="max-h-[50vh] w-auto object-contain"
                />
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                onClick={handleNativeShare}
                disabled={isSharing}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
              >
                <span>{isSharing ? t("tb_export_sharing") : t("tb_export_share_btn")}</span>
              </button>
              <button
                onClick={handleDownloadMedia}
                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-700 transition-all"
              >
                {t("tb_export_save_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DYNAMISCHER TOGGLE-SCHALTER (2D | [STUDIO PRO] | 3D)              */}
      {/* ================================================================= */}
      <div className="w-full max-w-5xl flex flex-col items-center mb-1 px-3">
        <div
          className={`bg-[#050b18] p-1.5 rounded-full shadow-lg border border-slate-800 grid ${
            isProUser ? "grid-cols-3 max-w-lg" : "grid-cols-2 max-w-md"
          } relative w-full`}
        >
          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              setActiveMode("tactics");
            }}
            className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all ${
              activeMode === "tactics"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("tb_mode_2d")}
          </button>

          {/* NUR SICHTBAR FÜR PRO-USER & FREIGESCHALTETE TESTER */}
          {isProUser && (
            <button
              onClick={() => setActiveMode("studio")}
              className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all flex items-center justify-center gap-1 ${
                activeMode === "studio"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                  : "text-pink-400 hover:text-pink-300"
              }`}
            >
              <span>{t("tb_mode_studio")}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              setActiveMode("3d");
            }}
            className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all ${
              activeMode === "3d"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("tb_mode_3d")}
          </button>
        </div>
      </div>

      {/* --- RENDERN BASIEREND AUF DEM SCHALTER --- */}
      {activeMode === "3d" ? (
        <TrajectoryView3D />
      ) : (
        <>
          {/* ============================================================= */}
          {/* TACTICAL STUDIO (PRO) WERKZEUGLEISTE                          */}
          {/* ============================================================= */}
          {activeMode === "studio" && isProUser && (
            <div className="w-full max-w-[600px] px-3 flex flex-col gap-2.5 animate-in fade-in">
              <div className="bg-[#050b18] border border-pink-500/40 rounded-2xl p-3 sm:p-4 shadow-[0_0_25px_rgba(236,72,153,0.12)] flex flex-col gap-3">
                
                {/* Zeile 1: Taktik-Titel & Aufnahme-Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 shrink-0">
                      🎬 STUDIO
                    </span>
                    <input
                      type="text"
                      value={studioTitle}
                      onChange={(e) => setStudioTitle(e.target.value)}
                      placeholder={t("tb_studio_title_placeholder")}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-pink-500 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleTakeSnapshot}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      {t("tb_studio_photo_btn")}
                    </button>

                    {!isRecording ? (
                      <button
                        onClick={startVideoRecording}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>{t("tb_studio_rec_btn")}</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopVideoRecording}
                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)] flex items-center justify-center gap-1.5"
                      >
                        <span>{t("tb_studio_stop_btn")} ({recSeconds}s)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Zeile 2: Zeichen-Werkzeuge */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setStudioTool("move")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "move"
                        ? "bg-white text-black border-white shadow-md"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {t("tb_tool_move")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_run")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_run"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-cyan-300"
                    }`}
                  >
                    {t("tb_tool_run")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_ball")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_ball"
                        ? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300"
                    }`}
                  >
                    {t("tb_tool_ball")}
                  </button>
                  <button
                    onClick={() => setStudioTool("zone_circle")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "zone_circle"
                        ? "bg-pink-500/20 text-pink-300 border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-pink-300"
                    }`}
                  >
                    {t("tb_tool_zone")}
                  </button>
                  <button
                    onClick={() => setDrawings((prev) => prev.slice(0, -1))}
                    disabled={drawings.length === 0}
                    className="col-span-2 sm:col-span-1 py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
                  >
                    {t("tb_tool_undo")}
                  </button>
                  <button
                    onClick={() => setDrawings([])}
                    disabled={drawings.length === 0}
                    className="col-span-2 sm:col-span-1 py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-40"
                  >
                    {t("tb_tool_clear")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- FILTER PANEL --- */}
          {showTactics && (
            <div className="w-full max-w-5xl px-3 flex flex-col gap-3">
              <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-widest font-bold block text-gray-400 mb-0.5">{t("tb_preset_badge")}</span>
                  <h4 className="text-sm font-bold text-gray-800">{t("tb_preset_title")}</h4>
                </div>
                <div className="relative w-full sm:w-72">
                  <select
                    value={selectedScenarioKey}
                    onChange={handleScenarioChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8 shadow-inner"
                  >
                    {Object.entries(SCENARIOS).map(([key, value]) => (
                      <option key={key} value={key}>{t(value.nameKey)}</option>
                    ))}
                    <option value="custom" disabled>{t("tb_preset_custom")}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">▼</div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-md w-full">
                <span className="text-xs uppercase tracking-widest font-bold block mb-3 text-gray-500">{t("tb_filter_title")}</span>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
                  <label className="flex items-center gap-2 sm:gap-3 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg border border-indigo-200 cursor-pointer select-none transition-all shadow-sm">
                    <input type="checkbox" checked={filters.showAttackArc} onChange={() => toggleFilter("showAttackArc")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-indigo-500 inline-block" />
                      <span className="font-bold text-indigo-900">{t("tb_filter_arc")}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showBallVector} onChange={() => toggleFilter("showBallVector")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-yellow-400 inline-block" />
                      <span className="font-medium text-gray-800">{t("tb_filter_vector")}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showMovements} onChange={() => toggleFilter("showMovements")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-[#5cd6ff] inline-block" />
                      <span className="font-medium text-gray-800">{t("tb_filter_moves")}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showWeaknessZones} onChange={() => toggleFilter("showWeaknessZones")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-red-400/50 border border-red-500 rounded inline-block" />
                      <span className="font-medium text-gray-800">{t("tb_filter_weakness")}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showTeamLines} onChange={() => toggleFilter("showTeamLines")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                      <span className="font-medium text-gray-800">{t("tb_filter_teamlines")}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 sm:gap-3 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer select-none transition-all">
                    <input type="checkbox" checked={filters.showPulse} onChange={() => toggleFilter("showPulse")} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-gray-400 bg-white inline-block animate-pulse" />
                      <span className="font-medium text-gray-800">{t("tb_filter_pulse")}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div ref={containerRef} className="w-full max-w-[600px] mx-auto px-3 flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <svg
              ref={svgRef}
              viewBox="-60 -60 500 880"
              className={`rounded-xl shadow-2xl border-4 w-full h-auto max-h-[75vh] touch-none select-none overflow-hidden ${
                isRecording
                  ? "border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)]"
                  : activeMode === "studio"
                    ? "border-pink-500/60"
                    : "border-[#111]"
              }`}
              style={{
                background: "#050505",
                display: "block",
                touchAction: "none",
                cursor: activeMode === "studio" && studioTool !== "move" ? "crosshair" : "default",
              }}
              onMouseDown={handleSvgPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={handleSvgPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
              onTouchCancel={onPointerUp}
              onDoubleClick={handleSvgDoubleClick}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="yellow" />
                </marker>
                <marker id="moveArrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#5cd6ff" />
                </marker>
                <marker id="studioRunArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#00f0ff" />
                </marker>
                <marker id="studioBallArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
                </marker>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="-2" dy="0" stdDeviation="2" floodColor="rgba(0,0,0,0.5)" />
                </filter>
                <filter id="activeShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="-8" dy="0" stdDeviation="6" floodColor="rgba(0,0,0,0.6)" />
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

              <g transform="matrix(0 -1 1 0 0 760)">
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

                <text x={netX} y={V_HEIGHT / 2} transform={`rotate(90 ${netX} ${V_HEIGHT / 2})`} textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity={0.25} fontSize={16} fontWeight="bold" letterSpacing="4">{t("tb_court_net")}</text>
                <text x={offsetX / 2 + 5} y={V_HEIGHT - 18} transform={`rotate(90 ${offsetX / 2 + 5} ${V_HEIGHT - 18})`} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">{t("tb_court_team_a")}</text>
                <text x={V_WIDTH - offsetX / 2 - 5} y={V_HEIGHT - 18} transform={`rotate(90 ${V_WIDTH - offsetX / 2 - 5} ${V_HEIGHT - 18})`} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">{t("tb_court_team_b")}</text>

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
                            {gap > GAP_THRESHOLD + 2 && <rect x={avgX - 30} y={avgY - 80} width={60} height={160} fill="red" opacity="0.35" rx="8" />}
                            {avgX < netX + DEEP_DEF_THRESHOLD && <rect x={netX + 10} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />}
                          </>
                        );
                      } else {
                        const a1 = items.find((i) => i.id === "a1"); const a2 = items.find((i) => i.id === "a2"); if (!a1 || !a2) return null;
                        const gap = Math.abs(a1.y - a2.y); const avgX = (a1.x + a2.x) / 2; const avgY = (a1.y + a2.y) / 2;
                        return (
                          <>
                            {gap > GAP_THRESHOLD + 2 && <rect x={avgX - 30} y={avgY - 80} width={60} height={160} fill="red" opacity="0.35" rx="8" />}
                            {avgX > netX - DEEP_DEF_THRESHOLD && <rect x={netX - 60} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />}
                          </>
                        );
                      }
                    })()}

                    {filters.showTeamLines && (() => {
                      const teamA = items.filter((i) => i.id.startsWith("a")); if (teamA.length < 2) return null;
                      const distA = Math.hypot(teamA[0].x - teamA[1].x, teamA[0].y - teamA[1].y);
                      const isGapTooWide = distA > WIDE_GAP_THRESHOLD;
                      return <line x1={teamA[0].x} y1={teamA[0].y} x2={teamA[1].x} y2={teamA[1].y} stroke={isGapTooWide ? "#e74c3c" : "#2ecc71"} strokeWidth={4} />;
                    })()}

                    {filters.showTeamLines && (() => {
                      const teamB = items.filter((i) => i.id.startsWith("b")); if (teamB.length < 2) return null;
                      const distB = Math.hypot(teamB[0].x - teamB[1].x, teamB[0].y - teamB[1].y);
                      const isGapTooWide = distB > WIDE_GAP_THRESHOLD;
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

                {/* ========================================================= */}
                {/* EINGEZEICHNETE TACTICAL STUDIO PFEILE & ZONEN             */}
                {/* ========================================================= */}
                {allDrawingsToRender.map((d) => {
                  if (d.type === "zone_circle") {
                    const radius = Math.max(18, Math.hypot(d.x2 - d.x1, d.y2 - d.y1));
                    return (
                      <g key={d.id} style={{ pointerEvents: "none" }}>
                        <circle
                          cx={d.x1}
                          cy={d.y1}
                          r={radius}
                          fill="rgba(236, 72, 153, 0.22)"
                          stroke="#ec4899"
                          strokeWidth="3"
                          strokeDasharray="6 4"
                        />
                        <circle cx={d.x1} cy={d.y1} r="4" fill="#ec4899" />
                      </g>
                    );
                  }

                  const isRun = d.type === "arrow_run";
                  return (
                    <line
                      key={d.id}
                      x1={d.x1}
                      y1={d.y1}
                      x2={d.x2}
                      y2={d.y2}
                      stroke={isRun ? "#00f0ff" : "#fbbf24"}
                      strokeWidth="4"
                      strokeDasharray={isRun ? "none" : "8 5"}
                      markerEnd={isRun ? "url(#studioRunArrow)" : "url(#studioBallArrow)"}
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}

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
                      <text x={item.x} y={item.y} transform={`rotate(90 ${item.x} ${item.y})`} textAnchor="middle" dominantBaseline="central" fill={item.color === "#f1c40f" ? "black" : "white"} fontSize={item.isPlayer ? 11 : 12} fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>{item.label}</text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {showTactics && analysis && (
              <div className={`mt-4 p-4 sm:p-6 rounded-2xl text-white shadow-2xl border-2 border-white/20 w-full max-w-[600px] transition-all duration-500 ${analysis.color}`}>
                <h3 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2"><span className="text-xl sm:text-2xl">📋</span> {analysis.title}</h3>
                <p className="text-sm sm:text-lg leading-relaxed font-medium opacity-90">{analysis.body}</p>
                <div className="mt-4 bg-white/20 p-3 sm:p-4 rounded-xl border border-white/30 backdrop-blur-sm">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold block mb-1">{items.find((i) => i.id === "ball")!.x < netX ? t("tb_rec_header_attack") : t("tb_rec_header_defense")}</span>
                  <span className="text-lg sm:text-2xl font-black">{analysis.recommendation}</span>
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/20">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold block mb-3 text-white/80">{t("tb_legend_title")}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-xs bg-black/20 p-3 rounded-xl border border-white/10">
                    {filters.showAttackArc && (<div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-indigo-300 border-dashed inline-block" /><span><strong className="text-indigo-200">{t("tb_leg_arc_b")}</strong> {t("tb_leg_arc_t")}</span></div>)}
                    {filters.showMovements && (<div className="flex items-center gap-2"><span className="w-5 h-0.5 border-t-2 border-dashed border-[#5cd6ff] inline-block" /><span><strong className="text-[#5cd6ff]">{t("tb_leg_move_b")}</strong> {t("tb_leg_move_t")}</span></div>)}
                    {filters.showPulse && (<div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white inline-block animate-pulse bg-white/20" /><span><strong className="text-white">{t("tb_leg_pulse_b")}</strong> {t("tb_leg_pulse_t")}</span></div>)}
                    {filters.showBallVector && (<><div className="flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full border border-yellow-400 border-dashed text-[9px] font-bold text-yellow-300">◎</span><span><strong className="text-yellow-300">{t("tb_leg_target_b")}</strong> {t("tb_leg_target_t")}</span></div><div className="flex items-center gap-2"><span className="w-5 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" /><span><strong className="text-yellow-300">{t("tb_leg_vec_b")}</strong> {t("tb_leg_vec_t")}</span></div></>)}
                    {filters.showWeaknessZones && (<><div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500/30 rounded inline-block border border-red-500/40" /><span><strong className="text-red-300">{t("tb_leg_red_b")}</strong> {t("tb_leg_red_t")}</span></div><div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-500/30 rounded inline-block border border-orange-500/40" /><span><strong className="text-orange-300">{t("tb_leg_orange_b")}</strong> {t("tb_leg_orange_t")}</span></div></>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-3 mb-6 w-full">
            <button onClick={reset} className="px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md">{t("tb_btn_reset_pos")}</button>
            <button onClick={() => setShowTactics(!showTactics)} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all shadow-md ${showTactics ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>{showTactics ? t("tb_btn_analysis_off") : t("tb_btn_analysis_on")}</button>
          </div>
        </>
      )}
    </div>
  );
}
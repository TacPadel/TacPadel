import React, { useRef, useState, useCallback, useMemo } from "react";
import ScenarioCourt4D from "./ScenarioCourt4D";
import { useTranslation } from "../lib/i18n";
import { V_WIDTH, V_HEIGHT } from "../lib/tacticsMath";
import {
  DEFENSE_PRESETS,
  DefenseShotType,
  calculateGlassDefenseTrajectory,
  evaluatePlayerDefensePosition,
} from "../lib/glassPhysics";

export default function TrajectoryView3D() {
  const { lang, t } = useTranslation();

  const [labMode, setLabMode] = useState<"attack" | "defense">("attack");

  // --- ANGRIFFS-MODUS STATES ---
  const [shotType, setShotType] = useState("BAJADA");
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [playerPos, setPlayerPos] = useState({ x: 140, y: 260 });
  const [targetPos, setTargetPos] = useState({ x: 620, y: 120 });

  // --- SCHEIBENSPIEL-MODUS (VERTEIDIGUNG) STATES ---
  const [defShotType, setDefShotType] = useState<DefenseShotType>("FLAT");
  const [defOppPos, setDefOppPos] = useState(DEFENSE_PRESETS[2].oppPos);
  const [defBouncePos, setDefBouncePos] = useState(DEFENSE_PRESETS[2].bouncePos);
  const [defPlayerPos, setDefPlayerPos] = useState(DEFENSE_PRESETS[2].playerPos);
  const [defActivePreset, setDefActivePreset] = useState<string>(DEFENSE_PRESETS[2].id);
  const [defSpeed, setDefSpeed] = useState<0.4 | 1>(0.4);
  const [defQuizMode, setDefQuizMode] = useState<boolean>(false);
  const [defIsPlaying, setDefIsPlaying] = useState<boolean>(false);
  const [defHasFinished, setDefHasFinished] = useState<boolean>(false);
  const [defReplayKey, setDefReplayKey] = useState<number>(0);

  const [activeDrag, setActiveDrag] = useState<"player" | "target" | "opp" | null>(null);

  const sniperSvgRef = useRef<SVGSVGElement>(null);
  const NET_X = V_WIDTH / 2;

  const getMetersFromXY = (svgX: number, svgY: number) => {
    const z = 10 - (svgX / V_WIDTH) * 20;
    const x = (svgY / V_HEIGHT) * 10 - 5;
    return {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };
  };

  const getXYFromMeters = (meterX: number, meterZ: number) => ({
    x: ((10 - meterZ) / 20) * V_WIDTH,
    y: ((meterX + 5) / 10) * V_HEIGHT,
  });

  const playerCoords = getMetersFromXY(playerPos.x, playerPos.y);
  const targetCoords = getMetersFromXY(targetPos.x, targetPos.y);

  const defOppCoords = getMetersFromXY(defOppPos.x, defOppPos.y);
  const defBounceCoords = getMetersFromXY(defBouncePos.x, defBouncePos.y);
  const defPlayerCoords = getMetersFromXY(defPlayerPos.x, defPlayerPos.y);

  // Live-Berechnung der 3D-Scheibenphysik
  const defenseSim = useMemo(
    () => calculateGlassDefenseTrajectory(defOppCoords, defBounceCoords, defShotType, lang),
    [defOppCoords.x, defOppCoords.z, defBounceCoords.x, defBounceCoords.z, defShotType, lang]
  );

  const defenseEval = useMemo(
    () => evaluatePlayerDefensePosition(defPlayerCoords, defenseSim, lang),
    [defPlayerCoords.x, defPlayerCoords.z, defenseSim, lang]
  );

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = sniperSvgRef.current;
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

  const onPointerDown = useCallback(
    (id: "player" | "target" | "opp", e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      setActiveDrag(id);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!activeDrag) return;
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);

      if (labMode === "attack") {
        if (activeDrag === "player") {
          setPlayerPos({
            x: Math.max(16, Math.min(NET_X - 16, pt.x)),
            y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)),
          });
        } else if (activeDrag === "target") {
          setTargetPos({
            x: Math.max(NET_X + 16, Math.min(V_WIDTH - 16, pt.x)),
            y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)),
          });
        }
      } else {
        setDefActivePreset("");
        if (activeDrag === "opp") {
          setDefOppPos({
            x: Math.max(NET_X + 20, Math.min(V_WIDTH - 18, pt.x)),
            y: Math.max(18, Math.min(V_HEIGHT - 18, pt.y)),
          });
        } else if (activeDrag === "target") {
          setDefBouncePos({
            x: Math.max(20, Math.min(NET_X - 24, pt.x)),
            y: Math.max(18, Math.min(V_HEIGHT - 18, pt.y)),
          });
        } else if (activeDrag === "player") {
          setDefPlayerPos({
            x: Math.max(22, Math.min(NET_X - 20, pt.x)),
            y: Math.max(18, Math.min(V_HEIGHT - 18, pt.y)),
          });
        }
      }
    },
    [activeDrag, getPoint, NET_X, labMode]
  );

  const onPointerUp = useCallback(() => setActiveDrag(null), []);

  const handleSimulateAttack = () => {
    setIsSimulating(true);
    setTimeout(() => setHasSubmitted(true), 1500);
  };

  const handleBackAttack = () => {
    setHasSubmitted(false);
    setIsSimulating(false);
  };

  const handleApplyDefensePreset = (presetId: string) => {
    const preset = DEFENSE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDefActivePreset(preset.id);
    setDefShotType(preset.shotType);
    setDefOppPos(preset.oppPos);
    setDefBouncePos(preset.bouncePos);
    setDefPlayerPos(preset.playerPos);
  };

  const handleStartDefenseSim = (overrideShot?: DefenseShotType) => {
    if (overrideShot) setDefShotType(overrideShot);
    setDefHasFinished(false);
    setDefIsPlaying(true);
    setDefReplayKey((k) => k + 1);
  };

  const handleBackToDefensePlan = () => {
    setDefIsPlaying(false);
    setDefHasFinished(false);
  };

  const isDefenseSimView = labMode === "defense" && (defIsPlaying || defHasFinished);
  const showHudPanel = labMode === "attack" ? !isSimulating : !isDefenseSimView;

  // 2D-Preview-Polylinie für den Scheiben-Rebound im Mini-Radar
  const defenseRadarPath = useMemo(() => {
    if (labMode !== "defense" || defQuizMode) return "";
    const pts: string[] = [];
    const opp2d = getXYFromMeters(defOppCoords.x, defOppCoords.z);
    const b2d = getXYFromMeters(defBounceCoords.x, defBounceCoords.z);
    pts.push(`${opp2d.x},${opp2d.y}`, `${b2d.x},${b2d.y}`);
    defenseSim.glassHits.forEach((hit) => {
      const h2d = getXYFromMeters(hit.point.x, hit.point.z);
      pts.push(`${h2d.x},${h2d.y}`);
    });
    const sw2d = getXYFromMeters(defenseSim.sweetspot.x, defenseSim.sweetspot.z);
    pts.push(`${sw2d.x},${sw2d.y}`);
    return pts.join(" ");
  }, [labMode, defQuizMode, defOppCoords.x, defOppCoords.z, defBounceCoords.x, defBounceCoords.z, defenseSim]);

  const defShotOptions: { id: DefenseShotType; label: string }[] = [
    {
      id: "SLICE",
      label: lang === "en" ? "🔪 Slice (drops)" : lang === "es" ? "🔪 Cortado (cae)" : "🔪 Slice (fällt ab)",
    },
    {
      id: "FLAT",
      label: lang === "en" ? "🎾 Flat (neutral)" : lang === "es" ? "🎾 Plano (neutro)" : "🎾 Glatt (neutral)",
    },
    {
      id: "TOPSPIN",
      label: lang === "en" ? "🌀 Topspin (kicks)" : lang === "es" ? "🌀 Liftado (sale)" : "🌀 Topspin (springt raus)",
    },
    {
      id: "LOB",
      label: lang === "en" ? "🎈 Deep Lob" : lang === "es" ? "🎈 Globo" : "🎈 Tiefer Lob",
    },
  ];

  return (
    <div className="w-full max-w-5xl flex-1 flex flex-col h-full px-2 mb-4">
      <div className="w-full flex-1 h-full min-h-[480px] bg-[#02040a] rounded-xl shadow-2xl border-4 border-[#111] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-auto">
          <ScenarioCourt4D
            level="Schlagrichtung"
            isPreparingShot={labMode === "attack" && isSimulating && !hasSubmitted}
            positions={{
              you: `EXACT_${playerCoords.x}_${playerCoords.z}`,
              partner: "EXACT_1000_1000",
              opp1: "EXACT_1000_1000",
              opp2: "EXACT_1000_1000",
              ball: { side: "left", zone: `EXACT_${playerCoords.x}_${playerCoords.z}`, type: shotType },
            }}
            selectedZone={`EXACT_${targetCoords.x}_${targetCoords.z}`}
            exactCoords={labMode === "attack" ? { you: playerCoords, target: targetCoords } : undefined}
            defenseLab={
              labMode === "defense"
                ? {
                    active: true,
                    isPlaying: defIsPlaying,
                    hasFinished: defHasFinished,
                    playbackSpeed: defSpeed,
                    replayKey: defReplayKey,
                    showPreviewGuide: !defQuizMode,
                    shotType: defShotType,
                    oppPos: defOppCoords,
                    playerPos: defPlayerCoords,
                    simulation: defenseSim,
                    onFinished: () => {
                      setDefIsPlaying(false);
                      setDefHasFinished(true);
                    },
                  }
                : undefined
            }
            hidePlayerLabels={true}
            hasSubmitted={labMode === "attack" && hasSubmitted}
            bestZones={[`EXACT_${targetCoords.x}_${targetCoords.z}`]}
            onZoneClick={() => {}}
            activeChar="you"
            hitterId="you"
            playIntro={false}
            turnResult="perfect"
          />
        </div>

        {/* PLANUNGS-HUD (ANGRIFF ODER SCHEIBENSPIEL) */}
        {showHudPanel && (
          <div className="absolute top-2 left-2 z-10 w-[calc(100%-16px)] max-w-[310px] sm:max-w-none sm:w-80 bg-black/85 sm:bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex flex-col gap-2 pointer-events-auto max-h-[calc(100%-16px)] overflow-y-auto">
            {/* Modus-Umschalter: Angriff vs. Scheibenspiel */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setDefIsPlaying(false);
                  setDefHasFinished(false);
                  setLabMode("attack");
                }}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  labMode === "attack"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {lang === "en" ? "⚔️ Attack" : lang === "es" ? "⚔️ Ataque" : "⚔️ Angriff"}
              </button>
              <button
                onClick={() => {
                  setHasSubmitted(false);
                  setIsSimulating(false);
                  setLabMode("defense");
                }}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  labMode === "defense"
                    ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-md"
                    : "text-cyan-300 hover:text-white"
                }`}
              >
                {lang === "en" ? "🛡️ Glass Lab" : lang === "es" ? "🛡️ Cristales" : "🛡️ Scheibenspiel"}
              </button>
            </div>

            {labMode === "attack" ? (
              <div>
                <span className="text-[#5cd6ff] text-[9px] font-black uppercase tracking-widest block">
                  {t("tb_radar_badge")}
                </span>
                <h3 className="text-white text-xs sm:text-sm font-bold">{t("tb_radar_title")}</h3>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 text-[9px] font-black uppercase tracking-widest">
                    {lang === "en"
                      ? "3D GLASS DEFENSE LAB"
                      : lang === "es"
                      ? "LABORATORIO 3D DE CRISTALES"
                      : "3D SCHEIBENSPIEL-LABOR"}
                  </span>
                  <button
                    onClick={() => setDefQuizMode((q) => !q)}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border transition-all ${
                      defQuizMode
                        ? "bg-amber-500/25 border-amber-400 text-amber-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {lang === "en" ? "🎯 Test" : lang === "es" ? "🎯 Test" : "🎯 Test"}
                  </button>
                </div>

                {/* 4 Scheiben-Presets */}
                <div className="grid grid-cols-2 gap-1">
                  {DEFENSE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyDefensePreset(preset.id)}
                      className={`py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all truncate ${
                        defActivePreset === preset.id
                          ? "bg-purple-600/30 border-purple-400 text-purple-200"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {preset.labels[lang] || preset.labels.de}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2D MINI-RADAR */}
            <div className="w-full bg-[#050505] rounded-xl border border-white/10 shadow-inner overflow-hidden flex justify-center py-1.5">
              <svg
                ref={sniperSvgRef}
                viewBox="-40 -40 460 840"
                className="w-auto h-[170px] sm:h-[205px] touch-none select-none block cursor-crosshair"
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onTouchCancel={onPointerUp}
              >
                <g transform="matrix(0 -1 1 0 0 760)">
                  <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
                  <line x1={NET_X} y1={10} x2={NET_X} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="6 4" />
                  <line x1={NET_X - 6.95 * 38} y1={10} x2={NET_X - 6.95 * 38} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X + 6.95 * 38} y1={10} x2={NET_X + 6.95 * 38} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X - 6.95 * 38} y1={V_HEIGHT / 2} x2={NET_X} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X} y1={V_HEIGHT / 2} x2={NET_X + 6.95 * 38} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />

                  {labMode === "attack" ? (
                    <>
                      <line x1={playerPos.x} y1={playerPos.y} x2={targetPos.x} y2={targetPos.y} stroke="#f1c40f" strokeWidth="6" strokeDasharray="8 6" opacity={0.8} />
                      <g style={{ cursor: activeDrag === "target" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("target", e)} onTouchStart={(e) => onPointerDown("target", e)}>
                        <circle cx={targetPos.x} cy={targetPos.y} r={40} fill="transparent" />
                        <circle cx={targetPos.x} cy={targetPos.y} r="16" fill="none" stroke="#f1c40f" strokeWidth="3" className="animate-pulse" />
                        <circle cx={targetPos.x} cy={targetPos.y} r="6" fill="#f1c40f" />
                      </g>
                      <g style={{ cursor: activeDrag === "player" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("player", e)} onTouchStart={(e) => onPointerDown("player", e)}>
                        <circle cx={playerPos.x} cy={playerPos.y} r={40} fill="transparent" />
                        <circle cx={playerPos.x} cy={playerPos.y} r={activeDrag === "player" ? 22 : 18} fill="#e74c3c" stroke="#ffffff" strokeWidth="3" />
                        <text x={playerPos.x} y={playerPos.y} transform={`rotate(90 ${playerPos.x} ${playerPos.y})`} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {t("tb_radar_you")}
                        </text>
                      </g>
                    </>
                  ) : (
                    <>
                      {/* Glas-Highlight auf deiner Seite (Rückscheibe + hintere Seitenscheiben) */}
                      <polyline
                        points={`160,10 10,10 10,${V_HEIGHT - 10} 160,${V_HEIGHT - 10}`}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth={5}
                        opacity={0.75}
                      />

                      {/* Live-Rebound-Vorschau (im Quiz-Modus versteckt) */}
                      {defenseRadarPath && (
                        <polyline
                          points={defenseRadarPath}
                          fill="none"
                          stroke="#c084fc"
                          strokeWidth="5"
                          strokeDasharray="8 5"
                          opacity={0.85}
                        />
                      )}

                      {/* Gegner (Gelb) */}
                      <g style={{ cursor: activeDrag === "opp" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("opp", e)} onTouchStart={(e) => onPointerDown("opp", e)}>
                        <circle cx={defOppPos.x} cy={defOppPos.y} r={42} fill="transparent" />
                        <circle cx={defOppPos.x} cy={defOppPos.y} r={activeDrag === "opp" ? 22 : 18} fill="#facc15" stroke="#ffffff" strokeWidth="3" />
                        <text x={defOppPos.x} y={defOppPos.y} transform={`rotate(90 ${defOppPos.x} ${defOppPos.y})`} textAnchor="middle" dominantBaseline="central" fill="black" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          B1
                        </text>
                      </g>

                      {/* 1. Boden-Aufprallpunkt (Lila/Gelb) */}
                      <g style={{ cursor: activeDrag === "target" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("target", e)} onTouchStart={(e) => onPointerDown("target", e)}>
                        <circle cx={defBouncePos.x} cy={defBouncePos.y} r={40} fill="transparent" />
                        <circle cx={defBouncePos.x} cy={defBouncePos.y} r="16" fill="none" stroke="#c084fc" strokeWidth="3.5" className="animate-pulse" />
                        <circle cx={defBouncePos.x} cy={defBouncePos.y} r="6" fill="#facc15" />
                      </g>

                      {/* Deine Figur (Rot) */}
                      <g style={{ cursor: activeDrag === "player" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("player", e)} onTouchStart={(e) => onPointerDown("player", e)}>
                        <circle cx={defPlayerPos.x} cy={defPlayerPos.y} r={42} fill="transparent" />
                        <circle cx={defPlayerPos.x} cy={defPlayerPos.y} r={activeDrag === "player" ? 22 : 18} fill="#e74c3c" stroke="#ffffff" strokeWidth="3" />
                        <text x={defPlayerPos.x} y={defPlayerPos.y} transform={`rotate(90 ${defPlayerPos.x} ${defPlayerPos.y})`} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {t("tb_radar_you")}
                        </text>
                      </g>
                    </>
                  )}
                </g>
              </svg>
            </div>

            {labMode === "attack" ? (
              <>
                <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-white/80 font-bold px-1">
                  <span>
                    {t("tb_radar_pos")}{" "}
                    <span className="text-[#e74c3c] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">
                      X:{playerCoords.x} Z:{playerCoords.z}
                    </span>
                  </span>
                  <span>
                    {t("tb_radar_target")}{" "}
                    <span className="text-[#f1c40f] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">
                      X:{targetCoords.x} Z:{targetCoords.z}
                    </span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <select
                    value={shotType}
                    onChange={(e) => setShotType(e.target.value)}
                    className="w-full bg-white/10 text-white text-xs font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="BAJADA" className="text-black">{t("tb_shot_topspin")}</option>
                    <option value="VIBORA" className="text-black">{t("tb_shot_slice")}</option>
                    <option value="SMASH" className="text-black">{t("tb_shot_flat")}</option>
                    <option value="LOB" className="text-black">{t("tb_shot_lob")}</option>
                  </select>
                  <button
                    onClick={handleSimulateAttack}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold py-2 px-3 rounded-lg shadow-md transition-transform active:scale-95 whitespace-nowrap"
                  >
                    {t("tb_btn_simulate")}
                  </button>
                </div>
              </>
            ) : (
              <>
                {!defQuizMode && (
                  <div className="text-[10px] font-black text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-lg px-2.5 py-1 text-center uppercase tracking-wider">
                    {defenseSim.patternLabel}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <select
                    value={defShotType}
                    onChange={(e) => setDefShotType(e.target.value as DefenseShotType)}
                    className="flex-1 bg-white/10 text-white text-[11px] font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {defShotOptions.map((opt) => (
                      <option key={opt.id} value={opt.id} className="text-black">
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setDefSpeed((s) => (s === 0.4 ? 1 : 0.4))}
                    className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-black shrink-0"
                  >
                    {defSpeed}x
                  </button>
                </div>

                <button
                  onClick={() => handleStartDefenseSim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-black uppercase tracking-widest py-2.5 px-3 rounded-xl shadow-lg transition-transform active:scale-95"
                >
                  {defQuizMode
                    ? lang === "en"
                      ? "🎯 Check Position & Play"
                      : lang === "es"
                      ? "🎯 Comprobar y Simular"
                      : "🎯 Stellung prüfen & starten"
                    : t("tb_btn_simulate")}
                </button>
              </>
            )}
          </div>
        )}

        {/* ANGRIFFS-MODUS ZURÜCK-BUTTON */}
        {labMode === "attack" && isSimulating && (
          <button
            onClick={handleBackAttack}
            className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors pointer-events-auto animate-in fade-in"
          >
            {t("tb_btn_back_plan")}
          </button>
        )}

        {/* SCHEIBENSPIEL-SIMULATIONS-STEUERLEISTE (MIT LIVE-SPIN-VERGLEICH & ZEITLUPE) */}
        {isDefenseSimView && (
          <>
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBackToDefensePlan}
                  className="bg-slate-950/90 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg hover:bg-slate-800 transition-colors"
                >
                  {t("tb_btn_back_plan")}
                </button>
                <button
                  onClick={() => handleStartDefenseSim()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg transition-colors"
                >
                  🔁 Replay
                </button>
                <button
                  onClick={() => setDefSpeed((s) => (s === 0.4 ? 1 : 0.4))}
                  className="bg-slate-950/90 border border-cyan-500/50 text-cyan-300 px-2.5 py-1.5 rounded-lg text-xs font-black"
                >
                  {defSpeed}x
                </button>
              </div>

              {/* Direkter Spin-Vergleich aus exakt derselben Position */}
              <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-700">
                {(["SLICE", "FLAT", "TOPSPIN", "LOB"] as DefenseShotType[]).map((sType) => (
                  <button
                    key={sType}
                    onClick={() => handleStartDefenseSim(sType)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      defShotType === sType
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {sType}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach-Auswertung & Legende nach Ende des Ballflugs (Kamera frei drehbar) */}
            {defHasFinished && (
              <div className="absolute bottom-3 left-3 right-3 z-20 bg-[#050b18]/92 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-3 sm:p-4 shadow-2xl pointer-events-auto flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                    🛡️ {defenseSim.patternLabel}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    {lang === "en"
                      ? "3D Camera unlocked – drag to inspect angles"
                      : lang === "es"
                      ? "Cámara 3D libre: arrastra para ver el ángulo"
                      : "3D-Kamera frei – drehe das Feld für jeden Winkel"}
                  </span>
                </div>

                {defQuizMode && (
                  <div
                    className={`text-xs font-black px-3 py-1.5 rounded-lg border ${
                      defenseEval.status === "perfect"
                        ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                        : defenseEval.status === "playable"
                        ? "bg-amber-950/50 border-amber-500/50 text-amber-300"
                        : "bg-red-950/50 border-red-500/50 text-red-300"
                    }`}
                  >
                    {defenseEval.status === "perfect"
                      ? "✓ "
                      : defenseEval.status === "playable"
                      ? "⚠️ "
                      : "❌ "}
                    {defenseEval.message}
                  </div>
                )}

                <p className="text-xs text-slate-200 leading-snug">
                  💡 {defenseSim.coachTip}
                </p>

                <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400 pt-1 border-t border-slate-800">
                  <span className="text-yellow-400">● {lang === "en" ? "Approach" : lang === "es" ? "Vuelo" : "Anflug"}</span>
                  <span className="text-purple-400">● {lang === "en" ? "To Glass" : lang === "es" ? "Al cristal" : "Zur Scheibe"}</span>
                  <span className="text-cyan-400">● {lang === "en" ? "Rebound" : lang === "es" ? "Rebote" : "Abpraller"}</span>
                  <span className="text-emerald-400">● {lang === "en" ? "Sweetspot & Stand" : lang === "es" ? "Punto óptimo" : "Treffpunkt & Standzone"}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

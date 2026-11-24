import React, { useRef, useState, useCallback, useMemo } from "react";
import ScenarioCourt4D from "./ScenarioCourt4D";
import { useTranslation } from "../lib/i18n";
import { V_WIDTH, V_HEIGHT } from "../lib/tacticsMath";
import {
  ATTACK_PRESETS,
  DEFENSE_PRESETS,
  AttackShotType,
  DefenseShotType,
  LabMode,
  LabShotType,
  calculateLabTrajectory,
  evaluatePlayerDefensePosition,
} from "../lib/glassPhysics";

export default function TrajectoryView3D() {
  const { lang, t } = useTranslation();

  const [labMode, setLabMode] = useState<LabMode>("attack");

  // --- ANGRIFFS-MODUS STATES ---
  const [atkShotType, setAtkShotType] = useState<AttackShotType>(ATTACK_PRESETS[0].shotType);
  const [atkPlayerPos, setAtkPlayerPos] = useState(ATTACK_PRESETS[0].playerPos);
  const [atkTargetPos, setAtkTargetPos] = useState(ATTACK_PRESETS[0].targetPos);
  const [atkActivePreset, setAtkActivePreset] = useState<string>(ATTACK_PRESETS[0].id);

  // --- SCHEIBENSPIEL-MODUS (VERTEIDIGUNG) STATES ---
  const [defShotType, setDefShotType] = useState<DefenseShotType>(DEFENSE_PRESETS[2].shotType);
  const [defOppPos, setDefOppPos] = useState(DEFENSE_PRESETS[2].oppPos);
  const [defBouncePos, setDefBouncePos] = useState(DEFENSE_PRESETS[2].bouncePos);
  const [defPlayerPos, setDefPlayerPos] = useState(DEFENSE_PRESETS[2].playerPos);
  const [defActivePreset, setDefActivePreset] = useState<string>(DEFENSE_PRESETS[2].id);
  const [defQuizMode, setDefQuizMode] = useState<boolean>(false);

  // --- GEMEINSAME SIMULATIONS-STEUERUNG ---
  const [playbackSpeed, setPlaybackSpeed] = useState<0.4 | 1>(0.4);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasFinished, setHasFinished] = useState<boolean>(false);
  const [replayKey, setReplayKey] = useState<number>(0);

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

  const atkPlayerCoords = getMetersFromXY(atkPlayerPos.x, atkPlayerPos.y);
  const atkTargetCoords = getMetersFromXY(atkTargetPos.x, atkTargetPos.y);

  const defOppCoords = getMetersFromXY(defOppPos.x, defOppPos.y);
  const defBounceCoords = getMetersFromXY(defBouncePos.x, defBouncePos.y);
  const defPlayerCoords = getMetersFromXY(defPlayerPos.x, defPlayerPos.y);

  const activeShotType: LabShotType = labMode === "attack" ? atkShotType : defShotType;

  // Live-Berechnung der einheitlichen 3D-Physik für Angriff & Verteidigung
  const activeSimulation = useMemo(() => {
    if (labMode === "attack") {
      return calculateLabTrajectory({
        mode: "attack",
        startPos: atkPlayerCoords,
        bouncePos: atkTargetCoords,
        shotType: atkShotType,
        lang,
      });
    }
    return calculateLabTrajectory({
      mode: "defense",
      startPos: defOppCoords,
      bouncePos: defBounceCoords,
      shotType: defShotType,
      lang,
    });
  }, [
    labMode,
    atkPlayerCoords.x,
    atkPlayerCoords.z,
    atkTargetCoords.x,
    atkTargetCoords.z,
    atkShotType,
    defOppCoords.x,
    defOppCoords.z,
    defBounceCoords.x,
    defBounceCoords.z,
    defShotType,
    lang,
  ]);

  const defenseEval = useMemo(
    () =>
      labMode === "defense"
        ? evaluatePlayerDefensePosition(defPlayerCoords, activeSimulation, lang)
        : null,
    [labMode, defPlayerCoords.x, defPlayerCoords.z, activeSimulation, lang]
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
        setAtkActivePreset("");
        if (activeDrag === "player") {
          setAtkPlayerPos({
            x: Math.max(18, Math.min(NET_X - 18, pt.x)),
            y: Math.max(18, Math.min(V_HEIGHT - 18, pt.y)),
          });
        } else if (activeDrag === "target") {
          setAtkTargetPos({
            x: Math.max(NET_X + 20, Math.min(V_WIDTH - 18, pt.x)),
            y: Math.max(18, Math.min(V_HEIGHT - 18, pt.y)),
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

  const handleApplyAttackPreset = (presetId: string) => {
    const preset = ATTACK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setAtkActivePreset(preset.id);
    setAtkShotType(preset.shotType);
    setAtkPlayerPos(preset.playerPos);
    setAtkTargetPos(preset.targetPos);
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

  const handleStartSim = (overrideShot?: LabShotType) => {
    if (overrideShot) {
      if (labMode === "attack") setAtkShotType(overrideShot as AttackShotType);
      else setDefShotType(overrideShot as DefenseShotType);
    }
    setHasFinished(false);
    setIsPlaying(true);
    setReplayKey((k) => k + 1);
  };

  const handleBackToPlan = () => {
    setIsPlaying(false);
    setHasFinished(false);
  };

  const isSimView = isPlaying || hasFinished;
  const hidePreview = labMode === "defense" && defQuizMode;

  // 2D-Preview-Polylinie im Mini-Radar (für Angriff & Verteidigung)
  const radarPreviewPath = useMemo(() => {
    if (hidePreview) return "";
    const pts: string[] = [];
    const start2d =
      labMode === "attack"
        ? getXYFromMeters(atkPlayerCoords.x, atkPlayerCoords.z)
        : getXYFromMeters(defOppCoords.x, defOppCoords.z);
    const bounce2d = getXYFromMeters(activeSimulation.firstBounce.x, activeSimulation.firstBounce.z);
    pts.push(`${start2d.x},${start2d.y}`, `${bounce2d.x},${bounce2d.y}`);

    activeSimulation.glassHits.forEach((hit) => {
      const h2d = getXYFromMeters(hit.point.x, hit.point.z);
      pts.push(`${h2d.x},${h2d.y}`);
    });

    const endPt = activeSimulation.exitedCourt
      ? activeSimulation.samples[activeSimulation.samples.length - 1]?.pos || activeSimulation.sweetspot
      : activeSimulation.sweetspot;
    const end2d = getXYFromMeters(endPt.x, endPt.z);
    pts.push(`${end2d.x},${end2d.y}`);
    return pts.join(" ");
  }, [
    hidePreview,
    labMode,
    atkPlayerCoords.x,
    atkPlayerCoords.z,
    defOppCoords.x,
    defOppCoords.z,
    activeSimulation,
  ]);

  const atkShotOptions: { id: AttackShotType; short: string; label: string }[] = [
    {
      id: "VIBORA",
      short: "VÍBORA",
      label: lang === "en" ? "🐍 Víbora (Slice drops)" : lang === "es" ? "🐍 Víbora (cae)" : "🐍 Víbora (Slice fällt ab)",
    },
    {
      id: "BAJADA",
      short: "BAJADA",
      label: lang === "en" ? "🌀 Bajada (Topspin kicks)" : lang === "es" ? "🌀 Bajada (liftada)" : "🌀 Bajada (Topspin)",
    },
    {
      id: "SMASH_POR3",
      short: "POR 3",
      label: lang === "en" ? "💥 Smash Por 3 (Kick)" : lang === "es" ? "💥 Remate x3 (Kick)" : "💥 Smash Por 3 (Kick)",
    },
    {
      id: "VOLLEY",
      short: "VOLLEY",
      label: lang === "en" ? "⚡ Volley (Flat/Fence)" : lang === "es" ? "⚡ Volea (Reja)" : "⚡ Volley (Direkt/Gitter)",
    },
    {
      id: "LOB",
      short: "LOB",
      label: lang === "en" ? "🎈 Deep Lob" : lang === "es" ? "🎈 Globo" : "🎈 Tiefer Lob",
    },
  ];

  const defShotOptions: { id: DefenseShotType; short: string; label: string }[] = [
    {
      id: "SLICE",
      short: "SLICE",
      label: lang === "en" ? "🔪 Slice (drops)" : lang === "es" ? "🔪 Cortado (cae)" : "🔪 Slice (fällt ab)",
    },
    {
      id: "FLAT",
      short: "FLAT",
      label: lang === "en" ? "🎾 Flat (neutral)" : lang === "es" ? "🎾 Plano (neutro)" : "🎾 Glatt (neutral)",
    },
    {
      id: "TOPSPIN",
      short: "TOPSPIN",
      label: lang === "en" ? "🌀 Topspin (kicks)" : lang === "es" ? "🌀 Liftado (sale)" : "🌀 Topspin (springt raus)",
    },
    {
      id: "LOB",
      short: "LOB",
      label: lang === "en" ? "🎈 Deep Lob" : lang === "es" ? "🎈 Globo" : "🎈 Tiefer Lob",
    },
  ];

  const ratingBadgeClass =
    activeSimulation.attackRating === "winner"
      ? "bg-emerald-950/60 border-emerald-400/60 text-emerald-300"
      : activeSimulation.attackRating === "pressure"
      ? "bg-cyan-950/60 border-cyan-400/60 text-cyan-300"
      : activeSimulation.attackRating === "risky"
      ? "bg-amber-950/60 border-amber-400/60 text-amber-300"
      : "bg-slate-900/80 border-slate-700 text-slate-300";

  return (
    <div className="w-full max-w-5xl flex-1 flex flex-col h-full px-2 mb-4">
      <div className="w-full flex-1 h-full min-h-[480px] bg-[#02040a] rounded-xl shadow-2xl border-4 border-[#111] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-auto">
          <ScenarioCourt4D
            level="Schlagrichtung"
            positions={{
              you: "C2",
              partner: "EXACT_1000_1000",
              opp1: "EXACT_1000_1000",
              opp2: "EXACT_1000_1000",
              ball: { side: "left", zone: "C2", type: activeShotType },
            }}
            selectedZone={null}
            trajectoryLab={{
              active: true,
              mode: labMode,
              isPlaying,
              hasFinished,
              playbackSpeed,
              replayKey,
              showPreviewGuide: !hidePreview,
              shotType: activeShotType,
              playerPos: labMode === "attack" ? atkPlayerCoords : defPlayerCoords,
              oppPos: labMode === "defense" ? defOppCoords : undefined,
              simulation: activeSimulation,
              onFinished: () => {
                setIsPlaying(false);
                setHasFinished(true);
              },
            }}
            hidePlayerLabels={true}
            hasSubmitted={false}
            bestZones={[]}
            onZoneClick={() => {}}
            activeChar="you"
            hitterId="you"
            playIntro={false}
            turnResult="perfect"
          />
        </div>

        {/* PLANUNGS-HUD (ANGRIFF ODER SCHEIBENSPIEL) */}
        {!isSimView && (
          <div className="absolute top-2 left-2 z-10 w-[calc(100%-16px)] max-w-[310px] sm:max-w-none sm:w-80 bg-black/85 sm:bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex flex-col gap-2 pointer-events-auto max-h-[calc(100%-16px)] overflow-y-auto">
            {/* Modus-Umschalter: Angriff vs. Scheibenspiel */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setHasFinished(false);
                  setLabMode("attack");
                }}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  labMode === "attack"
                    ? "bg-gradient-to-r from-orange-600 to-amber-500 text-black shadow-md"
                    : "text-orange-300 hover:text-white"
                }`}
              >
                {lang === "en" ? "⚔️ Attack Lab" : lang === "es" ? "⚔️ Ataque" : "⚔️ Angriff"}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setHasFinished(false);
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
              <div className="flex flex-col gap-1.5">
                <span className="text-orange-400 text-[9px] font-black uppercase tracking-widest">
                  {lang === "en"
                    ? "3D ATTACK & POR-3 LAB"
                    : lang === "es"
                    ? "LABORATORIO 3D DE ATAQUE Y X3"
                    : "3D ANGRIFFS- & POR-3-LABOR"}
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {ATTACK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyAttackPreset(preset.id)}
                      className={`py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all truncate ${
                        atkActivePreset === preset.id
                          ? "bg-orange-500/25 border-orange-400 text-orange-200"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {preset.labels[lang] || preset.labels.de}
                    </button>
                  ))}
                </div>
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
                    🎯 Test
                  </button>
                </div>

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

                  {/* Glas-Highlight auf der Ziel-Hälfte */}
                  {labMode === "attack" ? (
                    <polyline
                      points={`600,10 750,10 750,${V_HEIGHT - 10} 600,${V_HEIGHT - 10}`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={5}
                      opacity={0.75}
                    />
                  ) : (
                    <polyline
                      points={`160,10 10,10 10,${V_HEIGHT - 10} 160,${V_HEIGHT - 10}`}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={5}
                      opacity={0.75}
                    />
                  )}

                  {/* Live-Rebound-Vorschau (inkl. Orange bei Por 3/4) */}
                  {radarPreviewPath && (
                    <polyline
                      points={radarPreviewPath}
                      fill="none"
                      stroke={activeSimulation.exitedCourt ? "#f97316" : "#c084fc"}
                      strokeWidth="5"
                      strokeDasharray="8 5"
                      opacity={0.85}
                    />
                  )}

                  {labMode === "attack" ? (
                    <>
                      {/* 1. Aufprall-Ziel (Gelb/Orange) */}
                      <g style={{ cursor: activeDrag === "target" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("target", e)} onTouchStart={(e) => onPointerDown("target", e)}>
                        <circle cx={atkTargetPos.x} cy={atkTargetPos.y} r={42} fill="transparent" />
                        <circle cx={atkTargetPos.x} cy={atkTargetPos.y} r="16" fill="none" stroke="#facc15" strokeWidth="3.5" className="animate-pulse" />
                        <circle cx={atkTargetPos.x} cy={atkTargetPos.y} r="6" fill="#facc15" />
                      </g>

                      {/* Deine Figur (Rot) */}
                      <g style={{ cursor: activeDrag === "player" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("player", e)} onTouchStart={(e) => onPointerDown("player", e)}>
                        <circle cx={atkPlayerPos.x} cy={atkPlayerPos.y} r={42} fill="transparent" />
                        <circle cx={atkPlayerPos.x} cy={atkPlayerPos.y} r={activeDrag === "player" ? 22 : 18} fill="#e74c3c" stroke="#ffffff" strokeWidth="3" />
                        <text x={atkPlayerPos.x} y={atkPlayerPos.y} transform={`rotate(90 ${atkPlayerPos.x} ${atkPlayerPos.y})`} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {t("tb_radar_you")}
                        </text>
                      </g>
                    </>
                  ) : (
                    <>
                      {/* Gegner (Gelb) */}
                      <g style={{ cursor: activeDrag === "opp" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("opp", e)} onTouchStart={(e) => onPointerDown("opp", e)}>
                        <circle cx={defOppPos.x} cy={defOppPos.y} r={42} fill="transparent" />
                        <circle cx={defOppPos.x} cy={defOppPos.y} r={activeDrag === "opp" ? 22 : 18} fill="#facc15" stroke="#ffffff" strokeWidth="3" />
                        <text x={defOppPos.x} y={defOppPos.y} transform={`rotate(90 ${defOppPos.x} ${defOppPos.y})`} textAnchor="middle" dominantBaseline="central" fill="black" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          B1
                        </text>
                      </g>

                      {/* 1. Boden-Aufprallpunkt */}
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

            {/* Live-Status-Badge (Ergebnis-Vorschau) */}
            {!hidePreview && (
              <div
                className={`text-[10px] font-black rounded-lg px-2.5 py-1 text-center uppercase tracking-wider border ${
                  labMode === "attack"
                    ? ratingBadgeClass
                    : "text-cyan-300 bg-cyan-950/40 border-cyan-500/30"
                }`}
              >
                {activeSimulation.patternLabel}
              </div>
            )}

            {/* Schlag-Auswahl & Geschwindigkeit */}
            <div className="flex items-center gap-1.5">
              {labMode === "attack" ? (
                <select
                  value={atkShotType}
                  onChange={(e) => setAtkShotType(e.target.value as AttackShotType)}
                  className="flex-1 bg-white/10 text-white text-[11px] font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                >
                  {atkShotOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="text-black">
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
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
              )}

              <button
                onClick={() => setPlaybackSpeed((s) => (s === 0.4 ? 1 : 0.4))}
                className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-black shrink-0"
              >
                {playbackSpeed}x
              </button>
            </div>

            <button
              onClick={() => handleStartSim()}
              className={`w-full text-xs font-black uppercase tracking-widest py-2.5 px-3 rounded-xl shadow-lg transition-transform active:scale-95 ${
                labMode === "attack"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black"
                  : "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white"
              }`}
            >
              {labMode === "defense" && defQuizMode
                ? lang === "en"
                  ? "🎯 Check Position & Play"
                  : lang === "es"
                  ? "🎯 Comprobar y Simular"
                  : "🎯 Stellung prüfen & starten"
                : t("tb_btn_simulate")}
            </button>
          </div>
        )}

        {/* SIMULATIONS-STEUERLEISTE (FÜR ANGRIFF & SCHEIBENSPIEL) */}
        {isSimView && (
          <>
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBackToPlan}
                  className="bg-slate-950/90 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg hover:bg-slate-800 transition-colors"
                >
                  {t("tb_btn_back_plan")}
                </button>
                <button
                  onClick={() => handleStartSim()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg transition-colors"
                >
                  🔁 Replay
                </button>
                <button
                  onClick={() => setPlaybackSpeed((s) => (s === 0.4 ? 1 : 0.4))}
                  className="bg-slate-950/90 border border-cyan-500/50 text-cyan-300 px-2.5 py-1.5 rounded-lg text-xs font-black"
                >
                  {playbackSpeed}x
                </button>
              </div>

              {/* Direkter Live-Schlag-/Spin-Vergleich aus exakt derselben Position */}
              <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 overflow-x-auto max-w-full">
                {(labMode === "attack" ? atkShotOptions : defShotOptions).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleStartSim(opt.id)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      activeShotType === opt.id
                        ? labMode === "attack"
                          ? "bg-orange-500 text-black"
                          : "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach-Auswertung & Legende nach Ende des Ballflugs (Kamera frei drehbar) */}
            {hasFinished && (
              <div className="absolute bottom-3 left-3 right-3 z-20 bg-[#050b18]/92 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-3 sm:p-4 shadow-2xl pointer-events-auto flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                      labMode === "attack"
                        ? ratingBadgeClass
                        : "bg-cyan-950/50 border-cyan-500/40 text-cyan-300"
                    }`}
                  >
                    {labMode === "attack" ? "⚔️ " : "🛡️ "}
                    {activeSimulation.patternLabel}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    {lang === "en"
                      ? "3D Camera unlocked – drag to inspect angles"
                      : lang === "es"
                      ? "Cámara 3D libre: arrastra para ver el ángulo"
                      : "3D-Kamera frei – drehe das Feld für jeden Winkel"}
                  </span>
                </div>

                {labMode === "defense" && defQuizMode && defenseEval && (
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
                  💡 {activeSimulation.coachTip}
                </p>

                <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400 pt-1 border-t border-slate-800">
                  <span className="text-yellow-400">
                    ● {lang === "en" ? "Approach" : lang === "es" ? "Vuelo" : "Anflug"}
                  </span>
                  <span className="text-purple-400">
                    ● {lang === "en" ? "To Glass" : lang === "es" ? "Al cristal" : "Zur Scheibe"}
                  </span>
                  <span className="text-cyan-400">
                    ● {lang === "en" ? "Rebound" : lang === "es" ? "Rebote" : "Abpraller"}
                  </span>
                  {activeSimulation.exitedCourt ? (
                    <span className="text-orange-400">
                      ● {activeSimulation.exitedCourt === "por_3" ? "Por 3 Exit (3m)" : "Por 4 Exit (4m)"}
                    </span>
                  ) : (
                    <span className={labMode === "attack" ? "text-amber-400" : "text-emerald-400"}>
                      ●{" "}
                      {labMode === "attack"
                        ? lang === "en"
                          ? "Opponent Rebound Height"
                          : lang === "es"
                          ? "Altura de rebote rival"
                          : "Gegner-Rebound-Höhe"
                        : lang === "en"
                        ? "Sweetspot & Stand"
                        : lang === "es"
                        ? "Punto óptimo"
                        : "Treffpunkt & Standzone"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

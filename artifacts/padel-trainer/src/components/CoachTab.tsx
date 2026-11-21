import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { supabase } from "../lib/supabase";
import { Scenario } from "./Scenarios";
import { useTranslation, formatShotName } from "../lib/i18n";
import {
  TacticCoachStats,
  RadarAxisKey,
  DiagnosisType,
  CoachSummary,
  fetchCoachStats,
  analyzeCoachStats,
  buildSmartWeaknessPool,
} from "../lib/tacticStats";

interface CoachTabProps {
  userId?: string | null;
  userName: string;
  totalPoints: number;
  onStartWeaknessTraining: (
    scenarios: Scenario[],
    focus: CoachSummary["recommendedTaskFocus"]
  ) => void;
  onNavigateTab: (tab: "trainer" | "game" | "board") => void;
}

interface MatchHistoryAggregate {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  aces: number;
  winners: number;
  unforcedErrors: number;
  totalShots: number;
  perfectShots: number;
  perfectPct: number;
  recentResults: ("win" | "loss")[];
}

const getAxisLabel = (axis: RadarAxisKey, lang: string): string => {
  if (lang === "en") {
    switch (axis) {
      case "shotChoice": return "Shot Choice";
      case "placement": return "Placement";
      case "positioning": return "Positioning";
      case "netPlay": return "Net Play";
      case "overhead": return "Overheads";
      case "defense": return "Defense";
    }
  }
  if (lang === "es") {
    switch (axis) {
      case "shotChoice": return "Elección";
      case "placement": return "Precisión";
      case "positioning": return "Posición";
      case "netPlay": return "Red";
      case "overhead": return "Remates";
      case "defense": return "Defensa";
    }
  }
  switch (axis) {
    case "shotChoice": return "Schlagwahl";
    case "placement": return "Platzierung";
    case "positioning": return "Stellung";
    case "netPlay": return "Netzspiel";
    case "overhead": return "Überkopf";
    case "defense": return "Defensive";
  }
};

const getDiagnosisMeta = (diagnosis: DiagnosisType, lang: string) => {
  if (lang === "en") {
    switch (diagnosis) {
      case "core_weakness":
        return {
          badge: "⚠️ CORE WEAKNESS",
          color: "text-red-400 bg-red-950/50 border-red-500/40",
          tip: "Same mistake in Trainer and 3D Match. Start a targeted drill now to fix the root cause.",
        };
      case "execution_gap":
        return {
          badge: "🔥 EXECUTION GAP",
          color: "text-orange-400 bg-orange-950/50 border-orange-500/40",
          tip: "You know the theory in the Trainer, but under match pressure it slips. Focus on applying it in your next 3D match.",
        };
      case "instinct_strength":
        return {
          badge: "⚡ INSTINCT STRENGTH",
          color: "text-purple-300 bg-purple-950/50 border-purple-500/40",
          tip: "You play this well by instinct in matches even though Trainer drills were tricky. A quick drill locks in the theory.",
        };
      case "mastered":
        return {
          badge: "🏆 MASTERED",
          color: "text-emerald-400 bg-emerald-950/50 border-emerald-500/40",
          tip: "Rock solid in both theory and live match execution.",
        };
      case "trainer_only":
        return {
          badge: "📘 THEORY ONLY",
          color: "text-cyan-300 bg-cyan-950/50 border-cyan-500/40",
          tip: "Play a 3D Match to compare your Trainer knowledge against real match execution.",
        };
      case "match_only":
        return {
          badge: "🎾 MATCH ONLY",
          color: "text-amber-300 bg-amber-950/50 border-amber-500/40",
          tip: "Play a few Trainer rounds so the Coach can compare your match stats against tactical theory.",
        };
      default:
        return {
          badge: "📊 COLLECTING DATA",
          color: "text-slate-400 bg-slate-900 border-slate-700",
          tip: "Complete a few Trainer drills or a 3D Match to unlock your comparison.",
        };
    }
  }

  if (lang === "es") {
    switch (diagnosis) {
      case "core_weakness":
        return {
          badge: "⚠️ PUNTO CRÍTICO",
          color: "text-red-400 bg-red-950/50 border-red-500/40",
          tip: "El mismo error se repite en el Entrenador y en el Partido 3D. Entrena esta debilidad primero.",
        };
      case "execution_gap":
        return {
          badge: "🔥 BRECHA EN PARTIDO",
          color: "text-orange-400 bg-orange-950/50 border-orange-500/40",
          tip: "Dominas la teoría en el Entrenador, pero en el partido aún vacilas. Practica jugadas completas bajo presión.",
        };
      case "instinct_strength":
        return {
          badge: "⚡ INSTINTO FUERTE",
          color: "text-purple-300 bg-purple-950/50 border-purple-500/40",
          tip: "En el partido juegas muy bien por instinto aunque fallaste en la teoría. Un repaso rápido lo consolida.",
        };
      case "mastered":
        return {
          badge: "🏆 DOMINADO",
          color: "text-emerald-400 bg-emerald-950/50 border-emerald-500/40",
          tip: "Excelente tanto en teoría como en el partido 3D.",
        };
      case "trainer_only":
        return {
          badge: "📘 SOLO TEORÍA",
          color: "text-cyan-300 bg-cyan-950/50 border-cyan-500/40",
          tip: "Juega un Partido 3D para comparar tu teoría con la práctica real.",
        };
      case "match_only":
        return {
          badge: "🎾 SOLO PARTIDO",
          color: "text-amber-300 bg-amber-950/50 border-amber-500/40",
          tip: "Completa algunos ejercicios del Entrenador para activar la comparación.",
        };
      default:
        return {
          badge: "📊 RECOPILANDO",
          color: "text-slate-400 bg-slate-900 border-slate-700",
          tip: "Juega en el Entrenador o un Partido 3D para activar tu radar.",
        };
    }
  }

  switch (diagnosis) {
    case "core_weakness":
      return {
        badge: "⚠️ DAUER-BAUSTELLE",
        color: "text-red-400 bg-red-950/50 border-red-500/40",
        tip: "Derselbe Fehler passiert im Taktik-Trainer UND im 3D-Match. Genau hier holst du mit gezielten Drills am meisten raus.",
      };
    case "execution_gap":
      return {
        badge: "🔥 UMSETZUNGS-LÜCKE",
        color: "text-orange-400 bg-orange-950/50 border-orange-500/40",
        tip: "Im Taktik-Trainer hast du das verstanden, aber im 3D-Match setzt du es unter Druck noch nicht sauber um.",
      };
    case "instinct_strength":
      return {
        badge: "⚡ INSTINKT-STÄRKE",
        color: "text-purple-300 bg-purple-950/50 border-purple-500/40",
        tip: "Im Spiel löst du das intuitiv stark, obwohl die Theorie-Aufgaben hakten. Mit einem kurzen Drill sitzt auch das Regelwerk.",
      };
    case "mastered":
      return {
        badge: "🏆 GEMEISTERT",
        color: "text-emerald-400 bg-emerald-950/50 border-emerald-500/40",
        tip: "Stark im Kopf und stark auf dem Platz – hier bist du sehr sicher unterwegs.",
      };
    case "trainer_only":
      return {
        badge: "📘 NUR THEORIE",
        color: "text-cyan-300 bg-cyan-950/50 border-cyan-500/40",
        tip: "Spiele ein 3D-Match, damit der Coach deine Trainer-Werte mit der echten Umsetzung im Spiel vergleichen kann.",
      };
    case "match_only":
      return {
        badge: "🎾 NUR MATCH-DATEN",
        color: "text-amber-300 bg-amber-950/50 border-amber-500/40",
        tip: "Spiele ein paar Aufgaben im Taktik-Trainer, um den direkten Theorie-vs.-Praxis-Vergleich freizuschalten.",
      };
    default:
      return {
        badge: "📊 DATEN WERDEN GESAMMELT",
        color: "text-slate-400 bg-slate-900 border-slate-700",
        tip: "Starte im Taktik-Trainer oder im 3D-Match – dein Coach analysiert jeden Zug automatisch.",
      };
  }
};

export default function CoachTab({
  userId,
  userName,
  totalPoints,
  onStartWeaknessTraining,
  onNavigateTab,
}: CoachTabProps) {
  const { lang } = useTranslation();
  const [coachStats, setCoachStats] = useState<TacticCoachStats | null>(null);
  const [matchAgg, setMatchAgg] = useState<MatchHistoryAggregate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadAllCoachData = async () => {
      setLoading(true);
      const stats = await fetchCoachStats(userId);
      if (active) setCoachStats(stats);

      if (userId) {
        try {
          let { data, error } = await supabase
            .from("match_history")
            .select(
              "result, aces, winners, unforced_errors, total_shots, shots_perfect, duration_seconds, match_type, created_at"
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50);

          if (error) {
            const fallback = await supabase
              .from("match_history")
              .select(
                "result, aces, winners, unforced_errors, total_shots, shots_perfect, duration_seconds, match_type"
              )
              .eq("user_id", userId)
              .limit(50);
            data = fallback.data as any;
          }

          if (active && Array.isArray(data)) {
            const totalMatches = data.length;
            const wins = data.filter((m: any) => m.result === "win").length;
            const losses = totalMatches - wins;
            const aces = data.reduce((s: number, m: any) => s + (m.aces || 0), 0);
            const winners = data.reduce((s: number, m: any) => s + (m.winners || 0), 0);
            const unforcedErrors = data.reduce(
              (s: number, m: any) => s + (m.unforced_errors || 0),
              0
            );
            const totalShots = data.reduce((s: number, m: any) => s + (m.total_shots || 0), 0);
            const perfectShots = data.reduce(
              (s: number, m: any) => s + (m.shots_perfect || 0),
              0
            );
            const recentResults = data
              .slice(0, 5)
              .map((m: any) => (m.result === "win" ? "win" : "loss")) as ("win" | "loss")[];

            setMatchAgg({
              totalMatches,
              wins,
              losses,
              winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
              aces,
              winners,
              unforcedErrors,
              totalShots,
              perfectShots,
              perfectPct: totalShots > 0 ? Math.round((perfectShots / totalShots) * 100) : 0,
              recentResults,
            });
          }
        } catch {
          // Offline-Fallback: Match-History bleibt optional
        }
      } else if (active) {
        setMatchAgg(null);
      }

      if (active) setLoading(false);
    };

    loadAllCoachData();
    return () => {
      active = false;
    };
  }, [userId]);

  const summary = useMemo(() => {
    if (!coachStats) return null;
    return analyzeCoachStats(coachStats);
  }, [coachStats]);

  const radarData = useMemo(() => {
    if (!summary) return [];
    return summary.comparisons.map((c) => ({
      axis: c.axis,
      subject: getAxisLabel(c.axis, lang),
      trainer: c.trainerPct ?? 0,
      match: c.matchPct ?? 0,
      hasTrainer: c.trainerPct !== null,
      hasMatch: c.matchPct !== null,
    }));
  }, [summary, lang]);

  const hasTrainerData = (coachStats?.trainer.totalTurns || 0) > 0;
  const hasMatchData = (coachStats?.match.totalTurns || 0) > 0;
  const hasAnyRadarData = hasTrainerData || hasMatchData;

  const primaryFocusMeta = summary?.primaryFocus
    ? getDiagnosisMeta(summary.primaryFocus.diagnosis, lang)
    : null;

  const handleLaunchDrill = () => {
    if (!coachStats) return;
    const { scenarios, focus } = buildSmartWeaknessPool(coachStats, 10);
    onStartWeaknessTraining(scenarios, focus);
  };

  return (
    <motion.div
      key="coach-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="w-full flex flex-col gap-5 pb-10 select-none text-slate-200"
    >
      {/* 1. COACH HERO HEADER */}
      <div className="w-full bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_40px_rgba(6,182,212,0.12)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-orange-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-orange-500/20 border border-cyan-400/40 flex items-center justify-center text-2xl shrink-0 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]">
              🧠
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
                {lang === "en"
                  ? "PERSONAL ANALYTICS & DRILLS"
                  : lang === "es"
                  ? "ANÁLISIS Y ENTRENAMIENTO PERSONAL"
                  : "DEIN PERSÖNLICHER TAKTIK-COACH"}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider leading-tight">
                TacPadel Coach
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === "en"
                  ? `Theory vs. Match comparison for ${userName}`
                  : lang === "es"
                  ? `Teoría vs. Partido 3D para ${userName}`
                  : `Theorie (Trainer) vs. Praxis (3D-Match) für ${userName}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            <div className="bg-[#030611] border border-cyan-500/30 rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                {lang === "en" ? "Trainer" : "Trainer"}
              </div>
              <div className="text-base font-black text-white">
                {coachStats?.trainer.totalTurns || 0}
              </div>
            </div>
            <div className="bg-[#030611] border border-orange-500/30 rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-orange-400">
                {lang === "en" ? "Match" : "Match"}
              </div>
              <div className="text-base font-black text-white">
                {coachStats?.match.totalTurns || 0}
              </div>
            </div>
            <div className="bg-[#030611] border border-slate-700/70 rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                TacScore
              </div>
              <div className="text-base font-black text-emerald-400">{totalPoints}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DUAL-SPINNENNETZ (THEORIE VS. PRAXIS) */}
      <div className="w-full bg-[#050b18]/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-white">
              🕸️{" "}
              {lang === "en"
                ? "Weakness Radar: Trainer vs. 3D Match"
                : lang === "es"
                ? "Radar de Debilidades: Entrenador vs. Partido"
                : "Schwächen-Radar: Trainer vs. 3D-Match"}
            </h2>
            <p className="text-[11px] text-slate-400">
              {lang === "en"
                ? "See instantly where your theory holds up under live match pressure."
                : lang === "es"
                ? "Comprueba dónde aplicas tu teoría bajo presión en el partido."
                : "Sieh auf einen Blick, ob du deine Taktik-Übungen im echten Spiel umsetzt."}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_#22d3ee]" />
              {lang === "en" ? "Trainer" : "Trainer"}
            </span>
            <span className="flex items-center gap-1.5 text-orange-300">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow-[0_0_8px_#f97316]" />
              3D-Match
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs font-bold text-slate-400 animate-pulse">
            {lang === "en"
              ? "Analyzing your tactics..."
              : lang === "es"
              ? "Analizando tu táctica..."
              : "Analysiere deine Taktik-Daten..."}
          </div>
        ) : !hasAnyRadarData ? (
          <div className="bg-[#030611] border border-slate-800 rounded-xl p-6 text-center flex flex-col items-center gap-3">
            <span className="text-4xl">🕸️</span>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              {lang === "en"
                ? "Your Dual-Radar is ready to calibrate"
                : lang === "es"
                ? "Tu Radar Dual está listo para calibrarse"
                : "Dein Dual-Radar wartet auf die ersten Züge"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              {lang === "en"
                ? "Play a few tasks in the Tactic Trainer and a 3D Match. Every shot, target, wobble and positioning move is automatically tracked here."
                : lang === "es"
                ? "Juega algunas tareas en el Entrenador y un Partido 3D. Cada golpe, precisión, fallo y desplazamiento se registra automáticamente."
                : "Spiele ein paar Aufgaben im Taktik-Trainer und ein 3D-Match. Jeder Schlag, Wackler und Stellungsfehler wird ab sofort automatisch hier ausgewertet."}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 mt-1">
              <button
                onClick={() => onNavigateTab("trainer")}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] uppercase tracking-wider transition-all"
              >
                {lang === "en" ? "Start Trainer" : lang === "es" ? "Ir al Entrenador" : "Zum Taktik-Trainer"}
              </button>
              <button
                onClick={() => onNavigateTab("game")}
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[11px] uppercase tracking-wider transition-all"
              >
                {lang === "en" ? "Play 3D Match" : lang === "es" ? "Jugar Partido 3D" : "3D-Match starten"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full h-72 sm:h-80 bg-[#030611]/90 rounded-xl border border-slate-800/80 p-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 800 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "#475569", fontSize: 9 }}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value}%`, name]}
                    contentStyle={{
                      backgroundColor: "#050b18",
                      border: "1px solid #06b6d4",
                      borderRadius: "10px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  {hasTrainerData && (
                    <Radar
                      name={lang === "en" ? "Trainer (Theory)" : lang === "es" ? "Entrenador" : "Trainer (Theorie)"}
                      dataKey="trainer"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      fill="#06b6d4"
                      fillOpacity={0.28}
                    />
                  )}
                  {hasMatchData && (
                    <Radar
                      name={lang === "en" ? "3D Match (Live)" : lang === "es" ? "Partido 3D" : "3D-Match (Praxis)"}
                      dataKey="match"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="#f97316"
                      fillOpacity={0.28}
                    />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Kaltstart-Hinweis, wenn noch einer der beiden Modi fehlt */}
            {(!hasTrainerData || !hasMatchData) && (
              <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-300 font-semibold">
                  {!hasMatchData
                    ? lang === "en"
                      ? "💡 Play 1 Match so the orange Praxis layer overlays your Trainer radar!"
                      : lang === "es"
                      ? "💡 ¡Juega 1 Partido 3D para superponer tu capa naranja de práctica!"
                      : "💡 Spiele 1 Match, damit sich die orange Praxis-Fläche über deinen Trainer legt!"
                    : lang === "en"
                    ? "💡 Complete a few Trainer scenarios to unlock the cyan Theory comparison!"
                    : lang === "es"
                    ? "💡 ¡Completa escenarios en el Entrenador para ver la comparación teórica!"
                    : "💡 Spiele ein paar Trainer-Aufgaben, damit sich der Cyan-Theorievergleich ergänzt!"}
                </span>
                <button
                  onClick={() => onNavigateTab(!hasMatchData ? "game" : "trainer")}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 shrink-0"
                >
                  {!hasMatchData
                    ? lang === "en" ? "Play Match →" : "Zum Match →"
                    : lang === "en" ? "Open Trainer →" : "Zum Trainer →"}
                </button>
              </div>
            )}

            {/* 3. COACH HAUPT-DIAGNOSE + 1-KLICK-TRAININGSBUTTON */}
            {summary?.primaryFocus && primaryFocusMeta && (
              <div className="bg-gradient-to-br from-[#071126] to-[#040914] border border-orange-500/40 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-[0_0_25px_rgba(249,115,22,0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {lang === "en"
                      ? "COACH RECOMMENDATION #1"
                      : lang === "es"
                      ? "RECOMENDACIÓN DEL COACH #1"
                      : "COACH-EMPFEHLUNG #1"}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${primaryFocusMeta.color}`}
                  >
                    {primaryFocusMeta.badge}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">
                    {getAxisLabel(summary.primaryFocus.axis, lang)}
                    <span className="text-xs font-bold text-slate-400 ml-2 normal-case">
                      (Trainer:{" "}
                      <span className="text-cyan-400">
                        {summary.primaryFocus.trainerPct !== null
                          ? `${summary.primaryFocus.trainerPct}%`
                          : "—"}
                      </span>{" "}
                      • Match:{" "}
                      <span className="text-orange-400">
                        {summary.primaryFocus.matchPct !== null
                          ? `${summary.primaryFocus.matchPct}%`
                          : "—"}
                      </span>
                      )
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {primaryFocusMeta.tip}
                  </p>
                </div>

                <button
                  onClick={handleLaunchDrill}
                  className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black text-xs sm:text-sm uppercase tracking-[0.18em] rounded-xl shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:scale-[1.01] active:scale-95 transition-all"
                >
                  🎯{" "}
                  {lang === "en"
                    ? "Train Weaknesses Now (10 Rounds)"
                    : lang === "es"
                    ? "Entrenar Debilidades Ahora (10 Rondas)"
                    : "Schwachstellen jetzt trainieren (10 Runden)"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. DETAIL-VERGLEICH ALLER 6 ACHSEN (THEORIE VS. PRAXIS) */}
      {summary && hasAnyRadarData && (
        <div className="w-full bg-[#050b18]/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3.5">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-300">
            📐{" "}
            {lang === "en"
              ? "Detailed Comparison (6 Tactical Axes)"
              : lang === "es"
              ? "Comparativa Detallada (6 Ejes Tácticos)"
              : "Detail-Vergleich: Theorie vs. Praxis"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.comparisons.map((comp) => {
              const meta = getDiagnosisMeta(comp.diagnosis, lang);
              return (
                <div
                  key={comp.axis}
                  className="bg-[#030611] border border-slate-800/90 rounded-xl p-3.5 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      {getAxisLabel(comp.axis, lang)}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${meta.color}`}
                    >
                      {meta.badge}
                    </span>
                  </div>

                  {/* Trainer-Balken */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-14 text-cyan-400">Trainer</span>
                    <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-500"
                        style={{ width: `${comp.trainerPct ?? 0}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-slate-300">
                      {comp.trainerPct !== null ? `${comp.trainerPct}%` : "—"}
                    </span>
                  </div>

                  {/* Match-Balken */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-14 text-orange-400">Match</span>
                    <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${comp.matchPct ?? 0}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-slate-300">
                      {comp.matchPct !== null ? `${comp.matchPct}%` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. FEHLER-ANALYSE AUS DEN MATCHES + SCHLAG-CHECK */}
      {coachStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fehler-Aufschlüsselung */}
          <div className="bg-[#050b18]/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-300">
              🔍{" "}
              {lang === "en"
                ? "Live Match Error Breakdown"
                : lang === "es"
                ? "Desglose de Errores en Partido"
                : "Fehler- & Wackler-Analyse (3D-Match)"}
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#030611] border border-red-500/25 rounded-xl p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-red-400">
                  {lang === "en" ? "Tactical Errors" : lang === "es" ? "Errores Tácticos" : "Taktik-Fehler"}
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {coachStats.matchErrors.tacticalErrors}
                </div>
              </div>
              <div className="bg-[#030611] border border-amber-500/25 rounded-xl p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  {lang === "en" ? "Shaky Shots" : lang === "es" ? "Golpes Inestables" : "Wackler"}
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {coachStats.matchErrors.wobbles}
                </div>
              </div>
              <div className="bg-[#030611] border border-purple-500/25 rounded-xl p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-purple-400">
                  {lang === "en" ? "Position Errors" : lang === "es" ? "Errores Posición" : "Stellungsfehler"}
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {coachStats.matchErrors.positioningErrors}
                </div>
              </div>
              <div className="bg-[#030611] border border-rose-500/25 rounded-xl p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-rose-400">
                  {lang === "en" ? "Net / Glass Out" : lang === "es" ? "Red / Cristal" : "Netz / Aus"}
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {coachStats.matchErrors.unforcedErrors}
                </div>
              </div>
            </div>
          </div>

          {/* Stärkster & schwächster Schlag */}
          <div className="bg-[#050b18]/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-300">
              🎾{" "}
              {lang === "en"
                ? "Shot Profile (Combined)"
                : lang === "es"
                ? "Perfil de Golpes"
                : "Schlag-Profil (Trainer & Match)"}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 flex-1">
              <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block">
                    ⚠️{" "}
                    {lang === "en"
                      ? "Needs Most Work"
                      : lang === "es"
                      ? "Mayor Margen de Mejora"
                      : "Größte Schlag-Baustelle"}
                  </span>
                  <span className="text-base font-black text-white">
                    {summary?.weakestShot
                      ? formatShotName(summary.weakestShot.shot, lang)
                      : "—"}
                  </span>
                  {summary?.weakestShot && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Trainer: {summary.weakestShot.trainerPct !== null ? `${summary.weakestShot.trainerPct}%` : "—"} • Match:{" "}
                      {summary.weakestShot.matchPct !== null ? `${summary.weakestShot.matchPct}%` : "—"}
                    </span>
                  )}
                </div>
                <span className="text-xl font-black text-red-400">
                  {summary?.weakestShot ? `${summary.weakestShot.combinedPct}%` : "—"}
                </span>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block">
                    💪{" "}
                    {lang === "en"
                      ? "Strongest Weapon"
                      : lang === "es"
                      ? "Tu Mejor Arma"
                      : "Deine stärkste Waffe"}
                  </span>
                  <span className="text-base font-black text-white">
                    {summary?.strongestShot
                      ? formatShotName(summary.strongestShot.shot, lang)
                      : "—"}
                  </span>
                </div>
                <span className="text-xl font-black text-emerald-400">
                  {summary?.strongestShot ? `${summary.strongestShot.combinedPct}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MATCH-STATISTIKEN (AUS SUPABASE MATCH_HISTORY) */}
      <div className="w-full bg-[#050b18]/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-300">
            📊{" "}
            {lang === "en"
              ? "3D Match Statistics"
              : lang === "es"
              ? "Estadísticas de Partidos 3D"
              : "3D-Match Bilanz & Statistiken"}
          </h2>

          {matchAgg && matchAgg.recentResults.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mr-1">
                {lang === "en" ? "Form:" : "Form:"}
              </span>
              {matchAgg.recentResults.map((res, idx) => (
                <span
                  key={idx}
                  className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center border ${
                    res === "win"
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-red-500/20 border-red-500/50 text-red-300"
                  }`}
                >
                  {res === "win" ? "S" : "N"}
                </span>
              ))}
            </div>
          )}
        </div>

        {!userId ? (
          <p className="text-xs text-slate-400 bg-[#030611] border border-slate-800 rounded-xl p-4">
            {lang === "en"
              ? "Sign in to save your long-term match history across devices. Your Weakness Radar above already tracks locally!"
              : lang === "es"
              ? "Inicia sesión para guardar tu historial de partidos. ¡Tu Radar de Debilidades ya funciona localmente!"
              : "Melde dich an, um deine langfristige Match-Historie geräteübergreifend zu speichern. Dein Schwächen-Radar oben arbeitet bereits live!"}
          </p>
        ) : matchAgg && matchAgg.totalMatches > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-slate-400">
                {lang === "en" ? "Matches" : "Spiele"}
              </div>
              <div className="text-xl font-black text-white mt-0.5">{matchAgg.totalMatches}</div>
            </div>
            <div className="bg-[#030611] border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-emerald-400">
                {lang === "en" ? "Win Rate" : "Siegquote"}
              </div>
              <div className="text-xl font-black text-emerald-300 mt-0.5">{matchAgg.winRate}%</div>
              <div className="text-[9px] text-slate-500 font-bold">
                {matchAgg.wins}S / {matchAgg.losses}N
              </div>
            </div>
            <div className="bg-[#030611] border border-cyan-500/30 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-cyan-400">
                {lang === "en" ? "Perfect %" : "Perfekt %"}
              </div>
              <div className="text-xl font-black text-cyan-300 mt-0.5">{matchAgg.perfectPct}%</div>
              <div className="text-[9px] text-slate-500 font-bold">
                {matchAgg.perfectShots}/{matchAgg.totalShots}
              </div>
            </div>
            <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-emerald-400">Winners</div>
              <div className="text-xl font-black text-white mt-0.5">{matchAgg.winners}</div>
            </div>
            <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-orange-400">
                {lang === "en" ? "Aces" : "Asse"}
              </div>
              <div className="text-xl font-black text-white mt-0.5">{matchAgg.aces}</div>
            </div>
            <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-red-400">
                {lang === "en" ? "Errors" : "Fehler"}
              </div>
              <div className="text-xl font-black text-white mt-0.5">{matchAgg.unforcedErrors}</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 bg-[#030611] border border-slate-800 rounded-xl p-4">
            {lang === "en"
              ? "No completed 3D matches yet. Finish your first match to see your full match breakdown here."
              : lang === "es"
              ? "Aún no hay partidos 3D completados. Termina tu primer partido para ver tus estadísticas aquí."
              : "Noch keine abgeschlossenen 3D-Matches. Sobald dein erstes Match vorbei ist, erscheinen hier Bilanz, Formkurve & Schlagquoten."}
          </p>
        )}
      </div>

      {/* 7. DIE 3 COACH-SÄULEN (DIREKT-SPRUNG) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onNavigateTab("trainer")}
          className="bg-[#050b18] hover:bg-cyan-950/30 border border-cyan-500/30 hover:border-cyan-400 rounded-xl p-4 text-left transition-all flex flex-col gap-1"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
            1. {lang === "en" ? "THEORY" : "THEORIE"}
          </span>
          <span className="text-sm font-black text-white">
            {lang === "en" ? "Tactic Trainer →" : "Taktik-Trainer →"}
          </span>
          <span className="text-[11px] text-slate-400">
            {lang === "en" ? "Build tactical foundations" : "Muster & Laufwege festigen"}
          </span>
        </button>

        <button
          onClick={() => onNavigateTab("game")}
          className="bg-[#050b18] hover:bg-orange-950/30 border border-orange-500/30 hover:border-orange-400 rounded-xl p-4 text-left transition-all flex flex-col gap-1"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
            2. {lang === "en" ? "PRACTICE" : "PRAXIS"}
          </span>
          <span className="text-sm font-black text-white">
            {lang === "en" ? "3D Match →" : "3D-Match →"}
          </span>
          <span className="text-[11px] text-slate-400">
            {lang === "en" ? "Apply tactics under pressure" : "Unter Druck umsetzen & testen"}
          </span>
        </button>

        <button
          onClick={() => onNavigateTab("board")}
          className="bg-[#050b18] hover:bg-purple-950/30 border border-purple-500/30 hover:border-purple-400 rounded-xl p-4 text-left transition-all flex flex-col gap-1"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
            3. {lang === "en" ? "ANALYSIS" : "ANALYSE"}
          </span>
          <span className="text-sm font-black text-white">
            {lang === "en" ? "Tactics Board →" : "TaktikBoard →"}
          </span>
          <span className="text-[11px] text-slate-400">
            {lang === "en" ? "Draw plays & analyze gaps" : "Spielzüge aufzeichnen & verstehen"}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

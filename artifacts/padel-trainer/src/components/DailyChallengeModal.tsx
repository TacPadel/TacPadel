import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import ScenarioCourt25 from "./ScenarioCourt25";
import { SCENARIOS } from "./Scenarios";
import { supabase } from "../lib/supabase";
import { useTranslation, formatShotName } from "../lib/i18n";

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE"];

interface DailyChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onRewardEarned: (points: number) => void;
}

// Berechnet anhand des Datums für alle Spieler exakt dasselbe Tages-Szenario
export function getDailyScenario() {
  const todayStr = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = (hash * 31 + todayStr.charCodeAt(i)) % 100000;
  }
  const pool = SCENARIOS.filter((s) => s.id >= 62);
  const activePool = pool.length > 0 ? pool : SCENARIOS;
  return activePool[hash % activePool.length];
}

export function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export default function DailyChallengeModal({
  isOpen,
  onClose,
  user,
  onRewardEarned,
}: DailyChallengeModalProps) {
  const { lang, t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  const isIOS = Capacitor.getPlatform() === "ios";

  const scenario = useMemo(() => getDailyScenario(), []);
  const todayStr = getTodayDateString();
  const storagePrefix = user?.id ? `_${user.id}` : "_guest";

  // Mehrsprachige Szenario-Texte (mit automatischem Fallback auf Deutsch)
  const scenarioDescription =
    (lang === "en" && (scenario as any)?.description_en) ||
    (lang === "es" && (scenario as any)?.description_es) ||
    scenario.description;

  const scenarioExplanation =
    (lang === "en" && (scenario as any)?.explanation_en) ||
    (lang === "es" && (scenario as any)?.explanation_es) ||
    scenario.explanation;

  // Eigener, komplett isolierter State (berührt NICHT den Taktik-Trainer!)
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isShotModalOpen, setIsShotModalOpen] = useState(false);

  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [wasSuccess, setWasSuccess] = useState(false);
  const [streak, setStreak] = useState(0);

  // Prüfen, ob heute schon gespielt wurde + Streak laden
  useEffect(() => {
    if (!isOpen) return;

    const savedDate = localStorage.getItem(`tacpadel_daily_date${storagePrefix}`) || user?.user_metadata?.daily_date;
    const savedResult = localStorage.getItem(`tacpadel_daily_result${storagePrefix}`) || user?.user_metadata?.daily_result;
    const savedStreak = parseInt(
      localStorage.getItem(`tacpadel_daily_streak${storagePrefix}`) || user?.user_metadata?.daily_streak || "0",
      10
    );

    setStreak(savedStreak);

    if (savedDate === todayStr) {
      setAlreadyCompleted(true);
      setHasSubmitted(true);
      setWasSuccess(savedResult === "won");
      setSelectedShot(scenario.validShots[0]);
      setSelectedZone(scenario.bestZones?.[0] || null);
      setSelectedLaufZone(scenario.laufZone || null);
    } else {
      setAlreadyCompleted(false);
      setHasSubmitted(false);
      setSelectedShot(null);
      setSelectedZone(null);
      setSelectedLaufZone(null);
    }
  }, [isOpen, todayStr, storagePrefix, user, scenario]);

  if (!isOpen || typeof document === "undefined") return null;

  const isShotCorrect = !!(
    selectedShot &&
    scenario.validShots.some(
      (valid) =>
        valid === selectedShot ||
        (selectedShot === "LOB" && valid.includes("LOB")) ||
        (selectedShot === "VOLLEY" && valid.includes("VOLLEY"))
    )
  );

  const isZoneCorrect = !!(selectedZone && (scenario.bestZones || []).includes(selectedZone));
  const isLaufZoneCorrect = !!(selectedLaufZone && scenario.laufZone === selectedLaufZone);

  const canSubmit = !hasSubmitted && !!selectedShot && !!selectedZone && !!selectedLaufZone;
  const isFullyCorrect = alreadyCompleted ? wasSuccess : (isShotCorrect && isZoneCorrect && isLaufZoneCorrect);

  const handleExecuteDaily = async () => {
    if (!canSubmit || alreadyCompleted) return;

    setHasSubmitted(true);
    const success = isShotCorrect && isZoneCorrect && isLaufZoneCorrect;
    setWasSuccess(success);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const lastPlayedDate = localStorage.getItem(`tacpadel_daily_date${storagePrefix}`) || user?.user_metadata?.daily_date;

    let newStreak = streak;
    if (success) {
      newStreak = lastPlayedDate === yesterdayStr ? streak + 1 : 1;
      onRewardEarned(150);
    } else {
      newStreak = 0;
    }

    setStreak(newStreak);
    const resultStr = success ? "won" : "lost";

    localStorage.setItem(`tacpadel_daily_date${storagePrefix}`, todayStr);
    localStorage.setItem(`tacpadel_daily_result${storagePrefix}`, resultStr);
    localStorage.setItem(`tacpadel_daily_streak${storagePrefix}`, newStreak.toString());

    if (user) {
      await supabase.auth.updateUser({
        data: {
          daily_date: todayStr,
          daily_result: resultStr,
          daily_streak: newStreak,
        },
      }).catch(() => {});
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] h-[100dvh] w-screen bg-[#02050d]/95 backdrop-blur-xl flex flex-col items-center justify-between px-2.5 sm:px-4 overflow-hidden select-none"
      style={{
        paddingTop: isNative
          ? isIOS
            ? "max(env(safe-area-inset-top, 0px), 52px)"
            : "max(env(safe-area-inset-top, 0px), 38px)"
          : "max(env(safe-area-inset-top, 0px), 12px)",
        paddingBottom: isNative
          ? isIOS
            ? "max(env(safe-area-inset-bottom, 0px), 24px)"
            : "max(env(safe-area-inset-bottom, 0px), 20px)"
          : "max(env(safe-area-inset-bottom, 0px), 12px)",
      }}
    >
      <div className="w-full max-w-4xl h-full flex flex-col gap-2 sm:gap-3">
        
        {/* KOMPAKTER KOMBI-HEADER INKL. BRIEFING */}
        <div className="shrink-0 bg-[#040914] border border-amber-500/40 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2 shadow-[0_0_25px_rgba(245,158,11,0.12)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                🔥
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest truncate">
                  {t("daily_title")}
                </h2>
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {t("daily_badge_info")}
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                  #{scenario.id}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] sm:text-xs font-black text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-1 rounded-lg">
                {streak}d 🔥
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-snug border-t border-slate-800/80 pt-1.5">
            {scenarioDescription}
          </p>
        </div>

        {/* 3D COURT */}
        <div className="flex-1 w-full min-h-0 bg-[#030611] rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <ScenarioCourt25
            level="Spielzug"
            positions={{
              you: scenario.positions.you,
              partner: scenario.positions.partner,
              opp1: scenario.positions.opp1,
              opp2: scenario.positions.opp2,
              ball: {
                side: scenario.positions.ball.side as "left" | "right",
                zone: scenario.positions.ball.zone,
                type: selectedShot || "Schlag",
              },
            }}
            selectedZone={selectedZone}
            hasSubmitted={hasSubmitted}
            bestZones={scenario.bestZones || []}
            acceptableZones={[]}
            onZoneClick={(zoneId: string) => {
              if (!hasSubmitted) setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
            }}
            profiMode={true}
            selectedLaufZone={selectedLaufZone}
            perfectLaufZone={hasSubmitted ? (scenario.laufZone || null) : null}
            acceptableLaufZones={[]}
            onLaufZoneClick={(zoneId: string) => {
              if (!hasSubmitted) setSelectedLaufZone((prev) => (prev === zoneId ? null : zoneId));
            }}
            activeChar="you"
            hitterId="you"
          />
        </div>

        {/* STEUERUNG ODER ERGEBNIS */}
        {!hasSubmitted ? (
          <div className="shrink-0 bg-[#050b18] border border-slate-700 p-2.5 sm:p-3.5 rounded-xl flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-center">
            <div className="grid grid-cols-3 gap-2 flex-1 w-full">
              <div className={`flex flex-col gap-0.5 p-2 rounded-lg border ${selectedLaufZone ? "border-purple-500/50 bg-purple-950/20" : "border-purple-500/30 bg-purple-950/10"}`}>
                <span className="text-[8px] font-black tracking-widest text-purple-400 uppercase">{t("trainer_step1_run")}</span>
                <span className="text-xs font-bold text-white truncate">{selectedLaufZone || "-"}</span>
              </div>

              <div className={`flex flex-col gap-0.5 p-2 rounded-lg border ${selectedZone ? "border-emerald-500/50 bg-emerald-950/20" : "border-emerald-500/30 bg-emerald-950/10"}`}>
                <span className="text-[8px] font-black tracking-widest text-emerald-400 uppercase">{t("trainer_step2_target")}</span>
                <span className="text-xs font-bold text-white truncate">{selectedZone || "-"}</span>
              </div>

              <div
                onClick={() => setIsShotModalOpen(true)}
                className={`flex flex-col gap-0.5 p-2 rounded-lg border cursor-pointer transition-all ${selectedShot ? "border-orange-500/50 bg-orange-950/20" : "border-orange-500/50 bg-orange-950/30 animate-pulse"}`}
              >
                <span className="text-[8px] font-black tracking-widest text-orange-400 uppercase">{t("daily_step3_shot")}</span>
                <span className="text-xs font-bold text-white truncate">
                  {selectedShot ? formatShotName(selectedShot, lang) : t("trainer_choose")}
                </span>
              </div>
            </div>

            <button
              onClick={handleExecuteDaily}
              disabled={!canSubmit}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-black font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:shadow-none transition-all"
            >
              {t("trainer_submit")}
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`shrink-0 p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isFullyCorrect
                ? "bg-emerald-950/40 border-emerald-500/50"
                : "bg-red-950/40 border-red-500/50"
            }`}
          >
            <div className="flex-1 text-center sm:text-left">
              <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-1 ${isFullyCorrect ? "text-emerald-400" : "text-red-400"}`}>
                {isFullyCorrect ? t("daily_res_won") : t("daily_res_lost")}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-snug mb-2 line-clamp-2 sm:line-clamp-none">
                {scenarioExplanation}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                <span className="bg-black/40 border border-slate-800 px-2 py-0.5 rounded text-[9px] font-bold text-slate-400 uppercase">
                  {t("trainer_badge_shot")} <b className="text-white">{scenario.validShots.map((s) => formatShotName(s, lang)).join(" / ")}</b>
                </span>
                <span className="bg-black/40 border border-slate-800 px-2 py-0.5 rounded text-[9px] font-bold text-slate-400 uppercase">
                  {t("trainer_badge_target")} <b className="text-white">{(scenario.bestZones || []).join(", ")}</b>
                </span>
                <span className="bg-black/40 border border-slate-800 px-2 py-0.5 rounded text-[9px] font-bold text-slate-400 uppercase">
                  {t("trainer_badge_run")} <b className="text-white">{scenario.laufZone}</b>
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-200 text-black font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
            >
              {t("daily_close_arrow")}
            </button>
          </motion.div>
        )}
      </div>

      {/* EIGENES SCHLAG-AUSWAHL-MODAL */}
      <AnimatePresence>
        {isShotModalOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[310] bg-[#050b18] border-t border-amber-500/50 p-6 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)]"
            style={{
              paddingBottom: isNative
                ? isIOS
                  ? "max(env(safe-area-inset-bottom, 0px), 28px)"
                  : "max(env(safe-area-inset-bottom, 0px), 24px)"
                : "24px",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black tracking-widest text-amber-400 uppercase">
                {t("trainer_shot_modal_q2")}
              </h3>
              <button onClick={() => setIsShotModalOpen(false)} className="text-xs text-slate-400 hover:text-white">
                {t("daily_close")}
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-2">
              {SHOTS.map((shot) => (
                <button
                  key={shot}
                  onClick={() => {
                    setSelectedShot(shot);
                    setIsShotModalOpen(false);
                  }}
                  className={`py-3.5 px-2 rounded-lg border text-xs font-black tracking-wider uppercase transition-all ${
                    selectedShot === shot
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {formatShotName(shot, lang)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
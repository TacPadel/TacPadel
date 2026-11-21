import React, { useState, useMemo, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import Navigation from "./components/Navigation";
import HomeView from "./components/HomeView";
import BasicsView from './components/Basics';
import { motion, AnimatePresence } from "framer-motion";
import TacticsBoard from "./components/TacticsBoard";
import ScenarioCourt, { PlayerPositions } from "./components/ScenarioCourt";
import { SCENARIOS, Scenario } from './components/Scenarios';
import { PADEL_DICTIONARY, CATEGORY_COLORS } from './components/Basics';
import GameScreen from './components/GameScreen';
import { usePoints } from './lib/usePoints';
import { useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabase';
import { useProgress, Level } from './lib/useProgress';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { DBPlayer } from "./components/HomeView";
import ProfileTab from './components/ProfileTab';
import CoachTab from './components/CoachTab';
import * as THREE from "three";
import ScenarioCourt25 from "./components/ScenarioCourt25";
import PublicProfileModal from "./components/PublicProfileModal";
import StrategyTrainer from "./components/StrategyTrainer";
import ShareCardModal, { ShareCardPayload } from "./components/ShareCardModal";
import RatingPromptModal, { shouldShowRatingPrompt } from "./components/RatingPromptModal";
import { useTranslation, formatLevelName, formatShotName } from "./lib/i18n";
import { recordTrainerAttempt, CoachSummary } from "./lib/tacticStats";

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE"];
const TRAINER_SEQUENCE: Level[] = ["Schlag", "Schlagrichtung", "Laufrichtung", "Spielzug"];
const CRASH_COURSE_STEPS: Level[] = ["Schlag", "Schlagrichtung", "Laufrichtung", "Spielzug"];
const CRASH_COURSE_BONUS_POINTS = 1500;

type Tab = "home" | "trainer" | "game" | "board" | "taktik" | "basics" | "login" | "profile" | "strategy" | "coach";

// Rotierende Aufgaben-Typen für den interaktiven Simulations-Modus
type SimTaskType = "shot" | "target" | "run" | "shot_target" | "shot_run" | "target_run" | "full";
const SIM_TASK_TYPES: SimTaskType[] = [
  "shot",
  "target",
  "run",
  "shot_target",
  "shot_run",
  "target_run",
  "full",
];

// Hilfsfunktion: Wählt für einen Crashkurs-Schritt einen passenden Szenario-Index im jeweiligen Level-Pool
function pickCrashCourseScenarioIndex(targetLevel: Level): number {
  const pool = SCENARIOS.filter((s) => {
    if (targetLevel === "Schlag") return s.id <= 10;
    if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30;
    if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
    if (targetLevel === "Spielzug") return s.id >= 62;
    return true;
  });

  const validIndices: number[] = [];
  pool.forEach((s, idx) => {
    const hasTarget = Array.isArray(s.bestZones) && s.bestZones.length > 0;
    const hasRun = Boolean(s.laufZone);
    if (targetLevel === "Schlag") validIndices.push(idx);
    else if (targetLevel === "Schlagrichtung" && hasTarget) validIndices.push(idx);
    else if (targetLevel === "Laufrichtung" && hasRun) validIndices.push(idx);
    else if (targetLevel === "Spielzug" && hasTarget && hasRun) validIndices.push(idx);
  });

  if (validIndices.length > 0) {
    return validIndices[Math.floor(Math.random() * validIndices.length)];
  }
  return pool.length > 0 ? Math.floor(Math.random() * pool.length) : 0;
}

// Prüft, ob ein Szenario die nötigen Felder für den jeweiligen Simulations-Aufgabentyp besitzt
function scenarioSupportsSimTask(s: Scenario, task: SimTaskType): boolean {
  const hasTarget = Array.isArray(s.bestZones) && s.bestZones.length > 0;
  const hasRun = Boolean(s.laufZone);
  if (task === "target" || task === "shot_target") return hasTarget;
  if (task === "run" || task === "shot_run") return hasRun;
  if (task === "target_run" || task === "full") return hasTarget && hasRun;
  return true;
}

// Wählt für die Simulation abwechslungsreich den nächsten Aufgabentyp + ein passendes Szenario
function rollNextSimulationRound(prevTask?: SimTaskType, prevScenarioId?: number): {
  globalIndex: number;
  taskType: SimTaskType;
  prefilledShot: string | null;
} {
  const availableTasks = prevTask
    ? SIM_TASK_TYPES.filter((t) => t !== prevTask)
    : SIM_TASK_TYPES;
  const nextTask = availableTasks[Math.floor(Math.random() * availableTasks.length)];

  const matchingScenarios = SCENARIOS.filter(
    (s) => scenarioSupportsSimTask(s, nextTask) && s.id !== prevScenarioId
  );
  const pool = matchingScenarios.length > 0 ? matchingScenarios : SCENARIOS;
  const chosenScenario = pool[Math.floor(Math.random() * pool.length)];
  const globalIndex = Math.max(0, SCENARIOS.findIndex((s) => s.id === chosenScenario.id));

  const shotIsGiven = nextTask === "target" || nextTask === "run" || nextTask === "target_run";
  const prefilledShot = shotIsGiven ? (chosenScenario.validShots[0] || "DRIVE") : null;

  return { globalIndex, taskType: nextTask, prefilledShot };
}

const get3DPosition = (zoneId: string, side: "left" | "right", yHeight: number = 0): THREE.Vector3 => {
  if (!zoneId || typeof zoneId !== "string" || zoneId.length < 2) {
    return new THREE.Vector3(0, yHeight, 0);
  }

  const letters = ["A", "B", "C", "D", "E"];
  const letter = zoneId[0].toUpperCase();
  const num = parseInt(zoneId[1]);
  const letterIdx = letters.indexOf(letter) !== -1 ? letters.indexOf(letter) : 2;

  let x = 8 - (letterIdx * 1.5);
  if (side === "left") x = -x;

  let z = 4 - ((num - 1) * 2);

  return new THREE.Vector3(x, yHeight, z);
};

const getTargetProgressionLevel = (scores: Record<string, number>, locked: Level[]): Level => {
  if ((scores["Spielzug"] || 0) >= 10) return "Simulation";

  for (const lvl of TRAINER_SEQUENCE) {
    const progUnlocked =
      lvl === "Schlag" ? true :
      lvl === "Schlagrichtung" ? (scores["Schlag"] || 0) >= 10 :
      lvl === "Laufrichtung" ? (scores["Schlagrichtung"] || 0) >= 10 :
      (scores["Laufrichtung"] || 0) >= 10;

    const isClosed = locked.includes(lvl) && lvl !== "Spielzug";
    if (progUnlocked && !isClosed) {
      return lvl;
    }
  }

  return "Spielzug";
};

function WelcomeModal({ user, onComplete }: { user: any, onComplete: () => void }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) return;
    setIsSaving(true);

    await supabase.auth.updateUser({ data: { display_name: username } });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('user_stats')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          display_name: username,
          avatar_url: session.user.user_metadata?.avatar_url || null
        }, { onConflict: 'id' });
    }

    setIsSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-card-border p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-6 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-primary" />

        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary text-4xl shadow-inner"></div>

        <div>
          <h2 className="text-3xl font-black text-primary mb-2">{t("welcome_title")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("welcome_text")}
          </p>
        </div>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("welcome_placeholder")}
          className="px-5 py-4 bg-background border-2 border-border focus:border-primary rounded-xl text-foreground text-center font-bold text-lg outline-none transition-all shadow-sm"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        <button
          onClick={handleSave}
          disabled={isSaving || !username.trim()}
          className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 mt-2"
        >
          {isSaving ? t("welcome_saving") : t("welcome_btn")}
        </button>
      </motion.div>
    </div>
  );
}

function TutorialModal({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#050b18] border border-cyan-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] max-w-lg w-full max-h-[82vh] overflow-y-auto flex flex-col gap-6 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

        <div className="text-center">
          <span className="text-4xl mb-2 block">🧠</span>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">{t("tut_title")}</h2>
          <p className="text-cyan-400 text-sm font-bold tracking-wider mt-1">{t("tut_subtitle")}</p>
        </div>

        <div className="flex flex-col gap-4 text-sm text-slate-300 mt-2">
          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">1</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step1_title")}</p>
              <p className="leading-snug">{t("tut_step1_desc")}</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">2</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step2_title")}</p>
              <p className="leading-snug mb-2">{t("tut_step2_desc")}</p>
              <ul className="flex flex-col gap-1 text-[11px] font-bold tracking-wider">
                <li className="text-orange-400">{t("tut_step2_b1")}</li>
                <li className="text-emerald-400">{t("tut_step2_b2")}</li>
                <li className="text-purple-400">{t("tut_step2_b3")}</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">3</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step3_title")}</p>
              <p className="leading-snug">{t("tut_step3_desc")}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full mt-2 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black text-sm tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
        >
          {t("tut_btn_start")}
        </button>
      </motion.div>
    </div>
  );
}

function GameLockedModal({
  solvedCount,
  requiredCount,
  onStartCrashCourse,
  onClose,
}: {
  solvedCount: number;
  requiredCount: number;
  onStartCrashCourse: () => void;
  onClose: () => void;
}) {
  const { lang, t } = useTranslation();
  const clampedSolved = Math.min(solvedCount, requiredCount);
  const progressPct = Math.round((clampedSolved / requiredCount) * 100);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#050b18] border border-orange-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_0_50px_rgba(249,115,22,0.2)] max-w-md w-full max-h-[86vh] overflow-y-auto flex flex-col gap-5 text-center relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-cyan-500" />

        <div className="w-16 h-16 rounded-2xl bg-orange-950/50 border border-orange-500/40 flex items-center justify-center mx-auto text-3xl shadow-[inset_0_0_15px_rgba(249,115,22,0.2)]">
          🔒
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
            {t("game_lock_title")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t("game_lock_desc")}
          </p>
        </div>

        {/* 4-Schritte-Übersicht + Fortschrittsbalken */}
        <div className="w-full bg-[#030611] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-400">{t("game_lock_progress")}</span>
            <span className="text-orange-400">
              {clampedSolved} / {requiredCount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-left">
            {CRASH_COURSE_STEPS.map((stepLvl, idx) => {
              const done = idx < clampedSolved;
              const isNext = idx === clampedSolved;
              return (
                <div
                  key={stepLvl}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 ${
                    done
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : isNext
                      ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-500"
                  }`}
                >
                  <span>{done ? "✓" : `${idx + 1}.`}</span>
                  <span className="truncate">{formatLevelName(stepLvl, lang)}</span>
                </div>
              );
            })}
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Bonus-Hinweis */}
        <div className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-[11px] font-bold text-emerald-300 leading-snug">
          🎁 {t("game_lock_bonus_hint")}
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          <button
            onClick={onStartCrashCourse}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black text-xs tracking-[0.16em] uppercase shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            {clampedSolved > 0 ? t("game_lock_btn_resume") : t("game_lock_btn_trainer")}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            {t("game_lock_btn_close")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GuestSignupPromptModal({
  onSignUp,
  onGoToGameTab,
  onClose,
}: {
  onSignUp: () => void;
  onGoToGameTab: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#050b18] border border-emerald-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.2)] max-w-md w-full max-h-[86vh] overflow-y-auto flex flex-col gap-5 text-center relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400" />

        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-[inset_0_0_15px_rgba(16,185,129,0.25)]">
            🏆
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 bg-amber-950/50 border border-amber-500/40 px-3 py-1 rounded-full">
            {t("guest_unlock_badge")}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
            {t("guest_unlock_title")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t("guest_unlock_desc")}
          </p>
        </div>

        <div className="w-full bg-[#030611] border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5 text-left text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 font-black">🎁</span>
            <span className="text-amber-200 font-bold">{t("guest_unlock_b1")}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-black">✓</span>
            <span>{t("guest_unlock_b2")}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-cyan-400 font-black">✓</span>
            <span>{t("guest_unlock_b3")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          <button
            onClick={onSignUp}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black rounded-xl font-black text-xs tracking-[0.14em] uppercase shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            {t("guest_unlock_btn_signup")}
          </button>
          <button
            onClick={onGoToGameTab}
            className="w-full py-3 bg-orange-950/40 hover:bg-orange-900/50 border border-orange-500/40 text-orange-300 rounded-xl font-black text-[11px] tracking-[0.15em] uppercase transition-all"
          >
            {t("guest_unlock_btn_game")}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            {t("guest_unlock_btn_later")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const updateSupabaseScore = async (newTotalPoints: number) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    const { error } = await supabase
      .from('user_stats')
      .upsert({
        id: session.user.id,
        email: session.user.email,
        points: newTotalPoints
      });

    if (error) {
      console.error("Fehler beim Speichern der Stats:", error);
    }
  }
};

function shuffleIndices(length: number, excludeFirst?: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (excludeFirst !== undefined && indices[0] === excludeFirst && indices.length > 1) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }
  return indices;
}

const getAdjacentZones = (zoneId: string) => {
  if (!zoneId) return [];
  const LETTERS = ["A", "B", "C", "D"];
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const neighbors = [];

  if (num > 1) neighbors.push(`${letter}${num - 1}`);
  if (num < 5) neighbors.push(`${letter}${num + 1}`);
  if (letterIdx > 0) neighbors.push(`${LETTERS[letterIdx - 1]}${num}`);
  if (letterIdx < LETTERS.length - 1) neighbors.push(`${LETTERS[letterIdx + 1]}${num}`);

  return neighbors;
};

export default function App(): React.JSX.Element {
  const { lang, t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;
    return savedTab ? savedTab : "home";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{type: 'error'|'success', text: string} | null>(null);

  const [selectedPublicUserId, setSelectedPublicUserId] = useState<string | null>(null);
  const [selectedPublicUserTab, setSelectedPublicUserTab] = useState<"single" | "tournament">("single");

  useEffect(() => {
    localStorage.setItem("tacpadel_activeTab", activeTab);
  }, [activeTab]);

  const [dbLeaderboard, setDbLeaderboard] = useState<DBPlayer[]>([]);
  const [dbSeasonLeaderboard, setDbSeasonLeaderboard] = useState<DBPlayer[]>([]);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      const { data: allData, error: errAll } = await supabase
        .from('user_stats')
        .select('id, email, points, tac_points, display_name, avatar_url')
        .order('points', { ascending: false })
        .limit(20);

      if (!errAll && allData) {
        const formattedAll = allData.map((user: any) => {
          const emailFallback = user.email ? user.email.split('@')[0] : t("player_fallback");
          const finalName = user.display_name && user.display_name.trim() !== ""
            ? user.display_name
            : emailFallback;

          return {
            id: user.id,
            name: finalName,
            score: user.points || 0,
            tacPoints: user.tac_points || 0,
            avatar_url: user.avatar_url
          };
        });
        setDbLeaderboard(formattedAll);
      }

      const { data: seasonData, error: errSeason } = await supabase
        .from('user_stats')
        .select('id, email, points, tac_points, display_name, avatar_url')
        .order('tac_points', { ascending: false })
        .limit(20);

      if (!errSeason && seasonData) {
        const formattedSeason = seasonData.map((user: any) => {
          const emailFallback = user.email ? user.email.split('@')[0] : t("player_fallback");
          const finalName = user.display_name && user.display_name.trim() !== ""
            ? user.display_name
            : emailFallback;

          return {
            id: user.id,
            name: finalName,
            score: user.tac_points || 0,
            tacPoints: user.tac_points || 0,
            avatar_url: user.avatar_url
          };
        });
        setDbSeasonLeaderboard(formattedSeason);
      }
    };

    fetchLeaderboards();
  }, []);

  const { points: totalPoints, addPoints } = usePoints();
  const { user, signOut } = useAuth();

  const [dbProfile, setDbProfile] = useState<{ display_name?: string, avatar_url?: string, tac_points?: number } | null>(null);

  useEffect(() => {
    if (user?.id) {
      const fetchDbProfile = async () => {
        const { data } = await supabase
          .from('user_stats')
          .select('display_name, avatar_url, tac_points')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setDbProfile(data);
        }
      };
      fetchDbProfile();
    } else {
      setDbProfile(null);
    }
  }, [user]);

  const finalUserName = dbProfile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gast";
  const finalAvatarUrl = dbProfile?.avatar_url || user?.user_metadata?.avatar_url;

  const {
    lockedLevels,
    setLockedLevels,
    highestScores,
    updateHighScore,
    activeSession,
    saveActiveSession,
    clearActiveSession,
    isProgressLoaded
  } = useProgress();

  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [level, setLevel] = useState<Level>("Schlag");
  const [simTaskType, setSimTaskType] = useState<SimTaskType>("full");

  // --- SCHWÄCHEN-COACH MODUS (Aus dem TacPadel Coach Dual-Radar gestartet) ---
  const [isWeaknessMode, setIsWeaknessMode] = useState(false);
  const [weaknessScenarios, setWeaknessScenarios] = useState<Scenario[]>([]);
  const [weaknessFocus, setWeaknessFocus] = useState<CoachSummary["recommendedTaskFocus"]>("full");

  // --- 4/4 GÄSTE-CRASHKURS & 1500-TACSCORE-STARTBONUS ---
  const [isCrashCourse, setIsCrashCourse] = useState(false);
  const [crashCourseStep, setCrashCourseStep] = useState(0);
  const [crashCourseProgress, setCrashCourseProgress] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("tacpadel_guest_crashcourse_progress") || "0", 10);
    return isNaN(saved) ? 0 : Math.min(saved, CRASH_COURSE_STEPS.length);
  });
  const [crashCourseDone, setCrashCourseDone] = useState<boolean>(
    () => localStorage.getItem("tacpadel_guest_crashcourse_done") === "true"
  );
  const [showGameLockedModal, setShowGameLockedModal] = useState(false);
  const [showGameUnlockedToast, setShowGameUnlockedToast] = useState(false);
  const [showBonusClaimedToast, setShowBonusClaimedToast] = useState(false);
  const [pendingGuestSignupPrompt, setPendingGuestSignupPrompt] = useState(false);
  const [showGuestSignupModal, setShowGuestSignupModal] = useState(false);

  const isSimulation = !isCrashCourse && !isWeaknessMode && (level as string) === "Simulation";
  const maxScore = isCrashCourse
    ? CRASH_COURSE_STEPS.length
    : isWeaknessMode
    ? Math.max(1, weaknessScenarios.length)
    : 10;

  const [[currentScenarioIndex, rotationPool], setRotation] = useState<[number, number[]]>(() => {
    const initialCount = SCENARIOS.filter(s => s.id <= 10).length;
    const pool = shuffleIndices(initialCount);
    return [pool[0], pool.slice(1)];
  });

  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [wrongPool, setWrongPool] = useState<number[]>([]);
  const [isRetryPhase, setIsRetryPhase] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const [masteredShots, setMasteredShots] = useState<Set<string>>(new Set());

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [hasRestored, setHasRestored] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Share-Card & Store-Rating Modals
  const [sharePayload, setSharePayload] = useState<ShareCardPayload | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Trennung: Eingeloggte Nutzer kommen direkt in den Game-Tab (dort greift die 1500-TacScore-Hürde).
  // Gäste schalten den Game-Tab über den 4/4-Crashkurs frei.
  const isGameUnlocked = Boolean(user) || crashCourseDone;

  // Startet gezieltes 10-Runden-Training aus dem TacPadel Coach (Trainer + Match kombiniert)
  const startWeaknessTraining = (
    pool: Scenario[],
    focus: CoachSummary["recommendedTaskFocus"] = "full"
  ) => {
    if (!pool || pool.length === 0) return;
    setIsCrashCourse(false);
    setIsWeaknessMode(true);
    setWeaknessScenarios(pool);
    setWeaknessFocus(focus);
    setRotation([0, pool.slice(1).map((_, idx) => idx + 1)]);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setScore(0);
    setRoundsPlayed(0);
    setWrongPool([]);
    setIsRetryPhase(false);
    setGameOver(false);
    setShowRetryBanner(false);
    setFeedbackMsg(null);
    setAttempts(0);
    setActiveTab("trainer");
  };

  // Startet (oder setzt fort) den 4-Schritte-Crashkurs für Gäste
  const startGuestCrashCourse = () => {
    const startStep = Math.min(crashCourseProgress, CRASH_COURSE_STEPS.length - 1);
    const stepLevel = CRASH_COURSE_STEPS[startStep];
    const scenarioIdx = pickCrashCourseScenarioIndex(stepLevel);

    setShowGameLockedModal(false);
    setIsWeaknessMode(false);
    setIsCrashCourse(true);
    setCrashCourseStep(startStep);
    setLevel(stepLevel);
    setRotation([scenarioIdx, []]);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setScore(startStep);
    setRoundsPlayed(startStep);
    setWrongPool([]);
    setIsRetryPhase(false);
    setGameOver(false);
    setShowRetryBanner(false);
    setFeedbackMsg(null);
    setAttempts(0);
    setActiveTab("trainer");
  };

  // Zentraler Tab-Wechsler: blockiert "game" für Gäste vor Abschluss des 4/4-Crashkurses
  const handleTabChange = (nextTab: Tab) => {
    if (nextTab === "game" && !isGameUnlocked) {
      setShowGameLockedModal(true);
      return;
    }

    if (nextTab === "game" && !user && pendingGuestSignupPrompt) {
      setPendingGuestSignupPrompt(false);
      sessionStorage.setItem("tacpadel_guest_signup_shown", "true");
      setShowGuestSignupModal(true);
      return;
    }

    if (nextTab !== "trainer" && isCrashCourse) {
      setIsCrashCourse(false);
    }

    if (nextTab !== "trainer" && isWeaknessMode) {
      setIsWeaknessMode(false);
    }

    setActiveTab(nextTab);
  };

  // Sicherheitsnetz: Falls "game" aus localStorage geladen wurde, aber für den Gast gesperrt ist
  useEffect(() => {
    if (isProgressLoaded && activeTab === "game" && !isGameUnlocked) {
      setActiveTab("home");
    }
  }, [isProgressLoaded, activeTab, isGameUnlocked]);

  // Schreibt den 1.500-TacScore-Startbonus automatisch gut, sobald ein Crashkurs-Absolvent sich registriert/anmeldet
  useEffect(() => {
    const claimCrashCourseBonus = async () => {
      if (!user?.id) return;
      if (localStorage.getItem("tacpadel_pending_crashcourse_bonus") !== "true") return;

      // Flag sofort entfernen, damit der Bonus nicht mehrfach vergeben wird
      localStorage.removeItem("tacpadel_pending_crashcourse_bonus");
      localStorage.setItem("tacpadel_guest_crashcourse_done", "true");
      setCrashCourseDone(true);
      setIsCrashCourse(false);

      const { data: existing } = await supabase
        .from("user_stats")
        .select("points")
        .eq("id", user.id)
        .maybeSingle();

      const currentDbPoints = existing?.points || 0;
      if (currentDbPoints < CRASH_COURSE_BONUS_POINTS) {
        const diff = CRASH_COURSE_BONUS_POINTS - currentDbPoints;
        localStorage.setItem("tacpadel_score", String(CRASH_COURSE_BONUS_POINTS));

        await supabase
          .from("user_stats")
          .upsert(
            {
              id: user.id,
              email: user.email,
              points: CRASH_COURSE_BONUS_POINTS,
            },
            { onConflict: "id" }
          );

        addPoints(diff);
        setShowBonusClaimedToast(true);
        setTimeout(() => setShowBonusClaimedToast(false), 5000);
      }
    };

    claimCrashCourseBonus();
  }, [user]);

  // Öffnet ein per Link geteiltes Szenario direkt im Taktik-Trainer (?scenario=ID)
  const openSharedScenarioById = (targetId: number): boolean => {
    const foundScenario = SCENARIOS.find((s) => s.id === targetId);
    if (!foundScenario) return false;

    let targetLevel: Level = "Schlag";
    if (foundScenario.id >= 62) targetLevel = "Spielzug";
    else if (foundScenario.id >= 31) targetLevel = "Laufrichtung";
    else if (foundScenario.id >= 11) targetLevel = "Schlagrichtung";

    const pool = SCENARIOS.filter((s) => {
      if (targetLevel === "Schlag") return s.id <= 10;
      if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30;
      if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
      return s.id >= 62;
    });

    const localIdx = Math.max(0, pool.findIndex((s) => s.id === foundScenario.id));
    const rest = shuffleIndices(pool.length)
      .filter((i) => i !== localIdx)
      .slice(0, 9);

    setIsCrashCourse(false);
    setIsWeaknessMode(false);
    setLevel(targetLevel);
    setRotation([localIdx, rest]);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setScore(0);
    setRoundsPlayed(0);
    setWrongPool([]);
    setIsRetryPhase(false);
    setGameOver(false);
    setShowRetryBanner(false);
    setFeedbackMsg(null);
    setAttempts(0);
    setActiveTab("trainer");
    return true;
  };

  // Prüft beim App-Start sofort auf ?scenario=ID (funktioniert für Gäste & eingeloggte Spieler)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedScenarioParam = urlParams.get("scenario");
    if (sharedScenarioParam) {
      const targetId = parseInt(sharedScenarioParam, 10);
      if (!isNaN(targetId) && openSharedScenarioById(targetId)) {
        setHasRestored(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // Bewertungs-Moment nach einem erfolgreich abgeschlossenen Taktik-Level
  useEffect(() => {
    if (gameOver && shouldShowRatingPrompt()) {
      const timer = setTimeout(() => {
        setShowRatingModal(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [gameOver]);

  // Easy-Mode ist überall (auch in der Simulation) fest aktiv;
  // Trainer-Korrektur-Modus ist in den 4 Lern-Modi, im Crashkurs & im Schwächen-Modus aktiv und in der Simulation deaktiviert.
  const activeEasyMode = true;
  const activeCorrectionMode = !isSimulation;

  // Aktuelles Szenario im Schwächen-Modus (für dynamische Fokus-Anforderungen)
  const activeWeaknessScenario = isWeaknessMode
    ? (weaknessScenarios[currentScenarioIndex] || weaknessScenarios[0] || null)
    : null;
  const weaknessHasTarget = Boolean(
    activeWeaknessScenario &&
    Array.isArray(activeWeaknessScenario.bestZones) &&
    activeWeaknessScenario.bestZones.length > 0
  );
  const weaknessHasRun = Boolean(activeWeaknessScenario && activeWeaknessScenario.laufZone);

  // Dynamische Anforderungen je nach Level, Schwächen-Fokus bzw. Simulations-Aufgabe
  const needsRun = isWeaknessMode
    ? (weaknessFocus === "positioning" || weaknessFocus === "full") && weaknessHasRun
    : isSimulation
    ? ["run", "shot_run", "target_run", "full"].includes(simTaskType)
    : level === "Laufrichtung" || level === "Spielzug";

  const needsTarget = isWeaknessMode
    ? (weaknessFocus === "placement" ||
        weaknessFocus === "full" ||
        (weaknessFocus === "positioning" && !weaknessHasRun)) &&
      weaknessHasTarget
    : isSimulation
    ? ["target", "shot_target", "target_run", "full"].includes(simTaskType)
    : level === "Schlagrichtung" || level === "Spielzug";

  const needsShot = isWeaknessMode
    ? true
    : isSimulation
    ? ["shot", "shot_target", "shot_run", "full"].includes(simTaskType)
    : true;

  // Übersetzt den aktuellen Aufgabentyp in das passende Court-Layout für ScenarioCourt25
  const effectiveCourtLevel: Level = (isSimulation || isWeaknessMode)
    ? needsRun && needsTarget
      ? "Spielzug"
      : needsTarget
      ? "Schlagrichtung"
      : needsRun
      ? "Laufrichtung"
      : "Schlag"
    : level;

  // Kurzes Badge für den Schwächen-Coach Fokus
  const weaknessFocusBadgeText = useMemo(() => {
    if (!isWeaknessMode) return "";
    if (lang === "en") {
      switch (weaknessFocus) {
        case "positioning": return "🎯 COACH FOCUS: POSITIONING";
        case "placement": return "🎯 COACH FOCUS: TARGET PLACEMENT";
        case "shotChoice": return "🎯 COACH FOCUS: SHOT CHOICE";
        default: return "🎯 COACH FOCUS: FULL TACTICS";
      }
    }
    if (lang === "es") {
      switch (weaknessFocus) {
        case "positioning": return "🎯 ENFOQUE COACH: POSICIÓN";
        case "placement": return "🎯 ENFOQUE COACH: PRECISIÓN";
        case "shotChoice": return "🎯 ENFOQUE COACH: ELECCIÓN DE GOLPE";
        default: return "🎯 ENFOQUE COACH: TÁCTICA COMPLETA";
      }
    }
    switch (weaknessFocus) {
      case "positioning": return "🎯 COACH-FOKUS: STELLUNGSSPIEL";
      case "placement": return "🎯 COACH-FOKUS: PLATZIERUNG";
      case "shotChoice": return "🎯 COACH-FOKUS: SCHLAGWAHL";
      default: return "🎯 COACH-FOKUS: KOMPLETTER SPIELZUG";
    }
  }, [isWeaknessMode, weaknessFocus, lang]);

  // Kurzes Badge + Erklärungstext für die aktuelle Simulations-Aufgabe
  const simTaskBadgeText = useMemo(() => {
    if (!isSimulation) return "";
    if (lang === "en") {
      switch (simTaskType) {
        case "shot": return "⚡ TASK: SHOT ONLY";
        case "target": return "🎯 TASK: TARGET ONLY";
        case "run": return "🏃 TASK: RUN ZONE ONLY";
        case "shot_target": return "🔥 COMBO: TARGET & SHOT";
        case "shot_run": return "🔥 COMBO: RUN & SHOT";
        case "target_run": return "🔥 COMBO: RUN & TARGET";
        default: return "👑 FULL MOVE (ALL 3)";
      }
    }
    if (lang === "es") {
      switch (simTaskType) {
        case "shot": return "⚡ TAREA: SOLO GOLPE";
        case "target": return "🎯 TAREA: SOLO DESTINO";
        case "run": return "🏃 TAREA: SOLO CARRERA";
        case "shot_target": return "🔥 COMBO: DESTINO Y GOLPE";
        case "shot_run": return "🔥 COMBO: CARRERA Y GOLPE";
        case "target_run": return "🔥 COMBO: CARRERA Y DESTINO";
        default: return "👑 JUGADA COMPLETA (LOS 3)";
      }
    }
    switch (simTaskType) {
      case "shot": return "⚡ AUFGABE: NUR SCHLAG WÄHLEN";
      case "target": return "🎯 AUFGABE: NUR SCHLAGZIEL";
      case "run": return "🏃 AUFGABE: NUR LAUFWEG";
      case "shot_target": return "🔥 KOMBI: SCHLAGZIEL & SCHLAG";
      case "shot_run": return "🔥 KOMBI: LAUFWEG & SCHLAG";
      case "target_run": return "🔥 KOMBI: LAUFWEG & SCHLAGZIEL";
      default: return "👑 KOMPLETTER SPIELZUG (ALLE 3)";
    }
  }, [isSimulation, simTaskType, lang]);

  const isProgressionUnlocked = (l: string) => {
    if (l === "Schlag") return true;
    if (l === "Schlagrichtung") return (highestScores["Schlag"] || 0) >= 10;
    if (l === "Laufrichtung") return (highestScores["Schlagrichtung"] || 0) >= 10;
    if (l === "Spielzug") return (highestScores["Laufrichtung"] || 0) >= 10;
    return true;
  };

  useEffect(() => {
    const handleGuestUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        localStorage.removeItem("tacpadel_savegame");
        localStorage.removeItem("tacpadel_tour_stamina");
        localStorage.removeItem("tacpadel_score");
        localStorage.removeItem("tacpadel_tac_points");
        clearActiveSession();
      }
    };
    window.addEventListener("beforeunload", handleGuestUnload);
    return () => window.removeEventListener("beforeunload", handleGuestUnload);
  }, [clearActiveSession]);

  useEffect(() => {
    if (user && !user.user_metadata?.display_name) {
      const hasSeen = sessionStorage.getItem('hasSeenWelcome');
      if (!hasSeen) {
        setShowWelcome(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "trainer") {
      const hasSeen = localStorage.getItem('tacpadel_hasSeenTrainerTutorial');
      if (!hasSeen) {
        setShowTutorial(true);
      }
    }
  }, [activeTab]);

  const handleWelcomeComplete = () => {
    sessionStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
  };

  const handleTutorialComplete = () => {
    localStorage.setItem('tacpadel_hasSeenTrainerTutorial', 'true');
    setShowTutorial(false);
  };

  const initPoolForLevel = (targetLevel: Level) => {
    const isNewSim = (targetLevel as string) === "Simulation";
    const filteredPool = SCENARIOS.filter(s => {
      if (targetLevel === "Schlag") return s.id <= 10;
      if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30;
      if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
      if (targetLevel === "Spielzug") return s.id >= 62;
      if (isNewSim) return true;
      return true;
    });

    if (isNewSim) {
      const nextSim = rollNextSimulationRound();
      setSimTaskType(nextSim.taskType);
      setRotation([nextSim.globalIndex, []]);
      setSelectedShot(nextSim.prefilledShot);
    } else {
      const allIndices = shuffleIndices(filteredPool.length);
      const maxQ = 10;
      const limitedIndices = allIndices.slice(0, maxQ);
      setRotation([limitedIndices[0], limitedIndices.slice(1)]);
      setSelectedShot(null);
    }
  };

  useEffect(() => {
    if (isProgressLoaded && !hasRestored) {
      const syncedLocks = new Set<Level>(lockedLevels);

      if ((highestScores["Spielzug"] || 0) < 10) {
        syncedLocks.add("Simulation");
      } else {
        syncedLocks.delete("Simulation");
      }

      const isCurrentlyReplayingUnlocked =
        activeSession &&
        activeSession.score > 0 &&
        activeSession.score < 10 &&
        !lockedLevels.includes(activeSession.level);

      (["Schlag", "Schlagrichtung", "Laufrichtung"] as Level[]).forEach((lvl) => {
        if ((highestScores[lvl] || 0) >= 10) {
          if (!(isCurrentlyReplayingUnlocked && activeSession?.level === lvl)) {
            syncedLocks.add(lvl);
          }
        }
      });

      const finalLocks = Array.from(syncedLocks);
      if (
        finalLocks.length !== lockedLevels.length ||
        finalLocks.some((l) => !lockedLevels.includes(l))
      ) {
        setLockedLevels(finalLocks);
      }

      const hasValidActiveSession =
        activeSession &&
        user &&
        !(
          activeSession.level !== "Spielzug" &&
          activeSession.level !== "Simulation" &&
          finalLocks.includes(activeSession.level) &&
          (activeSession.score || 0) === 0
        );

      if (hasValidActiveSession) {
        setLevel(activeSession.level);
        if ((activeSession.level as string) === "Simulation") {
          const nextSim = rollNextSimulationRound();
          setSimTaskType(nextSim.taskType);
          setRotation([nextSim.globalIndex, []]);
          setSelectedShot(nextSim.prefilledShot);
          setScore(activeSession.score || 0);
        } else {
          setScore(Math.min(activeSession.score, 10));
          setRotation([activeSession.currentScenarioIndex, (activeSession.rotationPool || []).slice(0, 10)]);
          setSelectedShot(activeSession.selectedShot || null);
        }
        setWrongPool(activeSession.wrongPool || []);
        setIsRetryPhase(activeSession.isRetryPhase || false);
        setRoundsPlayed(activeSession.roundsPlayed || 0);
        setHasSubmitted(activeSession.hasSubmitted || false);
        setSelectedZone(activeSession.selectedZone || null);
        setSelectedLaufZone(activeSession.selectedLaufZone || null);
        setAttempts(activeSession.attempts || 0);
        setFeedbackMsg(activeSession.feedbackMsg || null);
      } else {
        const targetLvl = getTargetProgressionLevel(highestScores, finalLocks);
        setLevel(targetLvl);
        initPoolForLevel(targetLvl);
        if (!user) {
          clearActiveSession();
        }
      }

      setHasRestored(true);
    }
  }, [isProgressLoaded, activeSession, hasRestored, user, highestScores, lockedLevels, setLockedLevels, clearActiveSession]);

  useEffect(() => {
    if (hasRestored && user && !gameOver && !isCrashCourse && !isWeaknessMode) {
      saveActiveSession({
        level,
        score,
        currentScenarioIndex,
        rotationPool,
        wrongPool,
        isRetryPhase,
        roundsPlayed,
        hasSubmitted,
        selectedShot,
        selectedZone,
        selectedLaufZone,
        attempts,
        feedbackMsg
      });
    }
    if (gameOver && hasRestored && !isWeaknessMode) {
      clearActiveSession();
    }
  }, [level, score, hasSubmitted, currentScenarioIndex, hasRestored, user, gameOver, isCrashCourse, isWeaknessMode]);

  useEffect(() => {
    if (user && activeTab === "login") {
      const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;

      if (savedTab && savedTab !== "login") {
        setActiveTab(savedTab);
      } else {
        setActiveTab("home");
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    const channel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setDbLeaderboard(prev => prev.map(p =>
          p.id === payload.new.id ? { ...p, score: payload.new.score } : p
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const isNativeApp = Capacitor.isNativePlatform();

    const handleDeepLink = async (url: string) => {
      // Szenario-Challenge Deep-Link (z. B. ?scenario=42)
      if (url.includes('scenario=')) {
        const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
        const scenarioParam = new URLSearchParams(queryPart).get('scenario');
        if (scenarioParam) {
          const targetId = parseInt(scenarioParam, 10);
          if (!isNaN(targetId)) {
            openSharedScenarioById(targetId);
            setHasRestored(true);
            return;
          }
        }
      }

      if (url.includes('access_token=') || url.includes('code=')) {
        if (isNativeApp) {
          try { await Browser.close(); } catch (e) {}
        }

        const hashPart = url.includes('#') ? url.split('#')[1] : '';
        const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';

        const hashParams = new URLSearchParams(hashPart);
        const queryParams = new URLSearchParams(queryPart);

        const code = queryParams.get('code') || hashParams.get('code');
        const access_token = hashParams.get('access_token') || queryParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        try {
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        } catch (e: any) {
          console.error("Fehler bei Session: " + e.message);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (isNativeApp) {
          try { Browser.close(); } catch (e) {}
        }

        setTimeout(() => {
          const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;

          if (savedTab && savedTab !== "login") {
            setActiveTab(savedTab);
          } else {
            setActiveTab("home");
          }
        }, 800);
      }
    });

    let appListener: any;

    if (isNativeApp) {
      CapacitorApp.addListener('appUrlOpen', (event) => {
        handleDeepLink(event.url);
      }).then(listener => { appListener = listener; });

      CapacitorApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl?.url) handleDeepLink(launchUrl.url);
      });
    }

    return () => {
      if (appListener) appListener.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    const isNative = Capacitor.isNativePlatform();

    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      }
    });

    if (error) {
      setAuthMsg({ type: 'error', text: t("login_err_google") + error.message });
      return;
    }

    if (data?.url) {
      if (isNative) {
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    }
  };

  const handleAppleLogin = async () => {
    const isNative = Capacitor.isNativePlatform();

    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      }
    });

    if (error) {
      setAuthMsg({ type: 'error', text: t("login_err_apple") + error.message });
      return;
    }

    if (data?.url) {
      if (isNative) {
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMsg(null);

    const isNative = Capacitor.isNativePlatform();
    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });
      if (error) {
        setAuthMsg({ type: 'error', text: error.message });
      } else {
        setAuthMsg({ type: 'success', text: t("login_success_signup") });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMsg({ type: 'error', text: t("login_err_credentials") });
      }
    }
    setAuthLoading(false);
  };

  const filteredScenarios = useMemo(() => {
    if (isWeaknessMode && weaknessScenarios.length > 0) return weaknessScenarios;
    if (level === "Schlag") return SCENARIOS.filter(s => s.id <= 10);
    if (level === "Schlagrichtung") return SCENARIOS.filter(s => s.id >= 1 && s.id <= 30);
    if (level === "Laufrichtung") return SCENARIOS.filter(s => s.id >= 31 && s.id <= 61);
    if (level === "Spielzug") return SCENARIOS.filter(s => s.id >= 62);
    if (isSimulation) return SCENARIOS;
    return SCENARIOS;
  }, [level, isSimulation, isWeaknessMode, weaknessScenarios]);

  const scenario = filteredScenarios[currentScenarioIndex] || filteredScenarios[0];

  const scenarioDescription =
    (lang === "en" && (scenario as any)?.description_en) ||
    (lang === "es" && (scenario as any)?.description_es) ||
    scenario.description;

  const scenarioExplanation =
    (lang === "en" && (scenario as any)?.explanation_en) ||
    (lang === "es" && (scenario as any)?.explanation_es) ||
    scenario.explanation;

  // Easy-Mode (3er-Auswahl) gilt für alle Trainings-Modi und die Simulation
  const visibleShots = useMemo(() => {
    if (activeEasyMode && scenario) {
      const correctShot = scenario.validShots[0];
      const otherShots = SHOTS.filter(s => !scenario.validShots.includes(s));
      const shuffledOthers = [...otherShots].sort(() => Math.random() - 0.5);
      const reducedShots = [correctShot, ...shuffledOthers.slice(0, 2)].sort(() => Math.random() - 0.5);
      return reducedShots;
    }
    return SHOTS;
  }, [activeEasyMode, scenario]);

  const acceptableZones = useMemo(() => {
    if (!scenario || !activeEasyMode || !scenario.bestZones) return [];
    let neighbors: string[] = [];
    scenario.bestZones.forEach((zone) => {
      neighbors.push(...getAdjacentZones(zone));
    });
    return Array.from(new Set(neighbors)).filter(z => !scenario.bestZones.includes(z));
  }, [scenario, activeEasyMode]);

  const acceptableLaufZones = useMemo(() => {
    if (!scenario || !scenario.laufZone || !activeEasyMode) return [];
    const neighbors = getAdjacentZones(scenario.laufZone);
    return neighbors.filter(z => z !== scenario.laufZone);
  }, [scenario, activeEasyMode]);

  const handleShotClick = (shot: string) => {
    if (hasSubmitted || !needsShot) return;
    setSelectedShot((prev) => (prev === shot ? null : shot));
    setFeedbackMsg(null);
  };

  const handleZoneClick = (zoneId: string) => {
    if (hasSubmitted || !needsTarget) return;
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
    setFeedbackMsg(null);
  };

  const handleLaufZoneClick = (zoneId: string) => {
    if (hasSubmitted || !needsRun) return;
    setSelectedLaufZone((prev) => (prev === zoneId ? null : zoneId));
    setFeedbackMsg(null);
  };

  const isShotCorrect = !needsShot || !!(
    selectedShot &&
    scenario.validShots.some(
      (valid) =>
        valid === selectedShot ||
        (selectedShot === "LOB" && valid.includes("LOB")) ||
        (selectedShot === "VOLLEY" && valid.includes("VOLLEY"))
    )
  );

  const isZoneExact = !needsTarget || !!(selectedZone && (scenario.bestZones || []).includes(selectedZone));
  const isZoneAcceptableOnly = needsTarget && !isZoneExact && !!(selectedZone && acceptableZones.includes(selectedZone));
  const isZoneCorrect = isZoneExact || isZoneAcceptableOnly;

  const isLaufZoneExact = !needsRun || !!(selectedLaufZone && scenario.laufZone === selectedLaufZone);
  const isLaufZoneAcceptableOnly = needsRun && !isLaufZoneExact && !!(selectedLaufZone && acceptableLaufZones.includes(selectedLaufZone));
  const isLaufZoneCorrect = isLaufZoneExact || isLaufZoneAcceptableOnly;

  const canSubmit = (() => {
    if (hasSubmitted) return false;
    if (needsShot && !selectedShot) return false;
    if (needsTarget && !selectedZone) return false;
    if (needsRun && !selectedLaufZone) return false;
    return true;
  })();

  const isFullyCorrect = isShotCorrect && isZoneCorrect && isLaufZoneCorrect;

  const isPartiallyCorrect = !isFullyCorrect && (
    (needsShot && isShotCorrect) ||
    (needsTarget && isZoneCorrect) ||
    (needsRun && isLaufZoneCorrect)
  );

  const handleSubmit = () => {
    if (!canSubmit) return;

    const currentAttempt = attempts + 1;
    setAttempts(currentAttempt);

    // 🎯 Taktik-Coach Tracking: Nur den 1. Versuch ehrlich fürs Dual-Radar zählen
    if (currentAttempt === 1 && scenario) {
      recordTrainerAttempt({
        userId: user?.id,
        scenarioId: scenario.id,
        primaryShot: scenario.validShots[0] || "DRIVE",
        needsShot,
        needsTarget,
        needsRun,
        isShotCorrect,
        isZoneCorrect: isZoneExact,
        isZoneAcceptable: isZoneAcceptableOnly,
        isLaufZoneCorrect: isLaufZoneExact,
        isLaufZoneAcceptable: isLaufZoneAcceptableOnly,
        isFullyCorrect,
      });
    }

    if (isFullyCorrect) {
      setHasSubmitted(true);
      setFeedbackMsg(null);

      // --- SPEZIALFALL: 4/4 GÄSTE-CRASHKURS ---
      if (isCrashCourse) {
        const completedSteps = crashCourseStep + 1;
        setScore(completedSteps);
        setRoundsPlayed(completedSteps);

        const nextProgress = Math.max(crashCourseProgress, completedSteps);
        setCrashCourseProgress(nextProgress);
        localStorage.setItem("tacpadel_guest_crashcourse_progress", String(nextProgress));

        if (completedSteps >= CRASH_COURSE_STEPS.length) {
          setCrashCourseDone(true);
          localStorage.setItem("tacpadel_guest_crashcourse_done", "true");
          localStorage.setItem("tacpadel_pending_crashcourse_bonus", "true");
          setShowGameUnlockedToast(true);
          setTimeout(() => setShowGameUnlockedToast(false), 4500);

          if (!user && !sessionStorage.getItem("tacpadel_guest_signup_shown")) {
            setPendingGuestSignupPrompt(true);
          }
        }
        return;
      }

      const newScore = score + 1;
      setScore(newScore);
      if (!isWeaknessMode) {
        updateHighScore(level, newScore);
      }

      setRoundsPlayed((r) => r + 1);

      // Punkte-Ausbeute:
      // - Schwächen-Coach: 40 Pkt. (1. Versuch) / 20 Pkt. (ab 2. Versuch)
      // - Simulation: +20 Punkte
      // - Schlag: 100 Pkt. (1. Versuch) / 50 Pkt. (ab 2. Versuch)
      // - Ab Schlagrichtung (Schlagrichtung, Laufrichtung, Spielzug): 50 Pkt. (1. Versuch) / 25 Pkt. (ab 2. Versuch)
      let pointsEarned = 0;
      if (isWeaknessMode) {
        pointsEarned = currentAttempt === 1 ? 40 : 20;
      } else if (isSimulation) {
        pointsEarned = 20;
      } else if (level === "Schlag") {
        pointsEarned = currentAttempt === 1 ? 100 : 50;
      } else {
        pointsEarned = currentAttempt === 1 ? 50 : 25;
      }

      if (user) {
        const newTotal = totalPoints + pointsEarned;
        addPoints(pointsEarned);
        updateSupabaseScore(newTotal);
      }

      if (!isWeaknessMode && level === "Schlag" && scenario.validShots.length === 1) {
        setMasteredShots((prev) => new Set([...prev, scenario.validShots[0]]));
      }
    } else {
      // Minuspunkte (-20) erst ab Simulation
      if (isSimulation && user) {
        const newTotal = Math.max(0, totalPoints - 20);
        addPoints(-20);
        updateSupabaseScore(newTotal);

        const unlockable = lockedLevels.filter(l => l !== "Simulation");
        if (newTotal < 1500 && unlockable.length > 0) {
          setShowUnlockModal(true);
        }
      }

      if (activeCorrectionMode) {
        let errors = [];
        if (needsShot && !isShotCorrect) errors.push(t("trainer_err_shot"));
        if (needsTarget && !isZoneCorrect) errors.push(t("trainer_err_target"));
        if (needsRun && !isLaufZoneCorrect) errors.push(t("trainer_err_run"));

        setFeedbackMsg(`${t("trainer_feedback_prefix")}${errors.join(t("trainer_err_and"))}.`);
      } else {
        setHasSubmitted(true);
        setWrongPool((prev) => [...prev, currentScenarioIndex]);
        setRoundsPlayed((r) => r + 1);
      }
    }
  };

  const nextRound = () => {
    // --- SPEZIALFALL: 4/4 GÄSTE-CRASHKURS ---
    if (isCrashCourse) {
      const nextStep = crashCourseStep + 1;
      if (nextStep < CRASH_COURSE_STEPS.length) {
        const nextLevel = CRASH_COURSE_STEPS[nextStep];
        const nextIdx = pickCrashCourseScenarioIndex(nextLevel);
        setCrashCourseStep(nextStep);
        setLevel(nextLevel);
        setRotation([nextIdx, []]);
        setSelectedShot(null);
        setSelectedZone(null);
        setSelectedLaufZone(null);
        setHasSubmitted(false);
        setFeedbackMsg(null);
        setAttempts(0);
        return;
      }

      // Alle 4 Schritte abgeschlossen → Crashkurs beenden & Gäste-Einladung mit 1500-Bonus zeigen
      setIsCrashCourse(false);
      setLevel("Schlag");
      initPoolForLevel("Schlag");
      setSelectedZone(null);
      setSelectedLaufZone(null);
      setHasSubmitted(false);
      setScore(0);
      setRoundsPlayed(0);
      setFeedbackMsg(null);
      setAttempts(0);

      if (!user && pendingGuestSignupPrompt) {
        setPendingGuestSignupPrompt(false);
        sessionStorage.setItem("tacpadel_guest_signup_shown", "true");
        setShowGuestSignupModal(true);
      }
      return;
    }

    if (isSimulation) {
      const nextSim = rollNextSimulationRound(simTaskType, scenario?.id);
      setSimTaskType(nextSim.taskType);
      setSelectedShot(nextSim.prefilledShot);
      setSelectedZone(null);
      setSelectedLaufZone(null);
      setHasSubmitted(false);
      setFeedbackMsg(null);
      setAttempts(0);

      setRotation([nextSim.globalIndex, []]);
      return;
    }

    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setFeedbackMsg(null);
    setAttempts(0);

    const targetScore = isWeaknessMode ? maxScore : 10;

    if (score < targetScore && rotationPool.length > 0) {
      setRotation([rotationPool[0], rotationPool.slice(1)]);
      return;
    }

    if (score < targetScore && wrongPool.length > 0) {
      const retryIndices = shuffleIndices(wrongPool.length).map((i) => wrongPool[i]);
      const [next, ...rest] = retryIndices;

      setRotation([next, rest]);
      setWrongPool([]);
      setIsRetryPhase(true);
      setShowRetryBanner(true);
      return;
    }

    if (score < targetScore) {
      const needed = targetScore - score;
      const freshIndices = shuffleIndices(filteredScenarios.length, currentScenarioIndex).slice(0, needed);
      setRotation([freshIndices[0], freshIndices.slice(1)]);
      return;
    }

    if (isWeaknessMode) {
      setGameOver(true);
      return;
    }

    updateHighScore(level, targetScore);
    setGameOver(true);

    if (level === "Spielzug") {
      setLockedLevels(prev => prev.filter(l => l !== "Simulation"));
    } else if (level === "Schlag" || level === "Schlagrichtung" || level === "Laufrichtung") {
      setLockedLevels(prev => prev.includes(level) ? prev : [...prev, level]);
    }
  };

  const handleLevelChange = (newLevel: Level, force: boolean = false) => {
    const wasWeakness = isWeaknessMode;
    if (isCrashCourse) setIsCrashCourse(false);
    if (isWeaknessMode) setIsWeaknessMode(false);
    if (newLevel === level && !force && !gameOver && !wasWeakness) return;
    clearActiveSession();
    setLevel(newLevel);

    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setScore(0);
    setRoundsPlayed(0);
    setWrongPool([]);
    setIsRetryPhase(false);
    setGameOver(false);
    setShowRetryBanner(false);
    setFeedbackMsg(null);
    setAttempts(0);

    initPoolForLevel(newLevel);
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.clear();
    sessionStorage.clear();
    clearActiveSession();
    setIsCrashCourse(false);
    setIsWeaknessMode(false);
    setWeaknessScenarios([]);
    setCrashCourseStep(0);
    setCrashCourseProgress(0);
    setCrashCourseDone(false);
    setPendingGuestSignupPrompt(false);
    setLevel("Schlag");
    setScore(0);
    setAttempts(0);
    setRoundsPlayed(0);
    setHasSubmitted(false);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setGameOver(false);
    setIsRetryPhase(false);
    setFeedbackMsg(null);
    setWrongPool([]);
    window.location.reload();
  };

  const isNative = Capacitor.isNativePlatform();
  const isIOS = Capacitor.getPlatform() === "ios";

  return (
  <div className="min-h-[100dvh] w-full text-foreground flex flex-col items-center font-sans isolate relative">

    {/* OPTISCHE STATUSLEISTEN-TRENNUNG FÜR NATIVE APPS */}
    {isNative && (
      <div
        className="w-full bg-[#010206] border-b border-slate-900/80 shrink-0 z-10"
        style={{
          height: isIOS
            ? "max(env(safe-area-inset-top, 0px), 44px)"
            : "max(env(safe-area-inset-top, 0px), 24px)"
        }}
      />
    )}

    <header className="w-full max-w-4xl flex justify-between items-center px-4 py-2.5 z-10 bg-background/50 backdrop-blur-md border-b border-border/40 shrink-0">
      <button
        onClick={() => handleTabChange("coach")}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all active:scale-95 ${
          activeTab === "coach"
            ? "bg-cyan-950/70 border-cyan-400/70 shadow-[0_0_16px_rgba(6,182,212,0.35)]"
            : "bg-slate-900/60 border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-950/30"
        }`}
        title="TacPadel Coach"
      >
        <span className="font-black text-base sm:text-lg tracking-wider text-primary leading-none">
          TacPadel
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/25 to-orange-500/25 border border-cyan-400/40 text-cyan-300 leading-none">
          COACH
        </span>
      </button>

      <div>
        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange("profile")}
              className="text-muted-foreground hover:text-primary transition-colors font-semibold flex items-center gap-2.5 group"
            >
              {finalAvatarUrl ? (
                <img
                  src={finalAvatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-primary/20 group-hover:border-primary/50 transition-colors shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  👤
                </div>
              )}

              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {finalUserName === "Gast" ? t("guest_name") : finalUserName}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg font-bold hover:bg-red-500/20 transition-all ml-2"
            >
              {t("header_logout")}
            </button>
          </div>
        ) : (
          activeTab !== "login" && (
            <button
              onClick={() => handleTabChange("login")}
              className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              {t("header_login")}
            </button>
          )
        )}
      </div>
    </header>

      {/* Hintergrundbild fest in den tiefsten Hintergrund (-z-10) legen */}
      <div className="fixed inset-0 pointer-events-none -z-10 flex items-center justify-center opacity-40 mix-blend-screen">
        <img
          src={"/background_app.png"}
          alt="Tactical Background"
          className="w-[95%] max-w-2xl h-auto object-contain select-none"
        />
      </div>
      <SplashScreen />

      {/* --- PUBLIC PROFILE MODAL --- */}
      <AnimatePresence>
        {selectedPublicUserId && (
          <PublicProfileModal
            userId={selectedPublicUserId}
            defaultTab={selectedPublicUserTab}
            onClose={() => setSelectedPublicUserId(null)}
          />
        )}
      </AnimatePresence>

      {/* --- UNLOCK MODAL --- */}
      <AnimatePresence>
        {showUnlockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-12 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-card-border p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">📉</span>
              </div>
              <h2 className="text-2xl font-bold text-destructive">{t("unlock_title")}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t("unlock_desc")}
              </p>
              <div className="flex flex-col gap-3 mt-4">
                {lockedLevels.filter(lvl => lvl !== "Simulation").map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setLockedLevels(prev => prev.filter(l => l !== lvl));
                      setShowUnlockModal(false);
                      handleLevelChange(lvl, true);
                    }}
                    className="px-4 py-3.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow flex items-center justify-between"
                  >
                    <span>{formatLevelName(lvl, lang)}</span>
                    <span className="text-emerald-400">{t("unlock_btn")}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- WILLKOMMENS MODAL --- */}
      <AnimatePresence>
        {showWelcome && user && (
          <WelcomeModal user={user} onComplete={handleWelcomeComplete} />
        )}
      </AnimatePresence>

      {/* --- TUTORIAL MODAL --- */}
      <AnimatePresence>
        {showTutorial && (
          <TutorialModal onComplete={handleTutorialComplete} />
        )}
      </AnimatePresence>

      {/* --- GAME LOCKED MODAL (NUR FÜR GÄSTE VOR 4/4 CRASHKURS) --- */}
      <AnimatePresence>
        {showGameLockedModal && !user && (
          <GameLockedModal
            solvedCount={crashCourseProgress}
            requiredCount={CRASH_COURSE_STEPS.length}
            onClose={() => setShowGameLockedModal(false)}
            onStartCrashCourse={startGuestCrashCourse}
          />
        )}
      </AnimatePresence>

      {/* --- GÄSTE-EINLADUNG MIT 1.500 TACSCORE STARTBONUS --- */}
      <AnimatePresence>
        {showGuestSignupModal && !user && (
          <GuestSignupPromptModal
            onSignUp={() => {
              setShowGuestSignupModal(false);
              setIsSignUp(true);
              setActiveTab("login");
            }}
            onGoToGameTab={() => {
              setShowGuestSignupModal(false);
              setActiveTab("game");
            }}
            onClose={() => setShowGuestSignupModal(false)}
          />
        )}
      </AnimatePresence>

      {/* --- FREISCHALT-TOAST NACH 4/4 CRASHKURS --- */}
      <AnimatePresence>
        {showGameUnlockedToast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[180] w-[92%] max-w-md bg-[#050b18]/95 border border-emerald-400/60 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2.5 text-center"
          >
            <span className="text-lg">🔓</span>
            <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
              {t("game_unlocked_toast")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BONUS-TOAST NACH REGISTRIERUNG (+1.500 TACSCORE) --- */}
      <AnimatePresence>
        {showBonusClaimedToast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[180] w-[92%] max-w-md bg-[#050b18]/95 border border-amber-400/70 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2.5 text-center"
          >
            <span className="text-lg">🎁</span>
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
              {t("bonus_claimed_toast")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tech-Shell wieder mit relative z-10 über das Hintergrundbild legen */}
      <div className="flex-grow w-full tech-shell flex flex-col items-center p-3 sm:p-4 pb-28 lg:p-8 rounded-none border-x-0 sm:rounded-xl sm:border-x bg-transparent relative z-10">

        <div className="max-w-4xl w-full flex flex-col gap-4 sm:gap-6">

          <AnimatePresence mode="wait">

            {/* --- TAB: TACPADEL COACH (STATISTIKEN, DUAL-RADAR & SCHWÄCHEN-TRAINING) --- */}
            {activeTab === "coach" && (
              <CoachTab
                key="coach-page"
                userId={user?.id}
                userName={finalUserName === "Gast" ? t("guest_name") : finalUserName}
                totalPoints={user ? totalPoints : 0}
                onStartWeaknessTraining={startWeaknessTraining}
                onNavigateTab={(target) => handleTabChange(target)}
              />
            )}

            {/* --- TAB 1: HOME --- */}
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <HomeView
                  setActiveTab={handleTabChange}
                  isGameUnlocked={isGameUnlocked}
                  gameUnlockProgress={crashCourseDone ? CRASH_COURSE_STEPS.length : crashCourseProgress}
                  gameUnlockRequired={CRASH_COURSE_STEPS.length}
                  currentScore={user ? totalPoints : 0}
                  onDailyReward={(pts) => { if (user) { addPoints(pts); updateSupabaseScore(totalPoints + pts); } }}
                  currentTacPoints={user ? (dbProfile?.tac_points || 0) : 0}
                  userName={finalUserName}
                  userEmail={user?.email || ""}
                  userAvatar={finalAvatarUrl}
                  dbLeaderboard={dbLeaderboard.length > 0 ? dbLeaderboard : undefined}
                  dbSeasonLeaderboard={dbSeasonLeaderboard.length > 0 ? dbSeasonLeaderboard : undefined}
                  onPlayerClick={(id, listType) => {
                    setSelectedPublicUserId(id);
                    setSelectedPublicUserTab(listType === "season" ? "tournament" : "single");
                  }}
                  onQuickStart={(specificIndex?: number) => {
                    setIsCrashCourse(false);
                    setIsWeaknessMode(false);
                    if ((highestScores["Spielzug"] || 0) >= 10) {
                      handleLevelChange("Simulation" as Level, true);
                      setActiveTab("trainer");
                      return;
                    }

                    if (typeof specificIndex === 'number') {
                      const targetScenario = SCENARIOS[specificIndex];

                      let targetLevel: Level = "Schlag";
                      if (targetScenario.id >= 62) targetLevel = "Spielzug";
                      else if (targetScenario.id >= 31) targetLevel = "Laufrichtung";
                      else if (targetScenario.id >= 11) targetLevel = "Schlagrichtung";

                      setLevel(targetLevel);

                      const filteredPool = SCENARIOS.filter(s => {
                        if (targetLevel === "Schlag") return s.id <= 10;
                        if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30;
                        if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
                        if (targetLevel === "Spielzug") return s.id >= 62;
                        return true;
                      });

                      const localIndex = filteredPool.findIndex(s => s.id === targetScenario.id);

                      if (localIndex !== -1) {
                        const allIndices = shuffleIndices(filteredPool.length);
                        const poolWithoutTarget = allIndices.filter(i => i !== localIndex);
                        const maxQuestions = 10;
                        const limitedIndices = [localIndex, ...poolWithoutTarget].slice(0, maxQuestions);

                        setRotation([limitedIndices[0], limitedIndices.slice(1)]);
                      }

                      setSelectedShot(null);
                      setSelectedZone(null);
                      setSelectedLaufZone(null);
                      setHasSubmitted(false);
                      setScore(0);
                      setRoundsPlayed(0);
                      setWrongPool([]);
                      setIsRetryPhase(false);
                      setGameOver(false);
                      setShowRetryBanner(false);
                      setFeedbackMsg(null);
                      setAttempts(0);
                    } else {
                      const nextOpenLevel = getTargetProgressionLevel(highestScores, lockedLevels);
                      handleLevelChange(nextOpenLevel, true);
                    }
                    setActiveTab("trainer");
                  }}
                />
              </motion.div>
            )}

            {/* --- NEUER TAB: STRATEGIE MODUS --- */}
            {activeTab === "strategy" && (
              <motion.div
                key="strategy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-[1400px] mx-auto"
              >
                <StrategyTrainer
                  onBack={() => setActiveTab("trainer")}
                  onStrategyComplete={(points) => {
                    if (user) {
                      const newTotal = totalPoints + points;
                      addPoints(points);
                      updateSupabaseScore(newTotal);
                    }
                  }}
                />
              </motion.div>
            )}

            {/* --- BASICS --- */}
            {activeTab === "basics" && (
              <BasicsView setActiveTab={handleTabChange as any} />
            )}

            {/* --- TRAINER TAB --- */}
            {activeTab === "trainer" && (
              <motion.div
                key="trainer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[1400px] mx-auto flex flex-col gap-4 text-slate-200 font-sans select-none pb-18"
              >
                {/* 1. MASTER DASHBOARD */}
                <div className="w-full bg-[#040914]/90 border border-orange-900/50 backdrop-blur-md p-4 lg:p-5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden mt-2">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/80 to-transparent" />

                  <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                    <div className="flex items-center justify-between lg:justify-start lg:gap-8 w-full lg:w-auto">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm lg:text-base font-bold text-orange-500 tracking-widest uppercase">
                            {isWeaknessMode
                              ? (lang === "en" ? "🎯 WEAKNESS COACH" : lang === "es" ? "🎯 COACH DE DEBILIDADES" : "🎯 SCHWÄCHEN-COACH")
                              : isCrashCourse
                              ? t("crashcourse_title")
                              : t("trainer_title")}
                          </span>
                          <button
                            onClick={() => setShowTutorial(true)}
                            className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-700 hover:text-white transition-colors"
                            title={t("trainer_tutorial_tooltip")}
                          >
                            ❓
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end lg:items-start pl-4 lg:pl-6 lg:border-l border-slate-700/50">
                        <span className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-0.5">
                          {isCrashCourse || isWeaknessMode ? t("game_lock_progress") : t("trainer_total_score")}
                        </span>
                        <div className="text-xl lg:text-2xl leading-none font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                          {isCrashCourse
                            ? `${score} / ${CRASH_COURSE_STEPS.length}`
                            : isWeaknessMode
                            ? `${score} / ${maxScore}`
                            : (user ? totalPoints : 0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 w-full lg:w-auto pt-3 lg:pt-0 border-t border-slate-800 lg:border-none">
                      {isWeaknessMode ? (
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                          <span className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-orange-950/50 border border-orange-500/50 text-orange-300">
                            {weaknessFocusBadgeText}
                          </span>
                          <button
                            onClick={() => {
                              setIsWeaknessMode(false);
                              setActiveTab("coach");
                            }}
                            className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            {lang === "en" ? "← Back to Coach" : lang === "es" ? "← Volver al Coach" : "← Zurück zum Coach"}
                          </button>
                        </div>
                      ) : isCrashCourse ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2 w-full lg:w-auto">
                          {CRASH_COURSE_STEPS.map((lvl, idx) => {
                            const isDone = idx < crashCourseStep || (idx === crashCourseStep && hasSubmitted && isFullyCorrect);
                            const isCurrent = idx === crashCourseStep && !isDone;
                            return (
                              <div
                                key={lvl}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                                  isDone
                                    ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                                    : isCurrent
                                    ? "bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                                    : "bg-slate-900/40 border-slate-800 text-slate-500"
                                }`}
                              >
                                <span>{isDone ? "✓" : `${idx + 1}.`}</span>
                                <span>{formatLevelName(lvl, lang)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap">

                          {(highestScores["Spielzug"] || 0) < 10 ? (
                            (["Schlag", "Schlagrichtung", "Laufrichtung", "Spielzug"] as const).map((lvl) => {
                              const isPenaltyLocked = lockedLevels.includes(lvl as any) && lvl !== "Spielzug";
                              const isProgLocked = !isProgressionUnlocked(lvl);
                              const isLocked = isPenaltyLocked || isProgLocked;
                              const isActive = level === lvl;
                              return (
                                <button
                                  key={lvl}
                                  onClick={() => !isLocked && handleLevelChange(lvl as any)}
                                  disabled={isLocked}
                                  className={`flex items-center justify-center lg:justify-between gap-2 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    isActive
                                      ? "bg-cyan-950/60 border border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                                      : isLocked
                                        ? "bg-slate-900/50 border border-slate-800/50 text-slate-600 cursor-not-allowed"
                                        : "bg-slate-900/30 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  <span>{formatLevelName(lvl, lang)}</span>
                                  {isLocked && <span className="text-slate-600">🔒</span>}
                                </button>
                              );
                            })
                          ) : (
                            <button
                              onClick={() => handleLevelChange("Simulation" as Level)}
                              className={`col-span-2 sm:col-span-4 lg:w-auto px-4 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                                isSimulation
                                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-purple-400 animate-pulse"
                                  : "bg-purple-950/40 border border-purple-800 text-purple-300 hover:bg-purple-900/60"
                              }`}
                            >
                              <span>{t("trainer_pro_rallye")}</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveTab("strategy")}
                            className="col-span-2 sm:col-span-4 lg:w-auto px-4 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-pink-400 hover:scale-105"
                          >
                            <span>{t("trainer_strategies")}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-start gap-3">
                    <div className="flex flex-col w-full gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {isWeaknessMode
                            ? (lang === "en"
                              ? "Targeted coach drill built from your Trainer & 3D Match weaknesses."
                              : lang === "es"
                              ? "Entrenamiento personalizado según tus debilidades del Entrenador y del Partido 3D."
                              : "Gezieltes Coach-Training basierend auf deinen Lücken aus Trainer & 3D-Match.")
                            : isSimulation ? t("trainer_hint_sim") :
                            level === "Spielzug" ? t("trainer_hint_spielzug") :
                            level === "Laufrichtung" ? t("trainer_hint_lauf") :
                            level === "Schlag" ? t("trainer_hint_schlag") :
                            t("trainer_hint_default")}
                        </p>

                        {isSimulation && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                            {simTaskBadgeText}
                          </span>
                        )}

                        {isCrashCourse && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/50 text-amber-300">
                            🚀 {t("crashcourse_step_label")} {crashCourseStep + 1} / {CRASH_COURSE_STEPS.length}
                          </span>
                        )}
                      </div>

                      {feedbackMsg && !hasSubmitted && (
                        <div className="mt-1 text-[10px] font-bold text-red-400 px-2 py-1 bg-red-950/30 border border-red-900/50 rounded animate-pulse self-start">
                          ⚠️ {feedbackMsg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* MOBILE BRIEFING */}
                <div className="lg:hidden w-full bg-[#050b18]/80 border border-slate-800 rounded-xl p-4 shadow-lg mt-1">
                  <div className="flex justify-between items-center mb-1.5 gap-2">
                    <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">{t("trainer_scenario_label")} {scenario.id}</h3>
                    <span className="text-[10px] font-bold text-purple-400 truncate">
                      {isWeaknessMode ? weaknessFocusBadgeText : isSimulation ? simTaskBadgeText : formatLevelName(level, lang)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 leading-snug mb-4">{scenarioDescription}</p>

                  <div className="mt-auto pt-3 border-t border-slate-800/50">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                        {isWeaknessMode
                          ? (lang === "en" ? "Weakness Drill" : lang === "es" ? "Drill de Debilidades" : "Schwächen-Drill")
                          : isCrashCourse ? t("crashcourse_title") : isSimulation ? t("trainer_progress_sim") : t("trainer_progress_lvl")}
                      </span>
                      <span className="text-xs font-black text-white">
                        {isSimulation ? `Serie: ${score} (+20 / -20)` : `${score} / ${maxScore}`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full shadow-[0_0_8px_rgba(6,182,212,0.8)] ${isWeaknessMode ? 'bg-orange-500' : isCrashCourse ? 'bg-amber-400' : isSimulation ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: isSimulation ? "100%" : `${(score / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* CORE WORKSPACE */}
                <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-5 items-start">

                  <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 order-3 lg:order-1 w-full h-full">
                    <div className="flex flex-col bg-[#050b18]/80 border border-slate-800 rounded-xl p-5 shadow-lg relative h-full">
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 rounded-l-xl shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                      <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">{t("trainer_briefing")}</h3>
                      <div className="flex items-end gap-3 mb-3">
                        <span className="text-5xl font-black text-white leading-none">{scenario.id}</span>
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider pb-1">
                          {isWeaknessMode ? "Coach" : formatLevelName(level, lang)}
                        </span>
                      </div>
                      {isSimulation && (
                        <div className="mb-3 px-2.5 py-1 rounded bg-purple-950/50 border border-purple-500/40 text-[10px] font-black text-purple-300 uppercase tracking-wider self-start">
                          {simTaskBadgeText}
                        </div>
                      )}
                      {isWeaknessMode && (
                        <div className="mb-3 px-2.5 py-1 rounded bg-orange-950/50 border border-orange-500/40 text-[10px] font-black text-orange-300 uppercase tracking-wider self-start">
                          {weaknessFocusBadgeText}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-8 flex-1">{scenarioDescription}</p>

                      <div className="mt-auto">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                            {isWeaknessMode
                              ? (lang === "en" ? "Weakness Drill" : lang === "es" ? "Drill de Debilidades" : "Schwächen-Drill")
                              : isCrashCourse ? t("crashcourse_title") : isSimulation ? t("trainer_progress_sim") : t("trainer_progress_lvl")}
                          </span>
                          <span className="text-xs font-black text-white">
                            {isSimulation ? `Serie: ${score} (+20 / -20)` : `${score} / ${maxScore}`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full shadow-[0_0_8px_rgba(6,182,212,0.8)] ${isWeaknessMode ? 'bg-orange-500' : isCrashCourse ? 'bg-amber-400' : isSimulation ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: isSimulation ? "100%" : `${(score / maxScore) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 order-1 lg:order-2 w-full h-[55vh] min-h-[450px] lg:h-[650px] bg-[#030611] rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden p-1 lg:p-2">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

                    <div className="absolute inset-0 w-full h-full pb-1 lg:pb-2">
                      <ScenarioCourt25
                        level={effectiveCourtLevel as any}
                        positions={{
                          you: scenario.positions.you,
                          partner: scenario.positions.partner,
                          opp1: scenario.positions.opp1,
                          opp2: scenario.positions.opp2,
                          ball: {
                            side: scenario.positions.ball.side as "left" | "right",
                            zone: scenario.positions.ball.zone,
                            type: selectedShot || "Schlag"
                          }
                        }}
                        selectedZone={needsTarget ? selectedZone : null}
                        hasSubmitted={hasSubmitted}
                        bestZones={needsTarget ? (scenario.bestZones || []) : []}
                        acceptableZones={needsTarget ? acceptableZones : []}
                        onZoneClick={(zoneId: string) => { if (needsTarget) handleZoneClick(zoneId); }}
                        profiMode={effectiveCourtLevel === "Spielzug" || effectiveCourtLevel === "Laufrichtung" || isSimulation}
                        selectedLaufZone={needsRun ? selectedLaufZone : null}
                        perfectLaufZone={hasSubmitted && needsRun ? (scenario.laufZone || null) : null}
                        acceptableLaufZones={needsRun ? acceptableLaufZones : []}
                        onLaufZoneClick={handleLaufZoneClick}
                        activeChar="you"
                        hitterId="you"
                        feedbackMsg={feedbackMsg}
                      />
                    </div>
                  </div>
                </div>

                {/* ACTION BAR */}
                {!gameOver && !hasSubmitted && (
                  <div className="fixed bottom-24 lg:sticky lg:bottom-4 left-4 right-4 lg:left-auto lg:right-auto z-40 w-auto lg:w-full bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-3 lg:p-4 rounded-xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] mt-2">
                    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-center">
                      <div className="grid grid-cols-3 gap-2 lg:gap-4 flex-1 w-full">

                        {/* 1. LAUFZONE */}
                        <div className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-colors ${needsRun ? (selectedLaufZone ? 'border-purple-500/50 bg-purple-950/20' : 'border-purple-500/40 bg-purple-950/20 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)] animate-pulse') : 'border-slate-800/50 bg-slate-900/20 opacity-40'}`}>
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-purple-400 uppercase">{t("trainer_step1_run")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">{!needsRun ? "-" : selectedLaufZone ? selectedLaufZone : t("trainer_choose")}</span>
                        </div>

                        {/* 2. SCHLAGZIEL */}
                        <div className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-colors ${needsTarget ? (selectedZone ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-emerald-500/40 bg-emerald-950/20 shadow-[inset_0_0_15px_rgba(16,185,129,0.15)] animate-pulse') : 'border-slate-800/50 bg-slate-900/20 opacity-40'}`}>
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-emerald-400 uppercase">{t("trainer_step2_target")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">{!needsTarget ? "-" : selectedZone ? selectedZone : t("trainer_choose")}</span>
                        </div>

                        {/* 3. SCHLAG (Klickbar wenn gesucht, oder mit 🔒 vorgegeben bei reinen Richtungs-Aufgaben) */}
                        <div
                          onClick={() => { if (needsShot) setIsShotModalOpen(true); }}
                          className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-all ${
                            needsShot
                              ? selectedShot
                                ? 'border-orange-500/50 bg-orange-950/20 cursor-pointer hover:scale-[1.02] active:scale-95'
                                : 'border-orange-500/50 bg-orange-950/30 shadow-[0_0_15px_rgba(255,119,0,0.2)] animate-pulse cursor-pointer hover:scale-[1.02] active:scale-95'
                              : 'border-amber-500/30 bg-amber-950/15 opacity-90 cursor-default'
                          }`}
                        >
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-orange-400 uppercase">{t("trainer_step3_shot")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">
                            {!needsShot && selectedShot
                              ? `🔒 ${formatShotName(selectedShot, lang)}`
                              : selectedShot
                              ? formatShotName(selectedShot, lang)
                              : t("trainer_choose")}
                          </span>
                        </div>

                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full lg:w-1/3 py-3 lg:py-5 bg-gradient-to-r from-cyan-600 to-cyan-600 hover:from-cyan-500 hover:to-cyan-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-white font-black text-xs lg:text-sm tracking-[0.2em] uppercase rounded-lg lg:rounded-xl shadow-[0_0_20px_rgba(255,119,0,0.3)] disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all duration-200 border border-cyan-400/50 disabled:border-slate-800"
                      >
                        {t("trainer_submit")}
                      </button>
                    </div>
                  </div>
                )}

                {/* SHOT MODAL */}
                <AnimatePresence>
                  {isShotModalOpen && (
                    <motion.div
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, info) => {
                        if (info.offset.y > 100) {
                          setIsShotModalOpen(false);
                        }
                      }}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className={`fixed ${
                        typeof window !== "undefined" &&
                        window.innerWidth >= 740 &&
                        window.innerWidth <= 1100 &&
                        window.innerHeight >= 900
                          ? "bottom-28"
                          : "bottom-20 lg:bottom-6"
                      } left-3 right-3 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[70] bg-[#050b18] border border-orange-500/40 p-5 rounded-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.95)] flex flex-col max-h-[75vh] touch-none`}
                    >
                      <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 cursor-grab active:cursor-grabbing" />

                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-black tracking-widest text-orange-400 uppercase">
                          {t("trainer_shot_modal_q1")}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar pb-2">
                        {visibleShots.map((shot) => {
                          const isSelected = selectedShot === shot;
                          let btnStyle = isSelected
                            ? "bg-orange-600/20 border-orange-500 text-orange-300 shadow-[0_0_10px_rgba(255,119,0,0.2)]"
                            : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60";

                          return (
                            <button
                              key={shot}
                              disabled={hasSubmitted}
                              onClick={() => {
                                handleShotClick(shot);
                                setIsShotModalOpen(false);
                              }}
                              className={`w-full flex items-center justify-center py-4 px-1 rounded-lg border text-xs font-black tracking-wider uppercase transition-all duration-200 text-center ${btnStyle}`}
                            >
                              {formatShotName(shot, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* RESULT OVERLAY */}
                <AnimatePresence>
                  {hasSubmitted && !gameOver && (
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                      className={`fixed ${
                        typeof window !== "undefined" &&
                        window.innerWidth >= 740 &&
                        window.innerWidth <= 1100 &&
                        window.innerHeight >= 900
                          ? "bottom-28"
                          : "bottom-24 lg:bottom-6"
                      } left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-5xl z-50 bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-4 sm:p-6 rounded-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.9)]`}
                    >
                      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="flex-1 text-center md:text-left flex flex-col gap-2">
                          <h3 className={`text-xl font-black uppercase tracking-widest ${
                            isFullyCorrect ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                            isPartiallyCorrect ? "text-amber-400" : "text-red-500"
                          }`}>
                            {isFullyCorrect
                              ? isSimulation
                                ? `${t("trainer_res_perfect_play")} (+20)`
                                : level === "Spielzug" || isWeaknessMode
                                ? t("trainer_res_perfect_play")
                                : t("trainer_res_success")
                              : isPartiallyCorrect
                              ? `${t("trainer_res_partial")}${isSimulation ? " (-20)" : ""}`
                              : `${t("trainer_res_wrong")}${isSimulation ? " (-20)" : ""}`}
                          </h3>
                          <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
                            {scenarioExplanation}
                          </p>

                          <div className="flex gap-2 flex-wrap justify-center md:justify-start mt-1">
                            <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {t("trainer_badge_shot")} <span className="text-white">{scenario.validShots.map(s => formatShotName(s, lang)).join(" / ")}</span>
                            </span>
                            {needsTarget && scenario.bestZones && (
                              <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {t("trainer_badge_target")} <span className="text-white">{scenario.bestZones.join(", ")}</span>
                              </span>
                            )}
                            {needsRun && scenario.laufZone && (
                              <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {t("trainer_badge_run")} <span className="text-white">{scenario.laufZone}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                          <button
                            onClick={() =>
                              setSharePayload({
                                mode: "partner_challenge",
                                scenario,
                                description: scenarioDescription,
                                userName: finalUserName,
                              })
                            }
                            className="w-full sm:w-auto px-5 py-5 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/50 font-black text-xs tracking-[0.15em] uppercase rounded-xl transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                          >
                            {t("share_ask_partner_btn")}
                          </button>

                          <button
                            onClick={nextRound}
                            className="w-full md:w-auto px-10 py-5 bg-white hover:bg-slate-200 text-black font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                          >
                            {isCrashCourse && crashCourseStep + 1 >= CRASH_COURSE_STEPS.length
                              ? t("crashcourse_finish_btn")
                              : t("trainer_next_task")}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* GAME OVER */}
                <AnimatePresence>
                  {gameOver && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#050b18]/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-8 lg:p-10 flex flex-col items-center gap-6 text-center mt-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] mx-4 sm:mx-0"
                    >
                      <span className="text-6xl drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                        {isWeaknessMode ? "🎯" : "🏆"}
                      </span>
                      <div className="flex flex-col gap-1">
                        <h2 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-widest uppercase">
                          {isWeaknessMode
                            ? (lang === "en" ? "WEAKNESS DRILL COMPLETED!" : lang === "es" ? "¡DRILL COMPLETADO!" : "SCHWÄCHEN-DRILL GEMEISTERT!")
                            : t("trainer_mastered_title")}
                        </h2>
                        <p className="text-sm text-slate-400">
                          {isWeaknessMode
                            ? (lang === "en"
                              ? "Your Coach Radar has been updated. Test it in your next 3D match!"
                              : lang === "es"
                              ? "Tu Radar Coach se ha actualizado. ¡Pruébalo en tu próximo partido 3D!"
                              : "Dein Coach-Radar wurde aktualisiert. Setz es jetzt im nächsten 3D-Match um!")
                            : (
                              <>
                                {t("trainer_mastered_desc_1")} <span className="font-bold text-white uppercase">{formatLevelName(level, lang)}</span> {t("trainer_mastered_desc_2")}
                              </>
                            )}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
                        <button
                          onClick={() =>
                            setSharePayload({
                              mode: "trainer_result",
                              levelName: isWeaknessMode
                                ? (lang === "en" ? "Weakness Coach" : lang === "es" ? "Coach Debilidades" : "Schwächen-Coach")
                                : formatLevelName(level, lang),
                              score: maxScore,
                              maxScore,
                              totalPoints: user ? totalPoints : 0,
                              userName: finalUserName,
                            })
                          }
                          className="w-full sm:w-auto px-6 py-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-300 uppercase tracking-[0.15em] font-black text-xs rounded-xl hover:scale-105 active:scale-95 transition-all"
                        >
                          {t("share_trainer_result_btn")}
                        </button>

                        {isWeaknessMode ? (
                          <button
                            onClick={() => {
                              setIsWeaknessMode(false);
                              setGameOver(false);
                              setActiveTab("coach");
                            }}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-black uppercase tracking-[0.2em] font-black text-xs rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-105 transition-all"
                          >
                            {lang === "en" ? "BACK TO COACH →" : lang === "es" ? "VOLVER AL COACH →" : "ZUM COACH-RADAR →"}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (level === "Spielzug") {
                                setLockedLevels(prev => prev.filter(l => l !== "Simulation"));
                                handleLevelChange("Simulation" as Level, true);
                              } else {
                                const updatedLocks = lockedLevels.includes(level) ? lockedLevels : [...lockedLevels, level];
                                setLockedLevels(updatedLocks);

                                const updatedScores = { ...highestScores, [level]: Math.max(highestScores[level] || 0, 10) };
                                const currentIndex = TRAINER_SEQUENCE.indexOf(level);
                                let nextLevel: Level = "Spielzug";

                                for (let i = currentIndex + 1; i < TRAINER_SEQUENCE.length; i++) {
                                  const candidate = TRAINER_SEQUENCE[i];
                                  const isClosed = updatedLocks.includes(candidate) && candidate !== "Spielzug";
                                  if (!isClosed) {
                                    nextLevel = candidate;
                                    break;
                                  }
                                }

                                updateHighScore(level, updatedScores[level]);
                                handleLevelChange(nextLevel, true);
                              }
                            }}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white uppercase tracking-[0.2em] font-black text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 transition-all"
                          >
                            {level === "Spielzug" ? t("trainer_start_pro_rallye") : t("trainer_start_next_lvl")}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}

            {/* LOGIN TAB */}
            {activeTab === "login" && (
              <motion.div
                key="login-page"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center justify-center p-6 sm:p-10 bg-card border border-card-border rounded-2xl shadow-2xl max-w-md mx-auto mt-12 gap-5 w-full"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary text-3xl">
                  🎾
                </div>

                <div className="text-center mb-2">
                  <h2 className="text-2xl font-black text-primary tracking-wide">
                    {isSignUp ? t("login_title_signup") : t("login_title_signin")}
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mt-2">
                    {t("login_subtitle")}
                  </p>
                </div>

                {localStorage.getItem("tacpadel_pending_crashcourse_bonus") === "true" && (
                  <div className="w-full px-3.5 py-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold text-center">
                    🎁 {t("login_bonus_banner")}
                  </div>
                )}

                <AnimatePresence>
                  {authMsg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`w-full p-3 rounded-lg text-xs font-bold text-center border ${authMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
                    >
                      {authMsg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder={t("login_email_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-background border border-border focus:border-primary rounded-xl text-foreground text-sm font-semibold outline-none transition-colors"
                  />
                  <input
                    type="password"
                    placeholder={t("login_password_placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-background border border-border focus:border-primary rounded-xl text-foreground text-sm font-semibold outline-none transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full px-6 py-3.5 bg-primary text-primary-foreground rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {authLoading ? t("login_processing") : (isSignUp ? t("login_btn_signup") : t("login_btn_signin"))}
                  </button>
                </form>

                <div className="flex items-center w-full gap-3 my-2 opacity-50">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("login_or")}</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    onClick={handleAppleLogin}
                    type="button"
                    className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white text-black rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {t("login_with_apple")}
                  </button>

                  <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white text-black rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.52-1.14 2.81-2.42 3.68v3.05h3.91c2.28-2.1 3.61-5.19 3.61-8.58z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-3.05c-1.08.72-2.45 1.16-4.02 1.16-3.09 0-5.72-2.09-6.65-4.91H1.31v3.15C3.29 22.36 7.37 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.35 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.31C.47 8.24 0 10.06 0 12s.47 3.76 1.31 5.44l4.04-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 1.64 1.31 4.75l4.04 3.15c.93-2.82 3.56-4.91 6.65-4.91z"/>
                    </svg>
                    {t("login_with_google")}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 mt-4 w-full">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setAuthMsg(null); }}
                    className="text-xs text-muted-foreground hover:text-primary font-bold transition-colors"
                  >
                    {isSignUp ? t("login_switch_to_signin") : t("login_switch_to_signup")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("home")}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors mt-2"
                  >
                    {t("login_back_home")}
                  </button>
                </div>
              </motion.div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && user && (
              <ProfileTab
                key="profile-page"
                user={user}
                setActiveTab={(t) => handleTabChange(t as Tab)}
              />
            )}

            {/* GAME SCREEN */}
            {activeTab === "game" && (
              <motion.div
                key="game"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                <GameScreen />
              </motion.div>
            )}

            {/* TAKTIK BOARD */}
            {(activeTab === "board" || activeTab === "taktik") && (
              <motion.div
                key="board"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                <div className="bg-card border border-card-border p-4 rounded-xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-1">
                    {t("board_header_title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("board_header_desc")}
                  </p>
                </div>
                <TacticsBoard />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- SHARE CARD & RATING MODALS --- */}
      <ShareCardModal payload={sharePayload} onClose={() => setSharePayload(null)} />
      <RatingPromptModal isOpen={showRatingModal} onClose={() => setShowRatingModal(false)} />

      <Navigation activeTab={activeTab as any} setActiveTab={handleTabChange as any} />

    </div>
  );
}

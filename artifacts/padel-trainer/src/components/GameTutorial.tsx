import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { AI_PROFILES } from "../engine/AiProfiles";
import { GamePhase, TurnResult } from "../engine/GameLogic";
import { useTranslation, formatShotName, TranslationKey } from "../lib/i18n";

interface GameTutorialProps {
  onComplete: () => void;
}

// Hilfsfunktion für millisekundengenaue Pausen im "Film"
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STEP_TITLE_KEYS: TranslationKey[] = [
  "gtut_s1_title",
  "gtut_s2_title",
  "gtut_s3_title",
  "gtut_s4_title",
  "gtut_s5_title",
];

const STEP_TEXT_KEYS: TranslationKey[] = [
  "gtut_s1_text",
  "gtut_s2_text",
  "gtut_s3_text",
  "gtut_s4_text",
  "gtut_s5_text",
];

export default function GameTutorial({ onComplete }: GameTutorialProps) {
  const { lang, t } = useTranslation();

  // Zeigt zuerst das Erklär-Fenster an
  const [showIntroModal, setShowIntroModal] = useState(true);

  // --- UI & STEP STATES ---
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const title = t(STEP_TITLE_KEYS[stepIndex] || "gtut_s1_title");
  const text = t(STEP_TEXT_KEYS[stepIndex] || "gtut_s1_text");

  // --- FAKE ACTION BAR STATES ---
  const [mockUi, setMockUi] = useState({
    run: "D4" as string | null,
    target: "C2" as string | null,
    shot: "AUFSCHLAG" as string | null,
    showTimer: false,
  });

  // --- 3D COURT STATES ---
  const [phase, setPhase] = useState<GamePhase>("player_planning");
  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  const [timerDuration, setTimerDuration] = useState(2500);

  const [tutZone, setTutZone] = useState<string | null>("C2");
  const [tutLauf, setTutLauf] = useState<string | null>("D4");
  const [tutShot, setTutShot] = useState<string | null>("AUFSCHLAG");

  // Initialer State: Du stehst auf D1, Ball liegt bei dir (side: "left")
  const [courtState, setCourtState] = useState({
    you: "D1",
    partner: "B4",
    opp1: "B1",
    opp2: "D1",
    ball: { side: "left" as "left" | "right", zone: "D1", type: "PREPARE_SERVE" },
  });

  const isTimerPhase = phase === "timer_running";
  const isAiActive = phase === "ai_prepare" || phase === "timer_running";
  const isAnimPhase = phase === "player_animating" || phase === "timer_running";

  // =========================================================================
  // DAS REGIE-SKRIPT: EXAKTER SPIELABLAUF WIE IM ECHTEN MATCH
  // =========================================================================
  const runStepAnimation = async (nextStep: number) => {
    setIsAnimating(true);
    setStepIndex(nextStep);

    // -------------------------------------------------------------------------
    // SCHRITT 2: AUFSCHLAG AUSFÜHREN (Ball fliegt von D1 -> C2, du läufst -> D4)
    // -------------------------------------------------------------------------
    if (nextStep === 1) {
      setTimerDuration(2500);
      setTurnResult("success");
      setPhase("player_animating");

      setCourtState({
        you: "D4",
        partner: "B4",
        opp1: "B1",
        opp2: "D1",
        ball: { side: "left", zone: "D1", type: "AUFSCHLAG" },
      });

      await sleep(2600);

      setPhase("ai_prepare");
      setTurnResult(null);
      setTutZone(null);
      setTutLauf(null);
      setTutShot(null);
      setCourtState({
        you: "D4",
        partner: "B4",
        opp1: "B1",
        opp2: "D1",
        ball: { side: "right", zone: "C2", type: "AUFSCHLAG" },
      });
    }

    // -------------------------------------------------------------------------
    // SCHRITT 3: GEGNER RETURNIERT (Ball fliegt von C2 -> D4, Timer läuft!)
    // -------------------------------------------------------------------------
    else if (nextStep === 2) {
      setMockUi({ run: null, target: null, shot: null, showTimer: false });
      await sleep(300);

      setTimerDuration(2800);
      setTutZone("D4");
      setMockUi({ run: null, target: null, shot: null, showTimer: true });

      setCourtState({
        you: "D4",
        partner: "B4",
        opp1: "C2",
        opp2: "D1",
        ball: { side: "right", zone: "C2", type: "DRIVE" },
      });
      setPhase("timer_running");

      await sleep(1000);
      setTutLauf("D4");
      setMockUi((prev) => ({ ...prev, run: "D4" }));

      await sleep(1800);
    }

    // -------------------------------------------------------------------------
    // SCHRITT 4: VOLLEY AM NETZ PLANEN (Ball ist jetzt bei dir auf D4!)
    // -------------------------------------------------------------------------
    else if (nextStep === 3) {
      setPhase("player_planning");
      setMockUi({ run: null, target: null, shot: null, showTimer: false });
      setTutZone(null);
      setTutLauf(null);
      setTutShot(null);

      setCourtState({
        you: "D4",
        partner: "B4",
        opp1: "C2",
        opp2: "D1",
        ball: { side: "left", zone: "D4", type: "DRIVE" },
      });

      await sleep(600);
      setMockUi((prev) => ({ ...prev, run: "D4" }));
      setTutLauf("D4");

      await sleep(600);
      setMockUi((prev) => ({ ...prev, target: "A1" }));
      setTutZone("A1");

      await sleep(600);
      setMockUi((prev) => ({ ...prev, shot: "VOLLEY" }));
      setTutShot("VOLLEY");

      await sleep(400);
    }

    // -------------------------------------------------------------------------
    // SCHRITT 5: VOLLEY AUSFÜHREN (Ball fliegt von D4 -> A1)
    // -------------------------------------------------------------------------
    else if (nextStep === 4) {
      setTimerDuration(2500);
      setTurnResult("perfect");
      setPhase("player_animating");

      setCourtState({
        you: "D4",
        partner: "B4",
        opp1: "B1",
        opp2: "D1",
        ball: { side: "left", zone: "D4", type: "VOLLEY" },
      });

      await sleep(2500);
    }

    setIsAnimating(false);
  };

  const handleNextClick = () => {
    if (stepIndex < 4) {
      runStepAnimation(stepIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div
      className="w-full flex-1 flex flex-col bg-[#050b18] rounded-2xl border border-slate-900 shadow-2xl select-none relative overflow-hidden"
      style={{ height: "calc(100dvh - 150px)", minHeight: "600px" }}
    >
      {/* =================================================== */}
      {/* 0. INTRO MODAL (DAS URSPRÜNGLICHE ERKLÄR-FENSTER)   */}
      {/* =================================================== */}
      <AnimatePresence>
        {showIntroModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md pointer-events-auto overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#050b18] border border-orange-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_0_50px_rgba(255,119,0,0.2)] max-w-lg w-full flex flex-col gap-5 relative overflow-hidden my-auto"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />

              <div className="text-center">
                <span className="inline-block px-3 py-1 mb-2 rounded-full bg-orange-500/10 border border-orange-500/30 text-[10px] font-black text-orange-400 uppercase tracking-widest">
                  {t("gtut_badge")}
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">
                  {t("gtut_intro_title")}
                </h2>
                <p className="text-orange-400 text-sm font-bold tracking-wider mt-1">
                  {t("gtut_intro_sub")}
                </p>
              </div>

              <div className="flex flex-col gap-3 text-sm text-slate-300">
                <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">{t("gtut_intro_s1_title")}</p>
                    <p className="leading-snug text-xs sm:text-sm">{t("gtut_intro_s1_desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">{t("gtut_intro_s2_title")}</p>
                    <p className="leading-snug text-xs sm:text-sm">{t("gtut_intro_s2_desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">{t("gtut_intro_s3_title")}</p>
                    <p className="leading-snug text-xs sm:text-sm">{t("gtut_intro_s3_desc")}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <button
                  onClick={() => setShowIntroModal(false)}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-black text-xs sm:text-sm tracking-[0.15em] uppercase shadow-[0_0_20px_rgba(255,119,0,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t("gtut_btn_watch")}
                </button>
                <button
                  onClick={onComplete}
                  className="w-full py-2 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest transition-colors"
                >
                  {t("gtut_btn_skip")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================= */}
      {/* 1. OBERER BEREICH: 3D COURT (FLEX-1)      */}
      {/* ========================================= */}
      <div className="relative w-full flex-1 overflow-hidden pointer-events-none bg-[#030611]">
        {/* Kleines Banner oben am Rand */}
        <div className="absolute top-3 left-3 right-3 z-30 flex justify-between items-center pointer-events-auto">
          <div className="bg-cyan-950/80 backdrop-blur-md border border-cyan-500/40 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
            <span className="text-xs">🎓</span>
            <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
              {t("gtut_top_badge")}
            </span>
          </div>
          <button
            onClick={onComplete}
            className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700 px-3 py-1 rounded-full text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-all"
          >
            {t("gtut_btn_exit")}
          </button>
        </div>

        <div className="absolute inset-0 z-10">
          <ScenarioCourt3D
            key="tutorial-court-static"
            arenaModel="/TacPadel.glb"
            playIntro={false}
            gameOver={false}
            level="Spielzug"
            positions={courtState as any}
            hasSubmitted={isAnimPhase}
            bestZones={[]}
            acceptableZones={[]}
            profiMode={false}
            selectedZone={phase === "ai_prepare" ? null : tutZone}
            selectedLaufZone={tutLauf}
            selectedPartnerZone={null}
            activeChar={isAiActive ? "opp1" : "you"}
            hitterId={isAiActive ? "opp1" : "you"}
            isTimerActive={isTimerPhase}
            turnResult={turnResult}
            previewShot={phase === "player_planning" ? tutShot : null}
            timerDuration={timerDuration}
            onZoneClick={() => {}}
            onLaufZoneClick={() => {}}
            onPlayerClick={() => {}}
            playerScore={0}
            aiScore={0}
            isAiActive={isAiActive}
            phase={phase}
            isTimerPhase={isTimerPhase}
            isPlayerTeamServe={true}
            hidePlayerLabels={false}
            userTeamName={t("gtut_team_name")}
            activeAiProfile={AI_PROFILES[0]}
          />
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. MITTLERER BEREICH: ACTION BAR          */}
      {/* ========================================= */}
      <div className="w-full z-40 bg-[#050b18] border-t border-slate-700 p-2 sm:p-3 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pointer-events-none">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {/* Fake Timer Header */}
          <div className="flex items-center justify-between px-1 mb-1 mt-1">
            <span className="text-[9px] font-black tracking-widest uppercase text-purple-400">
              {isTimerPhase ? t("gtut_react_incoming") : t("gtut_you_hitter")}
            </span>
            <div className="w-1/2 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <motion.div
                key={`timer-${mockUi.showTimer}`}
                initial={{ width: "100%" }}
                animate={{ width: mockUi.showTimer ? "0%" : "100%" }}
                transition={{ duration: mockUi.showTimer ? 2.8 : 0, ease: "linear" }}
                className={`h-full ${mockUi.showTimer ? "bg-emerald-500" : "bg-slate-700 opacity-30"}`}
              />
            </div>
          </div>

          {/* Fake Auswahl-Buttons */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div
              className={`p-1.5 rounded border text-center transition-colors duration-300 ${
                mockUi.run
                  ? "border-purple-500 bg-purple-950/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="text-[7px] font-black uppercase text-purple-400">{t("game_run_zone")}</div>
              <div className="text-[9px] font-bold text-white truncate">{mockUi.run || "-"}</div>
            </div>
            <div
              className={`p-1.5 rounded border text-center transition-colors duration-300 ${
                mockUi.target
                  ? "border-emerald-500 bg-emerald-950/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="text-[7px] font-black text-emerald-400 uppercase">{t("game_shot_target")}</div>
              <div className="text-[9px] font-bold text-white truncate">{mockUi.target || "-"}</div>
            </div>
            <div
              className={`p-1.5 rounded border text-center transition-colors duration-300 ${
                mockUi.shot
                  ? "border-orange-500 bg-orange-950/40 shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="text-[7px] font-black text-orange-400 uppercase">{t("game_shot_label")}</div>
              <div className="text-[9px] font-bold text-white truncate">
                {mockUi.shot ? formatShotName(mockUi.shot, lang) : "-"}
              </div>
            </div>
          </div>

          {/* Fake Submit Button */}
          <button
            disabled
            className={`w-full py-2.5 font-black text-[10px] tracking-widest uppercase rounded-lg border transition-all ${
              isTimerPhase
                ? "bg-amber-950/40 text-amber-400 border-amber-500/50 animate-pulse"
                : phase === "player_animating"
                  ? "bg-emerald-900/50 text-emerald-400 border-emerald-500/50"
                  : "bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            }`}
          >
            {isTimerPhase
              ? t("gtut_choose_run_timer")
              : phase === "player_animating"
                ? t("gtut_ball_flying_short")
                : t("game_submit_move")}
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* 3. UNTERER BEREICH: INFO TEXTBOX          */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611] p-4 sm:p-5 shrink-0 border-t border-cyan-500/30 z-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl mx-auto flex flex-col gap-2"
          >
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-900/50">
                {t("gtut_step_word")} {stepIndex + 1} / 5
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {title}
            </h2>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium min-h-[48px]">
              {text}
            </p>

            <div className="flex justify-end pt-2 mt-1 border-t border-slate-800">
              <button
                onClick={handleNextClick}
                disabled={isAnimating}
                className={`w-full sm:w-auto px-6 py-3 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all ${
                  isAnimating
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95"
                }`}
              >
                {isAnimating
                  ? t("gtut_anim_running")
                  : stepIndex === 4
                    ? t("gtut_finish_btn")
                    : t("gtut_next_btn")}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
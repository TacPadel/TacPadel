import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import ScenarioCourt25 from "./ScenarioCourt25";
import {
  SHOT_TYPES,
  TurnResult,
  evaluatePlayerShot,
} from "../engine/GameLogic";
import { useTranslation, formatShotName } from "../lib/i18n";
import { useEntitlements } from "../lib/entitlements";
import { generateSmartDrillMeta } from "../lib/drillGenerator";
import {
  SavedPlay,
  ReplayContext,
  ReplayStep,
  PlaybookSource,
  loadPlaybook,
  savePlaybookList,
  upsertPlaybookEntry,
  inferPlaySource,
  extractReplayContext,
  createPlayFromReplayContext,
  createSharedReplayLink,
} from "../lib/playbook";

type HubFilter = "all" | PlaybookSource | "drills";
type ReplayPhase = "watching" | "solving" | "result";

interface ActiveReplayState {
  title: string;
  context: ReplayContext;
  isExternalShare: boolean;
  sourcePlayId?: string;
}

interface ReplayEvalResult {
  result: TurnResult;
  title: string;
  message: string;
  shot: string;
  targetZone: string;
  runZone: string;
}

interface PlaybookHubProps {
  userId?: string | null;
  tacScore?: number;
  initialSharedReplay?: { title: string; context: ReplayContext } | null;
  onClearSharedReplay?: () => void;
  onOpenInBoard: (playId: string) => void;
  onNavigateTab: (
    target: "home" | "trainer" | "game" | "board" | "playbook" | "coach" | "login"
  ) => void;
}

const SHARE_BASE_URL = "https://tac-padel-api-server.vercel.app/";

export default function PlaybookHub({
  userId,
  tacScore = 2000,
  initialSharedReplay,
  onClearSharedReplay,
  onOpenInBoard,
  onNavigateTab,
}: PlaybookHubProps) {
  const { lang, t } = useTranslation();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();

  const tr = (de: string, en: string, es: string) =>
    lang === "en" ? en : lang === "es" ? es : de;

  const [plays, setPlays] = useState<SavedPlay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<HubFilter>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sharingPlayId, setSharingPlayId] = useState<string | null>(null);

  // --- 3D-REPLAY & ANIMATIONS-STATES ---
  const [activeReplay, setActiveReplay] = useState<ActiveReplayState | null>(null);
  const [replayPhase, setReplayPhase] = useState<ReplayPhase>("solving");
  const [watchStepIdx, setWatchStepIdx] = useState<number>(0);
  const [watchAnimating, setWatchAnimating] = useState<boolean>(false);
  const [watchRunKey, setWatchRunKey] = useState<number>(0);

  // --- LÖSUNGS-EINGABE FÜR DEN LETZTEN ZUG ---
  const [chosenShot, setChosenShot] = useState<string | null>(null);
  const [chosenTarget, setChosenTarget] = useState<string | null>(null);
  const [chosenRun, setChosenRun] = useState<string | null>(null);
  const [isShotModalOpen, setIsShotModalOpen] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<ReplayEvalResult | null>(null);
  const [savedSharedToPb, setSavedSharedToPb] = useState<boolean>(false);

  const watchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearWatchTimers = () => {
    watchTimersRef.current.forEach((id) => clearTimeout(id));
    watchTimersRef.current = [];
  };

  const showToast = (msg: string, ms: number = 2800) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), ms);
  };

  // Playbook laden & auf Updates hören
  useEffect(() => {
    if (entitlementsLoading) return;
    let mounted = true;

    const refresh = async () => {
      setLoading(true);
      const list = await loadPlaybook(userId, entitlements.maxPlaybookSlots);
      if (mounted) {
        setPlays(list);
        setLoading(false);
      }
    };

    refresh();

    const onUpdated = () => {
      loadPlaybook(userId, entitlements.maxPlaybookSlots).then((list) => {
        if (mounted) setPlays(list);
      });
    };
    window.addEventListener("tacpadel-playbook-updated", onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("tacpadel-playbook-updated", onUpdated);
    };
  }, [userId, entitlementsLoading, entitlements.maxPlaybookSlots]);

  // Startet ein 3D-Replay (mit automatischer Vorlauf-Animation, falls Schritte vorhanden sind)
  const openReplaySession = (state: ActiveReplayState) => {
    clearWatchTimers();
    const hasSteps = Boolean(state.context.steps && state.context.steps.length > 0);
    setActiveReplay(state);
    setChosenShot(state.context.incomingShot === "PREPARE_SERVE" ? "AUFSCHLAG" : null);
    setChosenTarget(null);
    setChosenRun(null);
    setEvalResult(null);
    setSavedSharedToPb(false);
    setWatchStepIdx(0);
    setWatchAnimating(false);
    setWatchRunKey((k) => k + 1);
    setReplayPhase(hasSteps ? "watching" : "solving");
  };

  // Eingehenden Share-Link (?play=<code> oder ?replay=...) sofort starten
  useEffect(() => {
    if (initialSharedReplay) {
      openReplaySession({
        title: initialSharedReplay.title,
        context: initialSharedReplay.context,
        isExternalShare: true,
      });
    }
    return () => clearWatchTimers();
  }, [initialSharedReplay]);

  // Step-by-Step 3D-Ballwechsel-Animation vor dem letzten Zug
  useEffect(() => {
    if (!activeReplay || replayPhase !== "watching") {
      clearWatchTimers();
      return;
    }

    const steps = activeReplay.context.steps || [];
    if (steps.length === 0 || watchStepIdx >= steps.length) {
      setWatchAnimating(false);
      setReplayPhase("solving");
      return;
    }

    clearWatchTimers();
    setWatchAnimating(false);

    const tStart = setTimeout(() => {
      setWatchAnimating(true);
    }, 260);

    const tNext = setTimeout(() => {
      if (watchStepIdx + 1 < steps.length) {
        setWatchAnimating(false);
        setWatchStepIdx((idx) => idx + 1);
      } else {
        setWatchAnimating(false);
        setReplayPhase("solving");
      }
    }, 2150);

    watchTimersRef.current = [tStart, tNext];
    return () => clearWatchTimers();
  }, [activeReplay, replayPhase, watchStepIdx, watchRunKey]);

  const handleReplayWatchAgain = () => {
    if (!activeReplay?.context.steps?.length) return;
    clearWatchTimers();
    setEvalResult(null);
    setWatchStepIdx(0);
    setWatchAnimating(false);
    setWatchRunKey((k) => k + 1);
    setReplayPhase("watching");
  };

  const handleSkipToSolve = () => {
    clearWatchTimers();
    setWatchAnimating(false);
    setReplayPhase("solving");
  };

  const handleRetrySolve = () => {
    if (!activeReplay) return;
    setChosenShot(activeReplay.context.incomingShot === "PREPARE_SERVE" ? "AUFSCHLAG" : null);
    setChosenTarget(null);
    setChosenRun(null);
    setEvalResult(null);
    setReplayPhase("solving");
  };

  const handleCloseReplay = () => {
    clearWatchTimers();
    setActiveReplay(null);
    setEvalResult(null);
    if (onClearSharedReplay) onClearSharedReplay();
  };

  const handleEvaluateReplayShot = () => {
    if (!activeReplay || !chosenShot || !chosenTarget || !chosenRun) return;
    const ctx = activeReplay.context;
    const isServe = ctx.incomingShot === "PREPARE_SERVE";
    const isReturn = ctx.incomingShot === "AUFSCHLAG";

    const res = evaluatePlayerShot(
      chosenShot,
      ctx.you,
      chosenTarget,
      ctx.opp1,
      ctx.opp2,
      isServe,
      isReturn,
      false,
      null,
      null,
      tacScore,
      ctx.incomingShot || "DRIVE",
      [],
      1
    );

    setEvalResult({
      result: res.result,
      title: res.title,
      message: res.message,
      shot: chosenShot,
      targetZone: chosenTarget,
      runZone: chosenRun,
    });
    setReplayPhase("result");
  };

  // Speichert eine per Link empfangene Challenge ins eigene Playbook
  const handleSaveExternalReplay = () => {
    if (!activeReplay || savedSharedToPb) return;
    const entry = createPlayFromReplayContext(activeReplay.title, activeReplay.context);
    const res = upsertPlaybookEntry(userId, entry, entitlements.maxPlaybookSlots);
    if (res.limitReached) {
      showToast(
        entitlements.isGuest || !userId
          ? t("pb_guest_limit_reached")
          : t("pb_limit_reached").replace(/\{max\}/g, String(entitlements.maxPlaybookSlots)),
        3500
      );
      return;
    }
    setPlays(res.list);
    setSavedSharedToPb(true);
    window.dispatchEvent(new Event("tacpadel-playbook-updated"));
    showToast(
      tr(
        "📘 Im Playbook gespeichert!",
        "📘 Saved to your Playbook!",
        "📘 ¡Guardado en tu Playbook!"
      )
    );
  };

  // Teilt einen kurzen Supabase-Link (?play=<code>) inkl. komplettem animierten Ballwechsel
  const handleShareChallenge = async (
    title: string,
    context: ReplayContext,
    playIdKey: string
  ) => {
    if (sharingPlayId) return;
    setSharingPlayId(playIdKey);

    try {
      const originBase =
        typeof window !== "undefined" &&
        window.location.origin.startsWith("http") &&
        !window.location.origin.includes("localhost")
          ? `${window.location.origin}/`
          : SHARE_BASE_URL;

      const { url } = await createSharedReplayLink({
        title,
        context,
        userId,
        baseUrl: originBase,
      });

      const shareText = tr(
        `🎾 Schau dir diesen Ballwechsel in 3D an und spiel den letzten Schlag selbst: ${title}`,
        `🎾 Watch this 3D padel rally and play the final shot yourself: ${title}`,
        `🎾 Mira este punto de pádel en 3D y juega tú el último golpe: ${title}`
      );

      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `TacPadel – ${title}`,
          text: `${shareText}\n${url}`,
          url,
          dialogTitle: title,
        });
        setSharingPlayId(null);
        return;
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: `TacPadel – ${title}`,
            text: shareText,
            url,
          });
          setSharingPlayId(null);
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") {
            setSharingPlayId(null);
            return;
          }
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        showToast(
          tr(
            "🔗 Kurzlink kopiert! Jetzt in WhatsApp einfügen.",
            "🔗 Short link copied! Paste it in WhatsApp.",
            "🔗 ¡Enlace corto copiado! Pégalo en WhatsApp."
          )
        );
      } else {
        showToast(url, 4000);
      }
    } catch {
      showToast(
        tr(
          "Link konnte nicht geteilt werden.",
          "Could not share link.",
          "No se pudo compartir el enlace."
        )
      );
    } finally {
      setSharingPlayId(null);
    }
  };

  // Spielzug im Playbook als Coach-Drill an-/ausschalten (inkl. Auto-Text)
  const handleToggleDrill = (play: SavedPlay) => {
    if (!entitlements.canCreateCustomDrills) return;
    const nextIsDrill = !play.isDrill;
    const autoMeta = nextIsDrill
      ? generateSmartDrillMeta(
          {
            title: play.title,
            items: play.items,
            drawings: play.drawings,
            keyframes: play.keyframes,
          },
          lang
        )
      : null;

    const updated: SavedPlay = {
      ...play,
      isDrill: nextIsDrill,
      drillPrompt: nextIsDrill ? play.drillPrompt || autoMeta?.prompt : play.drillPrompt,
      drillExplanation: nextIsDrill
        ? play.drillExplanation || autoMeta?.explanation
        : play.drillExplanation,
      drillTargetDepth: nextIsDrill
        ? play.drillTargetDepth || autoMeta?.targetDepth
        : play.drillTargetDepth,
      updatedAt: Date.now(),
    };

    const nextList = [updated, ...plays.filter((p) => p.id !== play.id)];
    const saved = savePlaybookList(userId, nextList, entitlements.maxPlaybookSlots);
    setPlays(saved);
    window.dispatchEvent(new Event("tacpadel-playbook-updated"));
    showToast(
      nextIsDrill
        ? tr(
            "🎯 Als Coach-Drill aktiviert!",
            "🎯 Enabled as Coach Drill!",
            "🎯 ¡Activado como Coach Drill!"
          )
        : tr(
            "Coach-Drill deaktiviert.",
            "Coach Drill disabled.",
            "Coach Drill desactivado."
          )
    );
  };

  const handleDeletePlay = (playId: string) => {
    const nextList = plays.filter((p) => p.id !== playId);
    const saved = savePlaybookList(userId, nextList, entitlements.maxPlaybookSlots);
    setPlays(saved);
    window.dispatchEvent(new Event("tacpadel-playbook-updated"));
  };

  const handleCreateNewInStudio = () => {
    try {
      sessionStorage.removeItem("tacpadel_open_play_id");
      sessionStorage.setItem("tacpadel_open_board_mode", "studio");
    } catch {}
    onNavigateTab("board");
  };

  const filteredPlays = useMemo(() => {
    if (filter === "all") return plays;
    if (filter === "drills") return plays.filter((p) => Boolean(p.isDrill));
    return plays.filter((p) => inferPlaySource(p) === filter);
  }, [plays, filter]);

  const counts = useMemo(() => {
    let match = 0;
    let trainer = 0;
    let studio = 0;
    let drills = 0;
    plays.forEach((p) => {
      const src = inferPlaySource(p);
      if (src === "match") match++;
      else if (src === "trainer") trainer++;
      else studio++;
      if (p.isDrill) drills++;
    });
    return { all: plays.length, match, trainer, studio, drills };
  }, [plays]);

  const actorLabel = (actor: ReplayStep["actor"]) => {
    if (actor === "you") return tr("Du", "You", "Tú");
    if (actor === "partner") return tr("Partner", "Partner", "Compañero");
    if (actor === "opp1") return tr("Gegner 1", "Opp 1", "Rival 1");
    return tr("Gegner 2", "Opp 2", "Rival 2");
  };

  // =========================================================================
  // ANSICHT A: INTERAKTIVES 3D-REPLAY (ANIMATION -> LETZTEN ZUG LÖSEN)
  // =========================================================================
  if (activeReplay) {
    const ctx = activeReplay.context;
    const steps = ctx.steps || [];
    const currentWatchStep = steps[watchStepIdx] || null;
    const isWatching = replayPhase === "watching" && currentWatchStep !== null;
    const isSolved = replayPhase === "result" && evalResult !== null;

    const courtPositions = isWatching
      ? {
          you: currentWatchStep.youBefore,
          partner: currentWatchStep.partnerBefore,
          opp1: currentWatchStep.opp1Before,
          opp2: currentWatchStep.opp2Before,
          ball: {
            side: currentWatchStep.ballSideBefore,
            zone: currentWatchStep.fromZone,
            type: currentWatchStep.shot || "DRIVE",
          },
        }
      : {
          you: ctx.you,
          partner: ctx.partner,
          opp1: ctx.opp1,
          opp2: ctx.opp2,
          ball: {
            side: "left" as const,
            zone: ctx.ballZone || ctx.you,
            type: chosenShot || ctx.incomingShot || "DRIVE",
          },
        };

    const courtSelectedZone = isWatching ? currentWatchStep.toZone : chosenTarget;
    const courtSelectedLauf = isWatching ? currentWatchStep.youAfter : chosenRun;
    const courtHasSubmitted = isWatching ? watchAnimating : isSolved;
    const courtHitterId = isWatching ? currentWatchStep.actor : "you";

    const canSubmitSolution =
      replayPhase === "solving" && Boolean(chosenShot && chosenTarget && chosenRun);

    const evalBadgeStyle =
      evalResult?.result === "perfect"
        ? "bg-cyan-950/60 border-cyan-400/60 text-cyan-300"
        : evalResult?.result === "success"
        ? "bg-emerald-950/60 border-emerald-400/60 text-emerald-300"
        : evalResult?.result === "recovery"
        ? "bg-amber-950/60 border-amber-400/60 text-amber-300"
        : "bg-red-950/60 border-red-500/60 text-red-300";

    return (
      <div className="w-full flex flex-col gap-3 pb-10 animate-in fade-in">
        {toastMsg && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[180] w-[92%] max-w-md bg-[#050b18]/95 border border-cyan-400/70 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] text-center text-xs font-black text-cyan-300">
            {toastMsg}
          </div>
        )}

        {/* Kopfzeile */}
        <div className="bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 shadow-xl">
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400 block">
              {activeReplay.isExternalShare
                ? tr("🎾 GETEILTE 3D-CHALLENGE", "🎾 SHARED 3D CHALLENGE", "🎾 RETO 3D COMPARTIDO")
                : tr("🎬 3D-PLAYBOOK REPLAY", "🎬 3D PLAYBOOK REPLAY", "🎬 REPLAY 3D PLAYBOOK")}
            </span>
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {activeReplay.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {steps.length > 0 && (
              <button
                onClick={handleReplayWatchAgain}
                className="px-2.5 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all"
              >
                🔁 {tr("Ballwechsel", "Watch Rally", "Ver punto")}
              </button>
            )}

            <button
              onClick={() =>
                handleShareChallenge(
                  activeReplay.title,
                  activeReplay.context,
                  activeReplay.sourcePlayId || "active-replay"
                )
              }
              disabled={sharingPlayId !== null}
              className="px-2.5 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600 border border-purple-500/50 text-purple-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {sharingPlayId ? "…" : `📤 ${tr("Teilen", "Share", "Compartir")}`}
            </button>

            <button
              onClick={handleCloseReplay}
              className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-wider"
            >
              ← {tr("Zurück", "Back", "Volver")}
            </button>
          </div>
        </div>

        {/* Status-Banner: Entweder Ballwechsel-Animation ODER Entscheidungs-Aufruf */}
        {isWatching ? (
          <div className="bg-[#050b18]/95 border border-purple-500/50 rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                  {tr("Schlag", "Shot", "Golpe")} {watchStepIdx + 1}/{steps.length}:{" "}
                  <span className="text-white">{actorLabel(currentWatchStep.actor)}</span> →{" "}
                  <span className="text-amber-300">
                    {formatShotName(currentWatchStep.shot, lang)}
                  </span>{" "}
                  ({currentWatchStep.toZone})
                </span>
              </div>

              <button
                onClick={handleSkipToSolve}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 border border-amber-400/60 text-amber-300 hover:text-black text-[10px] font-black uppercase tracking-wider transition-all"
              >
                ⏭ {tr("Direkt lösen", "Solve Now", "Resolver ya")}
              </button>
            </div>

            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${((watchStepIdx + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        ) : replayPhase === "solving" ? (
          <div className="bg-gradient-to-r from-orange-950/60 via-[#050b18] to-cyan-950/50 border border-orange-500/50 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                ⚡ {tr("JETZT BIST DU DRAN!", "YOUR TURN!", "¡TU TURNO!")}
              </span>
              <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                {ctx.incomingShot === "PREPARE_SERVE"
                  ? tr(
                      "Wähle Laufweg, Aufschlag-Ziel und Aufschlag!",
                      "Choose run zone, serve target and serve!",
                      "¡Elige carrera, destino y saque!"
                    )
                  : tr(
                      `Gegner spielt ${formatShotName(ctx.incomingShot || "DRIVE", lang)} auf ${ctx.ballZone || ctx.you} – wähle Laufweg, Ziel & Schlag!`,
                      `Opponent plays ${formatShotName(ctx.incomingShot || "DRIVE", lang)} to ${ctx.ballZone || ctx.you} – pick run zone, target & shot!`,
                      `El rival juega ${formatShotName(ctx.incomingShot || "DRIVE", lang)} a ${ctx.ballZone || ctx.you} – ¡elige carrera, destino y golpe!`
                    )}
              </p>
            </div>
          </div>
        ) : null}

        {/* 3D COURT */}
        <div className="w-full h-[52vh] min-h-[400px] lg:h-[580px] bg-[#030611] rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden p-1">
          <div className="absolute inset-0 w-full h-full">
            <ScenarioCourt25
              key={`pb-court-${replayPhase}-${watchStepIdx}-${watchRunKey}`}
              level="Spielzug"
              positions={courtPositions}
              selectedZone={courtSelectedZone}
              hasSubmitted={courtHasSubmitted}
              bestZones={[]}
              acceptableZones={[]}
              onZoneClick={(zoneId: string) => {
                if (replayPhase === "solving") setChosenTarget(zoneId);
              }}
              profiMode={false}
              selectedLaufZone={courtSelectedLauf}
              perfectLaufZone={null}
              acceptableLaufZones={[]}
              onLaufZoneClick={(zoneId: string) => {
                if (replayPhase === "solving") setChosenRun(zoneId);
              }}
              activeChar="you"
              hitterId={courtHitterId as any}
              feedbackMsg={null}
            />
          </div>
        </div>

        {/* EINGABELEISTE WÄHREND DES LÖSENS */}
        {replayPhase === "solving" && (
          <div className="bg-[#050b18]/95 border border-slate-700 p-3 sm:p-4 rounded-2xl shadow-xl flex flex-col lg:flex-row gap-3 items-center">
            <div className="grid grid-cols-3 gap-2 flex-1 w-full">
              <div
                className={`p-2 rounded-xl border text-center ${
                  chosenRun
                    ? "border-purple-500/60 bg-purple-950/30"
                    : "border-purple-500/40 bg-purple-950/15 animate-pulse"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-widest text-purple-400">
                  {t("trainer_step1_run")}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {chosenRun || t("trainer_choose")}
                </div>
              </div>

              <div
                className={`p-2 rounded-xl border text-center ${
                  chosenTarget
                    ? "border-emerald-500/60 bg-emerald-950/30"
                    : "border-emerald-500/40 bg-emerald-950/15 animate-pulse"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
                  {t("trainer_step2_target")}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {chosenTarget || t("trainer_choose")}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsShotModalOpen(true)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  chosenShot
                    ? "border-orange-500/60 bg-orange-950/30"
                    : "border-orange-500/50 bg-orange-950/25 animate-pulse"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-widest text-orange-400">
                  {t("trainer_step3_shot")}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {chosenShot ? formatShotName(chosenShot, lang) : t("trainer_choose")}
                </div>
              </button>
            </div>

            <button
              onClick={handleEvaluateReplayShot}
              disabled={!canSubmitSolution}
              className="w-full lg:w-64 py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-black font-black text-xs uppercase tracking-[0.18em] rounded-xl transition-all shadow-lg"
            >
              {t("trainer_submit")}
            </button>
          </div>
        )}

        {/* AUSWERTUNG + AUFDECKUNG DES ORIGINAL-ZUGS */}
        {isSolved && evalResult && (
          <div className="bg-[#050b18]/95 border border-cyan-500/40 p-4 sm:p-5 rounded-2xl shadow-2xl flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${evalBadgeStyle}`}
              >
                {evalResult.title}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {formatShotName(evalResult.shot, lang)} → {evalResult.targetZone} ({tr("Lauf", "Run", "Carrera")}:{" "}
                {evalResult.runZone})
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {evalResult.message}
            </p>

            {/* Erst jetzt aufdecken: Wie der Punkt im Original-Match wirklich lief */}
            {(ctx.actualLastMove || ctx.note) && (
              <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                  📋 {tr("SO LIEF DER ORIGINAL-PUNKT", "HOW THE ORIGINAL POINT WENT", "ASÍ FUE EL PUNTO ORIGINAL")}
                </span>
                {ctx.actualLastMove && (
                  <p className="text-xs font-bold text-white">
                    {actorLabel(ctx.actualLastMove.actor)}:{" "}
                    <span className="text-cyan-300">
                      {formatShotName(ctx.actualLastMove.shot, lang)} → {ctx.actualLastMove.targetZone}
                    </span>
                    {ctx.actualLastMove.runZone ? ` (${ctx.actualLastMove.runZone})` : ""}
                  </p>
                )}
                {(ctx.actualLastMove?.outcome || ctx.note) && (
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {ctx.actualLastMove?.outcome || ctx.note}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleRetrySolve}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider"
              >
                🔄 {tr("Nochmal lösen", "Try Again", "Reintentar")}
              </button>

              {steps.length > 0 && (
                <button
                  onClick={handleReplayWatchAgain}
                  className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-black text-xs uppercase tracking-wider"
                >
                  🔁 {tr("Ballwechsel", "Watch Rally", "Ver punto")}
                </button>
              )}

              {activeReplay.isExternalShare && (
                <button
                  onClick={handleSaveExternalReplay}
                  disabled={savedSharedToPb}
                  className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${
                    savedSharedToPb
                      ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                      : "bg-amber-500/20 hover:bg-amber-500 border-amber-400/60 text-amber-300 hover:text-black"
                  }`}
                >
                  {savedSharedToPb
                    ? `✓ ${tr("Gespeichert", "Saved", "Guardado")}`
                    : `💾 ${tr("Ins Playbook", "Save to Playbook", "Guardar")}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* SCHLAG-AUSWAHL-MODAL */}
        <AnimatePresence>
          {isShotModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsShotModalOpen(false)}
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-20 lg:bottom-6 left-3 right-3 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[70] bg-[#050b18] border border-orange-500/40 p-5 rounded-3xl shadow-2xl flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-orange-400">
                    {tr("Welchen Schlag spielst du?", "Which shot do you play?", "¿Qué golpe juegas?")}
                  </h3>
                  <button
                    onClick={() => setIsShotModalOpen(false)}
                    className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto">
                  {SHOT_TYPES.map((shot) => (
                    <button
                      key={shot}
                      onClick={() => {
                        setChosenShot(shot);
                        setIsShotModalOpen(false);
                      }}
                      className={`py-3 px-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                        chosenShot === shot
                          ? "bg-orange-600/25 border-orange-400 text-orange-200"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {formatShotName(shot, lang)}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // =========================================================================
  // ANSICHT B: PLAYBOOK HUB (ÜBERSICHT ALLER SPIELZÜGE, DRILLS & REPLAYS)
  // =========================================================================
  return (
    <div className="w-full flex flex-col gap-4 pb-10 animate-in fade-in">
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[180] w-[92%] max-w-md bg-[#050b18]/95 border border-cyan-400/70 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] text-center text-xs font-black text-cyan-300">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 block">
            📘 TACPADEL PLAYBOOK HUB ({plays.length}/{entitlements.maxPlaybookSlots})
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
            {tr("Deine Spielzüge & 3D-Replays", "Your Plays & 3D Replays", "Tus Jugadas y Replays 3D")}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {tr(
              "Spiele ganze Ballwechsel in 3D ab, teile kurze Challenge-Links oder verwandle Züge in Drills.",
              "Replay full rallies in 3D, share short challenge links or turn plays into drills.",
              "Reproduce puntos completos en 3D, comparte enlaces cortos o conviértelos en drills."
            )}
          </p>
        </div>

        <button
          onClick={handleCreateNewInStudio}
          className="px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shrink-0 transition-all hover:scale-[1.02] active:scale-95"
        >
          + {tr("Neu im Studio", "New in Studio", "Nuevo en Estudio")}
        </button>
      </div>

      {/* Gast-Cloud-Sync-Banner */}
      {(entitlements.isGuest || !userId) && (
        <div className="bg-amber-950/35 border border-amber-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              ☁️ {tr("GASTMODUS • MAX. 2 LOKALE PLÄTZE", "GUEST MODE • MAX 2 LOCAL SLOTS", "MODO INVITADO • MÁX. 2 LOCALES")}
            </span>
            <p className="text-xs text-slate-300 leading-snug">
              {tr(
                "Melde dich kostenlos an für 50 Cloud-Plätze und automatische Sicherung auf allen Geräten.",
                "Sign in for free to unlock 50 cloud slots and sync across all your devices.",
                "Regístrate gratis para desbloquear 50 espacios en la nube en todos tus dispositivos."
              )}
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("login")}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider shrink-0 transition-all"
          >
            {tr("Kostenlos sichern", "Save for Free", "Guardar gratis")}
          </button>
        </div>
      )}

      {/* Filter-Tabs */}
      <div className="grid grid-cols-5 gap-1.5 bg-[#050b18] p-1.5 rounded-xl border border-slate-800">
        {(
          [
            { id: "all", label: `${tr("Alle", "All", "Todo")} (${counts.all})` },
            { id: "match", label: `🎾 (${counts.match})` },
            { id: "trainer", label: `🧠 (${counts.trainer})` },
            { id: "studio", label: `✏️ (${counts.studio})` },
            { id: "drills", label: `🎯 (${counts.drills})` },
          ] as { id: HubFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`py-2 px-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all truncate ${
              filter === tab.id
                ? "bg-cyan-600/25 border border-cyan-400/70 text-cyan-300"
                : "text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Spielzug-Liste */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
          {tr("Lade Playbook…", "Loading Playbook…", "Cargando Playbook…")}
        </div>
      ) : filteredPlays.length === 0 ? (
        <div className="bg-[#050b18]/90 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📘</span>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            {tr("Noch keine Spielzüge hier", "No plays here yet", "Aún no hay jugadas aquí")}
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            {tr(
              "Speichere spannende Punkte direkt nach dem 3D-Match, merke dir Trainer-Szenarien oder zeichne eigene Züge im TacticsBoard Studio.",
              "Save key rallies right after a 3D match, bookmark Trainer scenarios or draw your own plays in TacticsBoard Studio.",
              "Guarda puntos clave tras un partido 3D, marca escenarios del Entrenador o dibuja jugadas en el Estudio."
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            <button
              onClick={handleCreateNewInStudio}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs uppercase tracking-wider"
            >
              ✏️ {tr("Im Studio zeichnen", "Draw in Studio", "Dibujar en Estudio")}
            </button>
            <button
              onClick={() => onNavigateTab("game")}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider border border-slate-700"
            >
              🎾 {tr("Zum 3D-Match", "Go to 3D Match", "Ir al Partido 3D")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPlays.map((play) => {
            const src = inferPlaySource(play);
            const ctx = extractReplayContext(play);
            const stepCount = ctx.steps?.length || 0;
            const srcBadge =
              src === "match"
                ? { text: "🎾 MATCH", cls: "bg-orange-500/20 border-orange-500/40 text-orange-300" }
                : src === "trainer"
                ? { text: "🧠 TRAINER", cls: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" }
                : { text: "✏️ STUDIO", cls: "bg-pink-500/20 border-pink-500/40 text-pink-300" };

            return (
              <div
                key={play.id}
                className="bg-[#050b18]/95 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 flex flex-col gap-3 shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${srcBadge.cls}`}>
                        {srcBadge.text}
                      </span>
                      {play.isDrill && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                          {t("tb_pb_drill_badge")}
                        </span>
                      )}
                      {stepCount > 0 && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300">
                          🎬 {stepCount} {tr("Schläge", "Shots", "Golpes")}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-white truncate">{play.title}</h3>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {play.keyframes?.length || 1} {t("tb_pb_steps_label")}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeletePlay(play.id)}
                    title={tr("Löschen", "Delete", "Eliminar")}
                    className="w-8 h-8 rounded-lg bg-red-950/30 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-xs flex items-center justify-center shrink-0 transition-all"
                  >
                    🗑️
                  </button>
                </div>

                {(play.drillExplanation || play.drillPrompt) && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                    {play.drillExplanation || play.drillPrompt}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() =>
                      openReplaySession({
                        title: play.title,
                        context: ctx,
                        isExternalShare: false,
                        sourcePlayId: play.id,
                      })
                    }
                    className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    🎬 {tr("3D-Replay", "3D Replay", "Replay 3D")}
                  </button>

                  <button
                    onClick={() => handleShareChallenge(play.title, ctx, play.id)}
                    disabled={sharingPlayId === play.id}
                    className="py-2 px-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/50 text-purple-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {sharingPlayId === play.id
                      ? "…"
                      : `📤 ${tr("Freunde fragen", "Ask Friends", "Preguntar")}`}
                  </button>

                  <button
                    onClick={() => onOpenInBoard(play.id)}
                    className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    ✏️ {tr("Studio-Board", "Studio Board", "Estudio")}
                  </button>

                  {entitlements.canCreateCustomDrills && (
                    <button
                      onClick={() => handleToggleDrill(play)}
                      className={`py-2 px-2.5 rounded-xl border font-black text-[10px] uppercase tracking-wider transition-all ${
                        play.isDrill
                          ? "bg-orange-500/25 border-orange-400 text-orange-300"
                          : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-orange-300"
                      }`}
                    >
                      🎯 {play.isDrill ? tr("Drill aktiv", "Drill On", "Drill activo") : tr("Als Drill", "As Drill", "Como Drill")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
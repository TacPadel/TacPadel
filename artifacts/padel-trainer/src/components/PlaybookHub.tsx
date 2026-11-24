import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import ScenarioCourt25 from "./ScenarioCourt25";
import { SHOT_TYPES, TurnResult, evaluatePlayerShot } from "../engine/GameLogic";
import { useTranslation, formatShotName } from "../lib/i18n";
import { useEntitlements } from "../lib/entitlements";
import { enrichPlayAsDrill } from "../lib/drillGenerator";
import {
  SavedPlay,
  ReplayContext,
  PlaybookSource,
  loadPlaybook,
  savePlaybookList,
  upsertPlaybookEntry,
  inferPlaySource,
  extractReplayContext,
  createPlayFromReplayContext,
  encodeReplayToParam,
} from "../lib/playbook";

interface PlaybookHubProps {
  userId?: string | null;
  tacScore: number;
  initialSharedReplay?: { title: string; context: ReplayContext } | null;
  onClearSharedReplay?: () => void;
  onOpenInBoard: (playId: string) => void;
  onNavigateTab: (tab: "trainer" | "game" | "board" | "coach" | "login") => void;
}

type HubFilter = "all" | PlaybookSource | "drills";

const evalReplayRunTactics = (shot: string, runZone: string, opp1: string, opp2: string): boolean => {
  if (!shot || !runZone) return true;
  const r = parseInt(runZone[1] || "2", 10);
  const oppsAtNet =
    parseInt(opp1[1] || "1", 10) >= 3 || parseInt(opp2[1] || "1", 10) >= 3;
  const s = shot.toUpperCase();

  if (["LOB", "CHIQUITA", "AUFSCHLAG", "SMASH", "VOLLEY", "BANDEJA", "VIBORA", "BLOCK"].includes(s)) {
    return r >= 3;
  }
  if (s === "BAJADA") {
    return oppsAtNet ? r <= 2 : r >= 3;
  }
  if (s === "DRIVE") {
    return r <= 2;
  }
  return true;
};

export default function PlaybookHub({
  userId,
  tacScore,
  initialSharedReplay,
  onClearSharedReplay,
  onOpenInBoard,
  onNavigateTab,
}: PlaybookHubProps) {
  const { lang, t } = useTranslation();
  const { entitlements } = useEntitlements();
  const isGuest = !userId;

  const [plays, setPlays] = useState<SavedPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HubFilter>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // --- AKTIVES 3D-REPLAY ---
  const [replayItem, setReplayItem] = useState<{
    title: string;
    context: ReplayContext;
    isSharedChallenge: boolean;
  } | null>(null);

  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [evalOutput, setEvalOutput] = useState<{
    result: TurnResult;
    title: string;
    message: string;
    runOk: boolean;
  } | null>(null);
  const [savedSharedToMine, setSavedSharedToMine] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openNewInStudio = () => {
    try {
      sessionStorage.removeItem("tacpadel_open_play_id");
      sessionStorage.setItem("tacpadel_open_board_mode", "studio");
    } catch {}
    onNavigateTab("board");
  };

  const openPlayInStudio = (playId: string) => {
    try {
      sessionStorage.setItem("tacpadel_open_play_id", playId);
      sessionStorage.setItem("tacpadel_open_board_mode", "studio");
    } catch {}
    onOpenInBoard(playId);
  };

  useEffect(() => {
    let active = true;

    const fetchPlays = () => {
      setLoading(true);
      loadPlaybook(userId).then((list) => {
        if (active) {
          setPlays(list);
          setLoading(false);
        }
      });
    };

    fetchPlays();

    const handleUpdated = () => {
      fetchPlays();
    };
    window.addEventListener("tacpadel-playbook-updated", handleUpdated);

    return () => {
      active = false;
      window.removeEventListener("tacpadel-playbook-updated", handleUpdated);
    };
  }, [userId]);

  // Falls ein ?replay=... Deep-Link hereinkommt, sofort das 3D-Replay öffnen
  useEffect(() => {
    if (initialSharedReplay) {
      setReplayItem({
        title: initialSharedReplay.title,
        context: initialSharedReplay.context,
        isSharedChallenge: true,
      });
      setSelectedShot(null);
      setSelectedZone(null);
      setSelectedLaufZone(null);
      setHasSubmitted(false);
      setEvalOutput(null);
      setSavedSharedToMine(false);
    }
  }, [initialSharedReplay]);

  const filteredPlays = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plays.filter((p) => {
      const src = inferPlaySource(p);
      if (filter === "drills" && !p.isDrill) return false;
      if (filter !== "all" && filter !== "drills" && src !== filter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plays, filter, search]);

  const counts = useMemo(() => {
    return {
      all: plays.length,
      match: plays.filter((p) => inferPlaySource(p) === "match").length,
      trainer: plays.filter((p) => inferPlaySource(p) === "trainer").length,
      studio: plays.filter((p) => inferPlaySource(p) === "studio").length,
      drills: plays.filter((p) => Boolean(p.isDrill)).length,
    };
  }, [plays]);

  const handleToggleDrill = (playId: string) => {
    if (!entitlements.canCreateCustomDrills) return;
    let turnedOn = false;

    const next = plays.map((p) => {
      if (p.id !== playId) return p;
      if (!p.isDrill) {
        turnedOn = true;
        return enrichPlayAsDrill(p, lang);
      }
      return { ...p, isDrill: false, updatedAt: Date.now() };
    });

    const saved = savePlaybookList(
      userId,
      next,
      Math.max(next.length, entitlements.maxPlaybookSlots)
    );
    setPlays(saved);

    if (turnedOn) {
      showToast(t("pb_hub_drill_auto_toast"));
    }
  };

  const handleDeletePlay = (playId: string) => {
    const next = plays.filter((p) => p.id !== playId);
    const saved = savePlaybookList(
      userId,
      next,
      Math.max(next.length, entitlements.maxPlaybookSlots)
    );
    setPlays(saved);
  };

  const openReplayForPlay = (play: SavedPlay) => {
    const ctx = extractReplayContext(play);
    setReplayItem({
      title: play.title,
      context: ctx,
      isSharedChallenge: false,
    });
    setSelectedShot(ctx.incomingShot === "PREPARE_SERVE" ? "AUFSCHLAG" : null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setEvalOutput(null);
    setSavedSharedToMine(false);
  };

  const handleShareReplay = async (title: string, ctx: ReplayContext) => {
    const encoded = encodeReplayToParam(title, ctx);
    const baseUrl =
      Capacitor.isNativePlatform()
        ? "https://tacpadel.app"
        : typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "https://tacpadel.app";
    const shareUrl = `${baseUrl}?replay=${encoded}`;
    const shareText = `${t("pb_hub_share_msg")}\n${title}\n${shareUrl}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: title || "TacPadel",
          text: shareText,
          url: shareUrl,
          dialogTitle: title || "TacPadel",
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: title || "TacPadel",
          text: `${t("pb_hub_share_msg")} ${title}`,
          url: shareUrl,
        });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      showToast(t("pb_hub_shared_copied"));
    } catch {
      showToast(shareUrl);
    }
  };

  const handleReplaySubmit = () => {
    if (!replayItem || !selectedShot || !selectedZone || !selectedLaufZone) return;
    const ctx = replayItem.context;
    const isServe = ctx.incomingShot === "PREPARE_SERVE" || selectedShot === "AUFSCHLAG";

    const res = evaluatePlayerShot(
      selectedShot,
      ctx.you,
      selectedZone,
      ctx.opp1,
      ctx.opp2,
      isServe,
      false,
      false,
      null,
      null,
      Math.max(2000, tacScore),
      ctx.incomingShot || "DRIVE",
      [],
      1
    );

    const runOk = evalReplayRunTactics(selectedShot, selectedLaufZone, ctx.opp1, ctx.opp2);

    setEvalOutput({
      result: res.result,
      title: res.title,
      message: res.message,
      runOk,
    });
    setHasSubmitted(true);
  };

  const resetReplayAttempt = () => {
    setSelectedShot(
      replayItem?.context.incomingShot === "PREPARE_SERVE" ? "AUFSCHLAG" : null
    );
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setEvalOutput(null);
  };

  const handleSaveSharedChallengeToPlaybook = () => {
    if (!replayItem || savedSharedToMine) return;
    const entry = createPlayFromReplayContext(replayItem.title, replayItem.context);
    const res = upsertPlaybookEntry(userId, entry, entitlements.maxPlaybookSlots);
    if (res.limitReached) {
      showToast(
        isGuest
          ? t("pb_guest_limit_reached")
          : t("pb_limit_reached").replace(/\{max\}/g, String(entitlements.maxPlaybookSlots))
      );
      return;
    }
    setPlays(res.list);
    setSavedSharedToMine(true);
    showToast(t("tb_pb_saved_msg"));
  };

  const availableReplayShots = useMemo(() => {
    if (replayItem?.context.incomingShot === "PREPARE_SERVE") return ["AUFSCHLAG"];
    return SHOT_TYPES.filter((s) => s !== "AUFSCHLAG");
  }, [replayItem]);

  // =========================================================================
  // ANSICHT B: INTERAKTIVES 3D-REPLAY ("IN 3D NEU SPIELEN")
  // =========================================================================
  if (replayItem) {
    const ctx = replayItem.context;
    const canSubmitReplay = Boolean(
      !hasSubmitted && selectedShot && selectedZone && selectedLaufZone
    );
    const isGoodResult =
      evalOutput?.result === "perfect" || evalOutput?.result === "success";

    return (
      <motion.div
        key="playbook-replay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full max-w-[1400px] mx-auto flex flex-col gap-4 text-slate-200 select-none pb-24"
      >
        {/* Top-Steuerleiste */}
        <div className="w-full bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => {
                setReplayItem(null);
                if (onClearSharedReplay) onClearSharedReplay();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all"
            >
              {t("pb_replay_back_hub")}
            </button>

            <div className="flex items-center gap-2">
              {replayItem.isSharedChallenge && (
                <button
                  onClick={handleSaveSharedChallengeToPlaybook}
                  disabled={savedSharedToMine}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                    savedSharedToMine
                      ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                      : "bg-cyan-600/20 hover:bg-cyan-600 border-cyan-400/50 text-cyan-300 hover:text-white"
                  }`}
                >
                  {savedSharedToMine ? t("pb_replay_saved_mine") : t("pb_replay_save_mine")}
                </button>
              )}

              <button
                onClick={() => handleShareReplay(replayItem.title, ctx)}
                className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-500/50 text-purple-300 text-[10px] font-black uppercase tracking-wider transition-all"
              >
                {t("pb_replay_ask_friends")}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 block">
                {replayItem.isSharedChallenge
                  ? t("pb_replay_shared_badge")
                  : t("pb_replay_badge")}
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">{replayItem.title}</h2>
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-orange-950/50 border border-orange-500/40 text-orange-300 self-start sm:self-center">
              {t("pb_replay_incoming")}{" "}
              {formatShotName(
                ctx.incomingShot === "PREPARE_SERVE" ? "AUFSCHLAG" : ctx.incomingShot,
                lang
              )}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-snug">{t("pb_replay_hint")}</p>

          {toast && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3 py-1.5">
              <span>{toast}</span>
              {isGuest && (
                <button
                  onClick={() => onNavigateTab("login")}
                  className="px-2.5 py-1 rounded bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider"
                >
                  {t("pb_guest_banner_btn")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3D-Court */}
        <div className="w-full h-[55vh] min-h-[430px] lg:h-[600px] bg-[#030611] rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden p-1">
          <div className="absolute inset-0 w-full h-full">
            <ScenarioCourt25
              level={"Spielzug" as any}
              positions={{
                you: ctx.you,
                partner: ctx.partner,
                opp1: ctx.opp1,
                opp2: ctx.opp2,
                ball: {
                  side: "left",
                  zone: ctx.ballZone || ctx.you,
                  type: selectedShot || ctx.incomingShot || "DRIVE",
                },
              }}
              selectedZone={selectedZone}
              hasSubmitted={hasSubmitted}
              bestZones={hasSubmitted && isGoodResult && selectedZone ? [selectedZone] : []}
              acceptableZones={[]}
              onZoneClick={(zoneId: string) => {
                if (!hasSubmitted) setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
              }}
              profiMode={true}
              selectedLaufZone={selectedLaufZone}
              perfectLaufZone={hasSubmitted && evalOutput?.runOk ? selectedLaufZone : null}
              acceptableLaufZones={[]}
              onLaufZoneClick={(zoneId: string) => {
                if (!hasSubmitted) setSelectedLaufZone((prev) => (prev === zoneId ? null : zoneId));
              }}
              activeChar="you"
              hitterId="you"
              feedbackMsg={null}
            />
          </div>
        </div>

        {/* Action Bar (vor Submit) */}
        {!hasSubmitted && (
          <div className="w-full bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-3 lg:p-4 rounded-xl shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-3 items-center">
              <div className="grid grid-cols-3 gap-2 flex-1 w-full">
                <div
                  className={`flex flex-col gap-0.5 p-2 rounded-lg border ${
                    selectedLaufZone
                      ? "border-purple-500/60 bg-purple-950/25"
                      : "border-purple-500/40 bg-purple-950/15 animate-pulse"
                  }`}
                >
                  <span className="text-[8px] font-black tracking-widest text-purple-400 uppercase">
                    {t("trainer_step1_run")}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {selectedLaufZone || t("trainer_choose")}
                  </span>
                </div>

                <div
                  className={`flex flex-col gap-0.5 p-2 rounded-lg border ${
                    selectedZone
                      ? "border-emerald-500/60 bg-emerald-950/25"
                      : "border-emerald-500/40 bg-emerald-950/15 animate-pulse"
                  }`}
                >
                  <span className="text-[8px] font-black tracking-widest text-emerald-400 uppercase">
                    {t("trainer_step2_target")}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {selectedZone || t("trainer_choose")}
                  </span>
                </div>

                <div
                  onClick={() => setIsShotModalOpen(true)}
                  className={`flex flex-col gap-0.5 p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedShot
                      ? "border-orange-500/60 bg-orange-950/25"
                      : "border-orange-500/50 bg-orange-950/30 animate-pulse"
                  }`}
                >
                  <span className="text-[8px] font-black tracking-widest text-orange-400 uppercase">
                    {t("trainer_step3_shot")}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {selectedShot ? formatShotName(selectedShot, lang) : t("trainer_choose")}
                  </span>
                </div>
              </div>

              <button
                onClick={handleReplaySubmit}
                disabled={!canSubmitReplay}
                className="w-full lg:w-1/3 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-white font-black text-xs tracking-[0.2em] uppercase rounded-xl border border-cyan-400/50 disabled:border-slate-800 transition-all"
              >
                {t("trainer_submit")}
              </button>
            </div>
          </div>
        )}

        {/* Shot Modal */}
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
                className="fixed bottom-20 lg:bottom-6 left-3 right-3 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[70] bg-[#050b18] border border-orange-500/40 p-5 rounded-3xl shadow-2xl flex flex-col max-h-[70vh]"
              >
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4" />
                <h3 className="text-sm font-black tracking-widest text-orange-400 uppercase mb-3">
                  {t("trainer_shot_modal_q1")}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto pb-2">
                  {availableReplayShots.map((shot) => {
                    const isSel = selectedShot === shot;
                    return (
                      <button
                        key={shot}
                        onClick={() => {
                          setSelectedShot(shot);
                          setIsShotModalOpen(false);
                        }}
                        className={`py-3.5 px-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${
                          isSel
                            ? "bg-orange-600/25 border-orange-400 text-orange-200"
                            : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {formatShotName(shot, lang)}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Ergebnis-Auswertung */}
        {hasSubmitted && evalOutput && (
          <div className="w-full bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                className={`text-lg font-black uppercase tracking-wider ${
                  evalOutput.result === "perfect"
                    ? "text-cyan-400"
                    : evalOutput.result === "success"
                    ? "text-emerald-400"
                    : evalOutput.result === "recovery"
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {evalOutput.result === "perfect"
                  ? t("pb_replay_perfect")
                  : evalOutput.result === "success"
                  ? t("pb_replay_solid")
                  : evalOutput.result === "recovery"
                  ? t("pb_replay_shaky")
                  : t("pb_replay_error")}
              </h3>

              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                  evalOutput.runOk
                    ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/50 border-amber-500/40 text-amber-300"
                }`}
              >
                {evalOutput.runOk ? t("pb_replay_run_ok") : t("pb_replay_run_warn")}
              </span>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">{evalOutput.message}</p>

            {ctx.note && (
              <div className="text-xs text-slate-400 bg-[#030611] border border-slate-800 rounded-xl p-3">
                <span className="font-black uppercase tracking-wider text-slate-500 block mb-0.5 text-[10px]">
                  {t("pb_replay_orig_note")}
                </span>
                {ctx.note}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                onClick={resetReplayAttempt}
                className="flex-1 py-3.5 px-5 bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-[0.16em] rounded-xl transition-all"
              >
                {t("pb_replay_try_again")}
              </button>
              <button
                onClick={() => handleShareReplay(replayItem.title, ctx)}
                className="py-3.5 px-5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/50 text-purple-200 font-black text-xs uppercase tracking-[0.14em] rounded-xl transition-all"
              >
                {t("pb_replay_ask_friends")}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // =========================================================================
  // ANSICHT A: ZENTRALER PLAYBOOK HUB (VERWALTUNG)
  // =========================================================================
  return (
    <motion.div
      key="playbook-hub"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="w-full flex flex-col gap-4 pb-12 select-none text-slate-200"
    >
      {/* Hero Header */}
      <div className="w-full bg-[#050b18]/95 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.12)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-orange-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
              {t("pb_hub_badge")} • {plays.length}/{entitlements.maxPlaybookSlots}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-0.5">
              📘 {t("pb_hub_title")}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              {t("pb_hub_sub")}
            </p>
          </div>

          <button
            onClick={openNewInStudio}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shrink-0 transition-all"
          >
            {t("pb_hub_new_studio")}
          </button>
        </div>
      </div>

      {/* Gast-Cloud-Sync-Hinweis (2 lokale Plätze -> kostenlos anmelden für Cloud-Sync & 50 Plätze) */}
      {isGuest && (
        <div className="w-full bg-gradient-to-r from-amber-950/45 via-[#050b18] to-cyan-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">☁️</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                {t("pb_guest_banner_title")}
              </span>
              <p className="text-xs text-slate-300 leading-snug">
                {t("pb_guest_banner_desc")}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("login")}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-[11px] uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0 transition-all"
          >
            {t("pb_guest_banner_btn")}
          </button>
        </div>
      )}

      {/* Filter & Suche */}
      <div className="w-full bg-[#050b18]/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "all" as HubFilter, label: `${t("pb_hub_filter_all")} (${counts.all})` },
              { id: "match" as HubFilter, label: `${t("pb_hub_filter_match")} (${counts.match})` },
              { id: "trainer" as HubFilter, label: `${t("pb_hub_filter_trainer")} (${counts.trainer})` },
              { id: "studio" as HubFilter, label: `${t("pb_hub_filter_studio")} (${counts.studio})` },
              ...(entitlements.canCreateCustomDrills || counts.drills > 0
                ? [
                    {
                      id: "drills" as HubFilter,
                      label: `${t("pb_hub_filter_drills")} (${counts.drills})`,
                    },
                  ]
                : []),
            ]
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                filter === f.id
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                  : "bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("pb_hub_search_ph")}
          className="w-full bg-[#030611] border border-slate-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
        />

        {toast && (
          <div className="text-xs font-black text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3 py-2">
            {toast}
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
          ...
        </div>
      ) : filteredPlays.length === 0 ? (
        <div className="w-full bg-[#050b18]/90 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📘</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            {t("pb_hub_empty_title")}
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            {t("pb_hub_empty_desc")}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <button
              onClick={() => onNavigateTab("game")}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[11px] uppercase tracking-wider"
            >
              3D-Match
            </button>
            <button
              onClick={() => onNavigateTab("trainer")}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] uppercase tracking-wider"
            >
              Trainer
            </button>
            <button
              onClick={openNewInStudio}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] uppercase tracking-wider"
            >
              TacticsBoard
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredPlays.map((play) => {
            const src = inferPlaySource(play);
            const srcBadge =
              src === "match"
                ? { text: t("pb_hub_src_match"), cls: "bg-orange-950/50 border-orange-500/40 text-orange-300" }
                : src === "trainer"
                ? { text: t("pb_hub_src_trainer"), cls: "bg-cyan-950/50 border-cyan-500/40 text-cyan-300" }
                : { text: t("pb_hub_src_studio"), cls: "bg-pink-950/50 border-pink-500/40 text-pink-300" };

            return (
              <div
                key={play.id}
                className="bg-[#050b18]/95 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${srcBadge.cls}`}
                      >
                        {srcBadge.text}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {play.keyframes?.length || 1} {t("tb_pb_steps_label")}
                      </span>
                    </div>

                    {entitlements.canCreateCustomDrills && (
                      <button
                        onClick={() => handleToggleDrill(play.id)}
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border transition-all ${
                          play.isDrill
                            ? "bg-amber-500/20 border-amber-400 text-amber-300"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:text-amber-300"
                        }`}
                      >
                        {play.isDrill ? t("pb_hub_btn_drill_on") : t("pb_hub_btn_drill_off")}
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-black text-white leading-snug">{play.title}</h3>

                  {(play.drillExplanation || play.drillPrompt) && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                      {play.drillExplanation || play.drillPrompt}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => openReplayForPlay(play)}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap"
                  >
                    {t("pb_hub_btn_replay")}
                  </button>

                  <button
                    onClick={() => handleShareReplay(play.title, extractReplayContext(play))}
                    className="py-2 px-2.5 rounded-xl bg-purple-950/50 hover:bg-purple-900 border border-purple-500/40 text-purple-300 font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    {t("pb_hub_btn_share")}
                  </button>

                  <button
                    onClick={() => openPlayInStudio(play.id)}
                    className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    {t("pb_hub_btn_board")}
                  </button>

                  <button
                    onClick={() => handleDeletePlay(play.id)}
                    className="py-2 px-2.5 rounded-xl bg-red-950/30 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-[10px] font-bold transition-all"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

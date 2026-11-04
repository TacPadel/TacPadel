import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import ScenarioCourt25 from "./ScenarioCourt25";
import { StrategySequence, StrategyStep } from "../lib/strategies";

interface AdminUserRow {
  id: string;
  email?: string;
  display_name?: string;
  points?: number;
  tac_points?: number;
  is_pro?: boolean;
  avatar_url?: string;
}

interface AdminDashboardProps {
  onExit: () => void;
  onTestStrategy?: (strat: StrategySequence, type: "admin" | "draft") => void;
  initialTab?: "users" | "strategies";
}

export default function AdminDashboard({
  onExit,
  onTestStrategy,
  initialTab = "users",
}: AdminDashboardProps) {
  const [adminTab, setAdminTab] = useState<"strategies" | "users">(initialTab);

  // --- TAB 1: STRATEGIEN STATES ---
  const [pendingStrats, setPendingStrats] = useState<any[]>([]);
  const [loadingStrats, setLoadingStrats] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Integrierte 3D-Vorschau (falls aus dem ProfileTab geöffnet)
  const [previewStrat, setPreviewStrat] = useState<StrategySequence | null>(null);
  const [previewStepIdx, setPreviewStepIdx] = useState<number>(0);

  // --- TAB 2: SPIELER / PRO-USER STATES ---
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>("");
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoadingStrats(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("community_strategies")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      const fallback = await supabase
        .from("community_strategies")
        .select("*")
        .eq("status", "pending");

      if (fallback.error) {
        setErrorMsg(fallback.error.message);
      } else if (fallback.data) {
        setPendingStrats(fallback.data);
      }
    } else if (data) {
      setPendingStrats(data);
    }

    setLoadingStrats(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("user_stats")
      .select("id, email, display_name, points, tac_points, is_pro, avatar_url")
      .order("points", { ascending: false });

    if (error) {
      setErrorMsg(
        `Fehler beim Laden der Spieler (${error.message}). Bitte prüfe, ob die Spalte 'is_pro' in 'user_stats' existiert.`
      );
    } else if (data) {
      setUsersList(data as AdminUserRow[]);
    }

    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchPending();
    fetchUsers();
  }, []);

  const handleToggleUserPro = async (targetUser: AdminUserRow) => {
    setTogglingUserId(targetUser.id);
    const nextProStatus = !Boolean(targetUser.is_pro);

    const { data, error } = await supabase
      .from("user_stats")
      .update({ is_pro: nextProStatus })
      .eq("id", targetUser.id)
      .select();

    setTogglingUserId(null);

    if (error) {
      alert("Fehler beim Ändern des Pro-Status: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert(
        "Update wurde von Supabase blockiert! Bitte führe die Admin-UPDATE-Policy für 'user_stats' im Supabase SQL-Editor aus."
      );
      return;
    }

    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, is_pro: nextProStatus } : u))
    );
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        (u.display_name && u.display_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [usersList, userSearch]);

  const proUsersCount = useMemo(
    () => usersList.filter((u) => Boolean(u.is_pro)).length,
    [usersList]
  );

  const handleApprove = async (id: string) => {
    const { data, error } = await supabase
      .from("community_strategies")
      .update({ status: "approved" })
      .eq("id", id)
      .select();

    if (error) {
      alert("Fehler beim Freigeben: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("Keine Berechtigung zum Ändern! Bitte prüfe die Supabase UPDATE-Policy (RLS) für community_strategies.");
      return;
    }
    setPendingStrats((prev) => prev.filter((s) => s.id !== id));
    if (previewStrat?.id === id) setPreviewStrat(null);
  };

  const handleReject = async (id: string) => {
    const { data, error } = await supabase
      .from("community_strategies")
      .update({ status: "rejected" })
      .eq("id", id)
      .select();

    if (error) {
      alert("Fehler beim Ablehnen: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("Keine Berechtigung zum Ändern! Bitte prüfe die Supabase UPDATE-Policy (RLS) für community_strategies.");
      return;
    }
    setPendingStrats((prev) => prev.filter((s) => s.id !== id));
    if (previewStrat?.id === id) setPreviewStrat(null);
  };

  const handleTest = (dbRow: any) => {
    let parsedSteps: StrategyStep[] = [];
    if (typeof dbRow.steps === "string") {
      try {
        parsedSteps = JSON.parse(dbRow.steps);
      } catch {
        parsedSteps = [];
      }
    } else if (Array.isArray(dbRow.steps)) {
      parsedSteps = dbRow.steps;
    }

    const stratToTest: StrategySequence = {
      id: dbRow.id,
      title: `${dbRow.title} (ADMIN TEST)`,
      theme: dbRow.theme as any,
      difficulty: dbRow.difficulty as any,
      description: dbRow.description,
      steps: parsedSteps,
    };

    if (onTestStrategy) {
      onTestStrategy(stratToTest, "admin");
    } else {
      // Falls aus dem ProfileTab geöffnet: Integrierte 3D-Vorschau öffnen
      setPreviewStrat(stratToTest);
      setPreviewStepIdx(0);
    }
  };

  const activePreviewStep = previewStrat?.steps?.[previewStepIdx] || null;

  return (
    <div className="w-full bg-[#050b18] p-5 sm:p-6 rounded-2xl border border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.15)] text-slate-200">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-purple-900/50 pb-4">
        <div>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 uppercase tracking-widest">
            🛡️ Admin-Zentrale
          </h2>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Tester für Pro-Features freischalten & Community-Strategien prüfen
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => (adminTab === "strategies" ? fetchPending() : fetchUsers())}
            className="text-xs bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-purple-300 px-3 py-2 rounded-lg font-bold transition-colors"
          >
            ↻ Neu laden
          </button>
          <button
            onClick={onExit}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
          >
            ✕ Schließen
          </button>
        </div>
      </div>

      {/* TAB-UMSCHALTER */}
      <div className="grid grid-cols-2 gap-2 bg-[#03060e] p-1.5 rounded-xl border border-slate-800 mb-6">
        <button
          onClick={() => {
            setAdminTab("users");
            setPreviewStrat(null);
          }}
          className={`py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            adminTab === "users"
              ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>👑 Pro-User & Tester</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-black/40 text-pink-200">
            {proUsersCount} Pro
          </span>
        </button>

        <button
          onClick={() => setAdminTab("strategies")}
          className={`py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            adminTab === "strategies"
              ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>📋 Strategien prüfen</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-black/40 text-purple-200">
            {pendingStrats.length}
          </span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: SPIELER-LISTE & PRO-RECHTE VERGEBEN                */}
      {/* ========================================================= */}
      {adminTab === "users" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="🔍 Spielername oder E-Mail suchen..."
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-pink-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none"
            />
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-900/80 border border-slate-800 px-3.5 py-2.5 rounded-xl text-center">
              Gesamt: <span className="text-white">{usersList.length}</span> • Pro:{" "}
              <span className="text-pink-400">{proUsersCount}</span>
            </div>
          </div>

          {loadingUsers ? (
            <p className="text-slate-400 text-center py-8 animate-pulse font-bold uppercase tracking-widest text-xs">
              Lade Spieler-Liste...
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-xs font-bold uppercase tracking-widest">
              Keine passenden Spieler gefunden.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
              {filteredUsers.map((u) => {
                const isPro = Boolean(u.is_pro);
                const fallbackName = u.email ? u.email.split("@")[0] : "Spieler";
                const displayName =
                  u.display_name && u.display_name.trim() !== "" ? u.display_name : fallbackName;
                const isBusy = togglingUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                      isPro
                        ? "bg-pink-950/20 border-pink-500/40 shadow-[inset_0_0_15px_rgba(236,72,153,0.08)]"
                        : "bg-slate-900/70 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-slate-400 shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-white truncate">
                            {displayName}
                          </span>
                          {isPro && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                              👑 PRO USER
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {u.email || `ID: ${u.id.slice(0, 8)}...`}
                        </div>
                        <div className="flex gap-3 mt-1 text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-cyan-400">{u.points || 0} TS</span>
                          <span className="text-amber-400">{u.tac_points || 0} TP</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleUserPro(u)}
                      disabled={isBusy}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                        isPro
                          ? "bg-pink-600 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(236,72,153,0.4)]"
                          : "bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700"
                      }`}
                    >
                      {isBusy
                        ? "Speichert..."
                        : isPro
                          ? "👑 Pro aktiv (Entziehen)"
                          : "🔓 Auf Pro setzen"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: EINGEREICHTE STRATEGIEN PRÜFEN                     */}
      {/* ========================================================= */}
      {adminTab === "strategies" && (
        <>
          {/* INTEGRIERTE 3D-VORSCHAU (Wenn ohne StrategyTrainer direkt im Profil geöffnet) */}
          {previewStrat && activePreviewStep ? (
            <div className="bg-slate-900/90 border border-cyan-500/50 rounded-xl p-4 flex flex-col gap-4 mb-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                    3D-Inspektor • Zug {previewStepIdx + 1} von {previewStrat.steps.length}
                  </span>
                  <h3 className="text-base font-black text-white">{previewStrat.title}</h3>
                </div>
                <button
                  onClick={() => setPreviewStrat(null)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold"
                >
                  ← Zurück zur Liste
                </button>
              </div>

              <div className="h-[360px] w-full bg-[#030611] rounded-xl border border-slate-800 overflow-hidden relative">
                <ScenarioCourt25
                  level={"Strategie" as any}
                  positions={{
                    ...activePreviewStep.positions,
                    ball: {
                      ...activePreviewStep.positions.ball,
                      type:
                        activePreviewStep.playerTurn === "ai"
                          ? activePreviewStep.aiShot || activePreviewStep.positions.ball.type
                          : activePreviewStep.validShots?.[0] || activePreviewStep.positions.ball.type,
                    },
                  }}
                  selectedZone={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiTarget || null
                      : activePreviewStep.bestZones?.[0] || null
                  }
                  bestZones={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiTarget
                        ? [activePreviewStep.aiTarget]
                        : []
                      : activePreviewStep.bestZones || []
                  }
                  selectedLaufZone={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiLaufZone || null
                      : activePreviewStep.laufZone || null
                  }
                  perfectLaufZone={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiLaufZone || null
                      : activePreviewStep.laufZone || null
                  }
                  acceptableZones={[]}
                  acceptableLaufZones={[]}
                  hasSubmitted={false}
                  profiMode={false}
                  onZoneClick={() => {}}
                  onLaufZoneClick={() => {}}
                  activeChar={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiHitter || "opp1"
                      : "you"
                  }
                  hitterId={
                    activePreviewStep.playerTurn === "ai"
                      ? activePreviewStep.aiHitter || "opp1"
                      : "you"
                  }
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs text-left flex flex-col gap-1">
                <span className="font-black text-cyan-400 uppercase">
                  {activePreviewStep.playerTurn === "ai" ? "🤖 Gegner-Zug:" : "🎾 Spieler-Zug:"}
                </span>
                <p className="text-slate-200 font-semibold">{activePreviewStep.description}</p>
                <p className="text-slate-400 text-[11px] mt-1">{activePreviewStep.stepExplanation}</p>
              </div>

              <div className="flex justify-between items-center gap-2">
                <button
                  disabled={previewStepIdx === 0}
                  onClick={() => setPreviewStepIdx((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
                >
                  ← Vorheriger Zug
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(previewStrat.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase"
                  >
                    ✅ Freigeben
                  </button>
                  <button
                    onClick={() => handleReject(previewStrat.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase"
                  >
                    ❌ Ablehnen
                  </button>
                </div>
                <button
                  disabled={previewStepIdx >= previewStrat.steps.length - 1}
                  onClick={() =>
                    setPreviewStepIdx((i) => Math.min(previewStrat.steps.length - 1, i + 1))
                  }
                  className="px-4 py-2 bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
                >
                  Nächster Zug →
                </button>
              </div>
            </div>
          ) : (
            <>
              {loadingStrats ? (
                <p className="text-slate-400 text-center py-8 animate-pulse font-bold uppercase tracking-widest text-xs">
                  Lade eingereichte Strategien...
                </p>
              ) : pendingStrats.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  Keine neuen Strategien zur Prüfung vorhanden. Alles sauber! 🧹
                </p>
              ) : null}

              <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                {pendingStrats.map((strat) => (
                  <div
                    key={strat.id}
                    className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 flex flex-col gap-3 text-left"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-bold text-lg text-white">{strat.title}</h3>
                        <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
                          Eingereicht von: {strat.creator_name || "Unbekannt"}
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 shrink-0">
                        {strat.theme} • Level {strat.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                      {strat.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleTest(strat)}
                        className="flex-1 bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white px-3 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        🎮 {onTestStrategy ? "Testen" : "3D Vorschau"}
                      </button>
                      <button
                        onClick={() => handleApprove(strat.id)}
                        className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white px-3 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        ✅ Freigeben
                      </button>
                      <button
                        onClick={() => handleReject(strat.id)}
                        className="flex-1 bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white px-3 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        ❌ Ablehnen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

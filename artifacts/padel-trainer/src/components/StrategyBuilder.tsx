import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import ScenarioCourt25 from "./ScenarioCourt25";
import { StrategyStep, StrategySequence } from "../lib/strategies";

const ZONES = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E3", "E4", "E5"];
const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE", "VORBEREITUNG"];

interface AdminUserRow {
  id: string;
  email?: string;
  display_name?: string;
  points?: number;
  tac_points?: number;
  is_pro?: boolean;
  avatar_url?: string;
}

// ==========================================
// ADMIN DASHBOARD (Strategien + Pro-User Verwaltung)
// ==========================================
function AdminDashboard({
  onExit,
  onTestStrategy,
}: {
  onExit: () => void;
  onTestStrategy: (strat: StrategySequence, type: "admin" | "draft") => void;
}) {
  const [adminTab, setAdminTab] = useState<"strategies" | "users">("strategies");

  // --- TAB 1: STRATEGIEN STATES ---
  const [pendingStrats, setPendingStrats] = useState<any[]>([]);
  const [loadingStrats, setLoadingStrats] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        `Fehler beim Laden der Spieler (${error.message}). Hast du die Spalte 'is_pro' in Supabase angelegt?`
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
      alert("Keine Berechtigung! Bitte prüfe die Supabase UPDATE-Policy (RLS) für community_strategies.");
      return;
    }
    setPendingStrats((prev) => prev.filter((s) => s.id !== id));
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
      alert("Keine Berechtigung! Bitte prüfe die Supabase UPDATE-Policy (RLS) für community_strategies.");
      return;
    }
    setPendingStrats((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTest = (dbRow: any) => {
    const parsedSteps = typeof dbRow.steps === "string" ? JSON.parse(dbRow.steps) : dbRow.steps;
    const stratToTest: StrategySequence = {
      id: dbRow.id,
      title: `${dbRow.title} (ADMIN TEST)`,
      theme: dbRow.theme as any,
      difficulty: dbRow.difficulty as any,
      description: dbRow.description,
      steps: parsedSteps || [],
    };
    onTestStrategy(stratToTest, "admin");
  };

  return (
    <div className="w-full bg-[#050b18] p-5 sm:p-6 rounded-xl border border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-purple-900/50 pb-4">
        <div>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 uppercase tracking-widest">
            Admin-Zentrale
          </h2>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Community-Strategien prüfen & Tester für Pro-Features freischalten
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
            Schließen
          </button>
        </div>
      </div>

      {/* TAB-UMSCHALTER */}
      <div className="grid grid-cols-2 gap-2 bg-[#03060e] p-1.5 rounded-xl border border-slate-800 mb-6">
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

        <button
          onClick={() => setAdminTab("users")}
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
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: EINGEREICHTE STRATEGIEN PRÜFEN                     */}
      {/* ========================================================= */}
      {adminTab === "strategies" && (
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

          <div className="flex flex-col gap-4">
            {pendingStrats.map((strat) => (
              <div
                key={strat.id}
                className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-white">{strat.title}</h3>
                    <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
                      Eingereicht von: {strat.creator_name || "Unbekannt"}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300">
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
                    🎮 Testen
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

      {/* ========================================================= */}
      {/* TAB 2: SPIELER-LISTE & PRO-RECHTE VERGEBEN                */}
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

                      <div className="min-w-0">
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
    </div>
  );
}

// ==========================================
// STRATEGY BUILDER
// ==========================================
interface StrategyBuilderProps {
  onBack: () => void;
  onTestStrategy: (strat: StrategySequence, type: "admin" | "draft") => void;
  startInAdmin?: boolean; 
}

export default function StrategyBuilder({ onBack, onTestStrategy, startInAdmin = false }: StrategyBuilderProps) {
  const { user } = useAuth();
  
  // Case-insensitive Prüfung für deine Admin-E-Mail
  const isAdmin = user?.email?.toLowerCase().trim() === 'caposion@gmail.com';
  const [showAdmin, setShowAdmin] = useState(startInAdmin);

  useEffect(() => {
    if (startInAdmin) setShowAdmin(true);
  }, [startInAdmin]);
  
  // Basic Info State
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<"Offensive" | "Defensive" | "Umschaltspiel">("Offensive");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState("");

  // Steps State
  const [steps, setSteps] = useState<StrategyStep[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Lade Auto-Save beim Start
  useEffect(() => {
    const saved = localStorage.getItem('padelStrategyDraft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.difficulty) setDifficulty(parsed.difficulty);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.steps) setSteps(parsed.steps);
      } catch (e) {}
    }
    setDraftLoaded(true);
  }, []);

  // Speichere automatisch jeden Fortschritt in LocalStorage
  useEffect(() => {
    if (draftLoaded) {
      localStorage.setItem('padelStrategyDraft', JSON.stringify({ title, theme, difficulty, description, steps }));
    }
  }, [title, theme, difficulty, description, steps, draftLoaded]);

  // Current Editing Step State
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const [playerTurn, setPlayerTurn] = useState<"you" | "ai">("you");
  const [stepDesc, setStepDesc] = useState("");
  const [stepExpl, setStepExpl] = useState("");
  
  const [posYou, setPosYou] = useState("B2");
  const [posPartner, setPosPartner] = useState("D2");
  const [posOpp1, setPosOpp1] = useState("B2");
  const [posOpp2, setPosOpp2] = useState("D2");
  
  // "left" = Unten (Deine Seite), "right" = Oben (Gegner)
  const [ballSide, setBallSide] = useState<"left" | "right">("left"); 
  const [ballZone, setBallZone] = useState("B2");
  const [ballType, setBallType] = useState("VORBEREITUNG");

  // If YOU
  const [validShots, setValidShots] = useState<string[]>(["VORBEREITUNG"]);
  const [bestZones, setBestZones] = useState<string[]>(["B2"]);
  const [laufZone, setLaufZone] = useState("B2");

  // If AI
  const [aiHitter, setAiHitter] = useState<"opp1" | "opp2">("opp1");
  const [aiTarget, setAiTarget] = useState("B2");
  const [aiLaufZone, setAiLaufZone] = useState("D2");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  // Wenn DU dran bist -> "left" (Unten), wenn GEGNER dran ist -> "right" (Oben)
  const handleTurnChange = (turn: "you" | "ai") => {
    setPlayerTurn(turn);
    setBallSide(turn === "you" ? "left" : "right");
  };

  // Beim Anlegen eines neuen Zugs ebenfalls auf "left" (Unten) setzen
  const openNewStep = () => {
    setEditingIndex(null);
    setPlayerTurn("you"); 
    setBallSide("left");
    setStepDesc(""); 
    setStepExpl("");
    setIsEditingStep(true);
  };

  const handleEditStep = (index: number) => {
    const s = steps[index];
    setEditingIndex(index);
    setPlayerTurn(s.playerTurn);
    setStepDesc(s.description);
    setStepExpl(s.stepExplanation);
    setPosYou(s.positions.you); setPosPartner(s.positions.partner);
    setPosOpp1(s.positions.opp1); setPosOpp2(s.positions.opp2);
    setBallSide(s.positions.ball.side); setBallZone(s.positions.ball.zone);
    setBallType(s.positions.ball.type || "DRIVE");
    if (s.playerTurn === "you") {
      setValidShots(s.validShots || ["DRIVE"]); setBestZones(s.bestZones || ["B2"]); setLaufZone(s.laufZone || "B2");
    } else {
      setAiHitter(s.aiHitter || "opp1"); setAiTarget(s.aiTarget || "B2"); setAiLaufZone(s.aiLaufZone || "D2");
    }
    setIsEditingStep(true);
  };

  const handleDeleteStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    const reindexed = updated.map((s, i) => ({ ...s, stepId: i + 1 }));
    setSteps(reindexed);
  };

  const handleAddStep = () => {
    const newStep: StrategyStep = {
      stepId: editingIndex !== null ? editingIndex + 1 : steps.length + 1,
      playerTurn,
      description: stepDesc,
      stepExplanation: stepExpl,
      positions: {
        you: posYou, partner: posPartner, opp1: posOpp1, opp2: posOpp2,
        ball: { side: ballSide, zone: ballZone, type: ballType }
      },
      ...(playerTurn === "you" 
        ? { validShots, bestZones, laufZone } 
        : { aiHitter, aiShot: ballType, aiTarget, aiLaufZone })
    };
    
    if (editingIndex !== null) {
      const updated = [...steps];
      updated[editingIndex] = newStep;
      setSteps(updated);
      setEditingIndex(null);
    } else {
      setSteps([...steps, newStep]);
    }
    setIsEditingStep(false);
  };

  const handleTestDraft = () => {
    if (steps.length === 0) return alert("Füge zuerst Züge hinzu, um sie zu testen!");
    const stratToTest: StrategySequence = {
      id: "DRAFT", 
      title: `${title || "Entwurf"} (VORSCHAU)`, 
      theme, 
      difficulty, 
      description, 
      steps
    };
    onTestStrategy(stratToTest, "draft");
  };

  const handleSubmitStrategy = async () => {
    if (!user) return alert("Bitte logge dich ein, um eine Strategie zu erstellen.");
    setIsSubmitting(true);

    const userName = user.user_metadata?.display_name || user.email?.split('@')[0] || "Community Spieler";

    const { error } = await supabase
      .from('community_strategies')
      .insert({
        creator_id: user.id,
        creator_name: userName,
        title,
        theme,
        difficulty,
        description,
        steps,
        status: "pending"
      });

    setIsSubmitting(false);
    if (error) {
      setSubmitStatus("error");
      alert("Fehler beim Einreichen: " + error.message);
      console.error(error);
    } else {
      setSubmitStatus("success");
      localStorage.removeItem('padelStrategyDraft');
      setTimeout(() => onBack(), 3000);
    }
  };

  const previewPositions = {
    you: posYou, partner: posPartner, opp1: posOpp1, opp2: posOpp2,
    ball: { side: ballSide as any, zone: ballZone, type: ballType }
  };

  if (showAdmin) {
    return (
      <div className="w-full flex flex-col gap-6 text-slate-200">
        <AdminDashboard onExit={() => setShowAdmin(false)} onTestStrategy={onTestStrategy} />
      </div>
    );
  }

  if (submitStatus === "success") {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#050b18]/90 rounded-2xl border border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
        <span className="text-6xl mb-4">🚀</span>
        <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest mb-2">Erfolgreich Eingereicht!</h2>
        <p className="text-slate-300">Deine Strategie "{title}" wurde an die Datenbank gesendet. Ein Admin wird sie prüfen und in Kürze für alle freigeben!</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      <div className="flex items-center justify-between bg-[#040914] p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">← Zurück</button>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase tracking-widest">
            Community Builder Betaphase
          </h2>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdmin(true)} className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/50 px-4 py-2 rounded-lg font-bold hover:bg-purple-600 hover:text-white transition-all uppercase tracking-widest">
            🛡️ Admin
          </button>
        )}
      </div>

      {!isEditingStep ? (
        <div className="flex flex-col gap-6">
          <div className="bg-[#050b18] p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">Basis Infos</h3>
            
            <input type="text" placeholder="Titel der Strategie..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none focus:border-cyan-500" />
            
            <div className="flex gap-4">
              <select value={theme} onChange={(e) => setTheme(e.target.value as any)} className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none text-sm">
                <option value="Offensive">Offensive</option>
                <option value="Defensive">Defensive</option>
                <option value="Umschaltspiel">Umschaltspiel</option>
              </select>
              <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as any)} className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none text-sm">
                <option value={1}>⭐ Leicht (1)</option>
                <option value={2}>⭐⭐ Mittel (2)</option>
                <option value={3}>⭐⭐⭐ Schwer (3)</option>
              </select>
            </div>
            
            <textarea placeholder="Kurze Beschreibung für die Community..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none focus:border-cyan-500 h-24 resize-none" />
          </div>

          <div className="bg-[#050b18] p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">2. Spielzüge ({steps.length})</h3>
            
            <div className="flex flex-col gap-2">
              {steps.map((s, idx) => (
                <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-300 block">Zug {idx + 1}: {s.playerTurn === "you" ? "Du" : "Gegner"}</span>
                    <span className="text-xs text-slate-500 truncate block">{s.description}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditStep(idx)} className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-colors text-xs">✏️</button>
                    <button onClick={() => handleDeleteStep(idx)} className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={openNewStep} className="w-full py-3 border border-dashed border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-950/30 transition-colors text-xs font-bold uppercase tracking-widest mt-2">
              + Neuen Zug hinzufügen
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleTestDraft} 
              disabled={steps.length === 0} 
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            >
              Vorschau Testen 🎮
            </button>
            <button 
              onClick={handleSubmitStrategy} 
              disabled={steps.length === 0 || !title || !description || isSubmitting}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02] active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSubmitting ? "Wird gesendet..." : "Einreichen ➔"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
          
          <div className="h-[50vh] lg:h-full min-h-[400px] bg-[#030611] rounded-2xl border border-slate-800 overflow-hidden sticky top-4">
            <ScenarioCourt25 
              level={"Strategie" as any}
              positions={previewPositions} 
              selectedZone={playerTurn === "you" ? bestZones[0] : aiTarget} 
              bestZones={playerTurn === "you" ? bestZones : (aiTarget ? [aiTarget] : [])} 
              selectedLaufZone={playerTurn === "you" ? laufZone : aiLaufZone}
              perfectLaufZone={playerTurn === "you" ? laufZone : aiLaufZone}
              acceptableZones={[]} acceptableLaufZones={[]}
              hasSubmitted={false} 
              profiMode={false} onZoneClick={()=>{}} onLaufZoneClick={()=>{}}
              activeChar={playerTurn === "you" ? "you" : aiHitter}
              hitterId={playerTurn === "you" ? "you" : aiHitter}
            />
          </div>

          <div className="bg-[#050b18] p-5 rounded-xl border border-slate-800 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{editingIndex !== null ? "Zug bearbeiten" : "Zug erstellen"}</h3>
              <button onClick={() => { setIsEditingStep(false); setEditingIndex(null); }} className="text-slate-500 hover:text-white text-xs">Abbrechen</button>
            </div>

            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
              <button onClick={() => handleTurnChange("you")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "you" ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>Du bist dran</button>
              <button onClick={() => handleTurnChange("ai")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "ai" ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Gegner ist dran</button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Briefing (Was passiert gerade?)</label>
              <textarea value={stepDesc} onChange={e => setStepDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
              
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-2">Auflösung (Erklärung nach dem Zug)</label>
              <textarea value={stepExpl} onChange={e => setStepExpl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-[10px] text-cyan-400 font-bold uppercase mb-3">Spieler-Positionen</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Du (Rechts)</label>
                  <select value={posYou} onChange={e => setPosYou(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Dein Partner (Links)</label>
                  <select value={posPartner} onChange={e => setPosPartner(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Gegner 1 (Links)</label>
                  <select value={posOpp1} onChange={e => setPosOpp1(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Gegner 2 (Rechts)</label>
                  <select value={posOpp2} onChange={e => setPosOpp2(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
              </div>

              <h4 className="text-[10px] text-cyan-400 font-bold uppercase mt-4 mb-2">Wo liegt der Ball (vor dem Schlag)?</h4>
              <div className="grid grid-cols-3 gap-2">
                <select value={ballSide} onChange={e => setBallSide(e.target.value as any)} className="bg-slate-800 text-xs p-1.5 rounded outline-none text-orange-300">
                  <option value="left">Unten (Bei dir)</option>
                  <option value="right">Oben (Gegner)</option>
                </select>
                <select value={ballZone} onChange={e => setBallZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                <select value={ballType} onChange={e => setBallType(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{SHOTS.map(z => <option key={z} value={z}>{z}</option>)}</select>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-[10px] text-emerald-400 font-bold uppercase mb-3">Lösung (Was soll gespielt werden?)</h4>
              
              {playerTurn === "you" ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Richtiges Schlagziel (Zone)</label>
                    <select value={bestZones[0]} onChange={e => setBestZones([e.target.value])} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Richtiger Laufweg (Zone danach)</label>
                    <select value={laufZone} onChange={e => setLaufZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Richtiger Schlag</label>
                    <select value={validShots[0]} onChange={e => setValidShots([e.target.value])} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{SHOTS.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Wer schlägt?</label>
                    <select value={aiHitter} onChange={e => setAiHitter(e.target.value as any)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">
                      <option value="opp1">Gegner 1 (Links)</option>
                      <option value="opp2">Gegner 2 (Rechts)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Ziel des Gegners</label>
                    <select value={aiTarget} onChange={e => setAiTarget(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Laufweg des Gegners</label>
                    <select value={aiLaufZone} onChange={e => setAiLaufZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleAddStep} className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all">
              Zug speichern
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
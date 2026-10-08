import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import ScenarioCourt25 from "./ScenarioCourt25";
import { StrategyStep, StrategySequence } from "../lib/strategies";

const ZONES = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E3", "E4", "E5"];
const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE", "VORBEREITUNG"];

// ==========================================
// ADMIN DASHBOARD (Nur für dich sichtbar)
// ==========================================
function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [pendingStrats, setPendingStrats] = useState<any[]>([]);

  useEffect(() => {
    async function fetchPending() {
      const { data } = await supabase
        .from('community_strategies')
        .select('*')
        .eq('status', 'pending');
      if (data) setPendingStrats(data);
    }
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    await supabase.from('community_strategies').update({ status: 'approved' }).eq('id', id);
    setPendingStrats(pendingStrats.filter(s => s.id !== id));
  };

  const handleReject = async (id: string) => {
    await supabase.from('community_strategies').update({ status: 'rejected' }).eq('id', id);
    setPendingStrats(pendingStrats.filter(s => s.id !== id));
  };

  return (
    <div className="w-full bg-[#050b18] p-6 rounded-xl border border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
      <div className="flex justify-between items-center mb-6 border-b border-purple-900/50 pb-4">
        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 uppercase tracking-widest">Admin: Prüf-Zentrale</h2>
        <button onClick={onExit} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">Schließen</button>
      </div>
      
      {pendingStrats.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Keine neuen Strategien zur Prüfung vorhanden. Alles sauber! 🧹</p>
      ) : null}
      
      <div className="flex flex-col gap-4">
        {pendingStrats.map(strat => (
          <div key={strat.id} className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-lg text-white">{strat.title}</h3>
              <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Eingereicht von: {strat.creator_name}</span>
            </div>
            <p className="text-sm text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800">{strat.description}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => handleApprove(strat.id)} className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all">✅ Freigeben</button>
              <button onClick={() => handleReject(strat.id)} className="flex-1 bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all">❌ Ablehnen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// STRATEGY BUILDER HAUPTKOMPONENTE
// ==========================================
export default function StrategyBuilder({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  
  // 🔥 HIER DEINE E-MAIL EINTRAGEN:
  const isAdmin = user?.email === 'caposion@gmail.com';
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Basic Info State
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<"Offensive" | "Defensive" | "Umschaltspiel">("Offensive");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState("");

  // Steps State
  const [steps, setSteps] = useState<StrategyStep[]>([]);
  
  // Current Editing Step State
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [playerTurn, setPlayerTurn] = useState<"you" | "ai">("you");
  const [stepDesc, setStepDesc] = useState("");
  const [stepExpl, setStepExpl] = useState("");
  
  const [posYou, setPosYou] = useState("B2");
  const [posPartner, setPosPartner] = useState("D2");
  const [posOpp1, setPosOpp1] = useState("B2");
  const [posOpp2, setPosOpp2] = useState("D2");
  
  const [ballSide, setBallSide] = useState<"left" | "right">("right"); // right = deine Seite, left = Gegner
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

  // Smarter Wechsel: Setzt den Ball automatisch auf die korrekte Spielfeldhälfte
  const handleTurnChange = (turn: "you" | "ai") => {
    setPlayerTurn(turn);
    setBallSide(turn === "you" ? "right" : "left");
  };

  const handleAddStep = () => {
    const newStep: StrategyStep = {
      stepId: steps.length + 1,
      playerTurn,
      description: stepDesc,
      stepExplanation: stepExpl,
      positions: {
        you: posYou,
        partner: posPartner,
        opp1: posOpp1,
        opp2: posOpp2,
        ball: { side: ballSide, zone: ballZone, type: ballType }
      },
      ...(playerTurn === "you" 
        ? { validShots, bestZones, laufZone } 
        : { aiHitter, aiShot: ballType, aiTarget, aiLaufZone })
    };
    setSteps([...steps, newStep]);
    setIsEditingStep(false);
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
      console.error(error);
    } else {
      setSubmitStatus("success");
      setTimeout(() => onBack(), 3000);
    }
  };

  // Preview Data für das 3D-Feld
  const previewPositions = {
    you: posYou, partner: posPartner, opp1: posOpp1, opp2: posOpp2,
    ball: { side: ballSide as any, zone: ballZone, type: ballType }
  };

  // Wenn der Admin-Modus aktiv ist
  if (showAdmin) {
    return (
      <div className="w-full flex flex-col gap-6 text-slate-200">
        <AdminDashboard onExit={() => setShowAdmin(false)} />
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
            Community Builder
          </h2>
        </div>
        {/* Geheimer Admin-Button: Wird nur eingeblendet, wenn die E-Mail oben übereinstimmt */}
        {isAdmin && (
          <button 
            onClick={() => setShowAdmin(true)}
            className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/50 px-4 py-2 rounded-lg font-bold hover:bg-purple-600 hover:text-white transition-all uppercase tracking-widest"
          >
            🛡️ Admin
          </button>
        )}
      </div>

      {!isEditingStep ? (
        <div className="flex flex-col gap-6">
          {/* Basis-Informationen */}
          <div className="bg-[#050b18] p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">1. Basis Infos</h3>
            
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

          {/* Übersicht der Schritte */}
          <div className="bg-[#050b18] p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">2. Spielzüge ({steps.length})</h3>
            
            <div className="flex flex-col gap-2">
              {steps.map((s, idx) => (
                <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300">Zug {idx + 1}: {s.playerTurn === "you" ? "Du" : "Gegner"}</span>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setIsEditingStep(true)} className="w-full py-3 border border-dashed border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-950/30 transition-colors text-xs font-bold uppercase tracking-widest mt-2">
              + Neuen Zug hinzufügen
            </button>
          </div>

          <button 
            onClick={handleSubmitStrategy} 
            disabled={steps.length === 0 || !title || !description || isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02] active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSubmitting ? "Wird gesendet..." : "Strategie Einreichen ➔"}
          </button>
        </div>
      ) : (
        /* STEP EDITOR (Formular + Live Vorschau) */
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
          
          {/* Linke Seite: Live Vorschau */}
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

          {/* Rechte Seite: Formular */}
          <div className="bg-[#050b18] p-5 rounded-xl border border-slate-800 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">Zug konfigurieren</h3>
              <button onClick={() => setIsEditingStep(false)} className="text-slate-500 hover:text-white text-xs">Abbrechen</button>
            </div>

            {/* Wer ist dran? */}
            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
              <button onClick={() => handleTurnChange("you")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "you" ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>Du bist dran</button>
              <button onClick={() => handleTurnChange("ai")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "ai" ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Gegner ist dran</button>
            </div>

            {/* Beschreibungen */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Briefing (Was passiert gerade?)</label>
              <textarea value={stepDesc} onChange={e => setStepDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
              
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-2">Auflösung (Erklärung nach dem Zug)</label>
              <textarea value={stepExpl} onChange={e => setStepExpl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
            </div>

            {/* Positionen auf dem Feld */}
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
                  <option value="right">Unten (Bei dir)</option>
                  <option value="left">Oben (Gegner)</option>
                </select>
                <select value={ballZone} onChange={e => setBallZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                <select value={ballType} onChange={e => setBallType(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{SHOTS.map(z => <option key={z} value={z}>{z}</option>)}</select>
              </div>
            </div>

            {/* Spezifische Einstellungen je nach Turn */}
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
                    <label className="text-[10px] text-slate-400">Richtigschlag</label>
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
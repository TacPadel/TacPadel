import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import ScenarioCourt25 from "./ScenarioCourt25";
import { StrategyStep, StrategySequence } from "../lib/strategies";
import AdminDashboard from "./AdminDashboard";
import { useTranslation, formatShotName } from "../lib/i18n";

const ZONES = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E3", "E4", "E5"];
const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE", "VORBEREITUNG"];

interface StrategyBuilderProps {
  onBack: () => void;
  onTestStrategy: (strat: StrategySequence, type: "admin" | "draft") => void;
  startInAdmin?: boolean; 
}

export default function StrategyBuilder({ onBack, onTestStrategy, startInAdmin = false }: StrategyBuilderProps) {
  const { user } = useAuth();
  const { lang, t } = useTranslation();
  
  const emailLower = user?.email?.toLowerCase().trim() || "";
  const isAdmin = emailLower === "caposion@gmail.com" || emailLower === "admin@tacpadel.com";
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

  const renderShotLabel = (shot: string) => {
    if (shot === "VORBEREITUNG") return t("sb_shot_prep");
    return formatShotName(shot, lang);
  };

  const handleTurnChange = (turn: "you" | "ai") => {
    setPlayerTurn(turn);
    setBallSide(turn === "you" ? "left" : "right");
  };

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
    if (steps.length === 0) return alert(t("sb_alert_add_moves"));
    const stratToTest: StrategySequence = {
      id: "DRAFT", 
      title: `${title || t("sb_draft_fallback")} (${t("sb_preview_tag")})`, 
      theme, 
      difficulty, 
      description, 
      steps
    };
    onTestStrategy(stratToTest, "draft");
  };

  const handleSubmitStrategy = async () => {
    if (!user) return alert(t("sb_alert_login_req"));
    setIsSubmitting(true);

    const userName = user.user_metadata?.display_name || user.email?.split('@')[0] || t("sb_community_player");

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
      alert(t("sb_alert_submit_err") + error.message);
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
        <AdminDashboard
          onExit={() => setShowAdmin(false)}
          onTestStrategy={onTestStrategy}
          initialTab="strategies"
        />
      </div>
    );
  }

  if (submitStatus === "success") {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#050b18]/90 rounded-2xl border border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
        <span className="text-6xl mb-4">🚀</span>
        <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest mb-2">{t("sb_success_title")}</h2>
        <p className="text-slate-300">{t("sb_success_desc_1")} "{title}" {t("sb_success_desc_2")}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      <div className="flex items-center justify-between bg-[#040914] p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">{t("btn_back")}</button>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase tracking-widest">
            {t("sb_header_title")}
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
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">{t("sb_basic_info")}</h3>
            
            <input type="text" placeholder={t("sb_title_placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none focus:border-cyan-500" />
            
            <div className="flex gap-4">
              <select value={theme} onChange={(e) => setTheme(e.target.value as any)} className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none text-sm">
                <option value="Offensive">{t("strat_theme_off")}</option>
                <option value="Defensive">{t("strat_theme_def")}</option>
                <option value="Umschaltspiel">{t("strat_theme_trans")}</option>
              </select>
              <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as any)} className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none text-sm">
                <option value={1}>{t("sb_diff_easy")}</option>
                <option value={2}>{t("sb_diff_med")}</option>
                <option value={3}>{t("sb_diff_hard")}</option>
              </select>
            </div>
            
            <textarea placeholder={t("sb_desc_placeholder")} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg outline-none focus:border-cyan-500 h-24 resize-none" />
          </div>

          <div className="bg-[#050b18] p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">{t("sb_moves_header")} ({steps.length})</h3>
            
            <div className="flex flex-col gap-2">
              {steps.map((s, idx) => (
                <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-300 block">{t("sb_move_label")} {idx + 1}: {s.playerTurn === "you" ? t("home_you_tag") : t("game_opponent")}</span>
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
              {t("sb_add_move_btn")}
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleTestDraft} 
              disabled={steps.length === 0} 
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            >
              {t("sb_test_preview_btn")}
            </button>
            <button 
              onClick={handleSubmitStrategy} 
              disabled={steps.length === 0 || !title || !description || isSubmitting}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02] active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSubmitting ? t("sb_sending") : t("sb_submit_btn")}
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
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{editingIndex !== null ? t("sb_edit_move_title") : t("sb_create_move_title")}</h3>
              <button onClick={() => { setIsEditingStep(false); setEditingIndex(null); }} className="text-slate-500 hover:text-white text-xs">{t("prof_cancel")}</button>
            </div>

            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
              <button onClick={() => handleTurnChange("you")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "you" ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>{t("sb_your_turn_btn")}</button>
              <button onClick={() => handleTurnChange("ai")} className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-colors ${playerTurn === "ai" ? 'bg-red-600 text-white' : 'text-slate-500'}`}>{t("sb_opp_turn_btn")}</button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t("sb_briefing_label")}</label>
              <textarea value={stepDesc} onChange={e => setStepDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
              
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-2">{t("sb_resolution_label")}</label>
              <textarea value={stepExpl} onChange={e => setStepExpl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-md outline-none text-xs h-16" />
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-[10px] text-cyan-400 font-bold uppercase mb-3">{t("sb_player_pos_title")}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">{t("sb_pos_you_right")}</label>
                  <select value={posYou} onChange={e => setPosYou(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">{t("sb_pos_partner_left")}</label>
                  <select value={posPartner} onChange={e => setPosPartner(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">{t("sb_pos_opp1_left")}</label>
                  <select value={posOpp1} onChange={e => setPosOpp1(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">{t("sb_pos_opp2_right")}</label>
                  <select value={posOpp2} onChange={e => setPosOpp2(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                </div>
              </div>

              <h4 className="text-[10px] text-cyan-400 font-bold uppercase mt-4 mb-2">{t("sb_ball_pos_title")}</h4>
              <div className="grid grid-cols-3 gap-2">
                <select value={ballSide} onChange={e => setBallSide(e.target.value as any)} className="bg-slate-800 text-xs p-1.5 rounded outline-none text-orange-300">
                  <option value="left">{t("sb_ball_side_left")}</option>
                  <option value="right">{t("sb_ball_side_right")}</option>
                </select>
                <select value={ballZone} onChange={e => setBallZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                <select value={ballType} onChange={e => setBallType(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{SHOTS.map(z => <option key={z} value={z}>{renderShotLabel(z)}</option>)}</select>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-[10px] text-emerald-400 font-bold uppercase mb-3">{t("sb_solution_title")}</h4>
              
              {playerTurn === "you" ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_sol_target")}</label>
                    <select value={bestZones[0]} onChange={e => setBestZones([e.target.value])} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_sol_run")}</label>
                    <select value={laufZone} onChange={e => setLaufZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_sol_shot")}</label>
                    <select value={validShots[0]} onChange={e => setValidShots([e.target.value])} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{SHOTS.map(z => <option key={z} value={z}>{renderShotLabel(z)}</option>)}</select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_who_hits")}</label>
                    <select value={aiHitter} onChange={e => setAiHitter(e.target.value as any)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">
                      <option value="opp1">{t("sb_pos_opp1_left")}</option>
                      <option value="opp2">{t("sb_pos_opp2_right")}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_opp_target")}</label>
                    <select value={aiTarget} onChange={e => setAiTarget(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">{t("sb_opp_run")}</label>
                    <select value={aiLaufZone} onChange={e => setAiLaufZone(e.target.value)} className="bg-slate-800 text-xs p-1.5 rounded outline-none">{ZONES.map(z => <option key={z} value={z}>{z}</option>)}</select>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleAddStep} className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all">
              {t("sb_save_move_btn")}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
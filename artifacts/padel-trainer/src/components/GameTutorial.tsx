import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { AI_PROFILES } from "../engine/AiProfiles";
import { GamePhase, TurnResult } from "../engine/GameLogic";

interface GameTutorialProps {
  onComplete: () => void;
}

// Hilfsfunktion für millisekundengenaue Pausen im "Film"
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function GameTutorial({ onComplete }: GameTutorialProps) {
  // --- UI & TEXT STATES ---
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [title, setTitle] = useState("1. Dein Aufschlag");
  const [text, setText] = useState("Du hast Aufschlag. Ziele durch die Mitte (T-Linie), um den Winkel für den Return zu minimieren.");

  // --- FAKE ACTION BAR STATES ---
  const [mockUi, setMockUi] = useState({
    run: "D4" as string | null,
    target: "C2" as string | null,
    shot: "AUFSCHLAG" as string | null,
    showTimer: false
  });

  // --- 3D COURT STATES ---
  const [phase, setPhase] = useState<GamePhase>("player_planning");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  
  const [tutZone, setTutZone] = useState<string | null>("C2");
  const [tutLauf, setTutLauf] = useState<string | null>("D4");
  const [tutShot, setTutShot] = useState<string | null>("AUFSCHLAG");

  // Initialer State: Du bereitest Aufschlag vor. (left = Deine Seite, unten)
  const [courtState, setCourtState] = useState({ 
    you: "D1", partner: "B4", opp1: "B1", opp2: "D1", 
    ball: { side: "left" as "left"|"right", zone: "D1", type: "PREPARE_SERVE" } 
  });

  const [animTrigger, setAnimTrigger] = useState(0);

  // =========================================================================
  // DAS REGIE-SKRIPT: HIER PASSIERT DIE MAGIE
  // =========================================================================
  const runStepAnimation = async (nextStep: number) => {
    setIsAnimating(true); // Sperrt den Weiter-Button
    setStepIndex(nextStep);
    setAnimTrigger(prev => prev + 1); // Zwingt 3D-Kamera zum Neuladen

    if (nextStep === 1) {
      setTitle("Aufschlag ausgeführt");
      setText("Perfekt. Der Ball fliegt zur T-Linie und du rückst sofort ans Netz vor, um den Druck zu erhöhen.");
      
      // 1. Aufschlag-Animation starten (Ball fliegt auf Gegner-Seite = right)
      setHasSubmitted(true);
      setTurnResult("success");
      setCourtState(prev => ({ 
        ...prev, 
        you: "D4", // Du rückst ans Netz vor
        ball: { side: "right", zone: "C2", type: "AUFSCHLAG" } 
      }));

      // 2. Warten, bis der Ball beim Gegner ist
      await sleep(2500); 
    } 
    
    else if (nextStep === 2) {
      setTitle("2. Gegner returniert");
      setText("Der Gegner reagiert auf deinen Aufschlag. Er muss durch die Mitte returnieren. Beobachte seinen Schlag – der Timer startet!");
      
      // 1. Vorbereiten für den Return
      setHasSubmitted(false);
      setTurnResult(null);
      setPhase("timer_running");
      
      // 2. UI zurücksetzen & Timer einblenden
      setMockUi({ run: null, target: null, shot: null, showTimer: true });
      setTutZone(null); setTutLauf(null); setTutShot(null);

      // 3. Gegner schlägt (Ball fliegt zu dir = left)
      setCourtState({ 
        you: "D4", partner: "B4", opp1: "C2", opp2: "D1", // Gegner opp1 tritt in die Mitte (C2)
        ball: { side: "left", zone: "D4", type: "DRIVE" } // Ball fliegt flach auf dich zu
      });
      
      // Warten, damit der Spieler sieht, wie der Balken schrumpft
      await sleep(1500); 
    } 
    
    else if (nextStep === 3) {
      setTitle("3. Volley vorbereiten");
      setText("Der flache Return kommt auf dich zu. Wie von Geisterhand wählen wir tief in die Ecke (A1) und bereiten den Volley vor.");
      
      setPhase("player_planning"); // Timer stoppt visuell
      
      // UI füllt sich Stück für Stück automatisch aus!
      await sleep(600);
      setMockUi(prev => ({ ...prev, run: "D4" }));
      setTutLauf("D4");

      await sleep(600);
      setMockUi(prev => ({ ...prev, target: "A1" }));
      setTutZone("A1");

      await sleep(600);
      setMockUi(prev => ({ ...prev, shot: "VOLLEY" }));
      setTutShot("VOLLEY");

      await sleep(400); // Kurz wirken lassen
    } 
    
    else if (nextStep === 4) {
      setTitle("Klasse Spielzug!");
      setText("Stark! Mit dem Volley hältst du den Druck aufrecht und zwingst die Gegner in die absolute Defensive. Genau so funktioniert ein Match!");
      
      // 1. Timer ausblenden, Animation starten
      setMockUi(prev => ({ ...prev, showTimer: false }));
      setHasSubmitted(true);
      setTurnResult("success");
      
      // 2. Du volleyierst, Gegner flüchtet zurück nach B1 (Ball fliegt zum Gegner = right)
      setCourtState({ 
        you: "D4", partner: "B4", opp1: "B1", opp2: "D1", 
        ball: { side: "right", zone: "A1", type: "VOLLEY" } 
      });

      // 3. Warten, bis Volley einschlägt
      await sleep(2500);
    }

    setIsAnimating(false); // Weiter-Button wieder freigeben
  };

  const handleNextClick = () => {
    if (stepIndex < 4) {
      runStepAnimation(stepIndex + 1);
    } else {
      onComplete(); // Tutorial beenden
    }
  };

  return (
    <div 
      className="w-full flex-1 flex flex-col bg-[#050b18] rounded-2xl border border-slate-900 shadow-2xl select-none relative overflow-hidden" 
      style={{ height: "calc(100dvh - 150px)", minHeight: "600px" }}
    >
      
      {/* ========================================= */}
      {/* OBERER BEREICH: 3D COURT (FLEX-1)         */}
      {/* ========================================= */}
      <div className="relative w-full flex-1 overflow-hidden z-10 bg-[#030611]">
        <ScenarioCourt3D 
          key={`tutorial-court-${animTrigger}`} 
          arenaModel="/TacPadel.glb" 
          playIntro={false}  
          gameOver={false} 
          
          level="Spielzug" 
          positions={courtState as any} 
          hasSubmitted={hasSubmitted}
          bestZones={[]} 
          acceptableZones={[]}
          profiMode={false}
          
          selectedZone={tutZone}
          selectedLaufZone={tutLauf} 
          selectedPartnerZone={null}
          
          activeChar="you" 
          hitterId="you"
          
          isTimerActive={mockUi.showTimer} 
          turnResult={turnResult}
          previewShot={tutShot}
          timerDuration={4000} 
          
          onZoneClick={() => {}}
          onLaufZoneClick={() => {}}
          onPlayerClick={() => {}}
          
          playerScore={0} aiScore={0}
          isAiActive={phase === "ai_prepare"} 
          phase={phase} 
          isTimerPhase={mockUi.showTimer}
          isPlayerTeamServe={true}
          hidePlayerLabels={false}
          userTeamName="Du & Partner"
          activeAiProfile={AI_PROFILES[0]}
        />
      </div>

      {/* ========================================= */}
      {/* UNTERER BEREICH: ACTION BAR & TEXTBOX     */}
      {/* ========================================= */}
      <div className="w-full z-40 bg-[#050b18] border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] shrink-0 pb-16">
        
        {/* --- 1. Fake Action Bar --- */}
        <div className="p-2 sm:p-3 border-b border-slate-800">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            
            {/* Fake Timer Header */}
            <div className="flex items-center justify-between px-1 mb-1 mt-1">
              <span className="text-[9px] font-black tracking-widest uppercase text-purple-400">
                DU (Schläger)
              </span>
              <div className="w-1/2 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <motion.div 
                  initial={{ width: "100%" }} 
                  animate={{ width: mockUi.showTimer ? "0%" : "100%" }} 
                  transition={{ duration: 4, ease: "linear" }}
                  className={`h-full ${mockUi.showTimer ? 'bg-emerald-500' : 'bg-slate-700 opacity-50'}`} 
                />
              </div>
            </div>

            {/* Fake Auswahl-Buttons */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className={`p-1.5 rounded border text-center transition-colors duration-500 ${mockUi.run ? 'border-purple-500/50 bg-purple-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                <div className="text-[7px] font-black uppercase text-purple-400">Laufzone</div>
                <div className="text-[9px] font-bold text-white truncate">{mockUi.run || "-"}</div>
              </div>
              <div className={`p-1.5 rounded border text-center transition-colors duration-500 ${mockUi.target ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                <div className="text-[7px] font-black text-emerald-400 uppercase">Schlagziel</div>
                <div className="text-[9px] font-bold text-white truncate">{mockUi.target || "-"}</div>
              </div>
              <div className={`p-1.5 rounded border text-center transition-colors duration-500 ${mockUi.shot ? 'border-orange-500/50 bg-orange-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                <div className="text-[7px] font-black text-orange-400 uppercase">Schlag</div>
                <div className="text-[9px] font-bold text-white truncate">{mockUi.shot || "-"}</div>
              </div>
            </div>

            {/* Fake Submit Button */}
            <button disabled className={`w-full py-2 font-black text-[10px] tracking-widest uppercase rounded-lg border transition-all ${
                mockUi.showTimer ? "bg-slate-900 text-slate-700 border-slate-800" 
                : hasSubmitted ? "bg-emerald-900/50 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                : "bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            }`}>
              {mockUi.showTimer ? "Zeit läuft..." : hasSubmitted ? "Wird ausgeführt..." : "Zug ausführen"}
            </button>
          </div>
        </div>

        {/* --- 2. Info Textbox --- */}
        <div className="p-3 sm:p-5 bg-gradient-to-b from-[#050b18] to-black">
          <AnimatePresence mode="wait">
            <motion.div 
              key={stepIndex}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl mx-auto flex flex-col gap-2"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-900/50">
                  Schritt {stepIndex + 1} / 5
                </span>
              </div>
              
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                {title}
              </h2>
              
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium min-h-[50px] sm:min-h-[60px]">
                {text}
              </p>

              <div className="flex justify-end pt-3 mt-1 border-t border-slate-700/50">
                <button 
                  onClick={handleNextClick}
                  disabled={isAnimating}
                  className={`w-full sm:w-auto px-6 py-3 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all ${
                    isAnimating 
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                      : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95"
                  }`}
                >
                  {isAnimating ? "Warten..." : stepIndex === 4 ? "Tutorial beenden ➔" : "Weiter ➔"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        
      </div>

    </div>
  );
}
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { AI_PROFILES } from "../engine/AiProfiles";
import { GamePhase, TurnResult } from "../engine/GameLogic";

interface GameTutorialProps {
  onComplete: () => void;
}

// Hilfsfunktion, um Pausen im Code zu erzwingen (in Millisekunden)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function GameTutorial({ onComplete }: GameTutorialProps) {
  // --- UI STATES ---
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false); // Sperrt den "Weiter"-Button während einer Animation
  const [title, setTitle] = useState("Willkommen");
  const [text, setText] = useState("Im Match-Modus spielst du Sätze gegen die KI. Timing, die richtige Taktik und Ausdauer entscheiden über Sieg oder Niederlage.");

  // --- COURT STATES (Steuern die 3D Szene) ---
  const [phase, setPhase] = useState<GamePhase>("ai_prepare");
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  
  const [commands, setCommands] = useState({ run: null as string | null, target: null as string | null, shot: null as string | null });
  
  const [courtState, setCourtState] = useState({ 
    you: "D1", partner: "B4", opp1: "B1", opp2: "D1", 
    ball: { side: "right" as "left"|"right", zone: "D1", type: "PREPARE_SERVE" } 
  });

  // =========================================================================
  // HIER KANNST DU DAS TIMING FÜR JEDEN SCHRITT PERFEKT ANPASSEN!
  // =========================================================================
  const runStepAnimation = async (nextStep: number) => {
    setIsAnimating(true); // Button sperren
    setStepIndex(nextStep);

    if (nextStep === 1) {
      setTitle("1. Reagieren (Zeitdruck!)");
      setText("Dein Aufschlag wurde returniert! Der Ball fliegt flach auf dich zu. Ab jetzt tickt ein Timer! Du musst schnell handeln, bevor die Zeit abläuft.");
      
      // 1. Kurze Pause, damit der Spieler den Text anfangen kann zu lesen
      await sleep(800); 

      // 2. Ball abfeuern (Gegner returnt von C2 auf dich an D4)
      setPhase("timer_running");
      setIsTimerActive(true);
      setCourtState({ 
        you: "D4", partner: "B4", opp1: "C2", opp2: "D1", 
        ball: { side: "left", zone: "D4", type: "DRIVE" } 
      });

      // 3. Warten, bis der Ball bei dir ankommt (Timer-Dauer)
      await sleep(2500); 
    } 
    
    else if (nextStep === 2) {
      setTitle("2. Laufweg festlegen");
      setText("Da du nach dem Aufschlag schon optimal am Netz stehst, wählen wir D4, um deine Position zu halten.");
      
      // 1. Spiel pausiert zum Planen
      setPhase("player_planning");
      setIsTimerActive(false);
      
      // 2. Kurze Pause für den visuellen Effekt
      await sleep(600); 

      // 3. Setze den Laufweg visuell
      setCommands(prev => ({ ...prev, run: "D4" }));
    } 
    
    else if (nextStep === 3) {
      setTitle("3. Schlagziel & Art");
      setText("Jetzt markieren wir unser Schlagziel in der tiefen Ecke (A1), um den Gegner festzunageln, und wählen als Schlag den VOLLEY.");
      
      await sleep(600);
      
      // Setze das Ziel und den Schlag
      setCommands(prev => ({ ...prev, target: "A1", shot: "VOLLEY" }));
    } 
    
    else if (nextStep === 4) {
      setTitle("4. Ausführen & Ausdauer");
      setText("Stark! Mit dem Volley hältst du den Druck aufrecht. Achte im echten Spiel immer auf deine Ausdauer, sonst machst du Fehler!");
      
      await sleep(400);

      // 1. Dein Spieler schlägt den Ball
      setHasSubmitted(true);
      setPhase("player_animating");
      setTurnResult("perfect");
      
      // 2. Ball fliegt nach A1, Gegner rennt panisch nach B1
      setCourtState({ 
        you: "D4", partner: "B4", opp1: "B1", opp2: "D1", 
        ball: { side: "right", zone: "A1", type: "VOLLEY" } 
      });

      // 3. Warten, bis die Flug-Animation des Volleys fertig ist
      await sleep(3000);
    }

    setIsAnimating(false); // Button wieder freigeben
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
      
      {/* 3D COURT IM HINTERGRUND (Visuelle Vorschau) */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-100">
        <ScenarioCourt3D 
          arenaModel="/TacPadel.glb" 
          playIntro={false}  
          gameOver={false} 
          
          level="Spielzug" 
          positions={courtState as any} 
          hasSubmitted={hasSubmitted}
          bestZones={[]} 
          acceptableZones={[]}
          profiMode={false}
          
          selectedZone={commands.target}
          selectedLaufZone={commands.run} 
          selectedPartnerZone={null}
          
          activeChar="you" 
          hitterId="you"
          
          isTimerActive={isTimerActive} 
          turnResult={turnResult}
          previewShot={commands.shot}
          timerDuration={2500} 
          
          onZoneClick={() => {}}
          onLaufZoneClick={() => {}}
          onPlayerClick={() => {}}
          
          playerScore={0} 
          aiScore={0}
          isAiActive={phase === "ai_prepare"} 
          phase={phase} 
          isTimerPhase={isTimerActive}
          isPlayerTeamServe={false}

          hidePlayerLabels={false}
          userTeamName="Dein Team"
          activeAiProfile={AI_PROFILES[0]}
        />
      </div>

      {/* OVERLAY MIT KOMPAKTER TEXTBOX FÜR HANDYS */}
      <div className="absolute inset-x-0 bottom-4 z-50 flex flex-col justify-end p-3 sm:p-6 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={stepIndex} // Die Box animiert kurz beim Textwechsel
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg mx-auto bg-[#050b18]/90 backdrop-blur-md border border-cyan-500/50 p-4 sm:p-5 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pointer-events-auto flex flex-col gap-2"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-900/50">
                Schritt {stepIndex + 1} / 5
              </span>
            </div>
            
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {title}
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium min-h-[60px]">
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
  );
}
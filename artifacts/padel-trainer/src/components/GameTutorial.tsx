import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { AI_PROFILES } from "../engine/AiProfiles";

interface GameTutorialProps {
  onComplete: () => void;
}

// Unser Skript für die animierte 3D-Tour (Mit dem neuen Volley-Spielzug!)
const TUTORIAL_STEPS = [
  {
    title: "Willkommen",
    text: "Im Match-Modus spielst du Sätze gegen die KI. Timing, die richtige Taktik und Ausdauer entscheiden über Sieg oder Niederlage.",
    phase: "ai_prepare", 
    isTimerActive: false,
    hasSubmitted: false,
    // Du stehst auf D1 und hast Aufschlag
    courtState: { you: "D1", partner: "B4", opp1: "B1", opp2: "D1", ball: { side: "right", zone: "D1", type: "PREPARE_SERVE" } },
    commands: { run: null as string | null, target: null as string | null, shot: null as string | null },
    turnResult: null
  },
  {
    title: "1. Reagieren (Zeitdruck!)",
    text: "Dein Aufschlag wurde returniert! Der Ball fliegt flach auf dich zu. Ab jetzt tickt ein Timer! Du musst schnell handeln, bevor die Zeit abläuft.",
    phase: "timer_running", 
    isTimerActive: true,
    hasSubmitted: false,
    // Du bist ans Netz vorgerückt (D4), der Gegner returniert aus der Mitte (C2)
    courtState: { you: "D4", partner: "B4", opp1: "C2", opp2: "D1", ball: { side: "left", zone: "D4", type: "DRIVE" } },
    commands: { run: null, target: null, shot: null },
    turnResult: null
  },
  {
    title: "2. Laufweg festlegen",
    text: "Wähle deine Laufzone, um den Ball zu erreichen. Da du schon optimal am Netz stehst, wählen wir D4, um die Position zu halten.",
    phase: "player_planning", 
    isTimerActive: false,
    hasSubmitted: false,
    courtState: { you: "D4", partner: "B4", opp1: "C2", opp2: "D1", ball: { side: "left", zone: "D4", type: "DRIVE" } },
    commands: { run: "D4", target: null, shot: null }, // Wir markieren D4 als unser Halte-Ziel
    turnResult: null
  },
  {
    title: "3. Schlagziel & Art",
    text: "Jetzt markieren wir unser Schlagziel in der tiefen Ecke (A1), um den Gegner festzunageln, und wählen als Schlag den VOLLEY.",
    phase: "player_planning", 
    isTimerActive: false,
    hasSubmitted: false,
    courtState: { you: "D4", partner: "B4", opp1: "C2", opp2: "D1", ball: { side: "left", zone: "D4", type: "DRIVE" } },
    commands: { run: "D4", target: "A1", shot: "VOLLEY" }, // A1 und VOLLEY sind ausgewählt
    turnResult: null
  },
  {
    title: "4. Ausführen & Ausdauer",
    text: "Stark! Mit dem Volley hältst du den Druck aufrecht. Jeder Sprint und harte Schlag kostet Ausdauer. Behalte den Balken immer im Blick.",
    phase: "player_animating", 
    isTimerActive: false,
    hasSubmitted: true,
    // Der Volley fliegt nach A1, der Gegner (opp1) muss hastig zurück nach B1 rennen
    courtState: { you: "D4", partner: "B4", opp1: "B1", opp2: "D1", ball: { side: "right", zone: "A1", type: "VOLLEY" } }, 
    commands: { run: "D4", target: "A1", shot: "VOLLEY" },
    turnResult: "perfect"
  }
];

export default function GameTutorial({ onComplete }: GameTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = TUTORIAL_STEPS[stepIndex];

  // Um die Animationen jedes Mal frisch auszulösen, brauchen wir einen Key
  const [animTrigger, setAnimTrigger] = useState(0);

  const handleNext = () => {
    if (stepIndex < TUTORIAL_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
      setAnimTrigger(prev => prev + 1); // Trigger für ScenarioCourt3D hochzählen
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
          key={`tutorial-court-${animTrigger}`} // Zwingt den Court, die Animation neu zu starten
          arenaModel="/TacPadel.glb" 
          playIntro={false}  
          gameOver={false} 
          
          level="Spielzug" 
          positions={step.courtState as any} 
          hasSubmitted={step.hasSubmitted}
          bestZones={[]} 
          acceptableZones={[]}
          profiMode={false}
          
          selectedZone={step.commands.target}
          selectedLaufZone={step.commands.run} 
          selectedPartnerZone={null}
          
          activeChar="you" 
          hitterId="you"
          
          isTimerActive={step.isTimerActive} 
          turnResult={step.turnResult}
          previewShot={step.commands.shot}
          timerDuration={2500} 
          
          onZoneClick={() => {}}
          onLaufZoneClick={() => {}}
          onPlayerClick={() => {}}
          
          playerScore={0} 
          aiScore={0}
          isAiActive={step.phase === "ai_prepare"} 
          phase={step.phase as any} 
          isTimerPhase={step.isTimerActive}
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
            key={stepIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg mx-auto bg-[#050b18]/90 backdrop-blur-md border border-cyan-500/50 p-4 sm:p-5 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pointer-events-auto flex flex-col gap-2"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-900/50">
                Schritt {stepIndex + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {step.title}
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
              {step.text}
            </p>

            <div className="flex justify-end pt-3 mt-1 border-t border-slate-700/50">
              <button 
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                {stepIndex === TUTORIAL_STEPS.length - 1 ? "Tutorial beenden ➔" : "Weiter ➔"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
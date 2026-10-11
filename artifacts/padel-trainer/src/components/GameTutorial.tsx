import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { AI_PROFILES } from "../engine/AiProfiles";

interface GameTutorialProps {
  onComplete: () => void;
}

// Unser Skript für die geführte 3D-Tour
const TUTORIAL_STEPS = [
  {
    title: "Willkommen auf dem Court",
    text: "Im Match-Modus spielst du komplette Sätze gegen die KI. Timing, die richtige Taktik und deine Ausdauer entscheiden über Sieg oder Niederlage.",
    phase: "player_planning",
    hasSubmitted: false,
    courtState: { you: "B1", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B1", type: "PREPARE_SERVE" } },
    commands: { run: null as string | null, target: null as string | null, shot: null as string | null },
    turnResult: null
  },
  {
    title: "1. Reagieren (Zeitdruck!)",
    text: "Der Gegner schlägt den Ball in deine Hälfte. Ab jetzt tickt ein Timer! Du musst schnell handeln, bevor die Zeit abläuft.",
    phase: "timer_running",
    hasSubmitted: false,
    courtState: { you: "B1", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B2", type: "DRIVE" } },
    commands: { run: null, target: null, shot: null },
    turnResult: null
  },
  {
    title: "2. Raumabdeckung & Laufweg",
    text: "Wähle den Spieler, der den Ball erreichen kann, und klicke auf das Feld, in das er laufen soll. Vergiss nicht, deinen Partner zur Absicherung zu positionieren!",
    phase: "player_planning",
    hasSubmitted: false,
    courtState: { you: "B1", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B2", type: "DRIVE" } },
    commands: { run: "B2", target: null, shot: null },
    turnResult: null
  },
  {
    title: "3. Schlagziel & Schlagart",
    text: "Tippe danach auf das gegnerische Feld, um dein Ziel zu markieren. Wähle anschließend unten deinen gewünschten Schlag (z. B. einen Lob oder Smash).",
    phase: "player_planning",
    hasSubmitted: false,
    courtState: { you: "B1", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B2", type: "DRIVE" } },
    commands: { run: "B2", target: "C4", shot: "LOB" },
    turnResult: null
  },
  {
    title: "4. Ausdauer (Stamina)",
    text: "Jeder Sprint und harte Schläge kosten Ausdauer. Ist der Balken rot, machst du Fehler! Spiele ab und zu langsame Bälle (Lobs), um im Ballwechsel Energie zu tanken.",
    phase: "player_animating",
    hasSubmitted: true,
    courtState: { you: "B2", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "right", zone: "C4", type: "LOB" } },
    commands: { run: "B2", target: "C4", shot: "LOB" },
    turnResult: "perfect"
  }
];

export default function GameTutorial({ onComplete }: GameTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = TUTORIAL_STEPS[stepIndex];

  const handleNext = () => {
    if (stepIndex < TUTORIAL_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      onComplete(); // Tutorial beenden und zum Hauptmenü zurückkehren
    }
  };

  return (
    <div 
      className="w-full flex-1 flex flex-col bg-[#050b18] rounded-2xl border border-slate-900 shadow-2xl select-none relative overflow-hidden" 
      style={{ height: "calc(100dvh - 150px)", minHeight: "600px" }}
    >
      
      {/* 3D COURT IM HINTERGRUND (Visuelle Vorschau) */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-60">
        <ScenarioCourt3D 
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
          
          isTimerActive={step.phase === "timer_running"} 
          turnResult={step.turnResult}
          previewShot={step.commands.shot}
          timerDuration={5000}
          
          onZoneClick={() => {}}
          onLaufZoneClick={() => {}}
          onPlayerClick={() => {}}
          
          playerScore={0} 
          aiScore={0}
          isAiActive={false} 
          phase={step.phase as any} 
          isTimerPhase={step.phase === "timer_running"}
          isPlayerTeamServe={true}

          hidePlayerLabels={false}
          userTeamName="Dein Team"
          activeAiProfile={AI_PROFILES[0]}
        />
      </div>

      {/* OVERLAY MIT TEXTBOX */}
      <div className="absolute inset-0 z-50 flex flex-col justify-end p-4 lg:p-8 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={stepIndex}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl mx-auto bg-[#050b18]/95 backdrop-blur-xl border border-cyan-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.8)] pointer-events-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50">
                Schritt {stepIndex + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              {step.title}
            </h2>
            
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-medium">
              {step.text}
            </p>

            <div className="flex justify-end border-t border-slate-700/50 pt-4 mt-auto">
              <button 
                onClick={handleNext}
                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all"
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
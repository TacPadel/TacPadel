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
  const [title, setTitle] = useState("1. Aufschlag planen");
  const [text, setText] = useState(
    "Du schlägst von hinten rechts (D1) auf. Wir zielen durch die Mitte auf die T-Linie (C2), um dem Gegner die Winkel zu nehmen, und rücken direkt ans Netz (D4) vor."
  );

  // --- FAKE ACTION BAR STATES ---
  const [mockUi, setMockUi] = useState({
    run: "D4" as string | null,
    target: "C2" as string | null,
    shot: "AUFSCHLAG" as string | null,
    showTimer: false
  });

  // --- 3D COURT STATES ---
  const [phase, setPhase] = useState<GamePhase>("player_planning");
  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  const [timerDuration, setTimerDuration] = useState(2500);
  
  const [tutZone, setTutZone] = useState<string | null>("C2");
  const [tutLauf, setTutLauf] = useState<string | null>("D4");
  const [tutShot, setTutShot] = useState<string | null>("AUFSCHLAG");

  // Initialer State: Du stehst auf D1, Ball liegt bei dir (side: "left")
  const [courtState, setCourtState] = useState({ 
    you: "D1", partner: "B4", opp1: "B1", opp2: "D1", 
    ball: { side: "left" as "left" | "right", zone: "D1", type: "PREPARE_SERVE" } 
  });

  // Exakte Hilfsvariablen wie in der echten GameScreen.tsx
  const isTimerPhase = phase === "timer_running";
  const isAiActive = phase === "ai_prepare" || phase === "timer_running";
  const isAnimPhase = phase === "player_animating" || phase === "timer_running";

  // =========================================================================
  // DAS REGIE-SKRIPT: EXAKTER SPIELABLAUF WIE IM ECHTEN MATCH
  // =========================================================================
  const runStepAnimation = async (nextStep: number) => {
    setIsAnimating(true); // Sperrt den Weiter-Button während die Animation läuft
    setStepIndex(nextStep);

    // -------------------------------------------------------------------------
    // SCHRITT 2: AUFSCHLAG AUSFÜHREN (Ball fliegt von D1 -> C2, du läufst -> D4)
    // -------------------------------------------------------------------------
    if (nextStep === 1) {
      setTitle("2. Aufschlag & Netzangriff");
      setText(
        "Zug ausgeführt! Während dein Aufschlag über das Netz auf C2 fliegt, sprintet deine Figur automatisch in die gewählte Laufzone (D4) ans Netz."
      );
      
      setTimerDuration(2500);
      setTurnResult("success");
      setPhase("player_animating"); // Macht isAnimPhase (hasSubmitted) = true -> Ball fliegt!
      
      setCourtState({ 
        you: "D4", // Du läufst vor ans Netz
        partner: "B4", 
        opp1: "B1", 
        opp2: "D1", 
        ball: { side: "left", zone: "D1", type: "AUFSCHLAG" } // Startpunkt des Balls
      });

      // Warten, bis der Aufschlag beim Gegner gelandet ist
      await sleep(2600); 

      // WICHTIG: Kurzer Reset in "ai_prepare" (hasSubmitted = false), 
      // damit der Ball offiziell oben beim Gegner (right, C2) ankommt!
      setPhase("ai_prepare");
      setTurnResult(null);
      setTutZone(null);
      setTutLauf(null);
      setTutShot(null);
      setCourtState({
        you: "D4", partner: "B4", opp1: "B1", opp2: "D1",
        ball: { side: "right", zone: "C2", type: "AUFSCHLAG" }
      });
    } 
    
    // -------------------------------------------------------------------------
    // SCHRITT 3: GEGNER RETURNIERT (Ball fliegt von C2 -> D4, Timer läuft!)
    // -------------------------------------------------------------------------
    else if (nextStep === 2) {
      setTitle("3. Gegner schlägt (Timer läuft!)");
      setText(
        "Der Gegner läuft zum Ball (C2) und spielt ihn flach auf dich zurück. Sobald er schlägt, läuft der Timer: Du musst schnell deine Laufzone (D4) antippen, um den Ball anzunehmen!"
      );
      
      // UI leeren
      setMockUi({ run: null, target: null, shot: null, showTimer: false });
      await sleep(300);

      // Gegner schlägt! Phase wechselt von "ai_prepare" auf "timer_running" -> hasSubmitted wird true!
      setTimerDuration(2800);
      setTutZone("D4"); // Ziel des Gegners ist deine Position D4
      setMockUi({ run: null, target: null, shot: null, showTimer: true });
      
      setCourtState({ 
        you: "D4", 
        partner: "B4", 
        opp1: "C2", // Gegner 1 ist in die Mitte auf C2 gelaufen
        opp2: "D1", 
        ball: { side: "right", zone: "C2", type: "DRIVE" } // Startpunkt beim Gegner oben
      });
      setPhase("timer_running"); // Startet den Ballflug von C2 nach D4!
      
      // Nach 1 Sekunde (während der Ball fliegt) wählt der Spieler D4 zum Abfangen
      await sleep(1000);
      setTutLauf("D4");
      setMockUi(prev => ({ ...prev, run: "D4" }));

      // Restliche Flugzeit abwarten, bis der Ball bei dir am Netz ist
      await sleep(1800); 
    } 
    
    // -------------------------------------------------------------------------
    // SCHRITT 4: VOLLEY AM NETZ PLANEN (Ball ist jetzt bei dir auf D4!)
    // -------------------------------------------------------------------------
    else if (nextStep === 3) {
      setTitle("4. Volley planen");
      setText(
        "Du hast den Ball auf D4 abgefangen! Jetzt läuft kein Timer mehr und du kannst deinen Angriff planen: Wir bleiben am Netz (D4), zielen tief in die Ecke (A1) und wählen den VOLLEY."
      );
      
      // WICHTIG: Ball ist jetzt auf deiner Seite (side: "left") in Zone D4!
      setPhase("player_planning"); // Macht hasSubmitted = false
      setMockUi({ run: null, target: null, shot: null, showTimer: false });
      setTutZone(null);
      setTutLauf(null);
      setTutShot(null);

      setCourtState({ 
        you: "D4", 
        partner: "B4", 
        opp1: "C2", 
        opp2: "D1", 
        ball: { side: "left", zone: "D4", type: "DRIVE" } // Ball liegt jetzt vor dir am Netz!
      });
      
      // UI füllt sich Schritt für Schritt wie von Geisterhand
      await sleep(600);
      setMockUi(prev => ({ ...prev, run: "D4" }));
      setTutLauf("D4");

      await sleep(600);
      setMockUi(prev => ({ ...prev, target: "A1" }));
      setTutZone("A1");

      await sleep(600);
      setMockUi(prev => ({ ...prev, shot: "VOLLEY" }));
      setTutShot("VOLLEY"); // Zeichnet die Vorschau-Linie von deinem D4 zum gegnerischen A1!

      await sleep(400);
    } 
    
    // -------------------------------------------------------------------------
    // SCHRITT 5: VOLLEY AUSFÜHREN (Ball fliegt von D4 -> A1)
    // -------------------------------------------------------------------------
    else if (nextStep === 4) {
      setTitle("5. Punktabschluss!");
      setText(
        "Stark! Du führst den Zug aus: Dein Volley fliegt scharf in die Ecke (A1) und zwingt die Gegner in die Defensive. Damit kennst du den kompletten Ablauf!"
      );
      
      setTimerDuration(2500);
      setTurnResult("perfect");
      setPhase("player_animating"); // Macht hasSubmitted = true -> Volley fliegt los!
      
      // Ball startet bei dir (left, D4) und fliegt nach A1 (tutZone), Gegner rennt nach B1 zurück
      setCourtState({ 
        you: "D4", 
        partner: "B4", 
        opp1: "B1", 
        opp2: "D1", 
        ball: { side: "left", zone: "D4", type: "VOLLEY" } 
      });

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
      className="w-full flex-1 flex flex-col bg-[#050b18] rounded-2xl border border-slate-900 shadow-2xl select-none overflow-hidden" 
      style={{ height: "calc(100dvh - 150px)", minHeight: "600px" }}
    >
      
      {/* ========================================= */}
      {/* 1. OBERER BEREICH: 3D COURT (FLEX-1)      */}
      {/* ========================================= */}
      <div className="relative w-full flex-1 overflow-hidden pointer-events-none bg-[#030611]">
        <div className="absolute inset-0 z-10">
          <ScenarioCourt3D 
            key="tutorial-court-static"
            arenaModel="/TacPadel.glb" 
            playIntro={false}  
            gameOver={false} 
            
            level="Spielzug" 
            positions={courtState as any} 
            hasSubmitted={isAnimPhase}
            bestZones={[]} 
            acceptableZones={[]}
            profiMode={false}
            
            selectedZone={phase === "ai_prepare" ? null : tutZone}
            selectedLaufZone={tutLauf} 
            selectedPartnerZone={null}
            
            activeChar={isAiActive ? "opp1" : "you"} 
            hitterId={isAiActive ? "opp1" : "you"}
            
            isTimerActive={isTimerPhase} 
            turnResult={turnResult}
            previewShot={phase === "player_planning" ? tutShot : null}
            timerDuration={timerDuration} 
            
            onZoneClick={() => {}}
            onLaufZoneClick={() => {}}
            onPlayerClick={() => {}}
            
            playerScore={0} aiScore={0}
            isAiActive={isAiActive} 
            phase={phase} 
            isTimerPhase={isTimerPhase}
            isPlayerTeamServe={true}
            hidePlayerLabels={false}
            userTeamName="Du & Partner"
            activeAiProfile={AI_PROFILES[0]}
          />
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. MITTLERER BEREICH: ACTION BAR          */}
      {/* ========================================= */}
      <div className="w-full z-40 bg-[#050b18] border-t border-slate-700 p-2 sm:p-3 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pointer-events-none">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          
          {/* Fake Timer Header */}
          <div className="flex items-center justify-between px-1 mb-1 mt-1">
            <span className="text-[9px] font-black tracking-widest uppercase text-purple-400">
              {isTimerPhase ? "REAKTION (BALL KOMMT!)" : "DU (SCHLÄGER)"}
            </span>
            <div className="w-1/2 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <motion.div 
                key={`timer-${mockUi.showTimer}`}
                initial={{ width: "100%" }} 
                animate={{ width: mockUi.showTimer ? "0%" : "100%" }} 
                transition={{ duration: mockUi.showTimer ? 2.8 : 0, ease: "linear" }}
                className={`h-full ${mockUi.showTimer ? 'bg-emerald-500' : 'bg-slate-700 opacity-30'}`} 
              />
            </div>
          </div>

          {/* Fake Auswahl-Buttons */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div className={`p-1.5 rounded border text-center transition-colors duration-300 ${mockUi.run ? 'border-purple-500 bg-purple-950/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-slate-800 bg-slate-900/40'}`}>
              <div className="text-[7px] font-black uppercase text-purple-400">Laufzone</div>
              <div className="text-[9px] font-bold text-white truncate">{mockUi.run || "-"}</div>
            </div>
            <div className={`p-1.5 rounded border text-center transition-colors duration-300 ${mockUi.target ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-slate-800 bg-slate-900/40'}`}>
              <div className="text-[7px] font-black text-emerald-400 uppercase">Schlagziel</div>
              <div className="text-[9px] font-bold text-white truncate">{mockUi.target || "-"}</div>
            </div>
            <div className={`p-1.5 rounded border text-center transition-colors duration-300 ${mockUi.shot ? 'border-orange-500 bg-orange-950/40 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'border-slate-800 bg-slate-900/40'}`}>
              <div className="text-[7px] font-black text-orange-400 uppercase">Schlag</div>
              <div className="text-[9px] font-bold text-white truncate">{mockUi.shot || "-"}</div>
            </div>
          </div>

          {/* Fake Submit Button */}
          <button disabled className={`w-full py-2.5 font-black text-[10px] tracking-widest uppercase rounded-lg border transition-all ${
              isTimerPhase ? "bg-amber-950/40 text-amber-400 border-amber-500/50 animate-pulse" 
              : phase === "player_animating" ? "bg-emerald-900/50 text-emerald-400 border-emerald-500/50" 
              : "bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          }`}>
            {isTimerPhase ? "Laufweg wählen (Timer läuft...)" : phase === "player_animating" ? "Ball im Flug..." : "Zug ausführen"}
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* 3. UNTERER BEREICH: INFO TEXTBOX          */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611] p-4 sm:p-5 shrink-0 border-t border-cyan-500/30 z-50">
        <AnimatePresence mode="wait">
          <motion.div 
            key={stepIndex}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl mx-auto flex flex-col gap-2"
          >
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-900/50">
                Schritt {stepIndex + 1} / 5
              </span>
            </div>
            
            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {title}
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium min-h-[48px]">
              {text}
            </p>

            <div className="flex justify-end pt-2 mt-1 border-t border-slate-800">
              <button 
                onClick={handleNextClick}
                disabled={isAnimating}
                className={`w-full sm:w-auto px-6 py-3 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all ${
                  isAnimating 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95"
                }`}
              >
                {isAnimating ? "Animation läuft..." : stepIndex === 4 ? "Tutorial beenden ➔" : "Weiter ➔"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
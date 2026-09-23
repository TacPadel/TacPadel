import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScenarioCourt25 from "./ScenarioCourt25";
import { STRATEGIES, StrategySequence, StrategyStep } from "../lib/strategies";

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE"];

interface StrategyTrainerProps {
  onBack: () => void;
  onStrategyComplete: (points: number) => void;
}

export default function StrategyTrainer({ onBack, onStrategyComplete }: StrategyTrainerProps) {
  const [activeStrategy, setActiveStrategy] = useState<StrategySequence | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
  
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [stepResult, setStepResult] = useState<"correct" | "wrong" | null>(null);
  const [strategyFinished, setStrategyFinished] = useState(false);

  const activeStep: StrategyStep | null = activeStrategy ? activeStrategy.steps[currentStepIndex] : null;
  const isAITurn = activeStep?.playerTurn === "ai";

  const handleShotClick = (shot: string) => {
    if (hasSubmitted || isAITurn) return;
    setSelectedShot((prev) => (prev === shot ? null : shot));
  };

  const handleZoneClick = (zoneId: string) => {
    if (hasSubmitted || isAITurn) return;
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
  };

  const handleLaufZoneClick = (zoneId: string) => {
    if (hasSubmitted || isAITurn) return;
    setSelectedLaufZone((prev) => (prev === zoneId ? null : zoneId));
  };

  const canSubmit = isAITurn || (selectedShot && selectedZone && selectedLaufZone && !hasSubmitted);

  const handleSubmit = () => {
    if (!canSubmit || !activeStep) return;
    setHasSubmitted(true);

    if (isAITurn) {
      // KI macht immer alles richtig
      setStepResult("correct");
    } else {
      const isShotCorrect = activeStep.validShots?.includes(selectedShot!) ?? false;
      const isZoneCorrect = activeStep.bestZones?.includes(selectedZone!) ?? false;
      const isLaufCorrect = activeStep.laufZone === selectedLaufZone;

      if (isShotCorrect && isZoneCorrect && isLaufCorrect) {
        setStepResult("correct");
      } else {
        setStepResult("wrong");
      }
    }
  };

  const handleNextStep = () => {
    if (!activeStrategy) return;

    if (stepResult === "wrong") {
      setCurrentStepIndex(0);
      resetInputs();
    } else if (stepResult === "correct") {
      if (currentStepIndex + 1 < activeStrategy.steps.length) {
        setCurrentStepIndex(currentStepIndex + 1);
        resetInputs();
      } else {
        setStrategyFinished(true);
        onStrategyComplete(50); 
      }
    }
  };

  const resetInputs = () => {
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setStepResult(null);
  };

  const leaveStrategy = () => {
    setActiveStrategy(null);
    setCurrentStepIndex(0);
    setStrategyFinished(false);
    resetInputs();
  };

  if (!activeStrategy) {
    return (
      <div className="w-full flex flex-col gap-6 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            ← Zurück
          </button>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase tracking-widest">
            Strategie-Pfade
          </h2>
        </div>
        <p className="text-slate-400 text-sm">
          Meistere zusammenhängende Ballwechsel. Spiele abwechselnd mit dem Gegner, um die Taktik aufzubauen.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {STRATEGIES.map((strat) => (
            <div 
              key={strat.id}
              onClick={() => {
                setActiveStrategy(strat);
                setCurrentStepIndex(0);
                resetInputs();
              }}
              className="bg-[#050b18]/80 border border-slate-800 hover:border-cyan-500/50 p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] shadow-lg group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-purple-950/50 text-purple-400 border border-purple-900/50`}>
                  {strat.theme}
                </span>
                <span className="text-xs font-bold text-slate-500">{strat.steps.length} Züge</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 relative z-10">{strat.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-2 relative z-10">{strat.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeStep && !strategyFinished) {
    return (
      <div className="w-full flex flex-col gap-4 text-slate-200 font-sans pb-24 lg:pb-4 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-[#040914]/90 border border-purple-900/50 p-4 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-purple-400 tracking-widest uppercase">Aktuelle Strategie</span>
            <span className="text-sm font-black text-white">{activeStrategy.title}</span>
          </div>
          <button onClick={leaveStrategy} className="text-xs bg-slate-900/50 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-800 hover:text-white">
            Abbrechen
          </button>
        </div>

        {/* Workspace: Briefing & Court */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-5">
          
          <div className={`lg:col-span-4 flex flex-col bg-[#050b18]/80 border ${isAITurn ? 'border-red-900/50' : 'border-slate-800'} rounded-xl p-5 shadow-lg relative`}>
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${isAITurn ? 'bg-red-500' : 'bg-purple-500'}`} />
            
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-[10px] font-black tracking-widest uppercase ${isAITurn ? 'text-red-400' : 'text-slate-400'}`}>
                {isAITurn ? "Gegner am Zug" : "Dein Zug"}
              </h3>
              <span className="text-[10px] text-slate-500 font-bold">{currentStepIndex + 1} / {activeStrategy.steps.length}</span>
            </div>

            <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-4">
              {activeStep.description}
            </p>
          </div>

          {/* 3D Court */}
          <div className="lg:col-span-8 h-[50vh] min-h-[400px] bg-[#030611] rounded-2xl border border-slate-800 relative overflow-hidden">
            <ScenarioCourt25
              level={"Strategie" as any} // <-- 1. LED Screen zeigt jetzt Strategie an
              positions={{
                ...activeStep.positions,
                ball: {
                  ...activeStep.positions.ball,
                  // Damit das LED Display oben den korrekten Schlag (z.B. DRIVE) anzeigt
                  type: isAITurn 
                    ? (activeStep.aiShot || activeStep.positions.ball.type)
                    : (selectedShot || activeStep.positions.ball.type)
                }
              }}
              // 2. KI Ziele werden ERST übergeben wenn "Abspielen" (hasSubmitted) geklickt wurde!
              // Vorher ist es null, dadurch leuchtet bei der KI nichts vorab.
              selectedZone={isAITurn ? (hasSubmitted ? (activeStep.aiTarget || null) : null) : selectedZone}
              hasSubmitted={hasSubmitted}
              // 3. Wenn die KI animiert wird, fügen wir ihr Ziel in bestZones ein, damit die LED NICHT "Falsche Wahl" ausspuckt
              bestZones={isAITurn ? (activeStep.aiTarget ? [activeStep.aiTarget] : []) : (activeStep.bestZones || [])}
              acceptableZones={[]} 
              onZoneClick={handleZoneClick}
              profiMode={!isAITurn} 
              // Gleicher Fix für Laufwege
              selectedLaufZone={isAITurn ? (hasSubmitted ? (activeStep.aiLaufZone || null) : null) : selectedLaufZone}
              perfectLaufZone={isAITurn ? (activeStep.aiLaufZone || null) : (hasSubmitted ? (activeStep.laufZone || null) : null)}
              acceptableLaufZones={[]}
              onLaufZoneClick={handleLaufZoneClick}
              activeChar={isAITurn ? activeStep.aiHitter || "opp1" : "you"}
              hitterId={isAITurn ? activeStep.aiHitter || "opp1" : "you"}
            />
          </div>
        </div>

        {/* Action Bar (Boden) */}
        {!hasSubmitted && (
          <div className={`fixed bottom-20 lg:sticky lg:bottom-4 left-4 right-4 lg:left-auto lg:right-auto z-40 bg-[#050b18]/95 backdrop-blur-xl border ${isAITurn ? 'border-red-900/50 shadow-[0_-10px_30px_rgba(220,38,38,0.2)]' : 'border-slate-700'} p-3 rounded-xl`}>
            
            {isAITurn ? (
              // Wenn die KI dran ist, gibt es nur EINEN dicken Ausführen-Button
              <button
                onClick={handleSubmit}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs tracking-widest uppercase rounded-lg transition-all"
              >
                Gegnerischen Zug abspielen ➔
              </button>
            ) : (
              // Wenn DU dran bist, hast du die normale Steuerung
              <div className="flex gap-2">
                <div className={`flex-1 p-2 rounded-lg border ${selectedLaufZone ? 'border-purple-500/50 bg-purple-950/20' : 'border-purple-500/30 bg-purple-950/10'}`}>
                  <span className="text-[9px] font-black tracking-widest text-purple-400 uppercase">1. Laufzone</span>
                  <div className="text-xs font-bold">{selectedLaufZone || "-"}</div>
                </div>         
                
                <div className={`flex-1 p-2 rounded-lg border ${selectedZone ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-emerald-500/30 bg-emerald-950/10'}`}>
                  <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">2. Schlagziel</span>
                  <div className="text-xs font-bold">{selectedZone || "-"}</div>
                </div>
                
                <div 
                  onClick={() => setIsShotModalOpen(true)}
                  className={`flex-1 p-2 rounded-lg border cursor-pointer ${selectedShot ? 'border-orange-500/50 bg-orange-950/20' : 'border-orange-500/50 bg-orange-950/30 animate-pulse'}`}
                >
                  <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase">3. Schlag</span>
                  <div className="text-xs font-bold">{selectedShot || "Wählen..."}</div>
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-1/3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-black text-[10px] uppercase rounded-lg transition-all"
                >
                  Ausführen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Shot Selection Modal */}
        <AnimatePresence>
          {isShotModalOpen && !isAITurn && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-[#050b18] border-t border-orange-900/50 p-6 rounded-t-3xl h-[60vh] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-5" onClick={() => setIsShotModalOpen(false)} />
              <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-10">
                {SHOTS.map((shot) => (
                  <button
                    key={shot}
                    onClick={() => { handleShotClick(shot); setIsShotModalOpen(false); }}
                    className={`py-3 rounded-lg border text-[10px] font-black uppercase ${selectedShot === shot ? 'bg-orange-600/20 border-orange-500 text-orange-300' : 'bg-slate-900/40 border-slate-800 text-slate-400'}`}
                  >
                    {shot}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Overlay für den aktuellen Schritt */}
        <AnimatePresence>
          {hasSubmitted && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-10 left-4 right-4 lg:w-3/4 lg:left-[12.5%] z-50 bg-[#050b18]/95 border border-slate-700 p-6 rounded-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.8)]"
            >
              <h3 className={`text-xl font-black uppercase tracking-widest mb-2 ${
                isAITurn ? "text-red-400" : (stepResult === "correct" ? "text-emerald-400" : "text-red-500")
              }`}>
                {isAITurn ? "Gegner hat gespielt" : (stepResult === "correct" ? "Stark! Nächster Schritt..." : "Fehler! Kette gerissen.")}
              </h3>
              
              <p className="text-slate-300 text-sm mb-4">
                {isAITurn || stepResult === "correct" 
                  ? activeStep.stepExplanation 
                  : "Deine Taktik ist fehlgeschlagen. Du musst die Strategie komplett neu aufbauen!"}
              </p>
              
              <button
                onClick={handleNextStep}
                className="w-full py-4 bg-white hover:bg-slate-300 text-black font-black text-xs uppercase rounded-xl transition-transform active:scale-95"
              >
                {stepResult === "correct" ? "Weiter ➔" : "Neu starten ↺"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: STRATEGIE ABGESCHLOSSEN
  // ==========================================
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#050b18]/90 border border-purple-500/40 rounded-2xl p-8 flex flex-col items-center text-center mt-12 mx-4 shadow-[0_0_50px_rgba(168,85,247,0.15)]"
    >
      <span className="text-6xl mb-4">🏆</span>
      <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-500 uppercase tracking-widest">
        Strategie Meister
      </h2>
      <p className="text-slate-400 mt-2 mb-6">
        Du hast alle Züge von "{activeStrategy?.title}" perfekt ausgeführt. +50 Punkte!
      </p>
      <button 
        onClick={leaveStrategy}
        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:scale-105 transition-transform text-white uppercase font-black text-xs rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)]"
      >
        Zurück zur Übersicht
      </button>
    </motion.div>
  );
}
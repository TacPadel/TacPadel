import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TacticsBoard from "./components/TacticsBoard";

interface Scenario {
  id: number;
  description: string;
  validShots: string[];
  bestZones: string[];
  explanation: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    description:
      "Gegner haben euch nach hinten gedrängt und stehen beide aggressiv am Netz (Zonen B4 und C4). Ein schneller, flacher Ball kommt tief in deine linke Glasecke (Zone A1). Du stehst perfekt zum Ball.",
    validShots: ["LOB", "CHIRURGISCHER LOB"],
    bestZones: ["A1", "D1"],
    explanation:
      "Da die Gegner das Netz dominieren, ist der hohe Lob die einzige sichere Option, um sie zu vertreiben und selbst das Netz zu erobern. Ein flacher Ball wird am Netz eiskalt abgefangen.",
  },
  {
    id: 2,
    description:
      "Du stehst stabil am Netz (Zone B3). Der Gegner spielt einen verunglückten, zu kurzen Lob, der als hoher Ball auf die Mittellinie (Zone B2) fällt. Du hast viel Zeit, stehst aber relativ weit hinten im Feld.",
    validShots: ["BANDEJA", "VIBORA"],
    bestZones: ["A1", "D1", "A2"],
    explanation:
      "Für einen finalen Smash stehst du zu weit hinten. Die Bandeja oder Víbora hält die Gegner hinten und sichert dir die Netzposition, ohne dass der Ball hoch von der Wand abprallt.",
  },
  {
    id: 3,
    description:
      "Du stehst am Netz (Zone C3). Der Gegner schießt aus der Defensive einen harten, schnellen Passierball direkt auf deinen Körper.",
    validShots: ["BLOCK", "REFLEX-VOLLEY", "VOLLEY"],
    bestZones: ["B2", "C2", "A1"],
    explanation:
      "Bei harten Bällen auf den Körper darfst du nicht ausholen. Schläger kompakt als 'Wand' hinhalten (Block) und den Ball tief in die Mitte oder dem Gegner vor die Füße tropfen lassen.",
  },
];

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA"];

const COURT_ZONES = [
  { id: "A1", label: "Glass Corner L" },
  { id: "B1", label: "Back C-L" },
  { id: "C1", label: "Back C-R" },
  { id: "D1", label: "Glass Corner R" },
  { id: "A2", label: "Mid L" },
  { id: "B2", label: "Mid C-L" },
  { id: "C2", label: "Mid C-R" },
  { id: "D2", label: "Mid R" },
  { id: "A3", label: "Net Fence L" },
  { id: "B3", label: "Net C-L" },
  { id: "C3", label: "Net C-R" },
  { id: "D3", label: "Net Fence R" },
  { id: "A4", label: "At Net L" },
  { id: "B4", label: "At Net C-L" },
  { id: "C4", label: "At Net C-R" },
  { id: "D4", label: "At Net R" },
];

type Tab = "trainer" | "board";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("trainer");
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(() =>
    Math.floor(Math.random() * SCENARIOS.length)
  );
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  const scenario = SCENARIOS[currentScenarioIndex];

  const handleShotClick = (shot: string) => {
    if (hasSubmitted) return;
    setSelectedShot((prev) => (prev === shot ? null : shot));
  };

  const handleZoneClick = (zoneId: string) => {
    if (hasSubmitted) return;
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
  };

  const isShotCorrect =
    selectedShot &&
    scenario.validShots.some(
      (valid) =>
        valid === selectedShot ||
        (selectedShot === "LOB" && valid.includes("LOB")) ||
        (selectedShot === "VOLLEY" && valid.includes("VOLLEY"))
    );
  const isZoneCorrect = selectedZone && scenario.bestZones.includes(selectedZone);

  const handleSubmit = () => {
    if (!selectedShot || !selectedZone || hasSubmitted) return;
    setHasSubmitted(true);
    if (isShotCorrect && isZoneCorrect) {
      setScore((s) => s + 1);
    }
    setRoundsPlayed((r) => r + 1);
  };

  const nextRound = () => {
    let nextIndex = currentScenarioIndex;
    while (nextIndex === currentScenarioIndex) {
      nextIndex = Math.floor(Math.random() * SCENARIOS.length);
    }
    setCurrentScenarioIndex(nextIndex);
    setSelectedShot(null);
    setSelectedZone(null);
    setHasSubmitted(false);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col items-center p-4 lg:p-8 font-sans">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-primary">PADEL TACTICS</h1>
          {activeTab === "trainer" && (
            <div className="text-sm font-medium px-3 py-1 bg-secondary rounded-full">
              {score} / {roundsPlayed} gelöste Taktikaufgaben
            </div>
          )}
        </header>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab("trainer")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "trainer"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Taktik-Trainer
          </button>
          <button
            onClick={() => setActiveTab("board")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "board"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Taktik-Board
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "trainer" ? (
            <motion.div
              key="trainer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-6">
                  <div className="bg-card border border-card-border p-6 rounded-xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                      Szenario
                    </h2>
                    <p className="text-lg leading-relaxed">{scenario.description}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                      1. Schlag wählen
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {SHOTS.map((shot) => {
                        const isSelected = selectedShot === shot;
                        let bgClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80";
                        if (isSelected) bgClass = "bg-primary text-primary-foreground shadow-md";
                        if (hasSubmitted && isSelected) {
                          bgClass = isShotCorrect
                            ? "bg-primary text-primary-foreground"
                            : "bg-destructive text-destructive-foreground";
                        }
                        return (
                          <button
                            key={shot}
                            onClick={() => handleShotClick(shot)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${bgClass} ${
                              hasSubmitted ? "cursor-default" : "cursor-pointer active:scale-95"
                            }`}
                          >
                            {shot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                    2. Zielzone wählen
                  </h3>
                  <div className="relative aspect-[3/4] w-full max-w-[400px] mx-auto border-4 border-primary rounded-xl overflow-hidden bg-emerald-900/10 p-2 shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                      <div className="w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    </div>
                    <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-1">
                      {COURT_ZONES.map((zone) => {
                        const isSelected = selectedZone === zone.id;
                        const isBest = hasSubmitted && scenario.bestZones.includes(zone.id);
                        let zoneClass =
                          "border border-primary/20 bg-background/50 hover:bg-primary/20 transition-colors";
                        if (isSelected && !hasSubmitted) {
                          zoneClass = "border-primary bg-primary/40 shadow-[0_0_15px_rgba(0,255,150,0.4)]";
                        } else if (hasSubmitted) {
                          if (isBest) {
                            zoneClass = "border-primary bg-primary/60 shadow-[0_0_15px_rgba(0,255,150,0.6)]";
                          } else if (isSelected && !isBest) {
                            zoneClass = "border-destructive bg-destructive/60";
                          } else {
                            zoneClass = "border-primary/10 bg-background/20 opacity-50";
                          }
                        }
                        return (
                          <button
                            key={zone.id}
                            onClick={() => handleZoneClick(zone.id)}
                            className={`relative flex flex-col items-center justify-center rounded-md group ${zoneClass} ${
                              hasSubmitted ? "cursor-default" : "cursor-pointer"
                            }`}
                          >
                            <span className="font-mono font-bold text-lg opacity-80 group-hover:opacity-100">
                              {zone.id}
                            </span>
                            <span className="text-[0.65rem] uppercase tracking-wider opacity-60 text-center px-1 hidden sm:block">
                              {zone.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20" />
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                    Netz (Gegnerseite)
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {!hasSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex justify-center mt-4"
                  >
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedShot || !selectedZone}
                      className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      Bestätigen
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-card-border p-6 rounded-xl shadow-2xl mt-4"
                  >
                    <div className="flex flex-col gap-4">
                      <h3
                        className={`text-2xl font-bold ${
                          isShotCorrect && isZoneCorrect
                            ? "text-primary"
                            : isShotCorrect || isZoneCorrect
                            ? "text-yellow-500"
                            : "text-destructive"
                        }`}
                      >
                        {isShotCorrect && isZoneCorrect
                          ? "Ausgezeichnet! Richtig entschieden."
                          : isShotCorrect
                          ? "Teilweise richtig: Der Schlag war gut, aber die Platzierung suboptimal."
                          : "Taktischer Fehler: In dieser Situation verlierst du den Punkt."}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed">
                        {scenario.explanation}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm font-medium mt-2">
                        <div className="bg-background px-4 py-2 rounded-lg border border-border">
                          <span className="text-muted-foreground mr-2">Optimale Schläge:</span>
                          <span className="text-primary">{scenario.validShots.join(" oder ")}</span>
                        </div>
                        <div className="bg-background px-4 py-2 rounded-lg border border-border">
                          <span className="text-muted-foreground mr-2">Beste Zonen:</span>
                          <span className="text-primary">{scenario.bestZones.join(", ")}</span>
                        </div>
                      </div>
                      <button
                        onClick={nextRound}
                        className="mt-4 w-full sm:w-auto self-start px-6 py-3 bg-secondary text-secondary-foreground font-bold rounded-lg hover:bg-secondary/80 transition-colors"
                      >
                        Nächste Aufgabe
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              <div className="bg-card border border-card-border p-4 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-1">
                  Taktik-Board
                </h2>
                <p className="text-sm text-muted-foreground">
                  Bewege Spieler und Ball frei auf dem Spielfeld, um Taktiken zu planen und zu erklären.
                </p>
              </div>
              <TacticsBoard />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

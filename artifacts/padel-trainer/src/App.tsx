import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TacticsBoard from "./components/TacticsBoard";
import ScenarioCourt, { PlayerPositions } from "./components/ScenarioCourt";

interface Scenario {
  id: number;
  description: string;
  validShots: string[];
  bestZones: string[];
  explanation: string;
  positions: PlayerPositions;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    description:
      "Die Gegner haben euch nach hinten gedrängt und besetzen das Netz. Ein schneller, flacher Ball kommt tief in deine linke Glasecke (Zone A1). Du stehst stabil zum Ball. Was spielst du, um die gegnerische Netzposition aufzulösen?",
    validShots: ["LOB"],
    bestZones: ["A1", "D1"],
    explanation:
      "Richtig! Wenn die Gegner das Netz dominieren, ist ein hoher und tiefer Lob das effektivste taktische Mittel. Er zwingt die Gegner zum Rückzug an die Grundlinie (Zonen A1 oder D1) und ermöglicht deinem Team das Aufrücken ans Netz.",
    positions: {
      you: "A1",
      partner: "B1",
      opp1: "B4",
      opp2: "C4",
      ball: { side: "left", zone: "A1" },
    },
  },
  {
    id: 2,
    description:
      "Du stehst in der Angriffsposition am Netz (Zone B3). Der Gegner spielt unter Druck einen unpräzisen, zu kurzen Lob auf das T-Stück der Mittellinie (Zone B2). Du hast ausreichend Zeit, stehst für einen direkten Smash aber etwas zu weit vom Netz entfernt. Welcher Schlag sichert die Position?",
    validShots: ["BANDEJA", "VIBORA"],
    bestZones: ["A1", "D1", "A2"],
    explanation:
      "Korrekt! Für einen direkten, punktbringenden Smash ist die Distanz zum Netz hier zu groß. Eine kontrollierte Bandeja oder Víbora tief in die Ecken hält die Gegner hinten und bewahrt die eigene Netzposition.",
    positions: {
      you: "B3",
      partner: "C3",
      opp1: "B1",
      opp2: "C1",
      ball: { side: "left", zone: "B2" },
    },
  },
  {
    id: 3,
    description:
      "Dein Team steht kompakt am Netz. Der Gegner schlägt aus der Defensive einen harten, flachen Passierball genau durch die Mitte auf die Netzkante (Zone B4/C4). Wie reagiert man in dieser Netzposition am besten?",
    validShots: ["BLOCK", "VOLLEY"],
    bestZones: ["B2", "C2", "B1"],
    explanation:
      "Hervorragend. Bei sehr schnellen Bällen durch die Mitte empfiehlt es sich, den Schläger kompakt hinzuhalten (Block oder Volley), ohne weit auszuholen. Der Ball sollte kontrolliert und flach vor die Füße der Gegner platziert werden.",
    positions: {
      you: "B4",
      partner: "C4",
      opp1: "B1",
      opp2: "C2",
      ball: { side: "left", zone: "B4" },
    },
  },
  {
    id: 4,
    description:
      "Der Gegner spielt einen hohen, kurzen Lob, der steil auf Zone B3 fällt. Du stehst in perfekter Schlagposition direkt am Netz — Zeit, Höhe und Winkel stimmen. Die Gegner befinden sich tief an ihrer Grundlinie. Wie beendest du den Punkt?",
    validShots: ["SMASH"],
    bestZones: ["A1", "D1"],
    explanation:
      "Perfekt! Dies ist die klassische Smash-Situation: optimale Position, hoher Ball, Gegner tief hinten. Ein präziser, harter Smash tief in die Glasecken (A1 oder D1) beendet den Punkt direkt. Hier kein Risiko scheuen — wer zögert, verschenkt den Punkt.",
    positions: {
      you: "B4",
      partner: "C4",
      opp1: "A1",
      opp2: "D1",
      ball: { side: "left", zone: "B3" },
    },
  },
  {
    id: 5,
    description:
      "Der Gegner lobbt hoch an deine Rückwand. Der Ball prallt vom Glas ab und steht nun gut spielbar bei Zone A2. Die Gegner haben das Netz besetzt. Wie spielst du den Glaswand-Ball taktisch klug zurück?",
    validShots: ["BAJADA", "LOB"],
    bestZones: ["B4", "C4"],
    explanation:
      "Korrekt! Eine Bajada — ein kontrollierter Slice nach dem Glaswandabprall — direkt zu den Füßen der netzstehenden Gegner (B4/C4) ist die technisch anspruchsvollste, aber wirksamste Lösung. Alternativ schützt ein hoher Lob tief in die Ecken die eigene Position.",
    positions: {
      you: "A2",
      partner: "B2",
      opp1: "B4",
      opp2: "C4",
      ball: { side: "left", zone: "A2" },
    },
  },
  {
    id: 6,
    description:
      "Du und dein Partner stehen an der Aufschlaglinie (Zonen B2/C2). Der Gegner spielt einen mittelhohen Ball mittig auf Zone B3. Du hast Zeit und gute Schlagposition. Welcher Schlag bringt euch ans Netz und setzt die Gegner unter Druck?",
    validShots: ["VIBORA", "BANDEJA"],
    bestZones: ["A1", "D1", "A2"],
    explanation:
      "Genau! Eine offensive Víbora oder Bandeja aus der Mitte treibt die Gegner tief an die Grundlinie und öffnet den Weg ans Netz. Ein defensiver Volley würde die Initiative wieder abgeben — hier muss man aktiv werden.",
    positions: {
      you: "B2",
      partner: "C2",
      opp1: "A1",
      opp2: "D1",
      ball: { side: "left", zone: "B3" },
    },
  },
  {
    id: 7,
    description:
      "Du stehst am Netz (Zone B4), der Ball kommt tief und langsam direkt auf deine Füße. Ein Smash ist unmöglich — der Ball liegt zu tief. Die Gegner stehen mittig und warten. Wie rettest du den Punkt?",
    validShots: ["VOLLEY", "BLOCK"],
    bestZones: ["A1", "D1", "A2"],
    explanation:
      "Richtig! Bei einem Ball zu den Füßen am Netz muss man den Schläger unter den Ball bringen und einen kontrollierten, tiefen Volley tief in die Grundlinienecken spielen (A1/D1). Zu viel Kraft führt ins Netz — hier zählt Feingefühl über Aggression.",
    positions: {
      you: "B4",
      partner: "C4",
      opp1: "B2",
      opp2: "C2",
      ball: { side: "left", zone: "B4" },
    },
  },
  {
    id: 8,
    description:
      "Beide Gegner sind auf die linke Seite gelaufen (GEG1 & GEG2 bei A4/A3). Die rechte Seite ihres Feldes ist komplett offen. Du stehst stabil am Netz (Zone C4) und hast den Ball gut gespielt bekommen. Was tust du?",
    validShots: ["VOLLEY", "VIBORA", "SMASH"],
    bestZones: ["D1", "D2", "D3"],
    explanation:
      "Ausgezeichnet! Die offene Seite (D-Zonen) ist der goldene Treffer. Ein präziser Volley, Víbora oder Smash in die rechte Seite (D1–D3) zwingt die Gegner zu einem unmöglichen Sprint und beendet den Punkt. Immer in den offenen Raum spielen!",
    positions: {
      you: "C4",
      partner: "B4",
      opp1: "A4",
      opp2: "A3",
      ball: { side: "left", zone: "C3" },
    },
  },
];

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA"];

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
              {/* Scenario description */}
              <div className="bg-card border border-card-border p-6 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                  Szenario
                </h2>
                <p className="text-lg leading-relaxed">{scenario.description}</p>
              </div>

              {/* Shot selection */}
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

              {/* Interactive court */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  2. Zielzone auf dem Spielfeld wählen
                </h3>
                <div className="flex gap-4 text-xs text-muted-foreground mb-1 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    DU
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-800 inline-block" />
                    Partner
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                    Gegner
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                    Ball
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground/70">
                    Klicke auf die Gegnerseite (rechts) um Zielzone zu wählen
                  </span>
                </div>
                <ScenarioCourt
                  positions={scenario.positions}
                  selectedZone={selectedZone}
                  hasSubmitted={hasSubmitted}
                  bestZones={scenario.bestZones}
                  onZoneClick={handleZoneClick}
                />
              </div>

              {/* Submit / feedback */}
              <AnimatePresence>
                {!hasSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex justify-center mt-2"
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
                    className="bg-card border border-card-border p-6 rounded-xl shadow-2xl"
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
                        Nächste Aufgabe →
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

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TacticsBoard from "./components/TacticsBoard";
import ScenarioCourt, { PlayerPositions } from "./components/ScenarioCourt";

const PADEL_DICTIONARY: Record<string, Record<string, string>> = {
  "Schläge": {
    "Aufschlag": "Der Aufschlag wird im Padel unterhalb der Hüfte (aus dem Sprung nach einem Bodenaufprall) ausgeführt und muss diagonal in das gegenüberliegende Aufschlagfeld gespielt werden. Berührt der Ball danach das Gitter, ist es ein Aufschlagfehler; berührt er die Glaswand, ist er gültig.",
    "Lob": "Der wichtigste Defensivschlag im Padel. Ein hoher, tiefer Ball an die gegnerische Grundlinie. Ziel ist es, die Gegner von der Netzposition nach hinten zu zwingen, um selbst das Netz zu erobern.",
    "Volley": "Ein Schlag direkt aus der Luft, ohne vorherigen Bodenaufprall, meistens eng am Netz gespielt. Volleys werden idealerweise mit viel Slice (Rückwärtsdrall) tief in die Ecken platziert.",
    "Bandeja": "Ein defensiver/kontrollierter Überkopfschlag, der meistens im Mittelfeld angewendet wird. Getroffen wird der Ball seitlich auf Kopfhöhe mit Slice, um den Ball flach zu halten und die Netzposition zu verteidigen.",
    "Víbora": "Ein aggressiverer Überkopfschlag mit viel Seitwärtsdrall (Schnitt). Der Ball prallt unberechenbar und extrem flach von den gegnerischen Wänden ab.",
    "Smash": "Ein klassischer Überkopf-Power-Schlag. Wird genutzt, um den Ball so hart zu treffen, dass er nach der gegnerischen Wand über die 3- oder 4-Meter-Außenwand springt (Por Tres / Por Cuatro) oder unerreichbar zurück ins eigene Feld fliegt.",
    "Bajada de Pared": "Ein Überkopfschlag aus dem Hinterfeld, nachdem der Ball hoch von der eigenen Rückwand abgesprungen ist. Man \"schlägt den Ball von der Wand nach unten\", oft sehr kraftvoll und offensiv.",
    "Chiquita": "Ein kurzer, weicher Ball aus der Defensive genau vor die Füße der am Netz stehenden Gegner. Zwingt den Gegner zu einem unangenehmen Volley von weit unten und öffnet Chancen zum Konter.",
    "Block": "Ein rein passiver Schlag am Netz. Man hält den Schläger wie eine Wand hin, um extrem harte, gerade Passierbälle des Gegners abzufangen und kurz hinter dem Netz abtropfen zu lassen.",
  },
  "Positionen": {
    "Netzposition (Angriff)": "Die dominierende Position im Padel. Beide Spieler stehen ca. 2–3 Meter vor dem Netz. Von hier aus wird der Druck per Volley und Überkopfschlägen aufgebaut. Punkte werden fast nur hier gewonnen.",
    "Grundlinie (Verteidigung)": "Die Ausgangsposition bei gegnerischem Aufschlag oder Druck. Spieler stehen leicht hinter der Aufschlaglinie. Fokus liegt auf dem Nutzen der Glaswände und dem Spielen von Lobs.",
    "Die Übergangszone (Niemandsland)": "Der Bereich zwischen Aufschlaglinie und Netz. Hier sollte man sich niemals freiwillig aufhalten, da man leicht vor die Füße angespielt werden kann. Diese Zone wird nur schnell durchschritten.",
    "Die T-Linie": "Der Kreuzungspunkt der Aufschlaglinien in der Mitte des Feldes. Ein wichtiger Orientierungspunkt für das Stellungsspiel bei kurzen Bällen.",
  },
  "Regeln": {
    "Zählweise": "Exakt wie im Tennis: 15, 30, 40, Spiel. Bei Einstand (40:40) wird entweder traditionell über Vorteil gespielt oder mit der \"Golden Point\"-Regel (der nächste Punkt entscheidet das Spiel). Ein Satz geht bis 6, ein Match über 2 Gewinnsätze.",
    "Wand & Gitter": "Der Ball muss immer zuerst auf dem Boden aufkommen, bevor er die Glaswand oder das Metallgitter berührt. Berührt er die Wand/das Gitter direkt fliegend, ist er im Aus. Nach dem Bodenaufprall darf er beliebig oft an die Wände ditschen.",
    "Eigenes Glas nutzen": "In der Defensive darf man den Ball mit voller Kraft gegen die eigene Glasscheibe schlagen, damit er über das Netz ins gegnerische Feld fliegt. Das Nutzen des eigenen Metallgitters ist hingegen verboten.",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Schläge": "bg-blue-500/10 border-blue-500/30 text-blue-400",
  "Positionen": "bg-amber-500/10 border-amber-500/30 text-amber-400",
  "Regeln": "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

type Level = "Anfänger" | "Fortgeschrittener" | "Profi";

interface Scenario {
  id: number;
  description: string;
  validShots: string[];
  bestZones: string[];
  explanation: string;
  positions: PlayerPositions;
  laufZone: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    description:
      "Die Gegner haben euch nach hinten gedrängt und besetzen das Netz. Ein schneller, flacher Ball kommt tief in deine linke Glasecke (Zone A1). Du stehst stabil zum Ball. Was spielst du?",
    validShots: ["LOB"],
    bestZones: ["A1", "D1"],
    explanation:
      "Richtig! Wenn die Gegner das Netz dominieren, ist ein hoher und tiefer Lob das effektivste taktische Mittel, um sie zum Rückzug zu zwingen.",
    positions: {
      you: "A1",
      partner: "B1",
      opp1: "B4",
      opp2: "C4",
      ball: { side: "left", zone: "A1" },
    },
    laufZone: "B2",
  },
  {
    id: 2,
    description:
      "Du stehst in der Angriffsposition am Netz (Zone B3). Der Gegner spielt unter Druck einen unpräzisen, zu kurzen Lob auf das T-Stück der Mittellinie (Zone B2). Welcher Schlag sichert die Position?",
    validShots: ["BANDEJA", "VIBORA"],
    bestZones: ["A1", "D1", "A2"],
    explanation:
      "Korrekt! Für einen direkten Smash ist die Distanz zum Netz zu groß. Eine kontrollierte Bandeja oder Víbora hält die Gegner hinten.",
    positions: {
      you: "B3",
      partner: "C3",
      opp1: "B1",
      opp2: "C1",
      ball: { side: "left", zone: "B2" },
    },
    laufZone: "B3",
  },
  {
    id: 3,
    description:
      "Dein Team steht kompakt am Netz. Der Gegner schlägt aus der Defensive einen harten, flachen Passierball genau durch die Mitte auf die Netzkante (Zone B4/C4). Wie reagierst du?",
    validShots: ["BLOCK", "VOLLEY"],
    bestZones: ["B2", "C2", "B1"],
    explanation:
      "Hervorragend. Bei schnellen Bällen durch die Mitte den Schläger kompakt als Wand hinhalten und den Ball flach vor die Füße der Gegner blocken.",
    positions: {
      you: "B4",
      partner: "C4",
      opp1: "B1",
      opp2: "C2",
      ball: { side: "left", zone: "B4" },
    },
    laufZone: "B4",
  },
  {
    id: 4,
    description:
      "Ihr habt die Gegner perfekt ausgespielt. Ein hoher Lob des Gegners verhungert mitten im Feld (Zone B3). Du stehst direkt darunter an der Netzkante. Was tust du?",
    validShots: ["SMASH"],
    bestZones: ["A1", "D1", "B2"],
    explanation:
      "Punktgewinn! Aus dieser extrem nahen Position am Netz ist der Power-Smash die richtige Wahl, um den Ball unbrennbar zu machen.",
    positions: {
      you: "B4",
      partner: "C4",
      opp1: "B1",
      opp2: "C1",
      ball: { side: "left", zone: "B3" },
    },
    laufZone: "B4",
  },
  {
    id: 5,
    description:
      "Ein hoher Lob des Gegners fliegt über dich hinweg, prallt hoch an der linken Rückwand ab und kommt in Zone A2 herunter. Die Gegner rücken sofort aggressiv ans Netz auf (B4, C4). Welcher Schlag bietet sich an?",
    validShots: ["BAJADA", "LOB"],
    bestZones: ["A2", "D2", "A1"],
    explanation:
      "Sehr gut! Da der Ball hoch von der Wand abspringt, kannst du ihn über Netzhöhe als Bajada (Vorschlag von oben nach unten) aggressiv in die Lücken oder als überraschenden Lob spielen.",
    positions: {
      you: "A1",
      partner: "B1",
      opp1: "B4",
      opp2: "C4",
      ball: { side: "left", zone: "A2" },
    },
    laufZone: "B2",
  },
  {
    id: 6,
    description:
      "Ihr baut das Spiel geduldig von der Aufschlaglinie auf (Zone B2). Der Ball kommt als halbhoher, mittelschneller Ball in deine Komfortzone. Die Gegner stehen mittig (B3/C3). Wie hältst du den Druck aufrecht?",
    validShots: ["VIBORA", "BANDEJA"],
    bestZones: ["A1", "D1", "B2"],
    explanation:
      "Genauso. Ein kontrollierter, effetreicher Überkopfschlag aus dem Mittelfeld zwingt die Gegner, hinten zu bleiben, und erlaubt es euch, weiter vorzurücken.",
    positions: {
      you: "B2",
      partner: "C2",
      opp1: "B3",
      opp2: "C3",
      ball: { side: "left", zone: "B2" },
    },
    laufZone: "B3",
  },
  {
    id: 7,
    description:
      "Du stehst vorne am Netz (Zone C3). Der Gegner spielt einen extrem unangenehmen, gechippten Ball, der dir direkt vor die Füße fällt (Zone C3). Wie rettest du den Ball?",
    validShots: ["VOLLEY", "BLOCK"],
    bestZones: ["B2", "C2"],
    explanation:
      "Stark gelöst. Wenn der Ball dir vor die Füße fällt, musst du tief in die Knie gehen und den Volley/Block mit extrem weichem Handgelenk kurz hinter das Netz tropfen lassen.",
    positions: {
      you: "C3",
      partner: "B3",
      opp1: "B1",
      opp2: "C1",
      ball: { side: "left", zone: "C3" },
    },
    laufZone: "C3",
  },
  {
    id: 8,
    description:
      "Du bist am Netz (Zone B3). GEG1 ist weit in die Mitte gerückt, wodurch die linke äußere Gitterseite (Zone A2/A1) komplett offen steht. Welcher Schlag nutzt das aus?",
    validShots: ["VOLLEY", "VIBORA", "SMASH"],
    bestZones: ["A1", "A2"],
    explanation:
      "Chirurgisch präzise! Das Ausnutzen der offenen Seite mit einem platzierten Volley oder einer Víbora in die freie Ecke gewinnt in 90% der Fälle den Punkt.",
    positions: {
      you: "B3",
      partner: "C3",
      opp1: "C4",
      opp2: "D4",
      ball: { side: "left", zone: "B3" },
    },
    laufZone: "B3",
  },
];

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA"];

type Tab = "trainer" | "board" | "basics";

function BasicsTab() {
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpenEntry((prev) => (prev === key ? null : key));

  return (
    <motion.div
      key="basics"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-6"
    >
      {Object.entries(PADEL_DICTIONARY).map(([category, entries]) => {
        const colorClass = CATEGORY_COLORS[category] ?? "bg-secondary/20 border-border text-muted-foreground";
        return (
          <div key={category} className="flex flex-col gap-2">
            <div className={`inline-flex items-center self-start px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${colorClass}`}>
              {category}
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(entries).map(([term, definition]) => {
                const entryKey = `${category}__${term}`;
                const isOpen = openEntry === entryKey;
                return (
                  <div key={term} className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggle(entryKey)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <span className="font-semibold text-base">{term}</span>
                      <span className={`text-muted-foreground text-lg leading-none transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>+</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-4 pt-0 text-muted-foreground leading-relaxed border-t border-card-border">
                            {definition}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("trainer");
  const [level, setLevel] = useState<Level>("Fortgeschrittener");
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(() =>
    Math.floor(Math.random() * SCENARIOS.length)
  );
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
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

  const isShotCorrect = !!(
    selectedShot &&
    scenario.validShots.some(
      (valid) =>
        valid === selectedShot ||
        (selectedShot === "LOB" && valid.includes("LOB")) ||
        (selectedShot === "VOLLEY" && valid.includes("VOLLEY"))
    )
  );
  const isZoneCorrect = !!(selectedZone && scenario.bestZones.includes(selectedZone));
  const isLaufZoneCorrect = !!(selectedLaufZone && selectedLaufZone === scenario.laufZone);

  const canSubmit = (() => {
    if (hasSubmitted) return false;
    if (!selectedShot) return false;
    if (level === "Fortgeschrittener" && !selectedZone) return false;
    if (level === "Profi" && (!selectedZone || !selectedLaufZone)) return false;
    return true;
  })();

  const isFullyCorrect = (() => {
    if (level === "Anfänger") return isShotCorrect;
    if (level === "Fortgeschrittener") return isShotCorrect && isZoneCorrect;
    return isShotCorrect && isZoneCorrect && isLaufZoneCorrect;
  })();

  const isPartiallyCorrect = !isFullyCorrect && (isShotCorrect || isZoneCorrect || isLaufZoneCorrect);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setHasSubmitted(true);
    if (isFullyCorrect) {
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
    setSelectedLaufZone(null);
    setHasSubmitted(false);
  };

  const handleLevelChange = (newLevel: Level) => {
    setLevel(newLevel);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
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
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl self-start flex-wrap">
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
          <button
            onClick={() => setActiveTab("basics")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "basics"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Padel Basics
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "basics" ? (
            <BasicsTab key="basics" />
          ) : activeTab === "trainer" ? (
            <motion.div
              key="trainer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-6"
            >
              {/* Level picker */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Schwierigkeitsstufe
                </h3>
                <div className="flex gap-1.5 flex-wrap">
                  {(["Anfänger", "Fortgeschrittener", "Profi"] as Level[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleLevelChange(lvl)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        level === lvl
                          ? lvl === "Anfänger"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow"
                            : lvl === "Fortgeschrittener"
                            ? "bg-amber-500 text-white border-amber-500 shadow"
                            : "bg-red-600 text-white border-red-600 shadow"
                          : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {lvl === "Anfänger" ? "⚡ Anfänger" : lvl === "Fortgeschrittener" ? "🎯 Fortgeschrittener" : "★ Profi"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {level === "Anfänger"
                    ? "Wähle nur den richtigen Schlag."
                    : level === "Fortgeschrittener"
                    ? "Wähle Schlag und Zielzone auf dem Spielfeld."
                    : "Wähle deine Laufposition, den Schlag und die Zielzone — die volle Profi-Kette."}
                </p>
              </div>

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
                  {level === "Profi" ? "2. Schlag wählen" : "1. Schlag wählen"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SHOTS.map((shot) => {
                    const isSelected = selectedShot === shot;
                    let bgClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80";
                    if (isSelected) bgClass = "bg-primary text-primary-foreground shadow-md";
                    if (hasSubmitted && isSelected) {
                      bgClass = isShotCorrect
                        ? "bg-emerald-600 text-white"
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

              {/* Interactive court — only for Fortgeschrittener and Profi */}
              {level !== "Anfänger" && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                    {level === "Profi" ? "1. + 3. Laufziel & Zielzone auf dem Spielfeld wählen" : "2. Zielzone auf dem Spielfeld wählen"}
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
                    {level === "Profi" ? (
                      <>
                        <span className="flex items-center gap-1.5 text-violet-400">
                          Links klicken = Laufziel (DU)
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground/70">
                          Rechts klicken = Zielzone (Gegner)
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground/70">
                        Klicke auf die Gegnerseite (rechts) um Zielzone zu wählen
                      </span>
                    )}
                  </div>
                  <ScenarioCourt
                    positions={scenario.positions}
                    selectedZone={selectedZone}
                    hasSubmitted={hasSubmitted}
                    bestZones={scenario.bestZones}
                    onZoneClick={handleZoneClick}
                    profiMode={level === "Profi"}
                    selectedLaufZone={selectedLaufZone}
                    correctLaufZone={hasSubmitted ? scenario.laufZone : null}
                    onLaufZoneClick={(zoneId) => setSelectedLaufZone((z) => (z === zoneId ? null : zoneId))}
                  />
                </div>
              )}

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
                      disabled={!canSubmit}
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
                          isFullyCorrect
                            ? "text-primary"
                            : isPartiallyCorrect
                            ? "text-yellow-500"
                            : "text-destructive"
                        }`}
                      >
                        {isFullyCorrect
                          ? level === "Profi"
                            ? "★★★ Weltklasse! Die gesamte Kette perfekt vorausgesehen."
                            : "Ausgezeichnet! Richtig entschieden."
                          : isPartiallyCorrect
                          ? "Teilweise richtig — nicht ganz optimal."
                          : "Taktischer Fehler: In dieser Situation verlierst du den Punkt."}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed">
                        {scenario.explanation}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm font-medium mt-2">
                        {level === "Profi" && (
                          <div className={`px-4 py-2 rounded-lg border ${isLaufZoneCorrect ? "bg-emerald-600/10 border-emerald-600/40" : "bg-background border-border"}`}>
                            <span className="text-muted-foreground mr-2">Richtiges Laufziel:</span>
                            <span className={isLaufZoneCorrect ? "text-emerald-400" : "text-destructive"}>{scenario.laufZone}</span>
                          </div>
                        )}
                        <div className={`px-4 py-2 rounded-lg border ${isShotCorrect ? "bg-emerald-600/10 border-emerald-600/40" : "bg-background border-border"}`}>
                          <span className="text-muted-foreground mr-2">Optimale Schläge:</span>
                          <span className={isShotCorrect ? "text-emerald-400" : "text-primary"}>{scenario.validShots.join(" oder ")}</span>
                        </div>
                        {level !== "Anfänger" && (
                          <div className={`px-4 py-2 rounded-lg border ${isZoneCorrect ? "bg-emerald-600/10 border-emerald-600/40" : "bg-background border-border"}`}>
                            <span className="text-muted-foreground mr-2">Beste Zonen:</span>
                            <span className={isZoneCorrect ? "text-emerald-400" : "text-primary"}>{scenario.bestZones.join(", ")}</span>
                          </div>
                        )}
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

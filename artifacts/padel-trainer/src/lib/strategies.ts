import { PlayerPositions } from '../components/ScenarioCourt';

export type StrategyStep = {
  stepId: number;
  playerTurn: "you" | "ai"; // GANZ WICHTIG: Wer ist am Zug?
  description: string;
  positions: PlayerPositions;
  
  // Deine Eingaben (Wenn playerTurn === "you")
  validShots?: string[];
  bestZones?: string[];
  laufZone?: string;

  // KI Aktionen (Wenn playerTurn === "ai")
  aiHitter?: "opp1" | "opp2";
  aiShot?: string;
  aiTarget?: string;
  aiLaufZone?: string;

  stepExplanation: string;
};

export type StrategySequence = {
  id: string;
  title: string;
  theme: "Offensive" | "Defensive" | "Umschaltspiel";
  difficulty: 1 | 2 | 3;
  description: string;
  steps: StrategyStep[];
};

export const STRATEGIES: StrategySequence[] = [
  {
    id: "STRAT-1",
    title: "Serve & Volley durch die Mitte",
    theme: "Offensive",
    difficulty: 1,
    description: "Der Klassiker: Du nimmst dem Gegner durch einen Aufschlag durch die Mitte den Winkel und rückst sofort ans Netz auf, um den Punkt am Netz zu dominieren.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Du hast Aufschlag. Ziele durch die Mitte (T-Linie), um den Winkel für den Return zu minimieren.",
        positions: {
          you: "D1", // Du stehst hinten rechts
          partner: "B4", // Partner steht am Netz
          opp1: "B1", // Returnspieler hinten links
          opp2: "D1", // Anderer Gegner hinten rechts
          ball: { side: "left", zone: "D1", type: "Vorbereitung" } // LEFT = Unten bei dir
        },
        validShots: ["AUFSCHLAG"],
        bestZones: ["C2"], // Ziel: T-Linie
        laufZone: "D4", // Weg: Ans Netz
        stepExplanation: "Perfekt. Du rückst ans Netz vor."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Der Gegner reagiert auf deinen Aufschlag. Er muss durch die Mitte returnieren. Beobachte seinen Schlag!",
        positions: {
          you: "D4", // Du bist jetzt am Netz
          partner: "B4", 
          opp1: "C2", // Gegner 1 ist zur Mitte getreten
          opp2: "D1", 
          ball: { side: "right", zone: "C2", type: "AUFSCHLAG" } // RIGHT = Oben beim Gegner
        },
        aiHitter: "opp1",
        aiShot: "DRIVE",
        aiTarget: "D4", // Er spielt flach auf dich zurück
        aiLaufZone: "B1", // Er geht nach dem Return zurück
        stepExplanation: "Der Gegner spielt einen flachen Return auf dich am Netz. Mach dich bereit!"
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der flache Return kommt auf dich zu. Spiele einen tiefen Volley in die Ecke, um sie hinten festzunageln.",
        positions: {
          you: "D4", 
          partner: "B4", 
          opp1: "B1", // Gegner wieder hinten
          opp2: "D1", 
          ball: { side: "left", zone: "D4", type: "DRIVE" } // Ball kommt vom Gegner (Oben)
        },
        validShots: ["VOLLEY"],
        bestZones: ["A1"], // Ziel: Die tiefe Ecke
        laufZone: "D4", // Position behalten
        stepExplanation: "Stark! Mit dem Volley hältst du den Druck aufrecht und zwingst die Gegner in die absolute Defensive."
      }
    ]
  },
  {
    id: "STRAT-2",
    title: "Befreiungs-Lob & Netzangriff",
    theme: "Umschaltspiel",
    difficulty: 2,
    description: "Die Gegner stehen am Netz und machen Druck. Du nutzt einen tiefen Ball für einen perfekten Lob und eroberst dir die Netzposition zurück.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Beide Gegner kleben am Netz. Du bekommst einen harten Ball tief in deine Ecke. Spiele einen hohen Lob über den diagonalen Spieler.",
        positions: {
          you: "A1", 
          partner: "D1", 
          opp1: "B4", 
          opp2: "D4", 
          ball: { side: "left", zone: "A1", type: "Vorbereitung" } // RIGHT = Kommt vom Gegner am Netz
        },
        validShots: ["LOB"],
        bestZones: ["E1"], 
        laufZone: "C4", 
        stepExplanation: "Super! Der Lob ist in der Luft. Rücke sofort ans Netz vor."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Dein Lob war gut! Gegner 2 muss in die Ecke zurückrennen und einen Verzweiflungs-Ball (Bajada) spielen.",
        positions: {
          you: "C4", // Du bist am Netz
          partner: "E5", 
          opp1: "C2", 
          opp2: "E1", // Gegner ist in die Ecke gerannt
          ball: { side: "right", zone: "E1", type: "LOB" } // RIGHT = Ball ist beim Gegner hinten
        },
        aiHitter: "opp2",
        aiShot: "BAJADA",
        aiTarget: "C4",
        aiLaufZone: "D2",
        stepExplanation: "Der Gegner spielt einen hohen Notball zurück. Perfekte Chance für dich!"
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der Ball kommt hoch aus der Ecke. Positioniere dich für den Abschluss in die Mitte.",
        positions: {
          you: "C4", 
          partner: "E4", 
          opp1: "C2", 
          opp2: "D2", 
          ball: { side: "right", zone: "E1", type: "BAJADA" } 
        },
        validShots: ["SMASH", "BANDEJA", "VIBORA"], 
        bestZones: ["B2", "B3"], 
        laufZone: "C4", 
        stepExplanation: "Hervorragend. Du hast das Momentum gedreht und den Punkt zugemacht."
      }
    ]
  }
];
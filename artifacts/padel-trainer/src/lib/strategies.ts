import { PlayerPositions } from '../components/ScenarioCourt';

export type StrategyStep = {
  stepId: number;
  playerTurn: "you" | "ai"; // GANZ WICHTIG: Wer ist am Zug?
  description: string;
  description_en?: string;
  description_es?: string;
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
  stepExplanation_en?: string;
  stepExplanation_es?: string;
};

export type StrategySequence = {
  id: string;
  title: string;
  title_en?: string;
  title_es?: string;
  theme: "Offensive" | "Defensive" | "Umschaltspiel";
  difficulty: 1 | 2 | 3;
  description: string;
  description_en?: string;
  description_es?: string;
  steps: StrategyStep[];
};

export const STRATEGIES: StrategySequence[] = [
  {
    id: "STRAT-1",
    title: "Serve & Volley durch die Mitte",
    title_en: "Serve & Volley Down the Middle",
    title_es: "Saque y Volea por el Centro",
    theme: "Offensive",
    difficulty: 1,
    description: "Der Klassiker: Du nimmst dem Gegner durch einen Aufschlag durch die Mitte den Winkel und rückst sofort ans Netz auf, um den Punkt am Netz zu dominieren.",
    description_en: "The classic play: Cut off the opponent's angles with a serve down the T and immediately follow it to the net to dominate the rally.",
    description_es: "El clásico: Le quitas ángulo al rival con un saque a la T y subes de inmediato a la red para dominar el punto.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Du hast Aufschlag. Ziele durch die Mitte (T-Linie), um den Winkel für den Return zu minimieren.",
        description_en: "You are serving. Aim down the middle (T-line) to minimize the opponent's return angles.",
        description_es: "Tienes el saque. Apunta al centro (línea de la T) para reducir los ángulos de resto del rival.",
        positions: {
          you: "D1", // Du stehst hinten rechts
          partner: "B4", // Partner steht am Netz
          opp1: "B1", // Returnspieler hinten links
          opp2: "D1", // Anderer Gegner hinten rechts
          ball: { side: "left", zone: "D1", type: "Vorbereitung" }
        },
        validShots: ["AUFSCHLAG"],
        bestZones: ["C2"], // Ziel: T-Linie
        laufZone: "D4", // Weg: Ans Netz
        stepExplanation: "Perfekt. Du rückst ans Netz vor.",
        stepExplanation_en: "Perfect. You follow your serve straight up to the net.",
        stepExplanation_es: "Perfecto. Acompañas tu saque subiendo a la red."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Der Gegner reagiert auf deinen Aufschlag. Er muss durch die Mitte returnieren. Beobachte seinen Schlag!",
        description_en: "The opponent reacts to your serve and is forced to return through the middle. Watch their shot!",
        description_es: "El rival reacciona a tu saque y se ve obligado a restar por el centro. ¡Observa su tiro!",
        positions: {
          you: "D4", // Du bist jetzt am Netz
          partner: "B4", 
          opp1: "C2", // Gegner 1 ist zur Mitte getreten
          opp2: "D1", 
          ball: { side: "right", zone: "C2", type: "AUFSCHLAG" }
        },
        aiHitter: "opp1",
        aiShot: "DRIVE",
        aiTarget: "D4", // Er spielt flach auf dich zurück
        aiLaufZone: "B1", // Er geht nach dem Return zurück
        stepExplanation: "Der Gegner spielt einen flachen Return auf dich am Netz. Mach dich bereit!",
        stepExplanation_en: "The opponent hits a flat drive return towards you at the net. Get ready!",
        stepExplanation_es: "El rival juega un resto plano hacia ti en la red. ¡Prepárate!"
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der flache Return kommt auf dich zu. Spiele einen tiefen Volley in die Ecke, um sie hinten festzunageln.",
        description_en: "The flat return comes right at you. Punch a deep volley into the corner to pin them at the back.",
        description_es: "El resto plano viene hacia ti. Juega una volea profunda al rincón para hundirlos en el fondo.",
        positions: {
          you: "D4", 
          partner: "B4", 
          opp1: "B1", // Gegner wieder hinten
          opp2: "D1", 
          ball: { side: "left", zone: "D4", type: "DRIVE" }
        },
        validShots: ["VOLLEY"],
        bestZones: ["A1"], // Ziel: Die tiefe Ecke
        laufZone: "D4", // Position behalten
        stepExplanation: "Stark! Mit dem Volley hältst du den Druck aufrecht und zwingst die Gegner in die absolute Defensive.",
        stepExplanation_en: "Great job! Your deep volley keeps the pressure on and locks the opponents in deep defense.",
        stepExplanation_es: "¡Brillante! Con esa volea mantienes la presión y obligas a los rivales a defender en el fondo."
      }
    ]
  },
  {
    id: "STRAT-2",
    title: "Befreiungs-Lob & Netzangriff",
    title_en: "Defensive Lob & Net Takeover",
    title_es: "Globo Defensivo y Toma de Red",
    theme: "Umschaltspiel",
    difficulty: 2,
    description: "Die Gegner stehen am Netz und machen Druck. Du nutzt einen tiefen Ball für einen perfekten Lob und eroberst dir die Netzposition zurück.",
    description_en: "The opponents control the net and apply pressure. Use a deep cross-court lob to push them back and take over the net.",
    description_es: "Los rivales dominan la red y presionan. Aprovecha una bola baja para lanzar un globo perfecto y recuperar la red.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Beide Gegner kleben am Netz. Du bekommst einen harten Ball tief in deine Ecke. Spiele einen hohen Lob über den diagonalen Spieler.",
        description_en: "Both opponents are crowding the net while you are pinned deep in the corner. Play a high cross-court lob over the diagonal player.",
        description_es: "Ambos rivales están pegados a la red y recibes una bola profunda en tu esquina. Juega un globo alto cruzado sobre el jugador diagonal.",
        positions: {
          you: "A1", 
          partner: "D1", 
          opp1: "B4", 
          opp2: "D4", 
          ball: { side: "left", zone: "A1", type: "Vorbereitung" }
        },
        validShots: ["LOB"],
        bestZones: ["E1"], 
        laufZone: "C4", 
        stepExplanation: "Super! Der Lob ist in der Luft. Rücke sofort ans Netz vor.",
        stepExplanation_en: "Great! The lob is up in the air—move forward to take the net immediately.",
        stepExplanation_es: "¡Muy bien! El globo está en el aire: sube de inmediato a tomar la red."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Dein Lob war gut! Gegner 2 muss in die Ecke zurückrennen und einen Verzweiflungs-Ball (Bajada) spielen.",
        description_en: "Your lob pushed them back! Opponent 2 has to sprint into the corner and hit a desperate Bajada.",
        description_es: "¡Tu globo fue buenísimo! El rival 2 tiene que correr hasta el rincón y jugar una Bajada forzada.",
        positions: {
          you: "C4", // Du bist am Netz
          partner: "E5", 
          opp1: "C2", 
          opp2: "E1", // Gegner ist in die Ecke gerannt
          ball: { side: "right", zone: "E1", type: "LOB" }
        },
        aiHitter: "opp2",
        aiShot: "BAJADA",
        aiTarget: "C4",
        aiLaufZone: "D2",
        stepExplanation: "Der Gegner spielt einen hohen Notball zurück. Perfekte Chance für dich!",
        stepExplanation_en: "The opponent floats a weak emergency ball back. Your chance to finish!",
        stepExplanation_es: "El rival devuelve una bola forzada a media altura. ¡Tu oportunidad para definir!"
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der Ball kommt hoch aus der Ecke. Positioniere dich für den Abschluss in die Mitte.",
        description_en: "The ball floats high from the corner. Put away the overhead into the open court.",
        description_es: "La bola viene alta desde la esquina. Define con un golpe aéreo hacia el hueco.",
        positions: {
          you: "C4", 
          partner: "E4", 
          opp1: "C2", 
          opp2: "D2", 
          ball: { side: "left", zone: "C4" } 
        },
        validShots: ["SMASH", "BANDEJA", "VIBORA"], 
        bestZones: ["B2", "B3"], 
        laufZone: "C4", 
        stepExplanation: "Hervorragend. Du hast das Momentum gedreht und den Punkt zugemacht.",
        stepExplanation_en: "Outstanding! You flipped the momentum from defense to attack and closed out the point.",
        stepExplanation_es: "¡Excelente! Has cambiado la iniciativa de defensa a ataque y has cerrado el punto."
      }
    ]
  },
  {
    id: "STRAT-3",
    title: "Anti-Tennis: Die Glaswand-Falle",
    title_en: "Anti-Tennis: The Back-Glass Trap",
    title_es: "Anti-Tenis: La Trampa del Cristal",
    theme: "Offensive",
    difficulty: 2,
    description: "Tennisspieler hassen die Glaswand. Spiele den Ball absichtlich tief in die Ecke ans Glas. Sie werden einen schwachen Lob spielen, den du bestrafst.",
    description_en: "Former tennis players hate balls rebounding off the glass. Aim deep into the corner glass to force a weak lob, then punish it.",
    description_es: "Los jugadores de tenis sufren con el rebote de pared. Juega profundo al cristal de la esquina para forzar un globo corto y rematar.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Ihr habt das Netz, die typischen Tennisspieler stehen an der Grundlinie. Spiele einen Volley oder eine weiche Bandeja GANZ TIEF in die linke Ecke ans Glas.",
        description_en: "You control the net while the opponents stay on the baseline. Play a deep Volley right into the back left corner glass (A1).",
        description_es: "Domináis la red mientras los rivales esperan en la línea de fondo. Juega una Volea profunda directo al cristal del rincón izquierdo (A1).",
        positions: {
          you: "E4", // Du stehst aggressiv am Netz
          partner: "B4", 
          opp1: "A2", // Tennisspieler bleiben wie angewurzelt hinten
          opp2: "D2", 
          ball: { side: "left", zone: "E4", type: "Vorbereitung" } 
        },
        validShots: ["VOLLEY"],
        bestZones: ["A1"], // Ganz tief in die Ecke
        laufZone: "D4", // Position behaupten
        stepExplanation: "Genau richtig! Der Ball klatscht an die Scheibe. Ein Albtraum für reine Tennisspieler.",
        stepExplanation_en: "Spot on! The ball skids off the corner glass—a nightmare for pure baseline players.",
        stepExplanation_es: "¡Exacto! La bola muerde el cristal del rincón, obligando al rival a girar."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Der Gegner dreht sich ungeschickt zur Scheibe, schwingt zu weit aus und muss einen Not-Lob spielen.",
        description_en: "The opponent turns awkwardly towards the glass, takes too big a swing, and pops up a short lob.",
        description_es: "El rival gira incómodo hacia el cristal y levanta un globo de emergencia demasiado corto.",
        positions: {
          you: "D4", 
          partner: "B4", 
          opp1: "A1", // Gegner in die Ecke gezwungen
          opp2: "D2", 
          ball: { side: "right", zone: "A1", type: "VOLLEY" } 
        },
        aiHitter: "opp1",
        aiShot: "LOB",
        aiTarget: "D3", // Ein zu kurzer Lob
        aiLaufZone: "B2",
        stepExplanation: "Typisch! Der Ball kommt durch die schlechte Wandtechnik viel zu kurz und hoch zurück.",
        stepExplanation_en: "Classic! Poor glass footwork results in a short, high sitter in mid-court.",
        stepExplanation_es: "¡Clásico! La mala lectura de pared deja un globo corto a media pista."
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der Lob verhungert im Halbfeld. Mach ein bis zwei Schritte zurück und beende den Punkt hart durch die Mitte.",
        description_en: "The lob sits up in mid-court (D3). Step back and finish the point hard down the middle.",
        description_es: "El globo se queda colgado en D3. Da un paso atrás y define fuerte por el centro.",
        positions: {
          you: "D3", // Du bist leicht zurückgegangen
          partner: "B4", 
          opp1: "B2", 
          opp2: "D2", 
          ball: { side: "left", zone: "D3", type: "LOB" } 
        },
        validShots: ["SMASH", "VIBORA"], 
        bestZones: ["C1"], // Hart durch die Mitte, wo sich beide Tennisspieler uneinig sind
        laufZone: "D4", // Sofort wieder ans Netz
        stepExplanation: "Krawumm! So bestraft man mangelnde Glaswand-Verteidigung.",
        stepExplanation_en: "Boom! That is how you punish weak back-glass defense.",
        stepExplanation_es: "¡Bum! Así se castiga una mala defensa de pared."
      }
    ]
  },
  {
    id: "STRAT-4",
    title: "Anti-Tennis: Die Ziehharmonika",
    title_en: "Anti-Tennis: The Accordion",
    title_es: "Anti-Tenis: El Acordeón",
    theme: "Umschaltspiel",
    difficulty: 3,
    description: "Tennisspieler meiden den Weg nach vorne. Locke sie mit einer 'Chiquita' (kurzer Ball) vor ans Netz und überloppe sie direkt im nächsten Zug.",
    description_en: "Baseline players hate being pulled forward and back. Lure them in with a soft Chiquita, then lob over their heads on the very next shot.",
    description_es: "Mueve a los rivales hacia delante y hacia atrás como un acordeón: atráelos con una Chiquita corta y supéralos con un globo en el siguiente tiro.",
    steps: [
      {
        stepId: 1,
        playerTurn: "you",
        description: "Beide Teams stehen hinten (klassisches Tennis-Duell). Unterbrich den Rhythmus! Spiele eine softe Chiquita (kurz) vor die Füße des linken Gegners.",
        description_en: "Both teams are trading from the back. Break the rhythm! Drop a soft Chiquita into C4 to pull the opponent forward.",
        description_es: "Ambos equipos pelotean desde atrás. ¡Rompe el ritmo! Juega una Chiquita suave a C4 para obligar al rival a entrar.",
        positions: {
          you: "B2", // Du bist hinten
          partner: "D2", 
          opp1: "B2", // Gegner auch hinten
          opp2: "D2", 
          ball: { side: "left", zone: "B2", type: "Vorbereitung" } 
        },
        validShots: ["CHIQUITA"],
        bestZones: ["C4"], // Kurz hinter das Netz
        laufZone: "B4", // Du gehst vor ins Halbfeld, um den Druck zu erhöhen
        stepExplanation: "Clever! Der Gegner MUSS nun nach vorne ins ungeliebte No-Man's-Land.",
        stepExplanation_en: "Smart! Now the opponent is forced to run forward into no man's land.",
        stepExplanation_es: "¡Inteligente! Ahora el rival está obligado a correr hacia delante a tierra de nadie."
      },
      {
        stepId: 2,
        playerTurn: "ai",
        description: "Der Gegner sprintet hektisch nach vorne und muss den Ball tief ausgraben (schwieriger Volley).",
        description_en: "The opponent scrambles forward and has to dig out a low volley.",
        description_es: "El rival corre precipitado hacia delante y tiene que levantar una volea baja.",
        positions: {
          you: "B4", // Du bist aufgerückt
          partner: "D4", 
          opp1: "C4", // Gegner ist nach vorne geeilt
          opp2: "D4", 
          ball: { side: "right", zone: "C4", type: "CHIQUITA" } 
        },
        aiHitter: "opp1",
        aiShot: "VOLLEY",
        aiTarget: "B4", // Spielt einen defensiven Halb-Volley auf dich
        aiLaufZone: "C3", // Bleibt im Halbfeld stehen
        stepExplanation: "Genau wie geplant. Er steht jetzt gestrandet im Halbfeld, wo er nicht sein will.",
        stepExplanation_en: "Just as planned—now they are stranded in mid-court (C3).",
        stepExplanation_es: "Tal como planeaste: ahora se ha quedado vendido a media pista (C3)."
      },
      {
        stepId: 3,
        playerTurn: "you",
        description: "Der Gegner steht im Halbfeld. Nutze den Platz hinter ihm und spiele einen präzisen Lob in seine Ecke.",
        description_en: "With the opponent stranded in mid-court, exploit the space behind them with a precise lob into A1.",
        description_es: "Con el rival atrapado a media pista, aprovecha el espacio a su espalda con un globo preciso hacia A1.",
        positions: {
          you: "B4", 
          partner: "D4", 
          opp1: "C3", // Gestrandeter Gegner
          opp2: "D3", 
          ball: { side: "left", zone: "B4", type: "VOLLEY" } 
        },
        validShots: ["LOB"], 
        bestZones: ["A1"], // Tief über ihn drüber in seine Ecke
        laufZone: "B4", // Du und dein Partner erobern jetzt das Netz!
        stepExplanation: "Schachmatt! Der Gegner muss nun rückwärts laufen und einen schwierigen Überkopfschlag meistern – eine absolute Schwäche von Tennisspielern.",
        stepExplanation_en: "Checkmate! The opponent is forced to backpedal into the corner while you and your partner own the net.",
        stepExplanation_es: "¡Jaque mate! El rival tiene que correr hacia atrás mientras tu pareja domina la red."
      }
    ]
  }
];
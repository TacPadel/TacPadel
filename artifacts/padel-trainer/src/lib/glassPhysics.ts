import * as THREE from "three";
import { AppLanguage } from "./i18n";

export type LabMode = "attack" | "defense";

export type AttackShotType = "VIBORA" | "BAJADA" | "SMASH_POR3" | "VOLLEY" | "LOB";
export type DefenseShotType = "SLICE" | "FLAT" | "TOPSPIN" | "LOB";
export type LabShotType = AttackShotType | DefenseShotType;

export type GlassPattern =
  | "no_glass"
  | "back_only"
  | "side_only"
  | "back_to_side"
  | "side_to_back"
  | "fence"
  | "por_3"
  | "por_4";

export type AttackRating = "winner" | "pressure" | "neutral" | "risky";

export interface GlassHit {
  point: THREE.Vector3;
  wall: "back" | "side_left" | "side_right";
  isMesh: boolean;
  time: number;
}

export interface TrajectorySegment {
  kind: "approach" | "to_glass" | "after_glass" | "por_exit";
  points: THREE.Vector3[];
  startTime: number;
  endTime: number;
}

export interface TrajectorySample {
  time: number;
  pos: THREE.Vector3;
  segmentKind: TrajectorySegment["kind"];
}

export interface LabSimulationResult {
  mode: LabMode;
  shotType: LabShotType;
  segments: TrajectorySegment[];
  samples: TrajectorySample[];
  totalDuration: number;
  firstBounce: THREE.Vector3;
  secondBounce: THREE.Vector3 | null;
  glassHits: GlassHit[];
  exitPoint: THREE.Vector3 | null;
  exitedCourt: "por_3" | "por_4" | null;
  sweetspot: THREE.Vector3;
  optimalStandPos: THREE.Vector3;
  pattern: GlassPattern;
  patternLabel: string;
  coachTip: string;
  isBajadaWindow: boolean;
  attackRating?: AttackRating;
}

export interface DefensePositionEval {
  status: "perfect" | "playable" | "jammed" | "too_far";
  distance: number;
  message: string;
}

export interface DefensePreset {
  id: string;
  labels: Record<AppLanguage, string>;
  shotType: DefenseShotType;
  // 2D-Radar-Koordinaten (V_WIDTH = 760, V_HEIGHT = 380)
  oppPos: { x: number; y: number };
  bouncePos: { x: number; y: number };
  playerPos: { x: number; y: number };
}

export interface AttackPreset {
  id: string;
  labels: Record<AppLanguage, string>;
  shotType: AttackShotType;
  // 2D-Radar-Koordinaten (V_WIDTH = 760, V_HEIGHT = 380)
  playerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
}

// =========================================================================
// 4 KLASSISCHE ANGRIFFS-PRESETS (INKL. POR-3 KICK SMASH & GITTER-VOLLEY)
// =========================================================================
export const ATTACK_PRESETS: AttackPreset[] = [
  {
    id: "attack_por3",
    labels: {
      de: "💥 Smash Por 3",
      en: "💥 Smash x3",
      es: "💥 Remate x3",
    },
    shotType: "SMASH_POR3",
    playerPos: { x: 266, y: 114 }, // x: -2.0, z: +3.0
    targetPos: { x: 616, y: 243 }, // x: +1.4, z: -6.2 -> perfektes Por-3-Fenster
  },
  {
    id: "attack_vibora",
    labels: {
      de: "🐍 Víbora Ecke",
      en: "🐍 Víbora Corner",
      es: "🐍 Víbora Rincón",
    },
    shotType: "VIBORA",
    playerPos: { x: 243, y: 122 }, // x: -1.8, z: +3.6
    targetPos: { x: 676, y: 319 }, // x: +3.4, z: -7.8
  },
  {
    id: "attack_fence",
    labels: {
      de: "⚡ Gitter-Volley",
      en: "⚡ Fence Volley",
      es: "⚡ Volea a Reja",
    },
    shotType: "VOLLEY",
    playerPos: { x: 289, y: 133 }, // x: -1.5, z: +2.4
    targetPos: { x: 517, y: 334 }, // x: +3.8, z: -3.6
  },
  {
    id: "attack_bajada",
    labels: {
      de: "🔥 Bajada Tief",
      en: "🔥 Deep Bajada",
      es: "🔥 Bajada Fondo",
    },
    shotType: "BAJADA",
    playerPos: { x: 95, y: 274 },  // x: +2.2, z: +7.5
    targetPos: { x: 638, y: 179 }, // x: -0.3, z: -6.8
  },
];

// =========================================================================
// 4 KLASSISCHE SCHEIBENSPIEL-PRESETS (VERTEIDIGUNG)
// =========================================================================
export const DEFENSE_PRESETS: DefensePreset[] = [
  {
    id: "back_straight",
    labels: {
      de: "Rückscheibe",
      en: "Back Glass",
      es: "Cristal fondo",
    },
    shotType: "TOPSPIN",
    oppPos: { x: 494, y: 114 },    // x: -2.0, z: -3.0
    bouncePos: { x: 84, y: 106 },  // x: -2.2, z: +7.8
    playerPos: { x: 132, y: 106 }, // x: -2.2, z: +6.5
  },
  {
    id: "side_diag",
    labels: {
      de: "Seitenglas",
      en: "Side Glass",
      es: "Cristal lateral",
    },
    shotType: "FLAT",
    oppPos: { x: 475, y: 76 },     // x: -3.0, z: -2.5
    bouncePos: { x: 152, y: 319 }, // x: +3.4, z: +6.0
    playerPos: { x: 112, y: 264 }, // x: +1.9, z: +7.0
  },
  {
    id: "double_back_side",
    labels: {
      de: "Rück → Seite",
      en: "Back → Side",
      es: "Fondo → Lateral",
    },
    shotType: "FLAT",
    oppPos: { x: 513, y: 106 },    // x: -2.2, z: -3.5
    bouncePos: { x: 76, y: 315 },  // x: +3.3, z: +8.0
    playerPos: { x: 126, y: 266 }, // x: +2.0, z: +6.7
  },
  {
    id: "double_side_back",
    labels: {
      de: "Seite → Rück",
      en: "Side → Back",
      es: "Lateral → Fondo",
    },
    shotType: "FLAT",
    oppPos: { x: 479, y: 53 },     // x: -3.6, z: -2.6
    bouncePos: { x: 99, y: 346 },  // x: +4.1, z: +7.4
    playerPos: { x: 120, y: 280 }, // x: +2.4, z: +6.8
  },
];

const GRAVITY = 9.81;
const BALL_RADIUS = 0.06;
const HALF_COURT_X = 4.92;
const BACK_WALL_Z = 9.92;
const SIDE_WALL_EXIT_HEIGHT = 3.02;
const BACK_WALL_EXIT_HEIGHT = 4.02;

interface ShotPhysicsProfile {
  startY: number;
  baseSpeed: number;
  floorHorizKeep: number;
  floorBounceVy: number;
  glassHorizRest: number;
  glassTangentialKeep: number;
  glassVyFactor: number;
  glassVySpinKick: number;
  backGlassSideKick?: number;
}

const SHOT_PROFILES: Record<LabShotType, ShotPhysicsProfile> = {
  // Verteidigungs-Spins
  SLICE: {
    startY: 1.55,
    baseSpeed: 12.2,
    floorHorizKeep: 0.88,
    floorBounceVy: 2.55,
    glassHorizRest: 0.50,
    glassTangentialKeep: 0.82,
    glassVyFactor: 0.25,
    glassVySpinKick: -1.45,
  },
  FLAT: {
    startY: 1.45,
    baseSpeed: 11.4,
    floorHorizKeep: 0.86,
    floorBounceVy: 4.15,
    glassHorizRest: 0.74,
    glassTangentialKeep: 0.88,
    glassVyFactor: 0.65,
    glassVySpinKick: 0.0,
  },
  TOPSPIN: {
    startY: 1.85,
    baseSpeed: 10.6,
    floorHorizKeep: 0.90,
    floorBounceVy: 5.45,
    glassHorizRest: 0.86,
    glassTangentialKeep: 0.90,
    glassVyFactor: 0.72,
    glassVySpinKick: 1.65,
  },
  LOB: {
    startY: 1.15,
    baseSpeed: 6.4,
    floorHorizKeep: 0.78,
    floorBounceVy: 7.35,
    glassHorizRest: 0.64,
    glassTangentialKeep: 0.84,
    glassVyFactor: 0.78,
    glassVySpinKick: 0.55,
  },
  // Angriffs-Schläge
  VIBORA: {
    startY: 2.05,
    baseSpeed: 13.4,
    floorHorizKeep: 0.88,
    floorBounceVy: 2.35,
    glassHorizRest: 0.46,
    glassTangentialKeep: 0.82,
    glassVyFactor: 0.22,
    glassVySpinKick: -1.55, // Zwingt den Ball am Glas steil nach unten
  },
  BAJADA: {
    startY: 1.95,
    baseSpeed: 13.8,
    floorHorizKeep: 0.88,
    floorBounceVy: 5.25,
    glassHorizRest: 0.84,
    glassTangentialKeep: 0.90,
    glassVyFactor: 0.72,
    glassVySpinKick: 1.55,
  },
  SMASH_POR3: {
    startY: 2.65,
    baseSpeed: 17.5,
    floorHorizKeep: 0.76,
    floorBounceVy: 8.5,
    glassHorizRest: 0.62,
    glassTangentialKeep: 0.92,
    glassVyFactor: 0.68,
    glassVySpinKick: 2.65,
    backGlassSideKick: 1.65, // Seitlicher Kick nach Rückscheibe Richtung 3m-Seitenwand
  },
  VOLLEY: {
    startY: 1.35,
    baseSpeed: 12.6,
    floorHorizKeep: 0.85,
    floorBounceVy: 3.05,
    glassHorizRest: 0.62,
    glassTangentialKeep: 0.86,
    glassVyFactor: 0.45,
    glassVySpinKick: -0.6,
  },
};

function getDefensePatternText(
  pattern: GlassPattern,
  shotType: LabShotType,
  isBajadaWindow: boolean,
  lang: AppLanguage
): { label: string; tip: string } {
  if (lang === "en") {
    if (pattern === "por_3") {
      return {
        label: "POR 3 • BALL EXITS COURT",
        tip: "Ball clears the 3m side wall! Only way to save it is sprinting outside the court door.",
      };
    }
    if (pattern === "por_4") {
      return {
        label: "POR 4 • OVER BACK GLASS",
        tip: "Ball flies over the 4m back glass – immediate point winner.",
      };
    }
    if (pattern === "fence") {
      return {
        label: "SIDE MESH / FENCE",
        tip: "Ball hits the metal fence – bounces unpredictably. Stay low, compact grip, react late.",
      };
    }
    if (pattern === "back_to_side") {
      return {
        label: "DOUBLE GLASS: BACK → SIDE",
        tip: "Read the back glass first, then open toward the center – the second bounce feeds the ball right into your strike zone.",
      };
    }
    if (pattern === "side_to_back") {
      return {
        label: "DOUBLE GLASS: SIDE → BACK",
        tip: "Classic Giro! Don't chase the side wall – turn smoothly with the ball as the back glass opens it toward the middle.",
      };
    }
    if (pattern === "back_only") {
      if (shotType === "SLICE" || shotType === "VIBORA") {
        return {
          label: "BACK GLASS • SLICE DROP",
          tip: "Backspin makes the ball drop steeply off the glass. Bend your knees, stay close to the glass and lift a clean lob or chiquita.",
        };
      }
      if (isBajadaWindow) {
        return {
          label: "BACK GLASS • BAJADA WINDOW",
          tip: "High rebound off the back glass! Leave space behind the bounce, get behind the ball and attack with a Bajada.",
        };
      }
      return {
        label: "SINGLE BACK GLASS",
        tip: "Step back with the ball, leave roughly 1m space to the glass and transfer your weight forward into the strike.",
      };
    }
    if (pattern === "side_only") {
      return {
        label: "SINGLE SIDE GLASS",
        tip: "Angle in = angle out toward the center. Don't get jammed against the side glass – wait one step inside.",
      };
    }
    return {
      label: "NO GLASS REBOUND",
      tip: "Ball bounces twice before reaching the glass – step forward and play it directly before it dies.",
    };
  }

  if (lang === "es") {
    if (pattern === "por_3") {
      return {
        label: "POR 3 • SALE POR LATERAL",
        tip: "¡La bola supera los 3m del lateral! Solo se puede salvar saliendo por la puerta.",
      };
    }
    if (pattern === "por_4") {
      return {
        label: "POR 4 • SALE POR FONDO",
        tip: "La bola supera los 4m del fondo: punto directo.",
      };
    }
    if (pattern === "fence") {
      return {
        label: "REJA METÁLICA",
        tip: "La bola toca la reja lateral: rebote imprevisible. Flexiona rodillas y bloquea con pala firme.",
      };
    }
    if (pattern === "back_to_side") {
      return {
        label: "DOBLE PARED: FONDO → LATERAL",
        tip: "Acompaña primero al fondo y ábrete hacia el centro: el segundo cristal te deja la bola cómoda delante.",
      };
    }
    if (pattern === "side_to_back") {
      return {
        label: "DOBLE PARED: LATERAL → FONDO",
        tip: "¡Giro clásico! No te pegues al cristal lateral: gira acompañando la bola mientras el fondo la abre al centro.",
      };
    }
    if (pattern === "back_only") {
      if (shotType === "SLICE" || shotType === "VIBORA") {
        return {
          label: "PARED DE FONDO • CORTADO",
          tip: "El efecto cortado hace caer la bola rápido tras el cristal. Baja el centro de gravedad y levanta un globo o chiquita.",
        };
      }
      if (isBajadaWindow) {
        return {
          label: "PARED DE FONDO • BAJADA",
          tip: "¡Rebote alto! Deja espacio con el cristal, colócate detrás de la bola y ataca con una bajada de pared.",
        };
      }
      return {
        label: "PARED DE FONDO",
        tip: "Deja espacio al cristal, espera el rebote a altura cómoda y transfiere el peso hacia delante al golpear.",
      };
    }
    if (pattern === "side_only") {
      return {
        label: "PARED LATERAL",
        tip: "Ángulo de entrada = ángulo de salida hacia el centro. No te encierres contra el cristal.",
      };
    }
    return {
      label: "SIN REBOTE EN CRISTAL",
      tip: "La bola bota dos veces antes de llegar al cristal: adelántate y golpea directo tras el primer bote.",
    };
  }

  // Deutsch
  if (pattern === "por_3") {
    return {
      label: "POR 3 • BALL FLIEGT RAUS",
      tip: "Der Ball fliegt über die 3-Meter-Seitenwand! Nur noch durch einen Sprint aus der Tür zu retten.",
    };
  }
  if (pattern === "por_4") {
    return {
      label: "POR 4 • ÜBER RÜCKSCHEIBE",
      tip: "Der Ball fliegt über die 4-Meter-Rückwand – direkter Punkt!",
    };
  }
  if (pattern === "fence") {
    return {
      label: "GITTER-TREFFER (SEITE)",
      tip: "Der Ball trifft das Metallgitter – unberechenbarer Absprung! Tief bleiben, kompakter Griff und spät reagieren.",
    };
  }
  if (pattern === "back_to_side") {
    return {
      label: "DOPPELGLAS: RÜCK → SEITE",
      tip: "Geh erst mit zur Rückscheibe und öffne dann zur Mitte – die Seitenscheibe legt dir den Ball perfekt vor den Schläger.",
    };
  }
  if (pattern === "side_to_back") {
    return {
      label: "DOPPELGLAS: SEITE → RÜCK",
      tip: "Klassischer Giro! Klebe nicht an der Seitenscheibe, sondern dreh dich ruhig mit – die Rückscheibe öffnet den Ball in die Mitte.",
    };
  }
  if (pattern === "back_only") {
    if (shotType === "SLICE" || shotType === "VIBORA") {
      return {
        label: "RÜCKSCHEIBE • SLICE FÄLLT AB",
        tip: "Achtung Unterschnitt: Der Ball fällt kurz nach dem Glas steil ab! Tief in die Knie, nah am Glas abholen und kontrolliert lobben.",
      };
    }
    if (isBajadaWindow) {
      return {
        label: "RÜCKSCHEIBE • BAJADA-FENSTER",
        tip: "Hoher Rebound aus der Scheibe! Lass genug Platz zum Glas, geh hinter den Ball und greife mit einer Bajada an.",
      };
    }
    return {
      label: "RÜCKSCHEIBE GERADE",
      tip: "Lass den Ball an dir vorbei, halte ~1 m Abstand zur Scheibe und nimm den Schwung nach dem Abpraller mit nach vorne.",
    };
  }
  if (pattern === "side_only") {
    return {
      label: "SEITENSCHEIBE",
      tip: "Einfallswinkel = Ausfallswinkel zur Mitte. Klemm dich nicht an der Scheibe ein – ein Schritt innen gibt dir volle Kontrolle.",
    };
  }
  return {
    label: "KEIN SCHEIBEN-KONTAKT",
    tip: "Der Ball springt zweimal auf, bevor er das Glas erreicht – geh aktiv entgegen und nimm ihn direkt vor der Scheibe!",
  };
}

function getAttackEvaluation(
  pattern: GlassPattern,
  shotType: LabShotType,
  bouncePos: THREE.Vector3,
  sweetspot: THREE.Vector3,
  lang: AppLanguage
): { label: string; tip: string; rating: AttackRating } {
  const bounceDepth = Math.abs(bouncePos.z);

  if (pattern === "por_3") {
    return {
      rating: "winner",
      label:
        lang === "en"
          ? "POR 3 WINNER! (OVER 3M WALL)"
          : lang === "es"
          ? "¡GANADOR POR 3! (POR EL LATERAL)"
          : "POR-3 WINNER! (ÜBER 3M-WAND)",
      tip:
        lang === "en"
          ? "Perfect Kick Smash! The bounce depth and topspin angle send the ball cleanly out over the 3-meter side wall."
          : lang === "es"
          ? "¡Remate x3 perfecto! La profundidad del bote y el efecto sacan la bola limpia por encima de los 3 metros."
          : "Perfekter Kick-Smash! Aufpralltiefe und Spin schicken den Ball sauber über die 3-Meter-Seitenwand aus dem Court.",
    };
  }

  if (pattern === "por_4") {
    return {
      rating: "winner",
      label:
        lang === "en"
          ? "POR 4 WINNER! (OVER BACK GLASS)"
          : lang === "es"
          ? "¡GANADOR POR 4! (POR EL FONDO)"
          : "POR-4 WINNER! (ÜBER RÜCKWAND)",
      tip:
        lang === "en"
          ? "Unstoppable power smash clearing the 4-meter back wall – instant point!"
          : lang === "es"
          ? "Remate imparable por encima de los 4 metros del fondo: ¡punto directo!"
          : "Unaufhaltbarer Smash direkt über die 4-Meter-Rückwand – sofortiger Punktgewinn!",
    };
  }

  if (pattern === "fence") {
    return {
      rating: "winner",
      label:
        lang === "en"
          ? "METAL FENCE HIT • HUGE PRESSURE"
          : lang === "es"
          ? "IMPACTO EN REJA • MÁXIMA PRESIÓN"
          : "GITTER-TREFFER • TOP-ANGRIFF",
      tip:
        lang === "en"
          ? "Nasty angle into the metal mesh! Unpredictable bounce makes a clean counter almost impossible."
          : lang === "es"
          ? "¡Gran ángulo a la reja! El bote irregular complica muchísimo la devolución rival."
          : "Starkes Ziel ins Metallgitter! Der unberechenbare Absprung macht einen sauberen Konter fast unmöglich.",
    };
  }

  if (shotType === "SMASH_POR3") {
    return {
      rating: "risky",
      label:
        lang === "en"
          ? "NO POR 3 • COUNTER RISK!"
          : lang === "es"
          ? "NO SALE X3 • ¡RIESGO DE CONTRA!"
          : "KEIN POR 3 • KONTER-GEFAHR!",
      tip:
        lang === "en"
          ? bounceDepth > 7.4
            ? "Bounce was too close to the back glass! Aim ~3–4m before the back wall (around Z: -6.0) so the ball rises high before hitting the glass."
            : "Bounce was too short or too central – aim slightly cross-court around Z: -6.0 to kick out over the 3m side wall."
          : lang === "es"
          ? bounceDepth > 7.4
            ? "¡Bote demasiado pegado al fondo! Apunta a ~3–4 m de la pared (Z: -6.0) para que la bola suba antes del cristal."
            : "Bote corto o muy centrado: busca un ángulo cruzado sobre Z: -6.0 para sacarla por 3."
          : bounceDepth > 7.4
          ? "Aufprall war zu nah an der Rückscheibe! Ziele ~3–4 m vor das Glas (ca. Z: -6.0), damit der Ball hoch genug an die Scheibe steigt."
          : "Aufprall war zu kurz oder zu mittig – ziele leicht diagonal auf ca. Z: -6.0, damit der Kick über die 3m-Seitenwand rausfliegt.",
    };
  }

  if (shotType === "LOB") {
    if (bounceDepth >= 6.8) {
      return {
        rating: "pressure",
        label:
          lang === "en"
            ? "DEEP LOB • NET CONQUERED"
            : lang === "es"
            ? "GLOBO PROFUNDO • RED CONQUISTADA"
            : "TIEFER LOB • NETZ EROBERT",
        tip:
          lang === "en"
            ? "Great depth! Forces opponents behind the service line so your team can take the net."
            : lang === "es"
            ? "¡Gran profundidad! Empuja al rival al fondo y te permite tomar la red."
            : "Starke Länge! Drückt den Gegner komplett an die Rückscheibe – jetzt sofort ans Netz aufrücken.",
      };
    }
    return {
      rating: "risky",
      label:
        lang === "en"
          ? "LOB TOO SHORT • SMASH DANGER"
          : lang === "es"
          ? "GLOBO CORTO • PELIGRO DE REMATE"
          : "LOB ZU KURZ • SMASH-GEFAHR",
      tip:
        lang === "en"
          ? "Short lob leaves an easy overhead smash in mid-court. Aim deeper toward the back glass!"
          : lang === "es"
          ? "Un globo corto regala un remate cómodo. ¡Busca más profundidad hacia el cristal de fondo!"
          : "Zu kurzer Lob im Halbfeld – perfekte Einladung für einen gegnerischen Smash. Ziele tiefer ans Glas!",
    };
  }

  if (pattern === "back_to_side" || pattern === "side_to_back") {
    const lowDie = sweetspot.y < 1.05;
    return {
      rating: lowDie ? "winner" : "pressure",
      label:
        lang === "en"
          ? "DOUBLE GLASS CORNER PRESSURE"
          : lang === "es"
          ? "PRESIÓN EN DOBLE PARED"
          : "DOPPELGLAS-DRUCK IN DER ECKE",
      tip:
        lang === "en"
          ? lowDie
            ? "Deadly double-glass corner! Low rebound forces a difficult defensive dig."
            : "Good double-glass angle that locks the opponent into the corner – follow up at the net."
          : lang === "es"
          ? lowDie
            ? "¡Doble pared letal! El rebote bajo obliga al rival a defender muy forzado."
            : "Buen ángulo de doble pared para encerrar al rival en el rincón y dominar en la red."
          : lowDie
          ? "Starkes Doppelglas! Der flache Rebound zwingt den Gegner tief in die Ecke ohne Konter-Chance."
          : "Guter Doppelglas-Winkel – bindet den Gegner hinten in der Ecke, haltet vorne die Mitte dicht.",
    };
  }

  if (pattern === "back_only") {
    if ((shotType === "VIBORA" || shotType === "VOLLEY" || shotType === "SLICE") && sweetspot.y < 1.0) {
      return {
        rating: "winner",
        label:
          lang === "en"
            ? "DEAD SLICE REBOUND • LETHAL"
            : lang === "es"
            ? "REBOTE BAJO CORTADO • LETAL"
            : "FLACHER SLICE-REBOUND • TOP",
        tip:
          lang === "en"
            ? "Ball dies steeply off the back glass – zero height for a counter-attack!"
            : lang === "es"
            ? "La bola muere abajo tras el cristal: imposible contraatacar."
            : "Der Ball stirbt flach an der Scheibe ab – keine Höhe für eine gegnerische Bajada!",
      };
    }

    if (sweetspot.y >= 1.22) {
      return {
        rating: "risky",
        label:
          lang === "en"
            ? "HIGH REBOUND • BAJADA RISK!"
            : lang === "es"
            ? "REBOTE ALTO • ¡PELIGRO DE BAJADA!"
            : "HOHER REBOUND • KONTER-GEFAHR!",
        tip:
          lang === "en"
            ? "Warning: Topspin kicks the ball high off the back glass – this gives the opponent an attacking Bajada. Try Víbora/Slice or aim more into the side corner!"
            : lang === "es"
            ? "Cuidado: el rebote alto del cristal regala una bajada al rival. ¡Prueba con Víbora/cortado o busca el rincón!"
            : "Achtung: Der Ball springt zu hoch aus der Rückscheibe heraus – perfektes Bajada-Fenster für den Gegner! Teste Víbora/Slice oder ziele mehr in die Ecke.",
      };
    }
  }

  return {
    rating: "neutral",
    label:
      lang === "en"
        ? "SOLID ATTACKING SHOT"
        : lang === "es"
        ? "GOLPE DE ATAQUE SÓLIDO"
        : "SOLIDER ANGRIFFSSCHLAG",
    tip:
      lang === "en"
        ? "Controlled depth. Keep the net with your partner and cover the center corridor."
        : lang === "es"
        ? "Profundidad controlada. Mantén la red con tu compañero cerrando el centro."
        : "Saubere Kontrolle – haltet gemeinsam das Netz und macht die Mitte dicht.",
  };
}

// =========================================================================
// VEREINTE 3D-PHYSIK-ENGINE FÜR ANGRIFF & VERTEIDIGUNG (INKL. POR 3 / POR 4)
// =========================================================================
export function calculateLabTrajectory(params: {
  mode: LabMode;
  startPos: { x: number; z: number };
  bouncePos: { x: number; z: number };
  shotType: LabShotType;
  lang: AppLanguage;
}): LabSimulationResult {
  const { mode, startPos, bouncePos, shotType, lang } = params;
  const isAttack = mode === "attack";
  const profile = SHOT_PROFILES[shotType];

  const pStart = new THREE.Vector3(startPos.x, profile.startY, startPos.z);

  const clampedBounceZ = isAttack
    ? Math.max(-BACK_WALL_Z + 0.2, Math.min(-0.6, bouncePos.z))
    : Math.max(0.6, Math.min(BACK_WALL_Z - 0.2, bouncePos.z));

  const pBounce = new THREE.Vector3(
    Math.max(-HALF_COURT_X + 0.15, Math.min(HALF_COURT_X - 0.15, bouncePos.x)),
    BALL_RADIUS,
    clampedBounceZ
  );

  const dx = pBounce.x - pStart.x;
  const dz = pBounce.z - pStart.z;
  const horizDist = Math.max(1.5, Math.hypot(dx, dz));

  // Flugzeit bis zum 1. Bodenkontakt (garantiert sauberes Überfliegen des 0,92m-Netzes)
  let t0 = Math.max(0.45, horizDist / profile.baseSpeed);
  if (shotType === "LOB") {
    t0 = Math.max(1.45, Math.min(1.95, horizDist / profile.baseSpeed));
  }

  let vy0 = (pBounce.y - pStart.y + 0.5 * GRAVITY * t0 * t0) / t0;

  if (Math.sign(pStart.z) !== Math.sign(pBounce.z) && pBounce.z !== pStart.z) {
    const fracNet = Math.abs(pStart.z) / Math.abs(pBounce.z - pStart.z);
    for (let guard = 0; guard < 12; guard++) {
      const tNet = t0 * fracNet;
      const yNet = pStart.y + vy0 * tNet - 0.5 * GRAVITY * tNet * tNet;
      if (yNet >= 1.12) break;
      t0 += 0.08;
      vy0 = (pBounce.y - pStart.y + 0.5 * GRAVITY * t0 * t0) / t0;
    }
  }

  const vx0 = dx / t0;
  const vz0 = dz / t0;

  const approachPoints: THREE.Vector3[] = [];
  const samples: TrajectorySample[] = [];
  const approachSteps = 36;

  for (let i = 0; i <= approachSteps; i++) {
    const frac = i / approachSteps;
    const t = frac * t0;
    const pos = new THREE.Vector3(
      pStart.x + vx0 * t,
      Math.max(BALL_RADIUS, pStart.y + vy0 * t - 0.5 * GRAVITY * t * t),
      pStart.z + vz0 * t
    );
    approachPoints.push(pos);
    samples.push({ time: t, pos, segmentKind: "approach" });
  }

  // --- PHASE 2: PHYSIK-INTEGRATOR NACH DEM 1. BODENKONTAKT ---
  let curPos = pBounce.clone();
  let vx = vx0 * profile.floorHorizKeep;
  let vz = vz0 * profile.floorHorizKeep;
  let vy = profile.floorBounceVy;

  const glassHits: GlassHit[] = [];
  const toGlassPoints: THREE.Vector3[] = [pBounce.clone()];
  const afterGlassPoints: THREE.Vector3[] = [];
  const porExitPoints: THREE.Vector3[] = [];

  let secondBounce: THREE.Vector3 | null = null;
  let exitPoint: THREE.Vector3 | null = null;
  let exitedCourt: "por_3" | "por_4" | null = null;

  const dt = 0.008;
  const maxSimTime = 2.8;
  let elapsedAfterBounce = 0;
  let sampleAccum = 0;

  const targetBackZ = isAttack ? -BACK_WALL_Z : BACK_WALL_Z;

  const postGlassCandidates: {
    pos: THREE.Vector3;
    vx: number;
    vz: number;
    score: number;
    time: number;
  }[] = [];

  while (elapsedAfterBounce < maxSimTime) {
    elapsedAfterBounce += dt;
    vy -= GRAVITY * dt;

    curPos = new THREE.Vector3(
      curPos.x + vx * dt,
      curPos.y + vy * dt,
      curPos.z + vz * dt
    );

    if (!exitedCourt) {
      // 1. Rückscheibe (Angriff: z <= -9.92 | Verteidigung: z >= +9.92)
      const hitBackWall = isAttack
        ? curPos.z <= targetBackZ && vz < 0
        : curPos.z >= targetBackZ && vz > 0;

      if (hitBackWall) {
        curPos.z = targetBackZ;
        const hitPos = curPos.clone();
        const totalTime = t0 + elapsedAfterBounce;

        // POR 4: Ball fliegt über die 4m hohe Rückscheibe aus dem Court!
        if (hitPos.y > BACK_WALL_EXIT_HEIGHT) {
          exitedCourt = "por_4";
          exitPoint = hitPos;
          if (glassHits.length === 0) toGlassPoints.push(hitPos);
          else afterGlassPoints.push(hitPos);
          porExitPoints.push(hitPos);
          samples.push({ time: totalTime, pos: hitPos, segmentKind: "por_exit" });
          sampleAccum = 0;
          continue;
        }

        if (glassHits.length === 0) {
          toGlassPoints.push(hitPos);
          afterGlassPoints.push(hitPos);
        } else {
          afterGlassPoints.push(hitPos);
        }

        glassHits.push({
          point: hitPos,
          wall: "back",
          isMesh: false,
          time: totalTime,
        });

        vz = (isAttack ? 1 : -1) * Math.abs(vz) * profile.glassHorizRest;
        const sideKick = profile.backGlassSideKick || 0;
        const kickDir = Math.abs(vx) > 0.35 ? Math.sign(vx) : curPos.x >= 0 ? 1 : -1;
        vx = vx * profile.glassTangentialKeep + kickDir * sideKick;
        vy = Math.max(-2.6, Math.min(7.2, vy * profile.glassVyFactor + profile.glassVySpinKick));

        samples.push({ time: totalTime, pos: hitPos, segmentKind: "after_glass" });
        sampleAccum = 0;
      }

      // 2. Rechte oder linke Seitenwand (|x| >= 4.92)
      if (Math.abs(curPos.x) >= HALF_COURT_X && Math.sign(vx) === Math.sign(curPos.x)) {
        const hitRight = curPos.x > 0;
        curPos.x = hitRight ? HALF_COURT_X : -HALF_COURT_X;
        const hitPos = curPos.clone();
        const totalTime = t0 + elapsedAfterBounce;

        // POR 3: Ball überfliegt die 3-Meter-Seitenwand!
        if (hitPos.y > SIDE_WALL_EXIT_HEIGHT) {
          exitedCourt = "por_3";
          exitPoint = hitPos;
          if (glassHits.length === 0) toGlassPoints.push(hitPos);
          else afterGlassPoints.push(hitPos);
          porExitPoints.push(hitPos);
          samples.push({ time: totalTime, pos: hitPos, segmentKind: "por_exit" });
          sampleAccum = 0;
          continue;
        }

        const isMesh = Math.abs(curPos.z) < 5.5;

        if (glassHits.length === 0) {
          toGlassPoints.push(hitPos);
          afterGlassPoints.push(hitPos);
        } else {
          afterGlassPoints.push(hitPos);
        }

        glassHits.push({
          point: hitPos,
          wall: hitRight ? "side_right" : "side_left",
          isMesh,
          time: totalTime,
        });

        const sideRest = isMesh ? 0.45 : profile.glassHorizRest;
        vx = -Math.sign(curPos.x) * Math.abs(vx) * sideRest;
        vz = vz * (isMesh ? 0.72 : profile.glassTangentialKeep);
        vy = Math.max(
          -2.4,
          Math.min(4.6, vy * profile.glassVyFactor + (isMesh ? -0.8 : profile.glassVySpinKick * 0.6))
        );

        samples.push({ time: totalTime, pos: hitPos, segmentKind: "after_glass" });
        sampleAccum = 0;
      }
    }

    // 3. Zweiter Bodenkontakt (oder Auslauf außerhalb des Courts nach Por 3/4)
    const outsideBounds =
      exitedCourt !== null && (Math.abs(curPos.x) > 8.6 || Math.abs(curPos.z) > 13.0);

    if ((curPos.y <= BALL_RADIUS && vy < 0) || outsideBounds) {
      curPos.y = Math.max(BALL_RADIUS, curPos.y);
      secondBounce = curPos.clone();
      const totalTime = t0 + elapsedAfterBounce;

      if (exitedCourt) {
        porExitPoints.push(secondBounce);
      } else if (glassHits.length === 0) {
        toGlassPoints.push(secondBounce);
      } else {
        afterGlassPoints.push(secondBounce);
      }

      samples.push({
        time: totalTime,
        pos: secondBounce,
        segmentKind: exitedCourt
          ? "por_exit"
          : glassHits.length === 0
          ? "to_glass"
          : "after_glass",
      });
      break;
    }

    // Sweetspot-Kandidaten nach Glas-Kontakt (innerhalb des Courts)
    if (!exitedCourt && glassHits.length > 0 && curPos.y >= 0.35 && curPos.y <= 2.4) {
      const distFromBack = BACK_WALL_Z - Math.abs(curPos.z);
      const distFromSide = HALF_COURT_X - Math.abs(curPos.x);
      const minClearance = Math.min(distFromBack, distFromSide);
      const preferredY =
        shotType === "TOPSPIN" || shotType === "BAJADA" || shotType === "LOB" ? 1.35 : 0.92;
      const heightScore = 1 - Math.min(1, Math.abs(curPos.y - preferredY) / 1.2);
      const clearanceScore = Math.min(1, minClearance / 1.3);
      const score = heightScore * 0.6 + clearanceScore * 0.4;

      postGlassCandidates.push({
        pos: curPos.clone(),
        vx,
        vz,
        score,
        time: t0 + elapsedAfterBounce,
      });
    }

    sampleAccum += dt;
    if (sampleAccum >= 0.024) {
      sampleAccum = 0;
      const pt = curPos.clone();
      if (exitedCourt) {
        porExitPoints.push(pt);
        samples.push({ time: t0 + elapsedAfterBounce, pos: pt, segmentKind: "por_exit" });
      } else if (glassHits.length === 0) {
        toGlassPoints.push(pt);
        samples.push({ time: t0 + elapsedAfterBounce, pos: pt, segmentKind: "to_glass" });
      } else {
        afterGlassPoints.push(pt);
        samples.push({ time: t0 + elapsedAfterBounce, pos: pt, segmentKind: "after_glass" });
      }
    }
  }

  const totalDuration = samples[samples.length - 1]?.time || t0 + 1.0;

  // Muster erkennen
  let pattern: GlassPattern = "no_glass";
  if (exitedCourt === "por_3") {
    pattern = "por_3";
  } else if (exitedCourt === "por_4") {
    pattern = "por_4";
  } else if (glassHits.some((h) => h.isMesh)) {
    pattern = "fence";
  } else if (glassHits.length >= 2) {
    const first = glassHits[0].wall;
    const second = glassHits[1].wall;
    if (first === "back" && second !== "back") pattern = "back_to_side";
    else if (first !== "back" && second === "back") pattern = "side_to_back";
    else pattern = first === "back" ? "back_only" : "side_only";
  } else if (glassHits.length === 1) {
    pattern = glassHits[0].wall === "back" ? "back_only" : "side_only";
  }

  // Optimalen Treffpunkt (Sweetspot) & Standzone ermitteln
  const lastGlassTime = glassHits.length > 0 ? glassHits[glassHits.length - 1].time : 0;
  const afterLastGlass = postGlassCandidates.filter((c) => c.time >= lastGlassTime + 0.06);
  const candidatePool = afterLastGlass.length > 0 ? afterLastGlass : postGlassCandidates;

  let sweetspot: THREE.Vector3;
  let optimalStandPos: THREE.Vector3;

  if (exitPoint) {
    sweetspot = exitPoint.clone();
    optimalStandPos = new THREE.Vector3(exitPoint.x, 0.04, exitPoint.z);
  } else if (candidatePool.length > 0) {
    const best = candidatePool.reduce((a, b) => (b.score > a.score ? b : a));
    sweetspot = best.pos.clone();

    const dirToCenterX = sweetspot.x >= 0 ? -1 : 1;
    const standX = Math.max(-4.35, Math.min(4.35, sweetspot.x + dirToCenterX * 0.85));
    const standZ = isAttack
      ? Math.max(-9.1, Math.min(-1.2, sweetspot.z + (best.vz > 1 ? -0.55 : 0.45)))
      : Math.max(1.2, Math.min(9.1, sweetspot.z + (best.vz < -1 ? 0.55 : -0.45)));
    optimalStandPos = new THREE.Vector3(standX, 0.04, standZ);
  } else {
    const midIdx = Math.min(toGlassPoints.length - 1, Math.floor(toGlassPoints.length * 0.45));
    sweetspot = (toGlassPoints[midIdx] || pBounce).clone();
    sweetspot.y = Math.max(0.65, sweetspot.y);
    const standZ = isAttack
      ? Math.max(-9.1, Math.min(-1.2, sweetspot.z - 0.7))
      : Math.max(1.2, Math.min(9.1, sweetspot.z + 0.7));
    optimalStandPos = new THREE.Vector3(
      Math.max(-4.35, Math.min(4.35, sweetspot.x + (sweetspot.x >= 0 ? -0.7 : 0.7))),
      0.04,
      standZ
    );
  }

  const isBajadaWindow =
    pattern === "back_only" &&
    sweetspot.y >= 1.15 &&
    (shotType === "TOPSPIN" || shotType === "BAJADA" || shotType === "LOB");

  let patternLabel: string;
  let coachTip: string;
  let attackRating: AttackRating | undefined;

  if (isAttack) {
    const atkEval = getAttackEvaluation(pattern, shotType, pBounce, sweetspot, lang);
    patternLabel = atkEval.label;
    coachTip = atkEval.tip;
    attackRating = atkEval.rating;
  } else {
    const defText = getDefensePatternText(pattern, shotType, isBajadaWindow, lang);
    patternLabel = defText.label;
    coachTip = defText.tip;
  }

  const segments: TrajectorySegment[] = [
    {
      kind: "approach",
      points: approachPoints,
      startTime: 0,
      endTime: t0,
    },
  ];

  if (toGlassPoints.length >= 2) {
    segments.push({
      kind: "to_glass",
      points: toGlassPoints,
      startTime: t0,
      endTime: glassHits.length > 0 ? glassHits[0].time : totalDuration,
    });
  }

  if (afterGlassPoints.length >= 2) {
    segments.push({
      kind: "after_glass",
      points: afterGlassPoints,
      startTime: glassHits[0]?.time || t0,
      endTime: exitPoint ? samples.find((s) => s.segmentKind === "por_exit")?.time || totalDuration : totalDuration,
    });
  }

  if (porExitPoints.length >= 2) {
    segments.push({
      kind: "por_exit",
      points: porExitPoints,
      startTime: samples.find((s) => s.segmentKind === "por_exit")?.time || totalDuration,
      endTime: totalDuration,
    });
  }

  return {
    mode,
    shotType,
    segments,
    samples,
    totalDuration,
    firstBounce: pBounce,
    secondBounce,
    glassHits,
    exitPoint,
    exitedCourt,
    sweetspot,
    optimalStandPos,
    pattern,
    patternLabel,
    coachTip,
    isBajadaWindow,
    attackRating,
  };
}

// Bewertet im Verteidigungs-Stellungs-Test, ob deine rote Figur optimal zum Rebound steht
export function evaluatePlayerDefensePosition(
  playerPos: { x: number; z: number },
  sim: LabSimulationResult,
  lang: AppLanguage
): DefensePositionEval {
  const playerVec = new THREE.Vector3(playerPos.x, 0.04, playerPos.z);
  const distance = playerVec.distanceTo(sim.optimalStandPos);

  let isJammed = false;
  if (sim.glassHits.length > 0) {
    const toGlassSeg = sim.segments.find((s) => s.kind === "to_glass");
    if (toGlassSeg) {
      isJammed = toGlassSeg.points.some((pt) => {
        const d2D = Math.hypot(pt.x - playerPos.x, pt.z - playerPos.z);
        return d2D < 0.62;
      });
    }
    const distToSweetspot2D = Math.hypot(
      sim.sweetspot.x - playerPos.x,
      sim.sweetspot.z - playerPos.z
    );
    if (distToSweetspot2D < 0.42) {
      isJammed = true;
    }
  }

  if (isJammed) {
    return {
      status: "jammed",
      distance: Number(distance.toFixed(2)),
      message:
        lang === "en"
          ? "Jammed! You are standing in the ball's rebound path – give the glass more space."
          : lang === "es"
          ? "¡Encerrado! Estás en la trayectoria del rebote: dale más espacio al cristal."
          : "Eingeklemmt! Du stehst direkt im Weg des Scheiben-Abprallers – lass dem Ball mehr Platz!",
    };
  }

  if (distance <= 1.25) {
    return {
      status: "perfect",
      distance: Number(distance.toFixed(2)),
      message:
        lang === "en"
          ? "Perfect positioning! Ideal distance to read the glass and swing cleanly."
          : lang === "es"
          ? "¡Posición perfecta! Distancia ideal para leer el cristal y golpear cómodo."
          : "Perfekt gestellt! Idealer Abstand zur Scheibe – du kannst sauber durchschwingen.",
    };
  }

  if (distance <= 2.35) {
    return {
      status: "playable",
      distance: Number(distance.toFixed(2)),
      message:
        lang === "en"
          ? "Playable – shift ~1 step closer to the green ring for an effortless strike."
          : lang === "es"
          ? "Jugable: ajusta un paso hacia el aro verde para golpear más cómodo."
          : "Spielbar – noch ein Schritt Richtung grüner Standzone, dann triffst du ihn mühelos.",
    };
  }

  return {
    status: "too_far",
    distance: Number(distance.toFixed(2)),
    message:
      lang === "en"
        ? "Too far from the rebound – follow the green stand zone after the glass bounce."
        : lang === "es"
        ? "Demasiado lejos del rebote: colócate junto a la zona verde tras el cristal."
        : "Zu weit vom Abpraller entfernt – orientiere dich an der grünen Standzone nach der Scheibe.",
  };
}

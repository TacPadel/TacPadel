import * as THREE from "three";
import { AppLanguage } from "./i18n";

export type DefenseShotType = "SLICE" | "FLAT" | "TOPSPIN" | "LOB";

export type GlassPattern =
  | "no_glass"
  | "back_only"
  | "side_only"
  | "back_to_side"
  | "side_to_back"
  | "fence";

export interface GlassHit {
  point: THREE.Vector3;
  wall: "back" | "side_left" | "side_right";
  isMesh: boolean;
  time: number;
}

export interface TrajectorySegment {
  kind: "approach" | "to_glass" | "after_glass";
  points: THREE.Vector3[];
  startTime: number;
  endTime: number;
}

export interface TrajectorySample {
  time: number;
  pos: THREE.Vector3;
  segmentKind: TrajectorySegment["kind"];
}

export interface DefenseSimulationResult {
  segments: TrajectorySegment[];
  samples: TrajectorySample[];
  totalDuration: number;
  firstBounce: THREE.Vector3;
  secondBounce: THREE.Vector3 | null;
  glassHits: GlassHit[];
  sweetspot: THREE.Vector3;
  optimalStandPos: THREE.Vector3;
  pattern: GlassPattern;
  patternLabel: string;
  coachTip: string;
  isBajadaWindow: boolean;
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

// 4 klassische Scheibenspiel-Situationen als 1-Klick-Presets für das 3D-Radar
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

interface ShotPhysicsProfile {
  startY: number;
  baseSpeed: number;
  floorHorizKeep: number;
  floorBounceVy: number;
  glassHorizRest: number;
  glassTangentialKeep: number;
  glassVyFactor: number;
  glassVySpinKick: number;
}

const SHOT_PROFILES: Record<DefenseShotType, ShotPhysicsProfile> = {
  SLICE: {
    startY: 1.55,
    baseSpeed: 12.2,
    floorHorizKeep: 0.88,
    floorBounceVy: 2.55,
    glassHorizRest: 0.50,
    glassTangentialKeep: 0.82,
    glassVyFactor: 0.25,
    glassVySpinKick: -1.45, // Unterschnitt zieht den Ball an der Scheibe nach unten
  },
  FLAT: {
    startY: 1.45,
    baseSpeed: 11.4,
    floorHorizKeep: 0.86,
    floorBounceVy: 4.15,
    glassHorizRest: 0.74,
    glassTangentialKeep: 0.88,
    glassVyFactor: 0.65,
    glassVySpinKick: 0.0, // Sauberer Einfallswinkel = Ausfallswinkel
  },
  TOPSPIN: {
    startY: 1.85,
    baseSpeed: 10.6,
    floorHorizKeep: 0.90,
    floorBounceVy: 5.45,
    glassHorizRest: 0.86,
    glassTangentialKeep: 0.90,
    glassVyFactor: 0.72,
    glassVySpinKick: 1.65, // Topspin drückt den Ball hoch & weit aus der Scheibe
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
};

function getPatternText(
  pattern: GlassPattern,
  shotType: DefenseShotType,
  isBajadaWindow: boolean,
  lang: AppLanguage
): { label: string; tip: string } {
  if (lang === "en") {
    if (pattern === "fence") {
      return {
        label: "SIDE MESH / FENCE",
        tip: "Ball hits the metal fence (front side) – bounces unpredictably. Stay low, compact grip, react late.",
      };
    }
    if (pattern === "double_back_side" || pattern === "back_to_side") {
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
      if (shotType === "SLICE") {
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
      if (shotType === "SLICE") {
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
    if (shotType === "SLICE") {
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

// Berechnet die vollständige 3D-Verteidigungs-Flugbahn inkl. Spin, Doppelglas & optimalem Treffpunkt
export function calculateGlassDefenseTrajectory(
  oppPos: { x: number; z: number },
  bouncePos: { x: number; z: number },
  shotType: DefenseShotType,
  lang: AppLanguage
): DefenseSimulationResult {
  const profile = SHOT_PROFILES[shotType];
  const pStart = new THREE.Vector3(oppPos.x, profile.startY, oppPos.z);
  const pBounce = new THREE.Vector3(
    Math.max(-HALF_COURT_X + 0.15, Math.min(HALF_COURT_X - 0.15, bouncePos.x)),
    BALL_RADIUS,
    Math.max(0.6, Math.min(BACK_WALL_Z - 0.2, bouncePos.z))
  );

  const dx = pBounce.x - pStart.x;
  const dz = pBounce.z - pStart.z;
  const horizDist = Math.max(1.5, Math.hypot(dx, dz));

  // Flugzeit bis zum 1. Bodenkontakt (inkl. Garantie, dass der Ball sauber über das 0,92m-Netz fliegt)
  let t0 = Math.max(0.55, horizDist / profile.baseSpeed);
  if (shotType === "LOB") {
    t0 = Math.max(1.45, Math.min(1.95, horizDist / profile.baseSpeed));
  }

  let vy0 = (pBounce.y - pStart.y + 0.5 * GRAVITY * t0 * t0) / t0;

  if (pStart.z < 0 && pBounce.z > 0) {
    const fracNet = Math.abs(pStart.z) / (pBounce.z - pStart.z);
    for (let guard = 0; guard < 10; guard++) {
      const tNet = t0 * fracNet;
      const yNet = pStart.y + vy0 * tNet - 0.5 * GRAVITY * tNet * tNet;
      if (yNet >= 1.12) break;
      t0 += 0.1;
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

  let secondBounce: THREE.Vector3 | null = null;
  const dt = 0.008;
  const maxSimTime = 2.6;
  let elapsedAfterBounce = 0;
  let sampleAccum = 0;

  // Kandidaten für den optimalen Treffpunkt (Sweetspot) sammeln
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

    // 1. Rückscheibe (z >= +9.92)
    if (curPos.z >= BACK_WALL_Z && vz > 0) {
      curPos.z = BACK_WALL_Z;
      const hitPos = curPos.clone();
      const totalTime = t0 + elapsedAfterBounce;

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

      vz = -Math.abs(vz) * profile.glassHorizRest;
      vx = vx * profile.glassTangentialKeep;
      vy = Math.max(-2.6, Math.min(4.8, vy * profile.glassVyFactor + profile.glassVySpinKick));

      samples.push({ time: totalTime, pos: hitPos, segmentKind: "after_glass" });
      sampleAccum = 0;
    }

    // 2. Rechte oder linke Seitenwand (|x| >= 4.92)
    if (Math.abs(curPos.x) >= HALF_COURT_X && Math.sign(vx) === Math.sign(curPos.x)) {
      const hitRight = curPos.x > 0;
      curPos.x = hitRight ? HALF_COURT_X : -HALF_COURT_X;
      const hitPos = curPos.clone();
      const totalTime = t0 + elapsedAfterBounce;
      const isMesh = curPos.z < 4.0; // Vor den hinteren 6m (4m Vollglas + 2m Stufe) beginnt das Gitter

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
        Math.min(4.2, vy * profile.glassVyFactor + (isMesh ? -0.8 : profile.glassVySpinKick * 0.6))
      );

      samples.push({ time: totalTime, pos: hitPos, segmentKind: "after_glass" });
      sampleAccum = 0;
    }

    // 3. Zweiter Bodenkontakt -> spielbares Fenster endet hier
    if (curPos.y <= BALL_RADIUS && vy < 0) {
      curPos.y = BALL_RADIUS;
      secondBounce = curPos.clone();
      const totalTime = t0 + elapsedAfterBounce;

      if (glassHits.length === 0) {
        toGlassPoints.push(secondBounce);
      } else {
        afterGlassPoints.push(secondBounce);
      }
      samples.push({
        time: totalTime,
        pos: secondBounce,
        segmentKind: glassHits.length === 0 ? "to_glass" : "after_glass",
      });
      break;
    }

    // Sweetspot-Bewertung (sobald der Ball die letzte relevante Scheibe verlassen hat)
    if (glassHits.length > 0 && curPos.y >= 0.35 && curPos.y <= 2.2) {
      const distFromBack = BACK_WALL_Z - curPos.z;
      const distFromSide = HALF_COURT_X - Math.abs(curPos.x);
      const minClearance = Math.min(distFromBack, distFromSide);
      const preferredY = shotType === "TOPSPIN" || shotType === "LOB" ? 1.35 : 0.92;
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
      if (glassHits.length === 0) {
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
  if (glassHits.some((h) => h.isMesh)) {
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

  // Optimalen Treffpunkt (Sweetspot) & optimale Standposition ermitteln
  const lastGlassTime = glassHits.length > 0 ? glassHits[glassHits.length - 1].time : 0;
  const afterLastGlass = postGlassCandidates.filter((c) => c.time >= lastGlassTime + 0.06);
  const candidatePool = afterLastGlass.length > 0 ? afterLastGlass : postGlassCandidates;

  let sweetspot: THREE.Vector3;
  let optimalStandPos: THREE.Vector3;

  if (candidatePool.length > 0) {
    const best = candidatePool.reduce((a, b) => (b.score > a.score ? b : a));
    sweetspot = best.pos.clone();

    // Spieler steht seitlich/leicht dahinter (Richtung Mitte/Netz), damit er frei durchschwingen kann
    const dirToCenterX = sweetspot.x >= 0 ? -1 : 1;
    const standX = Math.max(-4.35, Math.min(4.35, sweetspot.x + dirToCenterX * 0.85));
    const standZ = Math.max(1.2, Math.min(9.1, sweetspot.z + (best.vz < -1 ? 0.55 : -0.45)));
    optimalStandPos = new THREE.Vector3(standX, 0.04, standZ);
  } else {
    // Kein Glaskontakt -> optimaler Treffpunkt kurz nach dem 1. Aufprall
    const midIdx = Math.min(toGlassPoints.length - 1, Math.floor(toGlassPoints.length * 0.45));
    sweetspot = (toGlassPoints[midIdx] || pBounce).clone();
    sweetspot.y = Math.max(0.65, sweetspot.y);
    optimalStandPos = new THREE.Vector3(
      Math.max(-4.35, Math.min(4.35, sweetspot.x + (sweetspot.x >= 0 ? -0.7 : 0.7))),
      0.04,
      Math.max(1.2, Math.min(9.1, sweetspot.z + 0.7))
    );
  }

  const isBajadaWindow =
    pattern === "back_only" &&
    sweetspot.y >= 1.15 &&
    (shotType === "TOPSPIN" || shotType === "LOB");

  const { label: patternLabel, tip: coachTip } = getPatternText(
    pattern,
    shotType,
    isBajadaWindow,
    lang
  );

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
      endTime: totalDuration,
    });
  }

  return {
    segments,
    samples,
    totalDuration,
    firstBounce: pBounce,
    secondBounce,
    glassHits,
    sweetspot,
    optimalStandPos,
    pattern,
    patternLabel,
    coachTip,
    isBajadaWindow,
  };
}

// Bewertet im optionalen Stellungs-Test, ob deine rote Figur optimal zum Rebound steht
export function evaluatePlayerDefensePosition(
  playerPos: { x: number; z: number },
  sim: DefenseSimulationResult,
  lang: AppLanguage
): DefensePositionEval {
  const playerVec = new THREE.Vector3(playerPos.x, 0.04, playerPos.z);
  const distance = playerVec.distanceTo(sim.optimalStandPos);

  // Prüfen, ob sich der Spieler direkt zwischen Boden-Aufprall und Scheibe eingeklemmt hat
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

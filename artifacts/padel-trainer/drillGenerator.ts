import { AppLanguage } from "./i18n";
import {
  BOARD_V_WIDTH,
  BOARD_V_HEIGHT,
  DrillDepth,
  PlaybookDraggableItem,
  PlaybookStudioDrawing,
  SavedPlay,
} from "./playbook";

export interface GeneratedDrill {
  id: string;
  source: "standard" | "playbook";
  title: string;
  prompt: string;
  explanation: string;
  targetDepth: DrillDepth;
  startItems: PlaybookDraggableItem[];
  solutionItems?: PlaybookDraggableItem[];
  solutionDrawings?: PlaybookStudioDrawing[];
  isMirrored?: boolean;
}

export interface SmartDrillMeta {
  prompt: string;
  explanation: string;
  targetDepth: DrillDepth;
}

const V_WIDTH = BOARD_V_WIDTH;
const V_HEIGHT = BOARD_V_HEIGHT;
const NET_X = V_WIDTH / 2;

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(val)));

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const cloneItems = (list: PlaybookDraggableItem[]): PlaybookDraggableItem[] =>
  list.map((i) => ({ ...i }));

const cloneDrawings = (list: PlaybookStudioDrawing[] = []): PlaybookStudioDrawing[] =>
  list.map((d) => ({ ...d }));

const isBallArrow = (type: PlaybookStudioDrawing["type"]) =>
  type === "arrow_ball" || type === "arrow_lob" || type === "arrow_glass";

// Verschiebt Figuren & Ball anhand der Pfeile eines Schritts (für Musterlösungen)
function deriveItemsFromDrawings(
  baseItems: PlaybookDraggableItem[],
  stepDrawings: PlaybookStudioDrawing[]
): PlaybookDraggableItem[] {
  const next = cloneItems(baseItems);

  stepDrawings.forEach((d) => {
    if (d.type === "zone_circle") return;

    let targetId = d.linkedItemId;
    if (!targetId) {
      if (isBallArrow(d.type)) {
        targetId = "ball";
      } else if (d.type === "arrow_run") {
        let bestId: string | undefined;
        let bestDist = 75;
        baseItems
          .filter((i) => i.isPlayer)
          .forEach((p) => {
            const dist = Math.hypot(p.x - d.x1, p.y - d.y1);
            if (dist < bestDist) {
              bestDist = dist;
              bestId = p.id;
            }
          });
        targetId = bestId;
      }
    }

    if (!targetId) return;
    const item = next.find((i) => i.id === targetId);
    if (!item) return;

    let destX = clamp(d.x2, 16, V_WIDTH - 16);
    const destY = clamp(d.y2, 16, V_HEIGHT - 16);

    if (item.id.startsWith("a")) {
      destX = Math.min(NET_X - 15, destX);
    } else if (item.id.startsWith("b") && item.id !== "ball") {
      destX = Math.max(NET_X + 15, destX);
    }

    item.x = destX;
    item.y = destY;
  });

  return next;
}

function hasTeamAMoved(
  a: PlaybookDraggableItem[],
  b: PlaybookDraggableItem[]
): boolean {
  return ["a1", "a2"].some((id) => {
    const p1 = a.find((i) => i.id === id);
    const p2 = b.find((i) => i.id === id);
    if (!p1 || !p2) return false;
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) > 15;
  });
}

// Spiegelt das komplette Feld sauber an der Längsachse und hält A1/B1 links, A2/B2 rechts
export function mirrorItemsVertically(
  items: PlaybookDraggableItem[]
): PlaybookDraggableItem[] {
  const a1 = items.find((i) => i.id === "a1");
  const a2 = items.find((i) => i.id === "a2");
  const b1 = items.find((i) => i.id === "b1");
  const b2 = items.find((i) => i.id === "b2");
  const ball = items.find((i) => i.id === "ball");

  return items.map((item) => {
    if (item.id === "a1" && a2) {
      return { ...item, x: a2.x, y: clamp(V_HEIGHT - a2.y, 20, V_HEIGHT - 20) };
    }
    if (item.id === "a2" && a1) {
      return { ...item, x: a1.x, y: clamp(V_HEIGHT - a1.y, 20, V_HEIGHT - 20) };
    }
    if (item.id === "b1" && b2) {
      return { ...item, x: b2.x, y: clamp(V_HEIGHT - b2.y, 20, V_HEIGHT - 20) };
    }
    if (item.id === "b2" && b1) {
      return { ...item, x: b1.x, y: clamp(V_HEIGHT - b1.y, 20, V_HEIGHT - 20) };
    }
    if (item.id === "ball" && ball) {
      return { ...item, y: clamp(V_HEIGHT - ball.y, 20, V_HEIGHT - 20) };
    }
    return { ...item, y: clamp(V_HEIGHT - item.y, 20, V_HEIGHT - 20) };
  });
}

// Erzeugt realistische, bewusst fehlerhafte Startpositionen für A1 & A2 (nie schon gelöst)
export function scrambleTeamA(
  baseItems: PlaybookDraggableItem[],
  targetDepth: DrillDepth,
  patternOverride?: number
): PlaybookDraggableItem[] {
  const next = cloneItems(baseItems);
  const a1 = next.find((i) => i.id === "a1");
  const a2 = next.find((i) => i.id === "a2");
  const ball = next.find((i) => i.id === "ball");
  if (!a1 || !a2) return next;

  const pattern = patternOverride !== undefined ? patternOverride % 4 : rand(0, 3);
  const ballOnLeft = (ball?.y ?? V_HEIGHT / 2) < V_HEIGHT / 2;

  if (pattern === 0) {
    // Typischer Fehler 1: Tiefen-Riss (einer vorne, einer hinten) + breite Lücke
    const a1Forward = Math.random() < 0.5;
    a1.x = a1Forward ? rand(255, 315) : rand(65, 115);
    a2.x = a1Forward ? rand(65, 115) : rand(255, 315);
    a1.y = rand(48, 100);
    a2.y = rand(280, 332);
  } else if (pattern === 1) {
    // Typischer Fehler 2: Offene Mitte + falsche Tiefe
    const wrongX =
      targetDepth === "net"
        ? rand(80, 145)
        : targetDepth === "back"
        ? rand(215, 275)
        : Math.random() < 0.5
        ? rand(60, 95)
        : rand(290, 325);
    a1.x = clamp(wrongX + rand(-18, 18), 55, 330);
    a2.x = clamp(wrongX + rand(-18, 18), 55, 330);
    a1.y = rand(34, 62);
    a2.y = rand(318, 346);
  } else if (pattern === 2) {
    // Typischer Fehler 3: Falsche Seite (weg vom Ball verschoben) + falscher Tiefenbereich
    const wrongBaseX =
      targetDepth === "net"
        ? rand(75, 125)
        : targetDepth === "back"
        ? rand(235, 295)
        : rand(70, 110);
    a1.x = wrongBaseX;
    a2.x = clamp(wrongBaseX + rand(55, 95) * (Math.random() < 0.5 ? 1 : -1), 55, 330);
    if (ballOnLeft) {
      a1.y = rand(185, 225);
      a2.y = rand(310, 345);
    } else {
      a1.y = rand(35, 70);
      a2.y = rand(155, 195);
    }
  } else {
    // Typischer Fehler 4: Niemandsland + diagonale Fehlstellung
    a1.x = targetDepth === "net" ? rand(110, 165) : rand(195, 245);
    a2.x = targetDepth === "net" ? rand(185, 235) : rand(95, 145);
    a1.y = rand(42, 85);
    a2.y = rand(295, 338);
  }

  return next;
}

type SideLabel = "left" | "center" | "right";

function detectSide(y: number): SideLabel {
  if (y < 140) return "left";
  if (y > 240) return "right";
  return "center";
}

function getSideText(side: SideLabel, lang: AppLanguage): string {
  if (lang === "en") {
    return side === "left" ? "left corner" : side === "right" ? "right corner" : "center";
  }
  if (lang === "es") {
    return side === "left" ? "esquina izquierda" : side === "right" ? "esquina derecha" : "centro";
  }
  return side === "left" ? "linken Ecke" : side === "right" ? "rechten Ecke" : "Mitte";
}

// =========================================================================
// 1. DYNAMISCHE STANDARD-DRILLS (GLEICHES ZIEL, IMMER FRISCH GEMISCHT)
// =========================================================================
export const STANDARD_DRILL_IDS = [
  "drill_rubberband_defense",
  "drill_net_shift_right",
  "drill_bandeja_block",
  "drill_after_lob_take_net",
] as const;

export type StandardDrillId = (typeof STANDARD_DRILL_IDS)[number];

export function generateStandardDrill(
  drillId: StandardDrillId,
  lang: AppLanguage
): GeneratedDrill {
  const mirror = Math.random() < 0.5;

  if (drillId === "drill_rubberband_defense") {
    const b1X = rand(435, 485);
    const b2X = clamp(b1X + rand(-25, 25), 435, 505);
    const ballOnB1 = !mirror;
    const b1Y = rand(65, 130);
    const b2Y = rand(245, 315);
    const ballX = (ballOnB1 ? b1X : b2X) - rand(6, 16);
    const ballY = clamp((ballOnB1 ? b1Y : b2Y) + rand(-14, 14), 45, V_HEIGHT - 45);
    const sideText = getSideText(detectSide(ballY), lang);

    const base: PlaybookDraggableItem[] = [
      { id: "a1", x: 100, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 100, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: b1X, y: b1Y, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: b2X, y: b2Y, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: ballX, y: ballY, color: "#2ecc71", label: "●", isPlayer: false },
    ];

    const startItems = scrambleTeamA(base, "back");

    const title =
      lang === "en"
        ? "Close the Rubberband (Defense)"
        : lang === "es"
        ? "Cerrar la Goma (Defensa)"
        : "Gummiband schließen (Defensive)";

    const prompt =
      lang === "en"
        ? `Opponents attack at the net from the ${sideText}. Move A1 & A2 back together, close the middle gap and align with the angle cone.`
        : lang === "es"
        ? `Los rivales atacan en la red desde la ${sideText}. Coloca a A1 y A2 juntos atrás, cierra el centro y cubre el cono de ángulo.`
        : `Die Gegner greifen am Netz aus der ${sideText} an. Ziehe A1 & A2 geschlossen nach hinten, schließe die Mitte und decke den Winkel.`;

    const explanation =
      lang === "en"
        ? "When opponents dominate the net, both defenders must drop back in sync – no depth split and no open middle lane."
        : lang === "es"
        ? "Cuando el rival domina la red, ambos defensores bajan sincronizados: sin ruptura en profundidad ni hueco central."
        : "Greift der Gegner am Netz an, verteidigt ihr auf einer Linie hinter der Aufschlaglinie – ohne Tiefen-Riss und ohne offene Mitte.";

    return {
      id: drillId,
      source: "standard",
      title,
      prompt,
      explanation,
      targetDepth: "back",
      startItems,
      isMirrored: mirror,
    };
  }

  if (drillId === "drill_net_shift_right") {
    const b1X = rand(640, 705);
    const b2X = rand(640, 705);
    const b1Y = rand(70, 140);
    const b2Y = rand(245, 320);
    const ballOnRight = !mirror;
    const ballY = ballOnRight ? clamp(b2Y + rand(-10, 16), 255, 340) : clamp(b1Y + rand(-16, 10), 40, 125);
    const ballX = (ballOnRight ? b2X : b1X) - rand(5, 16);
    const sideText = getSideText(detectSide(ballY), lang);

    const base: PlaybookDraggableItem[] = [
      { id: "a1", x: 270, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 270, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: b1X, y: b1Y, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: b2X, y: b2Y, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: ballX, y: ballY, color: "#2ecc71", label: "●", isPlayer: false },
    ];

    const startItems = scrambleTeamA(base, "net");

    const title =
      lang === "en"
        ? "Net Shift to the Ball"
        : lang === "es"
        ? "Basculación en Red hacia la Bola"
        : "Netz-Verschieben zum Ball";

    const prompt =
      lang === "en"
        ? `Opponents defend deep from the ${sideText}. Move A1 & A2 up to the net together and shift toward the ball to lock down the angles.`
        : lang === "es"
        ? `Los rivales defienden desde la ${sideText}. Sube con A1 y A2 a la red y bascula hacia la bola para cerrar la paralela y el centro.`
        : `Der Gegner spielt aus der ${sideText} tief hinten. Rücke mit A1 & A2 geschlossen ans Netz vor und verschiebe zum Ball, um Longline & Mitte zu schließen.`;

    const explanation =
      lang === "en"
        ? "Windshield-wiper rule at the net: the ball-side player covers the line, the partner slides to the middle – always as one unit."
        : lang === "es"
        ? "Regla del parabrisas en red: quien está en el lado de la bola cubre el paralelo y su compañero cierra el centro."
        : "Scheibenwischer-Prinzip am Netz: Der ballnahe Spieler deckt die Linie ab, der Partner schiebt in die Mitte nach – immer als geschlossene Einheit.";

    return {
      id: drillId,
      source: "standard",
      title,
      prompt,
      explanation,
      targetDepth: "net",
      startItems,
      isMirrored: mirror,
    };
  }

  if (drillId === "drill_bandeja_block") {
    const b1X = rand(485, 555);
    const b2X = rand(485, 555);
    const b1Y = rand(75, 145);
    const b2Y = rand(235, 310);
    const ballOnB2 = !mirror;
    const ballX = (ballOnB2 ? b2X : b1X) - rand(4, 14);
    const ballY = clamp((ballOnB2 ? b2Y : b1Y) + rand(-18, 18), 55, V_HEIGHT - 55);
    const sideText = getSideText(detectSide(ballY), lang);

    const base: PlaybookDraggableItem[] = [
      { id: "a1", x: 110, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 110, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: b1X, y: b1Y, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: b2X, y: b2Y, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: ballX, y: ballY, color: "#2ecc71", label: "●", isPlayer: false },
    ];

    const startItems = scrambleTeamA(base, "back");

    const title =
      lang === "en"
        ? "Defend the Bandeja"
        : lang === "es"
        ? "Defender la Bandeja"
        : "Bandeja sauber abwehren";

    const prompt =
      lang === "en"
        ? `An opponent prepares an overhead Bandeja from the ${sideText}. Position A1 & A2 compactly in defense to read both glass and middle.`
        : lang === "es"
        ? `El rival prepara una bandeja desde la ${sideText}. Coloca a A1 y A2 compactos en defensa para cubrir el cristal y el centro.`
        : `Der Gegner holt aus der ${sideText} zur Bandeja aus. Stelle A1 & A2 kompakt in der Defensive auf, um Glasscheibe und Mitte abzusichern.`;

    const explanation =
      lang === "en"
        ? "Against a Bandeja you never stay stuck in no-man's-land: defend behind the service line, keep compact spacing and cover the bisector."
        : lang === "es"
        ? "Ante una bandeja nunca te quedes en tierra de nadie: defiende detrás de la línea de saque con buena distancia entre compañeros."
        : "Bei einer gegnerischen Bandeja darf niemand im Niemandsland stehen: hinter der Aufschlaglinie kompakt stehen und die Winkelhalbierende sichern.";

    return {
      id: drillId,
      source: "standard",
      title,
      prompt,
      explanation,
      targetDepth: "back",
      startItems,
      isMirrored: mirror,
    };
  }

  // drill_after_lob_take_net
  const b1X = rand(660, 720);
  const b2X = rand(650, 715);
  const b1Y = rand(65, 140);
  const b2Y = rand(235, 315);
  const ballOnLeft = !mirror;
  const ballX = (ballOnLeft ? b1X : b2X) - rand(4, 14);
  const ballY = ballOnLeft ? clamp(b1Y + rand(-12, 16), 45, 145) : clamp(b2Y + rand(-16, 12), 235, 335);
  const sideText = getSideText(detectSide(ballY), lang);

  const base: PlaybookDraggableItem[] = [
    { id: "a1", x: 280, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
    { id: "a2", x: 280, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
    { id: "b1", x: b1X, y: b1Y, color: "#f1c40f", label: "B1", isPlayer: true },
    { id: "b2", x: b2X, y: b2Y, color: "#f1c40f", label: "B2", isPlayer: true },
    { id: "ball", x: ballX, y: ballY, color: "#2ecc71", label: "●", isPlayer: false },
  ];

  const startItems = scrambleTeamA(base, "net");

  const title =
    lang === "en"
      ? "Take the Net After a Deep Lob"
      : lang === "es"
      ? "Subir a la Red tras Globo Profundo"
      : "Nach tiefem Lob ans Netz aufrücken";

  const prompt =
    lang === "en"
      ? `Your deep lob pushed the opponents to the back glass in the ${sideText}. Advance A1 & A2 together to seize the net position!`
      : lang === "es"
      ? `Tu globo profundo empujó a los rivales al cristal de la ${sideText}. ¡Sube con A1 y A2 juntos para conquistar la red!`
      : `Dein tiefer Lob drückt die Gegner in die ${sideText} an die Rückscheibe. Rücke jetzt mit A1 & A2 geschlossen ans Netz auf!`;

  const explanation =
    lang === "en"
      ? "A good lob is wasted if you stay back. Both players must move forward together immediately to take control at the net."
      : lang === "es"
      ? "Un gran globo se pierde si os quedáis atrás. Subid juntos de inmediato para tomar el control de la red."
      : "Ein guter Lob verpufft, wenn ihr hinten bleibt. Rückt sofort synchron ans Netz vor und übernehmt die Angriffsposition.";

  return {
    id: drillId,
    source: "standard",
    title,
    prompt,
    explanation,
    targetDepth: "net",
    startItems,
    isMirrored: mirror,
  };
}

// =========================================================================
// 2. AUTOMATISCHE LOKALE TAKTIK-ANALYSE FÜR EIGENE PLAYBOOK-SPIELZÜGE
// =========================================================================
export function generateSmartDrillMeta(
  params: {
    title?: string;
    items: PlaybookDraggableItem[];
    drawings?: PlaybookStudioDrawing[];
    keyframes?: { items: PlaybookDraggableItem[]; drawings?: PlaybookStudioDrawing[] }[];
  },
  lang: AppLanguage
): SmartDrillMeta {
  const frames = params.keyframes || [];
  const startItems = frames.length > 0 ? frames[0].items : params.items;
  const step1Drawings =
    frames.length > 0 && (frames[0].drawings?.length || 0) > 0
      ? frames[0].drawings || []
      : params.drawings || [];

  let solutionItems: PlaybookDraggableItem[] | undefined;
  if (frames.length >= 2 && hasTeamAMoved(frames[0].items, frames[1].items)) {
    solutionItems = frames[1].items;
  } else if (step1Drawings.some((d) => d.type === "arrow_run")) {
    const derived = deriveItemsFromDrawings(startItems, step1Drawings);
    if (hasTeamAMoved(startItems, derived)) {
      solutionItems = derived;
    }
  }

  const refItems = solutionItems || startItems;
  const a1 = refItems.find((i) => i.id === "a1");
  const a2 = refItems.find((i) => i.id === "a2");
  const b1 = refItems.find((i) => i.id === "b1");
  const b2 = refItems.find((i) => i.id === "b2");
  const ball = (frames.length > 0 ? frames[0].items : params.items).find(
    (i) => i.id === "ball"
  );

  const avgAX = a1 && a2 ? (a1.x + a2.x) / 2 : 130;
  const avgBX = b1 && b2 ? (b1.x + b2.x) / 2 : 600;
  const ballSide = detectSide(ball?.y ?? V_HEIGHT / 2);
  const sideText = getSideText(ballSide, lang);

  const hasLob = step1Drawings.some((d) => d.type === "arrow_lob");
  const hasGlass = step1Drawings.some((d) => d.type === "arrow_glass");

  // Zieltiefe intelligent aus Musterlösung, Pfeilen oder Gegner-Position ableiten
  let targetDepth: DrillDepth = "back";
  if (solutionItems) {
    targetDepth = avgAX >= 235 ? "net" : avgAX <= 170 ? "back" : "mid";
  } else if (hasLob || avgBX >= 610) {
    targetDepth = "net";
  } else if (avgBX <= 515) {
    targetDepth = "back";
  } else {
    targetDepth = avgAX >= 235 ? "net" : avgAX <= 170 ? "back" : "mid";
  }

  const cleanTitle = (params.title || "").replace(/^[🏆⚠️🧠🎯📘]+\s*/u, "").trim();
  const titleHint = cleanTitle ? ` („${cleanTitle}“)` : "";

  if (hasLob || (targetDepth === "net" && avgBX >= 600)) {
    if (lang === "en") {
      return {
        targetDepth: "net",
        prompt: `Play scenario${titleHint}: The ball goes deep into the ${sideText}. Move A1 & A2 forward together to claim the net and seal the angle.`,
        explanation:
          "Whenever your shot forces the opponents deep behind their service line, both players must take the net as one unit and protect the center.",
      };
    }
    if (lang === "es") {
      return {
        targetDepth: "net",
        prompt: `Situación${titleHint}: La bola presiona en la ${sideText}. Sube con A1 y A2 juntos a la red y cierra los ángulos de respuesta.`,
        explanation:
          "Cuando empujas al rival al fondo de la pista, ambos jugadores deben conquistar la red en bloque y proteger el centro.",
      };
    }
    return {
      targetDepth: "net",
      prompt: `Spielzug${titleHint}: Der Ball drückt den Gegner in die ${sideText}. Rücke mit A1 & A2 geschlossen ans Netz vor und mach die Winkel dicht.`,
      explanation:
        "Sobald der Gegner hinten verteidigen muss, erobert ihr gemeinsam das Netz – haltet den Mittelkorridor eng und verschiebt synchron zum Ball.",
    };
  }

  if (hasGlass) {
    if (lang === "en") {
      return {
        targetDepth,
        prompt: `Glass rebound scenario${titleHint}: Read the bounce from the ${sideText} and place A1 & A2 in compact ${targetDepth === "net" ? "attacking" : "defensive"} alignment.`,
        explanation:
          "On glass rebounds, calm spacing beats rushing. Stay parallel as a pair so neither the middle gap nor the corner opens up.",
      };
    }
    if (lang === "es") {
      return {
        targetDepth,
        prompt: `Rebote en cristal${titleHint}: Lee el rebote en la ${sideText} y coloca a A1 y A2 en posición compacta de ${targetDepth === "net" ? "ataque" : "defensa"}.`,
        explanation:
          "En jugadas de cristal es clave mantener la línea paralela entre compañeros para cubrir tanto el rebote como el centro.",
      };
    }
    return {
      targetDepth,
      prompt: `Scheiben-Situation${titleHint}: Lies den Abpraller in der ${sideText} und stelle A1 & A2 kompakt in der ${targetDepth === "net" ? "Angriffs-" : "Defensiv-"}Formation auf.`,
      explanation:
        "Bei Scheiben-Bällen zählt ruhiges, paralleles Verschieben im Team – ohne Tiefen-Riss und mit sauberer Absicherung der Mitte.",
    };
  }

  if (targetDepth === "net") {
    if (lang === "en") {
      return {
        targetDepth: "net",
        prompt: `Net formation${titleHint}: The ball is on the ${sideText}. Position A1 & A2 together at the net without leaving the middle open.`,
        explanation:
          "In attack, both players hold the net line together and shift sideways toward the ball to block down-the-line and cross-court passes.",
      };
    }
    if (lang === "es") {
      return {
        targetDepth: "net",
        prompt: `Formación de red${titleHint}: La bola está en la ${sideText}. Coloca a A1 y A2 juntos en la red sin dejar el centro abierto.`,
        explanation:
          "En ataque, ambos jugadores mantienen la red en línea y basculan hacia la bola para bloquear paralelos y diagonales.",
      };
    }
    return {
      targetDepth: "net",
      prompt: `Netz-Formation${titleHint}: Der Ball liegt in der ${sideText}. Positioniere A1 & A2 gemeinsam am Netz, ohne die Mitte zu öffnen.`,
      explanation:
        "Im Angriff haltet ihr die Netzlinie als Paar und verschiebt gemeinsam zum Ball – so bleiben Longline und Mitte zuverlässig zu.",
    };
  }

  if (targetDepth === "mid") {
    if (lang === "en") {
      return {
        targetDepth: "mid",
        prompt: `Transition play${titleHint}: With the ball on the ${sideText}, align A1 & A2 compactly in mid-court without splitting depth.`,
        explanation:
          "In transition phases, staying parallel is critical. Move together as a pair so opponents cannot exploit a staggered gap.",
      };
    }
    if (lang === "es") {
      return {
        targetDepth: "mid",
        prompt: `Transición${titleHint}: Con la bola en la ${sideText}, alinea a A1 y A2 en media pista sin romper la línea paralela.`,
        explanation:
          "En fases de transición es vital moverse a la par para no regalar huecos diagonales al rival.",
      };
    }
    return {
      targetDepth: "mid",
      prompt: `Übergangsphase${titleHint}: Bei Ball in der ${sideText} positioniere A1 & A2 kompakt und auf gleicher Höhe im Mittelfeld.`,
      explanation:
        "Im Übergang entscheidet das Gummiband: Bleibt auf gleicher Höhe, damit der Gegner keine Lücke zwischen euch anspielen kann.",
    };
  }

  // Default: Defensive ("back")
  if (lang === "en") {
    return {
      targetDepth: "back",
      prompt: `Defensive drill${titleHint}: Opponents apply pressure from the ${sideText}. Drop A1 & A2 back in sync, close the middle and cover the angle cone.`,
      explanation:
        "Under pressure, defend behind the service line as a compact unit. Keep the rubberband green and cover the center bisector.",
    };
  }
  if (lang === "es") {
    return {
      targetDepth: "back",
      prompt: `Drill defensivo${titleHint}: Los rivales presionan desde la ${sideText}. Baja con A1 y A2 sincronizados, cierra el centro y cubre el ángulo.`,
      explanation:
        "Bajo presión se defiende detrás de la línea de saque en bloque compacto, manteniendo la goma cerrada y el centro protegido.",
    };
  }
  return {
    targetDepth: "back",
    prompt: `Defensiv-Drill${titleHint}: Der Gegner macht aus der ${sideText} Druck. Ziehe A1 & A2 synchron zurück, schließe die Mitte und decke den Winkel.`,
    explanation:
      "Unter Druck verteidigt ihr gemeinsam hinter der Aufschlaglinie. Haltet das Gummiband geschlossen und sichert die Winkelhalbierende ab.",
  };
}

// Reichert einen Playbook-Spielzug automatisch mit smartem Drill-Text & Zieltiefe an
export function enrichPlayAsDrill(
  play: SavedPlay,
  lang: AppLanguage,
  forceRegenerateText: boolean = false
): SavedPlay {
  const smart = generateSmartDrillMeta(play, lang);

  return {
    ...play,
    isDrill: true,
    drillPrompt:
      forceRegenerateText || !play.drillPrompt?.trim()
        ? smart.prompt
        : play.drillPrompt,
    drillExplanation:
      forceRegenerateText || !play.drillExplanation?.trim()
        ? smart.explanation
        : play.drillExplanation,
    drillTargetDepth: play.drillTargetDepth || smart.targetDepth,
    updatedAt: Date.now(),
  };
}

// =========================================================================
// 3. BAUT AUS JEDEM PLAYBOOK-EINTRAG EINEN SPIELBAREN, VARIABLEN DRILL
// =========================================================================
export function buildPlaybookDrill(
  play: SavedPlay,
  lang: AppLanguage,
  options?: { remix?: boolean }
): GeneratedDrill {
  const frames = play.keyframes || [];
  const rawStart =
    frames.length > 0 ? cloneItems(frames[0].items) : cloneItems(play.items);
  const step1Drawings =
    frames.length > 0
      ? cloneDrawings(frames[0].drawings || [])
      : cloneDrawings(play.drawings || []);

  const smartMeta = generateSmartDrillMeta(play, lang);
  const targetDepth: DrillDepth = play.drillTargetDepth || smartMeta.targetDepth;

  let startItems = rawStart;
  let solutionItems: PlaybookDraggableItem[] | undefined;

  if (frames.length >= 2 && hasTeamAMoved(frames[0].items, frames[1].items)) {
    // 2+ Schritte mit klarer Bewegung von Team A -> Schritt 1 = Start, Schritt 2 = Musterlösung
    startItems = cloneItems(frames[0].items);
    solutionItems = cloneItems(frames[1].items);
  } else if (step1Drawings.some((d) => d.type === "arrow_run")) {
    // 1 Schritt mit Laufpfeil -> Pfeil-Ende = Musterlösung
    const derived = deriveItemsFromDrawings(rawStart, step1Drawings);
    if (hasTeamAMoved(rawStart, derived)) {
      startItems = rawStart;
      solutionItems = derived;
    }
  } else if (frames.length === 1 && hasTeamAMoved(frames[0].items, play.items)) {
    startItems = cloneItems(frames[0].items);
    solutionItems = cloneItems(play.items);
  }

  // Falls es nur eine 1-Schritt-Momentaufnahme ohne Bewegung war:
  // Die gespeicherte Aufstellung wird automatisch zur Musterlösung und Team A wird als Rätsel gemischt!
  const isAutoScrambledSingleShot = !solutionItems;
  if (!solutionItems) {
    solutionItems = cloneItems(rawStart);
    startItems = scrambleTeamA(rawStart, targetDepth);
  }

  // Bei Klick auf "🎲 Neue Variante": Szene optional spiegeln & Startposition frisch mischen
  let isMirrored = false;
  if (options?.remix) {
    isMirrored = Math.random() < 0.5;
    if (isMirrored) {
      startItems = mirrorItemsVertically(startItems);
      solutionItems = mirrorItemsVertically(solutionItems);
    }
    if (isAutoScrambledSingleShot) {
      startItems = scrambleTeamA(solutionItems, targetDepth);
    }
  }

  // Wenn gespiegelt wurde, generieren wir den Text passend zur gespiegelten Ball-Seite neu,
  // sofern der Nutzer keinen ganz eigenen Sondertext überschrieben hat
  const finalMeta = isMirrored
    ? generateSmartDrillMeta({ title: play.title, items: startItems, drawings: step1Drawings }, lang)
    : smartMeta;

  return {
    id: `pb_${play.id}`,
    source: "playbook",
    title: play.title,
    prompt:
      !isMirrored && play.drillPrompt?.trim()
        ? play.drillPrompt.trim()
        : finalMeta.prompt,
    explanation:
      !isMirrored && play.drillExplanation?.trim()
        ? play.drillExplanation.trim()
        : finalMeta.explanation,
    targetDepth,
    startItems,
    solutionItems,
    solutionDrawings: step1Drawings.length > 0 ? step1Drawings : undefined,
    isMirrored,
  };
}

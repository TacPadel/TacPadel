import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import ScenarioCourt4D from "./ScenarioCourt4D";
import { SCENARIOS as TRAINER_SCENARIOS, Scenario as TrainerScenario } from "./Scenarios";
import { supabase } from "../lib/supabase";
import { useTranslation, TranslationKey } from "../lib/i18n";
import {
  fetchCoachStats,
  buildSmartWeaknessPool,
  recordBoardDrill,
} from "../lib/tacticStats";

interface DraggableItem {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  isPlayer: boolean;
}

interface TacticalFilters {
  showBallVector: boolean;
  showMovements: boolean;
  showWeaknessZones: boolean;
  showTeamLines: boolean;
  showPulse: boolean;
  showAttackArc: boolean;
  showAngleCone: boolean;
}

// Typen für das Tactical Studio (Zeichnungen & Rekorder)
type StudioTool = "move" | "arrow_run" | "arrow_ball" | "zone_circle";

interface StudioDrawing {
  id: string;
  type: "arrow_run" | "arrow_ball" | "zone_circle";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Interaktiver Stellungsspiel-Drill auf dem Board
interface BoardDrill {
  id: string;
  title: { de: string; en: string; es: string };
  prompt: { de: string; en: string; es: string };
  explanation: { de: string; en: string; es: string };
  targetDepth: "back" | "mid" | "net";
  items: DraggableItem[];
}

interface DrillCheckResult {
  scorePct: number;
  passed: boolean;
  checks: {
    label: string;
    ok: boolean;
  }[];
}

// Virtuelle Konstanten für stabiles Scaling (Logik bleibt 16:9, Ansicht wird 9:16 gedreht!)
const V_WIDTH = 760;
const V_HEIGHT = 380;

// Globale Taktik-Schwellenwerte für Analyse
const GAP_THRESHOLD = 160;
const WIDE_GAP_THRESHOLD = 180;
const DEPTH_GAP_THRESHOLD = 95;
const DEEP_DEF_THRESHOLD = 80;

// Konvertiert Zonen (A1–E5) aus dem Trainer exakt in Board-Koordinaten
const zoneToBoardCoords = (zoneId: string, side: "left" | "right"): { x: number; y: number } => {
  if (!zoneId || zoneId.length < 2) {
    return { x: side === "left" ? 120 : V_WIDTH - 120, y: V_HEIGHT / 2 };
  }
  const letters = ["A", "B", "C", "D", "E"];
  const colIdx = Math.max(0, Math.min(4, letters.indexOf(zoneId[0].toUpperCase())));
  const rowNum = Math.max(1, Math.min(5, parseInt(zoneId[1], 10) || 2));

  const y = 10 + (colIdx + 0.5) * ((V_HEIGHT - 20) / 5);
  const rowStep = (V_WIDTH / 2 - 10) / 5;
  const x =
    side === "left"
      ? 10 + (rowNum - 0.5) * rowStep
      : V_WIDTH - 10 - (rowNum - 0.5) * rowStep;

  return { x: Math.round(x), y: Math.round(y) };
};

const trainerScenarioToBoardItems = (scenario: TrainerScenario): DraggableItem[] => {
  const a1 = zoneToBoardCoords(scenario.positions.you, "left");
  const a2 = zoneToBoardCoords(scenario.positions.partner, "left");
  const b1 = zoneToBoardCoords(scenario.positions.opp1, "right");
  const b2 = zoneToBoardCoords(scenario.positions.opp2, "right");
  const ballSide = scenario.positions.ball.side === "right" ? "right" : "left";
  const ball = zoneToBoardCoords(scenario.positions.ball.zone, ballSide);

  return [
    { id: "a1", x: a1.x, y: a1.y, color: "#e74c3c", label: "A1", isPlayer: true },
    { id: "a2", x: a2.x, y: a2.y, color: "#e74c3c", label: "A2", isPlayer: true },
    { id: "b1", x: b1.x, y: b1.y, color: "#f1c40f", label: "B1", isPlayer: true },
    { id: "b2", x: b2.x, y: b2.y, color: "#f1c40f", label: "B2", isPlayer: true },
    { id: "ball", x: ball.x, y: ball.y, color: "#2ecc71", label: "●", isPlayer: false },
  ];
};

// Hilfsfunktion zur Berechnung der magnetischen Bogen-Kurve (Parabel)
const getArcX = (y: number, isTeamA: boolean) => {
  const cy = V_HEIGHT / 2;
  const aVal = 80 / Math.pow(V_HEIGHT / 2 - 20, 2);
  const netX = V_WIDTH / 2;

  if (isTeamA) {
    return aVal * Math.pow(y - cy, 2) + (netX - 140);
  } else {
    return -(aVal * Math.pow(y - cy, 2)) + (netX + 140);
  }
};

const getControlPointX = (isTeamA: boolean) => {
  const apexX = getArcX(V_HEIGHT / 2, isTeamA);
  const edgeX = getArcX(20, isTeamA);
  return 2 * apexX - edgeX;
};

// Berechnet den Gefahrenwinkel-Kegel + Winkelhalbierende vom Ball aus
const getDangerAngleCone = (ball: { x: number; y: number }) => {
  const netX = V_WIDTH / 2;
  const isBallOnSideA = ball.x <= netX;
  const farX = isBallOnSideA ? V_WIDTH - 14 : 14;
  const topCornerY = 18;
  const bottomCornerY = V_HEIGHT - 18;

  // Winkelhalbierende: perfekte Mitten-Ausrichtung für das verteidigende Team
  const aTop = Math.atan2(topCornerY - ball.y, farX - ball.x);
  const aBot = Math.atan2(bottomCornerY - ball.y, farX - ball.x);
  const midAngle = (aTop + aBot) / 2;
  const dx = farX - ball.x;
  const bisectorY = Math.max(
    45,
    Math.min(V_HEIGHT - 45, ball.y + Math.tan(midAngle) * dx)
  );

  return {
    points: `${ball.x},${ball.y} ${farX},${topCornerY} ${farX},${bottomCornerY}`,
    farX,
    topCornerY,
    bottomCornerY,
    bisectorY,
  };
};

// VORDEFINIERTE TAKTISCHE AUFSTELLUNGEN (SZENARIOS)
const SCENARIOS: Record<
  string,
  {
    nameKey: TranslationKey;
    basicVisible?: boolean;
    items: DraggableItem[];
    customAnalysis?: { targetX: number; targetY: number; recommendationKey: TranslationKey };
  }
> = {
  initial: {
    nameKey: "tb_scen_initial_name",
    basicVisible: true,
    items: [
      { id: "a1", x: 120, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 120, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 120, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 120, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH / 2, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },
    ],
  },
  angriff_netz_a: {
    nameKey: "tb_scen_net_name",
    basicVisible: true,
    items: [
      { id: "a1", x: 310, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 310, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 80, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 335, y: 135, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 195,
      recommendationKey: "tb_scen_net_rec",
    },
  },
  angriff_dynamisch: {
    nameKey: "tb_scen_wiper_name",
    items: [
      { id: "a1", x: getArcX(110, true), y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: getArcX(270, true), y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 70, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 70, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH / 2 - 40, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 680,
      targetY: 60,
      recommendationKey: "tb_scen_wiper_rec",
    },
  },
  aufschlag_a: {
    nameKey: "tb_scen_serve_name",
    items: [
      { id: "a1", x: 60, y: 270, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 320, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 80, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 100, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 85, y: 270, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 660,
      targetY: 100,
      recommendationKey: "tb_scen_serve_rec",
    },
  },
  return_a: {
    nameKey: "tb_scen_return_name",
    items: [
      { id: "a1", x: 80, y: 270, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 90, y: 110, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 60, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 440, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH - 90, y: 110, color: "#2ecc71", label: "●", isPlayer: false },
    ],
    customAnalysis: {
      targetX: 100,
      targetY: 280,
      recommendationKey: "tb_scen_return_rec",
    },
  },
};

// KURATIERTE STELLUNGSSPIEL-DRILLS FÜR DAS BOARD
const BOARD_DRILLS: BoardDrill[] = [
  {
    id: "drill_rubberband_defense",
    title: {
      de: "Gummiband-Rettung",
      en: "Rubber-Band Rescue",
      es: "Rescate de Posición",
    },
    prompt: {
      de: "Gegner B1 greift links am Netz an – A1 steht hinten, A2 klebt allein vorn! Schiebe A1 & A2 in eine kompakte Defensive.",
      en: "Opponent B1 attacks from the left net while A2 is stranded up front! Move A1 & A2 into compact defense.",
      es: "B1 ataca desde la red izquierda y A2 quedó solo arriba. Mueve a A1 y A2 a una defensa compacta.",
    },
    explanation: {
      de: "Das Netz gibt man immer gemeinsam auf. Stehen beide parallel hinten links-orientiert, sind Mitte und Longline dicht.",
      en: "Always retreat together as a pair. Staying parallel in the back protects both the middle and the down-the-line shot.",
      es: "Siempre se retrocede en pareja. Paralelos en el fondo cubrís el centro y el paralelo.",
    },
    targetDepth: "back",
    items: [
      { id: "a1", x: 90, y: 80, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 300, y: 315, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: 455, y: 90, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 470, y: 245, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 445, y: 85, color: "#2ecc71", label: "●", isPlayer: false },
    ],
  },
  {
    id: "drill_net_shift_right",
    title: {
      de: "Scheibenwischer am Netz",
      en: "Net Wiper Shift",
      es: "Desplazamiento en Red",
    },
    prompt: {
      de: "Die Gegner sind hinten rechts in die Ecke gedrängt. Rücke mit A1 & A2 gemeinsam ans Netz vor und mache Mitte + Longline dicht!",
      en: "Opponents are pinned in the back-right corner. Advance A1 & A2 together to the net and close the angles!",
      es: "Los rivales están encerrados al fondo derecha. Sube con A1 y A2 a la red y cierra los ángulos.",
    },
    explanation: {
      de: "Am Netz verschiebt das ganze Team leicht zur Ballseite: Longline-Spieler deckt die Linie, Partner schließt die Mitte.",
      en: "At the net, both players shift slightly toward the ball side: line player guards down-the-line, partner shuts the middle.",
      es: "En red el equipo bascula hacia la bola: uno cubre el paralelo y el compañero cierra el centro.",
    },
    targetDepth: "net",
    items: [
      { id: "a1", x: 160, y: 65, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 205, y: 325, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: 675, y: 120, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 690, y: 305, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 680, y: 315, color: "#2ecc71", label: "●", isPlayer: false },
    ],
  },
  {
    id: "drill_bandeja_block",
    title: {
      de: "Bandeja aus dem Halbfeld",
      en: "Defending the Bandeja",
      es: "Defensa ante Bandeja",
    },
    prompt: {
      de: "B2 bereitet rechts eine Bandeja vor. Eure Mitte steht sperrangelweit offen! Ziehe A1 & A2 in eine sichere Abwehr-Staffelung.",
      en: "B2 sets up a Bandeja on the right and your middle is wide open! Position A1 & A2 safely behind the service line.",
      es: "B2 prepara una bandeja a la derecha y dejáis el centro abierto. Coloca a A1 y A2 cerrando el centro atrás.",
    },
    explanation: {
      de: "Gegen eine Bandeja bleibt ihr kompakt hinter der Aufschlaglinie und verengt die Mitte, damit der Ball sauber von der Scheibe genommen werden kann.",
      en: "Against a Bandeja, stay compact behind the service line and close the middle so you can read the glass rebound cleanly.",
      es: "Ante una bandeja, quedaos compactos detrás de la línea de saque cerrando el centro para leer bien el cristal.",
    },
    targetDepth: "back",
    items: [
      { id: "a1", x: 195, y: 42, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 95, y: 338, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: 495, y: 125, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 545, y: 295, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 540, y: 295, color: "#2ecc71", label: "●", isPlayer: false },
    ],
  },
  {
    id: "drill_after_lob_take_net",
    title: {
      de: "Nach dem tiefen Lob vorrücken",
      en: "Take the Net After a Deep Lob",
      es: "Subir tras Globo Profundo",
    },
    prompt: {
      de: "Euer Lob hat beide Gegner ganz nach hinten links gedrängt! Übernehmt mit A1 & A2 gemeinsam die Netzposition.",
      en: "Your deep lob pushed both opponents to the back-left glass! Move A1 & A2 forward together to claim the net.",
      es: "Vuestro globo profundo empujó a los rivales al fondo izquierda. ¡Subid juntos a la red con A1 y A2!",
    },
    explanation: {
      de: "Sobald die Gegner nach hinten gezwungen sind, rückt ihr synchron bis vor die T-Linie vor und verschiebt leicht Richtung Ballseite.",
      en: "Once opponents are forced to the back glass, advance in sync to the net zone and lean slightly toward the ball side.",
      es: "Cuando los rivales retroceden al cristal, subid sincronizados a zona de volea basculando hacia la bola.",
    },
    targetDepth: "net",
    items: [
      { id: "a1", x: 95, y: 115, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 105, y: 275, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: 705, y: 75, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: 690, y: 235, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: 700, y: 70, color: "#2ecc71", label: "●", isPlayer: false },
    ],
  },
];

// HILFSFUNKTION: Kapselt die Ziel-Berechnung für beide Systeme (inkl. Tiefen-Riss-Erkennung)
const getTacticalTargetAndRec = (
  ball: { x: number; y: number },
  teamA: DraggableItem[],
  teamB: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string,
  lang: string
) => {
  const netX = V_WIDTH / 2;
  const isBallOnSideA = ball.x <= netX;
  const teamA_X = (teamA[0].x + teamA[1].x) / 2;
  const teamB_X = (teamB[0].x + teamB[1].x) / 2;
  const depthGapA = Math.abs(teamA[0].x - teamA[1].x);
  const depthGapB = Math.abs(teamB[0].x - teamB[1].x);

  let targetX = 0;
  let targetY = 0;
  let recommendation = "";

  if (customTarget) {
    targetX = customTarget.x;
    targetY = customTarget.y;
    recommendation = t("tb_rec_custom_target");
  } else if (scenarioKey !== "custom" && SCENARIOS[scenarioKey]?.customAnalysis) {
    const custom = SCENARIOS[scenarioKey].customAnalysis!;
    targetX = custom.targetX;
    targetY = custom.targetY;
    recommendation = t(custom.recommendationKey);
  } else {
    if (isBallOnSideA) {
      targetX = V_WIDTH - 80;
      targetY = V_HEIGHT / 2;
      recommendation = t("tb_rec_clear_lob");

      const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD + 2;
      if (depthGapB > DEPTH_GAP_THRESHOLD) {
        targetX = (teamB[0].x + teamB[1].x) / 2;
        targetY = (teamB[0].y + teamB[1].y) / 2;
        recommendation =
          lang === "en"
            ? "Opponent split in depth – play flat through the open middle!"
            : lang === "es"
            ? "Rival partido en profundidad: ¡juega rápido al centro abierto!"
            : "Gegner auseinandergerissen – spiel flach durch die offene Mitte!";
      } else if (teamB_X < netX + DEEP_DEF_THRESHOLD) {
        recommendation = t("tb_rec_opp_at_net");
        targetX = V_WIDTH - 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isBMiddleOpen && filters.showWeaknessZones) {
        recommendation = t("tb_rec_gap_middle");
        targetX = (teamB[0].x + teamB[1].x) / 2;
        targetY = (teamB[0].y + teamB[1].y) / 2;
      }
    } else {
      targetX = 80;
      targetY = V_HEIGHT / 2;
      recommendation = t("tb_rec_hold_net");

      const isAMiddleOpen = Math.abs(teamA[0].y - teamA[1].y) > GAP_THRESHOLD + 2;
      const isAAtNet = teamA_X > netX - DEEP_DEF_THRESHOLD;
      if (depthGapA > DEPTH_GAP_THRESHOLD) {
        targetX = (teamA[0].x + teamA[1].x) / 2;
        targetY = (teamA[0].y + teamA[1].y) / 2;
        recommendation =
          lang === "en"
            ? "Team split in depth – move up or retreat together as a pair!"
            : lang === "es"
            ? "Equipo partido en profundidad: ¡subid o retroceded juntos!"
            : "Team auseinandergerissen – gemeinsam vor oder zurück verschieben!";
      } else if (isAAtNet) {
        recommendation = t("tb_rec_lob_danger");
        targetX = 40;
        targetY = ball.y > V_HEIGHT / 2 ? V_HEIGHT * 0.25 : V_HEIGHT * 0.75;
      } else if (isAMiddleOpen && filters.showWeaknessZones) {
        recommendation = t("tb_rec_own_middle_open");
        targetX = (teamA[0].x + teamA[1].x) / 2;
        targetY = (teamA[0].y + teamA[1].y) / 2;
      }
    }
  }
  return { targetX, targetY, recommendation };
};

const getTacticalAnalysis = (
  items: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string,
  lang: string
) => {
  const teamA = items.filter((i) => i.id.startsWith("a"));
  const teamB = items.filter((i) => i.id.startsWith("b"));
  const ball = items.find((i) => i.id === "ball");
  if (!ball || teamA.length < 2 || teamB.length < 2) return null;

  const netX = V_WIDTH / 2;
  const teamA_X = (teamA[0].x + teamA[1].x) / 2;
  const depthGapA = Math.abs(teamA[0].x - teamA[1].x);
  const isBallOnSideA = ball.x <= netX;

  const closestA = teamA.reduce((prev, curr) =>
    Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y)
      ? curr
      : prev
  );
  const closestB = teamB.reduce((prev, curr) =>
    Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y)
      ? curr
      : prev
  );

  const { targetX, targetY, recommendation } = getTacticalTargetAndRec(
    ball,
    teamA,
    teamB,
    filters,
    scenarioKey,
    customTarget,
    t,
    lang
  );

  const movements: Record<string, { tx: number; ty: number }> = {};
  let title = "";
  let bodyText = "";
  let color = "";
  let activePlayerId = "";

  const targetYPercent = Math.max(0, Math.min(1, targetY / V_HEIGHT));
  const targetLateralShift = (targetYPercent - 0.5) * 160;

  if (isBallOnSideA) {
    const isBMiddleOpen = Math.abs(teamB[0].y - teamB[1].y) > GAP_THRESHOLD + 2;
    const isAInTransition = teamA_X > V_WIDTH * 0.25 && teamA_X < netX - 80;

    const hitterAngle = Math.atan2(ball.y - closestA.y, ball.x - closestA.x);
    const hitterDist = Math.hypot(ball.x - closestA.x, ball.y - closestA.y);
    const hitterStep = Math.max(0, hitterDist - 28);
    const hitterTx = closestA.x + Math.cos(hitterAngle) * hitterStep;
    const hitterTy = closestA.y + Math.sin(hitterAngle) * hitterStep;

    teamA.forEach((p) => {
      if (p.id === closestA.id) {
        movements[p.id] = { tx: hitterTx, ty: hitterTy };
      } else {
        const idealSpacing = p.id === "a1" ? -160 : 160;
        const targetYBall = Math.max(40, Math.min(V_HEIGHT - 40, ball.y + idealSpacing));
        let partnerTx = p.x;
        if (hitterTx > p.x) partnerTx = hitterTx;
        movements[p.id] = { tx: partnerTx, ty: p.y * 0.4 + targetYBall * 0.6 };
      }
    });

    const defBaseX = (teamB[0].x + teamB[1].x) / 2;
    teamB.forEach((p) => {
      if (filters.showAttackArc) {
        const optY = p.id === "b1" ? 110 + targetLateralShift : 270 + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: optY };
      } else {
        const baseY = p.id === "b1" ? 110 : 270;
        const targetNetY = baseY + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: p.y * 0.4 + targetNetY * 0.6 };
      }
    });

    bodyText = `${t("tb_body_side_a_1")} ${closestA.label} ${t("tb_body_side_a_2")}`;
    title = `${t("tb_title_side_a_1")} ${closestA.label} ${t("tb_title_side_a_2")}`;
    color =
      depthGapA > DEPTH_GAP_THRESHOLD || isAInTransition
        ? "bg-red-900/90 border-red-500/50"
        : isBMiddleOpen && filters.showWeaknessZones
        ? "bg-emerald-900/90 border-emerald-500/50"
        : "bg-[#07152e]/95 border-cyan-500/40";
    activePlayerId = closestA.id;
  } else {
    const hitterAngle = Math.atan2(ball.y - closestB.y, ball.x - closestB.x);
    const hitterDist = Math.hypot(ball.x - closestB.x, ball.y - closestB.y);
    const hitterStep = Math.max(0, hitterDist - 28);
    const hitterTx = closestB.x + Math.cos(hitterAngle) * hitterStep;
    const hitterTy = closestB.y + Math.sin(hitterAngle) * hitterStep;

    teamB.forEach((p) => {
      if (p.id === closestB.id) {
        movements[p.id] = { tx: hitterTx, ty: hitterTy };
      } else {
        const idealSpacing = p.id === "b1" ? -160 : 160;
        const targetYBall = Math.max(40, Math.min(V_HEIGHT - 40, ball.y + idealSpacing));
        let partnerTx = p.x;
        if (hitterTx < p.x) partnerTx = hitterTx;
        movements[p.id] = { tx: partnerTx, ty: p.y * 0.4 + targetYBall * 0.6 };
      }
    });

    const defBaseX = (teamA[0].x + teamA[1].x) / 2;
    teamA.forEach((p) => {
      if (filters.showAttackArc) {
        const optY = p.id === "a1" ? 110 + targetLateralShift : 270 + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: optY };
      } else {
        const baseY = p.id === "a1" ? 110 : 270;
        const targetNetY = baseY + targetLateralShift;
        movements[p.id] = { tx: defBaseX, ty: p.y * 0.4 + targetNetY * 0.6 };
      }
    });

    bodyText = `${t("tb_body_side_b_1")} ${closestB.label} ${t("tb_body_side_b_2")}`;
    title = `${t("tb_title_side_b_1")} ${closestB.label} ${t("tb_title_side_b_2")}`;
    color =
      depthGapA > DEPTH_GAP_THRESHOLD
        ? "bg-red-900/90 border-red-500/50"
        : "bg-[#081329]/95 border-blue-500/40";
    activePlayerId = closestB.id;
  }

  return { title, body: bodyText, color, recommendation, targetX, targetY, activePlayerId, movements };
};

// ==========================================
// 3D ANSICHT MIT TAKTIK-RADAR HUD
// ==========================================
function TrajectoryView3D() {
  const { t } = useTranslation();

  const [shotType, setShotType] = useState("BAJADA");
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [playerPos, setPlayerPos] = useState({ x: 140, y: 260 });
  const [targetPos, setTargetPos] = useState({ x: 620, y: 120 });
  const [activeDrag, setActiveDrag] = useState<"player" | "target" | null>(null);

  const sniperSvgRef = useRef<SVGSVGElement>(null);
  const NET_X = V_WIDTH / 2;

  const getMetersFromXY = (svgX: number, svgY: number) => {
    const z = 10 - (svgX / V_WIDTH) * 20;
    const x = (svgY / V_HEIGHT) * 10 - 5;
    return {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };
  };

  const playerCoords = getMetersFromXY(playerPos.x, playerPos.y);
  const targetCoords = getMetersFromXY(targetPos.x, targetPos.y);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = sniperSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();

    let clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    let clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const SVG_VIEW_X = -40;
    const SVG_VIEW_Y = -40;
    const SVG_VIEW_W = 460;
    const SVG_VIEW_H = 840;

    const vX = ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X;
    const vY = ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y;

    return {
      x: V_WIDTH - vY,
      y: vX,
    };
  }, []);

  const onPointerDown = useCallback((id: "player" | "target", e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    setActiveDrag(id);
  }, []);

  const onPointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!activeDrag) return;
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);

      if (activeDrag === "player") {
        setPlayerPos({
          x: Math.max(16, Math.min(NET_X - 16, pt.x)),
          y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)),
        });
      } else if (activeDrag === "target") {
        setTargetPos({
          x: Math.max(NET_X + 16, Math.min(V_WIDTH - 16, pt.x)),
          y: Math.max(16, Math.min(V_HEIGHT - 16, pt.y)),
        });
      }
    },
    [activeDrag, getPoint, NET_X]
  );

  const onPointerUp = useCallback(() => setActiveDrag(null), []);

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => setHasSubmitted(true), 1500);
  };

  const handleBack = () => {
    setHasSubmitted(false);
    setIsSimulating(false);
  };

  return (
    <div className="w-full max-w-5xl flex-1 flex flex-col h-full px-2 mb-4">
      <div className="w-full flex-1 h-full min-h-[450px] bg-[#02040a] rounded-xl shadow-2xl border-4 border-[#111] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-auto">
          <ScenarioCourt4D
            level="Schlagrichtung"
            isPreparingShot={isSimulating && !hasSubmitted}
            positions={{
              you: `EXACT_${playerCoords.x}_${playerCoords.z}`,
              partner: "EXACT_1000_1000",
              opp1: "EXACT_1000_1000",
              opp2: "EXACT_1000_1000",
              ball: { side: "left", zone: `EXACT_${playerCoords.x}_${playerCoords.z}`, type: shotType },
            }}
            selectedZone={`EXACT_${targetCoords.x}_${targetCoords.z}`}
            exactCoords={{ you: playerCoords, target: targetCoords }}
            hidePlayerLabels={true}
            hasSubmitted={hasSubmitted}
            bestZones={[`EXACT_${targetCoords.x}_${targetCoords.z}`]}
            onZoneClick={() => {}}
            activeChar="you"
            hitterId="you"
            playIntro={false}
            turnResult="perfect"
          />
        </div>

        {!isSimulating && (
          <div className="absolute top-2 left-2 z-10 w-[calc(100%-16px)] max-w-[300px] sm:max-w-none sm:w-72 bg-black/80 sm:bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2 sm:gap-3 pointer-events-auto transition-opacity animate-in fade-in">
            <div className="flex justify-between items-center sm:block">
              <div>
                <span className="text-[#5cd6ff] text-[9px] sm:text-[10px] font-black uppercase tracking-widest block mb-0.5">
                  {t("tb_radar_badge")}
                </span>
                <h3 className="text-white text-xs sm:text-sm font-bold">{t("tb_radar_title")}</h3>
              </div>
            </div>

            <div className="w-full bg-[#050505] rounded-xl border border-white/10 shadow-inner overflow-hidden flex justify-center py-2">
              <svg
                ref={sniperSvgRef}
                viewBox="-40 -40 460 840"
                className="w-auto h-[180px] sm:h-[220px] touch-none select-none block cursor-crosshair"
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onTouchCancel={onPointerUp}
              >
                <g transform="matrix(0 -1 1 0 0 760)">
                  <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
                  <line x1={NET_X} y1={10} x2={NET_X} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="6 4" />
                  <line x1={NET_X - 6.95 * 38} y1={10} x2={NET_X - 6.95 * 38} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X + 6.95 * 38} y1={10} x2={NET_X + 6.95 * 38} y2={V_HEIGHT - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X - 6.95 * 38} y1={V_HEIGHT / 2} x2={NET_X} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                  <line x1={NET_X} y1={V_HEIGHT / 2} x2={NET_X + 6.95 * 38} y2={V_HEIGHT / 2} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />

                  <line x1={playerPos.x} y1={playerPos.y} x2={targetPos.x} y2={targetPos.y} stroke="#f1c40f" strokeWidth="6" strokeDasharray="8 6" opacity={0.8} />
                  <g style={{ cursor: activeDrag === "target" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("target", e)} onTouchStart={(e) => onPointerDown("target", e)}>
                    <circle cx={targetPos.x} cy={targetPos.y} r={40} fill="transparent" />
                    <circle cx={targetPos.x} cy={targetPos.y} r="16" fill="none" stroke="#f1c40f" strokeWidth="3" className="animate-pulse" />
                    <circle cx={targetPos.x} cy={targetPos.y} r="6" fill="#f1c40f" />
                  </g>
                  <g style={{ cursor: activeDrag === "player" ? "grabbing" : "grab" }} onMouseDown={(e) => onPointerDown("player", e)} onTouchStart={(e) => onPointerDown("player", e)}>
                    <circle cx={playerPos.x} cy={playerPos.y} r={40} fill="transparent" />
                    <circle cx={playerPos.x} cy={playerPos.y} r={activeDrag === "player" ? 22 : 18} fill="#e74c3c" stroke="#ffffff" strokeWidth="3" />
                    <text x={playerPos.x} y={playerPos.y} transform={`rotate(90 ${playerPos.x} ${playerPos.y})`} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="bold" style={{ pointerEvents: "none" }}>
                      {t("tb_radar_you")}
                    </text>
                  </g>
                </g>
              </svg>
            </div>

            <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-white/80 font-bold px-1">
              <span>
                {t("tb_radar_pos")}{" "}
                <span className="text-[#e74c3c] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">
                  X:{playerCoords.x} Z:{playerCoords.z}
                </span>
              </span>
              <span>
                {t("tb_radar_target")}{" "}
                <span className="text-[#f1c40f] ml-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/20 font-mono tracking-tighter">
                  X:{targetCoords.x} Z:{targetCoords.z}
                </span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <select
                value={shotType}
                onChange={(e) => setShotType(e.target.value)}
                className="w-full bg-white/10 text-white text-xs font-bold p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="BAJADA" className="text-black">{t("tb_shot_topspin")}</option>
                <option value="VIBORA" className="text-black">{t("tb_shot_slice")}</option>
                <option value="SMASH" className="text-black">{t("tb_shot_flat")}</option>
                <option value="LOB" className="text-black">{t("tb_shot_lob")}</option>
              </select>
              <button
                onClick={handleSimulate}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold py-2 px-3 rounded-lg shadow-md transition-transform active:scale-95 whitespace-nowrap"
              >
                {t("tb_btn_simulate")}
              </button>
            </div>
          </div>
        )}

        {isSimulating && (
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors pointer-events-auto animate-in fade-in"
          >
            {t("tb_btn_back_plan")}
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// HAUPT-KOMPONENTE (COACH-LABOR & STUDIO)
// ==========================================
export default function TacticsBoard() {
  const { lang, t } = useTranslation();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<DraggableItem[]>(SCENARIOS.initial.items);
  const [activeId, setActiveId] = useState<string | null>(null);

  const dragRef = useRef<{ id: string; ox: number; oy: number; gapY: number; partnerId: string | null } | null>(null);
  const [showTactics, setShowTactics] = useState(false);

  const [selectedScenarioKey, setSelectedScenarioKey] = useState("initial");
  const [loadedTrainerScenario, setLoadedTrainerScenario] = useState<TrainerScenario | null>(null);
  const [customTarget, setCustomTarget] = useState<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // --- DYNAMISCHER SCHALTER: 2D | [STUDIO] | 3D ---
  const [activeMode, setActiveMode] = useState<"tactics" | "studio" | "3d">("tactics");

  // --- STILLSCHWEIGENDE FEATURE-FREISCHALTUNG (kein "Pro"-Hinweis im UI) ---
  const [isProUser, setIsProUser] = useState<boolean>(false);
  const [boardUserId, setBoardUserId] = useState<string | null>(null);
  const [weaknessPool, setWeaknessPool] = useState<TrainerScenario[]>([]);

  // --- INTERAKTIVER STELLUNGSSPIEL-DRILL ---
  const [activeDrillIdx, setActiveDrillIdx] = useState<number | null>(null);
  const [drillResult, setDrillResult] = useState<DrillCheckResult | null>(null);

  useEffect(() => {
    async function checkAccessAndCoachData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setBoardUserId(null);
        setIsProUser(false);
        return;
      }

      setBoardUserId(session.user.id);
      let unlocked = false;

      const emailLower = session.user.email?.toLowerCase().trim() || "";
      const isAdmin = emailLower === "caposion@gmail.com" || emailLower === "admin@tacpadel.com";
      if (isAdmin) {
        const localOverride = localStorage.getItem("tacpadel_is_pro");
        unlocked = localOverride === null ? true : localOverride === "true";
      } else {
        const { data: statsData } = await supabase
          .from("user_stats")
          .select("is_pro")
          .eq("id", session.user.id)
          .maybeSingle();

        unlocked = Boolean(statsData?.is_pro);
        localStorage.setItem("tacpadel_is_pro", String(unlocked));
      }

      setIsProUser(unlocked);

      if (unlocked) {
        const stats = await fetchCoachStats(session.user.id);
        const { scenarios } = buildSmartWeaknessPool(stats, 8);
        setWeaknessPool(scenarios);
      }
    }
    checkAccessAndCoachData();
  }, []);

  // Falls Zugriff entzogen wird, sicher aus Studio/Drill zurückfallen
  useEffect(() => {
    if (!isProUser) {
      if (activeMode === "studio") setActiveMode("tactics");
      if (activeDrillIdx !== null) {
        setActiveDrillIdx(null);
        setDrillResult(null);
      }
    }
  }, [isProUser, activeMode, activeDrillIdx]);

  // --- TACTICAL STUDIO STATES (Zeichnen, Aufnehmen, Teilen) ---
  const [studioTool, setStudioTool] = useState<StudioTool>("move");
  const [studioTitle, setStudioTitle] = useState<string>(() => t("tb_default_studio_title"));
  const [drawings, setDrawings] = useState<StudioDrawing[]>([]);
  const [currentDraft, setCurrentDraft] = useState<StudioDrawing | null>(null);

  // Rekorder & Export States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recSeconds, setRecSeconds] = useState<number>(0);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [exportMedia, setExportMedia] = useState<{
    url: string;
    file: File;
    type: "image" | "video";
  } | null>(null);

  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState<TacticalFilters>({
    showBallVector: true,
    showMovements: true,
    showWeaknessZones: true,
    showTeamLines: true,
    showPulse: true,
    showAttackArc: false,
    showAngleCone: true,
  });

  // Basis-Nutzer erhalten eine saubere Kern-Analyse (Gummiband inkl. Tiefen-Riss + Zielvektor)
  const effectiveFilters: TacticalFilters = useMemo(() => {
    if (isProUser) return filters;
    return {
      showBallVector: true,
      showTeamLines: true,
      showWeaknessZones: false,
      showMovements: false,
      showPulse: false,
      showAttackArc: false,
      showAngleCone: false,
    };
  }, [isProUser, filters]);

  const netX = V_WIDTH / 2;
  const offsetX = 10 + (V_WIDTH - 20) * 0.15;

  const analysis = useMemo(
    () =>
      getTacticalAnalysis(
        items,
        effectiveFilters,
        selectedScenarioKey,
        isProUser ? customTarget : null,
        t,
        lang
      ),
    [items, effectiveFilters, selectedScenarioKey, customTarget, isProUser, lang]
  );

  const activeDrill = activeDrillIdx !== null ? BOARD_DRILLS[activeDrillIdx] : null;
  const allDrawingsToRender = currentDraft ? [...drawings, currentDraft] : drawings;

  const liveStateRef = useRef({
    items,
    drawings: allDrawingsToRender,
    showTactics,
    filters: effectiveFilters,
    analysis,
    studioTitle,
  });

  useEffect(() => {
    liveStateRef.current = {
      items,
      drawings: allDrawingsToRender,
      showTactics,
      filters: effectiveFilters,
      analysis,
      studioTitle,
    };
  }, [items, allDrawingsToRender, showTactics, effectiveFilters, analysis, studioTitle]);

  const toggleFilter = (key: keyof TacticalFilters) => {
    if (!isProUser) return;
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setActiveDrillIdx(null);
    setDrillResult(null);
    setSelectedScenarioKey(key);
    setCustomTarget(null);

    if (key.startsWith("trainer_") && isProUser) {
      const scId = parseInt(key.replace("trainer_", ""), 10);
      const found = TRAINER_SCENARIOS.find((s) => s.id === scId) || null;
      if (found) {
        setLoadedTrainerScenario(found);
        setItems(trainerScenarioToBoardItems(found));
        setShowTactics(true);
      }
      return;
    }

    setLoadedTrainerScenario(null);
    if (SCENARIOS[key]) {
      setItems(SCENARIOS[key].items);
      if (isProUser && key === "angriff_dynamisch") {
        setFilters((prev) => ({ ...prev, showAttackArc: true }));
      }
    }
  };

  // --- COACH-DRILL STARTEN & PRÜFEN ---
  const startBoardDrill = (index: number = 0) => {
    if (!isProUser) return;
    const safeIdx = index % BOARD_DRILLS.length;
    const drill = BOARD_DRILLS[safeIdx];
    setActiveDrillIdx(safeIdx);
    setDrillResult(null);
    setLoadedTrainerScenario(null);
    setSelectedScenarioKey("custom");
    setCustomTarget(null);
    setShowTactics(true);
    setItems(drill.items.map((item) => ({ ...item })));
  };

  const evaluateActiveDrill = () => {
    if (!activeDrill) return;
    const a1 = items.find((i) => i.id === "a1");
    const a2 = items.find((i) => i.id === "a2");
    const ball = items.find((i) => i.id === "ball");
    if (!a1 || !a2 || !ball) return;

    const lateralGap = Math.abs(a1.y - a2.y);
    const depthGap = Math.abs(a1.x - a2.x);
    const avgX = (a1.x + a2.x) / 2;
    const avgY = (a1.y + a2.y) / 2;

    const cone = getDangerAngleCone(ball);

    const middleOk = lateralGap >= 85 && lateralGap <= 178;
    const parallelOk = depthGap <= 78;
    const depthOk =
      activeDrill.targetDepth === "back"
        ? avgX <= 175
        : activeDrill.targetDepth === "net"
        ? avgX >= 245
        : avgX >= 145 && avgX <= 260;
    const angleOk = Math.abs(avgY - cone.bisectorY) <= 78;

    const checks = [
      {
        label:
          lang === "en"
            ? "Middle closed (compact spacing)"
            : lang === "es"
            ? "Centro cerrado (distancia compacta)"
            : "Mitte dicht (kompakter Abstand)",
        ok: middleOk,
      },
      {
        label:
          lang === "en"
            ? "Parallel pair (no depth split)"
            : lang === "es"
            ? "Pareja paralela (sin brecha)"
            : "Kein Tiefen-Riss (parallel im Team)",
        ok: parallelOk,
      },
      {
        label:
          activeDrill.targetDepth === "net"
            ? lang === "en"
              ? "Net dominance (advanced together)"
              : lang === "es"
              ? "Dominio de red (subida juntos)"
              : "Netzposition eingenommen"
            : lang === "en"
            ? "Safe defensive depth"
            : lang === "es"
            ? "Profundidad defensiva segura"
            : "Sichere Abwehr-Tiefe",
        ok: depthOk,
      },
      {
        label:
          lang === "en"
            ? "Ball-side angle coverage"
            : lang === "es"
            ? "Cobertura de ángulo hacia la bola"
            : "Winkel zur Ballseite abgedeckt",
        ok: angleOk,
      },
    ];

    const passedCount = checks.filter((c) => c.ok).length;
    const scorePct = Math.round((passedCount / checks.length) * 100);
    const passed = passedCount >= 3;

    setDrillResult({ scorePct, passed, checks });
    recordBoardDrill({
      userId: boardUserId,
      scorePct,
      passed,
    });
  };

  // === VISUELLE UMRECHNUNG FÜR VERTIKAL-TOUCH ===
  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const SVG_VIEW_X = -60;
    const SVG_VIEW_Y = -60;
    const SVG_VIEW_W = 500;
    const SVG_VIEW_H = 880;

    const vX = ((clientX - rect.left) / rect.width) * SVG_VIEW_W + SVG_VIEW_X;
    const vY = ((clientY - rect.top) / rect.height) * SVG_VIEW_H + SVG_VIEW_Y;

    return {
      x: V_WIDTH - vY,
      y: vX,
    };
  }, []);

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    if (!isProUser || activeDrill) return;
    if (activeMode === "studio" && studioTool !== "move") return;
    const pt = getPoint(e);
    setCustomTarget({ x: pt.x, y: pt.y });
    setSelectedScenarioKey("custom");
  };

  const handleSvgPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProUser && activeMode === "studio" && studioTool !== "move") {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      setCurrentDraft({
        id: `draw-${Date.now()}`,
        type: studioTool,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
      });
      return;
    }

    if (isProUser && !activeDrill && "touches" in e) {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        const pt = getPoint(e);
        setCustomTarget({ x: pt.x, y: pt.y });
        setSelectedScenarioKey("custom");
      }
      lastTapRef.current = now;
    }
  };

  const onPointerDown = useCallback(
    (id: string, e: React.MouseEvent | React.TouchEvent) => {
      if (isProUser && activeMode === "studio" && studioTool !== "move") {
        handleSvgPointerDown(e);
        return;
      }

      // Im aktiven Coach-Drill dürfen nur Team A (A1 & A2) verschoben werden
      if (activeDrill && !id.startsWith("a")) {
        return;
      }

      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const partnerId =
        id === "a1" ? "a2" : id === "a2" ? "a1" : id === "b1" ? "b2" : id === "b2" ? "b1" : null;
      const partner = items.find((i) => i.id === partnerId);
      const gapY = partner ? partner.y - item.y : 0;

      dragRef.current = { id, ox: pt.x - item.x, oy: pt.y - item.y, gapY, partnerId };
      setActiveId(id);
      if (!activeDrill) {
        setSelectedScenarioKey("custom");
        setLoadedTrainerScenario(null);
      } else {
        setDrillResult(null);
      }
    },
    [items, getPoint, activeMode, studioTool, isProUser, activeDrill]
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (currentDraft) {
        if (e.cancelable) e.preventDefault();
        const pt = getPoint(e);
        setCurrentDraft((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
        return;
      }

      if (!dragRef.current) return;
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      const { id, ox, oy, gapY, partnerId } = dragRef.current;

      setItems((prev) => {
        const itemToMove = prev.find((i) => i.id === id);
        if (!itemToMove) return prev;

        let minX = 16;
        let maxX = V_WIDTH - 16;

        if (id === "ball" && effectiveFilters.showAttackArc) {
          const newX = Math.max(16, Math.min(V_WIDTH - 16, pt.x - ox));
          const newY = Math.max(16, Math.min(V_HEIGHT - 16, pt.y - oy));
          const ballRatio = Math.max(0, Math.min(1, newY / V_HEIGHT));

          const isTeamAAttacking = newX > netX;

          const pTeamA = prev.filter((i) => i.id.startsWith("a"));
          const pTeamB = prev.filter((i) => i.id.startsWith("b"));
          const simBall = { x: newX, y: newY };
          const { targetY: simTargetY } = getTacticalTargetAndRec(
            simBall,
            pTeamA,
            pTeamB,
            effectiveFilters,
            selectedScenarioKey,
            isProUser ? customTarget : null,
            t,
            lang
          );
          const targetRatio = Math.max(0, Math.min(1, simTargetY / V_HEIGHT));

          return prev.map((item) => {
            if (item.id === "ball") return { ...item, x: newX, y: newY };

            if (item.isPlayer) {
              const isAttacker = isTeamAAttacking ? item.id.startsWith("a") : item.id.startsWith("b");

              if (isAttacker) {
                const targetYPos =
                  item.id === "a1" || item.id === "b1"
                    ? 110 + (targetRatio - 0.5) * 160
                    : 270 + (targetRatio - 0.5) * 160;
                return { ...item, x: getArcX(targetYPos, item.id.startsWith("a")), y: targetYPos };
              } else {
                const targetX = isTeamAAttacking ? V_WIDTH - 80 : 80;
                const isPlayer1 = item.id === "a1" || item.id === "b1";
                const targetYPos = isPlayer1
                  ? 110 + (ballRatio - 0.5) * 160
                  : 270 + (ballRatio - 0.5) * 160;
                return { ...item, x: targetX, y: targetYPos };
              }
            }
            return item;
          });
        }

        if (id.startsWith("a")) {
          maxX = netX - 15;
        } else if (id.startsWith("b") && id !== "ball") {
          minX = netX + 15;
        }

        let newX = Math.max(minX, Math.min(maxX, pt.x - ox));
        let newY = Math.max(16, Math.min(V_HEIGHT - 16, pt.y - oy));

        if (effectiveFilters.showAttackArc && itemToMove.isPlayer && !activeDrill) {
          const ballItem = prev.find((i) => i.id === "ball");
          const isTeamAAttacking = ballItem ? ballItem.x > netX : false;
          const isTeamA = id.startsWith("a");

          if ((isTeamA && isTeamAAttacking) || (!isTeamA && !isTeamAAttacking)) {
            let partnerNewY = newY + gapY;

            if (partnerNewY < 16) {
              partnerNewY = 16;
              newY = partnerNewY - gapY;
            } else if (partnerNewY > V_HEIGHT - 16) {
              partnerNewY = V_HEIGHT - 16;
              newY = partnerNewY - gapY;
            }

            newX = getArcX(newY, isTeamA);
            const partnerNewX = getArcX(partnerNewY, isTeamA);

            return prev.map((item) => {
              if (item.id === id) return { ...item, x: newX, y: newY };
              if (item.id === partnerId) return { ...item, x: partnerNewX, y: partnerNewY };
              return item;
            });
          }
        }

        return prev.map((item) => {
          if (item.id === id) return { ...item, x: newX, y: newY };
          return item;
        });
      });
    },
    [getPoint, effectiveFilters, selectedScenarioKey, customTarget, currentDraft, netX, t, lang, isProUser, activeDrill]
  );

  const onPointerUp = useCallback(() => {
    if (currentDraft) {
      const dist = Math.hypot(currentDraft.x2 - currentDraft.x1, currentDraft.y2 - currentDraft.y1);
      if (dist > 12 || currentDraft.type === "zone_circle") {
        const finalDraft =
          currentDraft.type === "zone_circle" && dist < 20
            ? { ...currentDraft, x2: currentDraft.x1 + 32, y2: currentDraft.y1 }
            : currentDraft;
        setDrawings((prev) => [...prev, finalDraft]);
      }
      setCurrentDraft(null);
    }
    dragRef.current = null;
    setActiveId(null);
  }, [currentDraft]);

  const reset = () => {
    setActiveDrillIdx(null);
    setDrillResult(null);
    setLoadedTrainerScenario(null);
    setSelectedScenarioKey("initial");
    setCustomTarget(null);
    setItems(SCENARIOS.initial.items);
  };

  // =========================================================================
  // SYNCHRONER 30-FPS CANVAS-RENDERER
  // =========================================================================
  const drawBoardFrameSynchronously = useCallback((): HTMLCanvasElement | null => {
    let canvas = recCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 880;
      recCanvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const state = liveStateRef.current;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(60, 60);
    ctx.transform(0, -1, 1, 0, 0, 760);

    ctx.fillStyle = "#1034A6";
    ctx.fillRect(10, 10, V_WIDTH - 20, V_HEIGHT - 20);

    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 4;
    ctx.strokeRect(-30, -30, 820, 440);

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, V_WIDTH - 20, V_HEIGHT - 20);

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offsetX, 10);
    ctx.lineTo(offsetX, V_HEIGHT - 10);
    ctx.moveTo(V_WIDTH - offsetX, 10);
    ctx.lineTo(V_WIDTH - offsetX, V_HEIGHT - 10);
    ctx.moveTo(offsetX, V_HEIGHT / 2);
    ctx.lineTo(V_WIDTH - offsetX, V_HEIGHT / 2);
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.fillRect(netX - 2, 10, 4, V_HEIGHT - 20);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(netX, 10);
    ctx.lineTo(netX, V_HEIGHT - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawArrowhead = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      size: number = 12
    ) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    };

    if (state.showTactics) {
      const ball = state.items.find((i) => i.id === "ball");

      // Gefahrenwinkel-Kegel + Winkelhalbierende im Export
      if (state.filters.showAngleCone && ball) {
        const cone = getDangerAngleCone(ball);
        ctx.fillStyle = "rgba(250, 204, 21, 0.13)";
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(cone.farX, cone.topCornerY);
        ctx.lineTo(cone.farX, cone.bottomCornerY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(cone.farX, cone.bisectorY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (state.filters.showWeaknessZones && ball) {
        const pair =
          ball.x <= netX
            ? [state.items.find((i) => i.id === "b1"), state.items.find((i) => i.id === "b2")]
            : [state.items.find((i) => i.id === "a1"), state.items.find((i) => i.id === "a2")];
        if (pair[0] && pair[1]) {
          const gap = Math.abs(pair[0].y - pair[1].y);
          const avgX = (pair[0].x + pair[1].x) / 2;
          const avgY = (pair[0].y + pair[1].y) / 2;
          if (gap > GAP_THRESHOLD + 2) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
            ctx.fillRect(avgX - 30, avgY - 80, 60, 160);
          }
        }
      }

      if (state.filters.showTeamLines) {
        const teamA = state.items.filter((i) => i.id.startsWith("a"));
        if (teamA.length >= 2) {
          const distA = Math.hypot(teamA[0].x - teamA[1].x, teamA[0].y - teamA[1].y);
          const depthGapA = Math.abs(teamA[0].x - teamA[1].x);
          ctx.strokeStyle =
            distA > WIDE_GAP_THRESHOLD || depthGapA > DEPTH_GAP_THRESHOLD ? "#e74c3c" : "#2ecc71";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(teamA[0].x, teamA[0].y);
          ctx.lineTo(teamA[1].x, teamA[1].y);
          ctx.stroke();
        }
        const teamB = state.items.filter((i) => i.id.startsWith("b"));
        if (teamB.length >= 2) {
          const distB = Math.hypot(teamB[0].x - teamB[1].x, teamB[0].y - teamB[1].y);
          const depthGapB = Math.abs(teamB[0].x - teamB[1].x);
          ctx.strokeStyle =
            distB > WIDE_GAP_THRESHOLD || depthGapB > DEPTH_GAP_THRESHOLD ? "#e74c3c" : "#2ecc71";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(teamB[0].x, teamB[0].y);
          ctx.lineTo(teamB[1].x, teamB[1].y);
          ctx.stroke();
        }
      }

      if (state.analysis && state.filters.showBallVector && ball) {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 2]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(state.analysis.targetX, state.analysis.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowhead(ball.x, ball.y, state.analysis.targetX, state.analysis.targetY, "#facc15", 13);
      }

      if (state.analysis && state.filters.showMovements) {
        state.items
          .filter((item) => item.isPlayer)
          .forEach((player) => {
            const move = state.analysis?.movements?.[player.id];
            if (!move || Math.hypot(move.tx - player.x, move.ty - player.y) < 12) return;
            const angle = Math.atan2(move.ty - player.y, move.tx - player.x);
            const startX = player.x + Math.cos(angle) * 17;
            const startY = player.y + Math.sin(angle) * 17;
            ctx.strokeStyle = "#5cd6ff";
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(move.tx, move.ty);
            ctx.stroke();
            ctx.setLineDash([]);
            drawArrowhead(startX, startY, move.tx, move.ty, "#5cd6ff", 11);
          });
      }
    }

    state.drawings.forEach((d) => {
      if (d.type === "zone_circle") {
        const radius = Math.max(18, Math.hypot(d.x2 - d.x1, d.y2 - d.y1));
        ctx.fillStyle = "rgba(236, 72, 153, 0.22)";
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(d.x1, d.y1, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      const isRun = d.type === "arrow_run";
      const color = isRun ? "#00f0ff" : "#fbbf24";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.setLineDash(isRun ? [] : [8, 5]);
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowhead(d.x1, d.y1, d.x2, d.y2, color, 14);
    });

    state.items.forEach((item) => {
      const r = item.isPlayer ? 16 : 10;
      ctx.fillStyle = item.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = item.color === "#f1c40f" ? "#000000" : "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();

    ctx.fillStyle = "rgba(4, 9, 20, 0.94)";
    ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 48);
    ctx.lineTo(canvas.width, canvas.height - 48);
    ctx.stroke();

    ctx.fillStyle = "#22d3ee";
    ctx.font = "900 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("TACPADEL • TACTICAL COACH", 16, canvas.height - 19);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      (state.studioTitle || t("tb_watermark_fallback")).toUpperCase(),
      canvas.width - 16,
      canvas.height - 19
    );

    return canvas;
  }, [netX, offsetX, t]);

  // 📸 1. FOTO SNAPSHOT ERSTELLEN
  const handleTakeSnapshot = () => {
    const canvas = drawBoardFrameSynchronously();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `tacpadel-tactic-${Date.now()}.png`, {
        type: "image/png",
        lastModified: Date.now(),
      });
      const url = URL.createObjectURL(blob);
      setExportMedia({ url, file, type: "image" });
    }, "image/png");
  };

  // 🔴 2. VIDEO-AUFNAHME (SHORTCLIP) MIT ECHTEN 30 FPS STARTEN / STOPPEN
  const startVideoRecording = () => {
    const canvas = drawBoardFrameSynchronously();
    if (!canvas || typeof MediaRecorder === "undefined") {
      alert(t("tb_alert_no_video"));
      return;
    }

    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
    if (!stream) {
      alert(t("tb_alert_no_stream"));
      return;
    }

    const mimeCandidates = [
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp8",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    const supportedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

    recChunksRef.current = [];
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: 1500000,
    };
    if (supportedMime) options.mimeType = supportedMime;

    const recorder = new MediaRecorder(stream, options);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const rawMime = recorder.mimeType || supportedMime || "video/webm";
      const isMp4 = rawMime.toLowerCase().includes("mp4");
      const cleanMime = isMp4 ? "video/mp4" : "video/webm";
      const ext = isMp4 ? "mp4" : "webm";

      const blob = new Blob(recChunksRef.current, { type: cleanMime });
      const file = new File([blob], `tacpadel-clip-${Date.now()}.${ext}`, {
        type: cleanMime,
        lastModified: Date.now(),
      });
      const url = URL.createObjectURL(blob);
      setExportMedia({ url, file, type: "video" });
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setRecSeconds(0);

    recFrameIntervalRef.current = setInterval(() => {
      drawBoardFrameSynchronously();
    }, 33);

    recTimerRef.current = setInterval(() => {
      setRecSeconds((s) => s + 1);
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (recFrameIntervalRef.current) clearInterval(recFrameIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (recFrameIntervalRef.current) clearInterval(recFrameIntervalRef.current);
    };
  }, []);

  // Hilfsfunktion: File -> Base64 für Capacitor Filesystem
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // 📲 3. NATIVES TEILEN (Capacitor Share + Filesystem für iOS/Android, Web-Fallback)
  const handleNativeShare = async () => {
    if (!exportMedia || isSharing) return;
    setIsSharing(true);

    const shareText = `${t("tb_share_text_1")} "${studioTitle}" ${t("tb_share_text_2")}`;

    try {
      if (Capacitor.isNativePlatform()) {
        const base64Data = await fileToBase64(exportMedia.file);
        const cached = await Filesystem.writeFile({
          path: exportMedia.file.name,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: studioTitle || "TacPadel",
          text: exportMedia.type === "image" ? shareText : undefined,
          files: [cached.uri],
          dialogTitle: studioTitle || "TacPadel",
        });

        setIsSharing(false);
        return;
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        const canShareFile =
          !navigator.canShare || navigator.canShare({ files: [exportMedia.file] });

        if (canShareFile) {
          try {
            if (exportMedia.type === "video") {
              await navigator.share({
                files: [exportMedia.file],
                title: studioTitle || "TacPadel",
              });
            } else {
              await navigator.share({
                files: [exportMedia.file],
                title: studioTitle || "TacPadel",
                text: shareText,
              });
            }
            setIsSharing(false);
            return;
          } catch (innerErr: any) {
            if (innerErr?.name === "AbortError") {
              setIsSharing(false);
              return;
            }
            try {
              await navigator.share({ files: [exportMedia.file] });
              setIsSharing(false);
              return;
            } catch (retryErr: any) {
              if (retryErr?.name === "AbortError") {
                setIsSharing(false);
                return;
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setIsSharing(false);
        return;
      }
    }

    handleDownloadMedia();
    setIsSharing(false);
    alert(t("tb_alert_video_saved"));
  };

  const handleDownloadMedia = () => {
    if (!exportMedia) return;
    const a = document.createElement("a");
    a.href = exportMedia.url;
    a.download = exportMedia.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Sichtbare Standard-Aufstellungen (Basis sieht 2, erweiterter Zugriff sieht alle 5)
  const visiblePresetEntries = useMemo(() => {
    return Object.entries(SCENARIOS).filter(([, val]) => isProUser || val.basicVisible);
  }, [isProUser]);

  const loadedScenarioDesc = loadedTrainerScenario
    ? (lang === "en" && (loadedTrainerScenario as any).description_en) ||
      (lang === "es" && (loadedTrainerScenario as any).description_es) ||
      loadedTrainerScenario.description
    : null;

  const loadedScenarioExpl = loadedTrainerScenario
    ? (lang === "en" && (loadedTrainerScenario as any).explanation_en) ||
      (lang === "es" && (loadedTrainerScenario as any).explanation_es) ||
      loadedTrainerScenario.explanation
    : null;

  const ballItem = items.find((i) => i.id === "ball");
  const angleCone = ballItem ? getDangerAngleCone(ballItem) : null;

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full flex-1 py-4 overflow-hidden">
      {/* ================================================================= */}
      {/* EXPORT & SHARE VORSCHAU-MODAL (Für aufgenommene Fotos & Videos)   */}
      {/* ================================================================= */}
      {exportMedia && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#050b18] border border-cyan-500/50 p-5 sm:p-6 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] max-w-md w-full flex flex-col items-center gap-4 relative overflow-hidden">
            <div className="flex justify-between items-center w-full border-b border-slate-800 pb-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 block">
                  {t("tb_export_badge")}
                </span>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {exportMedia.type === "video" ? t("tb_export_video_title") : t("tb_export_img_title")}
                </h3>
              </div>
              <button
                onClick={() => setExportMedia(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="w-full max-h-[52vh] bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {exportMedia.type === "video" ? (
                <video
                  src={exportMedia.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[50vh] w-auto object-contain"
                />
              ) : (
                <img
                  src={exportMedia.url}
                  alt="Taktik Snapshot"
                  className="max-h-[50vh] w-auto object-contain"
                />
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                onClick={handleNativeShare}
                disabled={isSharing}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
              >
                <span>{isSharing ? t("tb_export_sharing") : t("tb_export_share_btn")}</span>
              </button>
              <button
                onClick={handleDownloadMedia}
                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-700 transition-all"
              >
                {t("tb_export_save_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DYNAMISCHER TOGGLE-SCHALTER (2D | [STUDIO] | 3D)                  */}
      {/* ================================================================= */}
      <div className="w-full max-w-5xl flex flex-col items-center mb-1 px-3">
        <div
          className={`bg-[#050b18] p-1.5 rounded-full shadow-lg border border-slate-800 grid ${
            isProUser ? "grid-cols-3 max-w-lg" : "grid-cols-2 max-w-md"
          } relative w-full`}
        >
          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              setActiveMode("tactics");
            }}
            className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all ${
              activeMode === "tactics"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("tb_mode_2d")}
          </button>

          {isProUser && (
            <button
              onClick={() => setActiveMode("studio")}
              className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all flex items-center justify-center gap-1 ${
                activeMode === "studio"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                  : "text-pink-400 hover:text-pink-300"
              }`}
            >
              <span>🎬 Studio</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              setActiveMode("3d");
            }}
            className={`py-2 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all ${
              activeMode === "3d"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("tb_mode_3d")}
          </button>
        </div>
      </div>

      {/* --- RENDERN BASIEREND AUF DEM SCHALTER --- */}
      {activeMode === "3d" ? (
        <TrajectoryView3D />
      ) : (
        <>
          {/* ============================================================= */}
          {/* TACTICAL STUDIO WERKZEUGLEISTE                                */}
          {/* ============================================================= */}
          {activeMode === "studio" && isProUser && (
            <div className="w-full max-w-[600px] px-3 flex flex-col gap-2.5 animate-in fade-in">
              <div className="bg-[#050b18] border border-pink-500/40 rounded-2xl p-3 sm:p-4 shadow-[0_0_25px_rgba(236,72,153,0.12)] flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 shrink-0">
                      🎬 STUDIO
                    </span>
                    <input
                      type="text"
                      value={studioTitle}
                      onChange={(e) => setStudioTitle(e.target.value)}
                      placeholder={t("tb_studio_title_placeholder")}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-pink-500 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleTakeSnapshot}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      {t("tb_studio_photo_btn")}
                    </button>

                    {!isRecording ? (
                      <button
                        onClick={startVideoRecording}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>{t("tb_studio_rec_btn")}</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopVideoRecording}
                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)] flex items-center justify-center gap-1.5"
                      >
                        <span>
                          {t("tb_studio_stop_btn")} ({recSeconds}s)
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setStudioTool("move")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "move"
                        ? "bg-white text-black border-white shadow-md"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {t("tb_tool_move")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_run")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_run"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-cyan-300"
                    }`}
                  >
                    {t("tb_tool_run")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_ball")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_ball"
                        ? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300"
                    }`}
                  >
                    {t("tb_tool_ball")}
                  </button>
                  <button
                    onClick={() => setStudioTool("zone_circle")}
                    className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "zone_circle"
                        ? "bg-pink-500/20 text-pink-300 border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-pink-300"
                    }`}
                  >
                    {t("tb_tool_zone")}
                  </button>
                  <button
                    onClick={() => setDrawings((prev) => prev.slice(0, -1))}
                    disabled={drawings.length === 0}
                    className="col-span-2 sm:col-span-1 py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
                  >
                    {t("tb_tool_undo")}
                  </button>
                  <button
                    onClick={() => setDrawings([])}
                    disabled={drawings.length === 0}
                    className="col-span-2 sm:col-span-1 py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-40"
                  >
                    {t("tb_tool_clear")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* AKTIVER STELLUNGSSPIEL-DRILL BANNER (NUR WENN AKTIV)          */}
          {/* ============================================================= */}
          {isProUser && activeDrill && (
            <div className="w-full max-w-[600px] px-3">
              <div className="bg-[#050b18] border border-orange-500/50 rounded-2xl p-4 shadow-[0_0_25px_rgba(249,115,22,0.18)] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400 block">
                      🎯{" "}
                      {lang === "en"
                        ? `POSITIONING DRILL ${(activeDrillIdx ?? 0) + 1}/${BOARD_DRILLS.length}`
                        : lang === "es"
                        ? `DRILL DE POSICIÓN ${(activeDrillIdx ?? 0) + 1}/${BOARD_DRILLS.length}`
                        : `STELLUNGSSPIEL-DRILL ${(activeDrillIdx ?? 0) + 1}/${BOARD_DRILLS.length}`}
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-white">
                      {lang === "en"
                        ? activeDrill.title.en
                        : lang === "es"
                        ? activeDrill.title.es
                        : activeDrill.title.de}
                    </h4>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDrillIdx(null);
                      setDrillResult(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {lang === "en"
                    ? activeDrill.prompt.en
                    : lang === "es"
                    ? activeDrill.prompt.es
                    : activeDrill.prompt.de}
                </p>

                {drillResult ? (
                  <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          drillResult.passed ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {drillResult.passed
                          ? lang === "en"
                            ? "✅ Great Positioning!"
                            : lang === "es"
                            ? "✅ ¡Gran Posición!"
                            : "✅ Starkes Stellungsspiel!"
                          : lang === "en"
                          ? "⚠️ Almost – adjust your pair!"
                          : lang === "es"
                          ? "⚠️ Casi – ajusta la pareja"
                          : "⚠️ Noch Lücken – korrigiere A1 & A2!"}
                      </span>
                      <span className="text-sm font-black text-white">{drillResult.scorePct}%</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {drillResult.checks.map((c, idx) => (
                        <div
                          key={idx}
                          className={`px-2.5 py-1.5 rounded-lg border font-bold ${
                            c.ok
                              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                              : "bg-red-950/40 border-red-500/40 text-red-300"
                          }`}
                        >
                          {c.ok ? "✓" : "✗"} {c.label}
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-800/80">
                      💡{" "}
                      {lang === "en"
                        ? activeDrill.explanation.en
                        : lang === "es"
                        ? activeDrill.explanation.es
                        : activeDrill.explanation.de}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startBoardDrill(((activeDrillIdx ?? 0) + 1) % BOARD_DRILLS.length)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-[11px] uppercase tracking-wider"
                      >
                        {lang === "en"
                          ? "Next Drill →"
                          : lang === "es"
                          ? "Siguiente Drill →"
                          : "Nächster Drill →"}
                      </button>
                      {!drillResult.passed && (
                        <button
                          onClick={() => setDrillResult(null)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-black text-[11px] uppercase tracking-wider"
                        >
                          {lang === "en" ? "Retry" : lang === "es" ? "Reintentar" : "Nochmal"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={evaluateActiveDrill}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black text-xs uppercase tracking-widest transition-all"
                  >
                    {lang === "en"
                      ? "Check Positioning ✓"
                      : lang === "es"
                      ? "Comprobar Posición ✓"
                      : "Aufstellung prüfen ✓"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* --- DARK-MODE SZENARIO- & FILTER-PANEL --- */}
          {showTactics && !activeDrill && (
            <div className="w-full max-w-[600px] px-3 flex flex-col gap-3">
              <div className="p-3.5 sm:p-4 bg-[#050b18]/95 border border-slate-800 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-black block text-cyan-400 mb-0.5">
                    {t("tb_preset_badge")}
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-white">{t("tb_preset_title")}</h4>
                </div>
                <div className="relative w-full sm:w-72">
                  <select
                    value={selectedScenarioKey}
                    onChange={handleScenarioChange}
                    className="w-full px-3 py-2.5 bg-[#030611] border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer appearance-none pr-8"
                  >
                    <optgroup label={lang === "en" ? "Standard Formations" : lang === "es" ? "Formaciones" : "Standard-Aufstellungen"}>
                      {visiblePresetEntries.map(([key, value]) => (
                        <option key={key} value={key} className="bg-[#050b18] text-white">
                          {t(value.nameKey)}
                        </option>
                      ))}
                    </optgroup>

                    {isProUser && weaknessPool.length > 0 && (
                      <optgroup label={lang === "en" ? "Coach Focus (Your Weaknesses)" : lang === "es" ? "Enfoque Coach (Debilidades)" : "Coach-Fokus (Deine Baustellen)"}>
                        {weaknessPool.map((sc) => (
                          <option key={`weak-${sc.id}`} value={`trainer_${sc.id}`} className="bg-[#050b18] text-amber-300">
                            🎯 #{sc.id} – {sc.validShots[0] || "Taktik"}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {isProUser && (
                      <optgroup label={lang === "en" ? "All Trainer Scenarios (1–111)" : lang === "es" ? "Todos los Escenarios" : "Alle Trainer-Szenarien (1–111)"}>
                        {TRAINER_SCENARIOS.map((sc, idx) => (
                          <option key={`tr-${sc.id}-${idx}`} value={`trainer_${sc.id}`} className="bg-[#050b18] text-slate-200">
                            #{sc.id} – {sc.validShots[0] || "Szenario"}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <option value="custom" disabled className="bg-[#050b18] text-slate-500">
                      {t("tb_preset_custom")}
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Geladenes Trainer-Szenario Kontext-Karte */}
              {isProUser && loadedTrainerScenario && loadedScenarioDesc && (
                <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/40 rounded-xl flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                      🧠 Coach-Szenario #{loadedTrainerScenario.id}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300">
                      {loadedTrainerScenario.validShots.join(" / ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-semibold leading-snug">
                    {loadedScenarioDesc}
                  </p>
                  {loadedScenarioExpl && (
                    <p className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-cyan-500/20">
                      💡 {loadedScenarioExpl}
                    </p>
                  )}
                </div>
              )}

              {/* Erweiterte Taktik-Filter (nur bei isProUser sichtbar) */}
              {isProUser && (
                <div className="p-3.5 sm:p-4 bg-[#050b18]/95 border border-slate-800 rounded-xl shadow-lg w-full">
                  <span className="text-[10px] uppercase tracking-widest font-black block mb-2.5 text-slate-400">
                    {t("tb_filter_title")}
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <label className="flex items-center gap-2 bg-amber-950/30 hover:bg-amber-950/50 px-2.5 py-1.5 rounded-lg border border-amber-500/40 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showAngleCone}
                        onChange={() => toggleFilter("showAngleCone")}
                        className="rounded text-amber-500 w-3.5 h-3.5"
                      />
                      <span className="font-bold text-amber-200">
                        {lang === "en" ? "Angle Cone" : lang === "es" ? "Cono de Ángulo" : "Winkel-Kegel"}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 bg-indigo-950/40 hover:bg-indigo-950/60 px-2.5 py-1.5 rounded-lg border border-indigo-500/40 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showAttackArc}
                        onChange={() => toggleFilter("showAttackArc")}
                        className="rounded text-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="font-bold text-indigo-200">{t("tb_filter_arc")}</span>
                    </label>

                    <label className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showBallVector}
                        onChange={() => toggleFilter("showBallVector")}
                        className="rounded text-yellow-400 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-200">{t("tb_filter_vector")}</span>
                    </label>

                    <label className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showMovements}
                        onChange={() => toggleFilter("showMovements")}
                        className="rounded text-cyan-400 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-200">{t("tb_filter_moves")}</span>
                    </label>

                    <label className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showWeaknessZones}
                        onChange={() => toggleFilter("showWeaknessZones")}
                        className="rounded text-red-400 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-200">{t("tb_filter_weakness")}</span>
                    </label>

                    <label className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showTeamLines}
                        onChange={() => toggleFilter("showTeamLines")}
                        className="rounded text-emerald-400 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-200">{t("tb_filter_teamlines")}</span>
                    </label>

                    <label className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={filters.showPulse}
                        onChange={() => toggleFilter("showPulse")}
                        className="rounded text-white w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-200">{t("tb_filter_pulse")}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            ref={containerRef}
            className="w-full max-w-[600px] mx-auto px-3 flex-1 flex flex-col items-center justify-center min-h-[300px]"
          >
            <svg
              ref={svgRef}
              viewBox="-60 -60 500 880"
              className={`rounded-xl shadow-2xl border-4 w-full h-auto max-h-[75vh] touch-none select-none overflow-hidden ${
                isRecording
                  ? "border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)]"
                  : activeDrill
                  ? "border-orange-500/70 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                  : activeMode === "studio"
                  ? "border-pink-500/60"
                  : "border-[#111]"
              }`}
              style={{
                background: "#050505",
                display: "block",
                touchAction: "none",
                cursor: activeMode === "studio" && studioTool !== "move" ? "crosshair" : "default",
              }}
              onMouseDown={handleSvgPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={handleSvgPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
              onTouchCancel={onPointerUp}
              onDoubleClick={handleSvgDoubleClick}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="yellow" />
                </marker>
                <marker id="moveArrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#5cd6ff" />
                </marker>
                <marker id="studioRunArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#00f0ff" />
                </marker>
                <marker id="studioBallArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
                </marker>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="-2" dy="0" stdDeviation="2" floodColor="rgba(0,0,0,0.5)" />
                </filter>
                <filter id="activeShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="-8" dy="0" stdDeviation="6" floodColor="rgba(0,0,0,0.6)" />
                </filter>

                <pattern id="turf" width="4" height="4" patternUnits="userSpaceOnUse">
                  <rect width="2" height="2" fill="rgba(0,0,0,0.06)" />
                  <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,0.06)" />
                </pattern>

                <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <path d="M 0 6 L 6 0 M 0 0 L 6 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                </pattern>

                <linearGradient id="glassGradTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradBottom" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradLeft" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <linearGradient id="glassGradRight" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
              </defs>

              <g transform="matrix(0 -1 1 0 0 760)">
                <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="#1034A6" />
                <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="url(#turf)" />
                <rect x={10} y={10} width={V_WIDTH - 20} height={V_HEIGHT - 20} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.9} />
                <line x1={offsetX} y1={10} x2={offsetX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
                <line x1={V_WIDTH - offsetX} y1={10} x2={V_WIDTH - offsetX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
                <line x1={offsetX} y1={V_HEIGHT / 2} x2={V_WIDTH - offsetX} y2={V_HEIGHT / 2} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
                <rect x={netX - 2} y={10} width={4} height={V_HEIGHT - 20} fill="#111" />
                <line x1={netX} y1={10} x2={netX} y2={V_HEIGHT - 10} stroke="#ffffff" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />

                <g stroke="#555" strokeWidth="2" strokeLinejoin="round">
                  <polygon points="-30,-30 125,-30 150,10 10,10" fill="url(#glassGradTop)" />
                  <polygon points="125,-30 635,-30 610,10 150,10" fill="url(#mesh)" />
                  <polygon points="635,-30 790,-30 750,10 610,10" fill="url(#glassGradTop)" />
                  <polygon points="-30,410 125,410 150,370 10,370" fill="url(#glassGradBottom)" />
                  <polygon points="125,410 635,410 610,370 150,370" fill="url(#mesh)" />
                  <polygon points="635,410 790,410 750,370 610,370" fill="url(#glassGradBottom)" />
                  <polygon points="-30,-30 -30,410 10,370 10,10" fill="url(#glassGradLeft)" />
                  <polygon points="790,-30 790,410 750,370 750,10" fill="url(#glassGradRight)" />
                </g>

                <g stroke="#666" strokeWidth="3" strokeLinecap="round">
                  <rect x="-30" y="-30" width="820" height="440" fill="none" strokeWidth="4" />
                  <line x1="150" y1="10" x2="125" y2="-30" />
                  <line x1="610" y1="10" x2="635" y2="-30" />
                  <line x1="150" y1="370" x2="125" y2="410" />
                  <line x1="610" y1="370" x2="635" y2="410" />
                  <line x1={netX} y1="10" x2={netX} y2="-30" />
                  <line x1={netX} y1="370" x2={netX} y2="410" />
                </g>

                <g stroke="#7f8c8d" strokeWidth="3">
                  <line x1="-30" y1="-30" x2="-50" y2="-50" />
                  <line x1="-55" y1="-45" x2="-45" y2="-55" stroke="#fff" strokeWidth="6" />
                  <line x1="790" y1="-30" x2="810" y2="-50" />
                  <line x1="805" y1="-55" x2="815" y2="-45" stroke="#fff" strokeWidth="6" />
                  <line x1="-30" y1="410" x2="-50" y2="430" />
                  <line x1="-55" y1="425" x2="-45" y2="435" stroke="#fff" strokeWidth="6" />
                  <line x1="790" y1="410" x2="810" y2="430" />
                  <line x1="805" y1="435" x2="815" y2="425" stroke="#fff" strokeWidth="6" />
                </g>

                <text x={netX} y={V_HEIGHT / 2} transform={`rotate(90 ${netX} ${V_HEIGHT / 2})`} textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity={0.25} fontSize={16} fontWeight="bold" letterSpacing="4">
                  {t("tb_court_net")}
                </text>
                <text x={offsetX / 2 + 5} y={V_HEIGHT - 18} transform={`rotate(90 ${offsetX / 2 + 5} ${V_HEIGHT - 18})`} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">
                  {t("tb_court_team_a")}
                </text>
                <text x={V_WIDTH - offsetX / 2 - 5} y={V_HEIGHT - 18} transform={`rotate(90 ${V_WIDTH - offsetX / 2 - 5} ${V_HEIGHT - 18})`} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={12} fontWeight="bold">
                  {t("tb_court_team_b")}
                </text>

                {showTactics && (
                  <>
                    {/* GEFAHRENWINKEL-KEGEL + WINKELHALBIERENDE */}
                    {effectiveFilters.showAngleCone && angleCone && ballItem && (
                      <g style={{ pointerEvents: "none" }}>
                        <polygon
                          points={angleCone.points}
                          fill="rgba(250, 204, 21, 0.13)"
                          stroke="rgba(250, 204, 21, 0.38)"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                        <line
                          x1={ballItem.x}
                          y1={ballItem.y}
                          x2={angleCone.farX}
                          y2={angleCone.bisectorY}
                          stroke="rgba(34, 211, 238, 0.55)"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      </g>
                    )}

                    {effectiveFilters.showAttackArc && (
                      <>
                        <path
                          d={`M ${getArcX(20, true)} 20 Q ${getControlPointX(true)} ${V_HEIGHT / 2} ${getArcX(V_HEIGHT - 20, true)} ${V_HEIGHT - 20}`}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.4)"
                          strokeWidth="4"
                          strokeDasharray="8 6"
                        />
                        <path
                          d={`M ${getArcX(20, false)} 20 Q ${getControlPointX(false)} ${V_HEIGHT / 2} ${getArcX(V_HEIGHT - 20, false)} ${V_HEIGHT - 20}`}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.4)"
                          strokeWidth="4"
                          strokeDasharray="8 6"
                        />
                      </>
                    )}

                    <line x1={V_WIDTH * 0.25} y1={10} x2={V_WIDTH * 0.25} y2={V_HEIGHT - 10} stroke="white" strokeWidth={1} strokeDasharray="4 4" opacity="0.3" />
                    <line x1={netX - 80} y1={10} x2={netX - 80} y2={V_HEIGHT - 10} stroke="white" strokeWidth={1} strokeDasharray="4 4" opacity="0.3" />

                    {effectiveFilters.showWeaknessZones &&
                      (() => {
                        const ball = items.find((i) => i.id === "ball");
                        if (!ball) return null;
                        if (ball.x <= netX) {
                          const b1 = items.find((i) => i.id === "b1");
                          const b2 = items.find((i) => i.id === "b2");
                          if (!b1 || !b2) return null;
                          const gap = Math.abs(b1.y - b2.y);
                          const depthGap = Math.abs(b1.x - b2.x);
                          const avgX = (b1.x + b2.x) / 2;
                          const avgY = (b1.y + b2.y) / 2;
                          return (
                            <>
                              {(gap > GAP_THRESHOLD + 2 || depthGap > DEPTH_GAP_THRESHOLD) && (
                                <rect x={avgX - 30} y={avgY - 80} width={60} height={160} fill="red" opacity="0.35" rx="8" />
                              )}
                              {avgX < netX + DEEP_DEF_THRESHOLD && (
                                <rect x={netX + 10} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />
                              )}
                            </>
                          );
                        } else {
                          const a1 = items.find((i) => i.id === "a1");
                          const a2 = items.find((i) => i.id === "a2");
                          if (!a1 || !a2) return null;
                          const gap = Math.abs(a1.y - a2.y);
                          const depthGap = Math.abs(a1.x - a2.x);
                          const avgX = (a1.x + a2.x) / 2;
                          const avgY = (a1.y + a2.y) / 2;
                          return (
                            <>
                              {(gap > GAP_THRESHOLD + 2 || depthGap > DEPTH_GAP_THRESHOLD) && (
                                <rect x={avgX - 30} y={avgY - 80} width={60} height={160} fill="red" opacity="0.35" rx="8" />
                              )}
                              {avgX > netX - DEEP_DEF_THRESHOLD && (
                                <rect x={netX - 60} y={12} width={50} height={V_HEIGHT - 24} fill="orange" opacity="0.2" />
                              )}
                            </>
                          );
                        }
                      })()}

                    {/* GUMMIBAND-LINIEN (INKL. TIEFEN-RISS-ERKENNUNG) */}
                    {effectiveFilters.showTeamLines &&
                      (() => {
                        const teamA = items.filter((i) => i.id.startsWith("a"));
                        if (teamA.length < 2) return null;
                        const distA = Math.hypot(teamA[0].x - teamA[1].x, teamA[0].y - teamA[1].y);
                        const depthGapA = Math.abs(teamA[0].x - teamA[1].x);
                        const isSplit = distA > WIDE_GAP_THRESHOLD || depthGapA > DEPTH_GAP_THRESHOLD;
                        return (
                          <line
                            x1={teamA[0].x}
                            y1={teamA[0].y}
                            x2={teamA[1].x}
                            y2={teamA[1].y}
                            stroke={isSplit ? "#e74c3c" : "#2ecc71"}
                            strokeWidth={4}
                          />
                        );
                      })()}

                    {effectiveFilters.showTeamLines &&
                      (() => {
                        const teamB = items.filter((i) => i.id.startsWith("b"));
                        if (teamB.length < 2) return null;
                        const distB = Math.hypot(teamB[0].x - teamB[1].x, teamB[0].y - teamB[1].y);
                        const depthGapB = Math.abs(teamB[0].x - teamB[1].x);
                        const isSplit = distB > WIDE_GAP_THRESHOLD || depthGapB > DEPTH_GAP_THRESHOLD;
                        return (
                          <line
                            x1={teamB[0].x}
                            y1={teamB[0].y}
                            x2={teamB[1].x}
                            y2={teamB[1].y}
                            stroke={isSplit ? "#e74c3c" : "#2ecc71"}
                            strokeWidth={4}
                          />
                        );
                      })()}

                    {effectiveFilters.showTeamLines && (
                      <line
                        x1={((items.find((i) => i.id === "a1")?.x || 0) + (items.find((i) => i.id === "a2")?.x || 0)) / 2}
                        y1={V_HEIGHT / 2}
                        x2={items.find((i) => i.id === "ball")?.x || 0}
                        y2={items.find((i) => i.id === "ball")?.y || 0}
                        stroke="#3498db"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    )}

                    {analysis && effectiveFilters.showBallVector && !activeDrill && (
                      <>
                        <line
                          x1={items.find((i) => i.id === "ball")?.x || 0}
                          y1={items.find((i) => i.id === "ball")?.y || 0}
                          x2={analysis.targetX}
                          y2={analysis.targetY}
                          stroke="yellow"
                          strokeWidth="4"
                          strokeDasharray="6 2"
                          markerEnd="url(#arrowhead)"
                        />
                        <g className="animate-pulse">
                          <circle cx={analysis.targetX} cy={analysis.targetY} r="14" fill="none" stroke="yellow" strokeWidth="2" opacity="0.85" />
                          <circle cx={analysis.targetX} cy={analysis.targetY} r="4" fill="yellow" />
                        </g>
                      </>
                    )}

                    {analysis &&
                      effectiveFilters.showMovements &&
                      !activeDrill &&
                      items
                        .filter((item) => item.isPlayer)
                        .map((player) => {
                          const move = analysis.movements?.[player.id];
                          if (!move) return null;
                          const angle = Math.atan2(move.ty - player.y, move.tx - player.x);
                          const startX = player.x + Math.cos(angle) * 17;
                          const startY = player.y + Math.sin(angle) * 17;
                          if (Math.hypot(move.tx - player.x, move.ty - player.y) < 12) return null;
                          return (
                            <line
                              key={`move-${player.id}`}
                              x1={startX}
                              y1={startY}
                              x2={move.tx}
                              y2={move.ty}
                              stroke="#5cd6ff"
                              strokeWidth="3"
                              strokeDasharray="4 3"
                              markerEnd="url(#moveArrowhead)"
                            />
                          );
                        })}
                  </>
                )}

                {/* ========================================================= */}
                {/* EINGEZEICHNETE TACTICAL STUDIO PFEILE & ZONEN             */}
                {/* ========================================================= */}
                {isProUser &&
                  allDrawingsToRender.map((d) => {
                    if (d.type === "zone_circle") {
                      const radius = Math.max(18, Math.hypot(d.x2 - d.x1, d.y2 - d.y1));
                      return (
                        <g key={d.id} style={{ pointerEvents: "none" }}>
                          <circle
                            cx={d.x1}
                            cy={d.y1}
                            r={radius}
                            fill="rgba(236, 72, 153, 0.22)"
                            stroke="#ec4899"
                            strokeWidth="3"
                            strokeDasharray="6 4"
                          />
                          <circle cx={d.x1} cy={d.y1} r="4" fill="#ec4899" />
                        </g>
                      );
                    }

                    const isRun = d.type === "arrow_run";
                    return (
                      <line
                        key={d.id}
                        x1={d.x1}
                        y1={d.y1}
                        x2={d.x2}
                        y2={d.y2}
                        stroke={isRun ? "#00f0ff" : "#fbbf24"}
                        strokeWidth="4"
                        strokeDasharray={isRun ? "none" : "8 5"}
                        markerEnd={isRun ? "url(#studioRunArrow)" : "url(#studioBallArrow)"}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  })}

                {/* Figuren */}
                {items.map((item) => {
                  const isDragging = activeId === item.id;
                  const baseR = item.isPlayer ? 16 : 10;
                  const r = isDragging ? baseR * 1.15 : baseR;
                  const isActivePlayer = showTactics && analysis && analysis.activePlayerId === item.id;
                  const isDrillMovable = !activeDrill || item.id.startsWith("a");

                  return (
                    <g
                      key={item.id}
                      style={{
                        cursor: !isDrillMovable ? "default" : isDragging ? "grabbing" : "grab",
                        opacity: !isDrillMovable ? 0.9 : 1,
                      }}
                      onMouseDown={(e) => onPointerDown(item.id, e)}
                      onTouchStart={(e) => onPointerDown(item.id, e)}
                    >
                      <circle cx={item.x} cy={item.y} r={baseR + 12} fill="transparent" />
                      {isActivePlayer && effectiveFilters.showPulse && (
                        <circle
                          cx={item.x}
                          cy={item.y}
                          r={r + 6}
                          fill="none"
                          stroke={item.id.startsWith("a") ? "#ffffff" : "#f1c40f"}
                          strokeWidth="3"
                          className="animate-ping"
                          style={{ transformOrigin: `${item.x}px ${item.y}px`, opacity: 0.6 }}
                        />
                      )}
                      <circle
                        cx={item.x}
                        cy={item.y}
                        r={r}
                        fill={item.color}
                        stroke={isActivePlayer ? "#ffffff" : "white"}
                        strokeWidth={isActivePlayer ? 4 : 2}
                        filter={isDragging ? "url(#activeShadow)" : "url(#shadow)"}
                      />
                      <text
                        x={item.x}
                        y={item.y}
                        transform={`rotate(90 ${item.x} ${item.y})`}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={item.color === "#f1c40f" ? "black" : "white"}
                        fontSize={item.isPlayer ? 11 : 12}
                        fontWeight="bold"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {showTactics && analysis && !activeDrill && (
              <div
                className={`mt-4 p-4 sm:p-5 rounded-2xl text-white shadow-2xl border w-full max-w-[600px] transition-all duration-300 ${analysis.color}`}
              >
                <h3 className="text-base sm:text-lg font-black mb-1.5 flex items-center gap-2">
                  <span className="text-lg sm:text-xl">📋</span> {analysis.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed font-medium text-slate-200">
                  {analysis.body}
                </p>
                <div className="mt-3 bg-black/30 p-3 sm:p-4 rounded-xl border border-white/15 backdrop-blur-sm">
                  <span className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-cyan-300">
                    {items.find((i) => i.id === "ball")!.x < netX
                      ? t("tb_rec_header_attack")
                      : t("tb_rec_header_defense")}
                  </span>
                  <span className="text-sm sm:text-lg font-black">{analysis.recommendation}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-white/15">
                  <span className="text-[10px] uppercase tracking-widest font-bold block mb-2 text-slate-400">
                    {t("tb_legend_title")}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-black/25 p-3 rounded-xl border border-white/10">
                    {effectiveFilters.showAngleCone && (
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 bg-yellow-400/25 border border-yellow-400/60 rounded inline-block" />
                        <span>
                          <strong className="text-amber-300">
                            {lang === "en" ? "Angle Cone:" : lang === "es" ? "Cono:" : "Winkel-Kegel:"}
                          </strong>{" "}
                          {lang === "en"
                            ? "Danger corridor & center bisector"
                            : lang === "es"
                            ? "Ángulos de tiro y bisectriz"
                            : "Gefahrenkorridor & Winkelhalbierende"}
                        </span>
                      </div>
                    )}
                    {effectiveFilters.showAttackArc && (
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-indigo-300 border-dashed inline-block" />
                        <span>
                          <strong className="text-indigo-200">{t("tb_leg_arc_b")}</strong>{" "}
                          {t("tb_leg_arc_t")}
                        </span>
                      </div>
                    )}
                    {effectiveFilters.showMovements && (
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-0.5 border-t-2 border-dashed border-[#5cd6ff] inline-block" />
                        <span>
                          <strong className="text-[#5cd6ff]">{t("tb_leg_move_b")}</strong>{" "}
                          {t("tb_leg_move_t")}
                        </span>
                      </div>
                    )}
                    {effectiveFilters.showPulse && (
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white inline-block animate-pulse bg-white/20" />
                        <span>
                          <strong className="text-white">{t("tb_leg_pulse_b")}</strong>{" "}
                          {t("tb_leg_pulse_t")}
                        </span>
                      </div>
                    )}
                    {effectiveFilters.showBallVector && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full border border-yellow-400 border-dashed text-[9px] font-bold text-yellow-300">
                            ◎
                          </span>
                          <span>
                            <strong className="text-yellow-300">{t("tb_leg_target_b")}</strong>{" "}
                            {t("tb_leg_target_t")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" />
                          <span>
                            <strong className="text-yellow-300">{t("tb_leg_vec_b")}</strong>{" "}
                            {t("tb_leg_vec_t")}
                          </span>
                        </div>
                      </>
                    )}
                    {effectiveFilters.showTeamLines && (
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-1 bg-emerald-500 rounded inline-block" />
                        <span>
                          <strong className="text-emerald-300">
                            {lang === "en" ? "Team Line:" : lang === "es" ? "Línea Equipo:" : "Gummiband:"}
                          </strong>{" "}
                          {lang === "en"
                            ? "Green = compact, Red = split"
                            : lang === "es"
                            ? "Verde = compacto, Rojo = abierto"
                            : "Grün = kompakt, Rot = Lücke/Tiefen-Riss"}
                        </span>
                      </div>
                    )}
                    {effectiveFilters.showWeaknessZones && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-red-500/30 rounded inline-block border border-red-500/40" />
                          <span>
                            <strong className="text-red-300">{t("tb_leg_red_b")}</strong>{" "}
                            {t("tb_leg_red_t")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-orange-500/30 rounded inline-block border border-orange-500/40" />
                          <span>
                            <strong className="text-orange-300">{t("tb_leg_orange_b")}</strong>{" "}
                            {t("tb_leg_orange_t")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-3 mb-6 w-full">
            <button
              onClick={reset}
              className="px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md"
            >
              {t("tb_btn_reset_pos")}
            </button>
            <button
              onClick={() => {
                if (activeDrill) {
                  setActiveDrillIdx(null);
                  setDrillResult(null);
                }
                setShowTactics(!showTactics);
              }}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all shadow-md ${
                showTactics && !activeDrill
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
              }`}
            >
              {showTactics ? t("tb_btn_analysis_off") : t("tb_btn_analysis_on")}
            </button>

            {isProUser && (
              <button
                onClick={() => {
                  if (activeDrill) {
                    setActiveDrillIdx(null);
                    setDrillResult(null);
                  } else {
                    startBoardDrill(0);
                  }
                }}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-black rounded-lg transition-all shadow-md ${
                  activeDrill
                    ? "bg-orange-500 text-black hover:bg-orange-400"
                    : "bg-gradient-to-r from-orange-600 to-amber-500 text-black hover:from-orange-500 hover:to-amber-400"
                }`}
              >
                {activeDrill
                  ? lang === "en"
                    ? "Exit Drill"
                    : lang === "es"
                    ? "Salir del Drill"
                    : "Drill beenden"
                  : lang === "en"
                  ? "🎯 Coach Drill"
                  : lang === "es"
                  ? "🎯 Drill Coach"
                  : "🎯 Coach-Drill"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

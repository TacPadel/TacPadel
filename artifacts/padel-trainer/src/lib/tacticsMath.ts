import type { Scenario as TrainerScenario } from "../components/Scenarios";
import type { TranslationKey } from "./i18n";
import {
  BOARD_V_WIDTH,
  BOARD_V_HEIGHT,
  PlaybookDraggableItem,
  PlaybookStudioDrawing,
  PlaybookKeyframe,
  zoneToBoardCoords,
} from "./playbook";

export type DraggableItem = PlaybookDraggableItem;
export type StudioDrawing = PlaybookStudioDrawing;
export type BoardKeyframe = PlaybookKeyframe;

export type StudioTool =
  | "move"
  | "arrow_run"
  | "arrow_ball"
  | "arrow_lob"
  | "arrow_glass"
  | "zone_circle";

export interface TacticalFilters {
  showBallVector: boolean;
  showMovements: boolean;
  showWeaknessZones: boolean;
  showTeamLines: boolean;
  showPulse: boolean;
  showAttackArc: boolean;
  showAngleCone: boolean;
}

export interface TacticalAnalysisResult {
  title: string;
  body: string;
  color: string;
  recommendation: string;
  targetX: number;
  targetY: number;
  activePlayerId: string;
  movements: Record<string, { tx: number; ty: number }>;
}

// Virtuelle Konstanten für stabiles Scaling (Logik bleibt 16:9, Ansicht wird 9:16 gedreht)
export const V_WIDTH = BOARD_V_WIDTH;
export const V_HEIGHT = BOARD_V_HEIGHT;

// Globale Taktik-Schwellenwerte für Analyse
export const GAP_THRESHOLD = 160;
export const WIDE_GAP_THRESHOLD = 180;
export const DEPTH_GAP_THRESHOLD = 95;
export const DEEP_DEF_THRESHOLD = 80;

export const isBallArrowType = (type: StudioTool): boolean =>
  type === "arrow_ball" || type === "arrow_lob" || type === "arrow_glass";

export const cloneItems = (list: DraggableItem[]): DraggableItem[] =>
  list.map((i) => ({ ...i }));

export const cloneDrawings = (list: StudioDrawing[] = []): StudioDrawing[] =>
  list.map((d) => ({ ...d }));

export const cloneKeyframes = (frames: BoardKeyframe[]): BoardKeyframe[] =>
  frames.map((f) => ({
    id: f.id,
    items: cloneItems(f.items || []),
    drawings: cloneDrawings(f.drawings || []),
  }));

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Berechnet den Kontrollpunkt einer quadratischen Bézier-Kurve für den gebogenen Lob-Pfeil
export const getLobControlPoint = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;

  const nx = -dy / len;
  const ny = dx / len;
  const arcOffset = Math.min(95, Math.max(38, len * 0.28));

  const cand1x = mx + nx * arcOffset;
  const cand1y = my + ny * arcOffset;
  const cand2x = mx - nx * arcOffset;
  const cand2y = my - ny * arcOffset;

  const d1 = Math.hypot(cand1x - V_WIDTH / 2, cand1y - V_HEIGHT / 2);
  const d2 = Math.hypot(cand2x - V_WIDTH / 2, cand2y - V_HEIGHT / 2);

  const chosenX = d1 <= d2 ? cand1x : cand2x;
  const chosenY = d1 <= d2 ? cand1y : cand2y;

  return {
    cx: Math.max(20, Math.min(V_WIDTH - 20, chosenX)),
    cy: Math.max(20, Math.min(V_HEIGHT - 20, chosenY)),
  };
};

// Berechnet den physikalischen Auftreffpunkt an Rück- oder Seitenscheibe (Spiegelungsprinzip)
export const getGlassBouncePoint = (x1: number, y1: number, x2: number, y2: number) => {
  const netCenter = V_WIDTH / 2;
  const minX = 14;
  const maxX = V_WIDTH - 14;
  const minY = 14;
  const maxY = V_HEIGHT - 14;

  const xBack = x2 >= netCenter ? maxX : minX;
  const dBack = Math.abs(xBack - x2);
  const dTop = Math.abs(y2 - minY);
  const dBot = Math.abs(maxY - y2);
  const dSide = Math.min(dTop, dBot);

  if (dSide < dBack * 0.72 && dSide < 120) {
    const yWall = dTop <= dBot ? minY : maxY;
    const y2Mirrored = 2 * yWall - y2;
    const denom = y2Mirrored - y1;
    if (Math.abs(denom) > 1) {
      const s = (yWall - y1) / denom;
      if (s > 0.05 && s < 0.98) {
        const bx = Math.max(minX, Math.min(maxX, x1 + s * (x2 - x1)));
        const sameSide =
          (x1 <= netCenter && x2 <= netCenter) || (x1 > netCenter && x2 > netCenter);
        const hitsTargetSide = x2 >= netCenter ? bx > netCenter + 18 : bx < netCenter - 18;
        if (sameSide || hitsTargetSide) {
          return { bx, by: yWall };
        }
      }
    }
  }

  const x2Mirrored = 2 * xBack - x2;
  const denom = x2Mirrored - x1;
  if (Math.abs(denom) > 1) {
    const s = (xBack - x1) / denom;
    const clampedS = Math.max(0.05, Math.min(0.98, s));
    const by = Math.max(minY, Math.min(maxY, y1 + clampedS * (y2 - y1)));
    return { bx: xBack, by };
  }

  return { bx: xBack, by: Math.max(minY, Math.min(maxY, (y1 + y2) / 2)) };
};

// Verschiebt Figuren und Ball automatisch entlang der gezeichneten Pfeile eines Schritts
export const applyDrawingsToItems = (
  baseItems: DraggableItem[],
  stepDrawings: StudioDrawing[]
): DraggableItem[] => {
  const next = cloneItems(baseItems);
  const netCenter = V_WIDTH / 2;

  stepDrawings.forEach((d) => {
    if (d.type === "zone_circle") return;

    let targetId = d.linkedItemId;

    if (!targetId) {
      if (isBallArrowType(d.type)) {
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

    let destX = Math.max(16, Math.min(V_WIDTH - 16, d.x2));
    const destY = Math.max(16, Math.min(V_HEIGHT - 16, d.y2));

    if (item.id.startsWith("a")) {
      destX = Math.min(netCenter - 15, destX);
    } else if (item.id.startsWith("b") && item.id !== "ball") {
      destX = Math.max(netCenter + 15, destX);
    }

    item.x = destX;
    item.y = destY;
  });

  return next;
};

// Prüft, ob zwei Aufstellungen sich bei A1 oder A2 spürbar unterscheiden
export const hasTeamAMoved = (a: DraggableItem[], b: DraggableItem[]): boolean => {
  return ["a1", "a2"].some((id) => {
    const p1 = a.find((i) => i.id === id);
    const p2 = b.find((i) => i.id === id);
    if (!p1 || !p2) return false;
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) > 15;
  });
};

// Konvertiert ein Taktik-Trainer-Szenario in Board-Figuren
export const trainerScenarioToBoardItems = (scenario: TrainerScenario): DraggableItem[] => {
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

// Hilfsfunktionen zur Berechnung der magnetischen Bogen-Kurve (Parabel)
export const getArcX = (y: number, isTeamA: boolean): number => {
  const cy = V_HEIGHT / 2;
  const aVal = 80 / Math.pow(V_HEIGHT / 2 - 20, 2);
  const netX = V_WIDTH / 2;

  if (isTeamA) {
    return aVal * Math.pow(y - cy, 2) + (netX - 140);
  }
  return -(aVal * Math.pow(y - cy, 2)) + (netX + 140);
};

export const getControlPointX = (isTeamA: boolean): number => {
  const apexX = getArcX(V_HEIGHT / 2, isTeamA);
  const edgeX = getArcX(20, isTeamA);
  return 2 * apexX - edgeX;
};

// Berechnet den Gefahrenwinkel-Kegel + Winkelhalbierende vom Ball aus
export const getDangerAngleCone = (ball: { x: number; y: number }) => {
  const netX = V_WIDTH / 2;
  const isBallOnSideA = ball.x <= netX;
  const farX = isBallOnSideA ? V_WIDTH - 14 : 14;
  const topCornerY = 18;
  const bottomCornerY = V_HEIGHT - 18;

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

// VORDEFINIERTE TAKTISCHE AUFSTELLUNGEN (Standard & Dynamischer Angriff)
export const SCENARIOS: Record<
  string,
  {
    nameKey: TranslationKey;
    items: DraggableItem[];
    customAnalysis?: { targetX: number; targetY: number; recommendationKey: TranslationKey };
  }
> = {
  initial: {
    nameKey: "tb_scen_initial_name",
    items: [
      { id: "a1", x: 120, y: 110, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: 120, y: 270, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: V_WIDTH - 120, y: 110, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: V_WIDTH - 120, y: 270, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: V_WIDTH / 2, y: V_HEIGHT / 2, color: "#2ecc71", label: "●", isPlayer: false },
    ],
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
};

// Berechnet Zielpunkt & Taktik-Empfehlung (inkl. Tiefen-Riss-Erkennung)
export const getTacticalTargetAndRec = (
  ball: { x: number; y: number },
  teamA: DraggableItem[],
  teamB: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string
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
        recommendation = t("tb_rec_opp_split");
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
        recommendation = t("tb_rec_team_split");
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

// Komplette 2D-Live-Taktikanalyse inkl. Spieler-Laufwegen
export const getTacticalAnalysis = (
  items: DraggableItem[],
  filters: TacticalFilters,
  scenarioKey: string,
  customTarget: { x: number; y: number } | null,
  t: (key: TranslationKey) => string
): TacticalAnalysisResult | null => {
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
    t
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

import { supabase } from "./supabase";
import type { Scenario as TrainerScenario } from "../components/Scenarios";
import { AppLanguage, formatShotName } from "./i18n";

export const BOARD_V_WIDTH = 760;
export const BOARD_V_HEIGHT = 380;
export const MAX_PLAYBOOK_ITEMS = 50;

export type PlaybookSource = "match" | "trainer" | "studio";
export type DrillDepth = "back" | "mid" | "net";

export interface PlaybookDraggableItem {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  isPlayer: boolean;
}

export interface PlaybookStudioDrawing {
  id: string;
  type: "arrow_run" | "arrow_ball" | "arrow_lob" | "arrow_glass" | "zone_circle";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  linkedItemId?: string;
}

export interface PlaybookKeyframe {
  id: string;
  items: PlaybookDraggableItem[];
  drawings: PlaybookStudioDrawing[];
}

export interface ReplayStep {
  actor: "you" | "partner" | "opp1" | "opp2";
  shot: string;
  fromZone: string;
  toZone: string;
  ballSideBefore: "left" | "right";
  ballSideAfter: "left" | "right";
  youBefore: string;
  partnerBefore: string;
  opp1Before: string;
  opp2Before: string;
  youAfter: string;
  partnerAfter: string;
  opp1After: string;
  opp2After: string;
}

export interface ReplayActualMove {
  actor: "you" | "partner" | "opp1" | "opp2";
  shot: string;
  targetZone: string;
  runZone?: string;
  outcome?: string;
}

export interface ReplayTrainerEval {
  scenarioId?: number;
  validShots: string[];
  bestZones: string[];
  laufZone?: string;
}

export interface ReplayContext {
  source?: PlaybookSource;
  you: string;
  partner: string;
  opp1: string;
  opp2: string;
  ballZone: string;
  ballSide: "left" | "right";
  incomingShot: string;
  note?: string;
  steps?: ReplayStep[];
  actualLastMove?: ReplayActualMove;
  trainerEval?: ReplayTrainerEval;
}

export interface SavedPlay {
  id: string;
  title: string;
  updatedAt: number;
  items: PlaybookDraggableItem[];
  drawings: PlaybookStudioDrawing[];
  keyframes: PlaybookKeyframe[];
  isDrill?: boolean;
  drillPrompt?: string;
  drillExplanation?: string;
  drillTargetDepth?: DrillDepth;
  source?: PlaybookSource;
  replayContext?: ReplayContext;
}

export interface UpsertPlaybookResult {
  saved: boolean;
  list: SavedPlay[];
  limitReached: boolean;
}

const PLAYBOOK_TABLE = "playbook_entries";
const SHARED_REPLAYS_TABLE = "shared_replays";

export const getPlaybookStorageKey = (userId?: string | null) =>
  `tacpadel_playbook_v1_${userId || "guest"}`;

// Zonen (A1–E5) -> Board-Koordinaten
export function zoneToBoardCoords(
  zoneId: string,
  side: "left" | "right"
): { x: number; y: number } {
  if (!zoneId || zoneId.length < 2) {
    return { x: side === "left" ? 120 : BOARD_V_WIDTH - 120, y: BOARD_V_HEIGHT / 2 };
  }
  const letters = ["A", "B", "C", "D", "E"];
  const colIdx = Math.max(0, Math.min(4, letters.indexOf(zoneId[0].toUpperCase())));
  const rowNum = Math.max(1, Math.min(5, parseInt(zoneId[1], 10) || 2));

  const y = 10 + (colIdx + 0.5) * ((BOARD_V_HEIGHT - 20) / 5);
  const rowStep = (BOARD_V_WIDTH / 2 - 10) / 5;
  const x =
    side === "left"
      ? 10 + (rowNum - 0.5) * rowStep
      : BOARD_V_WIDTH - 10 - (rowNum - 0.5) * rowStep;

  return { x: Math.round(x), y: Math.round(y) };
}

// Board-Koordinaten -> Zonen (A1–E5)
export function boardCoordsToZone(
  x: number,
  y: number,
  side: "left" | "right"
): string {
  const letters = ["A", "B", "C", "D", "E"];
  const colStep = (BOARD_V_HEIGHT - 20) / 5;
  const rowStep = (BOARD_V_WIDTH / 2 - 10) / 5;

  const colIdx = Math.max(0, Math.min(4, Math.round((y - 10) / colStep - 0.5)));
  const rawRow =
    side === "left"
      ? (x - 10) / rowStep + 0.5
      : (BOARD_V_WIDTH - 10 - x) / rowStep + 0.5;
  const rowNum = Math.max(1, Math.min(5, Math.round(rawRow)));

  return `${letters[colIdx]}${rowNum}`;
}

export function inferPlaySource(play: SavedPlay): PlaybookSource {
  if (play.source) return play.source;
  if (play.id.startsWith("match-play-")) return "match";
  if (play.id.startsWith("trainer-play-")) return "trainer";
  return "studio";
}

const KNOWN_SHOTS = [
  "BANDEJA",
  "VIBORA",
  "SMASH",
  "VOLLEY",
  "CHIQUITA",
  "BAJADA",
  "BLOCK",
  "LOB",
  "AUFSCHLAG",
  "DRIVE",
];

function detectShotFromText(text?: string): string {
  const upper = (text || "").toUpperCase();
  for (const shot of KNOWN_SHOTS) {
    if (upper.includes(shot)) return shot;
  }
  if (upper.includes("GLOBO")) return "LOB";
  if (upper.includes("VOLEA")) return "VOLLEY";
  if (upper.includes("BLOQUEO")) return "BLOCK";
  if (upper.includes("SAQUE") || upper.includes("SERVE")) return "AUFSCHLAG";
  return "DRIVE";
}

function getZonesFromBoardItems(items: PlaybookDraggableItem[]) {
  const a1 = items.find((i) => i.id === "a1") || { x: 120, y: 110 };
  const a2 = items.find((i) => i.id === "a2") || { x: 120, y: 270 };
  const b1 = items.find((i) => i.id === "b1") || { x: BOARD_V_WIDTH - 120, y: 110 };
  const b2 = items.find((i) => i.id === "b2") || { x: BOARD_V_WIDTH - 120, y: 270 };
  const ball = items.find((i) => i.id === "ball") || { x: a1.x, y: a1.y };
  const ballSide: "left" | "right" = ball.x <= BOARD_V_WIDTH / 2 ? "left" : "right";

  return {
    a1,
    a2,
    b1,
    b2,
    ball,
    ballSide,
    you: boardCoordsToZone(a1.x, a1.y, "left"),
    partner: boardCoordsToZone(a2.x, a2.y, "left"),
    opp1: boardCoordsToZone(b1.x, b1.y, "right"),
    opp2: boardCoordsToZone(b2.x, b2.y, "right"),
    ballZone: boardCoordsToZone(ball.x, ball.y, ballSide),
  };
}

// Konvertiert mehrstufige TacticsBoard-Keyframes sauber in abspielbare 3D-ReplaySteps
function extractStepsFromKeyframes(play: SavedPlay): ReplayStep[] {
  const frames = play.keyframes || [];
  if (frames.length === 0) return [];

  const steps: ReplayStep[] = [];
  const defaultShot = detectShotFromText(`${play.title} ${play.drillPrompt || ""}`);

  for (let i = 0; i < frames.length; i++) {
    const cur = frames[i];
    const next = frames[i + 1];
    const before = getZonesFromBoardItems(cur.items || []);
    const drawings = cur.drawings || [];

    const ballArrow = drawings.find(
      (d) =>
        d.type === "arrow_ball" ||
        d.type === "arrow_lob" ||
        d.type === "arrow_glass"
    );

    if (!next && !ballArrow) continue;

    const after = next ? getZonesFromBoardItems(next.items || []) : { ...before };

    let toSide: "left" | "right" = next
      ? after.ballSide
      : ballArrow && ballArrow.x2 <= BOARD_V_WIDTH / 2
      ? "left"
      : "right";

    let toZone = next ? after.ballZone : before.ballZone;
    if (ballArrow) {
      toSide = ballArrow.x2 <= BOARD_V_WIDTH / 2 ? "left" : "right";
      toZone = boardCoordsToZone(ballArrow.x2, ballArrow.y2, toSide);
    }

    // Laufwege aus Zeichnungen übernehmen, falls kein Nachfolge-Keyframe existiert
    let youAfter = after.you;
    let partnerAfter = after.partner;
    let opp1After = after.opp1;
    let opp2After = after.opp2;

    if (!next) {
      drawings
        .filter((d) => d.type === "arrow_run" && d.linkedItemId)
        .forEach((d) => {
          if (d.linkedItemId === "a1") youAfter = boardCoordsToZone(d.x2, d.y2, "left");
          if (d.linkedItemId === "a2") partnerAfter = boardCoordsToZone(d.x2, d.y2, "left");
          if (d.linkedItemId === "b1") opp1After = boardCoordsToZone(d.x2, d.y2, "right");
          if (d.linkedItemId === "b2") opp2After = boardCoordsToZone(d.x2, d.y2, "right");
        });
    }

    let actor: ReplayStep["actor"] = "you";
    if (before.ballSide === "left") {
      const dA1 = Math.hypot(before.a1.x - before.ball.x, before.a1.y - before.ball.y);
      const dA2 = Math.hypot(before.a2.x - before.ball.x, before.a2.y - before.ball.y);
      actor = dA2 + 10 < dA1 ? "partner" : "you";
    } else {
      const dB1 = Math.hypot(before.b1.x - before.ball.x, before.b1.y - before.ball.y);
      const dB2 = Math.hypot(before.b2.x - before.ball.x, before.b2.y - before.ball.y);
      actor = dB2 + 10 < dB1 ? "opp2" : "opp1";
    }

    let shot = defaultShot;
    if (ballArrow?.type === "arrow_lob") shot = "LOB";
    else if (ballArrow?.type === "arrow_glass") shot = "BAJADA";
    else if (ballArrow?.type === "arrow_ball") {
      const actorRow = parseInt(
        (actor === "you"
          ? before.you
          : actor === "partner"
          ? before.partner
          : actor === "opp1"
          ? before.opp1
          : before.opp2)[1] || "2",
        10
      );
      shot = actorRow >= 3 ? "VOLLEY" : "DRIVE";
    }

    steps.push({
      actor,
      shot,
      fromZone: before.ballZone,
      toZone,
      ballSideBefore: before.ballSide,
      ballSideAfter: toSide,
      youBefore: before.you,
      partnerBefore: before.partner,
      opp1Before: before.opp1,
      opp2Before: before.opp2,
      youAfter,
      partnerAfter,
      opp1After,
      opp2After,
    });
  }

  return steps;
}

// Baut aus jedem Playbook-Eintrag (Match, Trainer oder Studio) eine abspielbare 3D-Replay-Challenge
export function extractReplayContext(play: SavedPlay): ReplayContext {
  const playSource = inferPlaySource(play);

  if (play.replayContext) {
    return {
      ...play.replayContext,
      source: play.replayContext.source || playSource,
      steps: play.replayContext.steps ? play.replayContext.steps.map((s) => ({ ...s })) : undefined,
      actualLastMove: play.replayContext.actualLastMove
        ? { ...play.replayContext.actualLastMove }
        : undefined,
      trainerEval: play.replayContext.trainerEval
        ? {
            ...play.replayContext.trainerEval,
            validShots: [...play.replayContext.trainerEval.validShots],
            bestZones: [...play.replayContext.trainerEval.bestZones],
          }
        : undefined,
    };
  }

  // Mehrstufige Studio-Spielzüge automatisch in Vorlauf-Animation + letzten Zug aufteilen
  const studioSteps = extractStepsFromKeyframes(play);
  if (studioSteps.length > 0 && playSource !== "trainer") {
    let lastTeamStepIdx = -1;
    for (let i = studioSteps.length - 1; i >= 0; i--) {
      if (studioSteps[i].actor === "you" || studioSteps[i].actor === "partner") {
        lastTeamStepIdx = i;
        break;
      }
    }

    if (lastTeamStepIdx >= 0) {
      const decisionStep = studioSteps[lastTeamStepIdx];
      const introSteps = studioSteps.slice(0, lastTeamStepIdx);
      const prevStep = lastTeamStepIdx > 0 ? studioSteps[lastTeamStepIdx - 1] : null;
      const isPartnerHitter = decisionStep.actor === "partner";

      return {
        source: playSource,
        you: isPartnerHitter ? decisionStep.partnerBefore : decisionStep.youBefore,
        partner: isPartnerHitter ? decisionStep.youBefore : decisionStep.partnerBefore,
        opp1: decisionStep.opp1Before,
        opp2: decisionStep.opp2Before,
        ballZone: isPartnerHitter ? decisionStep.partnerBefore : decisionStep.youBefore,
        ballSide: "left",
        incomingShot:
          prevStep?.shot ||
          (decisionStep.shot === "AUFSCHLAG" ? "PREPARE_SERVE" : "DRIVE"),
        note: play.drillExplanation || play.drillPrompt,
        steps: introSteps,
        actualLastMove: {
          actor: decisionStep.actor,
          shot: decisionStep.shot,
          targetZone: decisionStep.toZone,
          runZone: isPartnerHitter ? decisionStep.partnerAfter : decisionStep.youAfter,
        },
      };
    }

    // Falls nur Gegner-Schläge gezeichnet wurden: alle abspielen und letzten Ball beantworten lassen
    const finalOppStep = studioSteps[studioSteps.length - 1];
    return {
      source: playSource,
      you: finalOppStep.youAfter,
      partner: finalOppStep.partnerAfter,
      opp1: finalOppStep.opp1After,
      opp2: finalOppStep.opp2After,
      ballZone: finalOppStep.toZone,
      ballSide: "left",
      incomingShot: finalOppStep.shot || "DRIVE",
      note: play.drillExplanation || play.drillPrompt,
      steps: studioSteps,
    };
  }

  // Fallback für Einzelbild-Einträge ohne Keyframes
  const snap = getZonesFromBoardItems(play.items || []);
  let youZone = snap.you;
  let partnerZone = snap.partner;

  const dA1 = Math.hypot(snap.a1.x - snap.ball.x, snap.a1.y - snap.ball.y);
  const dA2 = Math.hypot(snap.a2.x - snap.ball.x, snap.a2.y - snap.ball.y);
  if (dA2 + 12 < dA1) {
    const tmp = youZone;
    youZone = partnerZone;
    partnerZone = tmp;
  }

  const incomingShot = detectShotFromText(`${play.title} ${play.drillPrompt || ""}`);

  return {
    source: playSource,
    you: youZone,
    partner: partnerZone,
    opp1: snap.opp1,
    opp2: snap.opp2,
    ballZone: youZone,
    ballSide: "left",
    incomingShot,
    note: play.drillExplanation || play.drillPrompt,
  };
}

// Konvertiert ein Taktik-Trainer-Szenario mit einem Klick in einen Playbook-Eintrag
export function createPlayFromTrainerScenario(
  scenario: TrainerScenario,
  lang: AppLanguage
): SavedPlay {
  const a1 = zoneToBoardCoords(scenario.positions.you, "left");
  const a2 = zoneToBoardCoords(scenario.positions.partner, "left");
  const b1 = zoneToBoardCoords(scenario.positions.opp1, "right");
  const b2 = zoneToBoardCoords(scenario.positions.opp2, "right");
  const ballSide = scenario.positions.ball.side === "right" ? "right" : "left";
  const ball = zoneToBoardCoords(scenario.positions.ball.zone, ballSide);

  const items: PlaybookDraggableItem[] = [
    { id: "a1", x: a1.x, y: a1.y, color: "#e74c3c", label: "A1", isPlayer: true },
    { id: "a2", x: a2.x, y: a2.y, color: "#e74c3c", label: "A2", isPlayer: true },
    { id: "b1", x: b1.x, y: b1.y, color: "#f1c40f", label: "B1", isPlayer: true },
    { id: "b2", x: b2.x, y: b2.y, color: "#f1c40f", label: "B2", isPlayer: true },
    { id: "ball", x: ball.x, y: ball.y, color: "#2ecc71", label: "●", isPlayer: false },
  ];

  const drawings: PlaybookStudioDrawing[] = [];
  const primaryShot = scenario.validShots[0] || "DRIVE";

  if (scenario.bestZones && scenario.bestZones.length > 0) {
    const targetPt = zoneToBoardCoords(scenario.bestZones[0], "right");
    drawings.push({
      id: `tr-ball-${scenario.id}`,
      type: primaryShot.toUpperCase().includes("LOB")
        ? "arrow_lob"
        : primaryShot.toUpperCase() === "BAJADA"
        ? "arrow_glass"
        : "arrow_ball",
      x1: ball.x,
      y1: ball.y,
      x2: targetPt.x,
      y2: targetPt.y,
      linkedItemId: "ball",
    });
  }

  if (scenario.laufZone) {
    const runPt = zoneToBoardCoords(scenario.laufZone, "left");
    drawings.push({
      id: `tr-run-${scenario.id}`,
      type: "arrow_run",
      x1: a1.x,
      y1: a1.y,
      x2: runPt.x,
      y2: runPt.y,
      linkedItemId: "a1",
    });
  }

  const desc =
    (lang === "en" && (scenario as any).description_en) ||
    (lang === "es" && (scenario as any).description_es) ||
    scenario.description;

  const expl =
    (lang === "en" && (scenario as any).explanation_en) ||
    (lang === "es" && (scenario as any).explanation_es) ||
    scenario.explanation;

  const shotLabel = formatShotName(primaryShot, lang);

  return {
    id: `trainer-play-${scenario.id}`,
    title: `🧠 #${scenario.id} – ${shotLabel}`,
    updatedAt: Date.now(),
    items,
    drawings,
    keyframes: [{ id: `kf-tr-${scenario.id}`, items, drawings }],
    source: "trainer",
    isDrill: false,
    drillPrompt: desc,
    drillExplanation: expl,
    drillTargetDepth:
      parseInt(scenario.laufZone?.[1] || "2", 10) >= 3 ? "net" : "back",
    replayContext: {
      source: "trainer",
      you: scenario.positions.you,
      partner: scenario.positions.partner,
      opp1: scenario.positions.opp1,
      opp2: scenario.positions.opp2,
      ballZone: scenario.positions.ball.zone || scenario.positions.you,
      ballSide,
      incomingShot: primaryShot === "AUFSCHLAG" ? "PREPARE_SERVE" : "DRIVE",
      note: desc,
      trainerEval: {
        scenarioId: scenario.id,
        validShots: [...scenario.validShots],
        bestZones: [...(scenario.bestZones || [])],
        laufZone: scenario.laufZone || undefined,
      },
      actualLastMove: {
        actor: "you",
        shot: primaryShot,
        targetZone: scenario.bestZones?.[0] || "C3",
        runZone: scenario.laufZone,
        outcome: expl,
      },
    },
  };
}

// Konvertiert einen geteilten Replay-Link (inkl. aller Vorlauf-Schritte & Trainer-Daten) in einen Playbook-Eintrag
export function createPlayFromReplayContext(
  title: string,
  ctx: ReplayContext
): SavedPlay {
  const buildFrameFromStep = (step: ReplayStep, idx: number): PlaybookKeyframe => {
    const a1 = zoneToBoardCoords(step.youBefore, "left");
    const a2 = zoneToBoardCoords(step.partnerBefore, "left");
    const b1 = zoneToBoardCoords(step.opp1Before, "right");
    const b2 = zoneToBoardCoords(step.opp2Before, "right");
    const ball = zoneToBoardCoords(step.fromZone, step.ballSideBefore);

    const items: PlaybookDraggableItem[] = [
      { id: "a1", x: a1.x, y: a1.y, color: "#e74c3c", label: "A1", isPlayer: true },
      { id: "a2", x: a2.x, y: a2.y, color: "#e74c3c", label: "A2", isPlayer: true },
      { id: "b1", x: b1.x, y: b1.y, color: "#f1c40f", label: "B1", isPlayer: true },
      { id: "b2", x: b2.x, y: b2.y, color: "#f1c40f", label: "B2", isPlayer: true },
      { id: "ball", x: ball.x, y: ball.y, color: "#2ecc71", label: "●", isPlayer: false },
    ];

    const destPt = zoneToBoardCoords(step.toZone, step.ballSideAfter);
    const upperShot = (step.shot || "").toUpperCase();
    const arrowType: PlaybookStudioDrawing["type"] = upperShot.includes("LOB")
      ? "arrow_lob"
      : upperShot === "BAJADA"
      ? "arrow_glass"
      : "arrow_ball";

    const drawings: PlaybookStudioDrawing[] = [
      {
        id: `sh-ball-${idx}-${Date.now()}`,
        type: arrowType,
        x1: ball.x,
        y1: ball.y,
        x2: destPt.x,
        y2: destPt.y,
        linkedItemId: "ball",
      },
    ];

    return {
      id: `kf-sh-${idx}-${Date.now()}`,
      items,
      drawings,
    };
  };

  let keyframes: PlaybookKeyframe[] = [];
  if (ctx.steps && ctx.steps.length > 0) {
    keyframes = ctx.steps.map(buildFrameFromStep);
  }

  const a1 = zoneToBoardCoords(ctx.you, "left");
  const a2 = zoneToBoardCoords(ctx.partner, "left");
  const b1 = zoneToBoardCoords(ctx.opp1, "right");
  const b2 = zoneToBoardCoords(ctx.opp2, "right");
  const ball = zoneToBoardCoords(ctx.ballZone || ctx.you, ctx.ballSide || "left");

  const finalItems: PlaybookDraggableItem[] = [
    { id: "a1", x: a1.x, y: a1.y, color: "#e74c3c", label: "A1", isPlayer: true },
    { id: "a2", x: a2.x, y: a2.y, color: "#e74c3c", label: "A2", isPlayer: true },
    { id: "b1", x: b1.x, y: b1.y, color: "#f1c40f", label: "B1", isPlayer: true },
    { id: "b2", x: b2.x, y: b2.y, color: "#f1c40f", label: "B2", isPlayer: true },
    { id: "ball", x: ball.x, y: ball.y, color: "#2ecc71", label: "●", isPlayer: false },
  ];

  keyframes.push({
    id: `kf-sh-end-${Date.now()}`,
    items: finalItems,
    drawings: [],
  });

  return {
    id: `shared-play-${Date.now()}`,
    title: title || "Shared Play",
    updatedAt: Date.now(),
    items: keyframes[0].items,
    drawings: keyframes[0].drawings,
    keyframes,
    source: ctx.source || "match",
    isDrill: false,
    drillExplanation: ctx.note,
    replayContext: {
      ...ctx,
      steps: ctx.steps ? ctx.steps.map((s) => ({ ...s })) : undefined,
      actualLastMove: ctx.actualLastMove ? { ...ctx.actualLastMove } : undefined,
      trainerEval: ctx.trainerEval
        ? {
            ...ctx.trainerEval,
            validShots: [...ctx.trainerEval.validShots],
            bestZones: [...ctx.trainerEval.bestZones],
          }
        : undefined,
    },
  };
}

// =========================================================================
// KURZE SUPABASE SHARE-LINKS (`?play=<code>` über `public.shared_replays`)
// =========================================================================
const SHARE_CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function generateShortShareCode(len: number = 8): string {
  let out = "";
  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint8Array(len);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < len; i++) {
      out += SHARE_CODE_CHARS[buf[i] % SHARE_CODE_CHARS.length];
    }
    return out;
  }
  for (let i = 0; i < len; i++) {
    out += SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)];
  }
  return out;
}

export async function createSharedReplayLink(params: {
  title: string;
  context: ReplayContext;
  userId?: string | null;
  baseUrl: string;
}): Promise<{ url: string; shortCode: string | null }> {
  const cleanTitle = (params.title || "TacPadel Challenge").slice(0, 120);
  const cleanCtx: ReplayContext = {
    ...params.context,
    steps: params.context.steps ? params.context.steps.slice(-16) : undefined,
    trainerEval: params.context.trainerEval
      ? {
          ...params.context.trainerEval,
          validShots: [...params.context.trainerEval.validShots],
          bestZones: [...params.context.trainerEval.bestZones],
        }
      : undefined,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateShortShareCode(8);
    try {
      const { error } = await supabase.from(SHARED_REPLAYS_TABLE).insert({
        code,
        title: cleanTitle,
        replay_context: cleanCtx,
        created_by: params.userId || null,
      });

      if (!error) {
        return {
          url: `${params.baseUrl}?play=${code}`,
          shortCode: code,
        };
      }
      // Nur bei Code-Kollision (23505) nochmal würfeln
      if (error.code !== "23505") break;
    } catch {
      break;
    }
  }

  // Sauberer Offline-/Fallback-Link ohne Datenverlust
  const encoded = encodeReplayToParam(cleanTitle, cleanCtx);
  return {
    url: `${params.baseUrl}?replay=${encoded}`,
    shortCode: null,
  };
}

export async function fetchSharedReplayByCode(
  code: string
): Promise<{ title: string; context: ReplayContext } | null> {
  const cleanCode = (code || "").trim().toLowerCase();
  if (!cleanCode || cleanCode.length < 6 || cleanCode.length > 16) return null;

  try {
    const { data, error } = await supabase
      .from(SHARED_REPLAYS_TABLE)
      .select("title, replay_context")
      .eq("code", cleanCode)
      .maybeSingle();

    if (error || !data?.replay_context) return null;

    const ctx = data.replay_context as ReplayContext;
    if (!ctx.you || !ctx.partner || !ctx.opp1 || !ctx.opp2) return null;

    return {
      title: String(data.title || "Padel Challenge"),
      context: ctx,
    };
  } catch {
    return null;
  }
}

// =========================================================================
// SUPABASE-TABELLEN-HELFER (`public.playbook_entries`)
// =========================================================================
function toDbRow(userId: string, play: SavedPlay) {
  const source = inferPlaySource(play);
  const updatedAt = play.updatedAt || Date.now();
  return {
    id: play.id,
    user_id: userId,
    title: play.title,
    source,
    is_drill: Boolean(play.isDrill),
    payload: {
      ...play,
      source,
      isDrill: Boolean(play.isDrill),
      updatedAt,
    },
    updated_at: updatedAt,
  };
}

function fromDbRow(row: any): SavedPlay | null {
  if (!row?.payload || typeof row.payload !== "object") return null;
  const p = row.payload as SavedPlay;
  return {
    ...p,
    id: String(row.id || p.id),
    title: String(row.title || p.title || "Play"),
    source: (row.source || p.source || inferPlaySource(p)) as PlaybookSource,
    isDrill: Boolean(row.is_drill ?? p.isDrill),
    updatedAt: Number(row.updated_at || p.updatedAt || Date.now()),
  };
}

async function syncPlaybookListToSupabase(
  userId: string,
  list: SavedPlay[]
): Promise<boolean> {
  try {
    if (list.length > 0) {
      const rows = list.map((p) => toDbRow(userId, p));
      const { error: upsertErr } = await supabase
        .from(PLAYBOOK_TABLE)
        .upsert(rows, { onConflict: "user_id,id" });
      if (upsertErr) return false;
    }

    const { data: existingRows, error: fetchErr } = await supabase
      .from(PLAYBOOK_TABLE)
      .select("id")
      .eq("user_id", userId);

    if (fetchErr || !existingRows) return true;

    const keepIds = new Set(list.map((p) => p.id));
    const staleIds = existingRows
      .map((r: any) => String(r.id))
      .filter((id) => !keepIds.has(id));

    if (staleIds.length > 0) {
      await supabase
        .from(PLAYBOOK_TABLE)
        .delete()
        .eq("user_id", userId)
        .in("id", staleIds);
    }

    return true;
  } catch {
    return false;
  }
}

async function upsertSinglePlayToSupabase(
  userId: string,
  entry: SavedPlay
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(PLAYBOOK_TABLE)
      .upsert(toDbRow(userId, entry), { onConflict: "user_id,id" });
    return !error;
  } catch {
    return false;
  }
}

export async function loadPlaybook(
  userId?: string | null,
  maxSlots: number = MAX_PLAYBOOK_ITEMS
): Promise<SavedPlay[]> {
  let localPlays: SavedPlay[] = [];
  try {
    const raw = localStorage.getItem(getPlaybookStorageKey(userId));
    if (raw) localPlays = JSON.parse(raw);
  } catch {}

  let dbPlays: SavedPlay[] = [];
  let legacyMetaPlays: SavedPlay[] = [];
  let dbReachable = false;

  if (userId) {
    try {
      const { data, error } = await supabase
        .from(PLAYBOOK_TABLE)
        .select("id, title, source, is_drill, payload, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(maxSlots);

      if (!error && Array.isArray(data)) {
        dbReachable = true;
        dbPlays = data
          .map(fromDbRow)
          .filter((p): p is SavedPlay => p !== null);
      }
    } catch {}

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (Array.isArray(session?.user?.user_metadata?.tactic_playbook)) {
        legacyMetaPlays = session.user.user_metadata.tactic_playbook as SavedPlay[];
      }
    } catch {}
  }

  const mergedMap = new Map<string, SavedPlay>();
  [...legacyMetaPlays, ...dbPlays, ...localPlays].forEach((p) => {
    const existing = mergedMap.get(p.id);
    if (!existing || (p.updatedAt || 0) > (existing.updatedAt || 0)) {
      mergedMap.set(p.id, p);
    }
  });

  const merged = Array.from(mergedMap.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, maxSlots);

  try {
    localStorage.setItem(getPlaybookStorageKey(userId), JSON.stringify(merged));
  } catch {}

  if (userId && dbReachable) {
    const dbIds = new Set(dbPlays.map((p) => p.id));
    const hasUnsyncedLocal = merged.some((p) => !dbIds.has(p.id));

    if (legacyMetaPlays.length > 0 || hasUnsyncedLocal) {
      const synced = await syncPlaybookListToSupabase(userId, merged);
      if (synced && legacyMetaPlays.length > 0) {
        supabase.auth
          .updateUser({ data: { tactic_playbook: null } })
          .catch(() => {});
      }
    }
  }

  return merged;
}

export function savePlaybookList(
  userId: string | null | undefined,
  list: SavedPlay[],
  maxSlots: number = MAX_PLAYBOOK_ITEMS
): SavedPlay[] {
  const trimmed = list.slice(0, maxSlots);
  try {
    localStorage.setItem(getPlaybookStorageKey(userId), JSON.stringify(trimmed));
  } catch {}

  if (userId) {
    syncPlaybookListToSupabase(userId, trimmed).catch(() => {});
  }
  return trimmed;
}

export function upsertPlaybookEntry(
  userId: string | null | undefined,
  entry: SavedPlay,
  maxSlots: number = MAX_PLAYBOOK_ITEMS
): UpsertPlaybookResult {
  let current: SavedPlay[] = [];
  try {
    const raw = localStorage.getItem(getPlaybookStorageKey(userId));
    if (raw) current = JSON.parse(raw);
  } catch {}

  const exists = current.some((p) => p.id === entry.id);
  if (!exists && current.length >= maxSlots) {
    return {
      saved: false,
      list: current,
      limitReached: true,
    };
  }

  const next = [entry, ...current.filter((p) => p.id !== entry.id)].slice(0, maxSlots);
  try {
    localStorage.setItem(getPlaybookStorageKey(userId), JSON.stringify(next));
  } catch {}

  if (userId) {
    upsertSinglePlayToSupabase(userId, entry).catch(() => {});
  }

  return {
    saved: true,
    list: next,
    limitReached: false,
  };
}

// =========================================================================
// AUTOMATISCHE GAST-ÜBERNAHME BEIM LOGIN (PLAYBOOK + COACH-STATS)
// =========================================================================
export async function migrateGuestPlaybookToUser(
  userId: string,
  maxSlots: number = MAX_PLAYBOOK_ITEMS
): Promise<number> {
  if (!userId) return 0;

  const guestKey = getPlaybookStorageKey(null);
  let guestPlays: SavedPlay[] = [];
  try {
    const rawGuest = localStorage.getItem(guestKey);
    if (!rawGuest) return 0;
    const parsed = JSON.parse(rawGuest);
    if (Array.isArray(parsed)) guestPlays = parsed;
  } catch {
    localStorage.removeItem(guestKey);
    return 0;
  }

  if (guestPlays.length === 0) {
    localStorage.removeItem(guestKey);
    return 0;
  }

  const existingUserPlays = await loadPlaybook(userId, maxSlots);
  const mergedMap = new Map<string, SavedPlay>();

  [...existingUserPlays, ...guestPlays].forEach((p) => {
    const cur = mergedMap.get(p.id);
    if (!cur || (p.updatedAt || 0) > (cur.updatedAt || 0)) {
      mergedMap.set(p.id, p);
    }
  });

  const limit = Math.max(maxSlots, existingUserPlays.length + guestPlays.length);
  const mergedList = Array.from(mergedMap.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, limit);

  try {
    localStorage.setItem(getPlaybookStorageKey(userId), JSON.stringify(mergedList));
  } catch {}

  await syncPlaybookListToSupabase(userId, mergedList);
  localStorage.removeItem(guestKey);

  return guestPlays.length;
}

const MAX_KEYS = new Set(["version", "updatedAt", "lastUpdated", "timestamp"]);

function isPlainObject(val: unknown): val is Record<string, any> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function deepMergeCoachStats(existing: any, incoming: any): any {
  if (existing === undefined || existing === null) return incoming;
  if (incoming === undefined || incoming === null) return existing;

  if (typeof existing === "number" && typeof incoming === "number") {
    return existing + incoming;
  }
  if (typeof existing === "boolean" && typeof incoming === "boolean") {
    return existing || incoming;
  }
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const combined = [...incoming, ...existing];
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const item of combined) {
      const sig = typeof item === "object" ? JSON.stringify(item) : String(item);
      if (!seen.has(sig)) {
        seen.add(sig);
        deduped.push(item);
      }
    }
    return deduped.slice(0, 120);
  }
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const out: Record<string, any> = { ...existing };
    for (const key of Object.keys(incoming)) {
      if (MAX_KEYS.has(key) && typeof out[key] === "number" && typeof incoming[key] === "number") {
        out[key] = Math.max(out[key], incoming[key]);
      } else {
        out[key] = deepMergeCoachStats(out[key], incoming[key]);
      }
    }
    return out;
  }
  return existing;
}

export function migrateGuestCoachStatsToUser(userId: string): number {
  if (!userId || typeof localStorage === "undefined") return 0;

  let migratedCount = 0;

  try {
    const allKeys = Object.keys(localStorage);
    const guestCoachKeys = allKeys.filter(
      (k) =>
        /^tacpadel_.*(coach|tactic_stats).*_guest$/i.test(k) &&
        !k.includes("weekly_drills") &&
        !k.includes("playbook")
    );

    for (const guestKey of guestCoachKeys) {
      const rawGuest = localStorage.getItem(guestKey);
      if (!rawGuest) {
        localStorage.removeItem(guestKey);
        continue;
      }

      let parsedGuest: any;
      try {
        parsedGuest = JSON.parse(rawGuest);
      } catch {
        localStorage.removeItem(guestKey);
        continue;
      }

      const hasActivity =
        isPlainObject(parsedGuest) &&
        ((parsedGuest.trainer?.totalTurns || 0) > 0 ||
          (parsedGuest.match?.totalTurns || 0) > 0 ||
          Object.keys(parsedGuest).length > 0);

      if (!hasActivity) {
        localStorage.removeItem(guestKey);
        continue;
      }

      const targetKey = guestKey.replace(/_guest$/, `_${userId}`);
      let merged = parsedGuest;

      try {
        const rawUser = localStorage.getItem(targetKey);
        if (rawUser) {
          const parsedUser = JSON.parse(rawUser);
          merged = deepMergeCoachStats(parsedUser, parsedGuest);
        }
      } catch {}

      localStorage.setItem(targetKey, JSON.stringify(merged));
      localStorage.removeItem(guestKey);
      migratedCount++;
    }
  } catch {}

  return migratedCount;
}

// =========================================================================
// LEGACY/OFFLINE URL-CODEC FÜR ?replay=... (ABWÄRTSKOMPATIBEL)
// =========================================================================
export function encodeReplayToParam(title: string, ctx: ReplayContext): string {
  const payload = {
    t: title.slice(0, 48),
    src: ctx.source || "match",
    y: ctx.you,
    p: ctx.partner,
    o1: ctx.opp1,
    o2: ctx.opp2,
    b: ctx.ballZone,
    s: ctx.incomingShot,
    n: (ctx.note || "").slice(0, 140),
  };
  try {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

export function decodeReplayFromParam(
  param: string
): { title: string; context: ReplayContext } | null {
  try {
    const padded = param.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const bin = atob(padded + "=".repeat(padLen));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);

    if (!data?.y || !data?.p || !data?.o1 || !data?.o2) return null;

    const src =
      data.src === "trainer" || data.src === "studio" || data.src === "match"
        ? (data.src as PlaybookSource)
        : "match";

    return {
      title: String(data.t || "Padel Challenge"),
      context: {
        source: src,
        you: String(data.y),
        partner: String(data.p),
        opp1: String(data.o1),
        opp2: String(data.o2),
        ballZone: String(data.b || data.y),
        ballSide: "left",
        incomingShot: String(data.s || "DRIVE"),
        note: data.n ? String(data.n) : undefined,
      },
    };
  } catch {
    return null;
  }
}
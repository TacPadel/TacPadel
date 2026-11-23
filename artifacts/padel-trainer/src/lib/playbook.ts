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

export interface ReplayContext {
  you: string;
  partner: string;
  opp1: string;
  opp2: string;
  ballZone: string;
  ballSide: "left" | "right";
  incomingShot: string;
  note?: string;
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

// Baut aus jedem Playbook-Eintrag (Match, Trainer oder Studio) eine spielbare 3D-Replay-Situation
export function extractReplayContext(play: SavedPlay): ReplayContext {
  if (play.replayContext) {
    return { ...play.replayContext };
  }

  const frames = play.keyframes || [];
  let chosenItems = play.items;

  if (frames.length > 0) {
    const leftBallFrames = frames.filter((f) => {
      const b = f.items.find((i) => i.id === "ball");
      return b && b.x <= BOARD_V_WIDTH / 2;
    });
    if (leftBallFrames.length > 0) {
      chosenItems = leftBallFrames[leftBallFrames.length - 1].items;
    } else {
      chosenItems = frames[0].items;
    }
  }

  const a1 = chosenItems.find((i) => i.id === "a1") || { x: 120, y: 110 };
  const a2 = chosenItems.find((i) => i.id === "a2") || { x: 120, y: 270 };
  const b1 = chosenItems.find((i) => i.id === "b1") || { x: BOARD_V_WIDTH - 120, y: 110 };
  const b2 = chosenItems.find((i) => i.id === "b2") || { x: BOARD_V_WIDTH - 120, y: 270 };
  const ball = chosenItems.find((i) => i.id === "ball") || { x: a1.x, y: a1.y };

  let youZone = boardCoordsToZone(a1.x, a1.y, "left");
  let partnerZone = boardCoordsToZone(a2.x, a2.y, "left");
  const opp1Zone = boardCoordsToZone(b1.x, b1.y, "right");
  const opp2Zone = boardCoordsToZone(b2.x, b2.y, "right");

  const distA1 = Math.hypot(a1.x - ball.x, a1.y - ball.y);
  const distA2 = Math.hypot(a2.x - ball.x, a2.y - ball.y);
  if (distA2 + 12 < distA1) {
    const tmp = youZone;
    youZone = partnerZone;
    partnerZone = tmp;
  }

  const incomingShot = detectShotFromText(`${play.title} ${play.drillPrompt || ""}`);

  return {
    you: youZone,
    partner: partnerZone,
    opp1: opp1Zone,
    opp2: opp2Zone,
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
      you: scenario.positions.you,
      partner: scenario.positions.partner,
      opp1: scenario.positions.opp1,
      opp2: scenario.positions.opp2,
      ballZone: scenario.positions.you,
      ballSide: "left",
      incomingShot: primaryShot === "AUFSCHLAG" ? "PREPARE_SERVE" : "DRIVE",
      note: desc,
    },
  };
}

// Konvertiert einen geteilten Replay-Link in einen speicherbaren Playbook-Eintrag
export function createPlayFromReplayContext(
  title: string,
  ctx: ReplayContext
): SavedPlay {
  const a1 = zoneToBoardCoords(ctx.you, "left");
  const a2 = zoneToBoardCoords(ctx.partner, "left");
  const b1 = zoneToBoardCoords(ctx.opp1, "right");
  const b2 = zoneToBoardCoords(ctx.opp2, "right");
  const ball = zoneToBoardCoords(ctx.ballZone || ctx.you, ctx.ballSide || "left");

  const items: PlaybookDraggableItem[] = [
    { id: "a1", x: a1.x, y: a1.y, color: "#e74c3c", label: "A1", isPlayer: true },
    { id: "a2", x: a2.x, y: a2.y, color: "#e74c3c", label: "A2", isPlayer: true },
    { id: "b1", x: b1.x, y: b1.y, color: "#f1c40f", label: "B1", isPlayer: true },
    { id: "b2", x: b2.x, y: b2.y, color: "#f1c40f", label: "B2", isPlayer: true },
    { id: "ball", x: ball.x, y: ball.y, color: "#2ecc71", label: "●", isPlayer: false },
  ];

  return {
    id: `shared-play-${Date.now()}`,
    title: title || "Shared Play",
    updatedAt: Date.now(),
    items,
    drawings: [],
    keyframes: [{ id: `kf-sh-${Date.now()}`, items, drawings: [] }],
    source: "match",
    isDrill: false,
    drillExplanation: ctx.note,
    replayContext: { ...ctx },
  };
}

// Lädt Playbook (Lokal + Supabase user_metadata zusammenführen)
export async function loadPlaybook(
  userId?: string | null,
  maxSlots: number = MAX_PLAYBOOK_ITEMS
): Promise<SavedPlay[]> {
  let localPlays: SavedPlay[] = [];
  try {
    const raw = localStorage.getItem(getPlaybookStorageKey(userId));
    if (raw) localPlays = JSON.parse(raw);
  } catch {}

  let remotePlays: SavedPlay[] = [];
  if (userId) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (Array.isArray(session?.user?.user_metadata?.tactic_playbook)) {
        remotePlays = session.user.user_metadata.tactic_playbook as SavedPlay[];
      }
    } catch {}
  }

  const mergedMap = new Map<string, SavedPlay>();
  [...remotePlays, ...localPlays].forEach((p) => {
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
    supabase.auth
      .updateUser({ data: { tactic_playbook: trimmed } })
      .catch(() => {});
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

  const next = [entry, ...current.filter((p) => p.id !== entry.id)];
  return {
    saved: true,
    list: savePlaybookList(userId, next, maxSlots),
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

  const mergedList = Array.from(mergedMap.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, Math.max(maxSlots, existingUserPlays.length + guestPlays.length));

  savePlaybookList(userId, mergedList, Math.max(maxSlots, mergedList.length));
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
// KOMPAKTER URL-CODEC FÜR "WIE WÜRDEST DU DAS SPIELEN?" (?replay=...)
// =========================================================================
export function encodeReplayToParam(title: string, ctx: ReplayContext): string {
  const payload = {
    t: title.slice(0, 48),
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

    return {
      title: String(data.t || "Padel Challenge"),
      context: {
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
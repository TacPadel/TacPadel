import { supabase } from "./supabase";
import { SCENARIOS, Scenario } from "../components/Scenarios";

export type RadarAxisKey =
  | "shotChoice"
  | "placement"
  | "positioning"
  | "netPlay"
  | "overhead"
  | "defense";

export type QualityLevel = "perfect" | "good" | "wobble" | "error";

export type DiagnosisType =
  | "mastered"          // Trainer hoch + Match hoch
  | "execution_gap"     // Trainer hoch + Match tief (Theorie klar, im Spiel nicht umgesetzt)
  | "core_weakness"     // Trainer tief + Match tief (Dauer-Baustelle)
  | "instinct_strength" // Trainer tief + Match hoch (Intuitiv stark im Match)
  | "trainer_only"      // Noch zu wenig Match-Daten
  | "match_only"        // Noch zu wenig Trainer-Daten
  | "insufficient";     // Noch zu wenig Gesamtdaten

export interface ScoreBucket {
  scoreSum: number;
  count: number;
}

export interface ModeStats {
  totalTurns: number;
  axes: Record<RadarAxisKey, ScoreBucket>;
  byShot: Record<string, ScoreBucket>;
}

export interface ScenarioHistory {
  wrong: number;
  correct: number;
  lastSeen: number;
}

export interface MatchErrorCounters {
  tacticalErrors: number;     // Falscher Schlag oder falsche Zone laut Taktik-Check
  wobbles: number;            // Wackler in der Ausführung
  positioningErrors: number;  // Stellungs- oder Laufwegfehler im Match
  unforcedErrors: number;     // Netz- oder direkte Glasfehler
}

export interface TacticCoachStats {
  version: 2;
  updatedAt: number;
  trainer: ModeStats;
  match: ModeStats;
  matchErrors: MatchErrorCounters;
  byScenario: Record<number, ScenarioHistory>;
  // Zählt bestandene Stellungsspiel-Drills auf dem TacticsBoard
  boardDrillsCompleted: number;
  // Kennzeichnet einmaligen Auto-Import aus historischen Supabase-Daten
  backfilledMatch?: boolean;
  backfilledTrainer?: boolean;
  hasLiveMatch?: boolean;
  hasLiveTrainer?: boolean;
}

export interface AxisComparison {
  axis: RadarAxisKey;
  trainerPct: number | null;
  matchPct: number | null;
  trainerCount: number;
  matchCount: number;
  gap: number | null; // trainerPct - matchPct (positiv = Umsetzungs-Lücke)
  diagnosis: DiagnosisType;
}

export interface CoachSummary {
  comparisons: AxisComparison[];
  primaryFocus: AxisComparison | null;
  weakestShot: {
    shot: string;
    trainerPct: number | null;
    matchPct: number | null;
    combinedPct: number;
  } | null;
  strongestShot: {
    shot: string;
    combinedPct: number;
  } | null;
  recommendedTaskFocus: "positioning" | "placement" | "shotChoice" | "full";
}

export const RADAR_AXES: RadarAxisKey[] = [
  "shotChoice",
  "placement",
  "positioning",
  "netPlay",
  "overhead",
  "defense",
];

const QUALITY_SCORE_MAP: Record<QualityLevel, number> = {
  perfect: 100,
  good: 80,
  wobble: 45,
  error: 0,
};

const clampPct = (val: number): number => Math.max(20, Math.min(95, Math.round(val)));

const createEmptyBucket = (): ScoreBucket => ({ scoreSum: 0, count: 0 });

const createEmptyModeStats = (): ModeStats => ({
  totalTurns: 0,
  axes: {
    shotChoice: createEmptyBucket(),
    placement: createEmptyBucket(),
    positioning: createEmptyBucket(),
    netPlay: createEmptyBucket(),
    overhead: createEmptyBucket(),
    defense: createEmptyBucket(),
  },
  byShot: {},
});

export function createEmptyCoachStats(): TacticCoachStats {
  return {
    version: 2,
    updatedAt: Date.now(),
    trainer: createEmptyModeStats(),
    match: createEmptyModeStats(),
    matchErrors: {
      tacticalErrors: 0,
      wobbles: 0,
      positioningErrors: 0,
      unforcedErrors: 0,
    },
    byScenario: {},
    boardDrillsCompleted: 0,
    backfilledMatch: false,
    backfilledTrainer: false,
    hasLiveMatch: false,
    hasLiveTrainer: false,
  };
}

const getStorageKey = (userId?: string | null) =>
  `tacpadel_coach_stats_v2_${userId || "guest"}`;

export function getShotCategoryAxis(shotType?: string | null): "netPlay" | "overhead" | "defense" {
  const s = (shotType || "").toUpperCase();
  if (s.includes("VOLLEY") || s.includes("BLOCK")) return "netPlay";
  if (s.includes("BANDEJA") || s.includes("VIBORA") || s.includes("VÍBORA") || s.includes("SMASH")) {
    return "overhead";
  }
  return "defense"; // LOB, CHIQUITA, BAJADA, DRIVE, AUFSCHLAG
}

function normalizeShotKey(shotType?: string | null): string {
  const s = (shotType || "DRIVE").toUpperCase().trim();
  if (s.includes("VÍBORA")) return "VIBORA";
  if (s.includes("SERVE")) return "AUFSCHLAG";
  return s;
}

function addScore(bucket: ScoreBucket, score: number) {
  bucket.scoreSum += score;
  bucket.count += 1;
}

function addWeightedScore(bucket: ScoreBucket, pct: number, weight: number) {
  bucket.scoreSum += pct * weight;
  bucket.count += weight;
}

export function getBucketPct(bucket?: ScoreBucket | null): number | null {
  if (!bucket || bucket.count === 0) return null;
  return Math.round(bucket.scoreSum / bucket.count);
}

function hydrateStats(raw: any): TacticCoachStats {
  const base = createEmptyCoachStats();
  if (!raw || raw.version !== 2) return base;

  const hydrateMode = (modeRaw: any): ModeStats => {
    const mode = createEmptyModeStats();
    if (!modeRaw) return mode;
    mode.totalTurns = modeRaw.totalTurns || 0;
    for (const axis of RADAR_AXES) {
      if (modeRaw.axes?.[axis]) {
        mode.axes[axis] = {
          scoreSum: modeRaw.axes[axis].scoreSum || 0,
          count: modeRaw.axes[axis].count || 0,
        };
      }
    }
    if (modeRaw.byShot && typeof modeRaw.byShot === "object") {
      mode.byShot = modeRaw.byShot;
    }
    return mode;
  };

  const hydratedTrainer = hydrateMode(raw.trainer);
  const hydratedMatch = hydrateMode(raw.match);

  return {
    version: 2,
    updatedAt: raw.updatedAt || Date.now(),
    trainer: hydratedTrainer,
    match: hydratedMatch,
    matchErrors: {
      tacticalErrors: raw.matchErrors?.tacticalErrors || 0,
      wobbles: raw.matchErrors?.wobbles || 0,
      positioningErrors: raw.matchErrors?.positioningErrors || 0,
      unforcedErrors: raw.matchErrors?.unforcedErrors || 0,
    },
    byScenario: raw.byScenario || {},
    boardDrillsCompleted: raw.boardDrillsCompleted || 0,
    backfilledMatch: Boolean(raw.backfilledMatch),
    backfilledTrainer: Boolean(raw.backfilledTrainer),
    hasLiveMatch:
      typeof raw.hasLiveMatch === "boolean"
        ? raw.hasLiveMatch
        : hydratedMatch.totalTurns > 0 && !raw.backfilledMatch,
    hasLiveTrainer:
      typeof raw.hasLiveTrainer === "boolean"
        ? raw.hasLiveTrainer
        : hydratedTrainer.totalTurns > 0 && !raw.backfilledTrainer,
  };
}

export function loadLocalCoachStats(userId?: string | null): TacticCoachStats {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return createEmptyCoachStats();
    return hydrateStats(JSON.parse(raw));
  } catch {
    return createEmptyCoachStats();
  }
}

function persistCoachStats(userId: string | null | undefined, stats: TacticCoachStats) {
  stats.updatedAt = Date.now();
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(stats));
  } catch {}

  if (userId) {
    supabase
      .from("user_stats")
      .update({ tactic_stats: stats })
      .eq("id", userId)
      .then(() => {});
  }
}

// =========================================================================
// 0. EINMALIGER AUTO-BACKFILL AUS SUPABASE MATCH_HISTORY & TRAINER-LEVELN
// =========================================================================
function applyTrainerLevelBackfill(
  stats: TacticCoachStats,
  highestScores?: Record<string, number>
): boolean {
  if (stats.backfilledTrainer || stats.trainer.totalTurns > 0) return false;

  let scores: Record<string, number> = highestScores ? { ...highestScores } : {};
  if (Object.keys(scores).length === 0) {
    try {
      const rawProg =
        localStorage.getItem("tacpadel_progress") ||
        localStorage.getItem("tacpadel_highest_scores");
      if (rawProg) {
        const parsed = JSON.parse(rawProg);
        scores = parsed?.highestScores || parsed || {};
      }
    } catch {}
  }

  const sSchlag = Math.min(10, Math.max(0, scores["Schlag"] || 0));
  const sRichtung = Math.min(10, Math.max(0, scores["Schlagrichtung"] || 0));
  const sLauf = Math.min(10, Math.max(0, scores["Laufrichtung"] || 0));
  const sSpielzug = Math.min(10, Math.max(0, scores["Spielzug"] || 0));

  if (sSchlag === 0 && sRichtung === 0 && sLauf === 0 && sSpielzug === 0) {
    return false;
  }

  // Moderates Start-Gewicht (4 Züge), damit neue Trainer-Runden das Radar sofort weiterformen
  const weight = 4;

  const shotChoicePct =
    sSchlag > 0 ? clampPct(55 + sSchlag * 3 + (sSpielzug >= 10 ? 5 : 0)) : null;
  const placementPct =
    sRichtung > 0 ? clampPct(52 + sRichtung * 3.2 + (sSpielzug >= 10 ? 5 : 0)) : null;
  const positioningPct =
    sLauf > 0 ? clampPct(52 + sLauf * 3.2 + (sSpielzug >= 10 ? 5 : 0)) : null;
  const netPlayPct =
    sSpielzug > 0
      ? clampPct(54 + sSpielzug * 3)
      : sRichtung >= 10
      ? 72
      : null;
  const overheadPct =
    sSpielzug > 0
      ? clampPct(52 + sSpielzug * 3)
      : sSchlag >= 10
      ? 70
      : null;
  const defensePct =
    sLauf > 0
      ? clampPct(54 + sLauf * 3)
      : sSchlag >= 10
      ? 72
      : null;

  if (shotChoicePct !== null) addWeightedScore(stats.trainer.axes.shotChoice, shotChoicePct, weight);
  if (placementPct !== null) addWeightedScore(stats.trainer.axes.placement, placementPct, weight);
  if (positioningPct !== null) addWeightedScore(stats.trainer.axes.positioning, positioningPct, weight);
  if (netPlayPct !== null) addWeightedScore(stats.trainer.axes.netPlay, netPlayPct, weight);
  if (overheadPct !== null) addWeightedScore(stats.trainer.axes.overhead, overheadPct, weight);
  if (defensePct !== null) addWeightedScore(stats.trainer.axes.defense, defensePct, weight);

  stats.trainer.totalTurns = weight;
  stats.backfilledTrainer = true;
  stats.hasLiveTrainer = false;
  return true;
}

async function applySupabaseMatchBackfill(
  userId: string,
  stats: TacticCoachStats
): Promise<boolean> {
  if (stats.backfilledMatch || stats.match.totalTurns > 0) return false;

  try {
    let { data: historyData, error } = await supabase
      .from("match_history")
      .select("result, aces, winners, unforced_errors, total_shots, shots_perfect, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      const fallback = await supabase
        .from("match_history")
        .select("result, aces, winners, unforced_errors, total_shots, shots_perfect")
        .eq("user_id", userId)
        .limit(25);
      historyData = fallback.data as any;
    }

    if (!Array.isArray(historyData) || historyData.length === 0) {
      return false;
    }

    const totalMatches = historyData.length;
    const wins = historyData.filter((m: any) => m.result === "win").length;
    const winRate = wins / totalMatches;

    const totalShots = historyData.reduce((sum: number, m: any) => sum + (m.total_shots || 0), 0);
    const perfectShots = historyData.reduce((sum: number, m: any) => sum + (m.shots_perfect || 0), 0);
    const winners = historyData.reduce((sum: number, m: any) => sum + (m.winners || 0), 0);
    const aces = historyData.reduce((sum: number, m: any) => sum + (m.aces || 0), 0);
    const unforcedErrors = historyData.reduce(
      (sum: number, m: any) => sum + (m.unforced_errors || 0),
      0
    );

    const perfRatioPct = totalShots > 0 ? (perfectShots / totalShots) * 100 : null;
    const basePrecision =
      perfRatioPct !== null
        ? clampPct(46 + perfRatioPct * 1.05)
        : clampPct(50 + winRate * 30);

    const errPerMatch = unforcedErrors / totalMatches;
    const errPenalty = Math.min(24, Math.round(errPerMatch * 4));

    const winShotsPerMatch = (winners + aces) / totalMatches;
    const attackBonus = Math.min(20, Math.round(winShotsPerMatch * 3.5));

    const shotChoicePct = clampPct(basePrecision + Math.round(winRate * 12) - Math.round(errPenalty * 0.5));
    const placementPct = clampPct(basePrecision + 4 - errPenalty);
    const positioningPct = clampPct(48 + winRate * 32 - Math.round(errPenalty * 0.6));
    const netPlayPct = clampPct(basePrecision + Math.round(attackBonus * 0.7) - Math.round(errPenalty * 0.5));
    const overheadPct = clampPct(basePrecision + attackBonus - Math.round(errPenalty * 0.4));
    const defensePct = clampPct(50 + winRate * 28 - Math.round(errPenalty * 0.8));

    // Moderates Start-Gewicht (3–6 Züge), damit 2–3 neue Matches das Spinnennetz spürbar weiterbewegen
    const weight = Math.min(6, Math.max(3, Math.round(totalMatches / 2)));

    addWeightedScore(stats.match.axes.shotChoice, shotChoicePct, weight);
    addWeightedScore(stats.match.axes.placement, placementPct, weight);
    addWeightedScore(stats.match.axes.positioning, positioningPct, weight);
    addWeightedScore(stats.match.axes.netPlay, netPlayPct, weight);
    addWeightedScore(stats.match.axes.overhead, overheadPct, weight);
    addWeightedScore(stats.match.axes.defense, defensePct, weight);

    stats.match.totalTurns = weight;
    stats.matchErrors.unforcedErrors += unforcedErrors;
    stats.backfilledMatch = true;
    stats.hasLiveMatch = false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchCoachStats(
  userId?: string | null,
  trainerHighestScores?: Record<string, number>
): Promise<TacticCoachStats> {
  let stats = loadLocalCoachStats(userId);

  if (userId) {
    try {
      const { data, error } = await supabase
        .from("user_stats")
        .select("tactic_stats")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data?.tactic_stats && (data.tactic_stats as any).version === 2) {
        const remote = hydrateStats(data.tactic_stats);
        const localVolume =
          stats.trainer.totalTurns + stats.match.totalTurns + stats.boardDrillsCompleted;
        const remoteVolume =
          remote.trainer.totalTurns + remote.match.totalTurns + remote.boardDrillsCompleted;

        stats = remoteVolume >= localVolume ? remote : stats;
      }
    } catch {
      // Offline-Fallback: lokaler Stand bleibt aktiv
    }
  }

  let didBackfill = false;
  if (applyTrainerLevelBackfill(stats, trainerHighestScores)) {
    didBackfill = true;
  }
  if (userId && (await applySupabaseMatchBackfill(userId, stats))) {
    didBackfill = true;
  }

  if (didBackfill) {
    persistCoachStats(userId, stats);
  } else {
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(stats));
    } catch {}
  }

  return stats;
}

// =========================================================================
// 1. TRACKING FÜR TAKTIK-TRAINER (Aufrufen beim 1. Versuch in App.tsx)
// =========================================================================
export function recordTrainerAttempt(params: {
  userId?: string | null;
  scenarioId: number;
  primaryShot: string;
  needsShot: boolean;
  needsTarget: boolean;
  needsRun: boolean;
  isShotCorrect: boolean;
  isZoneCorrect: boolean;
  isZoneAcceptable?: boolean;
  isLaufZoneCorrect: boolean;
  isLaufZoneAcceptable?: boolean;
  isFullyCorrect: boolean;
}): TacticCoachStats {
  const stats = loadLocalCoachStats(params.userId);
  const shotKey = normalizeShotKey(params.primaryShot);
  const categoryAxis = getShotCategoryAxis(shotKey);

  stats.trainer.totalTurns += 1;
  stats.hasLiveTrainer = true;

  // 3 Taktik-Dimensionen
  if (params.needsShot) {
    addScore(stats.trainer.axes.shotChoice, params.isShotCorrect ? 100 : 0);
  }
  if (params.needsTarget) {
    const targetScore = params.isZoneCorrect ? 100 : params.isZoneAcceptable ? 70 : 0;
    addScore(stats.trainer.axes.placement, targetScore);
  }
  if (params.needsRun) {
    const runScore = params.isLaufZoneCorrect ? 100 : params.isLaufZoneAcceptable ? 70 : 0;
    addScore(stats.trainer.axes.positioning, runScore);
  }

  // 3 Spielbereich-Achsen (Netz / Überkopf / Defensive) + Schlagart
  const overallScore = params.isFullyCorrect ? 100 : 0;
  addScore(stats.trainer.axes[categoryAxis], overallScore);

  if (!stats.trainer.byShot[shotKey]) {
    stats.trainer.byShot[shotKey] = createEmptyBucket();
  }
  addScore(stats.trainer.byShot[shotKey], overallScore);

  // Szenario-Historie für gezielte Wiederholung
  if (!stats.byScenario[params.scenarioId]) {
    stats.byScenario[params.scenarioId] = { wrong: 0, correct: 0, lastSeen: Date.now() };
  }
  stats.byScenario[params.scenarioId].lastSeen = Date.now();
  if (params.isFullyCorrect) {
    stats.byScenario[params.scenarioId].correct += 1;
  } else {
    stats.byScenario[params.scenarioId].wrong += 1;
  }

  persistCoachStats(params.userId, stats);
  return stats;
}

// =========================================================================
// 2. TRACKING FÜR 3D-MATCH (Aufrufen nach jedem eigenen Zug in GameScreen.tsx)
// =========================================================================
export function recordMatchTurn(params: {
  userId?: string | null;
  shotType: string;
  shotChoiceQuality: QualityLevel;     // Passte der Schlag zur Situation?
  placementQuality: QualityLevel;      // Traf der Ball eine sinnvolle Zone?
  executionQuality: QualityLevel;      // Ausführung: perfekt / gut / Wackler / Fehler
  positioningQuality?: QualityLevel;   // Laufweg / Stellung nach dem Schlag (optional)
  isUnforcedError?: boolean;           // Netz- oder direkter Glasfehler
}): TacticCoachStats {
  const stats = loadLocalCoachStats(params.userId);
  const shotKey = normalizeShotKey(params.shotType);
  const categoryAxis = getShotCategoryAxis(shotKey);

  const shotScore = QUALITY_SCORE_MAP[params.shotChoiceQuality];
  const placementScore = QUALITY_SCORE_MAP[params.placementQuality];
  const executionScore = QUALITY_SCORE_MAP[params.executionQuality];
  const positioningScore = params.positioningQuality
    ? QUALITY_SCORE_MAP[params.positioningQuality]
    : null;

  stats.match.totalTurns += 1;
  stats.hasLiveMatch = true;

  // 3 Taktik-Dimensionen im Match
  addScore(stats.match.axes.shotChoice, shotScore);
  // Platzierung kombiniert Zielwahl und saubere Ausführung
  addScore(stats.match.axes.placement, Math.round(placementScore * 0.6 + executionScore * 0.4));
  if (positioningScore !== null) {
    addScore(stats.match.axes.positioning, positioningScore);
  }

  // Spielbereich-Achse & Schlagart (kombiniert Taktik + Ausführung)
  const combinedTurnScore = Math.round(
    shotScore * 0.35 + placementScore * 0.35 + executionScore * 0.3
  );
  addScore(stats.match.axes[categoryAxis], combinedTurnScore);

  if (!stats.match.byShot[shotKey]) {
    stats.match.byShot[shotKey] = createEmptyBucket();
  }
  addScore(stats.match.byShot[shotKey], combinedTurnScore);

  // Fehler-Zähler für präzises Coach-Feedback
  if (params.shotChoiceQuality === "error" || params.placementQuality === "error") {
    stats.matchErrors.tacticalErrors += 1;
  }
  if (params.executionQuality === "wobble") {
    stats.matchErrors.wobbles += 1;
  }
  if (params.positioningQuality === "error" || params.positioningQuality === "wobble") {
    stats.matchErrors.positioningErrors += 1;
  }
  if (params.isUnforcedError || params.executionQuality === "error") {
    stats.matchErrors.unforcedErrors += 1;
  }

  persistCoachStats(params.userId, stats);
  return stats;
}

// =========================================================================
// 2b. DEFENSIV- & STELLUNGSFEHLER IM MATCH (Ball im Timer nicht erlaufen)
// =========================================================================
export function recordMatchDefenseError(params: {
  userId?: string | null;
  incomingShot?: string | null;
  reason: "missed_time" | "wrong_zone" | "smash_over_head";
}): TacticCoachStats {
  const stats = loadLocalCoachStats(params.userId);

  stats.match.totalTurns += 1;
  stats.hasLiveMatch = true;
  addScore(stats.match.axes.positioning, 0);
  addScore(stats.match.axes.defense, params.reason === "missed_time" ? 25 : 0);
  stats.matchErrors.positioningErrors += 1;

  persistCoachStats(params.userId, stats);
  return stats;
}

// =========================================================================
// 2c. TRACKING FÜR TAKTIKBOARD-DRILLS (Stellungsspiel-Training am Board)
// =========================================================================
export function recordBoardDrill(params: {
  userId?: string | null;
  scorePct: number;
  passed: boolean;
}): TacticCoachStats {
  const stats = loadLocalCoachStats(params.userId);
  const clampedScore = Math.max(0, Math.min(100, Math.round(params.scorePct)));

  if (params.passed) {
    stats.boardDrillsCompleted = (stats.boardDrillsCompleted || 0) + 1;
  }

  stats.trainer.totalTurns += 1;
  stats.hasLiveTrainer = true;
  addScore(stats.trainer.axes.positioning, clampedScore);

  persistCoachStats(params.userId, stats);
  return stats;
}

// =========================================================================
// 3. COACH-ANALYSE: VERGLEICH TRAINER VS. 3D-MATCH
// =========================================================================
export function analyzeCoachStats(stats: TacticCoachStats): CoachSummary {
  const comparisons: AxisComparison[] = RADAR_AXES.map((axis) => {
    const tBucket = stats.trainer.axes[axis];
    const mBucket = stats.match.axes[axis];
    const trainerPct = getBucketPct(tBucket);
    const matchPct = getBucketPct(mBucket);
    const gap = trainerPct !== null && matchPct !== null ? trainerPct - matchPct : null;

    let diagnosis: DiagnosisType = "insufficient";

    if (trainerPct !== null && matchPct !== null) {
      if (trainerPct >= 75 && matchPct >= 75) {
        diagnosis = "mastered";
      } else if (trainerPct < 65 && matchPct < 65) {
        diagnosis = "core_weakness";
      } else if (gap !== null && gap >= 15) {
        diagnosis = "execution_gap";
      } else if (gap !== null && gap <= -15) {
        diagnosis = "instinct_strength";
      } else if (matchPct < 70) {
        diagnosis = "execution_gap";
      } else {
        diagnosis = "mastered";
      }
    } else if (trainerPct !== null) {
      diagnosis = "trainer_only";
    } else if (matchPct !== null) {
      diagnosis = "match_only";
    }

    return {
      axis,
      trainerPct,
      matchPct,
      trainerCount: tBucket.count,
      matchCount: mBucket.count,
      gap,
      diagnosis,
    };
  });

  // Wichtigste Baustelle bestimmen:
  // 1. Dauer-Baustelle (Trainer & Match schwach)
  // 2. Umsetzungs-Lücke (Trainer gut, Match schwach)
  // 3. Niedrigster Einzelwert
  const prioritized = [...comparisons]
    .filter((c) => c.trainerPct !== null || c.matchPct !== null)
    .sort((a, b) => {
      const rank = (d: DiagnosisType) => {
        if (d === "core_weakness") return 4;
        if (d === "execution_gap") return 3;
        if (d === "match_only" || d === "trainer_only") return 2;
        if (d === "instinct_strength") return 1;
        return 0;
      };
      const rDiff = rank(b.diagnosis) - rank(a.diagnosis);
      if (rDiff !== 0) return rDiff;

      const scoreA = a.matchPct ?? a.trainerPct ?? 100;
      const scoreB = b.matchPct ?? b.trainerPct ?? 100;
      return scoreA - scoreB;
    });

  const primaryFocus = prioritized[0] || null;

  // Schlagarten aus beiden Modi kombinieren
  const allShots = new Set([
    ...Object.keys(stats.trainer.byShot),
    ...Object.keys(stats.match.byShot),
  ]);

  const shotList = Array.from(allShots)
    .map((shot) => {
      const tPct = getBucketPct(stats.trainer.byShot[shot]);
      const mPct = getBucketPct(stats.match.byShot[shot]);
      // Match zählt etwas stärker (60 %), weil es die echte Umsetzung zeigt
      const combinedPct =
        tPct !== null && mPct !== null
          ? Math.round(tPct * 0.4 + mPct * 0.6)
          : mPct ?? tPct ?? 100;
      return { shot, trainerPct: tPct, matchPct: mPct, combinedPct };
    })
    .sort((a, b) => a.combinedPct - b.combinedPct);

  const weakestShot = shotList[0] || null;
  const strongestShot = shotList.length > 0 ? shotList[shotList.length - 1] : null;

  // Empfohlener Aufgaben-Fokus für den Taktik-Trainer
  const dimAxes = comparisons.filter((c) =>
    ["shotChoice", "placement", "positioning"].includes(c.axis)
  );
  const weakestDim = dimAxes
    .filter((c) => (c.matchPct ?? c.trainerPct) !== null)
    .sort((a, b) => (a.matchPct ?? a.trainerPct ?? 100) - (b.matchPct ?? b.trainerPct ?? 100))[0];

  const recommendedTaskFocus: CoachSummary["recommendedTaskFocus"] =
    weakestDim && (weakestDim.matchPct ?? weakestDim.trainerPct ?? 100) < 70
      ? (weakestDim.axis as "positioning" | "placement" | "shotChoice")
      : "full";

  return {
    comparisons,
    primaryFocus,
    weakestShot,
    strongestShot,
    recommendedTaskFocus,
  };
}

// =========================================================================
// 4. INTELLIGENTE SZENARIO-AUSWAHL (Trainer + Match-Schwächen kombiniert)
// =========================================================================
export function buildSmartWeaknessPool(
  stats: TacticCoachStats,
  count: number = 10
): { scenarios: Scenario[]; focus: CoachSummary["recommendedTaskFocus"] } {
  const summary = analyzeCoachStats(stats);
  const axisDiagnosisMap = new Map(summary.comparisons.map((c) => [c.axis, c]));

  const scored = SCENARIOS.map((scenario) => {
    const primaryShot = normalizeShotKey(scenario.validShots[0]);
    const categoryAxis = getShotCategoryAxis(primaryShot);

    const scHist = stats.byScenario[scenario.id];
    const tShotPct = getBucketPct(stats.trainer.byShot[primaryShot]);
    const mShotPct = getBucketPct(stats.match.byShot[primaryShot]);
    const axisComp = axisDiagnosisMap.get(categoryAxis);

    let priority = 0;

    // 1. Direkte Szenario-Fehler aus dem Trainer
    if (scHist) {
      priority += scHist.wrong * 35 - scHist.correct * 10;
    }

    // 2. Match-Schwäche bei dieser Schlagart (2x Gewicht -> Praxis-Umsetzung!)
    if (mShotPct !== null) {
      priority += (100 - mShotPct) * 0.9;
    }

    // 3. Trainer-Schwäche bei dieser Schlagart
    if (tShotPct !== null) {
      priority += (100 - tShotPct) * 0.5;
    }

    // 4. Dauer-Baustelle bekommt Extra-Boost (3x Fokus)
    if (axisComp?.diagnosis === "core_weakness") {
      priority += 45;
    } else if (axisComp?.diagnosis === "execution_gap") {
      priority += 30;
    }

    // 5. Wenn Stellungsspiel die Hauptschwäche ist, Szenarien mit Laufweg (ID >= 31) bevorzugen
    if (summary.recommendedTaskFocus === "positioning" && scenario.id >= 31) {
      priority += 25;
    }

    // Kleine Zufallsstreuung, damit sich Runden nicht starr wiederholen
    priority += Math.random() * 10;

    return { scenario, priority };
  });

  const seen = new Set<number>();
  const uniqueSorted = scored
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      if (seen.has(item.scenario.id)) return false;
      seen.add(item.scenario.id);
      return true;
    });

  return {
    scenarios: uniqueSorted.slice(0, count).map((i) => i.scenario),
    focus: summary.recommendedTaskFocus,
  };
}

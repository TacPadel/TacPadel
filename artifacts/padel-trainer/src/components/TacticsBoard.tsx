import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import TrajectoryView3D from "./TrajectoryView3D";
import type { Scenario as TrainerScenario } from "./Scenarios";
import { useTranslation, formatShotName } from "../lib/i18n";
import {
  fetchCoachStats,
  buildSmartWeaknessPool,
  recordBoardDrill,
} from "../lib/tacticStats";
import { useEntitlements } from "../lib/entitlements";
import {
  STANDARD_DRILL_IDS,
  StandardDrillId,
  GeneratedDrill,
  generateStandardDrill,
  buildPlaybookDrill,
  generateSmartDrillMeta,
} from "../lib/drillGenerator";
import {
  DrillDepth,
  SavedPlay,
  loadPlaybook,
  savePlaybookList,
} from "../lib/playbook";
import {
  V_WIDTH,
  V_HEIGHT,
  GAP_THRESHOLD,
  WIDE_GAP_THRESHOLD,
  DEPTH_GAP_THRESHOLD,
  DEEP_DEF_THRESHOLD,
  SCENARIOS,
  DraggableItem,
  StudioDrawing,
  BoardKeyframe,
  StudioTool,
  TacticalFilters,
  isBallArrowType,
  cloneItems,
  cloneDrawings,
  cloneKeyframes,
  easeInOut,
  getLobControlPoint,
  getGlassBouncePoint,
  applyDrawingsToItems,
  hasTeamAMoved,
  trainerScenarioToBoardItems,
  getArcX,
  getControlPointX,
  getDangerAngleCone,
  getTacticalTargetAndRec,
  getTacticalAnalysis,
} from "../lib/tacticsMath";

type BoardMode = "tactics" | "drill" | "studio" | "3d";
type DrillCategory = "all" | "standard" | "playbook";

type DrillSlot =
  | { source: "standard"; id: StandardDrillId }
  | { source: "playbook"; id: string; play: SavedPlay };

interface DrillCheckResult {
  scorePct: number;
  passed: boolean;
  checks: {
    label: string;
    ok: boolean;
  }[];
}

// ==========================================
// HAUPT-KOMPONENTE (2D, COACH-DRILL, STUDIO & 3D)
// ==========================================
export default function TacticsBoard() {
  const { lang, t } = useTranslation();
  const { userId: boardUserId, entitlements, loading: entitlementsLoading } = useEntitlements();

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

  // --- DYNAMISCHER HAUPTSCHALTER: 2D | [DRILL] | [STUDIO] | 3D ---
  const [activeMode, setActiveMode] = useState<BoardMode>(() => {
    try {
      if (
        sessionStorage.getItem("tacpadel_open_play_id") ||
        sessionStorage.getItem("tacpadel_open_board_mode") === "studio"
      ) {
        return "studio";
      }
    } catch {}
    return "tactics";
  });

  // --- COACH-SCHWÄCHEN-POOL FÜR 2D-VORLAGEN ---
  const [weaknessPool, setWeaknessPool] = useState<TrainerScenario[]>([]);

  // --- COACH-DRILL TAB STATES (Dynamisch gemischte Standard- + eigene Playbook-Drills) ---
  const [drillCategory, setDrillCategory] = useState<DrillCategory>("all");
  const [activeDrillIdx, setActiveDrillIdx] = useState<number>(0);
  const [drillVariantSeed, setDrillVariantSeed] = useState<number>(0);
  const [drillResult, setDrillResult] = useState<DrillCheckResult | null>(null);
  const [showDrillSolution, setShowDrillSolution] = useState<boolean>(false);

  // --- MULTI-STEP KEYFRAME ANIMATION (Exklusiv im Studio, inkl. Lob & Scheibe) ---
  const [keyframes, setKeyframes] = useState<BoardKeyframe[]>([]);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<0.7 | 1 | 1.5>(1);
  const [ballScale, setBallScale] = useState<number>(1);
  const [stepToast, setStepToast] = useState<string | null>(null);
  const animRafRef = useRef<number | null>(null);
  const playbackFramesRef = useRef<BoardKeyframe[]>([]);

  // --- MEIN PLAYBOOK (Zentral über src/lib/playbook.ts) ---
  const [isPlaybookOpen, setIsPlaybookOpen] = useState<boolean>(false);
  const [playbook, setPlaybook] = useState<SavedPlay[]>([]);
  const [playTitle, setPlayTitle] = useState<string>("");
  const [playAsDrill, setPlayAsDrill] = useState<boolean>(false);
  const [playDrillPrompt, setPlayDrillPrompt] = useState<string>("");
  const [playDrillExpl, setPlayDrillExpl] = useState<string>("");
  const [playDrillDepth, setPlayDrillDepth] = useState<DrillDepth>("back");
  const [playbookToast, setPlaybookToast] = useState<string | null>(null);

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

  // Lädt einen gespeicherten Playbook-Spielzug sauber ins Board / Studio
  const applySavedPlayToBoard = useCallback((play: SavedPlay) => {
    setLoadedTrainerScenario(null);
    setSelectedScenarioKey("custom");
    setCustomTarget(null);

    const loadedFrames = cloneKeyframes(play.keyframes || []);
    setKeyframes(loadedFrames);
    if (loadedFrames.length > 0) {
      setActiveStepIdx(0);
      setItems(cloneItems(loadedFrames[0].items));
      const initialDrawings =
        loadedFrames[0].drawings && loadedFrames[0].drawings.length > 0
          ? cloneDrawings(loadedFrames[0].drawings)
          : cloneDrawings(play.drawings || []);
      setDrawings(initialDrawings);
    } else {
      setActiveStepIdx(null);
      setItems(cloneItems(play.items));
      setDrawings(cloneDrawings(play.drawings || []));
    }

    setPlayTitle(play.title);
    setStudioTitle(play.title);
    setPlayAsDrill(Boolean(play.isDrill));
    setPlayDrillPrompt(play.drillPrompt || "");
    setPlayDrillExpl(play.drillExplanation || "");
    setPlayDrillDepth(play.drillTargetDepth || "back");
  }, []);

  // Lädt Playbook, prüft Auto-Load aus dem Playbook Hub und holt Coach-Schwächen
  useEffect(() => {
    if (entitlementsLoading) return;
    let active = true;

    async function loadBoardData() {
      const mergedPlaybook = await loadPlaybook(boardUserId);
      if (!active) return;
      setPlaybook(mergedPlaybook);

      let pendingPlayId: string | null = null;
      let pendingMode: string | null = null;
      try {
        pendingPlayId = sessionStorage.getItem("tacpadel_open_play_id");
        pendingMode = sessionStorage.getItem("tacpadel_open_board_mode");
      } catch {}

      if (pendingPlayId) {
        try {
          sessionStorage.removeItem("tacpadel_open_play_id");
          sessionStorage.removeItem("tacpadel_open_board_mode");
        } catch {}

        const targetPlay = mergedPlaybook.find((p) => p.id === pendingPlayId);
        if (targetPlay) {
          applySavedPlayToBoard(targetPlay);
          if (entitlements.canAccessStudio) {
            setShowTactics(false);
            setActiveMode("studio");
            setIsPlaybookOpen(false);
          }
        }
      } else if (pendingMode === "studio") {
        try {
          sessionStorage.removeItem("tacpadel_open_board_mode");
        } catch {}

        if (entitlements.canAccessStudio) {
          setShowTactics(false);
          setActiveMode("studio");
          setIsPlaybookOpen(false);
        }
      }

      if (entitlements.hasAdvancedBoardOverlays && boardUserId) {
        const stats = await fetchCoachStats(boardUserId);
        if (!active) return;
        if (stats.trainer.totalTurns > 0 || stats.match.totalTurns > 0) {
          const { scenarios } = buildSmartWeaknessPool(stats, 5);
          setWeaknessPool(scenarios);
        } else {
          setWeaknessPool([]);
        }
      } else if (active) {
        setWeaknessPool([]);
      }
    }

    loadBoardData();

    const handlePlaybookUpdated = () => {
      loadPlaybook(boardUserId).then((list) => {
        if (active) setPlaybook(list);
      });
    };
    window.addEventListener("tacpadel-playbook-updated", handlePlaybookUpdated);

    return () => {
      active = false;
      window.removeEventListener("tacpadel-playbook-updated", handlePlaybookUpdated);
    };
  }, [
    boardUserId,
    entitlementsLoading,
    entitlements.canAccessStudio,
    entitlements.hasAdvancedBoardOverlays,
    applySavedPlayToBoard,
  ]);

  // Sicherheits-Fallback, falls ein Modus durch Entitlements deaktiviert wird
  useEffect(() => {
    if (!entitlements.canAccessStudio && activeMode === "studio") {
      setActiveMode("tactics");
      setIsPlaybookOpen(false);
      setIsPlaying(false);
    }
    if (!entitlements.canAccessDrills && activeMode === "drill") {
      setActiveMode("tactics");
    }
    if (!entitlements.canCreateCustomDrills && drillCategory === "playbook") {
      setDrillCategory("all");
    }
  }, [
    entitlements.canAccessStudio,
    entitlements.canAccessDrills,
    entitlements.canCreateCustomDrills,
    activeMode,
    drillCategory,
  ]);

  // --- DYNAMISCHE DRILL-SLOTS (Standard + eigene Playbook-Drills) ---
  const playbookDrillEntries = useMemo(() => {
    if (!entitlements.canCreateCustomDrills) return [];
    return playbook.filter((p) => Boolean(p.isDrill));
  }, [playbook, entitlements.canCreateCustomDrills]);

  const drillSlots: DrillSlot[] = useMemo(() => {
    const stdSlots: DrillSlot[] = STANDARD_DRILL_IDS.map((id) => ({
      source: "standard",
      id,
    }));
    const pbSlots: DrillSlot[] = playbookDrillEntries.map((play) => ({
      source: "playbook",
      id: `pb_${play.id}`,
      play,
    }));

    if (!entitlements.canCreateCustomDrills) return stdSlots;
    if (drillCategory === "standard") return stdSlots;
    if (drillCategory === "playbook") return pbSlots;
    return [...pbSlots, ...stdSlots];
  }, [drillCategory, playbookDrillEntries, entitlements.canCreateCustomDrills]);

  const safeDrillIdx =
    drillSlots.length > 0 ? Math.min(activeDrillIdx, drillSlots.length - 1) : 0;

  // Würfelt beim Öffnen, Wechseln oder Klick auf "🎲 Neue Variante" eine frische Variante
  const activeDrill: GeneratedDrill | null = useMemo(() => {
    if (!entitlements.canAccessDrills || activeMode !== "drill") return null;
    const slot = drillSlots[safeDrillIdx];
    if (!slot) return null;

    if (slot.source === "standard") {
      return generateStandardDrill(slot.id, lang);
    }
    return buildPlaybookDrill(slot.play, lang, { remix: drillVariantSeed > 0 });
  }, [
    entitlements.canAccessDrills,
    activeMode,
    drillSlots,
    safeDrillIdx,
    lang,
    drillVariantSeed,
  ]);

  // Lädt die Startaufstellung automatisch, sobald ein neuer Drill oder eine neue Variante generiert wird
  useEffect(() => {
    if (activeMode === "drill" && activeDrill) {
      setItems(cloneItems(activeDrill.startItems));
      setDrillResult(null);
      setShowDrillSolution(false);
      setShowTactics(true);
      setLoadedTrainerScenario(null);
      setSelectedScenarioKey("custom");
      setCustomTarget(null);
    }
  }, [activeMode, activeDrill]);

  // Im Studio startet die Analyse immer ausgeschaltet (erst per Button aktivierbar)
  useEffect(() => {
    if (activeMode === "studio") {
      setShowTactics(false);
    }
  }, [activeMode]);

  // Basis-Nutzer erhalten eine saubere Kern-Analyse (Gummiband inkl. Tiefen-Riss + Zielvektor)
  const effectiveFilters: TacticalFilters = useMemo(() => {
    if (entitlements.hasAdvancedBoardOverlays) return filters;
    return {
      showBallVector: true,
      showTeamLines: true,
      showWeaknessZones: false,
      showMovements: false,
      showPulse: false,
      showAttackArc: false,
      showAngleCone: false,
    };
  }, [entitlements.hasAdvancedBoardOverlays, filters]);

  const netX = V_WIDTH / 2;
  const offsetX = 10 + (V_WIDTH - 20) * 0.15;

  const analysis = useMemo(
    () =>
      getTacticalAnalysis(
        items,
        effectiveFilters,
        selectedScenarioKey,
        entitlements.hasAdvancedBoardOverlays ? customTarget : null,
        t
      ),
    [items, effectiveFilters, selectedScenarioKey, customTarget, entitlements.hasAdvancedBoardOverlays, lang]
  );

  const allDrawingsToRender = currentDraft ? [...drawings, currentDraft] : drawings;

  const liveStateRef = useRef({
    items,
    drawings: allDrawingsToRender,
    showTactics,
    filters: effectiveFilters,
    analysis,
    studioTitle,
    ballScale,
    hasCleanVideoExport: entitlements.hasCleanVideoExport,
  });

  useEffect(() => {
    liveStateRef.current = {
      items,
      drawings: allDrawingsToRender,
      showTactics,
      filters: effectiveFilters,
      analysis,
      studioTitle,
      ballScale,
      hasCleanVideoExport: entitlements.hasCleanVideoExport,
    };
  }, [
    items,
    allDrawingsToRender,
    showTactics,
    effectiveFilters,
    analysis,
    studioTitle,
    ballScale,
    entitlements.hasCleanVideoExport,
  ]);

  // Prüft, ob am aktuell ausgewählten Schritt ungespeicherte Änderungen vorliegen
  const isActiveStepDirty = useMemo(() => {
    if (activeStepIdx === null || isPlaying) return false;
    const kf = keyframes[activeStepIdx];
    if (!kf) return false;

    const itemsChanged = kf.items.some((kItem) => {
      const cur = items.find((i) => i.id === kItem.id);
      return (
        !cur ||
        Math.round(cur.x) !== Math.round(kItem.x) ||
        Math.round(cur.y) !== Math.round(kItem.y)
      );
    });
    if (itemsChanged) return true;

    const kfDrawings = kf.drawings || [];
    if (kfDrawings.length !== drawings.length) return true;
    return kfDrawings.some((kd, idx) => {
      const cd = drawings[idx];
      return (
        !cd ||
        cd.type !== kd.type ||
        Math.round(cd.x1) !== Math.round(kd.x1) ||
        Math.round(cd.y1) !== Math.round(kd.y1) ||
        Math.round(cd.x2) !== Math.round(kd.x2) ||
        Math.round(cd.y2) !== Math.round(kd.y2)
      );
    });
  }, [activeStepIdx, keyframes, items, drawings, isPlaying]);

  // Prüft, ob der aktuelle Studio-Entwurf automatisch eine exakte Drill-Musterlösung erzeugt
  const currentStudioHasAutoSolution = useMemo(() => {
    if (keyframes.length >= 2) return true;
    if (keyframes.length === 1) {
      if ((keyframes[0].drawings || []).some((d) => d.type === "arrow_run")) return true;
      if (hasTeamAMoved(keyframes[0].items, items)) return true;
    }
    return drawings.some((d) => d.type === "arrow_run");
  }, [keyframes, drawings, items]);

  const canPlayAnimation = useMemo(() => {
    if (keyframes.length >= 2) return true;
    if (
      keyframes.length === 1 &&
      (keyframes[0].drawings || []).some((d) => d.type !== "zone_circle")
    ) {
      return true;
    }
    return drawings.some((d) => d.type !== "zone_circle");
  }, [keyframes, drawings]);

  // --- KEYFRAME ANIMATIONS-STEUERUNG ---
  const stopAnimation = useCallback(() => {
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    liveStateRef.current.ballScale = 1;
    setBallScale(1);
    setIsPlaying(false);
  }, []);

  const startAnimation = useCallback(() => {
    let frames: BoardKeyframe[] = [];

    if (keyframes.length === 0) {
      const hasArrows = drawings.some((d) => d.type !== "zone_circle");
      if (!hasArrows) return;
      frames = [
        { id: "live-start", items: cloneItems(items), drawings: cloneDrawings(drawings) },
        { id: "live-end", items: applyDrawingsToItems(items, drawings), drawings: [] },
      ];
    } else {
      frames = cloneKeyframes(keyframes);

      if (activeStepIdx === null && drawings.some((d) => d.type !== "zone_circle")) {
        frames.push({
          id: "unsaved-step",
          items: cloneItems(items),
          drawings: cloneDrawings(drawings),
        });
      }

      const lastFrame = frames[frames.length - 1];
      if ((lastFrame.drawings || []).some((d) => d.type !== "zone_circle")) {
        frames.push({
          id: "auto-end",
          items: applyDrawingsToItems(lastFrame.items, lastFrame.drawings),
          drawings: [],
        });
      }
    }

    if (frames.length < 2) return;
    playbackFramesRef.current = frames;
    setIsPlaying(true);
  }, [keyframes, items, drawings, activeStepIdx]);

  useEffect(() => {
    if (!isPlaying) return;
    const frames = playbackFramesRef.current;
    if (!frames || frames.length < 2) {
      setIsPlaying(false);
      return;
    }

    const initialHoldMs = 450 / playSpeed;
    const transitionMs = 1100 / playSpeed;
    const holdMs = 420 / playSpeed;
    const segmentMs = transitionMs + holdMs;
    const totalSegments = frames.length - 1;
    const startTime = performance.now();

    const firstItems = cloneItems(frames[0].items);
    const firstDrawings = cloneDrawings(frames[0].drawings || []);
    liveStateRef.current.items = firstItems;
    liveStateRef.current.drawings = firstDrawings;
    liveStateRef.current.ballScale = 1;
    setItems(firstItems);
    setDrawings(firstDrawings);
    setBallScale(1);
    setActiveStepIdx(keyframes.length > 0 ? 0 : null);

    let lastAppliedDrawingStep = 0;

    const applyStepDrawings = (stepIdx: number) => {
      if (stepIdx === lastAppliedDrawingStep) return;
      lastAppliedDrawingStep = stepIdx;
      const nextDrawings = cloneDrawings(frames[stepIdx]?.drawings || []);
      liveStateRef.current.drawings = nextDrawings;
      setDrawings(nextDrawings);
    };

    const tick = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < initialHoldMs) {
        animRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const animElapsed = elapsed - initialHoldMs;
      const segIndex = Math.floor(animElapsed / segmentMs);

      if (segIndex >= totalSegments) {
        const lastIdx = frames.length - 1;
        const finalItems = cloneItems(frames[lastIdx].items);
        const finalDrawings = cloneDrawings(frames[lastIdx].drawings || []);
        liveStateRef.current.items = finalItems;
        liveStateRef.current.drawings = finalDrawings;
        liveStateRef.current.ballScale = 1;
        setItems(finalItems);
        setDrawings(finalDrawings);
        setBallScale(1);
        setActiveStepIdx(lastIdx < keyframes.length ? lastIdx : null);
        setIsPlaying(false);
        animRafRef.current = null;
        return;
      }

      const segElapsed = animElapsed - segIndex * segmentMs;
      const isHoldPhase = segElapsed >= transitionMs;
      const rawT = Math.min(1, segElapsed / transitionMs);
      const tEased = easeInOut(rawT);

      const fromFrame = frames[segIndex].items;
      const toFrame = frames[segIndex + 1].items;
      const stepDrawings = frames[segIndex].drawings || [];
      const ballDrawing = stepDrawings.find((d) => isBallArrowType(d.type));

      let nextBallScale = 1;

      const interpolated = fromFrame.map((fromItem) => {
        const target = toFrame.find((i) => i.id === fromItem.id) || fromItem;

        if (fromItem.id === "ball" && ballDrawing && !isHoldPhase) {
          if (ballDrawing.type === "arrow_lob") {
            const { cx, cy } = getLobControlPoint(fromItem.x, fromItem.y, target.x, target.y);
            const inv = 1 - tEased;
            const x = inv * inv * fromItem.x + 2 * inv * tEased * cx + tEased * tEased * target.x;
            const y = inv * inv * fromItem.y + 2 * inv * tEased * cy + tEased * tEased * target.y;
            nextBallScale = 1 + 0.65 * Math.sin(Math.PI * tEased);
            return { ...fromItem, x, y };
          }

          if (ballDrawing.type === "arrow_glass") {
            const { bx, by } = getGlassBouncePoint(fromItem.x, fromItem.y, target.x, target.y);
            const l1 = Math.hypot(bx - fromItem.x, by - fromItem.y);
            const l2 = Math.hypot(target.x - bx, target.y - by);
            const totalLen = l1 + l2;
            if (totalLen > 1) {
              const dist = tEased * totalLen;
              if (dist <= l1 && l1 > 0) {
                const u = dist / l1;
                return {
                  ...fromItem,
                  x: fromItem.x + (bx - fromItem.x) * u,
                  y: fromItem.y + (by - fromItem.y) * u,
                };
              }
              if (l2 > 0) {
                const u = (dist - l1) / l2;
                return {
                  ...fromItem,
                  x: bx + (target.x - bx) * u,
                  y: by + (target.y - by) * u,
                };
              }
            }
          }
        }

        return {
          ...fromItem,
          x: fromItem.x + (target.x - fromItem.x) * tEased,
          y: fromItem.y + (target.y - fromItem.y) * tEased,
        };
      });

      const drawingStepIdx = isHoldPhase ? segIndex + 1 : segIndex;
      applyStepDrawings(drawingStepIdx);

      liveStateRef.current.items = interpolated;
      liveStateRef.current.ballScale = nextBallScale;
      setItems(interpolated);
      setBallScale(nextBallScale);

      const highlightIdx = isHoldPhase ? segIndex + 1 : segIndex;
      setActiveStepIdx(highlightIdx < keyframes.length ? highlightIdx : null);

      animRafRef.current = requestAnimationFrame(tick);
    };

    animRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRafRef.current !== null) {
        cancelAnimationFrame(animRafRef.current);
        animRafRef.current = null;
      }
    };
  }, [isPlaying, playSpeed, keyframes.length]);

  // Keyframe-Aktionen (respektiert entitlements.maxAnimSteps)
  const handleAddKeyframe = () => {
    stopAnimation();
    if (keyframes.length >= entitlements.maxAnimSteps) {
      setStepToast(
        t("tb_anim_limit_reached").replace(/\{max\}/g, String(entitlements.maxAnimSteps))
      );
      setTimeout(() => setStepToast(null), 2600);
      return;
    }

    const newFrame: BoardKeyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      items: cloneItems(items),
      drawings: cloneDrawings(drawings),
    };

    const nextItems = applyDrawingsToItems(items, drawings);

    setKeyframes((prev) => [...prev, newFrame]);
    setItems(nextItems);
    setDrawings([]);
    setCurrentDraft(null);
    setActiveStepIdx(null);

    setStepToast(t("tb_anim_step_saved"));
    setTimeout(() => setStepToast(null), 2600);
  };

  const handleSelectKeyframe = (idx: number) => {
    stopAnimation();
    const frame = keyframes[idx];
    if (!frame) return;
    setActiveStepIdx(idx);
    setItems(cloneItems(frame.items));
    setDrawings(cloneDrawings(frame.drawings || []));
  };

  const handleUpdateActiveKeyframe = () => {
    if (activeStepIdx === null || !keyframes[activeStepIdx]) return;
    stopAnimation();
    const updatedItems = cloneItems(items);
    const updatedDrawings = cloneDrawings(drawings);

    setKeyframes((prev) =>
      prev.map((kf, idx) =>
        idx === activeStepIdx
          ? { ...kf, items: updatedItems, drawings: updatedDrawings }
          : kf
      )
    );
    setStepToast(t("tb_anim_step_updated"));
    setTimeout(() => setStepToast(null), 2000);
  };

  const handleDeleteActiveKeyframe = () => {
    if (activeStepIdx === null) return;
    stopAnimation();
    setKeyframes((prev) => {
      const next = prev.filter((_, idx) => idx !== activeStepIdx);
      if (next.length === 0) {
        setActiveStepIdx(null);
      } else {
        const nextIdx = Math.min(activeStepIdx, next.length - 1);
        setActiveStepIdx(nextIdx);
        setItems(cloneItems(next[nextIdx].items));
        setDrawings(cloneDrawings(next[nextIdx].drawings || []));
      }
      return next;
    });
  };

  const handleClearKeyframes = () => {
    stopAnimation();
    setKeyframes([]);
    setActiveStepIdx(null);
    setDrawings([]);
  };

  // --- PLAYBOOK SPEICHERN, LADEN & LÖSCHEN (Zentral über src/lib/playbook.ts) ---
  const persistPlaybook = useCallback(
    (nextList: SavedPlay[]) => {
      const saved = savePlaybookList(
        boardUserId,
        nextList,
        Math.max(nextList.length, entitlements.maxPlaybookSlots)
      );
      setPlaybook(saved);
    },
    [boardUserId, entitlements.maxPlaybookSlots]
  );

  // Generiert Aufgabe, Erklärung & Zieltiefe automatisch aus dem aktuellen Studio-Spielzug
  const handleAutoFillDrillMeta = () => {
    const smart = generateSmartDrillMeta(
      {
        title: playTitle || studioTitle,
        items,
        drawings,
        keyframes,
      },
      lang
    );
    setPlayDrillPrompt(smart.prompt);
    setPlayDrillExpl(smart.explanation);
    setPlayDrillDepth(smart.targetDepth);
  };

  const handleSaveToPlaybook = () => {
    if (!entitlements.canAccessStudio) return;
    stopAnimation();
    const cleanTitle = (playTitle || studioTitle || t("tb_default_studio_title")).trim();
    if (!cleanTitle) return;

    const existing = playbook.find(
      (p) => p.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (!existing && playbook.length >= entitlements.maxPlaybookSlots) {
      setPlaybookToast(
        entitlements.isGuest || !boardUserId
          ? t("pb_guest_limit_reached")
          : t("pb_limit_reached").replace(/\{max\}/g, String(entitlements.maxPlaybookSlots))
      );
      setTimeout(() => setPlaybookToast(null), 3500);
      return;
    }

    const syncedKeyframes =
      activeStepIdx !== null && keyframes[activeStepIdx] && isActiveStepDirty
        ? keyframes.map((kf, idx) =>
            idx === activeStepIdx
              ? { ...kf, items: cloneItems(items), drawings: cloneDrawings(drawings) }
              : kf
          )
        : keyframes;

    if (syncedKeyframes !== keyframes) {
      setKeyframes(syncedKeyframes);
    }

    const effectiveIsDrill = entitlements.canCreateCustomDrills
      ? playAsDrill
      : Boolean(existing?.isDrill);

    const autoMeta = effectiveIsDrill
      ? generateSmartDrillMeta(
          {
            title: cleanTitle,
            items,
            drawings,
            keyframes: syncedKeyframes,
          },
          lang
        )
      : null;

    const finalPrompt = effectiveIsDrill
      ? playDrillPrompt.trim() || autoMeta?.prompt
      : existing?.drillPrompt;
    const finalExpl = effectiveIsDrill
      ? playDrillExpl.trim() || autoMeta?.explanation
      : existing?.drillExplanation;
    const finalDepth = effectiveIsDrill
      ? playDrillDepth || autoMeta?.targetDepth
      : existing?.drillTargetDepth;

    const savedEntry: SavedPlay = {
      id: existing ? existing.id : `play-${Date.now()}`,
      title: cleanTitle,
      updatedAt: Date.now(),
      items: cloneItems(items),
      drawings: cloneDrawings(drawings),
      keyframes: cloneKeyframes(syncedKeyframes),
      isDrill: effectiveIsDrill,
      drillPrompt: finalPrompt,
      drillExplanation: finalExpl,
      drillTargetDepth: finalDepth,
      source: existing?.source || "studio",
      replayContext: existing?.replayContext,
    };

    const nextList = [
      savedEntry,
      ...playbook.filter((p) => p.id !== savedEntry.id),
    ];

    persistPlaybook(nextList);
    setPlayTitle(cleanTitle);
    setStudioTitle(cleanTitle);
    if (effectiveIsDrill) {
      if (finalPrompt) setPlayDrillPrompt(finalPrompt);
      if (finalExpl) setPlayDrillExpl(finalExpl);
      if (finalDepth) setPlayDrillDepth(finalDepth);
    }
    setPlaybookToast(t("tb_pb_saved_msg"));
    setTimeout(() => setPlaybookToast(null), 2500);
  };

  const handleLoadPlay = (play: SavedPlay) => {
    stopAnimation();
    applySavedPlayToBoard(play);
  };

  const handleDeletePlay = (playId: string) => {
    const nextList = playbook.filter((p) => p.id !== playId);
    persistPlaybook(nextList);
  };

  const toggleFilter = (key: keyof TacticalFilters) => {
    if (!entitlements.hasAdvancedBoardOverlays) return;
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    stopAnimation();
    setSelectedScenarioKey(key);
    setCustomTarget(null);

    if (key.startsWith("weakness_") && entitlements.hasAdvancedBoardOverlays) {
      const scId = parseInt(key.replace("weakness_", ""), 10);
      const found = weaknessPool.find((s) => s.id === scId) || null;
      if (found) {
        setLoadedTrainerScenario(found);
        setItems(trainerScenarioToBoardItems(found));
        setShowTactics(true);
      }
      return;
    }

    setLoadedTrainerScenario(null);
    if (SCENARIOS[key]) {
      setItems(cloneItems(SCENARIOS[key].items));
      if (entitlements.hasAdvancedBoardOverlays && key === "angriff_dynamisch") {
        setFilters((prev) => ({ ...prev, showAttackArc: true }));
      }
    }
  };

  // --- COACH-DRILL NAVIGATION & PRÜFUNG ---
  const handleSelectDrillCategory = (cat: DrillCategory) => {
    setDrillCategory(cat);
    setActiveDrillIdx(0);
    setDrillVariantSeed(0);
    setDrillResult(null);
    setShowDrillSolution(false);
  };

  const handleStepDrill = (delta: number) => {
    if (drillSlots.length === 0) return;
    const nextIdx = (safeDrillIdx + delta + drillSlots.length) % drillSlots.length;
    setActiveDrillIdx(nextIdx);
    setDrillVariantSeed(0);
    setDrillResult(null);
    setShowDrillSolution(false);
  };

  const evaluateActiveDrill = () => {
    if (!activeDrill) return;
    const a1 = items.find((i) => i.id === "a1");
    const a2 = items.find((i) => i.id === "a2");
    const ball = items.find((i) => i.id === "ball");
    if (!a1 || !a2 || !ball) return;

    const lateralGap = Math.abs(a1.y - a2.y);
    const depthGap = Math.abs(a1.x - a2.x);
    let checks: { label: string; ok: boolean }[] = [];

    if (activeDrill.solutionItems) {
      const solA1 = activeDrill.solutionItems.find((i) => i.id === "a1");
      const solA2 = activeDrill.solutionItems.find((i) => i.id === "a2");

      const distA1 = solA1 ? Math.hypot(a1.x - solA1.x, a1.y - solA1.y) : 999;
      const distA2 = solA2 ? Math.hypot(a2.x - solA2.x, a2.y - solA2.y) : 999;
      const solLateralGap = solA1 && solA2 ? Math.abs(solA1.y - solA2.y) : 140;
      const solDepthGap = solA1 && solA2 ? Math.abs(solA1.x - solA2.x) : 0;

      const a1Ok = distA1 <= 65;
      const a2Ok = distA2 <= 65;
      const middleOk =
        (lateralGap >= 85 && lateralGap <= 178) ||
        Math.abs(lateralGap - solLateralGap) <= 50;
      const parallelOk =
        depthGap <= 78 || Math.abs(depthGap - solDepthGap) <= 50;

      checks = [
        { label: t("tb_drill_chk_a1_pos"), ok: a1Ok },
        { label: t("tb_drill_chk_a2_pos"), ok: a2Ok },
        { label: t("tb_drill_chk_middle"), ok: middleOk },
        { label: t("tb_drill_chk_parallel"), ok: parallelOk },
      ];
    } else {
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

      const depthLabel =
        activeDrill.targetDepth === "net"
          ? t("tb_drill_chk_net")
          : activeDrill.targetDepth === "mid"
          ? t("tb_drill_chk_mid")
          : t("tb_drill_chk_back");

      checks = [
        { label: t("tb_drill_chk_middle"), ok: middleOk },
        { label: t("tb_drill_chk_parallel"), ok: parallelOk },
        { label: depthLabel, ok: depthOk },
        { label: t("tb_drill_chk_angle"), ok: angleOk },
      ];
    }

    const passedCount = checks.filter((c) => c.ok).length;
    const scorePct = Math.round((passedCount / checks.length) * 100);
    const passed = passedCount >= 3;

    setDrillResult({ scorePct, passed, checks });
    if (activeDrill.solutionItems && !passed) {
      setShowDrillSolution(true);
    }

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

  // Startet eine neue Studio-Zeichnung inkl. Auto-Snap & Figuren-Verknüpfung
  const startStudioDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent, preferredItemId?: string) => {
      if (studioTool === "move") return;
      if (isPlaying) stopAnimation();
      if (e.cancelable) e.preventDefault();

      const pt = getPoint(e);
      let startX = pt.x;
      let startY = pt.y;
      let linkedItemId: string | undefined;

      if (studioTool === "arrow_run") {
        const directPlayer = preferredItemId
          ? items.find((i) => i.id === preferredItemId && i.isPlayer)
          : undefined;

        if (directPlayer) {
          linkedItemId = directPlayer.id;
          startX = directPlayer.x;
          startY = directPlayer.y;
        } else {
          let closest: DraggableItem | null = null;
          let minDist = 60;
          items
            .filter((i) => i.isPlayer)
            .forEach((p) => {
              const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
              if (dist < minDist) {
                minDist = dist;
                closest = p;
              }
            });
          if (closest) {
            linkedItemId = (closest as DraggableItem).id;
            startX = (closest as DraggableItem).x;
            startY = (closest as DraggableItem).y;
          }
        }
      } else if (isBallArrowType(studioTool)) {
        const ball = items.find((i) => i.id === "ball");
        linkedItemId = "ball";
        if (ball && (preferredItemId === "ball" || Math.hypot(ball.x - pt.x, ball.y - pt.y) < 85)) {
          startX = ball.x;
          startY = ball.y;
        }
      }

      setCurrentDraft({
        id: `draw-${Date.now()}`,
        type: studioTool,
        x1: startX,
        y1: startY,
        x2: pt.x,
        y2: pt.y,
        linkedItemId,
      });
    },
    [studioTool, isPlaying, stopAnimation, getPoint, items]
  );

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    if (!entitlements.hasAdvancedBoardOverlays || activeMode === "drill" || isPlaying) return;
    if (activeMode === "studio" && studioTool !== "move") return;
    const pt = getPoint(e);
    setCustomTarget({ x: pt.x, y: pt.y });
    setSelectedScenarioKey("custom");
  };

  const handleSvgPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (entitlements.canAccessStudio && activeMode === "studio" && studioTool !== "move") {
      startStudioDrawing(e);
      return;
    }

    if (
      entitlements.hasAdvancedBoardOverlays &&
      activeMode !== "drill" &&
      !isPlaying &&
      "touches" in e
    ) {
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
      if (entitlements.canAccessStudio && activeMode === "studio" && studioTool !== "move") {
        e.stopPropagation();
        startStudioDrawing(e, id);
        return;
      }

      if (isPlaying) {
        stopAnimation();
      }

      if (activeMode === "drill" && !id.startsWith("a")) {
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
      if (activeMode !== "drill") {
        setSelectedScenarioKey("custom");
        setLoadedTrainerScenario(null);
      } else {
        setDrillResult(null);
        setShowDrillSolution(false);
      }
    },
    [
      items,
      getPoint,
      activeMode,
      studioTool,
      entitlements.canAccessStudio,
      isPlaying,
      stopAnimation,
      startStudioDrawing,
    ]
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

        if (id === "ball" && effectiveFilters.showAttackArc && activeMode !== "drill") {
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
            entitlements.hasAdvancedBoardOverlays ? customTarget : null,
            t
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

        if (effectiveFilters.showAttackArc && itemToMove.isPlayer && activeMode !== "drill") {
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
    [
      getPoint,
      effectiveFilters,
      selectedScenarioKey,
      customTarget,
      currentDraft,
      netX,
      t,
      entitlements.hasAdvancedBoardOverlays,
      activeMode,
    ]
  );

  const onPointerUp = useCallback(() => {
    if (currentDraft) {
      const dist = Math.hypot(currentDraft.x2 - currentDraft.x1, currentDraft.y2 - currentDraft.y1);
      if (dist > 12 || currentDraft.type === "zone_circle") {
        const finalDraft =
          currentDraft.type === "zone_circle" && dist < 20
            ? { ...currentDraft, x2: currentDraft.x1 + 32, y2: currentDraft.y1 }
            : currentDraft;
        setDrawings((prev) => {
          const newIsBall = isBallArrowType(finalDraft.type);
          const filtered =
            finalDraft.linkedItemId && finalDraft.type !== "zone_circle"
              ? prev.filter((d) => {
                  if (newIsBall && isBallArrowType(d.type)) return false;
                  if (d.type === finalDraft.type && d.linkedItemId === finalDraft.linkedItemId) {
                    return false;
                  }
                  return true;
                })
              : prev;
          return [...filtered, finalDraft];
        });
      }
      setCurrentDraft(null);
    }
    dragRef.current = null;
    setActiveId(null);
  }, [currentDraft]);

  const reset = () => {
    stopAnimation();
    if (activeMode === "drill" && activeDrill) {
      setItems(cloneItems(activeDrill.startItems));
      setDrillResult(null);
      setShowDrillSolution(false);
      return;
    }
    setLoadedTrainerScenario(null);
    setSelectedScenarioKey("initial");
    setCustomTarget(null);
    setItems(cloneItems(SCENARIOS.initial.items));
  };

  // =========================================================================
  // SYNCHRONER 30-FPS CANVAS-RENDERER (INKL. LOB-KURVE, SCHEIBE & BRANDING)
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

      if (state.filters.showAngleCone && ball) {
        const cone = getDangerAngleCone(ball);
        ctx.fillStyle = "rgba(250, 204, 21, 0.13)";
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(cone.farX, cone.topCornerY);
        ctx.lineTo(cone.farX, cone.bottomCornerY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(34, 211, 238, 0.55)";
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
          const depthGap = Math.abs(pair[0].x - pair[1].x);
          const avgX = (pair[0].x + pair[1].x) / 2;
          const avgY = (pair[0].y + pair[1].y) / 2;
          if (gap > GAP_THRESHOLD + 2 || depthGap > DEPTH_GAP_THRESHOLD) {
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

      if (d.type === "arrow_lob") {
        const { cx, cy } = getLobControlPoint(d.x1, d.y1, d.x2, d.y2);
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.quadraticCurveTo(cx, cy, d.x2, d.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowhead(cx, cy, d.x2, d.y2, "#34d399", 14);
        return;
      }

      if (d.type === "arrow_glass") {
        const { bx, by } = getGlassBouncePoint(d.x1, d.y1, d.x2, d.y2);
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 4;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(bx, by);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(192, 132, 252, 0.28)";
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();

        const rebLen = Math.hypot(d.x2 - bx, d.y2 - by);
        if (rebLen > 6) {
          drawArrowhead(bx, by, d.x2, d.y2, "#c084fc", 14);
        } else {
          drawArrowhead(d.x1, d.y1, bx, by, "#c084fc", 14);
        }
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
      const r = item.isPlayer ? 16 : 10 * (state.ballScale || 1);
      if (!item.isPlayer && (state.ballScale || 1) > 1.08) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(item.x - 6, item.y + 6, 9, 0, Math.PI * 2);
        ctx.fill();
      }

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

    // Free-Modus: TacPadel-Wasserzeichen; Pro-Modus: sauberer Titel-Balken
    if (!state.hasCleanVideoExport) {
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
    } else if (state.studioTitle?.trim()) {
      ctx.fillStyle = "rgba(4, 9, 20, 0.9)";
      ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 44);
      ctx.lineTo(canvas.width, canvas.height - 44);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        state.studioTitle.trim().toUpperCase(),
        canvas.width / 2,
        canvas.height - 17
      );
    }

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

  const switchToStudioForNewDrill = () => {
    stopAnimation();
    setShowTactics(false);
    setActiveMode("studio");
    setIsPlaybookOpen(true);
    setPlayAsDrill(entitlements.canCreateCustomDrills);
    setDrillResult(null);
    setShowDrillSolution(false);
  };

  const tabCount =
    2 + (entitlements.canAccessDrills ? 1 : 0) + (entitlements.canAccessStudio ? 1 : 0);
  const tabGridClass =
    tabCount === 4
      ? "grid-cols-4 max-w-xl"
      : tabCount === 3
      ? "grid-cols-3 max-w-lg"
      : "grid-cols-2 max-w-md";

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
      {/* DYNAMISCHER TOGGLE-SCHALTER (2D | [DRILL] | [STUDIO] | 3D)        */}
      {/* ================================================================= */}
      <div className="w-full max-w-5xl flex flex-col items-center mb-1 px-3">
        <div
          className={`bg-[#050b18] p-1.5 rounded-full shadow-lg border border-slate-800 grid ${tabGridClass} relative w-full`}
        >
          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              stopAnimation();
              setIsPlaybookOpen(false);
              setDrillResult(null);
              setShowDrillSolution(false);
              setActiveMode("tactics");
            }}
            className={`py-2 px-1.5 text-[9.5px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all truncate ${
              activeMode === "tactics"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("tb_mode_2d")}
          </button>

          {entitlements.canAccessDrills && (
            <button
              onClick={() => {
                if (isRecording) stopVideoRecording();
                stopAnimation();
                setIsPlaybookOpen(false);
                setActiveMode("drill");
              }}
              className={`py-2 px-1.5 text-[9.5px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all truncate ${
                activeMode === "drill"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-[0_0_14px_rgba(249,115,22,0.55)]"
                  : "text-orange-400 hover:text-orange-300"
              }`}
            >
              {t("tb_mode_drill")}
            </button>
          )}

          {entitlements.canAccessStudio && (
            <button
              onClick={() => {
                setDrillResult(null);
                setShowDrillSolution(false);
                setShowTactics(false);
                setActiveMode("studio");
              }}
              className={`py-2 px-1.5 text-[9.5px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all truncate ${
                activeMode === "studio"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                  : "text-pink-400 hover:text-pink-300"
              }`}
            >
              {t("tb_mode_studio_clean")}
            </button>
          )}

          <button
            onClick={() => {
              if (isRecording) stopVideoRecording();
              stopAnimation();
              setIsPlaybookOpen(false);
              setDrillResult(null);
              setShowDrillSolution(false);
              setActiveMode("3d");
            }}
            className={`py-2 px-1.5 text-[9.5px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-all truncate ${
              activeMode === "3d"
                ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tabCount > 2 ? t("tb_mode_3d_short") : t("tb_mode_3d")}
          </button>
        </div>
      </div>

      {/* --- RENDERN BASIEREND AUF DEM SCHALTER --- */}
      {activeMode === "3d" ? (
        <TrajectoryView3D />
      ) : (
        <>
          {/* ============================================================= */}
          {/* VEREINTER STUDIO-, ZEICHEN-, ANIMATIONS- & PLAYBOOK-BLOCK     */}
          {/* ============================================================= */}
          {activeMode === "studio" && entitlements.canAccessStudio && (
            <div className="w-full max-w-[600px] px-3 flex flex-col gap-2.5 animate-in fade-in">
              <div className="bg-[#050b18] border border-pink-500/40 rounded-2xl p-3 sm:p-4 shadow-[0_0_25px_rgba(236,72,153,0.12)] flex flex-col gap-3">
                {/* 1. Kopfzeile: Titel, Playbook-Schalter, Foto & Video-REC */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 shrink-0">
                      {t("tb_mode_studio_clean")}
                    </span>
                    <input
                      type="text"
                      value={studioTitle}
                      onChange={(e) => setStudioTitle(e.target.value)}
                      placeholder={t("tb_studio_title_placeholder")}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-pink-500 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setIsPlaybookOpen((prev) => !prev)}
                      className={`px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                        isPlaybookOpen
                          ? "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                          : "bg-slate-900 text-cyan-300 border-cyan-500/40 hover:bg-slate-800"
                      }`}
                    >
                      {t("tb_pb_toggle")}
                    </button>

                    <button
                      onClick={handleTakeSnapshot}
                      className="flex-1 sm:flex-initial px-2.5 py-2 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      {t("tb_studio_photo_btn")}
                    </button>

                    {!isRecording ? (
                      <button
                        onClick={startVideoRecording}
                        className="flex-1 sm:flex-initial px-2.5 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>{t("tb_studio_rec_btn")}</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopVideoRecording}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)] flex items-center justify-center gap-1.5"
                      >
                        <span>
                          {t("tb_studio_stop_btn")} ({recSeconds}s)
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Zeichen-Werkzeuge (2x4 Grid inkl. Lob-Kurve & Scheiben-Abpraller) */}
                <div className="grid grid-cols-4 gap-1.5 pt-2.5 border-t border-slate-800/80">
                  <button
                    onClick={() => setStudioTool("move")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "move"
                        ? "bg-white text-black border-white shadow-md"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {t("tb_tool_move")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_run")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_run"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-cyan-300"
                    }`}
                  >
                    {t("tb_tool_run")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_ball")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_ball"
                        ? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300"
                    }`}
                  >
                    {t("tb_tool_ball")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_lob")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_lob"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-300"
                    }`}
                  >
                    {t("tb_tool_lob")}
                  </button>
                  <button
                    onClick={() => setStudioTool("arrow_glass")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      studioTool === "arrow_glass"
                        ? "bg-purple-500/20 text-purple-300 border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.3)]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-purple-300"
                    }`}
                  >
                    {t("tb_tool_glass")}
                  </button>
                  <button
                    onClick={() => setStudioTool("zone_circle")}
                    className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
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
                    className="py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
                  >
                    {t("tb_tool_undo")}
                  </button>
                  <button
                    onClick={() => setDrawings([])}
                    disabled={drawings.length === 0}
                    className="py-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-40"
                  >
                    {t("tb_tool_clear")}
                  </button>
                </div>

                {/* 3. Integrierte Spielzug-Animation */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                        {t("tb_anim_title")} ({keyframes.length}/{entitlements.maxAnimSteps})
                      </span>
                      {activeStepIdx !== null && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                          {t("tb_anim_step_label")} {activeStepIdx + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {([0.7, 1, 1.5] as const).map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setPlaySpeed(spd)}
                          className={`px-2 py-0.5 rounded text-[9px] font-black border transition-all ${
                            playSpeed === spd
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}

                      {canPlayAnimation && (
                        <button
                          onClick={() => (isPlaying ? stopAnimation() : startAnimation())}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                            isPlaying
                              ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                          }`}
                        >
                          {isPlaying ? t("tb_anim_stop") : t("tb_anim_play")}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {keyframes.map((kf, idx) => {
                      const hasStepDrawings = (kf.drawings?.length || 0) > 0;
                      return (
                        <button
                          key={kf.id}
                          onClick={() => handleSelectKeyframe(idx)}
                          className={`relative w-7 h-7 rounded-lg text-xs font-black border transition-all ${
                            activeStepIdx === idx
                              ? "bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-105"
                              : "bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/60"
                          }`}
                        >
                          {idx + 1}
                          {hasStepDrawings && (
                            <span
                              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-[#050b18] ${
                                activeStepIdx === idx ? "bg-pink-500" : "bg-amber-400"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}

                    <button
                      onClick={handleAddKeyframe}
                      className="px-2.5 h-7 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-200 hover:text-white transition-all"
                    >
                      {t("tb_anim_add_step")}
                    </button>

                    {activeStepIdx !== null && (
                      <>
                        <button
                          onClick={handleUpdateActiveKeyframe}
                          title={t("tb_anim_update_step")}
                          className={`px-2 h-7 rounded-lg text-[10px] font-black border transition-all ${
                            isActiveStepDirty
                              ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)] animate-pulse"
                              : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300"
                          }`}
                        >
                          ↻
                        </button>
                        <button
                          onClick={handleDeleteActiveKeyframe}
                          title={t("tb_anim_del_step")}
                          className="px-2 h-7 rounded-lg text-[10px] font-black bg-slate-800 hover:bg-red-900/50 border border-slate-700 text-red-400"
                        >
                          ✕
                        </button>
                      </>
                    )}

                    {keyframes.length > 0 && (
                      <button
                        onClick={handleClearKeyframes}
                        className="ml-auto px-2 h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-400 transition-colors"
                      >
                        {t("tb_anim_clear")}
                      </button>
                    )}
                  </div>

                  {stepToast ? (
                    <p className="text-[10px] font-bold text-emerald-400 leading-snug">{stepToast}</p>
                  ) : isActiveStepDirty ? (
                    <p className="text-[10px] font-semibold text-amber-300 leading-snug">
                      {t("tb_anim_unsaved_hint")}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-snug">
                      {keyframes.length === 0 ? t("tb_anim_hint") : t("tb_anim_step_drawings_hint")}
                    </p>
                  )}
                </div>

                {/* 4. Ausklappbares Playbook direkt im Studio-Block (inkl. Auto-Drill-Text) */}
                {isPlaybookOpen && (
                  <div className="pt-3 border-t border-cyan-500/30 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                        {t("tb_pb_title")} ({playbook.length}/{entitlements.maxPlaybookSlots})
                      </span>
                      <button
                        onClick={() => setIsPlaybookOpen(false)}
                        className="w-6 h-6 rounded-md bg-slate-900 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={playTitle}
                        onChange={(e) => setPlayTitle(e.target.value)}
                        placeholder={t("tb_pb_placeholder")}
                        className="flex-1 bg-[#030611] border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none"
                      />
                      <button
                        onClick={handleSaveToPlaybook}
                        className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-all"
                      >
                        {t("tb_pb_save")}
                      </button>
                    </div>

                    {/* Playbook -> Coach-Drill Option (inkl. Auto-Text-Generator) */}
                    {entitlements.canCreateCustomDrills && (
                      <div className="bg-[#030611] border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={playAsDrill}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPlayAsDrill(checked);
                                if (checked && !playDrillPrompt.trim() && !playDrillExpl.trim()) {
                                  handleAutoFillDrillMeta();
                                }
                              }}
                              className="rounded text-orange-500 w-3.5 h-3.5"
                            />
                            <span className="text-[11px] font-black text-orange-300 uppercase tracking-wider">
                              {t("tb_pb_as_drill")}
                            </span>
                          </label>

                          {playAsDrill && (
                            <button
                              type="button"
                              onClick={handleAutoFillDrillMeta}
                              className="px-2 py-1 rounded-md bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-300 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              {t("tb_drill_auto_gen_btn")}
                            </button>
                          )}
                        </div>

                        {playAsDrill && (
                          <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-800/80">
                            <input
                              type="text"
                              value={playDrillPrompt}
                              onChange={(e) => setPlayDrillPrompt(e.target.value)}
                              placeholder={t("tb_pb_drill_prompt_ph")}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-orange-400 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white outline-none"
                            />
                            <input
                              type="text"
                              value={playDrillExpl}
                              onChange={(e) => setPlayDrillExpl(e.target.value)}
                              placeholder={t("tb_pb_drill_expl_ph")}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-orange-400 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 outline-none"
                            />

                            {currentStudioHasAutoSolution ? (
                              <p className="text-[10px] font-bold text-emerald-400">
                                {t("tb_pb_drill_auto_sol")}
                              </p>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {t("tb_pb_drill_depth_label")}
                                </span>
                                <div className="flex gap-1">
                                  {(
                                    [
                                      { id: "back", label: t("tb_pb_depth_back") },
                                      { id: "mid", label: t("tb_pb_depth_mid") },
                                      { id: "net", label: t("tb_pb_depth_net") },
                                    ] as const
                                  ).map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setPlayDrillDepth(opt.id)}
                                      className={`px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${
                                        playDrillDepth === opt.id
                                          ? "bg-orange-500/25 border-orange-400 text-orange-300"
                                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {playbookToast && (
                      <div
                        className={`text-[11px] font-black rounded-lg px-3 py-1.5 border ${
                          playbookToast === t("tb_pb_saved_msg")
                            ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/40"
                            : "text-amber-300 bg-amber-950/40 border-amber-500/40"
                        }`}
                      >
                        {playbookToast}
                      </div>
                    )}

                    {playbook.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2.5 bg-[#030611] rounded-xl border border-slate-800/80">
                        {t("tb_pb_empty")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                        {playbook.map((play) => (
                          <div
                            key={play.id}
                            className="flex items-center justify-between gap-2 bg-[#030611] border border-slate-800 rounded-xl px-3 py-2"
                          >
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">{play.title}</span>
                                {play.isDrill && entitlements.canCreateCustomDrills && (
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 shrink-0">
                                    {t("tb_pb_drill_badge")}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-500 font-semibold">
                                {play.keyframes?.length || 1} {t("tb_pb_steps_label")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleLoadPlay(play)}
                                className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                {t("tb_pb_load")}
                              </button>
                              <button
                                onClick={() => handleDeletePlay(play.id)}
                                className="px-2 py-1 rounded-lg bg-red-950/30 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-[10px] font-bold transition-all"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* COACH-DRILL COCKPIT (EIGENER HAUPT-TAB + DYNAMISCHE VARIANTEN)*/}
          {/* ============================================================= */}
          {entitlements.canAccessDrills && activeMode === "drill" && (
            <div className="w-full max-w-[600px] px-3 flex flex-col gap-2.5 animate-in fade-in">
              {/* Kategorie-Auswahl: Alle | Standard | Playbook (bei Custom-Drills) */}
              {entitlements.canCreateCustomDrills && (
                <div className="bg-[#050b18] border border-slate-800 rounded-xl p-1 grid grid-cols-3 gap-1">
                  {(
                    [
                      {
                        id: "all" as DrillCategory,
                        label: `${t("tb_drill_cat_all")} (${STANDARD_DRILL_IDS.length + playbookDrillEntries.length})`,
                      },
                      {
                        id: "standard" as DrillCategory,
                        label: `${t("tb_drill_cat_standard")} (${STANDARD_DRILL_IDS.length})`,
                      },
                      {
                        id: "playbook" as DrillCategory,
                        label: `${t("tb_drill_cat_playbook")} (${playbookDrillEntries.length})`,
                      },
                    ]
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectDrillCategory(cat.id)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all truncate ${
                        drillCategory === cat.id
                          ? "bg-orange-500/25 border border-orange-400/70 text-orange-300"
                          : "text-slate-400 hover:text-white border border-transparent"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {!activeDrill ? (
                <div className="bg-[#050b18] border border-slate-800 rounded-2xl p-5 text-center flex flex-col items-center gap-3">
                  <span className="text-3xl">📘</span>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    {t("tb_drill_empty_pb_title")}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    {t("tb_drill_empty_pb_desc")}
                  </p>
                  <button
                    onClick={switchToStudioForNewDrill}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all"
                  >
                    {t("tb_drill_create_in_studio")}
                  </button>
                </div>
              ) : (
                <div className="bg-[#050b18] border border-orange-500/50 rounded-2xl p-4 shadow-[0_0_25px_rgba(249,115,22,0.18)] flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className={`text-[9px] font-black uppercase tracking-[0.2em] block ${
                          activeDrill.source === "playbook" ? "text-cyan-400" : "text-orange-400"
                        }`}
                      >
                        {activeDrill.source === "playbook"
                          ? t("tb_drill_custom_badge")
                          : t("tb_drill_badge")}{" "}
                        {safeDrillIdx + 1}/{drillSlots.length}
                        {drillVariantSeed > 0 && ` • ${t("tb_drill_variant_label")} #${drillVariantSeed + 1}`}
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-white truncate">
                        {activeDrill.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setDrillVariantSeed((s) => s + 1)}
                        className="px-2.5 h-8 rounded-lg bg-cyan-950/60 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap"
                      >
                        {t("tb_drill_shuffle_btn")}
                      </button>

                      {drillSlots.length > 1 && (
                        <>
                          <button
                            onClick={() => handleStepDrill(-1)}
                            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-black text-xs"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => handleStepDrill(1)}
                            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-black text-xs"
                          >
                            →
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{activeDrill.prompt}</p>

                  {drillResult ? (
                    <div className="bg-[#030611] border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black uppercase tracking-wider ${
                            drillResult.passed ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {drillResult.passed ? t("tb_drill_passed") : t("tb_drill_failed")}
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
                        💡 {activeDrill.explanation}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {activeDrill.solutionItems && (
                          <button
                            onClick={() => setShowDrillSolution((prev) => !prev)}
                            className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                              showDrillSolution
                                ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                                : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                            }`}
                          >
                            {showDrillSolution ? t("tb_drill_hide_sol") : t("tb_drill_show_sol")}
                          </button>
                        )}
                        <button
                          onClick={() => setDrillVariantSeed((s) => s + 1)}
                          className="px-3 py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all"
                        >
                          {t("tb_drill_shuffle_btn")}
                        </button>
                        <button
                          onClick={() => handleStepDrill(1)}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-[11px] uppercase tracking-wider"
                        >
                          {t("tb_drill_next_btn")}
                        </button>
                        {!drillResult.passed && (
                          <button
                            onClick={() => {
                              setDrillResult(null);
                              setShowDrillSolution(false);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-black text-[11px] uppercase tracking-wider"
                          >
                            {t("tb_drill_retry_btn")}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={evaluateActiveDrill}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black text-xs uppercase tracking-widest transition-all"
                    >
                      {t("tb_drill_check_btn")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- DARK-MODE SZENARIO- & FILTER-PANEL (NICHT IM DRILL-TAB) --- */}
          {showTactics && activeMode !== "drill" && (
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
                    <optgroup label={t("tb_opt_standard")}>
                      {Object.entries(SCENARIOS).map(([key, value]) => (
                        <option key={key} value={key} className="bg-[#050b18] text-white">
                          {t(value.nameKey)}
                        </option>
                      ))}
                    </optgroup>

                    {entitlements.hasAdvancedBoardOverlays && weaknessPool.length > 0 && (
                      <optgroup label={t("tb_opt_coach_focus")}>
                        {weaknessPool.map((sc) => (
                          <option
                            key={`weak-${sc.id}`}
                            value={`weakness_${sc.id}`}
                            className="bg-[#050b18] text-amber-300"
                          >
                            🎯 #{sc.id} – {formatShotName(sc.validShots[0] || "DRIVE", lang)}
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

              {entitlements.hasAdvancedBoardOverlays && loadedTrainerScenario && loadedScenarioDesc && (
                <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/40 rounded-xl flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                      {t("tb_coach_scen_badge")} #{loadedTrainerScenario.id}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300">
                      {loadedTrainerScenario.validShots
                        .map((s) => formatShotName(s, lang))
                        .join(" / ")}
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

              {entitlements.hasAdvancedBoardOverlays && (
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
                      <span className="font-bold text-amber-200">{t("tb_filter_angle_cone")}</span>
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

          {/* ============================================================= */}
          {/* SPIELFELD SVG                                                 */}
          {/* ============================================================= */}
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
                  : isPlaying
                  ? "border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  : activeMode === "drill"
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
                <marker id="studioLobArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#34d399" />
                </marker>
                <marker id="studioGlassArrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#c084fc" />
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

                    {effectiveFilters.showAttackArc && activeMode !== "drill" && (
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

                    {analysis && effectiveFilters.showBallVector && activeMode !== "drill" && (
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
                      activeMode !== "drill" &&
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

                {/* MUSTERLÖSUNGS-OVERLAY FÜR PLAYBOOK-DRILLS (Ziel-Ringe für A1 & A2) */}
                {entitlements.canAccessDrills &&
                  activeMode === "drill" &&
                  showDrillSolution &&
                  activeDrill?.solutionItems && (
                    <g style={{ pointerEvents: "none" }}>
                      {["a1", "a2"].map((pid) => {
                        const sol = activeDrill.solutionItems?.find((i) => i.id === pid);
                        const cur = items.find((i) => i.id === pid);
                        if (!sol) return null;
                        return (
                          <g key={`sol-${pid}`}>
                            {cur && Math.hypot(sol.x - cur.x, sol.y - cur.y) > 20 && (
                              <line
                                x1={cur.x}
                                y1={cur.y}
                                x2={sol.x}
                                y2={sol.y}
                                stroke="#34d399"
                                strokeWidth="3"
                                strokeDasharray="6 4"
                                opacity="0.75"
                              />
                            )}
                            <circle
                              cx={sol.x}
                              cy={sol.y}
                              r="22"
                              fill="rgba(52, 211, 153, 0.2)"
                              stroke="#34d399"
                              strokeWidth="3"
                              strokeDasharray="5 3"
                            />
                            <text
                              x={sol.x}
                              y={sol.y}
                              transform={`rotate(90 ${sol.x} ${sol.y})`}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#a7f3d0"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {sol.label}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                {/* EINGEZEICHNETE TACTICAL STUDIO PFEILE & ZONEN (Gerade, Lob-Kurve, Scheibe & Zone) */}
                {entitlements.canAccessStudio &&
                  activeMode === "studio" &&
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

                    if (d.type === "arrow_lob") {
                      const { cx, cy } = getLobControlPoint(d.x1, d.y1, d.x2, d.y2);
                      return (
                        <path
                          key={d.id}
                          d={`M ${d.x1} ${d.y1} Q ${cx} ${cy} ${d.x2} ${d.y2}`}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="4"
                          strokeDasharray="10 5"
                          markerEnd="url(#studioLobArrow)"
                          style={{ pointerEvents: "none" }}
                        />
                      );
                    }

                    if (d.type === "arrow_glass") {
                      const { bx, by } = getGlassBouncePoint(d.x1, d.y1, d.x2, d.y2);
                      return (
                        <g key={d.id} style={{ pointerEvents: "none" }}>
                          <polyline
                            points={`${d.x1},${d.y1} ${bx},${by} ${d.x2},${d.y2}`}
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="4"
                            strokeDasharray="7 4"
                            strokeLinejoin="round"
                            markerEnd="url(#studioGlassArrow)"
                          />
                          <circle
                            cx={bx}
                            cy={by}
                            r="8"
                            fill="rgba(192, 132, 252, 0.28)"
                            stroke="#c084fc"
                            strokeWidth="2"
                          />
                          <circle cx={bx} cy={by} r="3" fill="#ffffff" />
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
                  const baseR = item.isPlayer ? 16 : 10 * ballScale;
                  const r = isDragging ? baseR * 1.15 : baseR;
                  const isActivePlayer = showTactics && analysis && analysis.activePlayerId === item.id;
                  const isDrillMovable = activeMode !== "drill" || item.id.startsWith("a");

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
                      {!item.isPlayer && ballScale > 1.08 && (
                        <circle cx={item.x - 6} cy={item.y + 6} r={9} fill="rgba(0,0,0,0.32)" />
                      )}
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

            {showTactics && analysis && activeMode !== "drill" && (
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
                          <strong className="text-amber-300">{t("tb_leg_cone_b")}</strong>{" "}
                          {t("tb_leg_cone_t")}
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
                          <strong className="text-emerald-300">{t("tb_leg_rubber_b")}</strong>{" "}
                          {t("tb_leg_rubber_t")}
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

          {/* ============================================================= */}
          {/* AKTIONS-LEISTE UNTEN                                          */}
          {/* ============================================================= */}
          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-3 mb-6 w-full">
            <button
              onClick={reset}
              className="px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md"
            >
              {t("tb_btn_reset_pos")}
            </button>

            {activeMode !== "drill" && (
              <button
                onClick={() => setShowTactics(!showTactics)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all shadow-md ${
                  showTactics
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                }`}
              >
                {showTactics ? t("tb_btn_analysis_off") : t("tb_btn_analysis_on")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

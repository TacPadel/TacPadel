import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '../lib/supabase';

import { 
  SHOT_TYPES, TurnResult, PlayerId, GamePhase, Command, Scenario,
  getServerInfo, evaluatePlayerShot, calculateSmartAITurn 
} from "../engine/GameLogic";
import { soundManager } from '../lib/SoundManager';

import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import TourScreen from "./TourScreen"; 

// --- NEU: Importiere die ausgelagerten KI Profile ---
import { AiProfile, AI_PROFILES } from "../engine/AiProfiles";

type Stats = { 
  winners: number; 
  aces: number; 
  unforcedErrors: number;
  totalShots: number;
  shotsPerfect: number;
  shotsSuccess: number;
  shotsRecovery: number;
  shotsError: number;
};

const initialStatsData: { player: Stats, ai: Stats } = {
  player: { winners: 0, aces: 0, unforcedErrors: 0, totalShots: 0, shotsPerfect: 0, shotsSuccess: 0, shotsRecovery: 0, shotsError: 0 },
  ai: { winners: 0, aces: 0, unforcedErrors: 0, totalShots: 0, shotsPerfect: 0, shotsSuccess: 0, shotsRecovery: 0, shotsError: 0 }
};

const MAX_PLAYER_STAMINA = 50; 
const STAMINA_REGEN_BETWEEN_ROUNDS = 20; // PUNKT 1: Wie viel Ausdauer zwischen Matches regeneriert wird

const getAiMaxStamina = (score: number) => score >= 4000 ? 60 : (score < 2000 ? 35 : 50);

const getZoneDist = (z1: string, z2: string) => {
  if (!z1 || !z2) return 0;
  const c1 = ["A","B","C","D","E"].indexOf(z1[0]);
  const r1 = parseInt(z1[1]);
  const c2 = ["A","B","C","D","E"].indexOf(z2[0]);
  const r2 = parseInt(z2[1]);
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
};

const evalRunTactics = (shot: string, runZone: string) => {
  if (!shot || !runZone) return 0;
  const r = parseInt(runZone[1]);
  const s = shot.toUpperCase();
  if (["LOB", "CHIQUITA", "AUFSCHLAG", "SMASH", "VOLLEY", "BANDEJA", "VIBORA"].includes(s)) {
    return r >= 3 ? 3 : 0; 
  }
  if (["DRIVE", "BLOCK", "BAJADA"].includes(s)) {
    return r <= 2 ? 3 : 0; 
  }
  return 0;
};

export default function GameScreen() {
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showGameOverUI, setShowGameOverUI] = useState<boolean>(false); 
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  
  // --- TURNIER STATES ---
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeTournamentRound, setActiveTournamentRound] = useState<number>(1);
  const [activeTournamentDifficulty, setActiveTournamentDifficulty] = useState<number>(0);
  const [tournamentLoading, setTournamentLoading] = useState<boolean>(false);

  // --- NEU: Aktives KI Profil State ---
  const [activeAiProfile, setActiveAiProfile] = useState<AiProfile>(AI_PROFILES[0]);

  const [introTrigger, setIntroTrigger] = useState(0); 
  const [playIntro, setPlayIntro] = useState<boolean>(false);
  
  const [isIntroPlaying, setIsIntroPlaying] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState(!document.hidden);

  const [tacScore, setTacScore] = useState<number>(3000);
  const [lastScoreChange, setLastScoreChange] = useState<number>(0);
  const [matchStats, setMatchStats] = useState<{player: Stats, ai: Stats}>(initialStatsData);
  const [shotHistory, setShotHistory] = useState<string[]>([]);
  const [aiShotHistory, setAiShotHistory] = useState<string[]>([]);
  const [serveNumber, setServeNumber] = useState<1 | 2>(1);

  const [staminaModeEnabled, setStaminaModeEnabled] = useState<boolean>(true);
  const [stamina, setStamina] = useState({ 
    you: MAX_PLAYER_STAMINA, 
    partner: MAX_PLAYER_STAMINA, 
    opp1: getAiMaxStamina(3000), 
    opp2: getAiMaxStamina(3000) 
  });
  const staminaRef = useRef(stamina);
  useEffect(() => { staminaRef.current = stamina; }, [stamina]);

  useEffect(() => {
    const savedStaminaSetting = localStorage.getItem("tacpadel_stamina");
    if (savedStaminaSetting === "false") {
      setStaminaModeEnabled(false);
    }
  }, []);

  const isProfi = activeTournamentId !== null 
    ? activeTournamentDifficulty >= 4000 
    : tacScore >= 4000;
    
  const [showProfiBanner, setShowProfiBanner] = useState<boolean>(false);

  const triggerProfiBanner = () => {
    const isProfiMatch = activeTournamentId !== null 
      ? activeTournamentDifficulty >= 4000 
      : tacScore >= 4000;

    if (isProfiMatch) {
      setShowProfiBanner(true);
      setTimeout(() => setShowProfiBanner(false), 4000);
    }
  };

  const [showNameTags, setShowNameTags] = useState(() => {
    return localStorage.getItem("tacpadel_show_nametags") !== "false";
  });

  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const playSfx = (soundId: string) => {
    if (localStorage.getItem("tacpadel_sound") !== "false") {
      soundManager.play(soundId);
    }
  };

  useEffect(() => {
    const fetchUserScore = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from("user_stats") 
            .select("points") 
            .eq("id", session.user.id)
            .single();

          if (data && !error) {
            setTacScore(data.points);
            localStorage.setItem("tacpadel_score", data.points.toString());
            return; 
          }
        }
      } catch (err) {
        console.log("Konnte Score nicht von Supabase laden, nutze lokalen Speicher.");
      }
      const saved = localStorage.getItem("tacpadel_score");
      if (saved) setTacScore(parseInt(saved, 10));
    };
    fetchUserScore();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    bgmRef.current = new Audio("/sounds/background.mp3"); 
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.2; 
    return () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) {
      const isMusicEnabled = localStorage.getItem("tacpadel_music") !== "false";
      if (!isMenuOpen && !gameOver && isMusicEnabled && isVisible) {
        bgmRef.current.play().catch(e => console.log("Browser blockiert Autoplay:", e));
      } else {
        bgmRef.current.pause();
        if (gameOver) bgmRef.current.currentTime = 0; 
      }
    }
  }, [isMenuOpen, gameOver, isVisible]);

  const totalPoints = playerScore + aiScore;
  const { serverId } = getServerInfo(totalPoints);
  const isPlayerTeamServe = serverId === "you" || serverId === "partner";

  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  const [courtState, setCourtState] = useState({
    you: "B1", partner: "D4", opp1: "B1", opp2: "D1", 
    ball: { side: "left" as "left"|"right", zone: "B1", type: "PREPARE_SERVE" }
  });
  const courtStateRef = useRef(courtState);
  useEffect(() => { courtStateRef.current = courtState; }, [courtState]);
  
  const [phase, setPhase] = useState<GamePhase>("player_planning");
  
  const [aiTarget, setAiTarget] = useState<string>("B3"); 
  const aiTargetRef = useRef(aiTarget);
  useEffect(() => { aiTargetRef.current = aiTarget; }, [aiTarget]);

  const [aiHitterId, setAiHitterId] = useState<"opp1" | "opp2">("opp1");
  const [validInterceptZones, setValidInterceptZones] = useState<string[]>([]);
  const validInterceptZonesRef = useRef<string[]>([]);
  useEffect(() => { validInterceptZonesRef.current = validInterceptZones; }, [validInterceptZones]);
  
  const [aiTrajectory, setAiTrajectory] = useState({ impactZone: "B3", reboundZone: null as string | null, isWallHit: false });
  const aiTrajectoryRef = useRef(aiTrajectory);
  useEffect(() => { aiTrajectoryRef.current = aiTrajectory; }, [aiTrajectory]);

  const [catchStatus, setCatchStatus] = useState<"ok" | "missed_time" | "wrong_zone" | "smash_over_head">("ok");
  const [timerDuration, setTimerDuration] = useState<number>(5000); 
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [activeChar, setActiveChar] = useState<"you" | "partner">("you");
  const [hitterId, setHitterId] = useState<"you" | "partner">("you");
  
  const [commands, setCommands] = useState<{ you: Command, partner: Command }>({
    you: { run: null, shot: null, target: null },
    partner: { run: null, shot: null, target: null }
  });
  const commandsRef = useRef(commands);
  useEffect(() => { commandsRef.current = commands; }, [commands]);

  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  const [turnTitle, setTurnTitle] = useState<string>(""); 
  const [turnMessage, setTurnMessage] = useState<string>("");
  
  const turnResultRef = useRef(turnResult);
  const turnTitleRef = useRef(turnTitle); 
  useEffect(() => { turnResultRef.current = turnResult; turnTitleRef.current = turnTitle; }, [turnResult, turnTitle]); 

  const [showResultOverlay, setShowResultOverlay] = useState<boolean>(false);
  const [isShotModalOpen, setIsShotModalOpen] = useState<boolean>(false);
  const [lastShotQuality, setLastShotQuality] = useState<TurnResult>(null);

  const [showExplanations, setShowExplanations] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("tacpadel_show_explanations");
    if (saved === "false") setShowExplanations(false);
  }, []);

  const [flashMsg, setFlashMsg] = useState<{text: string, color: string} | null>(null);

  const showFlash = (text: string, color: string = "text-white", duration: number = 2000) => {
    setFlashMsg({ text, color });
    setTimeout(() => setFlashMsg(null), duration);
  };

  const loadGame = () => {
    const savedData = localStorage.getItem("tacpadel_savegame");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      
      setActiveTournamentId(parsed.tournamentId || null);
      setActiveTournamentRound(parsed.tournamentRound || 1);
      setActiveTournamentDifficulty(parsed.tournamentDifficulty || 0);

      // --- NEU: KI Profil laden ---
      if (parsed.activeAiProfile) setActiveAiProfile(parsed.activeAiProfile);

      setPlayerScore(parsed.playerScore);
      setAiScore(parsed.aiScore);
      setCourtState(parsed.courtState);
      setPhase(parsed.phase || "player_planning");
      
      if (parsed.matchStats) {
        setMatchStats({
          player: { ...initialStatsData.player, ...parsed.matchStats.player },
          ai: { ...initialStatsData.ai, ...parsed.matchStats.ai }
        });
      }

      if (staminaModeEnabled) {
        if (parsed.stamina) setStamina(parsed.stamina);
        else setStamina({ you: MAX_PLAYER_STAMINA, partner: MAX_PLAYER_STAMINA, opp1: getAiMaxStamina(parsed.tournamentDifficulty || parsed.tacScore || 3000), opp2: getAiMaxStamina(parsed.tournamentDifficulty || parsed.tacScore || 3000) });
      }
      
      const total = parsed.playerScore + parsed.aiScore;
      const { serverId, isRightCourt } = getServerInfo(total);
      let receiverId = "you"; 
      if (serverId === "opp1" || serverId === "opp2") {
        receiverId = isRightCourt ? "partner" : "you";
      }
      
      const initialHitter = (serverId === "you" || serverId === "partner") ? serverId : receiverId;
      const isOurServe = parsed.courtState.ball.type === "PREPARE_SERVE" && (serverId === "you" || serverId === "partner");
      resetSelections(initialHitter as "you" | "partner", isOurServe);

      setGameOver(false);
      setShowGameOverUI(false);
      setShowResultOverlay(false);
      
      setPlayIntro(false);
      setIsIntroPlaying(false);
      triggerProfiBanner();

      return true;
    }
    return false;
  };

  // PUNKT 1: Stamina Carry-Over beim Starten eines Turniers
  const handleStartTournamentMatch = (tourId: string, round: number, difficulty: number = 0) => {
    setIsTourOpen(false);
    setIsMenuOpen(false);
    
    setActiveTournamentId(tourId);
    setActiveTournamentRound(round);
    setActiveTournamentDifficulty(difficulty);

    // --- NEU: Zufällige Auswahl eines Gegners für jede Turnierrunde ---
    const randomIndex = Math.floor(Math.random() * AI_PROFILES.length);
    const selectedProfile = AI_PROFILES[randomIndex];
    setActiveAiProfile(selectedProfile);

    setPlayerScore(0);
    setAiScore(0);
    setGameOver(false);
    setShowGameOverUI(false);
    setMatchStats(initialStatsData);
    setAiShotHistory([]);

    const baseDifficulty = difficulty > 0 ? difficulty : tacScore;
    const roundDifficultyBonus = (round - 1) * 500; 
    const aiTargetScore = baseDifficulty + roundDifficultyBonus;
    
    if (staminaModeEnabled) {
      let startYou = MAX_PLAYER_STAMINA;
      let startPartner = MAX_PLAYER_STAMINA;

      if (round > 1) {
        // Lade Ausdauer aus vorheriger Runde und wende Regeneration an
        const savedTourStamina = JSON.parse(localStorage.getItem("tacpadel_tour_stamina") || "{}");
        const prevStamina = savedTourStamina[tourId];
        
        if (prevStamina) {
          startYou = Math.min(MAX_PLAYER_STAMINA, prevStamina.you + STAMINA_REGEN_BETWEEN_ROUNDS);
          startPartner = Math.min(MAX_PLAYER_STAMINA, prevStamina.partner + STAMINA_REGEN_BETWEEN_ROUNDS);
        }
      } else {
        // Starte bei 100% in Runde 1 -> Lösche alte Werte falls vorhanden
        const savedTourStamina = JSON.parse(localStorage.getItem("tacpadel_tour_stamina") || "{}");
        delete savedTourStamina[tourId];
        localStorage.setItem("tacpadel_tour_stamina", JSON.stringify(savedTourStamina));
      }

      setStamina({ 
        you: startYou, 
        partner: startPartner, 
        // Gegner Ausdauer wird mit dem Profil-Multiplikator berechnet!
        opp1: Math.floor(getAiMaxStamina(aiTargetScore) * selectedProfile.staminaMult), 
        opp2: Math.floor(getAiMaxStamina(aiTargetScore) * selectedProfile.staminaMult) 
      });
    }

    resetForNextPoint(0, 0, 0, initialStatsData, true); 
    
    setIntroTrigger(prev => prev + 1); 
    setPlayIntro(true);
    setIsIntroPlaying(true); 

    let roundName = "Viertelfinale";
    if (round === 2) roundName = "Halbfinale";
    if (round === 3) roundName = "Finale";
    
    setTimeout(() => {
        showFlash(`Gegner: ${selectedProfile.teamName} (${selectedProfile.p1} & ${selectedProfile.p2})`, "text-cyan-400", 4000);
    }, 3500);

    // Kleiner Hinweis für den Spieler, dass die Ausdauer übernommen wurde
    if (round > 1 && staminaModeEnabled) {
        showFlash(`🏆 ${roundName} gestartet! (Stamina teilweise regeneriert)`, "text-amber-400", 4000);
    } else {
        showFlash(`🏆 ${roundName} gestartet!`, "text-orange-400", 3500);
    }
  };

  const startNewGame = () => {
    setActiveTournamentId(null);
    setActiveTournamentRound(1);
    setActiveTournamentDifficulty(0);
    
    // --- NEU: Zufälliges Team für Einzelmatch ---
    const randomProfile = AI_PROFILES[Math.floor(Math.random() * AI_PROFILES.length)];
    setActiveAiProfile(randomProfile);

    setPlayerScore(0);
    setAiScore(0);
    setGameOver(false);
    setShowGameOverUI(false);
    
    setMatchStats(initialStatsData);
    setAiShotHistory([]);
    
    if (staminaModeEnabled) {
      setStamina({ 
        you: MAX_PLAYER_STAMINA, 
        partner: MAX_PLAYER_STAMINA, 
        opp1: Math.floor(getAiMaxStamina(tacScore) * randomProfile.staminaMult), 
        opp2: Math.floor(getAiMaxStamina(tacScore) * randomProfile.staminaMult) 
      });
    }
    
    resetForNextPoint(0, 0, 0, initialStatsData, true); 
    
    setIntroTrigger(prev => prev + 1); 
    setPlayIntro(true);
    setIsIntroPlaying(true); 

    setTimeout(() => {
        showFlash(`Gegner: ${randomProfile.teamName} (${randomProfile.p1} & ${randomProfile.p2})`, "text-cyan-400", 4000);
    }, 3500);
  };

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    
    if (phase === "ai_prepare" && !isIntroPlaying) {
      const isAiServing = courtState.ball.type === "PREPARE_SERVE";
      const delay = isAiServing ? 2800 : 1500;
      
      t = setTimeout(() => {
        let currentAiHitter: "opp1" | "opp2" = "opp1";
        const { isRightCourt } = getServerInfo(totalPoints); 
        const ballLandedAt = courtState.ball.zone;

        if (isAiServing) {
          currentAiHitter = serverId as "opp1" | "opp2";
        } 
        else if (courtState.ball.type === "AUFSCHLAG") {
          currentAiHitter = isRightCourt ? "opp1" : "opp2";
        } 
        else {
          const bCol = ballLandedAt[0];
          if (bCol === "A" || bCol === "B") currentAiHitter = "opp1"; 
          else if (bCol === "D" || bCol === "E") currentAiHitter = "opp2"; 
          else {
            const getRowIdx = (pos: string) => parseInt(pos[1]);
            const dist1 = Math.abs(getRowIdx(courtState.opp1) - getRowIdx(ballLandedAt));
            const dist2 = Math.abs(getRowIdx(courtState.opp2) - getRowIdx(ballLandedAt));
            if (dist1 < dist2) currentAiHitter = "opp1";
            else if (dist2 < dist1) currentAiHitter = "opp2";
            else currentAiHitter = "opp1"; 
          }
        }

        let currentAiDifficulty = tacScore;
        if (activeTournamentId) {
          currentAiDifficulty = activeTournamentDifficulty > 0 ? activeTournamentDifficulty : tacScore;
          currentAiDifficulty += ((activeTournamentRound - 1) * 300);
        }

        const brain = calculateSmartAITurn(
          ballLandedAt, courtState.you, courtState.partner, 
          isAiServing, lastShotQuality, currentAiDifficulty, 
          courtState.ball.type, aiShotHistory, serveNumber,
          staminaRef.current.you, staminaRef.current.partner,
          activeAiProfile.style // --- NEU: Style wird übergeben ---
        );
        
        setAiShotHistory(prev => [brain.shot, ...prev].slice(0, 3));

        let finalAiResult = brain.aiResult as TurnResult;
        let finalAiTitle = brain.aiTitle;
        let finalAiMessage = brain.aiMessage;

        if (staminaModeEnabled) {
          const currentAiStamina = staminaRef.current[currentAiHitter];
          if (currentAiStamina <= 0) {
             if (finalAiResult === "perfect") {
                 finalAiResult = "success";
             } else if (finalAiResult === "success") {
                 finalAiResult = "recovery";
             } else if (finalAiResult === "recovery" || (finalAiResult && !finalAiResult.startsWith("error"))) {
                 finalAiResult = "error_net";
                 // --- NEU: Nutzt die KI Namen ---
                 finalAiTitle = `🤖 ${currentAiHitter === "opp1" ? activeAiProfile.p1 : activeAiProfile.p2} ERSCHÖPFT`;
                 finalAiMessage = `${currentAiHitter === "opp1" ? activeAiProfile.p1 : activeAiProfile.p2} pfeift aus dem letzten Loch und schlägt den Ball kraftlos ins Netz!`;
             }
          }
        }

        setMatchStats(prev => {
          const newAiStats = { ...prev.ai };
          newAiStats.totalShots += 1;
          if (finalAiResult === "perfect") newAiStats.shotsPerfect += 1;
          else if (finalAiResult === "recovery") newAiStats.shotsRecovery += 1;
          else if (finalAiResult?.startsWith("error")) newAiStats.shotsError += 1;
          else newAiStats.shotsSuccess += 1;
          return { ...prev, ai: newAiStats };
        });

        setAiHitterId(currentAiHitter); 
        setValidInterceptZones(brain.interceptZones);
        setAiTarget(brain.target);

      const GLOBAL_SPEED_FACTOR = 0.75; 
        let calcDuration = brain.flightTimeMs * GLOBAL_SPEED_FACTOR;
        
        // --- NEU: Anpassung der Reaktionszeit basierend auf dem KI Style ---
        if (activeAiProfile.style === "aggressive" && finalAiResult !== "error_net" && finalAiResult !== "error_out") {
            calcDuration *= 0.85; 
        }
        if (activeAiProfile.style === "defensive" && finalAiResult !== "error_net" && finalAiResult !== "error_out") {
            calcDuration *= 1.15;
        }

        if (finalAiResult === "error_net" || finalAiResult === "error_wall_direct" || finalAiResult === "error_out") {
          calcDuration = 3600; 
        } else if (finalAiResult === "perfect") {
          calcDuration = 3000; 
        } else {
          calcDuration = Math.max(calcDuration, 3600);
        }

        if (staminaModeEnabled && (staminaRef.current.you <= 0 || staminaRef.current.partner <= 0)) {
            if (finalAiResult !== "perfect" && !finalAiResult?.startsWith("error")) {
                calcDuration *= 0.65;
            }
        }

        setTimerDuration(calcDuration);
        
        setAiTrajectory({ impactZone: brain.target, reboundZone: brain.reboundZone, isWallHit: brain.isWallHit });

        let fColor = "text-red-400";
        if (finalAiResult?.startsWith("error")) fColor = "text-emerald-400";
        else if (finalAiResult === "recovery") fColor = "text-amber-400";
        else if (finalAiResult === "perfect") fColor = "text-red-600";
        
        showFlash(finalAiTitle, fColor, calcDuration + 800);

        setCourtState(prev => {
          const nextState = {
            ...prev,
            ball: { side: "right" as const, zone: ballLandedAt, type: brain.shot }
          };
          
          if (!isAiServing) {
            nextState[currentAiHitter] = ballLandedAt;
            const partnerId = currentAiHitter === "opp1" ? "opp2" : "opp1";
            let pTarget = brain.opp2Target || "C2"; 
            const targetRow = pTarget[1]; 
            const hitterCol = ballLandedAt[0]; 

            if (hitterCol === "A" || hitterCol === "B") pTarget = "D" + targetRow; 
            else if (hitterCol === "D" || hitterCol === "E") pTarget = "B" + targetRow; 
            else pTarget = partnerId === "opp1" ? "B" + targetRow : "D" + targetRow; 
            
            nextState[partnerId] = pTarget;

            if (staminaModeEnabled) {
              const opp1Dist = getZoneDist(prev.opp1, nextState.opp1);
              const opp2Dist = getZoneDist(prev.opp2, nextState.opp2);
              setStamina(s => ({
                ...s,
                opp1: Math.max(0, s.opp1 - opp1Dist + (opp1Dist > 0 ? 1 : 0)), 
                opp2: Math.max(0, s.opp2 - opp2Dist + (opp2Dist > 0 ? 1 : 0))
              }));
            }
          }
          return nextState;
        });

        const isAiWinnerOrError = finalAiResult === "perfect" || (finalAiResult && finalAiResult.startsWith("error"));
        if (isAiWinnerOrError) {
          setTurnResult(finalAiResult as TurnResult);
          setTurnTitle(finalAiTitle); 
          setTurnMessage(finalAiMessage);

          setPhase("player_animating");
          setTimeout(() => {
              setShowResultOverlay(true);
          }, calcDuration + 400);
          
        } else {
          setTurnResult(null); 
          setLastShotQuality(finalAiResult as TurnResult);
        }

        if (progressBarRef.current) {
          progressBarRef.current.style.width = "100%";
          progressBarRef.current.className = "h-full bg-emerald-500";
        }

        setCatchStatus("ok");
        setPhase("timer_running");
      }, delay); 
    }
    return () => clearTimeout(t);
  }, [phase, courtState.ball.zone, courtState.you, courtState.partner, courtState.opp1, courtState.opp2, serverId, lastShotQuality, totalPoints, isIntroPlaying, staminaModeEnabled, activeTournamentId, activeTournamentRound, activeTournamentDifficulty, activeAiProfile]); // activeAiProfile im Dependency-Array!

  useEffect(() => {
    if (phase !== "timer_running") return;
    const startTime = Date.now();
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, timerDuration - elapsed); 

      if (progressBarRef.current) {
        const percentage = (remaining / timerDuration) * 100;
        progressBarRef.current.style.width = `${percentage}%`;

        if (percentage > 50) progressBarRef.current.className = "h-full bg-emerald-500";
        else if (percentage > 25) progressBarRef.current.className = "h-full bg-amber-500";
        else progressBarRef.current.className = "h-full bg-red-500";
      }

      if (remaining > 0) {
        frameId = requestAnimationFrame(tick);
      } else {
        if (turnResultRef.current === "perfect" || (turnResultRef.current && turnResultRef.current.startsWith("error"))) {
          setPhase("player_animating");
          setTimeout(() => setShowResultOverlay(true), 1200);
        } else {
          const currentYouPos = courtStateRef.current.you;
          const currentPartnerPos = courtStateRef.current.partner;

          const interceptYouRun = commandsRef.current.you.run || currentYouPos;
          const interceptPartnerRun = commandsRef.current.partner.run || currentPartnerPos;
          
          let isYouInZone = validInterceptZonesRef.current.includes(interceptYouRun);
          let isPartnerInZone = validInterceptZonesRef.current.includes(interceptPartnerRun);

          const { serverId: currentServer, isRightCourt: currentIsRight } = getServerInfo(totalPoints);
          if (courtStateRef.current.ball.type === "AUFSCHLAG" && (currentServer === "opp1" || currentServer === "opp2")) {
              const expectedReturner = currentIsRight ? "partner" : "you";
              if (expectedReturner === "you") {
                  isPartnerInZone = false; 
              } else {
                  isYouInZone = false;     
              }
          }

          let status: "ok" | "missed_time" | "wrong_zone" | "smash_over_head" = "ok";
          
          if (isYouInZone || isPartnerInZone) status = "ok"; 
          else if (!commandsRef.current.you.run && !commandsRef.current.partner.run) status = "missed_time"; 
          else status = courtStateRef.current.ball.type === "SMASH" ? "smash_over_head" : "wrong_zone";

          if (status === "ok") {
            let bestHitter = hitterId;
            if (isYouInZone && !isPartnerInZone) bestHitter = "you";
            else if (isPartnerInZone && !isYouInZone) bestHitter = "partner";
            else {
                const actualBallPos = aiTrajectoryRef.current.reboundZone || aiTargetRef.current;
                const getColIdx = (col: string) => ["A", "B", "C", "D", "E"].indexOf(col[0]);
                const getRowIdx = (pos: string) => parseInt(pos[1]);
                const tCol = getColIdx(actualBallPos);
                const tRow = getRowIdx(actualBallPos);
                
                const distYou = Math.abs(getColIdx(interceptYouRun) - tCol) + Math.abs(getRowIdx(interceptYouRun) - tRow);
                const distPartner = Math.abs(getColIdx(interceptPartnerRun) - tCol) + Math.abs(getRowIdx(interceptPartnerRun) - tRow);
                
                if (distPartner < distYou) bestHitter = "partner";
                else if (distYou < distPartner) bestHitter = "you";
                else {
                    if (commandsRef.current.partner.run && !commandsRef.current.you.run) bestHitter = "partner";
                    else if (commandsRef.current.you.run && !commandsRef.current.partner.run) bestHitter = "you";
                    else bestHitter = hitterId; 
                }
            }
            
            if (staminaModeEnabled) {
              const youDist = getZoneDist(currentYouPos, interceptYouRun);
              const partnerDist = getZoneDist(currentPartnerPos, interceptPartnerRun);
              setStamina(s => ({
                ...s,
                you: Math.max(0, s.you - youDist),
                partner: Math.max(0, s.partner - partnerDist)
              }));
            }

            setHitterId(bestHitter);
            setActiveChar(bestHitter);
            setCatchStatus(status);
            
            const catcherZone = bestHitter === "you" ? interceptYouRun : interceptPartnerRun;
            
            setCourtState(prev => ({
              ...prev, you: interceptYouRun, partner: interceptPartnerRun,
              ball: { side: "left", zone: catcherZone, type: prev.ball.type } 
            }));

            setCommands(prev => ({ you: { ...prev.you, run: null }, partner: { ...prev.partner, run: null } }));
            setPhase("player_planning"); 
            
          } else {
            let errorResult: TurnResult = "error_net";
            let tTitle = "";
            let message = "";
            
            if (status === "smash_over_head") {
              errorResult = "error_smash_over_head"; 
              tTitle = "❌ ÜBERWORFEN!"; 
              message = "Time-Out! Der Smash war zu hart und flog hoch über dich hinweg! Du hättest ans Netz kommen müssen.";
            } else if (status === "missed_time") {
              errorResult = "error_net"; 
              tTitle = "❌ ZU SPÄT!"; 
              message = "Time-Out! Du bist wie angewurzelt stehen geblieben und hast den Ball völlig verpasst.";
            } else {
              errorResult = "error_wrong_zone"; 
              tTitle = "❌ LUFTLOCH!"; 
              message = "Time-Out! Du bist völlig in die falsche Richtung gelaufen und konntest den Ball nicht mehr erreichen.";
            }

            playSfx("error_net");
            playSfx("crowd_gasp");

            setTurnResult(errorResult);
            setTurnTitle(tTitle);
            setTurnMessage(message);
            setLastShotQuality(errorResult);

            setMatchStats(prev => ({
              ...prev,
              player: {
                ...prev.player,
                totalShots: prev.player.totalShots + 1,
                shotsError: prev.player.shotsError + 1
              }
            }));

            showFlash(tTitle, "text-red-500", 2500);

            const finalBallZone = aiTrajectoryRef.current.reboundZone || aiTargetRef.current;
            setCourtState(prev => ({
              ...prev, you: interceptYouRun, partner: interceptPartnerRun,
              ball: { side: "left", zone: finalBallZone, type: prev.ball.type } 
            }));

            setPhase("player_animating"); 
            setTimeout(() => { setShowResultOverlay(true); }, 1500);
          }
        }
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [phase, timerDuration, staminaModeEnabled]);

  const updateCommand = (char: "you" | "partner", updates: Partial<Command>) => {
    setCommands(prev => ({ ...prev, [char]: { ...prev[char], ...updates } }));
  };

  const setAsHitter = (char: "you" | "partner") => {
    setHitterId(char);
    setCommands(prev => ({
      you: { ...prev.you, shot: char === "you" ? prev.you.shot : null, target: char === "you" ? prev.you.target : null },
      partner: { ...prev.partner, shot: char === "partner" ? prev.partner.shot : null, target: char === "partner" ? prev.partner.target : null }
    }));
  };

  const handleSubmit = () => {
    setPhase("player_animating"); 
    const chosenShot = commands[hitterId].shot!;

    const handleTurnResult = (result: TurnResult, shotType: string) => {
      if (["SMASH", "VIBORA", "BAJADA", "VOLLEY"].includes(shotType) || result === "perfect") playSfx("hit_smash"); 
      else if (["LOB", "BLOCK", "CHIQUITA"].includes(shotType)) playSfx("hit_soft");
      else playSfx("hit_hard");

      setTimeout(() => {
          if (result === "perfect") { playSfx("hit_smash"); playSfx("crowd_cheer"); } 
          else if (result === "error_net") { playSfx("error_net"); playSfx("crowd_gasp"); } 
          else if (result === "error_wall_direct") { playSfx("bounce_glass"); playSfx("crowd_gasp"); }
      }, 350); 
    };

    const hitFromPos = hitterId === "you" ? courtState.you : courtState.partner; 
    const targetPos = commands[hitterId].target!;
    
    const recoveryYouRun = commands.you.run || courtState.you;
    const recoveryPartnerRun = commands.partner.run || courtState.partner;
    
    if (staminaModeEnabled) {
      const youDist = getZoneDist(courtState.you, recoveryYouRun);
      const partnerDist = getZoneDist(courtState.partner, recoveryPartnerRun);
      const youRegen = evalRunTactics(chosenShot, recoveryYouRun);
      const partnerRegen = evalRunTactics(chosenShot, recoveryPartnerRun);

      setStamina(s => ({
        ...s,
        you: Math.max(0, Math.min(MAX_PLAYER_STAMINA, s.you - youDist + youRegen)),
        partner: Math.max(0, Math.min(MAX_PLAYER_STAMINA, s.partner - partnerDist + partnerRegen))
      }));
    }

    setCourtState(prev => ({ 
      ...prev, 
      you: recoveryYouRun, 
      partner: recoveryPartnerRun, 
      ball: { ...prev.ball, type: chosenShot, zone: hitFromPos } 
    }));

    const isPlayerServingTurn = courtState.ball.type === "PREPARE_SERVE" && (serverId === "you" || serverId === "partner");
    const isPlayerReturningTurn = courtState.ball.type === "AUFSCHLAG" && (serverId === "opp1" || serverId === "opp2");
    const isDugOut = aiTrajectoryRef.current.isWallHit && hitFromPos === aiTrajectoryRef.current.impactZone;

    let currentTurnResult: TurnResult = "success";
    let message = "";
    let tTitle = ""; 

    if (isPlayerServingTurn && hitterId !== serverId) {
      currentTurnResult = "error_wrong_zone";
      tTitle = "❌ FALSCHER AUFSCHLÄGER!";
      message = `Regelfehler! Falscher Aufschläger. Laut Rotation ${serverId === "you" ? "bist DU" : "ist dein PARTNER"} an der Reihe!`;
    } 
    else if (isPlayerServingTurn) {
      const hCol = hitFromPos.charAt(0).toUpperCase();
      const tCol = targetPos.charAt(0).toUpperCase();
      
      const isHitRight = hCol === "D" || hCol === "E";
      const isHitLeft = hCol === "A" || hCol === "B";
      const isTargetRight = tCol === "D" || tCol === "E";
      const isTargetLeft = tCol === "A" || tCol === "B";
      
      if ((isHitRight && isTargetRight) || (isHitLeft && isTargetLeft)) {
         currentTurnResult = "error_out"; 
         tTitle = "❌ FEHLAUFSCHLAG!";
         message = "Regelfehler! Der Aufschlag muss diagonal ins gegenüberliegende Feld (oder auf die T-Linie) gespielt werden. Geradeaus ist ein Fehler!";
      }
    }
    else if (isPlayerReturningTurn) {
      const { isRightCourt: currentIsRightCourt } = getServerInfo(totalPoints);
      const expectedReturner = currentIsRightCourt ? "partner" : "you";

      if (hitterId !== expectedReturner) {
         currentTurnResult = "error_wrong_zone";
         tTitle = "❌ FALSCHER RETURNER!";
         message = `Regelfehler! Der Aufschlag kam diagonal auf ${expectedReturner === "you" ? "dich" : "deinen Partner"}. Abfangen ist beim Return verboten!`;
      }
    }

    if (currentTurnResult === "success") {
      const evalResult = evaluatePlayerShot(
        chosenShot, hitFromPos, targetPos, 
        courtState.opp1, courtState.opp2, isPlayerServingTurn, isPlayerReturningTurn, isDugOut, 
        activeScenario, lastShotQuality, tacScore, courtState.ball.type, 
        shotHistory, serveNumber 
      );
      currentTurnResult = evalResult.result;
      tTitle = evalResult.title; 
      message = evalResult.message;

      if (staminaModeEnabled) {
        const currentStamina = staminaRef.current[hitterId];
        if (currentStamina <= 0) {
          if (currentTurnResult === "success") {
            currentTurnResult = "recovery"; 
            message += " [Erschöpft: Dem Schlag fehlt völlig die Power!]";
          } else if (currentTurnResult === "recovery") {
            currentTurnResult = "error_net"; 
            tTitle = "❌ KRAFTLOS IM NETZ";
            message += " [Erschöpft: Die Beine waren zu schwer, du bleibst am Netz hängen!]";
          }
        }
      }
    }

    setShotHistory(prev => {
      const newHistory = [chosenShot, ...prev];
      return newHistory.slice(0, 2); 
    });

    setMatchStats(prev => {
      const pStats = { ...prev.player };
      pStats.totalShots += 1;
      if (currentTurnResult === "perfect") pStats.shotsPerfect += 1;
      else if (currentTurnResult === "recovery") pStats.shotsRecovery += 1;
      else if (currentTurnResult?.startsWith("error")) pStats.shotsError += 1;
      else pStats.shotsSuccess += 1;
      return { ...prev, player: pStats };
    });

    setLastShotQuality(currentTurnResult); 
    setTurnResult(currentTurnResult);
    setTurnTitle(tTitle); 
    setTurnMessage(message);
    handleTurnResult(currentTurnResult, chosenShot);

    let pFlightTime = 3200;
    if (["SMASH", "VIBORA", "BAJADA"].includes(chosenShot)) pFlightTime = 2800;
    else if (["AUFSCHLAG"].includes(chosenShot)) pFlightTime = 3200; 
    else if (["LOB", "CHIQUITA"].includes(chosenShot)) pFlightTime = 3600; 
    
    if (currentTurnResult?.startsWith("error")) pFlightTime = 3200; 
    
    setTimerDuration(pFlightTime);

    let fColor = "text-emerald-400";
    if (currentTurnResult?.startsWith("error")) fColor = "text-red-500";
    else if (currentTurnResult === "recovery") fColor = "text-amber-400";
    else if (currentTurnResult === "perfect") fColor = "text-cyan-400";
    
    showFlash(tTitle, fColor, 2500);
    setTimeout(() => { setShowResultOverlay(true); }, pFlightTime + 300); 
  };

  const handleNextTurn = () => {
    if (!showResultOverlay) return; 
    
    setShowResultOverlay(false);
    
    let newPlayerScore = playerScore;
    let newAiScore = aiScore;
    
    const isTimeout = turnMessage.includes("Time-Out");
    const wasAiTurn = !commands[hitterId].shot && !isTimeout; 

    const newStats = { ...matchStats };
    const lastShotHit = (wasAiTurn || isTimeout) ? courtState.ball.type : commands[hitterId].shot;
    const isAce = lastShotHit === "AUFSCHLAG";
    
    const isServeError = isAce && turnResult && turnResult.startsWith("error") && !isTimeout;

    if (turnResult && turnResult.startsWith("error")) {
      if (isServeError && serveNumber === 1) {
         resetForNextPoint(newPlayerScore + newAiScore, newPlayerScore, newAiScore, newStats, false, true); 
         return; 
      }

      if (wasAiTurn) {
        newPlayerScore += 1; 
        newStats.ai.unforcedErrors += 1; 
      } else {
        newAiScore += 1;              
        newStats.player.unforcedErrors += 1; 
      }
      setActiveScenario(null); 
    } 
    else if (turnMessage.includes("PUNKT GEWONNEN") || turnResult === "perfect") {
      if (wasAiTurn) {
        newAiScore += 1;    
        if (isAce) newStats.ai.aces += 1; else newStats.ai.winners += 1;
      } else {
        newPlayerScore += 1;          
        if (isAce) newStats.player.aces += 1; else newStats.player.winners += 1;
      }
      setActiveScenario(null); 
    } 
    else {
      setActiveScenario(null);
      setCourtState(prev => ({
        ...prev,
        ball: { side: "right", zone: commands[hitterId].target || "C4", type: commands[hitterId].shot || "DRIVE" }
      }));
      resetSelections(hitterId, false);
      setPhase("ai_prepare"); 
      return;
    }

    setPlayerScore(newPlayerScore);
    setAiScore(newAiScore);
    setMatchStats(newStats); 

    // SPIELENDE
    if ((newPlayerScore >= 10 && newPlayerScore - newAiScore >= 2) || (newAiScore >= 10 && newAiScore - newPlayerScore >= 2)) {
      
      setGameOver(true); 
      setPhase("player_planning"); 
      
      setTimeout(() => {
        setShowGameOverUI(true); 
      }, 4000);

      localStorage.removeItem("tacpadel_savegame"); 

      const playerWon = newPlayerScore > newAiScore;

      // --- TURNIER LOGIK BEIM SPIELENDE ---
      if (activeTournamentId) {
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              
              let scoreChange = 0;
              const matchResult = playerWon ? "win" : "loss";
              
              if (playerWon) {
                if (activeTournamentRound < 3 && staminaModeEnabled) {
                  const currentStamina = staminaRef.current;
                  const savedTourStamina = JSON.parse(localStorage.getItem("tacpadel_tour_stamina") || "{}");
                  savedTourStamina[activeTournamentId] = {
                    you: currentStamina.you,
                    partner: currentStamina.partner
                  };
                  localStorage.setItem("tacpadel_tour_stamina", JSON.stringify(savedTourStamina));
                }

                if (activeTournamentRound === 3) {
                  const savedTourStamina = JSON.parse(localStorage.getItem("tacpadel_tour_stamina") || "{}");
                  if (savedTourStamina[activeTournamentId]) {
                    delete savedTourStamina[activeTournamentId];
                    localStorage.setItem("tacpadel_tour_stamina", JSON.stringify(savedTourStamina));
                  }

                  await supabase.from("tour_progress").update({ status: "won" }).eq("user_id", session.user.id).eq("tournament_id", activeTournamentId);
                  scoreChange = 500; 
                } else {
                  await supabase.from("tour_progress").update({ current_round: activeTournamentRound + 1 }).eq("user_id", session.user.id).eq("tournament_id", activeTournamentId);
                  scoreChange = 100; 
                }
              } else {
                const savedTourStamina = JSON.parse(localStorage.getItem("tacpadel_tour_stamina") || "{}");
                if (savedTourStamina[activeTournamentId]) {
                  delete savedTourStamina[activeTournamentId];
                  localStorage.setItem("tacpadel_tour_stamina", JSON.stringify(savedTourStamina));
                }

                await supabase.from("tour_progress").update({ status: "eliminated" }).eq("user_id", session.user.id).eq("tournament_id", activeTournamentId);
                scoreChange = -50; 
              }

              const finalScore = Math.max(0, tacScore + scoreChange);
              setTacScore(finalScore);
              setLastScoreChange(scoreChange);
              localStorage.setItem("tacpadel_score", finalScore.toString());

              await supabase.from("user_stats").update({ points: finalScore }).eq("id", session.user.id);
              
              await supabase.from("match_history").insert({ 
                user_id: session.user.id, 
                points: finalScore, 
                result: matchResult,
                aces: newStats.player.aces,
                winners: newStats.player.winners,
                unforced_errors: newStats.player.unforcedErrors,
                total_shots: newStats.player.totalShots,
                shots_perfect: newStats.player.shotsPerfect
              });

            }
          } catch (err) {
            console.error("Fehler beim Speichern des Turnier-Ergebnisses:", err);
          }
        })();
      }
      // --- NORMALES EINZELMATCH LOGIK BEIM SPIELENDE ---
      else {
        const diff = Math.abs(newPlayerScore - newAiScore);
        let scoreChange = 0;

        if (playerWon) scoreChange = 100 + (diff * 15);
        else scoreChange = -50 - (diff * 10);

        setLastScoreChange(scoreChange);
        
        const finalScore = Math.max(0, tacScore + scoreChange);
        setTacScore(finalScore);
        localStorage.setItem("tacpadel_score", finalScore.toString());
        
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              await supabase.from("user_stats").update({ points: finalScore }).eq("id", session.user.id);
              const matchResult = playerWon ? "win" : "loss";
              
              await supabase.from("match_history").insert({ 
                user_id: session.user.id, 
                points: finalScore, 
                result: matchResult,
                aces: newStats.player.aces,
                winners: newStats.player.winners,
                unforced_errors: newStats.player.unforcedErrors,
                total_shots: newStats.player.totalShots,
                shots_perfect: newStats.player.shotsPerfect
              });
            }
          } catch (err) {
            console.error("Fehler beim Speichern des Match-Ergebnisses:", err);
          }
        })();
      }

    } else {
      resetForNextPoint(newPlayerScore + newAiScore, newPlayerScore, newAiScore, newStats);
    }
  };

  const resetSelections = (defaultHitter: "you" | "partner" = "you", isServeTurn: boolean = false) => {
    setCommands({ 
      you: { run: null, shot: (isServeTurn && defaultHitter === "you") ? "AUFSCHLAG" : null, target: null }, 
      partner: { run: null, shot: (isServeTurn && defaultHitter === "partner") ? "AUFSCHLAG" : null, target: null } 
    });
    setTurnResult(null);
    setTurnTitle(""); 
    setTurnMessage("");
    setActiveChar(defaultHitter);
    setHitterId(defaultHitter);
    setCatchStatus("ok");
  };

  const resetForNextPoint = (total: number, newPScore?: number, newAScore?: number, newStats?: any, suppressFlash: boolean = false, isSecondServe: boolean = false) => {
    const pScore = newPScore ?? playerScore;
    const aScore = newAScore ?? aiScore;
    const stats = newStats ?? matchStats;
    const totalPointsForServe = pScore + aScore;

    const { serverId, isRightCourt } = getServerInfo(totalPointsForServe);
    
    let pYou = "B1", pPartner = "D4", pOpp1 = "B1", pOpp2 = "D1";
    let ballZone = "B1", ballSide: "left" | "right" = "left";
    let nextPhase: GamePhase = "player_planning";
    let receiverId = "you"; 

    if (serverId === "you") {
      if (isRightCourt) { pYou = "D1"; pPartner = "D4"; pOpp1 = "B1"; pOpp2 = "D2"; ballZone = "D1"; } 
      else { pYou = "B1"; pPartner = "D4"; pOpp1 = "B2"; pOpp2 = "D1"; ballZone = "B1"; }
      ballSide = "left"; nextPhase = "player_planning"; receiverId = "you"; 
      if (!suppressFlash) showFlash(isSecondServe ? "⚠️ 2. AUFSCHLAG!" : "DU HAST AUFSCHLAG!", isSecondServe ? "text-amber-400" : "text-purple-400", 3000); 
    } 
    else if (serverId === "partner") {
      if (isRightCourt) { pPartner = "D1"; pYou = "B4"; pOpp1 = "B1"; pOpp2 = "D2"; ballZone = "D1"; } 
      else { pPartner = "B1"; pYou = "B4"; pOpp1 = "B2"; pOpp2 = "D1"; ballZone = "B1"; }
      ballSide = "left"; nextPhase = "player_planning"; receiverId = "partner"; 
      if (!suppressFlash) showFlash(isSecondServe ? "⚠️ 2. AUFSCHLAG (PARTNER)!" : "PARTNER SCHLÄGT AUF!", isSecondServe ? "text-amber-400" : "text-cyan-400", 3000); 
    } 
    else if (serverId === "opp1") {
      if (isRightCourt) { pOpp1 = "B1"; pOpp2 = "D4"; pPartner = "D1"; pYou = "B2"; ballZone = "B1"; receiverId = "partner"; } 
      else { pOpp1 = "D1"; pOpp2 = "D4"; pYou = "B1"; pPartner = "D2"; ballZone = "D1"; receiverId = "you"; }
      ballSide = "right"; nextPhase = "ai_prepare";
      if (!suppressFlash) showFlash(isSecondServe ? "⚠️ KI: 2. AUFSCHLAG!" : "GEGNER SCHLÄGT AUF!", isSecondServe ? "text-amber-400" : "text-red-400", 3000); 
    } 
    else if (serverId === "opp2") {
      if (isRightCourt) { pOpp2 = "B1"; pOpp1 = "B4"; pPartner = "D1"; pYou = "B2"; ballZone = "B1"; receiverId = "partner"; } 
      else { pOpp2 = "D1"; pOpp1 = "B4"; pYou = "B1"; pPartner = "D2"; ballZone = "D1"; receiverId = "you"; }
      ballSide = "right"; nextPhase = "ai_prepare";
      if (!suppressFlash) showFlash(isSecondServe ? "⚠️ KI: 2. AUFSCHLAG!" : "GEGNER SCHLÄGT AUF!", isSecondServe ? "text-amber-400" : "text-red-400", 3000); 
    }

    const initialHitter = (serverId === "you" || serverId === "partner") ? serverId : receiverId;
    const isOurServe = serverId === "you" || serverId === "partner";
    
    resetSelections(initialHitter as "you" | "partner", isOurServe);
    setActiveScenario(null); 
    setLastShotQuality(null);
    setShotHistory([]); 
    setAiShotHistory([]);
    setServeNumber(isSecondServe ? 2 : 1); 

    const nextCourt = { 
      you: pYou, partner: pPartner, opp1: pOpp1, opp2: pOpp2, 
      ball: { side: ballSide, zone: ballZone, type: "PREPARE_SERVE" as const } 
    };
    
    setCourtState(nextCourt);
    setPhase(nextPhase); 

    let newStamina = staminaRef.current;
    if (staminaModeEnabled) {
      const isNewMatch = totalPointsForServe === 0 && !isSecondServe;
      if (!isNewMatch) {
         const aiTargetScore = activeTournamentId 
             ? (activeTournamentDifficulty > 0 ? activeTournamentDifficulty : tacScore) + ((activeTournamentRound - 1) * 500) 
             : tacScore;
         newStamina = {
           you: Math.min(MAX_PLAYER_STAMINA, staminaRef.current.you + 1),
           partner: Math.min(MAX_PLAYER_STAMINA, staminaRef.current.partner + 1),
           // Beachte den Profil-Multiplikator beim Cap!
           opp1: Math.min(Math.floor(getAiMaxStamina(aiTargetScore) * activeAiProfile.staminaMult), staminaRef.current.opp1 + 1),
           opp2: Math.min(Math.floor(getAiMaxStamina(aiTargetScore) * activeAiProfile.staminaMult), staminaRef.current.opp2 + 1)
         };
         setStamina(newStamina);
      }
    }

    const gameStateToSave = {
      playerScore: pScore,
      aiScore: aScore,
      courtState: nextCourt,
      phase: nextPhase,
      matchStats: stats,
      stamina: staminaModeEnabled ? newStamina : undefined,
      tournamentId: activeTournamentId,
      tournamentRound: activeTournamentRound,
      tournamentDifficulty: activeTournamentDifficulty,
      activeAiProfile // WICHTIG: KI speichern
    };
    localStorage.setItem("tacpadel_savegame", JSON.stringify(gameStateToSave));
  };

  const suppId = hitterId === "you" ? "partner" : "you";
  const isHitterReady = commands[hitterId].run && commands[hitterId].shot && commands[hitterId].target;
  const isSupporterReady = commands[suppId].run; 
  
  const needsSupporterConfirm = isHitterReady && !isSupporterReady && phase === "player_planning";
  const canSubmit = isHitterReady && isSupporterReady && phase === "player_planning";
  
  const isTimerPhase = phase === "timer_running";
  const isAiActive = phase === "ai_prepare" || phase === "timer_running" || (phase === "player_animating" && courtState.ball.side === "right");
  const isAnimPhase = phase === "player_animating" || phase === "timer_running";

  let submitText = "Zug ausführen";
  if (!commands[hitterId].run) submitText = `Fehlt: Laufweg`;
  else if (!commands[hitterId].shot) submitText = `Fehlt: Schlag`;
  else if (!commands[hitterId].target) submitText = `Fehlt: Schlagziel`;
  else if (needsSupporterConfirm) submitText = `Mitspieler steht gut?`; 

  const onMainButtonClick = () => {
    if (isTimerPhase) return;
    if (needsSupporterConfirm) updateCommand(suppId, { run: courtState[suppId] });
    else if (canSubmit) handleSubmit();
  };

  const StatCell = ({ val, total, noBorderTop }: { val: number, total: number, noBorderTop?: boolean }) => {
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    return (
      <div className={`py-2 text-white text-sm sm:text-base font-black flex flex-col items-center justify-center gap-0.5 ${noBorderTop ? '' : 'border-t border-slate-700/50'}`}>
        <span>{val}</span>
        {total > 0 && <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold leading-none">({pct}%)</span>}
      </div>
    );
  };

  return (
    <div 
      className="w-full flex-1 flex flex-col bg-[#050b18] rounded-2xl border border-slate-900 shadow-2xl select-none text-slate-200 relative overflow-hidden" 
      style={{ height: "calc(100dvh - 150px)", minHeight: "600px" }}
    >
      {/* =================================================== */}
      {/* HAUPTMENÜ OVERLAY                                   */}
      {/* =================================================== */}
      <AnimatePresence>
        {isMenuOpen && !isTourOpen && (
          <div className="absolute inset-0 z-[200] bg-[#050b18] rounded-2xl overflow-hidden pointer-events-auto">
            <div className="absolute inset-0 pointer-events-none">
              <img src="/logo.png" alt="TacPadel Background" className="w-full h-full object-cover opacity-100" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050b18] via-[#050b18]/40 to-transparent"></div>
            </div>
            <div className="relative z-10 h-full flex flex-col items-center justify-end pb-10 sm:pb-12 px-4 gap-4 w-full">
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-widest uppercase drop-shadow-[0_0_20px_rgba(255,119,0,0.8)] mb-auto mt-10"></h1>
              
              <button 
                onClick={() => { startNewGame(); setIsMenuOpen(false); }}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_30px_rgba(255,119,0,0.4)] hover:scale-105 transition-all"
              >
                Neues Einzelmatch
              </button>

              {localStorage.getItem("tacpadel_savegame") && (
                <button 
                  onClick={() => { if (loadGame()) setIsMenuOpen(false); else alert("Kein gültiger Speicherstand gefunden."); }}
                  className="w-full max-w-sm py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-105 transition-all"
                >
                  Match Fortsetzen
                </button>)}
              
              {/* Pro Tour Events Button */}
              <button 
                onClick={() => setIsTourOpen(true)}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:scale-105 transition-all"
              >
                Pro Tour Events
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================================== */}
      {/* PRO TOUR SCREEN OVERLAY                               */}
      {/* =================================================== */}
      <AnimatePresence>
        {isTourOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-[250] bg-[#02050a] rounded-2xl overflow-hidden pointer-events-auto"
          >
            <TourScreen 
              onClose={() => setIsTourOpen(false)} 
              onStartMatch={handleStartTournamentMatch} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfiBanner && (
          <motion.div
            initial={{ x: -800, skewX: 20, opacity: 0 }} 
            animate={{ x: 0, skewX: 0, opacity: 1 }}
            exit={{ x: -800, skewX: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 25, mass: 0.8 }}
            className="fixed top-44 left-0 right-0 z-[140] pointer-events-none flex justify-center px-4"
          >
            <div className="p-[2px] bg-gradient-to-r from-purple-500 via-[#050b14] to-fuchsia-500 shadow-[0_10px_30px_rgba(168,85,247,0.4)]" style={{ clipPath: "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)" }}>
              <div className="bg-[#03060c] flex items-center px-6 py-3 sm:px-8 sm:py-4 gap-4 sm:gap-6 relative overflow-hidden" style={{ clipPath: "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)" }}>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:8px_8px] opacity-30"></div>
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-dashed border-white/30 animate-[spin_4s_linear_infinite]"></div>
                  <div className="absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full border-y-2 border-purple-500 opacity-70"></div>
                  <span className="text-xl sm:text-2xl z-10 font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">🔥</span>
                </div>
                <div className="flex flex-col justify-center z-10 leading-tight">
                  <span className="text-lg sm:text-2xl font-black uppercase tracking-widest text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">Profi-Liga Aktiv</span>
                  <span className="text-sm sm:text-lg font-black uppercase tracking-widest text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">Keine Taktik-Linien</span>
                </div>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-60">
                   <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-fuchsia-500 rounded-full shadow-[0_0_5px_rgba(217,70,239,1)]"></div>
                   <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-fuchsia-500 rounded-full shadow-[0_0_5px_rgba(217,70,239,1)]"></div>
                   <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-fuchsia-500 rounded-full shadow-[0_0_5px_rgba(217,70,239,1)]"></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flashMsg && !isMenuOpen && (() => {
          let rawText = flashMsg.text;
          let icon = "✓"; 
          
          const firstChar = rawText.charAt(0);
          if (["⭐", "❌", "⚠️", "✓", "🏆"].includes(firstChar)) { icon = firstChar; rawText = rawText.slice(1).trim(); } 
          else if (rawText.includes("KI ") || rawText.includes("Gegner:")) { icon = "🤖"; }

          const words = rawText.split(" ");
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(" ");
          const line2 = words.slice(mid).join(" ");

          const isError = flashMsg.color.includes("red");
          const isWarning = flashMsg.color.includes("amber");

          let leftGlow = "from-[#00f0ff]"; let iconColor = "text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]"; let line1Color = "text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]";
          let rightGlow = "to-[#ff7700]"; let line2Color = "text-[#ff7700] drop-shadow-[0_0_8px_rgba(255,119,0,0.5)]";

          if (isError) { leftGlow = "from-red-500"; iconColor = "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"; line1Color = "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"; } 
          else if (isWarning) { leftGlow = "from-amber-400"; iconColor = "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"; line1Color = "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"; }

          return (
            <motion.div initial={{ x: 800, skewX: -20, opacity: 0 }} animate={{ x: 0, skewX: 0, opacity: 1 }} exit={{ x: -800, skewX: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 450, damping: 25, mass: 0.8 }} className="fixed top-24 left-0 right-0 z-[150] pointer-events-none flex justify-center px-4">
              <div className={`p-[2px] bg-gradient-to-r ${leftGlow} via-[#050b14] ${rightGlow} shadow-[0_10px_30px_rgba(0,0,0,0.8)]`} style={{ clipPath: "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)" }}>
                <div className="bg-[#03060c] flex items-center px-6 py-3 sm:px-8 sm:py-4 gap-4 sm:gap-6 relative overflow-hidden" style={{ clipPath: "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)" }}>
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:8px_8px] opacity-30"></div>
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-dashed border-white/30 animate-[spin_4s_linear_infinite]"></div>
                    <div className={`absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full border-y-2 ${isError ? 'border-red-500' : isWarning ? 'border-amber-400' : 'border-[#00f0ff]'} opacity-70`}></div>
                    <span className={`text-xl sm:text-2xl z-10 font-black ${iconColor}`}>{icon}</span>
                  </div>
                  <div className="flex flex-col justify-center z-10 leading-tight">
                    <span className={`text-lg sm:text-2xl font-black uppercase tracking-widest ${line1Color}`}>{line1}</span>
                    {line2 && <span className={`text-lg sm:text-2xl font-black uppercase tracking-widest ${line2Color}`}>{line2}</span>}
                  </div>
                  <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-60">
                     <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(255,119,0,1)]"></div>
                     <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(255,119,0,1)]"></div>
                     <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(255,119,0,1)]"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {showGameOverUI && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-md rounded-2xl border border-orange-500/50 pointer-events-auto overflow-y-auto custom-scrollbar">
            <div className="min-h-full flex flex-col p-4 sm:p-8">
              <div className="m-auto flex flex-col items-center w-full max-w-4xl space-y-6 sm:space-y-8 py-6">
                
                {activeTournamentId && (
                   <div className="bg-purple-900/50 border border-purple-500 px-6 py-2 rounded-full mb-[-1rem]">
                     <span className="text-purple-300 font-black uppercase tracking-widest text-xs">
                       Turnier {activeTournamentRound === 3 ? "Finale" : activeTournamentRound === 2 ? "Halbfinale" : "Viertelfinale"}
                     </span>
                   </div>
                )}

                <div className="text-center">
                  <h2 className="text-4xl sm:text-5xl font-black mb-2 uppercase tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                    {playerScore > aiScore ? <span className="text-emerald-400">🏆 Du Gewinnst!</span> : <span className="text-red-500">💀 {activeAiProfile.teamName} Gewinnt!</span>}
                  </h2>
                  <p className="text-slate-300 text-lg font-bold">Endstand im Tiebreak: {playerScore} : {aiScore}</p>
                </div>
                <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch justify-center w-full">
                  <div className="flex-1 flex flex-col items-center justify-center bg-[#050b14] border border-slate-700/50 p-6 rounded-2xl shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] w-full">
                    <span className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4">Dein TacScore</span>
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{tacScore}</span>
                      <div className={`px-5 py-1.5 rounded-full border ${lastScoreChange > 0 ? "bg-emerald-900/30 border-emerald-500/50 text-emerald-400" : "bg-red-900/30 border-red-500/50 text-red-500"}`}>
                        <span className="text-lg font-black tracking-widest whitespace-nowrap">{lastScoreChange > 0 ? `+${lastScoreChange}` : lastScoreChange} Punkte</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full bg-[#050b14] border border-slate-700/50 rounded-2xl overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col">
                    <div className="bg-slate-800/50 py-2.5 text-center border-b border-slate-700/50 shrink-0"><span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Match Ausgang</span></div>
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-700/50">
                      <div className="py-2 flex flex-col justify-center bg-slate-900/40"><span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Dein Team</span></div>
                      <div className="py-2 flex flex-col justify-center bg-slate-900/20"><span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Metrik</span></div>
                      <div className="py-2 flex flex-col justify-center bg-slate-900/40"><span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{activeAiProfile.teamName}</span></div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.player.aces}</div>
                      <div className="py-2.5 text-orange-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex items-center justify-center border-t border-slate-700/50">Asse</div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.ai.aces}</div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.player.winners}</div>
                      <div className="py-2.5 text-emerald-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex items-center justify-center border-t border-slate-700/50">Winner</div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.ai.winners}</div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.player.unforcedErrors}</div>
                      <div className="py-2.5 text-red-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex items-center justify-center border-t border-slate-700/50">Fehler</div>
                      <div className="py-2.5 text-white text-base sm:text-lg font-black border-t border-slate-700/50 flex items-center justify-center">{matchStats.ai.unforcedErrors}</div>
                    </div>
                    <div className="bg-slate-800/80 py-2.5 text-center border-y border-slate-700/50 shrink-0 mt-2"><span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Alle gespielten Schläge</span></div>
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-700/50 mb-2">
                      <div className="py-2 text-slate-300 text-sm font-black flex items-center justify-center">{matchStats.player.totalShots}</div>
                      <div className="py-2 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex items-center justify-center">Gesamt</div>
                      <div className="py-2 text-slate-300 text-sm font-black flex items-center justify-center">{matchStats.ai.totalShots}</div>
                      <StatCell val={matchStats.player.shotsPerfect} total={matchStats.player.totalShots} />
                      <div className="py-2 text-cyan-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex flex-col items-center justify-center border-t border-slate-700/50"><span>Perfekt</span><span className="text-[7px] opacity-60">⭐</span></div>
                      <StatCell val={matchStats.ai.shotsPerfect} total={matchStats.ai.totalShots} />
                      <StatCell val={matchStats.player.shotsSuccess} total={matchStats.player.totalShots} />
                      <div className="py-2 text-emerald-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex flex-col items-center justify-center border-t border-slate-700/50"><span>Solide</span><span className="text-[7px] opacity-60">✓</span></div>
                      <StatCell val={matchStats.ai.shotsSuccess} total={matchStats.ai.totalShots} />
                      <StatCell val={matchStats.player.shotsRecovery} total={matchStats.player.totalShots} />
                      <div className="py-2 text-amber-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex flex-col items-center justify-center border-t border-slate-700/50"><span>Wackler</span><span className="text-[7px] opacity-60">⚠️</span></div>
                      <StatCell val={matchStats.ai.shotsRecovery} total={matchStats.ai.totalShots} />
                      <StatCell val={matchStats.player.shotsError} total={matchStats.player.totalShots} />
                      <div className="py-2 text-red-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest bg-slate-900/20 flex flex-col items-center justify-center border-t border-slate-700/50"><span>Fehlschlag</span><span className="text-[7px] opacity-60">❌</span></div>
                      <StatCell val={matchStats.ai.shotsError} total={matchStats.ai.totalShots} />
                    </div>
                  </div>
                </div>
                
                {activeTournamentId ? (
                   <button onClick={() => { setIsTourOpen(true); setShowGameOverUI(false); setActiveTournamentId(null); }} className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_30px_rgba(217,70,239,0.4)] hover:scale-105 active:scale-95 transition-all shrink-0">
                     Zurück zur Pro Tour
                   </button>
                ) : (
                   <button onClick={startNewGame} className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_30px_rgba(255,119,0,0.4)] hover:scale-105 active:scale-95 transition-all shrink-0">
                     Neues Match starten
                   </button>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full flex-1 overflow-hidden pointer-events-auto">
        
        {/* --- AUSDAUER HUD OVERLAY --- */}
        <AnimatePresence>
          {staminaModeEnabled && !isMenuOpen && !isIntroPlaying && !gameOver && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none"
            >
              {/* KI 1 */}
              <div className="absolute top-4 left-4 flex flex-col gap-1 w-24 sm:w-32 opacity-80">
                 <div className="flex justify-between items-end">
                   <span className="text-[9px] font-black text-red-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">
                     {activeAiProfile.p1}
                   </span>
                   {stamina.opp1 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 && <span className="text-[8px] text-red-500 font-black animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">⚠️ LOW</span>}
                 </div>
                 <div className={`h-1.5 w-full bg-slate-900/80 rounded-full border overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] ${stamina.opp1 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 ? 'border-red-500/80' : 'border-slate-700'}`}>
                   <div 
                     className={`h-full transition-[width] duration-500 ease-out ${stamina.opp1 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-r from-red-600 to-red-400'}`} 
                     style={{ width: `${(stamina.opp1 / (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult)) * 100}%` }} 
                   />
                 </div>
              </div>

              {/* KI 2 */}
              <div className="absolute top-4 right-4 flex flex-col gap-1 w-24 sm:w-32 opacity-80 items-end">
                 <div className="flex justify-between items-end w-full flex-row-reverse">
                   <span className="text-[9px] font-black text-red-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">
                     {activeAiProfile.p2}
                   </span>
                   {stamina.opp2 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 && <span className="text-[8px] text-red-500 font-black animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">⚠️ LOW</span>}
                 </div>
                 <div className={`h-1.5 w-full bg-slate-900/80 rounded-full border overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] ${stamina.opp2 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 ? 'border-red-500/80' : 'border-slate-700'}`}>
                   <div 
                     className={`h-full transition-[width] duration-500 ease-out ml-auto ${stamina.opp2 <= (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult) * 0.3 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-l from-red-600 to-red-400'}`} 
                     style={{ width: `${(stamina.opp2 / (getAiMaxStamina(tacScore) * activeAiProfile.staminaMult)) * 100}%` }} 
                   />
                 </div>
              </div>

              {/* DU */}
              <div className="absolute bottom-4 left-4 flex flex-col gap-1 w-28 sm:w-36">
                 <div className="flex justify-between items-end">
                   <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">DU</span>
                   {stamina.you <= MAX_PLAYER_STAMINA * 0.3 && <span className="text-[10px] text-red-500 font-black animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">⚠️ LOW</span>}
                 </div>
                 <div className={`h-2 w-full bg-slate-900/90 rounded-full border overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.8)] ${stamina.you <= MAX_PLAYER_STAMINA * 0.3 ? 'border-red-500/80' : 'border-slate-700'}`}>
                   <div 
                     className={`h-full transition-[width] duration-500 ease-out ${stamina.you <= MAX_PLAYER_STAMINA * 0.3 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-pulse' : 'bg-gradient-to-r from-purple-600 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`} 
                     style={{ width: `${(stamina.you / MAX_PLAYER_STAMINA) * 100}%` }} 
                   />
                 </div>
              </div>

              {/* PARTNER */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-1 w-28 sm:w-36 items-end">
                 <div className="flex justify-between items-end w-full flex-row-reverse">
                   <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">Partner</span>
                   {stamina.partner <= MAX_PLAYER_STAMINA * 0.3 && <span className="text-[10px] text-red-500 font-black animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">⚠️ LOW</span>}
                 </div>
                 <div className={`h-2 w-full bg-slate-900/90 rounded-full border overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.8)] ${stamina.partner <= MAX_PLAYER_STAMINA * 0.3 ? 'border-red-500/80' : 'border-slate-700'}`}>
                   <div 
                     className={`h-full transition-[width] duration-500 ease-out ml-auto ${stamina.partner <= MAX_PLAYER_STAMINA * 0.3 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-pulse' : 'bg-gradient-to-l from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`} 
                     style={{ width: `${(stamina.partner / MAX_PLAYER_STAMINA) * 100}%` }} 
                   />
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-10">
          <ScenarioCourt3D 
            key={`court-${introTrigger}`} 
            playIntro={playIntro}  
            gameOver={gameOver} 
            
            onIntroFinished={() => {
              setPlayIntro(false);
              setIsIntroPlaying(false);
              if (!isMenuOpen && !gameOver) { 
                triggerProfiBanner(); 
                
                const info = getServerInfo(playerScore + aiScore);
                if (info.serverId === "you") {
                   showFlash("DU HAST AUFSCHLAG!", "text-purple-400", 3000);
                } else if (info.serverId === "partner") {
                   showFlash("PARTNER SCHLÄGT AUF!", "text-cyan-400", 3000);
                } else {
                   showFlash(`${activeAiProfile.teamName.toUpperCase()} SCHLÄGT AUF!`, "text-red-400", 3000);
                }
              }
            }} 
            
            level="Spielzug" 
            positions={courtState} 
            hasSubmitted={isAnimPhase}
            bestZones={activeScenario ? activeScenario.bestZones : []} 
            acceptableZones={activeScenario ? [activeScenario.laufZone] : []}
            
            profiMode={isProfi}
            
            selectedZone={phase === "ai_prepare" ? null : (isAiActive ? aiTarget : commands[hitterId].target)}
            selectedLaufZone={commands.you.run} selectedPartnerZone={commands.partner.run}
            activeChar={isAiActive ? aiHitterId : activeChar} hitterId={isAiActive ? aiHitterId : hitterId}
            isTimerActive={isTimerPhase} turnResult={turnResult}
            previewShot={phase === "player_planning" ? commands[hitterId].shot : null}
            timerDuration={timerDuration}
            
            onZoneClick={(id) => { if (phase === "player_planning" && activeChar === hitterId) updateCommand(activeChar, { target: id }); }}
            
            onLaufZoneClick={(id) => { if (phase === "player_planning" || isTimerPhase) updateCommand(activeChar, { run: id }); }}
            onPlayerClick={(char) => { if (phase === "player_planning" || isTimerPhase) setActiveChar(char as "you" | "partner"); }}
            
            playerScore={playerScore} aiScore={aiScore}
            isAiActive={isAiActive} phase={phase} isTimerPhase={isTimerPhase}
            isPlayerTeamServe={isPlayerTeamServe}

            hidePlayerLabels={!showNameTags}
            
            // --- HIER IST DIE KORRIGIERTE ZEILE (ohne Anführungszeichen) ---
            activeAiProfile={activeAiProfile}
          />
        </div>
      </div>

      <div className={`w-full z-40 bg-[#050b18] border-t border-slate-700 p-2 sm:p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2 shrink-0 transition-opacity duration-700 ${(isIntroPlaying || (gameOver && !showGameOverUI)) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {phase === "ai_prepare" && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-t-2 border-red-500 animate-spin" />
            <h3 className="text-red-400 font-black tracking-widest uppercase text-[10px]">
              🤖 {activeAiProfile.teamName} {courtState.ball.type === "PREPARE_SERVE" ? "schlägt auf" : "checkt Lücken"}...
            </h3>
          </div>
        )}

        {phase === "player_animating" && !showResultOverlay && (
          <div className="flex items-center justify-center py-2">
            <h3 className="text-orange-400 font-black tracking-widest uppercase text-[10px] animate-pulse">
              🎾 Ball im Flug...
            </h3>
          </div>
        )}

        {(phase === "player_planning" || phase === "timer_running") && !gameOver && (
          <>
            <div className="flex items-center justify-between px-1 mb-2 mt-1">
              <span className={`text-[9px] font-black tracking-widest uppercase ${activeChar === "you" ? "text-purple-400" : "text-cyan-400"}`}>
                {activeChar === "you" ? "DU" : "PARTNER"} {hitterId === activeChar ? (courtState.ball.type === "PREPARE_SERVE" ? `(${serveNumber}. Aufschlag)` : "(Schläger)") : "(Absicherung)"}
              </span>
              <div className="w-1/2 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div ref={progressBarRef} className={`h-full ${isTimerPhase ? 'bg-emerald-500 w-full' : 'w-0 opacity-0'}`} />
              </div>
            </div>

            {isTimerPhase ? (
              <div className="flex gap-3 w-full mb-2 h-14">
                <button onClick={() => setActiveChar("you")} className={`flex-1 rounded-xl border-2 font-black tracking-widest uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${activeChar === "you" ? 'bg-purple-900/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-105 z-10' : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-80 hover:bg-slate-800'}`}>
                  <span className="text-sm">DU</span><span className="text-[8px] font-bold opacity-70">Laufweg setzen</span>
                </button>
                <button onClick={() => setActiveChar("partner")} className={`flex-1 rounded-xl border-2 font-black tracking-widest uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${activeChar === "partner" ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105 z-10' : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-80 hover:bg-slate-800'}`}>
                  <span className="text-sm">PARTNER</span><span className="text-[8px] font-bold opacity-70">Laufweg setzen</span>
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className={`p-1.5 rounded border text-center ${commands[activeChar].run ? (activeChar === "you" ? 'border-purple-500/50 bg-purple-950/20' : 'border-cyan-500/50 bg-cyan-950/20') : 'border-slate-800 bg-slate-900/40'}`}>
                <div className={`text-[7px] font-black uppercase ${activeChar === "you" ? "text-purple-400" : "text-cyan-400"}`}>Laufzone</div>
                <div className="text-[9px] font-bold text-white truncate">{commands[activeChar].run || "-"}</div>
              </div>
              {hitterId === activeChar ? (
                <>
                  <div className={`p-1.5 rounded border text-center ${commands[activeChar].target ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                    <div className="text-[7px] font-black text-emerald-400 uppercase">Schlagziel</div>
                    <div className="text-[9px] font-bold text-white truncate">{commands[activeChar].target || "-"}</div>
                  </div>
                  <div onClick={() => !isTimerPhase && setIsShotModalOpen(true)} className={`p-1.5 rounded border text-center cursor-pointer ${commands[activeChar].shot ? 'border-orange-500/50 bg-orange-950/20' : 'border-orange-500/40 bg-orange-950/30 animate-pulse'}`}>
                    <div className="text-[7px] font-black text-orange-400 uppercase">Schlag</div>
                    <div className="text-[9px] font-bold text-white truncate">{commands[activeChar].shot || "WÄHLEN"}</div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex flex-col items-center justify-center border border-dashed border-slate-700/50 bg-slate-800/20 rounded p-1.5 pointer-events-none opacity-60">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">🛡️ Raumabdeckung</span>
                  <span className="text-[7px] font-bold text-slate-600">
                    {hitterId === "you" ? "Du" : "Partner"} {hitterId === "you" ? "hast" : "hat"} den Ball
                  </span>
                </div>
              )}
            </div>
            )}
            <button 
                onClick={onMainButtonClick} 
                disabled={(!canSubmit && !needsSupporterConfirm) || isTimerPhase} 
                className={`w-full py-2.5 font-black text-[10px] tracking-widest uppercase rounded-lg border transition-all ${
                  isTimerPhase ? "bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed" 
                    : canSubmit ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                      : needsSupporterConfirm ? "bg-emerald-900/50 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse"
                        : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                }`}
              >
                {isTimerPhase ? "Zeit läuft..." : submitText}
              </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {isShotModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsShotModalOpen(false)} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm pointer-events-auto" />
            <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(_, info) => { if (info.offset.y > 100) setIsShotModalOpen(false); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[70] bg-[#050b18] border-t border-orange-900/50 p-6 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[85vh] touch-none pointer-events-auto">
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-5 cursor-grab active:cursor-grabbing" />
              <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-black tracking-widest text-orange-400 uppercase">Welchen Schlag wählst du?</h3></div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto custom-scrollbar pb-10">
                {SHOT_TYPES.map((shot) => {
                  const isSelected = commands[activeChar].shot === shot;
                  let btnStyle = isSelected ? "bg-orange-600/20 border-orange-500 text-orange-300 shadow-[0_0_10px_rgba(255,119,0,0.2)]" : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60";
                  return <button key={shot} disabled={isAnimPhase} onClick={() => { updateCommand(activeChar, { shot }); setIsShotModalOpen(false); }} className={`w-full flex items-center justify-center py-3 px-1 rounded-lg border text-[9px] font-black tracking-wider uppercase transition-all duration-200 text-center ${btnStyle}`}>{shot}</button>;
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "player_animating" && showResultOverlay && !gameOver && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 25 }} className="fixed bottom-6 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-5xl z-50 bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.9)] pointer-events-auto">
            
            <div className={`flex flex-col md:flex-row gap-6 items-center ${showExplanations ? 'justify-between' : 'justify-center'}`}>
              
              {showExplanations && (
                <div className="flex-1 text-center md:text-left flex flex-col justify-center">
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed max-w-3xl font-medium">{turnMessage}</p>
                </div>
              )}

              <button onClick={handleNextTurn} className={`w-full ${showExplanations ? 'md:w-auto' : 'max-w-md'} px-10 py-5 bg-white hover:bg-slate-200 text-black font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 whitespace-nowrap`}>
                {turnResult && turnResult.startsWith("error") ? "Nächster Punkt ➔" : (turnResult === "perfect" ? "Punkt gewonnen! ➔" : "Nächste Aktion (KI) ➔")}
              </button>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
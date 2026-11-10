import React, { useState, useMemo, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import Navigation from "./components/Navigation";
import HomeView from "./components/HomeView";
import BasicsView from './components/Basics'; 
import { motion, AnimatePresence } from "framer-motion";
import TacticsBoard from "./components/TacticsBoard";
import ScenarioCourt, { PlayerPositions } from "./components/ScenarioCourt";
import { SCENARIOS, Scenario } from './components/Scenarios';
import { PADEL_DICTIONARY, CATEGORY_COLORS } from './components/Basics';
import GameScreen from './components/GameScreen';
import { usePoints } from './lib/usePoints';
import { useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabase';
import { useProgress, Level } from './lib/useProgress';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { DBPlayer } from "./components/HomeView";
import ProfileTab from './components/ProfileTab';
import * as THREE from "three";
import ScenarioCourt25 from "./components/ScenarioCourt25";
import PublicProfileModal from "./components/PublicProfileModal";
import StrategyTrainer from "./components/StrategyTrainer";
import { useTranslation, formatLevelName, formatShotName } from "./lib/i18n";

const SHOTS = ["LOB", "SMASH", "BANDEJA", "VIBORA", "VOLLEY", "BLOCK", "BAJADA", "CHIQUITA", "AUFSCHLAG", "DRIVE"];
const TRAINER_SEQUENCE: Level[] = ["Schlag", "Schlagrichtung", "Laufrichtung", "Spielzug"];

type Tab = "home" | "trainer" | "game" | "board" | "taktik" | "basics" | "login" | "profile" | "strategy";

const get3DPosition = (zoneId: string, side: "left" | "right", yHeight: number = 0): THREE.Vector3 => {
  if (!zoneId || typeof zoneId !== "string" || zoneId.length < 2) {
    return new THREE.Vector3(0, yHeight, 0);
  }

  const letters = ["A", "B", "C", "D", "E"];
  const letter = zoneId[0].toUpperCase();
  const num = parseInt(zoneId[1]);
  const letterIdx = letters.indexOf(letter) !== -1 ? letters.indexOf(letter) : 2;

  let x = 8 - (letterIdx * 1.5); 
  if (side === "left") x = -x;

  let z = 4 - ((num - 1) * 2);

  return new THREE.Vector3(x, yHeight, z);
};

const getTargetProgressionLevel = (scores: Record<string, number>, locked: Level[]): Level => {
  if ((scores["Spielzug"] || 0) >= 50) return "Simulation";

  for (const lvl of TRAINER_SEQUENCE) {
    const progUnlocked =
      lvl === "Schlag" ? true :
      lvl === "Schlagrichtung" ? (scores["Schlag"] || 0) >= 10 :
      lvl === "Laufrichtung" ? (scores["Schlagrichtung"] || 0) >= 10 :
      (scores["Laufrichtung"] || 0) >= 10;

    const isClosed = locked.includes(lvl) && lvl !== "Spielzug";
    if (progUnlocked && !isClosed) {
      return lvl;
    }
  }

  return "Spielzug";
};

function WelcomeModal({ user, onComplete }: { user: any, onComplete: () => void }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) return;
    setIsSaving(true);
    
    await supabase.auth.updateUser({ data: { display_name: username } });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('user_stats')
        .upsert({ 
          id: session.user.id, 
          email: session.user.email,
          display_name: username,
          avatar_url: session.user.user_metadata?.avatar_url || null
        }, { onConflict: 'id' }); 
    }

    setIsSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-card-border p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-6 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-primary" />
        
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary text-4xl shadow-inner"></div>
        
        <div>
          <h2 className="text-3xl font-black text-primary mb-2">{t("welcome_title")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("welcome_text")}
          </p>
        </div>

        <input 
          type="text" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("welcome_placeholder")}
          className="px-5 py-4 bg-background border-2 border-border focus:border-primary rounded-xl text-foreground text-center font-bold text-lg outline-none transition-all shadow-sm"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        <button
          onClick={handleSave}
          disabled={isSaving || !username.trim()}
          className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 mt-2"
        >
          {isSaving ? t("welcome_saving") : t("welcome_btn")}
        </button>
      </motion.div>
    </div>
  );
}

function TutorialModal({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-12 bg-background/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#050b18] border border-cyan-500/50 p-6 sm:p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] max-w-lg w-full max-h-[82vh] overflow-y-auto flex flex-col gap-6 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
        
        <div className="text-center">
          <span className="text-4xl mb-2 block">🧠</span>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">{t("tut_title")}</h2>
          <p className="text-cyan-400 text-sm font-bold tracking-wider mt-1">{t("tut_subtitle")}</p>
        </div>

        <div className="flex flex-col gap-4 text-sm text-slate-300 mt-2">
          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">1</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step1_title")}</p>
              <p className="leading-snug">{t("tut_step1_desc")}</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">2</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step2_title")}</p>
              <p className="leading-snug mb-2">{t("tut_step2_desc")}</p>
              <ul className="flex flex-col gap-1 text-[11px] font-bold tracking-wider">
                <li className="text-orange-400">{t("tut_step2_b1")}</li>
                <li className="text-emerald-400">{t("tut_step2_b2")}</li>
                <li className="text-purple-400">{t("tut_step2_b3")}</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-black text-white">3</div>
            <div>
              <p className="font-bold text-white mb-1">{t("tut_step3_title")}</p>
              <p className="leading-snug">{t("tut_step3_desc")}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full mt-2 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black text-sm tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
        >
          {t("tut_btn_start")}
        </button>
      </motion.div>
    </div>
  );
}

const updateSupabaseScore = async (newTotalPoints: number) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    const { error } = await supabase
      .from('user_stats')
      .upsert({ 
        id: session.user.id, 
        email: session.user.email,
        points: newTotalPoints     
      });

    if (error) {
      console.error("Fehler beim Speichern der Stats:", error);
    }
  }
};

function shuffleIndices(length: number, excludeFirst?: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (excludeFirst !== undefined && indices[0] === excludeFirst && indices.length > 1) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }
  return indices;
}

const getAdjacentZones = (zoneId: string) => {
  if (!zoneId) return [];
  const LETTERS = ["A", "B", "C", "D"];
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const neighbors = [];

  if (num > 1) neighbors.push(`${letter}${num - 1}`);
  if (num < 5) neighbors.push(`${letter}${num + 1}`);
  if (letterIdx > 0) neighbors.push(`${LETTERS[letterIdx - 1]}${num}`);
  if (letterIdx < LETTERS.length - 1) neighbors.push(`${LETTERS[letterIdx + 1]}${num}`);

  return neighbors;
};

export default function App(): React.JSX.Element {
  const { lang, t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;
    return savedTab ? savedTab : "home";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{type: 'error'|'success', text: string} | null>(null);

  const [selectedPublicUserId, setSelectedPublicUserId] = useState<string | null>(null);
  const [selectedPublicUserTab, setSelectedPublicUserTab] = useState<"single" | "tournament">("single");

  useEffect(() => {
    localStorage.setItem("tacpadel_activeTab", activeTab);
  }, [activeTab]);
  
  const [dbLeaderboard, setDbLeaderboard] = useState<DBPlayer[]>([]);
  const [dbSeasonLeaderboard, setDbSeasonLeaderboard] = useState<DBPlayer[]>([]);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      const { data: allData, error: errAll } = await supabase
        .from('user_stats')
        .select('id, email, points, tac_points, display_name, avatar_url')
        .order('points', { ascending: false })
        .limit(20);

      if (!errAll && allData) {
        const formattedAll = allData.map((user: any) => {
          const emailFallback = user.email ? user.email.split('@')[0] : t("player_fallback");
          const finalName = user.display_name && user.display_name.trim() !== "" 
            ? user.display_name 
            : emailFallback;

          return {
            id: user.id,
            name: finalName,
            score: user.points || 0,
            tacPoints: user.tac_points || 0,
            avatar_url: user.avatar_url 
          };
        });
        setDbLeaderboard(formattedAll);
      }

      const { data: seasonData, error: errSeason } = await supabase
        .from('user_stats')
        .select('id, email, points, tac_points, display_name, avatar_url')
        .order('tac_points', { ascending: false })
        .limit(20);

      if (!errSeason && seasonData) {
        const formattedSeason = seasonData.map((user: any) => {
          const emailFallback = user.email ? user.email.split('@')[0] : t("player_fallback");
          const finalName = user.display_name && user.display_name.trim() !== "" 
            ? user.display_name 
            : emailFallback;

          return {
            id: user.id,
            name: finalName,
            score: user.tac_points || 0, 
            tacPoints: user.tac_points || 0,
            avatar_url: user.avatar_url 
          };
        });
        setDbSeasonLeaderboard(formattedSeason);
      }
    };

    fetchLeaderboards();
  }, []);

  const { points: totalPoints, addPoints } = usePoints();
  const { user, signOut } = useAuth();
  
  const [dbProfile, setDbProfile] = useState<{ display_name?: string, avatar_url?: string, tac_points?: number } | null>(null);

  useEffect(() => {
    if (user?.id) {
      const fetchDbProfile = async () => {
        const { data } = await supabase
          .from('user_stats')
          .select('display_name, avatar_url, tac_points')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setDbProfile(data);
        }
      };
      fetchDbProfile();
    } else {
      setDbProfile(null);
    }
  }, [user]);

  const finalUserName = dbProfile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gast";
  const finalAvatarUrl = dbProfile?.avatar_url || user?.user_metadata?.avatar_url;
  
  const { 
    lockedLevels, 
    setLockedLevels, 
    highestScores, 
    updateHighScore,
    activeSession,
    saveActiveSession,
    clearActiveSession,
    isProgressLoaded
  } = useProgress();

  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [level, setLevel] = useState<Level>("Schlag");
  
  const isSimulation = (level as string) === "Simulation";
  const maxScore = level === "Spielzug" ? 50 : 10;

  const [[currentScenarioIndex, rotationPool], setRotation] = useState<[number, number[]]>(() => {
    const initialCount = SCENARIOS.filter(s => s.id <= 10).length; 
    const pool = shuffleIndices(initialCount);
    return [pool[0], pool.slice(1)];
  });

  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLaufZone, setSelectedLaufZone] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0); 
  const [attempts, setAttempts] = useState<number>(0); 
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [wrongPool, setWrongPool] = useState<number[]>([]);
  const [isRetryPhase, setIsRetryPhase] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const [masteredShots, setMasteredShots] = useState<Set<string>>(new Set());

  const [easyMode, setEasyMode] = useState(true);
  const [correctionMode, setCorrectionMode] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [hasRestored, setHasRestored] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const activeEasyMode = level === "Schlag" ? false : easyMode;
  const activeCorrectionMode = level === "Schlag" ? false : correctionMode;

  const isProgressionUnlocked = (l: string) => {
    if (l === "Schlag") return true;
    if (l === "Schlagrichtung") return (highestScores["Schlag"] || 0) >= 10;
    if (l === "Laufrichtung") return (highestScores["Schlagrichtung"] || 0) >= 10;
    if (l === "Spielzug") return (highestScores["Laufrichtung"] || 0) >= 10;
    return true; 
  };

  useEffect(() => {
    const handleGuestUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        localStorage.removeItem("tacpadel_savegame");
        localStorage.removeItem("tacpadel_tour_stamina");
        localStorage.removeItem("tacpadel_score");
        localStorage.removeItem("tacpadel_tac_points");
        clearActiveSession();
      }
    };
    window.addEventListener("beforeunload", handleGuestUnload);
    return () => window.removeEventListener("beforeunload", handleGuestUnload);
  }, [clearActiveSession]);

  useEffect(() => {
    if (user && !user.user_metadata?.display_name) {
      const hasSeen = sessionStorage.getItem('hasSeenWelcome');
      if (!hasSeen) {
        setShowWelcome(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "trainer") {
      const hasSeen = localStorage.getItem('tacpadel_hasSeenTrainerTutorial');
      if (!hasSeen) {
        setShowTutorial(true);
      }
    }
  }, [activeTab]);

  const handleWelcomeComplete = () => {
    sessionStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
  };

  const handleTutorialComplete = () => {
    localStorage.setItem('tacpadel_hasSeenTrainerTutorial', 'true');
    setShowTutorial(false);
  };

  const initPoolForLevel = (targetLevel: Level) => {
    const isNewSim = (targetLevel as string) === "Simulation";
    const filteredPool = SCENARIOS.filter(s => {
      if (targetLevel === "Schlag") return s.id <= 10;
      if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30; 
      if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
      if (targetLevel === "Spielzug") return s.id >= 62;
      if (isNewSim) return true; 
      return true;
    });

    if (isNewSim) {
      const randomScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      const globalIndex = SCENARIOS.findIndex(s => s.id === randomScenario.id);
      setRotation([globalIndex, []]);
    } else {
      const allIndices = shuffleIndices(filteredPool.length);
      const maxQ = targetLevel === "Spielzug" ? 50 : 10; 
      const limitedIndices = allIndices.slice(0, maxQ);
      setRotation([limitedIndices[0], limitedIndices.slice(1)]);
    }
  };

  useEffect(() => {
    if (isProgressLoaded && !hasRestored) {
      const syncedLocks = new Set<Level>(lockedLevels);

      if ((highestScores["Spielzug"] || 0) < 50) {
        syncedLocks.add("Simulation");
      } else {
        syncedLocks.delete("Simulation");
      }

      const isCurrentlyReplayingUnlocked =
        activeSession &&
        activeSession.score > 0 &&
        activeSession.score < 10 &&
        !lockedLevels.includes(activeSession.level);

      (["Schlag", "Schlagrichtung", "Laufrichtung"] as Level[]).forEach((lvl) => {
        if ((highestScores[lvl] || 0) >= 10) {
          if (!(isCurrentlyReplayingUnlocked && activeSession?.level === lvl)) {
            syncedLocks.add(lvl);
          }
        }
      });

      const finalLocks = Array.from(syncedLocks);
      if (
        finalLocks.length !== lockedLevels.length ||
        finalLocks.some((l) => !lockedLevels.includes(l))
      ) {
        setLockedLevels(finalLocks);
      }

      const hasValidActiveSession =
        activeSession &&
        user &&
        !(
          activeSession.level !== "Spielzug" &&
          activeSession.level !== "Simulation" &&
          finalLocks.includes(activeSession.level) &&
          (activeSession.score || 0) === 0
        );

      if (hasValidActiveSession) {
        setLevel(activeSession.level);
        setScore(activeSession.score);
        setRotation([activeSession.currentScenarioIndex, activeSession.rotationPool]);
        setWrongPool(activeSession.wrongPool || []);
        setIsRetryPhase(activeSession.isRetryPhase || false);
        setRoundsPlayed(activeSession.roundsPlayed || 0);
        setHasSubmitted(activeSession.hasSubmitted || false);
        setSelectedShot(activeSession.selectedShot || null);
        setSelectedZone(activeSession.selectedZone || null);
        setSelectedLaufZone(activeSession.selectedLaufZone || null);
        setAttempts(activeSession.attempts || 0);
        setFeedbackMsg(activeSession.feedbackMsg || null);
      } else {
        const targetLvl = getTargetProgressionLevel(highestScores, finalLocks);
        setLevel(targetLvl);
        initPoolForLevel(targetLvl);
        if (!user) {
          clearActiveSession();
        }
      }

      setHasRestored(true);
    }
  }, [isProgressLoaded, activeSession, hasRestored, user, highestScores, lockedLevels, setLockedLevels, clearActiveSession]);

  useEffect(() => {
    if (hasRestored && user && !gameOver) {
      saveActiveSession({
        level, 
        score, 
        currentScenarioIndex, 
        rotationPool, 
        wrongPool,
        isRetryPhase, 
        roundsPlayed, 
        hasSubmitted, 
        selectedShot,
        selectedZone, 
        selectedLaufZone, 
        attempts,
        feedbackMsg
      });
    }
    if (gameOver && hasRestored) {
      clearActiveSession();
    }
  }, [level, score, hasSubmitted, currentScenarioIndex, hasRestored, user, gameOver]);

  useEffect(() => {
    if (user && activeTab === "login") {
      const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;
      
      if (savedTab && savedTab !== "login") {
        setActiveTab(savedTab);
      } else {
        setActiveTab("home");
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    const channel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setDbLeaderboard(prev => prev.map(p => 
          p.id === payload.new.id ? { ...p, score: payload.new.score } : p
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const isNativeApp = Capacitor.isNativePlatform();

    const handleDeepLink = async (url: string) => {
      if (url.includes('access_token=') || url.includes('code=')) {
        if (isNativeApp) {
          try { await Browser.close(); } catch (e) {} 
        }
        
        const hashPart = url.includes('#') ? url.split('#')[1] : '';
        const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';

        const hashParams = new URLSearchParams(hashPart);
        const queryParams = new URLSearchParams(queryPart);

        const code = queryParams.get('code') || hashParams.get('code');
        const access_token = hashParams.get('access_token') || queryParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        try {
          if (code) {
             const { error } = await supabase.auth.exchangeCodeForSession(code);
             if (error) throw error;
          } else if (access_token && refresh_token) {
             const { error } = await supabase.auth.setSession({ access_token, refresh_token });
             if (error) throw error;
          }
        } catch (e: any) {
          console.error("Fehler bei Session: " + e.message);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (isNativeApp) {
          try { Browser.close(); } catch (e) {} 
        }
        
        setTimeout(() => {
          const savedTab = localStorage.getItem("tacpadel_activeTab") as Tab;
          
          if (savedTab && savedTab !== "login") {
            setActiveTab(savedTab);
          } else {
            setActiveTab("home");
          }
        }, 800);
      }
    });

    let appListener: any;
    
    if (isNativeApp) {
      CapacitorApp.addListener('appUrlOpen', (event) => {
        handleDeepLink(event.url);
      }).then(listener => { appListener = listener; });

      CapacitorApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl?.url) handleDeepLink(launchUrl.url);
      });
    }

    return () => {
      if (appListener) appListener.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    const isNative = Capacitor.isNativePlatform();

    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      }
    });

    if (error) {
      setAuthMsg({ type: 'error', text: t("login_err_google") + error.message });
      return;
    }

    if (data?.url) {
      if (isNative) {
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    }
  };

  const handleAppleLogin = async () => {
    const isNative = Capacitor.isNativePlatform();

    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      }
    });

    if (error) {
      setAuthMsg({ type: 'error', text: t("login_err_apple") + error.message });
      return;
    }

    if (data?.url) {
      if (isNative) {
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMsg(null);

    const isNative = Capacitor.isNativePlatform();
    const redirectUrl = isNative
      ? 'tacpadel://callback/'
      : window.location.origin;

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });
      if (error) {
        setAuthMsg({ type: 'error', text: error.message });
      } else {
        setAuthMsg({ type: 'success', text: t("login_success_signup") });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMsg({ type: 'error', text: t("login_err_credentials") });
      }
    }
    setAuthLoading(false);
  };

  const filteredScenarios = useMemo(() => {
    if (level === "Schlag") return SCENARIOS.filter(s => s.id <= 10);
    if (level === "Schlagrichtung") return SCENARIOS.filter(s => s.id >= 1 && s.id <= 30);
    if (level === "Laufrichtung") return SCENARIOS.filter(s => s.id >= 31 && s.id <= 61);
    if (level === "Spielzug") return SCENARIOS.filter(s => s.id >= 62);
    if (isSimulation) return SCENARIOS; 
    return SCENARIOS; 
  }, [level, isSimulation]);

  const scenario = filteredScenarios[currentScenarioIndex] || filteredScenarios[0];

  const scenarioDescription =
    (lang === "en" && (scenario as any)?.description_en) ||
    (lang === "es" && (scenario as any)?.description_es) ||
    scenario.description;

  const scenarioExplanation =
    (lang === "en" && (scenario as any)?.explanation_en) ||
    (lang === "es" && (scenario as any)?.explanation_es) ||
    scenario.explanation;

  const visibleShots = useMemo(() => {
    if (level === "Schlag") {
      const correctShot = scenario.validShots[0];
      const otherShots = SHOTS.filter(s => s !== correctShot);
      const shuffledOthers = otherShots.sort(() => Math.random() - 0.5);
      const reducedShots = [correctShot, ...shuffledOthers.slice(0, 2)].sort(() => Math.random() - 0.5);
      return reducedShots;
    }
    return SHOTS;
  }, [level, scenario]);

  const acceptableZones = useMemo(() => {
    if (!scenario || !activeEasyMode || !scenario.bestZones) return [];
    let neighbors: string[] = [];
    scenario.bestZones.forEach((zone) => {
      neighbors.push(...getAdjacentZones(zone));
    });
    return Array.from(new Set(neighbors)).filter(z => !scenario.bestZones.includes(z));
  }, [scenario, activeEasyMode]);

  const acceptableLaufZones = useMemo(() => {
    if (!scenario || !scenario.laufZone || !activeEasyMode) return [];
    const neighbors = getAdjacentZones(scenario.laufZone);
    return neighbors.filter(z => z !== scenario.laufZone);
  }, [scenario, activeEasyMode]);

  const handleShotClick = (shot: string) => {
    if (hasSubmitted) return;
    setSelectedShot((prev) => (prev === shot ? null : shot));
    setFeedbackMsg(null);
  };

  const handleZoneClick = (zoneId: string) => {
    if (hasSubmitted) return;
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
    setFeedbackMsg(null);
  };

  const handleLaufZoneClick = (zoneId: string) => {
    if (hasSubmitted) return;
    if (level === "Schlag" || level === "Schlagrichtung") return;
    setSelectedLaufZone((prev) => (prev === zoneId ? null : zoneId));
    setFeedbackMsg(null);
  };

  const isShotCorrect = !!(
    selectedShot &&
    scenario.validShots.some(
      (valid) =>
        valid === selectedShot ||
        (selectedShot === "LOB" && valid.includes("LOB")) ||
        (selectedShot === "VOLLEY" && valid.includes("VOLLEY"))
    )
  );
  
  const isZoneCorrect = !!(selectedZone && ((scenario.bestZones || []).includes(selectedZone) || acceptableZones.includes(selectedZone)));
  const isLaufZoneCorrect = !!(selectedLaufZone && (scenario.laufZone === selectedLaufZone || acceptableLaufZones.includes(selectedLaufZone)));

  const canSubmit = (() => {
    if (hasSubmitted) return false;
    if (!selectedShot) return false;
    if (level === "Schlagrichtung" && !selectedZone) return false;
    if (level === "Laufrichtung" && !selectedLaufZone) return false; 
    if ((level === "Spielzug" || isSimulation) && (!selectedZone || !selectedLaufZone)) return false;
    return true;
  })();

  const isFullyCorrect = (() => {
    if (level === "Schlag") return isShotCorrect;
    if (level === "Schlagrichtung") return isShotCorrect && isZoneCorrect;
    if (level === "Laufrichtung") return isShotCorrect && isLaufZoneCorrect; 
    if (level === "Spielzug" || isSimulation) return isShotCorrect && isZoneCorrect && isLaufZoneCorrect;
    return false;
  })();

  const isPartiallyCorrect = !isFullyCorrect && (isShotCorrect || isZoneCorrect || isLaufZoneCorrect);

  const handleSubmit = () => {
    if (!canSubmit) return;
    
    const currentAttempt = attempts + 1;
    setAttempts(currentAttempt);

    if (isFullyCorrect) {
      setHasSubmitted(true);
      
      const newScore = score + 1;
      setScore(newScore);
      updateHighScore(level, newScore);

      setRoundsPlayed((r) => r + 1);
      setFeedbackMsg(null);

      let pointsEarned = 0;
      if (level === "Schlag") {
        pointsEarned = 100;
      } else if (level !== "Spielzug" && !isSimulation) {
        if (activeEasyMode && activeCorrectionMode) pointsEarned = 25;
        else if (activeEasyMode || activeCorrectionMode) pointsEarned = 50;
        else pointsEarned = 100;
      } else {
        if (activeEasyMode && activeCorrectionMode) {
          pointsEarned = 25;
        } else if (activeCorrectionMode) {
          pointsEarned = 50; 
        } else if (activeEasyMode) {
          pointsEarned = 75;
        } else {
          pointsEarned = 100; 
        }
      }
      
      if (user) {
        const newTotal = totalPoints + pointsEarned;
        addPoints(pointsEarned);
        updateSupabaseScore(newTotal);
      }

      if (level === "Schlag" && scenario.validShots.length === 1) {
        setMasteredShots((prev) => new Set([...prev, scenario.validShots[0]]));
      }
    } else {
      if ((level === "Spielzug" || isSimulation) && !activeCorrectionMode && user) {
        const newTotal = totalPoints - 100;
        addPoints(-100); 
        updateSupabaseScore(newTotal); 
        
        const unlockable = lockedLevels.filter(l => l !== "Simulation");
        if (newTotal < 2500 && unlockable.length > 0) {
          setShowUnlockModal(true);
        }
      }
        
      if (activeCorrectionMode) {
        let errors = [];
        if (!isShotCorrect) errors.push(t("trainer_err_shot"));
        if ((level === "Schlagrichtung" || level === "Spielzug" || isSimulation) && !isZoneCorrect) errors.push(t("trainer_err_target"));
        if ((level === "Laufrichtung" || level === "Spielzug" || isSimulation) && !isLaufZoneCorrect) errors.push(t("trainer_err_run"));
        
        setFeedbackMsg(`${t("trainer_feedback_prefix")}${errors.join(t("trainer_err_and"))}.`);
      } else {
        setHasSubmitted(true);
        setWrongPool((prev) => [...prev, currentScenarioIndex]);
        setRoundsPlayed((r) => r + 1);
      }
    }
  };

  const nextRound = () => {
    if (isSimulation) {
      const randomScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      const globalIndex = SCENARIOS.findIndex(s => s.id === randomScenario.id);

      setSelectedShot(null);
      setSelectedZone(null);
      setSelectedLaufZone(null);
      setHasSubmitted(false);
      setFeedbackMsg(null);
      setAttempts(0);

      setRotation([globalIndex, []]);
      return;
    }

    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setFeedbackMsg(null);
    setAttempts(0);

    const targetScore = level === "Spielzug" ? 50 : 10;

    if (score < targetScore && rotationPool.length > 0) {
      setRotation([rotationPool[0], rotationPool.slice(1)]);
      return;
    }

    if (score < targetScore && wrongPool.length > 0) {
      const retryIndices = shuffleIndices(wrongPool.length).map((i) => wrongPool[i]);
      const [next, ...rest] = retryIndices; 
      
      setRotation([next, rest]);
      setWrongPool([]); 
      setIsRetryPhase(true);
      setShowRetryBanner(true);
      return;
    }

    if (score < targetScore) {
      const needed = targetScore - score;
      const freshIndices = shuffleIndices(filteredScenarios.length, currentScenarioIndex).slice(0, needed);
      setRotation([freshIndices[0], freshIndices.slice(1)]);
      return;
    }

    updateHighScore(level, targetScore);
    setGameOver(true);
    
    if (level === "Spielzug") {
      setLockedLevels(prev => prev.filter(l => l !== "Simulation"));
    } else if (level === "Schlag" || level === "Schlagrichtung" || level === "Laufrichtung") {
      setLockedLevels(prev => prev.includes(level) ? prev : [...prev, level]);
    }
  };

  const handleLevelChange = (newLevel: Level, force: boolean = false) => {
    if (newLevel === level && !force && !gameOver) return;
    clearActiveSession();
    setLevel(newLevel);
    initPoolForLevel(newLevel);
    
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setHasSubmitted(false);
    setScore(0);
    setRoundsPlayed(0);
    setWrongPool([]);
    setIsRetryPhase(false);
    setGameOver(false);
    setShowRetryBanner(false);
    setFeedbackMsg(null);
    setAttempts(0); 
  };

  const handleLogout = async () => {
    await signOut(); 
    localStorage.clear();
    sessionStorage.clear();
    clearActiveSession();
    setLevel("Schlag");
    setScore(0);
    setAttempts(0);
    setRoundsPlayed(0);
    setHasSubmitted(false);
    setSelectedShot(null);
    setSelectedZone(null);
    setSelectedLaufZone(null);
    setGameOver(false);
    setIsRetryPhase(false);
    setFeedbackMsg(null);
    setWrongPool([]);
    window.location.reload(); 
  };

  const isNative = Capacitor.isNativePlatform();
  const isIOS = Capacitor.getPlatform() === "ios";

  return (
  <div className="min-h-[100dvh] w-full text-foreground flex flex-col items-center font-sans relative">
    
    {/* OPTISCHE STATUSLEISTEN-TRENNUNG FÜR NATIVE APPS (Kompakt auf 24px für Android, ohne z-50 Blockade) */}
    {isNative && (
      <div 
        className="w-full bg-[#010206] border-b border-slate-900/80 shrink-0 z-10"
        style={{ 
          height: isIOS 
            ? "max(env(safe-area-inset-top, 0px), 44px)" 
            : "max(env(safe-area-inset-top, 0px), 24px)" 
        }}
      />
    )}

    <header className="w-full max-w-4xl flex justify-between items-center px-4 py-2.5 z-10 bg-background/50 backdrop-blur-md border-b border-border/40 shrink-0">
      <span className="font-black text-lg tracking-wider text-primary">TacPadel</span>
      <div>
        {user ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab("profile")}
              className="text-muted-foreground hover:text-primary transition-colors font-semibold flex items-center gap-2.5 group"
            >
              {finalAvatarUrl ? (
                <img 
                  src={finalAvatarUrl} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full object-cover border border-primary/20 group-hover:border-primary/50 transition-colors shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  👤
                </div>
              )}

              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {finalUserName === "Gast" ? t("guest_name") : finalUserName}
              </span>
            </button>

            <button 
              onClick={handleLogout} 
              className="text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg font-bold hover:bg-red-500/20 transition-all ml-2"
            >
              {t("header_logout")}
            </button>
          </div>
        ) : (
          activeTab !== "login" && (
            <button 
              onClick={() => setActiveTab("login")} 
              className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              {t("header_login")}
            </button>
          )
        )}
      </div>
    </header>

      {/* Hintergrundbild */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-40 mix-blend-screen">
        <img 
          src={"/background_app.png"} 
          alt="Tactical Background" 
          className="w-[95%] max-w-2xl h-auto object-contain select-none"
        />
      </div>
      <SplashScreen />

      {/* --- PUBLIC PROFILE MODAL --- */}
      <AnimatePresence>
        {selectedPublicUserId && (
          <PublicProfileModal
            userId={selectedPublicUserId}
            defaultTab={selectedPublicUserTab}
            onClose={() => setSelectedPublicUserId(null)}
          />
        )}
      </AnimatePresence>

      {/* --- UNLOCK MODAL --- */}
      <AnimatePresence>
        {showUnlockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-12 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-card-border p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">📉</span>
              </div>
              <h2 className="text-2xl font-bold text-destructive">{t("unlock_title")}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t("unlock_desc")}
              </p>
              <div className="flex flex-col gap-3 mt-4">
                {lockedLevels.filter(lvl => lvl !== "Simulation").map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setLockedLevels(prev => prev.filter(l => l !== lvl));
                      setShowUnlockModal(false);
                      handleLevelChange(lvl, true);
                    }}
                    className="px-4 py-3.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow flex items-center justify-between"
                  >
                    <span>{formatLevelName(lvl, lang)}</span>
                    <span className="text-emerald-400">{t("unlock_btn")}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- WILLKOMMENS MODAL --- */}
      <AnimatePresence>
        {showWelcome && user && (
          <WelcomeModal user={user} onComplete={handleWelcomeComplete} />
        )}
      </AnimatePresence>

      {/* --- TUTORIAL MODAL --- */}
      <AnimatePresence>
        {showTutorial && (
          <TutorialModal onComplete={handleTutorialComplete} />
        )}
      </AnimatePresence>
        
      {/* Tech-Shell (Ohne z-10 Stacking-Trap, damit Modals & Banner frei über dem Header liegen können) */}
      <div className="flex-grow w-full tech-shell flex flex-col items-center p-3 sm:p-4 pb-28 lg:p-8 rounded-none border-x-0 sm:rounded-xl sm:border-x bg-transparent">
        
        <div className="max-w-4xl w-full flex flex-col gap-4 sm:gap-6">

          <AnimatePresence mode="wait">
            
            {/* --- TAB 1: HOME --- */}
            {activeTab === "home" && (
              <motion.div 
                key="home" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <HomeView 
                  setActiveTab={setActiveTab} 
                  currentScore={user ? totalPoints : 0}
                  onDailyReward={(pts) => { if (user) { addPoints(pts); updateSupabaseScore(totalPoints + pts); } }}
                  currentTacPoints={user ? (dbProfile?.tac_points || 0) : 0} 
                  userName={finalUserName}
                  userEmail={user?.email || ""}
                  userAvatar={finalAvatarUrl} 
                  dbLeaderboard={dbLeaderboard.length > 0 ? dbLeaderboard : undefined}
                  dbSeasonLeaderboard={dbSeasonLeaderboard.length > 0 ? dbSeasonLeaderboard : undefined} 
                  onPlayerClick={(id, listType) => {
                    setSelectedPublicUserId(id);
                    setSelectedPublicUserTab(listType === "season" ? "tournament" : "single");
                  }}
                  onQuickStart={(specificIndex?: number) => {
                    if ((highestScores["Spielzug"] || 0) >= 50) {
                      handleLevelChange("Simulation" as Level, true);
                      setActiveTab("trainer");
                      return;
                    }

                    if (typeof specificIndex === 'number') {
                      const targetScenario = SCENARIOS[specificIndex];
                      
                      let targetLevel: Level = "Schlag";
                      if (targetScenario.id >= 62) targetLevel = "Spielzug";
                      else if (targetScenario.id >= 31) targetLevel = "Laufrichtung";
                      else if (targetScenario.id >= 11) targetLevel = "Schlagrichtung";

                      setLevel(targetLevel);
                      
                      const filteredPool = SCENARIOS.filter(s => {
                        if (targetLevel === "Schlag") return s.id <= 10;
                        if (targetLevel === "Schlagrichtung") return s.id >= 1 && s.id <= 30;
                        if (targetLevel === "Laufrichtung") return s.id >= 31 && s.id <= 61;
                        if (targetLevel === "Spielzug") return s.id >= 62;
                        return true;
                      });

                      const localIndex = filteredPool.findIndex(s => s.id === targetScenario.id);
                      
                      if (localIndex !== -1) {
                        const allIndices = shuffleIndices(filteredPool.length);
                        const poolWithoutTarget = allIndices.filter(i => i !== localIndex);
                        const maxQuestions = targetLevel === "Spielzug" ? 50 : 10; 
                        const limitedIndices = [localIndex, ...poolWithoutTarget].slice(0, maxQuestions);
                        
                        setRotation([limitedIndices[0], limitedIndices.slice(1)]);
                      }

                      setSelectedShot(null);
                      setSelectedZone(null);
                      setSelectedLaufZone(null);
                      setHasSubmitted(false);
                      setScore(0);
                      setRoundsPlayed(0);
                      setWrongPool([]);
                      setIsRetryPhase(false);
                      setGameOver(false);
                      setShowRetryBanner(false);
                      setFeedbackMsg(null);
                      setAttempts(0);
                    } else {
                      const nextOpenLevel = getTargetProgressionLevel(highestScores, lockedLevels);
                      handleLevelChange(nextOpenLevel, true);
                    }
                    setActiveTab("trainer");
                  }}
                />
              </motion.div>
            )}

            {/* --- NEUER TAB: STRATEGIE MODUS --- */}
            {activeTab === "strategy" && (
              <motion.div
                key="strategy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-[1400px] mx-auto"
              >
                <StrategyTrainer 
                  onBack={() => setActiveTab("trainer")}
                  onStrategyComplete={(points) => {
                    if (user) {
                      const newTotal = totalPoints + points;
                      addPoints(points);
                      updateSupabaseScore(newTotal);
                    }
                  }}
                />
              </motion.div>
            )}

            {/* --- BASICS --- */}
            {activeTab === "basics" && (
              <BasicsView setActiveTab={setActiveTab} />
            )}

            {/* --- TRAINER TAB --- */}
            {activeTab === "trainer" && (
              <motion.div
                key="trainer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[1400px] mx-auto flex flex-col gap-4 text-slate-200 font-sans select-none pb-18"
              >
                {/* 1. MASTER DASHBOARD */}
                <div className="w-full bg-[#040914]/90 border border-orange-900/50 backdrop-blur-md p-4 lg:p-5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden mt-2">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/80 to-transparent" />
                  
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                    <div className="flex items-center justify-between lg:justify-start lg:gap-8 w-full lg:w-auto">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm lg:text-base font-bold text-orange-500 tracking-widest uppercase">{t("trainer_title")}</span>
                          <button 
                            onClick={() => setShowTutorial(true)}
                            className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-700 hover:text-white transition-colors"
                            title={t("trainer_tutorial_tooltip")}
                          >
                            ❓
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end lg:items-start pl-4 lg:pl-6 lg:border-l border-slate-700/50">
                        <span className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-0.5">{t("trainer_total_score")}</span>
                        <div className="text-xl lg:text-2xl leading-none font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                          {user ? totalPoints : 0}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 w-full lg:w-auto pt-3 lg:pt-0 border-t border-slate-800 lg:border-none">
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap">
                        
                        {(highestScores["Spielzug"] || 0) < 50 ? (
                          (["Schlag", "Schlagrichtung", "Laufrichtung", "Spielzug"] as const).map((lvl) => {
                            const isPenaltyLocked = lockedLevels.includes(lvl as any) && lvl !== "Spielzug";
                            const isProgLocked = !isProgressionUnlocked(lvl);
                            const isLocked = isPenaltyLocked || isProgLocked;
                            const isActive = level === lvl;
                            return (
                              <button
                                key={lvl}
                                onClick={() => !isLocked && handleLevelChange(lvl as any)}
                                disabled={isLocked}
                                className={`flex items-center justify-center lg:justify-between gap-2 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                  isActive 
                                    ? "bg-cyan-950/60 border border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]" 
                                    : isLocked 
                                      ? "bg-slate-900/50 border border-slate-800/50 text-slate-600 cursor-not-allowed" 
                                      : "bg-slate-900/30 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <span>{formatLevelName(lvl, lang)}</span>
                                {isLocked && <span className="text-slate-600">🔒</span>}
                              </button>
                            );
                          })
                        ) : (
                          <button
                            onClick={() => handleLevelChange("Simulation" as Level)}
                            className={`col-span-2 sm:col-span-4 lg:w-auto px-4 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                              isSimulation
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-purple-400 animate-pulse"
                                : "bg-purple-950/40 border border-purple-800 text-purple-300 hover:bg-purple-900/60"
                            }`}
                          >
                            <span>{t("trainer_pro_rallye")}</span>
                          </button>
                        )}

                        <button
                          onClick={() => setActiveTab("strategy")}
                          className="col-span-2 sm:col-span-4 lg:w-auto px-4 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-pink-400 hover:scale-105"
                        >
                          <span>{t("trainer_strategies")}</span>
                        </button>
                      </div>
                    </div>

                      {!gameOver && level !== "Schlag" && (
                        <div className="flex gap-2 w-full lg:w-auto pt-3 lg:pt-0 lg:pl-4 lg:border-l border-slate-700/50">
                          <button
                            onClick={() => setEasyMode(!easyMode)}
                            className={`flex-1 lg:px-4 py-2.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${
                              easyMode ? 'bg-amber-500/90 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-slate-900/50 border border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Easy {easyMode ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => { setCorrectionMode(!correctionMode); setFeedbackMsg(null); }}
                            className={`flex-1 lg:px-4 py-2.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${
                              correctionMode ? 'bg-blue-600/90 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-900/50 border border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Trainer {correctionMode ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      )}
                    </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-start gap-3">
                    <div className="flex flex-col w-full">
                      <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                        {isSimulation ? t("trainer_hint_sim") : 
                         level === "Spielzug" ? t("trainer_hint_spielzug") : 
                         level === "Laufrichtung" ? t("trainer_hint_lauf") : 
                         level === "Schlag" ? t("trainer_hint_schlag") :
                         t("trainer_hint_default")}
                      </p>

                      <div className="flex flex-col items-start">
                        {feedbackMsg && !hasSubmitted ? (
                          <div className="text-[10px] font-bold text-red-400 px-2 py-1 bg-red-950/30 border border-red-900/50 rounded animate-pulse">
                            ⚠️ {feedbackMsg}
                          </div>
                        ) : (activeEasyMode || activeCorrectionMode) && level !== "Schlag" ? (
                          <div className="text-[10px] text-cyan-300 font-semibold flex flex-wrap gap-1.5 items-center bg-cyan-950/20 px-2 py-1 rounded border border-cyan-900/30">
                            {activeEasyMode && <span>{t("trainer_easy_info")}</span>}
                            {activeEasyMode && activeCorrectionMode && <span className="text-slate-600 font-normal">|</span>}
                            {activeCorrectionMode && <span>{t("trainer_corr_info")}</span>}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* MOBILE BRIEFING */}
                <div className="lg:hidden w-full bg-[#050b18]/80 border border-slate-800 rounded-xl p-4 shadow-lg mt-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">{t("trainer_scenario_label")} {scenario.id}</h3>
                    <span className="text-[10px] font-bold text-slate-500">{formatLevelName(level, lang)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 leading-snug mb-4">{scenarioDescription}</p>
                  
                  <div className="mt-auto pt-3 border-t border-slate-800/50">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                        {isSimulation ? t("trainer_progress_sim") : t("trainer_progress_lvl")}
                      </span>
                      <span className="text-xs font-black text-white">
                        {isSimulation ? `Score: ${score}` : `${score} / ${maxScore}`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full shadow-[0_0_8px_rgba(6,182,212,0.8)] ${isSimulation ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: isSimulation ? "100%" : `${(score / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* CORE WORKSPACE */}
                <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-5 items-start">
                  
                  <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 order-3 lg:order-1 w-full h-full">
                    <div className="flex flex-col bg-[#050b18]/80 border border-slate-800 rounded-xl p-5 shadow-lg relative h-full">
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 rounded-l-xl shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                      <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">{t("trainer_briefing")}</h3>
                      <div className="flex items-end gap-3 mb-4">
                        <span className="text-5xl font-black text-white leading-none">{scenario.id}</span>
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider pb-1">{formatLevelName(level, lang)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-8 flex-1">{scenarioDescription}</p>
                      
                      <div className="mt-auto">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                            {isSimulation ? t("trainer_progress_sim") : t("trainer_progress_lvl")}
                          </span>
                          <span className="text-xs font-black text-white">
                            {isSimulation ? `Score: ${score}` : `${score} / ${maxScore}`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full shadow-[0_0_8px_rgba(6,182,212,0.8)] ${isSimulation ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: isSimulation ? "100%" : `${(score / maxScore) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 order-1 lg:order-2 w-full h-[55vh] min-h-[450px] lg:h-[650px] bg-[#030611] rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden p-1 lg:p-2">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
                    
                    <div className="absolute inset-0 w-full h-full pb-1 lg:pb-2">
                      <ScenarioCourt25
                        level={level as any}
                        positions={{
                          you: scenario.positions.you,
                          partner: scenario.positions.partner,
                          opp1: scenario.positions.opp1,
                          opp2: scenario.positions.opp2,
                          ball: {
                            side: scenario.positions.ball.side as "left" | "right",
                            zone: scenario.positions.ball.zone,
                            type: selectedShot || "Schlag"
                          }
                        }}
                        selectedZone={selectedZone}
                        hasSubmitted={hasSubmitted}
                        bestZones={level === "Schlag" || level === "Laufrichtung" ? [] : (scenario.bestZones || [])}
                        acceptableZones={level === "Schlag" || level === "Laufrichtung" ? [] : acceptableZones}
                        onZoneClick={(zoneId: string) => { if (level !== "Schlag" && level !== "Laufrichtung") handleZoneClick(zoneId); }}
                        profiMode={level === "Spielzug" || level === "Laufrichtung" || isSimulation} 
                        selectedLaufZone={level === "Schlag" || level === "Schlagrichtung" ? null : selectedLaufZone}
                        perfectLaufZone={hasSubmitted ? (scenario.laufZone || null) : null}
                        acceptableLaufZones={level === "Schlag" || level === "Schlagrichtung" ? [] : acceptableLaufZones}
                        onLaufZoneClick={handleLaufZoneClick}
                        activeChar="you"
                        hitterId="you"
                        feedbackMsg={feedbackMsg} 
                      />
                    </div>
                  </div>
                </div>

                {/* ACTION BAR */}
                {!gameOver && !hasSubmitted && (
                  <div className="fixed bottom-20 lg:sticky lg:bottom-4 left-4 right-4 lg:left-auto lg:right-auto z-40 w-auto lg:w-full bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-3 lg:p-4 rounded-xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] mt-2">
                    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-center">
                      <div className="grid grid-cols-3 gap-2 lg:gap-4 flex-1 w-full">
                        
                        <div className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-colors ${level === "Spielzug" || level === "Laufrichtung" || isSimulation ? (selectedLaufZone ? 'border-purple-500/50 bg-purple-950/20' : 'border-purple-500/30 bg-purple-950/10 shadow-[inset_0_0_15px_rgba(168,85,247,0.1)]') : 'border-slate-800/50 bg-slate-900/20 opacity-40'}`}>
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-purple-400 uppercase">{t("trainer_step1_run")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">{level !== "Spielzug" && level !== "Laufrichtung" && !isSimulation ? "-" : selectedLaufZone ? selectedLaufZone : "-"}</span>
                        </div>         
                        
                        <div className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-colors ${level !== "Schlag" && level !== "Laufrichtung" ? (selectedZone ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-emerald-500/30 bg-emerald-950/10 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]') : 'border-slate-800/50 bg-slate-900/20 opacity-40'}`}>
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-emerald-400 uppercase">{t("trainer_step2_target")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">{level === "Schlag" || level === "Laufrichtung" ? "-" : selectedZone ? selectedZone : "-"}</span>
                        </div>
                        
                        <div 
                          onClick={() => setIsShotModalOpen(true)}
                          className={`flex flex-col gap-0.5 lg:gap-1 p-2 lg:p-2.5 rounded-lg border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${selectedShot ? 'border-orange-500/50 bg-orange-950/20' : 'border-orange-500/50 bg-orange-950/30 shadow-[0_0_15px_rgba(255,119,0,0.2)] animate-pulse'}`}
                        >
                          <span className="text-[8px] lg:text-[9px] font-black tracking-widest text-orange-400 uppercase">{t("trainer_step3_shot")}</span>
                          <span className="text-[10px] lg:text-xs font-bold text-white truncate">{selectedShot ? formatShotName(selectedShot, lang) : t("trainer_choose")}</span>
                        </div>
                      
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full lg:w-1/3 py-3 lg:py-5 bg-gradient-to-r from-cyan-600 to-cyan-600 hover:from-cyan-500 hover:to-cyan-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-white font-black text-xs lg:text-sm tracking-[0.2em] uppercase rounded-lg lg:rounded-xl shadow-[0_0_20px_rgba(255,119,0,0.3)] disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all duration-200 border border-cyan-400/50 disabled:border-slate-800"
                      >
                        {t("trainer_submit")}
                      </button>
                    </div>
                  </div>
                )}

                {/* SHOT MODAL */}
                <AnimatePresence>
                  {isShotModalOpen && (
                    <motion.div
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, info) => {
                        if (info.offset.y > 100) {
                          setIsShotModalOpen(false);
                        }
                      }}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-2xl z-[70] bg-[#050b18] border-t border-orange-900/50 p-6 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[85vh] touch-none"
                    >
                      <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-5 cursor-grab active:cursor-grabbing" />
                      
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-black tracking-widest text-orange-400 uppercase">
                          {level === "Schlag" ? t("trainer_shot_modal_q1") : t("trainer_shot_modal_q2")}
                        </h3>
                      </div>
                      
                      <div className={`grid gap-2 overflow-y-auto custom-scrollbar pb-10 ${level === "Schlag" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
                        {visibleShots.map((shot) => {
                          const isSelected = selectedShot === shot;
                          let btnStyle = isSelected 
                            ? "bg-orange-600/20 border-orange-500 text-orange-300 shadow-[0_0_10px_rgba(255,119,0,0.2)]" 
                            : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60";
                          
                          return (
                            <button
                              key={shot}
                              disabled={hasSubmitted}
                              onClick={() => {
                                handleShotClick(shot);
                                setIsShotModalOpen(false); 
                              }}
                              className={`w-full flex items-center justify-center py-4 px-1 rounded-lg border text-xs font-black tracking-wider uppercase transition-all duration-200 text-center ${btnStyle}`}
                            >
                              {formatShotName(shot, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* RESULT OVERLAY */}
                <AnimatePresence>
                  {hasSubmitted && !gameOver && (
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                      className="fixed bottom-10 lg:bottom-6 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-5xl z-50 bg-[#050b18]/95 backdrop-blur-xl border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.8)]"
                    >
                      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="flex-1 text-center md:text-left flex flex-col gap-2">
                          <h3 className={`text-xl font-black uppercase tracking-widest ${
                            isFullyCorrect ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                            isPartiallyCorrect ? "text-amber-400" : "text-red-500"
                          }`}>
                            {isFullyCorrect ? (level === "Spielzug" || isSimulation ? t("trainer_res_perfect_play") : t("trainer_res_success")) : 
                             isPartiallyCorrect ? t("trainer_res_partial") : t("trainer_res_wrong")}
                          </h3>
                          <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
                            {scenarioExplanation}
                          </p>
                          
                          <div className="flex gap-2 flex-wrap justify-center md:justify-start mt-1">
                            <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {t("trainer_badge_shot")} <span className="text-white">{scenario.validShots.map(s => formatShotName(s, lang)).join(" / ")}</span>
                            </span>
                            {(level === "Schlagrichtung" || level === "Spielzug" || isSimulation) && scenario.bestZones && (
                              <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {t("trainer_badge_target")} <span className="text-white">{scenario.bestZones.join(", ")}</span>
                              </span>
                            )}
                            {(level === "Laufrichtung" || level === "Spielzug" || isSimulation) && scenario.laufZone && (
                              <span className="bg-[#030611] border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {t("trainer_badge_run")} <span className="text-white">{scenario.laufZone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={nextRound}
                          className="w-full md:w-auto px-10 py-5 bg-white hover:bg-slate-200 text-black font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                        >
                          {t("trainer_next_task")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* GAME OVER */}
                <AnimatePresence>
                  {gameOver && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#050b18]/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-8 lg:p-10 flex flex-col items-center gap-6 text-center mt-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] mx-4 sm:mx-0"
                    >
                      <span className="text-6xl drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">🏆</span>
                      <div className="flex flex-col gap-1">
                        <h2 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-widest uppercase">
                          {t("trainer_mastered_title")}
                        </h2>
                        <p className="text-sm text-slate-400">
                          {t("trainer_mastered_desc_1")} <span className="font-bold text-white uppercase">{formatLevelName(level, lang)}</span> {t("trainer_mastered_desc_2")}
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          if (level === "Spielzug") {
                            setLockedLevels(prev => prev.filter(l => l !== "Simulation"));
                            handleLevelChange("Simulation" as Level, true);
                          } else {
                            const updatedLocks = lockedLevels.includes(level) ? lockedLevels : [...lockedLevels, level];
                            setLockedLevels(updatedLocks);

                            const updatedScores = { ...highestScores, [level]: Math.max(highestScores[level] || 0, 10) };
                            const currentIndex = TRAINER_SEQUENCE.indexOf(level);
                            let nextLevel: Level = "Spielzug";

                            for (let i = currentIndex + 1; i < TRAINER_SEQUENCE.length; i++) {
                              const candidate = TRAINER_SEQUENCE[i];
                              const isClosed = updatedLocks.includes(candidate) && candidate !== "Spielzug";
                              if (!isClosed) {
                                nextLevel = candidate;
                                break;
                              }
                            }

                            updateHighScore(level, updatedScores[level]);
                            handleLevelChange(nextLevel, true);
                          }
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white uppercase tracking-[0.2em] font-black text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 transition-all"
                      >
                        {level === "Spielzug" ? t("trainer_start_pro_rallye") : t("trainer_start_next_lvl")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}

            {/* LOGIN TAB */}
            {activeTab === "login" && (
              <motion.div
                key="login-page"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center justify-center p-6 sm:p-10 bg-card border border-card-border rounded-2xl shadow-2xl max-w-md mx-auto mt-12 gap-5 w-full"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary text-3xl">
                  🎾
                </div>
                
                <div className="text-center mb-2">
                  <h2 className="text-2xl font-black text-primary tracking-wide">
                    {isSignUp ? t("login_title_signup") : t("login_title_signin")}
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mt-2">
                    {t("login_subtitle")}
                  </p>
                </div>

                <AnimatePresence>
                  {authMsg && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`w-full p-3 rounded-lg text-xs font-bold text-center border ${authMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
                    >
                      {authMsg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder={t("login_email_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-background border border-border focus:border-primary rounded-xl text-foreground text-sm font-semibold outline-none transition-colors"
                  />
                  <input
                    type="password"
                    placeholder={t("login_password_placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-background border border-border focus:border-primary rounded-xl text-foreground text-sm font-semibold outline-none transition-colors"
                  />
                  
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full px-6 py-3.5 bg-primary text-primary-foreground rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {authLoading ? t("login_processing") : (isSignUp ? t("login_btn_signup") : t("login_btn_signin"))}
                  </button>
                </form>

                <div className="flex items-center w-full gap-3 my-2 opacity-50">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("login_or")}</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    onClick={handleAppleLogin}
                    type="button"
                    className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white text-black rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {t("login_with_apple")}
                  </button>

                  <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white text-black rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.52-1.14 2.81-2.42 3.68v3.05h3.91c2.28-2.1 3.61-5.19 3.61-8.58z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-3.05c-1.08.72-2.45 1.16-4.02 1.16-3.09 0-5.72-2.09-6.65-4.91H1.31v3.15C3.29 22.36 7.37 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.35 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.31C.47 8.24 0 10.06 0 12s.47 3.76 1.31 5.44l4.04-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 1.64 1.31 4.75l4.04 3.15c.93-2.82 3.56-4.91 6.65-4.91z"/>
                    </svg>
                    {t("login_with_google")}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 mt-4 w-full">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setAuthMsg(null); }}
                    className="text-xs text-muted-foreground hover:text-primary font-bold transition-colors"
                  >
                    {isSignUp ? t("login_switch_to_signin") : t("login_switch_to_signup")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("home")}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors mt-2"
                  >
                    {t("login_back_home")}
                  </button>
                </div>
              </motion.div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && user && (
              <ProfileTab key="profile-page" user={user} setActiveTab={(t) => setActiveTab(t as Tab)} />
            )}

            {/* GAME SCREEN (Ohne y-Transform, damit fixed-Modals und Banner nicht verschoben werden) */}
            {activeTab === "game" && (
              <motion.div
                key="game"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                <GameScreen />
              </motion.div>
            )}

            {/* TAKTIK BOARD */}
            {(activeTab === "board" || activeTab === "taktik") && (
              <motion.div
                key="board"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                <div className="bg-card border border-card-border p-4 rounded-xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-1">
                    {t("board_header_title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("board_header_desc")}
                  </p>
                </div>
                <TacticsBoard />
              </motion.div>
            )}

          </AnimatePresence>  
        </div>   
      </div>
      
      <Navigation activeTab={activeTab as any} setActiveTab={setActiveTab as any} />

    </div>
  );
}
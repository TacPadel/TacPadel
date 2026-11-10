import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { SCENARIOS } from "./Scenarios";
import DailyChallengeModal, { getTodayDateString } from "./DailyChallengeModal";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { useTranslation, TACTIC_TIPS_I18N } from "../lib/i18n";

export interface DBPlayer {
  id: string;
  name: string;
  score: number;
  avatar_url?: string;
}

interface HomeViewProps {
  setActiveTab: (tab: "home" | "trainer" | "taktik" | "basics" | "game") => void;
  onQuickStart: (scenarioIndex?: number) => void;
  currentScore?: number; 
  currentTacPoints?: number; 
  userName?: string; 
  userEmail?: string; 
  userAvatar?: string;
  dbLeaderboard?: DBPlayer[];
  dbSeasonLeaderboard?: DBPlayer[]; 
  onPlayerClick?: (id: string, listType?: "alltime" | "season") => void;
  onDailyReward?: (points: number) => void;
}

export default function HomeView({ 
  setActiveTab, 
  onQuickStart, 
  currentScore = 0, 
  currentTacPoints = 0,
  userName = "Gast",
  userEmail = "", 
  userAvatar = "",
  dbLeaderboard = [],
  dbSeasonLeaderboard = [],
  onPlayerClick,
  onDailyReward
}: HomeViewProps) {
  const { user } = useAuth();
  const { lang, t } = useTranslation();

  const displayUserName = userName === "Gast" ? t("guest_name") : userName;
  
  const [randomScenarioIndex] = useState(() => Math.floor(Math.random() * SCENARIOS.length));
  const previewScenario = SCENARIOS[randomScenarioIndex];
  
  const [dailyBonusAdded, setDailyBonusAdded] = useState(0);

  const displayScore = Math.floor(currentScore + dailyBonusAdded);
  const displayTacPoints = Math.floor(currentTacPoints);
  const isNewbie = displayScore === 0 && displayTacPoints === 0;
  
  const [tipIndex] = useState(() => Math.floor(Math.random() * TACTIC_TIPS_I18N.de.length));
  const dailyTip = TACTIC_TIPS_I18N[lang]?.[tipIndex] || TACTIC_TIPS_I18N.de[0];
  
  // --- DAILY CHALLENGE STATES ---
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<"open" | "won" | "lost">("open");
  const [dailyStreak, setDailyStreak] = useState<number>(0);

  const refreshDailyState = () => {
    const todayStr = getTodayDateString();
    const prefix = user?.id ? `_${user.id}` : "_guest";
    const savedDate = localStorage.getItem(`tacpadel_daily_date${prefix}`) || user?.user_metadata?.daily_date;
    const savedRes = localStorage.getItem(`tacpadel_daily_result${prefix}`) || user?.user_metadata?.daily_result;
    const savedStreak = parseInt(
      localStorage.getItem(`tacpadel_daily_streak${prefix}`) || user?.user_metadata?.daily_streak || "0",
      10
    );

    setDailyStreak(savedStreak);
    if (savedDate === todayStr) {
      setDailyStatus(savedRes === "won" ? "won" : "lost");
    } else {
      setDailyStatus("open");
    }
  };

  useEffect(() => {
    refreshDailyState();
  }, [user, isDailyModalOpen]);

  const handleRewardEarned = async (pts: number) => {
    setDailyBonusAdded((prev) => prev + pts);

    if (onDailyReward) {
      onDailyReward(pts);
    } else if (user) {
      const newTotal = Math.floor(currentScore + dailyBonusAdded + pts);
      localStorage.setItem("tacpadel_score", newTotal.toString());
      await supabase
        .from("user_stats")
        .upsert({ id: user.id, email: user.email, points: newTotal });
    }
    refreshDailyState();
  };

  const [lbTab, setLbTab] = useState<"alltime" | "season">("alltime");

  // --- ALL-TIME LEADERBOARD LOGIK ---
  const sortedLeaderboard = useMemo(() => {
    let playersList = (dbLeaderboard && dbLeaderboard.length > 0) ? [...dbLeaderboard] : [];
      
    const userIndex = playersList.findIndex(p => 
      p.name.toLowerCase() === userName.toLowerCase() || 
      (userEmail && p.name.toLowerCase() === userEmail.toLowerCase())
    );

    if (userIndex !== -1) {
      playersList[userIndex] = {
        ...playersList[userIndex],
        name: userName,
        score: Math.max(playersList[userIndex].score, displayScore),
        avatar_url: userAvatar || playersList[userIndex].avatar_url
      };
    } else {
      playersList.push({ id: "user", name: userName, score: displayScore, avatar_url: userAvatar });
    }

    return playersList.sort((a, b) => b.score - a.score);
  }, [dbLeaderboard, userName, userEmail, userAvatar, displayScore]);

  // --- SEASON LEADERBOARD LOGIK ---
  const sortedSeasonLeaderboard = useMemo(() => {
    let playersList = (dbSeasonLeaderboard && dbSeasonLeaderboard.length > 0) ? [...dbSeasonLeaderboard] : [];
      
    const userIndex = playersList.findIndex(p => 
      p.name.toLowerCase() === userName.toLowerCase() || 
      (userEmail && p.name.toLowerCase() === userEmail.toLowerCase())
    );

    if (userIndex !== -1) {
      playersList[userIndex] = {
        ...playersList[userIndex],
        name: userName,
        score: Math.max(playersList[userIndex].score, displayTacPoints),
        avatar_url: userAvatar || playersList[userIndex].avatar_url
      };
    } else {
      playersList.push({ id: "user", name: userName, score: displayTacPoints, avatar_url: userAvatar });
    }

    return playersList.sort((a, b) => b.score - a.score);
  }, [dbSeasonLeaderboard, userName, userEmail, userAvatar, displayTacPoints]);

  const allTimeRank = sortedLeaderboard.findIndex(p => p.name === userName) + 1;
  const seasonRank = sortedSeasonLeaderboard.findIndex(p => p.name === userName) + 1;

  const activeLeaderboard = lbTab === "alltime" ? sortedLeaderboard : sortedSeasonLeaderboard;
  const activeRank = lbTab === "alltime" ? allTimeRank : seasonRank;
  
  const isUserInTop5 = activeRank > 0 && activeRank <= 5;
  const currentUserData = activeLeaderboard[activeRank - 1];
  const top5Players = activeLeaderboard.slice(0, 5);

  const getMedal = (index: number) => {
    if (index === 0) return <span className="text-yellow-400 font-black text-xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">1.</span>;
    if (index === 1) return <span className="text-slate-300 font-black text-lg drop-shadow-[0_0_10px_rgba(203,213,225,0.6)]">2.</span>;
    if (index === 2) return <span className="text-orange-600 font-black text-lg drop-shadow-[0_0_10px_rgba(234,88,12,0.6)]">3.</span>;
    return <span className="text-slate-500 font-black">{index + 1}.</span>;
  };

  const renderAvatar = (url?: string, name: string = "") => {
    if (url) {
      return (
        <img 
          src={url} 
          alt={name} 
          className="w-8 h-8 rounded-full border border-slate-700 object-cover shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
          referrerPolicy="no-referrer"
        />
      );
    }
    const initial = name.charAt(0).toUpperCase();
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
        <span className="text-xs font-bold text-slate-400">{initial || "?"}</span>
      </div>
    );
  };

  return (
    <>
      {/* SEPARATES OVERLAY FÜR DIE TÄGLICHE CHALLENGE (Außerhalb von motion.div für sauberes fixed-Positioning) */}
      <DailyChallengeModal
        isOpen={isDailyModalOpen}
        onClose={() => setIsDailyModalOpen(false)}
        user={user}
        onRewardEarned={handleRewardEarned}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full flex flex-col gap-6 text-slate-200 font-sans pb-24"
      >
        {/* ======================================================== */}
        {/* 1. HERO SECTION (2-SPALTEN DESIGN FÜR RANGLISTEN)        */}
        {/* ======================================================== */}
        <div className="w-full bg-[#040914]/90 border border-cyan-900/50 backdrop-blur-xl p-6 lg:p-8 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 via-cyan-400 to-transparent" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="flex items-center gap-4">
              {userAvatar && (
                <img src={userAvatar} alt={displayUserName} className="w-14 h-14 rounded-full border-2 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">
                  {t("home_welcome")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">{displayUserName}</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-semibold">{t("home_hero_sub")}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 md:gap-8 bg-[#030611] border border-slate-800 p-4 rounded-xl shadow-inner w-full md:w-auto">
              
              {/* 1. Einzel (TacScore) */}
              <div className="flex flex-col items-start md:items-end flex-1 md:flex-auto">
                <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">TacScore (All-Time)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <div className="text-2xl md:text-3xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] leading-none">
                    {displayScore}
                  </div>
                  <span className="text-[10px] font-bold text-cyan-600">TS</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">{t("home_rank")} <span className="text-white">#{allTimeRank > 0 ? allTimeRank : "-"}</span></div>
              </div>
              
              <div className="h-10 w-px bg-slate-800 hidden md:block"></div>
              
              {/* 2. Turniere (TacPoints) */}
              <div className="flex flex-col items-end flex-1 md:flex-auto">
                <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">TacPoints (TP Tour)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <div className="text-2xl md:text-3xl font-black text-orange-400 drop-shadow-[0_0_15px_rgba(255,165,0,0.4)] leading-none">
                    {displayTacPoints}
                  </div>
                  <span className="text-[10px] font-bold text-orange-600">TP</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">{t("home_rank")} <span className="text-white">#{seasonRank > 0 ? seasonRank : "-"}</span></div>
              </div>

            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. TAKTIK-TIPP DES TAGES & TÄGLICHE CHALLENGE            */}
        {/* ======================================================== */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LINKS: Taktik-Tipp des Tages */}
          <div className="lg:col-span-7 bg-[#050b18]/80 border border-emerald-900/30 p-5 rounded-xl shadow-lg relative overflow-hidden flex items-center">
            <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <div className="flex items-start gap-4">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                  {t("home_tip_title")}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  <strong className="text-emerald-300 font-bold">{dailyTip.highlight}</strong> {dailyTip.text}
                </p>
              </div>
            </div>
          </div>

          {/* RECHTS: Tägliche Challenge */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsDailyModalOpen(true)}
            className={`lg:col-span-5 p-5 rounded-xl border shadow-lg relative overflow-hidden cursor-pointer flex items-center justify-between gap-4 transition-all ${
              dailyStatus === "open"
                ? "bg-gradient-to-br from-[#050b18] via-[#0a1020] to-amber-950/30 border-amber-500/50 hover:border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.12)]"
                : dailyStatus === "won"
                  ? "bg-[#050b18]/90 border-emerald-500/40"
                  : "bg-[#050b18]/90 border-slate-800"
            }`}
          >
            <div className={`absolute left-0 top-0 w-1 h-full ${
              dailyStatus === "open" ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" : dailyStatus === "won" ? "bg-emerald-500" : "bg-slate-600"
            }`} />

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  {t("home_daily_badge")}
                </span>
                {dailyStreak > 0 && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {dailyStreak} {dailyStreak === 1 ? t("home_day") : t("home_days")} {t("home_streak")}
                  </span>
                )}
              </div>

              <h4 className="text-base font-black text-white uppercase tracking-wider">
                {dailyStatus === "open"
                  ? t("home_daily_open_title")
                  : dailyStatus === "won"
                    ? t("home_daily_won_title")
                    : t("home_daily_lost_title")}
              </h4>

              <p className="text-xs text-slate-400 leading-snug">
                {dailyStatus === "open"
                  ? t("home_daily_open_desc")
                  : t("home_daily_closed_desc")}
              </p>
            </div>

            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-lg transition-all ${
              dailyStatus === "open"
                ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
                : dailyStatus === "won"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800 border border-slate-700 text-slate-400"
            }`}>
              {dailyStatus === "open" ? "➔" : dailyStatus === "won" ? "✓" : "👁️"}
            </div>
          </motion.div>

        </div>
          
        <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-5 mt-2">
          {/* ======================================================== */}
          {/* 3. TRAINER FORTSETZEN                                    */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">
              {t("home_training_header")}
            </h3>
            
            <motion.div 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickStart()} 
              className="w-full h-full min-h-[220px] relative group overflow-hidden rounded-2xl bg-[#050b18] border border-cyan-900/50 p-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] cursor-pointer flex flex-col"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-blue-600/10 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors z-10" />
              
              <div className="relative flex-1 bg-[#030611]/80 backdrop-blur-sm p-6 rounded-xl flex flex-col justify-between border border-slate-800/50 group-hover:border-cyan-500/50 transition-colors z-20 overflow-hidden">
                
                <div className="flex justify-between items-start w-full relative z-30">
                  <div className="flex flex-col items-start text-left gap-1.5">
                    <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
                      {isNewbie ? t("home_newbie_badge") : t("home_continue_badge")}
                    </span>
                    <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-wider drop-shadow-md">
                      {isNewbie ? t("home_newbie_title") : t("home_continue_title")}
                    </h2>
                    <p className="text-xs text-slate-400 max-w-[240px] mt-1">
                      {isNewbie ? t("home_newbie_desc") : t("home_continue_desc")}
                    </p>
                  </div>
                  
                  <div className="w-12 h-12 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(6,182,212,0.6)] transition-all">
                    <span className="text-xl font-black">➔</span>
                  </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[150%] opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none blur-[2px] z-10 flex items-center justify-center pt-10 scale-110">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] opacity-60 group-hover:opacity-90 brightness-125 contrast-125 transition-all duration-500 pointer-events-none blur-[1px] group-hover:blur-0 z-10 flex items-center justify-center pt-4 scale-90">
                    <ScenarioCourt3D
                      level="Schlag"
                      positions={previewScenario.positions}
                      selectedZone={null}
                      hasSubmitted={false}
                      bestZones={[]}
                      onZoneClick={() => {}}
                      profiMode={false}
                      acceptableZones={[]}
                      activeChar="you"
                      hitterId="opp1" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ======================================================== */}
          {/* 4. LEADERBOARD (All-Time & Season)                       */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex justify-between items-end px-1">
              <div className="flex items-center gap-3 sm:gap-4">
                <h3 
                  onClick={() => setLbTab("alltime")}
                  className={`text-[10px] sm:text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${lbTab === 'alltime' ? 'text-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  TacScore (All-Time)
                </h3>
                <span className="text-slate-700 font-black">|</span>
                <h3 
                  onClick={() => setLbTab("season")}
                  className={`text-[10px] sm:text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${lbTab === 'season' ? 'text-orange-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  TacPoints (TP Tour)
                </h3>
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded border border-slate-800">Top 5</span>
            </div>

            <div className="w-full h-full bg-[#040914]/90 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col gap-2">
              
              {top5Players.map((player, index) => {
                const isUser = player.name === userName; 
                const highlightColor = lbTab === 'alltime' ? 'text-cyan-400' : 'text-orange-400';
                const activeBg = lbTab === 'alltime' ? 'bg-cyan-950/30 border-cyan-900/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' : 'bg-orange-950/30 border-orange-900/50 shadow-[inset_0_0_15px_rgba(255,165,0,0.1)]';
                const tagColor = lbTab === 'alltime' ? 'bg-cyan-600/20 text-cyan-300' : 'bg-orange-600/20 text-orange-300';
                
                return (
                  <div 
                    key={`rank-${player.id}-${player.name}`}
                    onClick={() => onPlayerClick?.(player.id, lbTab)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${
                      isUser ? activeBg : 'bg-[#030611]/50 border-slate-800/50 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-sm">{getMedal(index)}</span>
                      {renderAvatar(player.avatar_url, player.name)}
                      <span className={`font-bold text-sm ${isUser ? highlightColor : 'text-slate-300'} truncate max-w-[120px] sm:max-w-[150px]`}>
                        {isUser ? displayUserName : player.name}
                        {isUser && <span className={`ml-2 text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded ${tagColor}`}>{t("home_you_tag")}</span>}
                      </span>
                    </div>
                    <span className={`font-black text-sm tracking-wider ${isUser ? 'text-white' : 'text-slate-400'}`}>
                      {player.score.toLocaleString()} <span className="text-[9px] text-slate-600 font-bold">{lbTab === 'alltime' ? 'PTS' : 'TP'}</span>
                    </span>
                  </div>
                );
              })}

              {!isUserInTop5 && currentUserData && (
                <>
                  <div className="text-center text-slate-700 font-black tracking-widest text-xs py-1">•••</div>
                  <div 
                    onClick={() => onPlayerClick?.(currentUserData.id, lbTab)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer hover:scale-[1.02] active:scale-95 ${
                      lbTab === 'alltime' ? 'bg-cyan-950/20 border-cyan-900/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' : 'bg-orange-950/20 border-orange-900/50 shadow-[inset_0_0_15px_rgba(255,165,0,0.1)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-black text-sm w-6 text-center ${lbTab === 'alltime' ? 'text-cyan-600' : 'text-orange-600'}`}>{activeRank}.</span>
                      {renderAvatar(currentUserData.avatar_url, currentUserData.name)}
                      <span className={`font-bold text-sm truncate max-w-[100px] sm:max-w-[150px] ${lbTab === 'alltime' ? 'text-cyan-400' : 'text-orange-400'}`}>
                        {displayUserName}
                        <span className={`ml-2 text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded ${lbTab === 'alltime' ? 'bg-cyan-600/20 text-cyan-300' : 'bg-orange-600/20 text-orange-300'}`}>{t("home_you_tag")}</span>
                      </span>
                    </div>
                    <span className="font-black text-sm tracking-wider text-white">
                      {currentUserData.score.toLocaleString()} <span className="text-[9px] text-slate-600 font-bold">{lbTab === 'alltime' ? 'PTS' : 'TP'}</span>
                    </span>
                  </div>
                </>
              )}

              {top5Players.length === 0 && (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl opacity-50">🏆</span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("home_waiting_data")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 5. APP NAVIGATION KACHELN (Game, Lexikon, Board)         */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          
          {/* Game / Match Starten Card */}
          <div 
            onClick={() => setActiveTab("game")} 
            className="bg-[#040914] border border-orange-500/30 hover:border-orange-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(255,119,0,0.05)] hover:shadow-[0_0_25px_rgba(255,119,0,0.15)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-orange-950/40 border border-orange-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(255,119,0,0.2)] group-hover:scale-105 transition-transform duration-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(255,119,0,0.8)]">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M5.6 5.6c2.5 2.5 3.5 6.3 2.7 9.8"></path>
                <path d="M18.4 18.4c-2.5-2.5-3.5-6.3-2.7-9.8"></path>
              </svg>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{t("home_card_match_title")}</h3>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t("home_card_match_sub")}</span>
            </div>
            <span className="text-orange-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
          </div>

          {/* Padel-Lexikon Card */}
          <div 
            onClick={() => setActiveTab("basics")}
            className="bg-[#040914] border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform duration-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{t("home_card_lexicon_title")}</h3>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{t("home_card_lexicon_sub")}</span>
            </div>
            <span className="text-emerald-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
          </div>

          {/* Freies Board Card */}
          <div 
            onClick={() => setActiveTab("taktik")} 
            className="bg-[#040914] border border-purple-500/30 hover:border-purple-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(168,85,247,0.05)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform duration-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"></path>
                <path d="M8 12l2 2 4-4"></path>
              </svg>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{t("home_card_board_title")}</h3>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{t("home_card_board_sub")}</span>
            </div>
            <span className="text-purple-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
          </div>

        </div>
      </motion.div>
    </>
  );
}
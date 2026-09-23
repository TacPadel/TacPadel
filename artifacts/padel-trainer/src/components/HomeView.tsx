import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import ScenarioCourt3D from "../components/ScenarioCourt3D/ScenarioCourt3D";
import { SCENARIOS } from "./Scenarios";

const TACTIC_TIPS = [
  {
    highlight: "Der Lob",
    text: "ist im Padel kein reiner Verteidigungsschlag, sondern dein wichtigster Angriffsschlag. Spiele ihn hoch und tief in die Ecken, um die Netzposition zu erobern!"
  },
  {
    highlight: "Die Bandeja",
    text: "ist kein harter Gewinnschlag! Nutze sie primär, um deine Netzposition zu verteidigen. Tiefe und Platzierung gehen hier immer vor Härte."
  },
  {
    highlight: "Das Gummiband-Prinzip:",
    text: "Bewege dich immer parallel zu deinem Partner. Rückt er ans Netz vor, gehst du mit. Bleibt einer hinten, entsteht eine tödliche Lücke in der Mitte."
  },
  {
    highlight: "Die Chiquita",
    text: "eignet sich perfekt, wenn die Gegner aufrücken. Spiele den Ball sanft auf ihre Füße, um sie zu einem schweren, tiefen Volley zu zwingen."
  },
  {
    highlight: "Durch die Mitte:",
    text: "Das ist oft der sicherste Weg. Tiefe Bälle durch die Mitte stiften Verwirrung (Wer nimmt den Ball?) und minimieren die Winkel für den gegnerischen Konter."
  }
];

export interface DBPlayer {
  id: string;
  name: string;
  score: number;
  avatar_url?: string;
}

interface HomeViewProps {
  setActiveTab: (tab: "home" | "trainer" | "taktik" | "basics") => void;
  onQuickStart: (scenarioIndex?: number) => void;
  currentScore?: number; 
  userName?: string; 
  userEmail?: string; 
  userAvatar?: string;
  dbLeaderboard?: DBPlayer[];
  onPlayerClick?: (id: string) => void;
}

export default function HomeView({ 
  setActiveTab, 
  onQuickStart, 
  currentScore = 0, 
  userName = "Gast",
  userEmail = "", 
  userAvatar = "",
  dbLeaderboard = [],
  onPlayerClick
}: HomeViewProps) {
  
  const [randomScenarioIndex] = useState(() => Math.floor(Math.random() * SCENARIOS.length));
  const previewScenario = SCENARIOS[randomScenarioIndex];
  const displayScore = Math.floor(currentScore);
  
  const [dailyTip] = useState(() => TACTIC_TIPS[Math.floor(Math.random() * TACTIC_TIPS.length)]);

  const hasDBData = dbLeaderboard && dbLeaderboard.length > 0;

  const sortedLeaderboard = useMemo(() => {
    let playersList = hasDBData ? [...dbLeaderboard] : [];
      
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
      playersList.push({ 
        id: "user", 
        name: userName, 
        score: displayScore,
        avatar_url: userAvatar
      });
    }

    return playersList.sort((a, b) => b.score - a.score);
  }, [dbLeaderboard, userName, userEmail, userAvatar, displayScore, hasDBData]);

  const currentUserRank = sortedLeaderboard.findIndex(p => p.name === userName) + 1;
  const isUserInTop5 = currentUserRank > 0 && currentUserRank <= 5;
  const currentUserData = sortedLeaderboard[currentUserRank - 1];
  const top5Players = sortedLeaderboard.slice(0, 5);

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full flex flex-col gap-6 text-slate-200 font-sans pb-24"
    >
      
      {/* ======================================================== */}
      {/* 1. HERO SECTION                                          */}
      {/* ======================================================== */}
      <div className="w-full bg-[#040914]/90 border border-cyan-900/50 backdrop-blur-xl p-6 lg:p-8 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 via-cyan-400 to-transparent" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-4">
            {userAvatar && (
              <img src={userAvatar} alt={userName} className="w-14 h-14 rounded-full border-2 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] object-cover" referrerPolicy="no-referrer" />
            )}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">
                Willkommen, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">{userName}</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Analysiere Spielsituationen und meistere das TacPadel Game.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-[#030611] border border-slate-800 p-4 rounded-xl shadow-inner w-full md:w-auto">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Total Score</span>
              <div className="text-3xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] leading-none mt-1">
                {displayScore}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-800 hidden md:block"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Rang</span>
              <div className="text-xl font-bold text-white mt-1">
                {currentUserRank > 0 ? `#${currentUserRank}` : "-"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TAKTIK-TIPP DES TAGES                                 */}
      {/* ======================================================== */}
      <div className="w-full bg-[#050b18]/80 border border-orange-900/30 p-5 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute left-0 top-0 w-1 h-full bg-orange-500 shadow-[0_0_10px_rgba(255,119,0,0.5)]"></div>
        <div className="flex items-start gap-4">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1">
              Taktik Tipp des Tages
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              <strong className="text-orange-300 font-bold">{dailyTip.highlight}</strong> {dailyTip.text}
            </p>
          </div>
        </div>
      </div>
        
      <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-5 mt-2">
        {/* ======================================================== */}
        {/* 3. BLITZSTART                                            */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">
            Training Starten
          </h3>
          
          <motion.div 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onQuickStart(randomScenarioIndex)}
            className="w-full h-full min-h-[220px] relative group overflow-hidden rounded-2xl bg-[#050b18] border border-cyan-900/50 p-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] cursor-pointer flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-blue-600/10 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors z-10" />
            
            <div className="relative flex-1 bg-[#030611]/80 backdrop-blur-sm p-6 rounded-xl flex flex-col justify-between border border-slate-800/50 group-hover:border-cyan-500/50 transition-colors z-20 overflow-hidden">
              
              <div className="flex justify-between items-start w-full relative z-30">
                <div className="flex flex-col items-start text-left gap-1.5">
                  <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">Zufalls-Szenario</span>
                  <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-wider drop-shadow-md">Blitzstart</h2>
                  <p className="text-xs text-slate-400 max-w-[200px] mt-1">Spring direkt in die Action und sammle Taktik-Punkte.</p>
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
        {/* 4. LEADERBOARD                                           */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Top Rankings
            </h3>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest bg-orange-950/30 px-2 py-1 rounded border border-orange-900/50">Top 5</span>
          </div>

          <div className="w-full h-full bg-[#040914]/90 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col gap-2">
            
            {top5Players.map((player, index) => {
              const isUser = player.name === userName; 
              return (
                <div 
                  key={`rank-${player.id}-${player.name}`}
                  onClick={() => onPlayerClick?.(player.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${
                    isUser 
                      ? 'bg-cyan-950/30 border-cyan-900/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' 
                      : 'bg-[#030611]/50 border-slate-800/50 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm">{getMedal(index)}</span>
                    {renderAvatar(player.avatar_url, player.name)}
                    <span className={`font-bold text-sm ${isUser ? 'text-cyan-400' : 'text-slate-300'} truncate max-w-[120px] sm:max-w-[150px]`}>
                      {player.name}
                      {isUser && <span className="ml-2 text-[8px] uppercase tracking-widest bg-cyan-600/20 text-cyan-300 px-1.5 py-0.5 rounded">Du</span>}
                    </span>
                  </div>
                  <span className={`font-black text-sm tracking-wider ${isUser ? 'text-white' : 'text-slate-400'}`}>
                    {player.score.toLocaleString()} <span className="text-[9px] text-slate-600 font-bold">PTS</span>
                  </span>
                </div>
              );
            })}

            {!isUserInTop5 && currentUserData && (
              <>
                <div className="text-center text-slate-700 font-black tracking-widest text-xs py-1">•••</div>
                <div 
                  onClick={() => onPlayerClick?.(currentUserData.id)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border bg-cyan-950/20 border-cyan-900/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm w-6 text-center text-cyan-600">{currentUserRank}.</span>
                    {renderAvatar(currentUserData.avatar_url, currentUserData.name)}
                    <span className="font-bold text-sm text-cyan-400 truncate max-w-[100px] sm:max-w-[150px]">
                      {currentUserData.name}
                      <span className="ml-2 text-[8px] uppercase tracking-widest bg-cyan-600/20 text-cyan-300 px-1.5 py-0.5 rounded">Du</span>
                    </span>
                  </div>
                  <span className="font-black text-sm tracking-wider text-white">
                    {currentUserData.score.toLocaleString()} <span className="text-[9px] text-slate-600 font-bold">PTS</span>
                  </span>
                </div>
              </>
            )}

            {top5Players.length === 0 && (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-3xl opacity-50">🏆</span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Warte auf Server...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. APP NAVIGATION KACHELN (NEUES NEON-DESIGN)            */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        
        {/* Taktik-Trainer Card */}
        <div 
          onClick={() => setActiveTab("trainer")}
          className="bg-[#040914] border border-orange-500/30 hover:border-orange-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(255,119,0,0.05)] hover:shadow-[0_0_25px_rgba(255,119,0,0.15)]"
        >
          <div className="w-16 h-16 rounded-2xl bg-orange-950/40 border border-orange-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(255,119,0,0.2)] group-hover:scale-105 transition-transform duration-300">
            {/* SVG Tennis Ball Outline */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(255,119,0,0.8)]">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.6 5.6c2.5 2.5 3.5 6.3 2.7 9.8"></path>
              <path d="M18.4 18.4c-2.5-2.5-3.5-6.3-2.7-9.8"></path>
            </svg>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Taktik-Trainer</h3>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Übungen & Matches</span>
          </div>
          <span className="text-orange-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
        </div>

        {/* Padel-Lexikon Card */}
        <div 
          onClick={() => setActiveTab("basics")}
          className="bg-[#040914] border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform duration-300">
            {/* SVG Book Outline */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Padel-Lexikon</h3>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Theorie & Wissen</span>
          </div>
          <span className="text-emerald-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
        </div>

        {/* Freies Board Card */}
        <div 
          onClick={() => setActiveTab("taktik")} 
          className="bg-[#040914] border border-purple-500/30 hover:border-purple-400 rounded-2xl p-5 lg:p-6 transition-all cursor-pointer group flex flex-col items-center text-center gap-4 shadow-[0_0_15px_rgba(168,85,247,0.05)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]"
        >
          <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-center shadow-[inset_0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform duration-300">
            {/* SVG Clipboard/Stats Outline */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"></path>
              <path d="M8 12l2 2 4-4"></path>
            </svg>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Taktik-Board</h3>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Taktik Planen</span>
          </div>
          <span className="text-purple-400 text-lg font-black mt-1 group-hover:translate-y-1 transition-transform">›</span>
        </div>

      </div>
    </motion.div>
  );
}
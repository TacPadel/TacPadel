import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '../lib/supabase'; 

// --- Typen & Mock-Daten ---
type TourStatus = "active" | "upcoming" | "completed";
type TourType = "fip" | "challenger" | "major";

type DBTourStatus = "active" | "won" | "eliminated";
interface TourProgress {
  tournament_id: string;
  status: DBTourStatus;
  current_round: number;
}

interface Tournament {
  id: string;
  name: string;
  location: string;
  type: TourType;
  status: TourStatus;
  reqScore: number;
  rewardText: string;
  startsIn?: string;
  baseDifficulty: number;
  tacPointsReward: number; 
}

// Typ für das Season Ranking
interface LeaderboardEntry {
  id: string;
  username: string; 
  tac_points: number;
}

// NEU: Typ für die Spieler-Statistiken
interface PlayerStats {
  id: string;
  username: string;
  tac_points: number;
  tournaments_played: number;
  tournaments_won: number;
  tournaments_eliminated: number;
  active_runs: number;
}

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: "t1",
    name: "Madrid Challenger",
    location: "Madrid, ESP",
    type: "challenger",
    status: "active",
    reqScore: 3500,
    baseDifficulty: 3500,
    tacPointsReward: 300,
    rewardText: "Silber-Pokal + 300 TacPoints",
  },
  {
    id: "t2",
    name: "Paris Premier Major",
    location: "Paris, FRA",
    type: "major",
    status: "upcoming",
    reqScore: 4000,
    baseDifficulty: 4500, 
    tacPointsReward: 600,
    rewardText: "Gold-Pokal + 600 TacPoints",
    startsIn: "12d 04h",
  },
  {
    id: "t3",
    name: "Berlin FIP Rise",
    location: "Berlin, GER",
    type: "fip",
    status: "upcoming",
    reqScore: 0,
    baseDifficulty: 2500, 
    tacPointsReward: 150,
    rewardText: "Bronze-Badge + 150 TacPoints",
    startsIn: "2d 10h",
  },
  {
    id: "t4",
    name: "Doha Premier Major",
    location: "Doha, QAT",
    type: "major",
    status: "completed",
    reqScore: 4000,
    baseDifficulty: 4500,
    tacPointsReward: 600,
    rewardText: "Trophäe erhalten",
  }
];

interface TourScreenProps {
  onClose: () => void;
  onStartMatch?: (tournamentId: string, currentRound: number, baseDifficulty: number, reward: number) => void;
}

export default function TourScreen({ onClose, onStartMatch }: TourScreenProps) {
  const [selectedTour, setSelectedTour] = useState<Tournament | null>(null);
  
  // -- SUPABASE STATES --
  const [progress, setProgress] = useState<Record<string, TourProgress>>({});
  const [tacPoints, setTacPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // -- LEADERBOARD & STATS STATES --
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);

  // Lade Turnier-Fortschritt UND TacPoints aus der Datenbank
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          const savedPoints = localStorage.getItem("tacpadel_tac_points");
          if (savedPoints) setTacPoints(parseInt(savedPoints, 10));
          setLoading(false);
          return;
        }

        // 1. Turnier-Fortschritt laden
        const { data: tourData, error: tourError } = await supabase
          .from("tour_progress")
          .select("*")
          .eq("user_id", session.user.id);

        if (tourData && !tourError) {
          const progressMap: Record<string, TourProgress> = {};
          tourData.forEach((row) => {
            progressMap[row.tournament_id] = row;
          });
          setProgress(progressMap);
        }

        // 2. TacPoints laden
        const { data: statsData, error: statsError } = await supabase
          .from("user_stats")
          .select("tac_points")
          .eq("id", session.user.id)
          .single();

        if (statsData && !statsError) {
          setTacPoints(statsData.tac_points || 0);
          localStorage.setItem("tacpadel_tac_points", (statsData.tac_points || 0).toString());
        } else {
          const savedPoints = localStorage.getItem("tacpadel_tac_points");
          if (savedPoints) setTacPoints(parseInt(savedPoints, 10));
        }

      } catch (err) {
        console.error("Fehler beim Laden der Daten:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Lade Season Ranking Daten
  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    setShowLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('id, username, tac_points')
        .order('tac_points', { ascending: false })
        .limit(10); 

      if (data && !error) {
        setLeaderboardData(data);
      } else {
        console.error("Fehler beim Laden des Rankings:", error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // NEU: Lade spezifische Turnier-Statistiken für einen Spieler
  const handlePlayerClick = async (player: LeaderboardEntry) => {
    setSelectedPlayer({
      id: player.id,
      username: player.username || "Spieler XYZ",
      tac_points: player.tac_points,
      tournaments_played: 0,
      tournaments_won: 0,
      tournaments_eliminated: 0,
      active_runs: 0
    });
    setLoadingPlayerStats(true);

    try {
      const { data, error } = await supabase
        .from('tour_progress')
        .select('status')
        .eq('user_id', player.id);

      if (data && !error) {
        const played = data.length;
        const won = data.filter(row => row.status === 'won').length;
        const elim = data.filter(row => row.status === 'eliminated').length;
        const active = data.filter(row => row.status === 'active').length;

        setSelectedPlayer({
          id: player.id,
          username: player.username || "Spieler XYZ",
          tac_points: player.tac_points,
          tournaments_played: played,
          tournaments_won: won,
          tournaments_eliminated: elim,
          active_runs: active
        });
      }
    } catch (err) {
      console.error("Fehler beim Laden der Spieler-Statistiken:", err);
    } finally {
      setLoadingPlayerStats(false);
    }
  };

  const getTypeColor = (type: TourType) => {
    switch (type) {
      case "major": return "text-fuchsia-400 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.4)]";
      case "challenger": return "text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]";
      case "fip": return "text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    }
  };

  const getTypeBg = (type: TourType) => {
    switch (type) {
      case "major": return "from-fuchsia-900/40 to-fuchsia-950/20";
      case "challenger": return "from-cyan-900/40 to-cyan-950/20";
      case "fip": return "from-emerald-900/40 to-emerald-950/20";
    }
  };

  // -- MATCH STARTEN LOGIK --
  const handleStartTournament = async (tour: Tournament) => {
    const currentStatus = progress[tour.id];

    if (currentStatus?.status === "eliminated" || currentStatus?.status === "won") {
      alert("Du hast dieses Turnier bereits beendet (Gewonnen oder Ausgeschieden).");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert("Bitte melde dich an, um die Tour zu spielen!");
        return;
      }

      let startRound = 1;

      if (!currentStatus) {
        // Neues Turnier starten
        const { error } = await supabase.from("tour_progress").insert({
          user_id: session.user.id,
          tournament_id: tour.id,
          status: "active",
          current_round: 1
        });
        
        if (error) throw error;
        
        setProgress(prev => ({
          ...prev,
          [tour.id]: { tournament_id: tour.id, status: "active", current_round: 1 }
        }));
      } else {
        startRound = currentStatus.current_round;
      }

      if (onStartMatch) {
        onStartMatch(tour.id, startRound, tour.baseDifficulty, tour.tacPointsReward);
      } 

    } catch (err) {
      console.error("Fehler beim Starten des Turniers:", err);
      alert("Fehler beim Starten. Bitte versuche es erneut.");
    }
  };

  const getBracketStatus = (tourId: string) => {
    const tourProgress = progress[tourId];
    const currentRound = tourProgress?.current_round || 1;
    const dbStat = tourProgress?.status; 

    return {
      vf: {
        text: currentRound === 1 ? (dbStat === 'eliminated' ? "Raus" : "Next") : "Erledigt ✓",
        styles: currentRound === 1 
          ? (dbStat === 'eliminated' ? "bg-red-600 text-white" : "bg-orange-600 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]") 
          : "bg-emerald-600 text-white",
        opacity: "opacity-100"
      },
      hf: {
        text: currentRound < 2 ? "Gesperrt" : (currentRound === 2 ? (dbStat === 'eliminated' ? "Raus" : "Next") : "Erledigt ✓"),
        styles: currentRound < 2 
          ? "text-slate-600" 
          : (currentRound === 2 
              ? (dbStat === 'eliminated' ? "bg-red-600 text-white" : "bg-orange-600 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]") 
              : "bg-emerald-600 text-white"),
        opacity: currentRound >= 2 ? "opacity-100" : "opacity-60"
      },
      f: {
        text: currentRound < 3 ? "Gesperrt" : (dbStat === 'won' ? "Champion 🏆" : (dbStat === 'eliminated' ? "Raus" : "Next")),
        styles: currentRound < 3 
          ? "text-slate-600" 
          : (dbStat === 'won' 
              ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
              : (dbStat === 'eliminated' ? "bg-red-600 text-white" : "bg-orange-600 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]")),
        opacity: currentRound >= 3 ? "opacity-100" : "opacity-60"
      }
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#02050a] text-slate-200 relative overflow-hidden pointer-events-auto">
      
      {/* HINTERGRUND GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>

      {/* HEADER & RADAR */}
      <div className="relative pt-6 pb-4 px-4 flex flex-col items-center border-b border-slate-800/50 bg-[#050b18]/80 backdrop-blur-sm z-10 shrink-0">
        
        {/* ZURÜCK BUTTON */}
        <button 
          onClick={onClose} 
          className="absolute left-4 top-6 w-10 h-10 flex items-center justify-center bg-slate-900/80 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors shadow-lg z-20"
        >
          <span className="text-slate-300 font-bold text-lg leading-none">✕</span>
        </button>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          Pro Tour
        </h1>
        
        {/* TAC POINTS & RANKING BUTTON */}
        <div className="mt-4 flex flex-wrap justify-center items-center gap-3 w-full px-4">
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-950/30 border border-amber-500/50 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <span className="text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)] text-sm leading-none">⭐</span>
            <span className="text-[12px] font-black tracking-widest text-amber-400 uppercase leading-none mt-0.5">
              {tacPoints} TacPoints
            </span>
          </div>
          
          <button 
            onClick={fetchLeaderboard}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-950/40 border border-indigo-500/50 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:bg-indigo-900/50 transition-colors"
          >
            <span className="text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.8)] text-sm leading-none">🏆</span>
            <span className="text-[12px] font-black tracking-widest text-indigo-300 uppercase leading-none mt-0.5">
              Season Ranking
            </span>
          </button>
        </div>

        {/* GLOBAL TIMER */}
        <div className="mt-3 flex items-center gap-2 px-4 py-1.5 bg-red-950/30 border border-red-500/30 rounded-full">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></div>
          <span className="text-[10px] font-black tracking-widest text-red-400 uppercase">Season Ends: 14d 08h 42m</span>
        </div>
      </div>

      {/* TURNIER-LISTE (SCROLLBAR) */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar z-10 flex flex-col gap-4 pb-20">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 rounded-full border-t-2 border-fuchsia-500 animate-spin"></div>
          </div>
        ) : (
          MOCK_TOURNAMENTS.map((tour) => {
            const dbProg = progress[tour.id];
            const isCompleted = dbProg?.status === 'won' || dbProg?.status === 'eliminated' || tour.status === 'completed';

            return (
              <motion.div 
                key={tour.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedTour(tour)}
                className={`relative p-[1px] rounded-xl cursor-pointer bg-gradient-to-br ${tour.status === 'active' && !isCompleted ? 'from-orange-500 via-slate-800 to-orange-500 animate-pulse' : 'from-slate-700 to-slate-900'} ${isCompleted ? 'opacity-50 grayscale-[0.3]' : ''}`}
              >
                <div className={`w-full h-full bg-gradient-to-br ${getTypeBg(tour.type)} p-4 rounded-xl flex flex-col bg-[#050b14]`}>
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${getTypeColor(tour.type)} bg-black/50`}>
                        {tour.type === "major" ? "⭐ Premier Major" : tour.type === "challenger" ? "🏆 Challenger" : "🥉 FIP Rise"}
                      </span>
                      <h3 className="text-lg font-black text-white uppercase tracking-wider mt-2 drop-shadow-lg">{tour.name}</h3>
                    </div>
                    
                    {/* STATUS BADGE */}
                    {tour.status === "active" && !isCompleted && (
                      <span className="text-[10px] font-black text-orange-400 bg-orange-950/50 border border-orange-500 px-2 py-1 rounded animate-pulse">
                        LIVE
                      </span>
                    )}
                    {tour.status === "upcoming" && !isCompleted && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-900/80 border border-slate-700 px-2 py-1 rounded">
                        In {tour.startsIn}
                      </span>
                    )}
                    {dbProg?.status === "won" && (
                      <span className="text-[10px] font-black text-emerald-500 bg-emerald-950/50 border border-emerald-500 px-2 py-1 rounded">
                        GEWONNEN 🏆
                      </span>
                    )}
                    {dbProg?.status === "eliminated" && (
                      <span className="text-[10px] font-black text-red-500 bg-red-950/50 border border-red-500 px-2 py-1 rounded">
                        AUSGESCHIEDEN 💀
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Entry TacScore</span>
                      <span className={`text-sm font-black ${tour.reqScore > 3000 ? 'text-red-400' : 'text-slate-300'}`}>
                        {tour.reqScore === 0 ? "Offen" : `${tour.reqScore}`}
                      </span>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-700"></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Rewards</span>
                      <span className="text-sm font-bold text-amber-400">{tour.rewardText}</span>
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ========================================================= */}
      {/* DETAIL MODAL (DER "TURNIER RUN")                          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedTour && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedTour(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />

            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-[110] bg-[#050b18] border-t-2 border-slate-700 p-6 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6 shrink-0 cursor-grab active:cursor-grabbing" onClick={() => setSelectedTour(null)} />
              
              <div className="flex flex-col items-center text-center mb-6 shrink-0">
                <span className={`text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border mb-3 ${getTypeColor(selectedTour.type)}`}>
                  {selectedTour.type.toUpperCase()}
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">{selectedTour.name}</h2>
                <p className="text-slate-400 text-sm mt-1">{selectedTour.location}</p>
                <div className="mt-2 bg-slate-900 border border-slate-700 px-3 py-1 rounded text-xs text-slate-400">
                  KI-Level: <span className="font-bold text-white">{selectedTour.baseDifficulty}</span>
                </div>
              </div>

              {/* DER DYNAMISCHE TURNIER-BAUM (BRACKET) */}
              <div className="flex-1 overflow-y-auto mb-6 custom-scrollbar">
                <div className="flex flex-col gap-3">
                  
                  {(() => {
                    const bracket = getBracketStatus(selectedTour.id);
                    return (
                      <>
                        <div className={`flex items-center gap-4 p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl ${bracket.vf.opacity}`}>
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center font-black text-slate-400 text-xs shrink-0">VF</div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white uppercase tracking-wider">Viertelfinale</p>
                            <p className="text-[10px] text-slate-500">1 Tiebreak bis 10</p>
                          </div>
                          <div className={`px-3 py-1 text-[10px] font-black uppercase rounded ${bracket.vf.styles}`}>{bracket.vf.text}</div>
                        </div>

                        <div className="w-0.5 h-4 bg-slate-700 ml-7"></div>

                        <div className={`flex items-center gap-4 p-3 bg-slate-900/30 border border-slate-800/50 rounded-xl ${bracket.hf.opacity}`}>
                          <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-slate-600 text-xs shrink-0">HF</div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Halbfinale</p>
                            <p className="text-[10px] text-slate-500">Gegen Seed #2</p>
                          </div>
                          <div className={`px-3 py-1 text-[10px] font-black uppercase rounded ${bracket.hf.styles}`}>{bracket.hf.text}</div>
                        </div>

                        <div className="w-0.5 h-4 bg-slate-700 ml-7"></div>

                        <div className={`flex items-center gap-4 p-3 bg-slate-900/30 border border-slate-800/50 rounded-xl ${bracket.f.opacity}`}>
                          <div className="w-8 h-8 rounded-full bg-amber-900/20 border border-amber-700/30 flex items-center justify-center font-black text-amber-600/50 text-xs shrink-0">F</div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-amber-500/50 uppercase tracking-wider">Finale</p>
                            <p className="text-[10px] text-slate-500">Boss KI Team</p>
                          </div>
                          <div className={`px-3 py-1 text-[10px] font-black uppercase rounded ${bracket.f.styles}`}>{bracket.f.text}</div>
                        </div>
                      </>
                    );
                  })()}

                </div>
              </div>

              {/* ACTION BUTTON */}
              <button 
                disabled={selectedTour.status !== 'active' || progress[selectedTour.id]?.status === 'won' || progress[selectedTour.id]?.status === 'eliminated'}
                onClick={() => handleStartTournament(selectedTour)}
                className={`w-full py-5 font-black tracking-[0.2em] uppercase rounded-xl transition-all shrink-0 ${
                  selectedTour.status === 'active' && progress[selectedTour.id]?.status !== 'won' && progress[selectedTour.id]?.status !== 'eliminated'
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-[0_0_20px_rgba(255,119,0,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {progress[selectedTour.id]?.status === 'won' 
                  ? 'Turnier Beendet (Sieger)' 
                  : (progress[selectedTour.id]?.status === 'eliminated' 
                      ? 'Turnier Beendet (Raus)' 
                      : (selectedTour.status === 'active' ? 'Turnier-Run Starten' : 'Noch nicht verfügbar')
                    )
                }
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* LEADERBOARD / SEASON RANKING MODAL                          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showLeaderboard && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowLeaderboard(false); setSelectedPlayer(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md z-[120]"
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="absolute top-[10%] bottom-[10%] left-4 right-4 z-[130] bg-[#050b14] border border-indigo-500/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.2)] flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">Season Ranking</h2>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Die besten Spieler der Pro Tour</p>
                </div>
                <button 
                  onClick={() => { setShowLeaderboard(false); setSelectedPlayer(null); }} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2 relative">
                {loadingLeaderboard ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="w-6 h-6 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div className="text-center text-slate-500 py-10 font-bold text-sm uppercase tracking-wider">
                    Noch keine Spieler im Ranking.
                  </div>
                ) : (
                  leaderboardData.map((player, index) => {
                    const rank = index + 1;
                    
                    let rankStyle = "bg-slate-900 border-slate-800 text-slate-400";
                    let textStyle = "text-slate-300";
                    if (rank === 1) {
                      rankStyle = "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
                      textStyle = "text-amber-400 font-black";
                    } else if (rank === 2) {
                      rankStyle = "bg-slate-300/20 border-slate-400 text-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.4)]";
                      textStyle = "text-slate-200 font-black";
                    } else if (rank === 3) {
                      rankStyle = "bg-orange-800/30 border-orange-700 text-orange-500 shadow-[0_0_10px_rgba(194,65,12,0.4)]";
                      textStyle = "text-orange-400 font-black";
                    }

                    return (
                      <div 
                        key={player.id} 
                        onClick={() => handlePlayerClick(player)}
                        className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl hover:bg-indigo-900/30 hover:border-indigo-500/50 cursor-pointer transition-all group"
                      >
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-sm shrink-0 transition-colors ${rankStyle}`}>
                          {rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate uppercase tracking-wider group-hover:text-indigo-300 transition-colors ${textStyle}`}>
                            {player.username || "Spieler XYZ"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">TacPoints</span>
                          <span className="text-sm font-black text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]">
                            {player.tac_points}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* STATISTIKEN OVERLAY (Schiebt sich über die Liste) */}
              <AnimatePresence>
                {selectedPlayer && (
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="absolute inset-0 z-20 bg-[#050b14] flex flex-col"
                  >
                    <div className="flex items-center gap-4 p-4 border-b border-slate-800 shrink-0">
                      <button 
                        onClick={() => setSelectedPlayer(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                      >
                        ←
                      </button>
                      <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest leading-tight">{selectedPlayer.username}</h3>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{selectedPlayer.tac_points} TacPoints</span>
                      </div>
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto custom-scrollbar flex flex-col justify-center">
                      {loadingPlayerStats ? (
                        <div className="flex justify-center items-center h-32">
                          <div className="w-8 h-8 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center">
                            <span className="text-3xl mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">🎾</span>
                            <span className="text-2xl font-black text-white">{selectedPlayer.tournaments_played}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Turniere Gespielt</span>
                          </div>

                          <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 rounded-xl flex flex-col items-center text-center">
                            <span className="text-3xl mb-1 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">🏆</span>
                            <span className="text-2xl font-black text-emerald-400">{selectedPlayer.tournaments_won}</span>
                            <span className="text-[9px] text-emerald-500/70 uppercase font-black tracking-widest">Siege</span>
                          </div>

                          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl flex flex-col items-center text-center">
                            <span className="text-3xl mb-1 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">💀</span>
                            <span className="text-2xl font-black text-red-400">{selectedPlayer.tournaments_eliminated}</span>
                            <span className="text-[9px] text-red-500/70 uppercase font-black tracking-widest">Ausgeschieden</span>
                          </div>

                          <div className="bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-xl flex flex-col items-center text-center">
                            <span className="text-3xl mb-1 drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">📊</span>
                            <span className="text-2xl font-black text-indigo-400">
                              {selectedPlayer.tournaments_won + selectedPlayer.tournaments_eliminated > 0 
                                ? Math.round((selectedPlayer.tournaments_won / (selectedPlayer.tournaments_won + selectedPlayer.tournaments_eliminated)) * 100) 
                                : 0}%
                            </span>
                            <span className="text-[9px] text-indigo-500/70 uppercase font-black tracking-widest">Win Rate</span>
                          </div>

                          {selectedPlayer.active_runs > 0 && (
                            <div className="col-span-2 bg-orange-950/20 border border-orange-900/30 p-3 rounded-xl flex items-center justify-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                              <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest">
                                {selectedPlayer.active_runs} Aktive Turnier-Runs
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
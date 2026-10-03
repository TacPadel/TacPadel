import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '../lib/supabase'; 

// --- NEUER IMPORT: Die ausgelagerten Turniere ---
import { Tournament, TourType, TOURNAMENTS } from '../engine/Tournaments';

type DBTourStatus = "active" | "won" | "eliminated";
interface TourProgress {
  tournament_id: string;
  status: DBTourStatus;
  current_round: number;
}

interface LeaderboardEntry {
  id: string;
  username: string; 
  tac_points: number;
  points: number; 
}

interface PlayerStats {
  id: string;
  username: string;
  tac_points: number;
  tournaments_played: number;
  tournaments_won: number;
  tournaments_eliminated: number;
  active_runs: number;
}

// 30-Tage Beta Enddatum
const BETA_END_DATE = new Date("2026-10-28T23:59:59").getTime();

// --- Freischalt-Bedingung für die Tour ---
const TOUR_UNLOCK_SCORE = 2000;

interface TourScreenProps {
  onClose: () => void;
  onStartMatch?: (tournamentId: string, currentRound: number, baseDifficulty: number, reward: number) => void;
}

// -----------------------------------------------------------
// ZENTRALE RE-BUY LOGIK (Überall einheitlich abrufbar)
// -----------------------------------------------------------
const getRetryFee = (tour: Tournament) => {
  if (tour.entryFee === 0) return 50; // Kostenlose Turniere kosten als Strafe 50 TP
  return Math.max(50, tour.entryFee * 2); // Mindestens 50 TP Strafe oder der doppelte Entry
};

export default function TourScreen({ onClose, onStartMatch }: TourScreenProps) {
  const [selectedTour, setSelectedTour] = useState<Tournament | null>(null);
  
  // -- SUPABASE STATES --
  const [progress, setProgress] = useState<Record<string, TourProgress>>({});
  const [tacPoints, setTacPoints] = useState<number>(0); 
  const [tacScore, setTacScore] = useState<number>(0); 
  const [loading, setLoading] = useState(true);

  // -- TIMER STATE --
  const [timeLeft, setTimeLeft] = useState<string>("Berechne...");

  // -- LEADERBOARD & STATS STATES --
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);

  // Dynamischer Countdown-Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = BETA_END_DATE - now;

      if (distance < 0) {
        setTimeLeft("BETA BEENDET");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Lade Turnier-Fortschritt, TacPoints (Währung) UND TacScore (Skill Level)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          const savedTacPoints = localStorage.getItem("tacpadel_tac_points");
          if (savedTacPoints) setTacPoints(parseInt(savedTacPoints, 10));
          
          const savedScore = localStorage.getItem("tacpadel_score");
          if (savedScore) setTacScore(parseInt(savedScore, 10));
          
          setLoading(false);
          return;
        }

        // 1. Turnier Progress
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

        // 2. Stats
        const { data: statsData, error: statsError } = await supabase
          .from("user_stats")
          .select("tac_points, points")
          .eq("id", session.user.id)
          .single();

        if (statsData && !statsError) {
          setTacPoints(statsData.tac_points || 0);
          setTacScore(statsData.points || 0);
          localStorage.setItem("tacpadel_tac_points", (statsData.tac_points || 0).toString());
          localStorage.setItem("tacpadel_score", (statsData.points || 0).toString());
        } else {
          const savedTacPoints = localStorage.getItem("tacpadel_tac_points");
          if (savedTacPoints) setTacPoints(parseInt(savedTacPoints, 10));
          
          const savedScore = localStorage.getItem("tacpadel_score");
          if (savedScore) setTacScore(parseInt(savedScore, 10));
        }

      } catch (err) {
        console.error("Fehler beim Laden der Daten:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    setShowLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('id, email, display_name, tac_points, points') 
        .order('tac_points', { ascending: false })
        .limit(10); 

      if (data && !error) {
        const formattedData = data.map((user: any) => {
          const emailFallback = user.email ? user.email.split('@')[0] : "Spieler XYZ";
          const finalName = user.display_name && user.display_name.trim() !== "" 
            ? user.display_name 
            : emailFallback;

          return {
            id: user.id,
            username: finalName,
            tac_points: user.tac_points || 0,
            points: user.points || 0
          };
        });
        
        setLeaderboardData(formattedData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

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
      case "master": return "text-fuchsia-400 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.4)]";
      case "pro": return "text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]";
      case "open": return "text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    }
  };

  const getTypeBg = (type: TourType) => {
    switch (type) {
      case "master": return "from-fuchsia-900/40 to-fuchsia-950/20";
      case "pro": return "from-cyan-900/40 to-cyan-950/20";
      case "open": return "from-emerald-900/40 to-emerald-950/20";
    }
  };

  // -----------------------------------------------------------
  // AKTUALISIERT: Re-Buy / Straf-Logik (Verwendet getRetryFee)
  // -----------------------------------------------------------
  const handleRetryTournament = async (tour: Tournament) => {
    const retryFee = getRetryFee(tour);

    if (tacPoints < retryFee) {
      alert(`Zu wenig TacPoints! Ein Retry kostet ${retryFee} TP.`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. TacPoints (Geld) abziehen
      const newTacPoints = tacPoints - retryFee;
      setTacPoints(newTacPoints);
      localStorage.setItem("tacpadel_tac_points", newTacPoints.toString());
      
      if (session?.user) {
        // Punkte in user_stats updaten
        await supabase.from('user_stats').update({ tac_points: newTacPoints }).eq('id', session.user.id);
        
        // 2. Status in DB wieder auf "active" und Runde auf 1 setzen
        await supabase.from("tour_progress").update({ 
          status: "active", 
          current_round: 1 
        }).eq("user_id", session.user.id).eq("tournament_id", tour.id);
      }

      // 3. Lokalen State aktualisieren
      setProgress(prev => ({
        ...prev,
        [tour.id]: { tournament_id: tour.id, status: "active", current_round: 1 }
      }));

      // 4. Match sofort wieder in Runde 1 starten
      if (onStartMatch) {
        onStartMatch(tour.id, 1, tour.baseDifficulty, tour.tacPointsReward);
      }

    } catch (err) {
      console.error("Fehler beim Retry des Turniers:", err);
      alert("Fehler beim Zurücksetzen. Bitte versuche es erneut.");
    }
  };

  const handleStartTournament = async (tour: Tournament) => {
    const currentStatus = progress[tour.id];

    if (currentStatus?.status === "eliminated" || currentStatus?.status === "won") {
      alert("Du hast dieses Turnier in der Beta bereits beendet.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!currentStatus) {
        if (tacPoints < tour.entryFee) {
           alert(`Zu wenig TacPoints! Du brauchst ${tour.entryFee} TP Startgeld.`);
           return;
        }

        if (tour.entryFee > 0) {
           const newTacPoints = tacPoints - tour.entryFee;
           setTacPoints(newTacPoints);
           localStorage.setItem("tacpadel_tac_points", newTacPoints.toString());
           
           if (session?.user) {
             await supabase.from('user_stats').update({ tac_points: newTacPoints }).eq('id', session.user.id);
           }
        }

        if (session?.user) {
            const { error } = await supabase.from("tour_progress").insert({
            user_id: session.user.id,
            tournament_id: tour.id,
            status: "active",
            current_round: 1
            });
            if (error) throw error;
        }
        
        setProgress(prev => ({
          ...prev,
          [tour.id]: { tournament_id: tour.id, status: "active", current_round: 1 }
        }));

        if (onStartMatch) {
            onStartMatch(tour.id, 1, tour.baseDifficulty, tour.tacPointsReward);
        }

      } else {
        if (onStartMatch) {
          onStartMatch(tour.id, currentStatus.current_round, tour.baseDifficulty, tour.tacPointsReward);
        } 
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

  // Sperr-Zustand berechnen
  const isTourLocked = !loading && tacScore < TOUR_UNLOCK_SCORE;

  return (
    <div className="w-full h-full flex flex-col bg-[#02050a] text-slate-200 relative overflow-hidden pointer-events-auto">
      
      {/* HINTERGRUND GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>

      {/* --- HEADER --- */}
      <div className="flex flex-col items-center w-full px-4 pt-6 pb-4 shrink-0 relative border-b border-slate-800/50 bg-[#050b18]/90 backdrop-blur-md z-10">
        <button 
          onClick={onClose}
          className="absolute left-4 top-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors z-20 shadow-md"
        >
          ✕
        </button>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-[0.2em] uppercase mt-1 drop-shadow-[0_0_10px_rgba(56,189,248,0.4)]">
          Beta Season <span className="text-sky-400">1</span>
        </h1>
        <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-4 text-center">
          Sammle TacPoints und klettere im Ranking
        </p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          
          <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border border-emerald-500/30 bg-emerald-950/30 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
            <span className="text-emerald-400 font-black text-sm tracking-wider drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]">{tacScore}</span>
            <span className="text-[7px] text-emerald-500/70 uppercase tracking-widest font-bold mt-0.5">TacScore</span>
          </div>

          <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border border-amber-500/30 bg-amber-950/30 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]">
            <span className="text-amber-400 font-black text-sm tracking-wider drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]">{tacPoints}</span>
            <span className="text-[7px] text-amber-500/70 uppercase tracking-widest font-bold mt-0.5">TacPoints</span>
          </div>

          <button 
            onClick={fetchLeaderboard}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border border-indigo-500/40 bg-indigo-900/20 hover:bg-indigo-900/40 transition-colors shadow-[inset_0_0_10px_rgba(99,102,241,0.15)] active:scale-95"
          >
            <span className="text-indigo-400 font-black text-sm tracking-wider drop-shadow-[0_0_5px_rgba(99,102,241,0.8)]">Ranking</span>
            <span className="text-[7px] text-indigo-500/70 uppercase tracking-widest font-bold mt-0.5">Beta Leaderboard</span>
          </button>

          <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border border-red-500/30 bg-red-950/30 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
            <span className="text-red-400 font-black text-xs tracking-wider">{timeLeft === "BETA BEENDET" ? "BEENDET" : timeLeft}</span>
            <div className="flex items-center gap-1 mt-0.5">
              {timeLeft !== "BETA BEENDET" && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>}
              <span className="text-[7px] text-red-500/70 uppercase tracking-widest font-bold">Beta Ends</span>
            </div>
          </div>
        </div>
      </div>
      {/* --- ENDE HEADER --- */}


      {/* --- CONTENT AREA: TURNIER-LISTE ODER LOCK-SCREEN --- */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar z-10 flex flex-col pb-20 relative">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 rounded-full border-t-2 border-fuchsia-500 animate-spin"></div>
          </div>
        ) : isTourLocked ? (
          
          /* ========================================================= */
          /* LOCK SCREEN                                               */
          /* ========================================================= */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 h-full px-4"
          >
            <div className="w-20 h-20 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
              <span className="text-4xl">🔒</span>
              <div className="absolute inset-0 rounded-full border-2 border-slate-600 border-t-emerald-500 animate-[spin_4s_linear_infinite] opacity-50"></div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-widest text-center mb-3 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              TP Tour Gesperrt
            </h2>
            
            <p className="text-slate-400 text-center text-sm font-medium mb-8 max-w-xs leading-relaxed">
              Beweise dich erst im Einzelmatch. Du benötigst <strong className="text-emerald-400 font-black">{TOUR_UNLOCK_SCORE} TacScore</strong>, um an offiziellen Turnieren teilzunehmen.
            </p>

            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-full h-4 mb-2 overflow-hidden relative shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, (tacScore / TOUR_UNLOCK_SCORE) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between w-full max-w-sm px-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-10">
              <span>Aktuell: {tacScore}</span>
              <span className="text-emerald-500">Ziel: {TOUR_UNLOCK_SCORE}</span>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-2">
                 <div className="h-px bg-slate-800 flex-1"></div>
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Oder sofort freischalten</span>
                 <div className="h-px bg-slate-800 flex-1"></div>
              </div>
              <button 
                disabled
                className="w-full py-4 bg-gradient-to-r from-amber-600/10 to-yellow-600/10 border border-amber-500/30 text-amber-500/50 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <span>Pro Supporter Pass (Demnächst)</span>
              </button>
              <button 
                disabled
                className="w-full py-4 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/30 text-blue-400/50 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <span>Video schauen (Demnächst)</span>
              </button>
            </div>
          </motion.div>

        ) : (

          /* ========================================================= */
          /* TURNIER LISTE                                             */
          /* ========================================================= */
          <div className="flex flex-col gap-4">
            {TOURNAMENTS.map((tour) => {
              const dbProg = progress[tour.id];
              const isCompleted = dbProg?.status === 'won' || dbProg?.status === 'eliminated';
              const isEliminated = dbProg?.status === 'eliminated';
              
              const isLockedByScore = tacScore < tour.reqScore;
              const isLockedByFunds = tacPoints < tour.entryFee && !dbProg; 
              
              const retryFee = getRetryFee(tour);

              return (
                <motion.div 
                  key={tour.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTour(tour)}
                  className={`relative p-[1px] rounded-xl cursor-pointer bg-gradient-to-br ${!isCompleted || dbProg?.status === 'eliminated' ? 'from-orange-500 via-slate-800 to-orange-500 animate-pulse' : 'from-slate-700 to-slate-900'} ${dbProg?.status === 'won' ? 'opacity-50 grayscale-[0.3]' : ''}`}
                >
                  <div className={`w-full h-full bg-gradient-to-br ${getTypeBg(tour.type)} p-4 rounded-xl flex flex-col bg-[#050b14]`}>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${getTypeColor(tour.type)} bg-black/50`}>
                          {tour.type === "master" ? "Premier Master" : tour.type === "pro" ? "Pro" : "Open"}
                        </span>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider mt-2 drop-shadow-lg">{tour.name}</h3>
                      </div>
                      
                      {/* STATUS BADGE */}
                      {!isCompleted && dbProg?.status === "active" && (
                        <span className="text-[10px] font-black text-orange-400 bg-orange-950/50 border border-orange-500 px-2 py-1 rounded animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.3)]">
                          LÄUFT (Runde {dbProg.current_round})
                        </span>
                      )}
                      {dbProg?.status === "won" && (
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-950/50 border border-emerald-500 px-2 py-1 rounded">
                          GEWONNEN 🏆
                        </span>
                      )}
                      {isEliminated && (
                        <span className="text-[10px] font-black text-red-500 bg-red-950/50 border border-red-500 px-2 py-1 rounded">
                          AUSGESCHIEDEN 💀
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Entry TacScore</span>
                        <span className={`text-sm font-black ${
                          tour.reqScore === 0 
                            ? 'text-slate-300' 
                            : !isLockedByScore 
                              ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' 
                              : 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                        }`}>
                          {tour.reqScore === 0 ? "Offen" : `${tour.reqScore}`}
                        </span>
                      </div>
                      
                      <div className="w-[1px] h-6 bg-slate-700"></div>
                      
                      <div className="flex flex-col">
                        {/* DYNAMISCHES TEXT LABEL FÜR STRAFE ODER ENTRY */}
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${isEliminated ? 'text-red-400/80' : 'text-slate-500'}`}>
                          {isEliminated ? 'Re-Buy Strafe' : 'Startgeld'}
                        </span>
                        
                        {/* DYNAMISCHER PREIS (Strafe vs Entry) */}
                        <span className={`text-sm font-black flex items-center gap-1 ${
                          isEliminated
                            ? (tacPoints >= retryFee ? 'text-red-400' : 'text-red-600 line-through')
                            : (tour.entryFee === 0 
                                ? 'text-emerald-400' 
                                : !isLockedByFunds 
                                  ? 'text-amber-400'
                                  : 'text-red-500 line-through')
                        }`}>
                          {isEliminated ? `${retryFee} TP` : (tour.entryFee === 0 ? "Frei" : `${tour.entryFee} TP`)}
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
            })}
          </div>
        )}
      </div>


      
      <AnimatePresence>
        {selectedTour && (() => {
          const dbProg = progress[selectedTour.id];
          const isCompleted = dbProg?.status === 'won' || dbProg?.status === 'eliminated';
          const isEliminated = dbProg?.status === 'eliminated';
          
          const isLockedByScore = tacScore < selectedTour.reqScore;
          const isLockedByFunds = tacPoints < selectedTour.entryFee && !dbProg;
          
          const isLocked = isLockedByScore || isLockedByFunds;

          // Retry Logik mit ZENTRALER FUNKTION
          const retryFee = getRetryFee(selectedTour);
          const canAffordRetry = tacPoints >= retryFee;

          // Text für normalen Start/Continue Button
          let btnText = "Beta-Run Starten";
          if (dbProg?.status === 'won') btnText = 'Turnier Beendet (Sieger)';
          else if (isLockedByScore) btnText = `Gesperrt: ${selectedTour.reqScore} TacScore nötig`;
          else if (isLockedByFunds) btnText = `Gesperrt: Zu wenig TacPoints (${selectedTour.entryFee} nötig)`;
          else if (!dbProg && selectedTour.entryFee > 0) btnText = `Buy-In zahlen (${selectedTour.entryFee} TP) & Starten`;
          else if (dbProg) btnText = `Weiter spielen (Runde ${dbProg.current_round})`;

          return (
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
                  
                  <div className="mt-2 bg-slate-900 border border-slate-700 px-3 py-1 rounded text-xs text-slate-400 flex gap-4 items-center">
                    <span>KI-Level: <span className="font-bold text-white">{selectedTour.baseDifficulty}</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    
                    {/* DYNAMISCHES HEADER LABEL IM POPUP */}
                    {isEliminated ? (
                      <span className="text-red-400 font-black drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">
                        Re-Buy Strafe: {retryFee} TP
                      </span>
                    ) : (
                      <span className="text-amber-400 font-black">
                        Buy-In: {selectedTour.entryFee === 0 ? "Frei" : `${selectedTour.entryFee} TP`}
                      </span>
                    )}
                  </div>
                </div>

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

                {/* --- DYNAMISCHER BUTTON BEREICH --- */}
                {isEliminated ? (
                  <div className="w-full flex flex-col gap-2">
                    <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Nicht aufgeben!</p>
                    <button 
                      disabled={!canAffordRetry}
                      onClick={() => handleRetryTournament(selectedTour)}
                      className={`w-full py-5 font-black tracking-[0.1em] uppercase rounded-xl transition-all shrink-0 ${
                        canAffordRetry
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      {!canAffordRetry 
                        ? `Zweite Chance: Zu wenig TP (${retryFee} nötig)` 
                        : `🔄 Zweite Chance (${retryFee} TP)`}
                    </button>
                  </div>
                ) : (
                  <button 
                    disabled={isCompleted || isLocked}
                    onClick={() => handleStartTournament(selectedTour)}
                    className={`w-full py-5 font-black tracking-[0.1em] uppercase rounded-xl transition-all shrink-0 ${
                      !isLocked && !isCompleted
                        ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-[0_0_20px_rgba(255,119,0,0.4)]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {btnText}
                  </button>
                )}

              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      
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
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">Beta Ranking</h2>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Die Top Tester der TP Tour</p>
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
                    Noch keine Tester im Ranking.
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
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none">TacScore</span>
                            <span className="text-xs font-black text-slate-300">
                              {player.points || 0}
                            </span>
                          </div>

                          <div className="w-px h-6 bg-slate-700/50"></div>
                          
                          <div className="flex flex-col items-end w-14">
                            <span className="text-[9px] font-black uppercase text-indigo-500/70 tracking-widest leading-none">TacPoints</span>
                            <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                              {player.tac_points}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* STATISTIKEN OVERLAY */}
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
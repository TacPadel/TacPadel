import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface PublicProfileModalProps {
  userId: string;
  onClose: () => void;
}

export default function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Statistiken
  const [winRate, setWinRate] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [aggStats, setAggStats] = useState({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      
      // 1. Profil laden
      const { data: profileData } = await supabase
        .from('user_stats')
        .select('display_name, avatar_url, points') // preferred_position wurde hier auch entfernt
        .eq('id', userId)
        .maybeSingle();

      if (profileData) setProfile(profileData);

      // 2. Match-Historie für Stats laden
      const { data: historyData } = await supabase
        .from('match_history')
        .select('result, aces, winners, unforced_errors, total_shots, shots_perfect')
        .eq('user_id', userId);

      if (historyData && historyData.length > 0) {
        // Win/Loss
        const w = historyData.filter(m => m.result === 'win').length;
        const l = historyData.filter(m => m.result === 'loss').length;
        setWins(w);
        setLosses(l);
        setWinRate((w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0);

        // Aggregierte Stats
        let tAces = 0, tWinners = 0, tUfe = 0, tTotalShots = 0, tPerfect = 0;
        let validMatchCount = 0;

        historyData.forEach((match) => {
          if (match.total_shots > 0 || match.winners > 0 || match.unforced_errors > 0) {
             tAces += match.aces || 0;
             tWinners += match.winners || 0;
             tUfe += match.unforced_errors || 0;
             tTotalShots += match.total_shots || 0;
             tPerfect += match.shots_perfect || 0;
             validMatchCount++;
          }
        });

        if (validMatchCount > 0) {
           setAggStats({
             avgWinners: Math.round((tWinners / validMatchCount) * 10) / 10,
             avgAces: Math.round((tAces / validMatchCount) * 10) / 10,
             avgErrors: Math.round((tUfe / validMatchCount) * 10) / 10,
             perfectRatio: tTotalShots > 0 ? Math.round((tPerfect / tTotalShots) * 100) : 0
           });
        }
      }
      setLoading(false);
    };

    if (userId) fetchUser();
  }, [userId]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        
        {/* Schließt das Modal, wenn man auf den unsichtbaren Hintergrund klickt */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#040914] border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden"
        >
          {/* Schließen Button Oben Rechts */}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors z-10">
            ✕
          </button>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-48">
              <span className="text-cyan-400 font-black tracking-widest uppercase animate-pulse">Scanne Spieler-Akte...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6 relative z-0">
              
              {/* KOPFBEREICH */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-cyan-900/30 flex items-center justify-center text-4xl border-2 border-dashed border-cyan-500/50">👤</div>
                  )}
                </div>
                
                <div className="text-center mt-2">
                  <h2 className="text-2xl font-black text-white">{profile?.display_name || 'Unbekannter Spieler'}</h2>
                  <p className="text-purple-400 font-bold text-sm tracking-widest uppercase mt-1">{profile?.points || 0} Pkt.</p>
                </div>
              </div>

              {/* MATCH BILANZ */}
              <div className="bg-[#050b18] border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]">
                <div>
                  <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Match Bilanz</h3>
                  <div className="flex gap-3 text-[10px] font-black tracking-widest uppercase mt-2">
                    <span className="text-emerald-400">{wins} W</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-red-400">{losses} L</span>
                  </div>
                </div>
                <div className="relative w-14 h-14 flex items-center justify-center rounded-full border-4 shadow-inner" style={{ borderColor: winRate > 50 ? '#10b981' : winRate > 30 ? '#f59e0b' : '#ef4444' }}>
                  <span className="text-sm font-black text-white">{winRate}%</span>
                </div>
              </div>

              {/* SCHLAG ANALYSE */}
              <div>
                <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">Ø Schlag-Analyse</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#050b18] py-3 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-black text-white">{aggStats.avgWinners}</span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mt-1">Winner</span>
                  </div>
                  <div className="bg-[#050b18] py-3 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-black text-emerald-400">{aggStats.perfectRatio}%</span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mt-1">Perfekt</span>
                  </div>
                  <div className="bg-[#050b18] py-3 rounded-lg border border-red-900/20 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-black text-red-400">{aggStats.avgErrors}</span>
                    <span className="text-[8px] text-red-900/80 uppercase tracking-widest font-bold mt-1">UFE</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
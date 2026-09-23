import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { supabase } from '../lib/supabase';

// --- NEU: 3D Imports für den Spind ---
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import PlayerShow from "./PlayerShow"; // Passe den Pfad an, falls deine Datei anders heißt oder woanders liegt!

export default function ProfileTab({ user, setActiveTab }: { user: any, setActiveTab: (t: string) => void }) {
  const fallbackName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "";
  const [username, setUsername] = useState(fallbackName);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [isUploading, setIsUploading] = useState(false);

  const [showExplanations, setShowExplanations] = useState(() => {
    return localStorage.getItem("tacpadel_show_explanations") !== "false";
  });
  const toggleExplanations = () => {
    const newVal = !showExplanations;
    setShowExplanations(newVal);
    localStorage.setItem("tacpadel_show_explanations", newVal.toString());
  };

  // --- States für das Dashboard ---
  const [matchHistory, setMatchHistory] = useState<any[]>([]);

  const [showNameTags, setShowNameTags] = useState(() => {
    return localStorage.getItem("tacpadel_show_nametags") !== "false";
  });

  const toggleNameTags = () => {
    const newVal = !showNameTags;
    setShowNameTags(newVal);
    localStorage.setItem("tacpadel_show_nametags", newVal.toString());
  };
  
  const [currentScore, setCurrentScore] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_score");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [preferredPosition, setPreferredPosition] = useState<string>(() => {
    return localStorage.getItem("tacpadel_preferred_position") || "Rechts";
  });
  
  // --- State für die aggregierten Schlag-Daten ---
  const [aggStats, setAggStats] = useState({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });
  const [matchesWithStats, setMatchesWithStats] = useState(0);

  // --- States für Audio, Musik & Mechanik ---
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("tacpadel_sound") !== "false");
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem("tacpadel_music") !== "false");
  
  // NEU: State für Ausdauer-System
  const [staminaEnabled, setStaminaEnabled] = useState(() => localStorage.getItem("tacpadel_stamina") !== "false");

  useEffect(() => {
    const loadUserData = async () => {
      // 1. Profil & aktuellen Score laden
      const { data: profileData } = await supabase
        .from('user_stats')
        .select('display_name, avatar_url, points, preferred_position')
        .eq('id', user.id)
        .maybeSingle();

      let trueScore = currentScore; // Basis ist erstmal der lokale Score

      if (profileData) {
        if (profileData.display_name) setUsername(profileData.display_name);
        if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
        if (profileData.points != null) trueScore = profileData.points;
        
        if (profileData.preferred_position) {
          setPreferredPosition(profileData.preferred_position);
          localStorage.setItem("tacpadel_preferred_position", profileData.preferred_position);
        } else {
          // Falls in Supabase noch gar kein Wert steht, laden wir unseren lokalen Wert hoch!
          const localPos = localStorage.getItem("tacpadel_preferred_position") || "Rechts";
          await supabase.from('user_stats').update({ preferred_position: localPos }).eq('id', user.id);
        }
      }

      // 2. Match Historie laden (inkl. Schlag-Statistiken)
      const { data: historyData } = await supabase
        .from('match_history')
        .select('points, result, created_at, aces, winners, unforced_errors, total_shots, shots_perfect')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }) 
        .limit(20);

      if (historyData && historyData.length > 0) {
        // --- NEU: Wir nehmen IMMER den Score aus dem absolut letzten Match als Wahrheit! ---
        // Das verhindert jegliche Asynchronität zwischen user_stats und match_history.
        const lastMatch = historyData[historyData.length - 1];
        if (lastMatch.points != null) {
          trueScore = lastMatch.points;
        }

        // A) Daten für den Chart formatieren
        const formattedData = historyData.map((match) => {
          const date = new Date(match.created_at);
          return {
            name: `${date.getDate()}.${date.getMonth() + 1}.`,
            score: match.points,
            result: match.result
          };
        });
        setMatchHistory(formattedData);

        // B) Daten für die Tiefenanalyse (Durchschnitt) berechnen
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
           setMatchesWithStats(validMatchCount);
           setAggStats({
             avgWinners: Math.round((tWinners / validMatchCount) * 10) / 10,
             avgAces: Math.round((tAces / validMatchCount) * 10) / 10,
             avgErrors: Math.round((tUfe / validMatchCount) * 10) / 10,
             perfectRatio: tTotalShots > 0 ? Math.round((tPerfect / tTotalShots) * 100) : 0
           });
        }
      } else {
        setMatchHistory([{ name: 'Start', score: trueScore }]);
      }

      // --- UI & LocalStorage updaten ---
      setCurrentScore(trueScore);
      localStorage.setItem("tacpadel_score", trueScore.toString());
      
      // --- SELF-HEALING: Datenbank synchronisieren ---
      // Falls in user_stats gar kein Eintrag war, legen wir ihn an. 
      // Falls der Score asynchron war, überschreiben wir ihn mit dem korrekten aus der Historie!
      if (!profileData) {
        await supabase.from('user_stats').upsert({ id: user.id, points: trueScore, preferred_position: preferredPosition });
      } else if (profileData.points !== trueScore) {
        await supabase.from('user_stats').update({ points: trueScore }).eq('id', user.id);
      }
    };
    
    loadUserData();
  }, [user.id]);

  const handlePositionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPos = e.target.value;
    setPreferredPosition(newPos);
    
    // SOFORT in den lokalen Speicher schreiben!
    localStorage.setItem("tacpadel_preferred_position", newPos);
    
    // Wieder sicheres update() statt upsert() verwenden!
    const { error } = await supabase
      .from('user_stats')
      .update({ preferred_position: newPos })
      .eq('id', user.id);
    
    if (error) {
      console.error("Fehler beim Speichern der Position:", error);
    } else {
      // Kleines Feedback, dass es erfolgreich war
      setMessage({ type: 'success', text: `Position erfolgreich auf ${newPos} geändert!` });
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setMessage(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Bitte wähle ein Bild aus.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      const { error: dbError } = await supabase
        .from('user_stats')
        .update({ avatar_url: publicUrl }) // <-- UPDATE statt UPSERT
        .eq('id', user.id);

      if (dbError) throw dbError;

      setAvatarUrl(publicUrl);
      setMessage({ type: 'success', text: "Profilbild erfolgreich aktualisiert!" });
      setTimeout(() => setMessage(null), 3000);

    } catch (error: any) {
      setMessage({ type: 'error', text: "Fehler beim Hochladen: " + error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    const newName = username.trim();

    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    
    const { error: dbError } = await supabase
      .from('user_stats')
      .update({ display_name: newName }) // <-- UPDATE statt UPSERT
      .eq('id', user.id);
    
    setIsSaving(false);

    if (authError || dbError) {
      setMessage({ type: 'error', text: "Fehler beim Speichern: " + (authError?.message || dbError?.message) });
    } else {
      setMessage({ type: 'success', text: "Benutzername erfolgreich aktualisiert!" });
      setTimeout(() => setMessage(null), 3000); 
    }
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem("tacpadel_sound", String(newState));
  };

  const toggleMusic = () => {
    const newState = !musicEnabled;
    setMusicEnabled(newState);
    localStorage.setItem("tacpadel_music", String(newState));
  };
  
  // NEU: Toggle für das Ausdauer-System
  const toggleStamina = () => {
    const newState = !staminaEnabled;
    setStaminaEnabled(newState);
    localStorage.setItem("tacpadel_stamina", String(newState));
  };

  // --- Win/Loss Berechnung ---
  const wins = matchHistory.filter(m => m.result === 'win').length;
  const losses = matchHistory.filter(m => m.result === 'loss').length;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col items-center justify-start p-4 sm:p-8 bg-[#040914]/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl max-w-3xl mx-auto mt-6 mb-24 gap-6 w-full"
    >
      
      {/* ========================================= */}
      {/* 1. KOPFBEREICH: Avatar & Name             */}
      {/* ========================================= */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full">
        {/* Avatar Upload */}
        <div className="relative flex flex-col items-center shrink-0">
          <label 
            htmlFor="avatar-upload" 
            className={`relative cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Profilbild" 
                className="w-28 h-28 rounded-full object-cover border-4 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:border-cyan-500/50 transition-colors"
              />
            ) : (
              <div className="w-28 h-28 bg-cyan-950/30 rounded-full flex items-center justify-center mx-auto text-cyan-500 text-5xl border-2 border-dashed border-cyan-500/50 group-hover:bg-cyan-900/50 transition-colors shadow-sm">
                👤
              </div>
            )}
            <div className="absolute bottom-0 right-0 bg-background border border-border rounded-full p-2.5 shadow-md text-sm group-hover:scale-110 transition-transform">
              ✏️
            </div>
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            disabled={isUploading}
            className="hidden"
          />
          {isUploading && (
            <span className="text-[10px] text-cyan-400 mt-3 font-bold animate-pulse uppercase tracking-wider">
              Lädt hoch...
            </span>
          )}
        </div>

        {/* Name & Account Details */}
        <div className="flex flex-col gap-3 w-full">
          <h2 className="text-2xl font-black text-white tracking-wide text-center md:text-left">Spieler-Akte</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase ml-1">E-Mail</label>
              <div className="px-4 py-3 bg-[#030611] border border-slate-800 rounded-xl text-slate-500 text-xs font-semibold cursor-not-allowed">
                {user?.email}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold tracking-widest text-cyan-500 uppercase ml-1">Benutzername</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Dein Spielername..."
                className="px-4 py-3 bg-[#050b18] border border-cyan-900/50 focus:border-cyan-400 rounded-xl text-white text-sm font-bold outline-none transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={isSaving || !username.trim()}
            className="w-full sm:w-auto self-end px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 mt-1"
          >
            {isSaving ? "Speichert..." : "Namen speichern"}
          </button>
          
          {message && (
            <div className={`w-full p-2.5 rounded-lg text-xs font-bold text-center ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />

      {/* ======================================================== */}
      {/* 1.5 3D UMKLEIDEKABINE (Locker Room)                      */}
      {/* ======================================================== */}
      <div className="w-full bg-[#050b14] border border-slate-800 rounded-2xl p-5 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">
            Dein Spind
          </h3>
          <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/30 rounded border border-cyan-900/50">
            3D Ansicht
          </span>
        </div>

        {/* 3D Canvas Container */}
        <div className="w-full h-64 sm:h-72 bg-[#03060c] rounded-xl border border-slate-800/80 overflow-hidden relative shadow-inner cursor-grab active:cursor-grabbing">
          
          {/* Atmosphärische Neon-Beleuchtung im Hintergrund (CSS) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/40 blur-[40px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-orange-500/40 blur-[40px] pointer-events-none" />

          <Canvas camera={{ position: [0, 1.2, 4], fov: 45 }}>
            <ambientLight intensity={2.5} />
            
            <directionalLight position={[0, 1.5, 3]} intensity={2.5} color="#ffffff" />
            
            <spotLight 
              position={[0, 4, 1]} 
              intensity={3.0} 
              angle={0.8} 
              penumbra={1} 
            />
            
            <pointLight position={[-1.5, 1.5, 1.5]} intensity={15} color="#00f0ff" distance={10} />
            <pointLight position={[1.5, 1.5, 1.5]} intensity={15} color="#ff7700" distance={10} />

            <PlayerShow />

            <OrbitControls 
              enableZoom={false} 
              enablePan={false} 
              autoRotate 
              autoRotateSpeed={0.5}
              minPolarAngle={Math.PI / 2.5} 
              maxPolarAngle={Math.PI / 2} 
            />
          </Canvas>
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />
      
      {/* ========================================= */}
      {/* 2. STATS & AUSRÜSTUNG                     */}
      {/* ========================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        
        {/* Gamer Card & Stats */}
        <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black tracking-widest text-orange-400 uppercase mb-4 flex justify-between">
              <span>Spielstil & Ausrüstung</span>
              <span className="text-slate-600">Locker</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Position */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Position</span>
                <p className="font-bold text-slate-200 text-xs mt-0.5 leading-tight">Coming soon...</p>
              </div>
              {/* Schläger */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Schläger</span>
                <p className="font-bold text-slate-200 text-xs mt-0.5 leading-tight">Coming soon...</p>
              </div>
              {/* Ausrüstung */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Ausrüstung</span>
                <p className="font-bold text-slate-200 text-xs mt-0.5 leading-tight">Coming soon...</p>
              </div>
              {/* Powerschlag */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Powerschlag</span>
                <p className="font-bold text-slate-200 text-xs mt-0.5 leading-tight">Coming soon...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black tracking-widest text-purple-400 uppercase">Tournament Roadmap</h3>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30">In Progress</span>
            </div>
            
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-bold text-slate-300">50er</span>
              <span className="text-[10px] font-black tracking-widest text-purple-400">{currentScore} / 5000 Pkt.</span>
              <span className="text-xs font-bold text-slate-300">250er</span>
            </div>
            <div className="w-full h-2.5 bg-[#050b18] border border-slate-800 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-cyan-400 shadow-[0_0_15px_rgba(168,85,247,0.6)] transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min(100, Math.max(10, (currentScore / 5000) * 100))}%` }} 
              />
            </div>
            
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed mt-4 bg-[#050b18] p-3 rounded-lg border border-slate-800/50">
              Sammle TacScore-Punkte und Matchpraxis, um das Ticket für die kompetitiven 250er-Klassen zu lösen.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2.5 MATCH BILANZ                            */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-row justify-between items-center">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Match Bilanz</h3>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Siegquote & Historie</span>
        </div>
        
        <div className="flex items-center gap-5 sm:gap-8">
          <div className="flex gap-3 sm:gap-4 text-[10px] font-black tracking-widest uppercase items-center">
            <span className="text-emerald-400 text-xs sm:text-sm">{wins} W</span>
            <span className="text-slate-600">|</span>
            <span className="text-red-400 text-xs sm:text-sm">{losses} L</span>
          </div>
          
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full border-4 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" 
               style={{ borderColor: winRate > 50 ? '#10b981' : winRate > 30 ? '#f59e0b' : '#ef4444' }}>
            <span className="text-xs sm:text-sm font-black text-white">{winRate}%</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 3. TIEFENANALYSE (SCHLAG-STATS)           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Schlag-Analyse (Avg. pro Match)</h3>
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/30">
            Letzte {matchesWithStats} Matches
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Winner */}
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgWinners}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">Winner</span>
          </div>
          {/* Asse */}
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgAces}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">Asse</span>
          </div>
          {/* Fehler */}
          <div className="bg-[#050b18] py-4 rounded-lg border border-red-900/20 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
            <span className="text-2xl font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{aggStats.avgErrors}</span>
            <span className="text-[9px] text-red-900/80 uppercase tracking-widest font-bold mt-1">Fehler (UFE)</span>
          </div>
          {/* Perfekte Schläge */}
          <div className="bg-[#050b18] py-4 rounded-lg border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-[inset_0_0_15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{aggStats.perfectRatio}%</span>
            <span className="text-[9px] text-emerald-700/80 uppercase tracking-widest font-bold mt-1">Perfekte Schläge</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 4. TAC-SCORE CHART                        */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 h-[280px] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">Performance Historie</h3>
          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30">Letzte 20 Matches</span>
        </div>
        
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={matchHistory}>
              <XAxis dataKey="name" stroke="#475569" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontWeight: 'bold' }} 
                itemStyle={{ color: '#22d3ee' }}
                labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#06b6d4" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#06b6d4', stroke: '#0f172a', strokeWidth: 2 }} 
                activeDot={{ r: 6, fill: '#fff', stroke: '#06b6d4' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================= */}
      {/* 5. AUDIO & UI SETTINGS                      */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center sm:text-left">
          <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Audio & UI</h3>
          <span className="text-[9px] text-slate-600 font-bold mt-1">Musik, SFX und Texte/Namen steuern</span>
        </div>
        
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
          {/* SFX Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SFX</span>
            <button 
              onClick={toggleSound}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${soundEnabled ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-slate-700'}`}
            >
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: soundEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>

          {/* Music Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Musik</span>
            <button 
              onClick={toggleMusic}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${musicEnabled ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-700'}`}
            >
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: musicEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>

          {/* Text Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Texte</span>
            <button 
              onClick={toggleExplanations}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showExplanations ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-700'}`}
            >
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showExplanations ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>

          {/* Name Tags Toggle (JETZT HIER IN BLOCK 5) */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Namen</span>
            <button 
              onClick={toggleNameTags}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showNameTags ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-700'}`}
            >
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showNameTags ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 6. SPIELMECHANIK SETTINGS                   */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center sm:text-left">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Spielmechanik</h3>
          <span className="text-[9px] text-slate-600 font-bold mt-1">Simulations-Limits und Mechaniken steuern</span>
        </div>
        
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
          {/* Stamina Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ausdauer</span>
            <button 
              onClick={toggleStamina}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${staminaEnabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
            >
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: staminaEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setActiveTab("home")}
        className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest transition-colors mt-2"
      >
        ← Zurück zum Menü
      </button>

    </motion.div>
  );
}
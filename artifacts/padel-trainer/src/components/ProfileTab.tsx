import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import * as THREE from 'three'; // <-- NEUER IMPORT FÜR DIE LINIEN

// --- Imports für KI-Profile & 3D ---
import { AI_PROFILES } from '../engine/AiProfiles'; 
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import PlayerShow from "./PlayerShow"; 

// ==========================================
// --- RPG MOCK DATENBANK (Reines UI-Mockup) ---
// ==========================================
const RACKETS = [
  { id: 'racket_starter', name: 'Rookie Frame Basic', modifiers: { smash: 0, control: 0, defense: 0, agility: 0 } },
  { id: 'racket_aero', name: 'Aero Swift Pro X', modifiers: { smash: 3, control: 2, defense: 0, agility: 5 } },
  { id: 'racket_titan', name: 'Titan Matrix CTRL', modifiers: { smash: -2, control: 7, defense: 3, agility: 0 } },
  { id: 'racket_eclipse', name: 'Eclipse Carbon Strike', modifiers: { smash: 4, control: 3, defense: -2, agility: 1 } },
];

const getPartnerModifiers = (partnerId: string) => {
  const p = AI_PROFILES.flatMap(prof => [
    { id: `${prof.id}-1`, style: prof.style },
    { id: `${prof.id}-2`, style: prof.style }
  ]).find(x => x.id === partnerId);
  
  const style = p?.style?.toLowerCase() || '';
  
  if (style.includes('aggressiv') || style.includes('finisher')) return { smash: 6, control: -2, defense: -3, agility: 2 };
  if (style.includes('taktik') || style.includes('control')) return { smash: -2, control: 6, defense: 3, agility: -1 };
  if (style.includes('defensiv') || style.includes('mauer')) return { smash: -3, control: 2, defense: 6, agility: 1 };
  
  return { smash: 2, control: 2, defense: 2, agility: 2 };
};

// ==========================================
// --- 3D TRON TROPHIES (Hologramm Style Bild-getreu) ---
// ==========================================
function TronTrophy({ position, tourId, onClick }: { position: [number, number, number], tourId: string, onClick: (id: string) => void }) {
  const ref = useRef<any>(null);
  
  // Sanfte Rotation der gesamten Trophäe
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });

  const idLower = tourId.toLowerCase();
  const isMaster = idLower.includes('master');
  const isPro = idLower.includes('pro');
  
  const color = isMaster ? "#fbbf24" : isPro ? "#bae6fd" : "#d97706";
  const intensity = isMaster ? 3 : isPro ? 2.5 : 2.5;

  // --- NEU: Durchgehende Energie-Strudel (Tubes) ---
  const { curve1, curve2 } = useMemo(() => {
    const spiralSegments = 60;
    const pts1 = [];
    const pts2 = [];
    
    for (let i = 0; i <= spiralSegments; i++) {
      const t = i / spiralSegments; // 0.0 bis 1.0
      const radius = 0.4 - (t * 0.15); // Strudel wird nach oben hin enger
      const y = 0.3 + (t * 1.0); // Zieht sich 1.0 Einheiten nach oben
      
      // Erste Linie
      const angle1 = t * Math.PI * 4; 
      pts1.push(new THREE.Vector3(Math.cos(angle1) * radius, y, Math.sin(angle1) * radius));
      
      // Zweite Linie (um 180 Grad bzw. Math.PI versetzt)
      const angle2 = t * Math.PI * 4 + Math.PI; 
      pts2.push(new THREE.Vector3(Math.cos(angle2) * radius, y, Math.sin(angle2) * radius));
    }
    
    return {
      curve1: new THREE.CatmullRomCurve3(pts1),
      curve2: new THREE.CatmullRomCurve3(pts2)
    };
  }, []);

  return (
    <group position={position} scale={0.8} onClick={(e) => { e.stopPropagation(); onClick(tourId); }}>
      
      {/* Unsichtbare Hitbox zum Anklicken */}
      <mesh visible={false} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.5, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <group ref={ref}>
        
        {/* === SOCKEL === */}
        <group position={[0, 0.2, 0]}>
          <mesh>
            <cylinderGeometry args={[0.45, 0.65, 0.4, 6]} />
            <meshStandardMaterial color="#020617" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.46, 0.66, 0.41, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.8} wireframe />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.67, 0.67, 0.02, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} />
          </mesh>
          
          <group position={[0, 0, 0.53]} rotation={[0.2, 0, 0]}>
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[0.4, 0.2, 0.01]} />
              <meshStandardMaterial color="#020617" />
            </mesh>
            <Text 
              fontSize={0.15} 
              color="#ffffff" 
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
              fontWeight="bold"
            >
              TP
            </Text>
          </group>
        </group>

        {/* === DYNAMISCHER SWOOSH BOGEN IM HINTERGRUND === */}
        <mesh position={[0, 1.4, -0.15]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.85, 0.015, 16, 64, Math.PI * 1.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
        </mesh>

        {/* === ENERGIE-STRUDEL (Durchgehende Linien) === */}
        <group>
          <mesh>
            {/* args: [curve, tubularSegments, radius, radialSegments, closed] */}
            <tubeGeometry args={[curve1, 64, 0.012, 8, false]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} />
          </mesh>
          <mesh>
            <tubeGeometry args={[curve2, 64, 0.012, 8, false]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} />
          </mesh>
        </group>

        {/* === HOLOGRAPHISCHER PADLESCHLÄGER === */}
        <group position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 10]}>
          
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.6, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.6, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.3} wireframe />
          </mesh>
          
          <group position={[0, 1.1, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 0.03, 32]} />
              <meshStandardMaterial color="#020617" transparent opacity={0.7} roughness={0.2} metalness={0.9} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.5, 0.035, 16, 64]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.45, 0.45, 0.035, 16, 4]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.4} wireframe />
            </mesh>
            <Text 
              position={[0, 0, 0.02]} 
              fontSize={0.25} 
              color="#ffffff" 
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
              fontWeight="black"
            >
              TP
            </Text>
          </group>
        </group>

        {/* === TENNIS/PADEL BALL === */}
        <group position={[0.45, 0.65, 0.2]}>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color="#020617" roughness={0.4} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.185, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} wireframe />
          </mesh>
        </group>

      </group>
    </group>
  );
}

// --- NEUER VITRINENSCHRANK ---
function TronCabinet({ trophies, onTrophyClick }: { trophies: string[], onTrophyClick: (id: string) => void }) {
  const cols = 3; 
  const minShelves = 4; 
  const numShelves = Math.max(minShelves, Math.ceil(trophies.length / cols));
  
  const shelfHeight = 2.4; 
  const width = 5.5; 
  const depth = 1.8;
  const totalHeight = numShelves * shelfHeight;

  return (
    <group position={[0, -2, 0]}> 
      
      {/* Tron Boden-Grid */}
      <gridHelper args={[40, 40, '#0ea5e9', '#020617']} position={[0, -0.01, 0]} />
      
      {/* Vitrinen-Bodenplatte (Sockel) */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
        <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>

      {/* Vitrinen-Deckel (Dach) */}
      <mesh position={[0, totalHeight, 0]}>
        <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
        <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>

      {/* Vitrinen-Rückwand (Dunkel) */}
      <mesh position={[0, totalHeight / 2, -depth / 2]}>
        <boxGeometry args={[width, totalHeight, 0.1]} />
        <meshStandardMaterial color="#010308" />
      </mesh>

      {/* Vitrinen-Seitenglas (Links) */}
      <mesh position={[-width / 2, totalHeight / 2, 0]}>
        <boxGeometry args={[0.05, totalHeight, depth]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} />
      </mesh>

      {/* Vitrinen-Seitenglas (Rechts) */}
      <mesh position={[width / 2, totalHeight / 2, 0]}>
        <boxGeometry args={[0.05, totalHeight, depth]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} />
      </mesh>

      {/* Einlegeböden */}
      {Array.from({ length: numShelves }).map((_, rowIndex) => (
        <mesh key={`shelf-${rowIndex}`} position={[0, rowIndex * shelfHeight, 0]}>
          <boxGeometry args={[width, 0.05, depth]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Trophäen positionieren */}
      {trophies.map((tourId, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const xPos = (col - 1) * 1.6; // Positionen: -1.6, 0, 1.6
        const yPos = row * shelfHeight;
        
        return (
          <TronTrophy 
            key={`${tourId}-${idx}`} 
            tourId={tourId} 
            position={[xPos, yPos + 0.025, 0]} // +0.025 damit sie direkt auf dem Boden stehen
            onClick={onTrophyClick} 
          />
        );
      })}
    </group>
  );
}
// ==========================================

export default function ProfileTab({ user, setActiveTab }: { user: any, setActiveTab: (t: string) => void }) {
  const fallbackName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "";
  const [username, setUsername] = useState(fallbackName);
  const [teamName, setTeamName] = useState("TacPadel Rookies");
  
  // Um zu tracken, ob wir überhaupt speichern müssen (Auto-Save)
  const [savedUsername, setSavedUsername] = useState(fallbackName);
  const [savedTeamName, setSavedTeamName] = useState("TacPadel Rookies");

  const [partnerId, setPartnerId] = useState("pro_1-1"); 
  const [racketId, setRacketId] = useState("racket_starter"); 
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [isUploading, setIsUploading] = useState(false);

  const [showExplanations, setShowExplanations] = useState(() => localStorage.getItem("tacpadel_show_explanations") !== "false");
  const toggleExplanations = () => {
    const newVal = !showExplanations;
    setShowExplanations(newVal);
    localStorage.setItem("tacpadel_show_explanations", newVal.toString());
  };

  const [statsMode, setStatsMode] = useState<'single' | 'tournament'>('single');
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [wonTrophies, setWonTrophies] = useState<string[]>([]);
  const [activeTrophyBanner, setActiveTrophyBanner] = useState<string | null>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);

  const [showNameTags, setShowNameTags] = useState(() => localStorage.getItem("tacpadel_show_nametags") !== "false");
  const toggleNameTags = () => {
    const newVal = !showNameTags;
    setShowNameTags(newVal);
    localStorage.setItem("tacpadel_show_nametags", newVal.toString());
  };
  
  const [currentScore, setCurrentScore] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_score");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [preferredPosition, setPreferredPosition] = useState<string>(() => localStorage.getItem("tacpadel_preferred_position") || "Rechts");
  const [aggStats, setAggStats] = useState({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });
  const [matchesWithStats, setMatchesWithStats] = useState(0);

  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("tacpadel_sound") !== "false");
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem("tacpadel_music") !== "false");
  const [staminaEnabled, setStaminaEnabled] = useState(() => localStorage.getItem("tacpadel_stamina") !== "false");

  useEffect(() => {
    const loadUserData = async () => {
      const { data: profileData } = await supabase
        .from('user_stats')
        .select('display_name, avatar_url, points, preferred_position, team_name, partner_id') 
        .eq('id', user.id)
        .maybeSingle();

      let trueScore = currentScore; 

      if (profileData) {
        if (profileData.display_name) {
          setUsername(profileData.display_name);
          setSavedUsername(profileData.display_name);
        }
        if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
        if (profileData.points != null) trueScore = profileData.points;
        
        if (profileData.team_name) {
          setTeamName(profileData.team_name);
          setSavedTeamName(profileData.team_name);
        }
        
        if (profileData.partner_id) {
          setPartnerId(profileData.partner_id);
          localStorage.setItem("tacpadel_partner_id", profileData.partner_id);
        }
        
        if (profileData.preferred_position) {
          setPreferredPosition(profileData.preferred_position);
          localStorage.setItem("tacpadel_preferred_position", profileData.preferred_position);
        } else {
          const localPos = localStorage.getItem("tacpadel_preferred_position") || "Rechts";
          await supabase.from('user_stats').update({ preferred_position: localPos }).eq('id', user.id);
        }
      }

      const { data: historyData } = await supabase
        .from('match_history')
        .select('points, tac_points, result, created_at, aces, winners, unforced_errors, total_shots, shots_perfect, match_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }); 

      if (historyData && historyData.length > 0) {
        setAllHistory(historyData);
        const lastMatch = historyData[historyData.length - 1];
        if (lastMatch.points != null) trueScore = lastMatch.points;
      } else {
        setAllHistory([]);
      }

      const { data: trophiesData } = await supabase
        .from('tour_progress')
        .select('tournament_id')
        .eq('user_id', user.id)
        .eq('status', 'won');

      if (trophiesData) {
        setWonTrophies(trophiesData.map(t => t.tournament_id));
      }

      setCurrentScore(trueScore);
      localStorage.setItem("tacpadel_score", trueScore.toString());
      
      if (!profileData) {
        await supabase.from('user_stats').upsert({ id: user.id, points: trueScore, preferred_position: preferredPosition, team_name: teamName, partner_id: partnerId });
      } else if (profileData.points !== trueScore) {
        await supabase.from('user_stats').update({ points: trueScore }).eq('id', user.id);
      }
    };
    
    loadUserData();
  }, [user.id]);

  useEffect(() => {
    if (allHistory.length === 0) {
      setMatchHistory([{ name: 'Start', Wert: currentScore }]);
      return;
    }
    const filtered = allHistory.filter(m => statsMode === 'tournament' ? m.match_type === 'tournament' : (m.match_type === 'single' || !m.match_type));

    if (filtered.length === 0) {
      setMatchHistory([{ name: 'Start', Wert: currentScore }]);
      setMatchesWithStats(0);
      setAggStats({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });
      return;
    }

    const recent = filtered.slice(-20);
    const formattedData = recent.map((match) => {
      const date = new Date(match.created_at);
      return {
        name: `${date.getDate()}.${date.getMonth() + 1}.`,
        Wert: statsMode === 'tournament' ? (match.tac_points || 0) : match.points,
        result: match.result
      };
    });
    setMatchHistory(formattedData);

    let tAces = 0, tWinners = 0, tUfe = 0, tTotalShots = 0, tPerfect = 0;
    let validMatchCount = 0;

    recent.forEach((match) => {
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
    } else {
       setMatchesWithStats(0);
       setAggStats({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });
    }
  }, [allHistory, statsMode, currentScore]);

  const loadoutStats = useMemo(() => {
    const baseStats = { smash: 50, control: 50, defense: 50, agility: 50 };
    const calculated = { ...baseStats };
    
    const pMods = getPartnerModifiers(partnerId);
    const rMods = RACKETS.find(r => r.id === racketId)?.modifiers || { smash: 0, control: 0, defense: 0, agility: 0 };

    const diffs = {
      smash: pMods.smash + rMods.smash,
      control: pMods.control + rMods.control,
      defense: pMods.defense + rMods.defense,
      agility: pMods.agility + rMods.agility,
    };

    calculated.smash += diffs.smash;
    calculated.control += diffs.control;
    calculated.defense += diffs.defense;
    calculated.agility += diffs.agility;

    return { stats: calculated, diffs };
  }, [partnerId, racketId]);

  const renderStatDiff = (diff: number) => {
    if (diff === 0) return <span className="text-[10px] font-black text-slate-600 bg-slate-800/50 px-1 rounded">-</span>;
    return (
      <span className={`text-[10px] font-black px-1 rounded ${diff > 0 ? 'text-emerald-400 bg-emerald-900/30 border border-emerald-500/30' : 'text-red-400 bg-red-900/30 border border-red-500/30'}`}>
        {diff > 0 ? '+' : ''}{diff}
      </span>
    );
  };

  const handlePartnerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPartner = e.target.value;
    setPartnerId(newPartner);
    localStorage.setItem("tacpadel_partner_id", newPartner);
    
    const { error } = await supabase.from('user_stats').update({ partner_id: newPartner }).eq('id', user.id);
    if (!error) {
      setMessage({ type: 'success', text: `Partner erfolgreich gewählt!` });
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleAutoSave = async () => {
    const newName = username.trim();
    const newTeam = teamName.trim();
    
    // Nur speichern, wenn sich wirklich etwas geändert hat
    if (newName === savedUsername && newTeam === savedTeamName) return;
    if (!newName || !newTeam) return; // Nichts speichern, wenn leer
    
    setIsSaving(true);
    setMessage(null);
    
    const { error: authError } = await supabase.auth.updateUser({ data: { display_name: newName } });
    
    const { error: dbError } = await supabase.from('user_stats').update({ 
      display_name: newName,
      team_name: newTeam 
    }).eq('id', user.id);
    
    setIsSaving(false);
    if (authError || dbError) {
      setMessage({ type: 'error', text: "Fehler beim Speichern!" });
      setTimeout(() => setMessage(null), 3000); 
    } else {
      setSavedUsername(newName);
      setSavedTeamName(newTeam);
      setMessage({ type: 'success', text: "Automatisch gespeichert!" });
      setTimeout(() => setMessage(null), 2500); 
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setMessage(null);
      if (!event.target.files || event.target.files.length === 0) throw new Error('Bitte wähle ein Bild aus.');
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await supabase.from('user_stats').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setMessage({ type: 'success', text: "Profilbild erfolgreich aktualisiert!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: "Fehler beim Hochladen: " + error.message });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUploading(false);
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
  const toggleStamina = () => {
    const newState = !staminaEnabled;
    setStaminaEnabled(newState);
    localStorage.setItem("tacpadel_stamina", String(newState));
  };

  const filteredForWins = allHistory.filter(m => statsMode === 'tournament' ? m.match_type === 'tournament' : (m.match_type === 'single' || !m.match_type));
  const wins = filteredForWins.filter(m => m.result === 'win').length;
  const losses = filteredForWins.filter(m => m.result === 'loss').length;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const formatTourName = (id: string) => id.replace(/-/g, ' ').toUpperCase();

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
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full relative">
        <div className="relative flex flex-col items-center shrink-0">
          <label htmlFor="avatar-upload" className={`relative cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profilbild" className="w-28 h-28 rounded-full object-cover border-4 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:border-cyan-500/50 transition-colors" />
            ) : (
              <div className="w-28 h-28 bg-cyan-950/30 rounded-full flex items-center justify-center mx-auto text-cyan-500 text-5xl border-2 border-dashed border-cyan-500/50 group-hover:bg-cyan-900/50 transition-colors shadow-sm">👤</div>
            )}
            <div className="absolute bottom-0 right-0 bg-background border border-border rounded-full p-2.5 shadow-md text-sm group-hover:scale-110 transition-transform">✏</div>
          </label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} className="hidden" />
          {isUploading && <span className="text-[10px] text-cyan-400 mt-3 font-bold animate-pulse uppercase tracking-wider">Lädt hoch...</span>}
        </div>

        <div className="flex flex-col gap-3 w-full">
          <div className="flex justify-between items-center w-full">
            <h2 className="text-2xl font-black text-white tracking-wide text-center md:text-left">Spieler-Akte</h2>
            
            {message && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
              >
                {isSaving ? "Speichert..." : message.text}
              </motion.div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase ml-1">E-Mail</label>
              <div className="px-4 py-3 bg-[#030611] border border-slate-800 rounded-xl text-slate-500 text-xs font-semibold cursor-not-allowed">{user?.email}</div>
            </div>
            <div className="flex flex-col gap-1.5 text-left relative group">
              <label className="text-[10px] font-bold tracking-widest text-cyan-500 uppercase ml-1">Dein Spielername</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onBlur={handleAutoSave} 
                onKeyDown={(e) => e.key === 'Enter' && handleAutoSave()}
                placeholder="Name..." 
                className="px-4 py-3 bg-[#050b18] border border-cyan-900/50 focus:border-cyan-400 rounded-xl text-white text-sm font-bold outline-none transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 w-full mt-1">
            <div className="flex flex-col gap-1.5 text-left relative group">
              <label className="text-[10px] font-bold tracking-widest text-purple-400 uppercase ml-1">Turnier Team-Name</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)} 
                onBlur={handleAutoSave} 
                onKeyDown={(e) => e.key === 'Enter' && handleAutoSave()}
                placeholder="z.B. TacPadel Bros" 
                className="px-4 py-3 bg-[#050b18] border border-purple-900/50 focus:border-purple-400 rounded-xl text-white text-sm font-bold outline-none transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>
          <span className="text-[8px] text-slate-500 text-right mt-[-4px] mr-2">Änderungen werden automatisch gespeichert</span>
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />

      {/* ======================================================== */}
      {/* 1.5 3D UMKLEIDEKABINE (Locker Room)                      */}
      {/* ======================================================== */}
      <div className="w-full bg-[#050b14] border border-slate-800 rounded-2xl p-5 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">Dein Spind</h3>
          <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/30 rounded border border-cyan-900/50">3D Ansicht</span>
        </div>
        <div className="w-full h-64 sm:h-72 bg-[#03060c] rounded-xl border border-slate-800/80 overflow-hidden relative shadow-inner cursor-grab active:cursor-grabbing">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/40 blur-[40px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-orange-500/40 blur-[40px] pointer-events-none" />
          <Canvas camera={{ position: [0, 1.2, 4], fov: 45 }}>
            <ambientLight intensity={2.5} />
            <directionalLight position={[0, 1.5, 3]} intensity={2.5} color="#ffffff" />
            <spotLight position={[0, 4, 1]} intensity={3.0} angle={0.8} penumbra={1} />
            <pointLight position={[-1.5, 1.5, 1.5]} intensity={15} color="#00f0ff" distance={10} />
            <pointLight position={[1.5, 1.5, 1.5]} intensity={15} color="#ff7700" distance={10} />
            <React.Suspense fallback={null}>
              <PlayerShow />
            </React.Suspense>
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 2} />
          </Canvas>
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />
      
      {/* ========================================= */}
      {/* 2. STATS, AUSRÜSTUNG & ROADMAP/TROPHÄEN   */}
      {/* ========================================= */}
      <div className="grid grid-cols-1 gap-4 w-full">
        
        {/* LOADOUT/RPG BOX */}
        <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <h3 className="text-[10px] font-black tracking-widest text-orange-400 uppercase mb-4 flex justify-between">
            <span>Spielstil & Ausrüstung</span><span className="text-slate-600">Locker</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex flex-col gap-3">
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Teampartner (KI)</label>
                <select 
                  value={partnerId} 
                  onChange={handlePartnerChange} 
                  className="px-3 py-2 bg-[#0a1122] border border-slate-700/50 focus:border-orange-500/50 rounded-lg text-white text-xs font-bold outline-none transition-colors appearance-none cursor-pointer"
                >
                  {AI_PROFILES.flatMap(p => [
                    <option key={`${p.id}-1`} value={`${p.id}-1`}>{p.p1} ({p.style})</option>,
                    <option key={`${p.id}-2`} value={`${p.id}-2`}>{p.p2} ({p.style})</option>
                  ])}
                </select>
              </div>

              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Schläger</label>
                <select 
                  value={racketId} 
                  onChange={(e) => setRacketId(e.target.value)} 
                  disabled
                  className="px-3 py-2 bg-[#0a1122] border border-slate-700/50 rounded-lg text-white text-xs font-bold outline-none appearance-none opacity-40 cursor-not-allowed"
                >
                  {RACKETS.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                  <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase drop-shadow-[0_0_5px_rgba(234,88,12,0.8)] border border-orange-500/30 bg-orange-950/50 px-2 py-0.5 rounded">
                    🔒 Coming soon
                  </span>
                </div>
              </div>

              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Powerschlag</label>
                <select disabled className="px-3 py-2 bg-[#0a1122] border border-slate-700/50 rounded-lg text-white text-xs font-bold outline-none appearance-none opacity-40 cursor-not-allowed">
                  <option>Topspin Smash (Klassik)</option>
                  <option>Bandeja Viper</option>
                  <option>Vibora Strike</option>
                </select>
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                  <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase drop-shadow-[0_0_5px_rgba(234,88,12,0.8)] border border-orange-500/30 bg-orange-950/50 px-2 py-0.5 rounded">
                    🔒 Coming soon
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#050b18] p-4 rounded-lg border border-slate-800/50 flex flex-col justify-center relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] pointer-events-none" />
              
              <h4 className="text-[9px] text-slate-500 uppercase tracking-widest font-black mb-4 border-b border-slate-800 pb-2">Player Attributes</h4>
              
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Smash Power</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.smash}</span>
                    {renderStatDiff(loadoutStats.diffs.smash)}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Control</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.control}</span>
                    {renderStatDiff(loadoutStats.diffs.control)}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Defense</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.defense}</span>
                    {renderStatDiff(loadoutStats.diffs.defense)}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Agility</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.agility}</span>
                    {renderStatDiff(loadoutStats.diffs.agility)}
                  </div>
                </div>
              </div>
              
            </div>

          </div>
        </div>

        {/* --- 3D TROPHÄENSCHRANK --- */}
        <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between mt-2">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black tracking-widest text-purple-400 uppercase">Tour Ranking & Trophäen</h3>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30">
                {wonTrophies.length} Titel
              </span>
            </div>
            
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Open</span>
              <span className="text-[11px] font-black tracking-widest text-purple-400">{currentScore} TacScore</span>
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Major</span>
            </div>
            
            <div className="w-full h-2.5 bg-[#050b18] border border-slate-800 rounded-full overflow-hidden mb-4 relative">
              <div className="absolute top-0 bottom-0 left-1/3 w-px bg-slate-700/80 z-10" />
              <div className="absolute top-0 bottom-0 left-2/3 w-px bg-slate-700/80 z-10" />
              <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] transition-all duration-1000 ease-out relative z-0" 
                  style={{ width: `${Math.min(100, Math.max(5, (currentScore / 6000) * 100))}%` }} />
            </div>

            {/* TRON 3D CABINET CONTAINER */}
            <div className="w-full bg-[#020408] rounded-xl border border-cyan-900/50 p-0 h-[380px] relative overflow-hidden shadow-[inset_0_0_30px_rgba(6,182,212,0.15)]">
              <div className="absolute top-3 left-4 z-10 pointer-events-none">
                <span className="text-[8px] text-cyan-400 uppercase tracking-widest font-black block drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">Tron Trophäen-Vault</span>
              </div>

              {wonTrophies.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Vault noch leer</span>
                </div>
              )}

              <Canvas camera={{ position: [0, 2.5, 16], fov: 45 }}>
                <ambientLight intensity={0.8} />
                <pointLight position={[0, 4, 3]} intensity={2.5} color="#0ea5e9" />
                
                <React.Suspense fallback={null}>
                  <TronCabinet trophies={wonTrophies} onTrophyClick={(id) => setActiveTrophyBanner(id)} />
                </React.Suspense>
                
                <OrbitControls 
                  target={[0, 2, 0]} 
                  enableZoom={true} 
                  maxDistance={14} 
                  minDistance={3} 
                  maxPolarAngle={Math.PI / 2 + 0.05} 
                  minPolarAngle={Math.PI / 4} 
                />
              </Canvas>

              {/* DYNAMISCHES BANNER OVERLAY */}
              <AnimatePresence>
                {activeTrophyBanner && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    onClick={() => setActiveTrophyBanner(null)}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 border border-cyan-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-md cursor-pointer z-20 flex flex-col items-center text-center"
                  >
                    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-1">Sieger</span>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{formatTourName(activeTrophyBanner)}</h4>
                    <span className="text-[8px] text-slate-400 mt-2">Klicken zum Schließen</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2.5 STATISTIK-FILTER (EINZEL / TURNIER)   */}
      {/* ========================================= */}
      <div className="flex bg-[#030611]/80 border border-slate-800/80 rounded-xl p-1.5 w-full mt-4 shadow-lg">
        <button onClick={() => setStatsMode('single')} className={`flex-1 py-3 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'single' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>Einzel-Matches</button>
        <button onClick={() => setStatsMode('tournament')} className={`flex-1 py-3 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'tournament' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>Turniere</button>
      </div>

      {/* ========================================= */}
      {/* 3. MATCH BILANZ                           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-row justify-between items-center">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Match Bilanz ({statsMode === 'single' ? 'Einzel' : 'Turnier'})</h3>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Siegquote & Historie</span>
        </div>
        <div className="flex items-center gap-5 sm:gap-8">
          <div className="flex gap-3 sm:gap-4 text-[10px] font-black tracking-widest uppercase items-center">
            <span className="text-emerald-400 text-xs sm:text-sm">{wins} W</span>
            <span className="text-slate-600">|</span>
            <span className="text-red-400 text-xs sm:text-sm">{losses} L</span>
          </div>
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full border-4 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" style={{ borderColor: winRate > 50 ? '#10b981' : winRate > 30 ? '#f59e0b' : '#ef4444' }}>
            <span className="text-xs sm:text-sm font-black text-white">{winRate}%</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 4. TIEFENANALYSE (SCHLAG-STATS)           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Schlag-Analyse ({statsMode === 'single' ? 'Einzel' : 'Turnier'})</h3>
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/30">Letzte {matchesWithStats} Matches</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgWinners}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">Winner</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgAces}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">Asse</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-red-900/20 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
            <span className="text-2xl font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{aggStats.avgErrors}</span>
            <span className="text-[9px] text-red-900/80 uppercase tracking-widest font-bold mt-1">Fehler (UFE)</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-[inset_0_0_15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{aggStats.perfectRatio}%</span>
            <span className="text-[9px] text-emerald-700/80 uppercase tracking-widest font-bold mt-1">Perfekte Schläge</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 5. TAC-SCORE / TAC-POINTS CHART           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 h-[280px] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
            Performance Historie ({statsMode === 'single' ? 'TacScore' : 'TacPoints'})
          </h3>
          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30">Max 20</span>
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
                dataKey="Wert" 
                name={statsMode === 'single' ? 'TacScore' : 'TacPoints'}
                stroke={statsMode === 'single' ? '#06b6d4' : '#a855f7'}
                strokeWidth={4} 
                dot={{ r: 4, fill: statsMode === 'single' ? '#06b6d4' : '#a855f7', stroke: '#0f172a', strokeWidth: 2 }} 
                activeDot={{ r: 6, fill: '#fff', stroke: statsMode === 'single' ? '#06b6d4' : '#a855f7' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================= */}
      {/* 6. AUDIO & UI SETTINGS                    */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center sm:text-left">
          <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Audio & UI</h3>
          <span className="text-[9px] text-slate-600 font-bold mt-1">Musik, SFX und Texte/Namen steuern</span>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SFX</span>
            <button onClick={toggleSound} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${soundEnabled ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: soundEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Musik</span>
            <button onClick={toggleMusic} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${musicEnabled ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: musicEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Texte</span>
            <button onClick={toggleExplanations} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showExplanations ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showExplanations ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Namen</span>
            <button onClick={toggleNameTags} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showNameTags ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showNameTags ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 7. SPIELMECHANIK SETTINGS                 */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center sm:text-left">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Spielmechanik</h3>
          <span className="text-[9px] text-slate-600 font-bold mt-1">Simulations-Limits und Mechaniken steuern</span>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ausdauer</span>
            <button onClick={toggleStamina} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${staminaEnabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: staminaEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </div>

      <button onClick={() => setActiveTab("home")} className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest transition-colors mt-2">
        ← Zurück zum Menü
      </button>

    </motion.div>
  );
}
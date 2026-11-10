import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import * as THREE from 'three'; 

// --- Imports für Loadout-Shop, RPG-Upgrades, Match-Lock, Admin, 3D & i18n ---
import {
  SHOP_PARTNERS,
  SHOP_RACKETS,
  SHOP_SHOTS,
  ShopItem,
  ItemProgressMap,
  normalizeShotId,
  isLoadoutLockedByActiveMatch,
  getSavedItemProgress,
  saveItemProgress,
  getUpgradedItemDetails,
  performItemUpgrade,
  calculateLoadoutStats,
} from '../lib/loadout';
import { useTranslation, formatPartnerPerk } from '../lib/i18n';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import PlayerShow from "./PlayerShow"; 
import AdminDashboard from "./AdminDashboard";
import InGameShopModal from "./InGameShopModal";

// =========================================================
// HILFSFUNKTION: Schwache / Ältere Geräte beim Start erkennen
// =========================================================
const detectLowEndDevice = (): boolean => {
  try {
    const manualSetting = localStorage.getItem("tacpadel_low_perf");
    if (manualSetting === "true") return true;
    if (manualSetting === "false") return false;

    const nav = navigator as any;
    if (nav.deviceMemory && nav.deviceMemory <= 4) return true;
    if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) return true;
  } catch (e) {}
  return false;
};

// ==========================================
// --- KAMERA-WECHSLER FÜR DEN KOMBINIERTEN CANVAS ---
// ==========================================
function CameraSwitcher({ mode, controlsRef }: { mode: 'locker' | 'trophies', controlsRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();

  useEffect(() => {
    if (mode === 'locker') {
      camera.position.set(0, 1.2, 4);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    } else {
      camera.position.set(0, 2.5, 16);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 2, 0);
        controlsRef.current.update();
      }
    }
  }, [mode, camera, controlsRef]);

  return null;
}

// ==========================================
// --- 3D TRON TROPHIES (Hologramm Style Bild-getreu) ---
// ==========================================
function TronTrophy({ position, tourId, onClick, lowQuality }: { position: [number, number, number], tourId: string, onClick: (id: string) => void, lowQuality?: boolean }) {
  const ref = useRef<any>(null);
  
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * 0.4;
  });

  const idLower = tourId.toLowerCase();
  const isMaster = idLower.includes('master');
  const isPro = idLower.includes('pro');
  
  const color = isMaster ? "#fbbf24" : isPro ? "#bae6fd" : "#d97706";
  const intensity = isMaster ? 3 : isPro ? 2.5 : 2.5;
  const tubeSteps = lowQuality ? 32 : 64;

  const { curve1, curve2 } = useMemo(() => {
    const spiralSegments = 60;
    const pts1 = [];
    const pts2 = [];
    
    for (let i = 0; i <= spiralSegments; i++) {
      const t = i / spiralSegments;
      const radius = 0.15 + (t * 0.4); 
      const y = 0.3 + (t * 1.0);
      
      const angle1 = t * Math.PI * 4; 
      pts1.push(new THREE.Vector3(Math.cos(angle1) * radius, y, Math.sin(angle1) * radius));
      
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
      <mesh visible={false} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.5, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <group ref={ref}>
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
        </group>

        <group>
          <mesh>
            <tubeGeometry args={[curve1, tubeSteps, 0.012, 8, false]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} />
          </mesh>
          <mesh>
            <tubeGeometry args={[curve2, tubeSteps, 0.012, 8, false]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} />
          </mesh>
        </group>

        <group position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 8]}>
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
              <cylinderGeometry args={[0.5, 0.5, 0.03, lowQuality ? 20 : 32]} />
              <meshStandardMaterial color="#020617" transparent opacity={0.7} roughness={0.2} metalness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, 0]}>
              <torusGeometry args={[0.5, 0.035, 16, lowQuality ? 32 : 64]} />
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

        <group position={[0.45, 1.4, 0.2]}>
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

// --- VITRINENSCHRANK ---
function TronCabinet({ trophies, onTrophyClick, lowQuality }: { trophies: string[], onTrophyClick: (id: string) => void, lowQuality?: boolean }) {
  const cols = 3; 
  const minShelves = 4; 
  const numShelves = Math.max(minShelves, Math.ceil(trophies.length / cols));
  
  const shelfHeight = 2.4; 
  const width = 5.5; 
  const depth = 1.8;
  const totalHeight = numShelves * shelfHeight;

  return (
    <group position={[0, -2, 0]}> 
      <gridHelper args={[40, lowQuality ? 20 : 40, '#0ea5e9', '#020617']} position={[0, -0.01, 0]} />
      
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
        <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>

      <mesh position={[0, totalHeight, 0]}>
        <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
        <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>

      <mesh position={[0, totalHeight / 2, -depth / 2]}>
        <boxGeometry args={[width, totalHeight, 0.1]} />
        <meshStandardMaterial color="#010308" />
      </mesh>

      <mesh position={[-width / 2, totalHeight / 2, 0]}>
        <boxGeometry args={[0.05, totalHeight, depth]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} />
      </mesh>

      <mesh position={[width / 2, totalHeight / 2, 0]}>
        <boxGeometry args={[0.05, totalHeight, depth]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} />
      </mesh>

      {Array.from({ length: numShelves }).map((_, rowIndex) => (
        <mesh key={`shelf-${rowIndex}`} position={[0, rowIndex * shelfHeight, 0]}>
          <boxGeometry args={[width, 0.05, depth]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} transparent opacity={0.4} />
        </mesh>
      ))}

      {trophies.map((tourId, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const xPos = (col - 1) * 1.6;
        const yPos = row * shelfHeight;
        
        return (
          <TronTrophy 
            key={`${tourId}-${idx}`} 
            tourId={tourId} 
            position={[xPos, yPos + 0.025, 0]}
            onClick={onTrophyClick}
            lowQuality={lowQuality}
          />
        );
      })}
    </group>
  );
}
// ==========================================

const normalizePartnerId = (rawId?: string | null): string => {
  if (!rawId) return "partner_rookie";
  if (SHOP_PARTNERS.some((p) => p.id === rawId)) return rawId;
  return "partner_rookie";
};

export default function ProfileTab({ user, setActiveTab }: { user: any, setActiveTab: (t: string) => void }) {
  const { lang, setLang, t } = useTranslation();

  const fallbackName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "";
  const [username, setUsername] = useState(fallbackName);
  const [teamName, setTeamName] = useState("TacPadel Rookies");
  
  const [savedUsername, setSavedUsername] = useState(fallbackName);
  const [savedTeamName, setSavedTeamName] = useState("TacPadel Rookies");

  // --- AKTUELL AUSGEWÄHLTE VORSCHAU-IDS IM DROPDOWN ---
  const [partnerId, setPartnerId] = useState(() => normalizePartnerId(localStorage.getItem("tacpadel_partner_id"))); 
  const [racketId, setRacketId] = useState(() => localStorage.getItem("tacpadel_racket_id") || "racket_starter"); 
  const [shotId, setShotId] = useState(() => normalizeShotId(localStorage.getItem("tacpadel_power_shot")));

  // --- FEST AUSGERÜSTETE IDS, FREIGESCHALTETE SHOP-ITEMS & RPG-UPGRADE-PROGRESS ---
  const [tacPoints, setTacPoints] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_tac_points");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [currentScore, setCurrentScore] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_score");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [unlockedItems, setUnlockedItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("tacpadel_unlocked_items");
      if (!saved) return ["partner_rookie", "racket_starter", "smash"];
      const parsed = JSON.parse(saved).map((id: string) =>
        id === "kick_x3" ? "volley" : id === "vibora" ? "chiquita" : id
      );
      return Array.from(new Set(["partner_rookie", "racket_starter", "smash", ...parsed]));
    } catch {
      return ["partner_rookie", "racket_starter", "smash"];
    }
  });
  const [itemProgressMap, setItemProgressMap] = useState<ItemProgressMap>(() => getSavedItemProgress());

  const [equippedPartner, setEquippedPartner] = useState<string>(() => normalizePartnerId(localStorage.getItem("tacpadel_partner_id")));
  const [equippedRacket, setEquippedRacket] = useState<string>(() => localStorage.getItem("tacpadel_racket_id") || "racket_starter");
  const [equippedShot, setEquippedShot] = useState<string>(() => normalizeShotId(localStorage.getItem("tacpadel_power_shot")));

  // --- MATCH-LOCK PRÜFUNG (Sperrt Loadout-Wechsel bei aktivem Spielstand) ---
  const [isMatchLocked, setIsMatchLocked] = useState<boolean>(() => isLoadoutLockedByActiveMatch(user?.id));

  // --- State für das InGameShopModal ---
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);

  // Synchronisiert Inventar, Ausrüstung & RPG-Progress nach Einkäufen/Upgrades
  const syncLoadoutFromStorage = useCallback(() => {
    try {
      const savedUnlocked = localStorage.getItem("tacpadel_unlocked_items");
      if (savedUnlocked) {
        const normalized = JSON.parse(savedUnlocked).map((id: string) =>
          id === "kick_x3" ? "volley" : id === "vibora" ? "chiquita" : id
        );
        setUnlockedItems(
          Array.from(new Set(["partner_rookie", "racket_starter", "smash", ...normalized]))
        );
      }
    } catch {}

    const savedTp = localStorage.getItem("tacpadel_tac_points");
    if (savedTp) setTacPoints(parseInt(savedTp, 10));

    setItemProgressMap(getSavedItemProgress());
    setIsMatchLocked(isLoadoutLockedByActiveMatch(user?.id));

    const nextPartner = normalizePartnerId(localStorage.getItem("tacpadel_partner_id"));
    const nextRacket = localStorage.getItem("tacpadel_racket_id") || "racket_starter";
    const nextShot = normalizeShotId(localStorage.getItem("tacpadel_power_shot"));

    setEquippedPartner(nextPartner);
    setPartnerId(nextPartner);
    setEquippedRacket(nextRacket);
    setRacketId(nextRacket);
    setEquippedShot(nextShot);
    setShotId(nextShot);
  }, [user?.id]);

  // --- GEFILTERTE INVENTAR-LISTEN (Nur gekaufte/freigeschaltete Items!) ---
  const ownedPartners = useMemo(
    () => SHOP_PARTNERS.filter((p) => unlockedItems.includes(p.id) || p.price === 0),
    [unlockedItems]
  );
  const ownedRackets = useMemo(
    () => SHOP_RACKETS.filter((r) => unlockedItems.includes(r.id) || r.price === 0),
    [unlockedItems]
  );
  const ownedShots = useMemo(
    () => SHOP_SHOTS.filter((s) => unlockedItems.includes(s.id) || s.price === 0),
    [unlockedItems]
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [isUploading, setIsUploading] = useState(false);

  // --- States für Kontolöschung ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Umschalter für den gemeinsamen 3D-Canvas ---
  const [active3DView, setActive3DView] = useState<'locker' | 'trophies'>('locker');
  const controlsRef = useRef<any>(null);

  // --- Performance-Modus ---
  const [lowPerfMode, setLowPerfMode] = useState<boolean>(() => detectLowEndDevice());
  const [dpr, setDpr] = useState<number>(() => (detectLowEndDevice() ? 0.8 : 1.25));

  const toggleLowPerf = () => {
    const newState = !lowPerfMode;
    setLowPerfMode(newState);
    setDpr(newState ? 0.8 : 1.25);
    localStorage.setItem("tacpadel_low_perf", String(newState));
  };

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

  const [preferredPosition, setPreferredPosition] = useState<string>(() => localStorage.getItem("tacpadel_preferred_position") || "Rechts");
  const [aggStats, setAggStats] = useState({ avgWinners: 0, avgAces: 0, avgErrors: 0, perfectRatio: 0 });
  const [matchesWithStats, setMatchesWithStats] = useState(0);

  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("tacpadel_sound") !== "false");
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem("tacpadel_music") !== "false");
  const [hapticsEnabled, setHapticsEnabled] = useState(() => localStorage.getItem("tacpadel_haptics") !== "false");
  const [staminaEnabled, setStaminaEnabled] = useState(() => localStorage.getItem("tacpadel_stamina") !== "false");

  // --- ADMIN TEST-SCHALTER FÜR DEN PRO-USER-STATUS ---
  const userEmailLower = user?.email?.toLowerCase().trim() || "";
  const isAdmin = userEmailLower === "admin@tacpadel.com" || userEmailLower === "caposion@gmail.com";
  const [isProUser, setIsProUser] = useState<boolean>(() => {
    if (isAdmin) {
      const saved = localStorage.getItem("tacpadel_is_pro");
      if (saved === "true") return true;
      if (saved === "false") return false;
      return true;
    }
    return false;
  });
  const [showAdminModal, setShowAdminModal] = useState(false);

  const toggleProUserStatus = async () => {
    const newState = !isProUser;
    setIsProUser(newState);
    localStorage.setItem("tacpadel_is_pro", String(newState));

    await supabase.auth.updateUser({ data: { is_pro: newState } }).catch(() => {});
    await supabase.from('user_stats').update({ is_pro: newState }).eq('id', user.id).then(() => {});

    setMessage({
      type: 'success',
      text: newState ? "👑 Pro-User-Ansicht aktiviert!" : "🔒 Free-User-Ansicht aktiviert!"
    });
    setTimeout(() => setMessage(null), 2500);
  };

  useEffect(() => {
    const loadUserData = async () => {
      setIsMatchLocked(isLoadoutLockedByActiveMatch(user.id));

      const { data: profileData } = await supabase
        .from('user_stats')
        .select('*') 
        .eq('id', user.id)
        .maybeSingle();

      let trueScore = currentScore; 

      if (user?.user_metadata?.item_progress) {
        const localProg = getSavedItemProgress();
        const remoteProg = user.user_metadata.item_progress as ItemProgressMap;
        const mergedProg: ItemProgressMap = { ...remoteProg, ...localProg };
        Object.keys(remoteProg).forEach((k) => {
          const r = remoteProg[k];
          const l = localProg[k];
          if (!l || r.level > l.level || (r.level === l.level && r.xp > l.xp)) {
            mergedProg[k] = r;
          }
        });
        saveItemProgress(mergedProg);
        setItemProgressMap(mergedProg);
      }

      if (profileData) {
        if (profileData.display_name) {
          setUsername(profileData.display_name);
          setSavedUsername(profileData.display_name);
        }
        if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
        if (profileData.points != null) trueScore = profileData.points;

        if (profileData.tac_points != null) {
          setTacPoints(profileData.tac_points);
          localStorage.setItem("tacpadel_tac_points", String(profileData.tac_points));
        }

        const rawUnlocked = Array.isArray(profileData.unlocked_items) ? profileData.unlocked_items : [];
        const normalizedUnlocked = rawUnlocked.map((id: string) =>
          id === "kick_x3" ? "volley" : id === "vibora" ? "chiquita" : id
        );
        const mergedUnlocked = normalizedUnlocked.length > 0
          ? Array.from(new Set(["partner_rookie", "racket_starter", "smash", ...normalizedUnlocked]))
          : unlockedItems;

        if (normalizedUnlocked.length > 0) {
          setUnlockedItems(mergedUnlocked);
          localStorage.setItem("tacpadel_unlocked_items", JSON.stringify(mergedUnlocked));
        }

        if (profileData.partner_id) {
          const validPartner = normalizePartnerId(profileData.partner_id);
          const safePartner = mergedUnlocked.includes(validPartner) ? validPartner : "partner_rookie";
          setEquippedPartner(safePartner);
          setPartnerId(safePartner);
          localStorage.setItem("tacpadel_partner_id", safePartner);
        }

        if (profileData.equipped_racket) {
          const safeRacket = mergedUnlocked.includes(profileData.equipped_racket)
            ? profileData.equipped_racket
            : "racket_starter";
          setEquippedRacket(safeRacket);
          setRacketId(safeRacket);
          localStorage.setItem("tacpadel_racket_id", safeRacket);
        }

        if (profileData.equipped_shot) {
          const normalizedShot = normalizeShotId(profileData.equipped_shot);
          const safeShot = mergedUnlocked.includes(normalizedShot)
            ? normalizedShot
            : "smash";
          setEquippedShot(safeShot);
          setShotId(safeShot);
          localStorage.setItem("tacpadel_power_shot", safeShot);
        }
        
        if (profileData.team_name) {
          setTeamName(profileData.team_name);
          setSavedTeamName(profileData.team_name);
        }

        if (!isAdmin) {
          const dbPro = Boolean(profileData.is_pro);
          setIsProUser(dbPro);
          localStorage.setItem("tacpadel_is_pro", String(dbPro));
        } else {
          const localOverride = localStorage.getItem("tacpadel_is_pro");
          if (localOverride === null && typeof profileData.is_pro === "boolean") {
            setIsProUser(profileData.is_pro);
            localStorage.setItem("tacpadel_is_pro", String(profileData.is_pro));
          }
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
        await supabase.from('user_stats').upsert({
          id: user.id,
          points: trueScore,
          preferred_position: preferredPosition,
          team_name: teamName,
          partner_id: partnerId
        });
      } else if (profileData.points !== trueScore) {
        await supabase.from('user_stats').update({ points: trueScore }).eq('id', user.id);
      }
    };
    
    loadUserData();
  }, [user.id, isAdmin]);

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

  // --- ZENTRALE BERECHNUNG DER SPIELER-ATTRIBUTE (INKL. +1 BIS +5 UPGRADES) ---
  const loadoutStats = useMemo(
    () => calculateLoadoutStats(partnerId, racketId, shotId, itemProgressMap),
    [partnerId, racketId, shotId, itemProgressMap]
  );

  const renderStatDiff = (diff: number) => {
    if (diff === 0) return <span className="text-[10px] font-black text-slate-600 bg-slate-800/50 px-1 rounded">-</span>;
    return (
      <span className={`text-[10px] font-black px-1 rounded ${diff > 0 ? 'text-emerald-400 bg-emerald-900/30 border border-emerald-500/30' : 'text-red-400 bg-red-900/30 border border-red-500/30'}`}>
        {diff > 0 ? '+' : ''}{diff}
      </span>
    );
  };

  // --- AUSRÜSTUNGS-LOGIK FÜR DAS INVENTAR (MIT MATCH-SPERRE) ---
  const handleEquipItem = async (item: ShopItem, category: 'partner' | 'racket' | 'shot') => {
    if (isLoadoutLockedByActiveMatch(user?.id)) {
      setMessage({ type: 'error', text: t("lock_match_err") });
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    if (category === 'partner') {
      setEquippedPartner(item.id);
      setPartnerId(item.id);
      localStorage.setItem("tacpadel_partner_id", item.id);
      await supabase.from('user_stats').update({ partner_id: item.id }).eq('id', user.id);
    } else if (category === 'racket') {
      setEquippedRacket(item.id);
      setRacketId(item.id);
      localStorage.setItem("tacpadel_racket_id", item.id);
      await supabase.from('user_stats').update({ equipped_racket: item.id }).eq('id', user.id);
    } else {
      setEquippedShot(item.id);
      setShotId(item.id);
      localStorage.setItem("tacpadel_power_shot", item.id);
      await supabase.from('user_stats').update({ equipped_shot: item.id }).eq('id', user.id);
    }
    const details = getUpgradedItemDetails(item, itemProgressMap);
    setMessage({ type: 'success', text: `${details.displayName} ${t("prof_msg_equipped")}` });
    setTimeout(() => setMessage(null), 2000);
  };

  // --- RPG "+1" UPGRADE-LOGIK DIREKT IM INVENTAR ---
  const handleUpgradeItem = async (item: ShopItem) => {
    const details = getUpgradedItemDetails(item, itemProgressMap);

    if (details.isMaxLevel) return;

    if (!details.canUpgrade) {
      const missingXp = Math.max(1, details.reqXp - details.xp);
      setMessage({
        type: 'error',
        text: `${t("rpg_need_more_xp_1")} ${missingXp} ${t("rpg_need_more_xp_2")}`,
      });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (tacPoints < details.upgradeCostTp) {
      const missingTp = details.upgradeCostTp - tacPoints;
      setMessage({
        type: 'error',
        text: `${t("prof_msg_need_tp_1")} ${missingTp} ${t("prof_msg_need_tp_2")}`,
      });
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    const res = performItemUpgrade(item.id, tacPoints);
    if (!res.success) return;

    setTacPoints(res.newTacPoints);
    setItemProgressMap({ ...res.updatedProgressMap });

    if (user?.id) {
      await supabase
        .from('user_stats')
        .update({ tac_points: res.newTacPoints })
        .eq('id', user.id);
      await supabase.auth
        .updateUser({ data: { item_progress: res.updatedProgressMap } })
        .catch(() => {});
    }

    setMessage({
      type: 'success',
      text: `⬆️ ${item.name} ${t("rpg_upgrade_success")} +${res.newLevel}!`,
    });
    setTimeout(() => setMessage(null), 3000);
  };

  // Hilfs-Renderer für die XP-Leiste + "+1 Upgrade"-Button unter jedem ausgewählten Inventar-Item
  const renderRpgUpgradeSection = (item: ShopItem) => {
    const details = getUpgradedItemDetails(item, itemProgressMap);
    const xpPct = details.isMaxLevel
      ? 100
      : details.reqXp > 0
      ? Math.min(100, Math.round((details.xp / details.reqXp) * 100))
      : 0;
    const canAffordTp = tacPoints >= details.upgradeCostTp;
    const mods = details.effectiveModifiers;

    return (
      <div className="mt-1.5 pt-2 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1 text-[8px] font-black">
          {mods.smash !== 0 && (
            <span className={`px-1.5 py-0.5 rounded ${mods.smash > 0 ? "bg-orange-950/60 text-orange-400 border border-orange-500/30" : "bg-red-950/40 text-red-400"}`}>
              PWR {mods.smash > 0 ? `+${mods.smash}` : mods.smash}
            </span>
          )}
          {mods.control !== 0 && (
            <span className={`px-1.5 py-0.5 rounded ${mods.control > 0 ? "bg-cyan-950/60 text-cyan-400 border border-cyan-500/30" : "bg-red-950/40 text-red-400"}`}>
              CTRL {mods.control > 0 ? `+${mods.control}` : mods.control}
            </span>
          )}
          {mods.defense !== 0 && (
            <span className={`px-1.5 py-0.5 rounded ${mods.defense > 0 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" : "bg-red-950/40 text-red-400"}`}>
              DEF {mods.defense > 0 ? `+${mods.defense}` : mods.defense}
            </span>
          )}
          {mods.agility !== 0 && (
            <span className={`px-1.5 py-0.5 rounded ${mods.agility > 0 ? "bg-purple-950/60 text-purple-400 border border-purple-500/30" : "bg-red-950/40 text-red-400"}`}>
              AGI {mods.agility > 0 ? `+${mods.agility}` : mods.agility}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider">
            <span className={details.canUpgrade ? "text-amber-400 animate-pulse" : "text-slate-400"}>
              {details.isMaxLevel
                ? t("rpg_max_level")
                : details.canUpgrade
                ? t("rpg_ready_upgrade")
                : `${t("rpg_xp_label")} (Lvl +${details.level} ➔ +${details.level + 1})`}
            </span>
            {!details.isMaxLevel && (
              <span className="text-cyan-300">
                {details.xp} / {details.reqXp} {t("rpg_xp_pts")} ({xpPct}%)
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                details.isMaxLevel
                  ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                  : details.canUpgrade
                  ? "bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400"
                  : "bg-gradient-to-r from-cyan-600 to-purple-500"
              }`}
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {!details.isMaxLevel && (
          <button
            onClick={() => handleUpgradeItem(item)}
            className={`w-full py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
              details.canUpgrade && canAffordTp
                ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                : details.canUpgrade && !canAffordTp
                ? "bg-slate-800 text-amber-400/70 border border-amber-500/30"
                : "bg-slate-900/80 text-slate-500 border border-slate-800"
            }`}
          >
            <span>
              {t("rpg_upgrade_btn")} +{details.level + 1} ({details.upgradeCostTp} TP 🪙)
            </span>
          </button>
        )}
      </div>
    );
  };

  const handleAutoSave = async () => {
    const newName = username.trim();
    const newTeam = teamName.trim();
    
    if (newName === savedUsername && newTeam === savedTeamName) return;
    if (!newName || !newTeam) return;
    
    setIsSaving(true);
    setMessage(null);
    
    const { error: authError } = await supabase.auth.updateUser({ data: { display_name: newName } });
    
    const { error: dbError } = await supabase.from('user_stats').update({ 
      display_name: newName,
      team_name: newTeam 
    }).eq('id', user.id);
    
    setIsSaving(false);
    if (authError || dbError) {
      setMessage({ type: 'error', text: t("prof_msg_save_err") });
      setTimeout(() => setMessage(null), 3000); 
    } else {
      setSavedUsername(newName);
      setSavedTeamName(newTeam);
      setMessage({ type: 'success', text: t("prof_msg_autosaved") });
      setTimeout(() => setMessage(null), 2500); 
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setMessage(null);
      if (!event.target.files || event.target.files.length === 0) throw new Error(t("prof_msg_select_img"));
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
      setMessage({ type: 'success', text: t("prof_msg_avatar_updated") });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: t("prof_msg_upload_err") + error.message });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      setMessage(null);

      await supabase.from('match_history').delete().eq('user_id', user.id);
      await supabase.from('tour_progress').delete().eq('user_id', user.id);
      await supabase.from('user_stats').delete().eq('id', user.id);

      const { error: rpcError } = await supabase.rpc('delete_user');
      if (rpcError) {
        console.warn("Hinweis bei RPC delete_user:", rpcError.message);
      }

      localStorage.clear();
      await supabase.auth.signOut();
    } catch (error: any) {
      setMessage({ type: 'error', text: t("prof_msg_delete_err") + error.message });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
  const toggleHaptics = () => {
    const newState = !hapticsEnabled;
    setHapticsEnabled(newState);
    localStorage.setItem("tacpadel_haptics", String(newState));
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

  const selectedPartnerObj = ownedPartners.find(p => p.id === partnerId) || ownedPartners[0] || SHOP_PARTNERS[0];
  const selectedRacketObj = ownedRackets.find(r => r.id === racketId) || ownedRackets[0] || SHOP_RACKETS[0];
  const selectedShotObj = ownedShots.find(s => s.id === shotId) || ownedShots[0] || SHOP_SHOTS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.18 }}
      className={`flex flex-col items-center justify-start p-4 sm:p-8 ${lowPerfMode ? 'bg-[#040914]' : 'bg-[#040914]/90 backdrop-blur-md'} border border-slate-800 rounded-2xl shadow-2xl max-w-3xl mx-auto mt-6 mb-24 gap-6 w-full`}
    >
      {/* ========================================= */}
      {/* IN-GAME SHOP MODAL                        */}
      {/* ========================================= */}
      <InGameShopModal
        isOpen={isShopModalOpen}
        onClose={() => {
          setIsShopModalOpen(false);
          syncLoadoutFromStorage();
        }}
        userId={user?.id || null}
        onLoadoutChanged={syncLoadoutFromStorage}
      />

      {/* ========================================= */}
      {/* 1. KOPFBEREICH: Avatar & Name             */}
      {/* ========================================= */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full relative">
        <div className="relative flex flex-col items-center shrink-0">
          <label htmlFor="avatar-upload" className={`relative cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:border-cyan-500/50 transition-colors" />
            ) : (
              <div className="w-28 h-28 bg-cyan-950/30 rounded-full flex items-center justify-center mx-auto text-cyan-500 text-5xl border-2 border-dashed border-cyan-500/50 group-hover:bg-cyan-900/50 transition-colors shadow-sm">👤</div>
            )}
            <div className="absolute bottom-0 right-0 bg-background border border-border rounded-full p-2.5 shadow-md text-sm group-hover:scale-110 transition-transform">✏</div>
          </label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} className="hidden" />
          {isUploading && <span className="text-[10px] text-cyan-400 mt-3 font-bold animate-pulse uppercase tracking-wider">{t("prof_uploading")}</span>}
        </div>

        <div className="flex flex-col gap-3 w-full">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white tracking-wide text-center md:text-left">{t("prof_title")}</h2>
              {isProUser && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-pink-950/60 border border-pink-500/50 text-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                  👑 PRO USER
                </span>
              )}
            </div>
            
            {message && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
              >
                {isSaving ? t("prof_saving") : message.text}
              </motion.div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase ml-1">{t("prof_email")}</label>
              <div className="px-4 py-3 bg-[#030611] border border-slate-800 rounded-xl text-slate-500 text-xs font-semibold cursor-not-allowed">{user?.email}</div>
            </div>
            <div className="flex flex-col gap-1.5 text-left relative group">
              <label className="text-[10px] font-bold tracking-widest text-cyan-500 uppercase ml-1">{t("prof_player_name")}</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onBlur={handleAutoSave} 
                onKeyDown={(e) => e.key === 'Enter' && handleAutoSave()}
                placeholder={t("prof_name_placeholder")} 
                className="px-4 py-3 bg-[#050b18] border border-cyan-900/50 focus:border-cyan-400 rounded-xl text-white text-sm font-bold outline-none transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 w-full mt-1">
            <div className="flex flex-col gap-1.5 text-left relative group">
              <label className="text-[10px] font-bold tracking-widest text-purple-400 uppercase ml-1">{t("prof_team_name")}</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)} 
                onBlur={handleAutoSave} 
                onKeyDown={(e) => e.key === 'Enter' && handleAutoSave()}
                placeholder={t("prof_team_placeholder")} 
                className="px-4 py-3 bg-[#050b18] border border-purple-900/50 focus:border-purple-400 rounded-xl text-white text-sm font-bold outline-none transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>
          <span className="text-[8px] text-slate-500 text-right mt-[-4px] mr-2">{t("prof_autosave_hint")}</span>
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />

      {/* ======================================================== */}
      {/* 1.5 KOMBINIERTER 3D SHOWROOM (Spind & Trophäen-Vault)    */}
      {/* ======================================================== */}
      <div className="w-full bg-[#050b14] border border-slate-800 rounded-2xl p-5 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col gap-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex bg-[#03060c] p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => { setActive3DView('locker'); setActiveTrophyBanner(null); }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                active3DView === 'locker'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t("prof_tab_locker")}
            </button>
            <button
              onClick={() => setActive3DView('trophies')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                active3DView === 'trophies'
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t("prof_tab_trophies")}</span>
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-black/40 text-purple-200">
                {wonTrophies.length} {t("prof_titles_count")}
              </span>
            </button>
          </div>

          <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/30 rounded border border-cyan-900/50">
            {lowPerfMode ? t("prof_3d_eco") : t("prof_3d_view")}
          </span>
        </div>

        {/* Tour Ranking Fortschrittsbalken */}
        <div className="w-full bg-[#030611]/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-1.5">
          <div className="flex justify-between items-end">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Open</span>
            <span className="text-[11px] font-black tracking-widest text-purple-400">{currentScore} TacScore</span>
            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Major</span>
          </div>
          <div className="w-full h-2.5 bg-[#050b18] border border-slate-800 rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-slate-700/80 z-10" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-slate-700/80 z-10" />
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] transition-all duration-1000 ease-out relative z-0" 
              style={{ width: `${Math.min(100, Math.max(5, (currentScore / 6000) * 100))}%` }} 
            />
          </div>
        </div>

        {/* GEMEINSAMER 3D CANVAS CONTAINER */}
        <div className={`w-full ${active3DView === 'trophies' ? 'h-[380px] border-cyan-900/50 shadow-[inset_0_0_30px_rgba(6,182,212,0.15)]' : 'h-64 sm:h-72 border-slate-800/80 shadow-inner'} bg-[#020408] rounded-xl border overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300`}>
          
          {active3DView === 'locker' && !lowPerfMode && (
            <>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/40 blur-[40px] pointer-events-none" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-orange-500/40 blur-[40px] pointer-events-none" />
            </>
          )}

          {active3DView === 'trophies' && (
            <div className="absolute top-3 left-4 z-10 pointer-events-none">
              <span className="text-[8px] text-cyan-400 uppercase tracking-widest font-black block drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{t("prof_vault_title")}</span>
            </div>
          )}

          {active3DView === 'trophies' && wonTrophies.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{t("prof_vault_empty")}</span>
            </div>
          )}

          <Canvas 
            dpr={dpr}
            camera={{ position: [0, 1.2, 4], fov: 45 }}
            gl={{
              antialias: !lowPerfMode,
              powerPreference: "high-performance",
              precision: lowPerfMode ? "mediump" : "highp"
            }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", (e) => {
                e.preventDefault();
                setLowPerfMode(true);
                setDpr(0.7);
              }, false);
            }}
          >
            <PerformanceMonitor
              onDecline={() => {
                setLowPerfMode(true);
                setDpr(0.75);
              }}
              onFallback={() => {
                setLowPerfMode(true);
                setDpr(0.65);
              }}
              onIncline={() => {
                if (!detectLowEndDevice()) {
                  setDpr(1.5);
                }
              }}
            />
            <AdaptiveDpr pixelated />

            <CameraSwitcher mode={active3DView} controlsRef={controlsRef} />

            {active3DView === 'locker' ? (
              <>
                <ambientLight intensity={2.5} />
                <directionalLight position={[0, 1.5, 3]} intensity={2.5} color="#ffffff" />
                {!lowPerfMode && (
                  <>
                    <spotLight position={[0, 4, 1]} intensity={3.0} angle={0.8} penumbra={1} />
                    <pointLight position={[-1.5, 1.5, 1.5]} intensity={15} color="#00f0ff" distance={10} />
                    <pointLight position={[1.5, 1.5, 1.5]} intensity={15} color="#ff7700" distance={10} />
                  </>
                )}
                <React.Suspense fallback={null}>
                  <PlayerShow />
                </React.Suspense>
                <OrbitControls 
                  ref={controlsRef}
                  enableZoom={false} 
                  enablePan={false} 
                  autoRotate 
                  autoRotateSpeed={0.5} 
                  minPolarAngle={Math.PI / 2.5} 
                  maxPolarAngle={Math.PI / 2} 
                />
              </>
            ) : (
              <>
                <ambientLight intensity={lowPerfMode ? 1.4 : 0.8} />
                <pointLight position={[0, 4, 3]} intensity={2.5} color="#0ea5e9" />
                <React.Suspense fallback={null}>
                  <TronCabinet 
                    trophies={wonTrophies} 
                    onTrophyClick={(id) => setActiveTrophyBanner(id)} 
                    lowQuality={lowPerfMode}
                  />
                </React.Suspense>
                <OrbitControls 
                  ref={controlsRef}
                  target={[0, 2, 0]} 
                  enableZoom={true} 
                  maxDistance={14} 
                  minDistance={3} 
                  maxPolarAngle={Math.PI / 2 + 0.05} 
                  minPolarAngle={Math.PI / 4} 
                />
              </>
            )}
          </Canvas>

          {/* DYNAMISCHES BANNER OVERLAY */}
          <AnimatePresence>
            {active3DView === 'trophies' && activeTrophyBanner && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                onClick={() => setActiveTrophyBanner(null)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 border border-cyan-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer z-20 flex flex-col items-center text-center"
              >
                <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-1">{t("prof_winner")}</span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">{formatTourName(activeTrophyBanner)}</h4>
                <span className="text-[8px] text-slate-400 mt-2">{t("prof_click_close")}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full h-px bg-slate-800/60 my-2" />
      
      {/* ========================================================= */}
      {/* 2. STATS & GEAR INVENTAR (INKL. RPG +1 UPGRADES & LOCK)   */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 gap-4 w-full">
        
        {/* INVENTAR & AUSSTATTUNGS-BOX */}
        <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800/80 pb-3 gap-2">
            <div>
              <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
                {t("prof_inventory_title")}
              </h3>
              <span className="text-[9px] text-slate-500 font-bold">
                {t("prof_inventory_sub")}
              </span>
            </div>
            <button 
              onClick={() => setIsShopModalOpen(true)}
              className="text-[10px] font-black text-amber-300 bg-amber-950/40 border border-amber-500/40 px-3.5 py-2 rounded-xl hover:bg-amber-900/50 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] shrink-0 flex items-center gap-1.5"
            >
              <span>🪙 In-Game Shop ({tacPoints} TP) ➔</span>
            </button>
          </div>

          {isMatchLocked && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
              <span>{t("lock_match_banner")}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex flex-col gap-3">
              {/* 1. PARTNER-INVENTAR */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                    {t("prof_partner_sec")} ({ownedPartners.length})
                  </label>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                    {equippedPartner === partnerId ? t("prof_status_equipped") : selectedPartnerObj.badge}
                  </span>
                </div>
                <select 
                  disabled={isMatchLocked}
                  value={partnerId} 
                  onChange={(e) => {
                    if (isLoadoutLockedByActiveMatch(user?.id)) {
                      setMessage({ type: 'error', text: t("lock_match_err") });
                      setTimeout(() => setMessage(null), 2500);
                      return;
                    }
                    const nextPartner = e.target.value;
                    setPartnerId(nextPartner);
                    setEquippedPartner(nextPartner);
                    localStorage.setItem("tacpadel_partner_id", nextPartner);
                    supabase.from('user_stats').update({ partner_id: nextPartner }).eq('id', user.id).then(() => {});
                  }} 
                  className={`px-3 py-2 bg-[#0a1122] border border-slate-700/50 focus:border-cyan-500/50 rounded-lg text-white text-xs font-bold outline-none transition-colors appearance-none ${isMatchLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {ownedPartners.map(p => {
                    const d = getUpgradedItemDetails(p, itemProgressMap);
                    return (
                      <option key={p.id} value={p.id}>
                        ✓ {d.displayName} ({p.badge})
                      </option>
                    );
                  })}
                </select>
                {selectedPartnerObj.perk && (
                  <span className="text-[10px] text-slate-400 italic">
                    ⚡ {formatPartnerPerk(selectedPartnerObj.id, lang, selectedPartnerObj.perk)}
                  </span>
                )}

                {renderRpgUpgradeSection(selectedPartnerObj)}

                {equippedPartner !== partnerId && (
                  <button
                    disabled={isMatchLocked}
                    onClick={() => handleEquipItem(selectedPartnerObj, 'partner')}
                    className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  >
                    {isMatchLocked ? t("lock_match_btn") : t("prof_status_owned")}
                  </button>
                )}
              </div>

              {/* 2. SCHLÄGER-INVENTAR */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                    {t("prof_racket_sec")} ({ownedRackets.length})
                  </label>
                  <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                    {equippedRacket === racketId ? t("prof_status_equipped") : selectedRacketObj.badge}
                  </span>
                </div>
                <select 
                  disabled={isMatchLocked}
                  value={racketId} 
                  onChange={(e) => {
                    if (isLoadoutLockedByActiveMatch(user?.id)) {
                      setMessage({ type: 'error', text: t("lock_match_err") });
                      setTimeout(() => setMessage(null), 2500);
                      return;
                    }
                    const nextId = e.target.value;
                    setRacketId(nextId);
                    setEquippedRacket(nextId);
                    localStorage.setItem("tacpadel_racket_id", nextId);
                    supabase.from('user_stats').update({ equipped_racket: nextId }).eq('id', user.id).then(() => {});
                  }} 
                  className={`px-3 py-2 bg-[#0a1122] border border-slate-700/50 focus:border-cyan-500/50 rounded-lg text-white text-xs font-bold outline-none transition-colors appearance-none ${isMatchLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {ownedRackets.map(r => {
                    const d = getUpgradedItemDetails(r, itemProgressMap);
                    return (
                      <option key={r.id} value={r.id}>
                        ✓ {d.displayName} ({r.badge})
                      </option>
                    );
                  })}
                </select>

                {renderRpgUpgradeSection(selectedRacketObj)}

                {equippedRacket !== racketId && (
                  <button
                    disabled={isMatchLocked}
                    onClick={() => handleEquipItem(selectedRacketObj, 'racket')}
                    className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  >
                    {isMatchLocked ? t("lock_match_btn") : t("prof_status_owned")}
                  </button>
                )}
              </div>

              {/* 3. SPEZIAL-SCHLAG-INVENTAR */}
              <div className="bg-[#050b18] p-3 rounded-lg border border-slate-800/50 flex flex-col gap-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                    {t("prof_shot_sec")} ({ownedShots.length})
                  </label>
                  <span className="text-[9px] font-black uppercase tracking-wider text-orange-400">
                    {equippedShot === shotId ? t("prof_status_equipped") : selectedShotObj.badge}
                  </span>
                </div>
                <select 
                  disabled={isMatchLocked}
                  value={shotId}
                  onChange={(e) => {
                    if (isLoadoutLockedByActiveMatch(user?.id)) {
                      setMessage({ type: 'error', text: t("lock_match_err") });
                      setTimeout(() => setMessage(null), 2500);
                      return;
                    }
                    const nextShot = e.target.value;
                    setShotId(nextShot);
                    setEquippedShot(nextShot);
                    localStorage.setItem("tacpadel_power_shot", nextShot);
                    supabase.from('user_stats').update({ equipped_shot: nextShot }).eq('id', user.id).then(() => {});
                  }}
                  className={`px-3 py-2 bg-[#0a1122] border border-slate-700/50 focus:border-cyan-500/50 rounded-lg text-white text-xs font-bold outline-none transition-colors appearance-none ${isMatchLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {ownedShots.map(s => {
                    const d = getUpgradedItemDetails(s, itemProgressMap);
                    return (
                      <option key={s.id} value={s.id}>
                        ✓ {d.displayName} ({s.badge})
                      </option>
                    );
                  })}
                </select>

                {renderRpgUpgradeSection(selectedShotObj)}

                {equippedShot !== shotId && (
                  <button
                    disabled={isMatchLocked}
                    onClick={() => handleEquipItem(selectedShotObj, 'shot')}
                    className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  >
                    {isMatchLocked ? t("lock_match_btn") : t("prof_status_owned")}
                  </button>
                )}
              </div>
            </div>

            {/* SPIELER ATTRIBUTE & AKTIVER MATCH-EFFEKT */}
            <div className="bg-[#050b18] p-4 rounded-lg border border-slate-800/50 flex flex-col justify-between relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] pointer-events-none" />
              
              <div>
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                  <h4 className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t("prof_attr_title")}</h4>
                  {(partnerId !== equippedPartner || racketId !== equippedRacket || shotId !== equippedShot) && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                      {t("prof_preview")}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Smash Power</span>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.smash}</span>
                      {renderStatDiff(loadoutStats.diffs.smash)}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1">
                      {t("prof_stat_winner_chance")} {loadoutStats.matchModifiers.winnerChanceBonus >= 0 ? "+" : ""}{Math.round(loadoutStats.matchModifiers.winnerChanceBonus * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Control</span>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.control}</span>
                      {renderStatDiff(loadoutStats.diffs.control)}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1">
                      {t("prof_stat_unforced_errors")} {Math.round((loadoutStats.matchModifiers.errorReductionFactor - 1) * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Defense</span>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.defense}</span>
                      {renderStatDiff(loadoutStats.diffs.defense)}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1">
                      {t("prof_stat_block_save")} {loadoutStats.matchModifiers.defenseSaveBonus >= 0 ? "+" : ""}{Math.round(loadoutStats.matchModifiers.defenseSaveBonus * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Agility</span>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-xl font-black text-white leading-none">{loadoutStats.stats.agility}</span>
                      {renderStatDiff(loadoutStats.diffs.agility)}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1">
                      {t("prof_stat_stamina_drain")} {Math.round((loadoutStats.matchModifiers.staminaDrainMultiplier - 1) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 text-[9px] text-slate-400 flex items-center justify-between">
                <span>{t("prof_setup_active_hint")}</span>
                <span className="text-emerald-400 font-black uppercase">{t("prof_active_badge")}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2.5 STATISTIK-FILTER (EINZEL / TURNIER)   */}
      {/* ========================================= */}
      <div className="flex bg-[#030611]/80 border border-slate-800/80 rounded-xl p-1.5 w-full mt-4 shadow-lg">
        <button onClick={() => setStatsMode('single')} className={`flex-1 py-3 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'single' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>{t("prof_filter_single")}</button>
        <button onClick={() => setStatsMode('tournament')} className={`flex-1 py-3 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'tournament' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>{t("prof_filter_tour")}</button>
      </div>

      {/* ========================================= */}
      {/* 3. MATCH BILANZ                           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-row justify-between items-center">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">{t("prof_balance_title")} ({statsMode === 'single' ? t("prof_mode_single") : t("prof_mode_tour")})</h3>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{t("prof_balance_sub")}</span>
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
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">{t("prof_shot_analysis")} ({statsMode === 'single' ? t("prof_mode_single") : t("prof_mode_tour")})</h3>
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/30">{t("prof_last_matches_1")} {matchesWithStats} {t("prof_last_matches_2")}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgWinners}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">{t("prof_stat_winners")}</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-slate-800/50 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{aggStats.avgAces}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">{t("prof_stat_aces")}</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-red-900/20 flex flex-col items-center justify-center text-center shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
            <span className="text-2xl font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{aggStats.avgErrors}</span>
            <span className="text-[9px] text-red-900/80 uppercase tracking-widest font-bold mt-1">{t("prof_stat_errors")}</span>
          </div>
          <div className="bg-[#050b18] py-4 rounded-lg border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-[inset_0_0_15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{aggStats.perfectRatio}%</span>
            <span className="text-[9px] text-emerald-700/80 uppercase tracking-widest font-bold mt-1">{t("prof_stat_perfect")}</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 5. TAC-SCORE / TAC-POINTS CHART           */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 h-[280px] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
            {t("prof_chart_title")} ({statsMode === 'single' ? 'TacScore' : 'TacPoints'})
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
      {/* 6. AUDIO, HAPTIK, SPRACHE & UI SETTINGS   */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col text-center sm:text-left">
            <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{t("prof_audio_title")}</h3>
            <span className="text-[9px] text-slate-600 font-bold mt-1">{t("prof_audio_sub")}</span>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_sfx")}</span>
              <button onClick={toggleSound} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${soundEnabled ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-slate-700'}`}>
                <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: soundEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_music")}</span>
              <button onClick={toggleMusic} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${musicEnabled ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-700'}`}>
                <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: musicEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_vibration")}</span>
              <button onClick={toggleHaptics} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${hapticsEnabled ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-slate-700'}`}>
                <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: hapticsEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_texts")}</span>
              <button onClick={toggleExplanations} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showExplanations ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-700'}`}>
                <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showExplanations ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_names")}</span>
              <button onClick={toggleNameTags} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showNameTags ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-700'}`}>
                <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: showNameTags ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
          </div>
        </div>

        {/* SPRACH-UMSCHALTER (DE / EN / ES) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-800/80">
          <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
            {t("prof_lang_label")}
          </span>
          <div className="flex bg-[#050b18] p-1 rounded-xl border border-slate-800 gap-1">
            {([
              { code: 'de', label: '🇩🇪 DE' },
              { code: 'en', label: '🇬🇧 EN' },
              { code: 'es', label: '🇪🇸 ES' },
            ] as const).map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  lang === l.code
                    ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 7. SPIELMECHANIK & GRAFIK SETTINGS        */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-slate-800/80 rounded-xl p-5 shadow-lg mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center sm:text-left">
          <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">{t("prof_mech_title")}</h3>
          <span className="text-[9px] text-slate-600 font-bold mt-1">{t("prof_mech_sub")}</span>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-5 sm:gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("prof_stamina")}</span>
            <button onClick={toggleStamina} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${staminaEnabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: staminaEnabled ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{t("prof_perf_mode")}</span>
            <button onClick={toggleLowPerf} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${lowPerfMode ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`}>
              <motion.div layout className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: lowPerfMode ? 24 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7.5 ADMIN DEVELOPER TOOLS                                 */}
      {/* ========================================================= */}
      {isAdmin && (
        <div className="w-full bg-[#050b18] border border-pink-500/40 rounded-xl p-5 shadow-[0_0_25px_rgba(236,72,153,0.12)] mt-2 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col text-center sm:text-left">
              <h3 className="text-[10px] font-black tracking-widest text-pink-400 uppercase">
                🛡️ Admin Test-Steuerung &amp; Zentrale
              </h3>
              <span className="text-[9px] text-slate-400 font-bold mt-1">
                Eigenen Pro-Status testen, Tester freischalten &amp; Strategien prüfen
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2.5 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isProUser ? 'text-pink-400' : 'text-slate-500'}`}>
                  {isProUser ? "👑 Pro Aktiv" : "🔒 Free"}
                </span>
                <button
                  onClick={toggleProUserStatus}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                    isProUser ? 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-[0_0_12px_rgba(236,72,153,0.6)]' : 'bg-slate-700'
                  }`}
                >
                  <motion.div
                    layout
                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md"
                    animate={{ x: isProUser ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              <button
                onClick={() => setShowAdminModal(!showAdminModal)}
                className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
              >
                {showAdminModal ? "✕ Zentrale schließen" : "🛠️ Admin-Zentrale öffnen"}
              </button>
            </div>
          </div>

          {showAdminModal && (
            <div className="pt-2 border-t border-slate-800/80">
              <AdminDashboard onExit={() => setShowAdminModal(false)} initialTab="users" />
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* 8. KONTO & DATENSCHUTZ (INKL. LÖSCHUNG)   */}
      {/* ========================================= */}
      <div className="w-full bg-[#030611]/80 border border-red-950/50 rounded-xl p-5 shadow-lg mt-2 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col text-center sm:text-left">
            <h3 className="text-[10px] font-black tracking-widest text-red-400 uppercase">{t("prof_account_title")}</h3>
            <span className="text-[9px] text-slate-600 font-bold mt-1">{t("prof_account_sub")}</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2.5 shrink-0">
            <a
              href="https://tac-padel-api-server.vercel.app/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-black text-slate-300 hover:text-cyan-400 uppercase tracking-widest transition-all"
            >
              {t("prof_privacy_link")}
            </a>

            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 rounded-lg text-[10px] font-black text-red-400 uppercase tracking-widest transition-all"
              >
                {t("prof_delete_btn")}
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-950/20 border border-red-500/40 rounded-lg p-4 flex flex-col gap-3 overflow-hidden"
            >
              <p className="text-xs font-bold text-red-300 text-center sm:text-left leading-relaxed">
                {t("prof_delete_warn_1")} <span className="underline font-black text-white">{t("prof_delete_warn_bold")}</span> {t("prof_delete_warn_2")}
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-2.5 mt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-black text-slate-300 uppercase tracking-widest transition-colors"
                >
                  {t("prof_cancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-[10px] font-black text-white uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all disabled:opacity-50"
                >
                  {isDeleting ? t("prof_deleting") : t("prof_confirm_delete")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button onClick={() => setActiveTab("home")} className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest transition-colors mt-2">
        {t("prof_back_menu")}
      </button>

    </motion.div>
  );
}
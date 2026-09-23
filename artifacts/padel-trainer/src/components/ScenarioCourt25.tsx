import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Text } from "@react-three/drei";
import * as THREE from "three"; 

import { supabase } from "../lib/supabase";
import Effects from "../components/ScenarioCourt3D/Effects";
import CourtFloor from "../components/ScenarioCourt3D/CourtFloor";
import TacticalData from "../components/ScenarioCourt3D/TacticalData";

export interface PlayerPositions {
  you: string;
  partner: string;
  opp1: string;
  opp2: string;
  ball: { 
    side: "left" | "right"; 
    zone: string; 
    type?: string; 
  };
}

export interface Props {
  level: "Schlag" | "Schlagrichtung" | "Laufrichtung" | "Spielzug";
  positions: PlayerPositions;
  selectedZone: string | null;
  hasSubmitted: boolean;
  bestZones: string[];
  acceptableZones?: string[];
  onZoneClick: (id: string) => void;
  profiMode?: boolean; 
  selectedLaufZone?: string | null;
  perfectLaufZone?: string | null;
  acceptableLaufZones?: string[];
  onLaufZoneClick?: (id: string) => void;
  previewShot?: string | null;
  
  feedbackMsg?: string | null; 

  activeChar: "you" | "partner" | "opp1" | "opp2";
  hitterId: "you" | "partner" | "opp1" | "opp2";
  selectedPartnerZone?: string | null;
  onPlayerClick?: (char: "you" | "partner") => void;
  
  isTimerActive?: boolean;
  turnResult?: string | null;
  playerScore?: number | string;
  aiScore?: number | string;
  isAiActive?: boolean;
  phase?: string;
  isTimerPhase?: boolean;
  isPlayerTeamServe?: boolean;

  courtState?: any; 
  gameOver?: boolean;
  showResultOverlay?: boolean;
  catchStatus?: string;
  activeScenario?: boolean;
  timeLeft?: number;
  timerDuration?: number;
  playIntro?: boolean;
  onIntroFinished?: () => void;
}

// ==========================================
// 1. ZONEN-BERECHNUNG & RASTER
// ==========================================
const getMarkingPosition = (zoneId: string, side: "left" | "right"): THREE.Vector3 => {
  if (!zoneId || zoneId.length < 2) return new THREE.Vector3(0, 0.02, 0);
  
  const letter = zoneId[0].toUpperCase();
  const num = parseInt(zoneId[1]);

  let x = 0;
  if (letter === "A") x = -4.0;
  if (letter === "B") x = -2.0;
  if (letter === "C") x = 0.0;
  if (letter === "D") x = 2.0;
  if (letter === "E") x = 4.0;

  let z = 0;
  if (num === 1) z = 9.0;
  if (num === 2) z = 7.0;
  if (num === 3) z = 5.0;
  if (num === 4) z = 3.0;
  if (num === 5) z = 1.0;

  if (side === "left") z = -z; 

  let offsetX = 0;
  if (letter === "A") offsetX = -0.35; 
  if (letter === "B") offsetX = -0.15;
  if (letter === "C") offsetX = 0.0;  
  if (letter === "D") offsetX = 0.15;
  if (letter === "E") offsetX = 0.35;  

  let offsetZ = 0;
  if (num === 1) offsetZ = 0.35; 
  if (num === 2) offsetZ = 0.15; 
  if (num === 3) offsetZ = 0.0;   
  if (num === 4) offsetZ = -0.15;
  if (num === 5) offsetZ = -0.35; 

  if (side === "left") offsetZ = -offsetZ; 

  return new THREE.Vector3(x + offsetX, 0.02, z + offsetZ);
};

function StaticCourtMarkings({ level, profiMode }: { level: string, profiMode?: boolean }) {
  const letters = ["A", "B", "C", "D", "E"]; 
  const zones: string[] = [];
  
  letters.forEach(letter => {
    for (let i = 1; i <= 5; i++) {
      zones.push(`${letter}${i}`);
    }
  });

  const showPlayerSide = level === "Schlag" || profiMode;
  const showOpponentSide = level !== "Schlag";

  return (
    <group>
      {showPlayerSide && zones.map((zone) => (
        <Text key={`right-${zone}`} position={getMarkingPosition(zone, "right")} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#ffffff" fillOpacity={0.65} anchorX="center" anchorY="middle" material-toneMapped={false}>
          {zone}
        </Text>
      ))}
      {showOpponentSide && zones.map((zone) => {
        const pos = getMarkingPosition(zone, "left");
        pos.y = 0.03; 
        return (
          <Text key={`left-${zone}`} position={pos} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.4} color="#ffffff" fillOpacity={0.75} anchorX="center" anchorY="middle" material-toneMapped={false}>
            {zone}
          </Text>
        );
      })}
    </group>
  );
}

// ==========================================
// 2. SCHWEBENDE HOLOGRAMM-TEXTE 
// ==========================================
function FloatingPrompts({ level, profiMode, selectedZone, selectedLaufZone, hasSubmitted }: Props) {
  const zielZoneRef = useRef<any>(null);
  const laufZoneRef = useRef<any>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulseOpacity = 0.6 + Math.sin(t * 3) * 0.25; 
    
    if (zielZoneRef.current) zielZoneRef.current.fillOpacity = pulseOpacity;
    if (laufZoneRef.current) laufZoneRef.current.fillOpacity = pulseOpacity;
  });

  const showZielzone = !selectedZone && !hasSubmitted && level !== "Schlag" && level !== "Laufrichtung";
  const showLaufziel = profiMode && !selectedLaufZone && !hasSubmitted;

  return (
    <group>
      {showZielzone && (
        <Text 
          ref={zielZoneRef} 
          position={[0, 1.0, -4.5]} 
          rotation={[-Math.PI / 4, 0, 0]} 
          fontSize={0.6} 
          color="#38bdf8" 
          anchorX="center" 
          anchorY="middle" 
          letterSpacing={0.15} 
          fontWeight="bold" 
          material-toneMapped={false}
        >
          ZIELZONE WÄHLEN
        </Text>
      )}

      {showLaufziel && (
        <Text 
          ref={laufZoneRef} 
          position={[0, 1.0, 4.5]} 
          rotation={[-Math.PI / 4, 0, 0]} 
          fontSize={0.6} 
          color="#c084fc" 
          anchorX="center" 
          anchorY="middle" 
          letterSpacing={0.15} 
          fontWeight="bold" 
          material-toneMapped={false}
        >
          LAUFZIEL WÄHLEN
        </Text>
      )}
    </group>
  );
}

// ==========================================
// 3. LED-PANEL & FILTER (ABSOLUT SYNCHRON ZUR UI)
// ==========================================
function HidePlayerLabels() {
  const { scene } = useThree();
  useEffect(() => {
    const hideInterval = setInterval(() => {
      scene.traverse((obj: any) => {
        if (obj.text && typeof obj.text === 'string') {
          const t = obj.text.toLowerCase().trim();
          if (t === "du" || t === "partner" || t === "ki 1" || t === "ki 2" || t === "gegner 1" || t === "gegner 2" || t === "opp1" || t === "opp2") {
            obj.visible = false;
          }
        }
      });
    }, 200);
    return () => clearInterval(hideInterval);
  }, [scene]);
  return null;
}

function StadiumLEDScreen(props: Props) {
  const [motivationText, setMotivationText] = useState("SUPER!");
  const [domSuccess, setDomSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (props.hasSubmitted) {
      const words = ["SUPER!", "KLASSE!", "STARK!", "PERFEKT!", "BOMBE!", "GENIAL!", "SAUBER!"];
      setMotivationText(words[Math.floor(Math.random() * words.length)]);

      // 100% SICHERES FALLBACK: Lese den Erfolg direkt aus der externen UI (Mission Erfolgreich)
      const checkDOM = () => {
        const text = document.body.textContent?.toUpperCase() || "";
        if (text.includes("MISSION ERFOLGREICH")) {
          setDomSuccess(true);
        }
      };
      
      checkDOM(); 
      const timer = setTimeout(checkDOM, 100); 
      return () => clearTimeout(timer);
    } else {
      setDomSuccess(null);
    }
  }, [props.hasSubmitted, props.turnResult]);

  let screenText = props.level.toUpperCase();
  let textColor = "text-white";
  let glowColor = "drop-shadow-[0_0_15px_rgba(14,165,233,0.6)]";
  
  let subText = "TAKTIK-TRAINER";
  let subTextColor = "text-sky-400";
  let textSize = "text-3xl"; 
  let textTransform = "uppercase"; 

  if (props.feedbackMsg) {
    screenText = props.feedbackMsg; 
    glowColor = "drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]";
    subText = "TAKTIK-KORREKTUR"; 
    subTextColor = "text-red-400";
    textSize = screenText.length > 20 ? "text-[1.1rem] px-4 leading-relaxed" : "text-3xl"; 
    textTransform = "normal-case";
  } else if (props.hasSubmitted) {
    const selZone = (props.selectedZone || "").trim().toUpperCase();
    const selLauf = (props.selectedLaufZone || "").trim().toUpperCase();
    const best = (props.bestZones || []).map(z => z.trim().toUpperCase());
    const accept = (props.acceptableZones || []).map(z => z.trim().toUpperCase());
    const perfLauf = (props.perfectLaufZone || "").trim().toUpperCase();
    const acceptLauf = (props.acceptableLaufZones || []).map(z => z.trim().toUpperCase());
    const currentLevel = (props.level || "").trim().toLowerCase();

    let isSuccess = false;

    // Normale Logik-Prüfung der Zonen (funktioniert bei Laufrichtung / Spielzug am besten)
    if (currentLevel === "laufrichtung") {
      isSuccess = (perfLauf === selLauf) || acceptLauf.includes(selLauf);
    } else if (props.profiMode) {
      const needsTarget = best.length > 0 || accept.length > 0;
      const needsLauf = perfLauf !== "" || acceptLauf.length > 0;
      const targetOk = !needsTarget || best.includes(selZone) || accept.includes(selZone);
      const laufOk = !needsLauf || perfLauf === selLauf || acceptLauf.includes(selLauf);
      isSuccess = targetOk && laufOk;
    } else if (currentLevel === "schlag") {
      // Wenn im Schlag-Modus ausnahmsweise mal eine Zone existiert
      if (selZone && (best.includes(selZone) || accept.includes(selZone))) {
        isSuccess = true;
      } else {
        // Interne Textanalyse als Reserve
        const res = (props.turnResult || "").toLowerCase();
        const hasError = res.startsWith("falsch") || 
                         res.startsWith("leider") || 
                         res.startsWith("schade") ||
                         res.includes("falsche wahl") ||
                         res.includes("nicht optimal");
        isSuccess = !hasError && res.length > 0;
      }
    } else {
      isSuccess = best.includes(selZone) || accept.includes(selZone);
    }

    // 🔥 DER ABSOLUTE OVERRIDE: Wenn die UI unten "Erfolgreich" sagt, wird alles auf Richtig gesetzt
    if (domSuccess === true) {
      isSuccess = true;
    }

    if (isSuccess) {
      screenText = motivationText;
      glowColor = "drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]";
      subText = "RICHTIGE WAHL";
      subTextColor = "text-emerald-400";
      textSize = "text-4xl";
    } else {
      screenText = props.turnResult ? props.turnResult : "FALSCHE WAHL";
      glowColor = "drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]";
      subText = "TAKTIK-KORREKTUR"; 
      subTextColor = "text-red-400";
      textSize = screenText.length > 20 ? "text-[1.1rem] px-4 leading-relaxed" : "text-3xl"; 
      textTransform = screenText.length > 20 ? "normal-case" : "uppercase";
    }
  }

  return (
    <group position={[0.25, 6.38, -11.7]} rotation={[0, 0, 0]}>
      <Html transform scale={0.78} className="pointer-events-none select-none taktik-screen">
        <div className="w-[400px] h-[200px] flex flex-col justify-center items-center bg-[#040914] border border-cyan-900/50 p-2 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent" />
          <p className={`text-sm font-bold tracking-[0.2em] uppercase mb-3 ${subTextColor}`}>{subText}</p>
          <h2 className={`${textSize} font-black text-center ${textColor} ${glowColor} ${textTransform}`}>{screenText}</h2>
        </div>
      </Html>
    </group>
  );
}

// ==========================================
// 4. HAUPTKOMPONENTE
// ==========================================
export default function ScenarioCourt25(props: Props) {
  const [playerName, setPlayerName] = useState("Gast");
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const fetchName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        let name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gast";
        const { data: profileData } = await supabase.from('user_stats').select('display_name').eq('id', user.id).maybeSingle();
        if (profileData?.display_name) name = profileData.display_name;
        setPlayerName(name);
      } catch (error) {
        console.error("Fehler beim Laden des Spielernamens:", error);
      }
    };
    fetchName();
  }, []);

  useEffect(() => {
    const hideHtmlInterval = setInterval(() => {
      const container = document.querySelector('.tactical-25-container');
      if (container) {
        const elements = container.querySelectorAll('div, span');
        elements.forEach(el => {
          const txt = el.textContent?.trim().toLowerCase() || "";
          
          if (txt === "du" || txt === "partner" || txt === "ki 1" || txt === "ki 2" || txt === "gegner 1" || txt === "gegner 2" || txt === "opp1" || txt === "opp2") {
            (el as HTMLElement).style.display = 'none'; 
          }
          
          if (txt.includes("team (du)") && txt.includes("match-tiebreak")) {
            if (!el.querySelector('canvas') && !el.classList.contains('taktik-screen')) {
              (el as HTMLElement).style.display = 'none';
            }
          }
        });
      }
    }, 200);
    return () => clearInterval(hideHtmlInterval);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#060913] overflow-hidden select-none tactical-25-container">
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto min-h-[250px]">
        <Canvas 
          dpr={[1, 1.5]}
          camera={{ position: [0, 15.0, 20.0], fov: 52 }} 
          gl={{ 
            antialias: false, 
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.0, 
            powerPreference: "high-performance" 
          }}
          className="w-full h-full"
        >
          <color attach="background" args={['#010205']} />
          <OrbitControls ref={controlsRef} enablePan={false} enableZoom={false} enableRotate={false} target={[0, 0, -2]} />
          
          <ambientLight intensity={0.1} color="#080d1e" />
          <directionalLight position={[0, 20, -10]} intensity={1.2} color="#ffffff" castShadow={false} />
          <Environment preset="city" environmentIntensity={0.5} />

          <Suspense fallback={<Html center className="text-white text-xs font-bold tracking-widest uppercase">Lade Arena...</Html>}>
            <Effects />
            <CourtFloor 
              serverId={props.hitterId} 
              playerScore={props.playerScore} 
              aiScore={props.aiScore}
              isAiActive={props.isAiActive}
              phase={props.phase}
              isTimerPhase={props.isTimerPhase}
              isPlayerTeamServe={props.isPlayerTeamServe}
              playerName={playerName}
            /> 
            
            <StaticCourtMarkings level={props.level} profiMode={props.profiMode} />
            
            <FloatingPrompts {...props} />
            
            <StadiumLEDScreen {...props} />

            <HidePlayerLabels />
            <TacticalData {...props} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
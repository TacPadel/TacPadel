import React, { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three"; 

import { supabase } from "../../lib/supabase";

import Effects from "./Effects";
import CourtFloor from "./CourtFloor";
import TacticalData from "./TacticalData";
import { AiProfile, AI_PROFILES } from "../../engine/AiProfiles";
import { SHOP_PARTNERS } from "../../lib/loadout";
import { useTranslation } from "../../lib/i18n";

// =========================================================
// ZENTRALE KAMERA-KONSTANTEN (Für nahtlose Übergänge)
// =========================================================
const DEFAULT_CAM_POS = new THREE.Vector3(0, 15.0, 27.5);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, -0.5, -2);

// =========================================================
// HILFSFUNKTION: Prüft, ob der Eco-Modus im Profil aktiv ist
// =========================================================
const isEcoModeEnabled = (): boolean => {
  try {
    const manualSetting = localStorage.getItem("tacpadel_low_perf");
    if (manualSetting === "true") return true;
    if (manualSetting === "false") return false;

    const nav = navigator as any;
    if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
  } catch (e) {}
  return false;
};

// Löst eine Partner-ID (Shop oder altes KI-Profil) sauber in den Anzeigenamen auf
const resolvePartnerNameFromId = (rawId?: string | null): string => {
  const pId = rawId || localStorage.getItem("tacpadel_partner_id") || "partner_rookie";
  const shopPartner = SHOP_PARTNERS.find((p) => p.id === pId);
  if (shopPartner) {
    return shopPartner.name.split(" (")[0];
  }
  if (pId.includes("-")) {
    const [baseId, pNum] = pId.split("-");
    const prof = AI_PROFILES.find((p) => p.id === baseId);
    if (prof) return pNum === "1" ? prof.p1 : prof.p2;
  }
  return SHOP_PARTNERS[0].name.split(" (")[0];
};

// =========================================================
// 1. CINEMATIC INTRO KAMERA (Endet exakt auf DEFAULT_CAM_POS)
// =========================================================
function IntroCamera({ onFinished }: { onFinished: () => void }) {
  const progressRef = useRef(0);
  const finishedRef = useRef(false);
  const delayTimer = useRef(0);
  
  const cameraPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, -15),  
    new THREE.Vector3(0, 4.0, -7),   
    new THREE.Vector3(0, 1.5, 0),    
    new THREE.Vector3(0, 6.5, 10),    
    new THREE.Vector3(8, 11.0, 18),   
    DEFAULT_CAM_POS.clone()   
  ]), []);

  const lookAtPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 5),
    new THREE.Vector3(0, 3, 10),
    new THREE.Vector3(0, 1, 4),
    new THREE.Vector3(0, 0, 0),
    DEFAULT_LOOK_AT.clone()
  ]), []);

  useFrame((state, delta) => {
    if (finishedRef.current) return;

    const safeDelta = Math.min(delta, 0.1);
    delayTimer.current += safeDelta;

    if (delayTimer.current < 1.2) {
      state.camera.position.copy(cameraPath.getPointAt(0));
      state.camera.lookAt(lookAtPath.getPointAt(0));
      return; 
    }

    const speed = 0.15; 
    progressRef.current += safeDelta * speed;

    if (progressRef.current >= 1) {
      progressRef.current = 1;
      finishedRef.current = true;
      state.camera.position.copy(DEFAULT_CAM_POS);
      state.camera.lookAt(DEFAULT_LOOK_AT);
      onFinished();
      return;
    }

    const camPos = cameraPath.getPointAt(progressRef.current);
    const lookTarget = lookAtPath.getPointAt(progressRef.current);

    state.camera.position.copy(camPos);
    state.camera.lookAt(lookTarget);
  });

  return null; 
}

// =========================================================
// 1b. CINEMATIC OUTRO KAMERA (Startet exakt auf DEFAULT_CAM_POS)
// =========================================================
function OutroCamera({ onCrash }: { onCrash: () => void }) {
  const progressRef = useRef(0); 
  const hasCrashed = useRef(false);
  
  const cameraPath = useMemo(() => new THREE.CatmullRomCurve3([
    DEFAULT_CAM_POS.clone(),    
    new THREE.Vector3(0, 7.5, 6),      
    new THREE.Vector3(0.5, 6.23, -6),  
    new THREE.Vector3(0.5, 6.23, -11)  
  ]), []);

  const lookAtPath = useMemo(() => new THREE.CatmullRomCurve3([
    DEFAULT_LOOK_AT.clone(),    
    new THREE.Vector3(0.5, 6.23, -11), 
    new THREE.Vector3(0.5, 6.23, -11.5), 
    new THREE.Vector3(0.5, 6.23, -11.7) 
  ]), []);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.1);
    const speed = 0.35; 
    progressRef.current += safeDelta * speed;

    if (progressRef.current >= 0.90 && !hasCrashed.current) {
      hasCrashed.current = true;
      onCrash();
    }

    if (progressRef.current >= 1) {
      progressRef.current = 1;
    }

    const camPos = cameraPath.getPointAt(progressRef.current);
    const lookTarget = lookAtPath.getPointAt(progressRef.current);

    state.camera.position.copy(camPos);
    state.camera.lookAt(lookTarget);
  });

  return null; 
}

// =========================================================
// 2. DYNAMISCHE ACTION-KAMERA (V4 - Angepasst an neuen Zoom)
// =========================================================
function DynamicActionCamera({ 
  hasSubmitted, 
  shotType, 
  turnResult,
  controlsRef,
  hitterId,          
  selectedZone       
}: { 
  hasSubmitted: boolean; 
  shotType?: string; 
  turnResult?: string | null; 
  controlsRef: React.MutableRefObject<any>;
  hitterId: string;
  selectedZone: string | null;
}) {
  const { camera } = useThree();
  const targetPos = useRef(DEFAULT_CAM_POS.clone());
  const targetLook = useRef(DEFAULT_LOOK_AT.clone());
  const currentLook = useRef(DEFAULT_LOOK_AT.clone());
  
  const timeSinceSubmit = useRef(0);

  useEffect(() => {
    if (!hasSubmitted) {
      timeSinceSubmit.current = 0;
      targetPos.current.copy(DEFAULT_CAM_POS);
      targetLook.current.copy(DEFAULT_LOOK_AT);
      currentLook.current.copy(DEFAULT_LOOK_AT);

      camera.position.copy(DEFAULT_CAM_POS);
      camera.lookAt(DEFAULT_LOOK_AT);

      requestAnimationFrame(() => {
        if (controlsRef.current) {
          controlsRef.current.target.copy(DEFAULT_LOOK_AT);
          controlsRef.current.update(); 
        }
      });
    }
  }, [hasSubmitted, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!hasSubmitted) return;

    const safeDelta = Math.min(delta, 0.1);
    timeSinceSubmit.current += safeDelta;

    const sType = shotType?.toUpperCase() || "";
    const isPerfect = turnResult === "perfect";
    const isError = turnResult?.includes("error");
    const isOpponent = hitterId === "opp1" || hitterId === "opp2";
    const hitToRight = selectedZone?.toUpperCase().startsWith("C") || selectedZone?.toUpperCase().startsWith("D");

    const powerShots = ["SMASH", "VIBORA", "BAJADA", "VOLLEY"];
    const isFinisher = powerShots.includes(sType) && isPerfect;

    let speed = 2.5;

    if (isFinisher) {
      targetPos.current.set(0, 4.2, 11); 
      targetLook.current.set(0, 1, -8); 
      speed = 1.2; 
    } 
    else if (isOpponent && !isPerfect && !isError) {
      targetPos.current.copy(DEFAULT_CAM_POS);
      targetLook.current.copy(DEFAULT_LOOK_AT);
    } 
    else if (sType === "LOB") {
      targetPos.current.set(0, 18.5, 28.0); 
      targetLook.current.copy(DEFAULT_LOOK_AT);
    } 
    else if (isPerfect || isError) {
      targetPos.current.set(0, 7.5, 16.5);
      targetLook.current.set(0, 0, -4);
    } 
    else {
      const panX = hitToRight ? -3 : 3; 
      targetPos.current.set(panX, 11.0, 20.5);
      targetLook.current.set(0, 0, -2);
    }

    camera.position.lerp(targetPos.current, speed * safeDelta);
    currentLook.current.lerp(targetLook.current, speed * safeDelta);
    camera.lookAt(currentLook.current);

    if (isFinisher && timeSinceSubmit.current > 0.35) {
      const shakeDuration = 0.25;
      const shakeProgress = (timeSinceSubmit.current - 0.35) / shakeDuration;
      
      if (shakeProgress >= 0 && shakeProgress <= 1) {
        const intensity = 0.3 * (1 - shakeProgress); 
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
        currentLook.current.y += (Math.random() - 0.5) * (intensity * 0.5);
      }
    }

    if (controlsRef.current) {
      controlsRef.current.target.copy(currentLook.current);
      controlsRef.current.update();
    }
  });

  return null;
}

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
  userTeamName?: string; 

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
  hidePlayerLabels?: boolean;

  courtState?: any; 
  gameOver?: boolean;
  showResultOverlay?: boolean;
  catchStatus?: string;
  activeScenario?: boolean;
  timeLeft?: number;
  timerDuration?: number;
  playIntro?: boolean;
  onIntroFinished?: () => void;
  
  activeAiProfile?: AiProfile; 
  targetScore?: number;
  matchTitle?: string;

  arenaModel?: string; 
}

export default function ScenarioCourt3D(props: Props) {
  const { t } = useTranslation();

  const [introFinished, setIntroFinished] = useState(false);
  const [playerName, setPlayerName] = useState(() => t("guest_name"));
  const [partnerName, setPartnerName] = useState(() => resolvePartnerNameFromId()); 
  const [blackout, setBlackout] = useState(false);
  const [ecoMode, setEcoMode] = useState<boolean>(() => isEcoModeEnabled());
  
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    setIntroFinished(!props.playIntro);
    if (!props.playIntro && props.onIntroFinished) {
      props.onIntroFinished();
    }
  }, [props.playIntro]);

  useEffect(() => {
    const fetchUserData = async () => {
      setPartnerName(resolvePartnerNameFromId());

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPlayerName(t("guest_name"));
          return;
        }

        let name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t("guest_name");
        let resolvedPartnerName = resolvePartnerNameFromId();
        
        const { data: profileData } = await supabase
          .from('user_stats')
          .select('display_name, partner_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData) {
          if (profileData.display_name) {
            name = profileData.display_name;
          }
          if (profileData.partner_id) {
            resolvedPartnerName = resolvePartnerNameFromId(profileData.partner_id);
          }
        }

        setPlayerName(name);
        setPartnerName(resolvedPartnerName);
      } catch (error) {
        console.error("Fehler beim Laden der Profildaten:", error);
      }
    };
    fetchUserData();
  }, [t]);

  return (
    <div className="relative w-full h-full bg-[#060913] overflow-hidden select-none">
      
      {/* 3D CANVAS-SCHICHT */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto min-h-[250px]">
        <Canvas 
          dpr={ecoMode ? 1.0 : [1, 1.5]}
          camera={{ position: [DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z], fov: 48 }} 
          gl={{ 
            antialias: true, 
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.0, 
            powerPreference: "high-performance" 
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setEcoMode(true);
            }, false);
          }}
          className="w-full h-full cursor-crosshair"
        >
          <color attach="background" args={['#010205']} />
          
          {/* Original-Beleuchtung & Environment bleiben dauerhaft aktiv für den echten Tron-Look */}
          <ambientLight intensity={0.1} color="#080d1e" />
          <directionalLight position={[0, 20, -10]} intensity={1.2} color="#ffffff" castShadow={false} />
          <Environment preset="city" environmentIntensity={0.5} />

          <Suspense fallback={<Html center className="text-white font-bold tracking-widest uppercase">{t("court_loading_arena")}</Html>}>
            
            {/* 1. INTRO KAMERA */}
            {!introFinished && !props.gameOver && (
              <IntroCamera onFinished={() => {
                setIntroFinished(true);
                if (props.onIntroFinished) props.onIntroFinished();
              }} />
            )}

            {/* 2. SPIEL KAMERA */}
            {introFinished && !props.gameOver && (
              <DynamicActionCamera 
                hasSubmitted={props.hasSubmitted} 
                shotType={props.positions.ball.type} 
                turnResult={props.turnResult}
                controlsRef={controlsRef} 
                hitterId={props.hitterId}
                selectedZone={props.selectedZone}
              />
            )}

            {/* 3. MAUS-STEUERUNG */}
            {introFinished && !props.gameOver && (
              <OrbitControls 
                ref={controlsRef} 
                enabled={!props.hasSubmitted} 
                enablePan={true} 
                enableZoom={true} 
                enableDamping={true} 
                dampingFactor={0.05}
                minDistance={8} 
                maxDistance={36} 
                screenSpacePanning={false}
                maxPolarAngle={Math.PI / 2.2} 
                minPolarAngle={0.1}
                minAzimuthAngle={-Math.PI / 2.5} 
                maxAzimuthAngle={Math.PI / 2.5}
                target={[DEFAULT_LOOK_AT.x, DEFAULT_LOOK_AT.y, DEFAULT_LOOK_AT.z]} 
              />
            )}

            {/* 4. OUTRO KAMERA */}
            {props.gameOver && (
              <OutroCamera onCrash={() => setBlackout(true)} />
            )}
            
            {/* Bloom & Vignette bleiben aktiv */}
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
              partnerName={partnerName} 
              userTeamName={props.userTeamName} 
              activeAiProfile={props.activeAiProfile} 
              targetScore={props.targetScore}
              matchTitle={props.matchTitle}
              arenaModel={props.arenaModel}
            /> 
            
            <TacticalData 
              {...props} 
              playerName={playerName} 
              partnerName={partnerName}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* HTML OVERLAY: SCHWARZER BLENDE-EFFEKT */}
      {props.gameOver && (
        <div 
          className={`absolute inset-0 z-40 bg-black pointer-events-none transition-opacity duration-[400ms] ${
            blackout ? "opacity-100" : "opacity-0"
          }`} 
        />
      )}
    </div>
  );
}
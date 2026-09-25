import React, { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three"; 

import { supabase } from "../../lib/supabase";

import Effects from "./Effects";
import CourtFloor from "./CourtFloor";
import TacticalData from "./TacticalData";
import { AiProfile } from "../../engine/AiProfiles"; // <-- NEU

// =========================================================
// 1. CINEMATIC INTRO KAMERA (Drohnen-Flug mit Pause)
// =========================================================
function IntroCamera({ onFinished }: { onFinished: () => void }) {
  const { camera } = useThree();
  const [introProgress, setIntroProgress] = useState(0);
  
  const delayTimer = useRef(0);
  
  const cameraPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, -15),  
    new THREE.Vector3(0, 4.0, -7),   
    new THREE.Vector3(0, 1.5, 0),    
    new THREE.Vector3(0, 6.0, 9),    
    new THREE.Vector3(8, 9.0, 15),   
    new THREE.Vector3(0, 12.5, 23)   
  ]), []);

  const lookAtPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 5),
    new THREE.Vector3(0, 3, 10),
    new THREE.Vector3(0, 1, 4),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.5, -2)
  ]), []);

  useFrame((state, delta) => {
    delayTimer.current += delta;

    if (delayTimer.current < 1.2) {
      state.camera.position.copy(cameraPath.getPointAt(0));
      state.camera.lookAt(lookAtPath.getPointAt(0));
      return; 
    }

    const speed = 0.15; 
    let newProgress = introProgress + delta * speed;

    if (newProgress >= 1) {
      onFinished();
      return;
    }

    setIntroProgress(newProgress);

    const camPos = cameraPath.getPointAt(newProgress);
    const lookTarget = lookAtPath.getPointAt(newProgress);

    state.camera.position.copy(camPos);
    state.camera.lookAt(lookTarget);
  });

  return null; 
}

// =========================================================
// 1b. CINEMATIC OUTRO KAMERA (Perfekter Crash-Flug)
// =========================================================
function OutroCamera({ onCrash }: { onCrash: () => void }) {
  const { camera } = useThree();
  const progressRef = useRef(0); 
  const hasCrashed = useRef(false);
  
  const cameraPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 12.5, 23),    
    new THREE.Vector3(0, 7.0, 5),      
    new THREE.Vector3(0.5, 6.23, -6),  
    new THREE.Vector3(0.5, 6.23, -11)  
  ]), []);

  const lookAtPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, -2),    
    new THREE.Vector3(0.5, 6.23, -11), 
    new THREE.Vector3(0.5, 6.23, -11.5), 
    new THREE.Vector3(0.5, 6.23, -11.7) 
  ]), []);

  useFrame((state, delta) => {
    // Geschwindigkeit auf 0.35 reduziert (ca. 2.8 Sekunden Flugzeit), um die Lücke zu füllen
    const speed = 0.35; 
    progressRef.current += delta * speed;

    // MAGIE: Wenn der Flug zu 90% durch ist, triggern wir die Blende, bevor wir ankommen!
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
// 2. DYNAMISCHE ACTION-KAMERA (V4 - Epic Finisher & Shake)
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
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3(0, -0.5, -2));
  
  const timeSinceSubmit = useRef(0);

  useEffect(() => {
    if (!hasSubmitted) {
      timeSinceSubmit.current = 0;
      targetPos.current.set(0, 12.5, 23);
      targetLook.current.set(0, -0.5, -2);
      currentLook.current.set(0, -0.5, -2);

      camera.position.set(0, 12.5, 23);
      camera.lookAt(0, -0.5, -2);

      requestAnimationFrame(() => {
        if (controlsRef.current) {
          controlsRef.current.target.set(0, -0.5, -2);
          controlsRef.current.update(); 
        }
      });
    }
  }, [hasSubmitted, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!hasSubmitted) return;

    timeSinceSubmit.current += delta;

    const sType = shotType?.toUpperCase() || "";
    const isPerfect = turnResult === "perfect";
    const isError = turnResult?.includes("error");
    const isOpponent = hitterId === "opp1" || hitterId === "opp2";
    const hitToRight = selectedZone?.toUpperCase().startsWith("C") || selectedZone?.toUpperCase().startsWith("D");

    const powerShots = ["SMASH", "VIBORA", "BAJADA", "VOLLEY"];
    const isFinisher = powerShots.includes(sType) && isPerfect;

    let speed = 2.5;

    if (isFinisher) {
      targetPos.current.set(0, 3.5, 9); 
      targetLook.current.set(0, 1, -8); 
      speed = 1.2; 
    } 
    else if (isOpponent && !isPerfect && !isError) {
      targetPos.current.set(0, 12.5, 23);
      targetLook.current.set(0, -0.5, -2);
    } 
    else if (sType === "LOB") {
      targetPos.current.set(0, 16, 23); 
      targetLook.current.set(0, -0.5, -2);
    } 
    else if (isPerfect || isError) {
      targetPos.current.set(0, 6, 14);
      targetLook.current.set(0, 0, -4);
    } 
    else {
      const panX = hitToRight ? -3 : 3; 
      targetPos.current.set(panX, 9, 17);
      targetLook.current.set(0, 0, -2);
    }

    camera.position.lerp(targetPos.current, speed * delta);
    currentLook.current.lerp(targetLook.current, speed * delta);
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
  
  activeAiProfile?: AiProfile; // <--- NEU: Gegner-Team Infos
}

export default function ScenarioCourt3D(props: Props) {
  const [introFinished, setIntroFinished] = useState(false);
  const [playerName, setPlayerName] = useState("Gast");
  
  // HIER FEHLTE DER STATE IM VORHERIGEN CODE!
  const [blackout, setBlackout] = useState(false);
  
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    setIntroFinished(!props.playIntro);
    if (!props.playIntro && props.onIntroFinished) {
      props.onIntroFinished();
    }
  }, [props.playIntro]);

  useEffect(() => {
    const fetchName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gast";
        
        const { data: profileData } = await supabase
          .from('user_stats')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData?.display_name) {
          name = profileData.display_name;
        }

        setPlayerName(name);
      } catch (error) {
        console.error("Fehler beim Laden des Spielernamens:", error);
      }
    };
    fetchName();
  }, []);

  return (
    <div className="relative w-full h-full bg-[#060913] overflow-hidden select-none">
      
      {/* 3D CANVAS-SCHICHT */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto min-h-[250px]">
        <Canvas 
          dpr={[1, 1.5]}
          camera={{ position: [0, 12.5, 23.0], fov: 45 }} 
          gl={{ 
            antialias: false, 
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.0, 
            powerPreference: "high-performance" 
          }}
          className="w-full h-full cursor-crosshair"
        >
          <color attach="background" args={['#010205']} />
          
          <ambientLight intensity={0.1} color="#080d1e" />
          <directionalLight position={[0, 20, -10]} intensity={1.2} color="#ffffff" castShadow={false} />
          <Environment preset="city" environmentIntensity={0.5} />

          <Suspense fallback={<Html center className="text-white font-bold tracking-widest uppercase">Arena lädt...</Html>}>
            
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
                maxDistance={27} 
                screenSpacePanning={false}
                maxPolarAngle={Math.PI / 2.2} 
                minPolarAngle={0.1}
                minAzimuthAngle={-Math.PI / 2.5} 
                maxAzimuthAngle={Math.PI / 2.5}
                target={[0, -0.5, -2]} 
              />
            )}

            {/* 4. OUTRO KAMERA (Mit Übergabe-Funktion an den Fade) */}
            {props.gameOver && (
              <OutroCamera onCrash={() => setBlackout(true)} />
            )}
            
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
              activeAiProfile={props.activeAiProfile} // <--- NEU
            /> 
            <TacticalData {...props} />
          </Suspense>
        </Canvas>
      </div>

      {/* =========================================================
          HTML OVERLAY: SCHWARZER BLENDE-EFFEKT
          ========================================================= */}
      {/* 
        Das Overlay startet bei 0% Deckkraft (opacity-0).
        Wenn die OutroCamera "onCrash()" aufruft, wird blackout true 
        und es blendet sanft auf opacity-100 (komplett schwarz).
      */}
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
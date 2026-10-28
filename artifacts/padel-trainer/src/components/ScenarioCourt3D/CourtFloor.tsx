import React, { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html, Text } from "@react-three/drei";

import { AiProfile } from "../../engine/AiProfiles"; 

// =========================================================
// HILFSFUNKTION: Schwache / Ältere Geräte erkennen
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

// --- Die offiziellen weißen Padel-Linien als 3D-Objekte (Geometrie & Material geteilt) ---
const OfficialCourtLines = React.memo(function OfficialCourtLines() {
  const thickness = 0.05; 
  const height = 0.025;   
  
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#ffffff",
    emissiveIntensity: 1
  }), []);

  return (
    <group position={[0, height, 0]}>
      {/* Außenlinien */}
      <mesh position={[0, 0, 9.975]} material={lineMaterial}><boxGeometry args={[10, thickness, thickness]} /></mesh>
      <mesh position={[0, 0, -9.975]} material={lineMaterial}><boxGeometry args={[10, thickness, thickness]} /></mesh>
      <mesh position={[4.975, 0, 0]} material={lineMaterial}><boxGeometry args={[thickness, thickness, 20]} /></mesh>
      <mesh position={[-4.975, 0, 0]} material={lineMaterial}><boxGeometry args={[thickness, thickness, 20]} /></mesh>
      
      {/* Aufschlaglinien */}
      <mesh position={[0, 0, 6.95]} material={lineMaterial}><boxGeometry args={[10, thickness, thickness]} /></mesh>
      <mesh position={[0, 0, -6.95]} material={lineMaterial}><boxGeometry args={[10, thickness, thickness]} /></mesh>
      
      {/* Mittellinie */}
      <mesh position={[0, 0, 0]} material={lineMaterial}><boxGeometry args={[thickness, thickness, 13.9]} /></mesh>
    </group>
  );
});

// --- DER OVALE, DREHENDE HOLOGRAMM-BANNER ---
const HologramBanner = React.memo(function HologramBanner({ lowQuality }: { lowQuality: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += Math.min(delta, 0.1) * 0.15; 
    }
  });

  const radius = 14; 
  const textCount = lowQuality ? 4 : 6; 

  return (
    <group position={[0, 9, 5]} rotation={[0, 0, 0]} scale={[1.1, 1, 1.3]}>
      <group ref={groupRef}>
        <mesh>
          <cylinderGeometry args={[radius, radius, 1.5, lowQuality ? 32 : 64, 1, true]} />
          <meshStandardMaterial 
            color="#00f0ff" 
            emissive="#00f0ff"
            emissiveIntensity={0.5}
            transparent 
            opacity={0.15} 
            side={THREE.DoubleSide} 
            depthWrite={false}
          />
        </mesh>

        {Array.from({ length: textCount }).map((_, i) => {
          const angle = (i / textCount) * Math.PI * 2;
          const x = Math.sin(angle) * radius;
          const z = Math.cos(angle) * radius;

          return (
            <group key={i} position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
              <Text
                position={[-0.05, 0, 0]} 
                anchorX="right"          
                fontSize={1.2}
                fontWeight="bold"
                letterSpacing={0.1}
                fillOpacity={0} 
                strokeWidth={0.04} 
                strokeColor="#00f0ff"    
                material-toneMapped={false} 
              >
                TAC
              </Text>
              <Text
                position={[0.05, 0, 0]} 
                anchorX="left"          
                fontSize={1.2}
                fontWeight="bold"
                letterSpacing={0.1}
                fillOpacity={0} 
                strokeWidth={0.04} 
                strokeColor="#f97316"   
                material-toneMapped={false} 
              >
                PADEL
              </Text>
            </group>
          );
        })}
      </group>
    </group>
  );
});

// --- DIE SCHWEBENDEN TRIBÜNEN-BANNER (Mit Team-Name) ---
const TribuneBanners = React.memo(function TribuneBanners({ userTeamName = "TEAM", aiTeamName = "TEAM KI" }: { userTeamName?: string, aiTeamName?: string }) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (leftRef.current) leftRef.current.position.y = 4 + Math.sin(t * 2) * 0.1;
    if (rightRef.current) rightRef.current.position.y = 4 + Math.sin(t * 2 + Math.PI) * 0.1;
  });

  return (
    <group>
      {/* LINKES BANNER (DEIN TEAM-NAME) */}
      <group ref={leftRef} position={[-14, 5.5, 2]} rotation={[0, Math.PI / 2, 0]}>
        <Text
          fontSize={1.2}
          fontWeight="bold"
          letterSpacing={0.1}
          fillOpacity={0}
          strokeWidth={0.03}
          strokeColor="#f97316"
          material-toneMapped={false}
        >
          {userTeamName.toUpperCase()}
        </Text>
      </group>

      {/* RECHTES BANNER (GEGNER TEAM) */}
      <group ref={rightRef} position={[14, 5.5, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <Text
          fontSize={1.2}
          fontWeight="bold"
          letterSpacing={0.1}
          fillOpacity={0}
          strokeWidth={0.03}
          strokeColor="#00f0ff"
          material-toneMapped={false}
        >
          {aiTeamName.toUpperCase()}
        </Text>
      </group>
    </group>
  );
});

// --- HOCHOPTIMIERTE 3D-MEEPLE-ZUSCHAUER ---
function SpectatorCrowd({ playerScore, aiScore, lowQuality }: { playerScore: number | string, aiScore: number | string, lowQuality: boolean }) {
  // Auf älteren Geräten 180 statt 450 Zuschauer -> spart 60% Instanzen
  const count = lowQuality ? 180 : 450; 
  
  const headRef = useRef<THREE.InstancedMesh>(null);
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const lArmRef = useRef<THREE.InstancedMesh>(null);
  const rArmRef = useRef<THREE.InstancedMesh>(null);
  const lLegRef = useRef<THREE.InstancedMesh>(null);
  const rLegRef = useRef<THREE.InstancedMesh>(null);

  const cheerIntensity = useRef(2.5); 
  const prevPlayerScore = useRef(playerScore);
  const prevAiScore = useRef(aiScore);
  const staticPlacedRef = useRef(false);

  useEffect(() => {
    if (playerScore !== prevPlayerScore.current || aiScore !== prevAiScore.current) {
      cheerIntensity.current = 1.5; 
      prevPlayerScore.current = playerScore;
      prevAiScore.current = aiScore;
    }
  }, [playerScore, aiScore]);

  // Statische Positionen & Blickrichtungen EINMALIG berechnen (kein lookAt() mehr in useFrame!)
  const crowdData = useMemo(() => {
    const data = [];
    const rowsCount = 4.5; 
    const startOffset = 11.6; 
    const stepDepth = 0.6;    
    const startY = -0.6;      
    const stepY = 0.3;        
    const fansPerStand = count / 3; 
    const tempObj = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const rowIndex = Math.floor(Math.random() * rowsCount);
      const exactY = startY + (rowIndex * stepY);
      const y = exactY + 0.6 + (Math.random() * 0.15); 
      
      let x, z, baseColor, isBackStand = false;

      if (i < fansPerStand) { // Linke Tribüne
        const exactX = startOffset + (rowIndex * stepDepth);
        x = -(exactX + (Math.random() - 0.5) * 0.2);
        z = -6.5 + Math.random() * 16;
        baseColor = "#f97316"; 
      } else if (i < fansPerStand * 2) { // Rechte Tribüne
        const exactX = startOffset + (rowIndex * stepDepth);
        x = exactX + (Math.random() - 0.5) * 0.2;
        z = -6.5 + Math.random() * 16;
        baseColor = "#00f0ff"; 
      } else { // Hintere Tribüne
        const startOffsetBack = 18.3; 
        const exactZ = startOffsetBack + (rowIndex * stepDepth);
        z = exactZ + (Math.random() - 0.5) * 0.2; 
        x = -8.5 + Math.random() * 16; 
        baseColor = Math.random() > 0.5 ? "#f97316" : "#00f0ff";
        isBackStand = true;
      }

      const scale = 0.8 + Math.random() * 0.2;
      const randomYaw = (Math.random() - 0.5) * 0.4;

      // Blickrichtung einmalig vorab bestimmen
      tempObj.position.set(x, y, z);
      if (isBackStand) {
        tempObj.lookAt(x, y, 0);
      } else {
        tempObj.lookAt(0, y, z);
      }
      const finalRotY = tempObj.rotation.y + randomYaw;

      data.push({ x, y, z, scale, finalRotY, baseColor });
    }
    return data;
  }, [count]);

  // Direkte Referenzen statt 2.700 getObjectByName()-Aufrufe pro Frame
  const dummyParts = useMemo(() => {
    const group = new THREE.Group();
    const head = new THREE.Object3D(); head.position.set(0, 0.55, 0);
    const torso = new THREE.Object3D(); torso.position.set(0, 0.1, 0);
    const lArm = new THREE.Object3D(); lArm.position.set(-0.22, 0.05, 0);
    const rArm = new THREE.Object3D(); rArm.position.set(0.22, 0.05, 0);
    const lLeg = new THREE.Object3D(); lLeg.position.set(-0.08, -0.35, 0);
    const rLeg = new THREE.Object3D(); rLeg.position.set(0.08, -0.35, 0);
    group.add(head, torso, lArm, rArm, lLeg, rLeg);
    return { group, head, torso, lArm, rArm, lLeg, rLeg };
  }, []);

  useEffect(() => {
    const refs = [headRef, torsoRef, lArmRef, rArmRef, lLegRef, rLegRef];
    if (refs.some(ref => !ref.current)) return;

    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.set(crowdData[i].baseColor).multiplyScalar(0.4 + Math.random() * 0.6);
      refs.forEach(ref => ref.current!.setColorAt(i, color));
    }
    refs.forEach(ref => { if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true; });
    staticPlacedRef.current = false;
  }, [crowdData, count]);

  useFrame((state, delta) => {
    if (!headRef.current || !torsoRef.current || !lArmRef.current || !rArmRef.current || !lLegRef.current || !rLegRef.current) return;

    // Im Low-Quality-Modus: Wenn der Jubel vorbei ist und die Figuren stehen, 0% CPU verbrauchen!
    if (lowQuality && cheerIntensity.current === 0 && staticPlacedRef.current) {
      return;
    }

    const safeDelta = Math.min(delta, 0.1);
    if (cheerIntensity.current > 0.01) {
      cheerIntensity.current -= safeDelta * 0.3; 
    } else {
      cheerIntensity.current = 0;
      staticPlacedRef.current = true;
    }

    const t = state.clock.elapsedTime;
    const isCheering = cheerIntensity.current > 0;
    const cheerFactor = Math.min(1, cheerIntensity.current);
    const { group, head, torso, lArm, rArm, lLeg, rLeg } = dummyParts;

    for (let i = 0; i < count; i++) {
      const data = crowdData[i];
      const idle = lowQuality ? 0 : Math.sin(t * 2 + i) * 0.02; 
      const jump = isCheering ? Math.max(0, Math.sin(t * 15 + i)) * 0.25 * cheerFactor : 0;

      group.position.set(data.x, data.y + idle + jump, data.z);
      group.rotation.set(0, data.finalRotY, 0);
      group.scale.setScalar(data.scale);

      const armRaise = isCheering 
        ? (Math.sin(t * 12 + i) * 0.5 + 0.5) * Math.PI * 0.8 * cheerFactor
        : 0;

      lArm.rotation.x = -armRaise;
      rArm.rotation.x = -armRaise;
      lArm.rotation.z = armRaise * 0.15;
      rArm.rotation.z = -armRaise * 0.15;

      group.updateMatrixWorld(true);

      headRef.current.setMatrixAt(i, head.matrixWorld);
      torsoRef.current.setMatrixAt(i, torso.matrixWorld);
      lArmRef.current.setMatrixAt(i, lArm.matrixWorld);
      rArmRef.current.setMatrixAt(i, rArm.matrixWorld);
      lLegRef.current.setMatrixAt(i, lLeg.matrixWorld);
      rLegRef.current.setMatrixAt(i, rLeg.matrixWorld);
    }

    headRef.current.instanceMatrix.needsUpdate = true;
    torsoRef.current.instanceMatrix.needsUpdate = true;
    lArmRef.current.instanceMatrix.needsUpdate = true;
    rArmRef.current.instanceMatrix.needsUpdate = true;
    lLegRef.current.instanceMatrix.needsUpdate = true;
    rLegRef.current.instanceMatrix.needsUpdate = true;
  });

  const sphereSegs = lowQuality ? 8 : 12;
  const capSegs = lowQuality ? 4 : 8;

  return (
    <group>
      <instancedMesh ref={headRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.15, sphereSegs, sphereSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={torsoRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.12, 0.3, 2, capSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lArmRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 2, capSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rArmRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 2, capSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lLegRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 2, capSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rLegRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 2, capSegs]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export interface ScoreboardProps {
  serverId?: string;
  playerScore?: number | string;
  aiScore?: number | string;
  isAiActive?: boolean;
  phase?: string;
  isTimerPhase?: boolean;
  isPlayerTeamServe?: boolean;
  playerName?: string; 
  partnerName?: string; 
  userTeamName?: string; 
  isSimulationMode?: boolean; 
  activeAiProfile?: AiProfile; 
  targetScore?: number; 
  matchTitle?: string;
  arenaModel?: string; 
}

export default function CourtFloor(props: ScoreboardProps) {
  const {
    serverId = "you",
    playerScore = 0,
    aiScore = 0,
    isAiActive = false,
    phase = "player_turn",
    isTimerPhase = false,
    isPlayerTeamServe = true,
    playerName = "Gast",
    partnerName = "Partner",
    userTeamName = "Dein Team",
    isSimulationMode = false,
    activeAiProfile,
    targetScore = 10,
    matchTitle = "Match-Tiebreak",
    arenaModel = "/TacPadel.glb"
  } = props;

  const [lowQuality] = useState<boolean>(() => detectLowEndDevice());

  // Dynamisches Laden des Models
  const { scene } = useGLTF(arenaModel);

  useEffect(() => {
    // WICHTIG: Den Abdunklungs-Shader nur anwenden, wenn es die Standard-Arena ist!
    if (arenaModel === "/TacPadel.glb") {
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const name = child.name.toLowerCase();
          const isCourt = name.includes("zone") || name.includes("court") || name.includes("floor") || name.includes("grass") || name.includes("feld");

          if (!isCourt) {
            child.material.color = new THREE.Color("#020308"); 
            child.material.roughness = 0.15; 
            child.material.metalness = 0.85; 
            child.material.envMapIntensity = 2.0; 
          } else {
            child.material.roughness = 0.3; 
            child.material.metalness = 0.1; 
            child.material.envMapIntensity = 1.0; 
          }
        }
      });
    }

    // VRAM-Schutz: Wenn eine Turnier-Arena verlassen wird, aus dem Cache räumen
    return () => {
      if (arenaModel !== "/TacPadel.glb") {
        useGLTF.clear(arenaModel);
      }
    };
  }, [scene, arenaModel]);

  const aiTeamName = activeAiProfile?.teamName || "TACPADEL AI";
  const opp1Name = activeAiProfile?.p1 || "KI 1";
  const opp2Name = activeAiProfile?.p2 || "KI 2";

  return (
    <group name="Environment">
      <primitive object={scene} rotation={[0, Math.PI / 2, 0]} />
      <OfficialCourtLines />
      <HologramBanner lowQuality={lowQuality} />
      <TribuneBanners userTeamName={userTeamName} aiTeamName={aiTeamName} />
      <SpectatorCrowd playerScore={playerScore} aiScore={aiScore} lowQuality={lowQuality} />

      {/* DIE GROSSE LED-SCOREBOARD-WAND IM HINTERGRUND */}
      <group position={[0.25, 6.38, -11.7]} rotation={[0, 0, 0]}>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[3.1, 1.6, 0.1]} />
          <meshStandardMaterial color="#020308" roughness={0.8} />
        </mesh>

        <Html
          transform 
          scale={0.78}
          className="pointer-events-none select-none"
        >
          {isSimulationMode ? (
            <div className="w-[400px] h-[200px] flex flex-col items-center justify-center bg-[#040914] border border-cyan-900/50 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:100%_4px] opacity-30 mix-blend-overlay" />
              <div className="z-10 flex flex-col items-center">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-[0_0_15px_rgba(0,240,255,0.5)] tracking-[0.2em] mb-1">
                  TACPADEL
                </h1>
                <p className="text-sm font-bold text-orange-400 tracking-[0.4em] uppercase opacity-90">
                  Simulation
                </p>
              </div>
            </div>
          ) : (
            <div className="w-[400px] h-[200px] flex flex-col justify-center bg-[#040914] border border-cyan-900/50 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent" />
              
              <div className="flex flex-row justify-between items-center w-full px-4">
                
                {/* LINKE SEITE (DEIN TEAM) */}
                <div className="text-left flex flex-col items-start w-1/3">
                  <p className="text-[11px] text-orange-400 font-bold tracking-widest uppercase mb-2">
                    {isPlayerTeamServe && "🎾"} {userTeamName} <br/> 
                    {serverId === "you" && <span className="text-purple-300">(Du)</span>} 
                    {serverId === "partner" && <span className="text-purple-300">({partnerName})</span>}
                  </p>
                  <p className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,119,0,0.6)]">{playerScore}</p>
                </div>
                
                {/* MITTE (STATUS & TURNIERINFO) */}
                <div className="text-center flex flex-col items-center flex-1 px-6 border-x border-slate-700/50">
                  <p className={`text-sm uppercase tracking-widest font-black mb-3 ${isAiActive ? "text-red-400" : "text-emerald-400"}`}>
                    {phase === "ai_prepare" ? "🔴 Gegner bereitet vor..." : (isTimerPhase ? "🔴 Ball fliegt!" : "🟢 Dein Zug")}
                  </p>
                  <p className="text-lg font-semibold text-slate-300 leading-snug">
                    {matchTitle}<br/>
                    <span className="text-sm font-normal text-slate-500">(bis {targetScore} Punkte)</span>
                  </p>
                </div>
                
                {/* RECHTE SEITE (GEGNER TEAM) */}
                <div className="text-right flex flex-col items-end w-1/3">
                  <p className="text-[11px] text-slate-400 font-bold tracking-widest uppercase mb-2">
                    {!isPlayerTeamServe && "🎾"} {aiTeamName} <br/> 
                    {serverId === "opp1" && <span className="text-cyan-300">({opp1Name})</span>} 
                    {serverId === "opp2" && <span className="text-cyan-300">({opp2Name})</span>}
                  </p>
                  <p className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{aiScore}</p>
                </div>
                
              </div>
            </div>
          )}
        </Html>
      </group>
    </group>
  );
}

// Preload der Standard-Arena, um Ladezeiten bei Start zu verkürzen
useGLTF.preload("/TacPadel.glb");
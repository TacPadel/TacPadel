import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html, Text } from "@react-three/drei";

// --- Die offiziellen weißen Padel-Linien als 3D-Objekte ---
function OfficialCourtLines() {
  const thickness = 0.05; 
  const height = 0.025;   
  
  const LineMaterial = <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />;

  return (
    <group position={[0, height, 0]}>
      {/* Außenlinien */}
      <mesh position={[0, 0, 9.975]}><boxGeometry args={[10, thickness, thickness]} />{LineMaterial}</mesh>
      <mesh position={[0, 0, -9.975]}><boxGeometry args={[10, thickness, thickness]} />{LineMaterial}</mesh>
      <mesh position={[4.975, 0, 0]}><boxGeometry args={[thickness, thickness, 20]} />{LineMaterial}</mesh>
      <mesh position={[-4.975, 0, 0]}><boxGeometry args={[thickness, thickness, 20]} />{LineMaterial}</mesh>
      
      {/* Aufschlaglinien */}
      <mesh position={[0, 0, 6.95]}><boxGeometry args={[10, thickness, thickness]} />{LineMaterial}</mesh>
      <mesh position={[0, 0, -6.95]}><boxGeometry args={[10, thickness, thickness]} />{LineMaterial}</mesh>
      
      {/* Mittellinie */}
      <mesh position={[0, 0, 0]}><boxGeometry args={[thickness, thickness, 13.9]} />{LineMaterial}</mesh>
    </group>
  );
}

/// --- DER OVALE, DREHENDE HOLOGRAMM-BANNER ---
function HologramBanner() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15; 
    }
  });

  const radius = 14; 
  const textCount = 6; 

  return (
    <group position={[0, 9, 5]} rotation={[0, 0, 0]} scale={[1.1, 1, 1.3]}>
      <group ref={groupRef}>
        <mesh>
          <cylinderGeometry args={[radius, radius, 1.5, 64, 1, true]} />
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
}

// --- DIE SCHWEBENDEN TRIBÜNEN-BANNER ---
function TribuneBanners({ playerName = "SPIELER" }: { playerName?: string }) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (leftRef.current) leftRef.current.position.y = 4 + Math.sin(t * 2) * 0.1;
    if (rightRef.current) rightRef.current.position.y = 4 + Math.sin(t * 2 + Math.PI) * 0.1;
  });

  return (
    <group>
      {/* LINKES BANNER (TEAM DU) */}
      <group ref={leftRef} position={[-14, 5.5, 2]} rotation={[0, Math.PI / 2, 0]}>
        <Text
          fontSize={1.2}
          fontWeight="bold"
          letterSpacing={0.1}
          fillOpacity={0}
          strokeWidth={0.03}
          strokeColor="#f97316" // Orange
          material-toneMapped={false}
        >
          TEAM {playerName.toUpperCase()}
        </Text>
      </group>

      {/* RECHTES BANNER (TEAM KI) */}
      <group ref={rightRef} position={[14, 5.5, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <Text
          fontSize={1.2}
          fontWeight="bold"
          letterSpacing={0.1}
          fillOpacity={0}
          strokeWidth={0.03}
          strokeColor="#00f0ff" // Cyan
          material-toneMapped={false}
        >
          TEAM TACPADEL-AI
        </Text>
      </group>
    </group>
  );
}

// --- NEU: ANIMIERTE 3D-MEEPLE-ZUSCHAUER (Jubeln beim Start & bei Punkten!) ---
function SpectatorCrowd({ playerScore, aiScore }: { playerScore: number | string, aiScore: number | string }) {
  const count = 450; 
  
  const headRef = useRef<THREE.InstancedMesh>(null);
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const lArmRef = useRef<THREE.InstancedMesh>(null);
  const rArmRef = useRef<THREE.InstancedMesh>(null);
  const lLegRef = useRef<THREE.InstancedMesh>(null);
  const rLegRef = useRef<THREE.InstancedMesh>(null);

  // Der Jubel-Pegel: Startet extrem hoch (2.5) für den Kameraflug!
  const cheerIntensity = useRef(2.5); 
  const prevPlayerScore = useRef(playerScore);
  const prevAiScore = useRef(aiScore);

  // Löst Jubel aus, sobald sich ein Punktestand ändert
  useEffect(() => {
    if (playerScore !== prevPlayerScore.current || aiScore !== prevAiScore.current) {
      cheerIntensity.current = 1.5; // Pegel wieder hochsetzen
      prevPlayerScore.current = playerScore;
      prevAiScore.current = aiScore;
    }
  }, [playerScore, aiScore]);

  // 1. GRUNDDATEN BERECHNEN (Einmalig, um Leistung zu sparen)
  const crowdData = useMemo(() => {
    const data = [];
    const rowsCount = 4.5; 
    const startOffset = 11.6; 
    const stepDepth = 0.6;    
    const startY = -0.6;       
    const stepY = 0.3;        
    const fansPerStand = count / 3; 

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
      const rotY = (Math.random() - 0.5) * 0.4;
      data.push({ x, y, z, scale, rotY, baseColor, isBackStand });
    }
    return data;
  }, []);

  // 2. FARBEN EINMALIG ZUWEISEN
  useEffect(() => {
    const refs = [headRef, torsoRef, lArmRef, rArmRef, lLegRef, rLegRef];
    if (refs.some(ref => !ref.current)) return;

    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.set(crowdData[i].baseColor).multiplyScalar(0.4 + Math.random() * 0.6);
      refs.forEach(ref => ref.current!.setColorAt(i, color));
    }
    refs.forEach(ref => { if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true; });
  }, [crowdData]);

  // 3. DAS DUMMY-SKELETT FÜR DIE ANIMATION
  const dummyGroup = useMemo(() => {
    const g = new THREE.Group();
    const head = new THREE.Object3D(); head.name = "head"; head.position.set(0, 0.55, 0);
    const torso = new THREE.Object3D(); torso.name = "torso"; torso.position.set(0, 0.1, 0);
    const lArm = new THREE.Object3D(); lArm.name = "lArm"; lArm.position.set(-0.22, 0.05, 0);
    const rArm = new THREE.Object3D(); rArm.name = "rArm"; rArm.position.set(0.22, 0.05, 0);
    const lLeg = new THREE.Object3D(); lLeg.name = "lLeg"; lLeg.position.set(-0.08, -0.35, 0);
    const rLeg = new THREE.Object3D(); rLeg.name = "rLeg"; rLeg.position.set(0.08, -0.35, 0);
    g.add(head, torso, lArm, rArm, lLeg, rLeg);
    return g;
  }, []);

  // 4. DER ANIMATIONS-LOOP (60 FPS)
  useFrame((state, delta) => {
    const refs = [headRef, torsoRef, lArmRef, rArmRef, lLegRef, rLegRef];
    if (refs.some(ref => !ref.current)) return;

    // Jubel langsam ausschleichen lassen (multiplizieren wirkt weicher als subtrahieren)
    if (cheerIntensity.current > 0.01) {
      cheerIntensity.current -= delta * 0.3; // Bestimmt, wie schnell sie sich beruhigen
    } else {
      cheerIntensity.current = 0;
    }

    const t = state.clock.elapsedTime;
    const head = dummyGroup.getObjectByName("head")!;
    const lArm = dummyGroup.getObjectByName("lArm")!;
    const rArm = dummyGroup.getObjectByName("rArm")!;

    for (let i = 0; i < count; i++) {
      const data = crowdData[i];

      // Leichtes Grund-Wippen (Atmen), damit sie niemals komplett einfrieren
      const idle = Math.sin(t * 2 + i) * 0.02; 
      
      // Jubel-Sprung (Nur aktiv, wenn Intensity > 0 ist)
      // Wir addieren "+ i", damit sie asynchron durcheinander springen!
      const jump = cheerIntensity.current > 0 
        ? Math.max(0, Math.sin(t * 15 + i)) * 0.25 * Math.min(1, cheerIntensity.current) 
        : 0;

      dummyGroup.position.set(data.x, data.y + idle + jump, data.z);
      
      // Blickrichtung wiederherstellen
      if (data.isBackStand) {
        dummyGroup.lookAt(data.x, dummyGroup.position.y, 0);
      } else {
        dummyGroup.lookAt(0, dummyGroup.position.y, data.z);
      }
      
      dummyGroup.rotation.y += data.rotY;
      dummyGroup.scale.set(data.scale, data.scale, data.scale);

      // Arme hochreißen!
      const armRaise = cheerIntensity.current > 0 
        ? (Math.sin(t * 12 + i) * 0.5 + 0.5) * Math.PI * 0.8 * Math.min(1, cheerIntensity.current)
        : 0;

      // Arme drehen sich nach oben vorne (-X Achse)
      lArm.rotation.x = -armRaise;
      rArm.rotation.x = -armRaise;
      // Leichtes Winken nach außen
      lArm.rotation.z = armRaise * 0.15;
      rArm.rotation.z = -armRaise * 0.15;

      // Matrix berechnen und zuweisen
      dummyGroup.updateMatrixWorld(true);
      refs.forEach(ref => {
        const part = dummyGroup.getObjectByName(ref.current!.name);
        if (part) ref.current!.setMatrixAt(i, part.matrixWorld);
      });
    }

    // Engine mitteilen, dass sich die Positionen im Frame geändert haben
    refs.forEach(ref => { ref.current!.instanceMatrix.needsUpdate = true; });
  });

  return (
    <group>
      <instancedMesh ref={headRef} name="head" args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      
      <instancedMesh ref={torsoRef} name="torso" args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.12, 0.3, 4, 8]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={lArmRef} name="lArm" args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={rArmRef} name="rArm" args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={lLegRef} name="lLeg" args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={rLegRef} name="rLeg" args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
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
  isSimulationMode?: boolean; // <-- NEU: Prop für den "TacPadel Simulation" Screen
}

export default function CourtFloor(props: ScoreboardProps) {
  const { scene } = useGLTF("/TacPadel.glb");

  // --- NEU: AAA MATERIAL-UPGRADE (Mit originalem blauen Court!) ---
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        
        const name = child.name.toLowerCase();
        // Wir suchen wieder nach den Namen des Spielfelds in deiner Blender-Datei
        const isCourt = name.includes("zone") || name.includes("court") || name.includes("floor") || name.includes("grass") || name.includes("feld");

        if (!isCourt) {
          // 1. Das restliche Stadion: Tiefschwarz und spiegelnd (AAA-Gloss)
          child.material.color = new THREE.Color("#020308"); 
          child.material.roughness = 0.15; 
          child.material.metalness = 0.85; 
          child.material.envMapIntensity = 2.0; 
        } else {
          // 2. Das Padel-Feld: 
          // Wir lassen die Farb-Überschreibung hier komplett weg! 
          // Dadurch nutzt Three.js automatisch dein originales Blau aus der .glb Datei.
          // Wir geben dem Blau nur ein leichtes, edles Glänzen:
          child.material.roughness = 0.3; // Leichter Glanz wie ein Hallenboden
          child.material.metalness = 0.1; // Kaum Metall, damit das Blau richtig leuchtet
          child.material.envMapIntensity = 1.0; 
        }
        
        child.material.needsUpdate = true;
      }
    });
  }, [scene]);

  const {
    serverId = "you",
    playerScore = 0,
    aiScore = 0,
    isAiActive = false,
    phase = "player_turn",
    isTimerPhase = false,
    isPlayerTeamServe = true,
    playerName = "Gast",
    isSimulationMode = false // <-- NEU: Standardmäßig ist das normale Scoreboard aktiv
  } = props;
  
  return (
    <group name="Environment">
      {/* 1. Dein Blender Stadion */}
      <primitive object={scene} rotation={[0, Math.PI / 2, 0]} />
      
      {/* 2. Die weißen Feld-Linien */}
      <OfficialCourtLines />

      {/* 3. Der drehende Hologramm-Ring */}
      <HologramBanner />

      {/* 4. Die seitlichen Hologramm-Banner über den Tribünen */}
      <TribuneBanners playerName={playerName} />

      {/* 5. Die 3D-Meeple-Zuschauer (Animiert) */}
      <SpectatorCrowd playerScore={playerScore} aiScore={aiScore} />

      {/* 6. DIE GROSSE LED-SCOREBOARD-WAND IM HINTERGRUND */}
      <group position={[0.25, 6.38, -11.7]} rotation={[0, 0, 0]}>
        
        {/* Das physische 3D-Gehäuse */}
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
            // --- DAS NEUE SIMULATIONS-BRANDING FÜR ScenarioCourt4D ---
            <div className="w-[400px] h-[200px] flex flex-col items-center justify-center bg-[#040914] border border-cyan-900/50 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
              {/* Oben: Sanfter Cyan-Glow */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent" />
              {/* Animierter Scanline-Effekt */}
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
            // --- DAS NORMALE MATCH-SCOREBOARD FÜR ScenarioCourt3D ---
            <div className="w-[400px] h-[200px] flex flex-col justify-center bg-[#040914] border border-cyan-900/50 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent" />
              
              <div className="flex flex-row justify-between items-center w-full px-4">
                
                <div className="text-left flex flex-col items-start w-1/3">
                  <p className="text-sm text-orange-400 font-bold tracking-widest uppercase mb-2">Team {serverId === "you" && "(Du)"} {serverId === "partner" && "🎾(Partner)"}</p>
                  <p className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,119,0,0.6)]">{playerScore}</p>
                </div>
                
                <div className="text-center flex flex-col items-center flex-1 px-6 border-x border-slate-700/50">
                  <p className={`text-sm uppercase tracking-widest font-black mb-3 ${isAiActive ? "text-red-400" : "text-emerald-400"}`}>
                    {phase === "ai_prepare" ? "🔴 Gegner bereitet vor..." : (isTimerPhase ? "🔴 Ball fliegt!" : "🟢 Dein Zug")}
                  </p>
                  <p className="text-lg font-semibold text-slate-300 leading-snug">Match-Tiebreak<br/><span className="text-sm font-normal text-slate-500">(bis 10 Punkte)</span></p>
                </div>
                
                <div className="text-right flex flex-col items-end w-1/3">
                  <p className="text-sm text-slate-400 font-bold tracking-widest uppercase mb-2">{!isPlayerTeamServe && "🎾"} KI {serverId === "opp1" && "(KI 1)"} {serverId === "opp2" && "(KI 2)"}</p>
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

useGLTF.preload("/TacPadel.glb");
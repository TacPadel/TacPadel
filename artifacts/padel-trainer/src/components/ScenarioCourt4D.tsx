import React, { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Text } from "@react-three/drei";
import * as THREE from "three";

import { supabase } from "../lib/supabase";
import Effects from "../components/ScenarioCourt3D/Effects";
import CourtFloor from "../components/ScenarioCourt3D/CourtFloor";
import TacticalData from "../components/ScenarioCourt3D/TacticalData";

// =========================================================
// 1. DYNAMISCHE ACTION-KAMERA (Fliegt zur gegnerischen Seite)
// =========================================================
const LETTERS = ["A", "B", "C", "D", "E"];

function getZoneCenter3D(side: "left" | "right", zoneId: string): THREE.Vector3 {
  if (!zoneId || zoneId.length < 2) return new THREE.Vector3(0, 0, side === "left" ? 5 : -5);

  if (zoneId.startsWith("EXACT_")) {
    const parts = zoneId.split("_");
    const exactX = parseFloat(parts[1]);
    const exactZ = parseFloat(parts[2]);
    return new THREE.Vector3(exactX, 0.02, exactZ);
  }

  const letterIdx = LETTERS.indexOf(zoneId[0].toUpperCase());
  const num = parseInt(zoneId[1]);
  const x = -5 + (letterIdx * 2) + 1;
  let z = 0;
  if (side === "left") { z = 10 - (num * 2) + 1; }
  else { z = -10 + (num * 2) - 1; }
  return new THREE.Vector3(x, 0.02, z);
}

function getFrontPos3D(side: "left" | "right", zoneId: string): THREE.Vector3 {
  const pos = getZoneCenter3D(side, zoneId);
  if (side === "left") { pos.z -= 0.7; }
  else { pos.z += 0.7; }
  return pos;
}

function getShotParameters(schlagTyp: string) {
  const sType = (schlagTyp || "").toUpperCase();
  if (sType.includes("LOB")) return { bogenHoehe: 9.0, powerMultiplier: 0.10 };
  if (sType.includes("CHIQUITA")) return { bogenHoehe: 3.0, powerMultiplier: 0.15 };
  if (sType.includes("SMASH")) return { bogenHoehe: 0.4, powerMultiplier: 1.0 };
  if (sType.includes("BAJADA")) return { bogenHoehe: 0.4, powerMultiplier: 0.4 };
  if (sType.includes("VIBORA")) return { bogenHoehe: 0.5, powerMultiplier: 0.35 };
  if (sType.includes("BANDEJA")) return { bogenHoehe: 0.7, powerMultiplier: 0.25 };
  if (sType.includes("VOLLEY")) return { bogenHoehe: 0.5, powerMultiplier: 0.25 };
  if (sType.includes("BLOCK")) return { bogenHoehe: 0.5, powerMultiplier: 0.1 };
  if (sType.includes("DRIVE")) return { bogenHoehe: 1.2, powerMultiplier: 0.25 };
  if (sType.includes("AUFSCHLAG")) return { bogenHoehe: 1.5, powerMultiplier: 0.3 };
  return { bogenHoehe: 1.2, powerMultiplier: 0.25 };
}

function DynamicActionCamera(props: Props & { controlsRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 12.5, 23));
  const targetLook = useRef(new THREE.Vector3(0, -0.5, -2));
  const currentLook = useRef(new THREE.Vector3(0, -0.5, -2));
 
  const flightTimer = useRef(0);
  const cameraBallProgress = useRef(0);

  // === EXAKTE KOPIE DER ERWEITERTEN FLUGKURVEN (SYNC MIT TACTICALDATA) ===
  const { curves } = useMemo(() => {
    if (!props.selectedZone && !props.exactCoords?.target) return { curves: [] };

    const startSide = props.positions.ball.side || "left";
    const targetSide = startSide === "left" ? "right" : "left";
    
    // OVERRIDE 1: Start-Position
    let startPos = getFrontPos3D(startSide, props.positions.ball.zone);
    if (props.exactCoords?.you) {
      startPos = new THREE.Vector3(props.exactCoords.you.x, 0.02, props.exactCoords.you.z);
      if (startSide === "left") { startPos.z -= 0.5; } else { startPos.z += 0.5; }
    }

    // OVERRIDE 2: Ziel-Position
    let ballTargetPos: THREE.Vector3 = getZoneCenter3D(targetSide, props.selectedZone || "C3");
    if (props.exactCoords?.target) {
      ballTargetPos = new THREE.Vector3(props.exactCoords.target.x, 0.02, props.exactCoords.target.z);
    }
    
    let isCaughtInAir = false;

    if (props.hasSubmitted && startSide === "right") {
      const youZone = props.selectedLaufZone || props.positions.you;
      const partnerZone = props.selectedPartnerZone || props.positions.partner;
      if (youZone === props.selectedZone) {
        isCaughtInAir = true;
        ballTargetPos = getFrontPos3D("left", youZone);
      } else if (partnerZone === props.selectedZone) {
        isCaughtInAir = true;
        ballTargetPos = getFrontPos3D("left", partnerZone);
      }
    }

    const { bogenHoehe, powerMultiplier } = getShotParameters(props.positions.ball.type || "");
    const sType = (props.positions.ball.type || "").toUpperCase();
    const resultCurves: THREE.QuadraticBezierCurve3[] = [];

    const isNetCrash = props.turnResult === "error_net";
    const isWallDirectCrash = props.turnResult === "error_wall_direct";

    if (isNetCrash) {
      const zDist = startPos.z - ballTargetPos.z;
      const fraction = zDist !== 0 ? Math.abs(startPos.z) / Math.abs(zDist) : 0.5;
      const netX = startPos.x + (ballTargetPos.x - startPos.x) * fraction;
      const pStart = new THREE.Vector3(startPos.x, 1.5, startPos.z);
      const pNet = new THREE.Vector3(netX, 0.6, 0);
      const pFloor = new THREE.Vector3(netX, 0.1, startPos.z > 0 ? 0.8 : -0.8);
      const mid1 = new THREE.Vector3((pStart.x + pNet.x) / 2, 1.0, (pStart.z + pNet.z) / 2);
      resultCurves.push(new THREE.QuadraticBezierCurve3(pStart, mid1, pNet));
      const mid2 = new THREE.Vector3((pNet.x + pFloor.x) / 2, 0.3, (pNet.z + pFloor.z) / 2);
      resultCurves.push(new THREE.QuadraticBezierCurve3(pNet, mid2, pFloor));
    }
    else if (isWallDirectCrash) {
      const targetZ = startPos.z > 0 ? -10 : 10;
      const zDist = targetZ - startPos.z;
      const targetZDist = ballTargetPos.z - startPos.z;
      const fraction = targetZDist !== 0 ? Math.abs(zDist / targetZDist) : 1;
      let wallX = startPos.x + (ballTargetPos.x - startPos.x) * fraction;
      wallX = Math.max(-5, Math.min(5, wallX));
      const hitHeight = sType.includes("LOB") ? 3.5 : 1.2;
      const pStart = new THREE.Vector3(startPos.x, 1.5, startPos.z);
      const pWall = new THREE.Vector3(wallX, hitHeight, targetZ);
      const pFloor = new THREE.Vector3(wallX, 0.1, targetZ > 0 ? 8.5 : -8.5);
      const mid1 = new THREE.Vector3((pStart.x + pWall.x) / 2, Math.max(hitHeight, bogenHoehe), (pStart.z + pWall.z) / 2);
      resultCurves.push(new THREE.QuadraticBezierCurve3(pStart, mid1, pWall));
      const mid2 = new THREE.Vector3((pWall.x + pFloor.x) / 2, hitHeight / 2, (pWall.z + pFloor.z) / 2);
      resultCurves.push(new THREE.QuadraticBezierCurve3(pWall, mid2, pFloor));
    }
    else {
      const pStart = new THREE.Vector3(startPos.x, 1.5, startPos.z);
      const finalTargetY = isCaughtInAir ? 1.2 : 0.1;
      const p1stBounce = new THREE.Vector3(ballTargetPos.x, finalTargetY, ballTargetPos.z);
      const midY = Math.max(pStart.y, p1stBounce.y) + bogenHoehe;
      const mid1 = new THREE.Vector3((pStart.x + p1stBounce.x) / 2, midY, (pStart.z + p1stBounce.z) / 2);
      resultCurves.push(new THREE.QuadraticBezierCurve3(pStart, mid1, p1stBounce));

      if (!isCaughtInAir) {
        let dx = p1stBounce.x - pStart.x;
        let dz = p1stBounce.z - pStart.z;
        const distStartBounce = Math.sqrt(dx * dx + dz * dz);
        if (distStartBounce > 0) { dx /= distStartBounce; dz /= distStartBounce; }

        let remainingDist = distStartBounce * powerMultiplier;
        if (remainingDist < 1.5) remainingDist = 1.5; 
        if (sType.includes("SMASH")) remainingDist += 2.0; 

        let curX = p1stBounce.x;
        let curZ = p1stBounce.z;
        let curY = 0.1;
        let lastPoint = p1stBounce.clone();
        let safeGuard = 0;

        while (remainingDist > 0.05 && safeGuard < 3) {
          safeGuard++;
          let tX = Infinity, tZ = Infinity;
          if (dx > 0.001) tX = (4.95 - curX) / dx;
          else if (dx < -0.001) tX = (-4.95 - curX) / dx;
          if (dz > 0.001) tZ = (9.95 - curZ) / dz;
          else if (dz < -0.001) tZ = (-9.95 - curZ) / dz;
          let tMin = Math.min(tX, tZ);

          if (tMin < remainingDist && tMin > 0.01) {
            curX += tMin * dx; curZ += tMin * dz;
            curY = Math.min(3.5, curY + tMin * (sType.includes("SMASH") ? 0.7 : 0.3)); 
            let pWall = new THREE.Vector3(curX, curY, curZ);
            let dist = lastPoint.distanceTo(pWall);
            let mid = new THREE.Vector3((lastPoint.x + pWall.x) / 2, Math.max(lastPoint.y, pWall.y) + Math.min(0.2, dist * 0.1), (lastPoint.z + pWall.z) / 2);
            resultCurves.push(new THREE.QuadraticBezierCurve3(lastPoint, mid, pWall));
            lastPoint = pWall;
            remainingDist -= tMin;

            if (tMin === tX) { dx = -dx; curX = curX > 0 ? 4.9 : -4.9; }
            if (tMin === tZ) { dz = -dz; curZ = curZ > 0 ? 9.9 : -9.9; }
            remainingDist *= 0.8;
          } else {
            curX += remainingDist * dx; curZ += remainingDist * dz; curY = 0.1;
            let pFloor = new THREE.Vector3(curX, curY, curZ);
            let dist = lastPoint.distanceTo(pFloor);
            let arcMidY = (lastPoint.y + pFloor.y) / 2;
            arcMidY += (lastPoint.y < 0.2) ? Math.min(0.6, dist * 0.3) : Math.min(0.3, dist * 0.15);
            let mid = new THREE.Vector3((lastPoint.x + pFloor.x) / 2, arcMidY, (lastPoint.z + pFloor.z) / 2);
            resultCurves.push(new THREE.QuadraticBezierCurve3(lastPoint, mid, pFloor));
            lastPoint = pFloor;
            remainingDist = 0; 
          }
        }

        if (lastPoint.y > 0.15) {
          let fallbackX = Math.max(-4.95, Math.min(4.95, lastPoint.x + dx * 1.5));
          let fallbackZ = Math.max(-9.95, Math.min(9.95, lastPoint.z + dz * 1.5));
          let pFloor = new THREE.Vector3(fallbackX, 0.1, fallbackZ);
          let dist = lastPoint.distanceTo(pFloor);
          let mid = new THREE.Vector3((lastPoint.x + pFloor.x) / 2, lastPoint.y + Math.min(0.3, dist * 0.2), (lastPoint.z + pFloor.z) / 2);
          resultCurves.push(new THREE.QuadraticBezierCurve3(lastPoint, mid, pFloor));
        }
      }
    }

    return { curves: resultCurves };
  }, [
    props.positions.ball.zone, props.positions.ball.side, props.positions.ball.type,
    props.selectedZone, props.selectedLaufZone, props.selectedPartnerZone,
    props.turnResult, props.hasSubmitted, props.exactCoords
  ]);

  useFrame((_, delta) => {
    if (!props.isPreparingShot && !props.hasSubmitted) {
      flightTimer.current = 0;
      cameraBallProgress.current = 0;
      targetPos.current.set(0, 12.5, 23);
      targetLook.current.set(0, -0.5, -2);
     
      camera.position.lerp(targetPos.current, 4.0 * delta);
      currentLook.current.lerp(targetLook.current, 4.0 * delta);
     
      if (props.controlsRef.current) {
        props.controlsRef.current.enabled = true;
        props.controlsRef.current.target.copy(currentLook.current);
        props.controlsRef.current.update();
      } else {
        camera.lookAt(currentLook.current);
      }
      return;
    }

    if (props.controlsRef.current) {
      props.controlsRef.current.enabled = false;
    }

    const isOpponent = props.hitterId === "opp1" || props.hitterId === "opp2";
    const teamSide = isOpponent ? "right" : "left";
    const targetSide = isOpponent ? "left" : "right"; 
   
    let startZoneStr = props.hitterId === "you" ? props.positions.you : (props.hitterId === "partner" ? props.positions.partner : props.positions[props.hitterId as keyof PlayerPositions] as string);
    if (!startZoneStr || startZoneStr.length < 2) startZoneStr = "C3";

    let start = getZoneCenter3D(teamSide, startZoneStr);
    const dirZ = isOpponent ? 1 : -1;
    let camCoords = { x: 0, z: 0 };

    if (props.exactCoords?.you && props.hitterId === "you") {
      start = new THREE.Vector3(props.exactCoords.you.x, 0.02, props.exactCoords.you.z);
      camCoords = { x: start.x, z: start.z - (dirZ * 2.5) };
    } else {
      const startRow = parseInt(startZoneStr.charAt(1));
      const camRow = startRow === 1 ? 1 : startRow - 1;
      const camZoneStr = `${startZoneStr.charAt(0).toUpperCase()}${camRow}`;
      const c = getZoneCenter3D(teamSide, camZoneStr);
      camCoords = { x: c.x, z: c.z };
    }

    if (props.isPreparingShot && !props.hasSubmitted) {
      targetPos.current.set(camCoords.x, 2.0, camCoords.z);
      targetLook.current.set(start.x, 1.0, start.z + (dirZ * 4.0));

      camera.position.lerp(targetPos.current, 5.0 * delta);
      currentLook.current.lerp(targetLook.current, 5.0 * delta);
      camera.lookAt(currentLook.current);
      return;
    }

    if (props.hasSubmitted) {
      flightTimer.current += delta;
     
      const startCamPos = new THREE.Vector3(camCoords.x, 2.0, camCoords.z);
      const c3Coords = getZoneCenter3D(targetSide, "C3");
      const c3Pos = new THREE.Vector3(c3Coords.x, 1.2, c3Coords.z);

      const DELAY_TIME = 0.5;

      if (flightTimer.current < DELAY_TIME) {
        targetPos.current.copy(startCamPos);
        targetLook.current.set(start.x, 1.0, start.z + (dirZ * 4.0));
        camera.position.lerp(targetPos.current, 8.0 * delta);
        currentLook.current.lerp(targetLook.current, 8.0 * delta);
      }
      else {
        const timeInSeconds = (props.timerDuration || 3000) / 1000;
        const baseSpeed = 3.0 / Math.max(1, timeInSeconds - 0.5);
        let currentTrackingSpeed = baseSpeed;

        if (cameraBallProgress.current >= 2.0) {
          currentTrackingSpeed = baseSpeed * 0.30;
        } else if (cameraBallProgress.current >= 1.0) {
          currentTrackingSpeed = baseSpeed * 0.50;
        }

        cameraBallProgress.current += delta * currentTrackingSpeed;
        const p = cameraBallProgress.current;

        const maxCurves = Math.max(1, curves.length);
        const moveProgress = Math.min(1.0, p / maxCurves);
        targetPos.current.copy(startCamPos).lerp(c3Pos, moveProgress);
        camera.position.lerp(targetPos.current, 10.0 * delta);

        if (curves.length > 0) {
          let currentCurveIndex = Math.floor(p);
          if (currentCurveIndex >= curves.length) currentCurveIndex = curves.length - 1;
          let t = p - currentCurveIndex;
          if (p >= curves.length) t = 1;
          t = Math.max(0, Math.min(1, t));

          const exactBallPos = curves[currentCurveIndex].getPointAt(t);
          targetLook.current.copy(exactBallPos);
        } else {
          targetLook.current.set(0, 0.5, 0);
        }
        currentLook.current.lerp(targetLook.current, 15.0 * delta);
      }
      camera.lookAt(currentLook.current);
    }
  });

  return null;
}

// =========================================================
// 2. PROPS DEFINITION
// =========================================================
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
  isPreparingShot?: boolean;

  hidePlayerLabels?: boolean;

  exactCoords?: {
    you?: { x: number, z: number };
    target?: { x: number, z: number };
  };

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

// =========================================================
// 3. HAUPTKOMPONENTE (ScenarioCourt4D)
// =========================================================
export default function ScenarioCourt4D(props: Props) {
  const [playerName, setPlayerName] = useState("Gast");
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (props.onIntroFinished) {
      props.onIntroFinished();
    }
  }, []);

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
         
          {!props.gameOver && (
            <DynamicActionCamera
              {...props}
              controlsRef={controlsRef}
            />
          )}

          {!props.gameOver && (
            <OrbitControls
              ref={controlsRef}
              enabled={!props.hasSubmitted && !props.isPreparingShot}
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
         
          <ambientLight intensity={0.1} color="#080d1e" />
          <directionalLight position={[0, 20, -10]} intensity={1.2} color="#ffffff" castShadow={false} />
          <Environment preset="city" environmentIntensity={0.5} />

          <Suspense fallback={<Html center className="text-white font-bold tracking-widest">LADE ARENA...</Html>}>
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
              isSimulationMode={true}
            />
            <TacticalData 
              {...props} 
              isCinematicMode={true} 
              hidePlayerLabels={!!props.exactCoords}
              positions={{
                ...props.positions,
                you: props.exactCoords?.you 
                  ? `EXACT_${props.exactCoords.you.x}_${props.exactCoords.you.z}` 
                  : props.positions.you,
                
                partner: props.exactCoords ? "EXACT_1000_1000" : props.positions.partner,
                opp1: props.exactCoords ? "EXACT_1000_1000" : props.positions.opp1,
                opp2: props.exactCoords ? "EXACT_1000_1000" : props.positions.opp2,
              }}
              selectedZone={props.exactCoords?.target 
                ? `EXACT_${props.exactCoords.target.x}_${props.exactCoords.target.z}` 
                : props.selectedZone
              }
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
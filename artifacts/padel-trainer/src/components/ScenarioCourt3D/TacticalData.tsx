import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Plane, Html, QuadraticBezierLine, Cylinder, Sphere, Ring, Edges, Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Props } from "./ScenarioCourt3D";

const LETTERS = ["A", "B", "C", "D", "E"];
const NUMBERS = [1, 2, 3, 4, 5];

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
  if (side === "left") {
    pos.z -= 0.7;
  } else {
    pos.z += 0.7;
  }
  return pos;
}

function getShotParameters(schlagTyp: string) {
  const sType = (schlagTyp || "").toUpperCase();
  
  if (sType.includes("LOB")) return { bogenHoehe: 9.0, powerMultiplier: 0.10, defaultColor: "#34d399" };
  if (sType.includes("CHIQUITA")) return { bogenHoehe: 3.0, powerMultiplier: 0.15, defaultColor: "#34d399" };
  if (sType.includes("SMASH")) return { bogenHoehe: 0.4, powerMultiplier: 1.0, defaultColor: "#ef4444" };
  if (sType.includes("BAJADA")) return { bogenHoehe: 0.4, powerMultiplier: 0.4, defaultColor: "#f97316" };
  if (sType.includes("VIBORA")) return { bogenHoehe: 0.5, powerMultiplier: 0.35, defaultColor: "#f97316" };
  if (sType.includes("BANDEJA")) return { bogenHoehe: 0.7, powerMultiplier: 0.25, defaultColor: "#f97316" };
  if (sType.includes("VOLLEY")) return { bogenHoehe: 0.5, powerMultiplier: 0.25, defaultColor: "#34d399" };
  if (sType.includes("BLOCK")) return { bogenHoehe: 0.5, powerMultiplier: 0.1, defaultColor: "#34d399" };
  if (sType.includes("DRIVE")) return { bogenHoehe: 1.2, powerMultiplier: 0.25, defaultColor: "#34d399" };
  if (sType.includes("AUFSCHLAG")) return { bogenHoehe: 1.5, powerMultiplier: 0.3, defaultColor: "#34d399" };

  return { bogenHoehe: 1.2, powerMultiplier: 0.25, defaultColor: "#ffffff" };
}

function calculatePreviewTrajectory(startPos: THREE.Vector3, targetPos: THREE.Vector3, schlagTyp: string) {
  const { bogenHoehe, powerMultiplier } = getShotParameters(schlagTyp);
  const sType = (schlagTyp || "").toUpperCase();
  const segments: { start: THREE.Vector3, mid: THREE.Vector3, end: THREE.Vector3 }[] = [];

  const pStart = new THREE.Vector3(startPos.x, 1.5, startPos.z);
  const p1stBounce = new THREE.Vector3(targetPos.x, 0.1, targetPos.z);

  const midY = Math.max(pStart.y, p1stBounce.y) + bogenHoehe;
  const mid1 = new THREE.Vector3((pStart.x + p1stBounce.x) / 2, midY, (pStart.z + p1stBounce.z) / 2);
  segments.push({ start: pStart, mid: mid1, end: p1stBounce });

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
      
      segments.push({ start: lastPoint.clone(), mid: mid.clone(), end: pWall.clone() });
      
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
      segments.push({ start: lastPoint.clone(), mid: mid.clone(), end: pFloor.clone() });
      
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
    segments.push({ start: lastPoint, mid: mid, end: pFloor });
  }

  return segments;
}

function AnimatedBall({
  startPos, targetPos, schlagTyp, isAnimating, isNetCrash, isWallDirectCrash, flightTimeMs, isCaughtInAir, isCinematicMode
}: {
  startPos: THREE.Vector3, targetPos: THREE.Vector3 | null, schlagTyp: string,
  isAnimating: boolean, isNetCrash?: boolean, isWallDirectCrash?: boolean, flightTimeMs?: number, isCaughtInAir?: boolean, isCinematicMode?: boolean
}) {
  const ballRef = useRef<THREE.Mesh>(null);
  const distanceRef = useRef(0);
  const delayTimer = useRef(0);

  React.useEffect(() => {
    distanceRef.current = 0;
    delayTimer.current = 0;
  }, [startPos.x, startPos.z]);

  const { curves, lengths, totalLength, effectiveLength } = useMemo(() => {
    if (!targetPos) return { curves: [], lengths: [], totalLength: 0, effectiveLength: 0 };

    const { bogenHoehe, powerMultiplier } = getShotParameters(schlagTyp);
    const sType = (schlagTyp || "").toUpperCase();
    const resultCurves: THREE.QuadraticBezierCurve3[] = [];

    if (isNetCrash) {
      const zDist = startPos.z - targetPos.z;
      const fraction = zDist !== 0 ? Math.abs(startPos.z) / Math.abs(zDist) : 0.5;
      const netX = startPos.x + (targetPos.x - startPos.x) * fraction;
      
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
      const targetZDist = targetPos.z - startPos.z;
      const fraction = targetZDist !== 0 ? Math.abs(zDist / targetZDist) : 1;
      
      let wallX = startPos.x + (targetPos.x - startPos.x) * fraction;
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
      const p1stBounce = new THREE.Vector3(targetPos.x, finalTargetY, targetPos.z);
      
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

    const friction = [1.0, 0.65, 0.45, 0.35];
    let effectiveLen = 0;

    const lens = resultCurves.map((c, idx) => {
      const l = c.getLength();
      effectiveLen += l / friction[Math.min(idx, 3)];
      return l;
    });
    
    const tLen = lens.reduce((sum, val) => sum + val, 0);

    return { curves: resultCurves, lengths: lens, totalLength: tLen, effectiveLength: effectiveLen };
  }, [startPos.x, startPos.z, targetPos?.x, targetPos?.z, schlagTyp, isNetCrash, isWallDirectCrash, isCaughtInAir]);

  useFrame((state, delta) => {
    if (!ballRef.current) return;
    if (isAnimating && curves.length > 0 && effectiveLength > 0) {
      
      if (isCinematicMode) {
        if (delayTimer.current < 1.3) {
          delayTimer.current += delta;
          ballRef.current.position.set(startPos.x, 1.5, startPos.z);
          return;
        }
      }

      const baseTime = (flightTimeMs || 5000) / 1000;
      const timeInSeconds = Math.max(baseTime, curves.length * 0.55);
      const baseSpeed = effectiveLength / timeInSeconds;

      let traveledForIndex = 0;
      let currentCurveIndex = 0;
      for (let i = 0; i < curves.length; i++) {
        if (distanceRef.current <= traveledForIndex + lengths[i] || i === curves.length - 1) {
          currentCurveIndex = i;
          break;
        }
        traveledForIndex += lengths[i];
      }

      const standardFriction = [1.0, 0.65, 0.45, 0.35];
      let currentFriction = standardFriction[Math.min(currentCurveIndex, 3)];

      if (isCinematicMode) {
        if (currentCurveIndex >= 2) currentFriction = 0.20;
        else if (currentCurveIndex === 1) currentFriction = 0.40;
      }

      const currentSpeed = baseSpeed * currentFriction;

      distanceRef.current += currentSpeed * delta;
      let currentDist = distanceRef.current;
      
      if (currentDist >= totalLength) {
        currentDist = totalLength;
      }

      let traveledForPos = 0;
      for (let i = 0; i < curves.length; i++) {
        const curveLen = lengths[i];
        if (currentDist <= traveledForPos + curveLen || i === curves.length - 1) {
          let t = curveLen === 0 ? 1 : (currentDist - traveledForPos) / curveLen;
          t = Math.max(0, Math.min(1, t));
          
          const position = curves[i].getPointAt(t);
          ballRef.current.position.copy(position);
          break;
        }
        traveledForPos += curveLen;
      }
    } else {
      distanceRef.current = 0;
      delayTimer.current = 0;
      ballRef.current.position.set(startPos.x, 1.5, startPos.z);
    }
  });

  return (
    <mesh ref={ballRef} position={[startPos.x, 1.5, startPos.z]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color="#ccff00" emissive="#ccff00" emissiveIntensity={5} />
      <pointLight color="#ccff00" intensity={2} distance={3} />
    </mesh>
  );
}

function Real3DPlayer({
  position, type, label, isGlowing, isHitter, onClick, disabled, modelUrl, rotation, hidePlayerLabels
}: {
  position: THREE.Vector3, type: string, label: string,
  isGlowing?: boolean, isHitter?: boolean, onClick?: () => void, disabled?: boolean,
  modelUrl: string, rotation?: [number, number, number], hidePlayerLabels?: boolean
}) {
  const groupRef = useRef<THREE.Group>(null);
  
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(), [scene, modelUrl]);

  useEffect(() => {
    if (groupRef.current) groupRef.current.position.set(position.x, 0, position.z);
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetPos = new THREE.Vector3(position.x, 0, position.z);
      groupRef.current.position.lerp(targetPos, 6.0 * delta);
    }
  });

  const isInteractive = onClick && !disabled;

  let baseColor = "#ef4444";
  if (type === "DU") baseColor = "#a855f7";
  if (type === "PTNER") baseColor = "#06b6d4";
  
  const auraColor = useMemo(() => new THREE.Color(baseColor), [baseColor]);

  return (
    <group 
      ref={groupRef} 
      onClick={(e) => {
        if (isInteractive) { e.stopPropagation(); onClick(); }
      }}
      onPointerOver={(e) => { if (isInteractive) { e.stopPropagation(); document.body.style.cursor = 'pointer'; } }}
      onPointerOut={(e) => { if (isInteractive) { e.stopPropagation(); document.body.style.cursor = 'default'; } }}
    >
      
      <Ring args={[0.45, 0.5, 32]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <meshBasicMaterial color={baseColor} side={THREE.DoubleSide} transparent opacity={isGlowing ? 1 : 0.15} />
      </Ring>

      {isGlowing && (
        <group>
          <Ring args={[0.65, 0.68, 32]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <meshBasicMaterial color={baseColor} side={THREE.DoubleSide} transparent opacity={0.7} />
          </Ring>

          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.55, 0.65, 1.2, 32, 1, true]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              uniforms={{ glowColor: { value: auraColor } }}
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                varying vec2 vUv;
                uniform vec3 glowColor;
                void main() {
                  float intensity = 1.0 - vUv.y;
                  intensity = pow(intensity, 2.0);
                  intensity *= 0.6;
                  gl_FragColor = vec4(glowColor, intensity);
                }
              `}
            />
          </mesh>
          
          <pointLight color={baseColor} intensity={2.5} distance={2.5} position={[0, 1.0, 0.5]} />
        </group>
      )}

      <primitive object={clonedScene} scale={1.4} rotation={rotation || [0, 0, 0]} />

      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 3.2, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {!hidePlayerLabels && (
        <Html position={[0, 2.8, 0]} center style={{ pointerEvents: 'none' }}>
          <div className={`whitespace-nowrap px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider backdrop-blur-md transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isGlowing ? 'bg-black/90 scale-110' : 'bg-black/60'} ${type === 'DU' ? 'text-purple-400 border-purple-500' : type === 'PTNER' ? 'text-cyan-400 border-cyan-500' : 'text-orange-400 border-orange-500/50'}`}>
            {label}
          </div>
        </Html>
      )}
      
      {!hidePlayerLabels && isHitter && !disabled && (
        <Html position={[0, 3.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="bg-orange-500 text-white font-black rounded-full w-5 h-5 flex items-center justify-center text-xs animate-bounce border border-white shadow-[0_0_15px_rgba(255,165,0,0.8)]">
            !
          </div>
        </Html>
      )}
    </group>
  );
}

export default function TacticalData(props: Props & { isCinematicMode?: boolean; hidePlayerLabels?: boolean }) {
  const allZoneIds = useMemo(() => LETTERS.flatMap((l) => NUMBERS.map((n) => `${l}${n}`)), []);
  const isLocked = props.hasSubmitted && !props.isTimerActive;

  const runOriginsRef = useRef({ you: props.positions.you, partner: props.positions.partner });
  useEffect(() => {
    if (!isLocked) {
      runOriginsRef.current = { you: props.positions.you, partner: props.positions.partner };
    }
  }, [isLocked, props.positions.you, props.positions.partner]);

  const getRealtimeRunFeedback = (runZone: string) => {
    const validFromProps = props.acceptableLaufZones || [];
    
    if (validFromProps.length > 0) {
      return validFromProps.includes(runZone);
    }
    
    const shot = (props.previewShot || props.positions.ball.type || "").toUpperCase();
    if (!shot || !runZone) return null;
    
    const runRow = parseInt(runZone[1]);

    if (["LOB", "CHIQUITA", "AUFSCHLAG"].includes(shot)) {
        return runRow >= 3;
    }
    if (["SMASH", "VOLLEY", "BANDEJA", "VIBORA"].includes(shot)) {
        return runRow >= 3;
    }
    if (["DRIVE", "BLOCK", "BAJADA"].includes(shot)) {
        return runRow <= 2;
    }
    return false;
  };

  return (
    <group name="TacticalData">
      <Text position={[0, 0.03, 11]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.8} color="rgba(255,255,255,0.2)" letterSpacing={0.2} anchorX="center" anchorY="middle" fontWeight="bold">
        DEINE SEITE
      </Text>
      <Text position={[0, 0.03, -11]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={0.8} color="rgba(255,255,255,0.2)" letterSpacing={0.2} anchorX="center" anchorY="middle" fontWeight="bold">
        GEGNERISCHE SEITE
      </Text>

      {allZoneIds.map((zoneId) => {
        const posLeft = getZoneCenter3D("left", zoneId);
        
        const isSelectedYou = !isLocked && props.selectedLaufZone === zoneId;
        const isSelectedPartner = !isLocked && props.selectedPartnerZone === zoneId;
        
        const isSelectedLeftAfterSubmit = isLocked && (props.selectedLaufZone === zoneId || props.selectedPartnerZone === zoneId);
        const isPerfectLeft = props.profiMode && isLocked && props.perfectLaufZone === zoneId;
        const isAcceptableLeft = props.profiMode && isLocked && (props.acceptableLaufZones || []).includes(zoneId);
        const isWrongLeft = props.profiMode && isLocked && isSelectedLeftAfterSubmit && !isPerfectLeft && !isAcceptableLeft;

        let colorLeft = "transparent"; let emissiveLeft = 0; let opLeft = 0;
        if (!isLocked) {
          if (isSelectedYou) { colorLeft = "#a855f7"; emissiveLeft = 2; opLeft = 0.25; }
          if (isSelectedPartner) { colorLeft = "#06b6d4"; emissiveLeft = 2; opLeft = 0.25; }
          if (isSelectedYou && isSelectedPartner) colorLeft = props.activeChar === "you" ? "#a855f7" : "#06b6d4";
        } else if (props.profiMode) {
          if (isPerfectLeft) { colorLeft = "#34d399"; emissiveLeft = 3; opLeft = 0.3; } 
          else if (isAcceptableLeft) { colorLeft = "#f97316"; emissiveLeft = 2; opLeft = 0.3; } 
          else if (isWrongLeft) { colorLeft = "#ef4444"; emissiveLeft = 3; opLeft = 0.3; } 
        }

        const posRight = getZoneCenter3D("right", zoneId);
        const isSelectedRight = !props.isAiActive && props.selectedZone === zoneId;
        const isBestRight = !props.isAiActive && isLocked && props.bestZones.includes(zoneId);
        const isAcceptableRight = !props.isAiActive && isLocked && (props.acceptableZones || []).includes(zoneId);
        const isWrongRight = !props.isAiActive && isLocked && isSelectedRight && !isBestRight && !isAcceptableRight;

        let colorRight = "transparent"; let emissiveRight = 0; let opRight = 0;
        if (!isLocked && isSelectedRight) { colorRight = "#34d399"; emissiveRight = 2; opRight = 0.2; } 
        else if (isLocked) {
          if (isBestRight) { colorRight = "#34d399"; emissiveRight = 3; opRight = 0.3; }
          else if (isAcceptableRight) { colorRight = "#f97316"; emissiveRight = 2; opRight = 0.3; }
          else if (isWrongRight) { colorRight = "#ef4444"; emissiveRight = 3; opRight = 0.3; }
        }

        const defaultEdgeColor = "#6dcefc"; 

        return (
          <React.Fragment key={`zones-${zoneId}`}>
            <group position={[posLeft.x, posLeft.y, posLeft.z]}>
              <Plane args={[1.95, 1.95]} rotation={[-Math.PI / 2, 0, 0]}
                 onClick={(e) => { e.stopPropagation(); if (!isLocked && props.onLaufZoneClick) props.onLaufZoneClick(zoneId); }}
                  >
                <meshStandardMaterial 
                  color={colorLeft} 
                  emissive={colorLeft} 
                  emissiveIntensity={emissiveLeft} 
                  transparent 
                  opacity={opLeft > 0 ? opLeft : 0.0} 
                  depthWrite={false}
                />
                
                <Edges 
                  linewidth={opLeft > 0 ? 2 : 1.5} 
                  color={opLeft > 0 ? new THREE.Color(colorLeft).multiplyScalar(2) : defaultEdgeColor} 
                  transparent 
                  opacity={opLeft > 0 ? 1 : 0.25} 
                />
              </Plane>
            </group>

            <group position={[posRight.x, posRight.y, posRight.z]}>
              <Plane args={[1.95, 1.95]} rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => { e.stopPropagation(); if (props.level !== "Schlag" && !props.hasSubmitted && props.activeChar === props.hitterId) props.onZoneClick(zoneId); }}
              >
                <meshStandardMaterial 
                  color={colorRight} 
                  emissive={colorRight} 
                  emissiveIntensity={emissiveRight} 
                  transparent 
                  opacity={opRight > 0 ? opRight : 0.0}
                  depthWrite={false}
                />
                
                <Edges 
                  linewidth={opRight > 0 ? 2 : 1.5} 
                  color={opRight > 0 ? new THREE.Color(colorRight).multiplyScalar(2) : defaultEdgeColor}
                  transparent 
                  opacity={opRight > 0 ? 1 : 0.25} 
                />
              </Plane>
            </group>
          </React.Fragment>
        );
      })}

      <Real3DPlayer 
        modelUrl="/Player1.glb"
        rotation={[0, Math.PI, 0]} 
        position={getZoneCenter3D("left", props.positions.you)} 
        type="DU" label="DU" 
        isGlowing={props.activeChar === "you"} 
        isHitter={props.hitterId === "you"}
        onClick={() => props.onPlayerClick && props.onPlayerClick("you")}
        disabled={isLocked}
        hidePlayerLabels={props.hidePlayerLabels} 
      />
      
      <Real3DPlayer 
        modelUrl="/Player2.glb"
        rotation={[0, Math.PI, 0]} 
        position={getZoneCenter3D("left", props.positions.partner)} 
        type="PTNER" label="PARTNER" 
        isGlowing={props.activeChar === "partner"}
        isHitter={props.hitterId === "partner"}
        onClick={() => props.onPlayerClick && props.onPlayerClick("partner")}
        disabled={isLocked}
        hidePlayerLabels={props.hidePlayerLabels} 
      />
      
      <Real3DPlayer 
        modelUrl="/Player3.glb"
        rotation={[0, 0, 0]} 
        position={getZoneCenter3D("right", props.positions.opp1)} 
        type="GEG1" label="KI 1" 
        isGlowing={props.activeChar === "opp1"} 
        isHitter={props.hitterId === "opp1"} 
        hidePlayerLabels={props.hidePlayerLabels} 
      />
      
      <Real3DPlayer 
        modelUrl="/Player4.glb"
        rotation={[0, 0, 0]} 
        position={getZoneCenter3D("right", props.positions.opp2)} 
        type="GEG2" label="KI 2" 
        isGlowing={props.activeChar === "opp2"} 
        isHitter={props.hitterId === "opp2"} 
        hidePlayerLabels={props.hidePlayerLabels} 
      />

      {/* --- BALL ANIMATION --- */}
      {(() => {
        const startSide = props.positions.ball.side || "left";
        const targetSide = startSide === "left" ? "right" : "left"; 
        
        const ballPos = getFrontPos3D(startSide, props.positions.ball.zone);
        let ballTargetPos = null;
        let isAnimating = false;
        
        if (props.hasSubmitted && props.selectedZone) {
          ballTargetPos = getZoneCenter3D(targetSide, props.selectedZone);
          isAnimating = true;
          // Magnet-Bug Logic entfernt. Die Ball-Physik ist jetzt komplett an die 
          // Timer-Phase aus der GameScreen gebunden und klebt nicht mehr!
        }

        return (
          <AnimatedBall 
            startPos={ballPos} 
            targetPos={ballTargetPos} 
            schlagTyp={props.positions.ball.type || "Schlag"} 
            isAnimating={isAnimating}
            isNetCrash={props.turnResult === "error_net"}
            isWallDirectCrash={props.turnResult === "error_wall_direct"}
            flightTimeMs={props.timerDuration}
            isCaughtInAir={false}
            isCinematicMode={props.isCinematicMode}
          />
        );
      })()}

      {/* --- LINIEN MIT ECHTZEIT-FEEDBACK --- */}
      {props.selectedLaufZone && (() => {
         const origin = isLocked ? runOriginsRef.current.you : props.positions.you;
         if (origin === props.selectedLaufZone) return null;
         
         const fromPos = getZoneCenter3D("left", origin);
         const targetPos = getZoneCenter3D("left", props.selectedLaufZone);
         const midPoint = new THREE.Vector3((fromPos.x + targetPos.x) / 2, 0.1, (fromPos.z + targetPos.z) / 2);
         
         let lineColor = "#a855f7"; 
         if (!props.profiMode) {
           const feedback = getRealtimeRunFeedback(props.selectedLaufZone);
           if (feedback !== null) {
             lineColor = feedback ? "#34d399" : "#ef4444"; 
           }
         }
         
         return <QuadraticBezierLine start={[fromPos.x, 0.2, fromPos.z]} end={[targetPos.x, 0.2, targetPos.z]} mid={[midPoint.x, 0.1, midPoint.z]} color={lineColor} lineWidth={5} dashed dashScale={5} />;
      })()}

      {props.selectedPartnerZone && (() => {
         const origin = isLocked ? runOriginsRef.current.partner : props.positions.partner;
         if (origin === props.selectedPartnerZone) return null;

         const fromPos = getZoneCenter3D("left", origin);
         const targetPos = getZoneCenter3D("left", props.selectedPartnerZone);
         const midPoint = new THREE.Vector3((fromPos.x + targetPos.x) / 2, 0.1, (fromPos.z + targetPos.z) / 2);
         
         let lineColor = "#06b6d4"; 
         if (!props.profiMode) {
           const feedback = getRealtimeRunFeedback(props.selectedPartnerZone);
           if (feedback !== null) {
             lineColor = feedback ? "#34d399" : "#ef4444"; 
           }
         }
         
         return <QuadraticBezierLine start={[fromPos.x, 0.2, fromPos.z]} end={[targetPos.x, 0.2, targetPos.z]} mid={[midPoint.x, 0.1, midPoint.z]} color={lineColor} lineWidth={5} dashed dashScale={5} />;
      })()}

      {/* --- VORSCHAU FLUGKURVE --- */}
      {(() => {
        // FIX: Sicheres Fallback, damit die gestrichelte Vorschau-Linie nicht während der eigenen Animation verschwindet
        const targetZoneId = (isLocked && props.bestZones && props.bestZones.length > 0) 
            ? props.bestZones[0] 
            : props.selectedZone;
            
        if (!targetZoneId) return null;

        const startSide = props.positions.ball.side || "left";
        const targetSide = startSide === "left" ? "right" : "left";

        const startZoneId = props.positions.ball.zone;
        const startPos = getFrontPos3D(startSide, startZoneId);
        const targetPos = getZoneCenter3D(targetSide, targetZoneId);

        const sType = props.previewShot || props.positions.ball.type || "Drive";
        const { bogenHoehe, defaultColor } = getShotParameters(sType);
        
        let lineColor = defaultColor;

        if (props.profiMode) {
          lineColor = "rgba(255, 255, 255, 0.6)"; 
        } else {
          
          const hitterPosZone = props.positions[props.hitterId] || props.positions.you;
          const hitFromZoneId = hitterPosZone;
          
          const hCol = hitFromZoneId[0];
          const hRow = parseInt(hitFromZoneId[1]);
          const tCol = targetZoneId[0];
          const tRow = parseInt(targetZoneId[1]);
          const upperSType = sType.toUpperCase();

          const o1Row = parseInt(props.positions.opp1[1]);
          const o2Row = parseInt(props.positions.opp2[1]);
          const oppsAtNet = o1Row >= 3 || o2Row >= 3; 
          const oppsAtBack = o1Row <= 2 && o2Row <= 2; 

          if (["VOLLEY", "BLOCK", "SMASH", "BANDEJA", "VIBORA"].includes(upperSType) && hRow <= 2) {
            lineColor = "#ef4444"; 
          } 
          else if (["DRIVE", "BAJADA"].includes(upperSType) && hRow >= 4) {
            lineColor = "#ef4444"; 
          }
          else if (upperSType === "BLOCK" && hRow <= 2) {
            lineColor = "#ef4444"; 
          }
          else {
            switch(upperSType) {
              case "AUFSCHLAG":
                if (tRow === 3) {
                  const isCross = (hCol === "B" && ["C", "D", "E"].includes(tCol)) || 
                                  (hCol === "D" && ["A", "B", "C"].includes(tCol));
                  lineColor = isCross ? "#34d399" : "#ef4444"; 
                } else if (tRow === 2) {
                  lineColor = "#f97316"; 
                } else {
                  lineColor = "#ef4444"; 
                }
                break;
                
              case "DRIVE":
                if (tRow >= 4 && oppsAtNet) {
                  lineColor = "#ef4444"; 
                } else if (tRow >= 4) {
                  lineColor = "#f97316"; 
                } else if (tCol === "A" || tCol === "E") {
                  lineColor = "#34d399"; 
                } else {
                  lineColor = "#34d399"; 
                }
                break;
                
              case "VOLLEY":
                if (tRow <= 2) {
                  lineColor = "#34d399"; 
                } else if (tRow >= 4 && oppsAtNet) {
                  lineColor = "#ef4444"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;

              case "BLOCK":
                if (tRow >= 4 && oppsAtNet) {
                  lineColor = "#34d399"; 
                } else if (tRow <= 2) {
                  lineColor = "#ef4444"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;
                
              case "LOB":
                if (tRow >= 3) {
                  lineColor = "#ef4444"; 
                } else if (oppsAtNet) {
                  lineColor = "#34d399"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;
                
              case "CHIQUITA":
                if (tRow <= 3) {
                  lineColor = "#ef4444"; 
                } else if (oppsAtNet) {
                  lineColor = "#34d399"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;
                
              case "BAJADA":
                if (tRow <= 2) {
                  lineColor = "#34d399"; 
                } else if (tRow === 3) {
                  lineColor = "#f97316"; 
                } else {
                  lineColor = "#ef4444"; 
                }
                break;
                
              case "BANDEJA":
                if (tRow >= 3) {
                  lineColor = "#ef4444"; 
                } else if (oppsAtBack) {
                  lineColor = "#34d399"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;
                
              case "VIBORA":
                if (tRow >= 3) {
                  lineColor = "#ef4444"; 
                } else if (oppsAtBack && (tCol === "A" || tCol === "E")) {
                  lineColor = "#34d399"; 
                } else {
                  lineColor = "#f97316"; 
                }
                break;
                
              case "SMASH":
                if (tRow <= 2) {
                  lineColor = "#34d399"; 
                } else if (tRow === 3) {
                  lineColor = "#f97316"; 
                } else {
                  lineColor = "#ef4444"; 
                }
                break;
            }
          }
        }

        const segments = calculatePreviewTrajectory(startPos, targetPos, sType);
        
        return (
          <group key={`preview-${startZoneId}-${targetZoneId}-${sType}-${lineColor}`}>
            {segments.map((seg, idx) => (
              <QuadraticBezierLine 
                key={`seg-${idx}`}
                start={[seg.start.x, seg.start.y, seg.start.z]} 
                end={[seg.end.x, seg.end.y, seg.end.z]} 
                mid={[seg.mid.x, seg.mid.y, seg.mid.z]} 
                color={lineColor} 
                lineWidth={props.previewShot ? (idx === 0 ? 5 : 2) : 2} 
                dashed 
                dashScale={props.previewShot ? 15 : 5} 
                transparent={true}
                opacity={idx === 0 ? 1 : 0.4} 
              />
            ))}
          </group>
        );
      })()}
    </group>
  );
}

useGLTF.preload("/Player1.glb");
useGLTF.preload("/Player2.glb");
useGLTF.preload("/Player3.glb");
useGLTF.preload("/Player4.glb");
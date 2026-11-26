import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RacketMesh } from "./RacketMesh";

interface SpinningRacketStageProps {
  racketId?: string | null;
  autoRotateSpeed: number;
  tiltZ: number;
}

function SpinningRacketStage({
  racketId,
  autoRotateSpeed,
  tiltZ,
}: SpinningRacketStageProps) {
  const spinRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (spinRef.current && autoRotateSpeed !== 0) {
      spinRef.current.rotation.y += Math.min(delta, 0.05) * autoRotateSpeed;
    }
  });

  return (
    <group ref={spinRef} rotation={[0.08, 0, tiltZ]}>
      {/* Alle 45cm-GLBs liegen auf Y = 0..0.45 -> -0.225 zentriert den Pivot exakt in der Mitte */}
      <RacketMesh
        racketId={racketId}
        position={[0, -0.225, 0]}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}

export interface RacketPreview3DProps {
  racketId?: string | null;
  className?: string;
  /** true im Shop (per Finger/Maus drehbar), false z. B. für kompakte Kacheln im ProfileTab */
  interactive?: boolean;
  autoRotateSpeed?: number;
  tiltZ?: number;
}

export default function RacketPreview3D({
  racketId,
  className = "w-full h-44",
  interactive = true,
  autoRotateSpeed = 0.65,
  tiltZ = -0.18,
}: RacketPreview3DProps) {
  return (
    <div
      className={`relative overflow-hidden ${interactive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${className}`}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.02, 0.78], fov: 38 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "low-power",
        }}
      >
        {/* Lokales Studio-Licht ohne externe HDRI-Dateien (Capacitor- & Offline-sicher) */}
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#e0f2fe", "#0f172a", 0.9]} />
        <directionalLight position={[2.2, 3.0, 2.5]} intensity={1.8} color="#ffffff" />
        <directionalLight position={[-2.4, 1.2, -1.8]} intensity={1.1} color="#38bdf8" />
        <directionalLight position={[0, -1.5, 1.8]} intensity={0.45} color="#f59e0b" />

        <SpinningRacketStage
          racketId={racketId}
          autoRotateSpeed={autoRotateSpeed}
          tiltZ={tiltZ}
        />

        {interactive && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={(2 * Math.PI) / 3}
          />
        )}
      </Canvas>
    </div>
  );
}
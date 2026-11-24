import React, { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three";

import { supabase } from "../lib/supabase";
import Effects from "../components/ScenarioCourt3D/Effects";
import CourtFloor from "../components/ScenarioCourt3D/CourtFloor";
import TacticalData from "../components/ScenarioCourt3D/TacticalData";
import { useTranslation } from "../lib/i18n";
import {
  LabMode,
  LabShotType,
  LabSimulationResult,
  TrajectorySegment,
} from "../lib/glassPhysics";

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

// =========================================================
// VEREINTES 3D-LABOR: ANGRIFF (INKL. POR 3/4) & SCHEIBENSPIEL
// =========================================================
export interface TrajectoryLabConfig {
  active: boolean;
  mode: LabMode;
  isPlaying: boolean;
  hasFinished: boolean;
  playbackSpeed: number;
  replayKey: number;
  showPreviewGuide: boolean;
  shotType: LabShotType;
  playerPos: { x: number; z: number };
  oppPos?: { x: number; z: number };
  simulation: LabSimulationResult;
  onFinished?: () => void;
}

function buildTubeGeometry(points: THREE.Vector3[], radius: number): THREE.TubeGeometry | null {
  if (!points || points.length < 2) return null;
  const deduped: THREE.Vector3[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].distanceTo(deduped[deduped.length - 1]) > 0.025) {
      deduped.push(points[i]);
    }
  }
  if (deduped.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(deduped);
  return new THREE.TubeGeometry(curve, Math.max(12, deduped.length * 2), radius, 8, false);
}

function samplePositionAtTime(sim: LabSimulationResult, time: number): THREE.Vector3 {
  const { samples } = sim;
  if (samples.length === 0) return sim.firstBounce.clone();
  if (time <= 0) return samples[0].pos.clone();
  const last = samples[samples.length - 1];
  if (time >= last.time) return last.pos.clone();

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = Math.max(0.0001, b.time - a.time);
      const frac = (time - a.time) / span;
      return a.pos.clone().lerp(b.pos, frac);
    }
  }
  return last.pos.clone();
}

function TrajectoryLabScene({
  lab,
  controlsRef,
}: {
  lab: TrajectoryLabConfig;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const ballMeshRef = useRef<THREE.Mesh>(null);
  const shadowMeshRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef<number>(0);
  const finishedFiredRef = useRef<boolean>(false);

  const camTargetPos = useRef(new THREE.Vector3(0, 10.5, 20.5));
  const camTargetLook = useRef(new THREE.Vector3(0, 0.6, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0.6, 0));
  const needsResetCamRef = useRef<boolean>(true);

  const { simulation } = lab;
  const isAttack = lab.mode === "attack";
  const backWallRingZ = isAttack ? -9.88 : 9.88;

  // Bei neuem Replay, Moduswechsel oder neuem Setup Timer sauber zurücksetzen
  useEffect(() => {
    elapsedRef.current = 0;
    finishedFiredRef.current = false;
    needsResetCamRef.current = true;
  }, [lab.replayKey, lab.isPlaying, lab.mode, simulation]);

  // 3D-Tube-Geometrien mit sicherem WebGL-Cleanup
  const tubeGeometries = useMemo(() => {
    return simulation.segments
      .map((seg) => ({
        kind: seg.kind,
        geo: buildTubeGeometry(
          seg.points,
          seg.kind === "por_exit"
            ? 0.058
            : seg.kind === "after_glass"
            ? 0.048
            : 0.036
        ),
      }))
      .filter(
        (entry): entry is { kind: TrajectorySegment["kind"]; geo: THREE.TubeGeometry } =>
          Boolean(entry.geo)
      );
  }, [simulation]);

  useEffect(() => {
    return () => {
      tubeGeometries.forEach((entry) => entry.geo.dispose());
    };
  }, [tubeGeometries]);

  const sweetspotDropGeo = useMemo(() => {
    const pts = [
      new THREE.Vector3(simulation.sweetspot.x, 0.04, simulation.sweetspot.z),
      simulation.sweetspot.clone(),
    ];
    return buildTubeGeometry(pts, 0.018);
  }, [simulation.sweetspot]);

  useEffect(() => {
    return () => {
      sweetspotDropGeo?.dispose();
    };
  }, [sweetspotDropGeo]);

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.08);
    const startSamplePos =
      simulation.samples[0]?.pos ||
      new THREE.Vector3(
        isAttack ? lab.playerPos.x : lab.oppPos?.x ?? 0,
        1.5,
        isAttack ? lab.playerPos.z : lab.oppPos?.z ?? -3
      );

    // 1. Ball-Position aktualisieren
    if (lab.isPlaying) {
      elapsedRef.current += safeDelta * lab.playbackSpeed;
      const curPos = samplePositionAtTime(simulation, elapsedRef.current);

      if (ballMeshRef.current) {
        ballMeshRef.current.position.copy(curPos);
        ballMeshRef.current.rotation.x += safeDelta * 14 * lab.playbackSpeed;
      }
      if (shadowMeshRef.current) {
        shadowMeshRef.current.position.set(curPos.x, 0.035, curPos.z);
        const s = Math.max(0.35, 1.15 - curPos.y * 0.14);
        shadowMeshRef.current.scale.set(s, s, 1);
      }

      if (elapsedRef.current >= simulation.totalDuration && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        if (lab.onFinished) lab.onFinished();
      }
    } else if (lab.hasFinished) {
      // Nach Ende ruht der Ball am Auslauf (Por 3/4) bzw. am Sweetspot
      const restPos = simulation.exitedCourt
        ? simulation.samples[simulation.samples.length - 1]?.pos || simulation.sweetspot
        : simulation.sweetspot;
      if (ballMeshRef.current) {
        ballMeshRef.current.position.copy(restPos);
      }
      if (shadowMeshRef.current) {
        shadowMeshRef.current.position.set(restPos.x, 0.035, restPos.z);
        shadowMeshRef.current.scale.set(0.9, 0.9, 1);
      }
    } else {
      // Planungsphase: Ball beim Schläger
      if (ballMeshRef.current) {
        ballMeshRef.current.position.copy(startSamplePos);
      }
      if (shadowMeshRef.current) {
        shadowMeshRef.current.position.set(startSamplePos.x, 0.035, startSamplePos.z);
        shadowMeshRef.current.scale.set(0.9, 0.9, 1);
      }
    }

    // 2. Kamera-Steuerung: Während des Flugs filmisch folgen, danach frei per OrbitControls
    if (lab.isPlaying) {
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }

      const curBall = samplePositionAtTime(simulation, elapsedRef.current);
      const cornerSide = simulation.firstBounce.x >= 0 ? 1 : -1;

      if (isAttack) {
        // Angriffskamera: Folgt dem Schlag in Richtung gegnerische Rückscheibe / Por-3-Seitenwand
        const camX = lab.playerPos.x * 0.35 - cornerSide * 1.4;
        const camY = simulation.exitedCourt ? 7.4 : 6.0;
        const camZ = simulation.exitedCourt ? 7.5 : 8.5;
        camTargetPos.current.set(camX, camY, camZ);
        camTargetLook.current.set(
          curBall.x * 0.6 + simulation.firstBounce.x * 0.4,
          Math.max(0.7, curBall.y * 0.72),
          Math.min(-1.0, curBall.z * 0.65 + simulation.firstBounce.z * 0.35)
        );
      } else {
        // Verteidigungskamera: Fokussiert auf die eigene Glasscheiben-Ecke
        camTargetPos.current.set(cornerSide * 2.2, 6.2, 16.8);
        camTargetLook.current.set(
          curBall.x * 0.45 + simulation.firstBounce.x * 0.55,
          Math.max(0.6, curBall.y * 0.6),
          Math.max(2.0, curBall.z * 0.5 + 3.5)
        );
      }

      camera.position.lerp(camTargetPos.current, 4.5 * safeDelta);
      currentLook.current.lerp(camTargetLook.current, 6.5 * safeDelta);
      camera.lookAt(currentLook.current);
      needsResetCamRef.current = false;
    } else if (controlsRef.current) {
      controlsRef.current.enabled = true;
      if (needsResetCamRef.current && !lab.hasFinished) {
        if (isAttack) {
          camTargetPos.current.set(0, 12.0, 22.0);
          camTargetLook.current.set(0, 0.2, -2.5);
        } else {
          camTargetPos.current.set(0, 10.5, 20.5);
          camTargetLook.current.set(0, 0.4, 3.5);
        }
        camera.position.lerp(camTargetPos.current, 5.0 * safeDelta);
        currentLook.current.lerp(camTargetLook.current, 5.0 * safeDelta);
        controlsRef.current.target.copy(currentLook.current);
        controlsRef.current.update();
        if (camera.position.distanceTo(camTargetPos.current) < 0.25) {
          needsResetCamRef.current = false;
        }
      }
    }
  });

  const showTrajectory = lab.isPlaying || lab.hasFinished || lab.showPreviewGuide;
  const showSolutionOverlays = lab.hasFinished || lab.showPreviewGuide;

  return (
    <group>
      {/* 1. Animierter 3D-Padelball + Bodenschatten */}
      <mesh ref={ballMeshRef} position={[lab.playerPos.x, 1.5, lab.playerPos.z]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial
          color="#d9f99d"
          emissive="#a3e635"
          emissiveIntensity={0.65}
          roughness={0.35}
        />
      </mesh>
      <mesh
        ref={shadowMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[lab.playerPos.x, 0.035, lab.playerPos.z]}
      >
        <circleGeometry args={[0.18, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} />
      </mesh>

      {/* 2. Aufprall-Marker am Boden (1. Kontakt) */}
      <group position={[simulation.firstBounce.x, 0.04, simulation.firstBounce.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.36, 32]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 24]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 3. Spieler-Standring (Rot) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[lab.playerPos.x, 0.038, lab.playerPos.z]}
      >
        <ringGeometry args={[0.42, 0.56, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* 4. Farbcodierte 3D-Flugspuren (Gelb -> Lila -> Cyan -> Orange bei Por 3/4) */}
      {showTrajectory &&
        tubeGeometries.map((entry, idx) => {
          const color =
            entry.kind === "approach"
              ? "#facc15"
              : entry.kind === "to_glass"
              ? "#c084fc"
              : entry.kind === "por_exit"
              ? "#f97316"
              : "#22d3ee";
          return (
            <mesh key={`${entry.kind}-${idx}`} geometry={entry.geo}>
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={entry.kind === "por_exit" ? 0.95 : 0.65}
                transparent
                opacity={lab.hasFinished || lab.isPlaying ? 0.94 : 0.45}
              />
            </mesh>
          );
        })}

      {/* 5. Leuchtende Aufprallringe direkt auf Rück- & Seitenscheibe */}
      {showTrajectory &&
        simulation.glassHits.map((hit, idx) => {
          const isBack = hit.wall === "back";
          const pos: [number, number, number] = isBack
            ? [hit.point.x, hit.point.y, backWallRingZ]
            : [hit.wall === "side_right" ? 4.88 : -4.88, hit.point.y, hit.point.z];
          const rot: [number, number, number] = isBack ? [0, 0, 0] : [0, Math.PI / 2, 0];
          const ringColor = hit.isMesh ? "#f97316" : idx === 0 ? "#c084fc" : "#22d3ee";

          return (
            <group key={`glass-hit-${idx}`} position={pos} rotation={rot}>
              <mesh>
                <ringGeometry args={[0.22, 0.36, 32]} />
                <meshBasicMaterial color={ringColor} transparent opacity={0.95} side={THREE.DoubleSide} />
              </mesh>
              <mesh>
                <circleGeometry args={[0.11, 24]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        })}

      {/* 6. POR-3 / POR-4 EXIT-PORTAL-RING (wenn Ball über die 3m-/4m-Wand fliegt) */}
      {showTrajectory && simulation.exitPoint && simulation.exitedCourt && (
        <group
          position={[simulation.exitPoint.x, simulation.exitPoint.y, simulation.exitPoint.z]}
          rotation={simulation.exitedCourt === "por_3" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
        >
          <mesh>
            <ringGeometry args={[0.35, 0.56, 36]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.95} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.2, 24]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* 7. Sweetspot & Standzone (Verteidigung: grün für Dich | Angriff: Rebound-Höhe beim Gegner) */}
      {showSolutionOverlays && !simulation.exitedCourt && (
        <group>
          <mesh position={simulation.sweetspot}>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshStandardMaterial
              color={isAttack ? "#f59e0b" : "#34d399"}
              emissive={isAttack ? "#d97706" : "#10b981"}
              emissiveIntensity={0.85}
              transparent
              opacity={0.78}
            />
          </mesh>

          {sweetspotDropGeo && (
            <mesh geometry={sweetspotDropGeo}>
              <meshBasicMaterial
                color={isAttack ? "#f59e0b" : "#34d399"}
                transparent
                opacity={0.6}
              />
            </mesh>
          )}

          {!isAttack && (
            <group position={[simulation.optimalStandPos.x, 0.042, simulation.optimalStandPos.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.58, 0.78, 36]} />
                <meshBasicMaterial color="#10b981" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.58, 36]} />
                <meshBasicMaterial color="#10b981" transparent opacity={0.22} side={THREE.DoubleSide} />
              </mesh>
            </group>
          )}
        </group>
      )}
    </group>
  );
}

// =========================================================
// PROPS DEFINITION
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
    you?: { x: number; z: number };
    target?: { x: number; z: number };
  };
  trajectoryLab?: TrajectoryLabConfig;
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
// HAUPTKOMPONENTE (ScenarioCourt4D)
// =========================================================
export default function ScenarioCourt4D(props: Props) {
  const { t } = useTranslation();

  const [playerName, setPlayerName] = useState(() => t("guest_name"));
  const controlsRef = useRef<any>(null);
  const [ecoMode, setEcoMode] = useState<boolean>(() => isEcoModeEnabled());

  const isLabActive = Boolean(props.trajectoryLab?.active);

  useEffect(() => {
    if (props.onIntroFinished) {
      props.onIntroFinished();
    }
  }, []);

  useEffect(() => {
    const fetchName = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setPlayerName(t("guest_name"));
          return;
        }

        let name =
          user?.user_metadata?.display_name ||
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          t("guest_name");

        const { data: profileData } = await supabase
          .from("user_stats")
          .select("display_name")
          .eq("id", user.id)
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
  }, [t]);

  const controlsEnabled = isLabActive
    ? !props.trajectoryLab?.isPlaying
    : !props.hasSubmitted && !props.isPreparingShot;

  return (
    <div className="relative w-full h-full bg-[#060913] overflow-hidden select-none">
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto min-h-[250px]">
        <Canvas
          dpr={ecoMode ? 1.0 : [1, 1.5]}
          camera={{ position: [0, 12.0, 22.0], fov: 45 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              "webglcontextlost",
              (e) => {
                e.preventDefault();
                setEcoMode(true);
              },
              false
            );
          }}
          className="w-full h-full cursor-crosshair"
        >
          <color attach="background" args={["#010205"]} />

          {!props.gameOver && (
            <OrbitControls
              ref={controlsRef}
              enabled={controlsEnabled}
              enablePan={true}
              enableZoom={true}
              enableDamping={true}
              dampingFactor={0.05}
              minDistance={6}
              maxDistance={28}
              screenSpacePanning={false}
              maxPolarAngle={Math.PI / 2.12}
              minPolarAngle={0.1}
              minAzimuthAngle={-Math.PI}
              maxAzimuthAngle={Math.PI}
              target={[0, -0.3, isLabActive && props.trajectoryLab?.mode === "defense" ? 4.5 : -2.5]}
            />
          )}

          <ambientLight intensity={0.1} color="#080d1e" />
          <directionalLight position={[0, 20, -10]} intensity={1.2} color="#ffffff" castShadow={false} />
          <Environment preset="city" environmentIntensity={0.5} />

          <Suspense
            fallback={
              <Html center className="text-white font-bold tracking-widest uppercase">
                {t("court_loading_arena")}
              </Html>
            }
          >
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

            {isLabActive && props.trajectoryLab ? (
              <>
                <TacticalData
                  {...props}
                  hasSubmitted={false}
                  isCinematicMode={true}
                  hidePlayerLabels={true}
                  positions={{
                    you: `EXACT_${props.trajectoryLab.playerPos.x}_${props.trajectoryLab.playerPos.z}`,
                    partner: "EXACT_1000_1000",
                    opp1:
                      props.trajectoryLab.mode === "defense" && props.trajectoryLab.oppPos
                        ? `EXACT_${props.trajectoryLab.oppPos.x}_${props.trajectoryLab.oppPos.z}`
                        : "EXACT_1000_1000",
                    opp2: "EXACT_1000_1000",
                    ball: { side: "right", zone: "EXACT_1000_1000", type: "DRIVE" },
                  }}
                  selectedZone={null}
                />
                <TrajectoryLabScene lab={props.trajectoryLab} controlsRef={controlsRef} />
              </>
            ) : (
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
                selectedZone={
                  props.exactCoords?.target
                    ? `EXACT_${props.exactCoords.target.x}_${props.exactCoords.target.z}`
                    : props.selectedZone
                }
              />
            )}
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

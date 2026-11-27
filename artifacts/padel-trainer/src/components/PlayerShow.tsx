import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, PerformanceMonitor, AdaptiveDpr, Environment, useGLTF } from '@react-three/drei';
import {
  PLAYER_SKINS,
  ShopItem,
  resolveSkinItem,
} from '../lib/loadout';
import { useTranslation } from '../lib/i18n';
import AnimatedPadelPlayer, {
  mapShotTypeToPlayerAction,
  type PlayerAction,
} from './AnimatedPadelPlayer';

const TROPHY_MODEL_URLS = {
  gold: '/trophy_gold.glb',
  silver: '/trophy_silver.glb',
  bronze: '/trophy_bronze.glb',
} as const;

type TrophyTier = keyof typeof TROPHY_MODEL_URLS;

const getTrophyTier = (tourId: string): TrophyTier => {
  const idLower = tourId.toLowerCase();
  if (idLower.includes('master') || idLower.includes('major') || idLower.includes('gold')) {
    return 'gold';
  }
  if (idLower.includes('pro') || idLower.includes('silver')) {
    return 'silver';
  }
  return 'bronze';
};

// =========================================================
// FALLBACK-FIGUR (falls ein Skin-GLB einmal fehlt)
// =========================================================
function LegacyPlayerFallback() {
  const { scene } = useGLTF('/PlayerShow.glb');
  return <primitive object={scene} scale={1.25} position={[0, -1.2, 0]} />;
}

// =========================================================
// ERROR BOUNDARY: Fängt fehlendes/defektes 3D-Modell ab
// =========================================================
interface ShowroomModelBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
  onError?: (errorMessage: string) => void;
}

class ShowroomModelBoundary extends React.Component<
  ShowroomModelBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: ShowroomModelBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('3D-Modell im Showroom konnte nicht geladen werden:', error);
    if (this.props.onError) {
      this.props.onError(error?.message || 'Unbekannter Ladefehler');
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// =========================================================
// KAMERA-WECHSLER (Kleiderschrank vs. Trophäen-Vitrine)
// =========================================================
function CameraSwitcher({
  mode,
  controlsRef,
}: {
  mode: 'locker' | 'trophies';
  controlsRef: React.MutableRefObject<any>;
}) {
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

// =========================================================
// 3D TROPHÄEN (GLB + HOLOGRAMM-FALLBACK)
// =========================================================
function ProceduralTronTrophy({ tier, lowQuality }: { tier: TrophyTier; lowQuality?: boolean }) {
  const color = tier === 'gold' ? '#fbbf24' : tier === 'silver' ? '#bae6fd' : '#d97706';
  const intensity = tier === 'gold' ? 3 : 2.5;
  const tubeSteps = lowQuality ? 32 : 64;

  const { curve1, curve2 } = useMemo(() => {
    const spiralSegments = 60;
    const pts1 = [];
    const pts2 = [];

    for (let i = 0; i <= spiralSegments; i++) {
      const t = i / spiralSegments;
      const radius = 0.15 + t * 0.4;
      const y = 0.3 + t * 1.0;

      const angle1 = t * Math.PI * 4;
      pts1.push(new THREE.Vector3(Math.cos(angle1) * radius, y, Math.sin(angle1) * radius));

      const angle2 = t * Math.PI * 4 + Math.PI;
      pts2.push(new THREE.Vector3(Math.cos(angle2) * radius, y, Math.sin(angle2) * radius));
    }

    return {
      curve1: new THREE.CatmullRomCurve3(pts1),
      curve2: new THREE.CatmullRomCurve3(pts2),
    };
  }, []);

  return (
    <group scale={0.8}>
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
  );
}

function GlbTrophyModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, false);

  const normalizedGroup = useMemo(() => {
    const wrapper = new THREE.Group();
    const clone = scene.clone(true);
    wrapper.add(clone);
    wrapper.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Mittig auf dem Regalboden (y = 0) absetzen & sauber ins Fach einpassen
    clone.position.x -= center.x;
    clone.position.y -= box.min.y;
    clone.position.z -= center.z;

    const targetHeight = 1.65;
    const maxWidth = 1.25;
    const scaleY = size.y > 0.0001 ? targetHeight / size.y : 1;
    const maxXZ = Math.max(size.x, size.z);
    const scaleXZ = maxXZ > 0.0001 ? maxWidth / maxXZ : 1;
    wrapper.scale.setScalar(Math.min(scaleY, scaleXZ));

    return wrapper;
  }, [scene]);

  return <primitive object={normalizedGroup} />;
}

function TronTrophy({
  position,
  tourId,
  onClick,
  lowQuality,
}: {
  position: [number, number, number];
  tourId: string;
  onClick: (id: string) => void;
  lowQuality?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const tier = getTrophyTier(tourId);
  const modelUrl = TROPHY_MODEL_URLS[tier];
  const ringColor = tier === 'gold' ? '#fbbf24' : tier === 'silver' ? '#bae6fd' : '#d97706';

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * 0.4;
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(tourId);
      }}
    >
      {/* Unsichtbare Klick-Hitbox */}
      <mesh visible={false} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.9, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Dezenter Leuchtsockel passend zu Gold / Silber / Bronze */}
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.52, 0.56, 0.03, 24]} />
        <meshStandardMaterial
          color="#020617"
          emissive={ringColor}
          emissiveIntensity={0.8}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      <group ref={ref} position={[0, 0.03, 0]}>
        <ShowroomModelBoundary
          key={modelUrl}
          fallback={<ProceduralTronTrophy tier={tier} lowQuality={lowQuality} />}
        >
          <React.Suspense fallback={<ProceduralTronTrophy tier={tier} lowQuality={lowQuality} />}>
            <GlbTrophyModel url={modelUrl} />
          </React.Suspense>
        </ShowroomModelBoundary>
      </group>
    </group>
  );
}

function TronCabinet({
  trophies,
  onTrophyClick,
  lowQuality,
}: {
  trophies: string[];
  onTrophyClick: (id: string) => void;
  lowQuality?: boolean;
}) {
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

// =========================================================
// HAUPTKOMPONENTE: 3D KLEIDERSCHRANK & TROPHÄEN-VITRINE
// =========================================================
export interface ShotPreviewSignal {
  shot: ShopItem;
  trigger: number;
}

export interface PlayerShowProps {
  playerSkinId: string;
  onSelectSkin: (skinId: string) => void;
  racketId: string;
  selectedRacketName: string;
  selectedShot: ShopItem;
  shotPreviewSignal?: ShotPreviewSignal | null;
  wonTrophies: string[];
  currentScore: number;
  lowPerfMode: boolean;
  dpr: number;
  onPerformanceDecline: (nextDpr: number) => void;
  onPerformanceIncline: (nextDpr: number) => void;
  onContextLost: () => void;
}

export default function PlayerShow({
  playerSkinId,
  onSelectSkin,
  racketId,
  selectedRacketName,
  selectedShot,
  shotPreviewSignal,
  wonTrophies,
  currentScore,
  lowPerfMode,
  dpr,
  onPerformanceDecline,
  onPerformanceIncline,
  onContextLost,
}: PlayerShowProps) {
  const { lang, t } = useTranslation();

  const [active3DView, setActive3DView] = useState<'locker' | 'trophies'>('locker');
  const [lockerAction, setLockerAction] = useState<PlayerAction>('idle');
  const [lockerAnimTrigger, setLockerAnimTrigger] = useState<number>(0);
  const [activeShotBadge, setActiveShotBadge] = useState<string | null>(null);
  const [lockerAutoRotate, setLockerAutoRotate] = useState<boolean>(true);
  const [showLockerRacket, setShowLockerRacket] = useState<boolean>(true);
  const [lockerModelError, setLockerModelError] = useState<string | null>(null);
  const [activeTrophyBanner, setActiveTrophyBanner] = useState<string | null>(null);

  const controlsRef = useRef<any>(null);
  const selectedSkinObj = useMemo(() => resolveSkinItem(playerSkinId), [playerSkinId]);
  const isPlayingShot = lockerAction !== 'idle' && lockerAction !== 'a_pose';

  const triggerShotPreview = useCallback((shotItem: ShopItem) => {
    const mappedAction = mapShotTypeToPlayerAction(shotItem.shotType || 'FOREHAND');
    setActive3DView('locker');
    setShowLockerRacket(true);
    setActiveShotBadge(shotItem.name);
    setLockerAction(mappedAction);
    setLockerAnimTrigger((k) => k + 1);
  }, []);

  // Löst die Schlag-Animation automatisch aus, sobald unten ein Spezialschlag gewechselt/aufgelevelt wird
  useEffect(() => {
    if (shotPreviewSignal && shotPreviewSignal.trigger > 0) {
      triggerShotPreview(shotPreviewSignal.shot);
    }
  }, [shotPreviewSignal, triggerShotPreview]);

  // Alle Kleiderschrank-Skins vorladen
  useEffect(() => {
    PLAYER_SKINS.forEach((skin) => {
      useGLTF.preload(skin.modelUrl, false, false);
    });
  }, []);

  useEffect(() => {
    setLockerModelError(null);
  }, [playerSkinId]);

  // Trophäen-GLBs erst laden, wenn der Trophäen-Tab geöffnet wird
  useEffect(() => {
    if (active3DView === 'trophies') {
      useGLTF.preload(TROPHY_MODEL_URLS.gold, false, false);
      useGLTF.preload(TROPHY_MODEL_URLS.silver, false, false);
      useGLTF.preload(TROPHY_MODEL_URLS.bronze, false, false);
    }
  }, [active3DView]);

  const formatTourName = (id: string) => id.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="w-full bg-[#050b14] border border-slate-800 rounded-2xl p-5 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col gap-4">

      {/* TAB-UMSCHALTER: KLEIDERSCHRANK VS. TROPHÄEN */}
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
            {lang === 'en' ? 'Wardrobe' : lang === 'es' ? 'Vestuario' : 'Kleiderschrank'}
          </button>
          <button
            onClick={() => setActive3DView('trophies')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
              active3DView === 'trophies'
                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{t('prof_tab_trophies')}</span>
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-black/40 text-purple-200">
              {wonTrophies.length} {t('prof_titles_count')}
            </span>
          </button>
        </div>

        <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/30 rounded border border-cyan-900/50">
          {lowPerfMode ? t('prof_3d_eco') : t('prof_3d_view')}
        </span>
      </div>

      {/* TOUR RANKING FORTSCHRITTSBALKEN */}
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
      <div
        className={`w-full ${
          active3DView === 'trophies'
            ? 'h-[380px] border-cyan-900/50 shadow-[inset_0_0_30px_rgba(6,182,212,0.15)]'
            : 'h-64 sm:h-72 border-slate-800/80 shadow-inner'
        } bg-[#020408] rounded-xl border overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300`}
      >
        {active3DView === 'locker' && !lowPerfMode && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/40 blur-[40px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-orange-500/40 blur-[40px] pointer-events-none" />
          </>
        )}

        {/* Kleiderschrank Info-Overlays */}
        {active3DView === 'locker' && (
          <>
            <div className="pointer-events-none absolute top-2.5 left-3 z-10 flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wider text-white bg-slate-950/75 border border-slate-700/80 px-2 py-0.5 rounded-md backdrop-blur-sm">
                {selectedSkinObj.name}
              </span>
              <span className="text-[8px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-1.5 py-0.5 rounded-md">
                {selectedRacketName}
              </span>
            </div>

            <AnimatePresence>
              {isPlayingShot && activeShotBadge && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="pointer-events-none absolute top-2.5 right-3 z-10"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/85 border border-amber-500/50 px-2.5 py-1 rounded-md shadow-[0_0_12px_rgba(245,158,11,0.35)]">
                    ⚡ {activeShotBadge}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {active3DView === 'trophies' && (
          <div className="absolute top-3 left-4 z-10 pointer-events-none">
            <span className="text-[8px] text-cyan-400 uppercase tracking-widest font-black block drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">
              {t('prof_vault_title')}
            </span>
          </div>
        )}

        {active3DView === 'trophies' && wonTrophies.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              {t('prof_vault_empty')}
            </span>
          </div>
        )}

        <Canvas
          dpr={dpr}
          camera={{ position: [0, 1.2, 4], fov: 45 }}
          gl={{
            antialias: !lowPerfMode,
            powerPreference: 'high-performance',
            precision: lowPerfMode ? 'mediump' : 'highp',
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              'webglcontextlost',
              (e) => {
                e.preventDefault();
                onContextLost();
              },
              false
            );
          }}
        >
          <PerformanceMonitor
            onDecline={() => onPerformanceDecline(0.75)}
            onFallback={() => onPerformanceDecline(0.65)}
            onIncline={() => onPerformanceIncline(1.5)}
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
              <ShowroomModelBoundary
                key={selectedSkinObj.id}
                fallback={
                  <React.Suspense fallback={null}>
                    <LegacyPlayerFallback />
                  </React.Suspense>
                }
                onError={(errMsg) => setLockerModelError(errMsg)}
              >
                <React.Suspense fallback={null}>
                  <AnimatedPadelPlayer
                    modelUrl={selectedSkinObj.modelUrl}
                    racketId={racketId}
                    action={lockerAction}
                    triggerKey={lockerAnimTrigger}
                    speed={isPlayingShot ? 1.25 : 1}
                    showRacket={showLockerRacket}
                    onActionFinished={() => {
                      setLockerAction((curr) => (curr === 'idle' || curr === 'a_pose' ? curr : 'idle'));
                      setActiveShotBadge(null);
                    }}
                  />
                </React.Suspense>
              </ShowroomModelBoundary>
              <OrbitControls
                ref={controlsRef}
                enableZoom={true}
                minDistance={2.2}
                maxDistance={5.5}
                enablePan={false}
                autoRotate={lockerAutoRotate && !isPlayingShot}
                autoRotateSpeed={0.8}
                minPolarAngle={Math.PI / 3}
                maxPolarAngle={Math.PI / 1.9}
              />
            </>
          ) : (
            <>
              <ambientLight intensity={lowPerfMode ? 1.5 : 0.9} />
              <directionalLight position={[4, 8, 8]} intensity={2.2} color="#ffffff" />
              <directionalLight position={[-5, 4, 4]} intensity={1.1} color="#bae6fd" />
              <pointLight position={[0, 4, 3]} intensity={2.5} color="#0ea5e9" />
              {!lowPerfMode && (
                <React.Suspense fallback={null}>
                  <Environment preset="city" environmentIntensity={0.75} />
                </React.Suspense>
              )}
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

        {/* TROPHÄEN-BANNER OVERLAY */}
        <AnimatePresence>
          {active3DView === 'trophies' && activeTrophyBanner && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              onClick={() => setActiveTrophyBanner(null)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 border border-cyan-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer z-20 flex flex-col items-center text-center"
            >
              <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-1">
                {t('prof_winner')}
              </span>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                {formatTourName(activeTrophyBanner)}
              </h4>
              <span className="text-[8px] text-slate-400 mt-2">{t('prof_click_close')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* KLEIDERSCHRANK: SKIN-AUSWAHL & ANIMATIONS-STEUERUNG */}
      {active3DView === 'locker' && (
        <div className="flex flex-col gap-2.5">
          {lockerModelError && (
            <div className="px-3 py-2 rounded-lg bg-amber-950/50 border border-amber-500/50 text-amber-300 text-[10px] font-bold leading-snug">
              Hinweis: Standard-Figur aktiv - <code className="text-white">{selectedSkinObj.modelUrl}</code> konnte nicht geladen werden ({lockerModelError}).
            </div>
          )}

          {/* SKIN-AUSWAHL */}
          <div className="bg-[#030611]/95 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">
                {lang === 'en' ? 'Player Skins' : lang === 'es' ? 'Skins de Jugador' : 'Spieler-Skins'}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                {PLAYER_SKINS.length} {lang === 'en' ? 'Available' : lang === 'es' ? 'Disponibles' : 'Verfügbar'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLAYER_SKINS.map((skin) => {
                const isActiveSkin = selectedSkinObj.id === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => onSelectSkin(skin.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                      isActiveSkin
                        ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                        : 'bg-[#060c1a] border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-slate-950"
                      style={{ backgroundColor: skin.accentColor }}
                    >
                      {skin.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black leading-tight truncate">{skin.name}</div>
                      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate">
                        {isActiveSkin
                          ? lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : 'Aktiv'
                          : skin.badge}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Platzhalter-Slot für künftige Skins */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-800/90 bg-[#040812]/60 text-slate-500 select-none">
                <span className="w-6 h-6 rounded-full shrink-0 border border-dashed border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-600">
                  +
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-wider truncate">
                    {lang === 'en' ? 'More Skins' : lang === 'es' ? 'Más Skins' : 'Weitere Skins'}
                  </div>
                  <div className="text-[8px] font-bold text-slate-600 truncate">
                    {lang === 'en' ? 'Coming soon' : lang === 'es' ? 'Próximamente' : 'Demnächst'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* POSEN-, SPEZIALSCHLAG- & ANSICHTS-STEUERUNG */}
          <div className="bg-[#030611]/95 border border-slate-800 rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  setLockerAction('idle');
                  setActiveShotBadge(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  lockerAction === 'idle'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'en' ? 'Ready Stance' : lang === 'es' ? 'Posición base' : 'Grundstellung'}
              </button>
              <button
                onClick={() => {
                  setLockerAction('a_pose');
                  setActiveShotBadge(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  lockerAction === 'a_pose'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                A-Pose
              </button>
              <button
                onClick={() => triggerShotPreview(selectedShot)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  isPlayingShot
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-amber-300 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                    : 'bg-orange-950/40 border-orange-500/40 text-orange-300 hover:bg-orange-900/50'
                }`}
              >
                ▶ {lang === 'en' ? 'Test Shot' : lang === 'es' ? 'Probar Golpe' : 'Schlag testen'}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowLockerRacket((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  showLockerRacket
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {lang === 'en' ? 'Racket' : lang === 'es' ? 'Pala' : 'Schläger'}
              </button>
              <button
                onClick={() => setLockerAutoRotate((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  lockerAutoRotate
                    ? 'bg-purple-500/25 border-purple-400 text-purple-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {lang === 'en' ? 'Rotate' : lang === 'es' ? 'Girar' : 'Drehen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

export type PlayerAction =
  | "a_pose"
  | "idle"
  | "walk"
  | "forehand"
  | "backhand"
  | "volley"
  | "bandeja"
  | "smash"
  | "lob";

type ShotAction = Exclude<PlayerAction, "a_pose" | "idle" | "walk">;
type DegVec3 = [number, number, number];
type BoneRotationMap = Record<string, DegVec3 | undefined>;
type RacketLoadPromise = Promise<THREE.Group>;

export const DEFAULT_RACKET_URL = "/racket_classic.glb";

// Zuordnung Shop-ID -> eigene 3D-Schlägerdatei in /public.
// Sobald du weitere Schläger exportierst, einfach hier 1 Zeile ergänzen:
export const RACKET_MODEL_MAP: Record<string, string> = {
  racket_starter: "/racket_classic.glb",
  // racket_control: "/racket_control.glb",
  // racket_power: "/racket_power.glb",
  // racket_pro: "/racket_pro.glb",
};

export function resolveRacketModelUrl(racketId?: string | null, customUrl?: string): string {
  if (customUrl) return customUrl;
  if (racketId && RACKET_MODEL_MAP[racketId]) {
    return RACKET_MODEL_MAP[racketId];
  }
  return DEFAULT_RACKET_URL;
}

const gltfRacketLoader = new GLTFLoader();
const glbRacketCache = new Map<string, RacketLoadPromise>();

function loadCachedRacketGlb(url: string): RacketLoadPromise {
  const existing = glbRacketCache.get(url);
  if (existing) return existing;

  const promise: RacketLoadPromise = new Promise((resolve, reject) => {
    gltfRacketLoader.load(
      url,
      (gltf) => {
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        glbRacketCache.delete(url);
        reject(err);
      }
    );
  });

  glbRacketCache.set(url, promise);
  return promise;
}

interface BonePoseSpec {
  hipsY?: number;
  bones: BoneRotationMap;
}

interface ShotKeyframe {
  at: number;
  pose: BonePoseSpec;
}

interface ShotAnimationDef {
  duration: number;
  frames: ShotKeyframe[];
}

// --- GRUNDSTELLUNG (ECHTER CONTINENTAL-GRIFF: SCHLÄGERKANTE HOCHKANT NACH VORNE) ---
const IDLE_POSE: BonePoseSpec = {
  hipsY: -0.07,
  bones: {
    Hips: [6, 0, 0],
    Spine: [10, 0, 0],
    Spine1: [6, 0, 0],
    Spine2: [2, 0, 0],
    Neck: [-6, 0, 0],
    Head: [-6, 0, 0],
    LeftUpLeg: [-22, 0, 6],
    LeftLeg: [38, 0, 0],
    LeftFoot: [-14, 0, 0],
    RightUpLeg: [-22, 0, -6],
    RightLeg: [38, 0, 0],
    RightFoot: [-14, 0, 0],
    RightArm: [-41, 49, 0],
    RightForeArm: [12, 52, -40],
    RightHand: [18, 0, 4],
    LeftArm: [-48, -50, -6],
    LeftForeArm: [6, -54, 48],
    LeftHand: [14, 0, -6],
  },
};

// --- ALLE PADEL-SCHLÄGE IM CHARAKTERRAUM ---
export const SHOT_ANIMATIONS: Record<ShotAction, ShotAnimationDef> = {
  forehand: {
    duration: 1.05,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.34,
        pose: {
          hipsY: -0.1,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -36, 0],
            Spine: [10, -24, 0],
            Spine1: [6, -16, 0],
            Head: [-6, 44, 0],
            RightArm: [24, -10, -24],
            RightForeArm: [-42, 62, 0],
            RightHand: [0, 0, -10],
            LeftArm: [-44, -32, -16],
            LeftForeArm: [-72, -55, 0],
          },
        },
      },
      {
        at: 0.58,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, 12, 0],
            Spine: [8, 16, 0],
            Spine1: [4, 12, 0],
            Head: [-4, -22, 0],
            RightArm: [-56, 26, -16],
            RightForeArm: [-24, 58, -18],
            RightHand: [10, 0, 0],
            LeftArm: [-12, 15, 10],
            LeftForeArm: [-95, -50, 0],
          },
        },
      },
      {
        at: 0.8,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, 34, 0],
            Spine: [4, 24, 0],
            Spine1: [2, 16, 0],
            Head: [-4, -40, 0],
            RightArm: [-88, 44, 32],
            RightForeArm: [-94, 78, 14],
            RightHand: [0, 0, 8],
            LeftArm: [14, 22, 8],
            LeftForeArm: [-95, -40, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  backhand: {
    duration: 1.05,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.34,
        pose: {
          hipsY: -0.1,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 36, 0],
            Spine: [10, 24, 0],
            Spine1: [6, 18, 0],
            Head: [-6, -42, 0],
            RightArm: [-46, 42, 26],
            RightForeArm: [-62, 68, -12],
            RightHand: [12, 0, 10],
            LeftArm: [-42, -26, -18],
            LeftForeArm: [-86, -65, 16],
          },
        },
      },
      {
        at: 0.58,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -8, 0],
            Spine: [8, -10, 0],
            Spine1: [4, -8, 0],
            Head: [-4, 14, 0],
            RightArm: [-58, -10, -24],
            RightForeArm: [-28, 70, 0],
            RightHand: [0, 0, -6],
            LeftArm: [24, -10, 12],
            LeftForeArm: [-42, -40, 0],
          },
        },
      },
      {
        at: 0.8,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -26, 0],
            Spine: [4, -18, 0],
            Spine1: [2, -14, 0],
            Head: [-4, 30, 0],
            RightArm: [-42, -34, -48],
            RightForeArm: [-22, 62, 0],
            LeftArm: [32, -16, 18],
            LeftForeArm: [-35, -40, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  volley: {
    duration: 0.72,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.28,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -18, 0],
            Spine: [10, -12, 0],
            Spine1: [6, -8, 0],
            Head: [-6, 20, 0],
            RightArm: [-32, 24, -22],
            RightForeArm: [-48, 64, -26],
            RightHand: [10, 0, -8],
            LeftArm: [-38, -32, -14],
            LeftForeArm: [-40, -56, 36],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, 12, 0],
            Spine: [12, 10, 0],
            Spine1: [6, 8, 0],
            LeftUpLeg: [-30, 0, 6],
            LeftLeg: [46, 0, 0],
            RightArm: [-60, 28, -8],
            RightForeArm: [-28, 60, -20],
            RightHand: [12, 0, -4],
            LeftArm: [-12, 8, 6],
            LeftForeArm: [-92, -60, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  bandeja: {
    duration: 1.25,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.36,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -44, 0],
            Spine: [4, -18, 6],
            Spine1: [-2, -14, 4],
            Head: [-14, 46, 0],
            RightArm: [-18, -18, -86],
            RightForeArm: [-84, 70, 0],
            RightHand: [0, 0, -8],
            LeftArm: [-112, -15, 18],
            LeftForeArm: [-18, -30, 0],
          },
        },
      },
      {
        at: 0.6,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -4, 0],
            Spine: [6, 8, -4],
            Spine1: [4, 10, 0],
            Head: [-10, 4, 0],
            RightArm: [-86, 12, -40],
            RightForeArm: [-30, 72, 0],
            RightHand: [0, 0, -4],
            LeftArm: [-24, 10, 8],
            LeftForeArm: [-92, -60, 0],
          },
        },
      },
      {
        at: 0.82,
        pose: {
          hipsY: -0.07,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 22, 0],
            Spine: [10, 18, 0],
            Head: [-6, -24, 0],
            RightArm: [-52, 34, 24],
            RightForeArm: [-88, 76, 14],
            LeftArm: [-12, 16, 10],
            LeftForeArm: [-96, -50, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  smash: {
    duration: 1.2,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.36,
        pose: {
          hipsY: -0.11,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [0, -46, 0],
            Spine: [-6, -20, 8],
            Spine1: [-10, -16, 6],
            Head: [-22, 48, 0],
            LeftUpLeg: [-28, 0, 6],
            LeftLeg: [46, 0, 0],
            RightUpLeg: [-28, 0, -6],
            RightLeg: [46, 0, 0],
            RightArm: [-30, -16, -110],
            RightForeArm: [-104, 70, 0],
            RightHand: [0, 0, -12],
            LeftArm: [-128, -10, 16],
            LeftForeArm: [-14, -20, 0],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: 0.13,
          bones: {
            Hips: [-4, 8, 0],
            Spine: [-6, 12, -8],
            Spine1: [-2, 10, -6],
            Head: [-18, -6, 0],
            LeftUpLeg: [-6, 0, 4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-8, 0, -4],
            RightLeg: [16, 0, 0],
            RightArm: [-138, 6, -16],
            RightForeArm: [-12, 52, 0],
            RightHand: [0, 0, 16],
            LeftArm: [-20, 10, 8],
            LeftForeArm: [-95, -50, 0],
          },
        },
      },
      {
        at: 0.8,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, 28, 0],
            Spine: [16, 20, -8],
            Spine1: [12, 14, 0],
            Head: [-8, -28, 0],
            RightArm: [-44, 38, 28],
            RightForeArm: [-78, 76, 12],
            RightHand: [0, 0, -12],
            LeftArm: [12, 20, 10],
            LeftForeArm: [-90, -40, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  lob: {
    duration: 1.15,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.36,
        pose: {
          hipsY: -0.18,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, -26, 0],
            Spine: [16, -14, 0],
            Spine1: [12, -10, 0],
            Head: [-14, 28, 0],
            LeftUpLeg: [-42, 0, 6],
            LeftLeg: [70, 0, 0],
            LeftFoot: [-26, 0, 0],
            RightUpLeg: [-42, 0, -6],
            RightLeg: [70, 0, 0],
            RightFoot: [-26, 0, 0],
            RightArm: [16, -12, -14],
            RightForeArm: [-24, 70, 0],
            RightHand: [0, 0, -18],
            LeftArm: [-34, -22, -12],
            LeftForeArm: [-75, -60, 0],
          },
        },
      },
      {
        at: 0.72,
        pose: {
          hipsY: 0.02,
          bones: {
            Hips: [0, 22, 0],
            Spine: [-4, 18, 0],
            Spine1: [-4, 14, 0],
            Head: [-16, -18, 0],
            LeftUpLeg: [-6, 0, 4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-6, 0, -4],
            RightLeg: [12, 0, 0],
            RightArm: [-116, 22, 14],
            RightForeArm: [-30, 72, 0],
            RightHand: [0, 0, -6],
            LeftArm: [-10, 15, 10],
            LeftForeArm: [-90, -50, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },
};

interface FingerSpec {
  hand: "RightHand" | "LeftHand";
  axis: [number, number, number];
  deg: number;
}

const HAND_FINGER_SPECS: Record<string, FingerSpec> = {
  RightHandIndex1: { hand: "RightHand", axis: [1, 0, 0], deg: 62 },
  RightHandIndex2: { hand: "RightHand", axis: [1, 0, 0], deg: 74 },
  RightHandIndex3: { hand: "RightHand", axis: [1, 0, 0], deg: 52 },
  RightHandMiddle1: { hand: "RightHand", axis: [1, 0, 0], deg: 68 },
  RightHandMiddle2: { hand: "RightHand", axis: [1, 0, 0], deg: 78 },
  RightHandMiddle3: { hand: "RightHand", axis: [1, 0, 0], deg: 54 },
  RightHandRing1: { hand: "RightHand", axis: [1, 0, 0], deg: 70 },
  RightHandRing2: { hand: "RightHand", axis: [1, 0, 0], deg: 78 },
  RightHandRing3: { hand: "RightHand", axis: [1, 0, 0], deg: 54 },
  RightHandPinky1: { hand: "RightHand", axis: [1, 0, 0], deg: 70 },
  RightHandPinky2: { hand: "RightHand", axis: [1, 0, 0], deg: 76 },
  RightHandPinky3: { hand: "RightHand", axis: [1, 0, 0], deg: 52 },
  RightHandThumb1: { hand: "RightHand", axis: [0, 1, 0.5], deg: -36 },
  RightHandThumb2: { hand: "RightHand", axis: [0, 0.3, 1], deg: 34 },
  RightHandThumb3: { hand: "RightHand", axis: [0, 0.2, 1], deg: 28 },

  LeftHandIndex1: { hand: "LeftHand", axis: [1, 0, 0], deg: 24 },
  LeftHandIndex2: { hand: "LeftHand", axis: [1, 0, 0], deg: 28 },
  LeftHandMiddle1: { hand: "LeftHand", axis: [1, 0, 0], deg: 28 },
  LeftHandMiddle2: { hand: "LeftHand", axis: [1, 0, 0], deg: 32 },
  LeftHandRing1: { hand: "LeftHand", axis: [1, 0, 0], deg: 32 },
  LeftHandRing2: { hand: "LeftHand", axis: [1, 0, 0], deg: 34 },
  LeftHandPinky1: { hand: "LeftHand", axis: [1, 0, 0], deg: 34 },
  LeftHandPinky2: { hand: "LeftHand", axis: [1, 0, 0], deg: 34 },
  LeftHandThumb1: { hand: "LeftHand", axis: [0, 1, -0.5], deg: 28 },
  LeftHandThumb2: { hand: "LeftHand", axis: [0, 0.2, -1], deg: 22 },
};

function normalizeBoneKey(rawName: string): string {
  return rawName.replace(/^mixamorig:?/i, "").replace(/^Armature\|/i, "");
}

// Notfall-Fallback, falls keine .glb-Datei geladen werden konnte
function buildFallbackRacketGroup(): THREE.Group {
  const racket = new THREE.Group();
  racket.name = "FallbackPadelRacket";
  racket.userData.isProceduralFallback = true;

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.125, 12),
    new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.9 })
  );
  grip.position.set(0, 0.062, 0);
  racket.add(grip);

  const shape = new THREE.Shape();
  shape.moveTo(-0.017, 0.124);
  shape.bezierCurveTo(-0.042, 0.155, -0.098, 0.215, -0.118, 0.295);
  shape.bezierCurveTo(-0.125, 0.365, -0.088, 0.432, 0.0, 0.442);
  shape.bezierCurveTo(0.088, 0.432, 0.125, 0.365, 0.118, 0.295);
  shape.bezierCurveTo(0.098, 0.215, 0.042, 0.155, 0.017, 0.124);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 16,
  });
  bodyGeo.translate(0, 0, -0.015);

  const body = new THREE.Mesh(bodyGeo, [
    new THREE.MeshStandardMaterial({ color: "#0b1120", roughness: 0.45, metalness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: "#0ea5e9", roughness: 0.35, metalness: 0.7 }),
  ]);
  racket.add(body);

  return racket;
}

function clearRacketMount(mount: THREE.Group) {
  while (mount.children.length > 0) {
    const child = mount.children[0];
    mount.remove(child);
    // Nur den prozeduralen Fallback disposen – gecachte GLB-Geometrien/Texturen bleiben intakt!
    if (child.userData?.isProceduralFallback) {
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    }
  }
}

function getRestCharQuaternion(
  obj: THREE.Object3D,
  rootObj: THREE.Object3D
): THREE.Quaternion {
  const chain: THREE.Object3D[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur && cur !== rootObj) {
    chain.push(cur);
    cur = cur.parent;
  }
  const q = new THREE.Quaternion();
  for (let i = chain.length - 1; i >= 0; i--) {
    q.multiply(chain[i].quaternion);
  }
  return q;
}

export interface AnimatedPadelPlayerProps {
  modelUrl?: string;
  racketId?: string | null;
  racketUrl?: string;
  action?: PlayerAction;
  triggerKey?: number;
  speed?: number;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  showRacket?: boolean;
  onActionFinished?: () => void;
}

export default function AnimatedPadelPlayer({
  modelUrl = "/meshy_player.glb",
  racketId = "racket_starter",
  racketUrl,
  action = "idle",
  triggerKey = 0,
  speed = 1,
  position = [0, -0.9, 0],
  rotationY = 0,
  scale = 1.15,
  showRacket = true,
  onActionFinished,
}: AnimatedPadelPlayerProps) {
  const { scene, animations } = useGLTF(modelUrl, false, false);
  const clonedScene = useMemo(() => cloneSkinned(scene), [scene]);

  const bonesMapRef = useRef(new Map<string, THREE.Bone>());
  const restLocalQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatInvRef = useRef(new Map<string, THREE.Quaternion>());
  const fingerGripQuatRef = useRef(new Map<string, THREE.Quaternion>());

  const restHipsYRef = useRef<number>(0.97);
  const racketMountRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);

  const shotElapsedRef = useRef<number>(0);
  const shotDoneRef = useRef<boolean>(false);

  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const tmpCharDelta = useMemo(() => new THREE.Quaternion(), []);
  const tmpLocalDelta = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatA = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatB = useMemo(() => new THREE.Quaternion(), []);
  const tmpTargetQuat = useMemo(() => new THREE.Quaternion(), []);

  const resolvedRacketUrl = useMemo(
    () => resolveRacketModelUrl(racketId, racketUrl),
    [racketId, racketUrl]
  );

  // 1. Bind-Pose erfassen, Charakterraum-Quaternionen & Schläger-Mount an RightHand anlegen
  useEffect(() => {
    const bonesMap = new Map<string, THREE.Bone>();
    const restLocal = new Map<string, THREE.Quaternion>();
    const restChar = new Map<string, THREE.Quaternion>();
    const restCharInv = new Map<string, THREE.Quaternion>();
    const fingerGrip = new Map<string, THREE.Quaternion>();

    clonedScene.traverse((obj) => {
      const skinned = obj as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh && skinned.skeleton) {
        skinned.skeleton.pose();
      }
    });

    clonedScene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) {
        const bone = obj as THREE.Bone;
        const key = normalizeBoneKey(bone.name);
        bonesMap.set(key, bone);
        restLocal.set(key, bone.quaternion.clone());

        const qChar = getRestCharQuaternion(bone, clonedScene);
        restChar.set(key, qChar);
        restCharInv.set(key, qChar.clone().invert());

        if (key === "Hips") {
          restHipsYRef.current = bone.position.y;
        }
      }
    });

    Object.entries(HAND_FINGER_SPECS).forEach(([fKey, spec]) => {
      const qHandChar = restChar.get(spec.hand);
      const qFChar = restChar.get(fKey);
      const qFLocal = restLocal.get(fKey);
      if (!qHandChar || !qFChar || !qFLocal) return;

      const qInHand = qHandChar.clone().invert().multiply(qFChar);
      const qInHandInv = qInHand.clone().invert();
      const axisVec = new THREE.Vector3(
        spec.axis[0],
        spec.axis[1],
        spec.axis[2]
      ).normalize();
      const qCurlHand = new THREE.Quaternion().setFromAxisAngle(
        axisVec,
        THREE.MathUtils.degToRad(spec.deg)
      );
      const qCurlLocal = qInHandInv.multiply(qCurlHand).multiply(qInHand);
      fingerGrip.set(fKey, qFLocal.clone().multiply(qCurlLocal));
    });

    bonesMapRef.current = bonesMap;
    restLocalQuatRef.current = restLocal;
    restCharQuatRef.current = restChar;
    restCharQuatInvRef.current = restCharInv;
    fingerGripQuatRef.current = fingerGrip;

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const walkClip =
      animations.find((clip) => clip.name === "Walking") || animations[0] || null;
    walkActionRef.current = walkClip ? mixer.clipAction(walkClip) : null;

    // Fester Continental-Griff-Mount an mixamorig:RightHand
    const rightHandBone = bonesMap.get("RightHand");
    let mount: THREE.Group | null = null;
    if (rightHandBone) {
      mount = new THREE.Group();
      mount.name = "PadelRacketMount";
      mount.position.set(0.0, 0.078, 0.026);
      mount.rotation.set(0, 0, THREE.MathUtils.degToRad(-56));
      mount.visible = showRacket;
      rightHandBone.add(mount);
      racketMountRef.current = mount;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      walkActionRef.current = null;

      if (rightHandBone && mount) {
        clearRacketMount(mount);
        rightHandBone.remove(mount);
      }
      racketMountRef.current = null;
    };
  }, [clonedScene, animations]);

  // 2. Echten 3D-Schläger (.glb) asynchron & gecacht in den Griff-Mount laden
  useEffect(() => {
    const mount = racketMountRef.current;
    if (!mount) return;

    let cancelled = false;

    const attachSceneToMount = (loadedScene: THREE.Group) => {
      if (cancelled || !racketMountRef.current) return;
      clearRacketMount(racketMountRef.current);
      const clone = loadedScene.clone(true);
      // Griff leicht (-3,2 cm) in die Handfläche schieben, damit die Finger mittig greifen
      clone.position.set(0, -0.032, 0);
      clone.scale.setScalar(1);
      racketMountRef.current.add(clone);
    };

    loadCachedRacketGlb(resolvedRacketUrl)
      .then(attachSceneToMount)
      .catch(() => {
        if (resolvedRacketUrl !== DEFAULT_RACKET_URL) {
          return loadCachedRacketGlb(DEFAULT_RACKET_URL)
            .then(attachSceneToMount)
            .catch(() => {
              if (!cancelled && racketMountRef.current) {
                clearRacketMount(racketMountRef.current);
                const fb = buildFallbackRacketGroup();
                fb.position.set(0, -0.032, 0);
                racketMountRef.current.add(fb);
              }
            });
        }
        if (!cancelled && racketMountRef.current) {
          clearRacketMount(racketMountRef.current);
          const fb = buildFallbackRacketGroup();
          fb.position.set(0, -0.032, 0);
          racketMountRef.current.add(fb);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedRacketUrl, clonedScene]);

  useEffect(() => {
    if (racketMountRef.current) {
      racketMountRef.current.visible = showRacket;
    }
  }, [showRacket]);

  // 3. Eingebetteten "Walking"-Clip steuern oder für prozedurale Schläge stoppen
  useEffect(() => {
    shotElapsedRef.current = 0;
    shotDoneRef.current = false;

    const walkAction = walkActionRef.current;
    if (!walkAction) return;

    if (action === "walk") {
      walkAction.reset();
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.play();
    } else {
      walkAction.stop();
    }
  }, [action, triggerKey]);

  // 4. Render-Loop: Walking-Mixer ODER Charakterraum-Bone-Animation
  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.05);

    if (action === "walk") {
      if (mixerRef.current) {
        mixerRef.current.update(safeDelta * speed);
      }
      return;
    }

    const bonesMap = bonesMapRef.current;
    const restLocal = restLocalQuatRef.current;
    const restChar = restCharQuatRef.current;
    const restCharInv = restCharQuatInvRef.current;
    const fingerGrip = fingerGripQuatRef.current;
    if (bonesMap.size === 0) return;

    const computeTargetBoneQuat = (
      key: string,
      deg: DegVec3 | undefined,
      out: THREE.Quaternion,
      useGrip: boolean
    ) => {
      if (useGrip) {
        const isRightFinger = key.startsWith("RightHand");
        if (!isRightFinger || showRacket) {
          const gripQ = fingerGrip.get(key);
          if (gripQ) {
            out.copy(gripQ);
            return;
          }
        }
      }

      const qRestLocal = restLocal.get(key);
      if (!qRestLocal) return;

      if (!deg) {
        out.copy(qRestLocal);
        return;
      }

      const qChar = restChar.get(key);
      const qCharInv = restCharInv.get(key);
      if (!qChar || !qCharInv) {
        out.copy(qRestLocal);
        return;
      }

      tmpEuler.set(
        THREE.MathUtils.degToRad(deg[0]),
        THREE.MathUtils.degToRad(deg[1]),
        THREE.MathUtils.degToRad(deg[2]),
        "XYZ"
      );
      tmpCharDelta.setFromEuler(tmpEuler);

      tmpLocalDelta.copy(qCharInv).multiply(tmpCharDelta).multiply(qChar);
      out.copy(qRestLocal).multiply(tmpLocalDelta);
    };

    const blendAlpha = 1 - Math.exp(-safeDelta * 14);
    const tClock = state.clock.elapsedTime;

    const applyPose = (pose: BonePoseSpec, breathe: boolean, useGrip: boolean) => {
      const hips = bonesMap.get("Hips");
      if (hips) {
        const bob = breathe ? Math.sin(tClock * 3.4) * 0.014 : 0;
        const targetY = restHipsYRef.current + (pose.hipsY ?? 0) + bob;
        hips.position.y = THREE.MathUtils.lerp(hips.position.y, targetY, blendAlpha);
      }

      bonesMap.forEach((bone, key) => {
        computeTargetBoneQuat(key, pose.bones[key], tmpTargetQuat, useGrip);
        bone.quaternion.slerp(tmpTargetQuat, blendAlpha);
      });
    };

    if (action === "a_pose") {
      applyPose({ hipsY: 0, bones: {} }, false, false);
      return;
    }

    if (action === "idle") {
      applyPose(IDLE_POSE, true, true);
      return;
    }

    const shotDef = SHOT_ANIMATIONS[action];
    if (!shotDef) {
      applyPose(IDLE_POSE, true, true);
      return;
    }

    shotElapsedRef.current += safeDelta * speed;
    const progress = Math.min(1, shotElapsedRef.current / shotDef.duration);

    if (progress >= 1 && !shotDoneRef.current) {
      shotDoneRef.current = true;
      if (onActionFinished) onActionFinished();
    }

    const frames = shotDef.frames;
    let prevFrame = frames[0];
    let nextFrame = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      if (progress >= frames[i].at && progress <= frames[i + 1].at) {
        prevFrame = frames[i];
        nextFrame = frames[i + 1];
        break;
      }
    }

    const segSpan = Math.max(0.0001, nextFrame.at - prevFrame.at);
    const rawT = THREE.MathUtils.clamp((progress - prevFrame.at) / segSpan, 0, 1);
    const smoothT = rawT * rawT * (3 - 2 * rawT);

    const fastBlend = 1 - Math.exp(-safeDelta * 22);
    const hips = bonesMap.get("Hips");
    if (hips) {
      const yA = restHipsYRef.current + (prevFrame.pose.hipsY ?? 0);
      const yB = restHipsYRef.current + (nextFrame.pose.hipsY ?? 0);
      hips.position.y = THREE.MathUtils.lerp(
        hips.position.y,
        THREE.MathUtils.lerp(yA, yB, smoothT),
        fastBlend
      );
    }

    bonesMap.forEach((bone, key) => {
      computeTargetBoneQuat(key, prevFrame.pose.bones[key], tmpQuatA, true);
      computeTargetBoneQuat(key, nextFrame.pose.bones[key], tmpQuatB, true);
      tmpTargetQuat.copy(tmpQuatA).slerp(tmpQuatB, smoothT);
      bone.quaternion.slerp(tmpTargetQuat, fastBlend);
    });
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
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

type DegVec3 = [number, number, number];

interface BonePoseSpec {
  hipsY?: number;
  bones: Partial<Record<string, DegVec3>>;
}

interface ShotKeyframe {
  at: number;
  pose: BonePoseSpec;
}

interface ShotAnimationDef {
  duration: number;
  frames: ShotKeyframe[];
}

// --- GRUNDSTELLUNG (READY STANCE) ---
const IDLE_POSE: BonePoseSpec = {
  hipsY: -0.06,
  bones: {
    Hips: [6, 0, 0],
    Spine: [10, 0, 0],
    Spine1: [8, 0, 0],
    Spine2: [4, 0, 0],
    Neck: [-8, 0, 0],
    Head: [-6, 0, 0],
    LeftUpLeg: [-20, 0, -6],
    LeftLeg: [36, 0, 0],
    LeftFoot: [-14, 0, 0],
    RightUpLeg: [-20, 0, 6],
    RightLeg: [36, 0, 0],
    RightFoot: [-14, 0, 0],
    LeftShoulder: [0, 0, 8],
    LeftArm: [28, 22, -48],
    LeftForeArm: [0, 0, 72],
    RightShoulder: [0, 0, -8],
    RightArm: [32, -26, 46],
    RightForeArm: [0, 0, -78],
    RightHand: [0, 12, -12],
  },
};

// --- ALLE PADEL-SCHLÄGE (WINKEL IN GRAD, RELATIV ZUR BIND-POSE) ---
export const SHOT_ANIMATIONS: Record<
  Exclude<PlayerAction, "a_pose" | "idle" | "walk">,
  ShotAnimationDef
> = {
  forehand: {
    duration: 1.05,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        at: 0.34,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -28, 0],
            Spine: [10, -18, 0],
            Spine1: [8, -14, 0],
            Head: [-6, 36, 0],
            LeftArm: [35, 35, -35],
            LeftForeArm: [0, 0, 58],
            RightArm: [-24, -42, 42],
            RightForeArm: [0, 0, -48],
            RightHand: [10, 18, -16],
          },
        },
      },
      {
        at: 0.58,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, 12, 0],
            Spine: [8, 14, 0],
            Spine1: [6, 12, 0],
            Head: [-4, -18, 0],
            LeftArm: [20, 10, -52],
            LeftForeArm: [0, 0, 85],
            RightArm: [48, -10, 32],
            RightForeArm: [0, 0, -34],
            RightHand: [-6, -10, -8],
          },
        },
      },
      {
        at: 0.80,
        pose: {
          hipsY: -0.03,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, 28, 0],
            Spine: [4, 22, 0],
            Spine1: [2, 16, 0],
            Head: [-4, -36, 0],
            LeftArm: [12, -10, -56],
            LeftForeArm: [0, 0, 92],
            RightArm: [72, 34, 18],
            RightForeArm: [0, 0, -96],
            RightHand: [-10, -18, 0],
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
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 30, 0],
            Spine: [10, 20, 0],
            Spine1: [8, 16, 0],
            Head: [-6, -38, 0],
            LeftArm: [34, 26, -38],
            LeftForeArm: [0, 0, 84],
            RightArm: [44, 42, 40],
            RightForeArm: [0, 0, -98],
            RightHand: [0, -24, 14],
          },
        },
      },
      {
        at: 0.58,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -6, 0],
            Spine: [8, -8, 0],
            Spine1: [4, -10, 0],
            Head: [-4, 14, 0],
            LeftArm: [12, 36, -54],
            LeftForeArm: [0, 0, 48],
            RightArm: [34, -18, 28],
            RightForeArm: [0, 0, -30],
            RightHand: [4, 14, -8],
          },
        },
      },
      {
        at: 0.80,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -22, 0],
            Spine: [4, -18, 0],
            Spine1: [2, -14, 0],
            Head: [-4, 30, 0],
            LeftArm: [-18, 28, -56],
            LeftForeArm: [0, 0, 38],
            RightArm: [12, -52, 8],
            RightForeArm: [0, 0, -22],
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
          hipsY: -0.07,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -16, 0],
            Spine: [10, -10, 0],
            Head: [-6, 18, 0],
            LeftArm: [36, 18, -40],
            LeftForeArm: [0, 0, 72],
            RightArm: [24, -34, 24],
            RightForeArm: [0, 0, -76],
            RightHand: [12, 16, -24],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, 10, 0],
            Spine: [12, 8, 0],
            LeftUpLeg: [-28, 0, -6],
            LeftLeg: [44, 0, 0],
            RightArm: [54, -4, 32],
            RightForeArm: [0, 0, -52],
            RightHand: [6, 0, -14],
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
            Hips: [4, -42, 0],
            Spine: [4, -18, -6],
            Spine1: [-4, -14, -4],
            Head: [-16, 46, 0],
            LeftShoulder: [0, 0, -18],
            LeftArm: [72, 18, -14],
            LeftForeArm: [0, 0, 22],
            RightShoulder: [0, 0, 20],
            RightArm: [-8, -24, -22],
            RightForeArm: [0, 0, -86],
            RightHand: [14, 18, -18],
          },
        },
      },
      {
        at: 0.60,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -6, 0],
            Spine: [6, 8, 4],
            Spine1: [4, 10, 0],
            Head: [-10, 4, 0],
            LeftArm: [26, 12, -48],
            LeftForeArm: [0, 0, 82],
            RightShoulder: [0, 0, 10],
            RightArm: [52, -16, -6],
            RightForeArm: [0, 0, -34],
            RightHand: [4, -12, -10],
          },
        },
      },
      {
        at: 0.82,
        pose: {
          hipsY: -0.06,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 22, 0],
            Spine: [10, 18, 0],
            Head: [-6, -24, 0],
            RightArm: [46, 36, 42],
            RightForeArm: [0, 0, -88],
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
          hipsY: -0.10,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [2, -46, 0],
            Spine: [-6, -18, -8],
            Spine1: [-10, -14, -6],
            Head: [-24, 48, 0],
            LeftUpLeg: [-26, 0, -6],
            LeftLeg: [44, 0, 0],
            RightUpLeg: [-26, 0, 6],
            RightLeg: [44, 0, 0],
            LeftShoulder: [0, 0, -24],
            LeftArm: [88, 12, 6],
            LeftForeArm: [0, 0, 14],
            RightShoulder: [0, 0, 26],
            RightArm: [-18, -28, -42],
            RightForeArm: [0, 0, -108],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: 0.14,
          bones: {
            Hips: [-4, 4, 0],
            Spine: [-4, 8, 6],
            Spine1: [2, 10, 4],
            Head: [-18, -6, 0],
            LeftUpLeg: [-6, 0, -4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-8, 0, 4],
            RightLeg: [16, 0, 0],
            LeftArm: [24, 10, -52],
            LeftForeArm: [0, 0, 74],
            RightShoulder: [0, 0, 32],
            RightArm: [72, -10, -44],
            RightForeArm: [0, 0, -10],
            RightHand: [-18, 0, -10],
          },
        },
      },
      {
        at: 0.80,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, 28, 0],
            Spine: [16, 20, 8],
            Spine1: [12, 14, 0],
            Head: [-8, -28, 0],
            RightArm: [40, 38, 46],
            RightForeArm: [0, 0, -72],
            RightHand: [-22, -16, 0],
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
            Hips: [14, -24, 0],
            Spine: [16, -14, 0],
            Spine1: [12, -10, 0],
            Head: [-14, 28, 0],
            LeftUpLeg: [-42, 0, -6],
            LeftLeg: [70, 0, 0],
            LeftFoot: [-26, 0, 0],
            RightUpLeg: [-42, 0, 6],
            RightLeg: [70, 0, 0],
            RightFoot: [-26, 0, 0],
            RightArm: [12, -26, 58],
            RightForeArm: [0, 0, -28],
            RightHand: [20, 12, -20],
          },
        },
      },
      {
        at: 0.72,
        pose: {
          hipsY: 0.02,
          bones: {
            Hips: [0, 18, 0],
            Spine: [-2, 16, 0],
            Spine1: [-4, 12, 0],
            Head: [-16, -18, 0],
            LeftUpLeg: [-6, 0, -4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-6, 0, 4],
            RightLeg: [12, 0, 0],
            LeftArm: [24, 10, -52],
            LeftForeArm: [0, 0, 76],
            RightShoulder: [0, 0, 16],
            RightArm: [82, 12, -16],
            RightForeArm: [0, 0, -42],
            RightHand: [10, -10, -10],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },
};

function normalizeBoneKey(rawName: string): string {
  return rawName.replace(/^mixamorig:?/i, "").replace(/^Armature\|/i, "");
}

function buildPadelRacketGroup(): THREE.Group {
  const racket = new THREE.Group();
  racket.name = "ProceduralPadelRacket";

  const handleMat = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.85,
    metalness: 0.1,
  });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.02, 0.14, 12),
    handleMat
  );
  handle.position.set(0, 0.07, 0);
  racket.add(handle);

  const bridgeMat = new THREE.MeshStandardMaterial({
    color: "#0ea5e9",
    emissive: "#0284c7",
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.7,
  });
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.065, 0.026),
    bridgeMat
  );
  bridge.position.set(0, 0.17, 0);
  racket.add(bridge);

  const faceMat = new THREE.MeshStandardMaterial({
    color: "#020617",
    roughness: 0.45,
    metalness: 0.65,
  });
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.032, 24),
    faceMat
  );
  face.rotation.x = Math.PI / 2;
  face.scale.set(0.92, 1.0, 1.12);
  face.position.set(0, 0.32, 0);
  racket.add(face);

  const rimMat = new THREE.MeshStandardMaterial({
    color: "#f97316",
    emissive: "#ea580c",
    emissiveIntensity: 0.7,
    roughness: 0.3,
    metalness: 0.8,
  });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.015, 10, 28),
    rimMat
  );
  rim.scale.set(0.92, 1.12, 1.0);
  rim.position.set(0, 0.32, 0);
  racket.add(rim);

  racket.position.set(0.0, 0.07, 0.03);
  racket.rotation.set(Math.PI / 2, 0.15, 0);

  return racket;
}

export interface AnimatedPadelPlayerProps {
  modelUrl?: string;
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

  // Eigenes Skelett pro Instanz klonen
  const clonedScene = useMemo(() => cloneSkinned(scene), [scene]);

  const bonesMapRef = useRef(new Map<string, THREE.Bone>());
  const restQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restHipsYRef = useRef<number>(0.97);
  const racketRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);

  const shotElapsedRef = useRef<number>(0);
  const shotDoneRef = useRef<boolean>(false);

  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const tmpDeltaQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatA = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatB = useMemo(() => new THREE.Quaternion(), []);
  const tmpTargetQuat = useMemo(() => new THREE.Quaternion(), []);

  // 1. Bind-Pose erfassen, AnimationMixer direkt auf clonedScene binden & Schläger anhängen
  useEffect(() => {
    const bonesMap = new Map<string, THREE.Bone>();
    const restQuats = new Map<string, THREE.Quaternion>();

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
        restQuats.set(key, bone.quaternion.clone());
        if (key === "Hips") {
          restHipsYRef.current = bone.position.y;
        }
      }
    });

    bonesMapRef.current = bonesMap;
    restQuatRef.current = restQuats;

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const walkClip =
      animations.find((clip) => clip.name === "Walking") || animations[0] || null;
    walkActionRef.current = walkClip ? mixer.clipAction(walkClip) : null;

    const rightHand = bonesMap.get("RightHand");
    let createdRacket: THREE.Group | null = null;
    if (rightHand) {
      createdRacket = buildPadelRacketGroup();
      createdRacket.visible = showRacket;
      rightHand.add(createdRacket);
      racketRef.current = createdRacket;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      walkActionRef.current = null;

      if (rightHand && createdRacket) {
        rightHand.remove(createdRacket);
        createdRacket.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        });
      }
      racketRef.current = null;
    };
  }, [clonedScene, animations]);

  // Schläger ein-/ausblenden
  useEffect(() => {
    if (racketRef.current) {
      racketRef.current.visible = showRacket;
    }
  }, [showRacket]);

  // 2. Eingebetteten "Walking"-Clip steuern oder für prozedurale Schläge stoppen
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

  // 3. Render-Loop: Walking-Mixer ODER prozedurale Bone-Animation
  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.05);

    if (action === "walk") {
      if (mixerRef.current) {
        mixerRef.current.update(safeDelta * speed);
      }
      return;
    }

    const bonesMap = bonesMapRef.current;
    const restQuats = restQuatRef.current;
    if (bonesMap.size === 0) return;

    const blendAlpha = 1 - Math.exp(-safeDelta * 14);
    const tClock = state.clock.elapsedTime;

    const applyPose = (pose: BonePoseSpec, breathe: boolean) => {
      const hips = bonesMap.get("Hips");
      if (hips) {
        const bob = breathe ? Math.sin(tClock * 3.4) * 0.014 : 0;
        const targetY = restHipsYRef.current + (pose.hipsY ?? 0) + bob;
        hips.position.y = THREE.MathUtils.lerp(hips.position.y, targetY, blendAlpha);
      }

      bonesMap.forEach((bone, key) => {
        const restQ = restQuats.get(key);
        if (!restQ) return;

        const deg = pose.bones[key];
        if (deg) {
          tmpEuler.set(
            THREE.MathUtils.degToRad(deg[0]),
            THREE.MathUtils.degToRad(deg[1]),
            THREE.MathUtils.degToRad(deg[2]),
            "XYZ"
          );
          tmpDeltaQuat.setFromEuler(tmpEuler);
          tmpTargetQuat.copy(restQ).multiply(tmpDeltaQuat);
        } else {
          tmpTargetQuat.copy(restQ);
        }

        bone.quaternion.slerp(tmpTargetQuat, blendAlpha);
      });
    };

    if (action === "a_pose") {
      applyPose({ hipsY: 0, bones: {} }, false);
      return;
    }

    if (action === "idle") {
      applyPose(IDLE_POSE, true);
      return;
    }

    const shotDef = SHOT_ANIMATIONS[action];
    if (!shotDef) {
      applyPose(IDLE_POSE, true);
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

    const hips = bonesMap.get("Hips");
    if (hips) {
      const yA = restHipsYRef.current + (prevFrame.pose.hipsY ?? 0);
      const yB = restHipsYRef.current + (nextFrame.pose.hipsY ?? 0);
      hips.position.y = THREE.MathUtils.lerp(
        hips.position.y,
        THREE.MathUtils.lerp(yA, yB, smoothT),
        1 - Math.exp(-safeDelta * 22)
      );
    }

    bonesMap.forEach((bone, key) => {
      const restQ = restQuats.get(key);
      if (!restQ) return;

      const degA = prevFrame.pose.bones[key];
      const degB = nextFrame.pose.bones[key];

      if (degA) {
        tmpEuler.set(
          THREE.MathUtils.degToRad(degA[0]),
          THREE.MathUtils.degToRad(degA[1]),
          THREE.MathUtils.degToRad(degA[2]),
          "XYZ"
        );
        tmpDeltaQuat.setFromEuler(tmpEuler);
        tmpQuatA.copy(restQ).multiply(tmpDeltaQuat);
      } else {
        tmpQuatA.copy(restQ);
      }

      if (degB) {
        tmpEuler.set(
          THREE.MathUtils.degToRad(degB[0]),
          THREE.MathUtils.degToRad(degB[1]),
          THREE.MathUtils.degToRad(degB[2]),
          "XYZ"
        );
        tmpDeltaQuat.setFromEuler(tmpEuler);
        tmpQuatB.copy(restQ).multiply(tmpDeltaQuat);
      } else {
        tmpQuatB.copy(restQ);
      }

      tmpTargetQuat.copy(tmpQuatA).slerp(tmpQuatB, smoothT);
      bone.quaternion.slerp(tmpTargetQuat, 1 - Math.exp(-safeDelta * 22));
    });
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}
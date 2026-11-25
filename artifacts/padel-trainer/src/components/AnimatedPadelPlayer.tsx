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
  // Winkel in Grad im SAUBEREN CHARAKTERRAUM (+X=links, +Y=oben, +Z=vorne):
  // - Spine/Head: +X neigt nach vorne, +Y dreht nach links, -Y nach rechts
  // - Arme/Beine (hängen nach -Y): -X schwingt nach VORNE, +Y dreht einwärts,
  //   RightArm -Z hebt Arm nach rechts/oben, LeftArm +Z hebt Arm nach links/oben
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

// --- GRUNDSTELLUNG (KLASSISCHE PADEL READY STANCE) ---
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
    // Arme vor dem Körper, Unterarme nach innen gedreht (Continental-Griff), linke Hand nahe am Schlägerherz
    RightArm: [-24, 24, 16],
    RightForeArm: [-88, 72, 18],
    RightHand: [0, 0, 14],
    LeftArm: [-34, -22, -16],
    LeftForeArm: [-96, -72, -18],
    LeftHand: [0, 0, -8],
  },
};

// --- ALLE PADEL-SCHLÄGE IM CHARAKTERRAUM ---
export const SHOT_ANIMATIONS: Record<
  Exclude<PlayerAction, "a_pose" | "idle" | "walk">,
  ShotAnimationDef
> = {
  forehand: {
    duration: 1.05,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Ausholen: Körper nach rechts aufdrehen, Schläger hinter der Hüfte
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
        // Treffpunkt: Hüfte + Schulter schnellen vor den Körper
        at: 0.58,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, 12, 0],
            Spine: [8, 16, 0],
            Spine1: [4, 12, 0],
            Head: [-4, -22, 0],
            RightArm: [-56, 15, -16],
            RightForeArm: [-36, 65, 0],
            RightHand: [0, 0, 0],
            LeftArm: [-12, 15, 10],
            LeftForeArm: [-95, -50, 0],
          },
        },
      },
      {
        // Durchschwung über die linke Schulter
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
        // Kompaktes Aufdrehen nach links
        at: 0.34,
        pose: {
          hipsY: -0.1,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 36, 0],
            Spine: [10, 24, 0],
            Spine1: [6, 18, 0],
            Head: [-6, -42, 0],
            RightArm: [-46, 36, 32],
            RightForeArm: [-86, 82, 16],
            RightHand: [0, 0, 12],
            LeftArm: [-42, -26, -18],
            LeftForeArm: [-92, -70, -12],
          },
        },
      },
      {
        // Treffpunkt vorne mit Gegenzug des linken Arms
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
        // Auslauf nach rechts außen
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
        // Kurzes Öffnen auf Brusthöhe am Netz
        at: 0.28,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -18, 0],
            Spine: [10, -12, 0],
            Spine1: [6, -8, 0],
            Head: [-6, 20, 0],
            RightArm: [-28, 8, -22],
            RightForeArm: [-80, 72, 0],
            RightHand: [0, 0, -10],
            LeftArm: [-36, -24, -16],
            LeftForeArm: [-86, -65, 0],
          },
        },
      },
      {
        // Kurzer Block-/Stech-Impuls mit Ausfallschritt
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
            RightArm: [-62, 16, -6],
            RightForeArm: [-44, 72, 0],
            RightHand: [0, 0, -6],
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
        // Seitlich stellen, linker Arm zeigt zum Ball, Schläger auf Kopfhöhe
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
        // Seitlicher Slice-Treffpunkt auf Augenhöhe
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
        // Kontrollierter Durchschwung Richtung linke Hüfte
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
        // Trophy-Pose: tief aufladen, linker Arm hoch, rechter Ellbogen nach hinten gespannt
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
        // Maximaler Streck-Treffpunkt über und leicht vor dem Kopf
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
        // Explosiver Durchschwung nach unten links
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
        // Tief in die Knie, Schläger tief neben rechtem Knie
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
        // Beine strecken und Schläger weich nach oben ziehen
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

// Finger-Krümmung für den Schlägergriff an der rechten Hand (in RightHand-Raum um +X)
const RIGHT_FINGER_CURL_DEG: Record<string, number> = {
  RightHandIndex1: 58,
  RightHandIndex2: 68,
  RightHandIndex3: 48,
  RightHandMiddle1: 64,
  RightHandMiddle2: 74,
  RightHandMiddle3: 52,
  RightHandRing1: 66,
  RightHandRing2: 74,
  RightHandRing3: 52,
  RightHandPinky1: 66,
  RightHandPinky2: 72,
  RightHandPinky3: 50,
};

function normalizeBoneKey(rawName: string): string {
  return rawName.replace(/^mixamorig:?/i, "").replace(/^Armature\|/i, "");
}

function buildPadelRacketGroup(): THREE.Group {
  const racket = new THREE.Group();
  racket.name = "ProceduralPadelRacket";

  // Griff
  const handleMat = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.85,
    metalness: 0.1,
  });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.02, 0.14, 12),
    handleMat
  );
  handle.position.set(0, 0.05, 0);
  racket.add(handle);

  // Herz / Brücke
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
  bridge.position.set(0, 0.15, 0);
  racket.add(bridge);

  // Schlagfläche
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
  face.position.set(0, 0.3, 0);
  racket.add(face);

  // Leuchtender Rahmen
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
  rim.position.set(0, 0.3, 0);
  racket.add(rim);

  // Continental-Griff in mixamorig:RightHand (+Y=Finger, +X=Daumenkante, +Z=Handfläche)
  racket.position.set(0.0, 0.075, 0.032);
  racket.rotation.set(0, 0, THREE.MathUtils.degToRad(-48));

  return racket;
}

// Berechnet die Ruhe-Orientierung eines Bones im lokalen Raum von rootObj (unabhängig von äußerer Gruppen-Rotation)
function getRestCharQuaternion(obj: THREE.Object3D, rootObj: THREE.Object3D): THREE.Quaternion {
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
  const clonedScene = useMemo(() => cloneSkinned(scene), [scene]);

  const bonesMapRef = useRef(new Map<string, THREE.Bone>());
  const restLocalQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatInvRef = useRef(new Map<string, THREE.Quaternion>());
  const fingerGripQuatRef = useRef(new Map<string, THREE.Quaternion>());

  const restHipsYRef = useRef<number>(0.97);
  const racketRef = useRef<THREE.Group | null>(null);
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

  // 1. Bind-Pose erfassen, Charakterraum-Quaternionen & Finger-Griff vorberechnen
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

    // Finger-Griff-Quaternionen im RightHand-Raum vorberechnen
    const rightHandBone = bonesMap.get("RightHand");
    if (rightHandBone) {
      const qHandChar = restChar.get("RightHand");
      if (qHandChar) {
        const qHandCharInv = qHandChar.clone().invert();
        Object.entries(RIGHT_FINGER_CURL_DEG).forEach(([fKey, curlDeg]) => {
          const fBone = bonesMap.get(fKey);
          const qFChar = restChar.get(fKey);
          const qFLocal = restLocal.get(fKey);
          if (!fBone || !qFChar || !qFLocal) return;

          // Orientierung des Fingers relativ zu RightHand
          const qInHand = qHandCharInv.clone().multiply(qFChar);
          const qInHandInv = qInHand.clone().invert();
          const qCurlHand = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            THREE.MathUtils.degToRad(curlDeg)
          );
          const qCurlLocal = qInHandInv.multiply(qCurlHand).multiply(qInHand);
          fingerGrip.set(fKey, qFLocal.clone().multiply(qCurlLocal));
        });
      }
    }

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

    let createdRacket: THREE.Group | null = null;
    if (rightHandBone) {
      createdRacket = buildPadelRacketGroup();
      createdRacket.visible = showRacket;
      rightHandBone.add(createdRacket);
      racketRef.current = createdRacket;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      walkActionRef.current = null;

      if (rightHandBone && createdRacket) {
        rightHandBone.remove(createdRacket);
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

  // 3. Render-Loop: Walking-Mixer ODER Charakterraum-Bone-Animation
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

    // Wandelt einen Charakterraum-Eulerwinkel exakt in das lokale Ziel-Quaternion eines Bones um
    const computeTargetBoneQuat = (
      key: string,
      deg: DegVec3 | undefined,
      out: THREE.Quaternion,
      useGrip: boolean
    ) => {
      if (useGrip && showRacket) {
        const gripQ = fingerGrip.get(key);
        if (gripQ) {
          out.copy(gripQ);
          return;
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

      // d_local = qCharInv * d_char * qChar
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
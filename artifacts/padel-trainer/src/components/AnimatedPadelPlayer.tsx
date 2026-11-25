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
    // Lockere Ellbogen-Weite, Handfläche sauber nach innen (+X), Schläger hochkant vor der Brust
    RightArm: [-41, 49, 0],
    RightForeArm: [12, 52, -40],
    RightHand: [18, 0, 4],
    LeftArm: [-48, -50, -6],
    LeftForeArm: [6, -54, 48],
    LeftHand: [14, 0, -6],
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
        // Ausholen: Körper nach rechts aufdrehen, Schläger kompakt hinter der Hüfte
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
        // Treffpunkt vorne mit aufrechter Schlagfläche
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

// Finger-Krümmung (rechts: fester Griff inkl. Daumen; links: lockere, natürliche Handhaltung)
const HAND_FINGER_SPECS: Record<
  string,
  { hand: "RightHand" | "LeftHand"; axis: [number, number, number]; deg: number }
> = {
  // Rechte Hand umschließt den Griff fest
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

  // Linke Hand leicht gerundet (kein steifer Anhalter-Daumen)
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

// =========================================================================
// REALISTISCHER 3D-PADELSCHLÄGER (TROPFFORM, OFFENES V-HERZ, LOCHMUSTER)
// Maße in Metern: Gesamtlänge ~44 cm, Kopfbreite ~24 cm, Stärke 3,6 cm
// =========================================================================
function buildPadelRacketGroup(): THREE.Group {
  const racket = new THREE.Group();
  racket.name = "ProceduralPadelRacket";

  // 1. Griff mit Abschlusskappe & Handschlaufe
  const gripMat = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.9,
    metalness: 0.05,
  });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0155, 0.0175, 0.125, 16),
    gripMat
  );
  handle.position.set(0, 0.062, 0);
  racket.add(handle);

  const buttCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0195, 0.0205, 0.014, 16),
    new THREE.MeshStandardMaterial({ color: "#0284c7", roughness: 0.35, metalness: 0.6 })
  );
  buttCap.position.set(0, 0.002, 0);
  racket.add(buttCap);

  // Griffband-Ring oben
  const gripRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.012, 16),
    new THREE.MeshStandardMaterial({
      color: "#00f0ff",
      emissive: "#0284c7",
      emissiveIntensity: 0.45,
      roughness: 0.3,
    })
  );
  gripRing.position.set(0, 0.122, 0);
  racket.add(gripRing);

  // 2. Tropfenförmiger Rahmen mit offenem V-Herz-Ausschnitt
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-0.017, 0.124);
  outerShape.bezierCurveTo(-0.042, 0.155, -0.098, 0.215, -0.118, 0.295);
  outerShape.bezierCurveTo(-0.125, 0.365, -0.088, 0.432, 0.0, 0.442);
  outerShape.bezierCurveTo(0.088, 0.432, 0.125, 0.365, 0.118, 0.295);
  outerShape.bezierCurveTo(0.098, 0.215, 0.042, 0.155, 0.017, 0.124);
  outerShape.closePath();

  // Echtes dreieckiges Padel-Herz (Ausschnitt im Schlägerhals)
  const heartHole = new THREE.Path();
  heartHole.moveTo(0.0, 0.148);
  heartHole.lineTo(-0.046, 0.214);
  heartHole.quadraticCurveTo(0.0, 0.204, 0.046, 0.214);
  heartHole.closePath();
  outerShape.holes.push(heartHole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 24,
  };

  const bodyGeo = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
  bodyGeo.translate(0, 0, -0.015); // exakt auf Z=0 zentrieren (Gesamtstärke ~3,8 cm)

  const carbonFaceMat = new THREE.MeshStandardMaterial({
    color: "#0b1120",
    roughness: 0.42,
    metalness: 0.55,
  });
  const frameSideMat = new THREE.MeshStandardMaterial({
    color: "#0ea5e9",
    emissive: "#0284c7",
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.72,
  });

  // Material-Array: [0] Vorder-/Rückseite (dunkles Carbon), [1] Rahmenkante (TacPadel Cyan)
  const racketBody = new THREE.Mesh(bodyGeo, [carbonFaceMat, frameSideMat]);
  racket.add(racketBody);

  // Dezente orange Akzent-Brücke am Herz
  const accentBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.011, 0.036),
    new THREE.MeshStandardMaterial({
      color: "#f97316",
      emissive: "#ea580c",
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.6,
    })
  );
  accentBar.position.set(0, 0.214, 0);
  racket.add(accentBar);

  // 3. Charakteristische Padel-Lochung auf beiden Schlagflächen (sauberes Symmetrie-Muster)
  const holeGeo = new THREE.CylinderGeometry(0.0052, 0.0052, 0.04, 8);
  holeGeo.rotateX(Math.PI / 2);
  const holeMat = new THREE.MeshBasicMaterial({ color: "#02040a" });

  const holeRows: Array<{ y: number; xs: number[] }> = [
    { y: 0.255, xs: [-0.046, -0.023, 0.023, 0.046] },
    { y: 0.285, xs: [-0.072, -0.048, -0.024, 0.024, 0.048, 0.072] },
    { y: 0.315, xs: [-0.082, -0.056, -0.028, 0.0, 0.028, 0.056, 0.082] },
    { y: 0.345, xs: [-0.082, -0.056, -0.028, 0.0, 0.028, 0.056, 0.082] },
    { y: 0.375, xs: [-0.068, -0.042, -0.018, 0.018, 0.042, 0.068] },
    { y: 0.402, xs: [-0.044, -0.018, 0.018, 0.044] },
  ];

  holeRows.forEach((row) => {
    row.xs.forEach((x) => {
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.set(x, row.y, 0);
      racket.add(hole);
    });
  });

  // Continental-Griff in mixamorig:RightHand (+Y=Finger, +X=Daumenkante, +Z=Handfläche)
  racket.position.set(0.0, 0.078, 0.026);
  racket.rotation.set(0, 0, THREE.MathUtils.degToRad(-56));

  return racket;
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

  // 1. Bind-Pose erfassen, Charakterraum-Quaternionen & beide Hand-Posen vorberechnen
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

    // Finger- & Daumen-Krümmung für rechte (Griff) und linke Hand vorberechnen
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

    const rightHandBone = bonesMap.get("RightHand");
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

  useEffect(() => {
    if (racketRef.current) {
      racketRef.current.visible = showRacket;
    }
  }, [showRacket]);

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
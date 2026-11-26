import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import {
  DEFAULT_PARTNER_URL as LOADOUT_DEFAULT_PARTNER_URL,
  DEFAULT_RACKET_URL as LOADOUT_DEFAULT_RACKET_URL,
  SHOP_PARTNERS,
  SHOP_RACKETS,
  resolvePartnerAsset,
  resolveRacketAsset,
  type RacketTransform,
} from "../lib/loadout";

export type PlayerAction =
  | "a_pose"
  | "idle"
  | "walk"
  | "serve"
  | "forehand"
  | "backhand"
  | "volley"
  | "bandeja"
  | "vibora"
  | "bajada"
  | "smash"
  | "lob"
  | "chiquita"
  | "block";

type ShotAction = Exclude<PlayerAction, "a_pose" | "idle" | "walk">;
type DegVec3 = [number, number, number];
type BoneRotationMap = Record<string, DegVec3 | undefined>;
type RacketLoadPromise = Promise<THREE.Group>;

interface HandAlignData {
  foreArmFixChar: THREE.Quaternion;
  foreArmFixCharInv: THREE.Quaternion;
  handFixChar: THREE.Quaternion;
  handBasisLocalQuat: THREE.Quaternion;
}

export const DEFAULT_PARTNER_URL = LOADOUT_DEFAULT_PARTNER_URL;
export const DEFAULT_RACKET_URL = LOADOUT_DEFAULT_RACKET_URL;

// Zuordnung Shop-ID -> 3D-Partnerdatei direkt aus loadout.ts (Single Source of Truth)
export const PARTNER_MODEL_MAP: Record<string, string> = Object.fromEntries(
  SHOP_PARTNERS.map((p) => [p.id, p.modelUrl])
);

// Zuordnung Shop-ID -> 3D-Schlägerdatei direkt aus loadout.ts (Single Source of Truth)
export const RACKET_MODEL_MAP: Record<string, string> = Object.fromEntries(
  SHOP_RACKETS.map((r) => [r.id, r.modelUrl])
);

export function resolvePartnerModelUrl(
  partnerId?: string | null,
  customUrl?: string
): string {
  if (customUrl) return customUrl;
  return resolvePartnerAsset(partnerId).url;
}

export function resolveRacketModelUrl(
  racketId?: string | null,
  customUrl?: string
): string {
  if (customUrl) return customUrl;
  return resolveRacketAsset(racketId).url;
}

/** Wärmt den useGLTF-Cache für einen Partner vor (sofortiger Wechsel im Shop/Profil) */
export function preloadAnimatedPartner(partnerId?: string | null): void {
  const { url } = resolvePartnerAsset(partnerId);
  useGLTF.preload(url, false, false);
}

export function preloadAllAnimatedPartners(): void {
  SHOP_PARTNERS.forEach((p) => {
    useGLTF.preload(p.modelUrl, false, false);
  });
}

// Hilfsfunktion zur direkten Zuordnung von GameLogic-Schlagnamen auf Animationen
export function mapShotTypeToPlayerAction(shotType?: string | null): PlayerAction {
  const s = (shotType || "").toUpperCase();
  if (s.includes("AUFSCHLAG") || s.includes("SERVE") || s.includes("SAQUE")) {
    return "serve";
  }
  if (s.includes("SMASH") || s.includes("REMATE")) return "smash";
  if (s.includes("VIBORA")) return "vibora";
  if (s.includes("BANDEJA")) return "bandeja";
  if (s.includes("BAJADA")) return "bajada";
  if (s.includes("VOLLEY") || s.includes("VOLEA")) return "volley";
  if (s.includes("LOB") || s.includes("GLOBO")) return "lob";
  if (s.includes("CHIQUITA")) return "chiquita";
  if (s.includes("BLOCK") || s.includes("BLOQUEO")) return "block";
  if (s.includes("RUECKHAND") || s.includes("BACKHAND") || s.includes("REVES")) {
    return "backhand";
  }
  return "forehand";
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

/** Wärmt den GLTFLoader-Cache für einen Schläger vor (sofortiger Wechsel im Spind) */
export function preloadAnimatedRacket(racketId?: string | null): void {
  const { url } = resolveRacketAsset(racketId);
  loadCachedRacketGlb(url).catch(() => {});
}

export function preloadAllAnimatedRackets(): void {
  SHOP_RACKETS.forEach((r) => {
    loadCachedRacketGlb(r.modelUrl).catch(() => {});
  });
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

// --- GRUNDSTELLUNG (CONTINENTAL-GRIFF: SCHLÄGERKANTE HOCHKANT NACH VORNE) ---
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

// --- SCHLÄGER-TRAGEPOSE WÄHREND DES LAUFENS (HÄLT DEN SCHLÄGER SEITLICH FREI) ---
const WALK_CARRY_ARM_BONES: BoneRotationMap = {
  RightArm: [-20, 43, -2],
  RightForeArm: [6, 18, -55],
  RightHand: [21, -2, -4],
};

// --- ALLE PADEL-SCHLÄGE IM CHARAKTERRAUM ---
export const SHOT_ANIMATIONS: Record<ShotAction, ShotAnimationDef> = {
  serve: {
    duration: 1.2,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Seitliche Aufschlag-Position: linke Hand lässt Ball vorne rechts fallen, Schläger auf Hüfthöhe zurück
        at: 0.34,
        pose: {
          hipsY: -0.06,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, -38, 0],
            Spine: [10, -20, 0],
            Spine1: [6, -12, 0],
            Head: [-4, 46, 0],
            RightArm: [-11, 14, -7],
            RightForeArm: [5, 16, -18],
            RightHand: [-22, 12, -14],
            LeftArm: [-12, 13, 23],
            LeftForeArm: [-35, -45, 55],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Unterhand-Treffpunkt unter Hüfthöhe mit leichter Slice-Öffnung
        at: 0.58,
        pose: {
          hipsY: -0.07,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, -6, 0],
            Spine: [10, 4, 0],
            Spine1: [6, 6, 0],
            Head: [-6, 4, 0],
            RightArm: [-55, 22, 6],
            RightForeArm: [-2, 4, 12],
            RightHand: [26, -13, 1],
            LeftArm: [-12, -19, 8],
            LeftForeArm: [-38, -47, 41],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Kontrollierter Auslauf hoch zur linken Schulter
        at: 0.82,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, 24, 0],
            Spine: [6, 18, 0],
            Spine1: [4, 12, 0],
            Head: [-4, -26, 0],
            RightArm: [-61, 30, -28],
            RightForeArm: [-68, 2, 44],
            RightHand: [2, 5, 8],
            LeftArm: [-40, 22, -21],
            LeftForeArm: [-22, -10, 40],
            LeftHand: [0, 0, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

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
        at: 0.32,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [8, 34, 0],
            Spine: [10, 22, 0],
            Spine1: [6, 16, 0],
            Head: [-6, -42, 0],
            RightArm: [-14, 42, -35],
            RightForeArm: [-22, 69, -48],
            RightHand: [0, 10, 2],
            LeftArm: [-51, -95, 19],
            LeftForeArm: [-19, -46, 37],
            LeftHand: [6, 0, 0],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, 4, 0],
            Spine: [8, 4, 0],
            Spine1: [4, 0, 0],
            Head: [-4, -6, 0],
            RightArm: [-24, 77, -50],
            RightForeArm: [35, -3, 23],
            RightHand: [30, -25, 12],
            LeftArm: [28, -22, 18],
            LeftForeArm: [-35, -35, 10],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        at: 0.8,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -18, 0],
            Spine: [4, -14, 0],
            Spine1: [2, -10, 0],
            Head: [-4, 24, 0],
            RightArm: [-23, 76, -49],
            RightForeArm: [15, -2, 5],
            RightHand: [3, 1, 11],
            LeftArm: [48, 0, 32],
            LeftForeArm: [-28, -25, 5],
            LeftHand: [0, 0, 0],
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
            Hips: [8, -16, 0],
            Spine: [10, -12, 0],
            Spine1: [6, -8, 0],
            Head: [-6, 20, 0],
            RightArm: [-54, 85, -1],
            RightForeArm: [25, -25, -55],
            RightHand: [30, -9, 7],
            LeftArm: [-19, -8, 27],
            LeftForeArm: [-42, -59, 55],
            LeftHand: [4, 0, 0],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, 4, 0],
            Spine: [12, 4, 0],
            Spine1: [6, 2, 0],
            Head: [-6, -6, 0],
            LeftUpLeg: [-30, 0, 6],
            LeftLeg: [46, 0, 0],
            RightArm: [-61, 73, 16],
            RightForeArm: [35, -49, -55],
            RightHand: [30, 0, -7],
            LeftArm: [-3, -16, 19],
            LeftForeArm: [-45, -54, 47],
            LeftHand: [0, 0, 0],
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
        at: 0.34,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -46, 0],
            Spine: [4, -20, 4],
            Spine1: [-2, -14, 4],
            Head: [-12, 50, 0],
            RightArm: [-77, 75, -20],
            RightForeArm: [6, 11, -6],
            RightHand: [14, -1, 19],
            LeftArm: [-114, -48, 74],
            LeftForeArm: [16, -14, 14],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        at: 0.58,
        pose: {
          hipsY: -0.05,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -12, 0],
            Spine: [6, -4, -4],
            Spine1: [4, 2, 0],
            Head: [-8, 12, 0],
            RightArm: [-79, 92, -18],
            RightForeArm: [35, 6, 21],
            RightHand: [30, -11, 29],
            LeftArm: [-28, -42, 4],
            LeftForeArm: [-25, -45, 25],
            LeftHand: [0, 0, 0],
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
            Spine: [10, 16, 0],
            Spine1: [4, 10, 0],
            Head: [-6, -24, 0],
            RightArm: [-21, 53, -13],
            RightForeArm: [-46, 38, -13],
            RightHand: [4, -1, 12],
            LeftArm: [-12, -32, 10],
            LeftForeArm: [-30, -40, 20],
            LeftHand: [0, 0, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  vibora: {
    duration: 1.15,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Enge seitliche Spannung hinter dem Kopf, Ellbogen hoch, linker Arm zeigt frei hoch-links
        at: 0.34,
        pose: {
          hipsY: -0.09,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -52, 0],
            Spine: [2, -24, 6],
            Spine1: [-4, -16, 4],
            Head: [-12, 56, 0],
            RightArm: [-76, 70, -9],
            RightForeArm: [4, 8, -38],
            RightHand: [6, -2, -2],
            LeftArm: [-114, -43, 73],
            LeftForeArm: [14, -12, 18],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Aggressiver Seitwärts-Peitschenschlag auf Ohrhöhe mit Side-Spin
        at: 0.56,
        pose: {
          hipsY: -0.04,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [6, -4, 0],
            Spine: [8, 6, -6],
            Spine1: [4, 8, -4],
            Head: [-8, 2, 0],
            RightArm: [-74, 52, -51],
            RightForeArm: [35, 33, 25],
            RightHand: [24, 4, 15],
            LeftArm: [-26, -40, 6],
            LeftForeArm: [-28, -42, 24],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Schneller Durchschwung um die linke Schulter/Brust
        at: 0.8,
        pose: {
          hipsY: -0.07,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, 30, 0],
            Spine: [12, 22, -4],
            Spine1: [6, 14, 0],
            Head: [-6, -30, 0],
            RightArm: [-44, 38, -62],
            RightForeArm: [-78, -8, 52],
            RightHand: [-4, 0, 0],
            LeftArm: [22, -24, 14],
            LeftForeArm: [-36, -30, 10],
            LeftHand: [0, 0, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  bajada: {
    duration: 1.15,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Hohe Vorbereitung nach der Rückscheibe: Schläger hoch über der rechten Schulter
        at: 0.34,
        pose: {
          hipsY: -0.06,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [4, -48, 0],
            Spine: [0, -22, 6],
            Spine1: [-4, -14, 4],
            Head: [-10, 50, 0],
            RightArm: [-72, 73, -27],
            RightForeArm: [16, 18, -14],
            RightHand: [2, 5, 12],
            LeftArm: [-72, 5, 88],
            LeftForeArm: [-3, -23, 29],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Druckvoller Angriffs-Treffpunkt von oben nach vorne-unten
        at: 0.56,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, 8, 0],
            Spine: [12, 12, -4],
            Spine1: [8, 10, 0],
            Head: [-8, -14, 0],
            RightArm: [11, 32, -69],
            RightForeArm: [35, -26, -55],
            RightHand: [30, 21, 27],
            LeftArm: [14, -26, 12],
            LeftForeArm: [-34, -36, 14],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Tiefer Auslauf über die linke Hüfte
        at: 0.8,
        pose: {
          hipsY: -0.1,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, 32, 0],
            Spine: [16, 22, -4],
            Spine1: [10, 14, 0],
            Head: [-10, -34, 0],
            RightArm: [36, 89, -45],
            RightForeArm: [35, -36, -55],
            RightHand: [0, 21, 18],
            LeftArm: [26, -24, 14],
            LeftForeArm: [-38, -30, 10],
            LeftHand: [0, 0, 0],
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
        at: 0.34,
        pose: {
          hipsY: -0.1,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [2, -48, 0],
            Spine: [-4, -22, 6],
            Spine1: [-8, -14, 6],
            Head: [-16, 52, 0],
            LeftUpLeg: [-28, 0, 6],
            LeftLeg: [46, 0, 0],
            RightUpLeg: [-28, 0, -6],
            RightLeg: [46, 0, 0],
            RightArm: [-75, 69, -18],
            RightForeArm: [5, 12, -27],
            RightHand: [2, 1, 6],
            LeftArm: [-102, -38, 69],
            LeftForeArm: [15, -14, 15],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        at: 0.56,
        pose: {
          hipsY: 0.05,
          bones: {
            Hips: [-2, 6, 0],
            Spine: [-4, 8, -6],
            Spine1: [-2, 6, -4],
            Head: [-14, -6, 0],
            LeftUpLeg: [-6, 0, 4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-8, 0, -4],
            RightLeg: [16, 0, 0],
            RightArm: [-3, 34, -95],
            RightForeArm: [35, 27, -34],
            RightHand: [27, 24, 14],
            LeftArm: [-34, -47, -2],
            LeftForeArm: [-7, -17, -16],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        at: 0.8,
        pose: {
          hipsY: -0.08,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [12, 28, 0],
            Spine: [14, 20, -6],
            Spine1: [8, 12, 0],
            Head: [-8, -28, 0],
            RightArm: [1, 44, -70],
            RightForeArm: [-61, -17, 52],
            RightHand: [5, -3, 6],
            LeftArm: [26, -24, 14],
            LeftForeArm: [-38, -30, 10],
            LeftHand: [0, 0, 0],
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
          hipsY: -0.16,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, -26, 0],
            Spine: [14, -14, 0],
            Spine1: [10, -10, 0],
            Head: [-14, 28, 0],
            LeftUpLeg: [-42, 0, 6],
            LeftLeg: [70, 0, 0],
            LeftFoot: [-26, 0, 0],
            RightUpLeg: [-42, 0, -6],
            RightLeg: [70, 0, 0],
            RightFoot: [-26, 0, 0],
            RightArm: [-60, 50, 10],
            RightForeArm: [-34, 7, 27],
            RightHand: [4, -4, 18],
            LeftArm: [-7, 41, 27],
            LeftForeArm: [-64, -66, 55],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        at: 0.72,
        pose: {
          hipsY: 0.01,
          bones: {
            Hips: [0, 18, 0],
            Spine: [-2, 14, 0],
            Spine1: [-2, 10, 0],
            Head: [-12, -18, 0],
            LeftUpLeg: [-6, 0, 4],
            LeftLeg: [12, 0, 0],
            RightUpLeg: [-6, 0, -4],
            RightLeg: [12, 0, 0],
            RightArm: [-95, -10, 11],
            RightForeArm: [-14, -55, 55],
            RightHand: [30, -9, 30],
            LeftArm: [18, -25, 18],
            LeftForeArm: [-32, -35, 12],
            LeftHand: [0, 0, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  chiquita: {
    duration: 0.95,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Tiefe Kniebeuge, sehr kurzer tiefer Ansatz rechts vor dem Körper
        at: 0.34,
        pose: {
          hipsY: -0.15,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [14, -20, 0],
            Spine: [14, -12, 0],
            Spine1: [10, -8, 0],
            Head: [-14, 24, 0],
            LeftUpLeg: [-38, 0, 6],
            LeftLeg: [64, 0, 0],
            LeftFoot: [-24, 0, 0],
            RightUpLeg: [-38, 0, -6],
            RightLeg: [64, 0, 0],
            RightFoot: [-24, 0, 0],
            RightArm: [-68, 43, 28],
            RightForeArm: [-23, 22, 2],
            RightHand: [28, -10, 15],
            LeftArm: [-14, 11, 23],
            LeftForeArm: [-57, -65, 55],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Weicher, kontrollierter Push vor die Füße der Netzspieler
        at: 0.64,
        pose: {
          hipsY: -0.12,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [12, 8, 0],
            Spine: [12, 8, 0],
            Spine1: [8, 6, 0],
            Head: [-10, -10, 0],
            LeftUpLeg: [-32, 0, 6],
            LeftLeg: [54, 0, 0],
            LeftFoot: [-20, 0, 0],
            RightUpLeg: [-32, 0, -6],
            RightLeg: [54, 0, 0],
            RightFoot: [-20, 0, 0],
            RightArm: [-48, 41, -27],
            RightForeArm: [-65, -40, 35],
            RightHand: [25, -20, 25],
            LeftArm: [-17, -40, 13],
            LeftForeArm: [-43, -55, 35],
            LeftHand: [0, 0, 0],
          },
        },
      },
      { at: 1.0, pose: IDLE_POSE },
    ],
  },

  block: {
    duration: 0.65,
    frames: [
      { at: 0.0, pose: IDLE_POSE },
      {
        // Tiefe, stabile Abwehrposition mit kompakter Schlägerwand vor der Brust
        at: 0.28,
        pose: {
          hipsY: -0.11,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [10, -10, 0],
            Spine: [12, -8, 0],
            Spine1: [8, -4, 0],
            Head: [-10, 10, 0],
            LeftUpLeg: [-30, 0, 8],
            LeftLeg: [50, 0, 0],
            RightUpLeg: [-30, 0, -8],
            RightLeg: [50, 0, 0],
            RightArm: [-35, 95, -14],
            RightForeArm: [35, -41, -55],
            RightHand: [30, -6, 1],
            LeftArm: [-23, -20, 16],
            LeftForeArm: [-43, -59, 55],
            LeftHand: [0, 0, 0],
          },
        },
      },
      {
        // Kurzes Abfedern ohne Ausholen
        at: 0.58,
        pose: {
          hipsY: -0.12,
          bones: {
            ...IDLE_POSE.bones,
            Hips: [12, 2, 0],
            Spine: [12, 2, 0],
            Spine1: [8, 2, 0],
            Head: [-10, -2, 0],
            LeftUpLeg: [-32, 0, 8],
            LeftLeg: [54, 0, 0],
            RightUpLeg: [-32, 0, -8],
            RightLeg: [54, 0, 0],
            RightArm: [-41, 83, -9],
            RightForeArm: [35, -61, -55],
            RightHand: [30, 0, -20],
            LeftArm: [-17, -36, 20],
            LeftForeArm: [-47, -58, 49],
            LeftHand: [0, 0, 0],
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
    new THREE.MeshStandardMaterial({
      color: "#0b1120",
      roughness: 0.45,
      metalness: 0.5,
    }),
    new THREE.MeshStandardMaterial({
      color: "#0ea5e9",
      roughness: 0.35,
      metalness: 0.7,
    }),
  ]);
  racket.add(body);

  return racket;
}

function clearRacketMount(mount: THREE.Group) {
  while (mount.children.length > 0) {
    const child = mount.children[0];
    mount.remove(child);
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
  partnerId?: string | null;
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

const WALK_FALLBACK_TIME_SCALE = 0.6;

export default function AnimatedPadelPlayer({
  partnerId = "partner_rookie",
  modelUrl,
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
  const resolvedPartnerAsset = useMemo(() => {
    if (modelUrl) {
      return {
        url: modelUrl,
        hasWalkingClip: true,
        racketOffset: undefined as RacketTransform | undefined,
      };
    }
    const asset = resolvePartnerAsset(partnerId);
    return {
      url: asset.url,
      hasWalkingClip: asset.hasWalkingClip,
      racketOffset: asset.racketOffset,
    };
  }, [partnerId, modelUrl]);

  const { scene, animations } = useGLTF(resolvedPartnerAsset.url, false, false);
  const clonedScene = useMemo(() => cloneSkinned(scene), [scene]);

  const bonesMapRef = useRef(new Map<string, THREE.Bone>());
  const restLocalQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const restCharQuatInvRef = useRef(new Map<string, THREE.Quaternion>());
  const fingerGripQuatRef = useRef(new Map<string, THREE.Quaternion>());
  const handAlignRef = useRef<{
    right: HandAlignData | null;
    left: HandAlignData | null;
  }>({ right: null, left: null });

  const restHipsYRef = useRef<number>(0.97);
  const racketMountRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkClipTimeScaleRef = useRef<number>(1);

  const shotElapsedRef = useRef<number>(0);
  const shotDoneRef = useRef<boolean>(false);

  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const tmpCharDelta = useMemo(() => new THREE.Quaternion(), []);
  const tmpLocalDelta = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatA = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatB = useMemo(() => new THREE.Quaternion(), []);
  const tmpTargetQuat = useMemo(() => new THREE.Quaternion(), []);

  const resolvedRacketAsset = useMemo(() => {
    if (racketUrl) {
      return { url: racketUrl, offset: undefined as RacketTransform | undefined };
    }
    const asset = resolveRacketAsset(racketId);
    return { url: asset.url, offset: asset.offset };
  }, [racketId, racketUrl]);

  // 1. Bind-Pose erfassen, Hand-Ausrichtung prüfen, Charakterraum-Quaternionen & Schläger-Mount an RightHand anlegen
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
    clonedScene.updateMatrixWorld(true);

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

    // Automatische Hand-Roll-Erkennung: gleicht Modelle mit rückwärts gerichteten Handflächen (Partner 1–4)
    // auf Leos Referenz-Bind-Pose (Handfläche +Z nach vorne) ab, ohne Leo zu verändern.
    const invRootMat = clonedScene.matrixWorld.clone().invert();
    const getPosChar = (bone: THREE.Bone) =>
      new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(invRootMat);

    const computeHandAlign = (side: "Right" | "Left"): HandAlignData | null => {
      const foreArmBone = bonesMap.get(`${side}ForeArm`);
      const handBone = bonesMap.get(`${side}Hand`);
      const indexBone = bonesMap.get(`${side}HandIndex1`);
      const middleBone = bonesMap.get(`${side}HandMiddle1`);
      const pinkyBone = bonesMap.get(`${side}HandPinky1`);
      if (!foreArmBone || !handBone || !indexBone || !middleBone || !pinkyBone) {
        return null;
      }

      const pForeArm = getPosChar(foreArmBone);
      const pHand = getPosChar(handBone);
      const pIndex = getPosChar(indexBone);
      const pMiddle = getPosChar(middleBone);
      const pPinky = getPosChar(pinkyBone);

      const vForeArmChar = pHand.clone().sub(pForeArm);
      const vFingersChar = pMiddle.clone().sub(pHand);
      const vThumbChar = pIndex.clone().sub(pPinky);
      if (
        vForeArmChar.lengthSq() < 1e-8 ||
        vFingersChar.lengthSq() < 1e-8 ||
        vThumbChar.lengthSq() < 1e-8
      ) {
        return null;
      }
      vForeArmChar.normalize();
      vFingersChar.normalize();
      vThumbChar.addScaledVector(vFingersChar, -vThumbChar.dot(vFingersChar)).normalize();

      const vPalmChar =
        side === "Right"
          ? new THREE.Vector3().crossVectors(vThumbChar, vFingersChar).normalize()
          : new THREE.Vector3().crossVectors(vFingersChar, vThumbChar).normalize();

      const targetPalm = new THREE.Vector3(0, 0, 1);
      targetPalm.addScaledVector(vFingersChar, -targetPalm.dot(vFingersChar));
      if (targetPalm.lengthSq() < 1e-6) return null;
      targetPalm.normalize();

      const cosA = THREE.MathUtils.clamp(vPalmChar.dot(targetPalm), -1, 1);
      const sinA = vFingersChar.dot(new THREE.Vector3().crossVectors(vPalmChar, targetPalm));
      let rollRad = Math.atan2(sinA, cosA);

      // Deadzone: Leo und bereits korrekt gedrehte Rigs bleiben 100 % unverändert
      if (Math.abs(rollRad) < THREE.MathUtils.degToRad(25)) {
        return null;
      }

      // Bei ~180° anatomisch natürliche Supinationsrichtung (innen herum) erzwingen
      if (Math.abs(rollRad) > THREE.MathUtils.degToRad(150)) {
        rollRad = side === "Right" ? Math.abs(rollRad) : -Math.abs(rollRad);
      }

      const foreArmFixChar = new THREE.Quaternion().setFromAxisAngle(
        vForeArmChar,
        rollRad * 0.7
      );
      const foreArmFixCharInv = foreArmFixChar.clone().invert();
      const handFixChar = new THREE.Quaternion().setFromAxisAngle(
        vFingersChar,
        rollRad * 0.3
      );

      // Exakte anatomische Handbasis im Hand-Lokalraum für Schläger-Mount & Fingerbeugung
      const invHandMat = handBone.matrixWorld.clone().invert();
      const getPosHandLocal = (bone: THREE.Bone) =>
        new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(invHandMat);

      const uFingers = getPosHandLocal(middleBone).normalize();
      const uThumb = getPosHandLocal(indexBone).sub(getPosHandLocal(pinkyBone));
      uThumb.addScaledVector(uFingers, -uThumb.dot(uFingers)).normalize();
      const uPalm =
        side === "Right"
          ? new THREE.Vector3().crossVectors(uThumb, uFingers).normalize()
          : new THREE.Vector3().crossVectors(uFingers, uThumb).normalize();

      const basisX = side === "Right" ? uThumb : uThumb.clone().negate();
      const basisMat = new THREE.Matrix4().makeBasis(basisX, uFingers, uPalm);
      const handBasisLocalQuat = new THREE.Quaternion().setFromRotationMatrix(basisMat);

      return {
        foreArmFixChar,
        foreArmFixCharInv,
        handFixChar,
        handBasisLocalQuat,
      };
    };

    const rightAlign = computeHandAlign("Right");
    const leftAlign = computeHandAlign("Left");
    handAlignRef.current = { right: rightAlign, left: leftAlign };

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

      const alignForHand = spec.hand === "RightHand" ? rightAlign : leftAlign;
      if (alignForHand) {
        axisVec.applyQuaternion(alignForHand.handBasisLocalQuat);
      }

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

    // Walking-Clip bevorzugen; bei Partnern ohne Walking-Clip auf gedrosseltes Running ausweichen
    const exactWalkClip = animations.find((clip) => clip.name === "Walking") || null;
    const walkClip =
      exactWalkClip ||
      animations.find((clip) => clip.name === "Running") ||
      animations[0] ||
      null;
    walkActionRef.current = walkClip ? mixer.clipAction(walkClip) : null;
    walkClipTimeScaleRef.current =
      exactWalkClip && resolvedPartnerAsset.hasWalkingClip
        ? 1
        : WALK_FALLBACK_TIME_SCALE;

    const rightHandBone = bonesMap.get("RightHand");
    let mount: THREE.Group | null = null;
    let handBasisGroup: THREE.Group | null = null;
    if (rightHandBone) {
      const partnerOffset = resolvedPartnerAsset.racketOffset;
      const pPos = partnerOffset?.position;
      const pRot = partnerOffset?.rotation;
      const pScale = partnerOffset?.scale;

      mount = new THREE.Group();
      mount.name = "PadelRacketMount";
      mount.position.set(
        0.0 + (pPos ? pPos[0] : 0),
        0.078 + (pPos ? pPos[1] : 0),
        0.026 + (pPos ? pPos[2] : 0)
      );
      mount.rotation.set(
        pRot ? pRot[0] : 0,
        pRot ? pRot[1] : 0,
        THREE.MathUtils.degToRad(-56) + (pRot ? pRot[2] : 0)
      );
      if (typeof pScale === "number") {
        mount.scale.setScalar(pScale);
      } else if (pScale) {
        mount.scale.set(pScale[0], pScale[1], pScale[2]);
      }
      mount.visible = showRacket;

      if (rightAlign) {
        handBasisGroup = new THREE.Group();
        handBasisGroup.name = "PadelRacketHandBasis";
        handBasisGroup.quaternion.copy(rightAlign.handBasisLocalQuat);
        handBasisGroup.add(mount);
        rightHandBone.add(handBasisGroup);
      } else {
        rightHandBone.add(mount);
      }
      racketMountRef.current = mount;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      walkActionRef.current = null;
      handAlignRef.current = { right: null, left: null };

      if (rightHandBone) {
        if (mount) clearRacketMount(mount);
        if (handBasisGroup) {
          rightHandBone.remove(handBasisGroup);
        } else if (mount) {
          rightHandBone.remove(mount);
        }
      }
      racketMountRef.current = null;
    };
  }, [clonedScene, animations, resolvedPartnerAsset.hasWalkingClip, resolvedPartnerAsset.racketOffset]);

  // 2. Echten 3D-Schläger (.glb) asynchron & gecacht in den Griff-Mount laden
  useEffect(() => {
    const mount = racketMountRef.current;
    if (!mount) return undefined;

    let cancelled = false;
    const { url, offset } = resolvedRacketAsset;

    const attachSceneToMount = (
      loadedScene: THREE.Group,
      applyOffset?: RacketTransform
    ) => {
      if (cancelled || !racketMountRef.current) return;
      clearRacketMount(racketMountRef.current);

      const clone = loadedScene.clone(true);
      const pos = applyOffset?.position;
      const rot = applyOffset?.rotation;
      const scl = applyOffset?.scale;

      clone.position.set(
        pos ? pos[0] : 0,
        -0.032 + (pos ? pos[1] : 0),
        pos ? pos[2] : 0
      );

      if (rot) {
        clone.rotation.set(rot[0], rot[1], rot[2]);
      }

      if (typeof scl === "number") {
        clone.scale.setScalar(scl);
      } else if (scl) {
        clone.scale.set(scl[0], scl[1], scl[2]);
      } else {
        clone.scale.setScalar(1);
      }

      racketMountRef.current.add(clone);
    };

    const attachProceduralFallback = () => {
      if (!cancelled && racketMountRef.current) {
        clearRacketMount(racketMountRef.current);
        const fb = buildFallbackRacketGroup();
        fb.position.set(0, -0.032, 0);
        racketMountRef.current.add(fb);
      }
    };

    loadCachedRacketGlb(url)
      .then((loaded) => attachSceneToMount(loaded, offset))
      .catch(() => {
        if (url !== DEFAULT_RACKET_URL) {
          const fallbackOffset = resolveRacketAsset().offset;
          loadCachedRacketGlb(DEFAULT_RACKET_URL)
            .then((loaded) => attachSceneToMount(loaded, fallbackOffset))
            .catch(attachProceduralFallback);
        } else {
          attachProceduralFallback();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedRacketAsset, clonedScene]);

  useEffect(() => {
    if (racketMountRef.current) {
      racketMountRef.current.visible = showRacket;
    }
  }, [showRacket]);

  // 3. Eingebetteten "Walking"-Clip (bzw. Running-Fallback) steuern oder für prozedurale Schläge stoppen
  useEffect(() => {
    shotElapsedRef.current = 0;
    shotDoneRef.current = false;

    const walkAction = walkActionRef.current;
    if (!walkAction) return;

    if (action === "walk") {
      walkAction.reset();
      walkAction.setEffectiveTimeScale(walkClipTimeScaleRef.current);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.play();
    } else {
      walkAction.stop();
    }
  }, [action, triggerKey, clonedScene]);

  // 4. Render-Loop: Walking-Mixer (mit Schläger-Tragekorrektur) ODER prozedurale Schläge
  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.05);
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
      useGrip: boolean,
      applyHandAlign: boolean
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

      const qChar = restChar.get(key);
      const qCharInv = restCharInv.get(key);
      if (!qChar || !qCharInv) {
        out.copy(qRestLocal);
        return;
      }

      const align = applyHandAlign ? handAlignRef.current : null;
      const rightAlign = align?.right;
      const leftAlign = align?.left;

      const isAlignedBone =
        (key === "RightForeArm" && !!rightAlign) ||
        (key === "RightHand" && !!rightAlign) ||
        (key === "LeftForeArm" && !!leftAlign) ||
        (key === "LeftHand" && !!leftAlign);

      if (!deg && !isAlignedBone) {
        out.copy(qRestLocal);
        return;
      }

      if (deg) {
        tmpEuler.set(
          THREE.MathUtils.degToRad(deg[0]),
          THREE.MathUtils.degToRad(deg[1]),
          THREE.MathUtils.degToRad(deg[2]),
          "XYZ"
        );
        tmpCharDelta.setFromEuler(tmpEuler);
      } else {
        tmpCharDelta.identity();
      }

      if (key === "RightForeArm" && rightAlign) {
        tmpCharDelta.multiply(rightAlign.foreArmFixChar);
      } else if (key === "RightHand" && rightAlign) {
        tmpCharDelta
          .premultiply(rightAlign.foreArmFixCharInv)
          .multiply(rightAlign.foreArmFixChar)
          .multiply(rightAlign.handFixChar);
      } else if (key === "LeftForeArm" && leftAlign) {
        tmpCharDelta.multiply(leftAlign.foreArmFixChar);
      } else if (key === "LeftHand" && leftAlign) {
        tmpCharDelta
          .premultiply(leftAlign.foreArmFixCharInv)
          .multiply(leftAlign.foreArmFixChar)
          .multiply(leftAlign.handFixChar);
      }

      tmpLocalDelta.copy(qCharInv).multiply(tmpCharDelta).multiply(qChar);
      out.copy(qRestLocal).multiply(tmpLocalDelta);
    };

    if (action === "walk") {
      if (mixerRef.current) {
        mixerRef.current.update(safeDelta * speed);
      }

      // Schläger beim Laufen sauber seitlich tragen (kein Durchschwingen durch den Bauch)
      if (showRacket) {
        const carryBones: Array<"RightArm" | "RightForeArm" | "RightHand"> = [
          "RightArm",
          "RightForeArm",
          "RightHand",
        ];
        carryBones.forEach((bKey) => {
          const bone = bonesMap.get(bKey);
          const deg = WALK_CARRY_ARM_BONES[bKey];
          if (!bone || !deg) return;
          computeTargetBoneQuat(bKey, deg, tmpTargetQuat, false, true);
          // 78 % Tragepose + 22 % natürlicher Lauf-Rhythmus aus dem Clip
          bone.quaternion.slerp(tmpTargetQuat, 0.78);
        });

        // Finger der rechten Hand bleiben auch beim Laufen fest um den Griff geschlossen
        fingerGrip.forEach((gripQ, fKey) => {
          if (!fKey.startsWith("RightHand")) return;
          const fBone = bonesMap.get(fKey);
          if (fBone) fBone.quaternion.copy(gripQ);
        });
      }
      return;
    }

    const blendAlpha = 1 - Math.exp(-safeDelta * 14);
    const tClock = state.clock.elapsedTime;

    const applyPose = (
      pose: BonePoseSpec,
      breathe: boolean,
      useGrip: boolean,
      applyHandAlign: boolean
    ) => {
      const hips = bonesMap.get("Hips");
      if (hips) {
        const bob = breathe ? Math.sin(tClock * 3.4) * 0.014 : 0;
        const targetY = restHipsYRef.current + (pose.hipsY ?? 0) + bob;
        hips.position.y = THREE.MathUtils.lerp(hips.position.y, targetY, blendAlpha);
      }

      bonesMap.forEach((bone, key) => {
        computeTargetBoneQuat(key, pose.bones[key], tmpTargetQuat, useGrip, applyHandAlign);
        bone.quaternion.slerp(tmpTargetQuat, blendAlpha);
      });
    };

    if (action === "a_pose") {
      applyPose({ hipsY: 0, bones: {} }, false, false, true);
      return;
    }

    if (action === "idle") {
      applyPose(IDLE_POSE, true, true, true);
      return;
    }

    const shotDef = SHOT_ANIMATIONS[action];
    if (!shotDef) {
      applyPose(IDLE_POSE, true, true, true);
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
      computeTargetBoneQuat(key, prevFrame.pose.bones[key], tmpQuatA, true, true);
      computeTargetBoneQuat(key, nextFrame.pose.bones[key], tmpQuatB, true, true);
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
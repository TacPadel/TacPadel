import { getAppLanguage } from "./i18n";

export type SkillFocus = "classic" | "power" | "control" | "defense" | "agility";

export interface ShopItem {
  id: string;
  name: string;
  focus: SkillFocus;
  tier: number; // Stufe 0 = Klassik, Stufe 1 = Basis-Spezialisierung (bereit für spätere Stufen)
  price: number;
  reqScore: number;
  badge: string;
  perk?: string;
  shotType?: string; // Für Spezial-Schläge: Welcher Schlag im Spiel geboostet wird
  modifiers: {
    smash: number;
    control: number;
    defense: number;
    agility: number;
  };
}

// =========================================================
// 1. KI-TEAMPARTNER (1x Klassik + 4x Skill-Fokus)
// =========================================================
export const SHOP_PARTNERS: ShopItem[] = [
  // 0. KLASSIK (Keine Buffs)
  {
    id: "partner_rookie",
    name: "Leo 'Base' Vega",
    focus: "classic",
    tier: 0,
    price: 0,
    reqScore: 0,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Clásico" : l === "en" ? "Classic" : "Klassik";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Juego equilibrado sin bonificaciones ni penalizaciones"
        : l === "en"
        ? "Balanced baseline play without buffs or penalties"
        : "Ausgeglichenes Basis-Spiel ohne Buffs oder Mali";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },

  // 1. POWER-FOKUS (+2 Smash, -2 Defense, -1 Control, 0 Agility)
  {
    id: "partner_cannon",
    name: "Diego 'El Cañón' Morales",
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia I" : "Power I";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista ofensivo: busca definir fuerte en la red (+2 PWR)"
        : l === "en"
        ? "Offensive specialist: looks to finish hard at the net (+2 PWR)"
        : "Offensiv-Spezialist: Sucht den harten Abschluss am Netz (+2 PWR)";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },

  // 2. CONTROL-FOKUS (+2 Control, -2 Smash, -1 Agility, 0 Defense)
  {
    id: "partner_tactician",
    name: "Sofia 'La Profesora' Navarro",
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      return "Control I";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista en control: coloca globos y chiquitas precisas (+2 CTRL)"
        : l === "en"
        ? "Control specialist: places pinpoint lobs and chiquitas (+2 CTRL)"
        : "Kontroll-Spezialistin: Spielt präzise Lobs und Chiquitas (+2 CTRL)";
    },
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },

  // 3. DEFENSE-FOKUS (+2 Defense, -2 Smash, -1 Agility, 0 Control)
  {
    id: "partner_wall",
    name: "Mateo 'El Muro' Ruiz",
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa I" : "Defense I";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista defensivo: devuelve bolas difíciles desde el cristal (+2 DEF)"
        : l === "en"
        ? "Defensive specialist: digs out tough balls off the back glass (+2 DEF)"
        : "Defensiv-Spezialist: Holt schwere Bälle von der Glaswand (+2 DEF)";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },

  // 4. AGILITY-FOKUS (+2 Agility, -2 Defense, -1 Control, 0 Smash)
  {
    id: "partner_runner",
    name: "Lucas 'El Rayo' Silva",
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad I" : "Agility I";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista en velocidad: cubre huecos rápido y ahorra energía (+2 AGI)"
        : l === "en"
        ? "Speed specialist: covers court gaps fast and saves stamina (+2 AGI)"
        : "Tempo-Spezialist: Schließt Lücken schnell & spart Ausdauer (+2 AGI)";
    },
    modifiers: { smash: 0, control: -1, defense: -2, agility: 2 },
  },
];

// =========================================================
// 2. SCHLÄGER / RACKETS (1x Klassik + 4x Skill-Fokus)
// =========================================================
export const SHOP_RACKETS: ShopItem[] = [
  // 0. KLASSIK (Keine Buffs)
  {
    id: "racket_starter",
    name: "Classic Allround Frame",
    focus: "classic",
    tier: 0,
    price: 0,
    reqScore: 0,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Clásico" : l === "en" ? "Classic" : "Klassik";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },

  // 1. POWER-SCHLÄGER (+2 Smash, -2 Defense, -1 Control, 0 Agility)
  {
    id: "racket_eclipse",
    name: "Diamond Striker",
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia I" : "Power I";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },

  // 2. CONTROL-SCHLÄGER (+2 Control, -2 Smash, -1 Agility, 0 Defense)
  {
    id: "racket_titan",
    name: "Precision Round CTRL",
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      return "Control I";
    },
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },

  // 3. DEFENSE-SCHLÄGER (+2 Defense, -2 Smash, -1 Agility, 0 Control)
  {
    id: "racket_shield",
    name: "Guardian Soft Core",
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa I" : "Defense I";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },

  // 4. AGILITY-SCHLÄGER (+2 Agility, -2 Defense, -1 Control, 0 Smash)
  {
    id: "racket_aero",
    name: "Aero Featherlight",
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad I" : "Agility I";
    },
    modifiers: { smash: 0, control: -1, defense: -2, agility: 2 },
  },
];

// =========================================================
// 3. SPEZIAL-SCHLÄGE / SHOTS (1x Klassik + 4x Skill-Fokus)
// =========================================================
export const SHOP_SHOTS: ShopItem[] = [
  // 0. KLASSIK (Keine Buffs)
  {
    id: "smash",
    name: "Klassik-Technik",
    focus: "classic",
    tier: 0,
    price: 0,
    reqScore: 0,
    shotType: "DRIVE",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Clásico" : l === "en" ? "Classic" : "Klassik";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },

  // 1. POWER-SCHLAG (+2 Smash, -2 Defense, -1 Control, 0 Agility)
  {
    id: "kick_x3",
    name: "Power-Smash Fokus",
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "SMASH",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia I" : "Power I";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },

  // 2. CONTROL-SCHLAG (+2 Control, -2 Smash, -1 Agility, 0 Defense)
  {
    id: "bandeja",
    name: "Bandeja-Control Fokus",
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "BANDEJA",
    get badge() {
      return "Control I";
    },
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },

  // 3. DEFENSE-SCHLAG (+2 Defense, -2 Smash, -1 Agility, 0 Control)
  {
    id: "shot_defense_wall",
    name: "Reflex-Block & Lob Fokus",
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "BLOCK",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa I" : "Defense I";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },

  // 4. AGILITY-SCHLAG (+2 Agility, -2 Defense, -1 Control, 0 Smash)
  {
    id: "vibora",
    name: "Tempo-Víbora & Chiquita Fokus",
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "VIBORA",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad I" : "Agility I";
    },
    modifiers: { smash: 0, control: -1, defense: -2, agility: 2 },
  },
];

// =========================================================
// 4. HILFSFUNKTION: PRÜFT TAC-SCORE VORAUSSETZUNG
// =========================================================
export function checkItemRequirement(item: ShopItem, userTacScore: number): boolean {
  return userTacScore >= item.reqScore;
}

// =========================================================
// 5. BERECHNUNG FÜR UI & MATCH-ENGINE (MIT HARD-CAPS)
// =========================================================
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function calculateLoadoutStats(
  partnerId?: string,
  racketId?: string,
  shotId?: string
) {
  const pId = partnerId || localStorage.getItem("tacpadel_partner_id") || "partner_rookie";
  const rId = racketId || localStorage.getItem("tacpadel_racket_id") || "racket_starter";
  const sId = shotId || localStorage.getItem("tacpadel_power_shot") || "smash";

  const partner = SHOP_PARTNERS.find((p) => p.id === pId) || SHOP_PARTNERS[0];
  const racket = SHOP_RACKETS.find((r) => r.id === rId) || SHOP_RACKETS[0];
  const shot = SHOP_SHOTS.find((s) => s.id === sId) || SHOP_SHOTS[0];

  const pMods = partner.modifiers;
  const rMods = racket.modifiers;
  const sMods = shot.modifiers;

  const diffs = {
    smash: pMods.smash + rMods.smash + sMods.smash,
    control: pMods.control + rMods.control + sMods.control,
    defense: pMods.defense + rMods.defense + sMods.defense,
    agility: pMods.agility + rMods.agility + sMods.agility,
  };

  const stats = {
    smash: 50 + diffs.smash,
    control: 50 + diffs.control,
    defense: 50 + diffs.defense,
    agility: 50 + diffs.agility,
  };

  // Auf Stufe 1 (Maximal +6 bei 3x gleichem Fokus) skalieren die Effekte spürbar,
  // lassen aber noch Raum für spätere Upgrade-Stufen (Tier 2 / Tier 3):
  const matchModifiers = {
    winnerChanceBonus: clamp((stats.smash - 50) * 0.008, -0.05, 0.12),
    errorReductionFactor: clamp(1 - (stats.control - 50) * 0.012, 0.82, 1.08),
    defenseSaveBonus: clamp((stats.defense - 50) * 0.01, -0.05, 0.14),
    staminaDrainMultiplier: clamp(1 - (stats.agility - 50) * 0.012, 0.82, 1.08),
  };

  return {
    stats,
    diffs,
    matchModifiers,
    partner,
    racket,
    shot,
  };
}
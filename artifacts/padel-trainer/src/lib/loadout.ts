import { getAppLanguage } from "./i18n";

export type SkillFocus = "classic" | "power" | "control" | "defense" | "agility";

export interface ShopItem {
  id: string;
  name: string;
  focus: SkillFocus;
  tier: number;
  price: number;
  reqScore: number;
  badge: string;
  perk?: string;
  shotType?: string;
  modifiers: {
    smash: number;
    control: number;
    defense: number;
    agility: number;
  };
}

// =========================================================
// RPG UPGRADE & XP SYSTEM (TYPEN & KONSTANTEN)
// =========================================================
export const MAX_ITEM_UPGRADE_LEVEL = 5; // +0 bis +5

export interface ItemProgress {
  level: number;
  xp: number;
}

export type ItemProgressMap = Record<string, ItemProgress>;

export interface UpgradedItemDetails {
  item: ShopItem;
  level: number;
  displayName: string;
  xp: number;
  reqXp: number;
  upgradeCostTp: number;
  canUpgrade: boolean;
  isMaxLevel: boolean;
  effectiveModifiers: {
    smash: number;
    control: number;
    defense: number;
    agility: number;
  };
}

// Migriert alte Schlag-IDs (kick_x3 / vibora) nahtlos auf die neuen Basis-Schläge (volley / chiquita)
export function normalizeShotId(rawId?: string | null): string {
  if (!rawId) return "smash";
  if (rawId === "kick_x3") return "volley";
  if (rawId === "vibora") return "chiquita";
  return rawId;
}

// =========================================================
// MATCH-LOCK: VERHINDERT LOADOUT-WECHSEL IM LAUFENDEN SPIEL
// =========================================================
export function getActiveMatchLockedLoadout(): {
  partnerId: string;
  racketId: string;
  shotId: string;
  userId?: string;
} | null {
  try {
    const raw = localStorage.getItem("tacpadel_savegame");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.lockedLoadout) {
      return {
        partnerId: parsed.lockedLoadout.partnerId || "partner_rookie",
        racketId: parsed.lockedLoadout.racketId || "racket_starter",
        shotId: normalizeShotId(parsed.lockedLoadout.shotId),
        userId: parsed.userId,
      };
    }
  } catch (e) {}
  return null;
}

export function isLoadoutLockedByActiveMatch(userId?: string | null): boolean {
  try {
    const raw = localStorage.getItem("tacpadel_savegame");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed) return false;
    if (userId && parsed.userId && parsed.userId !== userId) return false;
    return true;
  } catch {
    return false;
  }
}

export function getRequiredXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_ITEM_UPGRADE_LEVEL) return 0;
  return (currentLevel + 1) * 15;
}

export function getUpgradeTpCost(currentLevel: number): number {
  if (currentLevel >= MAX_ITEM_UPGRADE_LEVEL) return 0;
  return 100 + currentLevel * 75;
}

export function getSavedItemProgress(): ItemProgressMap {
  try {
    const raw = localStorage.getItem("tacpadel_item_progress");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export function saveItemProgress(map: ItemProgressMap): void {
  try {
    localStorage.setItem("tacpadel_item_progress", JSON.stringify(map));
  } catch (e) {}
}

export function getEffectiveItemModifiers(item: ShopItem, level: number) {
  const lvl = Math.max(0, Math.min(MAX_ITEM_UPGRADE_LEVEL, level));
  const mods = { ...item.modifiers };

  if (lvl === 0) return mods;

  const penaltyRelief = (lvl >= 3 ? 1 : 0) + (lvl >= 5 ? 1 : 0);

  switch (item.focus) {
    case "power":
      mods.smash += lvl;
      mods.defense = Math.min(0, mods.defense + penaltyRelief);
      break;
    case "control":
      mods.control += lvl;
      mods.smash = Math.min(0, mods.smash + penaltyRelief);
      break;
    case "defense":
      mods.defense += lvl;
      mods.smash = Math.min(0, mods.smash + penaltyRelief);
      break;
    case "agility":
      mods.agility += lvl;
      mods.defense = Math.min(0, mods.defense + penaltyRelief);
      break;
    case "classic":
      if (lvl >= 1) mods.control += 1;
      if (lvl >= 2) mods.defense += 1;
      if (lvl >= 3) mods.agility += 1;
      if (lvl >= 4) mods.smash += 1;
      if (lvl >= 5) {
        mods.control += 1;
        mods.defense += 1;
      }
      break;
  }

  return mods;
}

export function getUpgradedItemDetails(
  item: ShopItem,
  customProgressMap?: ItemProgressMap
): UpgradedItemDetails {
  const map = customProgressMap || getSavedItemProgress();
  const prog = map[item.id] || { level: 0, xp: 0 };
  const level = Math.max(0, Math.min(MAX_ITEM_UPGRADE_LEVEL, prog.level));
  const isMaxLevel = level >= MAX_ITEM_UPGRADE_LEVEL;
  const reqXp = getRequiredXpForNextLevel(level);
  const xp = isMaxLevel ? reqXp : prog.xp;
  const upgradeCostTp = getUpgradeTpCost(level);
  const canUpgrade = !isMaxLevel && xp >= reqXp;

  return {
    item,
    level,
    displayName: level > 0 ? `${item.name} +${level}` : item.name,
    xp,
    reqXp,
    upgradeCostTp,
    canUpgrade,
    isMaxLevel,
    effectiveModifiers: getEffectiveItemModifiers(item, level),
  };
}

// =========================================================
// XP-VERGABE NACH JEDEM MATCH (NUTZT EINGEFRORENES LOADOUT)
// =========================================================
export function addMatchXpToEquippedLoadout(pointsWonByPlayer: number) {
  const xpGained = Math.max(0, Math.floor(pointsWonByPlayer));
  const progressMap = getSavedItemProgress();

  // Falls im Savegame ein Loadout beim Matchstart eingefroren wurde, bekommt exakt dieses die XP!
  const locked = getActiveMatchLockedLoadout();
  const pId = locked?.partnerId || localStorage.getItem("tacpadel_partner_id") || "partner_rookie";
  const rId = locked?.racketId || localStorage.getItem("tacpadel_racket_id") || "racket_starter";
  const sId = locked?.shotId || normalizeShotId(localStorage.getItem("tacpadel_power_shot"));

  const equippedIds = [pId, rId, sId];
  const newlyReadyToUpgrade: string[] = [];

  equippedIds.forEach((id) => {
    const current = progressMap[id] || { level: 0, xp: 0 };
    if (current.level >= MAX_ITEM_UPGRADE_LEVEL) return;

    const reqXp = getRequiredXpForNextLevel(current.level);
    const wasReady = current.xp >= reqXp;
    const nextXp = current.xp + xpGained;

    progressMap[id] = {
      level: current.level,
      xp: nextXp,
    };

    if (!wasReady && nextXp >= reqXp) {
      newlyReadyToUpgrade.push(id);
    }
  });

  saveItemProgress(progressMap);

  return {
    xpGained,
    progressMap,
    newlyReadyToUpgrade,
  };
}

// =========================================================
// ITEM MIT TP AUFLEVELN (+1 UPGRADE DURCHFÜHREN)
// =========================================================
export function performItemUpgrade(
  itemId: string,
  currentTacPoints: number
): {
  success: boolean;
  newLevel: number;
  newTacPoints: number;
  cost: number;
  updatedProgressMap: ItemProgressMap;
  errorReason?: "max_level" | "not_enough_xp" | "not_enough_tp";
} {
  const progressMap = getSavedItemProgress();
  const current = progressMap[itemId] || { level: 0, xp: 0 };

  if (current.level >= MAX_ITEM_UPGRADE_LEVEL) {
    return {
      success: false,
      newLevel: current.level,
      newTacPoints: currentTacPoints,
      cost: 0,
      updatedProgressMap: progressMap,
      errorReason: "max_level",
    };
  }

  const reqXp = getRequiredXpForNextLevel(current.level);
  if (current.xp < reqXp) {
    return {
      success: false,
      newLevel: current.level,
      newTacPoints: currentTacPoints,
      cost: 0,
      updatedProgressMap: progressMap,
      errorReason: "not_enough_xp",
    };
  }

  const cost = getUpgradeTpCost(current.level);
  if (currentTacPoints < cost) {
    return {
      success: false,
      newLevel: current.level,
      newTacPoints: currentTacPoints,
      cost,
      updatedProgressMap: progressMap,
      errorReason: "not_enough_tp",
    };
  }

  const carryOverXp = Math.max(0, current.xp - reqXp);
  const newLevel = current.level + 1;
  const newTacPoints = currentTacPoints - cost;

  progressMap[itemId] = {
    level: newLevel,
    xp: carryOverXp,
  };

  saveItemProgress(progressMap);
  localStorage.setItem("tacpadel_tac_points", String(newTacPoints));

  return {
    success: true,
    newLevel,
    newTacPoints,
    cost,
    updatedProgressMap: progressMap,
  };
}

// =========================================================
// 1. KI-TEAMPARTNER (1x Klassik + 4x Skill-Fokus)
// =========================================================
export const SHOP_PARTNERS: ShopItem[] = [
  {
    id: "partner_rookie",
    name: "Leo",
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
  {
    id: "partner_cannon",
    name: "Diego",
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia" : "Power";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista ofensivo: presiona fuerte en la red"
        : l === "en"
        ? "Offensive specialist: applies heavy pressure at the net"
        : "Offensiv-Spezialist: Macht hohen Druck am Netz";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },
  {
    id: "partner_tactician",
    name: "Sofia",
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    badge: "Control",
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista en control: coloca globos y bandejas precisas"
        : l === "en"
        ? "Control specialist: places pinpoint lobs and bandejas"
        : "Kontroll-Spezialistin: Spielt präzise Lobs und Bandejas";
    },
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },
  {
    id: "partner_wall",
    name: "Mateo",
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa" : "Defense";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista defensivo: devuelve bolas difíciles desde el cristal"
        : l === "en"
        ? "Defensive specialist: digs out tough balls off the back glass"
        : "Defensiv-Spezialist: Holt schwere Bälle von der Glaswand";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },
  {
    id: "partner_runner",
    name: "Lucas",
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad" : "Agility";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Especialista en velocidad: cubre huecos rápido y ahorra energía"
        : l === "en"
        ? "Speed specialist: covers court gaps fast and saves stamina"
        : "Tempo-Spezialist: Schließt Lücken schnell & spart Ausdauer";
    },
    modifiers: { smash: 0, control: -1, defense: -2, agility: 2 },
  },
];

// =========================================================
// 2. SCHLÄGER / RACKETS (1x Klassik + 4x Skill-Fokus)
// =========================================================
export const SHOP_RACKETS: ShopItem[] = [
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
  {
    id: "racket_eclipse",
    name: "Diamond Striker",
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia" : "Power";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },
  {
    id: "racket_titan",
    name: "Precision Round CTRL",
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    badge: "Control",
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },
  {
    id: "racket_shield",
    name: "Guardian Soft Core",
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa" : "Defense";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },
  {
    id: "racket_aero",
    name: "Aero Featherlight",
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad" : "Agility";
    },
    modifiers: { smash: 0, control: -1, defense: -2, agility: 2 },
  },
];

// =========================================================
// 3. SCHLÄGE / SHOTS (1x Klassik + Volley, Bandeja, Block, Chiquita)
// =========================================================
export const SHOP_SHOTS: ShopItem[] = [
  {
    id: "smash",
    get name() {
      const l = getAppLanguage();
      return l === "es"
        ? "Técnica Clásica (Sin Buffs)"
        : l === "en"
        ? "Classic Technique (No Buffs)"
        : "Klassik-Technik (Ohne Buffs)";
    },
    focus: "classic",
    tier: 0,
    price: 0,
    reqScore: 0,
    shotType: undefined,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Clásico" : l === "en" ? "Classic" : "Klassik";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },
  {
    id: "volley",
    get name() {
      const l = getAppLanguage();
      return l === "es"
        ? "Enfoque Volea Ofensiva"
        : l === "en"
        ? "Power Volley Focus"
        : "Power-Volley Fokus";
    },
    focus: "power",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "VOLLEY",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Potencia" : "Power";
    },
    modifiers: { smash: 2, control: -1, defense: -2, agility: 0 },
  },
  {
    id: "bandeja",
    get name() {
      const l = getAppLanguage();
      return l === "es"
        ? "Enfoque Bandeja Control"
        : l === "en"
        ? "Bandeja Control Focus"
        : "Bandeja-Control Fokus";
    },
    focus: "control",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "BANDEJA",
    badge: "Control",
    modifiers: { smash: -2, control: 2, defense: 0, agility: -1 },
  },
  {
    id: "shot_defense_wall",
    get name() {
      const l = getAppLanguage();
      return l === "es"
        ? "Enfoque Bloqueo y Globo"
        : l === "en"
        ? "Reflex Block & Lob Focus"
        : "Reflex-Block & Lob Fokus";
    },
    focus: "defense",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "BLOCK",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Defensa" : "Defense";
    },
    modifiers: { smash: -2, control: 0, defense: 2, agility: -1 },
  },
  {
    id: "chiquita",
    get name() {
      const l = getAppLanguage();
      return l === "es"
        ? "Enfoque Chiquita Rápida"
        : l === "en"
        ? "Tempo Chiquita Focus"
        : "Tempo-Chiquita Fokus";
    },
    focus: "agility",
    tier: 1,
    price: 400,
    reqScore: 1500,
    shotType: "CHIQUITA",
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Agilidad" : "Agility";
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
// 5. BERECHNUNG FÜR UI & MATCH-ENGINE (INKL. MATCH-LOCK)
// =========================================================
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function calculateLoadoutStats(
  partnerId?: string,
  racketId?: string,
  shotId?: string,
  customProgressMap?: ItemProgressMap
) {
  // Wenn keine explizite Vorschau-ID übergeben wurde, nutzt die Engine bei laufendem Spiel das eingefrorene Loadout!
  const locked = !partnerId && !racketId && !shotId ? getActiveMatchLockedLoadout() : null;

  const pId =
    partnerId ||
    locked?.partnerId ||
    localStorage.getItem("tacpadel_partner_id") ||
    "partner_rookie";
  const rId =
    racketId ||
    locked?.racketId ||
    localStorage.getItem("tacpadel_racket_id") ||
    "racket_starter";
  const rawSId =
    shotId ||
    locked?.shotId ||
    localStorage.getItem("tacpadel_power_shot") ||
    "smash";
  const sId = normalizeShotId(rawSId);

  const basePartner = SHOP_PARTNERS.find((p) => p.id === pId) || SHOP_PARTNERS[0];
  const baseRacket = SHOP_RACKETS.find((r) => r.id === rId) || SHOP_RACKETS[0];
  const baseShot = SHOP_SHOTS.find((s) => s.id === sId) || SHOP_SHOTS[0];

  const partnerDetails = getUpgradedItemDetails(basePartner, customProgressMap);
  const racketDetails = getUpgradedItemDetails(baseRacket, customProgressMap);
  const shotDetails = getUpgradedItemDetails(baseShot, customProgressMap);

  const pMods = partnerDetails.effectiveModifiers;
  const rMods = racketDetails.effectiveModifiers;
  const sMods = shotDetails.effectiveModifiers;

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

  const matchModifiers = {
    winnerChanceBonus: clamp((stats.smash - 50) * 0.006, -0.05, 0.14),
    errorReductionFactor: clamp(1 - (stats.control - 50) * 0.009, 0.80, 1.08),
    defenseSaveBonus: clamp((stats.defense - 50) * 0.008, -0.05, 0.15),
    staminaDrainMultiplier: clamp(1 - (stats.agility - 50) * 0.009, 0.80, 1.08),
  };

  return {
    stats,
    diffs,
    matchModifiers,
    partner: { ...basePartner, name: partnerDetails.displayName, modifiers: pMods },
    racket: { ...baseRacket, name: racketDetails.displayName, modifiers: rMods },
    shot: { ...baseShot, name: shotDetails.displayName, modifiers: sMods },
    partnerDetails,
    racketDetails,
    shotDetails,
  };
}
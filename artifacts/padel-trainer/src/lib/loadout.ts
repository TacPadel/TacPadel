export interface ShopItem {
  id: string;
  name: string;
  price: number;
  reqScore: number; // Neu: Benötigter TacScore zum Freischalten/Benutzen
  badge: string;
  perk?: string;
  modifiers: {
    smash: number;
    control: number;
    defense: number;
    agility: number;
  };
}

// =========================================================
// 1. KURATIERTE KI-TEAMPARTNER (Skaliert nach TacScore & TacPoints)
// =========================================================
export const SHOP_PARTNERS: ShopItem[] = [
  {
    id: "partner_rookie",
    name: "Leo 'Base' Vega (Allrounder)",
    price: 0,
    reqScore: 0,
    badge: "Starter",
    perk: "Solides Grundlinienspiel ohne extreme Risiken",
    modifiers: { smash: 0, control: 1, defense: 1, agility: 0 },
  },
  {
    id: "partner_wall",
    name: "Mateo 'El Muro' Ruiz (Defensiv-Mauer)",
    price: 350,
    reqScore: 1500,
    badge: "+Defense",
    perk: "Holt selbst schwerste Bälle aus der hinteren Glasecke",
    modifiers: { smash: -1, control: 2, defense: 4, agility: 1 },
  },
  {
    id: "partner_tactician",
    name: "Sofia 'La Profesora' Navarro (Taktikerin)",
    price: 700,
    reqScore: 2500,
    badge: "+Control",
    perk: "Spielt millimetergenaue Lobs und Chiquitas",
    modifiers: { smash: 0, control: 5, defense: 2, agility: 2 },
  },
  {
    id: "partner_cannon",
    name: "Diego 'El Cañón' Morales (Finisher)",
    price: 1200,
    reqScore: 3500,
    badge: "+Smash",
    perk: "Dominiert am Netz mit extrem harten Smashes",
    modifiers: { smash: 6, control: -1, defense: -1, agility: 2 },
  },
  {
    id: "partner_legend",
    name: "Ale 'El Rey' Mendoza (World Tour Pro)",
    price: 2200,
    reqScore: 4500,
    badge: "👑 Master",
    perk: "Maximale Platzabdeckung, Übersicht & Power",
    modifiers: { smash: 5, control: 5, defense: 4, agility: 4 },
  },
];

// =========================================================
// 2. SCHLÄGER (RACKETS - Skaliert nach TacScore)
// =========================================================
export const SHOP_RACKETS: ShopItem[] = [
  {
    id: "racket_starter",
    name: "Rookie Frame Basic",
    price: 0,
    reqScore: 0,
    badge: "Standard",
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },
  {
    id: "racket_aero",
    name: "Aero Swift Pro X",
    price: 300,
    reqScore: 1200,
    badge: "+Agility",
    modifiers: { smash: 1, control: 1, defense: 0, agility: 3 },
  },
  {
    id: "racket_titan",
    name: "Titan Matrix CTRL",
    price: 550,
    reqScore: 2200,
    badge: "+Control",
    modifiers: { smash: -1, control: 4, defense: 2, agility: 0 },
  },
  {
    id: "racket_eclipse",
    name: "Eclipse Carbon Strike",
    price: 850,
    reqScore: 3200,
    badge: "+Power",
    modifiers: { smash: 3, control: 2, defense: -1, agility: 1 },
  },
  {
    id: "racket_apex_pro",
    name: "Apex Signature 18K",
    price: 1800,
    reqScore: 4200,
    badge: "Tour Elite",
    modifiers: { smash: 4, control: 4, defense: 2, agility: 3 },
  },
];

// =========================================================
// 3. SPEZIAL-FOKUS (POWER SHOTS - Skaliert nach TacScore)
// =========================================================
export const SHOP_SHOTS: ShopItem[] = [
  {
    id: "smash",
    name: "Topspin Smash (Klassik)",
    price: 0,
    reqScore: 0,
    badge: "Standard",
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },
  {
    id: "bandeja",
    name: "Bandeja Control",
    price: 300,
    reqScore: 1800,
    badge: "+Taktik",
    modifiers: { smash: 1, control: 2, defense: 2, agility: 0 },
  },
  {
    id: "vibora",
    name: "Víbora Slice",
    price: 550,
    reqScore: 2800,
    badge: "+Slice",
    modifiers: { smash: 2, control: 2, defense: 0, agility: 1 },
  },
  {
    id: "kick_x3",
    name: "Kick-Smash Por Tres (x3)",
    price: 1200,
    reqScore: 3800,
    badge: "Finisher",
    modifiers: { smash: 5, control: 0, defense: -1, agility: 1 },
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

  const pMods = SHOP_PARTNERS.find((p) => p.id === pId)?.modifiers || SHOP_PARTNERS[0].modifiers;
  const rMods = SHOP_RACKETS.find((r) => r.id === rId)?.modifiers || SHOP_RACKETS[0].modifiers;
  const sMods = SHOP_SHOTS.find((s) => s.id === sId)?.modifiers || SHOP_SHOTS[0].modifiers;

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

  // Streng gedeckelte Multiplikatoren (Hard-Caps schützen das Spiel-Balancing):
  const matchModifiers = {
    // Max. +10% Winner-Chance bei echten Offensivschlägen (0.005 pro Punkt über 50)
    winnerChanceBonus: clamp((stats.smash - 50) * 0.005, -0.03, 0.10),

    // Max. 15% weniger Unforced Errors bei ungenauen Schlägen (Faktor 0.85 bis 1.05)
    errorReductionFactor: clamp(1 - (stats.control - 50) * 0.0075, 0.85, 1.05),

    // Max. +12% höhere Abwehr-Rettungschance gegen KI-Angriffe (0.006 pro Punkt über 50)
    defenseSaveBonus: clamp((stats.defense - 50) * 0.006, -0.03, 0.12),

    // Max. 15% weniger Ausdauer-Verlust pro Ballwechsel (Faktor 0.85 bis 1.04)
    staminaDrainMultiplier: clamp(1 - (stats.agility - 50) * 0.008, 0.85, 1.04),
  };

  return {
    stats,
    diffs,
    matchModifiers,
    partner: SHOP_PARTNERS.find((p) => p.id === pId) || SHOP_PARTNERS[0],
    racket: SHOP_RACKETS.find((r) => r.id === rId) || SHOP_RACKETS[0],
    shot: SHOP_SHOTS.find((s) => s.id === sId) || SHOP_SHOTS[0],
  };
}
import { getAppLanguage } from "./i18n";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  reqScore: number; // Benötigter TacScore zum Freischalten/Benutzen
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
// 1. KURATIERTE KI-TEAMPARTNER (Mehrsprachig & Skaliert)
// =========================================================
export const SHOP_PARTNERS: ShopItem[] = [
  {
    id: "partner_rookie",
    name: "Leo 'Base' Vega",
    price: 0,
    reqScore: 0,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Starter" : l === "en" ? "Starter" : "Starter";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Juego sólido de fondo sin riesgos extremos"
        : l === "en"
        ? "Solid baseline play without extreme risks"
        : "Solides Grundlinienspiel ohne extreme Risiken";
    },
    modifiers: { smash: 0, control: 1, defense: 1, agility: 0 },
  },
  {
    id: "partner_wall",
    name: "Mateo 'El Muro' Ruiz",
    price: 350,
    reqScore: 1500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Defensa" : "+Defense";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Recupera hasta las bolas más difíciles del cristal de fondo"
        : l === "en"
        ? "Retrieves even the toughest balls from back glass corners"
        : "Holt selbst schwerste Bälle aus der hinteren Glasecke";
    },
    modifiers: { smash: -1, control: 2, defense: 4, agility: 1 },
  },
  {
    id: "partner_tactician",
    name: "Sofia 'La Profesora' Navarro",
    price: 700,
    reqScore: 2500,
    get badge() {
      return "+Control";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Juega globos y Chiquitas milimétricos"
        : l === "en"
        ? "Plays pinpoint lobs and Chiquitas"
        : "Spielt millimetergenaue Lobs und Chiquitas";
    },
    modifiers: { smash: 0, control: 5, defense: 2, agility: 2 },
  },
  {
    id: "partner_cannon",
    name: "Diego 'El Cañón' Morales",
    price: 1200,
    reqScore: 3500,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Remate" : "+Smash";
    },
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Domina en la red con remates demoledores"
        : l === "en"
        ? "Dominates at the net with explosive smashes"
        : "Dominiert am Netz mit extrem harten Smashes";
    },
    modifiers: { smash: 6, control: -1, defense: -1, agility: 2 },
  },
  {
    id: "partner_legend",
    name: "Ale 'El Rey' Mendoza",
    price: 2200,
    reqScore: 4500,
    badge: "👑 Master",
    get perk() {
      const l = getAppLanguage();
      return l === "es"
        ? "Máxima cobertura de pista, visión y potencia"
        : l === "en"
        ? "Maximum court coverage, vision & power"
        : "Maximale Platzabdeckung, Übersicht & Power";
    },
    modifiers: { smash: 5, control: 5, defense: 4, agility: 4 },
  },
];

// =========================================================
// 2. SCHLÄGER (RACKETS - Mehrsprachig & Skaliert)
// =========================================================
export const SHOP_RACKETS: ShopItem[] = [
  {
    id: "racket_starter",
    name: "Rookie Frame Basic",
    price: 0,
    reqScore: 0,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Estándar" : "Standard";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },
  {
    id: "racket_aero",
    name: "Aero Swift Pro X",
    price: 300,
    reqScore: 1200,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Agilidad" : "+Agility";
    },
    modifiers: { smash: 1, control: 1, defense: 0, agility: 3 },
  },
  {
    id: "racket_titan",
    name: "Titan Matrix CTRL",
    price: 550,
    reqScore: 2200,
    get badge() {
      return "+Control";
    },
    modifiers: { smash: -1, control: 4, defense: 2, agility: 0 },
  },
  {
    id: "racket_eclipse",
    name: "Eclipse Carbon Strike",
    price: 850,
    reqScore: 3200,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Potencia" : "+Power";
    },
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
// 3. SPEZIAL-FOKUS (POWER SHOTS - Mehrsprachig & Skaliert)
// =========================================================
export const SHOP_SHOTS: ShopItem[] = [
  {
    id: "smash",
    name: "Topspin Smash",
    price: 0,
    reqScore: 0,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Estándar" : "Standard";
    },
    modifiers: { smash: 0, control: 0, defense: 0, agility: 0 },
  },
  {
    id: "bandeja",
    name: "Bandeja Control",
    price: 300,
    reqScore: 1800,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Táctica" : "+Tactics";
    },
    modifiers: { smash: 1, control: 2, defense: 2, agility: 0 },
  },
  {
    id: "vibora",
    name: "Víbora Slice",
    price: 550,
    reqScore: 2800,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "+Cortado" : "+Slice";
    },
    modifiers: { smash: 2, control: 2, defense: 0, agility: 1 },
  },
  {
    id: "kick_x3",
    name: "Kick-Smash Por Tres (x3)",
    price: 1200,
    reqScore: 3800,
    get badge() {
      const l = getAppLanguage();
      return l === "es" ? "Definidor" : "Finisher";
    },
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
    winnerChanceBonus: clamp((stats.smash - 50) * 0.005, -0.03, 0.10),
    errorReductionFactor: clamp(1 - (stats.control - 50) * 0.0075, 0.85, 1.05),
    defenseSaveBonus: clamp((stats.defense - 50) * 0.006, -0.03, 0.12),
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
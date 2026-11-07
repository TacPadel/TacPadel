// src/engine/TournamentsSeason1.ts
import { getAppLanguage, AppLanguage } from "../lib/i18n";

export type TourType = "open" | "pro" | "master";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  type: TourType;
  reqScore: number;
  baseDifficulty: number;
  entryFee: number;
  tacPointsReward: number;
  rewardText: string;
  arenaModel?: string;
  week?: 1 | 2 | 3 | 4;
  scheduleSlot?: "weekday_free" | "weekday_pro" | "weekend_free" | "weekend_pro" | "month_end_master";
  isProUserOnly?: boolean;
}

export const SEASON_1_END_DATE = new Date("2026-12-12T23:59:59").getTime();

interface RawSeasonTournament {
  id: string;
  name: string;
  locations: Record<AppLanguage, string>;
  type: TourType;
  reqScore: number;
  baseDifficulty: number;
  entryFee: number;
  tacPointsReward: number;
  rewardTexts: Record<AppLanguage, string>;
  arenaModel?: string;
  week: 1 | 2 | 3 | 4;
  scheduleSlot: "weekday_free" | "weekday_pro" | "weekend_free" | "weekend_pro" | "month_end_master";
  isProUserOnly: boolean;
}

function createSeasonTournament(cfg: RawSeasonTournament): Tournament {
  return {
    id: cfg.id,
    name: cfg.name,
    get location() {
      const lang = getAppLanguage();
      return cfg.locations[lang] || cfg.locations.de;
    },
    type: cfg.type,
    reqScore: cfg.reqScore,
    baseDifficulty: cfg.baseDifficulty,
    entryFee: cfg.entryFee,
    tacPointsReward: cfg.tacPointsReward,
    get rewardText() {
      const lang = getAppLanguage();
      return cfg.rewardTexts[lang] || cfg.rewardTexts.de;
    },
    arenaModel: cfg.arenaModel,
    week: cfg.week,
    scheduleSlot: cfg.scheduleSlot,
    isProUserOnly: cfg.isProUserOnly,
  };
}

export const TOURNAMENTS: Tournament[] = [
  // ============================================================================
  // WOCHE 1: KICKOFF WEEK
  // ============================================================================
  createSeasonTournament({
    id: "s1_w1_open_free",
    name: "Kickoff Open Madrid",
    locations: {
      de: "Madrid, Spanien • Woche 1 (Mo–Fr • Frei)",
      en: "Madrid, Spain • Week 1 (Mon–Fri • Free)",
      es: "Madrid, España • Semana 1 (Lu–Vi • Gratis)",
    },
    type: "open",
    reqScore: 2000,
    baseDifficulty: 2200,
    entryFee: 0,
    tacPointsReward: 150,
    rewardTexts: {
      de: "150 TP + Trophäe",
      en: "150 TP + Trophy",
      es: "150 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 1,
    scheduleSlot: "weekday_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w1_open_pro1",
    name: "Barcelona Club Series [PRO]",
    locations: {
      de: "Barcelona, Spanien • Woche 1 (Mo–Fr • Pro User)",
      en: "Barcelona, Spain • Week 1 (Mon–Fri • Pro User)",
      es: "Barcelona, España • Semana 1 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2200,
    baseDifficulty: 2500,
    entryFee: 50,
    tacPointsReward: 300,
    rewardTexts: {
      de: "300 TP + Trophäe",
      en: "300 TP + Trophy",
      es: "300 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 1,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w1_open_pro2",
    name: "Valencia Night Cup [PRO]",
    locations: {
      de: "Valencia, Spanien • Woche 1 (Mo–Fr • Pro User)",
      en: "Valencia, Spain • Week 1 (Mon–Fri • Pro User)",
      es: "Valencia, España • Semana 1 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2400,
    baseDifficulty: 2700,
    entryFee: 75,
    tacPointsReward: 350,
    rewardTexts: {
      de: "350 TP + Trophäe",
      en: "350 TP + Trophy",
      es: "350 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 1,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w1_we_pro_free",
    name: "Weekend Pro Malaga",
    locations: {
      de: "Malaga, Spanien • Woche 1 (Wochenende • Frei)",
      en: "Malaga, Spain • Week 1 (Weekend • Free)",
      es: "Málaga, España • Semana 1 (Fin de semana • Gratis)",
    },
    type: "pro",
    reqScore: 2500,
    baseDifficulty: 3000,
    entryFee: 0,
    tacPointsReward: 400,
    rewardTexts: {
      de: "400 TP + Pro Trophäe",
      en: "400 TP + Pro Trophy",
      es: "400 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 1,
    scheduleSlot: "weekend_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w1_we_pro_vip",
    name: "Sevilla Pro Invitational [PRO]",
    locations: {
      de: "Sevilla, Spanien • Woche 1 (Wochenende • Pro User)",
      en: "Seville, Spain • Week 1 (Weekend • Pro User)",
      es: "Sevilla, España • Semana 1 (Fin de semana • Pro User)",
    },
    type: "pro",
    reqScore: 2800,
    baseDifficulty: 3300,
    entryFee: 100,
    tacPointsReward: 600,
    rewardTexts: {
      de: "600 TP + Pro Trophäe",
      en: "600 TP + Pro Trophy",
      es: "600 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 1,
    scheduleSlot: "weekend_pro",
    isProUserOnly: true,
  }),

  // ============================================================================
  // WOCHE 2: EUROPEAN TOUR
  // ============================================================================
  createSeasonTournament({
    id: "s1_w2_open_free",
    name: "Milano Open",
    locations: {
      de: "Mailand, Italien • Woche 2 (Mo–Fr • Frei)",
      en: "Milan, Italy • Week 2 (Mon–Fri • Free)",
      es: "Milán, Italia • Semana 2 (Lu–Vi • Gratis)",
    },
    type: "open",
    reqScore: 2000,
    baseDifficulty: 2300,
    entryFee: 0,
    tacPointsReward: 150,
    rewardTexts: {
      de: "150 TP + Trophäe",
      en: "150 TP + Trophy",
      es: "150 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 2,
    scheduleSlot: "weekday_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w2_open_pro1",
    name: "Roma Gladiator Cup [PRO]",
    locations: {
      de: "Rom, Italien • Woche 2 (Mo–Fr • Pro User)",
      en: "Rome, Italy • Week 2 (Mon–Fri • Pro User)",
      es: "Roma, Italia • Semana 2 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2300,
    baseDifficulty: 2600,
    entryFee: 50,
    tacPointsReward: 300,
    rewardTexts: {
      de: "300 TP + Trophäe",
      en: "300 TP + Trophy",
      es: "300 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 2,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w2_open_pro2",
    name: "Paris Metro Clash [PRO]",
    locations: {
      de: "Paris, Frankreich • Woche 2 (Mo–Fr • Pro User)",
      en: "Paris, France • Week 2 (Mon–Fri • Pro User)",
      es: "París, Francia • Semana 2 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2500,
    baseDifficulty: 2800,
    entryFee: 75,
    tacPointsReward: 350,
    rewardTexts: {
      de: "350 TP + Trophäe",
      en: "350 TP + Trophy",
      es: "350 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 2,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w2_we_pro_free",
    name: "Weekend Pro Stockholm",
    locations: {
      de: "Stockholm, Schweden • Woche 2 (Wochenende • Frei)",
      en: "Stockholm, Sweden • Week 2 (Weekend • Free)",
      es: "Estocolmo, Suecia • Semana 2 (Fin de semana • Gratis)",
    },
    type: "pro",
    reqScore: 2600,
    baseDifficulty: 3100,
    entryFee: 0,
    tacPointsReward: 400,
    rewardTexts: {
      de: "400 TP + Pro Trophäe",
      en: "400 TP + Pro Trophy",
      es: "400 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 2,
    scheduleSlot: "weekend_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w2_we_pro_vip",
    name: "Amsterdam Pro Dock [PRO]",
    locations: {
      de: "Amsterdam, Niederlande • Woche 2 (Wochenende • Pro User)",
      en: "Amsterdam, Netherlands • Week 2 (Weekend • Pro User)",
      es: "Ámsterdam, Países Bajos • Semana 2 (Fin de semana • Pro User)",
    },
    type: "pro",
    reqScore: 3000,
    baseDifficulty: 3500,
    entryFee: 100,
    tacPointsReward: 650,
    rewardTexts: {
      de: "650 TP + Pro Trophäe",
      en: "650 TP + Pro Trophy",
      es: "650 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 2,
    scheduleSlot: "weekend_pro",
    isProUserOnly: true,
  }),

  // ============================================================================
  // WOCHE 3: AMERICAS SWING
  // ============================================================================
  createSeasonTournament({
    id: "s1_w3_open_free",
    name: "Buenos Aires Open",
    locations: {
      de: "Buenos Aires, Argentinien • Woche 3 (Mo–Fr • Frei)",
      en: "Buenos Aires, Argentina • Week 3 (Mon–Fri • Free)",
      es: "Buenos Aires, Argentina • Semana 3 (Lu–Vi • Gratis)",
    },
    type: "open",
    reqScore: 2000,
    baseDifficulty: 2400,
    entryFee: 0,
    tacPointsReward: 175,
    rewardTexts: {
      de: "175 TP + Trophäe",
      en: "175 TP + Trophy",
      es: "175 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 3,
    scheduleSlot: "weekday_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w3_open_pro1",
    name: "Mendoza Andes Series [PRO]",
    locations: {
      de: "Mendoza, Argentinien • Woche 3 (Mo–Fr • Pro User)",
      en: "Mendoza, Argentina • Week 3 (Mon–Fri • Pro User)",
      es: "Mendoza, Argentina • Semana 3 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2400,
    baseDifficulty: 2700,
    entryFee: 50,
    tacPointsReward: 325,
    rewardTexts: {
      de: "325 TP + Trophäe",
      en: "325 TP + Trophy",
      es: "325 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 3,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w3_open_pro2",
    name: "Santiago Night Open [PRO]",
    locations: {
      de: "Santiago, Chile • Woche 3 (Mo–Fr • Pro User)",
      en: "Santiago, Chile • Week 3 (Mon–Fri • Pro User)",
      es: "Santiago, Chile • Semana 3 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2600,
    baseDifficulty: 2900,
    entryFee: 75,
    tacPointsReward: 375,
    rewardTexts: {
      de: "375 TP + Trophäe",
      en: "375 TP + Trophy",
      es: "375 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 3,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w3_we_pro_free",
    name: "Weekend Pro Acapulco",
    locations: {
      de: "Acapulco, Mexiko • Woche 3 (Wochenende • Frei)",
      en: "Acapulco, Mexico • Week 3 (Weekend • Free)",
      es: "Acapulco, México • Semana 3 (Fin de semana • Gratis)",
    },
    type: "pro",
    reqScore: 2700,
    baseDifficulty: 3200,
    entryFee: 0,
    tacPointsReward: 450,
    rewardTexts: {
      de: "450 TP + Pro Trophäe",
      en: "450 TP + Pro Trophy",
      es: "450 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 3,
    scheduleSlot: "weekend_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w3_we_pro_vip",
    name: "Miami Beach Pro [PRO]",
    locations: {
      de: "Miami, USA • Woche 3 (Wochenende • Pro User)",
      en: "Miami, USA • Week 3 (Weekend • Pro User)",
      es: "Miami, EE. UU. • Semana 3 (Fin de semana • Pro User)",
    },
    type: "pro",
    reqScore: 3200,
    baseDifficulty: 3700,
    entryFee: 125,
    tacPointsReward: 700,
    rewardTexts: {
      de: "700 TP + Pro Trophäe",
      en: "700 TP + Pro Trophy",
      es: "700 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 3,
    scheduleSlot: "weekend_pro",
    isProUserOnly: true,
  }),

  // ============================================================================
  // WOCHE 4: FINALS WEEK + PREMIER MASTER AM MONATSENDE
  // ============================================================================
  createSeasonTournament({
    id: "s1_w4_open_free",
    name: "Cairo Pyramid Open",
    locations: {
      de: "Kairo, Ägypten • Woche 4 (Mo–Fr • Frei)",
      en: "Cairo, Egypt • Week 4 (Mon–Fri • Free)",
      es: "El Cairo, Egipto • Semana 4 (Lu–Vi • Gratis)",
    },
    type: "open",
    reqScore: 2000,
    baseDifficulty: 2500,
    entryFee: 0,
    tacPointsReward: 200,
    rewardTexts: {
      de: "200 TP + Trophäe",
      en: "200 TP + Trophy",
      es: "200 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "weekday_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w4_open_pro1",
    name: "Riyadh Desert Cup [PRO]",
    locations: {
      de: "Riad, Saudi-Arabien • Woche 4 (Mo–Fr • Pro User)",
      en: "Riyadh, Saudi Arabia • Week 4 (Mon–Fri • Pro User)",
      es: "Riad, Arabia Saudita • Semana 4 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2500,
    baseDifficulty: 2900,
    entryFee: 75,
    tacPointsReward: 350,
    rewardTexts: {
      de: "350 TP + Trophäe",
      en: "350 TP + Trophy",
      es: "350 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w4_open_pro2",
    name: "Kuwait Gulf Series [PRO]",
    locations: {
      de: "Kuwait-Stadt • Woche 4 (Mo–Fr • Pro User)",
      en: "Kuwait City • Week 4 (Mon–Fri • Pro User)",
      es: "Ciudad de Kuwait • Semana 4 (Lu–Vi • Pro User)",
    },
    type: "open",
    reqScore: 2800,
    baseDifficulty: 3100,
    entryFee: 100,
    tacPointsReward: 400,
    rewardTexts: {
      de: "400 TP + Trophäe",
      en: "400 TP + Trophy",
      es: "400 TP + Trofeo",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "weekday_pro",
    isProUserOnly: true,
  }),
  createSeasonTournament({
    id: "s1_w4_we_pro_free",
    name: "Weekend Pro Doha",
    locations: {
      de: "Doha, Katar • Woche 4 (Wochenende • Frei)",
      en: "Doha, Qatar • Week 4 (Weekend • Free)",
      es: "Doha, Catar • Semana 4 (Fin de semana • Gratis)",
    },
    type: "pro",
    reqScore: 2800,
    baseDifficulty: 3400,
    entryFee: 0,
    tacPointsReward: 500,
    rewardTexts: {
      de: "500 TP + Pro Trophäe",
      en: "500 TP + Pro Trophy",
      es: "500 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "weekend_free",
    isProUserOnly: false,
  }),
  createSeasonTournament({
    id: "s1_w4_we_pro_vip",
    name: "Abu Dhabi Pro Crown [PRO]",
    locations: {
      de: "Abu Dhabi, VAE • Woche 4 (Wochenende • Pro User)",
      en: "Abu Dhabi, UAE • Week 4 (Weekend • Pro User)",
      es: "Abu Dabi, EAU • Semana 4 (Fin de semana • Pro User)",
    },
    type: "pro",
    reqScore: 3400,
    baseDifficulty: 3900,
    entryFee: 150,
    tacPointsReward: 800,
    rewardTexts: {
      de: "800 TP + Pro Trophäe",
      en: "800 TP + Pro Trophy",
      es: "800 TP + Trofeo Pro",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "weekend_pro",
    isProUserOnly: true,
  }),

  // 🏆 MONATSFINALE (Premier Master für Pro User)
  createSeasonTournament({
    id: "s1_m1_master_finale",
    name: "Dubai Premier Master [PRO]",
    locations: {
      de: "Dubai, VAE • Monatsfinale (Pro User Highlight)",
      en: "Dubai, UAE • Monthly Finale (Pro User Highlight)",
      es: "Dubái, EAU • Final del Mes (Destacado Pro User)",
    },
    type: "master",
    reqScore: 4000,
    baseDifficulty: 4500,
    entryFee: 250,
    tacPointsReward: 1500,
    rewardTexts: {
      de: "1500 TP + Goldene Master-Trophäe",
      en: "1500 TP + Golden Master Trophy",
      es: "1500 TP + Trofeo Master de Oro",
    },
    arenaModel: "/TacPadel.glb",
    week: 4,
    scheduleSlot: "month_end_master",
    isProUserOnly: true,
  }),
];
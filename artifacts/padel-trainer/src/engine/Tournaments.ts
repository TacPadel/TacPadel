import { getAppLanguage, AppLanguage } from "../lib/i18n";

export type TourStatus = "active" | "upcoming" | "completed";
export type TourType = "open" | "pro" | "master";
export type RewardTier = "bronze" | "silver" | "gold" | "platinum";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  type: TourType;
  status: TourStatus;
  reqScore: number;
  entryFee: number;
  rewardText: string;
  startsIn?: string;
  baseDifficulty: number;
  tacPointsReward: number;
  arenaModel?: string;
}

const REWARD_LABELS: Record<RewardTier, Record<AppLanguage, string>> = {
  bronze: {
    de: "Bronze-Badge",
    en: "Bronze Badge",
    es: "Insignia Bronce",
  },
  silver: {
    de: "Silber-Pokal",
    en: "Silver Trophy",
    es: "Trofeo Plata",
  },
  gold: {
    de: "Gold-Pokal",
    en: "Gold Trophy",
    es: "Trofeo Oro",
  },
  platinum: {
    de: "Platin-Pokal",
    en: "Platinum Trophy",
    es: "Trofeo Platino",
  },
};

interface RawTournamentConfig {
  id: string;
  name: string;
  locations: Record<AppLanguage, string>;
  type: TourType;
  status: TourStatus;
  reqScore: number;
  entryFee: number;
  baseDifficulty: number;
  tacPointsReward: number;
  rewardTier: RewardTier;
  arenaModel?: string;
}

function createTournament(cfg: RawTournamentConfig): Tournament {
  return {
    id: cfg.id,
    name: cfg.name,
    get location() {
      const lang = getAppLanguage();
      return cfg.locations[lang] || cfg.locations.de;
    },
    type: cfg.type,
    status: cfg.status,
    reqScore: cfg.reqScore,
    entryFee: cfg.entryFee,
    baseDifficulty: cfg.baseDifficulty,
    tacPointsReward: cfg.tacPointsReward,
    get rewardText() {
      const lang = getAppLanguage();
      const label = REWARD_LABELS[cfg.rewardTier][lang] || REWARD_LABELS[cfg.rewardTier].de;
      return `${label} + ${cfg.tacPointsReward} TP`;
    },
    arenaModel: cfg.arenaModel,
  };
}

export const TOURNAMENTS: Tournament[] = [
  // ==========================================
  // TIER 3: PADEL OPEN (Die Grind-Basis)
  // ==========================================
  createTournament({
    id: "open_berlin",
    name: "Berlin Open",
    locations: { de: "Berlin, GER", en: "Berlin, GER", es: "Berlín, GER" },
    type: "open",
    status: "active",
    reqScore: 0,
    entryFee: 0,
    baseDifficulty: 2000,
    tacPointsReward: 100,
    rewardTier: "bronze",
    arenaModel: "/TacPadel.glb",
  }),
  createTournament({
    id: "open_london",
    name: "London Padel Cup",
    locations: { de: "London, GBR", en: "London, GBR", es: "Londres, GBR" },
    type: "open",
    status: "active",
    reqScore: 0,
    entryFee: 0,
    baseDifficulty: 2200,
    tacPointsReward: 100,
    rewardTier: "bronze",
    arenaModel: "/TacPadelTournament.glb",
  }),
  createTournament({
    id: "open_amsterdam",
    name: "Amsterdam Open",
    locations: { de: "Amsterdam, NED", en: "Amsterdam, NED", es: "Ámsterdam, NED" },
    type: "open",
    status: "active",
    reqScore: 2000,
    entryFee: 10,
    baseDifficulty: 2400,
    tacPointsReward: 150,
    rewardTier: "bronze",
    arenaModel: "/TacPadel.glb",
  }),
  createTournament({
    id: "open_rome",
    name: "Rome Futures",
    locations: { de: "Rom, ITA", en: "Rome, ITA", es: "Roma, ITA" },
    type: "open",
    status: "active",
    reqScore: 2100,
    entryFee: 15,
    baseDifficulty: 2500,
    tacPointsReward: 180,
    rewardTier: "bronze",
    arenaModel: "/TacPadel.glb",
  }),
  createTournament({
    id: "open_miami",
    name: "Miami Beach Cup",
    locations: { de: "Miami, USA", en: "Miami, USA", es: "Miami, USA" },
    type: "open",
    status: "active",
    reqScore: 2200,
    entryFee: 20,
    baseDifficulty: 2600,
    tacPointsReward: 200,
    rewardTier: "bronze",
    arenaModel: "/TacPadel.glb",
  }),
  createTournament({
    id: "open_sydney",
    name: "Sydney Open",
    locations: { de: "Sydney, AUS", en: "Sydney, AUS", es: "Sídney, AUS" },
    type: "open",
    status: "active",
    reqScore: 2400,
    entryFee: 25,
    baseDifficulty: 2800,
    tacPointsReward: 250,
    rewardTier: "bronze",
    arenaModel: "/TacPadel.glb",
  }),

  // ==========================================
  // TIER 2: PRO SERIES (Die Mittelklasse)
  // ==========================================
  createTournament({
    id: "pro_madrid",
    name: "Madrid Pro Series",
    locations: { de: "Madrid, ESP", en: "Madrid, ESP", es: "Madrid, ESP" },
    type: "pro",
    status: "active",
    reqScore: 2800,
    entryFee: 50,
    baseDifficulty: 3200,
    tacPointsReward: 400,
    rewardTier: "silver",
    arenaModel: "/TacPadelPremium.glb",
  }),
  createTournament({
    id: "pro_buenosaires",
    name: "B. Aires Pro Series",
    locations: { de: "Buenos Aires, ARG", en: "Buenos Aires, ARG", es: "Buenos Aires, ARG" },
    type: "pro",
    status: "active",
    reqScore: 3000,
    entryFee: 60,
    baseDifficulty: 3400,
    tacPointsReward: 450,
    rewardTier: "silver",
    arenaModel: "/TacPadelIndustrial.glb",
  }),
  createTournament({
    id: "pro_tokyo",
    name: "Tokyo Pro Series",
    locations: { de: "Tokio, JPN", en: "Tokyo, JPN", es: "Tokio, JPN" },
    type: "pro",
    status: "active",
    reqScore: 3200,
    entryFee: 75,
    baseDifficulty: 3600,
    tacPointsReward: 500,
    rewardTier: "silver",
    arenaModel: "/TacPadelTournament.glb",
  }),
  createTournament({
    id: "pro_capetown",
    name: "Cape Town Elite",
    locations: { de: "Kapstadt, RSA", en: "Cape Town, RSA", es: "Ciudad del Cabo, RSA" },
    type: "pro",
    status: "active",
    reqScore: 3400,
    entryFee: 80,
    baseDifficulty: 3800,
    tacPointsReward: 550,
    rewardTier: "silver",
    arenaModel: "/TacPadelIndustrial.glb",
  }),
  createTournament({
    id: "pro_dubai",
    name: "Dubai Pro Series",
    locations: { de: "Dubai, UAE", en: "Dubai, UAE", es: "Dubái, UAE" },
    type: "pro",
    status: "active",
    reqScore: 3600,
    entryFee: 100,
    baseDifficulty: 4000,
    tacPointsReward: 650,
    rewardTier: "silver",
    arenaModel: "/TacPadelPremium.glb",
  }),

  // ==========================================
  // TIER 1: GRAND MASTER (Die großen 4)
  // ==========================================
  createTournament({
    id: "master_doha",
    name: "Doha Grand Master",
    locations: { de: "Doha, QAT", en: "Doha, QAT", es: "Doha, QAT" },
    type: "master",
    status: "active",
    reqScore: 4100,
    entryFee: 150,
    baseDifficulty: 4500,
    tacPointsReward: 1000,
    rewardTier: "gold",
    arenaModel: "/TacPadelIndustrial.glb",
  }),
  createTournament({
    id: "master_rome",
    name: "Rome Grand Master",
    locations: { de: "Rom, ITA", en: "Rome, ITA", es: "Roma, ITA" },
    type: "master",
    status: "active",
    reqScore: 4300,
    entryFee: 200,
    baseDifficulty: 4700,
    tacPointsReward: 1200,
    rewardTier: "gold",
    arenaModel: "/TacPadelPremium.glb",
  }),
  createTournament({
    id: "master_paris",
    name: "Paris Grand Master",
    locations: { de: "Paris, FRA", en: "Paris, FRA", es: "París, FRA" },
    type: "master",
    status: "active",
    reqScore: 4600,
    entryFee: 250,
    baseDifficulty: 5000,
    tacPointsReward: 1500,
    rewardTier: "gold",
    arenaModel: "/TacPadelTournament.glb",
  }),
  createTournament({
    id: "master_monterrey",
    name: "Monterrey Grand Master",
    locations: { de: "Monterrey, MEX", en: "Monterrey, MEX", es: "Monterrey, MEX" },
    type: "master",
    status: "active",
    reqScore: 5100,
    entryFee: 300,
    baseDifficulty: 5500,
    tacPointsReward: 2000,
    rewardTier: "platinum",
    arenaModel: "/TacPadel.glb",
  }),
];
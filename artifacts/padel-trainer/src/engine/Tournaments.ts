export type TourStatus = "active" | "upcoming" | "completed";
export type TourType = "open" | "pro" | "master"; // <-- FIP/Major entfernt

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
}

export const TOURNAMENTS: Tournament[] = [
  // ==========================================
  // TIER 3: PADEL OPEN (Die Grind-Basis)
  // ==========================================
  {
    id: "open_berlin", 
    name: "Berlin Open",
    location: "Berlin, GER",
    type: "open",
    status: "active", 
    reqScore: 0,
    entryFee: 0,
    baseDifficulty: 2000, 
    tacPointsReward: 100,
    rewardText: "Bronze-Badge + 100 TP",
  },
  {
    id: "open_london", 
    name: "London Padel Cup",
    location: "London, GBR",
    type: "open",
    status: "active", 
    reqScore: 0,
    entryFee: 0, 
    baseDifficulty: 2200, 
    tacPointsReward: 100,
    rewardText: "Bronze-Badge + 100 TP",
  },
  {
    id: "open_amsterdam", 
    name: "Amsterdam Open",
    location: "Amsterdam, NED",
    type: "open",
    status: "active", 
    reqScore: 300,
    entryFee: 10,
    baseDifficulty: 2400, 
    tacPointsReward: 150,
    rewardText: "Bronze-Badge + 150 TP",
  },
  {
    id: "open_rome", 
    name: "Rome Futures",
    location: "Rom, ITA",
    type: "open",
    status: "active", 
    reqScore: 600,
    entryFee: 15,
    baseDifficulty: 2500, 
    tacPointsReward: 180,
    rewardText: "Bronze-Badge + 180 TP",
  },
  {
    id: "open_miami", 
    name: "Miami Beach Cup",
    location: "Miami, USA",
    type: "open",
    status: "active", 
    reqScore: 1000,
    entryFee: 20,
    baseDifficulty: 2600, 
    tacPointsReward: 200,
    rewardText: "Bronze-Badge + 200 TP",
  },
  {
    id: "open_sydney", 
    name: "Sydney Open",
    location: "Sydney, AUS",
    type: "open",
    status: "active", 
    reqScore: 1200,
    entryFee: 25,
    baseDifficulty: 2800, 
    tacPointsReward: 250,
    rewardText: "Bronze-Badge + 250 TP",
  },

  // ==========================================
  // TIER 2: PRO SERIES (Die Mittelklasse)
  // ==========================================
  {
    id: "pro_madrid",
    name: "Madrid Pro Series",
    location: "Madrid, ESP",
    type: "pro",
    status: "active",
    reqScore: 2000,
    entryFee: 50, 
    baseDifficulty: 3200,
    tacPointsReward: 400,
    rewardText: "Silber-Pokal + 400 TP",
  },
  {
    id: "pro_buenosaires",
    name: "B. Aires Pro Series",
    location: "Buenos Aires, ARG",
    type: "pro",
    status: "active",
    reqScore: 2400,
    entryFee: 60, 
    baseDifficulty: 3400,
    tacPointsReward: 450,
    rewardText: "Silber-Pokal + 450 TP",
  },
  {
    id: "pro_tokyo",
    name: "Tokyo Pro Series",
    location: "Tokio, JPN",
    type: "pro",
    status: "active",
    reqScore: 2800,
    entryFee: 75, 
    baseDifficulty: 3600,
    tacPointsReward: 500,
    rewardText: "Silber-Pokal + 500 TP",
  },
  {
    id: "pro_capetown",
    name: "Cape Town Elite",
    location: "Kapstadt, RSA",
    type: "pro",
    status: "active",
    reqScore: 3200,
    entryFee: 80, 
    baseDifficulty: 3800,
    tacPointsReward: 550,
    rewardText: "Silber-Pokal + 550 TP",
  },
  {
    id: "pro_dubai",
    name: "Dubai Pro Series",
    location: "Dubai, UAE",
    type: "pro",
    status: "active",
    reqScore: 3500,
    entryFee: 100, 
    baseDifficulty: 4000,
    tacPointsReward: 650,
    rewardText: "Silber-Pokal + 650 TP",
  },

  // ==========================================
  // TIER 1: GRAND MASTER (Die großen 4)
  // ==========================================
  {
    id: "master_doha",
    name: "Doha Grand Master",
    location: "Doha, QAT",
    type: "master",
    status: "active", 
    reqScore: 4000,
    entryFee: 150, 
    baseDifficulty: 4500,
    tacPointsReward: 1000,
    rewardText: "Gold-Pokal + 1000 TP",
  },
  {
    id: "master_rome",
    name: "Rome Grand Master",
    location: "Rom, ITA",
    type: "master",
    status: "active", 
    reqScore: 4500,
    entryFee: 200, 
    baseDifficulty: 4700, 
    tacPointsReward: 1200,
    rewardText: "Gold-Pokal + 1200 TP",
  },
  {
    id: "master_paris",
    name: "Paris Grand Master",
    location: "Paris, FRA",
    type: "master",
    status: "active", 
    reqScore: 5000,
    entryFee: 250, 
    baseDifficulty: 5000, 
    tacPointsReward: 1500,
    rewardText: "Gold-Pokal + 1500 TP",
  },
  {
    id: "master_monterrey",
    name: "Monterrey Grand Master",
    location: "Monterrey, MEX",
    type: "master",
    status: "active", 
    reqScore: 5500,
    entryFee: 300, 
    baseDifficulty: 5500, 
    tacPointsReward: 2000,
    rewardText: "Platin-Pokal + 2000 TP",
  }
];
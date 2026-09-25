// src/engine/AiProfiles.ts

export type AiStyle = "balanced" | "defensive" | "aggressive";

export interface AiProfile {
  id: string;
  teamName: string;
  p1: string;
  p2: string;
  style: AiStyle;
  staminaMult: number; // Beeinflusst die maximale Ausdauer (1.4 = 40% mehr, 0.8 = 20% weniger)
}

export const AI_PROFILES: AiProfile[] = [
  // --- Ausgeglichene Teams (Allrounder, flexibel) ---
  { id: "prof_1", teamName: "Alianza Padel", p1: "Mateo", p2: "Julián", style: "balanced", staminaMult: 1.0 },
  { id: "prof_2", teamName: "Costa Blanca TC", p1: "Javier", p2: "Raúl", style: "balanced", staminaMult: 1.05 },
  { id: "prof_3", teamName: "Reyes del Norte", p1: "Sergio", p2: "Antonio", style: "balanced", staminaMult: 0.95 },
  { id: "prof_4", teamName: "Team Solera", p1: "Pablo", p2: "Héctor", style: "balanced", staminaMult: 1.1 },

  // --- Aggressive Teams (Viel Druck, Smashes, aber oft weniger Ausdauer) ---
  { id: "prof_5", teamName: "Los Lobos", p1: "Diego", p2: "Carlos", style: "aggressive", staminaMult: 0.85 },
  { id: "prof_6", teamName: "Viper Syndicate", p1: "Marco", p2: "Luis", style: "aggressive", staminaMult: 0.9 },
  { id: "prof_7", teamName: "La Tormenta", p1: "Rafael", p2: "Hugo", style: "aggressive", staminaMult: 0.8 },
  { id: "prof_8", teamName: "Club de Cuervos", p1: "Thiago", p2: "Mario", style: "aggressive", staminaMult: 0.85 },

  // --- Defensive Teams (Lobs, Fehler vermeiden, extrem gute Ausdauer) ---
  { id: "prof_9", teamName: "Team Eclipse", p1: "Alejandro", p2: "Fernando", style: "defensive", staminaMult: 1.3 },
  { id: "prof_10", teamName: "Los Halcones", p1: "Nicolás", p2: "Simón", style: "defensive", staminaMult: 1.4 },
  { id: "prof_11", teamName: "Fuerza Padel", p1: "Martín", p2: "Leo", style: "defensive", staminaMult: 1.25 },
  { id: "prof_12", teamName: "Madrid Masters", p1: "Gabriel", p2: "Lucas", style: "defensive", staminaMult: 1.35 },
];
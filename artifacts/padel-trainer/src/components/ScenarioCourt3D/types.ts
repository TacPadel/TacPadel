// types.ts
export interface PlayerPositions {
  you: string;
  partner: string;
  opp1: string;
  opp2: string;
  ball: { 
    side: "left" | "right"; 
    zone: string; 
    type?: string; 
  };
}

export interface Props {
  level: "Schlag" | "Schlagrichtung" | "Laufrichtung" | "Spielzug";
  positions: PlayerPositions;
  selectedZone: string | null;
  hasSubmitted: boolean;
  bestZones: string[];
  acceptableZones?: string[];
  onZoneClick: (id: string) => void;
  profiMode?: boolean;
  selectedLaufZone?: string | null;
  perfectLaufZone?: string | null;
  acceptableLaufZones?: string[];
  onLaufZoneClick?: (id: string) => void;
}
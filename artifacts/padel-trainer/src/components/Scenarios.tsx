// Falls PlayerPositions in einer anderen Datei definiert ist, hier importieren, z.B.:
// import { PlayerPositions } from './types';

export interface Scenario {
  id: number;
  description: string;
  validShots: string[];
  bestZones: string[];
  explanation: string;
  positions: any; // Hier kannst du wieder 'PlayerPositions' eintragen, wenn der Typ importiert ist
  laufZone: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    description:
      "Die Gegner besetzen das Netz. Ein flacher Ball kommt tief in deine linke Glasecke (A1). Welcher Schlag bringt in dieser Situation Entlastung?",
    validShots: ["LOB"],
    bestZones: ["A1", "E1"],
    explanation:
      "Ein hoher Lob zwingt die Gegner nach hinten und bricht ihren Netzangriff.",
    positions: {
      you: "A1",
      partner: "D1",
      opp1: "A4",
      opp2: "C3",
      ball: { side: "left", zone: "A1" },
    },
    laufZone: "B4",
  },
  {
    id: 2,
    description:
      "Du stehst am Netz (B3). Ein ungenauer, mittellanger Not-Lob kommt auf die Mittellinie (B2). Für einen Smash bist du zu weit weg.",
    validShots: ["BANDEJA"],
    bestZones: ["A1", "E1"],
    explanation:
      "Die Bandeja sichert deine Netzposition, indem du den Ball mit Slice flach hinten hältst.",
    positions: {
      you: "B3",
      partner: "D3",
      opp1: "B1",
      opp2: "D1",
      ball: { side: "left", zone: "B2" },
    },
    laufZone: "B4",
  },
  {
    id: 3,
    description:
      "Ihr steht kompakt am Netz. Ein extrem harter, flacher Passierball wird fliegend durch die Mitte geschlagen (B4). Wie reagierst du?",
    validShots: ["BLOCK"],
    bestZones: ["B2", "C2"],
    explanation:
      "Schläger stabil wie eine Wand reinhalten, um die Wucht zu nehmen und den Ball kurz abzulegen.",
    positions: {
      you: "B4",
      partner: "D4",
      opp1: "B1",
      opp2: "D2",
      ball: { side: "left", zone: "B4" },
    },
    laufZone: "B4",
  },
  {
    id: 4,
    description:
      "Ein verunglückter, sehr hoher Lob des Gegners fällt direkt an der Netzkante (B4) herunter. Du stehst perfekt darunter.",
    validShots: ["SMASH"],
    bestZones: ["A1", "E1"],
    explanation:
      "Aus nächster Nähe ist der Power-Smash die beste Wahl, um den Punkt direkt und humorlos zu beenden.",
    positions: {
      you: "B4",
      partner: "D4",
      opp1: "B1",
      opp2: "D1",
      ball: { side: "left", zone: "B4" },
    },
    laufZone: "B4",
  },
  {
    id: 5,
    description:
      "Ein hoher Lob fliegt über dich hinweg, klatscht hoch gegen deine eigene Rückwand und kommt in Zone A2 herunter. Die Gegner rücken aggressiv auf.",
    validShots: ["BAJADA"],
    bestZones: ["B2", "C2"],
    explanation:
      "Da der Ball hoch von der Wand abspringt, ziehst du ihn als Bajada de Pared von oben nach unten aggressiv durch.",
    positions: {
      you: "A2",
      partner: "C1",
      opp1: "A4",
      opp2: "C4",
      ball: { side: "left", zone: "A2" },
    },
    laufZone: "B3",
  },
  {
    id: 6,
    description:
      "Du stehst im Halbfeld (B3). Ein halbhoher Ball schwebt heran. Du willst maximalen Schnitt mitgeben, damit der Ball extrem flach aus dem gegnerischen Glas bricht.",
    validShots: ["VIBORA"],
    bestZones: ["A1", "A2"],
    explanation:
      "Die Víbora wird mit aggressivem Seitwärtsdrall geschlagen, sodass sie nach der Wand unberechenbar flach bleibt.",
    positions: {
      you: "B3",
      partner: "D4",
      opp1: "B3",
      opp2: "D3",
      ball: { side: "left", zone: "B3" },
    },
    laufZone: "B4",
  },
  {
    id: 7,
    description:
      "Du stehst stabil in Angriffsstimmung direkt am Netz (B4). Ein harter, aber gut lesbarer Ball kommt auf Brusthöhe angeflogen.",
    validShots: ["VOLLEY"],
    bestZones: ["B2", "C2", "D2"],
    explanation:
      "Ein klassischer Volley direkt aus der Luft wird mit Slice tief in die ungemütlichen Zonen gedrückt.",
    positions: {
      you: "B4",
      partner: "D4",
      opp1: "B1",
      opp2: "D1",
      ball: { side: "left", zone: "B4" },
    },
    laufZone: "B4",
  },
  {
    id: 8,
    description:
      "Du stehst hinten in der Defensive (A1). Die Gegner kleben eng am Netz. Du möchtest sie auskontern und zu einem Volley von ganz weit unten zwingen.",
    validShots: ["CHIQUITA"],
    bestZones: ["B3", "C3", "D3"],
    explanation:
      "Die Chiquita wird weich und kurz genau vor die Füße der Netzspieler gelegt, um einen Gegenangriff einzuleiten.",
    positions: {
      you: "A1",
      partner: "C1",
      opp1: "A4",
      opp2: "C4",
      ball: { side: "left", zone: "A1" },
    },
    laufZone: "B3",
  },
  {
    id: 9,
    description:
      "Das Spiel beginnt von Null. Du stehst spielbereit hinter der Aufschlaglinie (C2) und musst den Ball ins Spiel bringen. Welcher Schlag startet den Ballwechsel?",
    validShots: ["AUFSCHLAG"],
    bestZones: ["A3", "C3"],
    explanation:
      "Der Aufschlag wird unterhalb der Hüfte getroffen und startet diagonal den Punkt.",
    positions: {
      you: "D1",
      partner: "D4",
      opp1: "B1",
      opp2: "D2",
      ball: { side: "left", zone: "D1" },
    },
    laufZone: "B4",
  },
 {
    id: 10,
    description:
      "Du stehst hinten in der Ecke (A2). Ein gegnerischer Cross-Volley reißt eine riesige Lücke auf der Longline-Seite auf. Welcher flache Passierball nutzt das?",
    validShots: ["DRIVE"],
    bestZones: ["A4", "A5"],
    explanation:
      "Ein präziser, flacher Schlag die Linie entlang (Longline) passidert den Netzspieler eiskalt.",
    positions: {
      you: "A2",
      partner: "C2",
      opp1: "B4",
      opp2: "D4",
      ball: { side: "left", zone: "A2" },
    },
    laufZone: "A3",
  },
  
  // ==========================================
  // AB HIER NEUE ERWEITERTE SPIELZÜGE (11 - 35)
  // ==========================================
  {
    id: 11,
    description: "Der Ball prallt unkontrolliert vom Seitengitter ab (B3). Wähle den sichersten Schlag und die optimale Flugrichtung, um Zeit zu gewinnen.",
    validShots: ["LOB"],
    bestZones: ["A1", "E1"],
    explanation: "Nach unberechenbaren Gittertreffern ist ein hoher Lob in die tiefen Ecken die sicherste Option, um den Angriff zu stoppen.",
    positions: { you: "B3", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B3" } },
    laufZone: "B2",
  },
  {
    id: 12,
    description: "Gegner stehen nach einer Chiquita tief und eng in der Mitte. Was machst du um sie nun über außen in Verlegenheit zu bringen.",
    validShots: ["VOLLEY", "DRIVE"],
    bestZones: ["A4", "E4"], // Anpassung: Fokus auf außen
    explanation: "Durch einen Richtungswechsel nach außen zwingst du die Gegner, ihre kompakte Formation in der Mitte aufzugeben.",
    positions: { you: "C4", partner: "A4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "C4" } }, // Anpassung Positionierung am Netz
    laufZone: "C4",
  },
  {
    id: 13,
    description: "Du stehst auf der linken Netzseite (B4). GEG1 steht tief hinten in der Ecke (A1). Du willst maximalen Druck aufbauen.",
    validShots: ["VOLLEY"],
    bestZones: ["A1", "A2"],
    explanation: "Ein flacher Volley tief in die Ecke des defensiven Gegners zwingt ihn zu einem schweren Wand-Ball.",
    positions: { you: "B4", partner: "D4", opp1: "A1", opp2: "D2", ball: { side: "left", zone: "B4" } },
    laufZone: "B4",
  },
  {
    id: 14,
    description: "Cross-Aufschlag hart an die Seitenwand (A2). Wähle Schlag und Richtung, um das Serve-and-Volley der Gegner sofort zu brechen.",
    validShots: ["LOB"],
    bestZones: ["A1", "E1"],
    explanation: "Ein hoher Return-Lob über die vorstürmenden Netzspieler hinweg nimmt den Gegnern sofort die Initiative.",
    positions: { you: "A2", partner: "C1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A2" } },
    laufZone: "B2",
  },
  {
    id: 15,
    description: "Harter Ball kommt durch die Mitte auf dich zu (B4), Gegner rücken vor. Wie konterst du?.",
    validShots: ["VOLLEY", "BLOCK"],
    bestZones: ["C4", "B3"], // Anpassung Zielzonen für Konter
    explanation: "In dieser Situation hilft nur ein schneller Reflex-Block oder ein kurzer Volley in den freien Raum, um die Gegner zu überraschen.",
    positions: { you: "B4", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "C3" } }, // Anpassung Ballposition
    laufZone: "B4",
  },
  {
    id: 16,
    description: "Ein hoher Lob zwingt dich auf Reihe 3 zurück (B3). Wähle Schlag und Richtung, um die Offensive zurückzuerobern.",
    validShots: ["BANDEJA"],
    bestZones: ["D1", "E1"], // Anpassung Zielzonen für Bandeja
    explanation: "Die Bandeja wird tief und cross gespielt, um den Gegner hinten links unter Druck zu setzen und wieder vorzurücken.",
    positions: { you: "B3", partner: "D4", opp1: "A1", opp2: "D3", ball: { side: "left", zone: "B3" } },
    laufZone: "B4",
  },
  {
    id: 17,
    description: "Perfekter, halbhoher Ball auf Reihe 4 (C4). Was machst du, um den Gegner (B2) in die Ecke zu drängen.",
    validShots: ["VIBORA"],
    bestZones: ["A1", "B1"],
    explanation: "Die Víbora wird mit extremem Side-Spin scharf diagonal in die Ecke gezogen, damit sie flach an den Scheiben kleben bleibt.",
    positions: { you: "C4", partner: "A4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "C4" } },
    laufZone: "C4",
  },
  {
    id: 18,
    description: "Kurzer, hoher Ball fliegt ins Halbfeld (C3). Wähle den besten Abschluss.",
    validShots: ["SMASH"],
    bestZones: ["C5", "D5"],
    explanation: "Ein kurzer Ball im Halbfeld ist die Einladung für einen harten Power-Smash.",
    positions: { you: "C3", partner: "A3", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "C3" } },
    laufZone: "C4",
  },
  {
    id: 19,
    description: "Gegner-Smash prallt weit nach vorne ab (C3). Wähle Schlag und Richtung, um den Ball effektiv zu kontern.",
    validShots: ["BLOCK", "VOLLEY"],
    bestZones: ["B4", "C4"],
    explanation: "Smashes, die weit abprallen, kontert man am besten, indem man den Ball einfach kurz hinter das Netz blockt.",
    positions: { you: "C3", partner: "A2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "C3" } },
    laufZone: "C2",
  },
  {
    id: 20,
    description: "Aufschlag von links (B2). Wähle Schlagtyp und Flugrichtung für einen optimalen Start.",
    validShots: ["AUFSCHLAG"],
    bestZones: ["D3", "E2"],
    explanation: "Ein Aufschlag hart cross an die Seitenwand zieht den Gegner nach außen und öffnet das Feld.",
    positions: { you: "B2", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B2" } },
    laufZone: "B4",
  },
  {
    id: 21,
    description: "Gegner weichen unkontrolliert vom Netz zurück (Reihe 3). Was tust du um den freien Raum vorne zu nutzen.",
    validShots: ["CHIQUITA"],
    bestZones: ["B4", "C4"],
    explanation: "Spielen die Gegner defensiv, spielst du eine kurze Chiquita, um selbst die Netzhoheit zu übernehmen.",
    positions: { you: "B1", partner: "D1", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "B1" } },
    laufZone: "B4",
  },
  {
    id: 22,
    description: "Schneller Angriffsball kommt direkt auf deinen Körper (C4). Halte den Ball sicher im Spiel.",
    validShots: ["BLOCK"],
    bestZones: ["C2", "D2"],
    explanation: "Bei Bällen auf den Körper blockt man kompakt ab, ohne Schwung zu holen, um Fehler zu minimieren.",
    positions: { you: "C4", partner: "A4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "C4" } },
    laufZone: "C4",
  },
  {
    id: 23,
    description: "Gegnerischer Lob zwingt dich nach hinten an die Glasscheibe (B1). Wähle den Befreiungsschlag.",
    validShots: ["LOB"],
    bestZones: ["C1", "D1"],
    explanation: "Aus tiefster Bedrängnis an der Wand ist ein extrem hoher Lob das einzige Mittel, um Zeit zu gewinnen.",
    positions: { you: "B1", partner: "D1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    laufZone: "B2",
  },
  {
    id: 24,
    description: "Du stehst links vorne am Netz (A4). Ball kommt butterweich hoch an die linke Seitenwand (A5).",
    validShots: ["VIBORA", "VOLLEY"],
    bestZones: ["D1", "E1"],
    explanation: "Aus extremen Außenpositionen spielst du den Ball mit viel Schnitt scharf diagonal in die andere Ecke.",
    positions: { you: "A4", partner: "C4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "A5" } },
    laufZone: "B4",
  },
  {
    id: 25,
    description: "Gegner spielen sehr eng beieinander in der Mitte. Öffne das Spielfeld über die Außenwände.",
    validShots: ["DRIVE", "VOLLEY"],
    bestZones: ["A2", "E2"],
    explanation: "Ein flacher Ball cross an die Seitenwand (Gitter/Glas) zwingt die Gegner, ihre kompakte Formation aufzulösen.",
    positions: { you: "B2", partner: "D2", opp1: "C4", opp2: "D4", ball: { side: "left", zone: "B2" } },
    laufZone: "B2",
  },
  {
    id: 26,
    description: "Harter Schlag detoniert an deiner Rückwand und springt steil hoch ab (B2). Wie konterst du?.",
    validShots: ["BAJADA"],
    bestZones: ["C4", "D4"],
    explanation: "Nutze die Höhe des Abprallers, um den Ball mit einer harten Bajada peitschenartig nach unten in die Mitte zu ziehen.",
    positions: { you: "B2", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B2" } },
    laufZone: "B4",
  },
  {
    id: 27,
    description: "Ball kommt hart durch die Mitte auf dich zu, Gegner am Netz. Wähle Schlag und Richtung für einen kontrollierten Abwehrball.",
    validShots: ["BLOCK", "DRIVE"],
    bestZones: ["C2", "C1"], // Anpassung Zielzonen für Defensive
    explanation: "Bei Druck durch die Mitte spielst du den Ball flach und kontrolliert zurück, um den Winkel für den nächsten Angriff zu nehmen.",
    positions: { you: "A1", partner: "C1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    laufZone: "A1",
  },
  {
    id: 28,
    description: "Du stehst goldrichtig am Netz (B4). GEG2 (C3) rückt unüberlegt nach innen. Nutze den freien Raum.",
    validShots: ["VOLLEY"],
    bestZones: ["E4", "E5"],
    explanation: "Rückt ein Spieler zu weit in die Mitte ein, spielst du den Volley rigoros nach außen in den verwaisten Korridor.",
    positions: { you: "B4", partner: "D4", opp1: "B2", opp2: "C3", ball: { side: "left", zone: "B4" } },
    laufZone: "B4",
  },
  {
    id: 29,
    description: "Aufschlag von rechts (D2). Locke den Gegner sofort nach außen.",
    validShots: ["AUFSCHLAG"],
    bestZones: ["A2"],
    explanation: "Ein Aufschlag cross an die Seitenwand öffnet das Feld für deinen Partner am Netz.",
    positions: { you: "C2", partner: "A4", opp1: "A1", opp2: "D1", ball: { side: "left", zone: "D2" } },
    laufZone: "D4",
  },
  {
    id: 30,
    description: "Mittelhoher Lob zwingt dich auf Reihe 3 zurück (B3). Wähle Schlag und Zielzone um in der Offensive zu bleiben.",
    validShots: ["BANDEJA"],
    bestZones: ["D1", "D2"],
    explanation: "Die Bandeja ist ein Übergangsschlag. Spiele den Ball flach cross, um die Offensive beizubehalten.",
    positions: { you: "B3", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B3" } },
    laufZone: "B4",
  },
  {
    id: 31,
    description: "Der Ball kratzt flach über das Glas tief in deine Ecke (A1). Es ist kaum noch Raum für eine Ausholbewegung. Wie rettest du dich mit einer letzten Reflexbewegung aus dem Schlamassel?",
    validShots: ["LOB"],
    bestZones: ["A1", "B1"],
    explanation: "Eingequetscht im Eck rettet nur ein defensiver Schaufel-Lob. Danach musst du sofort die Ecke verlassen und zentraler (B2) decken.",
    positions: { you: "A1", partner: "C2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    laufZone: "B2",
  },// ==========================================
// ==========================================
  // LEVEL 3: LAUFRICHTUNG (IDs 31 - 60)
  // Fokus: Wohin bewege ich mich nach dem Schlag?
  // ==========================================
  {
    id: 31,
    description: "Du bist hinten links in die Ecke gedrängt. Die Gegner lauern aggressiv am Netz. Du schlägst einen perfekten, sehr hohen Lob über sie hinweg.",
    positions: { you: "B1", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["LOB"],
    bestZones: ["E1", "E5"],
    laufZone: "B4",
    explanation: "Nach einem perfekten Lob gibt es nur eine Richtung: Vor ans Netz (B4)! Wer hinten bleibt, verschenkt den taktischen Vorteil, während die Gegner nach hinten rennen."
  },
  {
    id: 32,
    description: "Du stehst dicht am Netz. Der Gegner spielt aus dem Halbfeld einen harten Drive exakt auf deinen Oberkörper.",
    positions: { you: "B5", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B5" } },
    validShots: ["BLOCK"],
    bestZones: ["C1", "C5", "D3"],
    laufZone: "B5",
    explanation: "Freeze! Bei Körpertreffern am Netz machst du dich kompakt und blockst. Jeder Schritt zur Seite oder nach hinten öffnet Lücken und führt meist zum Fehler. Stehenbleiben (B5)."
  },
  {
    id: 33,
    description: "Du stehst am Netz. Der Gegner spielt einen Lob ins Halbfeld. Du gehst zwei Schritte zurück und spielst eine sichere Bandeja in die gegnerische Ecke.",
    positions: { you: "B3", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B3" } },
    validShots: ["BANDEJA"],
    bestZones: ["E1", "E5"],
    laufZone: "B4",
    explanation: "Die Bandeja ist ein Aufbauschlag. Du weichst zum Schlagen ins Halbfeld (B3) zurück, musst danach aber sofort wieder ans Netz (B4) aufrücken, um die Lücke zu schließen."
  },
  {
    id: 34,
    description: "Der Gegner am Netz spielt einen schwachen Smash. Der Ball prallt hart an dein Glas und fliegt hoch bis ins Halbfeld zurück.",
    positions: { you: "B2", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B2" } },
    validShots: ["BAJADA", "DRIVE"],
    bestZones: ["E1", "E5"],
    laufZone: "B4",
    explanation: "Eine Einladung! Lauf dem Abpraller aggressiv ins Halbfeld (B2) entgegen, schlage ihn von oben herab und sprinte direkt weiter ans Netz (B4), um den Angriff abzuschließen."
  },
  {
    id: 35,
    description: "Aus dem Halbfeld spielst du eine softe Chiquita direkt vor die Füße des Netzspielers. Der Ball taucht extrem früh ab.",
    positions: { you: "B3", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B3" } },
    validShots: ["CHIQUITA"],
    bestZones: ["B2", "C2"],
    laufZone: "B4",
    explanation: "Eine Chiquita funktioniert nur mit dem anschließenden Netzangriff. Lauf sofort vor (B4), um den unweigerlich hoch kommenden Ball des Gegners als Volley abzufangen."
  },
  {
    id: 36,
    description: "Ein harter Ball zwingt dich tief in die Hocke. Du kannst den Ball gerade so als unkontrollierten Not-Lob zurückspielen, der eher zu kurz wird.",
    positions: { you: "B1", partner: "D1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["LOB"],
    bestZones: ["D3", "E3"],
    laufZone: "B1",
    explanation: "Gefahr! Ein schlechter Lob bedeutet, dass der Gegner sofort smashen wird. Bleibe hinten (B1) und mach dich bereit zur Verteidigung des Smashes. Vorlaufen wäre Selbstmord."
  },
  {
    id: 37,
    description: "Aus dem Halbfeld zündest du eine aggressive Vibora, die flach in die gegenüberliegende Ecke zischt und kaum von der Wand abspringen wird.",
    positions: { you: "B3", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B3" } },
    validShots: ["VIBORA"],
    bestZones: ["E5"],
    laufZone: "A4",
    explanation: "Nach einem extrem aggressiven Schlag gehst du auf den Kill. Rücke dichter ans Netz auf (A4 statt B4), um den schwachen Return direkt als harten Volley zu verwerten."
  },
  {
    id: 38,
    description: "Der Lob des Gegners war zu lang. Der Ball springt hoch von der Rückwand ab, du stehst perfekt, um ihn als Bajada wuchtig nach unten zu schlagen.",
    positions: { you: "B1", partner: "D4", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "B1" } },
    validShots: ["BAJADA"],
    bestZones: ["E3", "E5"],
    laufZone: "B4",
    explanation: "Die Bajada ist ein offensiver Übergangsschlag. Du nutzt den Schwung der Bewegung, um sofort nach dem Schlag das Netz (B4) zu attackieren."
  },
  {
    id: 39,
    description: "Am Netz spielst du einen druckvollen Vorhand-Volley genau durch die Mitte zwischen die beiden tief stehenden Gegner.",
    positions: { you: "D4", partner: "B4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "D4" } },
    validShots: ["VOLLEY"],
    bestZones: ["E3"],
    laufZone: "C4",
    explanation: "Wenn du in die Mitte spielst, verkleinerst du die Winkel für den Gegner. Verschiebe dich leicht zur Mitte (C4), um den direkten Passierball durch das Zentrum abzufangen."
  },
  {
    id: 40,
    description: "Du bist am Netz. Der Lob des Gegners ist perfekt und segelt unweigerlich über deinen Kopf hinweg. Dein Partner ist zu weit weg.",
    positions: { you: "B4", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B4" } },
    validShots: ["LOB", "DRIVE"],
    bestZones: ["E1", "E5"],
    laufZone: "B1",
    explanation: "Akzeptiere den verlorenen Netz-Vorteil. Drehe dich sofort um und sprinte in die Tiefe (B1), um den Ball nach dem Glasabpraller zu retten. Dein Partner zieht parallel mit zurück."
  },
  {
    id: 41,
    description: "Der Gegner serviert flach. Du machst einen Schritt ins Feld und spielst einen harten Drive-Return auf den vorrückenden Aufschläger.",
    positions: { you: "D1", partner: "B2", opp1: "D4", opp2: "B4", ball: { side: "left", zone: "D1" } },
    validShots: ["DRIVE"],
    bestZones: ["E5"],
    laufZone: "D2",
    explanation: "Obwohl der Return hart ist, bleibst du hinten (D2), bis du siehst, wie der Gegner den Volley spielt. Zu frühes Vorrücken öffnet den Raum für einen leichten Passierball."
  },
  {
    id: 42,
    description: "Du stehst auf B4, der Gegner auf B4 (gegenüber). Er schlägt einen schnellen Volley direkt auf dich. Es ist ein reines Reaktionsduell.",
    positions: { you: "B4", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B4" } },
    validShots: ["BLOCK", "VOLLEY"],
    bestZones: ["D3"],
    laufZone: "B4",
    explanation: "Beim direkten Schlagabtausch vorne gibt es keine Bewegung, nur Reflexe. Jede Gewichtsverlagerung nach hinten ist tödlich. Stehenbleiben (B4) und Schläger hinhalten!"
  },
  {
    id: 43,
    description: "Die Gegner kleben an der Rückwand. Du spielst von Netz aus einen gefühlvollen Stoppball knapp hinter das Netz.",
    positions: { you: "B4", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B4" } },
    validShots: ["VOLLEY"],
    bestZones: ["B2"],
    laufZone: "B5",
    explanation: "Nach einem Stoppball wird der Gegner (falls er ihn erwischt) den Ball nur knapp über das Netz löffeln können. Rücke maximal auf (B5), um diesen Ball direkt abzufangen."
  },
  {
    id: 44,
    description: "Am Netz drückst du den Volley scharf in Richtung der linken Seitenwand des Gegners.",
    positions: { you: "B4", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B4" } },
    validShots: ["VOLLEY"],
    bestZones: ["E1"],
    laufZone: "A4",
    explanation: "Wenn du nach außen spielst, öffnest du die Longline-Bahn. Verschiebe dich einen Schritt nach außen (A4), um den Passierball an der Linie zuzumachen."
  },
  {
    id: 45,
    description: "Der Gegner schlägt einen Smash. Du bist weit hinten und wehrst den Ball als flachen Block vor die Füße der Netzspieler ab.",
    positions: { you: "B1", partner: "D1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["BLOCK"],
    bestZones: ["C2", "C4"],
    laufZone: "B1",
    explanation: "Ein flacher Abwehrblock zwingt die Gegner zum tiefen Volley, berechtigt dich aber noch nicht zum Vorrücken. Position halten (B1) und auf den nächsten Ball warten."
  },
  {
    id: 46,
    description: "Du spielst von hinten einen etwas zu hohen Drive. Die Gegner rücken beide sofort aggressiv ans Netz auf.",
    positions: { you: "B2", partner: "D2", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "B2" } },
    validShots: ["DRIVE"],
    bestZones: ["B2", "B4"],
    laufZone: "B1",
    explanation: "Du hast den Druck abgegeben. Mach sofort einen Schritt zurück zur Glaswand (B1), um mehr Zeit für die Abwehr des kommenden Volleys zu haben."
  },
  {
    id: 47,
    description: "Du bekommst einen kurzen Lob. Du steigst hoch und hämmerst den Ball mit maximaler Kraft steil ins Feld, sodass er über die Rückwand fliegt (Por 3).",
    positions: { you: "B3", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B3" } },
    validShots: ["SMASH"],
    bestZones: ["E1"],
    laufZone: "B3",
    explanation: "Nach einem perfekten Gewinnschlag bleibst du stehen (B3). Die Gefahr ist gebannt, der Punkt gehört dir."
  },
  {
    id: 48,
    description: "Eure Gegner stehen weit außen. Du spielst von hinten einen flachen Drive knallhart genau durch die Mitte.",
    positions: { you: "B1", partner: "D1", opp1: "A2", opp2: "E2", ball: { side: "left", zone: "B1" } },
    validShots: ["DRIVE"],
    bestZones: ["D3"],
    laufZone: "C2",
    explanation: "Nach einem Schlag durch die Mitte solltest du dich auch selbst leicht zur Mitte orientieren (C2), um den besten Winkel für den nächsten Ball zu haben."
  },
  {
    id: 49,
    description: "Der Gegner spielt einen perfekten Stoppball. Du sprintest von hinten los und kratzt den Ball gerade so über das Netz.",
    positions: { you: "B3", partner: "D1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B3" } },
    validShots: ["LOB", "BLOCK"],
    bestZones: ["A4", "B3"],
    laufZone: "B5",
    explanation: "Du hast dich nach vorne gekämpft und stehst jetzt direkt am Netz. Zurückgehen ist unmöglich. Bleib am Netz kleben (B5) und versuche, dich im Nahkampf durchzusetzen."
  },
  {
    id: 50,
    description: "Dein Partner spielt aus der rechten Ecke einen super Lob und stürmt nach vorne ans Netz. Du bist noch hinten links.",
    positions: { you: "B1", partner: "D3", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["LOB"],
    bestZones: ["E1", "E5"],
    laufZone: "B4",
    explanation: "Padel spielt man als Team! Wenn dein Partner nach einem guten Lob ans Netz geht (D4), musst du sofort parallel mit vorrücken (B4), sonst klafft eine riesige Lücke im Team."
  },
  {
    id: 51,
    description: "Du spielst eine Bandeja mit mittlerer Geschwindigkeit sicher in die Mitte, um keinen Fehler zu riskieren.",
    positions: { you: "B3", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B3" } },
    validShots: ["BANDEJA"],
    bestZones: ["E3"],
    laufZone: "C4",
    explanation: "Rücke nach der Bandeja nicht nur vor, sondern orientiere dich etwas zur Mitte (C4), da der Gegner den Ball aus dem Zentrum in beide Richtungen verteilen kann."
  },
  {
    id: 52,
    description: "Der Gegner smasht gewaltig. Der Ball wird hoch von der Rückwand zurück zum gegnerischen Netz fliegen. Du hast keine Chance mehr.",
    positions: { you: "B1", partner: "D1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["BLOCK"],
    bestZones: ["A2"],
    laufZone: "B4",
    explanation: "Wenn der Ball uneinholbar vom eigenen Glas zurück zum Gegner fliegt, renn nach vorne ans Netz (B4)! Das ist deine einzige, winzige Chance, den Ball noch zu blocken."
  },
  {
    id: 53,
    description: "Am Netz spielst du einen scharfen Rückhand-Volley extrem cross an das gegnerische Gitter.",
    positions: { you: "D4", partner: "B4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "D4" } },
    validShots: ["VOLLEY"],
    bestZones: ["D5"],
    laufZone: "D4",
    explanation: "Ein Ball ans Gitter ist schwer zu kontrollieren. Behalte deine solide Grundposition (D4) bei, um alle Optionen abzudecken."
  },
  {
    id: 54,
    description: "Dein Lob rutscht dir ab und wird zu kurz und flach. Die Gegner formieren sich bereits zum Smash.",
    positions: { you: "B2", partner: "D2", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "B2" } },
    validShots: ["LOB"],
    bestZones: ["C2"],
    laufZone: "B1",
    explanation: "Alarm! Du hast einen Fehler gemacht. Geh sofort komplett an die Rückwand (B1) und mach dich extrem tief, um den unausweichlichen Smash bestmöglich zu überleben."
  },
  {
    id: 55,
    description: "Aus der Verteidigung blockst du den schweren Ball flach und langsam übers Netz. Die Gegner sind noch leicht auf dem Rückzug.",
    positions: { you: "B1", partner: "D1", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "B1" } },
    validShots: ["CHIQUITA", "BLOCK"],
    bestZones: ["B3"],
    laufZone: "B2",
    explanation: "Ein flacher, langsamer Ball gibt dir etwas Luft. Du kannst das Halbfeld noch nicht attackieren, aber einen Schritt vor (B2) gehen, um aus der reinen Defensive herauszukommen."
  },
  {
    id: 56,
    description: "Du triffst die Vibora perfekt und der Ball rutscht flach und giftig genau zwischen den beiden Gegnern hindurch.",
    positions: { you: "B3", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B3" } },
    validShots: ["VIBORA"],
    bestZones: ["E3"],
    laufZone: "B5",
    explanation: "Eine starke Vibora durch die Mitte zwingt die Gegner zu Chaos. Gehe extrem aggressiv ran (B5) und schnapp dir den zu erwartenden, hoch abprallenden Ball."
  },
  {
    id: 57,
    description: "Du stehst tief in der Vorhand-Ecke, der Aufschlag kommt schnell. Du spielst den Return hart und flach cross.",
    positions: { you: "D1", partner: "B2", opp1: "D4", opp2: "B4", ball: { side: "left", zone: "D1" } },
    validShots: ["DRIVE"],
    bestZones: ["E5"],
    laufZone: "D2",
    explanation: "Ein solider Return ist wichtig, aber du darfst nicht blind losstürmen, da der Netzspieler bereitsteht. Geh in die sichere Grundposition (D2) und warte ab."
  },
  {
    id: 58,
    description: "Der Gegner spielt aus dem Nichts einen schwachen Lob, während du am Netz stehst. Er ist so kurz, dass du ihn direkt vor dem Netz schlagen kannst.",
    positions: { you: "B5", partner: "D4", opp1: "B2", opp2: "D2", ball: { side: "left", zone: "B5" } },
    validShots: ["SMASH", "VIBORA"],
    bestZones: ["E1", "E5"],
    laufZone: "B5",
    explanation: "Ein kurzer Lob direkt vor dem Netz (B5) ist ein Geschenk. Du bleibst genau dort stehen, smasht ihn weg und beendest den Punkt. Zurückweichen wäre fatal."
  },
  {
    id: 59,
    description: "Der Ball klebt fast an der Rückwand. Du beugst dich weit hinunter und kratzt ihn mit einem extremen Bogen (Globo) unter die Hallendecke.",
    positions: { you: "B1", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B1" } },
    validShots: ["LOB"],
    bestZones: ["E1", "E5"],
    laufZone: "B4",
    explanation: "Wenn du einen Globo (sehr hohen Lob) spielst, ist der Ball ewig in der Luft. Das gibt dir massiv Zeit, dich in Ruhe vom Glas zu lösen und das Halbfeld/Netz (B4) zu erobern."
  },
  {
    id: 60,
    description: "Der Ball kommt blitzschnell von rechts außen. Du stehst links am Netz und leitest die Energie in einen Cross-Block um.",
    positions: { you: "B4", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B4" } },
    validShots: ["BLOCK"],
    bestZones: ["E5"],
    laufZone: "B4",
    explanation: "Wieder ein Reaktionsschlag. Nach dem Block am Netz verlässt du niemals deine kompakte Standposition. Stehenbleiben (B4)!"
  },
  // ==========================================
  // LEVEL 4: SPIELZUG (IDs 62 - 111)
  // Fokus: Kompletter Spielzug (Schlag + Ziel + Laufweg)
  // ==========================================
  
  // --- AUFSCHLAG (Fokus: Spieleröffnung & Aufrücken) ---
  {
    id: 62,
    description: "Spieleröffnung von Rechts: Du servierst von der rechten Seite. Der Returnspieler hat sich sehr weit nach außen Richtung Gitter positioniert, die Mitte ist offen.",
    positions: { you: "D1", partner: "A4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "D1" } },
    validShots: ["AUFSCHLAG"],
    bestZones: ["C3"],
    laufZone: "D4",
    explanation: "Ein flacher Aufschlag auf das T (C3) nutzt die Lücke aus. Nach jedem Aufschlag sprintest du kompromisslos ans Netz (D4), um die Position zu sichern."
  },
  {
    id: 63,
    description: "Spieleröffnung an die Wand: Du eröffnest den Punkt von rechts und möchtest den Gegner direkt in der Ecke einschnüren.",
    positions: { you: "D1", partner: "A4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "D1" } },
    validShots: ["AUFSCHLAG"],
    bestZones: ["E3"],
    laufZone: "D4",
    explanation: "Der Aufschlag an die Scheibe (E3) ist schwer zu retournieren. Du nutzt die Flugzeit für den direkten Sprint ans Netz (D4)."
  },
  {
    id: 64,
    description: "Service ins Eck: Du schlägst von der linken Seite auf die Rückhand des Gegners auf, direkt ans Glas.",
    positions: { you: "B1", partner: "D4", opp1: "D1", opp2: "B1", ball: { side: "left", zone: "B1" } },
    validShots: ["AUFSCHLAG"],
    bestZones: ["A3"],
    laufZone: "B4",
    explanation: "Ein starker Kick-Aufschlag an die Scheibe (A3) bringt den Gegner in Not. Du rückst sofort auf deine Netzposition (B4) vor."
  },
  {
    id: 65,
    description: "Überraschung im Zentrum: Der Gegner klebt förmlich an der Glasscheibe, um den Winkel zuzumachen. Die Mitte des Feldes ist völlig verwaist.",
    positions: { you: "B1", partner: "D4", opp1: "E1", opp2: "B1", ball: { side: "left", zone: "B1" } },
    validShots: ["AUFSCHLAG"],
    bestZones: ["C3"],
    laufZone: "B4",
    explanation: "Du bestrafst die schlechte Positionierung mit einem schnellen Service in die Mitte (C3) und sprintest nach vorne (B4), um den Return abzufangen."
  },
  {
    id: 66,
    description: "Aggressive Positionierung: Beide Gegner stehen extrem aggressiv am Netz und beim Return. Du willst sie direkt bei der Spieleröffnung einklemmen.",
    positions: { you: "D1", partner: "B4", opp1: "A1", opp2: "D2", ball: { side: "left", zone: "D1" } },
    validShots: ["AUFSCHLAG"],
    bestZones: ["D3"],
    laufZone: "D4",
    explanation: "Ein harter, schneller Aufschlag direkt auf den Körper (D3) lässt dem Gegner keinen Platz zum Ausholen. Laufziel bleibt zwingend das Netz (D4)."
  },

  // --- DRIVE (Fokus: Return & flache Konter) ---
  {
    id: 67,
    description: "Unter Druck an der Seitenwand: Der gegnerische Ball treibt dich extrem weit nach außen. Du bist fast am Gitter, der Netzspieler stürmt vor.",
    positions: { you: "A1", partner: "D2", opp1: "C4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    validShots: ["DRIVE"],
    bestZones: ["A5"],
    laufZone: "C1",
    explanation: "Du ziehst den Drive extrem flach Longline (A5), um den Netzspieler zu passieren. Danach musst du sofort die offene Mitte (C1) in der Defensive schließen, da du weit aus dem Feld getrieben wurdest."
  },
  {
    id: 68,
    description: "Die Einladung beim Return: Der gegnerische Aufschlag ist viel zu langsam und springt hoch ab. Du trittst entschlossen ins Feld hinein.",
    positions: { you: "D1", partner: "B2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "D2" } },
    validShots: ["DRIVE"],
    bestZones: ["C1"],
    laufZone: "D3",
    explanation: "Mit einem krachenden Drive durch die Mitte (C1) trennst du die Gegner. Da es ein Angriffsschlag ist, rückst du aggressiv ins Halbfeld (D3) auf."
  },
  {
    id: 69,
    description: "Wenig Platz beim Return: Der Aufschläger rückt extrem schnell und dicht ans Netz auf. Du hast keine Zeit, um spitze Winkel zu spielen.",
    positions: { you: "E1", partner: "A2", opp1: "C4", opp2: "E4", ball: { side: "left", zone: "E1" } },
    validShots: ["DRIVE"],
    bestZones: ["E4"],
    laufZone: "E2",
    explanation: "Du spielst den Drive direkt auf den Körper des Aufrückenden (E4). Da das Risiko hoch ist, bleibst du in einer soliden Defensivposition (E2) stehen."
  },
  {
    id: 70,
    description: "Vorbereitung aus der Ecke: Du stehst hinten links. Du willst den diagonalen Netzspieler dazu zwingen, den Ball von ganz unten holen zu müssen.",
    positions: { you: "A1", partner: "D2", opp1: "D4", opp2: "B4", ball: { side: "left", zone: "A1" } },
    validShots: ["DRIVE"],
    bestZones: ["E4"],
    laufZone: "B2",
    explanation: "Ein flacher Drive auf die Füße (E4) zwingt den Gegner zum Volley von unten. Du nutzt das, um moderat ins Halbfeld (B2) aufzurücken und den Druck zu erhöhen."
  },
  {
    id: 71,
    description: "Spin-Attacke aus der Tiefe: Du bist in der rechten Ecke. Du möchtest einen Ball spielen, der nach dem Aufkommen extrem schwer einzuschätzen ist.",
    positions: { you: "E1", partner: "A2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "E1" } },
    validShots: ["DRIVE"],
    bestZones: ["A4"],
    laufZone: "D2",
    explanation: "Ein mit Topspin gezogener Drive aufs Gitter (A4) ist für den Gegner unberechenbar. Du sicherst deine Seite ab und gehst auf die neutrale Position (D2)."
  },

  // --- LOB (Fokus: Coast-to-Coast & Raumgewinn) ---
  {
    id: 72,
    description: "Gefangen in der Tiefe (Links): Du klebst tief im linken Eck. Beide Gegner stehen extrem nah und aggressiv am Netz. Du brauchst dringend Luft.",
    positions: { you: "A1", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    validShots: ["LOB"],
    bestZones: ["E1"],
    laufZone: "B4",
    explanation: "Der Lob geht extrem hoch und diagonal (E1). Du nutzt die ewig lange Flugzeit für einen Vollgas-Sprint direkt ans Netz (B4)!"
  },
  {
    id: 73,
    description: "Gefangen in der Tiefe (Rechts): Du wurdest in die rechte Ecke gedrängt, die Gegner riechen ihre Chance und machen das Netz dicht.",
    positions: { you: "E1", partner: "A2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "E1" } },
    validShots: ["LOB"],
    bestZones: ["A1"],
    laufZone: "D4",
    explanation: "Ein perfekter Lob nach A1 kauft dir wertvolle Zeit. Wer nach einem guten Lob hinten stehen bleibt, verschenkt den Punkt. Sprint auf D4!"
  },
  {
    id: 74,
    description: "Zentrum unter Beschuss: Ein harter Schuss zwingt dich tief in die Mitte der Defensive. Du möchtest das Tempo komplett aus dem Spiel nehmen.",
    positions: { you: "C1", partner: "A2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "C1" } },
    validShots: ["LOB"],
    bestZones: ["C1"],
    laufZone: "C4",
    explanation: "Du überlopfst beide Spieler genau durch die Mitte (C1). Da die Gegner nach außen ausweichen müssen, stürmst du direkt auf C4 vor."
  },
  {
    id: 75,
    description: "Fehlschlag im Halbfeld: Du triffst den Ball unsauber. Er steigt auf, wird aber viel zu flach bleiben. Ein Gewitter bahnt sich an.",
    positions: { you: "A2", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A2" } },
    validShots: ["LOB"],
    bestZones: ["C3"],
    laufZone: "A1",
    explanation: "Fehler erkannt! Der Lob ist zu kurz (C3). Flucht nach hinten! Du musst sofort an die Scheibe (A1) und dich extrem tief machen, um den Smash zu überleben."
  },
  {
    id: 76,
    description: "Überraschung aus der Offensive: Du stehst auf B3. Die Gegner kleben etwas zu nah am Netz. Du entscheidest dich gegen rohe Gewalt und für Finesse.",
    positions: { you: "B3", partner: "D3", opp1: "B5", opp2: "D5", ball: { side: "left", zone: "B3" } },
    validShots: ["LOB"],
    bestZones: ["A1"],
    laufZone: "B4",
    explanation: "Ein Lob aus dem Halbfeld ist tödlich. Der Ball geht tief in die Ecke (A1) und du schiebst sofort auf B4 nach, um den Gegnern keine Chance zur Rückkehr zu lassen."
  },

  // --- BANDEJA (Fokus: Position halten & Aufbau) ---
  {
    id: 77,
    description: "Rückzug aus der Offensive: Du hattest das Netz, aber ein hoher Ball zwingt dich zurück ins Halbfeld. Du nimmst den Ball aus der Luft, um den Druck aufrechtzuerhalten.",
    positions: { you: "B2", partner: "D4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "B2" } },
    validShots: ["BANDEJA"],
    bestZones: ["E1"],
    laufZone: "B4",
    explanation: "Du spielst die Bandeja cross in die Ecke (E1). Da dies ein reiner Aufbauschlag ist, musst du sofort wie an einem Gummiband wieder ans Netz (B4) zurück."
  },
  {
    id: 78,
    description: "Aufbau durchs Zentrum: Du wurdest ins zentrale Halbfeld zurückgedrängt. Du willst Verwirrung stiften, ohne ein hohes Risiko einzugehen.",
    positions: { you: "C2", partner: "B4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "C2" } },
    validShots: ["BANDEJA"],
    bestZones: ["C1"],
    laufZone: "C4",
    explanation: "Eine sichere Bandeja durch die Mitte (C1) nimmt dem Gegner den Winkel. Du rückst danach direkt wieder entschlossen auf C4 auf."
  },
  {
    id: 79,
    description: "Sicherheit geht vor: Du bist auf D2, der Ball ist etwas zu tief gefallen, um noch extrem aggressiv zu werden. Du setzt auf Kontrolle.",
    positions: { you: "D2", partner: "B4", opp1: "C1", opp2: "A1", ball: { side: "left", zone: "D2" } },
    validShots: ["BANDEJA"],
    bestZones: ["A1"],
    laufZone: "D3",
    explanation: "Du legst den Ball kontrolliert mit einer Bandeja ab (A1). Da du nicht voll getroffen hast, rückst du nur auf D3 vor, um nicht in einen leichten Konter zu laufen."
  },
  {
    id: 80,
    description: "Distanz schaffen: Die Gegner rücken verdächtig nah auf. Du nimmst den halbhohen Ball aus der Luft, um sie wieder an die Wand zu drängen.",
    positions: { you: "B3", partner: "D4", opp1: "C3", opp2: "D3", ball: { side: "left", zone: "B3" } },
    validShots: ["BANDEJA"],
    bestZones: ["C1"],
    laufZone: "B4",
    explanation: "Du feuerst die Bandeja flach auf den Körper des Gegners (C1). Durch den Druck hast du genug Zeit, deine ideale Netzposition (B4) zurückzuerobern."
  },
  {
    id: 81,
    description: "Die Lücke an der Linie: Der Gegner vor dir steht viel zu weit in der Mitte. Du nimmst den Ball im Zurücklaufen und bestrafst diesen Stellungsfehler.",
    positions: { you: "B2", partner: "D4", opp1: "C1", opp2: "E1", ball: { side: "left", zone: "B2" } },
    validShots: ["BANDEJA"],
    bestZones: ["A1"],
    laufZone: "B4",
    explanation: "Du ziehst die Bandeja die Linie entlang (A1). Danach musst du schnell wieder vor (B4), um einen möglichen Longline-Passierball abzusichern."
  },

  // --- VIBORA (Fokus: Agresisver Aufbau & Kill-Push) ---
  {
    id: 82,
    description: "Einladung im Halbfeld: Der Ball verhungert auf halbem Weg in der Luft (D2). Du stellst dich perfekt seitlich und willst maximalen Schnitt und Druck aufbauen.",
    positions: { you: "D2", partner: "B4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "D2" } },
    validShots: ["VIBORA"],
    bestZones: ["A1"],
    laufZone: "D5",
    explanation: "Die Vibora zischt tief ins Eck (A1). Da der Return der Gegner extrem schwach ausfallen wird, sprintest du ganz dicht ans Netz (D5) für den finalen Kill-Volley!"
  },
  {
    id: 83,
    description: "Unberechenbarer Winkel: Du nimmst den Ball auf B3 an. Du willst ihn so schlagen, dass er an der gegnerischen Seite tot abrutscht.",
    positions: { you: "B3", partner: "D4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "B3" } },
    validShots: ["VIBORA"],
    bestZones: ["E2"],
    laufZone: "B4",
    explanation: "Der schnelle Ball ans Gitter (E2) durch eine Vibora springt wild ab. Du gehst dominant vor auf B4, um jeden halbhohen Abpraller sofort zu bestrafen."
  },
  {
    id: 84,
    description: "Spaltung der Abwehr: Die Gegner lassen eine riesige Lücke in der Mitte. Du entscheidest dich für einen aggressiven, extrem flachen Schlag aus der Luft dazwischen.",
    positions: { you: "C2", partner: "D4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "C2" } },
    validShots: ["VIBORA"],
    bestZones: ["C1"],
    laufZone: "C4",
    explanation: "Eine harte Vibora in die Mitte (C1) erzwingt Missverständnisse. Du rückst direkt ins Zentrum (C4) auf, um das Feld komplett dichtzumachen."
  },
  {
    id: 85,
    description: "Angriff auf die Füße: Einer der Gegner macht Anstalten aufzurücken. Du erwischst den Ball hoch genug, um ihn gnadenlos nach unten zu drücken.",
    positions: { you: "D2", partner: "B4", opp1: "C3", opp2: "A1", ball: { side: "left", zone: "D2" } },
    validShots: ["VIBORA"],
    bestZones: ["C4"],
    laufZone: "D4",
    explanation: "Du drückst die Vibora brutal flach auf seine Füße (C4). Ein Fehler ist quasi garantiert. Ab nach vorne (D4)!"
  },
  {
    id: 86,
    description: "Rettungstat aus der Schieflage: Der Ball ist dir leicht in den Rücken gefallen (E2), aber du reißt den Schläger noch hoch, um ihn mit Schnitt rüberzuzwingen.",
    positions: { you: "E2", partner: "A4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "E2" } },
    validShots: ["VIBORA"],
    bestZones: ["B1"],
    laufZone: "E3",
    explanation: "Die Not-Vibora nach B1 ist giftig, aber deine Balance war schlecht. Rücke nur moderat ins Halbfeld (E3) auf, bis du wieder sicher stehst."
  },

  // --- BAJADA (Fokus: Wandabpraller & Bungee-Sprint) ---
  {
    id: 87,
    description: "Geschenk von der Rückwand (Links): Der Ball prallt extrem hoch von deiner hinteren Scheibe ab. Du stehst bereit dahinter, das Feld liegt offen vor dir.",
    positions: { you: "A1", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    validShots: ["BAJADA"],
    bestZones: ["E1"],
    laufZone: "B4",
    explanation: "Du feuerst die Bajada de Pared mit Vollgas cross (E1). Nimm den Vorwärtsimpuls des Schlags mit und sprinte wie an einem Bungee-Seil sofort wieder ans Netz (B4)!"
  },
  {
    id: 88,
    description: "Hoher Rebound (Rechts): Der Abpraller springt dir an der rechten Wand perfekt auf Schulterhöhe entgegen. Die Gegner kleben am Netz.",
    positions: { you: "E1", partner: "B4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "E1" } },
    validShots: ["BAJADA"],
    bestZones: ["C1"],
    laufZone: "D4",
    explanation: "Du ziehst die Bajada hart durch die Mitte (C1), um die Gegner zu bestrafen. Keine Pause, sofort vorstürmen auf D4!"
  },
  {
    id: 89,
    description: "Die feine Klinge: Du tust so, als würdest du den hohen Wandabpraller voll durchziehen, nimmst aber im letzten Moment alles Tempo raus.",
    positions: { you: "A1", partner: "D3", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A1" } },
    validShots: ["BAJADA"],
    bestZones: ["A4"],
    laufZone: "A3",
    explanation: "Der Ball droppt weich (A4). Du überraschst die Gegner mit dieser Fake-Bajada, musst aber explosiv vorrücken (A3), um den resultierenden Notschlag abzufangen."
  },
  {
    id: 90,
    description: "Die Schwachstelle anvisieren: Der Netzspieler auf deiner Seite wirkt wackelig. Du hast einen perfekten Abpraller von der Scheibe auf Schlägerhöhe.",
    positions: { you: "E2", partner: "B4", opp1: "D4", opp2: "B4", ball: { side: "left", zone: "E2" } },
    validShots: ["BAJADA"],
    bestZones: ["D4"],
    laufZone: "D3",
    explanation: "Du schießt die Bajada kompromisslos auf den Körper des unsicheren Spielers (D4). Durch seinen flachen Block rückst du auf D3 auf, um das Feld eng zu machen."
  },
  {
    id: 91,
    description: "Zu flach für den Angriff: Der Abpraller an der Scheibe (C1) war zu niedrig für einen brachialen Schuss von oben. Du musst ihn solide im Spiel halten.",
    positions: { you: "C1", partner: "D3", opp1: "A4", opp2: "E4", ball: { side: "left", zone: "C1" } },
    validShots: ["BAJADA"],
    bestZones: ["E1"],
    laufZone: "C1",
    explanation: "Du streichst den Ball als kontrollierte Defensiv-Bajada nach E1. Da du nicht angegriffen hast, bleibst du hinten (C1) und sicherst die Basis."
  },

  // --- CHIQUITA (Fokus: Falle stellen & Rhythmuswechsel) ---
  {
    id: 92,
    description: "Die Falle im Niemandsland: Du stehst im Halbfeld. Die Gegner lauern angespannt am Netz auf einen harten Ball. Du nimmst komplett die Härte raus.",
    positions: { you: "C3", partner: "A2", opp1: "B5", opp2: "D5", ball: { side: "left", zone: "C3" } },
    validShots: ["CHIQUITA"],
    bestZones: ["B4"],
    laufZone: "C4",
    explanation: "Du legst den Ball als softe Chiquita auf B4. Das ist ein Lockvogel! Du MUSST sofort vor ans Netz (C4) sprinten, um den Ball hoch abzugreifen."
  },
  {
    id: 93,
    description: "Der extreme Winkel: Aus der Vorhand-Ecke willst du den Ball extrem kurz und flach vor die Füße des diagonalen Gegners abtropfen lassen.",
    positions: { you: "D2", partner: "B2", opp1: "A4", opp2: "D4", ball: { side: "left", zone: "D2" } },
    validShots: ["CHIQUITA"],
    bestZones: ["A4"],
    laufZone: "D4",
    explanation: "Die Chiquita fällt auf A4 runter. Du drückst sofort aggressiv nach vorne (D4), da der Gegner den Ball nur noch von ganz unten nach oben heben kann."
  },
  {
    id: 94,
    description: "Chaos im Zentrum: Zwischen den Gegnern am Netz ist eine kleine Lücke. Du willst den Ball genau dort sanft fallen lassen, damit beide zögern.",
    positions: { you: "A2", partner: "D2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "A2" } },
    validShots: ["CHIQUITA"],
    bestZones: ["C4"],
    laufZone: "B4",
    explanation: "Der weiche Ball in die Mitte (C4) zwingt beide Gegner in die Knie. Du nutzt die Verwirrung und stürmst direkt an dein Netz (B4)."
  },
  {
    id: 95,
    description: "Das Netzduell drosseln: Du und der Gegner stehen euch sehr nah gegenüber. Statt roher Gewalt nimmst du das Tempo in einer riskanten Aktion komplett raus.",
    positions: { you: "B4", partner: "D4", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "B4" } },
    validShots: ["CHIQUITA"],
    bestZones: ["C4"],
    laufZone: "B5",
    explanation: "Du legst den Ball in Zeitlupe auf C4 ab (Chiquita). Das funktioniert nur, wenn du danach das Netz extrem zumachst (B5), um dem Gegner jeden Ausweg zu nehmen."
  },
  {
    id: 96,
    description: "Abfallender Ball aus der Tiefe: Aus der hintersten Ecke spielst du einen weichen Ball, der genau vor den Füßen des gegnerischen Aufschlägers landen soll.",
    positions: { you: "E1", partner: "B2", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "E1" } },
    validShots: ["CHIQUITA"],
    bestZones: ["D4"],
    laufZone: "E3",
    explanation: "Die tiefe Chiquita fällt auf D4 ab. Da du von ganz hinten kommst, reicht die Zeit für einen Netzsprint nicht. Du sicherst immerhin das Halbfeld (E3) ab."
  },

  // --- VOLLEY (Fokus: Am Netz zuschlagen & Wischer-Bewegung) ---
  {
    id: 97,
    description: "Partner in Not: Dein Partner wird tief nach hinten rechts gedrängt. Du bist allein links am Netz und bekommst einen passablen Ball.",
    positions: { you: "D4", partner: "A2", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "D4" } },
    validShots: ["VOLLEY"],
    bestZones: ["A1"],
    laufZone: "C3",
    explanation: "Du spielst den Volley sicher auf A1. Sofort danach weichst du synchron mit deinem Partner in die Mitte/Halbfeld (C3) zurück. Das Netz gibt man immer im Team auf!"
  },
  {
    id: 98,
    description: "Der hohe Abschluss: Du erwischst den Ball extrem hoch am Netz. Die Gegner sind weit hinten. Es ist Zeit, den Sack zuzumachen.",
    positions: { you: "B4", partner: "D4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "B4" } },
    validShots: ["VOLLEY"],
    bestZones: ["E1"],
    laufZone: "B5",
    explanation: "Du drückst den Volley kompromisslos in die Ecke (E1). Wenn du den Gegner derart in die Enge treibst, schiebst du bis auf B5 vor, um ihn komplett zu ersticken."
  },
  {
    id: 99,
    description: "Sicherheit im Zentrum: Der Ball kommt schnell auf dich zu, du willst kein Risiko eingehen und drückst ihn direkt zwischen die Verteidiger.",
    positions: { you: "C4", partner: "A4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "C4" } },
    validShots: ["VOLLEY"],
    bestZones: ["C1"],
    laufZone: "C4",
    explanation: "Ein Volley in die Mitte (C1) ist die sicherste Option. Du behältst deine dominante und zentrale Position (C4) einfach bei."
  },
  {
    id: 100,
    description: "Das feine Händchen: Die Gegner kleben an der hinteren Glaswand und erwarten einen harten Schuss. Du lässt den Ball am Netz einfach abtropfen.",
    positions: { you: "D4", partner: "B4", opp1: "A1", opp2: "D1", ball: { side: "left", zone: "D4" } },
    validShots: ["VOLLEY"],
    bestZones: ["D5"],
    laufZone: "D5",
    explanation: "Ein perfekter Stop-Volley fällt tot hinter das Netz (D5). Du musst sofort ganz heran (D5), da der heranstürmende Gegner ihn (wenn überhaupt) nur noch sanft anheben kann."
  },
  {
    id: 101,
    description: "Schuss aufs Metall: Aus der linken Position feuerst du den Ball ohne Vorwarnung scharf auf das gegenüberliegende Gitter.",
    positions: { you: "B4", partner: "D4", opp1: "E1", opp2: "A1", ball: { side: "left", zone: "B4" } },
    validShots: ["VOLLEY"],
    bestZones: ["E2"],
    laufZone: "A4",
    explanation: "Ein aggressiver Volley ans Gitter (E2) öffnet kurz deine Longline-Seite. Verschiebe dich einen Schritt nach links (A4), um diesen Passierball direkt zu verhindern."
  },

  // --- SMASH (Fokus: Punkt beenden & Fake) ---
  {
    id: 102,
    description: "Der perfekte Abschluss (Links): Ein viel zu kurzer, hoher Ball trudelt genau auf dich (B4) zu. Das ist deine Chance, den Punkt spektakulär zu beenden.",
    positions: { you: "B4", partner: "D4", opp1: "B1", opp2: "E1", ball: { side: "left", zone: "B4" } },
    validShots: ["SMASH"],
    bestZones: ["C2"],
    laufZone: "B4",
    explanation: "Du hämmerst den Smash so hart auf C2, dass er über die 3-Meter-Wand fliegt (Por 3). Punkt für dich! Keine Bewegung mehr nötig, genieße es auf B4."
  },
  {
    id: 103,
    description: "Die Einladung (Rechts): Der hohe Ball ist eine absolute Einladung. Du bist auf D4 positioniert und holst mit maximaler Kraft aus.",
    positions: { you: "D4", partner: "B4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "D4" } },
    validShots: ["SMASH"],
    bestZones: ["C2"],
    laufZone: "D4",
    explanation: "Auch hier: Der krachende Smash über die Seitenwand beendet den Ballwechsel sofort. Du bleibst entspannt auf D4 stehen."
  },
  {
    id: 104,
    description: "Rohe Gewalt: Der Ball ist hoch, aber ziemlich weit hinten. Du ziehst voll durch, um ihn mit reiner Gewalt flach an die Rückwand zu schmettern.",
    positions: { you: "C3", partner: "A3", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "C3" } },
    validShots: ["SMASH"],
    bestZones: ["C1"],
    laufZone: "C4",
    explanation: "Der Smash knallt auf C1 und kommt extrem schnell zurück ins Feld. Du musst nach dem Schlag sofort ans Netz (C4) nachrücken, um Herr der Lage zu bleiben."
  },
  {
    id: 105,
    description: "Kick über die Rückwand: Du stehst direkt unter dem Ball auf B5. Du gehst volles Risiko, um den Ball senkrecht steigen zu lassen.",
    positions: { you: "B5", partner: "D4", opp1: "B1", opp2: "D1", ball: { side: "left", zone: "B5" } },
    validShots: ["SMASH"],
    bestZones: ["B2"],
    laufZone: "B5",
    explanation: "Du kickst den Smash bei B2 so an, dass er direkt über die 4-Meter-Rückwand springt (Por 4). Ein fehlerfreier Winner. Stehenbleiben (B5)!"
  },
  {
    id: 106,
    description: "Der große Bluff: Die Gegner rennen panisch nach hinten, weil sie deinen gewaltigen Ausholschwung sehen und das Schlimmste erwarten.",
    positions: { you: "D4", partner: "B4", opp1: "A1", opp2: "E1", ball: { side: "left", zone: "D4" } },
    validShots: ["SMASH"],
    bestZones: ["D4"],
    laufZone: "D5",
    explanation: "Du stoppst den Smash-Schwung im letzten Moment und tippst den Ball nur butterweich ans Netz (D4). Rücke sofort auf D5 vor, da der Ball sehr flach bleiben wird."
  },

  // --- BLOCK (Fokus: Notsituationen & Einfrieren) ---
  {
    id: 107,
    description: "Überleben am Netz: Du klebst am Netz (A5), während der Gegner aus kurzer Distanz mit voller Wucht auf dich abzieht. Du reißt den Schläger schützend hoch.",
    positions: { you: "A5", partner: "D4", opp1: "B3", opp2: "D3", ball: { side: "left", zone: "A5" } },
    validShots: ["BLOCK"],
    bestZones: ["C3"],
    laufZone: "A1",
    explanation: "Alarm! Du hast durch den Not-Block eine Smash-Vorlage für den Gegner in die Luft gelegt (C3). Wer jetzt vorne bleibt, wird abgeschossen. Panik-Sprint rückwärts an die Scheibe (A1)!"
  },
  {
    id: 108,
    description: "Eingefroren: Du stehst auf B4. Ein knallharter, flacher Laser-Schuss kommt direkt auf deinen Magen zugeflogen.",
    positions: { you: "B4", partner: "D4", opp1: "C2", opp2: "A2", ball: { side: "left", zone: "B4" } },
    validShots: ["BLOCK"],
    bestZones: ["A1"],
    laufZone: "B4",
    explanation: "Freeze! Bei Körpertreffern machst du dich kompakt und nutzt einen Block. Jeder Schritt nach hinten ist falsch. Bleib wie angewurzelt auf B4 stehen."
  },
  {
    id: 109,
    description: "Verteidigung aus der Hocke: Du gehst in der tiefsten Ecke extrem in die Knie, um einen harten Schmetterball gerade noch so abzuwehren.",
    positions: { you: "E1", partner: "B1", opp1: "B4", opp2: "D4", ball: { side: "left", zone: "E1" } },
    validShots: ["BLOCK"],
    bestZones: ["C4"],
    laufZone: "E2",
    explanation: "Der Block tropft sicher vor die Füße der Gegner (C4) ab. Da du noch nicht aktiv angegriffen hast, gehst du nur einen Sicherheitsschritt auf E2 vor."
  },
  {
    id: 110,
    description: "Feuergefecht auf engstem Raum: Schneller Schlagabtausch, Reflex gegen Reflex, direkt an der Netzkante.",
    positions: { you: "D4", partner: "B4", opp1: "D4", opp2: "A4", ball: { side: "left", zone: "D4" } },
    validShots: ["BLOCK"],
    bestZones: ["E4"],
    laufZone: "D4",
    explanation: "Pures Reflex-Padel. Block den Ball entschlossen cross (E4) und bleib auf deiner Position (D4) kleben, um sofort den nächsten Reflex parat zu haben."
  },
  {
    id: 111,
    description: "Den Rückzug antreten: Dein Partner spielt einen Fehlpass. Die Gegner stürmen vor, du kannst den Ball nur noch passiv entschärfen.",
    positions: { you: "B3", partner: "E1", opp1: "A4", opp2: "D4", ball: { side: "left", zone: "B3" } },
    validShots: ["BLOCK"],
    bestZones: ["C1"],
    laufZone: "B1",
    explanation: "Du blockst den Ball tief in die Mitte (C1). Da das Momentum klar bei den heranfliegenden Gegnern liegt, weichst du schnell und sicher in die Abwehrreihe (B1) zurück."
  }


];
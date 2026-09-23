export const SHOT_TYPES = [
  "AUFSCHLAG", "DRIVE", "VOLLEY", "BLOCK", 
  "LOB", "CHIQUITA", "BAJADA", 
  "BANDEJA", "VIBORA", "SMASH"
];

export type TurnResult = "success" | "perfect" | "recovery" | "error_net" | "error_out" | "error_smash_over_head" | "error_wrong_zone" | "error_wall_direct" | null;
export type PlayerId = "you" | "partner" | "opp1" | "opp2";
export type GamePhase = "player_planning" | "player_animating" | "ai_prepare" | "timer_running";
export type Command = { run: string | null, shot: string | null, target: string | null };

export type Scenario = {
  id: number;
  description: string;
  positions: { you: string; partner: string; opp1: string; opp2: string; ball: { side: string; zone: string } };
  validShots: string[];
  bestZones: string[];
  laufZone: string;
  explanation: string;
};

const COL_TO_NUM: Record<string, number> = { "A": 1, "B": 2, "C": 3, "D": 4, "E": 5 };
const NUM_TO_COL: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };

export const getServerInfo = (totalPoints: number) => {
  if (totalPoints === 0) return { serverId: "you" as PlayerId, isRightCourt: true };
  const rem = (totalPoints - 1) % 8;
  switch(rem) {
    case 0: return { serverId: "opp1" as PlayerId, isRightCourt: false };
    case 1: return { serverId: "opp1" as PlayerId, isRightCourt: true }; 
    case 2: return { serverId: "partner" as PlayerId, isRightCourt: false }; 
    case 3: return { serverId: "partner" as PlayerId, isRightCourt: true };  
    case 4: return { serverId: "opp2" as PlayerId, isRightCourt: false }; 
    case 5: return { serverId: "opp2" as PlayerId, isRightCourt: true };  
    case 6: return { serverId: "you" as PlayerId, isRightCourt: false };  
    case 7: return { serverId: "you" as PlayerId, isRightCourt: true };   
    default: return { serverId: "you" as PlayerId, isRightCourt: true };
  }
};

export const calculateBallTrajectory = (targetZone: string, shotType: string, hitterZone: string = "C1") => {
  const tColNum = COL_TO_NUM[targetZone[0]];
  const tRow = parseInt(targetZone[1]);
  
  const hRow = parseInt(hitterZone[1]);
  const hZ = - (10 - (hRow * 2) + 1); 
  const tZ = 10 - (tRow * 2) + 1;     
  const zDist = Math.abs(tZ - hZ);
  
  let isWallHit = false;
  let reboundZone: string | null = null;
  
  let baseTime = 5000;
  const sType = shotType.toUpperCase();
  let powerMultiplier = 0.25;
  
  if (sType === "LOB") { baseTime = 7500; powerMultiplier = 0.10; }
  else if (sType === "SMASH") { baseTime = 3000; powerMultiplier = 1.0; }
  else if (sType === "VOLLEY") { baseTime = 3800; powerMultiplier = 0.25; }
  else if (sType === "BLOCK") { baseTime = 4200; powerMultiplier = 0.1; }
  else if (sType === "CHIQUITA") { baseTime = 5000; powerMultiplier = 0.15; }
  else if (sType === "AUFSCHLAG") { baseTime = 4500; powerMultiplier = 0.3; }
  else if (sType === "BANDEJA") { baseTime = 4000; powerMultiplier = 0.25; }
  else if (sType === "VIBORA") { baseTime = 3500; powerMultiplier = 0.35; }
  else if (sType === "BAJADA") { baseTime = 3500; powerMultiplier = 0.4; }
  else if (sType === "DRIVE") { baseTime = 4500; powerMultiplier = 0.25; }

  let remainingDist = zDist * powerMultiplier;
  let curZ = tZ;
  
  if (curZ + remainingDist >= 10 && !["CHIQUITA", "BLOCK", "VOLLEY", "LOB"].includes(sType)) {
      isWallHit = true;
      remainingDist -= (10 - curZ); 
      curZ = 10 - remainingDist;    
      baseTime += 1500; 
  } else {
      curZ += remainingDist; 
  }

  let finalRow = Math.round((11 - curZ) / 2);
  finalRow = Math.max(1, Math.min(5, finalRow)); 

  if (isWallHit || finalRow !== tRow) {
    reboundZone = `${NUM_TO_COL[tColNum]}${finalRow}`;
  }

  return { impactZone: targetZone, reboundZone, isWallHit, flightTimeMs: baseTime, finalRow };
};

// --- KI TAKTIK-GEHIRN ---
export const calculateSmartAITurn = (
  aiHitZone: string, youZone: string, partnerZone: string, 
  isAiServe: boolean = false, incomingQuality: TurnResult = null,
  tacScore: number = 3000,
  incomingShot: string = "",
  aiShotHistory: string[] = [],
  serveNumber: 1 | 2 = 1, 
  staminaYou: number = 50,       // NEU: KI sieht deine Ausdauer
  staminaPartner: number = 50    // NEU: KI sieht Ausdauer vom Partner
) => {
  const allCols = ["A", "B", "C", "D", "E"];
  const aiHitCol = aiHitZone[0];
  const aiHitRow = parseInt(aiHitZone[1]); 

  let shot = "DRIVE";
  let targetCol = "C";
  let targetRow = 1;

  const youRow = parseInt(youZone[1]);
  const partnerRow = parseInt(partnerZone[1]);
  const youCol = youZone[0];
  const partnerCol = partnerZone[0];
  
  const bothAtNet = youRow >= 3 && partnerRow >= 3;
  const bothAtBack = youRow <= 2 && partnerRow <= 2;
  const openCols = allCols.filter(col => col !== youCol && col !== partnerCol);
  
  if (isAiServe) {
    shot = "AUFSCHLAG";
    const isRightSide = aiHitCol === "D" || aiHitCol === "E";
    const rand = Math.random();
    
    if (serveNumber === 1) {
        targetRow = 2; 
        if (isRightSide) {
            if (rand < 0.4) targetCol = "A"; else if (rand < 0.8) targetCol = "C"; else targetCol = "B"; 
        } else {
            if (rand < 0.4) targetCol = "E"; else if (rand < 0.8) targetCol = "C"; else targetCol = "D"; 
        }
    } else {
        targetRow = 3; 
        if (isRightSide) {
            if (rand < 0.8) targetCol = "B"; else targetCol = "C"; 
        } else {
            if (rand < 0.8) targetCol = "D"; else targetCol = "C"; 
        }
    }
  } else {
    const isReturn = incomingShot === "AUFSCHLAG";

    if (isReturn) {
        const roll = Math.random();
        if (bothAtNet) {
            if (roll < 0.6) { shot = "LOB"; targetRow = 1; } else { shot = "CHIQUITA"; targetRow = 4; }
        } else {
            if (roll < 0.5) { shot = "LOB"; targetRow = 1; } else { shot = "DRIVE"; targetRow = 2; }
        }
        targetCol = openCols.length > 0 ? openCols[Math.floor(Math.random() * openCols.length)] : "C";
    } 
    else if (incomingQuality === "recovery") {
        if (aiHitRow >= 3) {
            if (incomingShot === "LOB") { shot = Math.random() > 0.4 ? "SMASH" : "VIBORA"; } 
            else { shot = "VOLLEY"; }
            targetRow = 1; 
            targetCol = openCols.length > 0 ? openCols[Math.floor(Math.random() * openCols.length)] : "C";
        } else {
            shot = aiHitRow === 1 ? "BAJADA" : "DRIVE"; 
            targetRow = 1;
            targetCol = openCols.includes("C") ? "C" : (openCols[0] || "C");
        }
    } else if (aiHitRow >= 3) {
      const possibleShots = bothAtBack 
        ? ["VOLLEY", "BANDEJA", "VIBORA", "SMASH"] 
        : (bothAtNet ? ["BLOCK", "VOLLEY", "LOB"] : ["VOLLEY", "BANDEJA"]);
      
      const filteredShots = possibleShots.filter(s => !aiShotHistory.slice(0, 2).includes(s));
      const shotPool = filteredShots.length > 0 ? filteredShots : possibleShots;
      
      shot = shotPool[Math.floor(Math.random() * shotPool.length)];

      if (shot === "VOLLEY") targetRow = bothAtNet ? 4 : 1;
      else if (shot === "BANDEJA") targetRow = 2;
      else targetRow = 1;

      const nonLastCols = openCols.filter(col => col !== targetCol);
      const targetColPool = nonLastCols.length > 0 ? nonLastCols : openCols;
      targetCol = targetColPool.length > 0 ? targetColPool[Math.floor(Math.random() * targetColPool.length)] : "C";

    } else {
      if (bothAtNet) {
        const roll = Math.random();
        if (roll < 0.6) {
            shot = "LOB"; targetRow = 1; 
            targetCol = openCols.includes("C") ? "C" : (Math.random() > 0.5 ? "A" : "E");
        } else {
            shot = "CHIQUITA"; targetRow = 4;
            const chiquitaCols = openCols.length > 0 ? openCols : ["A", "B", "C"];
            targetCol = chiquitaCols[Math.floor(Math.random() * chiquitaCols.length)];
        }
      } else {
        const roll = Math.random();
        if (aiHitRow === 1 && roll < 0.25) { shot = "BAJADA"; targetRow = 2; } 
        else if (roll < 0.4) { shot = "LOB"; targetRow = 1; } 
        else { shot = "DRIVE"; targetRow = 2; }
        targetCol = openCols.length > 0 ? openCols[Math.floor(Math.random() * openCols.length)] : "C";
      }
    }
  }
// --- 🧊 KÜHLSCHRANK-TAKTIK (Ab 4500 TacScore) ---
  if (tacScore >= 4500 && !isAiServe) {
      const staminaDiff = staminaYou - staminaPartner;
      
      // Wenn ein Spieler deutlich erschöpfter ist (Differenz > 10)
      if (Math.abs(staminaDiff) > 10) {
          const weakCol = staminaDiff > 0 ? partnerCol : youCol; // Derjenige mit weniger Stamina
          const isWeakLeft = weakCol === "A" || weakCol === "B" || (weakCol === "C" && Math.random() > 0.5);
          
          // Zu 80% spielt die KI den Ball gezielt auf den erschöpften Spieler
          if (Math.random() < 0.8) {
              const weakSideCols = isWeakLeft ? ["A", "B"] : ["D", "E"];
              
              // Richtig fies: Sie spielt in die Spalte seiner Seite, wo er gerade NICHT steht, um ihn hetzen zu lassen!
              const runTarget = weakSideCols.find(c => c !== weakCol) || weakCol;
              targetCol = Math.random() > 0.3 ? runTarget : "C"; 
          }
      }
  }

  // --- FINALE KI-STATS BALANCE ---
  let hitChance = 71;      // Niedriger, provoziert mehr Unforced Errors
  let perfectChance = 5;   
  let recoveryChance = 14; // Mehr "Wackler", dynamischere Rallies
  let aiTitle = `KI SPIELT: ${shot}`;
  let aiMsg = `Die KI spielt einen platzierten ${shot}.`;

  if (shot === "AUFSCHLAG") {
      const isRisky = targetRow === 2 || targetCol === "A" || targetCol === "C" || targetCol === "E";
      if (serveNumber === 1) {
          if (isRisky) {
              perfectChance = 15; // Realistische Ass-Chance (15%)
              hitChance = 65;     
              recoveryChance = 0; 
          } else {
              perfectChance = 3;  
              hitChance = 87;     
              recoveryChance = 0;
          }
      } else {
          if (isRisky) {
              perfectChance = 5;  
              hitChance = 55;     
              recoveryChance = 0;
          } else {
              perfectChance = 1;  
              hitChance = 94;     
              recoveryChance = 0;
          }
      }
  }

  if (incomingQuality === "recovery") {
    perfectChance += 22; // KI nutzt deine Wackler konsequent als Winner
    hitChance += 5;      
    aiTitle = `KI ATTACKIERT!`; 
    aiMsg = `Die KI nutzt deinen schwachen Ball gnadenlos aus und attackiert mit einem ${shot}!`;
  }
  if (shot === "SMASH") { perfectChance += 8; hitChance -= 5; }
  if (shot === "LOB") { hitChance += 5; }

  let aiResult: TurnResult = "success";
  const roll = Math.floor(Math.random() * 100) + 1;
  
  if (roll <= perfectChance) { 
    aiResult = "perfect"; 
    aiTitle = "⭐ UNHALTBAR!"; 
    aiMsg = `Wahnsinn! Die KI versenkt einen perfekten ${shot}. Unhaltbar!`; 
  } else if (roll <= hitChance + perfectChance) { 
    aiResult = "success"; 
  } else if (roll <= hitChance + perfectChance + recoveryChance) { 
    aiResult = "recovery"; 
    aiTitle = "⚠️ KI WACKELT!"; 
    aiMsg = `Die KI wackelt! Ein schwacher ${shot} kommt rüber. Deine Chance!`; 
  } else { 
    const failRoll = Math.random();
    
    if (shot === "AUFSCHLAG") {
        if (failRoll < 0.33) { aiResult = "error_net"; aiTitle = "❌ KI: NETZFEHLER!"; }
        else if (failRoll < 0.66) { aiResult = "error_wall_direct"; aiTitle = "❌ KI: DIREKT ANS GLAS!"; }
        else { aiResult = "error_out"; aiTitle = "❌ KI: AUFSCHLAG-FEHLER!"; }
    } else {
        if (failRoll < 0.5) { aiResult = "error_net"; aiTitle = "❌ KI: NETZFEHLER!"; }
        else { aiResult = "error_wall_direct"; aiTitle = "❌ KI: ANS GLAS/GITTER!"; }
    }

    const failText = aiResult === "error_net" 
        ? "ins Netz" 
        : (aiResult === "error_wall_direct" ? "ohne Aufdotzen direkt ans Glas/Gitter" : "ins falsche Aufschlagfeld");
    
    aiMsg = `Unforced Error! Die KI verzieht den ${shot} ${failText}.`;
  }

  if (tacScore < 3000 && aiResult === "success") {
      const errorChance = (1 - (tacScore / 3000)) * 0.2; 
      if (Math.random() < errorChance) {
           aiResult = "error_net";
           aiTitle = "❌ KI PATZER!";
           aiMsg = "Leichter Fehler der KI! Der Ball landet unbedrängt im Netz.";
      }
  } else if (tacScore >= 4000 && aiResult === "success") {
      const perfectBoost = ((tacScore - 4000) / 100) * 0.015; 
      if (Math.random() < perfectBoost) {
           aiResult = "perfect";
           aiTitle = "⭐ UNHALTBAR!";
           aiMsg = "Die KI feuert einen messerscharfen, perfekten Ball ab. Keine Chance!";
      }
  }

  if (aiResult === "recovery") {
      if (shot === "LOB") {
          targetRow = 3; 
      } else if (shot === "CHIQUITA") {
          targetRow = 2; 
      } else if (["BANDEJA", "VIBORA", "BAJADA"].includes(shot)) {
          targetRow = 3; 
          targetCol = "C"; 
      } else if (["DRIVE", "VOLLEY"].includes(shot)) {
          targetRow = 2; 
      }
  }

  const target = `${targetCol}${targetRow}`;
  const traj = calculateBallTrajectory(target, shot, aiHitZone);

  let finalInterceptZones = new Set<string>();
  finalInterceptZones.add(traj.impactZone);
  
  if (traj.reboundZone) {
    const rStart = parseInt(traj.impactZone[1]);
    const rEnd = parseInt(traj.reboundZone[1]);
    const minRow = Math.min(rStart, rEnd);
    const maxRow = Math.max(rStart, rEnd);
    for (let r = minRow; r <= maxRow; r++) { finalInterceptZones.add(`${targetCol}${r}`); }
  }

  const colIdx = ["A", "B", "C", "D", "E"].indexOf(targetCol);
  Array.from(finalInterceptZones).forEach(zone => {
      if (traj.isWallHit || shot === "SMASH") {
          const r = zone[1];
          if (colIdx > 0) finalInterceptZones.add(`${["A", "B", "C", "D", "E"][colIdx - 1]}${r}`);
          if (colIdx < 4) finalInterceptZones.add(`${["A", "B", "C", "D", "E"][colIdx + 1]}${r}`);
      }
  });

  if (shot === "SMASH") {
    finalInterceptZones.add(`${targetCol}3`);
    finalInterceptZones.add(`${targetCol}4`);
  } else if (!traj.isWallHit) {
    if (targetRow > 1) finalInterceptZones.add(`${targetCol}${targetRow - 1}`); 
    if (targetRow < 4) finalInterceptZones.add(`${targetCol}${targetRow + 1}`); 
  }

  const uniqueInterceptZones = Array.from(finalInterceptZones);

  let speedMulti = 1.0;
  if (tacScore < 3000) { speedMulti = tacScore / 3000; } 
  else if (tacScore < 4000) { speedMulti = 1.0 + ((tacScore - 3000) / 1000) * 0.15; } 
  else { speedMulti = 1.15 + ((tacScore - 4000) / 1000) * 0.5; }

  let finalFlightTime = Math.max(1500, Math.min(10000, traj.flightTimeMs / speedMulti));

  if (aiResult === "recovery") {
      finalFlightTime *= 1.4; 
  }
  if (aiResult === "error_net") { finalFlightTime = 1500; }

  let hitterNextRow = 2; let partnerNextRow = 2;
  if (aiResult === "recovery") {
      hitterNextRow = aiHitRow; partnerNextRow = 2; 
  } else {
      if (["LOB", "VOLLEY", "BLOCK", "BANDEJA", "VIBORA", "SMASH", "AUFSCHLAG", "CHIQUITA"].includes(shot)) {
          hitterNextRow = 4; partnerNextRow = 4;
      } else { hitterNextRow = 2; partnerNextRow = 2; }
  }

  let hitterNextCol = aiHitCol; let partnerNextCol = "D"; 
  if (aiHitCol === "A" || aiHitCol === "B") { hitterNextCol = "B"; partnerNextCol = "D"; } 
  else if (aiHitCol === "D" || aiHitCol === "E") { hitterNextCol = "D"; partnerNextCol = "B"; } 
  else { hitterNextCol = "C"; partnerNextCol = Math.random() > 0.5 ? "B" : "D"; }

  if (aiResult === "recovery") { hitterNextCol = aiHitCol; }

  const aiHitterNextZone = `${hitterNextCol}${hitterNextRow}`;
  const aiPartnerNextZone = `${partnerNextCol}${partnerNextRow}`;

  return { 
    shot, target, interceptZones: uniqueInterceptZones, 
    aiHitterNextZone, opp2Target: aiPartnerNextZone, 
    isWallHit: traj.isWallHit, reboundZone: traj.reboundZone, flightTimeMs: finalFlightTime,
    aiResult: aiResult, aiTitle: aiTitle, aiMessage: aiMsg
  };
};

export const evaluatePlayerShot = (
  shot: string, hitterZone: string, targetZone: string, 
  opp1Zone: string, opp2Zone: string, isServeTurn: boolean, isReturnTurn: boolean,
  isDugOut: boolean, activeScenario: Scenario | null,
  incomingQuality: TurnResult, tacScore: number = 3000,
  incomingShot: string = "",
  playerShotHistory: string[] = [],
  serveNumber: 1 | 2 = 1 
): { result: TurnResult, title: string, message: string } => { 
  const hCol = hitterZone[0];
  const hRow = parseInt(hitterZone[1]);
  const tCol = targetZone[0];
  const tRow = parseInt(targetZone[1]);
  const o1Row = parseInt(opp1Zone[1]);
  const o2Row = parseInt(opp2Zone[1]);
  const oppsAtNet = o1Row >= 3 || o2Row >= 3;
  const oppsAtBack = o1Row <= 2 && o2Row <= 2;

  // --- FINALE PLAYER-STATS BALANCE ---
  let hitChance = 68;      // Etwas niedriger -> Normale Drives können Fehler provozieren
  let perfectChance = 4;   
  let recoveryChance = 16; 
  let title = "GUTE IDEE"; 
  let msg = "Eine sehr solide taktische Entscheidung."; 

  if (isServeTurn && shot !== "AUFSCHLAG") return { result: "error_net", title: "❌ REGELFEHLER", message: "Regelfehler: Du musst den Punkt mit einem Aufschlag beginnen!" };
  if (!isServeTurn && shot === "AUFSCHLAG") return { result: "error_net", title: "❌ REGELFEHLER", message: "Regelfehler: Ein Aufschlag ist nur zu Beginn des Punktes erlaubt." };
  if (isReturnTurn && ["VOLLEY", "BLOCK", "SMASH", "BANDEJA", "VIBORA"].includes(shot)) return { result: "error_wrong_zone", title: "❌ REGELFEHLER", message: "Regelfehler! Du darfst einen Aufschlag nicht volley nehmen. Lass ihn aufdotzen!" };
  
  if (activeScenario) {
    const isShotValid = activeScenario.validShots.includes(shot);
    const isZoneBest = activeScenario.bestZones.includes(targetZone);
    if (isShotValid && isZoneBest) { 
      hitChance += 10; perfectChance += 15; 
      title = "⭐ PERFEKTE LÖSUNG"; 
      msg = `Szenario gemeistert: ${activeScenario.explanation}`; 
    } 
    else { 
      hitChance -= 20; recoveryChance += 20; perfectChance = 0; 
      title = "⚠️ SZENARIO IGNORIERT"; 
      msg = "Du hast die taktische Vorgabe des Szenarios ignoriert. Das war extrem leichtsinnig!"; 
    }
  } else {
    
    if (incomingQuality === "recovery") {
      let isPerfectCounter = false;
      let counterTitle = "";
      let counterMsg = "";

      if (incomingShot === "LOB") {
        if (["SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = "GNADENLOS BESTRAFT";
          counterMsg = "Perfekt! Du hast den zu kurzen Lob gnadenlos mit einem Überkopfball bestraft.";
        } else {
          hitChance -= 10; recoveryChance += 15;
          counterTitle = "CHANCE LIEGENGELASSEN";
          counterMsg = "Der Lob der KI war zu kurz, aber du hast den Überkopfball verweigert. Ein Geschenk verschenkt!";
        }
      } 
      else if (incomingShot === "CHIQUITA") {
        if (["VOLLEY", "SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = "FLOATER VERWANDELT";
          counterMsg = "Klasse! Die Chiquita der KI ist hoch aufgestiegen und du hast den Floater aggressiv attackiert.";
        } else {
          hitChance -= 5;
          counterTitle = "ZU BRAV";
          counterMsg = "Die Chiquita war zu hoch angesetzt. Da hättest du am Netz direkt mehr Druck machen müssen!";
        }
      }
      else if (["BANDEJA", "VIBORA"].includes(incomingShot)) {
        if (["DRIVE", "VOLLEY", "BLOCK"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = "SCHWÄCHE AUSGENUTZT";
           counterMsg = `Der ${incomingShot} der Gegner war harmlos. Guter, offensiver Konter!`;
        } else if (["LOB"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = "CLEVER ÜBERLUPFT";
           counterMsg = "Die Gegner standen nach ihrem Fehler schlecht. Ein Lob hier war taktisch absolut genial!";
        } else {
           counterTitle = "HARMLOSE ANTWORT";
           counterMsg = "Die KI hat gewackelt, aber deine Antwort war zu brav.";
        }
      }
      else if (incomingShot === "BAJADA") {
         if (["SMASH", "VOLLEY"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = "LUFTHOHEIT!";
           counterMsg = "Die Bajada der Gegner war zu schwach und kam hoch rein. Sauber am Netz abgefangen!";
         } else {
           counterTitle = "CHANCE LIEGENGELASSEN";
           counterMsg = "Eine schwache Bajada muss am Netz sofort attackiert werden.";
         }
      }
      else {
        if (["DRIVE", "VOLLEY", "BAJADA"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = "GNADENLOSER KONTER";
          counterMsg = "Taktisch stark! Den wackeligen Ball eiskalt ausgenutzt.";
        } else if (["SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          hitChance -= 10; recoveryChance += 15; 
          perfectChance += 5; 
          counterTitle = "RISKANTER ÜBERKOPFBALL";
          counterMsg = `Mutig! Du spekulierst darauf, dass der wackelige ${incomingShot} als "Floater" hoch genug aufsteigt, um ihn von oben zu nehmen.`;
        }
      }

      if (isPerfectCounter) {
        // Taktisch kluges Spiel belohnt direkt mit starken Winnern!
        perfectChance += 22; 
        hitChance += 10;
        title = counterTitle;
        msg = counterMsg;
      } else if (counterTitle !== "") {
        title = counterTitle;
        msg = counterMsg;
      }
    }
    
    if (isDugOut) { 
      hitChance -= 15; recoveryChance += 30; perfectChance = 0; 
      title = "NOTSCHLAG!";
      msg = "Das war ein absoluter Not-Schlag (Halbflugball) aus der Defensive. Extrem schwer zu kontrollieren!"; 
    }

    const hitChanceBeforeCheck = hitChance;

    switch(shot) {
      case "LOB":
        if (tRow >= 3) { 
            hitChance -= 10; recoveryChance += 40; title = "LOB ZU KURZ"; msg = "Taktik-Fehler: Ein Lob ins Halbfeld ist ein Geschenk für den gegnerischen Smash."; 
        } else if (oppsAtNet) { 
            perfectChance += 10; hitChance += 5; title = "CLEVERER LOB"; msg = "Gute Idee! Ein tiefer Lob zwingt die Netzspieler wieder nach hinten."; 
        } else { 
            hitChance -= 5; recoveryChance += 15; title = "HARMLOSER LOB"; msg = "Taktisch fragwürdig: Ein Lob gegen Spieler, die sowieso schon hinten stehen."; 
        } break;
        
      case "CHIQUITA":
        if (tRow <= 3) { 
            hitChance -= 15; recoveryChance += 25; title = "ZIEL ZU LANG"; msg = "Falsches Ziel: Eine Chiquita muss ganz kurz direkt hinter das Netz gelegt werden."; 
        } else if (oppsAtNet) { 
            perfectChance += 12; hitChance += 5; title = "GIFTIGE IDEE"; msg = "Taktisch stark! Du versuchst, den vorrückenden Gegnern auf die Füße zu zielen."; 
        } else { 
            recoveryChance += 25; title = "SINNLOSE CHIQUITA"; msg = "Die Gegner stehen hinten und können diese kurze Chiquita locker erlaufen."; 
        } break;
        
      case "SMASH":
        if (hRow <= 2) {
            hitChance -= 25; recoveryChance += 35; title = "VON HINTEN?!"; msg = "Wahnsinn! Einen Smash von der Grundlinie zu versuchen, endet oft in einem sehr langsamen und unkontrollierten Ball.";
        } else if (tRow >= 4) { 
            hitChance -= 30; recoveryChance += 20; title = "ZIEL ZU STEIL"; msg = "Gefährlich! Den Smash extrem steil vor das eigene Netz zu ziehen, führt sehr oft zum Netzfehler."; 
        } else { 
            perfectChance += 15; hitChance -= 5; title = "AGGRESSIVE WAHL"; msg = "Mutige Entscheidung! Ein harter Smash birgt leichtes Risiko, macht aber Druck."; 
        } break;
        
      case "BANDEJA":
        if (hRow <= 1) {
             hitChance -= 15; recoveryChance += 35; title = "ZU WEIT HINTEN"; msg = "Falsche Position: Die Bandeja ist ein Aufbauschlag aus dem Halbfeld, nicht von der Grundlinie.";
        } else if (tRow >= 3) { 
             hitChance -= 5; recoveryChance += 25; title = "ZIEL ZU KURZ"; msg = "Zu kurz gezielt! Bandejas müssen die Gegner zwingend an die Rückwand drängen."; 
        } else if (oppsAtBack) { 
            perfectChance += 8; hitChance += 5; title = "STARKE IDEE"; msg = "Taktisch sauber: Eine tiefe Bandeja hilft euch, das Netz sicher zu verteidigen."; 
        } else { 
            hitChance += 5; title = "SICHERER SCHLAG"; msg = "Gute taktische Wahl, um kontrolliert das Netz zurückzuerobern."; 
        } break;

      case "VIBORA":
        if (hRow <= 2) {
             hitChance -= 25; recoveryChance += 30; title = "VIBORA VON HINTEN?!"; msg = "Viel zu riskant! Eine Vibora von ganz hinten auszuführen, geht oft schief.";
        } else if (tRow >= 3) { 
             recoveryChance += 30; title = "ZIEL ZU KURZ"; msg = "Eine Vibora ins Halbfeld verfehlt ihren Zweck und wird zum Geschenk für den Gegner."; 
        } else if (tCol === "C") {
             hitChance -= 5; recoveryChance += 20; title = "DURCH DIE MITTE"; msg = "Eine Vibora durch die Mitte verliert ihre Gefährlichkeit an der Seitenwand.";
        } else if (oppsAtBack && (tCol === "A" || tCol === "E")) { 
            perfectChance += 12; hitChance += 5; title = "GIFTIGES ZIEL"; msg = "Taktisch perfekt: Du zielst die Vibora messerscharf tief in die Ecke."; 
        } else {
            perfectChance += 5; title = "AGGRESSIVE IDEE"; msg = "Gute, druckvolle Entscheidung zum Überkopfball.";
        } break;
        
      case "VOLLEY":
        if (hRow <= 2) {
             hitChance -= 30; recoveryChance += 30; title = "VOLLEY VON HINTEN?!"; msg = "Ein taktischer Albtraum: Ein Volley von der Grundlinie ist völlig unkontrolliert.";
        } else if (tRow >= 4 && oppsAtNet) { 
             hitChance -= 15; recoveryChance += 25; title = "VOLL IN DEN MANN"; msg = "Sehr gefährlich: Ein langer Volley direkt auf die am Netz stehenden Gegner provoziert Konter."; 
        } else if (tRow <= 2) { 
            hitChance += 5; perfectChance += 8; title = "DRÜCKENDES ZIEL"; msg = "Taktisch stark! Den Volley gezielt tief an die Rückwand drücken."; 
        } else { 
            hitChance += 5; title = "SOLIDER SCHLAG"; msg = "Gute Idee beim Volley, könnte eventuell noch etwas tiefer platziert werden."; 
        } break;

      case "BLOCK":
        if (hRow <= 2) {
             hitChance -= 20; recoveryChance += 40; title = "BLOCK VON HINTEN?!"; msg = "Sinnlos: Ein Block macht nur ganz vorne direkt am Netz Sinn, um Härte abzufangen.";
        } else if (tRow >= 4 && oppsAtNet) { 
            perfectChance += 12; hitChance += 5; title = "STARKE IDEE"; msg = "Genialer Plan: Den harten Ball extrem weich direkt vor die Füße der Angreifer abtropfen lassen."; 
        } else if (tRow <= 2) {
            hitChance -= 5; recoveryChance += 30; title = "ZIEL ZU LANG"; msg = "Zu lang gezielt! Ein Block bis an die Grundlinie wird leicht zum langsamen Flugball für die Gegner.";
        } else { 
            hitChance += 5; title = "SICHERER BLOCK"; msg = "Gute taktische Entscheidung, um das gegnerische Tempo aus dem Ball zu nehmen."; 
        } break;
        
      case "DRIVE":
        if (hRow >= 4) { 
            hitChance -= 20; recoveryChance += 35; title = "DRIVE AM NETZ?!"; msg = "Sehr fehleranfällig: Ein Grundschlag direkt am Netz. Hier muss dringend ein Volley her!"; 
        } else if (tRow >= 4 && oppsAtNet) { 
            hitChance -= 10; recoveryChance += 25; title = "GEFÄHRLICHES ZIEL"; msg = "Ein flacher Drive direkt in die Arme der Netzspieler führt meist zum sofortigen Konter."; 
        } else if (tCol === "A" || tCol === "E") {
            hitChance += 5; perfectChance += 5; title = "GUTE PLATZIERUNG"; msg = "Eine schöne taktische Idee, den Drive präzise an die Außenlinie zu ziehen.";
        } else { 
            hitChance += 10; title = "SICHERER SCHLAG"; msg = "Taktisch klug: Ein sicherer Grundschlag durch die Mitte hält das eigene Risiko gering."; 
        } break;
        
      case "BAJADA":
        if (hRow >= 3) { 
            hitChance -= 30; recoveryChance += 30; title = "BAJADA IM FELD?!"; msg = "Eine Bajada (Wand-Smash) kann man nur spielen, wenn man GANZ HINTEN an der Scheibe klebt!";
        } else if (tRow >= 3) { 
            hitChance -= 10; recoveryChance += 30; title = "BAJADA ZU KURZ!"; msg = "Eine Bajada so kurz gezogen landet oft im Netz oder verhungert auf halbem Weg."; 
        } else { 
            perfectChance += 12; hitChance += 5; title = "LASER-BAJADA!"; msg = "Aggressive Bajada direkt aus der hintersten Ecke gepfeffert! Toller Konter."; 
        } break;
        
      case "AUFSCHLAG":
        if (!activeScenario) {
          const isCorrectRow = tRow === 2 || tRow === 3; 
          const isCross = (["A", "B"].includes(hCol) && ["C", "D", "E"].includes(tCol)) || 
                          (["D", "E"].includes(hCol) && ["A", "B", "C"].includes(tCol));

          if (isCorrectRow && isCross) {
            const isRisky = tRow === 2 || ["A", "C", "E"].includes(tCol);
            
            if (serveNumber === 1) {
                if (isRisky) {
                    hitChance = 65; 
                    perfectChance = 20; 
                    recoveryChance = 0; 
                    title = "AGGRESSIVER 1. AUFSCHLAG"; 
                    msg = "Risiko auf die Linie! 15% Chance auf ein Ass, aber 20% Risiko für einen Fehler.";
                } else {
                    hitChance = 87; perfectChance = 6; recoveryChance = 0;
                    title = "SICHERER 1. AUFSCHLAG"; 
                    msg = "Solide ins Feld. Wenig Gefahr für einen Fehler, aber auch kaum Ass-Potenzial.";
                }
            } else {
                if (isRisky) {
                    hitChance = 60; 
                    perfectChance = 7; 
                    recoveryChance = 0; 
                    title = "RISKANTES ZIEL (2. AUFSCHLAG)"; 
                    msg = "Viel zu riskant für einen zweiten Aufschlag! Führt extrem oft zum Doppelfehler.";
                } else {
                    hitChance = 92; perfectChance = 0; recoveryChance = 0;
                    title = "SOUVERÄNER 2. AUFSCHLAG"; 
                    msg = "Gute taktische Entscheidung! Ein sicherer 2. Aufschlag, um den Doppelfehler souverän zu vermeiden.";
                }
            }
          } else {
            hitChance = 0; recoveryChance = 0; perfectChance = 0; 
            title = "⚠️ FEHLAUFSCHLAG"; 
            msg = "Regelfehler: Der Aufschlag muss diagonal ins korrekte Feld (Reihe 2 oder 3) gespielt werden!";
          }
        } else {
          hitChance += 10; perfectChance += 3; title = "STARKES ZIEL"; msg = "Gute Platzierung beim Aufschlag!";
        } 
        break;
    }

    if (!isServeTurn && !isReturnTurn && !isDugOut && !activeScenario) {
        const isTacticallySound = hitChance >= hitChanceBeforeCheck;
        
        const activeRallyHistory = playerShotHistory.filter(s => s !== "AUFSCHLAG");
        
        if (isTacticallySound && activeRallyHistory.length >= 2) {
            if (!activeRallyHistory.includes(shot)) {
                perfectChance += 6; // Angepasst auf +6
                hitChance += 5;     
            }
        }
    }

    let penalty = 0;
    if (tacScore >= 3000 && tacScore < 4000) {
        penalty = ((tacScore - 3000) / 1000) * 2.0; 
    } else if (tacScore >= 4000) {
        penalty = 2.0 + ((tacScore - 4000) / 100) * 0.5; 
    }
    
    hitChance -= penalty;
    perfectChance -= penalty;
    
    if (tacScore >= 3000) {
         recoveryChance += 5; 
    }
  }

  hitChance = Math.max(5, Math.min(95, hitChance)); 
  perfectChance = Math.max(0, perfectChance);
  recoveryChance = Math.max(0, Math.min(100, recoveryChance));

  const roll = Math.floor(Math.random() * 100) + 1;

  const formatResult = (statusText: string) => {
    return `[Taktik-Check] ${msg}\n\n[Ausführung] ${statusText}`;
  };

  if (roll <= perfectChance) {
    return { 
      result: "perfect", 
      title: "⭐ " + title, 
      message: formatResult("🔥 Perfekt getroffen! Der Schlag ist messerscharf und unhaltbar.") 
    };
  } else if (roll <= hitChance + perfectChance) { 
    return { 
      result: "success", 
      title: "✓ " + title, 
      message: formatResult("✅ Sauber getroffen und sicher im Feld platziert.") 
    };
  } else if (roll <= hitChance + perfectChance + recoveryChance) {
    return { 
      result: "recovery", 
      title: "⚠️ WACKELIG!", 
      message: formatResult("⚠️ Unsauber getroffen! Der Ball taumelt gerade noch so rüber – eine Einladung für die Gegner!") 
    };
  } else {
    let failType: TurnResult;
    
    if (shot === "AUFSCHLAG") {
      const rand = Math.random();
      failType = rand < 0.33 ? "error_net" : (rand < 0.66 ? "error_wall_direct" : "error_out");
    } else {
      if (tRow <= 2) failType = "error_wall_direct"; 
      else if (tRow >= 4) failType = "error_net";    
      else {
        failType = Math.random() < 0.5 ? "error_net" : "error_wall_direct";
      }
    }
    
    let failExplanation = "";
    let failTitle = "";
    
    if (failType === "error_wall_direct") {
      failTitle = "❌ DIREKT ANS GLAS/GITTER!";
      failExplanation = "❌ Zu viel Power oder verzogen: Der Ball fliegt ohne Bodenkontakt direkt gegen das Glas oder seitlich ins Gitter.";
    } else if (failType === "error_net") {
      failTitle = "❌ NETZFEHLER!";
      failExplanation = "❌ Zu tief angesetzt: Der Ball landet krachend im Netz.";
    } else {
      failTitle = "❌ AUFSCHLAG-FEHLER!";
      failExplanation = "❌ Fehler beim Aufschlag: Der Ball landet im falschen Feld oder springt gegen das Gitter.";
    }

    return { 
      result: failType, 
      title: failTitle, 
      message: formatResult(failExplanation) 
    };
  }
};
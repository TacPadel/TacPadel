import { AiStyle } from "./AiProfiles";
import { translate as t, getAppLanguage, formatShotName } from "../lib/i18n";

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
  description_en?: string;
  description_es?: string;
  positions: { you: string; partner: string; opp1: string; opp2: string; ball: { side: string; zone: string } };
  validShots: string[];
  bestZones: string[];
  laufZone: string;
  explanation: string;
  explanation_en?: string;
  explanation_es?: string;
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
  
  // FIX: Aufschlag und normaler Drive prallen nicht als harte Wand-Kracher zurück (verhindert falsche Notschläge auf Reihe 2)
  if (curZ + remainingDist >= 10 && !["CHIQUITA", "BLOCK", "VOLLEY", "LOB", "AUFSCHLAG", "DRIVE"].includes(sType)) {
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
  staminaYou: number = 50,       
  staminaPartner: number = 50,    
  aiStyle: AiStyle = "balanced" 
) => {
  const lang = getAppLanguage();
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
  
  const getStyleTarget = (options: string[]) => {
      if (options.length === 0) return "C";
      if (aiStyle === "defensive") {
          if (options.includes("C") && Math.random() < 0.7) return "C";
          if (options.includes("B") && Math.random() < 0.5) return "B";
          if (options.includes("D") && Math.random() < 0.5) return "D";
      } else if (aiStyle === "aggressive") {
          const edges = options.filter(c => c === "A" || c === "E");
          if (edges.length > 0 && Math.random() < 0.6) return edges[Math.floor(Math.random() * edges.length)];
      }
      return options[Math.floor(Math.random() * options.length)];
  };

  if (isAiServe) {
    shot = "AUFSCHLAG";
    const isRightSide = aiHitCol === "D" || aiHitCol === "E";
    const rand = Math.random();
    
    if (serveNumber === 1) {
        targetRow = 2; 
        if (isRightSide) {
            if (aiStyle === "aggressive") targetCol = rand < 0.5 ? "A" : (rand < 0.7 ? "C" : "B");
            else if (aiStyle === "defensive") targetCol = rand < 0.5 ? "B" : "C";
            else targetCol = rand < 0.4 ? "A" : (rand < 0.8 ? "C" : "B");
        } else {
            if (aiStyle === "aggressive") targetCol = rand < 0.5 ? "E" : (rand < 0.7 ? "C" : "D");
            else if (aiStyle === "defensive") targetCol = rand < 0.5 ? "D" : "C";
            else targetCol = rand < 0.4 ? "E" : (rand < 0.8 ? "C" : "D");
        }
    } else {
        targetRow = 3; 
        if (isRightSide) {
            targetCol = rand < (aiStyle === "aggressive" ? 0.6 : 0.9) ? "B" : "C"; 
        } else {
            targetCol = rand < (aiStyle === "aggressive" ? 0.6 : 0.9) ? "D" : "C"; 
        }
    }
  } else {
    const isReturn = incomingShot === "AUFSCHLAG";

    if (isReturn) {
        const roll = Math.random();
        let lobChance = 0.6;
        if (aiStyle === "defensive") lobChance = 0.8;
        if (aiStyle === "aggressive") lobChance = 0.3;

        if (bothAtNet) {
            if (roll < lobChance) { shot = "LOB"; targetRow = 1; } else { shot = "CHIQUITA"; targetRow = 4; }
        } else {
            if (roll < lobChance - 0.1) { shot = "LOB"; targetRow = 1; } else { shot = "DRIVE"; targetRow = 2; }
        }
        targetCol = getStyleTarget(openCols);
    } 
    else if (incomingQuality === "recovery") {
        if (aiHitRow >= 3) {
            if (incomingShot === "LOB") { 
                shot = (aiStyle === "defensive" && Math.random() < 0.4) ? "BANDEJA" : (Math.random() > 0.3 ? "SMASH" : "VIBORA"); 
            } else { 
                shot = "VOLLEY"; 
            }
            targetRow = 1; 
            targetCol = getStyleTarget(openCols);
        } else {
            shot = aiHitRow <= 2 ? "BAJADA" : "DRIVE"; 
            targetRow = 1;
            targetCol = getStyleTarget(openCols);
        }
    } else if (aiHitRow >= 3) {
      const canPlayOverhead = incomingShot === "LOB";
      const canPlayBandejaVibora = canPlayOverhead && aiHitRow === 3;

      let possibleShots: string[] = [];
      if (bothAtBack) {
          possibleShots = ["VOLLEY"];
          if (canPlayOverhead) possibleShots.push("SMASH");
          if (canPlayBandejaVibora) possibleShots.push("BANDEJA", "VIBORA");
      } else if (bothAtNet) {
          possibleShots = ["BLOCK", "VOLLEY", "LOB"];
      } else {
          possibleShots = ["VOLLEY"];
          if (canPlayBandejaVibora) possibleShots.push("BANDEJA");
      }
      
      const filteredShots = possibleShots.filter(s => !aiShotHistory.slice(0, 2).includes(s));
      const shotPool = filteredShots.length > 0 ? filteredShots : possibleShots;
      
      if (aiStyle === "aggressive" && shotPool.includes("SMASH") && Math.random() < 0.5) {
          shot = "SMASH";
      } else if (aiStyle === "aggressive" && shotPool.includes("VIBORA") && Math.random() < 0.4) {
          shot = "VIBORA";
      } else if (aiStyle === "defensive" && shotPool.includes("BANDEJA") && Math.random() < 0.6) {
          shot = "BANDEJA";
      } else if (aiStyle === "defensive" && shotPool.includes("LOB") && Math.random() < 0.4) {
          shot = "LOB";
      } else {
          shot = shotPool[Math.floor(Math.random() * shotPool.length)];
      }

      if (shot === "VOLLEY") targetRow = bothAtNet ? 4 : 1;
      else if (shot === "BANDEJA") targetRow = 2;
      else targetRow = 1;

      targetCol = getStyleTarget(openCols);

    } else {
      if (bothAtNet) {
        const roll = Math.random();
        let lobChance = aiStyle === "defensive" ? 0.75 : (aiStyle === "aggressive" ? 0.4 : 0.6);
        
        if (roll < lobChance) {
            shot = "LOB"; targetRow = 1; 
            targetCol = openCols.includes("C") ? "C" : (Math.random() > 0.5 ? "A" : "E");
        } else {
            shot = "CHIQUITA"; targetRow = 4;
            const chiquitaCols = openCols.length > 0 ? openCols : ["A", "B", "C"];
            targetCol = getStyleTarget(chiquitaCols);
        }
      } else {
        const roll = Math.random();
        let bajadaChance = aiStyle === "aggressive" ? 0.4 : 0.15;
        let lobChance = aiStyle === "defensive" ? 0.6 : (aiStyle === "aggressive" ? 0.2 : 0.4);

        if (aiHitRow === 1 && roll < bajadaChance) { shot = "BAJADA"; targetRow = 2; } 
        else if (roll < lobChance + bajadaChance) { shot = "LOB"; targetRow = 1; } 
        else { shot = "DRIVE"; targetRow = 2; }
        targetCol = getStyleTarget(openCols);
      }
    }
  }

  if (tacScore >= 4500 && !isAiServe) {
      const staminaDiff = staminaYou - staminaPartner;
      if (Math.abs(staminaDiff) > 10) {
          const weakCol = staminaDiff > 0 ? partnerCol : youCol; 
          const isWeakLeft = weakCol === "A" || weakCol === "B" || (weakCol === "C" && Math.random() > 0.5);
          
          if (Math.random() < 0.8) {
              const weakSideCols = isWeakLeft ? ["A", "B"] : ["D", "E"];
              const runTarget = weakSideCols.find(c => c !== weakCol) || weakCol;
              targetCol = Math.random() > 0.3 ? runTarget : "C"; 
          }
      }
  }

  const displayShot = formatShotName(shot, lang);
  let hitChance = 68;       
  let perfectChance = 5;   
  let recoveryChance = 18; 
  let aiTitle = `${t("gl_ai_plays_title")} ${displayShot}`;
  let aiMsg = `${t("gl_ai_plays_msg_1")} ${displayShot}${t("gl_ai_plays_msg_2")}`;

  if (aiStyle === "aggressive") {
      perfectChance += 4;  
      hitChance -= 12;     
  } else if (aiStyle === "defensive") {
      perfectChance = Math.max(1, perfectChance - 3); 
      hitChance += 12;     
      recoveryChance += 5; 
  }

  if (shot === "AUFSCHLAG") {
      const isRisky = targetRow === 2 || targetCol === "A" || targetCol === "C" || targetCol === "E";
      if (serveNumber === 1) {
          if (isRisky) {
              perfectChance = 7; 
              hitChance = 67;    
              recoveryChance = 0; 
          } else {
              perfectChance = 3;  
              hitChance = 87;    
              recoveryChance = 0;
          }
      } else {
          if (isRisky) {
              perfectChance = 3;  
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
    const punishBonus = Math.round((tacScore / 3000) * 15); 
    perfectChance += punishBonus; 
    hitChance += 5;      
    aiTitle = t("gl_ai_attacks_title"); 
    aiMsg = `${t("gl_ai_attacks_msg_1")} ${displayShot}!`;
  }
  if (shot === "SMASH") { perfectChance += 8; hitChance -= 5; }
  if (shot === "LOB") { hitChance += 5; }

  let aiResult: TurnResult = "success";
  const roll = Math.floor(Math.random() * 100) + 1;
  
  if (roll <= perfectChance) { 
    aiResult = "perfect"; 
    aiTitle = t("gl_ai_unstoppable_title"); 
    aiMsg = `${t("gl_ai_unstoppable_msg_1")} ${displayShot}${t("gl_ai_unstoppable_msg_2")}`; 
  } else if (roll <= hitChance + perfectChance) { 
    aiResult = "success"; 
  } else if (roll <= hitChance + perfectChance + recoveryChance) { 
    aiResult = "recovery"; 
    aiTitle = t("gl_ai_shaky_title"); 
    aiMsg = `${t("gl_ai_shaky_msg_1")} ${displayShot} ${t("gl_ai_shaky_msg_2")}`; 
  } else { 
    const failRoll = Math.random();
    
    if (shot === "AUFSCHLAG") {
        if (failRoll < 0.33) { aiResult = "error_net"; aiTitle = t("gl_ai_err_net_title"); }
        else if (failRoll < 0.66) { aiResult = "error_wall_direct"; aiTitle = t("gl_ai_err_glass_title"); }
        else { aiResult = "error_out"; aiTitle = t("gl_ai_err_serve_title"); }
    } else {
        if (failRoll < 0.5) { aiResult = "error_net"; aiTitle = t("gl_ai_err_net_title"); }
        else { aiResult = "error_wall_direct"; aiTitle = t("gl_ai_err_wall_mesh_title"); }
    }

    const failText = aiResult === "error_net" 
        ? t("gl_ai_fail_net") 
        : (aiResult === "error_wall_direct" ? t("gl_ai_fail_wall") : t("gl_ai_fail_serve"));
    
    aiMsg = `${t("gl_ai_ufe_msg_1")} ${displayShot} ${failText}.`;
  }

  if (tacScore < 3000 && aiResult === "success") {
      const errorChance = (1 - (tacScore / 3000)) * 0.2; 
      if (Math.random() < errorChance) {
           aiResult = "error_net";
           aiTitle = t("gl_ai_blunder_title");
           aiMsg = t("gl_ai_blunder_msg");
      }
  } else if (tacScore >= 4000 && aiResult === "success") {
      let highLevelRisk = Math.min(0.12, ((tacScore - 4000) / 100) * 0.012); 
      
      if (incomingShot === "AUFSCHLAG") {
          highLevelRisk *= 0.2;
      }
      
      const riskRoll = Math.random();
      
      if (riskRoll < highLevelRisk) {
           aiResult = "perfect";
           aiTitle = t("gl_ai_unstoppable_title");
           aiMsg = t("gl_ai_laser_msg");
      } else if (riskRoll < highLevelRisk * 1.5) {
           aiResult = Math.random() > 0.5 ? "error_net" : "error_wall_direct";
           aiTitle = t("gl_ai_too_much_risk_title");
           aiMsg = t("gl_ai_too_much_risk_msg");
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

  if (shot !== "LOB" && shot !== "AUFSCHLAG") {
      const hColNum = ["A", "B", "C", "D", "E"].indexOf(aiHitCol) + 1; 
      const tColNum = ["A", "B", "C", "D", "E"].indexOf(targetCol) + 1; 
      const yHitter = aiHitRow;       
      const yTarget = 11 - targetRow; 

      for (let r = 5; r > targetRow; r--) {
          const y = 11 - r; 
          const tVal = (y - yHitter) / (yTarget - yHitter); 
          const x = hColNum + tVal * (tColNum - hColNum);   

          if (Math.abs(x - Math.round(x)) > 0.25) {
              const col1 = Math.max(1, Math.floor(x)) - 1;
              const col2 = Math.min(5, Math.ceil(x)) - 1;
              finalInterceptZones.add(`${["A", "B", "C", "D", "E"][col1]}${r}`);
              finalInterceptZones.add(`${["A", "B", "C", "D", "E"][col2]}${r}`);
          } else {
              const col = Math.max(1, Math.min(5, Math.round(x))) - 1;
              finalInterceptZones.add(`${["A", "B", "C", "D", "E"][col]}${r}`);
          }
      }
  } else if (!traj.isWallHit) {
      if (targetRow > 1) finalInterceptZones.add(`${targetCol}${targetRow - 1}`); 
      if (targetRow < 4) finalInterceptZones.add(`${targetCol}${targetRow + 1}`); 
  }

  const uniqueInterceptZones = Array.from(finalInterceptZones);

  let speedMulti = 1.0;
  if (tacScore < 3000) { speedMulti = 1.0 + ((tacScore / 3000) * 0.3);}
  else if (tacScore < 4000) { speedMulti = 1.3 + ((tacScore - 3000) / 1000) * 0.2; } 
  else { speedMulti = 1.5 + ((tacScore - 4000) / 1000) * 0.8; }

  let finalFlightTime = Math.max(1500, Math.min(10000, traj.flightTimeMs / speedMulti));

  if (aiResult === "recovery") {
      finalFlightTime *= 1.4; 
  }
  if (aiResult === "error_net") { finalFlightTime = 1500; }

  let hitterNextRow = 2; let partnerNextRow = 2;
  if (aiResult === "recovery") {
      hitterNextRow = aiHitRow; partnerNextRow = 2; 
  } else {
      const alwaysGoNet = ["LOB", "VOLLEY", "BLOCK", "BANDEJA", "VIBORA", "SMASH", "AUFSCHLAG", "CHIQUITA"].includes(shot);
      const smartBajadaGoNet = shot === "BAJADA" && !bothAtNet; 

      if (alwaysGoNet || smartBajadaGoNet) {
          hitterNextRow = 4; partnerNextRow = 4;
      } else { 
          hitterNextRow = 2; partnerNextRow = 2; 
      }
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
  const lang = getAppLanguage();
  const displayIncomingShot = formatShotName(incomingShot, lang);

  const hCol = hitterZone[0];
  const hRow = parseInt(hitterZone[1]);
  const tCol = targetZone[0];
  const tRow = parseInt(targetZone[1]);
  const o1Row = parseInt(opp1Zone[1]);
  const o2Row = parseInt(opp2Zone[1]);
  const oppsAtNet = o1Row >= 3 || o2Row >= 3;
  const oppsAtBack = o1Row <= 2 && o2Row <= 2;

  let hitChance = 65;       
  let perfectChance = 8;   
  let recoveryChance = 16; 
  let title = t("gl_default_title"); 
  let msg = t("gl_default_msg"); 

  if (isServeTurn && shot !== "AUFSCHLAG") return { result: "error_net", title: t("gl_rule_err_title"), message: t("gl_rule_err_must_serve") };
  if (!isServeTurn && shot === "AUFSCHLAG") return { result: "error_net", title: t("gl_rule_err_title"), message: t("gl_rule_err_serve_only_start") };
  if (isReturnTurn && ["VOLLEY", "BLOCK", "SMASH", "BANDEJA", "VIBORA"].includes(shot)) return { result: "error_wrong_zone", title: t("gl_rule_err_title"), message: t("gl_rule_err_no_volley_return") };
  
  if (activeScenario) {
    const isShotValid = activeScenario.validShots.includes(shot);
    const isZoneBest = activeScenario.bestZones.includes(targetZone);
    const scenExp =
      (lang === "en" && activeScenario.explanation_en) ||
      (lang === "es" && activeScenario.explanation_es) ||
      activeScenario.explanation;

    if (isShotValid && isZoneBest) { 
      hitChance += 10; perfectChance += 15; 
      title = t("gl_scen_perfect_title"); 
      msg = `${t("gl_scen_perfect_prefix")} ${scenExp}`; 
    } 
    else { 
      hitChance -= 20; recoveryChance += 20; perfectChance = 0; 
      title = t("gl_scen_ignored_title"); 
      msg = t("gl_scen_ignored_msg"); 
    }
  } else {
    
    // --- NEUE KONTER- & BLOCK-LOGIK ---
    if (incomingQuality === "recovery") {
      let isPerfectCounter = false;
      let counterTitle = "";
      let counterMsg = "";

      if (incomingShot === "LOB") {
        if (["SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = t("gl_cnt_punished_title");
          counterMsg = t("gl_cnt_punished_msg");
        } else {
          hitChance -= 10; recoveryChance += 15;
          counterTitle = t("gl_cnt_missed_chance_title");
          counterMsg = t("gl_cnt_missed_lob_msg");
        }
      } 
      else if (incomingShot === "CHIQUITA") {
        if (["VOLLEY", "SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = t("gl_cnt_floater_title");
          counterMsg = t("gl_cnt_floater_msg");
        } else {
          hitChance -= 5;
          counterTitle = t("gl_cnt_too_tame_title");
          counterMsg = t("gl_cnt_too_tame_msg");
        }
      }
      else if (["BANDEJA", "VIBORA"].includes(incomingShot)) {
        if (["DRIVE", "VOLLEY", "BLOCK"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = t("gl_cnt_weakness_title");
           counterMsg = `${t("gl_cnt_weakness_msg_1")} ${displayIncomingShot} ${t("gl_cnt_weakness_msg_2")}`;
        } else if (["LOB"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = t("gl_cnt_clever_lob_title");
           counterMsg = t("gl_cnt_clever_lob_msg");
        } else {
           counterTitle = t("gl_cnt_harmless_title");
           counterMsg = t("gl_cnt_harmless_msg");
        }
      }
      else if (["BAJADA", "SMASH"].includes(incomingShot)) {
         if (["SMASH", "VOLLEY", "BLOCK"].includes(shot)) {
           isPerfectCounter = true;
           counterTitle = t("gl_cnt_pressure_blocked_title");
           counterMsg = `${t("gl_cnt_pressure_blocked_msg_1")} ${displayIncomingShot} ${t("gl_cnt_pressure_blocked_msg_2")}`;
         } else if (shot === "LOB") {
           isPerfectCounter = true;
           counterTitle = t("gl_cnt_empty_space_title");
           counterMsg = `${t("gl_cnt_empty_space_msg_1")} ${displayIncomingShot} ${t("gl_cnt_empty_space_msg_2")}`;
         } else {
           counterTitle = t("gl_cnt_missed_chance_title");
           counterMsg = `${t("gl_cnt_missed_smash_msg_1")} ${displayIncomingShot} ${t("gl_cnt_missed_smash_msg_2")}`;
         }
      }
      else {
        if (["DRIVE", "VOLLEY", "BAJADA", "BLOCK"].includes(shot)) {
          isPerfectCounter = true;
          counterTitle = t("gl_cnt_ruthless_title");
          counterMsg = t("gl_cnt_ruthless_msg");
        } else if (["SMASH", "BANDEJA", "VIBORA"].includes(shot)) {
          hitChance -= 10; recoveryChance += 15; 
          perfectChance += 5; 
          counterTitle = t("gl_cnt_risky_overhead_title");
          counterMsg = t("gl_cnt_risky_overhead_msg");
        }
      }

      if (isPerfectCounter) {
        perfectChance += 45; 
        hitChance += 15;
        recoveryChance = 0;
        title = counterTitle;
        msg = counterMsg;
      } else if (counterTitle !== "") {
        title = counterTitle;
        msg = counterMsg;
      }
    }
    
    if (isDugOut) { 
      hitChance -= 15; recoveryChance += 30; perfectChance = 0; 
      title = t("gl_dugout_title");
      msg = t("gl_dugout_msg"); 
    }

    const hitChanceBeforeCheck = hitChance;

    // --- NEUE DROPSHOT, BLOCK & BAJADA LOGIK ---
    switch(shot) {
      case "LOB":
        if (tRow >= 3) { 
            perfectChance = 0; hitChance -= 25; recoveryChance += 35; title = t("gl_lob_short_title"); msg = t("gl_lob_short_msg"); 
        } else if (oppsAtNet) { 
            perfectChance += 10; hitChance += 5; title = t("gl_lob_clever_title"); msg = t("gl_lob_clever_msg"); 
        } else { 
            perfectChance = Math.max(0, perfectChance - 4); hitChance -= 10; recoveryChance += 15; title = t("gl_lob_harmless_title"); msg = t("gl_lob_harmless_msg"); 
        } break;
        
      case "CHIQUITA":
        if (tRow <= 3) { 
            perfectChance = 0; hitChance -= 20; recoveryChance += 25; title = t("gl_chiq_long_title"); msg = t("gl_chiq_long_msg"); 
        } else if (hRow >= 4) { 
            if (oppsAtNet) {
                perfectChance = 0; hitChance -= 20; recoveryChance += 25; title = t("gl_chiq_racket_title"); msg = t("gl_chiq_racket_msg");
            } else {
                perfectChance += 20; hitChance += 5; title = t("gl_chiq_drop_title"); msg = t("gl_chiq_drop_msg");
            }
        } else if (oppsAtNet) { 
            perfectChance += 12; hitChance += 5; title = t("gl_chiq_toxic_title"); msg = t("gl_chiq_toxic_msg"); 
        } else { 
            perfectChance = Math.max(0, perfectChance - 4); hitChance -= 15; recoveryChance += 25; title = t("gl_chiq_pointless_title"); msg = t("gl_chiq_pointless_msg"); 
        } break;
        
      case "SMASH":
        if (hRow <= 2) {
            perfectChance = 0; hitChance -= 30; recoveryChance += 35; title = t("gl_smash_back_title"); msg = t("gl_smash_back_msg");
        } else if (tRow >= 4) { 
            perfectChance = 0; hitChance -= 30; recoveryChance += 20; title = t("gl_smash_steep_title"); msg = t("gl_smash_steep_msg"); 
        } else { 
            perfectChance += 15; hitChance -= 5; title = t("gl_smash_agg_title"); msg = t("gl_smash_agg_msg"); 
        } break;
        
      case "BANDEJA":
        if (hRow <= 1) {
             perfectChance = 0; hitChance -= 20; recoveryChance += 35; title = t("gl_band_back_title"); msg = t("gl_band_back_msg");
        } else if (hRow >= 4) {
             perfectChance = 0; hitChance -= 20; recoveryChance += 25; title = t("gl_band_net_title"); msg = t("gl_band_net_msg");
        } else if (tRow >= 4) { 
             perfectChance = 0; hitChance -= 15; recoveryChance += 25; title = t("gl_band_short_title"); msg = t("gl_band_short_msg"); 
        } else if (oppsAtBack) { 
            perfectChance += 8; hitChance += 5; title = t("gl_band_strong_title"); msg = t("gl_band_strong_msg"); 
        } else { 
            hitChance += 5; title = t("gl_band_safe_title"); msg = t("gl_band_safe_msg"); 
        } break;

      case "VIBORA":
        if (hRow <= 1) {
             perfectChance = 0; hitChance -= 25; recoveryChance += 30; title = t("gl_vib_back_title"); msg = t("gl_vib_back_msg");
        } else if (hRow >= 4) {
             perfectChance = 0; hitChance -= 20; recoveryChance += 25; title = t("gl_band_net_title"); msg = t("gl_vib_net_msg");
        } else if (tRow >= 3) { 
             perfectChance = 0; hitChance -= 20; recoveryChance += 30; title = t("gl_band_short_title"); msg = t("gl_vib_short_msg"); 
        } else if (tCol === "C") {
             hitChance -= 10; recoveryChance += 20; title = t("gl_vib_mid_title"); msg = t("gl_vib_mid_msg");
        } else if (oppsAtBack && (tCol === "A" || tCol === "E")) { 
            perfectChance += 12; hitChance += 5; title = t("gl_vib_toxic_title"); msg = t("gl_vib_toxic_msg"); 
        } else {
            perfectChance += 5; title = t("gl_vib_agg_title"); msg = t("gl_vib_agg_msg");
        } break;
        
      case "VOLLEY":
        if (hRow <= 2) {
             perfectChance = 0; hitChance -= 30; recoveryChance += 30; title = t("gl_vol_back_title"); msg = t("gl_vol_back_msg");
        } else if (tRow >= 4) { 
             if (oppsAtNet) {
                 perfectChance = 0; hitChance -= 15; recoveryChance += 25; title = t("gl_vol_body_title"); msg = t("gl_vol_body_msg"); 
             } else {
                 perfectChance += 15; title = t("gl_vol_drop_title"); msg = t("gl_vol_drop_msg");
             }
        } else if (tRow <= 2) { 
            hitChance += 5; perfectChance += 8; title = t("gl_vol_deep_title"); msg = t("gl_vol_deep_msg"); 
        } else { 
            hitChance += 5; title = t("gl_vol_solid_title"); msg = t("gl_vol_solid_msg"); 
        } break;

      case "BLOCK":
        if (hRow <= 2) {
             perfectChance = 0; hitChance -= 25; recoveryChance += 35; title = t("gl_blk_back_title"); msg = t("gl_blk_back_msg");
        } else if (tRow >= 4) { 
            perfectChance += 12; hitChance += 5; 
            title = oppsAtNet ? t("gl_band_strong_title") : t("gl_blk_drop_title"); 
            msg = oppsAtNet ? t("gl_blk_net_msg") : t("gl_blk_drop_msg");
        } else if (tRow <= 1) {
            perfectChance = 0; hitChance -= 15; recoveryChance += 30; title = t("gl_chiq_long_title"); msg = t("gl_blk_long_msg");
        } else { 
            hitChance += 5; title = t("gl_blk_safe_title"); msg = t("gl_blk_safe_msg"); 
        } break;
        
      case "DRIVE":
        if (hRow >= 4) { 
            perfectChance = 0; hitChance -= 25; recoveryChance += 35; title = t("gl_drv_net_title"); msg = t("gl_drv_net_msg"); 
        } else if (tRow >= 4 && oppsAtNet) { 
            perfectChance = 0; hitChance -= 15; recoveryChance += 25; title = t("gl_drv_danger_title"); msg = t("gl_drv_danger_msg"); 
        } else if (tCol === "A" || tCol === "E") {
            hitChance += 5; perfectChance += 5; title = t("gl_drv_good_title"); msg = t("gl_drv_good_msg");
        } else { 
            hitChance += 10; title = t("gl_band_safe_title"); msg = t("gl_drv_safe_msg"); 
        } break;
        
      case "BAJADA":
        if (hRow >= 3) { 
            perfectChance = 0; hitChance -= 30; recoveryChance += 30; title = t("gl_baj_mid_title"); msg = t("gl_baj_mid_msg");
        } else if (tRow >= 3) { 
            perfectChance = 0; hitChance -= 20; recoveryChance += 30; title = t("gl_baj_short_title"); msg = t("gl_baj_short_msg"); 
        } else if (oppsAtNet) { 
            perfectChance += 15; hitChance -= 15; recoveryChance += 10; 
            title = t("gl_baj_risky_title"); 
            msg = t("gl_baj_risky_msg");
        } else { 
            perfectChance += 12; hitChance += 5; title = t("gl_baj_laser_title"); msg = t("gl_baj_laser_msg"); 
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
                    title = t("gl_srv_agg1_title"); 
                    msg = t("gl_srv_agg1_msg");
                } else {
                    hitChance = 87; perfectChance = 6; recoveryChance = 0;
                    title = t("gl_srv_safe1_title"); 
                    msg = t("gl_srv_safe1_msg");
                }
            } else {
                if (isRisky) {
                    hitChance = 60; 
                    perfectChance = 7; 
                    recoveryChance = 0; 
                    title = t("gl_srv_risk2_title"); 
                    msg = t("gl_srv_risk2_msg");
                } else {
                    hitChance = 95; perfectChance = 0; recoveryChance = 0;
                    title = t("gl_srv_safe2_title"); 
                    msg = t("gl_srv_safe2_msg");
                }
            }
          } else {
            hitChance = 0; recoveryChance = 0; perfectChance = 0; 
            title = t("gl_srv_fault_title"); 
            msg = t("gl_srv_fault_msg");
          }
        } else {
          hitChance += 10; perfectChance += 3; title = t("gl_srv_strong_title"); msg = t("gl_srv_strong_msg");
        } 
        break;
    }

    if (!isServeTurn && !isReturnTurn && !isDugOut && !activeScenario) {
        const isTacticallySound = hitChance >= hitChanceBeforeCheck;
        
        const activeRallyHistory = playerShotHistory.filter(s => s !== "AUFSCHLAG");
        
        if (isTacticallySound && activeRallyHistory.length >= 2) {
            if (!activeRallyHistory.includes(shot)) {
                perfectChance += 6; 
                hitChance += 5;    
            }
        }
    }

    if (isReturnTurn && !isDugOut && hitChance >= hitChanceBeforeCheck) {
      hitChance += 8;
      recoveryChance = Math.max(5, recoveryChance - 8);
    }

    if (isDugOut) {
      title = `${t("gl_dugout_prefix_title")} (${title})`;
      msg = `${t("gl_dugout_prefix_msg")} ${msg}`;
    }

    if (shot !== "AUFSCHLAG") {
      let penalty = 0;
      if (tacScore >= 3000 && tacScore < 4000) {
          penalty = ((tacScore - 3000) / 1000) * 1.5; 
      } else if (tacScore >= 4000) {
          penalty = Math.min(4.0, 1.5 + ((tacScore - 4000) / 100) * 0.2);
      }
      
      hitChance -= penalty;
      perfectChance = Math.max(0, perfectChance - penalty);
      
      if (tacScore >= 3000) {
           recoveryChance += 5; 
      }
    }
  }

  hitChance = Math.max(5, Math.min(95, hitChance)); 
  perfectChance = Math.max(0, perfectChance);
  recoveryChance = Math.max(0, Math.min(100, recoveryChance));

  const roll = Math.floor(Math.random() * 100) + 1;

  const formatResult = (statusText: string) => {
    return `${t("gl_tactic_check_tag")} ${msg}\n\n${t("gl_execution_tag")} ${statusText}`;
  };

  if (roll <= perfectChance) {
    return { 
      result: "perfect", 
      title: "⭐ " + title, 
      message: formatResult(t("gl_exec_perfect")) 
    };
  } else if (roll <= hitChance + perfectChance) { 
    return { 
      result: "success", 
      title: "✓ " + title, 
      message: formatResult(t("gl_exec_success")) 
    };
  } else if (roll <= hitChance + perfectChance + recoveryChance) {
    return { 
      result: "recovery", 
      title: t("gl_exec_shaky_title"), 
      message: formatResult(t("gl_exec_shaky_msg")) 
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
      failTitle = t("gl_exec_err_wall_title");
      failExplanation = t("gl_exec_err_wall_msg");
    } else if (failType === "error_net") {
      failTitle = t("gl_exec_err_net_title");
      failExplanation = t("gl_exec_err_net_msg");
    } else {
      failTitle = t("gl_exec_err_srv_title");
      failExplanation = t("gl_exec_err_srv_msg");
    }

    return { 
      result: failType, 
      title: failTitle, 
      message: formatResult(failExplanation) 
    };
  }
};
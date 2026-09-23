import React from "react";

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

interface Props {
  level: "Schlag" | "Schlagrichtung" | "Laufrichtung"|  "Spielzug" | "Simulation";
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

const LETTERS = ["A", "B", "C", "D", "E"]; 
const NUMBERS = [1, 2, 3, 4, 5];

function zoneCenter(side: "left" | "right", zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const y = 10 + innerH * (letterIdx + 0.5) / 5;

  if (side === "left") {
    const leftWidth = netX - 10;
    const x = 10 + leftWidth * (num - 0.5) / 5;
    return { x, y };
  } else {
    const rightWidth = w - 10 - netX;
    const x = netX + rightWidth * (5.5 - num) / 5;
    return { x, y };
  }
}

function zoneBoundsLeft(zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const leftWidth = netX - 10;

  const y1 = 10 + innerH * letterIdx / 5;
  const y2 = 10 + innerH * (letterIdx + 1) / 5;
  const x1 = 10 + leftWidth * (num - 1) / 5;
  const x2 = 10 + leftWidth * num / 5;

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function zoneBounds(zoneId: string, w: number, h: number) {
  const letter = zoneId[0];
  const num = parseInt(zoneId[1]);
  const letterIdx = LETTERS.indexOf(letter);
  const netX = w / 2;
  const innerH = h - 20;
  const rightWidth = w - 10 - netX;

  const y1 = 10 + innerH * letterIdx / 5;
  const y2 = 10 + innerH * (letterIdx + 1) / 5;
  const x1 = netX + rightWidth * (5 - num) / 5;
  const x2 = netX + rightWidth * (5 - num + 1) / 5;

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

export default function ScenarioCourt({
  level,
  positions,
  selectedZone,
  hasSubmitted,
  bestZones,
  acceptableZones = [],
  onZoneClick,
  profiMode = false,
  selectedLaufZone = null,
  perfectLaufZone = null,
  acceptableLaufZones = [],
  onLaufZoneClick,
}: Props) {
  const W = 760;
  const H = 380;
  const netX = W / 2;
  const offsetX = 10 + (W - 20) * 0.15;
  const ballR = 8;
  const glassWallLength = (W - 20) * 0.18; 
  const allZoneIds = LETTERS.flatMap((l) => NUMBERS.map((n) => `${l}${n}`));

  const project3D = (flatX: number, flatY: number, z: number = 0) => {
    const cx = 205; 
    const normY = (flatX - 10) / (W - 20); 

    const screenY = 60 + (1 - normY) * 320 - z * 0.85;
    const scaleX = 0.54 + (1 - normY) * 0.44;
    const screenX = cx + (flatY - H / 2) * scaleX;
    
    return { x: screenX, y: screenY };
  };

  const getPolygonPoints = (b: { x: number; y: number; width: number; height: number }) => {
    const p1 = project3D(b.x, b.y);
    const p2 = project3D(b.x + b.width, b.y);
    const p3 = project3D(b.x + b.width, b.y + b.height);
    const p4 = project3D(b.x, b.y + b.height);
    return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
  };

  // Komplett überarbeiteter 3D-Spieler mit menschlicher Anatomie und Schläger
  const render3DPlayer = (x: number, y: number, type: "DU" | "PTNER" | "GEG1" | "GEG2", label: string, isGlowing: boolean) => {
    const scale = type === "DU" ? 1.25 : 1.1; 
    const h = 24 * scale;      
    const wShoulder = 7.5 * scale;   
    const wWaist = 4 * scale;   
    const rHead = 5.5 * scale;   

    const isOpponent = type.startsWith("GEG");
    const dir = isOpponent ? -1 : 1;

    // Athletischer menschlicher Torso (Breite Schultern, V-Taper zur Hüfte, Beine)
    const bodyPath = `
      M ${x - 2.5*scale} ${y - h + 2*scale}
      C ${x - wShoulder} ${y - h + 2*scale}, ${x - wShoulder} ${y - h + 8*scale}, ${x - wWaist} ${y - h + 15*scale}
      L ${x - 4*scale} ${y - 1*scale}
      Q ${x - 2.5*scale} ${y + 2*scale} ${x - 1*scale} ${y - 1*scale}
      L ${x} ${y - 6*scale}
      L ${x + 1*scale} ${y - 1*scale}
      Q ${x + 2.5*scale} ${y + 2*scale} ${x + 4*scale} ${y - 1*scale}
      L ${x + wWaist} ${y - h + 15*scale}
      C ${x + wShoulder} ${y - h + 8*scale}, ${x + wShoulder} ${y - h + 2*scale}, ${x + 2.5*scale} ${y - h + 2*scale}
      Z
    `;

    // Position des Schlägers (seitlich vorne)
    const rackX = x + dir * 14 * scale;
    const rackY = y - h * 0.45;
    const rHeadRack = 6.5 * scale;

    return (
      <g key={label} style={{ pointerEvents: "none" }}>
        {/* Weicher Bodenschatten (breiter für die Beinstellung) */}
        <ellipse cx={x} cy={y + 1} rx={wShoulder * 1.3} ry={wShoulder * 0.5} fill="rgba(0,0,0,0.6)" filter="url(#blur-small)" />
        <ellipse cx={rackX} cy={y + 3} rx={rHeadRack * 0.9} ry={rHeadRack * 0.3} fill="rgba(0,0,0,0.4)" filter="url(#blur-small)" />
        
        {/* Neon-Aura unter der aktiven Figur */}
        {isGlowing && (
           <ellipse cx={x} cy={y} rx={wShoulder * 1.6} ry={wShoulder * 0.7} fill="none" stroke="#00f0ff" strokeWidth="2" filter="url(#neon-cyan)" />
        )}

        {/* --- ARM HINTEN (Idle / Tiefenwirkung) --- */}
        {/* Dieser Arm wird vor dem Körper gerendert, damit er optisch im Hintergrund liegt */}
        <path d={`M ${x - dir * (wShoulder - 2*scale)} ${y - h + 5*scale} Q ${x - dir * (wShoulder + 2*scale)} ${y - h + 10*scale} ${x - dir * (wShoulder - 0.5*scale)} ${y - h + 16*scale}`} 
              fill="none" 
              stroke={`url(#body-${type})`} 
              strokeWidth={3 * scale} 
              strokeLinecap="round" />

        {/* --- 3D-KÖRPER (Torso & Beine) --- */}
        <path d={bodyPath} fill={`url(#body-${type})`} />
        {/* Kleine Glanzlinie auf der Brust für mehr 3D Volumen */}
        <path d={`M ${x - 3*scale} ${y - h + 4*scale} Q ${x} ${y - h + 6*scale} ${x + 3*scale} ${y - h + 4*scale}`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* --- ARM VORNE MIT SCHLÄGER --- */}
        <path d={`M ${x + dir * (wShoulder - 2*scale)} ${y - h + 5*scale} Q ${x + dir * 10*scale} ${y - h + 4*scale} ${rackX} ${rackY}`} 
              fill="none" 
              stroke={`url(#body-${type})`} 
              strokeWidth={3.5 * scale} 
              strokeLinecap="round" />

        {/* --- DER PADEL-SCHLÄGER --- */}
        <g transform={`rotate(${dir * 25}, ${rackX}, ${rackY})`}>
          {/* Schlägergriff */}
          <line x1={rackX} y1={rackY + 2*scale} x2={rackX} y2={rackY - 5*scale} stroke={`url(#handle-grad)`} strokeWidth={2 * scale} strokeLinecap="round" />
          
          {/* Schläger-Herz (Die Brücke über dem Griff) */}
          <polygon points={`${rackX - 2.5 * scale},${rackY - 3*scale} ${rackX + 2.5 * scale},${rackY - 3*scale} ${rackX},${rackY - 6 * scale}`} fill="#1e293b" />

          {/* Schlägerkopf (Typische tropfenförmige Padel-Form) */}
          <path 
            d={`
              M ${rackX - rHeadRack} ${rackY - 10 * scale}
              C ${rackX - rHeadRack} ${rackY - 18 * scale}, ${rackX + rHeadRack} ${rackY - 18 * scale}, ${rackX + rHeadRack} ${rackY - 10 * scale}
              C ${rackX + rHeadRack} ${rackY - 5 * scale}, ${rackX + rHeadRack * 0.4} ${rackY - 2 * scale}, ${rackX} ${rackY - 2 * scale}
              C ${rackX - rHeadRack * 0.4} ${rackY - 2 * scale}, ${rackX - rHeadRack} ${rackY - 5 * scale}, ${rackX - rHeadRack} ${rackY - 10 * scale}
              Z
            `}
            fill={`url(#racket-face)`}
            stroke={`url(#body-${type})`} 
            strokeWidth={1.5 * scale}
          />

          {/* Padel-Lochmuster-Perforation auf der Schlagfläche */}
          <g fill="#0f172a" opacity="0.8">
            <circle cx={rackX} cy={rackY - 10 * scale} r={0.7 * scale} />
            <circle cx={rackX - 3 * scale} cy={rackY - 8 * scale} r={0.7 * scale} />
            <circle cx={rackX + 3 * scale} cy={rackY - 8 * scale} r={0.7 * scale} />
            <circle cx={rackX - 3 * scale} cy={rackY - 12 * scale} r={0.7 * scale} />
            <circle cx={rackX + 3 * scale} cy={rackY - 12 * scale} r={0.7 * scale} />
            <circle cx={rackX} cy={rackY - 6 * scale} r={0.7 * scale} />
            <circle cx={rackX} cy={rackY - 14 * scale} r={0.7 * scale} />
          </g>
        </g>

        {/* --- 3D-KOPF --- */}
        <circle cx={x} cy={y - h - rHead + 2*scale} r={rHead} fill={`url(#head-${type})`} />

        {/* Beschriftungs-Plakette unter der Figur */}
        <rect x={x - 17} y={y + 6} width={34} height={12} rx={4} fill="rgba(7, 11, 22, 0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x={x} y={y + 12} textAnchor="middle" dominantBaseline="middle" fill={type === "DU" ? "#ffffff" : "#94a3b8"} fontSize="7.5" fontWeight="900" letterSpacing="0.5">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full bg-[#060913] p-2 sm:p-4 rounded-2xl border border-slate-900 shadow-2xl select-none">
      <svg
        viewBox="0 0 410 450"
        className="w-full h-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]"
        style={{ background: "linear-gradient(to bottom, #030610 0%, #0a0e1a 100%)", display: "block" }}
      >
        <defs>
          <radialGradient id="stadium-glow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="rgba(22, 67, 126, 0.35)" />
            <stop offset="100%" stopColor="rgba(10, 14, 26, 0)" />
          </radialGradient>

          <pattern id="padel-mesh" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 5 M 0 0 L 5 5" stroke="rgba(56, 189, 248, 0.18)" strokeWidth="0.4" />
          </pattern>

          <filter id="neon-cyan" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neon-green" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neon-purple" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="blur-small">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>

          <marker id="arrow-target" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="#34d399" />
          </marker>
          <marker id="arrow-lauf" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="#c084fc" />
          </marker>

          {/* =================================== */}
          {/* SCHLÄGER & BALL TEXTUREN (GRADIENTS) */}
          {/* =================================== */}
          <radialGradient id="ball-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#efff80" />
            <stop offset="100%" stopColor="#84cc00" />
          </radialGradient>

          {/* Schläger-Grip Mattgrau */}
          <linearGradient id="handle-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Schläger-Schlagfläche Carbon-Look */}
          <linearGradient id="racket-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* ============================== */}
          {/* SPIELER TEXTUREN (3D SHADING)  */}
          {/* ============================== */}
          {/* DU (Dunkles Neon-Rot) */}
          <linearGradient id="body-DU" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="40%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <radialGradient id="head-DU" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
          
          {/* PTNER (Pink / Cyber-Magenta) */}
          <linearGradient id="body-PTNER" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#be123c" />
            <stop offset="40%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <radialGradient id="head-PTNER" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="100%" stopColor="#be123c" />
          </radialGradient>

          {/* GEG1 (Neon-Gelb / Amber) */}
          <linearGradient id="body-GEG1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <radialGradient id="head-GEG1" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>

          {/* GEG2 (Volt-Orange) */}
          <linearGradient id="body-GEG2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9a3412" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
          <radialGradient id="head-GEG2" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="100%" stopColor="#9a3412" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="410" height="450" fill="url(#stadium-glow)" />

        {/* 1. SPIELFELD-UNTERGRUND */}
        <polygon
          points={`${project3D(10, 10).x},${project3D(10, 10).y} ${project3D(W - 10, 10).x},${project3D(W - 10, 10).y} ${project3D(W - 10, H - 10).x},${project3D(W - 10, H - 10).y} ${project3D(10, H - 10).x},${project3D(10, H - 10).y}`}
          fill="#2270a3"
          stroke="rgba(56, 189, 248, 0.6)"
          strokeWidth="2"
        />

        {/* 2. FELDLINIEN */}
        {(() => {
          const l1 = project3D(offsetX, 10);
          const l2 = project3D(offsetX, H - 10);
          const r1 = project3D(W - offsetX, 10);
          const r2 = project3D(W - offsetX, H - 10);
          const c1 = project3D(offsetX, H / 2);
          const c2 = project3D(W - offsetX, H / 2);
          return (
            <g opacity="0.85">
              <line x1={l1.x} y1={l1.y} x2={l2.x} y2={l2.y} stroke="#ffffff" strokeWidth="2" />
              <line x1={r1.x} y1={r1.y} x2={r2.x} y2={r2.y} stroke="#ffffff" strokeWidth="2" />
              <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })()}

        {/* 3. DEINE LAUFZONEN (Links / Unten) */}
        {LETTERS.map((l) =>
          NUMBERS.map((n) => {
            const zoneId = `${l}${n}`;
            const b = zoneBoundsLeft(zoneId, W, H);
            
            const isSelected = profiMode && selectedLaufZone === zoneId;
            const isPerfect = profiMode && hasSubmitted && perfectLaufZone === zoneId;
            const isAcceptable = profiMode && hasSubmitted && acceptableLaufZones.includes(zoneId);
            const isWrong = profiMode && hasSubmitted && isSelected && !isPerfect && !isAcceptable;

            let fill = "transparent";
            let stroke = "rgba(255, 255, 255, 0.03)";
            
            if (profiMode) {
              if (!hasSubmitted) {
                fill = isSelected ? "rgba(139, 92, 246, 0.18)" : "transparent";
              } else {
                if (isPerfect) fill = "rgba(52, 211, 153, 0.22)"; 
                else if (isAcceptable) fill = "rgba(249, 115, 22, 0.22)"; 
                else if (isWrong) fill = "rgba(239, 68, 68, 0.22)"; 
                else fill = "transparent";
              }

              if (isSelected || isPerfect || isAcceptable || isWrong) {
                if (isPerfect) stroke = "#34d399"; 
                else if (isAcceptable) stroke = "#f97316"; 
                else if (isWrong) stroke = "#ef4444"; 
                else stroke = "#c084fc"; 
              }
            }

            const shouldPulse = isSelected && (isPerfect || isAcceptable);

            return (
              <polygon
                key={`left-zone-${zoneId}`}
                points={getPolygonPoints(b)}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected || isPerfect || isAcceptable || isWrong ? "2" : "0.5"}
                onClick={() => profiMode && !hasSubmitted && onLaufZoneClick && onLaufZoneClick(zoneId)}
                style={{ cursor: profiMode && !hasSubmitted ? "pointer" : "default" }}
                className={`transition-all duration-150 hover:fill-white/5 ${shouldPulse ? "animate-pulse" : ""}`}
              />
            );
          })
        )}

        {/* 4. GEGNERISCHE ZIELZONEN (Rechts / Oben) */}
        {allZoneIds.map((zoneId) => {
          const b = zoneBounds(zoneId, W, H);
          
          const isSelected = selectedZone === zoneId;
          const isBest = hasSubmitted && bestZones.includes(zoneId);
          const isAcceptable = hasSubmitted && acceptableZones.includes(zoneId);
          const isWrong = hasSubmitted && isSelected && !isBest && !isAcceptable;

          let fill = "transparent";
          let stroke = "rgba(255, 255, 255, 0.04)";
          
          if (!hasSubmitted) {
            fill = isSelected ? "rgba(52, 211, 153, 0.15)" : "transparent";
          } else {
            if (isBest) fill = "rgba(52, 211, 153, 0.22)"; 
            else if (isAcceptable) fill = "rgba(249, 115, 22, 0.22)"; 
            else if (isWrong) fill = "rgba(239, 68, 68, 0.22)"; 
            else fill = "transparent";
          }

          if (isSelected || isBest || isAcceptable || isWrong) {
            if (isBest) stroke = "#34d399"; 
            else if (isAcceptable) stroke = "#f97316"; 
            else if (isWrong) stroke = "#ef4444"; 
            else stroke = "#34d399"; 
          }

          const shouldPulse = isSelected && (isBest || isAcceptable);

          return (
            <polygon
              key={`right-zone-${zoneId}`}
              points={getPolygonPoints(b)}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected || isBest || isAcceptable || isWrong ? "2" : "0.5"}
              onClick={() => level !== "Schlag" && !hasSubmitted && onZoneClick(zoneId)}
              style={{ cursor: hasSubmitted || level === "Schlag" ? "default" : "pointer" }}
              className={`transition-all duration-150 hover:fill-white/5 ${shouldPulse ? "animate-pulse" : ""}`}
            />
          );
        })}

        {/* 5. ZONEN-BESCHRIFTUNGEN */}
        {LETTERS.map((l) => NUMBERS.map((n) => {
          const zoneId = `${l}${n}`;
          const bLeft = zoneBoundsLeft(zoneId, W, H);
          const bRight = zoneBounds(zoneId, W, H);
          const pL = project3D(bLeft.cx, bLeft.cy);
          const pR = project3D(bRight.cx, bRight.cy);

          return (
            <g key={`text-${zoneId}`} style={{ pointerEvents: "none" }} opacity="0.25" fontSize="9" fontWeight="bold" fontFamily="monospace">
              {(level === "Schlag" || profiMode) && (
                <text x={pL.x} y={pL.y} textAnchor="middle" dominantBaseline="central" fill="#ffffff">{zoneId}</text>
              )}
              {level !== "Schlag" && (
                <text x={pR.x} y={pR.y} textAnchor="middle" dominantBaseline="central" fill="#ffffff">{zoneId}</text>
              )}
            </g>
          );
        }))}

        {/* 6. NETZ */}
        {(() => {
          const bottomStart = project3D(netX, 10, 0);
          const bottomEnd = project3D(netX, H - 10, 0);
          const topStart = project3D(netX, 10, 26);
          const topEnd = project3D(netX, H - 10, 26);
          return (
            <g style={{ pointerEvents: "none" }}>
              <polygon points={`${bottomStart.x},${bottomStart.y} ${topStart.x},${topStart.y} ${topEnd.x},${topEnd.y} ${bottomEnd.x},${bottomEnd.y}`} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <line x1={topStart.x} y1={topStart.y} x2={topEnd.x} y2={topEnd.y} stroke="#ffffff" strokeWidth="2" />
              <line x1={bottomStart.x} y1={bottomStart.y} x2={topStart.x} y2={topStart.y} stroke="#64748b" strokeWidth="2.5" />
              <line x1={bottomEnd.x} y1={bottomEnd.y} x2={topEnd.x} y2={topEnd.y} stroke="#64748b" strokeWidth="2.5" />
            </g>
          );
        })()}

        {/* 7. WÄNDE & GITTER */}
        {(() => {
          const hGlass = 65; 
          const hMesh = 45;  

          const bTL = project3D(10, 10, 0);
          const bBL = project3D(10, H - 10, 0);
          const bTR = project3D(W - 10, 10, 0);
          const bBR = project3D(W - 10, H - 10, 0);

          const tTL = project3D(10, 10, hGlass);
          const tBL = project3D(10, H - 10, hGlass);
          const tTR = project3D(W - 10, 10, hGlass);
          const tBR = project3D(W - 10, H - 10, hGlass);

          const bL_TopGlEnd = project3D(10 + glassWallLength, 10, 0);
          const tL_TopGlEnd = project3D(10 + glassWallLength, 10, hGlass);
          const bL_BotGlEnd = project3D(10 + glassWallLength, H - 10, 0);
          const tL_BotGlEnd = project3D(10 + glassWallLength, H - 10, hGlass);

          const bR_TopGlEnd = project3D(W - 10 - glassWallLength, 10, 0);
          const tR_TopGlEnd = project3D(W - 10 - glassWallLength, 10, hGlass);
          const bR_BotGlEnd = project3D(W - 10 - glassWallLength, H - 10, 0);
          const tR_BotGlEnd = project3D(W - 10 - glassWallLength, H - 10, hGlass);

          const tL_TopMeshStart = project3D(10 + glassWallLength, 10, hMesh);
          const tR_TopMeshEnd   = project3D(W - 10 - glassWallLength, 10, hMesh);
          const tL_BotMeshStart = project3D(10 + glassWallLength, H - 10, hMesh);
          const tR_BotMeshEnd   = project3D(W - 10 - glassWallLength, H - 10, hMesh);

          return (
            <g style={{ pointerEvents: "none" }}>
              <polygon points={`${bTL.x},${bTL.y} ${tTL.x},${tTL.y} ${tBL.x},${tBL.y} ${bBL.x},${bBL.y}`} fill="rgba(0, 242, 254, 0.04)" stroke="none" />
              <polygon points={`${bTR.x},${bTR.y} ${tTR.x},${tTR.y} ${tBR.x},${tBR.y} ${bBR.x},${bBR.y}`} fill="rgba(0, 242, 254, 0.04)" stroke="none" />
              
              <polygon points={`${bTL.x},${bTL.y} ${tTL.x},${tTL.y} ${tL_TopGlEnd.x},${tL_TopGlEnd.y} ${bL_TopGlEnd.x},${bL_TopGlEnd.y}`} fill="rgba(0, 242, 254, 0.03)" stroke="none" />
              <polygon points={`${bBL.x},${bBL.y} ${tBL.x},${tBL.y} ${tL_BotGlEnd.x},${tL_BotGlEnd.y} ${bL_BotGlEnd.x},${bL_BotGlEnd.y}`} fill="rgba(0, 242, 254, 0.03)" stroke="none" />
              <polygon points={`${bTR.x},${bTR.y} ${tTR.x},${tTR.y} ${tR_TopGlEnd.x},${tR_TopGlEnd.y} ${bR_TopGlEnd.x},${bR_TopGlEnd.y}`} fill="rgba(0, 242, 254, 0.03)" stroke="none" />
              <polygon points={`${bBR.x},${bBR.y} ${tBR.x},${tBR.y} ${tR_BotGlEnd.x},${tR_BotGlEnd.y} ${bR_BotGlEnd.x},${bR_BotGlEnd.y}`} fill="rgba(0, 242, 254, 0.03)" stroke="none" />

              <polygon points={`${bL_TopGlEnd.x},${bL_TopGlEnd.y} ${tL_TopMeshStart.x},${tL_TopMeshStart.y} ${tR_TopMeshEnd.x},${tR_TopMeshEnd.y} ${bR_TopGlEnd.x},${bR_TopGlEnd.y}`} fill="url(#padel-mesh)" stroke="none" />
              <polygon points={`${bL_BotGlEnd.x},${bL_BotGlEnd.y} ${tL_BotMeshStart.x},${tL_BotMeshStart.y} ${tR_BotMeshEnd.x},${tR_BotMeshEnd.y} ${bR_BotGlEnd.x},${bR_BotGlEnd.y}`} fill="url(#padel-mesh)" stroke="none" />

              <line x1={tL_TopMeshStart.x} y1={tL_TopMeshStart.y} x2={tR_TopMeshEnd.x} y2={tR_TopMeshEnd.y} stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.5" />
              <line x1={tL_BotMeshStart.x} y1={tL_BotMeshStart.y} x2={tR_BotMeshEnd.x} y2={tR_BotMeshEnd.y} stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.5" />

              <g stroke="#00f0ff" strokeWidth="2.5" filter="url(#neon-cyan)">
                <line x1={tTL.x} y1={tTL.y} x2={tBL.x} y2={tBL.y} />
                <line x1={tTL.x} y1={tTL.y} x2={tL_TopGlEnd.x} y2={tL_TopGlEnd.y} />
                <line x1={tBL.x} y1={tBL.y} x2={tL_BotGlEnd.x} y2={tL_BotGlEnd.y} />

                <line x1={tTR.x} y1={tTR.y} x2={tBR.x} y2={tBR.y} />
                <line x1={tTR.x} y1={tTR.y} x2={tR_TopGlEnd.x} y2={tR_TopGlEnd.y} />
                <line x1={tBR.x} y1={tBR.y} x2={tR_BotGlEnd.x} y2={tR_BotGlEnd.y} />
              </g>

              <g stroke="rgba(0, 240, 255, 0.7)" strokeWidth="2">
                <line x1={bTL.x} y1={bTL.y} x2={tTL.x} y2={tTL.y} />
                <line x1={bBL.x} y1={bBL.y} x2={tBL.x} y2={tBL.y} />
                <line x1={bTR.x} y1={bTR.y} x2={tTR.x} y2={tTR.y} />
                <line x1={bBR.x} y1={bBR.y} x2={tBR.x} y2={tBR.y} />
              </g>
            </g>
          );
        })()}

        {/* 8. 3D SPIELER MIT PADEL-SCHLÄGERN */}
        {(() => {
          const pos = zoneCenter("right", positions.opp1, W, H);
          const p = project3D(pos.x, pos.y, 0);
          return render3DPlayer(p.x, p.y, "GEG1", "GEG1", false);
        })()}

        {(() => {
          const pos = zoneCenter("right", positions.opp2, W, H);
          const p = project3D(pos.x, pos.y, 0);
          return render3DPlayer(p.x, p.y, "GEG2", "GEG2", false);
        })()}

        {(() => {
          const pos = zoneCenter("left", positions.partner, W, H);
          const p = project3D(pos.x, pos.y, 0);
          return render3DPlayer(p.x, p.y, "PTNER", "PTNER", false);
        })()}

        {(() => {
          const pos = zoneCenter("left", positions.you, W, H);
          const p = project3D(pos.x, pos.y, 0);
          return render3DPlayer(p.x, p.y, "DU", "DU", true); 
        })()}

        {(() => {
          const ballPos = zoneCenter(positions.ball.side, positions.ball.zone, W, H);
          const p = project3D(ballPos.x, ballPos.y, 7); 
          const shadow = project3D(ballPos.x, ballPos.y, 0);
          return (
            <g>
              <ellipse cx={shadow.x} cy={shadow.y + 1} rx={ballR * 1.1} ry={ballR * 0.6} fill="rgba(0,0,0,0.4)" filter="url(#blur-small)" />
              <circle cx={p.x} cy={p.y} r={ballR} fill="url(#ball-grad)" stroke="#1a2e05" strokeWidth="0.5" filter="url(#neon-green)" />
            </g>
          );
        })()}

        {/* ======================================================== */}
        {/* 9. TAKTISCHE PFEILE (Als letztes -> immer ganz oben) */}
        {/* ======================================================== */}
        <g style={{ pointerEvents: "none" }}>
          
          {/* LAUFRICHTUNG */}
          {profiMode && selectedLaufZone && !hasSubmitted && (() => {
            const fromPos = zoneCenter("left", positions.you, W, H);
            const target2D = zoneBoundsLeft(selectedLaufZone, W, H);
            const to = project3D(target2D.cx, target2D.cy, 2);
            
            if (positions.you === selectedLaufZone) return null;

            const dx = Math.abs(target2D.cx - fromPos.y); 
            const flatStartOffset = dx < 1 ? 0.1 : 0;
            const fromFixed = project3D(fromPos.x, fromPos.y + flatStartOffset, 4);

            return (
              <line 
                x1={fromFixed.x} 
                y1={fromFixed.y} 
                x2={to.x} 
                y2={to.y}
                stroke="#c084fc"
                strokeWidth="5"
                strokeDasharray="5 4"
                markerEnd="url(#arrow-lauf)"
                filter="url(#neon-purple)"
              />
            );
          })()}

          {/* BALLFLUG */}
          {selectedZone && !hasSubmitted && (() => {
            const ballPos2D = zoneCenter(positions.ball.side, positions.ball.zone, W, H);
            const from = project3D(ballPos2D.x, ballPos2D.y, 4);
            const target2D = zoneBounds(selectedZone, W, H);
            const to = project3D(target2D.cx, target2D.cy, 2);

            const schlagTyp = positions.ball.type || "Schlag";

            let bogenHoehe = 50;
            let strokeWidth = "4.5";
            let dashArray = "5 4";

            if (schlagTyp === "LOB") {
              bogenHoehe = 180;
              strokeWidth = "4.5";
              dashArray = "5 4";
            } else if (schlagTyp === "VOLLEY") {
              bogenHoehe = 10;
              strokeWidth = "4";
              dashArray = "1 1";
            } else if (schlagTyp === "SMASH") {
              bogenHoehe = 0;
              strokeWidth = "6";
              dashArray = "8 2 2 2";
            } else if (schlagTyp === "BANDEJA") {
              bogenHoehe = 100;
              strokeWidth = "4.5";
              dashArray = "6 3";
            } else if (schlagTyp === "VIBORA") {
              bogenHoehe = 10;
              strokeWidth = "5";
              dashArray = "4 2";
            } else if (schlagTyp === "BLOCK") {
              bogenHoehe = 80;
              strokeWidth = "4";
              dashArray = "2 3";
            } else if (schlagTyp === "BAJADA") {
              bogenHoehe = 20;
              strokeWidth = "5.5";  
              dashArray = "7 2";
            } else if (schlagTyp === "CHIQUITA") {
              bogenHoehe = 50;
              strokeWidth = "3.5";
              dashArray = "3 3";
            } else if (schlagTyp === "AUFSCHLAG") {
              bogenHoehe = 100;
              strokeWidth = "4.5";
              dashArray = "5 4";
            } else if (schlagTyp === "DRIVE") {
              bogenHoehe = 50;
              strokeWidth = "4.5";
              dashArray = "5 4";
            }

            const dx = to.x - from.x;
            const safetyOffset = Math.abs(dx) < 2 ? 15 : 0;

            const cp1x = from.x + safetyOffset;
            const cp1y = from.y - (from.y - to.y) * 0.3;
            
            const cp2x = (from.x + to.x) / 2 + safetyOffset;
            const cp2y = Math.min(from.y, to.y) - Math.max(bogenHoehe, Math.abs(from.y - to.y) * 0.2); 

            return (
              <path 
                d={`M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`}
                fill="none"
                stroke="#34d399"
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                markerEnd="url(#arrow-target)"
                filter="url(#neon-green)"
              />
            );
          })()}

        </g>

        {/* 10. TEXT MELDUNGEN & LABELS */}
        {!selectedZone && !hasSubmitted && level !== "Schlag" && level !== "Laufrichtung" && (
        <text x="205" y="50" textAnchor="middle" fill="rgba(56, 189, 248, 0.65)" fontSize="12" fontWeight="bold" letterSpacing="1.5" className="animate-pulse">
         ZIELZONE WÄHLEN
         </text>
        )}
        {profiMode && !selectedLaufZone && !hasSubmitted && (
          <text x="205" y="420" textAnchor="middle" fill="rgba(192, 132, 252, 0.85)" fontSize="13" fontWeight="bold" letterSpacing="1.5" className="animate-pulse">
            LAUFZIEL WÄHLEN
          </text>
        )}

        <text x="205" y="400" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="bold" letterSpacing="0.5">
          DEINE SEITE
        </text>
        <text x="205" y="30" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="bold" letterSpacing="0.5">
          GEGNERISCHE SEITE
        </text>
      </svg>
    </div>
  );
}
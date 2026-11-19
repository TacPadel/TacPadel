import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scenario } from "./Scenarios";
import { useTranslation } from "../lib/i18n";

export type ShareCardPayload =
  | {
      mode: "trainer_result";
      levelName: string;
      score: number;
      maxScore: number;
      totalPoints: number;
      userName: string;
    }
  | {
      mode: "match_result";
      playerScore: number;
      aiScore: number;
      opponentTeam: string;
      tacScore: number;
      isWin: boolean;
      userName: string;
    }
  | {
      mode: "partner_challenge";
      scenario: Scenario;
      description: string;
      userName: string;
    };

interface ShareCardModalProps {
  payload: ShareCardPayload | null;
  onClose: () => void;
}

// Kompatibles abgerundetes Rechteck für alle WebViews (Android & iOS)
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 4
) {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lineCount++;
      if (lineCount >= maxLines) {
        ctx.fillText(line.trim() + "...", x, y);
        return;
      }
      ctx.fillText(line.trim(), x, y);
      line = words[i] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

// Zeichnet das 2D-Taktikfeld für die Doppelpartner-Challenge
function drawMiniCourt(
  ctx: CanvasRenderingContext2D,
  scenario: Scenario,
  cx: number,
  topY: number,
  courtW: number,
  courtH: number,
  labels: { you: string; opp1: string; opp2: string }
) {
  const leftX = cx - courtW / 2;
  const halfH = courtH / 2;

  // Spielfeld-Hintergrund
  drawRoundRect(ctx, leftX, topY, courtW, courtH, 18);
  ctx.fillStyle = "#071329";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#06b6d4";
  ctx.stroke();

  // Netz in der Mitte
  ctx.beginPath();
  ctx.moveTo(leftX, topY + halfH);
  ctx.lineTo(leftX + courtW, topY + halfH);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#f97316";
  ctx.stroke();

  // Aufschlaglinien
  const serviceOffset = halfH * 0.62;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.beginPath();
  ctx.moveTo(leftX, topY + halfH - serviceOffset);
  ctx.lineTo(leftX + courtW, topY + halfH - serviceOffset);
  ctx.moveTo(leftX, topY + halfH + serviceOffset);
  ctx.lineTo(leftX + courtW, topY + halfH + serviceOffset);
  ctx.moveTo(cx, topY + halfH - serviceOffset);
  ctx.lineTo(cx, topY + halfH + serviceOffset);
  ctx.stroke();

  const letters = ["A", "B", "C", "D", "E"];
  const getCoords = (zone: string, side: "left" | "right") => {
    const col = Math.max(0, letters.indexOf((zone?.[0] || "C").toUpperCase()));
    const row = Math.min(5, Math.max(1, parseInt(zone?.[1] || "2", 10)));
    const x = leftX + ((col + 0.5) / 5) * courtW;
    const y =
      side === "left"
        ? topY + courtH - ((row - 0.5) / 5) * halfH
        : topY + ((row - 0.5) / 5) * halfH;
    return { x, y };
  };

  const drawMarker = (x: number, y: number, color: string, label: string) => {
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = label.length > 2 ? "900 13px sans-serif" : "900 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 1);
  };

  const pYou = getCoords(scenario.positions.you, "left");
  const pPartner = getCoords(scenario.positions.partner, "left");
  const pOpp1 = getCoords(scenario.positions.opp1, "right");
  const pOpp2 = getCoords(scenario.positions.opp2, "right");
  const pBall = getCoords(scenario.positions.ball.zone, scenario.positions.ball.side);

  drawMarker(pOpp1.x, pOpp1.y, "#ef4444", labels.opp1);
  drawMarker(pOpp2.x, pOpp2.y, "#ef4444", labels.opp2);
  drawMarker(pYou.x, pYou.y, "#a855f7", labels.you);
  drawMarker(pPartner.x, pPartner.y, "#06b6d4", "P");

  // Gelber Padelball
  ctx.beginPath();
  ctx.arc(pBall.x, pBall.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#030611";
  ctx.stroke();
}

export default function ShareCardModal({ payload, onClose }: ShareCardModalProps) {
  const { lang, t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const shareUrl =
    payload?.mode === "partner_challenge"
      ? `${window.location.origin}/?scenario=${payload.scenario.id}`
      : window.location.origin;

  const shareMessage = (() => {
    if (!payload) return "";
    if (payload.mode === "trainer_result") {
      return `${t("share_msg_trainer_1")} ${payload.score}/${payload.maxScore} ${t("share_msg_trainer_2")} "${payload.levelName}"! ${t("share_msg_trainer_3")} 👉 ${shareUrl}`;
    }
    if (payload.mode === "match_result") {
      const prefix = payload.isWin ? t("share_msg_match_win") : t("share_msg_match_battle");
      return `${prefix} (${payload.playerScore}:${payload.aiScore}) • TacScore: ${payload.tacScore}! ${t("share_msg_match_cta")} 👉 ${shareUrl}`;
    }
    return `${t("share_msg_challenge_1")}${payload.scenario.id}): "${payload.description}" – ${t("share_msg_challenge_2")} 👉 ${shareUrl}`;
  })();

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // 1. Hintergrund
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#030611");
    bgGrad.addColorStop(0.5, "#071024");
    bgGrad.addColorStop(1, "#02040a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtiles Raster
    ctx.strokeStyle = "rgba(6, 182, 212, 0.06)";
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Äußerer Neon-Rahmen
    drawRoundRect(ctx, 44, 44, W - 88, H - 88, 36);
    ctx.lineWidth = 4;
    ctx.strokeStyle = payload.mode === "partner_challenge" ? "#a855f7" : "#06b6d4";
    ctx.stroke();

    // Header Logo
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f97316";
    ctx.font = "900 54px sans-serif";
    ctx.fillText("TACPADEL", W / 2, 145);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "800 22px sans-serif";
    ctx.fillText(t("share_canvas_subtitle"), W / 2, 185);

    if (payload.mode === "trainer_result") {
      // Badge
      drawRoundRect(ctx, W / 2 - 240, 245, 480, 56, 28);
      ctx.fillStyle = "rgba(6, 182, 212, 0.16)";
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.font = "900 23px sans-serif";
      ctx.fillText(t("share_canvas_trainer_badge"), W / 2, 281);

      // Großer Score
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 180px sans-serif";
      ctx.fillText(`${payload.score} / ${payload.maxScore}`, W / 2, 515);

      ctx.fillStyle = "#34d399";
      ctx.font = "900 40px sans-serif";
      ctx.fillText(`${t("share_canvas_level")} ${payload.levelName.toUpperCase()}`, W / 2, 595);

      // Spieler-Box
      drawRoundRect(ctx, 140, 670, W - 280, 220, 28);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "800 24px sans-serif";
      ctx.fillText(`${t("share_canvas_player")} ${payload.userName.toUpperCase()}`, W / 2, 735);

      ctx.fillStyle = "#22d3ee";
      ctx.font = "900 56px sans-serif";
      ctx.fillText(`${payload.totalPoints.toLocaleString()} TACSCORE`, W / 2, 815);

      // Callout
      ctx.fillStyle = "#f8fafc";
      ctx.font = "900 42px sans-serif";
      ctx.fillText(t("share_canvas_trainer_cta"), W / 2, 1020);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 28px sans-serif";
      ctx.fillText(t("share_canvas_trainer_sub"), W / 2, 1070);
    } else if (payload.mode === "match_result") {
      drawRoundRect(ctx, W / 2 - 230, 245, 460, 56, 28);
      ctx.fillStyle = payload.isWin ? "rgba(16, 185, 129, 0.18)" : "rgba(249, 115, 22, 0.18)";
      ctx.fill();
      ctx.fillStyle = payload.isWin ? "#34d399" : "#fb923c";
      ctx.font = "900 24px sans-serif";
      ctx.fillText(
        payload.isWin ? t("share_canvas_match_win") : t("share_canvas_match_result"),
        W / 2,
        281
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 185px sans-serif";
      ctx.fillText(`${payload.playerScore} : ${payload.aiScore}`, W / 2, 515);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "800 32px sans-serif";
      ctx.fillText(`VS. ${payload.opponentTeam.toUpperCase()}`, W / 2, 585);

      drawRoundRect(ctx, 140, 665, W - 280, 220, 28);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "800 24px sans-serif";
      ctx.fillText(`${t("share_canvas_player")} ${payload.userName.toUpperCase()}`, W / 2, 730);

      ctx.fillStyle = "#22d3ee";
      ctx.font = "900 58px sans-serif";
      ctx.fillText(`${payload.tacScore.toLocaleString()} TACSCORE`, W / 2, 810);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "900 40px sans-serif";
      ctx.fillText(t("share_canvas_match_cta"), W / 2, 1020);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 28px sans-serif";
      ctx.fillText(t("share_canvas_match_sub"), W / 2, 1070);
    } else {
      // Doppelpartner-Challenge Karte
      drawRoundRect(ctx, W / 2 - 260, 230, 520, 52, 26);
      ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
      ctx.fill();
      ctx.fillStyle = "#c084fc";
      ctx.font = "900 22px sans-serif";
      ctx.fillText(
        `${t("share_canvas_challenge_badge")} #${payload.scenario.id}`,
        W / 2,
        263
      );

      // 2D Mini-Spielfeld zeichnen
      drawMiniCourt(ctx, payload.scenario, W / 2, 320, 340, 520, {
        you: t("share_canvas_marker_you"),
        opp1: t("share_canvas_marker_opp1"),
        opp2: t("share_canvas_marker_opp2"),
      });

      // Legende unter dem Court
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "800 19px sans-serif";
      ctx.fillStyle = "#c084fc";
      ctx.fillText(t("share_canvas_legend"), W / 2, 882);

      // Szenario-Frage
      drawRoundRect(ctx, 110, 915, W - 220, 235, 24);
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 28px sans-serif";
      wrapText(ctx, payload.description, W / 2, 972, W - 290, 38, 3);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "900 26px sans-serif";
      ctx.fillText(t("share_canvas_challenge_q"), W / 2, 1115);
    }

    // Footer
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#64748b";
    ctx.font = "800 22px sans-serif";
    ctx.fillText(t("share_canvas_footer"), W / 2, H - 85);

    setPreviewUrl(canvas.toDataURL("image/png"));
  }, [payload, lang, t]);

  const handleNativeShare = async () => {
    if (!canvasRef.current || !payload) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current?.toBlob((b) => resolve(b), "image/png")
      );

      if (blob && navigator.share) {
        const file = new File([blob], "tacpadel-taktik.png", { type: "image/png" });
        const canShareFiles =
          typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

        if (canShareFiles) {
          await navigator.share({
            title: "TacPadel",
            text: shareMessage,
            files: [file],
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: "TacPadel",
          text: shareMessage,
          url: shareUrl,
        });
        return;
      }

      // Fallback für Desktop: Bild herunterladen + Text kopieren
      if (previewUrl) {
        const a = document.createElement("a");
        a.href = previewUrl;
        a.download = "tacpadel-karte.png";
        a.click();
      }
      await navigator.clipboard?.writeText(shareMessage);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch (err) {
      // Abbruch durch Nutzer im Teilen-Dialog ignorieren
    }
  };

  return (
    <AnimatePresence>
      {payload && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="bg-[#050b18] border border-cyan-500/40 rounded-2xl p-5 sm:p-6 max-w-md w-full flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(6,182,212,0.2)]"
          >
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                {payload.mode === "partner_challenge"
                  ? t("share_modal_title_challenge")
                  : t("share_modal_title_result")}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {previewUrl && (
              <img
                src={previewUrl}
                alt="TacPadel Share Card"
                className="w-full max-h-[52vh] object-contain rounded-xl border border-slate-800 shadow-xl"
              />
            )}

            <div className="w-full flex flex-col gap-2">
              <button
                onClick={handleNativeShare}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black text-xs uppercase tracking-[0.18em] rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                {copiedText ? t("share_btn_copied") : t("share_btn_whatsapp")}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-[11px] uppercase tracking-widest rounded-xl border border-slate-800"
              >
                {t("share_btn_close")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
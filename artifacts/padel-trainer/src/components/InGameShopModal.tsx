import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import {
  SHOP_PARTNERS,
  SHOP_RACKETS,
  SHOP_SHOTS,
  ShopItem,
  ItemProgressMap,
  getSavedItemProgress,
  getUpgradedItemDetails,
  performItemUpgrade,
  checkItemRequirement,
  calculateLoadoutStats,
} from "../lib/loadout";
import { useTranslation, formatPartnerPerk } from "../lib/i18n";

interface InGameShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onLoadoutChanged: () => void;
}

const normalizePartnerId = (rawId?: string | null): string => {
  if (!rawId) return "partner_rookie";
  if (SHOP_PARTNERS.some((p) => p.id === rawId)) return rawId;
  return "partner_rookie";
};

export default function InGameShopModal({
  isOpen,
  onClose,
  userId,
  onLoadoutChanged,
}: InGameShopModalProps) {
  const { lang, t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  const isIOS = Capacitor.getPlatform() === "ios";

  const [activeCategory, setActiveCategory] = useState<"partner" | "racket" | "shot">("partner");

  const [tacPoints, setTacPoints] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_tac_points");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [currentScore, setCurrentScore] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_score");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [unlockedItems, setUnlockedItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("tacpadel_unlocked_items");
      return saved ? JSON.parse(saved) : ["partner_rookie", "racket_starter", "smash"];
    } catch {
      return ["partner_rookie", "racket_starter", "smash"];
    }
  });

  const [itemProgressMap, setItemProgressMap] = useState<ItemProgressMap>(() => getSavedItemProgress());

  const [equippedPartner, setEquippedPartner] = useState<string>(() =>
    normalizePartnerId(localStorage.getItem("tacpadel_partner_id"))
  );
  const [equippedRacket, setEquippedRacket] = useState<string>(
    () => localStorage.getItem("tacpadel_racket_id") || "racket_starter"
  );
  const [equippedShot, setEquippedShot] = useState<string>(
    () => localStorage.getItem("tacpadel_power_shot") || "smash"
  );

  const [previewPartner, setPreviewPartner] = useState<string>(equippedPartner);
  const [previewRacket, setPreviewRacket] = useState<string>(equippedRacket);
  const [previewShot, setPreviewShot] = useState<string>(equippedShot);

  const [isBuying, setIsBuying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const localPartner = normalizePartnerId(localStorage.getItem("tacpadel_partner_id"));
    const localRacket = localStorage.getItem("tacpadel_racket_id") || "racket_starter";
    const localShot = localStorage.getItem("tacpadel_power_shot") || "smash";
    const localTp = parseInt(localStorage.getItem("tacpadel_tac_points") || "0", 10);
    const localScore = parseInt(localStorage.getItem("tacpadel_score") || "0", 10);

    setEquippedPartner(localPartner);
    setEquippedRacket(localRacket);
    setEquippedShot(localShot);
    setPreviewPartner(localPartner);
    setPreviewRacket(localRacket);
    setPreviewShot(localShot);
    setTacPoints(localTp);
    setCurrentScore(localScore);
    setItemProgressMap(getSavedItemProgress());

    if (!userId) return;

    (async () => {
      const { data } = await supabase
        .from("user_stats")
        .select("points, tac_points, unlocked_items, partner_id, equipped_racket, equipped_shot")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        if (data.points != null) {
          setCurrentScore(data.points);
          localStorage.setItem("tacpadel_score", String(data.points));
        }
        if (data.tac_points != null) {
          setTacPoints(data.tac_points);
          localStorage.setItem("tacpadel_tac_points", String(data.tac_points));
        }
        if (Array.isArray(data.unlocked_items) && data.unlocked_items.length > 0) {
          const merged = Array.from(
            new Set(["partner_rookie", "racket_starter", "smash", ...data.unlocked_items])
          );
          setUnlockedItems(merged);
          localStorage.setItem("tacpadel_unlocked_items", JSON.stringify(merged));
        }
        if (data.partner_id) {
          const validP = normalizePartnerId(data.partner_id);
          setEquippedPartner(validP);
          setPreviewPartner(validP);
          localStorage.setItem("tacpadel_partner_id", validP);
        }
        if (data.equipped_racket) {
          setEquippedRacket(data.equipped_racket);
          setPreviewRacket(data.equipped_racket);
          localStorage.setItem("tacpadel_racket_id", data.equipped_racket);
        }
        if (data.equipped_shot) {
          setEquippedShot(data.equipped_shot);
          setPreviewShot(data.equipped_shot);
          localStorage.setItem("tacpadel_power_shot", data.equipped_shot);
        }
      }
    })();
  }, [isOpen, userId]);

  const previewStats = useMemo(
    () => calculateLoadoutStats(previewPartner, previewRacket, previewShot, itemProgressMap),
    [previewPartner, previewRacket, previewShot, itemProgressMap]
  );

  const isPreviewMode =
    previewPartner !== equippedPartner ||
    previewRacket !== equippedRacket ||
    previewShot !== equippedShot;

  // RPG UPGRADE LOGIK IM SHOP
  const handleUpgradeItem = async (item: ShopItem) => {
    const details = getUpgradedItemDetails(item, itemProgressMap);
    if (details.isMaxLevel) return;

    if (!details.canUpgrade) {
      const missingXp = Math.max(1, details.reqXp - details.xp);
      setFeedback({
        type: "error",
        text: `${t("rpg_need_more_xp_1")} ${missingXp} ${t("rpg_need_more_xp_2")}`,
      });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (tacPoints < details.upgradeCostTp) {
      const missingUpgradeTp = details.upgradeCostTp - tacPoints;
      setFeedback({
        type: "error",
        text: `${t("prof_msg_need_tp_1")} ${missingUpgradeTp} ${t("prof_msg_need_tp_2")}`,
      });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    const res = performItemUpgrade(item.id, tacPoints);
    if (!res.success) return;

    setTacPoints(res.newTacPoints);
    setItemProgressMap({ ...res.updatedProgressMap });

    if (userId) {
      await supabase.from("user_stats").update({ tac_points: res.newTacPoints }).eq("id", userId);
      await supabase.auth.updateUser({ data: { item_progress: res.updatedProgressMap } }).catch(() => {});
    }

    onLoadoutChanged();
    setFeedback({
      type: "success",
      text: `⬆️ ${item.name} ${t("rpg_upgrade_success")} +${res.newLevel}!`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleEquipOrBuy = async (item: ShopItem, category: "partner" | "racket" | "shot") => {
    const isUnlocked = unlockedItems.includes(item.id) || item.price === 0;
    const meetsScoreReq = checkItemRequirement(item, currentScore);

    if (!meetsScoreReq) {
      setFeedback({
        type: "error",
        text: `${t("shop_err_score_low_1")} ${item.reqScore} ${t("shop_err_score_low_2")}`,
      });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    if (isUnlocked) {
      if (category === "partner") {
        setEquippedPartner(item.id);
        setPreviewPartner(item.id);
        localStorage.setItem("tacpadel_partner_id", item.id);
        if (userId) await supabase.from("user_stats").update({ partner_id: item.id }).eq("id", userId);
      } else if (category === "racket") {
        setEquippedRacket(item.id);
        setPreviewRacket(item.id);
        localStorage.setItem("tacpadel_racket_id", item.id);
        if (userId) await supabase.from("user_stats").update({ equipped_racket: item.id }).eq("id", userId);
      } else {
        setEquippedShot(item.id);
        setPreviewShot(item.id);
        localStorage.setItem("tacpadel_power_shot", item.id);
        if (userId) await supabase.from("user_stats").update({ equipped_shot: item.id }).eq("id", userId);
      }

      onLoadoutChanged();
      setFeedback({ type: "success", text: `✓ ${item.name} ${t("prof_msg_equipped")}` });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (tacPoints < item.price) {
      const missingBuyTp = item.price - tacPoints;
      setFeedback({
        type: "error",
        text: `${t("prof_msg_need_tp_1")} ${missingBuyTp} ${t("prof_msg_need_tp_2")}`,
      });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    setIsBuying(true);
    const nextTp = tacPoints - item.price;
    const nextUnlocked = Array.from(new Set([...unlockedItems, item.id]));

    if (userId) {
      const payload: any = {
        tac_points: nextTp,
        unlocked_items: nextUnlocked,
        ...(category === "partner"
          ? { partner_id: item.id }
          : category === "racket"
            ? { equipped_racket: item.id }
            : { equipped_shot: item.id }),
      };

      const { error } = await supabase.from("user_stats").update(payload).eq("id", userId);
      if (error) {
        await supabase.from("user_stats").update({ tac_points: nextTp }).eq("id", userId);
      }
    }

    setIsBuying(false);
    setTacPoints(nextTp);
    setUnlockedItems(nextUnlocked);
    localStorage.setItem("tacpadel_tac_points", String(nextTp));
    localStorage.setItem("tacpadel_unlocked_items", JSON.stringify(nextUnlocked));

    if (category === "partner") {
      setEquippedPartner(item.id);
      setPreviewPartner(item.id);
      localStorage.setItem("tacpadel_partner_id", item.id);
    } else if (category === "racket") {
      setEquippedRacket(item.id);
      setPreviewRacket(item.id);
      localStorage.setItem("tacpadel_racket_id", item.id);
    } else {
      setEquippedShot(item.id);
      setPreviewShot(item.id);
      localStorage.setItem("tacpadel_power_shot", item.id);
    }

    onLoadoutChanged();
    setFeedback({ type: "success", text: `🎉 ${item.name} ${t("prof_msg_unlocked")}` });
    setTimeout(() => setFeedback(null), 2500);
  };

  const currentItems =
    activeCategory === "partner"
      ? SHOP_PARTNERS
      : activeCategory === "racket"
        ? SHOP_RACKETS
        : SHOP_SHOTS;

  const currentEquippedId =
    activeCategory === "partner"
      ? equippedPartner
      : activeCategory === "racket"
        ? equippedRacket
        : equippedShot;

  const currentPreviewId =
    activeCategory === "partner"
      ? previewPartner
      : activeCategory === "racket"
        ? previewRacket
        : previewShot;

  const handleSelectPreview = (id: string) => {
    if (activeCategory === "partner") setPreviewPartner(id);
    else if (activeCategory === "racket") setPreviewRacket(id);
    else setPreviewShot(id);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[300] h-[100dvh] w-screen flex items-center justify-center px-3 sm:px-4 bg-black/85 backdrop-blur-md pointer-events-auto select-none"
          style={{
            paddingTop: isNative
              ? isIOS
                ? "max(env(safe-area-inset-top, 0px), 52px)"
                : "max(env(safe-area-inset-top, 0px), 38px)"
              : "max(env(safe-area-inset-top, 0px), 16px)",
            paddingBottom: isNative
              ? isIOS
                ? "max(env(safe-area-inset-bottom, 0px), 24px)"
                : "max(env(safe-area-inset-bottom, 0px), 20px)"
              : "max(env(safe-area-inset-bottom, 0px), 16px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            className="w-full max-w-lg h-full max-h-[82dvh] bg-[#050b18] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden relative"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#030611] gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest truncate">
                  🛒 {t("prof_shop_title")}
                </h2>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5 truncate">
                  {t("prof_shop_sub")}
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-purple-950/50 border border-purple-500/40 px-2 py-1 rounded-lg">
                  <span className="text-[9px] font-bold text-purple-300 uppercase">
                    {t("shop_your_score")}
                  </span>
                  <span className="text-xs font-black text-white">{currentScore}</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-950/50 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                  <span className="text-xs">🪙</span>
                  <span className="text-xs font-black text-amber-400">{tacPoints} TP</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center font-black text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* LIVE ATTRIBUTE BAR */}
            <div className="px-4 py-2.5 bg-[#040914] border-b border-slate-800/80 flex flex-col gap-1.5 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {t("prof_attr_title")}
                </span>
                {isPreviewMode ? (
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/40">
                    {t("prof_preview")}
                  </span>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
                    {t("prof_active_badge")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-[#081124] border border-slate-800 rounded-lg py-1.5 px-1">
                  <div className="text-[8px] font-bold text-slate-400 uppercase">PWR</div>
                  <div className="text-sm font-black text-orange-400">
                    {previewStats.stats.smash}
                    {previewStats.diffs.smash !== 0 && (
                      <span className="text-[9px] ml-1 text-slate-300">
                        ({previewStats.diffs.smash > 0 ? `+${previewStats.diffs.smash}` : previewStats.diffs.smash})
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-[#081124] border border-slate-800 rounded-lg py-1.5 px-1">
                  <div className="text-[8px] font-bold text-slate-400 uppercase">CTRL</div>
                  <div className="text-sm font-black text-cyan-400">
                    {previewStats.stats.control}
                    {previewStats.diffs.control !== 0 && (
                      <span className="text-[9px] ml-1 text-slate-300">
                        ({previewStats.diffs.control > 0 ? `+${previewStats.diffs.control}` : previewStats.diffs.control})
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-[#081124] border border-slate-800 rounded-lg py-1.5 px-1">
                  <div className="text-[8px] font-bold text-slate-400 uppercase">DEF</div>
                  <div className="text-sm font-black text-emerald-400">
                    {previewStats.stats.defense}
                    {previewStats.diffs.defense !== 0 && (
                      <span className="text-[9px] ml-1 text-slate-300">
                        ({previewStats.diffs.defense > 0 ? `+${previewStats.diffs.defense}` : previewStats.diffs.defense})
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-[#081124] border border-slate-800 rounded-lg py-1.5 px-1">
                  <div className="text-[8px] font-bold text-slate-400 uppercase">AGI</div>
                  <div className="text-sm font-black text-purple-400">
                    {previewStats.stats.agility}
                    {previewStats.diffs.agility !== 0 && (
                      <span className="text-[9px] ml-1 text-slate-300">
                        ({previewStats.diffs.agility > 0 ? `+${previewStats.diffs.agility}` : previewStats.diffs.agility})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* KATEGORIE-TABS */}
            <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-[#030611] border-b border-slate-800 shrink-0">
              <button
                onClick={() => setActiveCategory("partner")}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeCategory === "partner"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                🤝 {t("prof_partner_label")}
              </button>
              <button
                onClick={() => setActiveCategory("racket")}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeCategory === "racket"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                🎾 {t("prof_racket_label")}
              </button>
              <button
                onClick={() => setActiveCategory("shot")}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeCategory === "shot"
                    ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                ⚡ {t("prof_focus_label")}
              </button>
            </div>

            {/* FEEDBACK BANNER */}
            {feedback && (
              <div
                className={`mx-4 mt-2.5 px-3 py-1.5 rounded-lg text-center text-xs font-bold border shrink-0 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* ITEM-LISTE */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2.5 custom-scrollbar min-h-0">
              {currentItems.map((item) => {
                const isUnlocked = unlockedItems.includes(item.id) || item.price === 0;
                const meetsScoreReq = checkItemRequirement(item, currentScore);
                const isEquipped = currentEquippedId === item.id && isUnlocked;
                const isSelected = currentPreviewId === item.id;
                const canAfford = tacPoints >= item.price;
                const scoreProgress =
                  item.reqScore > 0 ? Math.min(100, Math.round((currentScore / item.reqScore) * 100)) : 100;
                
                const details = getUpgradedItemDetails(item, itemProgressMap);
                const xpPct = details.isMaxLevel ? 100 : details.reqXp > 0 ? Math.min(100, Math.round((details.xp / details.reqXp) * 100)) : 0;
                const canAffordUpgrade = tacPoints >= details.upgradeCostTp;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectPreview(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isEquipped
                        ? "bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : isSelected
                          ? "bg-slate-900/90 border-amber-500/60"
                          : !meetsScoreReq
                            ? "bg-[#030611]/60 border-slate-800/60 opacity-80"
                            : "bg-[#030611]/90 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-white">
                            {details.displayName}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            {item.badge}
                          </span>

                          {item.reqScore > 0 && (
                            <span
                              className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                meetsScoreReq
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-950/50 text-red-400 border-red-500/40"
                              }`}
                            >
                              {meetsScoreReq
                                ? `✓ ${t("shop_req_score_label")} ${item.reqScore} TacScore`
                                : `${t("shop_locked_by_score")} ${item.reqScore} TacScore`}
                            </span>
                          )}
                        </div>

                        {activeCategory === "partner" && item.perk && (
                          <span className="text-[10px] text-slate-400 italic mt-0.5">
                            ⚡ {formatPartnerPerk(item.id, lang, item.perk)}
                          </span>
                        )}
                      </div>

                      {/* MODIFIER PILLS (EFFEKTIVE WERTE) */}
                      <div className="flex items-center gap-1 shrink-0 text-[9px] font-black flex-wrap justify-end">
                        {details.effectiveModifiers.smash !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${details.effectiveModifiers.smash > 0 ? "bg-orange-950/60 text-orange-400" : "bg-red-950/40 text-red-400"}`}>
                            PWR {details.effectiveModifiers.smash > 0 ? `+${details.effectiveModifiers.smash}` : details.effectiveModifiers.smash}
                          </span>
                        )}
                        {details.effectiveModifiers.control !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${details.effectiveModifiers.control > 0 ? "bg-cyan-950/60 text-cyan-400" : "bg-red-950/40 text-red-400"}`}>
                            CTRL {details.effectiveModifiers.control > 0 ? `+${details.effectiveModifiers.control}` : details.effectiveModifiers.control}
                          </span>
                        )}
                        {details.effectiveModifiers.defense !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${details.effectiveModifiers.defense > 0 ? "bg-emerald-950/60 text-emerald-400" : "bg-red-950/40 text-red-400"}`}>
                            DEF {details.effectiveModifiers.defense > 0 ? `+${details.effectiveModifiers.defense}` : details.effectiveModifiers.defense}
                          </span>
                        )}
                        {details.effectiveModifiers.agility !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${details.effectiveModifiers.agility > 0 ? "bg-purple-950/60 text-purple-400" : "bg-red-950/40 text-red-400"}`}>
                            AGI {details.effectiveModifiers.agility > 0 ? `+${details.effectiveModifiers.agility}` : details.effectiveModifiers.agility}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* WENN GEKAUFT: DIREKTER XP-BALKEN & +1 UPGRADE BUTTON IM SHOP */}
                    {isUnlocked && (
                      <div className="mt-1 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider">
                          <span className={details.canUpgrade ? "text-amber-400 animate-pulse" : "text-slate-400"}>
                            {details.isMaxLevel ? t("rpg_max_level") : details.canUpgrade ? t("rpg_ready_upgrade") : `${t("rpg_xp_label")} (+${details.level} ➔ +${details.level + 1})`}
                          </span>
                          {!details.isMaxLevel && (
                            <span className="text-cyan-300">{details.xp} / {details.reqXp} {t("rpg_xp_pts")}</span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-500 ${details.isMaxLevel ? "bg-gradient-to-r from-amber-400 to-yellow-300" : details.canUpgrade ? "bg-gradient-to-r from-amber-500 to-emerald-400" : "bg-gradient-to-r from-cyan-600 to-purple-500"}`}
                            style={{ width: `${xpPct}%` }}
                          />
                        </div>

                        {!details.isMaxLevel && details.canUpgrade && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpgradeItem(item);
                            }}
                            className={`w-full mt-1 py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                              canAffordUpgrade
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                                : "bg-slate-800 text-amber-400/70 border border-amber-500/30"
                            }`}
                          >
                            <span>{t("rpg_upgrade_btn")} +{details.level + 1} ({details.upgradeCostTp} TP 🪙)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {!meetsScoreReq && item.reqScore > 0 && (
                      <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 mb-1">
                          <span>TacScore</span>
                          <span className="text-red-400">
                            {currentScore} / {item.reqScore} ({scoreProgress}%)
                          </span>
                        </div>
                        <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all"
                            style={{ width: `${scoreProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* BUTTON ZEILE */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isUnlocked ? (
                          <span className="text-emerald-400">{t("shop_unlocked_badge")}</span>
                        ) : (
                          <span className="text-amber-400">🪙 {item.price} TP</span>
                        )}
                      </span>

                      {isEquipped ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase tracking-widest">
                          {t("prof_equipped")}
                        </span>
                      ) : !meetsScoreReq ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEquipOrBuy(item, activeCategory);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-900 text-red-400/90 border border-red-900/40 cursor-not-allowed"
                        >
                          {`${t("shop_locked_by_score")} ${item.reqScore} TacScore`}
                        </button>
                      ) : (
                        <button
                          disabled={isBuying || (!isUnlocked && !canAfford)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEquipOrBuy(item, activeCategory);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                            isUnlocked
                              ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                              : canAfford
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                          }`}
                        >
                          {isUnlocked
                            ? t("prof_equip_now")
                            : `${t("prof_unlock_for")} (${item.price} TP)`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
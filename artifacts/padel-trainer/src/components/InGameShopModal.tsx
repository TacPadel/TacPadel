import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import {
  SHOP_PARTNERS,
  SHOP_RACKETS,
  SHOP_SHOTS,
  ShopItem,
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

  const [activeCategory, setActiveCategory] = useState<"partner" | "racket" | "shot">("partner");

  const [tacPoints, setTacPoints] = useState<number>(() => {
    const saved = localStorage.getItem("tacpadel_tac_points");
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

  const [equippedPartner, setEquippedPartner] = useState<string>(() =>
    normalizePartnerId(localStorage.getItem("tacpadel_partner_id"))
  );
  const [equippedRacket, setEquippedRacket] = useState<string>(
    () => localStorage.getItem("tacpadel_racket_id") || "racket_starter"
  );
  const [equippedShot, setEquippedShot] = useState<string>(
    () => localStorage.getItem("tacpadel_power_shot") || "smash"
  );

  // Vorschau-Auswahl beim Antippen eines Items
  const [previewPartner, setPreviewPartner] = useState<string>(equippedPartner);
  const [previewRacket, setPreviewRacket] = useState<string>(equippedRacket);
  const [previewShot, setPreviewShot] = useState<string>(equippedShot);

  const [isBuying, setIsBuying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Beim Öffnen aktuelle Daten aus localStorage & Supabase synchronisieren
  useEffect(() => {
    if (!isOpen) return;

    const localPartner = normalizePartnerId(localStorage.getItem("tacpadel_partner_id"));
    const localRacket = localStorage.getItem("tacpadel_racket_id") || "racket_starter";
    const localShot = localStorage.getItem("tacpadel_power_shot") || "smash";
    const localTp = parseInt(localStorage.getItem("tacpadel_tac_points") || "0", 10);

    setEquippedPartner(localPartner);
    setEquippedRacket(localRacket);
    setEquippedShot(localShot);
    setPreviewPartner(localPartner);
    setPreviewRacket(localRacket);
    setPreviewShot(localShot);
    setTacPoints(localTp);

    if (!userId) return;

    (async () => {
      const { data } = await supabase
        .from("user_stats")
        .select("tac_points, unlocked_items, partner_id, equipped_racket, equipped_shot")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
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
    () => calculateLoadoutStats(previewPartner, previewRacket, previewShot),
    [previewPartner, previewRacket, previewShot]
  );

  const isPreviewMode =
    previewPartner !== equippedPartner ||
    previewRacket !== equippedRacket ||
    previewShot !== equippedShot;

  const handleEquipOrBuy = async (item: ShopItem, category: "partner" | "racket" | "shot") => {
    const isUnlocked = unlockedItems.includes(item.id) || item.price === 0;

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
      setFeedback({
        type: "error",
        text: `${t("prof_msg_need_tp_1")} ${item.price - tacPoints} ${t("prof_msg_need_tp_2")}`,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            className="w-full max-w-lg bg-[#050b18] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col max-h-[88vh] overflow-hidden relative"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#030611]">
              <div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest">
                  🛒 {t("prof_shop_title")}
                </h2>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                  {t("prof_shop_sub")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-amber-950/50 border border-amber-500/40 px-2.5 py-1 rounded-lg">
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
                className={`mx-4 mt-2.5 px-3 py-1.5 rounded-lg text-center text-xs font-bold border ${
                  feedback.type === "success"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* ITEM-LISTE */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2.5 custom-scrollbar">
              {currentItems.map((item) => {
                const isUnlocked = unlockedItems.includes(item.id) || item.price === 0;
                const isEquipped = currentEquippedId === item.id && isUnlocked;
                const isSelected = currentPreviewId === item.id;
                const canAfford = tacPoints >= item.price;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectPreview(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isEquipped
                        ? "bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : isSelected
                          ? "bg-slate-900/90 border-amber-500/60"
                          : "bg-[#030611]/90 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-white">
                            {item.name}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            {item.badge}
                          </span>
                        </div>
                        {activeCategory === "partner" && item.perk && (
                          <span className="text-[10px] text-slate-400 italic mt-0.5">
                            ⚡ {formatPartnerPerk(item.id, lang, item.perk)}
                          </span>
                        )}
                      </div>

                      {/* MODIFIER PILLS */}
                      <div className="flex items-center gap-1 shrink-0 text-[9px] font-black">
                        {item.modifiers.smash !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${item.modifiers.smash > 0 ? "bg-orange-950/60 text-orange-400" : "bg-red-950/40 text-red-400"}`}>
                            PWR {item.modifiers.smash > 0 ? `+${item.modifiers.smash}` : item.modifiers.smash}
                          </span>
                        )}
                        {item.modifiers.control !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${item.modifiers.control > 0 ? "bg-cyan-950/60 text-cyan-400" : "bg-red-950/40 text-red-400"}`}>
                            CTRL {item.modifiers.control > 0 ? `+${item.modifiers.control}` : item.modifiers.control}
                          </span>
                        )}
                        {item.modifiers.defense !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${item.modifiers.defense > 0 ? "bg-emerald-950/60 text-emerald-400" : "bg-red-950/40 text-red-400"}`}>
                            DEF {item.modifiers.defense > 0 ? `+${item.modifiers.defense}` : item.modifiers.defense}
                          </span>
                        )}
                        {item.modifiers.agility !== 0 && (
                          <span className={`px-1.5 py-0.5 rounded ${item.modifiers.agility > 0 ? "bg-purple-950/60 text-purple-400" : "bg-red-950/40 text-red-400"}`}>
                            AGI {item.modifiers.agility > 0 ? `+${item.modifiers.agility}` : item.modifiers.agility}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BUTTON ZEILE */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isUnlocked ? (
                          <span className="text-emerald-400">✓ Freigeschaltet</span>
                        ) : (
                          <span className="text-amber-400">🪙 {item.price} TP</span>
                        )}
                      </span>

                      {isEquipped ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase tracking-widest">
                          {t("prof_equipped")}
                        </span>
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
    </AnimatePresence>
  );
}
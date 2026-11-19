import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useTranslation } from "../lib/i18n";

const ANDROID_PACKAGE_ID = "com.TacPadel.app";
// 10-stellige Apple-ID aus App Store Connect -> App-Informationen -> Apple-ID (nur Ziffern eintragen)
const IOS_APP_ID = "6829195076";

const RATING_STORAGE_KEY = "tacpadel_rating_prompt_status";

export function shouldShowRatingPrompt(): boolean {
  try {
    const status = localStorage.getItem(RATING_STORAGE_KEY);
    if (status === "rated" || status === "dismissed") return false;
    return true;
  } catch {
    return false;
  }
}

function triggerNativeScheme(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface RatingPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RatingPromptModal({ isOpen, onClose }: RatingPromptModalProps) {
  const { t } = useTranslation();
  const [selectedStars, setSelectedStars] = useState<number>(0);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const openStoreRating = async () => {
    try {
      localStorage.setItem(RATING_STORAGE_KEY, "rated");
    } catch {}

    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const isIOS =
      platform === "ios" || (!isNative && /iPhone|iPad|iPod/i.test(navigator.userAgent));

    const hasValidIosId = /^\d+$/.test(IOS_APP_ID);

    const nativeUrl = isIOS
      ? hasValidIosId
        ? `itms-apps://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
        : null
      : `market://details?id=${ANDROID_PACKAGE_ID}`;

    const webFallbackUrl = isIOS
      ? hasValidIosId
        ? `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
        : "https://apps.apple.com/search?term=TacPadel"
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;

    onClose();

    if (isNative) {
      if (nativeUrl) {
        triggerNativeScheme(nativeUrl);

        // Fallback für Emulatoren / Geräte ohne installierte Store-App:
        // Wenn die App nach 700ms noch im Vordergrund ist, Store-Seite im Browser öffnen.
        setTimeout(() => {
          if (document.visibilityState === "visible") {
            Browser.open({ url: webFallbackUrl }).catch(() => {});
          }
        }, 700);
      } else {
        try {
          await Browser.open({ url: webFallbackUrl });
        } catch {}
      }
      return;
    }

    // Fallback für Desktop-/Web-Tests
    window.open(webFallbackUrl, "_blank", "noopener,noreferrer");
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(RATING_STORAGE_KEY, "dismissed");
    } catch {}
    onClose();
  };

  const handleStarClick = (stars: number) => {
    setSelectedStars(stars);
    if (stars >= 4) {
      openStoreRating();
    } else {
      setFeedbackSent(true);
      try {
        localStorage.setItem(RATING_STORAGE_KEY, "dismissed");
      } catch {}
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="bg-[#050b18] border border-amber-500/40 rounded-2xl p-6 sm:p-7 max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-[0_0_40px_rgba(245,158,11,0.2)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-cyan-400" />

            <span className="text-4xl">🎾</span>

            {feedbackSent ? (
              <div className="py-4">
                <h3 className="text-lg font-black text-emerald-400 uppercase tracking-wider">
                  {t("rating_thanks_title")}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t("rating_thanks_desc")}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider">
                    {t("rating_title")}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1.5">
                    {t("rating_desc")}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 my-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleStarClick(star)}
                      className={`text-3xl transition-transform hover:scale-125 active:scale-95 ${
                        selectedStars >= star ? "text-amber-400" : "text-slate-600 hover:text-amber-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDismiss}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors mt-1"
                >
                  {t("rating_later")}
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
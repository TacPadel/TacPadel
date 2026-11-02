import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const triggerHaptic = {
  // Leichter Impuls (z. B. für weiche Bälle, Dinks oder Menü-Klicks)
  light: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  },

  // Mittlerer Impuls (z. B. für den Standard-Schlag / Drive)
  medium: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    }
  },

  // Schwerer Impuls (Für den harten Smash)
  heavy: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    }
  },

  // Glaswand-Treffer (Kurzes, scharfes Vibrieren)
  vibrate: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.vibrate({ duration: 50 }).catch(() => {});
    }
  },

  // Punktgewinn / Erfolg (Success-Vibration)
  success: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    }
  }
};
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// =========================================================================
// ZENTRALER WACHSTUMS-SCHALTER
// true  = Open-Access-Phase: Alle registrierten Nutzer erhalten vollen Zugriff
// false = Freemium-Phase: Free-Limits greifen, nur Pro-Accounts sind unbegrenzt
// =========================================================================
export const OPEN_ACCESS_MODE = true;

// Gäste dürfen lokal bis zu 2 Spielzüge speichern; ab Anmeldung gibt es Cloud-Sync & 50 Plätze
export const GUEST_PLAYBOOK_SLOTS = 2;

const ADMIN_EMAILS = ["caposion@gmail.com", "admin@tacpadel.com"];

export interface UserEntitlements {
  tier: "free" | "pro";
  isPro: boolean;
  isOpenAccess: boolean;
  isGuest: boolean;
  // Playbook & 3D-Replay
  maxPlaybookSlots: number;
  canSaveMatchRally: boolean;
  // TacticsBoard & Studio
  canAccessStudio: boolean;
  canAccessDrills: boolean;
  maxAnimSteps: number;
  canCreateCustomDrills: boolean;
  hasAdvancedBoardOverlays: boolean;
  hasCleanVideoExport: boolean;
  // TacPadel Coach
  hasUnlimitedWeaknessDrills: boolean;
  weeklyWeaknessDrillLimit: number;
  hasFullCoachAnalytics: boolean;
}

export const FREE_ENTITLEMENTS: UserEntitlements = {
  tier: "free",
  isPro: false,
  isOpenAccess: false,
  isGuest: false,
  maxPlaybookSlots: 3,
  canSaveMatchRally: true,
  canAccessStudio: true,
  canAccessDrills: true,
  maxAnimSteps: 3,
  canCreateCustomDrills: false,
  hasAdvancedBoardOverlays: false,
  hasCleanVideoExport: false,
  hasUnlimitedWeaknessDrills: false,
  weeklyWeaknessDrillLimit: 1,
  hasFullCoachAnalytics: false,
};

export const PRO_ENTITLEMENTS: UserEntitlements = {
  tier: "pro",
  isPro: true,
  isOpenAccess: false,
  isGuest: false,
  maxPlaybookSlots: 50,
  canSaveMatchRally: true,
  canAccessStudio: true,
  canAccessDrills: true,
  maxAnimSteps: 20,
  canCreateCustomDrills: true,
  hasAdvancedBoardOverlays: true,
  hasCleanVideoExport: true,
  hasUnlimitedWeaknessDrills: true,
  weeklyWeaknessDrillLimit: 999,
  hasFullCoachAnalytics: true,
};

export function getEntitlements(isProAccount: boolean): UserEntitlements {
  if (isProAccount) {
    return { ...PRO_ENTITLEMENTS, isOpenAccess: OPEN_ACCESS_MODE, isGuest: false };
  }
  return { ...FREE_ENTITLEMENTS, isOpenAccess: false, isGuest: false };
}

// Löst den aktuellen Zugriff sauber über Session, Admin-Preview, Gastmodus und OPEN_ACCESS_MODE auf
export async function resolveUserEntitlements(): Promise<{
  userId: string | null;
  entitlements: UserEntitlements;
  isAdmin: boolean;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const emailLower = user?.email?.toLowerCase().trim() || "";
  const isAdmin = ADMIN_EMAILS.includes(emailLower);

  // Admin-Override: Free vs. Pro jederzeit live testbar
  if (isAdmin) {
    const localOverride = localStorage.getItem("tacpadel_is_pro");
    const adminPro = localOverride === null ? true : localOverride === "true";
    return { userId, entitlements: getEntitlements(adminPro), isAdmin: true };
  }

  // Gastmodus: Volles Ausprobieren ohne Login-Wand, aber auf 2 lokale Playbook-Plätze begrenzt
  if (!userId) {
    if (OPEN_ACCESS_MODE) {
      return {
        userId: null,
        entitlements: {
          ...PRO_ENTITLEMENTS,
          isOpenAccess: true,
          isGuest: true,
          maxPlaybookSlots: GUEST_PLAYBOOK_SLOTS,
        },
        isAdmin: false,
      };
    }

    return {
      userId: null,
      entitlements: {
        ...FREE_ENTITLEMENTS,
        isOpenAccess: false,
        isGuest: true,
        maxPlaybookSlots: GUEST_PLAYBOOK_SLOTS,
      },
      isAdmin: false,
    };
  }

  // Open-Access-Wachstumsphase für registrierte Nutzer: Voller Zugriff + 50 Plätze + Cloud-Sync
  if (OPEN_ACCESS_MODE) {
    return {
      userId,
      entitlements: { ...PRO_ENTITLEMENTS, isOpenAccess: true, isGuest: false },
      isAdmin: false,
    };
  }

  // Spätere Freemium-Phase: gegen Supabase user_stats.is_pro prüfen
  try {
    const { data } = await supabase
      .from("user_stats")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    const dbPro = Boolean(data?.is_pro);
    localStorage.setItem("tacpadel_is_pro", String(dbPro));
    return { userId, entitlements: getEntitlements(dbPro), isAdmin: false };
  } catch {
    const cached = localStorage.getItem("tacpadel_is_pro") === "true";
    return { userId, entitlements: getEntitlements(cached), isAdmin: false };
  }
}

// Event-Trigger für Admin-Schalter im ProfileTab
export function notifyEntitlementsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tacpadel-entitlements-change"));
  }
}

// React-Hook für alle Komponenten
export function useEntitlements(): {
  userId: string | null;
  entitlements: UserEntitlements;
  isAdmin: boolean;
  loading: boolean;
} {
  const [state, setState] = useState<{
    userId: string | null;
    entitlements: UserEntitlements;
    isAdmin: boolean;
    loading: boolean;
  }>(() => ({
    userId: null,
    entitlements: OPEN_ACCESS_MODE
      ? { ...PRO_ENTITLEMENTS, isOpenAccess: true, isGuest: false }
      : { ...FREE_ENTITLEMENTS, isGuest: false },
    isAdmin: false,
    loading: true,
  }));

  useEffect(() => {
    let active = true;

    const load = async () => {
      const resolved = await resolveUserEntitlements();
      if (!active) return;
      setState({ ...resolved, loading: false });
    };

    load();

    const handleChange = () => {
      load();
    };
    window.addEventListener("tacpadel-entitlements-change", handleChange);

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      window.removeEventListener("tacpadel-entitlements-change", handleChange);
      authSub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

// =========================================================================
// WOCHEN-LIMIT-HELPER FÜR SCHWÄCHEN-TRAINING (CoachTab)
// =========================================================================
function getCurrentIsoWeekKey(): string {
  const now = new Date();
  const temp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getWeaknessUsageKey(userId?: string | null): string {
  return `tacpadel_coach_weekly_drills_${userId || "guest"}_${getCurrentIsoWeekKey()}`;
}

export function getWeeklyWeaknessDrillsUsed(userId?: string | null): number {
  try {
    const raw = localStorage.getItem(getWeaknessUsageKey(userId));
    const parsed = parseInt(raw || "0", 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

export function canStartWeaknessDrill(
  userId: string | null | undefined,
  entitlements: UserEntitlements
): boolean {
  if (entitlements.hasUnlimitedWeaknessDrills) return true;
  return getWeeklyWeaknessDrillsUsed(userId) < entitlements.weeklyWeaknessDrillLimit;
}

export function recordWeaknessDrillStarted(userId?: string | null): void {
  try {
    const key = getWeaknessUsageKey(userId);
    const current = getWeeklyWeaknessDrillsUsed(userId);
    localStorage.setItem(key, String(current + 1));
  } catch {}
}
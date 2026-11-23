import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// =========================================================================
// ZENTRALER WACHSTUMS-SCHALTER
// true  = Open-Access-Phase: Alle regulären Nutzer erhalten vollen Zugriff
// false = Freemium-Phase: Free-Limits greifen, nur Pro-Accounts sind unbegrenzt
// =========================================================================
export const OPEN_ACCESS_MODE = true;

const ADMIN_EMAILS = ["caposion@gmail.com", "admin@tacpadel.com"];

export interface UserEntitlements {
  tier: "free" | "pro";
  isPro: boolean;
  isOpenAccess: boolean;
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
  maxPlaybookSlots: 3,
  canSaveMatchRally: true, // Viralität: jeder erlebt den Match -> 3D-Replay Kreislauf (bis max. 3 Slots)
  canAccessStudio: true,   // Viralität: Studio & 30-FPS-Clip mit Wasserzeichen für alle nutzbar
  canAccessDrills: true,   // 4 Standard-Coach-Drills immer frei
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
    return { ...PRO_ENTITLEMENTS, isOpenAccess: OPEN_ACCESS_MODE };
  }
  return { ...FREE_ENTITLEMENTS, isOpenAccess: false };
}

// Löst den aktuellen Zugriff sauber über Session, Admin-Preview und OPEN_ACCESS_MODE auf
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

  // Admin-Override: Ermöglicht dir im Profil jederzeit den Test von Free vs. Pro,
  // selbst während OPEN_ACCESS_MODE = true für alle anderen aktiv ist.
  if (isAdmin) {
    const localOverride = localStorage.getItem("tacpadel_is_pro");
    const adminPro = localOverride === null ? true : localOverride === "true";
    return { userId, entitlements: getEntitlements(adminPro), isAdmin: true };
  }

  // Open-Access-Wachstumsphase: Alle normalen Nutzer & Gäste bekommen sofort vollen Zugriff
  if (OPEN_ACCESS_MODE) {
    return {
      userId,
      entitlements: { ...PRO_ENTITLEMENTS, isOpenAccess: true },
      isAdmin: false,
    };
  }

  // Spätere Freemium-Phase: Gäste = Free, eingeloggte Nutzer gegen Supabase user_stats.is_pro prüfen
  if (!userId) {
    return { userId: null, entitlements: getEntitlements(false), isAdmin: false };
  }

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

// Event-Trigger für deinen Admin-Schalter im ProfileTab
export function notifyEntitlementsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tacpadel-entitlements-change"));
  }
}

// React-Hook für alle Komponenten (ersetzt doppelte is_pro-Abfragen)
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
      ? { ...PRO_ENTITLEMENTS, isOpenAccess: true }
      : { ...FREE_ENTITLEMENTS },
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
// src/lib/useProStatus.ts
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "caposion@gmail.com";

export function useProStatus() {
  const [isProUser, setIsProUser] = useState<boolean>(false);
  const [loadingPro, setLoadingPro] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchProStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // 1. Nicht eingeloggt (Gast) -> Kein Pro-User
        if (!session?.user) {
          if (isMounted) {
            setIsProUser(false);
            setLoadingPro(false);
          }
          return;
        }

        const userEmail = session.user.email?.toLowerCase().trim() || "";
        const isAdmin = userEmail === ADMIN_EMAIL;

        // 2. Für dich als Admin hat dein Test-Schalter aus dem Profil Vorrang
        if (isAdmin) {
          const adminOverride = localStorage.getItem("tacpadel_is_pro");
          if (isMounted) {
            setIsProUser(adminOverride === null ? true : adminOverride === "true");
            setLoadingPro(false);
          }
          return;
        }

        // 3. Für alle normalen Spieler & Tester: Immer live aus Supabase 'user_stats' abfragen!
        const { data, error } = await supabase
          .from("user_stats")
          .select("is_pro")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          const dbProStatus = Boolean(data.is_pro);
          setIsProUser(dbProStatus);
          localStorage.setItem("tacpadel_is_pro", String(dbProStatus));
        } else if (isMounted) {
          setIsProUser(false);
          localStorage.removeItem("tacpadel_is_pro");
        }
      } catch (err) {
        console.error("Fehler beim Prüfen des Pro-Status:", err);
      } finally {
        if (isMounted) setLoadingPro(false);
      }
    }

    fetchProStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isProUser, loadingPro };
}
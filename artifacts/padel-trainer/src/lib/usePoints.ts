import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

const STORAGE_KEYS = ['tacpadel_score', 'tacpadel_points', 'tacpadel_tac_points'];

export function usePoints() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);

  // Hilfsfunktion: Löscht alle lokalen Punkte-Speicherstände
  const clearLocalGuestPoints = useCallback(() => {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  // 1. Punkte beim Start oder Account-Wechsel laden
  useEffect(() => {
    let isMounted = true;

    const loadPoints = async () => {
      // GAST-MODUS: Lokalen Speicher sofort bereinigen & bei 0 starten
      if (!user) {
        clearLocalGuestPoints();
        if (isMounted) setPoints(0);
        return;
      }

      // EINGELOGGTER SPIELER: Zuerst aus Supabase laden (Single Source of Truth)
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('points')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data && typeof data.points === 'number') {
          if (isMounted) {
            setPoints(data.points);
            localStorage.setItem('tacpadel_score', data.points.toString());
          }
          return;
        }
      } catch (err) {
        console.error('Fehler beim Laden der Punkte aus Supabase:', err);
      }

      // Fallback für eingeloggte User (falls kurzzeitig offline)
      const saved = localStorage.getItem('tacpadel_score');
      if (saved && isMounted) {
        setPoints(parseInt(saved, 10) || 0);
      }
    };

    loadPoints();

    return () => {
      isMounted = false;
    };
  }, [user, clearLocalGuestPoints]);

  // 2. Sicherheits-Cleanup, wenn ein Gast den Tab schließt oder neu lädt
  useEffect(() => {
    if (user) return;

    const handleUnload = () => {
      clearLocalGuestPoints();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearLocalGuestPoints();
    };
  }, [user, clearLocalGuestPoints]);

  // 3. Punkte hinzufügen / abziehen
  const addPoints = useCallback(
    (amount: number) => {
      setPoints((prev) => {
        const nextPoints = Math.max(0, prev + amount);

        // NUR im localStorage speichern, wenn der Spieler wirklich eingeloggt ist!
        if (user) {
          localStorage.setItem('tacpadel_score', nextPoints.toString());
        } else {
          clearLocalGuestPoints();
        }

        return nextPoints;
      });
    },
    [user, clearLocalGuestPoints]
  );

  // 4. Punkte manuell zurücksetzen
  const resetPoints = useCallback(() => {
    setPoints(0);
    clearLocalGuestPoints();
  }, [clearLocalGuestPoints]);

  return {
    points,
    addPoints,
    setPoints,
    resetPoints
  };
}
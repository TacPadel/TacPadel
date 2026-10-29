import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

export type Level =
  | 'Schlag'
  | 'Schlagrichtung'
  | 'Laufrichtung'
  | 'Spielzug'
  | 'Simulation'
  | 'Strategie';

export interface ActiveSession {
  level: Level;
  score: number;
  currentScenarioIndex: number;
  rotationPool: number[];
  wrongPool: number[];
  isRetryPhase: boolean;
  roundsPlayed: number;
  hasSubmitted: boolean;
  selectedShot: string | null;
  selectedZone: string | null;
  selectedLaufZone: string | null;
  attempts: number;
  feedbackMsg: string | null;
}

const DEFAULT_HIGH_SCORES: Record<string, number> = {
  Schlag: 0,
  Schlagrichtung: 0,
  Laufrichtung: 0,
  Spielzug: 0,
  Simulation: 0
};

const DEFAULT_LOCKED_LEVELS: Level[] = ['Simulation'];

// Alte globale Keys, die im Gast-Modus restlos gelöscht werden
const LEGACY_GUEST_KEYS = [
  'tacpadel_highestScores',
  'tacpadel_highscores',
  'tacpadel_lockedLevels',
  'tacpadel_activeSession',
  'tacpadel_progress'
];

export function useProgress() {
  const { user } = useAuth();

  const [highestScores, setHighestScores] = useState<Record<string, number>>(DEFAULT_HIGH_SCORES);
  const [lockedLevels, setLockedLevelsState] = useState<Level[]>(DEFAULT_LOCKED_LEVELS);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isProgressLoaded, setIsProgressLoaded] = useState<boolean>(false);

  // Hilfsfunktion: Löscht alle ungebundenen Gast-Daten aus dem localStorage
  const clearGuestStorage = useCallback(() => {
    LEGACY_GUEST_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  // 1. Fortschritt beim Start oder Login/Logout laden
  useEffect(() => {
    setIsProgressLoaded(false);

    // GAST-MODUS: Alles auf Anfang setzen und nichts aus dem localStorage laden
    if (!user) {
      clearGuestStorage();
      setHighestScores(DEFAULT_HIGH_SCORES);
      setLockedLevelsState(DEFAULT_LOCKED_LEVELS);
      setActiveSession(null);
      setIsProgressLoaded(true);
      return;
    }

    // EINGELOGGTER NUTZER: Eigene Keys anhand der User-ID verwenden
    const scoresKey = `tacpadel_highestScores_${user.id}`;
    const lockedKey = `tacpadel_lockedLevels_${user.id}`;
    const sessionKey = `tacpadel_activeSession_${user.id}`;

    // Alte globale Gast-Einträge löschen, damit nichts vermischt wird
    clearGuestStorage();

    // A) Highscores laden (aus localStorage oder Supabase user_metadata)
    let loadedScores = { ...DEFAULT_HIGH_SCORES };
    const savedScoresStr = localStorage.getItem(scoresKey);
    if (savedScoresStr) {
      try {
        loadedScores = { ...DEFAULT_HIGH_SCORES, ...JSON.parse(savedScoresStr) };
      } catch (e) {
        console.error('Fehler beim Lesen der Highscores:', e);
      }
    } else if (user.user_metadata?.highest_scores) {
      loadedScores = { ...DEFAULT_HIGH_SCORES, ...user.user_metadata.highest_scores };
      localStorage.setItem(scoresKey, JSON.stringify(loadedScores));
    }
    setHighestScores(loadedScores);

    // B) Gesperrte Level laden
    let loadedLocked: Level[] = [...DEFAULT_LOCKED_LEVELS];
    const savedLockedStr = localStorage.getItem(lockedKey);
    if (savedLockedStr) {
      try {
        loadedLocked = JSON.parse(savedLockedStr);
      } catch (e) {
        console.error('Fehler beim Lesen der gesperrten Level:', e);
      }
    } else if (Array.isArray(user.user_metadata?.locked_levels)) {
      loadedLocked = user.user_metadata.locked_levels;
      localStorage.setItem(lockedKey, JSON.stringify(loadedLocked));
    }
    setLockedLevelsState(loadedLocked);

    // C) Aktive Sitzung laden
    const savedSessionStr = localStorage.getItem(sessionKey);
    if (savedSessionStr) {
      try {
        setActiveSession(JSON.parse(savedSessionStr));
      } catch (e) {
        localStorage.removeItem(sessionKey);
        setActiveSession(null);
      }
    } else {
      setActiveSession(null);
    }

    setIsProgressLoaded(true);
  }, [user, clearGuestStorage]);

  // 2. Cleanup beim Schließen des Tabs im Gast-Modus
  useEffect(() => {
    if (user) return;

    const handleUnload = () => {
      clearGuestStorage();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearGuestStorage();
    };
  }, [user, clearGuestStorage]);

  // 3. Highscore aktualisieren
  const updateHighScore = useCallback(
    (level: Level, newScore: number) => {
      setHighestScores((prev) => {
        const currentBest = prev[level] || 0;
        if (newScore <= currentBest) return prev;

        const updated = { ...prev, [level]: newScore };

        // NUR dauerhaft speichern, wenn der Spieler eingeloggt ist!
        if (user) {
          localStorage.setItem(`tacpadel_highestScores_${user.id}`, JSON.stringify(updated));
          supabase.auth.updateUser({
            data: { highest_scores: updated }
          }).catch(() => {});
        } else {
          clearGuestStorage();
        }

        return updated;
      });
    },
    [user, clearGuestStorage]
  );

  // 4. Gesperrte Level setzen
  const setLockedLevels: React.Dispatch<React.SetStateAction<Level[]>> = useCallback(
    (value) => {
      setLockedLevelsState((prev) => {
        const nextLocked = typeof value === 'function' ? value(prev) : value;

        if (user) {
          localStorage.setItem(`tacpadel_lockedLevels_${user.id}`, JSON.stringify(nextLocked));
          supabase.auth.updateUser({
            data: { locked_levels: nextLocked }
          }).catch(() => {});
        } else {
          clearGuestStorage();
        }

        return nextLocked;
      });
    },
    [user, clearGuestStorage]
  );

  // 5. Aktive Trainer-Sitzung speichern (Nur für eingeloggte Spieler)
  const saveActiveSession = useCallback(
    (sessionData: ActiveSession) => {
      if (!user) {
        clearGuestStorage();
        return;
      }
      setActiveSession(sessionData);
      localStorage.setItem(`tacpadel_activeSession_${user.id}`, JSON.stringify(sessionData));
    },
    [user, clearGuestStorage]
  );

  // 6. Aktive Sitzung löschen
  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
    clearGuestStorage();
    if (user) {
      localStorage.removeItem(`tacpadel_activeSession_${user.id}`);
    }
  }, [user, clearGuestStorage]);

  return {
    lockedLevels,
    setLockedLevels,
    highestScores,
    updateHighScore,
    activeSession,
    saveActiveSession,
    clearActiveSession,
    isProgressLoaded
  };
}
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export type Level = "Schlag" | "Schlagrichtung" | "Laufrichtung" | "Spielzug" | "Simulation" | "Strategie";

const INITIAL_SCORES: Record<string, number> = {
  Schlag: 0,
  Schlagrichtung: 0,
  Laufrichtung: 0,
  Spielzug: 0,
  Simulation: 0,
};

// 1. Definiere das Interface VOR der Funktion
export interface ProgressHookReturn {
  lockedLevels: Level[];
  setLockedLevels: (levels: Level[] | ((prev: Level[]) => Level[])) => Promise<void>;
  highestScores: Record<string, number>;
  updateHighScore: (level: Level, score: number) => Promise<void>;
  activeSession: any;
  saveActiveSession: (session: any) => Promise<void>;
  clearActiveSession: () => Promise<void>;
  resetGuestProgress: () => void;
  isProgressLoaded: boolean;
}

// 2. Weise dem Hook diesen Rückgabetyp zu
export function useProgress(): ProgressHookReturn {
  const { user } = useAuth();
  const [lockedLevelsState, setLockedLevelsState] = useState<Level[]>([]);
  const [highestScores, setHighestScoresState] = useState<Record<string, number>>(INITIAL_SCORES);
  
  // Session-States
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  // Setzt den temporären Fortschritt eines Gastes im Arbeitsspeicher zurück
  const resetGuestProgress = useCallback(() => {
    if (!user) {
      setLockedLevelsState([]);
      setHighestScoresState(INITIAL_SCORES);
      setActiveSession(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLockedLevelsState([]);
      setHighestScoresState(INITIAL_SCORES);
      setActiveSession(null);
      setIsProgressLoaded(false);
      return;
    }

    let isMounted = true;
    setIsProgressLoaded(false);

    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!isMounted) return;

      if (data) {
        const levels = (data.locked_levels as string[] || []) as Level[];
        setLockedLevelsState(levels);
        
        setHighestScoresState(data.highest_scores || INITIAL_SCORES);
        setActiveSession(data.active_session);
      } else if (error && error.code === 'PGRST116') {
        await supabase.from('user_progress').insert([{ user_id: user.id }]);
      }
      setIsProgressLoaded(true);
    };

    fetchProgress();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const setLockedLevels = async (newLevels: Level[] | ((prev: Level[]) => Level[])) => {
    setLockedLevelsState(prev => {
      const updated = typeof newLevels === 'function' ? newLevels(prev) : newLevels;
      if (user) {
        supabase.from('user_progress').update({ locked_levels: updated }).eq('user_id', user.id).then();
      }
      return updated;
    });
  };

  const updateHighScore = async (level: Level, currentScore: number) => {
    setHighestScoresState(prev => {
      if (currentScore > (prev[level] || 0)) {
        const newScores = { ...prev, [level]: currentScore };
        if (user) {
          supabase.from('user_progress').update({ highest_scores: newScores }).eq('user_id', user.id).then();
        }
        return newScores;
      }
      return prev;
    });
  };

  // Session-Speicherung in Supabase (Nur für eingeloggte Spieler!)
  const saveActiveSession = async (sessionData: any) => {
    if (!user) return;
    setActiveSession(sessionData);
    supabase.from('user_progress').update({ active_session: sessionData }).eq('user_id', user.id).then();
  };

  const clearActiveSession = async () => {
    setActiveSession(null);
    if (user) {
      supabase.from('user_progress').update({ active_session: null }).eq('user_id', user.id).then();
    }
  };

  return { 
    lockedLevels: lockedLevelsState, 
    setLockedLevels, 
    highestScores, 
    updateHighScore, 
    activeSession, 
    saveActiveSession, 
    clearActiveSession,
    resetGuestProgress,
    isProgressLoaded 
  };
}
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export type Level = "Schlag" | "Schlagrichtung" | "Laufrichtung" | "Spielzug" | "Simulation";

// 1. Definiere das Interface VOR der Funktion
export interface ProgressHookReturn {
  lockedLevels: Level[];
  setLockedLevels: (levels: Level[] | ((prev: Level[]) => Level[])) => Promise<void>;
  highestScores: Record<string, number>;
  updateHighScore: (level: Level, score: number) => Promise<void>;
  activeSession: any;
  saveActiveSession: (session: any) => Promise<void>;
  clearActiveSession: () => Promise<void>;
  isProgressLoaded: boolean;
}

// 2. Weise dem Hook diesen Rückgabetyp zu
export function useProgress(): ProgressHookReturn {
  const { user } = useAuth();
  const [lockedLevelsState, setLockedLevelsState] = useState<Level[]>([]);
  const [highestScores, setHighestScoresState] = useState<Record<string, number>>({
    Schlag: 0, Schlagrichtung: 0, Laufrichtung: 0, Spielzug: 0, Simulation: 0,
  });
  
  // NEU: Session-States
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLockedLevelsState([]);
      setHighestScoresState({ Schlag: 0, Schlagrichtung: 0, Laufrichtung: 0, Spielzug: 0, Simulation: 0 });
      setActiveSession(null);
      setIsProgressLoaded(false);
      return;
    }

    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        // HIER WIRD EXPLIZIT GECASTET:
        const levels = (data.locked_levels as string[] || []) as Level[];
        setLockedLevelsState(levels);
        
        setHighestScoresState(data.highest_scores || {
          Schlag: 0, Schlagrichtung: 0, Laufrichtung: 0, Spielzug: 0, Simulation: 0,
        });
        setActiveSession(data.active_session);
      } else if (error && error.code === 'PGRST116') {
        await supabase.from('user_progress').insert([{ user_id: user.id }]);
      }
      setIsProgressLoaded(true);
    };

    fetchProgress();
  }, [user]);

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

  // NEU: Session-Speicherung in Supabase
  const saveActiveSession = async (sessionData: any) => {
    setActiveSession(sessionData);
    if (user) {
      supabase.from('user_progress').update({ active_session: sessionData }).eq('user_id', user.id).then();
    }
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
    isProgressLoaded 
  };
}
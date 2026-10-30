import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export function usePoints() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setPoints(0);
      return;
    }

    let isMounted = true;

    const fetchPoints = async () => {
      // 1. Versuche, die Punkte des Users abzufragen
      const { data, error } = await supabase
        .from('user_stats')
        .select('points')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;

      if (error && error.code === 'PGRST116') {
        // PGRST116 bedeutet: "Es wurde keine Zeile gefunden."
        // Legt beim ersten Login automatisch eine neue Zeile an:
        const { data: insertData } = await supabase
          .from('user_stats')
          .insert([{ id: user.id, email: user.email, points: 0 }])
          .select('points')
          .single();
          
        if (insertData && isMounted) {
          setPoints(insertData.points);
          localStorage.setItem('tacpadel_score', insertData.points.toString());
        }
      } else if (data) {
        // Zeile existiert bereits, wir setzen die Punkte
        setPoints(data.points);
        localStorage.setItem('tacpadel_score', data.points.toString());
      }
    };

    fetchPoints();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Diese Funktion rufst du auf, wenn der User ein Szenario gelöst hat
  const addPoints = useCallback(async (amountToAdd: number) => {
    // Im Gast-Modus nichts in Supabase speichern!
    if (!user) {
      setPoints(prev => Math.max(0, prev + amountToAdd));
      return;
    }

    const newTotal = Math.max(0, points + amountToAdd);
    setPoints(newTotal); // Anzeige sofort aktualisieren
    localStorage.setItem('tacpadel_score', newTotal.toString());

    // Danach den neuen Wert in der Datenbank speichern
    await supabase
      .from('user_stats')
      .update({ points: newTotal })
      .eq('id', user.id);
  }, [user, points]);

  const resetGuestPoints = useCallback(() => {
    if (!user) {
      setPoints(0);
    }
  }, [user]);

  return { points, addPoints, resetGuestPoints };
}
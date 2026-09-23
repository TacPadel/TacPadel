import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

export function usePoints() {
  const { user } = useAuth()
  const [points, setPoints] = useState<number>(0)

  useEffect(() => {
    if (!user) {
      setPoints(0)
      return
    }

    const fetchPoints = async () => {
      // 1. Versuche, die Punkte des Users abzufragen
      const { data, error } = await supabase
        .from('user_stats')
        .select('points')
        .eq('id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // PGRST116 bedeutet: "Es wurde keine Zeile gefunden."
        // Das passiert, wenn der User sich zum ersten Mal einloggt.
        // Also legen wir jetzt automatisch eine neue Zeile für ihn an:
        const { data: insertData, error: insertError } = await supabase
          .from('user_stats')
          .insert([{ id: user.id, email: user.email, points: 0 }])
          .select('points')
          .single()
          
        if (insertData) setPoints(insertData.points)
      } else if (data) {
        // Zeile existiert bereits, wir setzen die Punkte
        setPoints(data.points)
      }
    }

    fetchPoints()
  }, [user])

  // Diese Funktion rufst du auf, wenn der User ein Szenario gelöst hat
  const addPoints = async (amountToAdd: number) => {
    if (!user) return

    const newTotal = points + amountToAdd
    setPoints(newTotal) // Die Anzeige sofort aktualisieren (fühlt sich schneller an)

    // Danach den neuen Wert in der Datenbank speichern
    await supabase
      .from('user_stats')
      .update({ points: newTotal })
      .eq('id', user.id)
  }

  return { points, addPoints }
}
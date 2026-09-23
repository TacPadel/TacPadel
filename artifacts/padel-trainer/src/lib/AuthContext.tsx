import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Definiert, was in unserem Context gespeichert wird
type AuthContextType = {
  session: Session | null
  user: User | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  signOut: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // 1. Prüfe, ob wir gerade vom Login zurückkommen und ein Token in der URL steht
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    // 2. Das ist der wichtige Teil für das Handy:
    // Der Event-Listener für Auth-Änderungen fängt den Token aus der URL automatisch ab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      // Optional: Nach erfolgreichem Login zurück zur Startseite leiten
      if (session) {
        window.location.hash = ""; // URL säubern
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Eigener Hook, damit wir ihn überall in der App einfach nutzen können
export const useAuth = () => {
  return useContext(AuthContext)
}
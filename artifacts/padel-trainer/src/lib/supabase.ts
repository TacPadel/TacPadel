import { createClient } from '@supabase/supabase-js'

// Füge hier direkt deine URL und deinen Key ein, als Text (in Anführungszeichen)
const supabaseUrl = "https://wxrprbcsssbxugixdujr.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4cnByYmNzc3NieHVnaXhkdWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzM3NjMsImV4cCI6MjA5ODg0OTc2M30.ek5q3XgjV0DOJPSC98iLpk3i4wbLMgCw2_mVKGa56Lk" // Dein langer Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
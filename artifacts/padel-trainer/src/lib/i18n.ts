import { useState, useEffect } from "react";

export type AppLanguage = "de" | "en" | "es";

// 1. Erkennt beim ersten Start automatisch die Handy-Sprache (oder liest die gespeicherte Wahl)
export const getAppLanguage = (): AppLanguage => {
  try {
    const saved = localStorage.getItem("tacpadel_lang");
    if (saved === "de" || saved === "en" || saved === "es") return saved;

    const browserLang = (navigator.language || "de").toLowerCase();
    if (browserLang.startsWith("es")) return "es";
    if (browserLang.startsWith("en")) return "en";
  } catch {}
  return "de";
};

// 2. Schaltet die Sprache live in der gesamten App um
export const setAppLanguage = (lang: AppLanguage) => {
  try {
    localStorage.setItem("tacpadel_lang", lang);
    window.dispatchEvent(new Event("tacpadel-lang-change"));
  } catch {}
};

// 3. Zentrales Wörterbuch (Deutsch, Englisch, Spanisch)
export const TRANSLATIONS = {
  de: {
    // Navigation & Header
    nav_home: "Home",
    nav_trainer: "Trainer",
    nav_game: "Game",
    nav_taktik: "Taktik",
    nav_basics: "Basics",
    header_logout: "Abmelden",
    header_login: "Login",
    guest_name: "Gast",
    btn_back: "← Zurück",

    // Welcome & Login (App.tsx)
    welcome_title: "Willkommen!",
    welcome_text: "Schön, dass du dabei bist. Bevor du den Court betrittst, wie lautet dein Spielername für die Statistiken?",
    welcome_placeholder: "Dein Padel-Spitzname...",
    welcome_saving: "Speichert...",
    welcome_btn: "Auf den Platz gehen ➔",

    login_title_signin: "Anmelden",
    login_title_signup: "Account erstellen",
    login_subtitle: "Sichere deinen Trainingsfortschritt in der Cloud.",
    login_email_placeholder: "E-Mail Adresse",
    login_password_placeholder: "Passwort (min. 6 Zeichen)",
    login_processing: "Wird verarbeitet...",
    login_btn_signin: "Einloggen",
    login_btn_signup: "Registrieren",
    login_or: "Oder",
    login_with_apple: "Mit Apple",
    login_with_google: "Mit Google",
    login_switch_to_signin: "Bereits einen Account? Hier einloggen.",
    login_switch_to_signup: "Neu hier? Account erstellen.",
    login_back_home: "← Zurück zur Startseite",
    login_err_credentials: "Falsche E-Mail oder Passwort.",
    login_success_signup: "Registrierung erfolgreich! (Prüfe ggf. deine E-Mails)",
  },

  en: {
    // Navigation & Header
    nav_home: "Home",
    nav_trainer: "Trainer",
    nav_game: "Game",
    nav_taktik: "Tactics",
    nav_basics: "Basics",
    header_logout: "Log out",
    header_login: "Login",
    guest_name: "Guest",
    btn_back: "← Back",

    // Welcome & Login (App.tsx)
    welcome_title: "Welcome!",
    welcome_text: "Great to have you here. Before stepping onto the court, what is your player name for the rankings?",
    welcome_placeholder: "Your Padel nickname...",
    welcome_saving: "Saving...",
    welcome_btn: "Step onto the Court ➔",

    login_title_signin: "Sign In",
    login_title_signup: "Create Account",
    login_subtitle: "Save your training progress & trophies in the cloud.",
    login_email_placeholder: "Email address",
    login_password_placeholder: "Password (min. 6 characters)",
    login_processing: "Processing...",
    login_btn_signin: "Sign In",
    login_btn_signup: "Sign Up",
    login_or: "Or",
    login_with_apple: "Continue with Apple",
    login_with_google: "Continue with Google",
    login_switch_to_signin: "Already have an account? Sign in here.",
    login_switch_to_signup: "New here? Create an account.",
    login_back_home: "← Back to Home",
    login_err_credentials: "Invalid email or password.",
    login_success_signup: "Registration successful! (Please check your email if required)",
  },

  es: {
    // Navigation & Header
    nav_home: "Inicio",
    nav_trainer: "Entreno",
    nav_game: "Partido",
    nav_taktik: "Táctica",
    nav_basics: "Guía",
    header_logout: "Salir",
    header_login: "Acceso",
    guest_name: "Invitado",
    btn_back: "← Volver",

    // Welcome & Login (App.tsx)
    welcome_title: "¡Bienvenido!",
    welcome_text: "Qué bueno tenerte aquí. Antes de entrar a la pista, ¿cuál es tu nombre de jugador para el ranking?",
    welcome_placeholder: "Tu apodo de pádel...",
    welcome_saving: "Guardando...",
    welcome_btn: "Entrar a la pista ➔",

    login_title_signin: "Iniciar Sesión",
    login_title_signup: "Crear Cuenta",
    login_subtitle: "Guarda tu progreso de entrenamiento y trofeos en la nube.",
    login_email_placeholder: "Correo electrónico",
    login_password_placeholder: "Contraseña (mín. 6 caracteres)",
    login_processing: "Procesando...",
    login_btn_signin: "Entrar",
    login_btn_signup: "Registrarse",
    login_or: "O",
    login_with_apple: "Continuar con Apple",
    login_with_google: "Continuar con Google",
    login_switch_to_signin: "¿Ya tienes cuenta? Inicia sesión aquí.",
    login_switch_to_signup: "¿Nuevo aquí? Crea una cuenta.",
    login_back_home: "← Volver al inicio",
    login_err_credentials: "Correo o contraseña incorrectos.",
    login_success_signup: "¡Registro exitoso! (Revisa tu correo si es necesario)",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.de;

// Hilfsfunktion für Dateien außerhalb von React-Komponenten (z.B. GameLogic.ts)
export const translate = (key: TranslationKey): string => {
  const lang = getAppLanguage();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.de[key] || key;
};

// React-Hook für alle Komponenten
export function useTranslation() {
  const [lang, setLangState] = useState<AppLanguage>(() => getAppLanguage());

  useEffect(() => {
    const handleLangChange = () => setLangState(getAppLanguage());
    window.addEventListener("tacpadel-lang-change", handleLangChange);
    return () => window.removeEventListener("tacpadel-lang-change", handleLangChange);
  }, []);

  const t = (key: TranslationKey): string => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.de[key] || key;
  };

  return { lang, setLang: setAppLanguage, t };
}

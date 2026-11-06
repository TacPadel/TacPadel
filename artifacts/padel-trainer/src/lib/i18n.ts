import { useState, useEffect } from "react";

export type AppLanguage = "de" | "en" | "es";

// Erkennt automatisch die Gerätesprache (sofern im Profil nichts manuell überschrieben wurde)
export const getAppLanguage = (): AppLanguage => {
  try {
    const saved = localStorage.getItem("tacpadel_lang");
    if (saved === "de" || saved === "en" || saved === "es") return saved;

    const candidates =
      typeof navigator !== "undefined"
        ? [...(navigator.languages || []), navigator.language || "de"]
        : ["de"];

    for (const raw of candidates) {
      const code = (raw || "").toLowerCase();
      if (code.startsWith("es")) return "es";
      if (code.startsWith("en")) return "en";
      if (code.startsWith("de")) return "de";
    }
  } catch {}
  return "en";
};

export const setAppLanguage = (lang: AppLanguage) => {
  try {
    localStorage.setItem("tacpadel_lang", lang);
    window.dispatchEvent(new Event("tacpadel-lang-change"));
  } catch {}
};

// Übersetzt die Anzeige von Schlag-Namen, ohne die internen Code-IDs zu verändern
export const formatShotName = (shot: string, lang: AppLanguage = getAppLanguage()): string => {
  const s = (shot || "").toUpperCase();
  if (lang === "en") {
    if (s === "AUFSCHLAG") return "SERVE";
  } else if (lang === "es") {
    if (s === "AUFSCHLAG") return "SAQUE";
    if (s === "VOLLEY") return "VOLEA";
    if (s === "LOB") return "GLOBO";
    if (s === "BLOCK") return "BLOQUEO";
    if (s === "DRIVE") return "DERECHA / DRIVE";
  }
  return shot;
};

// Übersetzt die Anzeige der Trainer-Level, ohne die internen Level-IDs zu verändern
export const formatLevelName = (lvl: string, lang: AppLanguage = getAppLanguage()): string => {
  if (lang === "en") {
    switch (lvl) {
      case "Schlag": return "Shot";
      case "Schlagrichtung": return "Target Zone";
      case "Laufrichtung": return "Court Position";
      case "Spielzug": return "Full Play";
      case "Simulation": return "Pro Rally";
    }
  } else if (lang === "es") {
    switch (lvl) {
      case "Schlag": return "Golpe";
      case "Schlagrichtung": return "Dirección";
      case "Laufrichtung": return "Posición";
      case "Spielzug": return "Jugada";
      case "Simulation": return "Rally Pro";
    }
  }
  return lvl;
};

// Taktik-Tipps des Tages für HomeView.tsx
export const TACTIC_TIPS_I18N: Record<AppLanguage, { highlight: string; text: string }[]> = {
  de: [
    {
      highlight: "Der Lob",
      text: "ist im Padel kein reiner Verteidigungsschlag, sondern dein wichtigster Angriffsschlag. Spiele ihn hoch und tief in die Ecken, um die Netzposition zu erobern!"
    },
    {
      highlight: "Die Bandeja",
      text: "ist kein harter Gewinnschlag! Nutze sie primär, um deine Netzposition zu verteidigen. Tiefe und Platzierung gehen hier immer vor Härte."
    },
    {
      highlight: "Das Gummiband-Prinzip:",
      text: "Bewege dich immer parallel zu deinem Partner. Rückt er ans Netz vor, gehst du mit. Bleibt einer hinten, entsteht eine tödliche Lücke in der Mitte."
    },
    {
      highlight: "Die Chiquita",
      text: "eignet sich perfekt, wenn die Gegner aufrücken. Spiele den Ball sanft auf ihre Füße, um sie zu einem schweren, tiefen Volley zu zwingen."
    },
    {
      highlight: "Durch die Mitte:",
      text: "Das ist oft der sicherste Weg. Tiefe Bälle durch die Mitte stiften Verwirrung (Wer nimmt den Ball?) und minimieren die Winkel für den gegnerischen Konter."
    }
  ],
  en: [
    {
      highlight: "The Lob",
      text: "is not just a defensive shot in Padel, but your most important offensive weapon. Play it high and deep into the corners to take over the net!"
    },
    {
      highlight: "The Bandeja",
      text: "is not a power winner! Use it primarily to defend your net position. Depth and placement always come before power."
    },
    {
      highlight: "The Rubber Band Principle:",
      text: "Always move in sync with your partner. If they move up to the net, go with them. If one stays back, a deadly gap opens in the middle."
    },
    {
      highlight: "The Chiquita",
      text: "is perfect when opponents rush the net. Play the ball softly at their feet to force a difficult, low volley upwards."
    },
    {
      highlight: "Down the Middle:",
      text: "Often the smartest play. Deep balls through the center cause confusion (who takes it?) and cut off angles for the opponent's counter-attack."
    }
  ],
  es: [
    {
      highlight: "El Globo",
      text: "no es solo un golpe defensivo en el pádel, sino tu arma ofensiva más importante. ¡Juégalo alto y profundo hacia las esquinas para ganar la red!"
    },
    {
      highlight: "La Bandeja",
      text: "¡no es un remate de potencia! Úsala principalmente para conservar la red. La profundidad y la colocación siempre importan más que la fuerza."
    },
    {
      highlight: "El Principio del Elástico:",
      text: "Muévete siempre en bloque con tu compañero. Si sube a la red, acompáñalo. Si uno se queda atrás, se abre un hueco letal en el medio."
    },
    {
      highlight: "La Chiquita",
      text: "es perfecta cuando los rivales están pegados a la red. Juega suave a sus pies para obligarles a levantar una volea baja y difícil."
    },
    {
      highlight: "Por el Medio:",
      text: "Suele ser la opción más segura. Las bolas profundas al centro generan dudas en la pareja rival y reducen los ángulos de contraataque."
    }
  ]
};

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
    player_fallback: "Spieler",
    btn_back: "← Zurück",

    // HomeView
    home_welcome: "Willkommen,",
    home_hero_sub: "Analysiere Spielsituationen und meistere das TacPadel Game.",
    home_rank: "Rang:",
    home_tip_title: "Taktik Tipp des Tages",
    home_daily_badge: "🔥 Challenge des Tages",
    home_day: "Tag",
    home_days: "Tage",
    home_streak: "Serie",
    home_daily_open_title: "1 Versuch • +150 Punkte",
    home_daily_won_title: "Heute gemeistert! ✓",
    home_daily_lost_title: "Heute bereits gespielt",
    home_daily_open_desc: "Löse das heutige Profi-Szenario ohne Hilfestellung.",
    home_daily_closed_desc: "Tippe hier, um dir die heutige Auflösung nochmal anzusehen.",
    home_training_header: "Training",
    home_newbie_badge: "Dein Weg zum Profi",
    home_continue_badge: "Letzter Stand",
    home_newbie_title: "Blitzstart",
    home_continue_title: "Fortsetzen",
    home_newbie_desc: "Starte hier dein erstes Training, um ein echter TacPadeler zu werden.",
    home_continue_desc: "Mach genau da weiter, wo du beim letzten Mal aufgehört hast.",
    home_you_tag: "Du",
    home_waiting_data: "Warte auf Daten...",
    home_card_match_title: "Match Starten",
    home_card_match_sub: "Einzelmatch",
    home_card_lexicon_title: "Padel-Lexikon",
    home_card_lexicon_sub: "Theorie & Wissen",
    home_card_board_title: "Taktik-Board",
    home_card_board_sub: "Taktik Planen",

    // Welcome Modal
    welcome_title: "Willkommen!",
    welcome_text: "Schön, dass du dabei bist. Bevor du den Court betrittst, wie lautet dein Spielername für die Statistiken?",
    welcome_placeholder: "Dein Padel-Spitzname...",
    welcome_saving: "Speichert...",
    welcome_btn: "Auf den Platz gehen ➔",

    // Trainer Tutorial Modal
    tut_title: "Taktik-Trainer",
    tut_subtitle: "So funktioniert's",
    tut_step1_title: "Situation analysieren",
    tut_step1_desc: "Lies das Briefing und schau dir die Positionen der Spieler auf dem 3D-Court an. Der leuchtende Ball zeigt, woher der Schlag kommt.",
    tut_step2_title: "Aktionen wählen",
    tut_step2_desc: "Je nach Level musst du 1 bis 3 Entscheidungen treffen:",
    tut_step2_b1: "• SCHLAG: Welchen Schlag spielst du? (Unten tippen)",
    tut_step2_b2: "• ZIELZONE: Wohin spielst du? (Auf dem Court tippen)",
    tut_step2_b3: "• LAUFWEG: Wohin läufst du danach? (Auf dem Court tippen)",
    tut_step3_title: "Zug ausführen",
    tut_step3_desc: "Sobald du alles ausgewählt hast, wird der „Zug Ausführen“-Button aktiv. Finde heraus, ob deine Taktik aufgeht!",
    tut_btn_start: "Alles klar, los geht's!",

    // Unlock Modal (Score < 2500)
    unlock_title: "Punkte zu niedrig!",
    unlock_desc: "Dein Score ist unter 2500 Punkte gefallen. Wähle eine gesperrte Trainingsart, um sie wieder freizuschalten und neue Punkte zu sammeln:",
    unlock_btn: "Freischalten ➔",

    // Trainer Tab
    trainer_title: "Taktik-Trainer",
    trainer_tutorial_tooltip: "Tutorial anzeigen",
    trainer_total_score: "Total Score",
    trainer_pro_rallye: "Pro Rallye",
    trainer_strategies: "Strategien",
    trainer_hint_sim: "PRO RALLYE: Endlose Taktik-Simulation. Finde auf jede Situation die perfekte Antwort!",
    trainer_hint_spielzug: "Achte auf die Gegner-Position. Wähle nach dem Schlag sofort deinen Laufweg zur Absicherung.",
    trainer_hint_lauf: "Ein guter Schlag nützt nichts ohne Feldabdeckung. Wähle dein Laufziel.",
    trainer_hint_schlag: "Wähle den richtigen Schlag. Nutze das Tutorial, um die Schläge kennenzulernen.",
    trainer_hint_default: "Analysiere das Szenario und spiele den richtigen Schlag und die Trefferzone.",
    trainer_easy_info: "Erweiterte Zonen - 50% Punkte",
    trainer_corr_info: "Korrekturen bei falscher Auswahl - 75% Punkte",
    trainer_scenario_label: "Szenario",
    trainer_briefing: "Briefing",
    trainer_progress_sim: "Rallye Score (Endlos)",
    trainer_progress_lvl: "Level Fortschritt",
    trainer_step1_run: "1. Laufzone",
    trainer_step2_target: "2. Schlagziel",
    trainer_step3_shot: "3. Schlag (Tippen)",
    trainer_choose: "Wählen...",
    trainer_submit: "Zug Ausführen",
    trainer_shot_modal_q1: "Welcher Schlag passt hier?",
    trainer_shot_modal_q2: "Welchen Schlag wählst du?",
    trainer_err_shot: "den Schlag",
    trainer_err_target: "die Zielzone",
    trainer_err_run: "deine Laufrichtung",
    trainer_err_and: " und ",
    trainer_feedback_prefix: "Fast! Überprüfe nochmal ",
    trainer_res_perfect_play: "★★★ Perfekter Spielzug",
    trainer_res_success: "Mission Erfolgreich",
    trainer_res_partial: "Teilweise Richtig",
    trainer_res_wrong: "Taktischer Fehler",
    trainer_badge_shot: "Schlag:",
    trainer_badge_target: "Ziel:",
    trainer_badge_run: "Lauf:",
    trainer_next_task: "Nächste Aufgabe ➔",
    trainer_mastered_title: "System Mastered",
    trainer_mastered_desc_1: "Du hast das Level",
    trainer_mastered_desc_2: "erfolgreich abgeschlossen.",
    trainer_start_pro_rallye: "Pro Rallye Starten ➔",
    trainer_start_next_lvl: "Nächstes Level Starten ➔",

    // Login Tab
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
    login_err_google: "Google-Login fehlgeschlagen: ",
    login_err_apple: "Apple-Login fehlgeschlagen: ",

    // Tactics Board Header (App.tsx)
    board_header_title: "Taktik-Board",
    board_header_desc: "Bewege Spieler und Ball frei auf dem Spielfeld, um Taktiken zu planen und zu erklären.",
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
    player_fallback: "Player",
    btn_back: "← Back",

    // HomeView
    home_welcome: "Welcome,",
    home_hero_sub: "Analyze match situations and master the TacPadel game.",
    home_rank: "Rank:",
    home_tip_title: "Tactical Tip of the Day",
    home_daily_badge: "🔥 Daily Challenge",
    home_day: "Day",
    home_days: "Days",
    home_streak: "Streak",
    home_daily_open_title: "1 Attempt • +150 Points",
    home_daily_won_title: "Mastered today! ✓",
    home_daily_lost_title: "Already played today",
    home_daily_open_desc: "Solve today's pro scenario without hints.",
    home_daily_closed_desc: "Tap here to review today's solution.",
    home_training_header: "Training",
    home_newbie_badge: "Your Path to Pro",
    home_continue_badge: "Last Progress",
    home_newbie_title: "Quick Start",
    home_continue_title: "Continue",
    home_newbie_desc: "Start your first training session here to become a true TacPadel pro.",
    home_continue_desc: "Pick up right where you left off last time.",
    home_you_tag: "You",
    home_waiting_data: "Waiting for data...",
    home_card_match_title: "Start Match",
    home_card_match_sub: "Single Match",
    home_card_lexicon_title: "Padel Lexicon",
    home_card_lexicon_sub: "Theory & Knowledge",
    home_card_board_title: "Tactics Board",
    home_card_board_sub: "Plan Tactics",

    // Welcome Modal
    welcome_title: "Welcome!",
    welcome_text: "Great to have you here. Before stepping onto the court, what is your player name for the rankings?",
    welcome_placeholder: "Your Padel nickname...",
    welcome_saving: "Saving...",
    welcome_btn: "Step onto the Court ➔",

    // Trainer Tutorial Modal
    tut_title: "Tactical Trainer",
    tut_subtitle: "How it works",
    tut_step1_title: "Analyze the situation",
    tut_step1_desc: "Read the briefing and check the player positions on the 3D court. The glowing ball shows where the shot originates.",
    tut_step2_title: "Choose your actions",
    tut_step2_desc: "Depending on the level, you make 1 to 3 tactical decisions:",
    tut_step2_b1: "• SHOT: Which shot do you play? (Tap below)",
    tut_step2_b2: "• TARGET ZONE: Where do you aim? (Tap on the court)",
    tut_step2_b3: "• COURT POSITION: Where do you recover to? (Tap on the court)",
    tut_step3_title: "Execute play",
    tut_step3_desc: "Once selected, the 'Execute Play' button activates. See if your tactics work out!",
    tut_btn_start: "Got it, let's go!",

    // Unlock Modal
    unlock_title: "Score too low!",
    unlock_desc: "Your score dropped below 2500 points. Select a locked training mode to unlock it and earn new points:",
    unlock_btn: "Unlock ➔",

    // Trainer Tab
    trainer_title: "Tactical Trainer",
    trainer_tutorial_tooltip: "Show tutorial",
    trainer_total_score: "Total Score",
    trainer_pro_rallye: "Pro Rally",
    trainer_strategies: "Strategies",
    trainer_hint_sim: "PRO RALLY: Endless tactical simulation. Find the perfect answer to every court situation!",
    trainer_hint_spielzug: "Watch the opponents' position. Immediately select your recovery run after hitting the ball.",
    trainer_hint_lauf: "A good shot is useless without court coverage. Choose your recovery zone.",
    trainer_hint_schlag: "Choose the right shot. Use the tutorial to learn when to use each shot.",
    trainer_hint_default: "Analyze the scenario and select the right shot and target zone.",
    trainer_easy_info: "Expanded zones - 50% points",
    trainer_corr_info: "Hints on wrong selection - 75% points",
    trainer_scenario_label: "Scenario",
    trainer_briefing: "Briefing",
    trainer_progress_sim: "Rally Score (Endless)",
    trainer_progress_lvl: "Level Progress",
    trainer_step1_run: "1. Run Zone",
    trainer_step2_target: "2. Target Zone",
    trainer_step3_shot: "3. Shot (Tap)",
    trainer_choose: "Select...",
    trainer_submit: "Execute Play",
    trainer_shot_modal_q1: "Which shot fits best here?",
    trainer_shot_modal_q2: "Which shot do you choose?",
    trainer_err_shot: "your shot",
    trainer_err_target: "the target zone",
    trainer_err_run: "your court position",
    trainer_err_and: " and ",
    trainer_feedback_prefix: "Close! Double-check ",
    trainer_res_perfect_play: "★★★ Perfect Play",
    trainer_res_success: "Mission Accomplished",
    trainer_res_partial: "Partially Correct",
    trainer_res_wrong: "Tactical Error",
    trainer_badge_shot: "Shot:",
    trainer_badge_target: "Target:",
    trainer_badge_run: "Run:",
    trainer_next_task: "Next Challenge ➔",
    trainer_mastered_title: "System Mastered",
    trainer_mastered_desc_1: "You have successfully completed the level",
    trainer_mastered_desc_2: ".",
    trainer_start_pro_rallye: "Start Pro Rally ➔",
    trainer_start_next_lvl: "Start Next Level ➔",

    // Login Tab
    login_title_signin: "Sign In",
    login_title_signup: "Create Account",
    login_subtitle: "Save your training progress in the cloud.",
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
    login_err_google: "Google sign-in failed: ",
    login_err_apple: "Apple sign-in failed: ",

    // Tactics Board Header
    board_header_title: "Tactics Board",
    board_header_desc: "Freely move players and the ball on the court to plan and explain padel tactics.",
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
    player_fallback: "Jugador",
    btn_back: "← Volver",

    // HomeView
    home_welcome: "Bienvenido,",
    home_hero_sub: "Analiza situaciones de juego y domina TacPadel.",
    home_rank: "Rango:",
    home_tip_title: "Consejo Táctico del Día",
    home_daily_badge: "🔥 Reto del Día",
    home_day: "Día",
    home_days: "Días",
    home_streak: "Racha",
    home_daily_open_title: "1 Intento • +150 Puntos",
    home_daily_won_title: "¡Superado hoy! ✓",
    home_daily_lost_title: "Ya jugado hoy",
    home_daily_open_desc: "Resuelve el escenario pro de hoy sin ayuda.",
    home_daily_closed_desc: "Toca aquí para revisar la solución de hoy.",
    home_training_header: "Entrenamiento",
    home_newbie_badge: "Tu Camino a Pro",
    home_continue_badge: "Último Progreso",
    home_newbie_title: "Inicio Rápido",
    home_continue_title: "Continuar",
    home_newbie_desc: "Empieza aquí tu primer entrenamiento para dominar la pista.",
    home_continue_desc: "Continúa exactamente donde lo dejaste la última vez.",
    home_you_tag: "Tú",
    home_waiting_data: "Esperando datos...",
    home_card_match_title: "Iniciar Partido",
    home_card_match_sub: "Partido Individual",
    home_card_lexicon_title: "Léxico de Pádel",
    home_card_lexicon_sub: "Teoría y Conocimiento",
    home_card_board_title: "Pizarra Táctica",
    home_card_board_sub: "Planificar Táctica",

    // Welcome Modal
    welcome_title: "¡Bienvenido!",
    welcome_text: "Qué bueno tenerte aquí. Antes de saltar a la pista, ¿cuál es tu nombre de jugador para las estadísticas?",
    welcome_placeholder: "Tu apodo de pádel...",
    welcome_saving: "Guardando...",
    welcome_btn: "Saltar a la pista ➔",

    // Trainer Tutorial Modal
    tut_title: "Entrenador Táctico",
    tut_subtitle: "Cómo funciona",
    tut_step1_title: "Analiza la situación",
    tut_step1_desc: "Lee el informe y observa las posiciones en la pista 3D. La bola brillante indica desde dónde viene el golpe.",
    tut_step2_title: "Elige tus acciones",
    tut_step2_desc: "Según el nivel, debes tomar de 1 a 3 decisiones:",
    tut_step2_b1: "• GOLPE: ¿Qué golpe eliges? (Toca abajo)",
    tut_step2_b2: "• ZONA OBJETIVO: ¿Hacia dónde juegas? (Toca en la pista)",
    tut_step2_b3: "• DESPLAZAMIENTO: ¿Adónde te mueves después? (Toca en la pista)",
    tut_step3_title: "Ejecutar jugada",
    tut_step3_desc: "Cuando hayas elegido todo, se activará el botón 'Ejecutar Jugada'. ¡Descubre si tu táctica funciona!",
    tut_btn_start: "¡Entendido, vamos!",

    // Unlock Modal
    unlock_title: "¡Puntuación baja!",
    unlock_desc: "Tu puntuación ha bajado de 2500 puntos. Elige un modo bloqueado para desbloquearlo y sumar nuevos puntos:",
    unlock_btn: "Desbloquear ➔",

    // Trainer Tab
    trainer_title: "Entrenador Táctico",
    trainer_tutorial_tooltip: "Ver tutorial",
    trainer_total_score: "Puntuación Total",
    trainer_pro_rallye: "Rally Pro",
    trainer_strategies: "Estrategias",
    trainer_hint_sim: "RALLY PRO: Simulación táctica sin fin. ¡Encuentra la respuesta perfecta para cada situación!",
    trainer_hint_spielzug: "Observa la posición rival. Elige inmediatamente tu desplazamiento tras golpear para cubrir huecos.",
    trainer_hint_lauf: "Un buen golpe no sirve sin cubrir la pista. Elige tu zona de desplazamiento.",
    trainer_hint_schlag: "Elige el golpe adecuado. Usa el tutorial para conocer cada golpe.",
    trainer_hint_default: "Analiza el escenario y elige el golpe y la zona de impacto correctos.",
    trainer_easy_info: "Zonas ampliadas - 50% puntos",
    trainer_corr_info: "Corrección al fallar - 75% puntos",
    trainer_scenario_label: "Escenario",
    trainer_briefing: "Informe",
    trainer_progress_sim: "Puntos Rally (Sin fin)",
    trainer_progress_lvl: "Progreso del Nivel",
    trainer_step1_run: "1. Posición",
    trainer_step2_target: "2. Objetivo",
    trainer_step3_shot: "3. Golpe (Tocar)",
    trainer_choose: "Elegir...",
    trainer_submit: "Ejecutar Jugada",
    trainer_shot_modal_q1: "¿Qué golpe encaja aquí?",
    trainer_shot_modal_q2: "¿Qué golpe eliges?",
    trainer_err_shot: "el golpe",
    trainer_err_target: "la zona objetivo",
    trainer_err_run: "tu desplazamiento",
    trainer_err_and: " y ",
    trainer_feedback_prefix: "¡Casi! Revisa de nuevo ",
    trainer_res_perfect_play: "★★★ Jugada Perfecta",
    trainer_res_success: "Misión Cumplida",
    trainer_res_partial: "Parcialmente Correcto",
    trainer_res_wrong: "Error Táctico",
    trainer_badge_shot: "Golpe:",
    trainer_badge_target: "Objetivo:",
    trainer_badge_run: "Posición:",
    trainer_next_task: "Siguiente Ejercicio ➔",
    trainer_mastered_title: "Nivel Superado",
    trainer_mastered_desc_1: "Has completado con éxito el nivel",
    trainer_mastered_desc_2: ".",
    trainer_start_pro_rallye: "Iniciar Rally Pro ➔",
    trainer_start_next_lvl: "Siguiente Nivel ➔",

    // Login Tab
    login_title_signin: "Iniciar Sesión",
    login_title_signup: "Crear Cuenta",
    login_subtitle: "Guarda tu progreso de entrenamiento en la nube.",
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
    login_err_google: "Error al iniciar con Google: ",
    login_err_apple: "Error al iniciar con Apple: ",

    // Tactics Board Header
    board_header_title: "Pizarra Táctica",
    board_header_desc: "Mueve libremente a los jugadores y la bola en la pista para planificar y explicar tácticas.",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.de;

export const translate = (key: TranslationKey): string => {
  const lang = getAppLanguage();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.de[key] || key;
};

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

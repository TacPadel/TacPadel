import { useState, useEffect } from "react";

export default function SplashScreen() {
  // 1. Initial State: Prüfen, ob wir den Splash in dieser "Sitzung" schon gesehen haben
  const [isVisible, setIsVisible] = useState(() => {
    const hasSeenSplash = sessionStorage.getItem("tacpadel_splash_seen");
    return !hasSeenSplash; // Wird nur true (sichtbar), wenn der Key NICHT existiert
  });

  useEffect(() => {
    // Wenn er sowieso nicht sichtbar ist, brauchen wir gar keinen Timer starten
    if (!isVisible) return;

    // Nach 2,0 Sekunden wird isVisible auf false gesetzt
    const timer = setTimeout(() => {
      setIsVisible(false);
      // 2. Jetzt im Session-Speicher vermerken, dass der Splashscreen durchgelaufen ist
      sessionStorage.setItem("tacpadel_splash_seen", "true");
    }, 2000);

    // Aufräumen
    return () => clearTimeout(timer);
  }, [isVisible]);

  // Wenn die Zeit abgelaufen ist (oder er von vornherein versteckt war), geben wir null zurück
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-900 z-50">
      <img 
        src="/background_app.png" 
        alt="TacPadel" 
        className="w-9000 h-480 object-contain animate-pulse" 
      />
      <p className="text-white mt-4 tracking-widest text-sm animate-bounce">
        Lade Court...
      </p>
    </div>
  );
}
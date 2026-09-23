import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BasicsViewProps {
  setActiveTab?: (tab: "home" | "trainer" | "board" | "basics") => void;
}

// Deine bereitgestellten Daten
export const PADEL_DICTIONARY: Record<string, Record<string, string>> = {
  "Schläge": {
    "Aufschlag": "Der Aufschlag wird im Padel unterhalb der Hüfte (aus dem Sprung nach einem Bodenaufprall) ausgeführt und muss diagonal in das gegenüberliegende Aufschlagfeld gespielt werden. Berührt der Ball danach das Gitter, ist es ein Aufschlagfehler; berührt er die Glaswand, ist er gültig.",
    "Lob": "Der wichtigste Defensivschlag im Padel. Ein hoher, tiefer Ball an die gegnerische Grundlinie. Ziel ist es, die Gegner von der Netzposition nach hinten zu zwingen, um selbst das Netz zu erobern.",
    "Volley": "Ein Schlag direkt aus der Luft, ohne vorherigen Bodenaufprall, meistens eng am Netz gespielt. Volleys werden idealerweise mit viel Slice (Rückwärtsdrall) tief in die Ecken platziert.",
    "Bandeja": "Ein defensiver/kontrollierter Überkopfschlag, der meistens im Mittelfeld angewendet wird. Getroffen wird der Ball seitlich auf Kopfhöhe mit Slice, um den Ball flach zu halten und die Netzposition zu verteidigen.",
    "Víbora": "Ein aggressiverer Überkopfschlag mit viel Seitwärtsdrall (Schnitt). Der Ball prallt unberechenbar und extrem flach von den gegnerischen Wänden ab.",
    "Smash": "Ein klassischer Überkopf-Power-Schlag. Wird genutzt, um den Ball so hart zu treffen, dass er nach der gegnerischen Wand über die 3- oder 4-Meter-Außenwand springt (Por Tres / Por Cuatro) oder unerreichbar zurück ins eigene Feld fliegt.",
    "Bajada de Pared": "Ein Überkopfschlag aus dem Hinterfeld, nachdem der Ball hoch von der eigenen Rückwand abgesprungen ist. Man \"schlägt den Ball von der Wand nach unten\", oft sehr kraftvoll und offensiv.",
    "Chiquita": "Ein kurzer, weicher Ball aus der Defensive genau vor die Füße der am Netz stehenden Gegner. Zwingt den Gegner zu einem unangenehmen Volley von weit unten und öffnet Chancen zum Konter.",
    "Block": "Ein rein passiver Schlag am Netz. Man hält den Schläger wie eine Wand hin, um extrem harte, gerade Passierbälle des Gegners abzufangen und kurz hinter dem Netz abtropfen zu lassen.",
    "Drive": "Der Drive ist ein kraftvoller, flacher Grundschlag im Padel, der sowohl mit der Vorhand als auch mit der Rückhand gespielt werden kann. Er dient dazu, einen Ballwechsel zu eröffnen oder den Gegner aggressiv unter Druck zu setzen.",
  },
  "Positionen": {
    "Netzposition (Angriff)": "Die dominierende Position im Padel. Beide Spieler stehen ca. 2–3 Meter vor dem Netz. Von hier aus wird der Druck per Volley und Überkopfschlägen aufgebaut. Punkte werden fast nur hier gewonnen.",
    "Grundlinie (Verteidigung)": "Die Ausgangsposition bei gegnerischem Aufschlag oder Druck. Spieler stehen leicht hinter der Aufschlaglinie. Fokus liegt auf dem Nutzen der Glaswände und dem Spielen von Lobs.",
    "Die Übergangszone (Niemandsland)": "Der Bereich zwischen Aufschlaglinie und Netz. Hier sollte man sich niemals freiwillig aufhalten, da man leicht vor die Füße angespielt werden kann. Diese Zone wird nur schnell durchschritten.",
    "Die T-Linie": "Der Kreuzungspunkt der Aufschlaglinien in der Mitte des Feldes. Ein wichtiger Orientierungspunkt für das Stellungsspiel bei kurzen Bällen.",
  },
  "Regeln": {
    "Zählweise": "Exakt wie im Tennis: 15, 30, 40, Spiel. Bei Einstand (40:40) wird entweder traditionell über Vorteil gespielt oder mit der \"Golden Point\"-Regel (der nächste Punkt entscheidet das Spiel). Ein Satz geht bis 6, ein Match über 2 Gewinnsätze.",
    "Wand & Gitter": "Der Ball muss immer zuerst auf dem Boden aufkommen, bevor er die Glaswand oder das Metallgitter berührt. Berührt er die Wand/das Gitter direkt fliegend, ist er im Aus. Nach dem Bodenaufprall darf er beliebig oft an die Wände ditschen.",
    "Eigenes Glas nutzen": "In der Defensive darf man den Ball mit voller Kraft gegen die eigene Glasscheibe schlagen, damit er über das Netz ins gegnerische Feld fliegt. Das Nutzen des eigenen Metallgitters ist hingegen verboten.",
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Schläge": "bg-blue-500/10 border-blue-500/30 text-blue-400",
  "Positionen": "bg-amber-500/10 border-amber-500/30 text-amber-400",
  "Regeln": "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

// Hilfs-Mapping für den leuchtenden Seitenstreifen
const STRIPE_COLORS: Record<string, string> = {
  "Schläge": "bg-blue-500",
  "Positionen": "bg-amber-500",
  "Regeln": "bg-purple-500",
};

interface LexikonItem {
  id: string;
  title: string;
  category: string;
  badgeColor: string;
  stripeColor: string;
  description: string;
}

export default function BasicsView({ setActiveTab }: BasicsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Alle");
  // --- NEUER STATE für die Anzeige des Disclaimers ---
  const [showLegal, setShowLegal] = useState<boolean>(false);

  // Dynamische Kategorien aus dem Dictionary ziehen
  const categories = ["Alle", ...Object.keys(PADEL_DICTIONARY)];

  // Objekt flach machen für die Suche und Darstellung
  const flattenedItems: LexikonItem[] = useMemo(() => {
    const items: LexikonItem[] = [];
    Object.entries(PADEL_DICTIONARY).forEach(([catName, terms]) => {
      Object.entries(terms).forEach(([title, description]) => {
        items.push({
          id: title.toLowerCase().replace(/\s+/g, '-'),
          title,
          category: catName,
          badgeColor: CATEGORY_COLORS[catName] || "bg-slate-500/10 border-slate-500/30 text-slate-400",
          stripeColor: STRIPE_COLORS[catName] || "bg-slate-500",
          description
        });
      });
    });
    return items;
  }, []);

  // Filter-Logik
  const filteredItems = flattenedItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Alle" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <AnimatePresence mode="wait">
      {showLegal ? (
        // ========================================================
        // ANSICHT: RECHTLICHES & IMPRESSUM
        // ========================================================
        <motion.div
          key="legal-view"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full flex flex-col gap-4 text-slate-200 font-sans pb-24"
        >
          <div className="bg-[#030611]/80 border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-lg max-w-4xl mx-auto w-full mt-2">
            
            <button
              onClick={() => setShowLegal(false)}
              className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
            >
              ← Zurück zum Lexikon
            </button>
            
            <h2 className="text-xl font-bold text-cyan-400 mb-4">Haftungsausschluss (Disclaimer)</h2>
            
            <div className="text-sm text-slate-400 space-y-4 leading-relaxed">
              <p><strong className="text-slate-200">1. Gesundheitsrisiko & Verletzungsgefahr</strong><br/>
              Padel-Tennis ist ein körperlich anspruchsvoller und dynamischer Sport. Die Nutzung der TacPadel App und die Ausführung der darin beschriebenen Schläge, Laufwege und Taktiken erfolgen ausdrücklich auf eigene Gefahr. Wir übernehmen keine Haftung für Verletzungen, körperliche Beschwerden oder Sachschäden, die durch das Nachspielen der Trainingsszenarien entstehen. Bitte wärme dich vor jedem Spiel ausreichend auf und passe die Intensität deinem persönlichen Fitnesslevel an.</p>
              
              <p><strong className="text-slate-200">2. Keine professionelle Beratung</strong><br/>
              Die Inhalte, Tipps und Taktiken in dieser App dienen ausschließlich zu Informations- und Trainingszwecken. Sie ersetzen kein professionelles Training bei einem zertifizierten Padel-Coach oder medizinischen Rat bei Verletzungen.</p>
              
              <p><strong className="text-slate-200">3. Haftung für Inhalte</strong><br/>
              Die in dieser App dargestellten Taktiken und Szenarien wurden mit größter Sorgfalt erstellt. Dennoch übernehmen wir keine Gewähr für die Richtigkeit, Vollständigkeit oder garantierte Erfolge der Inhalte auf dem Platz.</p>
              
              <h2 className="text-xl font-bold text-cyan-400 mb-4 mt-8">Datenschutzhinweise</h2>            
              
              <p>Wir nehmen den Schutz deiner Daten ernst. Für die Nutzung der App und die Speicherung deines TacScores wird ein Account erstellt. Dabei werden grundlegende Daten (wie z.B. deine E-Mail-Adresse, dein gewählter Benutzername und deine erspielten Match-Ergebnisse) auf sicheren Servern unseres Datenbank-Dienstleisters (Supabase) gespeichert, damit du von verschiedenen Geräten auf deinen Spielstand zugreifen kannst.</p>
              
              <p>Passwörter werden verschlüsselt verarbeitet. Wir geben deine Daten nicht zu Werbezwecken an Dritte weiter. Du kannst jederzeit die Löschung deines Accounts und aller damit verbundenen Daten anfragen.</p>
              
              <div className="w-full h-px bg-slate-800 my-6" />
              
              <h2 className="text-xl font-bold text-cyan-400 mb-4">Impressum</h2>
              <p>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)<br/><br/>
              <strong className="text-slate-200">Betreiber der App:</strong><br/>
              TacPadel<br/>
              [Boris] [Sredojevic]<br/>
              [Brunnenstr. 26]<br/>
              [47623] [Kevelaer]<br/>
              <br/>
              <strong className="text-slate-200">Kontakt:</strong><br/>
              Telefon: [Deine Telefonnummer, z.B. +49 123 456789]<br/>
              E-Mail: [admin@tacpadel.de]<br/>
              <br/>
              <strong className="text-slate-200">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:</strong><br/>
              [Boris] [Sredojevic]<br/>
              [Brunnenstr. 26]<br/>
              [47623] [Kevelaer]<br/>
              <br/>
              <strong className="text-slate-200">EU-Streitschlichtung:</strong><br/>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/.
              Unsere E-Mail-Adresse finden Sie oben im Impressum.<br/>
              <br/>
              <strong className="text-slate-200">Verbraucherstreitbeilegung/Universalschlichtungsstelle:</strong><br/>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
            </div>
          </div>
        </motion.div>
      ) : (
        // ========================================================
        // ANSICHT: NORMALES LEXIKON
        // ========================================================
        <motion.div
          key="lexikon-view"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full flex flex-col gap-6 text-slate-200 font-sans pb-24"
        >
          {/* 1. HERO SECTION */}
          <div className="w-full bg-[#040914]/90 border border-emerald-900/50 backdrop-blur-xl p-6 lg:p-8 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-transparent" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black tracking-[0.3em] text-emerald-500 uppercase">Theorie & Wissen</span>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">
                  Padel-<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Lexikon</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Schlage alle Fachbegriffe, Schläge und Taktiken nach.</p>
              </div>

              {/* Suchleiste */}
              <div className="w-full md:w-72 bg-[#030611] border border-slate-800 p-3 rounded-xl shadow-inner flex items-center gap-3 transition-colors focus-within:border-emerald-500/50">
                <span className="text-slate-500 pl-1 text-sm">🔍</span>
                <input 
                  type="text" 
                  placeholder="Begriffe suchen..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-600 w-full pr-2 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. KATEGORIE-FILTER */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                  selectedCategory === cat 
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]" 
                    : "bg-[#050b18]/80 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 3. LEXIKON GRID (Karten) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.01 }}
                className="bg-[#050b18]/90 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-start gap-4 relative overflow-hidden group hover:border-slate-600 transition-all"
              >
                {/* Dynamischer, leuchtender Rand-Effekt (links) passend zur Kategorie */}
                <div className={`absolute top-0 left-0 w-1 h-full opacity-60 group-hover:opacity-100 transition-opacity ${item.stripeColor}`} />

                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-base font-black text-white uppercase tracking-wider leading-tight">{item.title}</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border whitespace-nowrap ${item.badgeColor}`}>
                    {item.category}
                  </span>
                </div>

                <div className="bg-[#030611]/60 border border-slate-800/80 p-4 rounded-xl flex-1 mt-auto shadow-inner">
                  <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-16 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🔎</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Keine passenden Begriffe gefunden.</p>
              </div>
            )}
          </div>

          {/* 4. RECHTLICHES LINK (Ganz unten) */}
          <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-center w-full">
            <button
              onClick={() => setShowLegal(true)}
              className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest font-black"
            >
              Rechtliche Hinweise & Disclaimer
            </button>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
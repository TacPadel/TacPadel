import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, AppLanguage, TranslationKey } from "../lib/i18n";

interface BasicsViewProps {
  setActiveTab?: (tab: "home" | "trainer" | "board" | "basics") => void;
}

type CategoryKey =
  | "shots"
  | "positions"
  | "rules"
  | "tactics"
  | "tacscore"
  | "tour"
  | "stamina"
  | "ai";

const CATEGORY_LABEL_KEYS: Record<CategoryKey, TranslationKey> = {
  shots: "basics_cat_shots",
  positions: "basics_cat_positions",
  rules: "basics_cat_rules",
  tactics: "basics_cat_tactics",
  tacscore: "basics_cat_tacscore",
  tour: "basics_cat_tour",
  stamina: "basics_cat_stamina",
  ai: "basics_cat_ai",
};

const CATEGORY_STYLE_BY_KEY: Record<CategoryKey, { badge: string; stripe: string }> = {
  shots: { badge: "bg-blue-500/10 border-blue-500/30 text-blue-400", stripe: "bg-blue-500" },
  positions: { badge: "bg-amber-500/10 border-amber-500/30 text-amber-400", stripe: "bg-amber-500" },
  rules: { badge: "bg-purple-500/10 border-purple-500/30 text-purple-400", stripe: "bg-purple-500" },
  tactics: { badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", stripe: "bg-yellow-500" },
  tacscore: { badge: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400", stripe: "bg-indigo-500" },
  tour: { badge: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400", stripe: "bg-fuchsia-500" },
  stamina: { badge: "bg-rose-500/10 border-rose-500/30 text-rose-400", stripe: "bg-rose-500" },
  ai: { badge: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400", stripe: "bg-cyan-500" },
};

// Mehrsprachiges Padel-Lexikon (DE / EN / ES)
export const PADEL_DICTIONARY_I18N: Record<AppLanguage, Record<CategoryKey, Record<string, string>>> = {
  de: {
    shots: {
      "Aufschlag": "Der Aufschlag wird im Padel nach einem Bodenaufprall unterhalb der Hüfte ausgeführt. Er muss diagonal in das gegenüberliegende Aufschlagfeld gespielt werden. Berührt der Ball danach das Gitter, ist es ein Fehler; berührt er die Glaswand, ist er gültig.",
      "Return": "Der Rückschlag auf den Aufschlag des Gegners. Die oberste Regel beim Return lautet: Den Ball sicher im Spiel halten. Oft wird ein tiefer Ball (Chiquita) oder ein Lob gespielt, um ans Netz zu kommen.",
      "Lob": "Der wichtigste Defensivschlag im Padel. Ein hoher, tiefer Ball an die gegnerische Grundlinie. Ziel ist es, die Gegner von der Netzposition nach hinten zu zwingen, um selbst das Netz zu erobern.",
      "Volley": "Ein Schlag direkt aus der Luft, ohne vorherigen Bodenaufprall, meistens eng am Netz gespielt. Volleys werden idealerweise mit viel Slice (Rückwärtsdrall) tief in die Ecken platziert.",
      "Bandeja": "Ein defensiver/kontrollierter Überkopfschlag, der meistens im Mittelfeld angewendet wird. Getroffen wird der Ball seitlich auf Kopfhöhe mit Slice, um den Ball flach zu halten und die Netzposition zu verteidigen.",
      "Víbora": "Ein aggressiverer Überkopfschlag mit viel Seitwärtsdrall (Schnitt). Der Ball prallt unberechenbar und extrem flach von den gegnerischen Wänden ab.",
      "Smash (Por Tres / Por Cuatro)": "Ein klassischer Überkopf-Power-Schlag. Wird genutzt, um den Ball so hart zu treffen, dass er nach der gegnerischen Wand über die 3-Meter (Por Tres) oder 4-Meter (Por Cuatro) Außenwand springt oder hoch ins eigene Feld zurückkehrt.",
      "Bajada de Pared": "Ein Überkopfschlag aus dem Hinterfeld, nachdem der Ball hoch von der eigenen Rückwand abgesprungen ist. Man „schlägt den Ball von der Wand nach unten“, oft sehr kraftvoll und offensiv.",
      "Chiquita": "Ein kurzer, weicher Ball aus der Defensive genau vor die Füße der am Netz stehenden Gegner. Zwingt den Gegner zu einem unangenehmen Volley von weit unten und öffnet Chancen zum Konter.",
      "Block": "Ein rein passiver Schlag am Netz. Man hält den Schläger wie eine Wand hin, um extrem harte, gerade Passierbälle des Gegners abzufangen und kurz hinter dem Netz abtropfen zu lassen.",
      "Drive": "Ein flacher Grundschlag, der sowohl mit der Vorhand als auch mit der Rückhand gespielt wird. Er dient dazu, den Ballwechsel zu eröffnen oder den Gegner von der Grundlinie aus unter Druck zu setzen.",
    },
    positions: {
      "Vorhand-Seite (Rechts)": "Der Spieler auf der rechten Seite (bei Rechtshändern). Traditionell der strategischere, aufbauende Spieler, der den Rhythmus bestimmt und den Ball sicher im Spiel hält, um dem Partner Chancen vorzubereiten.",
      "Rückhand-Seite (Links)": "Der Spieler auf der linken Seite. Hat den Ball bei hohen Bällen in der Mitte oft auf der starken Vorhand (für Smashes). Traditionell der offensivere Spieler, der viele Punkte abschließt.",
      "Netzposition (Angriff)": "Die dominierende Position im Padel. Beide Spieler stehen ca. 2–3 Meter vor dem Netz. Von hier aus wird der Druck per Volley und Überkopfschlägen aufgebaut. Punkte werden fast nur hier gewonnen.",
      "Grundlinie (Verteidigung)": "Die Ausgangsposition bei gegnerischem Aufschlag oder Druck. Spieler stehen leicht hinter der Aufschlaglinie. Fokus liegt auf dem Nutzen der Glaswände und dem Spielen von Lobs.",
      "Australische Aufstellung": "Eine Taktik beim Aufschlag: Die Spieler wechseln nach dem Aufschlag nicht die Seiten (links/rechts), sondern bleiben immer auf ihrer Spezial-Seite. Der Netzspieler duckt sich oft, damit der Partner diagonal über ihn aufschlagen kann.",
      "Übergangszone (Niemandsland)": "Der Bereich zwischen Aufschlaglinie und Netz. Hier sollte man sich niemals freiwillig aufhalten, da man leicht vor die Füße angespielt werden kann. Diese Zone wird nur schnell durchschritten.",
    },
    rules: {
      "Zählweise & Tie-Break": "Exakt wie im Tennis: 15, 30, 40, Spiel. Bei Einstand (40:40) wird oft mit der „Golden Point“-Regel (nächster Punkt entscheidet) gespielt. Ein normaler Satz geht bis 6. Bei 6:6 gibt es einen Tie-Break bis 7 Punkte.",
      "Match-Tiebreak": "Wird oft anstelle eines dritten Satzes gespielt (oder wie hier in der App als komplettes Match). Wer zuerst 10 Punkte erreicht (mit 2 Punkten Vorsprung), gewinnt das Match.",
      "Aufschlag-Regeln": "Der Ball muss hinter der Aufschlaglinie auf den Boden geprellt und unterhalb der Hüfte getroffen werden. Mindestens ein Fuß muss den Boden berühren und kein Fuß darf die Aufschlaglinie übertreten.",
      "Let (Netzaufschlag)": "Berührt der Ball beim Aufschlag die Netzkante und landet danach korrekt im diagonalen Aufschlagfeld, wird der Aufschlag wiederholt („Let“). Berührt er danach das Gitter, ist es ein Fehler.",
      "Wand & Gitter": "Der Ball muss immer zuerst auf dem Boden aufkommen, bevor er die Glaswand oder das Metallgitter berührt. Berührt er die Wand/das Gitter direkt fliegend, ist er sofort im Aus.",
      "Eigenes Glas nutzen": "In der Defensive darf man den Ball mit voller Kraft gegen die eigene Glasscheibe schlagen, damit er über das Netz ins gegnerische Feld fliegt. Das Nutzen des eigenen Metallgitters ist hingegen streng verboten.",
      "Netzberührung": "Weder der Spieler noch sein Schläger dürfen das Netz, die Netzpfosten oder das gegnerische Spielfeld berühren, solange der Ball im Spiel ist. Passiert dies, gehört der Punkt sofort den Gegnern.",
      "Übergreifen (Invasion)": "Den Ball auf der gegnerischen Seite des Netzes zu treffen, ist verboten. Ausnahme: Der Ball ist im eigenen Feld aufgesprungen, an die eigene Wand geprallt und fliegt von selbst wieder zurück übers Netz. Dann darf man übergreifen.",
    },
    tactics: {
      "La Nevera (Der Kühlschrank)": "Eine Taktik, bei der man den stärkeren der beiden gegnerischen Spieler komplett aus dem Spiel nimmt, indem man fast jeden Ball gezielt auf den schwächeren Partner spielt. Der starke Spieler „kühlt ab“.",
      "Split Step": "Ein kleiner Sprung, den man exakt in dem Moment ausführt, wenn der Gegner den Ball trifft. So ist man reaktionsbereit und kann explosiv in jede Richtung starten.",
      "Glaswand lesen": "Die Fähigkeit, den Winkel und die Geschwindigkeit des anfliegenden Balls richtig einzuschätzen, um zu wissen, wie er von der Rückwand oder Seitenwand abprallen wird.",
      "Pacing (Zeitspiel)": "Die Geschwindigkeit des Ballwechsels zu kontrollieren. Aggressive KIs hassen langsame, hohe Lobs, während defensive Teams oft Probleme mit extrem schnellen Volley-Duellen haben.",
    },
    tacscore: {
      "TacScore (Skill-Level)": "Dein MMR (Matchmaking Rating). Er steigt bei Siegen und sinkt bei Niederlagen. Dein TacScore bestimmt die Stärke der KI im freien Spiel und schaltet höhere Turniere frei.",
      "TacPoints (Währung)": "Die In-Game Währung. Du verdienst TacPoints durch Siege (besonders in Turnieren) und benötigst sie als Startgeld (Buy-In) für Pro Tour Events sowie für Ausrüstung im Spind.",
      "Profi-Liga Modus": "Erreichst du einen TacScore von 4000, wechselt das Spiel in den Profi-Modus. Die hilfreichen Taktik-Linien auf dem Boden verschwinden – du musst Laufwege und Schläge nun komplett frei einschätzen.",
    },
    tour: {
      "Open Events": "Die Einstiegsklasse der Pro Tour. Kosten wenig bis gar kein Startgeld und erfordern einen niedrigen TacScore. Perfekt, um erste Erfahrungen im K.o.-System zu sammeln und das Konto aufzufüllen.",
      "Pro Events": "Mittleres Schwierigkeitslevel. Hier treffen starke KIs aufeinander. Das Buy-In ist spürbar, aber die Belohnung für einen Turniersieg bringt dich in der Weltrangliste enorm nach vorne.",
      "Premier Master Events": "Die Königsklasse. Nur zugänglich für Spieler mit extrem hohem TacScore und großem Geldbeutel. Wer ein Master gewinnt, hat die absolute KI-Elite im Padel geschlagen.",
      "Turnier-Struktur": "Ein Event besteht aus Viertelfinale, Halbfinale und Finale. Je weiter du kommst, desto länger werden die Match-Tiebreaks (z. B. bis 6 im Viertelfinale, bis 10 im Finale).",
      "Turnier-Speicherung": "Dein Turnier-Fortschritt (inklusive verbleibender Ausdauer) wird nach jedem Match gespeichert. Verlierst du, bist du ausgeschieden und das Startgeld ist weg.",
    },
    stamina: {
      "Stamina (Ausdauer)": "Jeder Sprint und jeder harte Schlag kostet dich und deinen Partner Ausdauer. Sinkt der Wert auf 0, fehlt die Kraft für saubere Schläge und der Ball landet oft im Netz.",
      "Regeneration durch Taktik": "Während eines Ballwechsels kannst du Ausdauer regenerieren, indem du taktisch clevere Schläge spielst (z. B. einen kontrollierten Lob aus der tiefen Defensive oder einen Volley vorne am Netz).",
      "Zonen & Laufwege": "Das Spielfeld ist in ein Raster (A-E, 1-5) unterteilt. Du musst rechtzeitig in die Zielzone des gegnerischen Balls laufen, sonst machst du ein Luftloch. Achte darauf, Smash-Bälle nicht zu überlaufen!",
      "Wer nimmt den Ball?": "Du und dein Partner müsst euch absprechen. Wenn du in die Zone läufst, sollte dein Partner absichern. Läuft dein Partner zum Ball, überlass ihm den Schlag. Die KI bestraft Deckungslücken gnadenlos.",
    },
    ai: {
      "Gegner-Profile": "Du spielst gegen feste KI-Teams mit eigenen Stärken und einem bevorzugten Spielstil (Aggressiv, Defensiv, Balanced).",
      "Aggressive KI": "Spielt schnelle Bälle, rückt aggressiv ans Netz auf und zwingt dich zu schnellen Reaktionen. Dafür verbrauchen sie ihre Ausdauer wesentlich schneller.",
      "Defensive KI": "Spielt lange, sichere Bälle (oft Lobs) und macht kaum Eigenfehler (Unforced Errors). Sie haben einen extrem hohen Ausdauer-Multiplikator und sind schwer müde zu spielen.",
      "KI-Ausdauer": "Auch die Gegner haben einen Ausdauerbalken. Wenn du sie viel laufen lässt und den Ball im Spiel hältst (lange Ballwechsel), brechen sie irgendwann ein und machen leichte Fehler.",
    },
  },

  en: {
    shots: {
      "Serve": "In Padel, the serve is hit underhand below waist level after bouncing the ball once. It must land diagonally in the opponent's service box. Hitting the wire mesh after the bounce is a fault; hitting the glass wall is valid.",
      "Return": "The first shot answering the opponent's serve. The golden rule of returning: keep the ball safely in play. Players often use a low Chiquita or a deep Lob to take over the net.",
      "Lob": "The most important tactical shot in Padel. A high, deep ball towards the opponent's baseline designed to push net players back to the glass so your team can take the net.",
      "Volley": "A shot hit directly out of the air before the ball bounces, played close to the net. Volleys are ideally hit with slice (backspin) deep into the corners.",
      "Bandeja": "A controlled, defensive overhead shot played mid-court. Hit at head height with slice so the ball stays low after rebounding off the back glass, allowing you to keep the net position.",
      "Víbora": "An aggressive overhead shot with heavy side-spin. The ball rebounds fast, low and unpredictably off the opponent's corner walls.",
      "Smash (Por Tres / Por Cuatro)": "The classic power overhead. Used to hit the ball so hard that it bounces out over the 3-meter side wall (Por Tres), clears the 4-meter back wall (Por Cuatro), or flies back to your own side.",
      "Bajada de Pared": "An offensive overhead counter-attack from the back of the court after a high rebound off your own back glass. You 'bring the ball down' with pace to attack opponents at the net.",
      "Chiquita": "A soft, slow shot played from the back court right at the feet of opponents standing at the net, forcing them to hit a difficult volley upwards.",
      "Block": "A compact, defensive reflex shot at the net. You hold the racket firm like a wall to absorb powerful body shots and drop the ball short over the net.",
      "Drive (Groundstroke)": "A flat or slightly topspin groundstroke hit with forehand or backhand after the bounce to build the rally from the baseline.",
    },
    positions: {
      "Forehand Side (Right / Drive)": "The right side of the court. For right-handed players, the forehand faces the center. Traditionally the playmaker who builds the point and sets up opportunities for the partner.",
      "Backhand Side (Left / Revés)": "The left side of the court. For right-handers, the strong forehand and overhead smash cover the center. Traditionally the more aggressive finisher.",
      "Net Position (Attack)": "The dominant position in Padel. Both partners stand 2–3 meters from the net, applying pressure with volleys and overheads. Almost 80% of points are won from the net.",
      "Baseline (Defense)": "The starting position when defending behind the service line. Focus lies on using the glass walls, absorbing pressure and playing deep lobs to regain the net.",
      "Australian Formation": "A serving tactic where partners stay on their preferred side instead of switching. The net player crouches near the center line while the server hits diagonally.",
      "Transition Zone (No Man's Land)": "The area between the service line and the net. Never stop here during a rally, as opponents will easily target your feet. Move through it quickly.",
    },
    rules: {
      "Scoring & Tiebreak": "Identical to tennis: 15, 30, 40, Game. At Deuce (40:40), many tournaments use the 'Golden Point' rule (next point wins). At 6:6 games, a tiebreak is played to 7 points.",
      "Match Tiebreak": "Often played instead of a third set (or as a full match in TacPadel). The first team to reach 10 points with a 2-point lead wins.",
      "Service Rules": "The ball must bounce behind the service line and be struck below waist height. At least one foot must touch the ground, without touching or crossing the service line.",
      "Let Serve": "If a serve clips the top of the net and lands cleanly inside the diagonal service box (without hitting the wire mesh before the second bounce), it is replayed ('Let').",
      "Walls & Wire Mesh": "A ball must always bounce on the turf first before hitting the opponent's glass wall or wire mesh. Hitting a wall or fence directly on the fly is Out.",
      "Using Your Own Glass": "In desperate defense, you may hit the ball against your own glass wall so it rebounds over the net. Hitting your own wire mesh, however, is a fault.",
      "Net Touch": "Neither a player nor their racket may touch the net, net posts, or the opponent's court while the ball is in play.",
      "Reaching Over the Net": "You may only reach over the net to hit a ball after it has already bounced on your side (e.g., rebounding back over the net after a spin smash).",
    },
    tactics: {
      "La Nevera (The Fridge)": "A classic padel tactic where you direct almost every ball to the weaker opponent, leaving the stronger player 'in the fridge' out of rhythm.",
      "Split Step": "A small hop performed right as the opponent strikes the ball, loading your legs so you can push off explosively in any direction.",
      "Reading the Glass": "Judging the speed, spin and angle of an incoming shot to anticipate exactly where the ball will rebound off the back or side glass.",
      "Pacing (Tempo Control)": "Controlling the speed of the rally. Aggressive AI teams hate slow, high lobs, while defensive teams struggle against fast, angled volley combinations.",
    },
    tacscore: {
      "TacScore (Skill Rating)": "Your Matchmaking Rating (MMR). It rises with wins and drops with losses. Your TacScore determines AI difficulty and unlocks higher tournament tiers.",
      "TacPoints (Currency)": "Your in-game currency. Earn TacPoints in matches and tournaments to pay tournament entry fees (Buy-Ins) or unlock partners, rackets and power shots in the shop.",
      "Pro League Mode": "Once you reach 4000 TacScore, matches switch to Pro League Mode: tactical helper lines on the court disappear, requiring pure tactical reading.",
    },
    tour: {
      "Open Events": "The entry tier of the TP Tour with low or free Buy-Ins. Ideal for building your TacPoints bankroll and learning tournament stamina management.",
      "Pro Events": "Mid-tier tournaments featuring stronger AI teams, higher Buy-Ins and major TacPoints rewards for the season leaderboard.",
      "Premier Master Events": "The elite tier. Accessible only with high TacScore and TacPoints. Winning a Master unlocks the golden Tron trophy in your vault.",
      "Tournament Structure": "Each event consists of Quarterfinal (Tiebreak to 6), Semifinal (to 8) and Final (to 10).",
      "Tournament Persistence": "Your bracket progress and remaining player stamina carry over from round to round. If you lose without using a Second Chance, you are eliminated.",
    },
    stamina: {
      "Stamina": "Every sprint and shot drains stamina from you and your partner. If stamina hits 0, shot quality drops und balls can fall short into the net.",
      "Tactical Stamina Recovery": "You recover stamina mid-rally by choosing smart tactical positions (e.g. moving to the net after a deep lob or holding net position on volleys).",
      "Court Grid & Footwork": "The court is divided into a 5x5 grid (A–E, 1–5). You must move into the ball's intercept zone before the timer runs out.",
      "Who Takes the Ball?": "Coordinate with your partner: one player intercepts the ball while the other covers the open court. The AI ruthlessly punishes gaps.",
    },
    ai: {
      "Opponent Profiles": "You face distinct AI teams with individual playstyles (Aggressive, Defensive, Balanced) and stamina multipliers.",
      "Aggressive AI": "Hits fast, flat balls and rushes the net constantly, but burns through stamina much faster in long rallies.",
      "Defensive AI": "Plays high-percentage lobs, makes very few unforced errors and has a high stamina pool.",
      "Draining AI Stamina": "Opponents also have stamina bars. Moving them from corner to corner in long rallies wears them down and forces errors.",
    },
  },

  es: {
    shots: {
      "Saque (Servicio)": "En el pádel, el saque se ejecuta por debajo de la cintura tras botar la bola detrás de la línea de saque. Debe botar en el cuadro diagonal rival. Si tras el bote toca la malla metálica, es falta; si toca el cristal, es válido.",
      "Resto": "La devolución del saque rival. La regla de oro al restar es asegurar la bola en juego. Suele jugarse un globo profundo o una Chiquita para subir a la red.",
      "Globo (Lob)": "El golpe táctico más importante del pádel. Una bola alta y profunda hacia el fondo rival para expulsar a los rivales de la red y tomar la iniciativa.",
      "Volea": "Golpe realizado cerca de la red antes de que la bola bote. Se ejecuta con efecto cortado (slice) buscando profundidad y las esquinas.",
      "Bandeja": "Golpe aéreo defensivo/de control ejecutado a la altura de la cabeza con efecto cortado. Su objetivo no es definir el punto, sino lograr que la bola rebote baja en el cristal de fondo y conservar la red.",
      "Víbora": "Golpe aéreo ofensivo con fuerte efecto lateral. La bola sale rápida, rasante y muy difícil de defender tras tocar la doble pared rival.",
      "Remate (Por Tres / Por Cuatro)": "El golpe de máxima potencia por encima de la cabeza para sacar la bola por el lateral de 3 metros (Por Tres), por el fondo de 4 metros (Por Cuatro) o traerla de vuelta a tu campo.",
      "Bajada de Pared": "Contraataque ofensivo desde el fondo cuando la bola queda alta tras rebotar en tu propio cristal. Permite pasar de defensa a ataque con gran velocidad.",
      "Chiquita": "Golpe suave y lento desde el fondo dirigido a los pies de los rivales que están en la red, obligándoles a volear hacia arriba desde abajo.",
      "Bloqueo": "Golpe reflejo y compacto en la red. Se coloca la pala firme para amortiguar bolas potentes al cuerpo y dejarlas cortas al otro lado.",
      "Derecha / Revés (Drive)": "Golpes planos o liftados desde el fondo de la pista tras el bote para construir el punto.",
    },
    positions: {
      "Lado de Drive (Derecha)": "El jugador de la derecha. En diestros tiene la derecha hacia el centro. Tradicionalmente es el jugador más táctico y sólido que construye el punto.",
      "Lado de Revés (Izquierda)": "El jugador de la izquierda. En diestros cubre el centro con su derecha y el remate aéreo. Suele ser el jugador más ofensivo y definidor.",
      "Posición de Red (Ataque)": "La zona dominante en el pádel. Ambos jugadores se sitúan a 2–3 metros de la red para presionar con voleas y juego aéreo.",
      "Fondo de Pista (Defensa)": "Posición inicial detrás de la línea de saque cuando el rival domina. El objetivo es defender con los cristales y tirar globos para recuperar la red.",
      "Formación Australiana": "Táctica de saque en la que la pareja mantiene siempre su lado especialista sin cambiarse. El compañero en la red se agacha junto a la línea central.",
      "Zona de Transición (Tierra de Nadie)": "El espacio entre la línea de saque y la red. Nunca debes quedarte parado aquí, ya que te jugarán bolas a los pies con facilidad.",
    },
    rules: {
      "Puntuación y Tie-Break": "Igual que en el tenis: 15, 30, 40 y Juego. En iguales (40:40) suele aplicarse el 'Punto de Oro'. Con 6:6 se juega un tie-break a 7 puntos.",
      "Super Tie-Break": "Se juega a 10 puntos con diferencia de 2. En TacPadel los partidos individuales y rondas de torneo se disputan en formato Tie-Break dinámico.",
      "Reglas de Saque": "La bola debe botar detrás de la línea y golpearse por debajo de la cintura con al menos un pie en contacto con el suelo.",
      "Let (Saque que toca la red)": "Si el saque toca la cinta de la red y cae correctamente en el cuadro rival sin tocar la malla antes del segundo bote, se repite ('Let').",
      "Cristal y Malla Metálica": "La bola siempre debe botar primero en el suelo del campo rival antes de tocar el cristal o la malla. Si toca pared o malla directamente, es fuera.",
      "Uso de tu Propio Cristal": "En defensa puedes golpear la bola contra tu propio cristal para que pase al campo rival. Tocar tu propia malla metálica, en cambio, es pérdida del punto.",
      "Toque de Red": "Ni el jugador ni su pala pueden tocar la red, los postes ni el campo rival mientras la bola está en juego.",
      "Invasión (Pasar la pala)": "Solo se permite golpear la bola al otro lado de la red si ya ha botado primero en tu campo y vuelve hacia el campo rival por efecto.",
    },
    tactics: {
      "La Nevera": "Táctica clásica que consiste en enviar casi todas las bolas al rival más flojo para dejar 'en la nevera' (frío y sin ritmo) al jugador más peligroso.",
      "Split Step (Paso de Activación)": "Pequeño salto justo cuando el rival impacta la bola para activar las piernas y arrancar rápido en cualquier dirección.",
      "Lectura de Pared": "Capacidad de calcular la velocidad y el ángulo de entrada de la bola para anticipar su salida tras rebotar en el cristal.",
      "Control del Ritmo (Tempo)": "Alternar velocidades de bola. Las parejas IA agresivas sufren ante globos lentos y profundos, mientras que las defensivas sufren ante voleas rápidas.",
    },
    tacscore: {
      "TacScore (Nivel de Habilidad)": "Tu clasificación de nivel (MMR). Sube al ganar y baja al perder. Define la dificultad de la IA y desbloquea torneos superiores.",
      "TacPoints (Moneda)": "Moneda del juego obtenida en partidos y torneos. Sirve para pagar inscripciones (Buy-Ins) y desbloquear compañeros, palas y golpes en la tienda.",
      "Modo Liga Pro": "Al alcanzar 4000 de TacScore, desaparecen las líneas tácticas de ayuda en la pista para ofrecer una simulación 100% profesional.",
    },
    tour: {
      "Eventos Open": "La categoría inicial del TP Tour con inscripción gratuita o baja. Ideal para sumar tus primeros TacPoints.",
      "Eventos Pro": "Torneos de nivel intermedio con rivales IA exigentes y grandes premios de TacPoints para el ranking.",
      "Eventos Premier Master": "La máxima categoría del circuito. Ganar un Master añade el trofeo dorado Tron a tu vitrina 3D.",
      "Estructura del Torneo": "Cada torneo consta de Cuartos de Final (Tie-Break a 6), Semifinal (a 8) y Final (a 10).",
      "Progreso y Energía en Torneos": "Tu avance y la energía restante de tu pareja se guardan entre rondas. Gestiona bien tus esfuerzos para llegar fresco a la final.",
    },
    stamina: {
      "Energía (Stamina)": "Cada carrera y golpe potente consume energía. Si llega a 0, tus golpes pierden fuerza y aumenta el riesgo de fallar en la red.",
      "Recuperación Táctica": "Recuperas energía durante el punto si eliges desplazamientos tácticamente óptimos tras golpear.",
      "Zonas y Desplazamientos": "La pista se divide en una cuadrícula 5x5 (A–E, 1–5). Debes llegar a tiempo a la zona de impacto antes de que acabe el temporizador.",
      "¿Quién toma la bola?": "Coordínate con tu compañero: mientras uno va a la bola, el otro cubre el hueco libre en bloque.",
    },
    ai: {
      "Perfiles de Rivales IA": "Te enfrentas a parejas IA con estilos propios (Agresivo, Defensivo, Equilibrado) y distintos niveles de resistencia.",
      "IA Agresiva": "Juega bolas rápidas y sube constantemente a la red, pero agota su energía mucho más rápido en peloteos largos.",
      "IA Defensiva": "Juega globos profundos, comete muy pocos errores no forzados y tiene una gran reserva de energía.",
      "Desgastar a la IA": "Los rivales también tienen barra de energía. Moverlos de lado a lado en puntos largos los agota y provoca errores.",
    },
  },
};

// Rückwärtskompatible Exporte für App.tsx
export const PADEL_DICTIONARY: Record<string, Record<string, string>> = {
  "Schläge": PADEL_DICTIONARY_I18N.de.shots,
  "Positionen": PADEL_DICTIONARY_I18N.de.positions,
  "Regeln": PADEL_DICTIONARY_I18N.de.rules,
  "Taktik & Jargon": PADEL_DICTIONARY_I18N.de.tactics,
  "TacScore & Fortschritt": PADEL_DICTIONARY_I18N.de.tacscore,
  "Pro Tour & Turniere": PADEL_DICTIONARY_I18N.de.tour,
  "Ausdauer & Spielmechanik": PADEL_DICTIONARY_I18N.de.stamina,
  "KI-Gegner": PADEL_DICTIONARY_I18N.de.ai,
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Schläge": CATEGORY_STYLE_BY_KEY.shots.badge,
  "Positionen": CATEGORY_STYLE_BY_KEY.positions.badge,
  "Regeln": CATEGORY_STYLE_BY_KEY.rules.badge,
  "Taktik & Jargon": CATEGORY_STYLE_BY_KEY.tactics.badge,
  "TacScore & Fortschritt": CATEGORY_STYLE_BY_KEY.tacscore.badge,
  "Pro Tour & Turniere": CATEGORY_STYLE_BY_KEY.tour.badge,
  "Ausdauer & Spielmechanik": CATEGORY_STYLE_BY_KEY.stamina.badge,
  "KI-Gegner": CATEGORY_STYLE_BY_KEY.ai.badge,
};

const LEGAL_TEXTS: Record<
  AppLanguage,
  {
    disclaimerTitle: string;
    p1Title: string;
    p1Text: string;
    p2Title: string;
    p2Text: string;
    p3Title: string;
    p3Text: string;
    privacyTitle: string;
    guestTitle: string;
    guestText: string;
    accountTitle: string;
    accountText: string;
    deleteText1: string;
    deleteText2: string;
    imprintTitle: string;
    imprintLaw: string;
    operatorLabel: string;
    country: string;
    contactLabel: string;
    phoneLabel: string;
    contentRespLabel: string;
    disputeLabel: string;
    disputeText: string;
  }
> = {
  de: {
    disclaimerTitle: "Haftungsausschluss (Disclaimer)",
    p1Title: "1. Gesundheitsrisiko & Verletzungsgefahr",
    p1Text:
      "Padel-Tennis ist ein körperlich anspruchsvoller und dynamischer Sport. Die Nutzung der TacPadel App und die Ausführung der darin beschriebenen Schläge, Laufwege und Taktiken erfolgen ausdrücklich auf eigene Gefahr. Wir übernehmen keine Haftung für Verletzungen, körperliche Beschwerden oder Sachschäden, die durch das Nachspielen der Trainingsszenarien entstehen. Bitte wärme dich vor jedem Spiel ausreichend auf und passe die Intensität deinem persönlichen Fitnesslevel an.",
    p2Title: "2. Keine professionelle Beratung",
    p2Text:
      "Die Inhalte, Tipps und Taktiken in dieser App dienen ausschließlich zu Informations- und Trainingszwecken. Sie ersetzen kein professionelles Training bei einem zertifizierten Padel-Coach oder medizinischen Rat bei Verletzungen.",
    p3Title: "3. Haftung für Inhalte",
    p3Text:
      "Die in dieser App dargestellten Taktiken und Szenarien wurden mit größter Sorgfalt erstellt. Dennoch übernehmen wir keine Gewähr für die Richtigkeit, Vollständigkeit oder garantierte Erfolge der Inhalte auf dem Platz.",
    privacyTitle: "Datenschutzhinweise",
    guestTitle: "Nutzung als Gast (ohne Anmeldung):",
    guestText:
      "Du kannst das Grundlagen-Training und Einzel-Matches komplett ohne Registrierung spielen. Im Gast-Modus werden keinerlei personenbezogene Daten an unsere Server übertragen; deine Audio- und Spieleinstellungen werden lediglich lokal auf deinem Gerät (im LocalStorage) gespeichert.",
    accountTitle: "Nutzung mit Spieler-Account:",
    accountText:
      "Für die dauerhafte Speicherung deines TacScores, die Teilnahme an der TP-Tour und die globale Rangliste kannst du freiwillig einen Account erstellen. Dabei werden deine E-Mail-Adresse, dein gewählter Spielername, ein optionales Profilbild und deine Spielstatistiken verschlüsselt auf den Servern unseres Datenbank-Dienstleisters (Supabase) gespeichert, damit du geräteübergreifend auf deinen Spielstand zugreifen kannst.",
    deleteText1:
      "Passwörter werden ausschließlich verschlüsselt verarbeitet. Wir geben deine Daten nicht zu Werbezwecken an Dritte weiter. Du kannst deinen Account und alle damit verbundenen Daten jederzeit direkt in der App (im Profil-Tab ganz unten) oder per E-Mail an ",
    deleteText2: " vollständig löschen.",
    imprintTitle: "Impressum",
    imprintLaw: "Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)",
    operatorLabel: "Betreiber der App:",
    country: "Deutschland",
    contactLabel: "Kontakt:",
    phoneLabel: "Telefon:",
    contentRespLabel: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:",
    disputeLabel: "Verbraucherstreitbeilegung / Universalschlichtungsstelle:",
    disputeText:
      "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  },
  en: {
    disclaimerTitle: "Disclaimer",
    p1Title: "1. Health Risk & Risk of Injury",
    p1Text:
      "Padel is a physically demanding and dynamic sport. Using the TacPadel app and performing the shots, footwork and tactics described therein is expressly at your own risk. We assume no liability for injuries, physical complaints or property damage resulting from practicing these training scenarios. Please warm up properly before playing and adapt the intensity to your personal fitness level.",
    p2Title: "2. No Professional Advice",
    p2Text:
      "The content, tips and tactics in this app are provided strictly for informational and training purposes. They do not replace professional coaching from a certified padel coach or medical advice.",
    p3Title: "3. Liability for Content",
    p3Text:
      "All tactics and scenarios in this app have been created with great care. However, we assume no guarantee for the accuracy, completeness or on-court success of the content.",
    privacyTitle: "Privacy Notice",
    guestTitle: "Playing as Guest (Without Registration):",
    guestText:
      "You can play tactical training and single matches without registering. In Guest Mode, no personal data is transmitted to our servers; your audio and game settings are stored locally on your device (in LocalStorage).",
    accountTitle: "Playing with a Player Account:",
    accountText:
      "To permanently save your TacScore, compete in the TP Tour and appear on the global leaderboard, you can optionally create an account. Your email address, chosen player name, optional profile picture and match statistics are stored encrypted on the servers of our database provider (Supabase) so you can access your progress across devices.",
    deleteText1:
      "Passwords are processed exclusively in encrypted form. We never sell or share your data with third parties for advertising purposes. You can permanently delete your account and all associated data at any time directly inside the app (at the bottom of the Profile tab) or by emailing ",
    deleteText2: ".",
    imprintTitle: "Legal Notice (Imprint)",
    imprintLaw: "Information pursuant to Section 5 DDG (German Digital Services Act)",
    operatorLabel: "App Operator:",
    country: "Germany",
    contactLabel: "Contact:",
    phoneLabel: "Phone:",
    contentRespLabel: "Responsible for content pursuant to Section 18 (2) MStV:",
    disputeLabel: "Consumer Dispute Resolution:",
    disputeText:
      "We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
  },
  es: {
    disclaimerTitle: "Descargo de Responsabilidad (Disclaimer)",
    p1Title: "1. Riesgo Físico y de Lesiones",
    p1Text:
      "El pádel es un deporte físicamente exigente y dinámico. El uso de la aplicación TacPadel y la ejecución de los golpes, desplazamientos y tácticas descritos se realizan bajo tu propia responsabilidad. No asumimos ninguna responsabilidad por lesiones, molestias físicas o daños materiales derivados de poner en práctica los escenarios de entrenamiento. Calienta adecuadamente antes de jugar y adapta la intensidad a tu nivel físico.",
    p2Title: "2. Sin Asesoramiento Profesional",
    p2Text:
      "Los contenidos, consejos y tácticas de esta aplicación tienen fines exclusivamente informativos y de entrenamiento. No sustituyen el entrenamiento con un monitor certificado ni el consejo médico.",
    p3Title: "3. Responsabilidad por los Contenidos",
    p3Text:
      "Las tácticas y escenarios de esta aplicación han sido elaborados con el máximo cuidado. No obstante, no garantizamos la exactitud, integridad ni resultados garantizados en la pista.",
    privacyTitle: "Información sobre Privacidad",
    guestTitle: "Uso como Invitado (sin registro):",
    guestText:
      "Puedes jugar al entrenamiento táctico y a partidos individuales sin registrarte. En el modo invitado no se envían datos personales a nuestros servidores; tus ajustes se guardan únicamente de forma local en tu dispositivo (LocalStorage).",
    accountTitle: "Uso con Cuenta de Jugador:",
    accountText:
      "Para guardar permanentemente tu TacScore, participar en el TP Tour y figurar en el ranking global, puedes crear una cuenta voluntariamente. Tu correo electrónico, nombre de jugador, foto de perfil opcional y estadísticas se almacenan de forma cifrada en nuestro proveedor de base de datos (Supabase) para sincronizar tu progreso entre dispositivos.",
    deleteText1:
      "Las contraseñas se procesan exclusivamente de forma cifrada. No compartimos tus datos con terceros con fines publicitarios. Puedes eliminar tu cuenta y todos tus datos en cualquier momento directamente desde la app (en la pestaña Perfil, abajo del todo) o enviando un correo a ",
    deleteText2: ".",
    imprintTitle: "Aviso Legal (Impressum)",
    imprintLaw: "Información según el § 5 de la DDG (Ley Alemana de Servicios Digitales)",
    operatorLabel: "Operador de la App:",
    country: "Alemania",
    contactLabel: "Contacto:",
    phoneLabel: "Teléfono:",
    contentRespLabel: "Responsable del contenido según § 18 Abs. 2 MStV:",
    disputeLabel: "Resolución de litigios en línea:",
    disputeText:
      "No estamos dispuestos ni obligados a participar en procedimientos de resolución de litigios ante una junta de arbitraje de consumo.",
  },
};

interface LexikonItem {
  id: string;
  title: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  badgeColor: string;
  stripeColor: string;
  description: string;
}

const CATEGORY_KEYS: CategoryKey[] = [
  "shots",
  "positions",
  "rules",
  "tactics",
  "tacscore",
  "tour",
  "stamina",
  "ai",
];

export default function BasicsView({ setActiveTab }: BasicsViewProps) {
  const { lang, t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | CategoryKey>("all");
  const [showLegal, setShowLegal] = useState<boolean>(false);

  const activeDict = PADEL_DICTIONARY_I18N[lang] || PADEL_DICTIONARY_I18N.de;
  const legal = LEGAL_TEXTS[lang] || LEGAL_TEXTS.de;

  // Objekt flach machen für die Suche und Darstellung
  const flattenedItems: LexikonItem[] = useMemo(() => {
    const items: LexikonItem[] = [];
    CATEGORY_KEYS.forEach((catKey) => {
      const terms = activeDict[catKey] || {};
      const catLabel = t(CATEGORY_LABEL_KEYS[catKey]);
      const styles = CATEGORY_STYLE_BY_KEY[catKey];

      Object.entries(terms).forEach(([title, description]) => {
        items.push({
          id: `${catKey}-${title.toLowerCase().replace(/\s+/g, "-")}`,
          title,
          categoryKey: catKey,
          categoryLabel: catLabel,
          badgeColor: styles.badge,
          stripeColor: styles.stripe,
          description,
        });
      });
    });
    return items;
  }, [activeDict, lang]);

  // Filter-Logik
  const filteredItems = flattenedItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.categoryKey === selectedCategory;
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
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={() => setShowLegal(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-cyan-400 uppercase tracking-widest transition-colors"
            >
              {t("basics_back_to_lexicon")}
            </button>
          </div>

          <h2 className="text-xl font-bold text-cyan-400 mb-2">{legal.disclaimerTitle}</h2>

          <div className="text-sm text-slate-400 space-y-4 leading-relaxed">
            <p>
              <strong className="text-slate-200">{legal.p1Title}</strong>
              <br />
              {legal.p1Text}
            </p>

            <p>
              <strong className="text-slate-200">{legal.p2Title}</strong>
              <br />
              {legal.p2Text}
            </p>

            <p>
              <strong className="text-slate-200">{legal.p3Title}</strong>
              <br />
              {legal.p3Text}
            </p>

            <h2 className="text-xl font-bold text-cyan-400 mb-4 mt-8">{legal.privacyTitle}</h2>

            <p>
              <strong className="text-slate-200">{legal.guestTitle}</strong>
              <br />
              {legal.guestText}
            </p>

            <p>
              <strong className="text-slate-200">{legal.accountTitle}</strong>
              <br />
              {legal.accountText}
            </p>

            <p>
              {legal.deleteText1}
              <a href="mailto:support@tacpadel.com" className="text-cyan-400 hover:underline">
                support@tacpadel.com
              </a>
              {legal.deleteText2}
            </p>

            {/* Direkte Links zur vollständigen Datenschutzerklärung */}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="https://tac-padel-api-server.vercel.app/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 rounded-lg text-xs font-bold text-cyan-400 transition-colors"
              >
                {t("basics_privacy_full_btn")}
              </a>
              <a
                href="https://tac-padel-api-server.vercel.app/privacy.html#delete-account"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 transition-colors"
              >
                {t("basics_delete_info_btn")}
              </a>
            </div>

            <div className="w-full h-px bg-slate-800 my-6" />

            <h2 className="text-xl font-bold text-cyan-400 mb-4">{legal.imprintTitle}</h2>
            <p>
              {legal.imprintLaw}
              <br />
              <br />
              <strong className="text-slate-200">{legal.operatorLabel}</strong>
              <br />
              TacPadel Academy
              <br />
              Boris Sredojevic
              <br />
              Brunnenstr. 26
              <br />
              47623 Kevelaer
              <br />
              {legal.country}
              <br />
              <br />
              <strong className="text-slate-200">{legal.contactLabel}</strong>
              <br />
              {legal.phoneLabel} +49 172 1977728
              <br />
              E-Mail:{" "}
              <a href="mailto:support@tacpadel.com" className="text-cyan-400 hover:underline">
                support@tacpadel.com
              </a>
              <br />
              <br />
              <strong className="text-slate-200">{legal.contentRespLabel}</strong>
              <br />
              Boris Sredojevic
              <br />
              Brunnenstr. 26
              <br />
              47623 Kevelaer
              <br />
              <br />
              <strong className="text-slate-200">{legal.disputeLabel}</strong>
              <br />
              {legal.disputeText}
            </p>

            <div className="pt-4">
              <button
                onClick={() => setShowLegal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-cyan-400 uppercase tracking-widest transition-colors"
              >
                {t("basics_back_to_lexicon")}
              </button>
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
                <span className="text-[10px] font-black tracking-[0.3em] text-emerald-500 uppercase">
                  {t("basics_sub")}
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">
                  {t("basics_title_1")}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    {t("basics_title_2")}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-semibold">{t("basics_desc")}</p>
              </div>

              {/* Suchleiste */}
              <div className="w-full md:w-72 bg-[#030611] border border-slate-800 p-3 rounded-xl shadow-inner flex items-center gap-3 transition-colors focus-within:border-emerald-500/50">
                <span className="text-slate-500 pl-1 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder={t("basics_search_placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-600 w-full pr-2 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. KATEGORIE-FILTER */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-[#050b18]/80 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {t("basics_cat_all")}
            </button>

            {CATEGORY_KEYS.map((catKey) => (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                  selectedCategory === catKey
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                    : "bg-[#050b18]/80 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {t(CATEGORY_LABEL_KEYS[catKey])}
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
                <div
                  className={`absolute top-0 left-0 w-1 h-full opacity-60 group-hover:opacity-100 transition-opacity ${item.stripeColor}`}
                />

                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-base font-black text-white uppercase tracking-wider leading-tight">
                    {item.title}
                  </h3>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border whitespace-nowrap ${item.badgeColor}`}
                  >
                    {item.categoryLabel}
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {t("basics_no_results")}
                </p>
              </div>
            )}
          </div>

          {/* 4. RECHTLICHES LINK (Ganz unten) */}
          <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-center w-full">
            <button
              onClick={() => setShowLegal(true)}
              className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest font-black"
            >
              {t("basics_legal_btn")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
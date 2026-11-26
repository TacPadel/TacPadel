import React, { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr } from "@react-three/drei";
import AnimatedPadelPlayer, { PlayerAction } from "./AnimatedPadelPlayer";
import { useTranslation } from "../lib/i18n";

type LocalizedText = {
  de: string;
  en: string;
  es: string;
};

type ShotCategory = "basics" | "baseline" | "net";
type TimeoutHandle = ReturnType<typeof setTimeout>;

export type ShotGuideId = Exclude<PlayerAction, "a_pose" | "walk">;

interface ShotGuideEntry {
  id: ShotGuideId;
  category: ShotCategory;
  name: LocalizedText;
  level: LocalizedText;
  when: LocalizedText;
  technique: LocalizedText;
  tactic: LocalizedText;
  mistake: LocalizedText;
}

const SHOT_GUIDES: ShotGuideEntry[] = [
  {
    id: "idle",
    category: "basics",
    name: { de: "Grundstellung", en: "Ready Stance", es: "Posición base" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Vor jedem gegnerischen Schlag - sowohl an der Grundlinie als auch am Netz.",
      en: "Before every opponent shot - both at the baseline and at the net.",
      es: "Antes de cada golpe rival, tanto en el fondo como en la red.",
    },
    technique: {
      de: "Knie leicht gebeugt, Gewicht auf den Fußballen, Schläger im Continental-Griff hochkant vor der Brust, freie Hand stützt am Schlägerherz.",
      en: "Knees slightly bent, weight on the balls of your feet, racket vertical in Continental grip at chest height, free hand supporting the throat.",
      es: "Rodillas flexionadas, peso en las puntas, pala de canto delante del pecho con empuñadura continental y mano libre en el corazón.",
    },
    tactic: {
      de: "Verkürzt die Reaktionszeit für Vorhand, Rückhand und schnelle Volleys gleichermaßen.",
      en: "Cuts reaction time equally for forehand, backhand, and fast net volleys.",
      es: "Reduce el tiempo de reacción por igual para derecha, revés y voleas rápidas.",
    },
    mistake: {
      de: "Schläger zu tief neben der Hüfte hängen lassen oder zu aufrecht auf den Fersen stehen.",
      en: "Dropping the racket down by the hip or standing upright on your heels.",
      es: "Dejar caer la pala junto a la cadera o quedarse rígido sobre los talones.",
    },
  },
  {
    id: "serve",
    category: "basics",
    name: { de: "Aufschlag", en: "Serve", es: "Saque" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Zu Beginn jedes Punktes diagonal ins gegnerische Aufschlagfeld.",
      en: "At the start of every point diagonally into the opponent service box.",
      es: "Al inicio de cada punto en diagonal hacia el cuadro de saque rival.",
    },
    technique: {
      de: "Seitlich stehen, Ball locker vor dem Körper fallen lassen und nach dem Aufsprung unter Hüfthöhe mit leichtem Slice treffen.",
      en: "Stand sideways, drop the ball cleanly in front of your body, and strike below waist height with light slice after the bounce.",
      es: "Colócate de lado, deja caer la bola delante y golpea por debajo de la cintura con ligero efecto cortado.",
    },
    tactic: {
      de: "Ersten Aufschlag sicher an die Seitenscheibe oder T-Linie platzieren und sofort ans Netz vorrücken.",
      en: "Place the first serve reliably toward the side glass or T-line and advance immediately to the net.",
      es: "Dirige el primer saque al cristal lateral o a la T y sube de inmediato a la red.",
    },
    mistake: {
      de: "Ball aktiv nach oben werfen statt fallen lassen oder über Hüfthöhe schlagen.",
      en: "Tossing the ball upward instead of dropping it, or contacting above waist height.",
      es: "Lanzar la bola hacia arriba en vez de soltarla o impactar por encima de la cintura.",
    },
  },
  {
    id: "forehand",
    category: "baseline",
    name: { de: "Vorhand", en: "Forehand", es: "Derecha" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Standardschlag von der Grundlinie oder nach einem kontrollierten Scheibenabpraller.",
      en: "Standard groundstroke from the baseline or after a controlled glass rebound.",
      es: "Golpe base desde el fondo de pista o tras un rebote controlado en el cristal.",
    },
    technique: {
      de: "Früh seitlich drehen, kompakt ausholen, Ball vor der vorderen Hüfte treffen und sauber nach vorne durchschwingen.",
      en: "Turn sideways early, keep the backswing compact, strike in front of your lead hip, and finish smoothly forward.",
      es: "Gira pronto de lado, preparación corta, impacta delante de la cadera y acompaña hacia adelante.",
    },
    tactic: {
      de: "Druck rausnehmen, flach über das Netz spielen und den Gegner in unkomfortable Positionen zwingen.",
      en: "Keep the ball low over the net and force opponents into awkward defensive positions.",
      es: "Mantén la bola baja sobre la red y obliga a los rivales a defender incómodos.",
    },
    mistake: {
      de: "Zu weit wie im Tennis ausholen, wodurch der Treffpunkt zu spät hinter dem Körper liegt.",
      en: "Taking a huge tennis-style backswing, causing late contact behind the body.",
      es: "Hacer una preparación demasiado larga tipo tenis, impactando tarde detrás del cuerpo.",
    },
  },
  {
    id: "backhand",
    category: "baseline",
    name: { de: "Rückhand", en: "Backhand", es: "Revés" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Für Bälle auf deine schwache Seite an der Grundlinie oder beim Verteidigen aus der Ecke.",
      en: "For balls to your non-dominant side at the baseline or defending out of the corner.",
      es: "Para bolas hacia tu lado débil en el fondo o defendiendo desde la esquina.",
    },
    technique: {
      de: "Schultern deutlich eindrehen, linke Hand führt den Schläger beim Ausholen mit, beim Treffpunkt nach vorne schieben und links ausbalancieren.",
      en: "Rotate shoulders sideways, guide the backswing with your free hand, extend forward through contact, and counter-balance with the free arm.",
      es: "Gira bien los hombros, lleva la pala atrás con la mano libre, empuja adelante y equilibra atrás con el brazo libre.",
    },
    tactic: {
      de: "Ruhig cross über das niedrige Netz spielen, um Fehler zu vermeiden und Zeit für die Rückkehr zu gewinnen.",
      en: "Play calmly cross-court over the lower center of the net to avoid errors and buy recovery time.",
      es: "Juega cruzado con control sobre la parte baja de la red para ganar tiempo y evitar errores.",
    },
    mistake: {
      de: "Frontal zum Netz stehen bleiben und nur aus dem Handgelenk schlagen.",
      en: "Staying square to the net and flicking only with the wrist.",
      es: "Quedarse de frente a la red y golpear solo de muñeca.",
    },
  },
  {
    id: "lob",
    category: "baseline",
    name: { de: "Lob", en: "Lob", es: "Globo" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Wenn die Gegner dominant am Netz stehen und du Zeit hast, den Ball kontrolliert unter dem Ball anzusetzen.",
      en: "When opponents control the net and you have time to get underneath the ball.",
      es: "Cuando los rivales dominan la red y tienes tiempo para meterte debajo de la bola.",
    },
    technique: {
      de: "Tief in die Knie gehen, Schlägerfläche leicht öffnen und den Ball mit langem, ruhigem Zug von unten nach oben heben.",
      en: "Bend deeply at the knees, open the racket face slightly, and lift smoothly from low to high using your legs.",
      es: "Flexiona mucho las rodillas, abre ligeramente la cara y acompaña largo de abajo hacia arriba con las piernas.",
    },
    tactic: {
      de: "Wichtigster Schlag im Padel: drängt die Gegner vom Netz weg und ermöglicht dir den eigenen Netzangriff.",
      en: "The most important shot in padel: pushes opponents off the net so your team can take over.",
      es: "El golpe clave del pádel: desplaza a los rivales al fondo para recuperar la red.",
    },
    mistake: {
      de: "Zu kurz oder zu flach spielen - das serviert den Gegnern einen direkten Smash.",
      en: "Hitting too short or flat, handing the opponents an easy overhead smash.",
      es: "Quedarse corto o demasiado bajo, regalando un remate fácil.",
    },
  },
  {
    id: "chiquita",
    category: "baseline",
    name: { de: "Chiquita", en: "Chiquita", es: "Chiquita" },
    level: { de: "Fortgeschritten", en: "Intermediate", es: "Intermedio" },
    when: {
      de: "Wenn Gegner am Netz auf einen Lob warten und etwas zu weit von der Netzkante entfernt stehen.",
      en: "When net players anticipate a lob and stand slightly too far back from the net.",
      es: "Cuando los rivales esperan un globo y se separan ligeramente de la red.",
    },
    technique: {
      de: "Tief stehen, kurze Bewegung ohne Schwung, Ball gefühlvoll mit leicht offener Fläche knapp über das Netz schieben.",
      en: "Stay low with a short compact motion and gently guide the ball just over the net with a slightly open face.",
      es: "Posición baja, gesto muy corto y toque suave para pasar la bola rozando la red.",
    },
    tactic: {
      de: "Zwingt den Netzspieler zu einem tiefen Volley von unten nach oben und eröffnet Konter oder Netzübernahme.",
      en: "Forces an upward defensive volley from below net height and opens up a counterattack.",
      es: "Obliga a volear por debajo de la red y abre la puerta a contraatacar o subir.",
    },
    mistake: {
      de: "Zu hoch ansetzen, sodass der Gegner den Ball bequem über Netzkantenhöhe attackieren kann.",
      en: "Floating the ball too high so the opponent attacks comfortably above net height.",
      es: "Levantarla demasiado, permitiendo al rival atacar cómodamente por encima de la red.",
    },
  },
  {
    id: "bajada",
    category: "baseline",
    name: { de: "Bajada", en: "Bajada", es: "Bajada de pared" },
    level: { de: "Fortgeschritten", en: "Intermediate", es: "Intermedio" },
    when: {
      de: "Nach einem hohen Abpraller von der eigenen Rückscheibe, wenn du den Ball deutlich über Netzkantenhöhe treffen kannst.",
      en: "After a high rebound off your back glass when you can strike clearly above net height.",
      es: "Tras un rebote alto en tu cristal de fondo cuando puedes golpear por encima de la red.",
    },
    technique: {
      de: "Schnell hinter den Ball kommen, Schläger hoch hinter der Schulter laden und aktiv von oben nach vorne durchbeschleunigen.",
      en: "Get behind the ball quickly, load the racket high behind your shoulder, and accelerate aggressively forward and down.",
      es: "Colócate rápido detrás de la bola, arma alto y acelera de arriba hacia adelante.",
    },
    tactic: {
      de: "Verwandelt eine Verteidigungssituation in einen direkten Angriff auf Körper, Füße oder Lücken der Gegner.",
      en: "Turns defense into instant offense aimed at the opponents' body, feet, or open gaps.",
      es: "Convierte una defensa en ataque directo al cuerpo, a los pies o a los huecos.",
    },
    mistake: {
      de: "Aus zu tiefer Position draufhauen oder nicht weit genug hinter dem Ball stehen.",
      en: "Swinging hard when the ball has already dropped too low, or hitting off the back foot.",
      es: "Acelerar cuando la bola ya ha caído demasiado o golpear desequilibrado hacia atrás.",
    },
  },
  {
    id: "volley",
    category: "net",
    name: { de: "Volley", en: "Volley", es: "Volea" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Deine Hauptwaffe am Netz, um Bälle direkt aus der Luft vor dem Aufsprung zu spielen.",
      en: "Your primary net weapon to strike balls out of the air before they bounce.",
      es: "Tu arma principal en la red para golpear la bola en el aire antes del bote.",
    },
    technique: {
      de: "Minimal ausholen, Schlägerkopf stabil über Handgelenkshöhe halten und mit einem Schritt nach vorne kurz blockend durchdrücken.",
      en: "Minimal backswing, keep the racket head above wrist height, and punch forward cleanly while stepping into the ball.",
      es: "Preparación mínima, cabeza de la pala firme por encima de la muñeca y empuje corto dando un paso adelante.",
    },
    tactic: {
      de: "Tiefe und flachen Absprung erzwingen, bevorzugt auf Füße, Mitte oder Richtung Seitenglas.",
      en: "Create depth and a low bounce, targeting the feet, center gap, or side glass.",
      es: "Busca profundidad y bote bajo hacia los pies, el centro o el cristal lateral.",
    },
    mistake: {
      de: "Zu weit hinter die Schulter ausholen und den Ball unkontrolliert ins Glas prallen lassen.",
      en: "Swinging back behind the shoulder and blasting the ball straight into the back glass.",
      es: "Llevar la pala detrás del hombro y mandar la bola directa al cristal de fondo.",
    },
  },
  {
    id: "block",
    category: "net",
    name: { de: "Block", en: "Block", es: "Bloqueo" },
    level: { de: "Basis", en: "Basic", es: "Básico" },
    when: {
      de: "Gegen sehr harte gegnerische Schläge oder schnelle Bajadas, wenn keine Zeit zum Ausholen bleibt.",
      en: "Against very fast opponent drives or bajadas when there is no time to swing.",
      es: "Ante golpes muy rápidos o bajadas potentes cuando no hay tiempo de armar.",
    },
    technique: {
      de: "Tief stehen, Handgelenk fest halten, Schläger wie eine ruhige Wand vor den Körper stellen und die Energie des Gegners nutzen.",
      en: "Stay low, lock your wrist, present the racket as a calm wall in front of you, and redirect the opponent's pace.",
      es: "Baja el centro de gravedad, muñeca firme y presenta la pala delante usando la fuerza del rival.",
    },
    tactic: {
      de: "Tempo aus dem Ball nehmen, Fehler vermeiden und die eigene Netzposition stabilisieren.",
      en: "Absorb pace, prevent unforced errors, and keep control of the net position.",
      es: "Quita velocidad a la bola, evita errores no forzados y conserva la red.",
    },
    mistake: {
      de: "Gegen einen harten Ball selbst noch aktiv gegenschlagen - der Ball fliegt meist ins Aus.",
      en: "Swinging back hard against a fast ball, which usually sends it straight into the glass.",
      es: "Hacer swing contra una bola rápida, enviándola directa al cristal.",
    },
  },
  {
    id: "bandeja",
    category: "net",
    name: { de: "Bandeja", en: "Bandeja", es: "Bandeja" },
    level: { de: "Fortgeschritten", en: "Intermediate", es: "Intermedio" },
    when: {
      de: "Gegen einen mittellangen Lob, der für einen direkten Smash zu tief im Feld liegt.",
      en: "Against a medium-deep lob that is too far back for a winning smash.",
      es: "Contra un globo medio-profundo que queda demasiado atrás para rematar.",
    },
    technique: {
      de: "Sofort seitlich drehen, freie Hand zeigt zum Ball, Schläger auf Augenhöhe seitlich offen führen und mit kontrolliertem Slice tief ins Eck schieben.",
      en: "Turn sideways immediately, point at the ball with your free hand, contact outside at eye height with controlled slice.",
      es: "Gírate de lado al instante, señala con la mano libre e impacta al costado a la altura de los ojos con efecto cortado.",
    },
    tactic: {
      de: "Kein Gewinnschlag, sondern ein Kontrollschlag: Ball bleibt flach hinten, damit du das Netz nicht verlierst.",
      en: "Not a winner but a control shot: keeps the ball low in the back corner so you hold the net.",
      es: "Golpe de control para mantener la bola baja al fondo y no perder la red.",
    },
    mistake: {
      de: "Zu hart schlagen - der Ball springt hoch von der Rückscheibe ab und lädt zum Konter ein.",
      en: "Hitting too hard, causing a high rebound off the back glass that invites a counterattack.",
      es: "Pegarle demasiado fuerte, levantando el rebote en el cristal para el contraataque rival.",
    },
  },
  {
    id: "vibora",
    category: "net",
    name: { de: "Víbora", en: "Víbora", es: "Víbora" },
    level: { de: "Profi", en: "Pro", es: "Pro" },
    when: {
      de: "Gegen einen etwas kürzeren Lob, wenn du offensiv Druck mit starkem Seitenschnitt aufbauen willst.",
      en: "Against a slightly shorter lob when you want offensive pressure with heavy sidespin.",
      es: "Ante un globo algo más corto cuando buscas presión ofensiva con efecto lateral.",
    },
    technique: {
      de: "Seitlich laden, Schläger enger hinter den Kopf führen und seitlich auf Ohrhöhe mit schneller Peitschenbewegung um den Ball wischen.",
      en: "Coil sideways, tuck the racket behind your head, and whip rapidly around the outside of the ball at ear height.",
      es: "Arma de lado con la pala detrás de la cabeza y envuelve la bola por el exterior con un latigazo rápido.",
    },
    tactic: {
      de: "Der Ball taucht nach der Scheibe flach und seitlich weg und macht dem Verteidiger die Ecke extrem schwer.",
      en: "The ball skids low and sideways off the glass, making corner defense extremely difficult.",
      es: "La bola sale baja y rápida tras el cristal, dificultando al máximo la defensa en la esquina.",
    },
    mistake: {
      de: "Ball zu weit hinter dem Kopf treffen oder ohne Körperrotation nur aus dem Arm reißen.",
      en: "Contacting behind the head or pulling only with the arm without torso rotation.",
      es: "Impactar detrás de la cabeza o tirar solo de brazo sin rotación de tronco.",
    },
  },
  {
    id: "smash",
    category: "net",
    name: { de: "Smash", en: "Smash", es: "Remate" },
    level: { de: "Profi", en: "Pro", es: "Pro" },
    when: {
      de: "Nur gegen einen kurzen, zu flachen Lob nahe am Netz, um den Punkt direkt zu beenden.",
      en: "Only against a short lob close to the net to finish the point directly.",
      es: "Solo ante un globo corto cerca de la red para definir el punto.",
    },
    technique: {
      de: "Seitliche Trophy-Pose mit tiefer Beinladung, maximale Streckung über dem Kopf und explosiver Durchschwung Richtung linke Hüfte.",
      en: "Sideways trophy load with bent legs, full extension overhead, and explosive follow-through across the left hip.",
      es: "Posición lateral cargando piernas, máxima extensión arriba y terminación explosiva hacia la cadera izquierda.",
    },
    tactic: {
      de: "Entweder flach aufs eigene Feld zurückholen oder mit Topspin als Por 3 über die 3m-Seitenwand spielen.",
      en: "Either bring the ball back to your side or kick it with topspin Por 3 over the 3m side wall.",
      es: "Traerla a tu campo o sacarla por 3 metros por el lateral con efecto liftado.",
    },
    mistake: {
      de: "Zu weit hinten im Feld smashen - der Ball bleibt im Feld und der Gegner übernimmt sofort das Netz.",
      en: "Smashing from too far back, leaving a high rebound that lets opponents steal the net.",
      es: "Rematar desde demasiado atrás dejando un rebote alto que cede la red al rival.",
    },
  },
];

interface LabBoundaryProps {
  children: React.ReactNode;
}

class LabBoundary extends React.Component<LabBoundaryProps, { hasError: boolean }> {
  constructor(props: LabBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export interface ShotBasicsLab3DProps {
  racketId?: string | null;
  lowPerfMode?: boolean;
  initialShotId?: ShotGuideId;
  playRequestKey?: number;
}

export default function ShotBasicsLab3D({
  racketId,
  lowPerfMode = false,
  initialShotId = "forehand",
  playRequestKey = 0,
}: ShotBasicsLab3DProps) {
  const { lang } = useTranslation();

  const tr = (text: LocalizedText) =>
    lang === "en" ? text.en : lang === "es" ? text.es : text.de;

  const ui = (de: string, en: string, es: string) =>
    lang === "en" ? en : lang === "es" ? es : de;

  const [selectedId, setSelectedId] = useState<ShotGuideId>(initialShotId);
  const [activeAnim, setActiveAnim] = useState<PlayerAction>(initialShotId);
  const [triggerKey, setTriggerKey] = useState<number>(1);
  const [speed, setSpeed] = useState<0.35 | 1>(1);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const loopTimerRef = useRef<TimeoutHandle | null>(null);

  const equippedRacketId =
    racketId ||
    (typeof window !== "undefined"
      ? localStorage.getItem("tacpadel_racket_id") || "racket_starter"
      : "racket_starter");

  const selectedGuide =
    SHOT_GUIDES.find((g) => g.id === selectedId) || SHOT_GUIDES[0];

  const clearLoopTimer = () => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLoopTimer();
    };
  }, []);

  useEffect(() => {
    if (playRequestKey > 0) {
      clearLoopTimer();
      setSelectedId(initialShotId);
      setActiveAnim(initialShotId);
      setTriggerKey((k) => k + 1);
    }
  }, [initialShotId, playRequestKey]);

  const playShot = (shotId: ShotGuideId) => {
    clearLoopTimer();
    setSelectedId(shotId);
    setActiveAnim(shotId);
    setTriggerKey((k) => k + 1);
  };

  const handleActionFinished = () => {
    if (selectedId === "idle") return;
    if (loopEnabled) {
      clearLoopTimer();
      loopTimerRef.current = setTimeout(() => {
        setActiveAnim(selectedId);
        setTriggerKey((k) => k + 1);
      }, 450);
    } else {
      setActiveAnim("idle");
    }
  };

  const categories: Array<{ id: ShotCategory; title: string }> = [
    { id: "basics", title: ui("Grundlagen", "Fundamentals", "Fundamentos") },
    { id: "baseline", title: ui("Grundlinie", "Baseline", "Fondo de pista") },
    { id: "net", title: ui("Netz & Overhead", "Net & Overhead", "Red y aéreo") },
  ];

  return (
    <div className="w-full bg-[#050b14] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400 block">
            {ui("3D SCHLAG-LEXIKON", "3D SHOT ENCYCLOPEDIA", "ENCICLOPEDIA 3D DE GOLPES")}
          </span>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
            {ui("Alle Padel-Schläge im Detail", "All Padel Shots in Detail", "Todos los golpes de pádel")}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 0.35 : 1))}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
              speed === 0.35
                ? "bg-amber-500/25 border-amber-400 text-amber-300"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            {speed === 0.35 ? "Zeitlupe 0.35x" : "Tempo 1x"}
          </button>

          <button
            onClick={() => {
              const next = !loopEnabled;
              setLoopEnabled(next);
              if (next && selectedId !== "idle") {
                playShot(selectedId);
              } else {
                clearLoopTimer();
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
              loopEnabled
                ? "bg-cyan-500/25 border-cyan-400 text-cyan-300"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            {ui("Schleife", "Loop", "Bucle")}
          </button>

          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
              autoRotate
                ? "bg-purple-500/25 border-purple-400 text-purple-300"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            {ui("Drehen", "Rotate", "Girar")}
          </button>
        </div>
      </div>

      {/* Hauptbereich: 3D-Bühne links + Erklärung rechts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* 3D-Bühne */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <div className="w-full h-72 sm:h-80 lg:h-[400px] bg-[#020408] rounded-xl border border-slate-800 relative overflow-hidden cursor-grab active:cursor-grabbing">
            <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#050b18]/90 border border-cyan-500/40 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                {tr(selectedGuide.name)}
              </span>
              <span className="px-2 py-1 rounded-md bg-[#050b18]/85 border border-slate-700 text-[9px] font-bold uppercase tracking-wider text-slate-300">
                {tr(selectedGuide.level)}
              </span>
            </div>

            <div className="absolute bottom-2.5 left-3 z-10 pointer-events-none">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {ui("Ziehen zum Drehen | Zoomen möglich", "Drag to rotate | Pinch or scroll to zoom", "Arrastra para girar | Zoom activo")}
              </span>
            </div>

            <Canvas
              dpr={lowPerfMode ? 0.8 : 1.25}
              camera={{ position: [0, 1.15, 3.6], fov: 44 }}
              gl={{
                antialias: !lowPerfMode,
                powerPreference: "high-performance",
                precision: lowPerfMode ? "mediump" : "highp",
              }}
            >
              <AdaptiveDpr pixelated />
              <ambientLight intensity={2.4} />
              <directionalLight position={[1.5, 2.5, 3]} intensity={2.3} color="#ffffff" />
              {!lowPerfMode && (
                <>
                  <pointLight position={[-1.8, 1.6, 1.4]} intensity={12} color="#00f0ff" distance={9} />
                  <pointLight position={[1.8, 1.4, 1.2]} intensity={10} color="#f97316" distance={9} />
                </>
              )}

              <LabBoundary>
                <React.Suspense fallback={null}>
                  <AnimatedPadelPlayer
                    modelUrl="/meshy_player.glb"
                    racketId={equippedRacketId}
                    action={activeAnim}
                    triggerKey={triggerKey}
                    speed={speed}
                    showRacket={true}
                    position={[0, -0.92, 0]}
                    scale={1.12}
                    onActionFinished={handleActionFinished}
                  />
                </React.Suspense>
              </LabBoundary>

              <OrbitControls
                enableZoom={true}
                minDistance={2.1}
                maxDistance={5.2}
                enablePan={false}
                autoRotate={autoRotate}
                autoRotateSpeed={0.9}
                minPolarAngle={Math.PI / 3.2}
                maxPolarAngle={Math.PI / 1.85}
              />
            </Canvas>
          </div>

          <button
            onClick={() => playShot(selectedId)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[10px] uppercase tracking-[0.18em] transition-all shadow-lg"
          >
            {selectedId === "idle"
              ? ui("Grundstellung zentrieren", "Center Ready Stance", "Centrar posición base")
              : `${ui("Schlag abspielen", "Play Shot", "Reproducir golpe")}: ${tr(selectedGuide.name)}`}
          </button>
        </div>

        {/* Erklärungs-Karte */}
        <div className="lg:col-span-5 bg-[#030611] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-sm font-black uppercase tracking-wider text-white">
                {tr(selectedGuide.name)}
              </h4>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                {tr(selectedGuide.level)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">
                {ui("Wann spielen", "When to play", "Cuándo jugarlo")}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {tr(selectedGuide.when)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                {ui("Technik und Treffpunkt", "Technique and contact", "Técnica e impacto")}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {tr(selectedGuide.technique)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                {ui("Taktisches Ziel", "Tactical goal", "Objetivo táctico")}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {tr(selectedGuide.tactic)}
              </p>
            </div>

            <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-2.5 flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400">
                {ui("Typischer Fehler", "Common mistake", "Error común")}
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {tr(selectedGuide.mistake)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schlag-Auswahl nach Kategorien */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/80">
        {categories.map((cat) => {
          const items = SHOT_GUIDES.filter((g) => g.category === cat.id);
          return (
            <div key={cat.id} className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {cat.title}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => playShot(item.id)}
                    className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                      selectedId === item.id
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.35)]"
                        : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-white"
                    }`}
                  >
                    {tr(item.name)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

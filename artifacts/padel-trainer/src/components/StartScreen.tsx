import React from 'react';
import { Play, ClipboardList, BarChart3, Users, Calendar, Award } from 'lucide-react'; // Falls du Lucide-Icons nutzt

export default function StartScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between font-sans selection:bg-lime-400 selection:text-black">
      
      {/* 1. HEADER: Begrüßung */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Willkommen zurück</p>
          <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">
            Vamos, <span className="text-lime-400">Coach</span>!
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-lime-400 flex items-center justify-center shadow-lg shadow-lime-500/10">
          <span className="text-sm font-bold text-lime-400">P10</span>
        </div>
      </header>

      {/* HAUPTINHALT (Scrollbar auf dem Handy) */}
      <main className="flex-1 px-6 py-4 space-y-6 overflow-y-auto">
        
        {/* 2. HERO-CARD: Nächstes anstehendes Event / Quick Start */}
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          {/* Subtiler Glow im Hintergrund */}
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 text-lime-400 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400"></span>
            </span>
            Nächstes Training
          </div>
          
          <h3 className="text-lg font-bold text-white leading-tight">Match-Analyse & Vorhand-Technik</h3>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1.5">
            <Calendar size={14} /> Heute, 18:30 Uhr • Court 3
          </p>
          
          <button className="w-full mt-5 bg-lime-400 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-98 shadow-lg shadow-lime-400/20 text-sm">
            <Play size={16} fill="currentColor" /> Jetzt Training starten
          </button>
        </div>

        {/* 3. QUICK ACTIONS GRID (2x2 Layout perfekt für Daumen) */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">Spielfeld & Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            
            {/* Button 1: Taktikboard */}
            <button className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col items-start justify-between text-left transition-all active:scale-95 active:bg-zinc-850 h-32">
              <div className="p-3 bg-lime-400/10 text-lime-400 rounded-xl">
                <ClipboardList size={20} />
              </div>
              <div>
                <span className="block font-bold text-white text-sm">Taktikboard</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">Spielzüge planen</span>
              </div>
            </button>

            {/* Button 2: Übungskatalog */}
            <button className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col items-start justify-between text-left transition-all active:scale-95 active:bg-zinc-850 h-32">
              <div className="p-3 bg-blue-400/10 text-blue-400 rounded-xl">
                <Award size={20} />
              </div>
              <div>
                <span className="block font-bold text-white text-sm">Drills & Übungen</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">50+ Trainingsideen</span>
              </div>
            </button>

            {/* Button 3: Spieler / Teams */}
            <button className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col items-start justify-between text-left transition-all active:scale-95 active:bg-zinc-850 h-32">
              <div className="p-3 bg-purple-400/10 text-purple-400 rounded-xl">
                <Users size={20} />
              </div>
              <div>
                <span className="block font-bold text-white text-sm">Spielerprofile</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">Kader verwalten</span>
              </div>
            </button>

            {/* Button 4: Statistiken */}
            <button className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col items-start justify-between text-left transition-all active:scale-95 active:bg-zinc-850 h-32">
              <div className="p-3 bg-orange-400/10 text-orange-400 rounded-xl">
                <BarChart3 size={20} />
              </div>
              <div>
                <span className="block font-bold text-white text-sm">Erfolge</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">Fortschritte tracken</span>
              </div>
            </button>

          </div>
        </div>

        {/* 4. REZENTE AKTIVITÄT / MINI-LISTE */}
        <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Letzte Notizen</h3>
            <span className="text-xs text-lime-400 font-semibold">Alle anzeigen</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-3 bg-zinc-900 border border-zinc-800/50 rounded-xl text-xs">
              <span className="text-zinc-300 font-medium">Beidhand-Volley korrigiert (Lion)</span>
              <span className="text-zinc-500">Gestern</span>
            </div>
          </div>
        </div>

      </main>

      {/* 5. MOBILE BOTTOM NAVIGATION (Fest verankert für den App-Look) */}
      <nav className="bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800/80 px-6 py-4 flex justify-around items-center">
        <button className="text-lime-400 flex flex-col items-center gap-1">
          <Play size={18} fill="currentColor" />
          <span className="text-[10px] font-bold tracking-wide">Home</span>
        </button>
        <button className="text-zinc-500 flex flex-col items-center gap-1 active:text-zinc-300">
          <ClipboardList size={18} />
          <span className="text-[10px] font-medium tracking-wide">Taktik</span>
        </button>
        <button className="text-zinc-500 flex flex-col items-center gap-1 active:text-zinc-300">
          <Users size={18} />
          <span className="text-[10px] font-medium tracking-wide">Kader</span>
        </button>
      </nav>

    </div>
  );
}
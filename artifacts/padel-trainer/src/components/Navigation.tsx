interface NavigationProps {
  activeTab: any;
  setActiveTab: (tab: any) => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 tech-panel border-t border-border z-50 pb-safe shadow-lg bg-[#050b15]/95 backdrop-blur-sm">
      <div className="flex justify-around items-center h-16">
        
        {/* Button 1: Home */}
        <button 
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            activeTab === "home" ? "text-primary" : "text-muted-foreground hover:text-primary/70"
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        {/* Button 2: Trainer */}
        <button 
          onClick={() => setActiveTab("trainer")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            activeTab === "trainer" ? "text-primary" : "text-muted-foreground hover:text-primary/70"
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Trainer</span>
        </button>

        {/* Button 3: Story-Modus (NEU IN DER MITTE!) */}
        <button 
          onClick={() => setActiveTab("game")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            activeTab === "game" ? "text-primary" : "text-muted-foreground hover:text-primary/70"
          }`}
        >
          {/* Gamepad Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z M6 12h4 M8 10v4 M15 12h.01 M18 12h.01" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Game</span>
        </button>

        {/* Button 4: Taktik-Board */}
        <button 
          onClick={() => setActiveTab("taktik")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            activeTab === "taktik" ? "text-primary" : "text-muted-foreground hover:text-primary/70"
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Taktik</span>
        </button>

        {/* Button 5: Basics */}
        <button 
          onClick={() => setActiveTab("basics")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            activeTab === "basics" ? "text-primary" : "text-muted-foreground hover:text-primary/70"
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Basics</span>
        </button>

      </div>
    </nav>
  );
}
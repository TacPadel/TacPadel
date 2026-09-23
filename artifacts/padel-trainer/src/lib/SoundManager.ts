// lib/SoundManager.ts

class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private isMuted: boolean = false;

  constructor() {
    // Hier laden wir alle Sound-Files vor (Preloading), damit es keine Lags gibt.
    // TIPP: Du brauchst ein paar kurze mp3/wav Dateien in deinem /public Ordner.
    this.sounds = {
      hit_soft: new Audio('/sounds/hit_soft.mp3'),     // Für Lob, Block, Chiquita
      hit_hard: new Audio('/sounds/hit_hard.mp3'),     // Für Drive, Volley, Bandeja
      hit_smash: new Audio('/sounds/hit_smash.mp3'),   // Für Smash, Vibora, Perfekte Schläge
      bounce_glass: new Audio('/sounds/glass.mp3'),    // Ball prallt an die Scheibe
      error_net: new Audio('/sounds/net_hit.mp3'),     // Ball im Netz
      crowd_cheer: new Audio('/sounds/cheer.mp3'),     // Winner / Perfekt (Publikum jubelt kurz)
      crowd_gasp: new Audio('/sounds/gasp.mp3'),       // Unforced Error (Publikum stöhnt auf)
      ui_click: new Audio('/sounds/ui_click.mp3'),     // Button Click (optional)
    };

    // Lautstärke für Hintergrund-Elemente etwas anpassen
    if (this.sounds.crowd_cheer) this.sounds.crowd_cheer.volume = 0.5;
    if (this.sounds.crowd_gasp) this.sounds.crowd_gasp.volume = 0.4;
    if (this.sounds.ui_click) this.sounds.ui_click.volume = 0.2;
  }

  public play(soundName: keyof typeof this.sounds) {
    if (this.isMuted) return;
    
    const sound = this.sounds[soundName];
    if (sound) {
      // Klonen des Audio-Objekts, damit der gleiche Sound schnell hintereinander abgespielt werden kann
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = sound.volume;
      clone.play().catch(e => console.warn("Audio play blocked by browser:", e));
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMutedState() {
    return this.isMuted;
  }
}

// Wir exportieren eine Singleton-Instanz. So gibt es nur EINEN SoundManager in der ganzen App.
export const soundManager = new SoundManager();
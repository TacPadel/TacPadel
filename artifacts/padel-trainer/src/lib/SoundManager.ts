// src/lib/SoundManager.ts

class SoundManager {
  private ctx: AudioContext | null = null;

  // Initialisiert den AudioContext bei der ersten Nutzer-Interaktion (wichtig für iOS & Android)
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // Hilfsfunktion: Erzeugt kurzes Rauschen (für Schläger-Aufprall, Netz & Atmosphäre)
  private playNoise(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType = "bandpass",
    volume: number = 0.2
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  public play(soundId: string) {
    // Respektiert deine bestehende Sound-Einstellung aus dem LocalStorage
    if (typeof window !== "undefined" && localStorage.getItem("tacpadel_sound") === "false") {
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (soundId) {
      // 💥 1. SMASH / VIBORA / VOLLEY (Satter Bass-Punch + scharfer Schläger-Impuls)
      case "hit_smash": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);

        // Knackiger Treffer-Impuls
        this.playNoise(0.09, 1400, "bandpass", 0.35);
        break;
      }

      // 🎾 2. DRIVE / AUFSCHLAG (Solider, druckvoller Padel-Schlag)
      case "hit_hard": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.13);

        this.playNoise(0.06, 1000, "bandpass", 0.2);
        break;
      }

      // 🪶 3. LOB / CHIQUITA / BLOCK (Weicher, kontrollierter Touch)
      case "hit_soft": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(125, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.1);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);

        this.playNoise(0.04, 600, "lowpass", 0.12);
        break;
      }

      // 🪟 4. GLASWAND-TREFFER (Heller, gläserner Resonanz-Ping)
      case "bounce_glass": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.14);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);

        this.playNoise(0.05, 2400, "bandpass", 0.18);
        break;
      }

      // 🕸️ 5. NETZFEHLER (Dumpfes Abstoppen im Netzband)
      case "error_net": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.24);

        // kurzes Netz-Rascheln
        this.playNoise(0.18, 450, "lowpass", 0.22);
        break;
      }

      // 🏆 6. PUNKTGEWINN / JUBEL (Aufsteigender Tron-Synth-Akkord + leichter Jubel-Swell)
      case "crowd_cheer": {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startTime = now + idx * 0.065;

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.46);
        });
        break;
      }

      // ❌ 7. FEHLER / ENTTÄUSCHTES RAUNEN (Abfallender Synth-Ton)
      case "crowd_gasp": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.38);
        break;
      }

      default:
        break;
    }
  }
}

export const soundManager = new SoundManager();
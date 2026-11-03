// src/lib/SoundManager.ts

class SoundManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // Erzeugt kurzes Rauschen (für Schläger-Aufprall, Netz & Hall-Fahne)
  private playNoise(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType = "bandpass",
    volume: number = 0.2,
    delayOffset: number = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delayOffset;
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
    filter.frequency.setValueAtTime(filterFreq, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // Einzelner Schlag-Impuls (wird für normale Schläge und für die Echo-Kaskade genutzt)
  private triggerImpact(
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    noiseFreq: number,
    noiseVol: number,
    delayOffset: number = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delayOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    if (noiseVol > 0) {
      this.playNoise(duration * 0.6, noiseFreq, "bandpass", noiseVol, delayOffset);
    }
  }

  public play(soundId: string) {
    if (typeof window !== "undefined" && localStorage.getItem("tacpadel_sound") === "false") {
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (soundId) {
      // 💥 1. SMASH / VIBORA / VOLLEY (Kräftiger, trockener Schläger-Punch)
      case "hit_smash": {
        this.triggerImpact(230, 40, 0.18, 0.55, 1400, 0.4, 0);
        break;
      }

      // 🎾 2. DRIVE / AUFSCHLAG (Solider Grundschlag)
      case "hit_hard": {
        this.triggerImpact(165, 52, 0.13, 0.38, 1000, 0.22, 0);
        break;
      }

      // 🪶 3. LOB / CHIQUITA / BLOCK (Weicher Touch)
      case "hit_soft": {
        this.triggerImpact(125, 65, 0.1, 0.22, 600, 0.1, 0);
        break;
      }

      // 🪟 4. GLASWAND-TREFFER (Dumpf-gläserner Rückprall)
      case "bounce_glass": {
        this.triggerImpact(380, 110, 0.14, 0.32, 2200, 0.18, 0);
        break;
      }

      // 🕸️ 5. NETZFEHLER (Dumpfes Abstoppen im Netzband)
      case "error_net": {
        this.triggerImpact(95, 28, 0.22, 0.3, 400, 0.25, 0);
        break;
      }

      // 🏆 6. PUNKTGEWINN-ECHO (Wuchtiger Bass-Boom + 3-faches Arena-Echo statt Münz-Sound!)
      case "crowd_cheer": {
        // Tiefer Sub-Bass-Wumms beim Aufprall des Winners
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(110, now);
        subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.45);

        subGain.gain.setValueAtTime(0.65, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.48);

        // Stadion-Echo-Kaskade (Hall des Schlags in der Arena)
        const echoes = [
          { delay: 0.0, vol: 0.45, noise: 0.35, freq: 1300 },
          { delay: 0.11, vol: 0.26, noise: 0.2, freq: 1000 },
          { delay: 0.23, vol: 0.14, noise: 0.1, freq: 750 },
          { delay: 0.36, vol: 0.07, noise: 0.05, freq: 550 },
        ];

        echoes.forEach((e) => {
          this.triggerImpact(200, 38, 0.16, e.vol, e.freq, e.noise, e.delay);
        });
        break;
      }

      // ❌ 7. FEHLER-AUSKLANG (Kein Synth-Ton mehr, nur kurzes, tiefes Ausrollen)
      case "crowd_gasp": {
        this.triggerImpact(80, 30, 0.2, 0.18, 350, 0.08, 0.08);
        break;
      }

      default:
        break;
    }
  }
}

export const soundManager = new SoundManager();

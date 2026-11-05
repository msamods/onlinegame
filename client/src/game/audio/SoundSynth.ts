// Procedural Web Audio API Sound Synthesizer
// Completely eliminates external audio asset loading failures

export class SoundSynth {
  private static instance: SoundSynth;
  private ctx: AudioContext | null = null;
  public sfxVolume: number = 0.7;
  public musicVolume: number = 0.4;
  public isMuted: boolean = false;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isMusicPlaying: boolean = false;

  private constructor() {
    const savedSfx = localStorage.getItem('tactical_sfx_volume');
    const savedMusic = localStorage.getItem('tactical_music_volume');
    const savedMute = localStorage.getItem('tactical_muted');

    if (savedSfx !== null) this.sfxVolume = parseFloat(savedSfx);
    if (savedMusic !== null) this.musicVolume = parseFloat(savedMusic);
    if (savedMute !== null) this.isMuted = savedMute === 'true';
  }

  public static getInstance(): SoundSynth {
    if (!SoundSynth.instance) {
      SoundSynth.instance = new SoundSynth();
    }
    return SoundSynth.instance;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('tactical_muted', String(muted));
    if (this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(muted ? 0 : this.musicVolume * 0.15, this.ctx?.currentTime || 0);
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('tactical_sfx_volume', String(this.sfxVolume));
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('tactical_music_volume', String(this.musicVolume));
    if (this.ambientGain && !this.isMuted) {
      this.ambientGain.gain.setValueAtTime(this.musicVolume * 0.15, this.ctx?.currentTime || 0);
    }
  }

  // Helper for creating burst noise
  private createNoiseBuffer(): AudioBuffer {
    const bufferSize = this.ctx!.sampleRate * 1.5;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Weapon Sounds
  public playGunshot(weapon: string) {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.sfxVolume, t);
    masterGain.connect(this.ctx.destination);

    switch (weapon) {
      case 'pistol': {
        // Sharp pop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.14);

        // White noise transient
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(1200, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.6, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.09);
        break;
      }

      case 'assault_rifle': {
        // Punchy crack
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.16);

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'highpass';
        nFilter.frequency.setValueAtTime(1800, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.7, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.1);
        break;
      }

      case 'shotgun': {
        // Deep boom + wide noise spread
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.28);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.3);

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(2400, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.9, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.24);
        break;
      }

      case 'sniper_rifle': {
        // Sharp supersonic crack with long echo
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
        gain.gain.setValueAtTime(1.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.38);

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(2200, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(1.0, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.26);
        break;
      }

      case 'grenade_launcher': {
        // Low launch thump
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.2);
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }
    }
  }

  // Explosion
  public playExplosion() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.sfxVolume, t);
    masterGain.connect(this.ctx.destination);

    // Deep sub bass boom
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, t);
    sub.frequency.exponentialRampToValueAtTime(25, t + 0.7);
    subGain.gain.setValueAtTime(1.2, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    sub.connect(subGain);
    subGain.connect(masterGain);
    sub.start(t);
    sub.stop(t + 0.75);

    // Rumbling noise blast
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.6);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(1.0, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.7);
  }

  public playReload() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Metallic clip eject & insert click-clack
    [0, 0.25].forEach(delay => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, t + delay);
      osc.frequency.exponentialRampToValueAtTime(300, t + delay + 0.06);
      gain.gain.setValueAtTime(0.4 * this.sfxVolume, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.07);
    });
  }

  public playJump() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.15);
    gain.gain.setValueAtTime(0.3 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playHit() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    gain.gain.setValueAtTime(0.6 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playDeath() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Solemn chime
    [220, 185, 146].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.15);
      gain.gain.setValueAtTime(0.5 * this.sfxVolume, t + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + idx * 0.15);
      osc.stop(t + idx * 0.15 + 0.45);
    });
  }

  // Procedural Military Drone BGM
  public startAmbientMusic() {
    if (this.isMusicPlaying) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();

    this.ambientOsc.type = 'sawtooth';
    this.ambientOsc.frequency.setValueAtTime(55, t); // Low A

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, t);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.2, t); // slow pulse
    lfoGain.gain.setValueAtTime(40, t);
    lfo.connect(filter.frequency);
    lfo.start();

    const targetGain = this.isMuted ? 0 : this.musicVolume * 0.12;
    this.ambientGain.gain.setValueAtTime(targetGain, t);

    this.ambientOsc.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);

    this.ambientOsc.start();
    this.isMusicPlaying = true;
  }
}

export const sound = SoundSynth.getInstance();


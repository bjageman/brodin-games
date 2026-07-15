class AudioManager {
  private ctx: AudioContext | null = null;
  private ambientSource: AudioBufferSourceNode[] = [];
  private ambientGain: GainNode | null = null;
  private isMuted: boolean = true; // Start muted to respect browser autoplay policies
  private masterGain: GainNode | null = null;
  private timerId: any = null;

  private initCtx() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  getMuted() {
    return this.isMuted;
  }

  mute() {
    this.isMuted = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  unmute() {
    this.isMuted = false;
    this.initCtx();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
  }

  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  playSuccess() {
    this.initCtx();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(master);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.5);
    });
  }

  playFailure() {
    this.initCtx();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    
    [110, 108.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  playTick() {
    this.initCtx();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playClick() {
    this.initCtx();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  startAmbientNoise() {
    this.initCtx();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;

    if (this.ambientGain) return;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.08;
    this.ambientGain.connect(master);

    const bufferSize = 10 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    noiseNode.connect(filter);
    filter.connect(this.ambientGain);
    
    noiseNode.start(0);
    this.ambientSource.push(noiseNode);

    this.scheduleRandomOfficeSounds();
  }

  stopAmbientNoise() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.ambientSource.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    this.ambientSource = [];
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  private scheduleRandomOfficeSounds() {
    if (!this.ctx || this.ambientSource.length === 0) return;
    
    const scheduleNext = () => {
      if (this.ambientSource.length === 0) return;
      const delay = Math.random() * 8000 + 4000;
      
      this.timerId = setTimeout(() => {
        if (this.ambientSource.length === 0) return;
        this.playRandomOfficeSound();
        scheduleNext();
      }, delay);
    };
    
    scheduleNext();
  }

  private playRandomOfficeSound() {
    const ctx = this.ctx;
    const gainNode = this.ambientGain;
    if (!ctx || !gainNode || this.isMuted) return;
    
    const now = ctx.currentTime;
    const type = Math.random() > 0.5 ? 'keyboard' : 'phone';
    
    if (type === 'keyboard') {
      const numClacks = Math.floor(Math.random() * 6) + 4;
      for (let i = 0; i < numClacks; i++) {
        const time = now + i * (Math.random() * 0.1 + 0.08);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(Math.random() * 300 + 600, time);
        
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.015, time + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
        
        osc.connect(g);
        g.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.04);
      }
    } else {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);
      
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.008, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      
      const secondRingTime = now + 0.5;
      g.gain.setValueAtTime(0, secondRingTime);
      g.gain.linearRampToValueAtTime(0.008, secondRingTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, secondRingTime + 0.4);
      
      osc1.connect(g);
      osc2.connect(g);
      g.connect(gainNode);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.0);
      osc2.stop(now + 1.0);
    }
  }
}

export const audioManager = new AudioManager();

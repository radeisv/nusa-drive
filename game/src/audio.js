export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOscA = null;
  let sirenOscB = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicOn = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function fadeOut(gain, vol, dur) {
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      fadeOut(gain, vol, dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
    }
  }

  function noiseHit(dur, vol, filterFreq) {
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 800;
      const gain = ctx.createGain();
      fadeOut(gain, vol, dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
    }
  }

  return {
    ensure,
    get ready() { return ctx !== null; },
    /** Continuous engine hum; call every frame with 0..1 throttle/speed. */
    setEngine(level, on) {
      if (!ctx) return;
      try {
        if (!on) {
          if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          return;
        }
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineFilter = ctx.createBiquadFilter();
          engineFilter.type = 'lowpass';
          engineFilter.frequency.value = 400;
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          engineOsc.connect(engineFilter);
          engineFilter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(50 + level * 140, ctx.currentTime, 0.05);
        engineFilter.frequency.setTargetAtTime(300 + level * 900, ctx.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(0.05 + level * 0.06, ctx.currentTime, 0.05);
      } catch {
      }
    },
    /** Two-tone police siren while wanted; call with false to stop it. */
    setSiren(on) {
      if (!ctx) return;
      try {
        if (!on) {
          if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
          return;
        }
        if (!sirenOscA) {
          sirenOscA = ctx.createOscillator();
          sirenOscB = ctx.createOscillator();
          sirenOscA.type = 'triangle';
          sirenOscB.type = 'triangle';
          sirenOscA.frequency.value = 660;
          sirenOscB.frequency.value = 880;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 1.4;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.02;
          lfo.connect(lfoGain);
          lfoGain.connect(sirenGain.gain);
          sirenOscA.connect(sirenGain);
          sirenOscB.connect(sirenGain);
          sirenGain.connect(master);
          sirenOscA.start();
          sirenOscB.start();
          lfo.start();
        }
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
      } catch {
      }
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.25, 1320);
      setTimeout(() => blip(1320, 0.18, 'sine', 0.2), 90);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.22);
      setTimeout(() => blip(1568, 0.16, 'triangle', 0.2), 80);
    },
    impact(strength) {
      noiseHit(0.18, Math.min(0.5, 0.15 + strength * 0.3), 500);
      blip(90, 0.15, 'sine', 0.3, 50);
    },
    shot() {
      noiseHit(0.12, 0.4, 2400);
    },
    punch() {
      noiseHit(0.1, 0.3, 700);
    },
    honk() {
      blip(370, 0.25, 'square', 0.12, 370);
      blip(466, 0.25, 'square', 0.1, 466);
    },
    click() {
      blip(600, 0.05, 'square', 0.12);
    },
    busted() {
      blip(330, 0.3, 'sawtooth', 0.2, 220);
      setTimeout(() => blip(220, 0.5, 'sawtooth', 0.2, 110), 250);
    },
    /** A slow, warm two-chord loop (Am7 – Fmaj7) on soft triangle waves. */
    startMusic() {
      if (!ctx || musicOn) return;
      musicOn = true;
      const chords = [
        [220, 261.6, 329.6, 392],
        [174.6, 220, 261.6, 329.6],
      ];
      let step = 0;
      const playNote = (freq, when, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.05, when + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
      };
      const tick = () => {
        if (!musicOn || !ctx) return;
        const chord = chords[Math.floor(step / 4) % chords.length];
        const note = chord[step % 4];
        playNote(note, ctx.currentTime + 0.02, 1.8);
        if (step % 2 === 0) playNote(note / 2, ctx.currentTime + 0.02, 1.8);
        step += 1;
        musicTimer = setTimeout(tick, 450);
      };
      tick();
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) clearTimeout(musicTimer);
      musicTimer = null;
    },
  };
}

const STATIONS = [
  {
    call: 'WAVE 88.1', genre: 'Neon Drive', track: 'Pink Horizon',
    bpm: 96, root: 110, bassWave: 'sawtooth', leadWave: 'triangle', bassVol: 0.09, leadVol: 0.05,
    chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]],
    bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 0, 10, 0],
    lead: [12, null, 15, 19, null, 15, null, 12, null, 19, 22, null, 19, 15, 12, null],
  },
  {
    call: 'PALM FM 92.4', genre: 'Sunset Pop', track: 'Golden Hour',
    bpm: 112, root: 130.81, bassWave: 'sine', leadWave: 'square', bassVol: 0.11, leadVol: 0.03,
    chords: [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]],
    bass: [0, null, 0, null, 7, null, 0, null, 9, null, 9, null, 5, null, 7, null],
    lead: [12, 16, null, 19, 16, null, 12, null, 14, null, 16, 19, 21, 19, 16, null],
  },
  {
    call: 'NUSA ROCK 101', genre: 'Drive Rock', track: 'Midnight Run',
    bpm: 132, root: 82.41, bassWave: 'square', leadWave: 'square', bassVol: 0.07, leadVol: 0.035,
    chords: [[0, 7], [5, 12], [3, 10], [-2, 5]],
    bass: [0, 0, 0, 7, 0, 0, 12, 0, 0, 0, 0, 7, 10, 0, 12, 7],
    lead: [12, null, 12, 15, null, 12, null, 19, 17, 15, null, 12, null, 15, 17, 19],
  },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenA = null;
  let sirenB = null;
  let sirenGain = null;
  let seqTimer = null;
  let seqOn = false;
  let station = 0;
  let step = 0;
  let nextTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuf(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function decay(gain, vol, dur) {
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      decay(gain, vol, dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
    }
  }

  function thud(dur, vol, cutoff) {
    if (!ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 800;
      const gain = ctx.createGain();
      decay(gain, vol, dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
    }
  }

  function semi(root, steps) {
    return root * Math.pow(2, steps / 12);
  }

  function scheduleNote(freq, when, dur, type, vol) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(vol, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    } catch {
    }
  }

  function scheduleStep(index, when) {
    const st = STATIONS[station];
    const bar = Math.floor(index / 16) % st.chords.length;
    const pos = index % 16;
    const beat = 60 / st.bpm / 2;
    if (pos === 0) {
      for (const n of st.chords[bar]) scheduleNote(semi(st.root, n) * 2, when, beat * 8, 'triangle', 0.035);
    }
    const b = st.bass[pos];
    if (b !== null && b !== undefined) scheduleNote(semi(st.root, b), when, beat * 0.9, st.bassWave, st.bassVol);
    const l = st.lead[pos];
    if (l !== null && l !== undefined) scheduleNote(semi(st.root, l) * 2, when, beat * 1.4, st.leadWave, st.leadVol);
  }

  function pump() {
    if (!seqOn || !ctx) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2;
    while (nextTime < ctx.currentTime + 0.3) {
      scheduleStep(step, nextTime);
      step += 1;
      nextTime += beat;
    }
  }

  function startSequencer() {
    if (!ctx || seqOn) return;
    seqOn = true;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    pump();
    seqTimer = setInterval(pump, 110);
  }

  function stopSequencer() {
    seqOn = false;
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = null;
  }

  return {
    ensure,
    get ready() { return ctx !== null; },
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
    setSiren(on) {
      if (!ctx) return;
      try {
        if (!on) {
          if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
          return;
        }
        if (!sirenA) {
          sirenA = ctx.createOscillator();
          sirenB = ctx.createOscillator();
          sirenA.type = 'triangle';
          sirenB.type = 'triangle';
          sirenA.frequency.value = 660;
          sirenB.frequency.value = 880;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 1.4;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.02;
          lfo.connect(lfoGain);
          lfoGain.connect(sirenGain.gain);
          sirenA.connect(sirenGain);
          sirenB.connect(sirenGain);
          sirenGain.connect(master);
          sirenA.start();
          sirenB.start();
          lfo.start();
        }
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
      } catch {
      }
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.25, 1320);
      setTimeout(() => tone(1320, 0.18, 'sine', 0.2), 90);
    },
    cash() {
      tone(1046, 0.1, 'triangle', 0.22);
      setTimeout(() => tone(1568, 0.16, 'triangle', 0.2), 80);
    },
    impact(strength) {
      thud(0.18, Math.min(0.5, 0.15 + strength * 0.3), 500);
      tone(90, 0.15, 'sine', 0.3, 50);
    },
    shot() {
      thud(0.12, 0.4, 2400);
    },
    punch() {
      thud(0.1, 0.3, 700);
    },
    honk() {
      tone(370, 0.25, 'square', 0.12, 370);
      tone(466, 0.25, 'square', 0.1, 466);
    },
    click() {
      tone(600, 0.05, 'square', 0.12);
    },
    busted() {
      tone(330, 0.3, 'sawtooth', 0.2, 220);
      setTimeout(() => tone(220, 0.5, 'sawtooth', 0.2, 110), 250);
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      if (seqOn && ctx) {
        step = 0;
        nextTime = ctx.currentTime + 0.05;
      }
      return STATIONS[station];
    },
    stationInfo() {
      const st = STATIONS[station];
      return { station: `${st.call} · ${st.genre}`, track: st.track };
    },
    startMusic() {
      startSequencer();
    },
    stopMusic() {
      stopSequencer();
    },
  };
}

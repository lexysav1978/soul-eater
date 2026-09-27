'use strict';
// Все звуки генерируются через Web Audio API — никаких файлов не нужно.
const Sound = (() => {
  let ctx = null, master, noiseBuf, windGain, windFilter, droneGain, droneFilter;
  let muted = false;
  let heartT = 0, dripT = 4, windT = 0, distCurve = null, engine = null, pad = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Ветер
    const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0.04;
    w.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); w.start();

    // Ночной гул
    droneGain = ctx.createGain(); droneGain.gain.value = 0;
    droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 200;
    [55, 58.3, 82.4, 110.7].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(droneFilter); o.start();
    });
    droneFilter.connect(droneGain); droneGain.connect(master);
  }

  function env(g, t0, a, dur, vol) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function noise(dur, type, freq, q, vol, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.005, dur, vol);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type, vol, freqEnd, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, 0.01, dur, vol);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  function distortion() {
    if (!distCurve) {
      distCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 8); }
    }
    const ws = ctx.createWaveShaper(); ws.curve = distCurve; return ws;
  }

  function growl(vol = 0.5) {
    if (!ctx || vol < 0.02) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(75, t); o.frequency.linearRampToValueAtTime(48, t + 1.8);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 0.6;
    const trem = ctx.createGain(); trem.gain.value = 0.7;
    lfo.connect(lg); lg.connect(trem.gain);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 2);
    o.connect(distortion()).connect(lp).connect(trem).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 2.1); lfo.stop(t + 2.1);
    noise(1.6, 'lowpass', 250, 1, vol * 0.5);
  }

  function scream(vol = 0.7) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    const dist = distortion();
    dist.connect(bp); bp.connect(g); g.connect(master);
    [620, 690, 940, 1330].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 1.4);
      const vib = ctx.createOscillator(); vib.frequency.value = 17 + i * 3;
      const vg = ctx.createGain(); vg.gain.value = f * 0.04;
      vib.connect(vg); vg.connect(o.frequency);
      o.connect(dist); o.start(t); vib.start(t); o.stop(t + 1.6); vib.stop(t + 1.6);
    });
    noise(1.2, 'highpass', 2000, 0.5, vol * 0.6);
  }

  const api = {
    init,
    get ready() { return !!ctx; },
    step(run) { noise(0.09, 'lowpass', run ? 750 : 520, 1, run ? 0.2 : 0.13); },
    chop() { noise(0.15, 'lowpass', 900, 1, 0.5); tone(140, 0.15, 'triangle', 0.3, 60); },
    treeFall() { noise(0.9, 'lowpass', 300, 0.7, 0.6); tone(90, 0.8, 'triangle', 0.3, 30, 0.1); },
    snap() { noise(0.06, 'highpass', 1500, 1, 0.35); noise(0.05, 'bandpass', 2600, 2, 0.3, 0.07); },
    pick() { tone(520, 0.12, 'sine', 0.15, 780); },
    dig() { noise(0.3, 'lowpass', 380, 0.8, 0.55); },
    craft() { tone(300, 0.1, 'square', 0.06); tone(450, 0.15, 'square', 0.06, null, 0.1); },
    mineHit() { tone(1900, 0.25, 'triangle', 0.15, 1500); noise(0.1, 'highpass', 3000, 1, 0.3); },
    click() { tone(900, 0.04, 'square', 0.05); },
    whisper() { for (let i = 0; i < 6; i++) noise(0.4 + Math.random() * 0.5, 'bandpass', 2400 + Math.random() * 2400, 9, 0.12, i * 0.33); },
    heartbeat(vol) { tone(58, 0.14, 'sine', vol, 40); tone(52, 0.14, 'sine', vol * 0.8, 38, 0.2); },
    stinger() {
      [1180, 1250, 1320, 1410].forEach((f, i) => tone(f, 1.4, 'sawtooth', 0.035, f * 0.97, i * 0.02));
      tone(70, 1.5, 'sawtooth', 0.12, 40);
    },
    transform() { tone(220, 2.6, 'sawtooth', 0.18, 30); growl(0.7); setTimeout(() => scream(0.5), 1400); },
    chime() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.6, 'sine', 0.12, null, i * 0.12)); },
    dawn() { [262, 330, 392].forEach((f, i) => tone(f, 3, 'sine', 0.06, null, i * 0.3)); },
    laugh() {
      for (let i = 0; i < 6; i++) {
        const f = 950 - i * 45 + Math.random() * 60;
        tone(f, 0.11, 'sine', 0.09, f * 0.8, i * 0.14);
        tone(f * 2.01, 0.1, 'sine', 0.03, f * 1.6, i * 0.14);
      }
    },
    knock() { for (let i = 0; i < 3; i++) { noise(0.08, 'lowpass', 260, 1, 0.6, i * 0.38); tone(85, 0.1, 'sine', 0.35, 60, i * 0.38); } },
    stepsBehind() { for (let i = 0; i < 5; i++) noise(0.1, 'lowpass', 480, 1, 0.08 + i * 0.05, i * 0.45); },
    breath() { noise(1.2, 'bandpass', 900, 1.5, 0.12); noise(1.0, 'bandpass', 700, 1.5, 0.1, 1.4); },
    // Выключить / включить весь звук
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
      if (muted) try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    },
    get muted() { return muted; },
    // Жуткий голос: синтез речи с очень низким тоном + шёпот
    voice(text) {
      api.whisper();
      if (muted) return;
      try {
        const s = window.speechSynthesis;
        if (!s) return;
        const u = new SpeechSynthesisUtterance(text);
        const v = s.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ru'));
        if (v) u.voice = v;
        u.lang = 'ru-RU'; u.pitch = 0.05; u.rate = 0.72; u.volume = 0.6;
        s.cancel(); s.speak(u);
      } catch (e) { /* синтез речи недоступен */ }
    },
    // Гул двигателей самолёта
    engine(on) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (on && !engine) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 96;
        const og = ctx.createGain(); og.gain.value = 0.05;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
        s.connect(f); f.connect(g); o.connect(og); og.connect(lp); lp.connect(g); g.connect(master);
        s.start(); o.start();
        g.gain.setTargetAtTime(0.32, now, 1.2);
        engine = { s, o, g };
      } else if (!on && engine) {
        const e = engine; engine = null;
        e.g.gain.setTargetAtTime(0.0001, now, 0.4);
        setTimeout(() => { try { e.s.stop(); e.o.stop(); } catch (err) { /* уже остановлен */ } }, 2000);
      }
    },
    creak() { tone(170, 1.8, 'sawtooth', 0.05, 80); noise(1.6, 'bandpass', 620, 7, 0.14); noise(0.8, 'bandpass', 900, 9, 0.08, 0.6); },
    bird() {
      const f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone(f + Math.random() * 400, 0.08, 'sine', 0.04, f * (Math.random() < 0.5 ? 1.3 : 0.8), i * 0.11);
    },
    wave() { noise(3, 'lowpass', 500, 0.6, 0.18); noise(2.4, 'highpass', 2500, 0.5, 0.03, 0.4); },
    boom(vol = 0.3) { tone(45, 0.9, 'sine', vol, 28); noise(0.7, 'lowpass', 120, 1, vol * 0.8); },
    bellNote(f) { tone(f, 2.2, 'sine', 0.2); tone(f * 2.01, 1.5, 'sine', 0.07); tone(f * 3.02, 0.8, 'triangle', 0.03); },
    buzz() { tone(110, 0.5, 'square', 0.08, 90); tone(116, 0.5, 'square', 0.06, 94); },
    // Тихий «хор» рая
    pad(on) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (on && !pad) {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(master);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g);
        const oscs = [261.6, 329.6, 392, 523.3, 196].map((f, i) => {
          const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15 + i * 0.07;
          const lg = ctx.createGain(); lg.gain.value = f * 0.004; lfo.connect(lg); lg.connect(o.frequency);
          o.connect(lp); o.start(); lfo.start();
          return [o, lfo];
        });
        g.gain.setTargetAtTime(0.035, now, 2);
        pad = { g, oscs };
      } else if (!on && pad) {
        const p = pad; pad = null;
        p.g.gain.setTargetAtTime(0.0001, now, 0.8);
        setTimeout(() => p.oscs.forEach(([o, l]) => { try { o.stop(); l.stop(); } catch (e) { /* уже остановлен */ } }), 3000);
      }
    },
    jump() { noise(0.12, 'lowpass', 650, 1, 0.14); tone(180, 0.1, 'sine', 0.05, 240); },
    rumble() { noise(2.2, 'lowpass', 110, 1, 0.9); noise(1.5, 'lowpass', 200, 1, 0.5, 0.6); },
    bell() { tone(880, 0.7, 'sine', 0.14); tone(660, 0.9, 'sine', 0.14, null, 0.4); },
    say(text, pitch = 1, rate = 1) {
      if (muted) return;
      try {
        const s = window.speechSynthesis;
        if (!s) return;
        const u = new SpeechSynthesisUtterance(text);
        const v = s.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ru'));
        if (v) u.voice = v;
        u.lang = 'ru-RU'; u.pitch = pitch; u.rate = rate; u.volume = 0.8;
        s.cancel(); s.speak(u);
      } catch (e) { /* синтез речи недоступен */ }
    },
    growl, scream,
    update(dt, nightK, fear, inMine, inPlane) {
      if (!ctx) return;
      const now = ctx.currentTime;
      windT += dt;
      const windTarget = inPlane ? 0.002 :  inMine ? 0.008 : 0.03 + nightK * 0.04 + Math.sin(windT * 0.3) * 0.015;
      windGain.gain.setTargetAtTime(windTarget, now, 0.5);
      windFilter.frequency.setTargetAtTime(350 + Math.sin(windT * 0.21) * 150, now, 0.5);
      droneGain.gain.setTargetAtTime(nightK * 0.03 + (fear / 100) * 0.07 + (inMine ? 0.02 : 0), now, 0.8);
      droneFilter.frequency.setTargetAtTime(160 + fear * 3, now, 0.5);
      if (fear > 45) {
        heartT -= dt;
        if (heartT <= 0) { heartT = 1.25 - (fear / 100) * 0.75; api.heartbeat(0.15 + fear / 250); }
      }
      if (inMine) {
        dripT -= dt;
        if (dripT <= 0) { dripT = 1.5 + Math.random() * 4; tone(1400 + Math.random() * 900, 0.12, 'sine', 0.05, 700); }
      }
    }
  };
  return api;
})();

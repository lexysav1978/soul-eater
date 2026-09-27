'use strict';
// Мультик «Один день из жизни чудовища» — рисуется на canvas, звук и голоса генерируются в браузере.
const Cartoon = (() => {
  const W = 1280, H = 720;
  let cv, g, running = false, startT = 0, raf = 0, onDone = null, fired = new Set();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = k => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;
  const PI = Math.PI;

  // ================= ЗВУК =================
  let muted = false;
  let ac = null, out, nb, musicTimer = 0, nextT = 0, stepI = 0, bpm = 132, musicOn = false;
  function aInit() {
    if (ac) { ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); out = ac.createGain(); out.gain.value = muted ? 0 : 0.8; out.connect(ac.destination);
    nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function env(gn, t, dur, v) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function toneAt(t, f, d, type, v, fe) {
    if (!ac) return;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (fe) o.frequency.exponentialRampToValueAtTime(fe, t + d);
    const gn = ac.createGain(); env(gn, t, d, v); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + d + 0.05);
  }
  const tone = (f, d, type = 'sine', v = 0.2, fe = null, dl = 0) => ac && toneAt(ac.currentTime + dl, f, d, type, v, fe);
  function noiseAt(t, d, type, f, q, v) {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = nb;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ac.createGain(); env(gn, t, d, v); s.connect(fl); fl.connect(gn); gn.connect(out); s.start(t); s.stop(t + d + 0.05);
  }
  const noise = (d, type, f, q, v, dl = 0) => ac && noiseAt(ac.currentTime + dl, d, type, f, q, v);
  const R = n => [...Array(n).keys()];
  const SFX = {
    boing() { tone(180, 0.45, 'sine', 0.3, 650); tone(650, 0.35, 'sine', 0.2, 160, 0.22); },
    pop() { tone(900, 0.09, 'sine', 0.35, 180); noise(0.05, 'highpass', 2000, 1, 0.25); },
    splash() { noise(0.9, 'lowpass', 1400, 0.6, 0.5); noise(0.5, 'highpass', 3000, 1, 0.25, 0.1); },
    honk() { [0, 0.28].forEach(d => { tone(233, 0.24, 'sawtooth', 0.2, null, d); tone(466, 0.24, 'square', 0.07, null, d); }); },
    trumpet() { [392, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.26, 'sawtooth', 0.14, null, i * 0.2)); },
    crash() { noise(0.6, 'bandpass', 2600, 0.8, 0.55); tone(120, 0.3, 'square', 0.15, 40); },
    snore() { noise(1.2, 'lowpass', 240, 4, 0.4); tone(75, 1.1, 'sawtooth', 0.06, 55); tone(900, 0.6, 'sine', 0.05, 1400, 1.3); },
    yawn() { tone(260, 1.6, 'sawtooth', 0.1, 110); noise(1.4, 'lowpass', 500, 2, 0.12); },
    alarm() { R(12).forEach(i => tone(1760, 0.07, 'square', 0.08, null, i * 0.14)); },
    snip() { noise(0.05, 'highpass', 4500, 1, 0.3); tone(3200, 0.03, 'square', 0.05); },
    quack() { tone(620, 0.18, 'sawtooth', 0.16, 380); tone(1240, 0.18, 'square', 0.04, 760); },
    zoom() { tone(140, 1, 'sawtooth', 0.1, 900); noise(1, 'bandpass', 900, 2, 0.12); },
    clap() { R(14).forEach(i => noise(0.05, 'bandpass', 1500 + Math.random() * 900, 1, 0.25, i * 0.08 + Math.random() * 0.04)); },
    burp() { tone(95, 0.9, 'sawtooth', 0.32, 65); noise(0.9, 'lowpass', 320, 5, 0.25); },
    crunch() { R(4).forEach(i => noise(0.08, 'bandpass', 1900, 2, 0.35, i * 0.09)); },
    sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.28, 'sine', 0.09, null, i * 0.07)); },
    scrub() { noise(0.18, 'bandpass', 2400, 3, 0.2); },
    scratch() { noise(0.35, 'bandpass', 900, 3, 0.4); tone(300, 0.35, 'sawtooth', 0.08, 80); },
    ding() { tone(1318, 0.9, 'sine', 0.16); tone(2637, 0.6, 'sine', 0.05); },
    camera() { noise(0.08, 'highpass', 3000, 1, 0.45); noise(0.1, 'highpass', 2000, 1, 0.3, 0.12); },
    boom() { tone(70, 0.6, 'sine', 0.55, 30); noise(0.5, 'lowpass', 200, 1, 0.45); },
    whoosh() { noise(0.55, 'bandpass', 900, 1, 0.35); },
    tiptoe() { tone(1500 + Math.random() * 300, 0.05, 'triangle', 0.08); },
    grunt() { tone(150, 0.3, 'sawtooth', 0.16, 100); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'square', 0.08, null, i * 0.14)); tone(1046, 0.9, 'square', 0.09, null, 0.58); },
    laugh() { R(7).forEach(i => { tone(320 - i * 12, 0.11, 'sawtooth', 0.07, 260 - i * 12, i * 0.13); tone(460 - i * 10, 0.11, 'sawtooth', 0.05, 380, i * 0.13 + 0.03); }); },
    ooh() { tone(330, 1.1, 'sine', 0.1, 440); tone(415, 1.1, 'sine', 0.08, 555); tone(262, 1.1, 'sine', 0.08, 350); },
    spin() { tone(300, 2.4, 'triangle', 0.09, 1800); },
    drumroll() { R(26).forEach(i => noise(0.05, 'bandpass', 300, 1, 0.22, i * 0.055)); },
    phone() { R(4).forEach(i => { tone(440, 0.35, 'sine', 0.1, null, i * 0.8); tone(480, 0.35, 'sine', 0.1, null, i * 0.8); }); },
    squeak() { tone(1800, 0.4, 'sine', 0.15, 2600); tone(2600, 0.3, 'sine', 0.12, 1400, 0.35); },
    thud() { tone(90, 0.25, 'sine', 0.4, 40); noise(0.2, 'lowpass', 300, 1, 0.3); },
    rumble() { noise(2, 'lowpass', 120, 1, 0.6); }
  };
  // Весёлая мелодия
  const MEL = [72, 76, 79, 76, 74, 72, 74, 76, 76, 72, 69, 72, 71, 72, 74, 0, 77, 76, 74, 72, 74, 76, 77, 79, 79, 77, 76, 74, 72, 0, 71, 0];
  const BASS = [48, 55, 48, 55, 45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function sched() {
    if (!ac || !musicOn) return;
    const sp = 60 / bpm / 2;
    while (nextT < ac.currentTime + 0.25) {
      const i = stepI % 32, m = MEL[i];
      if (m) toneAt(nextT, mtof(m), sp * 0.85, 'square', 0.03);
      if (i % 2 === 0) toneAt(nextT, mtof(BASS[(i / 2) % 16]), sp * 1.8, 'triangle', 0.09);
      if (i % 4 === 0) toneAt(nextT, 150, 0.14, 'sine', 0.22, 45);
      if (i % 4 === 2) noiseAt(nextT, 0.04, 'highpass', 7000, 1, 0.06);
      nextT += sp; stepI++;
    }
  }
  function music(on, tempo) {
    if (tempo) bpm = tempo;
    if (on && !musicOn && ac) { musicOn = true; nextT = ac.currentTime + 0.05; stepI = 0; }
    if (!on) musicOn = false;
  }
  // Голоса
  const VOICES = { monster: [0.1, 0.8], boy: [2, 1.15], hero: [1, 1.05], pale: [1.6, 1], angel: [1.3, 0.95], narr: [0.95, 1.05] };
  function speak(who, text) {
    if (muted) return;
    try {
      const s = window.speechSynthesis; if (!s) return;
      const u = new SpeechSynthesisUtterance(text);
      const v = s.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ru'));
      if (v) u.voice = v;
      u.lang = 'ru-RU'; [u.pitch, u.rate] = VOICES[who] || [1, 1]; u.volume = 0.95;
      s.cancel(); s.speak(u);
    } catch (e) { /* нет синтеза речи */ }
  }

  // ================= РИСОВАНИЕ =================
  const INK = '#1b1420';
  function ol(w = 5) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; }
  function ell(x, y, rx, ry, fill, rot = 0, stroke = true) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, PI * 2); g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); }
  function rr(x, y, w, h, r, fill, stroke = true) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); }
  function limb(x, y, len, ang, w, col) {
    const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
    g.lineCap = 'round';
    g.lineWidth = w + 10; g.strokeStyle = INK; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    ol(); return [ex, ey];
  }
  function text(str, x, y, size, col = '#fff', align = 'center', font = 'Comic Sans MS, Segoe Print, cursive', stroke = 8) {
    g.font = `bold ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = stroke; g.strokeStyle = INK; g.strokeText(str, x, y); }
    g.fillStyle = col; g.fillText(str, x, y);
  }
  function heart(x, y, s, col = '#ff3a5a') {
    g.beginPath(); g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.3);
    g.fillStyle = col; g.fill(); ol(3); g.stroke(); ol();
  }
  function star(x, y, r, col = '#fff6a0') {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, rr2 = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    g.closePath(); g.fillStyle = col; g.fill();
  }

  // ---------- персонажи ----------
  // Пожиратель душ. (x,y) — точка между ногами на земле.
  function monster(x, y, s, o = {}) {
    const body = o.pajama ? '#f4a3c4' : '#3e3150';
    g.save(); g.translate(x, y); g.scale(s * (o.sx || 1) * (o.flip ? -1 : 1), s * (o.squash || 1)); if (o.rot) g.rotate(o.rot);
    ol(5);
    if (!o.noLegs) {
      rr(-50, -125, 36, 125, 16, body); rr(14, -125, 36, 125, 16, body);
      ell(-34, -4, 30, 14, body); ell(34, -4, 30, 14, body);
    }
    ell(0, -200, 80, 100, body);
    if (o.pajama) { g.fillStyle = '#fff'; [[-30, -230], [25, -180], [-10, -150], [40, -250], [-45, -170]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 7, 0, PI * 2); g.fill(); }); }
    else ell(0, -185, 48, 62, '#5a4870', 0, false);
    // руки
    const aL = o.aL != null ? o.aL : 0.35, aR = o.aR != null ? o.aR : 0.35;
    const hl = limb(-72, -255, o.armLen || 135, -aL, 28, body), hr = limb(72, -255, o.armLen || 135, aR, 28, body);
    [hl, hr].forEach(([hx, hy], k) => {
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(hx + i * 9 - 5, hy); g.lineTo(hx + i * 9, hy + 22); g.lineTo(hx + i * 9 + 5, hy);
        g.fillStyle = '#e8e0d0'; g.fill(); g.stroke();
      }
    });
    if (o.holdR) o.holdR(hr[0], hr[1]);
    if (o.holdL) o.holdL(hl[0], hl[1]);
    // голова
    const hy = -335;
    g.beginPath(); g.moveTo(-40, hy - 45); g.quadraticCurveTo(-85, hy - 110, -70, hy - 125); g.quadraticCurveTo(-55, hy - 80, -18, hy - 58); g.fillStyle = '#e8e0d0'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(40, hy - 45); g.quadraticCurveTo(85, hy - 110, 70, hy - 125); g.quadraticCurveTo(55, hy - 80, 18, hy - 58); g.fill(); g.stroke();
    ell(0, hy, 76, 68, body);
    // глаза
    const e = o.eyes || 'normal', lk = o.look || 0;
    if (e === 'normal' || e === 'wide' || e === 'cross') {
      const ry = e === 'wide' ? 28 : 22;
      ell(-28, hy - 10, 20, ry, '#fff'); ell(28, hy - 10, 20, ry, '#fff');
      g.fillStyle = '#e02020';
      const p1 = e === 'cross' ? 8 : lk, p2 = e === 'cross' ? -8 : lk;
      g.beginPath(); g.arc(-28 + p1, hy - 8, e === 'wide' ? 6 : 9, 0, PI * 2); g.fill();
      g.beginPath(); g.arc(28 + p2, hy - 8, e === 'wide' ? 6 : 9, 0, PI * 2); g.fill();
    } else if (e === 'sleepy') {
      ol(5); g.beginPath(); g.arc(-28, hy - 10, 16, 0.2, PI - 0.2); g.stroke(); g.beginPath(); g.arc(28, hy - 10, 16, 0.2, PI - 0.2); g.stroke();
    } else if (e === 'happy') {
      ol(6); g.beginPath(); g.arc(-28, hy - 2, 16, PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(28, hy - 2, 16, PI + 0.3, -0.3); g.stroke();
    } else if (e === 'hearts') { heart(-28, hy - 8, 22); heart(28, hy - 8, 22); }
    else if (e === 'x') { ol(6); [[-28], [28]].forEach(([ex]) => { g.beginPath(); g.moveTo(ex - 12, hy - 22); g.lineTo(ex + 12, hy + 2); g.moveTo(ex + 12, hy - 22); g.lineTo(ex - 12, hy + 2); g.stroke(); }); }
    ol(5);
    // рот
    const m = o.mouth || 'grin', my = hy + 30;
    if (m === 'grin') {
      g.beginPath(); g.moveTo(-44, my - 6); g.quadraticCurveTo(0, my + 36, 44, my - 6); g.closePath(); g.fillStyle = '#5a0a14'; g.fill(); g.stroke();
      g.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { const tx = -36 + i * 12; g.beginPath(); g.moveTo(tx, my - 4); g.lineTo(tx + 6, my + 8); g.lineTo(tx + 12, my - 4); g.fill(); }
    } else if (m === 'open' || m === 'yawn') {
      const ry = m === 'yawn' ? 38 : 26;
      ell(0, my + 6, 34, ry, '#5a0a14'); ell(0, my + ry - 6, 18, 10, '#e05070', 0, false);
      g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const tx = -24 + i * 10; g.beginPath(); g.moveTo(tx, my + 6 - ry + 4); g.lineTo(tx + 5, my + 6 - ry + 14); g.lineTo(tx + 10, my + 6 - ry + 4); g.fill(); }
    } else if (m === 'o') ell(0, my + 4, 12, 14, '#5a0a14');
    else if (m === 'smile') { ol(6); g.beginPath(); g.arc(0, my - 12, 30, 0.3, PI - 0.3); g.stroke(); ol(5); }
    else if (m === 'sad') { ol(6); g.beginPath(); g.arc(0, my + 22, 26, PI + 0.4, -0.4); g.stroke(); ol(5); }
    else if (m === 'tongue') { ol(6); g.beginPath(); g.arc(0, my - 12, 30, 0.3, PI - 0.3); g.stroke(); ol(5); ell(8, my + 22, 12, 16, '#e05070'); }
    else if (m === 'chew') { ell(0, my + 4, 26, 10 + Math.abs(Math.sin(performance.now() / 70)) * 12, '#5a0a14'); }
    if (o.cap) {
      g.beginPath(); g.moveTo(-70, hy - 40); g.quadraticCurveTo(10, hy - 150, 110, hy - 90); g.lineTo(60, hy - 50); g.closePath(); g.fillStyle = '#6a8ad8'; g.fill(); g.stroke();
      ell(112, hy - 92, 16, 16, '#fff');
    }
    if (o.duck) { ell(0, hy - 78, 34, 22, '#ffd23a'); ell(24, hy - 102, 18, 16, '#ffd23a'); g.beginPath(); g.moveTo(38, hy - 104); g.lineTo(58, hy - 98); g.lineTo(38, hy - 94); g.fillStyle = '#ff8a2a'; g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(28, hy - 106, 3, 0, PI * 2); g.fill(); }
    if (o.flowers) { ['#ff5a8a', '#ffd23a', '#9a7aff', '#fff'].forEach((c, i) => { const fx = -45 + i * 30, fy = hy - 70 - (i % 2) * 10; for (let k = 0; k < 5; k++) ell(fx + Math.cos(k * 1.26) * 9, fy + Math.sin(k * 1.26) * 9, 7, 7, c, 0, false); ell(fx, fy, 5, 5, '#ffb000', 0, false); }); }
    if (o.sweat) { g.beginPath(); g.moveTo(70, hy - 40); g.quadraticCurveTo(82, hy - 14, 70, hy - 6); g.quadraticCurveTo(58, hy - 14, 70, hy - 40); g.fillStyle = '#8ad0ff'; g.fill(); g.stroke(); }
    if (o.tea) { g.fillStyle = 'rgba(140,80,30,.85)'; [[-20, -20, 30], [25, 5, 22], [-5, 30, 18], [40, -30, 14]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a, hy + b, r, 0, PI * 2); g.fill(); }); }
    g.restore();
  }

  function boy(x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); if (o.rot) g.rotate(o.rot);
    ol(4);
    rr(-24, -60, 20, 60, 8, '#f0dccc'); rr(4, -60, 20, 60, 8, '#f0dccc');
    ell(-14, -2, 16, 8, '#333'); ell(14, -2, 16, 8, '#333');
    rr(-28, -76, 56, 30, 8, '#3a3632');
    rr(-32, -130, 64, 64, 14, '#6a7078');
    const aL = o.aL != null ? o.aL : 0.25, aR = o.aR != null ? o.aR : 0.25;
    const hl = limb(-30, -120, 55, -aL, 14, '#6a7078'), hr = limb(30, -120, 55, aR, 14, '#6a7078');
    ell(hl[0], hl[1], 9, 9, '#f0dccc'); ell(hr[0], hr[1], 9, 9, '#f0dccc');
    if (o.holdR) o.holdR(hr[0], hr[1]);
    const hy = -172;
    ell(0, hy, 44, 42, '#f2e2d2');
    g.beginPath(); g.moveTo(-44, hy); g.quadraticCurveTo(-40, hy - 52, 0, hy - 46); g.quadraticCurveTo(40, hy - 52, 44, hy); g.quadraticCurveTo(20, hy - 26, -44, hy); g.fillStyle = '#1a1410'; g.fill(); g.stroke();
    const e = o.eyes || 'normal';
    if (e === 'normal') { ell(-15, hy + 4, 9, 12, INK, 0, false); ell(15, hy + 4, 9, 12, INK, 0, false); g.fillStyle = '#fff'; g.beginPath(); g.arc(-12, hy, 3, 0, PI * 2); g.arc(18, hy, 3, 0, PI * 2); g.fill(); }
    else if (e === 'happy') { ol(4); g.beginPath(); g.arc(-15, hy + 8, 8, PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(15, hy + 8, 8, PI + 0.3, -0.3); g.stroke(); }
    else if (e === 'wink') { ell(-15, hy + 4, 9, 12, INK, 0, false); ol(4); g.beginPath(); g.arc(15, hy + 8, 8, PI + 0.3, -0.3); g.stroke(); }
    else if (e === 'x') { ol(4); [-15, 15].forEach(ex => { g.beginPath(); g.moveTo(ex - 7, hy - 3); g.lineTo(ex + 7, hy + 11); g.moveTo(ex + 7, hy - 3); g.lineTo(ex - 7, hy + 11); g.stroke(); }); }
    ol(4);
    const m = o.mouth || 'smile';
    if (m === 'smile') { g.beginPath(); g.arc(0, hy + 16, 10, 0.3, PI - 0.3); g.stroke(); }
    else if (m === 'open') ell(0, hy + 22, 9, 8, '#5a0a14');
    else if (m === 'grin') { g.beginPath(); g.arc(0, hy + 14, 14, 0.2, PI - 0.2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
    if (o.cap) { g.beginPath(); g.arc(0, hy - 22, 40, PI, 0); g.fillStyle = '#d8302a'; g.fill(); g.stroke(); rr(10, hy - 26, 58, 12, 6, '#d8302a'); }
    if (o.pizza) { rr(-50, hy - 70, 100, 24, 4, '#f0d8a8'); text('ПИЦЦА', 0, hy - 58, 14, '#c0302a', 'center', 'Arial', 0); }
    g.restore();
  }

  function hero(x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); if (o.rot) g.rotate(o.rot);
    ol(5);
    const coat = '#2f3e56';
    rr(-30, -80, 24, 80, 10, '#23252c'); rr(6, -80, 24, 80, 10, '#23252c');
    ell(-18, -2, 20, 9, '#111'); ell(18, -2, 20, 9, '#111');
    g.beginPath(); g.moveTo(-42, -170); g.lineTo(42, -170); g.lineTo(52, -70); g.lineTo(-52, -70); g.closePath(); g.fillStyle = coat; g.fill(); g.stroke();
    const aL = o.aL != null ? o.aL : 0.2, aR = o.aR != null ? o.aR : 0.2;
    const hl = limb(-40, -160, 70, -aL, 18, coat), hr = limb(40, -160, 70, aR, 18, coat);
    ell(hl[0], hl[1], 10, 10, '#e8c8a8'); ell(hr[0], hr[1], 10, 10, '#e8c8a8');
    if (o.holdR) o.holdR(hr[0], hr[1]);
    if (o.holdL) o.holdL(hl[0], hl[1]);
    const hy = -210 + (o.hoodBlow ? 0 : 0);
    ell(0, hy, 48, 46, coat);
    if (o.hoodBlow) { g.beginPath(); g.moveTo(-40, hy - 20); g.quadraticCurveTo(-110, hy - 40, -130, hy - 10); g.quadraticCurveTo(-90, hy, -40, hy + 10); g.fillStyle = coat; g.fill(); g.stroke(); }
    ell(0, hy + 6, 33, 32, '#e8c8a8');
    const e = o.eyes || 'normal';
    if (e === 'normal') { ell(-12, hy + 2, 5, 7, INK, 0, false); ell(12, hy + 2, 5, 7, INK, 0, false); }
    else if (e === 'happy' || e === 'closed') { ol(4); g.beginPath(); g.arc(-12, hy + 6, 7, PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(12, hy + 6, 7, PI + 0.3, -0.3); g.stroke(); }
    else if (e === 'wide') { ell(-12, hy + 2, 8, 10, '#fff'); ell(12, hy + 2, 8, 10, '#fff'); ell(-12, hy + 3, 3, 3, INK, 0, false); ell(12, hy + 3, 3, 3, INK, 0, false); }
    else if (e === 'x') { ol(4); [-12, 12].forEach(ex => { g.beginPath(); g.moveTo(ex - 6, hy - 4); g.lineTo(ex + 6, hy + 8); g.moveTo(ex + 6, hy - 4); g.lineTo(ex - 6, hy + 8); g.stroke(); }); }
    ol(4);
    const m = o.mouth || 'smile';
    if (m === 'smile') { g.beginPath(); g.arc(0, hy + 14, 10, 0.3, PI - 0.3); g.stroke(); }
    else if (m === 'open') ell(0, hy + 20, 9, 8, '#5a0a14');
    else if (m === 'flat') { g.beginPath(); g.moveTo(-9, hy + 20); g.lineTo(9, hy + 20); g.stroke(); }
    else if (m === 'tongue') { g.beginPath(); g.arc(0, hy + 14, 10, 0.3, PI - 0.3); g.stroke(); ell(4, hy + 26, 6, 8, '#e05070'); }
    if (o.phones) {
      ol(5); g.beginPath(); g.arc(0, hy - 4, 44, PI + 0.2, -0.2); g.strokeStyle = '#d02a3a'; g.lineWidth = 9; g.stroke(); ol(4);
      rr(-54, hy - 8, 18, 28, 7, '#d02a3a'); rr(36, hy - 8, 18, 28, 7, '#d02a3a');
    }
    g.restore();
  }

  function angel(x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s, s); ol(5);
    const wf = Math.sin(performance.now() / 180) * 0.15;
    ell(-60, -150, 55, 30, '#fff', -0.6 - wf); ell(60, -150, 55, 30, '#fff', 0.6 + wf);
    g.beginPath(); g.moveTo(-30, -190); g.lineTo(30, -190); g.lineTo(60, 0); g.lineTo(-60, 0); g.closePath(); g.fillStyle = '#faf6ec'; g.fill(); g.stroke();
    const aL = o.aL != null ? o.aL : 0.3, aR = o.aR != null ? o.aR : 0.3;
    const hl = limb(-28, -180, 65, -aL, 16, '#faf6ec'), hr = limb(28, -180, 65, aR, 16, '#faf6ec');
    ell(hl[0], hl[1], 9, 9, '#f2dcc6'); ell(hr[0], hr[1], 9, 9, '#f2dcc6');
    if (o.holdR) o.holdR(hr[0], hr[1]);
    const hy = -228;
    ell(0, hy, 36, 36, '#f2dcc6');
    ol(4); g.beginPath(); g.arc(-12, hy + 2, 7, PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(12, hy + 2, 7, PI + 0.3, -0.3); g.stroke();
    g.beginPath(); g.arc(0, hy + 12, 10, 0.3, PI - 0.3); g.stroke();
    g.save(); g.translate(0, hy - 52); g.rotate(o.haloSpin ? performance.now() / 200 : 0);
    g.beginPath(); g.ellipse(0, 0, 36, 10, 0, 0, PI * 2); g.lineWidth = 8; g.strokeStyle = '#ffd040'; g.stroke(); g.restore();
    g.restore();
  }

  // Бледная: cut — насколько коротко подстрижена (0..1)
  function pale(x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); ol(5);
    rr(-16, -110, 12, 110, 6, '#e0dcd4'); rr(4, -110, 12, 110, 6, '#e0dcd4');
    g.beginPath(); g.moveTo(-28, -240); g.lineTo(28, -240); g.lineTo(50, -100); g.lineTo(-50, -100); g.closePath(); g.fillStyle = o.uniform ? '#2a4a8a' : '#8a867e'; g.fill(); g.stroke();
    if (o.uniform) { g.beginPath(); g.moveTo(-12, -240); g.lineTo(0, -215); g.lineTo(12, -240); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
    const aL = o.aL != null ? o.aL : 0.2, aR = o.aR != null ? o.aR : 0.2;
    const hl = limb(-26, -235, 90, -aL, 11, '#e0dcd4'), hr = limb(26, -235, 90, aR, 11, '#e0dcd4');
    if (o.holdR) o.holdR(hr[0], hr[1]);
    const hy = -278;
    ell(0, hy, 34, 40, '#ece8e0');
    const cut = o.wig ? 0 : (o.cut || 0);
    if (cut > 0.85) {
      ol(4);
      g.beginPath(); g.arc(-13, hy, 12, 0, PI * 2); g.arc(13, hy, 12, 0, PI * 2); g.lineWidth = 4; g.stroke();
      g.beginPath(); g.moveTo(-1, hy); g.lineTo(1, hy); g.stroke();
      ell(-13, hy + 1, 5, 6, INK, 0, false); ell(13, hy + 1, 5, 6, INK, 0, false);
      g.fillStyle = 'rgba(255,120,140,.5)'; g.beginPath(); g.arc(-22, hy + 16, 7, 0, PI * 2); g.arc(22, hy + 16, 7, 0, PI * 2); g.fill();
      g.fillStyle = '#b07050'; [[-18, 12], [-24, 18], [18, 12], [24, 18]].forEach(([a, b]) => { g.beginPath(); g.arc(a, hy + b, 2, 0, PI * 2); g.fill(); });
      ol(4); g.beginPath(); g.arc(0, hy + 18, 9, 0.3, PI - 0.3); g.stroke();
    }
    // волосы
    const len = lerp(200, 30, cut);
    const blow = o.blow || 0;
    g.beginPath();
    g.moveTo(-38, hy - 10); g.quadraticCurveTo(0, hy - 60, 38, hy - 10);
    if (cut > 0.85) { g.quadraticCurveTo(40, hy - 30, 0, hy - 28); g.quadraticCurveTo(-40, hy - 30, -38, hy - 10); }
    else {
      g.lineTo(40 + blow * 160, hy - 10 + len * (1 - blow * 0.7)); g.lineTo(-40 + blow * 160, hy - 10 + len * (1 - blow * 0.7)); g.closePath();
    }
    g.fillStyle = '#0a0a0c'; g.fill(); g.stroke();
    if (cut < 0.85 && !o.wig && o.eye !== false) { g.fillStyle = '#fff'; g.beginPath(); g.arc(8, hy + 4, 3, 0, PI * 2); g.fill(); }
    g.restore();
  }

  function faceless(x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s, s); ol(5);
    g.beginPath(); g.moveTo(0, -230); g.lineTo(60, 0); g.lineTo(-60, 0); g.closePath(); g.fillStyle = '#16161a'; g.fill(); g.stroke();
    limb(-20, -170, 70, -(o.aL != null ? o.aL : 0.4), 12, '#16161a'); limb(20, -170, 70, o.aR != null ? o.aR : 0.4, 12, '#16161a');
    g.save(); g.translate(0, -250); g.rotate(o.spin || 0);
    ell(0, 0, 34, 42, '#f0ece2');
    g.fillStyle = INK; g.beginPath(); g.ellipse(-12, -8, 7, 4, 0.3, 0, PI * 2); g.ellipse(12, -8, 7, 4, -0.3, 0, PI * 2); g.fill();
    ol(4); g.beginPath(); g.arc(0, 6, 18, 0.2, PI - 0.2); g.stroke();
    g.restore(); g.restore();
  }

  // ---------- реквизит ----------
  function well(x, y, s = 1) {
    g.save(); g.translate(x, y); g.scale(s, s); ol(5);
    rr(-110, -40, 20, 160, 6, '#6a4a2a'); rr(90, -40, 20, 160, 6, '#6a4a2a');
    g.beginPath(); g.moveTo(-140, -40); g.lineTo(0, -110); g.lineTo(140, -40); g.closePath(); g.fillStyle = '#a0402a'; g.fill(); g.stroke();
    rr(-110, 60, 220, 70, 10, '#8a8a90');
    for (let i = 0; i < 5; i++) { ol(3); g.beginPath(); g.moveTo(-110 + i * 50, 60); g.lineTo(-110 + i * 50, 130); g.stroke(); }
    ol(5); ell(0, 62, 108, 16, '#1a2a3a');
    g.restore();
  }
  function clock(x, y, s, flat = 0) {
    g.save(); g.translate(x, y); g.scale(s, s * (1 - flat * 0.75)); ol(4);
    ell(-24, -44, 14, 14, '#e0c040'); ell(24, -44, 14, 14, '#e0c040');
    ell(0, 0, 44, 44, '#d84040'); ell(0, 0, 34, 34, '#fff');
    ol(4); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -22); g.moveTo(0, 0); g.lineTo(16, 6); g.stroke();
    g.restore();
  }
  function particles(n, x0, y0, t, speed, col, size, grav = 900, seed = 1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + seed, sp = speed * (0.6 + ((i * 37 + seed * 13) % 10) / 20);
      const x = x0 + Math.cos(a) * sp * t, y = y0 - Math.abs(Math.sin(a)) * sp * t + grav * t * t / 2;
      g.fillStyle = col; g.beginPath(); g.arc(x, y, size, 0, PI * 2); g.fill();
    }
  }

  // ---------- фоны ----------
  function sky(top, bot) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function cloud(x, y, s) { g.fillStyle = 'rgba(255,255,255,.95)'; [[0, 0, 60], [50, -20, 50], [100, 0, 55], [45, 20, 50]].forEach(([a, b, r]) => { g.beginPath(); g.arc(x + a * s, y + b * s, r * s, 0, PI * 2); g.fill(); }); }
  function bgVillage(t) {
    sky('#7ec8f8', '#dff2ff');
    g.fillStyle = '#ffe070'; g.beginPath(); g.arc(1120, 110, 60, 0, PI * 2); g.fill();
    cloud(150 + (t * 12) % 1400 - 200, 120, 0.8); cloud(700 + (t * 8) % 1400 - 400, 80, 0.6);
    g.fillStyle = '#6ab04a'; g.fillRect(0, 560, W, 160);
    g.fillStyle = '#5a9a3a'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, 570 + (i * 31) % 120, 14, 5);
    ol(5);
    [[60, 560], [1200, 560]].forEach(([x, y]) => { rr(x - 12, y - 120, 24, 120, 6, '#7a5230'); ell(x, y - 150, 70, 60, '#3a8a3a'); });
    rr(170, 360, 240, 200, 6, '#d8a868'); g.beginPath(); g.moveTo(150, 360); g.lineTo(290, 250); g.lineTo(430, 360); g.closePath(); g.fillStyle = '#c0402a'; g.fill(); g.stroke();
    rr(260, 450, 60, 110, 6, '#7a4a2a'); rr(190, 400, 50, 45, 4, '#9ad0f0'); rr(340, 400, 50, 45, 4, '#9ad0f0');
  }
  function bgBedroom() {
    g.fillStyle = '#f2d6a8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8c890'; for (let x = 0; x < W; x += 60) g.fillRect(x, 0, 26, 560);
    g.fillStyle = '#9a6a3a'; g.fillRect(0, 560, W, 160);
    ol(5); rr(560, 80, 200, 160, 8, '#bfe6ff'); g.beginPath(); g.moveTo(660, 80); g.lineTo(660, 240); g.moveTo(560, 160); g.lineTo(760, 160); g.stroke();
    g.fillStyle = '#ffe070'; g.beginPath(); g.arc(720, 120, 22, 0, PI * 2); g.fill();
    rr(1030, 470, 120, 90, 6, '#8a5a30');
  }
  function bgDoor() {
    sky('#7ec8f8', '#dff2ff');
    g.fillStyle = '#6ab04a'; g.fillRect(0, 620, W, 100);
    ol(5); rr(300, 180, 620, 440, 6, '#d8a868');
    g.beginPath(); g.moveTo(270, 180); g.lineTo(610, 40); g.lineTo(950, 180); g.closePath(); g.fillStyle = '#c0402a'; g.fill(); g.stroke();
    rr(340, 260, 110, 90, 4, '#9ad0f0'); rr(770, 260, 110, 90, 4, '#9ad0f0');
  }
  function bgPlane(t, tilt) {
    g.save(); g.translate(W / 2, H / 2); g.rotate(tilt || 0); g.translate(-W / 2, -H / 2);
    g.fillStyle = '#e8e4dc'; g.fillRect(-100, -100, W + 200, H + 200);
    g.fillStyle = '#d0ccc4'; g.fillRect(-100, -100, W + 200, 140);
    ol(5);
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 320; rr(x, 150, 110, 150, 50, '#c8c4bc');
      g.save(); g.beginPath(); g.roundRect(x + 14, 164, 82, 122, 40); g.clip();
      sky('#4a90d8', '#bfe0ff'); cloud(x + ((t * 60 + i * 50) % 200) - 60, 230, 0.35);
      g.restore(); g.beginPath(); g.roundRect(x + 14, 164, 82, 122, 40); g.stroke();
    }
    g.fillStyle = '#4a5a8a'; g.fillRect(-100, 560, W + 200, 260);
    g.restore();
  }
  function seat(x, y, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); ol(5); rr(-70, -200, 140, 200, 20, '#2a4a9a'); rr(-60, -210, 120, 40, 14, '#f4f2ea'); g.restore(); }
  function bgSalon() {
    g.fillStyle = '#f8c8d8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f0b0c8'; for (let y = 0; y < 560; y += 50) for (let x = (y / 50 % 2) * 40; x < W; x += 80) { g.beginPath(); g.arc(x, y, 8, 0, PI * 2); g.fill(); }
    g.fillStyle = '#e0e0e8'; g.fillRect(0, 560, W, 160);
    g.fillStyle = '#c8c8d0'; for (let x = 0; x < W; x += 80) for (let y = 560; y < H; y += 80) if (((x + y) / 80) % 2 === 0) g.fillRect(x, y, 80, 80);
    ol(5); rr(340, 40, 600, 70, 14, '#fff'); text('САЛОН «ЛОХМАТАЯ ГОЛОВА»', 640, 76, 30, '#d0306a', 'center', 'Comic Sans MS, cursive', 0);
  }
  function bgDisco(t) {
    sky('#1a0a3a', '#3a1060');
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 3 + i)})`; g.fillRect((i * 137) % W, (i * 71) % 400, 3, 3); }
    const cols = ['rgba(255,60,120,.25)', 'rgba(60,200,255,.25)', 'rgba(255,220,60,.25)', 'rgba(120,255,120,.25)'];
    cols.forEach((c, i) => {
      const a = Math.sin(t * 1.5 + i * 1.7) * 0.6;
      g.save(); g.translate(200 + i * 300, 0); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-120, H); g.lineTo(120, H); g.closePath(); g.fillStyle = c; g.fill(); g.restore();
    });
    // диско-луна
    g.save(); g.translate(640, 110); ol(4);
    ell(0, 0, 70, 70, '#c8c8d8');
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      if (i * i + j * j > 10) continue;
      const b = 0.5 + 0.5 * Math.sin(t * 6 + i * 2 + j * 3);
      g.fillStyle = `rgba(255,255,255,${b})`; g.fillRect(i * 18 - 8, j * 18 - 8, 16, 16);
    }
    g.restore();
    g.fillStyle = '#2a1a4a'; g.fillRect(0, 580, W, 140);
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < W; x += 100) g.fillRect(x, 580, 50, 140);
  }

  // ---------- пузыри и титры ----------
  function wrap(str, maxW, size) {
    g.font = `bold ${size}px Comic Sans MS, cursive`;
    const words = str.split(' '), lines = []; let cur = '';
    words.forEach(w => { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; });
    if (cur) lines.push(cur);
    return lines;
  }
  function bubble(x, y, str, k) {
    const size = 30, lines = wrap(str, 420, size), lh = size * 1.25;
    const w = Math.max(...lines.map(l => g.measureText(l).width)) + 50, h = lines.length * lh + 30;
    const sc = ease(clamp(k * 5, 0, 1));
    const bx = clamp(x - w / 2, 16, W - 16 - w), by = Math.max(16, y - h - 40);
    g.save(); g.translate(x, y); g.scale(sc, sc); g.translate(-x, -y);
    ol(5); g.fillStyle = '#fff';
    g.beginPath(); g.roundRect(bx, by, w, h, 26); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(clamp(x - 18, bx + 20, bx + w - 50), by + h - 3); g.lineTo(x, y); g.lineTo(clamp(x + 18, bx + 50, bx + w - 20), by + h - 3); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(clamp(x - 16, bx + 22, bx + w - 48), by + h - 8, 32, 8);
    lines.forEach((l, i) => text(l, bx + w / 2, by + 15 + lh / 2 + i * lh, size, INK, 'center', 'Comic Sans MS, cursive', 0));
    g.restore();
  }
  function caption(str) {
    g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, H - 92, W, 92);
    const lines = wrap(str, W - 120, 30);
    lines.forEach((l, i) => text(l, W / 2, H - 46 - (lines.length - 1) * 18 + i * 36, 30, '#ffe070', 'center', 'Comic Sans MS, cursive', 0));
  }

  // ================= СЦЕНЫ =================
  // Реплика: [начало, конец, кто, текст, x, y]
  const scrubCues = (a, b, step, fn) => { const c = []; for (let t = a; t < b; t += step) c.push([t, fn]); return c; };
  const SCENES = [
    { // 0. Заставка
      dur: 9, tempo: 132,
      cues: [[0.3, () => SFX.whoosh()], [3.2, () => music(true, 132)], [5.6, () => SFX.fanfare()],
        ...[...'ПОЖИРАТЕЛЬ ДУШ'].map((c, i) => [3.3 + i * 0.12, () => c !== ' ' && SFX.pop()])],
      draw(t) {
        if (t < 3.2) {
          g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
          const a = Math.min(seg(t, 0.2, 0.9), 1 - seg(t, 2.5, 3.1));
          g.globalAlpha = a; text('Студия «Туманный остров» представляет', W / 2, H / 2, 40, '#fff', 'center', 'Georgia', 0); g.globalAlpha = 1;
          return;
        }
        bgVillage(t);
        const title = 'ПОЖИРАТЕЛЬ ДУШ';
        [...title].forEach((c, i) => {
          const k = seg(t, 3.3 + i * 0.12, 3.8 + i * 0.12);
          const y = lerp(-100, 220, ease(k)) + Math.sin(t * 4 + i) * 6 * k;
          text(c, 190 + i * 70, y, 86, '#ff4a4a', 'center', 'Comic Sans MS, cursive', 12);
        });
        if (t > 5.6) { const k = ease(seg(t, 5.6, 6.1)); g.save(); g.translate(W / 2, 330); g.scale(k, k); text('Один день из жизни чудовища', 0, 0, 48, '#fff', 'center', 'Comic Sans MS, cursive', 10); g.restore(); }
        const py = lerp(900, 780, ease(seg(t, 6.2, 7)));
        monster(1080, py, 0.9, { aR: 2.6 + Math.sin(t * 10) * 0.3, mouth: 'grin', eyes: 'happy' });
      }
    },
    { // 1. Утро
      dur: 27,
      cues: [[0.3, () => SFX.snore()], [2.4, () => SFX.snore()], [4.2, () => SFX.alarm()], [6.2, () => SFX.crash()], [6.5, () => SFX.boing()],
        [8.6, () => SFX.yawn()], ...scrubCues(13, 16.8, 0.35, () => SFX.scrub()), [17, () => SFX.pop()], ...scrubCues(19.6, 22.4, 0.3, () => SFX.scratch()), [22.8, () => SFX.sparkle()]],
      lines: [[9.4, 12.2, 'monster', 'Опять понедельник...', 560, 190], [13, 16.6, 'narr', 'Пожиратель душ очень следит за зубами. Их у него триста сорок семь.'],
        [17.2, 19.2, 'monster', 'Упс.', 880, 190], [23, 26, 'monster', 'Красавчик!', 880, 190]],
      draw(t) {
        bgBedroom();
        // будильник
        const ring = t > 4.2 && t < 6.2;
        const flat = seg(t, 6.15, 6.25);
        clock(1090 + (ring ? Math.sin(t * 60) * 6 : 0), 440, 1, flat);
        if (ring) { text('ДЗЫНЬ!', 1090, 360 + Math.sin(t * 30) * 4, 36, '#ffe040'); }
        if (t > 6.3 && t < 8) { const k = seg(t, 6.3, 8); g.save(); ol(4); g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(1090 + i * 8 + k * 120, 420 - k * 300 + k * k * 360 + (i % 2) * 10); g.stroke(); g.restore(); }
        if (t < 7.5) {
          // спит в кровати
          ol(5); rr(300, 420, 720, 140, 20, '#7a4a2a'); rr(300, 380, 40, 180, 10, '#6a3a1a');
          g.save(); g.translate(430, 500); g.rotate(-1.35); monster(0, 0, 0.62, { eyes: 'sleepy', mouth: 'o', cap: true, pajama: true, noLegs: true, aL: 0, aR: 0 }); g.restore();
          rr(470, 400, 540, 120, 30, '#4a6ad8');
          g.fillStyle = '#ffe070'; [[560, 440], [700, 470], [860, 430], [950, 480]].forEach(([a, b]) => star(a, b, 14));
          // мишка
          ol(4); ell(560, 385, 30, 34, '#b07a4a'); ell(538, 358, 11, 11, '#b07a4a'); ell(582, 358, 11, 11, '#b07a4a');
          ell(560, 392, 10, 7, '#e0b890'); g.fillStyle = INK; g.beginPath(); g.arc(550, 380, 3, 0, PI * 2); g.arc(570, 380, 3, 0, PI * 2); g.fill();
          if (t < 4.2) for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3) % 1); g.globalAlpha = 1 - k; text('Z', 250 + k * 80 + i * 10, 330 - k * 180, 30 + i * 12, '#fff'); g.globalAlpha = 1; }
          if (t > 5.6 && t < 7.5) {
            const k = ease(seg(t, 5.6, 6.2));
            const ex = lerp(900, 1080, k), ey = lerp(450, 430 - Math.sin(k * PI) * 120, k);
            ol(5); g.lineWidth = 38; g.strokeStyle = INK; g.beginPath(); g.moveTo(880, 460); g.lineTo(ex, ey); g.stroke();
            g.lineWidth = 28; g.strokeStyle = '#f4a3c4'; g.beginPath(); g.moveTo(880, 460); g.lineTo(ex, ey); g.stroke(); ol();
          }
          return;
        }
        if (t < 12.8) {
          ol(5); rr(300, 460, 720, 100, 20, '#7a4a2a');
          const rise = ease(seg(t, 7.5, 8.4));
          const mouth = t > 8.6 && t < 10.2 ? 'yawn' : 'sad';
          monster(560, lerp(820, 640, rise), 0.8, { pajama: true, cap: true, eyes: t > 8.6 && t < 10.2 ? 'sleepy' : 'normal', mouth, aL: t > 8.6 && t < 10.2 ? 2.6 : 0.4, aR: t > 8.6 && t < 10.2 ? 2.6 : 0.4 });
          rr(470, 440, 540, 120, 30, '#4a6ad8');
          return;
        }
        // зеркало
        ol(6); rr(1000, 140, 220, 320, 100, '#bfe6ff'); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(1040, 180, 20, 200);
        const brushing = t > 13 && t < 17, broom = t > 19.4 && t < 22.6;
        const armA = brushing ? 2.4 + Math.sin(t * 22) * 0.25 : broom ? 2.2 + Math.sin(t * 18) * 0.4 : 0.5;
        monster(820, 690, 0.85, {
          pajama: true, cap: true, flip: true,
          eyes: t > 22.8 ? 'happy' : t > 17 && t < 19.4 ? 'wide' : 'normal',
          mouth: brushing || broom ? 'grin' : t > 22.8 ? 'grin' : t > 17 ? 'o' : 'grin',
          aR: armA,
          holdR: (hx, hy) => {
            if (brushing) { ol(3); rr(hx - 4, hy - 34, 8, 36, 3, '#40c0ff'); rr(hx - 8, hy - 42, 16, 10, 3, '#fff'); }
            if (broom) { ol(4); rr(hx - 5, hy - 170, 10, 190, 4, '#b07a3a'); g.beginPath(); g.moveTo(hx - 40, hy - 170); g.lineTo(hx + 40, hy - 170); g.lineTo(hx + 20, hy - 230); g.lineTo(hx - 20, hy - 230); g.closePath(); g.fillStyle = '#e0c060'; g.fill(); g.stroke(); }
          }
        });
        if (t > 17 && t < 18.5) { const k = seg(t, 17, 18.5); ol(3); rr(720 + k * 200, 350 - k * 200 + k * k * 400, 8, 20, 3, '#40c0ff'); rr(700 - k * 150, 340 - k * 150 + k * k * 380, 8, 16, 3, '#40c0ff'); }
        if (t > 22.8) { [[790, 395], [830, 405], [770, 410]].forEach(([a, b], i) => star(a, b, 16 + Math.sin(t * 12 + i) * 6)); }
      }
    },
    { // 2. Как напугать человека
      dur: 32,
      cues: [...scrubCues(0.3, 5, 0.35, () => SFX.tiptoe()), [5.8, () => SFX.boom()], [11, () => SFX.boom()], [15.6, () => SFX.pop()], [20.6, () => { SFX.trumpet(); SFX.honk(); }], [21, () => SFX.whoosh()],
        [25, () => SFX.sparkle()], [26, () => SFX.squeak()]],
      lines: [[5.8, 8.2, 'monster', 'БУ!', 560, 250], [11.1, 13.5, 'monster', 'БУУУУУ!!!', 560, 180], [17.3, 19.4, 'hero', 'Круто, табличка!', 840, 340],
        [21.8, 24.8, 'hero', 'О! Привет! Хочешь печеньку?', 840, 340], [26.2, 28.8, 'monster', 'Печенька-а-а...', 560, 380], [29, 31.8, 'narr', 'Пугать людей оказалось сложнее, чем кажется.']],
      draw(t) {
        bgVillage(t);
        well(1060, 450, 0.9);
        const dancing = t < 21;
        const bob = dancing ? Math.abs(Math.sin(t * 7)) * 18 : 0;
        const turn = t > 17 && t < 19.5;
        hero(840, 620 - bob, 0.9, {
          phones: t < 21, flip: turn, eyes: dancing ? 'closed' : 'happy', mouth: 'smile',
          aL: dancing ? 2.4 + Math.sin(t * 7) * 0.5 : 0.2, aR: dancing ? 2.2 - Math.sin(t * 7) * 0.5 : t > 21.6 ? 1.4 : 0.2,
          holdR: (hx, hy) => { if (t > 21.6 && t < 26) { ol(3); ell(hx, hy - 6, 20, 20, '#c88a40'); g.fillStyle = '#5a3010'; [[-6, -10], [6, -2], [-4, 6]].forEach(([a, b]) => { g.beginPath(); g.arc(hx + a, hy - 6 + b, 3, 0, PI * 2); g.fill(); }); } }
        });
        if (dancing) for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i / 3) % 1; g.globalAlpha = 1 - k; text('♪', 900 + i * 30 + Math.sin(k * 6) * 20, 400 - k * 200, 40, '#ffe040'); g.globalAlpha = 1; }
        if (t > 21 && t < 23) { const k = seg(t, 21, 23); g.save(); g.translate(840 + k * 300, 400 - k * 300 + k * k * 200); g.rotate(k * 8); ol(5); g.beginPath(); g.arc(0, 0, 40, PI, 0); g.strokeStyle = '#d02a3a'; g.lineWidth = 9; g.stroke(); g.restore(); }
        // Пожиратель
        const x = lerp(-250, 560, ease(seg(t, 0, 5)));
        let sc = 0.8, jump = 0, squash = 1;
        if (t < 5) { squash = 0.85; jump = Math.abs(Math.sin(t * 9)) * 10; }
        if (t > 5.8 && t < 6.4) jump = Math.sin(seg(t, 5.8, 6.4) * PI) * 60;
        if (t > 10.5) sc = lerp(0.8, 1.1, ease(seg(t, 10.5, 11.2))) - lerp(0, 0.3, seg(t, 14, 15));
        if (t > 26) squash = lerp(1, 0.18, ease(seg(t, 26, 28)));
        const eyes = t > 25 ? 'hearts' : t > 8.5 && t < 10.5 ? 'normal' : t > 13.8 && t < 15 ? 'wide' : 'normal';
        const sneak = t < 5;
        monster(x, 650 - jump, sc, {
          squash, eyes, look: sneak ? 8 : 0,
          mouth: t > 25 ? 'smile' : (t > 5.8 && t < 8.2) || (t > 11 && t < 13.5) ? 'open' : sneak ? 'grin' : t > 8.5 && t < 10.5 ? 'sad' : 'grin',
          aL: sneak ? 2.2 : t > 5.8 && t < 8 ? 2.8 : t > 15.5 && t < 19.4 ? 2.6 : 0.4,
          aR: sneak ? 2.0 : t > 5.8 && t < 8 ? 2.8 : t > 15.5 && t < 19.4 ? 2.6 : t > 19.5 && t < 25 ? 1.7 : 0.4,
          sweat: t > 13.8 && t < 16,
          holdR: (hx, hy) => {
            if (t > 19.5 && t < 25) { ol(4); g.save(); g.translate(hx, hy); g.rotate(-0.4); rr(-6, -10, 110, 16, 6, '#e0b020'); g.beginPath(); g.moveTo(100, -30); g.lineTo(150, -50); g.lineTo(150, 30); g.lineTo(100, 10); g.closePath(); g.fillStyle = '#e0b020'; g.fill(); g.stroke(); g.restore(); if (t > 20.6 && t < 22) text('ТУ-ТУ-У!', hx + 170, hy - 90, 40, '#ffe040'); }
          }
        });
        if (t > 15.5 && t < 19.4) { ol(5); rr(x - 90, 160, 180, 110, 8, '#fff'); text('БУ!', x, 215, 64, '#e02020', 'center', 'Comic Sans MS, cursive', 0); rr(x - 6, 270, 12, 60, 4, '#a07040'); }
        if (t > 8.5 && t < 10.5) text('?', x + 80, 260, 70, '#ffe040');
        if (t > 26) { g.fillStyle = 'rgba(62,49,80,.9)'; ol(5); ell(x, 650, lerp(20, 150, seg(t, 26, 28)), lerp(5, 26, seg(t, 26, 28)), '#3e3150'); }
        if (t > 5.8 && t < 6.6) text('БУ!', x, 200, 120 * ease(seg(t, 5.8, 6.1)), '#ff4040');
      }
    },
    { // 3. Доставка
      dur: 32,
      cues: [[0.2, () => SFX.phone()], [7, () => SFX.zoom()], [13, () => SFX.scratch()], [13.6, () => SFX.thud()], ...scrubCues(18.2, 21, 0.6, () => SFX.grunt()), [21, () => SFX.pop()], [21.1, () => SFX.whoosh()], [23.2, () => SFX.splash()], [23.6, () => SFX.boing()], [25.2, () => SFX.quack()]],
      lines: [[0.8, 6.6, 'monster', 'Алло, пиццерия? Одну пиццу с душой, пожалуйста. И побольше сыра!', 640, 180],
        [8.6, 12.6, 'boy', 'Доставка! С вас одна душа... Шучу! Триста рублей.', 960, 380], [14, 16.2, 'monster', 'Ой. Я застрял.', 610, 250],
        [18.2, 20.6, 'hero', 'Раз, два... ТЯНИ!', 380, 380], [25.6, 28, 'monster', 'Я в порядке!', 1120, 320], [28.2, 31.6, 'boy', 'А пицца... тоже в порядке.', 960, 380]],
      draw(t) {
        if (t < 7) {
          bgBedroom();
          monster(640, 700, 0.85, { eyes: 'happy', mouth: 'grin', aR: 2.8, holdR: (hx, hy) => { ol(4); rr(hx - 14, hy - 44, 28, 56, 6, '#222'); rr(hx - 9, hy - 38, 18, 30, 3, '#6ad0ff'); } });
          return;
        }
        bgDoor();
        // дверь
        const open = t > 13;
        ol(5); rr(530, 330, 160, 290, 6, open ? '#1a1410' : '#8a5a30');
        if (!open) ell(665, 480, 8, 8, '#e0c040');
        // Пожиратель застрял
        if (t > 13 && t < 21) {
          const shake = t > 18 ? Math.sin(t * 40) * 6 : 0;
          monster(610 + shake, 720, 0.9, { sx: 0.62, eyes: t > 18 ? 'x' : 'wide', mouth: t > 18 ? 'open' : 'o', aL: t > 16.4 ? PI / 2 : 0.5, aR: t > 16.4 ? PI / 2 : 0.5, armLen: 150 });
          ol(5); g.fillStyle = '#d8a868'; g.fillRect(470, 300, 60, 330); g.fillRect(690, 300, 60, 330); g.fillRect(470, 290, 280, 44);
          g.strokeRect(530, 330, 160, 300);
        }
        // полёт в колодец
        well(1120, 470, 0.9);
        if (t > 21 && t < 23.3) {
          const k = seg(t, 21, 23.2);
          const x = lerp(610, 1120, k), y = lerp(600, 520, k) - Math.sin(k * PI) * 420;
          monster(x, y, 0.5, { rot: k * PI * 4, eyes: 'x', mouth: 'open', aL: 2.6, aR: 2.6 });
        }
        if (t > 23.2 && t < 25) particles(16, 1120, 520, t - 23.2, 520, '#6ac0ff', 9, 900, 2);
        if (t > 25) { const k = ease(seg(t, 25, 25.6)); g.save(); g.beginPath(); g.rect(900, 0, 440, 530); g.clip(); monster(1120, 780 - k * 170, 0.62, { duck: true, eyes: 'happy', mouth: 'grin', aR: 2.8 }); g.restore(); well(1120, 470, 0.9); g.save(); g.beginPath(); g.rect(1000, 530, 240, 100); g.clip(); g.restore(); }
        // Миша на самокате
        const bx = t < 8.2 ? lerp(1500, 960, ease(seg(t, 7, 8.2))) : t > 16 && t < 18 ? lerp(960, 760, seg(t, 16, 17)) : t >= 18 && t < 21 ? 760 : 960;
        const pulling = t > 18 && t < 21;
        if (t < 16.5) { ol(5); rr(bx - 70, 610, 140, 14, 6, '#40a0e0'); rr(bx + 50, 460, 12, 160, 6, '#40a0e0'); ell(bx - 55, 628, 16, 16, '#333'); ell(bx + 55, 628, 16, 16, '#333'); }
        const pizzaOnHead = t > 23.6;
        boy(pulling ? 780 : bx, 610, 1, {
          cap: true, eyes: pulling ? 'x' : pizzaOnHead ? 'happy' : 'normal', mouth: pulling ? 'open' : 'smile', flip: pulling,
          aL: pulling ? -PI / 2 : 0.3, aR: pulling ? PI / 2 : t < 13 ? 1.4 : 0.3, pizza: pizzaOnHead,
          holdR: (hx, hy) => { if (!pizzaOnHead && t < 21) { ol(4); rr(hx - 45, hy - 20, 90, 22, 4, '#f0d8a8'); } }
        });
        if (t > 21 && t < 23.6) { const k = seg(t, 21, 23.6); ol(4); rr(lerp(760, 960, k) - 45, lerp(560, 420, k) - Math.sin(k * PI) * 200, 90, 22, 4, '#f0d8a8'); }
        if (t > 16.5) {
          const hx = t < 18 ? lerp(-100, 380, ease(seg(t, 16.5, 18))) : 380;
          hero(pulling ? 420 : hx, 620, 0.95, { eyes: pulling ? 'x' : 'normal', mouth: pulling ? 'open' : 'smile', aR: pulling ? PI / 2 : 0.2, aL: pulling ? PI / 2 : 0.2 });
        }
        if (t > 21 && t < 21.6) text('ХЛОП!', 610, 300, 90, '#ffe040');
        if (t > 23.2 && t < 24.4) text('ПЛЮХ!', 1120, 300, 80, '#6ac0ff');
      }
    },
    { // 4. Полёт
      dur: 30,
      cues: [[11.5, () => SFX.rumble()], [12.4, () => SFX.splash()], [16, () => SFX.crunch()], [17.5, () => SFX.crunch()], [18.6, () => SFX.crunch()], [22, () => SFX.ding()], [26.8, () => SFX.burp()], [29, () => SFX.laugh()]],
      lines: [[0.5, 4, 'narr', 'Полёт на Туманный остров. Эконом-класс.'], [5.6, 8.6, 'pale', 'Чай? Кофе? Душу?', 1040, 280], [8.8, 11, 'monster', 'Мне всё, пожалуйста.', 470, 160],
        [13.1, 15.2, 'monster', 'Ай! Горячо!', 470, 160], [19.4, 21.6, 'hero', 'Даже не думай.', 820, 400],
        [22.2, 26.5, 'narr', 'Говорит капитан: из-за пассажира на месте 13Б мы летим немного... ниже.'], [27.6, 29.8, 'monster', 'Это не я.', 470, 160]],
      draw(t) {
        const shake = t > 11.5 && t < 13.6 ? 10 : 0;
        const tilt = t > 22.2 && t < 26.8 ? Math.sin(seg(t, 22.2, 26.8) * PI) * 0.08 : 0;
        g.save(); g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        bgPlane(t, tilt);
        g.save(); g.translate(W / 2, H / 2); g.rotate(tilt); g.translate(-W / 2, -H / 2);
        seat(470, 600, 1.05); seat(820, 600, 1);
        const burp = t > 26.8 && t < 28.5;
        // Пожиратель сидит, колени у подбородка
        monster(470, 690, 0.72, {
          noLegs: true, eyes: t > 16 && t < 21 ? 'wide' : burp ? 'happy' : 'normal', tea: t > 12.4 && t < 16,
          mouth: t > 15.8 && t < 19 ? 'chew' : burp ? 'open' : t > 13 && t < 15.2 ? 'open' : 'grin', look: t > 19 && t < 21 ? -10 : 0,
          aL: 0.9, aR: t > 15.6 && t < 19 ? 2.4 : 0.9
        });
        ol(5); ell(430, 500, 40, 50, '#3e3150'); ell(510, 500, 40, 50, '#3e3150');
        g.strokeStyle = '#8a8a90'; g.lineWidth = 10; [440, 470, 500].forEach(y => { g.beginPath(); g.moveTo(390, y); g.lineTo(550, y); g.stroke(); }); ol();
        // поднос с едой
        if (t < 17.5) { ol(4); rr(380, 430, 170, 20, 6, '#c0c0c8'); if (t < 16) { ell(430, 418, 30, 14, '#e0a040'); ell(500, 420, 22, 12, '#60b040'); } }
        if (t < 18.6) { ol(3); rr(560, 400, 8, 50, 3, '#ddd'); }
        // герой рядом
        const slide = seg(t, 19.2, 20.4) * 60;
        hero(820 + slide, 660, 0.85, { eyes: burp ? 'x' : t > 16 && t < 21 ? 'wide' : 'normal', mouth: t > 19.4 && t < 21.6 ? 'flat' : 'smile', hoodBlow: burp });
        // стюардесса
        if (t > 4.2) {
          const x = t < 11 ? lerp(1450, 1000, ease(seg(t, 4.2, 5.4))) : 1000;
          ol(5); rr(x - 120, 420, 110, 150, 8, '#c8c8d0'); ell(x - 90, 410, 16, 12, '#fff'); ell(x - 45, 410, 16, 12, '#fff');
          pale(x + 40, 600, 0.8, { uniform: true, blow: burp ? 1 : 0, aL: 1.2, eye: true });
        }
        if (burp) text('БУЭЭЭ!', 470, 250, 80, '#9ad040');
        if (t > 12.4 && t < 13.2) text('ПЛЮХ!', 470, 250, 70, '#c08040');
        g.restore(); g.restore();
      }
    },
    { // 5. Салон красоты
      dur: 28,
      cues: [...scrubCues(6.5, 14, 0.38, () => SFX.snip()), [14, () => SFX.sparkle()], [20.4, () => SFX.squeak()], [22, () => SFX.boing()], [26.6, () => SFX.laugh()]],
      lines: [[0.5, 3, 'hero', 'Как стрижём?', 860, 300], [3.2, 6.3, 'pale', 'Ммм... Чтобы было пострашнее.', 600, 260],
        [14.5, 17.6, 'pale', 'Ой! Я вижу! Я ВСЁ ВИЖУ!', 600, 260], [18.2, 21, 'pale', 'Какой ужас... Я МИЛАЯ!', 600, 260], [23.4, 26.4, 'hero', 'Клиент всегда прав.', 860, 300]],
      draw(t) {
        bgSalon();
        // зеркало
        ol(6); rr(180, 170, 250, 330, 20, '#cfeaff');
        const cut = ease(seg(t, 6.5, 14)), wigged = t > 22;
        if (t > 18) { g.save(); g.beginPath(); g.roundRect(186, 176, 238, 318, 16); g.clip(); pale(305, 700, 0.9, { cut: wigged ? 0 : cut, wig: wigged, flip: true }); g.restore(); }
        // кресло
        ol(5); rr(520, 460, 170, 150, 20, '#d0306a'); rr(590, 610, 30, 60, 6, '#888');
        const jump = t > 20.3 && t < 21.2 ? Math.sin(seg(t, 20.3, 21.2) * PI) * 50 : 0;
        pale(605, 610 - jump, 0.9, { cut: wigged ? 0 : cut, wig: wigged, aL: t > 20.3 && t < 22.4 ? 2.6 : 0.3, aR: t > 20.3 && t < 22.4 ? 2.6 : 0.3 });
        // накидка
        ol(5); g.beginPath(); g.moveTo(535, 400); g.lineTo(675, 400); g.lineTo(720, 560); g.lineTo(490, 560); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.stroke();
        // падающие волосы
        if (t > 6.5 && t < 16) for (let i = 0; i < 14; i++) { const k = ((t - 6.5) * 0.5 + i / 14) % 1; g.fillStyle = '#0a0a0c'; g.save(); g.translate(560 + (i * 23) % 110, 380 + k * 250); g.rotate(i + k * 4); g.fillRect(-2, -12, 4, 24); g.restore(); }
        if (t > 8) { g.fillStyle = '#0a0a0c'; for (let i = 0; i < 18 * seg(t, 8, 14); i++) g.fillRect(470 + (i * 37) % 260, 640 + (i * 13) % 30, 26, 5); }
        // парик
        if (t > 21 && t < 22.1) { const k = seg(t, 21, 22); pale(605, lerp(200, 610, k), 0.9, { cut: 0, wig: true, eye: false }); }
        // парикмахер
        const snip = t > 6.5 && t < 14;
        hero(860 + (snip ? Math.sin(t * 3) * 40 : 0), 640, 0.95, {
          flip: true, mouth: t > 18 && t < 21 ? 'open' : 'smile', eyes: t > 14 && t < 17.6 ? 'wide' : 'normal',
          aR: snip ? 2.2 + Math.sin(t * 20) * 0.2 : 0.4,
          holdR: (hx, hy) => { ol(3); const o = snip ? Math.abs(Math.sin(t * 20)) * 0.6 : 0.3; g.save(); g.translate(hx, hy); [o, -o].forEach(a => { g.save(); g.rotate(a - PI / 2); rr(0, -3, 50, 6, 3, '#c0c0c8'); g.restore(); }); ell(-8, 8, 8, 8, '#e04060'); ell(8, 8, 8, 8, '#e04060'); g.restore(); }
        });
        if (t > 14 && t < 17) { [[560, 250], [650, 240], [610, 200]].forEach(([a, b], i) => star(a, b, 18 + Math.sin(t * 10 + i) * 8)); }
        if (t > 20.3 && t < 21.4) text('А-А-А!', 605, 170, 70, '#ff80b0');
      }
    },
    { // 6. Вечеринка у колодца
      dur: 30, tempo: 152,
      cues: [[0.1, () => music(true, 152)], [10, () => SFX.spin()], [11.5, () => SFX.ooh()], [13.6, () => SFX.drumroll()], [16.5, () => { SFX.pop(); SFX.boing(); }], [17.2, () => SFX.clap()], [23.5, () => SFX.camera()]],
      lines: [[0.4, 3.6, 'narr', 'Вечером все собрались у колодца на вечеринку.'], [7.4, 9.8, 'monster', 'Смотрите, что я умею!', 640, 170],
        [17.5, 19.6, 'boy', 'Ещё! Ещё!', 380, 330], [20.4, 23.2, 'angel', 'Групповое фото! Все улыбаемся!', 180, 300]],
      draw(t) {
        bgDisco(t);
        well(640, 470, 0.8);
        const photo = t > 23.5;
        const beat = Math.abs(Math.sin(t * 5));
        const dance = k => photo ? 0 : Math.abs(Math.sin(t * 5 + k)) * 16;
        angel(180, 640 - dance(0), 0.9, { aL: photo ? 0.3 : 2.6 - beat * 0.6, aR: photo ? 2.8 : 2.4 + beat * 0.4, haloSpin: !photo });
        boy(370, 650 - dance(1), 1.05, { eyes: photo ? 'wink' : 'happy', mouth: photo ? 'grin' : 'smile', aL: 2.6 - beat * 0.8, aR: 2.6 - (1 - beat) * 0.8 });
        hero(1000, 650 - dance(2), 0.9, { eyes: photo ? 'x' : 'happy', mouth: photo ? 'tongue' : 'smile', aL: photo ? 2.8 : 1.4 + beat, aR: photo ? 2.8 : 1.4 + (1 - beat) });
        pale(1140, 650 - dance(3), 0.8, { cut: 1, aL: 2.4, aR: 2.4 - beat });
        faceless(820, 650 - dance(4), 0.75, { spin: photo ? 0.4 : t * 6, aL: 2.4, aR: 1 + beat });
        // Пожиратель: брейк-данс
        if (t < 10 || photo) {
          monster(560, 650 - (photo ? 0 : dance(5)), 0.72, { eyes: photo ? 'cross' : 'happy', mouth: photo ? 'tongue' : 'grin', flowers: photo, aL: photo ? 2.8 : 2.4 + beat * 0.4, aR: photo ? 1.2 : 2.4 - beat * 0.4 });
        } else if (t < 16.5) {
          const spinSpeed = 4 + (t - 10) * 6;
          const sink = seg(t, 14, 16) * 260;
          g.save(); g.beginPath(); g.rect(0, 0, W, 600); g.clip();
          g.save(); g.translate(560, 330 + sink); g.scale(Math.cos(t * spinSpeed), 1); monster(0, 0, 0.72, { rot: PI, eyes: 'x', mouth: 'open', aL: 1.4, aR: 1.4 }); g.restore();
          g.restore();
          if (t > 14) particles(12, 560, 590, (t - 14) % 0.6, 300, '#8a6a4a', 7, 900, Math.floor(t * 2));
          if (t > 11.5 && t < 13.5) text('О-О-О!', 850, 300, 60, '#ffe040');
        } else {
          const k = ease(seg(t, 16.5, 17.3));
          monster(lerp(640, 560, k), lerp(470, 650, k) - Math.sin(k * PI) * 200, 0.72, { flowers: true, eyes: 'happy', mouth: 'grin', aL: 2.6, aR: 2.6 });
        }
        if (photo) {
          const f = 1 - seg(t, 23.5, 24.3);
          g.fillStyle = `rgba(255,255,255,${f})`; g.fillRect(0, 0, W, H);
          ol(0); g.strokeStyle = '#fff'; g.lineWidth = 40; g.strokeRect(40, 40, W - 80, H - 150);
          g.fillStyle = '#fff'; g.fillRect(40, H - 130, W - 80, 110);
          text('Лучшие друзья (почти)', W / 2, H - 75, 44, INK, 'center', 'Comic Sans MS, cursive', 0);
          if (t < 24.3) text('ЩЁЛК!', W / 2, 300, 110, '#ffe040');
        }
      }
    },
    { // 7. Конец
      dur: 13,
      cues: [[0.4, () => SFX.fanfare()], [3.6, () => SFX.boing()], [6.8, () => SFX.pop()], [12, () => music(false)]],
      lines: [[4, 6.6, 'monster', 'А продолжение будет?', 1000, 470], [7, 9.2, 'boy', 'Может быть...', 280, 470]],
      draw(t) {
        g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t + i))})`; g.fillRect((i * 151) % W, (i * 89) % H, 3, 3); }
        const k = ease(seg(t, 0.3, 1.2));
        g.save(); g.translate(W / 2, 250); g.scale(k, k);
        text(t > 9.6 ? 'КОНЕЦ... ИЛИ НЕТ?' : 'КОНЕЦ', 0, 0, 110, '#ff4a4a', 'center', 'Comic Sans MS, cursive', 12);
        g.restore();
        const my = lerp(1000, 790, ease(seg(t, 3.5, 4.2)));
        monster(1000, my, 0.9, { eyes: 'wide', mouth: 'o', aL: 2.8, aR: 0.4 });
        if (t > 6.8) { const by = lerp(900, 760, ease(seg(t, 6.8, 7.3))); boy(280, by, 1.3, { eyes: t > 9.2 ? 'wink' : 'normal', mouth: 'smile', aR: 2.6 }); }
        if (t > 9.8) {
          text('Мультик сделан специально для игры «Пожиратель душ»', W / 2, 370, 26, '#bbb', 'center', 'Georgia', 0);
          text('Нажми, чтобы выйти', W / 2, 420, 22, '#888', 'center', 'Georgia', 0);
        }
      }
    }
  ];
  // ================= ДВИЖОК: несколько мультиков =================
  const FILMS = { fun: { title: 'Один день из жизни чудовища', scenes: SCENES } };
  let film = FILMS.fun, TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
  function register(id, f) { FILMS[id] = f; }
  function pickFilm(id) { film = FILMS[id] || FILMS.fun; TOTAL = film.scenes.reduce((a, s) => a + s.dur, 0); }
  function sceneAt(T) {
    const sc = film.scenes; let acc = 0, si = 0;
    while (si < sc.length - 1 && T >= acc + sc[si].dur) { acc += sc[si].dur; si++; }
    return [si, sc[si], T - acc];
  }
  function drawLines(sc, t, si, live) {
    (sc.lines || []).forEach(([a, b, who, str, x, y], li) => {
      if (t < a || t > b) return;
      const key = si + ':' + li;
      if (live && !spoken.has(key)) { spoken.add(key); speak(who, str); }
      if (film.line) film.line(who, str, x, y, t - a, b - a);
      else if (who === 'narr') caption(str); else bubble(x, y, str, t - a);
    });
  }
  let spoken = new Set(), lastScene = -1;
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const T = (now - startT) / 1000;
    if (T >= TOTAL) { stop(); return; }
    const [si, sc, t] = sceneAt(T);
    if (si !== lastScene) { lastScene = si; if (sc.tempo && musicOn) bpm = sc.tempo; }
    (sc.cues || []).forEach(([ct, fn], ci) => { const key = si + ':' + ci; if (t >= ct && !fired.has(key)) { fired.add(key); fn(); } });
    g.save(); sc.draw(t); g.restore();
    drawLines(sc, t, si, true);
    if (film.post) { g.save(); film.post(T, t, si); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, H - 4, W * T / TOTAL, 4);
    sched();
  }
  function play(id, done) {
    if (typeof id === 'function') { done = id; id = 'fun'; }
    pickFilm(id || 'fun');
    onDone = done;
    if (!document.getElementById('cartoon')) {
      const wrapEl = document.createElement('div'); wrapEl.id = 'cartoon';
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; wrapEl.appendChild(cv);
      const skip = document.createElement('button'); skip.id = 'cartoonSkip'; skip.textContent = 'Пропустить ✕'; wrapEl.appendChild(skip);
      document.body.appendChild(wrapEl);
      g = cv.getContext('2d');
      skip.onclick = e => { e.stopPropagation(); stop(); };
      cv.onclick = () => { if ((performance.now() - startT) / 1000 > TOTAL - 3.5) stop(); };
      addEventListener('keydown', e => { if (running && e.code === 'Escape') stop(); });
    }
    document.getElementById('cartoon').style.display = 'flex';
    aInit();
    fired = new Set(); spoken = new Set(); lastScene = -1; bpm = 132;
    running = true; startT = performance.now();
    musicTimer = setInterval(sched, 60);
    if (film.start) film.start();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false; cancelAnimationFrame(raf); clearInterval(musicTimer); music(false);
    if (film.stop) film.stop();
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    document.getElementById('cartoon').style.display = 'none';
    if (onDone) onDone();
  }
  // Для проверки: нарисовать кадр в момент T (без звука)
  function renderAt(T, id) {
    if (id) pickFilm(id);
    if (!cv) { cv = document.createElement('canvas'); cv.width = W; cv.height = H; g = cv.getContext('2d'); }
    const [si, sc, t] = sceneAt(T);
    g.save(); sc.draw(t); g.restore();
    drawLines(sc, t, si, false);
    if (film.post) { g.save(); film.post(T, t, si); g.restore(); }
    return cv;
  }
  // Общие инструменты для других мультиков
  const lib = {
    get g() { return g; }, get ac() { return ac; }, get out() { return out; }, get nb() { return nb; },
    W, H, PI, INK, clamp, seg, ease, lerp, ol, ell, rr, limb, text, star, wrap, particles,
    monster, boy, hero, pale, faceless, tone, noise, toneAt, noiseAt, SFX, VOICES, speak
  };
  function setMuted(m) {
    muted = !!m;
    if (out) out.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05);
    if (muted) try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  return { play, stop, renderAt, register, lib, setMuted, films: FILMS, get length() { return TOTAL; } };
})();

'use strict';
// Страшный мультик «ОН УЖЕ ЗДЕСЬ» — «найденная запись» с камеры.
(() => {
  const L = Cartoon.lib;
  const { W, H, PI, INK, clamp, seg, ease, lerp } = L;
  const g = () => L.g;
  Object.assign(L.VOICES, { thing: [0.01, 0.6], misha: [1.8, 0.85], whisper: [0.4, 0.7], rec: [0.7, 0.9] });

  // ================= ЗВУК УЖАСА =================
  let drone = null, rain = null, boxTimer = 0, boxOn = false, boxNext = 0, boxI = 0;
  function loopNoise(type, freq, q, vol) {
    const ac = L.ac; if (!ac) return null;
    const s = ac.createBufferSource(); s.buffer = L.nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gn = ac.createGain(); gn.gain.value = 0.0001;
    s.connect(f); f.connect(gn); gn.connect(L.out); s.start();
    gn.gain.setTargetAtTime(vol, ac.currentTime, 1);
    return { s, gn };
  }
  function droneStart() {
    const ac = L.ac; if (!ac || drone) return;
    const gn = ac.createGain(); gn.gain.value = 0.0001; gn.connect(L.out);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(gn);
    const oscs = [41.2, 43.6, 61.7, 87.3].map(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    gn.gain.setTargetAtTime(0.09, ac.currentTime, 2);
    drone = { gn, oscs, lp };
  }
  function droneLevel(v) { if (drone && L.ac) drone.gn.gain.setTargetAtTime(v, L.ac.currentTime, 0.4); }
  function stopAll() {
    const ac = L.ac; if (!ac) return;
    if (drone) { const d = drone; drone = null; d.gn.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3); setTimeout(() => d.oscs.forEach(o => { try { o.stop(); } catch (e) { /* */ } }), 1500); }
    [rain, windN].forEach(n => { if (n) { n.gn.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3); setTimeout(() => { try { n.s.stop(); } catch (e) { /* */ } }, 1500); } });
    rain = null; windN = null; boxOn = false;
  }
  let windN = null;
  // Расстроенная музыкальная шкатулка (колыбельная)
  const BOX = [76, 79, 83, 81, 79, 76, 74, 76, 0, 72, 76, 79, 78, 76, 0, 0, 76, 79, 83, 84, 83, 79, 76, 0, 74, 72, 71, 72, 0, 0, 0, 0];
  function boxSched() {
    const ac = L.ac; if (!ac || !boxOn) return;
    while (boxNext < ac.currentTime + 0.3) {
      const m = BOX[boxI % BOX.length];
      if (m) {
        const f = 440 * Math.pow(2, (m - 69) / 12) * (1 + (Math.random() - 0.5) * 0.012) * (1 - boxI * 0.0006);
        L.toneAt(boxNext, f, 1.1, 'sine', 0.07); L.toneAt(boxNext, f * 2.01, 0.5, 'triangle', 0.015);
      }
      boxNext += 0.42 + boxI * 0.004; boxI++;
    }
  }
  function box(on) { const ac = L.ac; if (on && ac) { boxOn = true; boxI = 0; boxNext = ac.currentTime + 0.1; } else boxOn = false; }
  const S = {
    static(d = 0.6, v = 0.3) { L.noise(d, 'highpass', 1200, 0.5, v); },
    heart(v = 0.5) { L.tone(58, 0.16, 'sine', v, 40); L.tone(52, 0.16, 'sine', v * 0.8, 38, 0.22); },
    creak() { L.tone(140, 2.2, 'sawtooth', 0.06, 70); L.noise(2, 'bandpass', 560, 9, 0.16); L.noise(1, 'bandpass', 880, 12, 0.08, 0.8); },
    knock() { for (let i = 0; i < 3; i++) { L.noise(0.09, 'lowpass', 240, 1, 0.8, i * 0.5); L.tone(80, 0.12, 'sine', 0.5, 55, i * 0.5); } },
    tick() { L.noise(0.02, 'highpass', 3000, 1, 0.15); },
    thunder() { L.noise(2.8, 'lowpass', 180, 0.7, 0.9); L.noise(0.35, 'highpass', 1500, 0.5, 0.5); L.tone(40, 2, 'sine', 0.4, 25); },
    crack() { L.noise(0.06, 'highpass', 1800, 1, 0.5); L.noise(0.05, 'bandpass', 900, 3, 0.4, 0.07); },
    breath() { L.noise(1.3, 'bandpass', 700, 1.5, 0.22); L.noise(1.1, 'bandpass', 500, 1.5, 0.18, 1.5); },
    whisper() { for (let i = 0; i < 7; i++) L.noise(0.35 + Math.random() * 0.4, 'bandpass', 2400 + Math.random() * 2400, 9, 0.14, i * 0.3); },
    sting() { [1180, 1250, 1330, 1410].forEach((f, i) => L.tone(f, 1.6, 'sawtooth', 0.045, f * 0.96, i * 0.015)); L.tone(55, 1.8, 'sawtooth', 0.2, 35); },
    whoosh() { L.noise(0.4, 'bandpass', 900, 1, 0.4); },
    grab() { L.tone(90, 0.3, 'sine', 0.6, 40); L.noise(0.2, 'lowpass', 400, 1, 0.5); },
    scream(v = 1) {
      const ac = L.ac; if (!ac) return;
      const t = ac.currentTime;
      const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      const ws = ac.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 10); } ws.curve = c;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
      ws.connect(bp); bp.connect(gn); gn.connect(L.out);
      [600, 690, 950, 1340, 1800].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 1.6);
        const vb = ac.createOscillator(); vb.frequency.value = 16 + i * 3; const vg = ac.createGain(); vg.gain.value = f * 0.05; vb.connect(vg); vg.connect(o.frequency);
        o.connect(ws); o.start(t); vb.start(t); o.stop(t + 1.8); vb.stop(t + 1.8);
      });
      L.noise(1.4, 'highpass', 2000, 0.5, v * 0.7);
    }
  };

  // ================= РИСОВАНИЕ =================
  // Слой темноты с «дырами» света
  const dk = document.createElement('canvas'); dk.width = W; dk.height = H;
  const dg = dk.getContext('2d');
  function darkness(alpha, lights) {
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = `rgba(0,0,0,${alpha})`; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = 'destination-out';
    lights.forEach(l => {
      if (l.beam) {
        const [sx, sy] = l.beam;
        const ang = Math.atan2(l.y - sy, l.x - sx), len = Math.hypot(l.x - sx, l.y - sy);
        dg.save(); dg.translate(sx, sy); dg.rotate(ang);
        const gr = dg.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.85)');
        dg.fillStyle = gr; dg.beginPath(); dg.moveTo(0, -6); dg.lineTo(len, -l.r * 0.8); dg.lineTo(len, l.r * 0.8); dg.lineTo(0, 6); dg.closePath(); dg.fill();
        dg.restore();
      }
      const gr = dg.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, `rgba(0,0,0,${l.a || 1})`); gr.addColorStop(0.6, `rgba(0,0,0,${(l.a || 1) * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.beginPath(); dg.arc(l.x, l.y, l.r, 0, PI * 2); dg.fill();
    });
    g().drawImage(dk, 0, 0);
  }
  function fill(c) { g().fillStyle = c; g().fillRect(0, 0, W, H); }
  function glowEyes(x, y, size, col, open = 1, gap = 1) {
    const c = g();
    [-1, 1].forEach(k => {
      const ex = x + k * size * 1.6 * gap;
      const gr = c.createRadialGradient(ex, y, 0, ex, y, size * 3);
      gr.addColorStop(0, col); gr.addColorStop(0.25, col.replace('1)', '.5)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(ex, y, size * 3, 0, PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, y, size, size * open, 0, 0, PI * 2); c.fill();
    });
  }
  function tallFigure(x, y, h, alpha = 1, eyes = true) {
    const c = g(); c.save(); c.globalAlpha = alpha; c.fillStyle = '#020203';
    c.beginPath(); c.ellipse(x, y - h * 0.92, h * 0.05, h * 0.07, 0, 0, PI * 2); c.fill();
    c.beginPath(); c.moveTo(x - h * 0.06, y - h * 0.85); c.lineTo(x + h * 0.06, y - h * 0.85); c.lineTo(x + h * 0.05, y - h * 0.4); c.lineTo(x - h * 0.05, y - h * 0.4); c.fill();
    c.lineCap = 'round'; c.strokeStyle = '#020203';
    c.lineWidth = h * 0.025; [[-1, 0.15], [1, -0.1]].forEach(([k, sw]) => { c.beginPath(); c.moveTo(x + k * h * 0.05, y - h * 0.82); c.lineTo(x + k * h * (0.1 + sw * 0.1), y - h * 0.3); c.stroke(); });
    c.lineWidth = h * 0.03; [-1, 1].forEach(k => { c.beginPath(); c.moveTo(x + k * h * 0.03, y - h * 0.42); c.lineTo(x + k * h * 0.05, y); c.stroke(); });
    c.restore();
    if (eyes && alpha > 0.5) glowEyes(x, y - h * 0.93, h * 0.008, 'rgba(255,255,255,1)', 1, 1.2);
  }
  function claws(x, y, k, dir = 1) {
    const c = g(); c.save(); c.translate(x, y); c.scale(dir, 1);
    for (let i = 0; i < 4; i++) {
      const fy = i * 26, len = 40 + k * 30 - Math.abs(i - 1.5) * 6;
      c.strokeStyle = '#1a1614'; c.lineWidth = 13; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-4, fy); c.quadraticCurveTo(len * 0.6, fy - 8, len, fy + 10); c.stroke();
      c.strokeStyle = '#6a625a'; c.lineWidth = 8; c.stroke();
      c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(len - 3, fy + 5); c.lineTo(len + 14, fy + 22); c.lineTo(len + 4, fy + 12); c.fill();
    }
    c.restore();
  }
  function paleFigure(x, y, s, reach = 0) {
    const c = g(); c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#8a8680'; c.beginPath(); c.moveTo(-28, -240); c.lineTo(28, -240); c.lineTo(55, 0); c.lineTo(-55, 0); c.fill();
    c.strokeStyle = '#d8d4cc'; c.lineWidth = 12; c.lineCap = 'round';
    [-1, 1].forEach(k => { c.beginPath(); c.moveTo(k * 26, -232); c.lineTo(k * (40 + reach * 20), -232 + 120 - reach * 150); c.stroke(); });
    c.fillStyle = '#e8e4dc'; c.beginPath(); c.ellipse(0, -280, 34, 40, 0, 0, PI * 2); c.fill();
    c.fillStyle = '#050506'; c.beginPath(); c.moveTo(-40, -300); c.quadraticCurveTo(0, -345, 40, -300); c.lineTo(46, -90); c.lineTo(-46, -90); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(9, -278, 4, 0, PI * 2); c.fill();
    c.restore();
  }
  function bigFace(t, type = 'eater') {
    const c = g();
    const sx = (Math.random() - 0.5) * 40, sy = (Math.random() - 0.5) * 40;
    c.save(); c.translate(W / 2 + sx, H / 2 + sy); const k = 1 + Math.min(t, 0.4) * 0.8; c.scale(k, k);
    fill('#000');
    if (type === 'pale') {
      const gr = c.createRadialGradient(0, 0, 40, 0, 0, 420); gr.addColorStop(0, '#dcd8d0'); gr.addColorStop(1, '#000');
      c.fillStyle = gr; c.beginPath(); c.ellipse(0, 20, 300, 420, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(-110, -50, 70, 95, 0, 0, PI * 2); c.ellipse(110, -50, 70, 95, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-105, -40, 7, 0, PI * 2); c.arc(105, -40, 7, 0, PI * 2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, 210, 80, 170, 0, 0, PI * 2); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 12;
      for (let i = 0; i < 40; i++) { const x = -330 + i * 17; if (Math.abs(x) > 150 || i % 3 === 0) { c.beginPath(); c.moveTo(x, -500); c.quadraticCurveTo(x + (i % 5 - 2) * 20, 0, x + (i % 7 - 3) * 12, 500); c.stroke(); } }
    } else {
      const gr = c.createRadialGradient(0, -20, 40, 0, 0, 440); gr.addColorStop(0, '#4a4040'); gr.addColorStop(0.7, '#1a1414'); gr.addColorStop(1, '#000');
      c.fillStyle = gr; c.beginPath(); c.ellipse(0, 0, 380, 440, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(-140, -90, 95, 70, 0.3, 0, PI * 2); c.ellipse(140, -90, 95, 70, -0.3, 0, PI * 2); c.fill();
      [-140, 140].forEach(x => { const e = c.createRadialGradient(x, -85, 0, x, -85, 60); e.addColorStop(0, '#fff'); e.addColorStop(0.2, '#ff2000'); e.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = e; c.beginPath(); c.arc(x, -85, 60, 0, PI * 2); c.fill(); });
      c.fillStyle = '#100000'; c.beginPath(); c.ellipse(0, 190, 250, 150, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#e0d8c8';
      for (let i = 0; i < 14; i++) {
        const x = -230 + i * 35, d = Math.abs(i - 6.5);
        c.beginPath(); c.moveTo(x, 70 + d * 6); c.lineTo(x + 30, 70 + d * 6); c.lineTo(x + 15, 170 - d * 4); c.fill();
        c.beginPath(); c.moveTo(x, 330 - d * 6); c.lineTo(x + 30, 330 - d * 6); c.lineTo(x + 15, 230 + d * 4); c.fill();
      }
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      for (let i = 0; i < 16; i++) { c.beginPath(); let x = -250 + (i * 71) % 500, y = -380 + (i * 37) % 200; c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += ((i * j * 13) % 60) - 30; y += 40; c.lineTo(x, y); } c.stroke(); }
    }
    c.restore();
    c.fillStyle = 'rgba(160,0,0,.25)'; c.fillRect(0, 0, W, H);
  }
  function hcaption(str, k, dur) {
    const c = g();
    const a = Math.min(1, k * 3, (dur - k) * 3);
    c.save(); c.globalAlpha = clamp(a, 0, 1);
    c.font = 'italic 32px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(str, W / 2, H - 70);
    c.fillStyle = '#e8e0d0'; c.fillText(str, W / 2, H - 70);
    c.restore();
  }
  function htext(str, x, y, size, col = '#ddd', font = 'Courier New, monospace') {
    const c = g(); c.font = `bold ${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(str, x, y);
  }
  // Зерно, полосы, REC
  const scan = document.createElement('canvas'); scan.width = W; scan.height = H;
  (() => { const s = scan.getContext('2d'); s.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 3) s.fillRect(0, y, W, 1); })();
  function vhs(T, strong) {
    const c = g();
    for (let i = 0; i < (strong ? 900 : 260); i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)'; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    c.drawImage(scan, 0, 0);
    if (Math.random() < (strong ? 0.5 : 0.04)) { const y = Math.random() * H; c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y, W, 3 + Math.random() * 10); }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    if (Math.floor(T * 1.5) % 2 === 0) { c.fillStyle = '#e02020'; c.beginPath(); c.arc(60, 50, 11, 0, PI * 2); c.fill(); }
    htext('REC', 110, 51, 24, '#e8e8e8');
    const s = Math.floor(T) % 60;
    htext(`03:${String(13 + Math.floor(T / 60)).padStart(2, '0')}:${String(s).padStart(2, '0')}`, W - 130, 51, 24, '#e8e8e8');
    htext('ЗАПИСЬ №13', W - 130, H - 40, 18, '#aaa');
  }
  function rainDraw(t, x0, y0, w, h) {
    const c = g(); c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    c.strokeStyle = 'rgba(180,200,230,.35)'; c.lineWidth = 2;
    for (let i = 0; i < 60; i++) { const x = x0 + ((i * 53 + t * 300) % (w + 40)) - 20, y = y0 + ((i * 97 + t * 900) % h); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y + 22); c.stroke(); }
    c.restore();
  }
  const between = (t, a, b) => t >= a && t < b;
  const flicker = (t, seed = 1) => (Math.sin(t * 37 * seed) + Math.sin(t * 91 + seed)) > -0.4;

  // ================= СЦЕНЫ =================
  const SCENES = [
    { // 0. Предупреждение и начало записи
      dur: 10,
      cues: [[4.2, () => { S.static(1.2, 0.35); droneStart(); }], [6, () => S.static(0.3, 0.2)]],
      draw(t) {
        fill('#000');
        if (t < 4) {
          const a = Math.min(seg(t, 0.2, 0.8), 1 - seg(t, 3.3, 4));
          g().globalAlpha = a;
          htext('⚠ ВНИМАНИЕ', W / 2, H / 2 - 60, 46, '#e04040', 'Georgia, serif');
          htext('Этот мультик страшный. В нём есть громкие звуки.', W / 2, H / 2 + 10, 28, '#ddd', 'Georgia, serif');
          htext('Если станет слишком страшно — нажми Esc.', W / 2, H / 2 + 60, 24, '#999', 'Georgia, serif');
          g().globalAlpha = 1;
          return;
        }
        const n = Math.floor((t - 4.3) * 14);
        const l1 = 'ОН УЖЕ ЗДЕСЬ', l2 = 'Деревня. 03:13 ночи.';
        htext(l1.slice(0, Math.max(0, n)), W / 2, H / 2 - 30, 72, '#c02020', 'Georgia, serif');
        htext(l2.slice(0, Math.max(0, n - l1.length - 4)), W / 2, H / 2 + 50, 30, '#bbb');
      }
    },
    { // 1. Ночная деревня
      dur: 25,
      cues: [[0.2, () => { windN = loopNoise('bandpass', 380, 0.6, 0.08); }], [7, () => S.whisper()], [15.5, () => S.whisper()], [17, () => S.knock()], [19.2, () => S.sting()]],
      lines: [[16, 18.5, 'whisper', 'Тук... тук...']],
      draw(t) {
        const c = g();
        const z = 1 + ease(seg(t, 0, 25)) * 0.35;
        c.save(); c.translate(860, 380); c.scale(z, z); c.translate(-860, -380);
        const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05060e'); gr.addColorStop(1, '#161a26');
        c.fillStyle = gr; c.fillRect(-200, -200, W + 400, H + 400);
        c.fillStyle = '#c8ccd8'; c.beginPath(); c.arc(260, 130, 46, 0, PI * 2); c.fill();
        c.fillStyle = 'rgba(10,12,20,.85)'; c.beginPath(); c.ellipse(260 + Math.sin(t * 0.2) * 40, 150, 120, 26, 0, 0, PI * 2); c.fill();
        c.fillStyle = '#07080c'; c.fillRect(-200, 560, W + 400, 400);
        // деревья
        for (let i = 0; i < 9; i++) {
          const x = i * 150 - 40 + (i % 2) * 30, h = 260 + (i * 47) % 120;
          c.fillStyle = '#030305'; c.beginPath(); c.moveTo(x, 570 - h); c.lineTo(x - 70, 580); c.lineTo(x + 70, 580); c.fill();
        }
        // дом
        c.fillStyle = '#0a0b10'; c.fillRect(740, 360, 260, 210);
        c.beginPath(); c.moveTo(720, 360); c.lineTo(870, 250); c.lineTo(1020, 360); c.fill();
        const lit = flicker(t, 0.7) ? 1 : 0.35;
        c.fillStyle = `rgba(255,190,90,${0.85 * lit})`; c.fillRect(830, 420, 70, 60);
        c.fillStyle = '#000'; c.fillRect(862, 420, 6, 60); c.fillRect(830, 447, 70, 6);
        const wg = c.createRadialGradient(865, 450, 10, 865, 450, 160); wg.addColorStop(0, `rgba(255,170,70,${0.25 * lit})`); wg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = wg; c.fillRect(700, 300, 330, 300);
        // фигура между деревьями
        if (between(t, 7, 9.4)) tallFigure(220, 575, 300, 1);
        if (between(t, 12.5, 14.6)) tallFigure(520, 578, 330, 1);
        if (between(t, 19.2, 22.5)) tallFigure(1045, 575, 360, 1);
        // туман
        for (let i = 0; i < 5; i++) {
          const fx = ((t * (12 + i * 4) + i * 300) % (W + 600)) - 300;
          const fg = c.createRadialGradient(fx, 560, 10, fx, 560, 260); fg.addColorStop(0, 'rgba(120,130,150,.18)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = fg; c.fillRect(fx - 300, 380, 600, 340);
        }
        c.restore();
      }
    },
    { // 2. Спальня: пальцы на двери, красные глаза
      dur: 30,
      cues: [...Array(30).keys()].map(i => [i + 0.5, () => S.tick()]).concat([
        [8.3, () => droneLevel(0.14)], [18, () => S.creak()], [18.5, () => S.heart(0.4)], [20, () => S.heart(0.45)], [21.3, () => S.heart(0.5)], [22.4, () => S.heart(0.55)],
        [23.4, () => S.heart(0.6)], [24.1, () => S.sting()], [24.3, () => S.heart(0.7)], [25.1, () => S.heart(0.75)], [25.8, () => S.heart(0.8)], [26.4, () => S.heart(0.85)], [29.4, () => S.static(0.4, 0.25)]]),
      lines: [[4, 7, 'misha', 'Мама?.. Это ты?'], [8.5, 12.3, 'thing', 'Да, солнышко. Выключи фонарик.'], [14, 16.3, 'misha', 'Не буду...']],
      draw(t) {
        const c = g();
        fill('#2a2230');
        c.fillStyle = '#342a3c'; for (let x = 0; x < W; x += 70) c.fillRect(x, 0, 30, 560);
        c.fillStyle = '#1c1612'; c.fillRect(0, 560, W, 160);
        // дверь
        const open = ease(seg(t, 18, 23)) * 0.9 + 0.08;
        c.fillStyle = '#000'; c.fillRect(170, 170, 170, 390);
        c.fillStyle = '#4a3424'; c.fillRect(170 + 170 * open, 170, 170 * (1 - open), 390);
        c.strokeStyle = '#2a1a10'; c.lineWidth = 8; c.strokeRect(166, 166, 178, 398);
        // шкаф и часы
        c.fillStyle = '#3a2a1c'; c.fillRect(930, 150, 220, 410); c.fillStyle = '#000'; c.fillRect(1038, 150, 4, 410);
        c.fillStyle = '#d8d0c0'; c.beginPath(); c.arc(640, 120, 38, 0, PI * 2); c.fill();
        c.strokeStyle = '#000'; c.lineWidth = 4; c.beginPath(); c.moveTo(640, 120); c.lineTo(640, 94); c.moveTo(640, 120); c.lineTo(640 + Math.sin(t * 6.28) * 26, 120 - Math.cos(t * 6.28) * 26); c.stroke();
        htext('03:13', 640, 175, 20, '#b8b0a0');
        // кровать и Миша
        c.fillStyle = '#3a2418'; c.fillRect(420, 520, 440, 90);
        c.fillStyle = '#34406a'; c.beginPath(); c.roundRect(470, 470, 380, 90, 30); c.fill();
        L.boy(560, 620, 0.9, { eyes: 'normal', mouth: t > 4 && t < 7 ? 'open' : 'smile', aR: 1.3, aL: 0.2 });
        c.fillStyle = '#34406a'; c.beginPath(); c.roundRect(470, 520, 380, 80, 30); c.fill();
        // пальцы на двери — пока луч в другой стороне
        const beamX = 640 + Math.sin(t * 0.5 + 1.2) * 470 * (t < 17 ? 1 : 0) + (t >= 17 ? -390 : 0);
        const beamOnDoor = beamX < 420;
        if (between(t, 9.5, 17) && !beamOnDoor) claws(170 + 170 * open - 6, 300, seg(t, 9.5, 11), 1);
        if (t > 23.8) glowEyes(255, 250, 9, 'rgba(255,40,20,1)', t > 27 && t < 27.25 ? 0.1 : 1, 1.6);
        const lightOn = t < 29.3 || false;
        const flick = t > 26 && t < 29.3 ? flicker(t, 3) : true;
        const lights = [{ x: 600, y: 480, r: 150, a: 0.55 }];
        if (lightOn && flick) lights.push({ x: beamX, y: 330, r: 190, beam: [640, 470] });
        darkness(0.96, t > 29.3 ? [] : lights);
        if (t > 23.8) glowEyes(255, 250, 9, 'rgba(255,40,20,1)', t > 27 && t < 27.25 ? 0.1 : 1, 1.6);
      }
    },
    { // 3. Под кроватью
      dur: 25,
      cues: [[1.5, () => box(true)], [16.4, () => { box(false); droneLevel(0.03); }], [17.5, () => { S.whoosh(); S.grab(); droneLevel(0.14); }], [19.2, () => S.breath()]],
      lines: [[19.5, 22.8, 'thing', 'Я подожду...']],
      draw(t) {
        const c = g();
        fill('#0c0a10');
        c.fillStyle = '#1e1812'; c.fillRect(0, 470, W, 250);
        c.strokeStyle = '#140f0a'; c.lineWidth = 3; for (let x = 0; x < W; x += 120) { c.beginPath(); c.moveTo(x, 470); c.lineTo(x - 60, 720); c.stroke(); }
        // край кровати
        c.fillStyle = '#2a1c14'; c.fillRect(0, 150, 1280, 60);
        c.fillStyle = '#34406a'; c.fillRect(0, 120, 1280, 40);
        c.fillStyle = '#000'; c.fillRect(0, 210, 1280, 260);
        // глаза под кроватью
        const eyeA = seg(t, 7, 9.5) * (t > 21 ? 1 - seg(t, 21, 23) : 1);
        if (eyeA > 0) { c.globalAlpha = eyeA; glowEyes(930, 330, 12, 'rgba(255,255,255,1)', 0.8 + Math.sin(t * 2) * 0.1, 2.4); c.globalAlpha = 1; }
        // рука Миши
        const up = ease(seg(t, 17.5, 17.8));
        const handY = lerp(420, 60, up) + Math.sin(t * 1.4) * 8;
        c.strokeStyle = '#000'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(360, 140); c.lineTo(360 + Math.sin(t * 1.4) * 12, handY); c.stroke();
        c.strokeStyle = '#e8d4c0'; c.lineWidth = 24; c.stroke();
        c.fillStyle = '#e8d4c0'; c.beginPath(); c.arc(360 + Math.sin(t * 1.4) * 12, handY + 10, 20, 0, PI * 2); c.fill();
        // когтистая рука из-под кровати
        const reach = ease(seg(t, 11, 16.6)), grab = t > 17.5 ? 1 : 0;
        const hx = lerp(880, 420, reach) - grab * 20, hy = 400 - grab * 30;
        if (t > 11 && t < 23) {
          c.strokeStyle = '#0a0808'; c.lineWidth = 34; c.beginPath(); c.moveTo(960, 380); c.quadraticCurveTo((960 + hx) / 2, 470, hx, hy); c.stroke();
          c.strokeStyle = '#6a625a'; c.lineWidth = 22; c.stroke();
          claws(hx, hy - 38, grab ? 0 : 1, -1);
        }
        darkness(0.9, [{ x: 360, y: 300, r: 260, a: 0.6 }, { x: 900, y: 360, r: 160, a: 0.35 }]);
        if (eyeA > 0) { c.globalAlpha = eyeA; glowEyes(930, 330, 12, 'rgba(255,255,255,1)', 0.8 + Math.sin(t * 2) * 0.1, 2.4); c.globalAlpha = 1; }
      }
    },
    { // 4. Окно и молнии
      dur: 25,
      cues: [[0.1, () => { rain = loopNoise('lowpass', 2200, 0.4, 0.12); }], [4, () => {}], [4.6, () => S.thunder()], [9.6, () => S.thunder()], [14.6, () => S.thunder()], [19.5, () => S.scream(1)]],
      lines: [[11.3, 13.8, 'misha', 'Она... ближе.']],
      draw(t) {
        const c = g();
        const flashes = [4, 9, 14, 19.5];
        let fl = 0; flashes.forEach(f => { if (t >= f && t < f + 0.9) fl = Math.max(fl, 1 - (t - f) / 0.9); });
        const scare = t >= 19.5 && t < 21;
        if (scare) { bigFace(t - 19.5, 'pale'); return; }
        fill('#08090e');
        // окно
        const wx = 440, wy = 140, ww = 400, wh = 360;
        const sky = c.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, fl > 0 ? `rgba(200,210,255,${0.3 + fl * 0.7})` : '#0a0c16'); sky.addColorStop(1, fl > 0 ? `rgba(90,100,140,${0.5 + fl * 0.5})` : '#05060a');
        c.fillStyle = sky; c.fillRect(wx, wy, ww, wh);
        if (fl > 0.15) {
          c.fillStyle = '#05060a'; c.fillRect(wx, wy + wh - 60, ww, 60);
          if (t >= 4 && t < 5) paleFigure(wx + 200, wy + wh - 50, 0.25);
          if (t >= 9 && t < 10) paleFigure(wx + 170, wy + wh - 20, 0.6);
          if (t >= 14 && t < 15) paleFigure(wx + 200, wy + wh + 190, 1.2, 1);
        }
        rainDraw(t, wx, wy, ww, wh);
        c.strokeStyle = '#1a1410'; c.lineWidth = 18; c.strokeRect(wx, wy, ww, wh);
        c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2); c.lineWidth = 10; c.stroke();
        c.fillStyle = '#120e0c'; c.fillRect(0, 560, W, 160);
        L.boy(1010, 640, 1.1, { flip: true, eyes: 'normal', mouth: t > 11 ? 'open' : 'smile', aL: 0.2, aR: 0.2 });
        if (fl > 0) { c.fillStyle = `rgba(200,210,255,${fl * 0.35})`; c.fillRect(0, 0, W, H); }
        darkness(fl > 0.1 ? 0.3 : 0.93, [{ x: wx + ww / 2, y: wy + wh / 2, r: 330, a: 0.5 }]);
      }
    },
    { // 5. Коридор: «мама» поворачивает голову
      dur: 25,
      cues: [...[1, 2.2, 3.4, 4.6, 5.8, 7, 8.2, 9.4, 10.6, 11.8, 13].map(x => [x, () => L.noise(0.18, 'bandpass', 300 + Math.random() * 100, 3, 0.25)]),
        [17.2, () => S.crack()], [18.2, () => S.crack()], [19.2, () => S.crack()], [20.2, () => { S.crack(); S.sting(); }], [21.2, () => { S.static(0.5, 0.3); droneLevel(0.02); }], [22, () => S.breath()]],
      lines: [[14.5, 16.8, 'misha', 'Мама?..'], [22.3, 24.5, 'thing', 'Нашёл.']],
      draw(t) {
        const c = g();
        if (t > 21.2) { fill('#000'); if (t > 23.8 && t < 24.2) glowEyes(640, 300, 10, 'rgba(255,40,20,1)', 1, 1.6); return; }
        const cam = lerp(0, 700, ease(seg(t, 0, 14)));
        fill('#1a1418');
        c.save(); c.translate(-cam, 0);
        c.fillStyle = '#2a2026'; for (let x = 0; x < 2200; x += 90) c.fillRect(x, 0, 40, 560);
        c.fillStyle = '#140e0c'; c.fillRect(0, 560, 2200, 160);
        // портреты с глазами
        const mx = lerp(260, 900, ease(seg(t, 0, 14))) + cam;
        [300, 700, 1100].forEach((px, i) => {
          c.fillStyle = '#4a3418'; c.fillRect(px - 70, 150, 140, 180); c.fillStyle = '#2a2420'; c.fillRect(px - 56, 164, 112, 152);
          c.fillStyle = '#8a8070'; c.beginPath(); c.ellipse(px, 230, 34, 44, 0, 0, PI * 2); c.fill();
          [-12, 12].forEach(dx => { c.fillStyle = '#fff'; c.beginPath(); c.arc(px + dx, 222, 7, 0, PI * 2); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(px + dx + clamp((mx - px) / 80, -4, 4), 223, 3.5, 0, PI * 2); c.fill(); });
        });
        // «мама» в конце коридора
        const MX = 1750;
        c.fillStyle = '#5a5058'; c.beginPath(); c.moveTo(MX - 34, 320); c.lineTo(MX + 34, 320); c.lineTo(MX + 60, 560); c.lineTo(MX - 60, 560); c.fill();
        const turn = seg(t, 17, 21);
        const hy = 280;
        if (turn < 0.5) {
          c.fillStyle = '#2a1e18'; c.beginPath(); c.ellipse(MX, hy, 32, 38, 0, 0, PI * 2); c.fill();
          c.beginPath(); c.arc(MX, hy - 30, 16, 0, PI * 2); c.fill();
          if (turn > 0) { c.fillStyle = '#3e3150'; c.beginPath(); c.ellipse(MX + 20 * turn * 2, hy, 20 * turn * 2, 36, 0, 0, PI * 2); c.fill(); }
        } else {
          c.fillStyle = '#3e3150'; c.beginPath(); c.ellipse(MX, hy, 36, 40, 0, 0, PI * 2); c.fill();
          c.fillStyle = '#e8e0d0'; [[-1], [1]].forEach(([k]) => { c.beginPath(); c.moveTo(MX + k * 20, hy - 30); c.quadraticCurveTo(MX + k * 42, hy - 70, MX + k * 34, hy - 78); c.quadraticCurveTo(MX + k * 28, hy - 50, MX + k * 10, hy - 34); c.fill(); });
          glowEyes(MX, hy - 6, 5, 'rgba(255,40,20,1)', 1, 2.2);
          c.fillStyle = '#1a0000'; c.beginPath(); c.ellipse(MX, hy + 18, 22, 10 + turn * 6, 0, 0, PI * 2); c.fill();
          c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(MX - 18 + i * 6, hy + 11); c.lineTo(MX - 15 + i * 6, hy + 19); c.lineTo(MX - 12 + i * 6, hy + 11); c.fill(); }
        }
        L.boy(mx, 640, 1, { eyes: 'normal', mouth: t > 14.5 ? 'open' : 'smile', aR: 1.3 });
        c.restore();
        const bx = mx - cam;
        darkness(0.95, [{ x: bx + 330, y: 420, r: 230, beam: [bx + 40, 500] }, { x: bx, y: 520, r: 120, a: 0.5 }]);
        if (turn >= 0.5) { c.save(); c.translate(-cam, 0); glowEyes(MX, hy - 6, 5, 'rgba(255,40,20,1)', 1, 2.2); c.restore(); }
      }
    },
    { // 6. Стробоскоп и главный скример
      dur: 21,
      cues: [[0.3, () => droneLevel(0.16)], ...[2, 5, 8, 11].map((x, i) => [x, () => { S.static(0.25, 0.3); S.heart(0.5 + i * 0.12); }]),
        ...[...Array(10).keys()].map(i => [2.5 + i * 0.9, () => S.heart(0.5 + i * 0.05)]),
        [12.6, () => droneLevel(0.0001)], [13.4, () => S.breath()], [16.5, () => L.noise(0.05, 'highpass', 3000, 1, 0.2)], [18.2, () => S.scream(1.2)]],
      lines: [[16.8, 18.1, 'misha', 'Никого...']],
      draw(t) {
        const c = g();
        if (t >= 18.2 && t < 20) { bigFace(t - 18.2, 'eater'); return; }
        fill('#000');
        const shots = [[2, 'mask', 0.5], [5, 'crooked', 0.75], [8, 'pale', 1.0], [11, 'eater', 1.35]];
        let shown = null;
        shots.forEach(([at, kind, s]) => { if (t >= at && t < at + 0.55) shown = [kind, s]; });
        const room = () => { fill('#1e1820'); c.fillStyle = '#120e0c'; c.fillRect(0, 560, W, 160); };
        if (shown) {
          room();
          const [kind, s] = shown;
          if (kind === 'mask') L.faceless(640, 600, s * 1.4, { aL: 0.2, aR: 0.2 });
          if (kind === 'crooked') { tallFigure(640, 620, 560 * s, 1); }
          if (kind === 'pale') paleFigure(640, 620 + (s - 1) * 300, s * 1.6, 0.6);
          if (kind === 'eater') {
            // тёмный рогатый силуэт вплотную
            c.fillStyle = '#050304';
            c.beginPath(); c.ellipse(640, 900, 520, 420, 0, 0, PI * 2); c.fill();
            c.beginPath(); c.ellipse(640, 330, 200, 190, 0, 0, PI * 2); c.fill();
            [-1, 1].forEach(k => { c.beginPath(); c.moveTo(640 + k * 110, 200); c.quadraticCurveTo(640 + k * 260, 40, 640 + k * 230, -20); c.quadraticCurveTo(640 + k * 190, 90, 640 + k * 60, 170); c.fill(); });
            c.fillStyle = '#1a0000'; c.beginPath(); c.ellipse(640, 440, 120, 55, 0, 0, PI * 2); c.fill();
            c.fillStyle = '#b8b0a0';
            for (let i = 0; i < 10; i++) { const x = 545 + i * 19; c.beginPath(); c.moveTo(x, 400); c.lineTo(x + 16, 400); c.lineTo(x + 8, 440); c.fill(); c.beginPath(); c.moveTo(x, 482); c.lineTo(x + 16, 482); c.lineTo(x + 8, 448); c.fill(); }
          }
          darkness(0.55, [{ x: 640, y: 360, r: 420, a: 0.9 }]);
          if (kind === 'eater') glowEyes(640, 300, 16, 'rgba(255,30,10,1)', 1, 3.4);
        } else if (t > 16.5 && t < 18.2) {
          room();
          darkness(0.8, [{ x: 640, y: 380, r: 300, beam: [640, 700] }]);
        }
      }
    },
    { // 7. Запись прервана
      dur: 14,
      cues: [[0.1, () => { stopAll(); S.static(1.5, 0.4); }], [10, () => S.knock()]],
      draw(t) {
        fill('#000');
        if (t < 2.2) { for (let i = 0; i < 1500; i++) { const v = Math.random() * 255 | 0; g().fillStyle = `rgb(${v},${v},${v})`; g().fillRect(Math.random() * W, Math.random() * H, 3, 3); } }
        const j = t < 3 ? (Math.random() - 0.5) * 8 : 0;
        if (t > 1.5) htext('ЗАПИСЬ ПРЕРВАНА', W / 2 + j, H / 2 - 80, 56, '#c02020');
        if (t > 4) { g().globalAlpha = seg(t, 4, 5); htext('Он всё ещё ищет.', W / 2, H / 2, 32, '#ccc', 'Georgia, serif'); g().globalAlpha = 1; }
        if (t > 6.5) { g().globalAlpha = seg(t, 6.5, 7.5); htext('Сегодня ночью проверь, закрыта ли твоя дверь.', W / 2, H / 2 + 50, 28, '#999', 'Georgia, serif'); g().globalAlpha = 1; }
      }
    }
  ];

  Cartoon.register('horror', {
    title: 'Он уже здесь',
    scenes: SCENES,
    start() { boxTimer = setInterval(boxSched, 80); },
    stop() { clearInterval(boxTimer); stopAll(); },
    line(who, str, x, y, k, dur) { hcaption(str, k, dur); },
    post(T, t, si) { if (si > 0 && si < 7) vhs(T, (si === 4 && t >= 19.5 && t < 21) || (si === 6 && t >= 18.2 && t < 20)); }
  });

  // ================= МУЗЫКАЛЬНЫЙ УЖАСТИК «ДВЕРЬ» =================
  let dm = null;
  const CH = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 58]];
  const ARP = [0, 1, 2, 1, 3, 2, 1, 2];
  const MELO = { 0: { 0: 81, 6: 79 }, 1: { 4: 77 }, 2: { 0: 74, 6: 76 }, 3: { 0: 73, 4: 70 } };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function dmNote(t, f, d, type, v, dest, fe) {
    const ac = L.ac;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (fe) o.frequency.exponentialRampToValueAtTime(fe, t + d);
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(dest || L.out); o.start(t); o.stop(t + d + 0.05);
  }
  function choir(t, freqs, d, v) {
    const ac = L.ac;
    freqs.forEach(f => [1, 1.005].forEach(k => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * k;
      const vib = ac.createOscillator(); vib.frequency.value = 5.2; const vg = ac.createGain(); vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(o.frequency);
      const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + d * 0.4); gn.gain.linearRampToValueAtTime(0.0001, t + d);
      o.connect(gn); gn.connect(dm.echo); o.start(t); vib.start(t); o.stop(t + d + 0.1); vib.stop(t + d + 0.1);
    }));
  }
  function strings(t, freqs, d, v) {
    const ac = L.ac;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    const trem = ac.createGain(); trem.gain.value = 0.5;
    const lfo = ac.createOscillator(); lfo.frequency.value = 11; const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(trem.gain);
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.6); gn.gain.linearRampToValueAtTime(0.0001, t + d);
    lp.connect(trem); trem.connect(gn); gn.connect(L.out);
    freqs.forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + d + 0.1); });
    lfo.start(t); lfo.stop(t + d + 0.1);
  }
  function taiko(t, v) { dmNote(t, 72, 1.3, 'sine', v, null, 34); L.noiseAt(t, 0.3, 'lowpass', 220, 1, v * 0.6); }
  function dmStart() {
    const ac = L.ac; if (!ac || dm) return;
    const echo = ac.createGain(); const dl = ac.createDelay(1); dl.delayTime.value = 0.47;
    const fb = ac.createGain(); fb.gain.value = 0.38;
    echo.connect(L.out); echo.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(L.out);
    dm = { echo, next: ac.currentTime + 0.2, step: 0, level: 1, timer: setInterval(dmSched, 60) };
  }
  function dmStop() { if (dm) { clearInterval(dm.timer); dm = null; } }
  function dmLevel(v) { if (dm) dm.level = v; }
  function dmSched() {
    const ac = L.ac; if (!ac || !dm) return;
    const sp = 60 / 72 / 2;
    while (dm.next < ac.currentTime + 0.3) {
      const t = dm.next, s = dm.step % 8, bar = Math.floor(dm.step / 8) % 4, lv = dm.level, ch = CH[bar];
      if (lv > 0) {
        const m = ch[ARP[s]] + 12;
        dmNote(t, mtof(m), 1.9, 'triangle', 0.05); dmNote(t, mtof(m) * 2.003, 1.2, 'sine', 0.018);
        if (s === 0) { dmNote(t, mtof(ch[0] - 12), 3.4, 'sine', 0.15); dmNote(t, mtof(ch[0] - 24), 3.4, 'triangle', 0.08); }
      }
      if (lv >= 2 && MELO[bar] && MELO[bar][s]) dmNote(t, mtof(MELO[bar][s]), 2.4, 'sine', 0.07, dm.echo);
      if (lv >= 2 && s === 0) choir(t, [mtof(ch[1] + 12), mtof(ch[2] + 12), mtof(ch[3] + 12)], sp * 8, 0.016 * (lv - 1));
      if (lv >= 2 && s === 0 && (lv >= 3 || bar % 2 === 0)) taiko(t, 0.3 + lv * 0.08);
      if (lv >= 3 && s === 0) strings(t, [mtof(ch[0] + 12), mtof(ch[2] + 12), mtof(ch[3] + 24)], sp * 8, 0.028 * (lv - 2));
      if (lv >= 3 && s % (lv >= 4 ? 2 : 4) === 0) { dmNote(t, 58, 0.16, 'sine', 0.32, null, 40); dmNote(t + 0.2, 52, 0.16, 'sine', 0.26, null, 38); }
      if (lv >= 4 && s === 4 && bar % 2 === 1) [0, 1, 6, 7].forEach(k => dmNote(t, mtof(62 + k), 1.3, 'sawtooth', 0.02));
      dm.next += sp; dm.step++;
    }
  }

  // Чудовище-силуэт. Возвращает положение глаз на экране.
  function beast(x, y, s, pose, t) {
    const c = g(); c.save(); c.translate(x, y); c.scale(s, pose === 'ceiling' ? -s : s);
    const col = '#060406', rim = '#3a2a30';
    c.fillStyle = col; c.strokeStyle = rim; c.lineWidth = 3; c.lineCap = 'round';
    const ph = t * (pose === 'crawl' ? 9 : 3.2);
    const limb = (x1, y1, x2, y2, w) => { c.lineWidth = w + 5; c.strokeStyle = rim; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    const clawAt = (hx, hy) => { c.strokeStyle = '#8a8078'; c.lineWidth = 3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 22 + i * 3, hy + 12 + i * 8); c.stroke(); } };
    let eye;
    if (pose === 'crawl') {
      limb(-80, -60, -95 + Math.sin(ph) * 35, 0, 16); limb(-60, -60, -45 - Math.sin(ph) * 35, 0, 16);
      limb(70, -70, 90 + Math.sin(ph + 1.5) * 40, 0, 14); limb(90, -70, 115 - Math.sin(ph + 1.5) * 40, 0, 14);
      clawAt(90 + Math.sin(ph + 1.5) * 40, 0); clawAt(115 - Math.sin(ph + 1.5) * 40, 0);
      c.fillStyle = col; c.strokeStyle = rim; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, -80, 125, 45, -0.05, 0, PI * 2); c.fill(); c.stroke();
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-70 + i * 30, -118); c.lineTo(-60 + i * 30, -145); c.lineTo(-50 + i * 30, -118); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(150, -95, 44, 0, PI * 2); c.fill(); c.stroke();
      [[-1], [1]].forEach(([k]) => { c.beginPath(); c.moveTo(150 + k * 18, -130); c.quadraticCurveTo(150 + k * 50, -190, 150 + k * 30, -210); c.quadraticCurveTo(150 + k * 30, -165, 150 + k * 4, -135); c.fill(); c.stroke(); });
      eye = [170, -100];
    } else {
      limb(-15, -150, -15 + Math.sin(ph) * 30, 0, 20); limb(25, -150, 25 - Math.sin(ph) * 30, 0, 20);
      c.fillStyle = col; c.strokeStyle = rim; c.lineWidth = 3;
      c.beginPath(); c.ellipse(20, -235, 70, 105, 0.5, 0, PI * 2); c.fill(); c.stroke();
      const hx = 120 + Math.sin(ph + 1) * 30, hy = -15;
      limb(70, -290, hx, hy, 16); clawAt(hx, hy);
      limb(40, -280, 60 - Math.sin(ph + 1) * 25, -20, 14);
      c.fillStyle = col; c.strokeStyle = rim; c.lineWidth = 3;
      c.beginPath(); c.arc(115, -300, 50, 0, PI * 2); c.fill(); c.stroke();
      [[-1], [1]].forEach(([k]) => { c.beginPath(); c.moveTo(115 + k * 20, -338); c.quadraticCurveTo(115 + k * 60, -410, 115 + k * 38, -430); c.quadraticCurveTo(115 + k * 34, -380, 115 + k * 5, -345); c.fill(); c.stroke(); });
      c.fillStyle = '#1a0000'; c.beginPath(); c.ellipse(135, -275, 22, 9, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#c8c0b0'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(117 + i * 8, -282); c.lineTo(121 + i * 8, -272); c.lineTo(125 + i * 8, -282); c.fill(); }
      eye = [132, -308];
    }
    const p = c.getTransform().transformPoint(new DOMPoint(eye[0], eye[1]));
    c.restore();
    return [p.x, p.y];
  }
  function corridor(t, bulb) {
    const c = g();
    fill('#150f15');
    c.fillStyle = '#1d141d'; for (let x = 0; x < W; x += 64) c.fillRect(x, 60, 28, 500);
    c.fillStyle = '#0a0708'; c.fillRect(0, 0, W, 60);
    c.fillStyle = '#0d0908'; c.fillRect(0, 560, W, 160);
    c.strokeStyle = '#080605'; c.lineWidth = 3; for (let x = -200; x < W; x += 110) { c.beginPath(); c.moveTo(x, 560); c.lineTo(x - 120, 720); c.stroke(); }
    // дверь
    c.fillStyle = '#2e1e14'; c.fillRect(1110, 240, 140, 320);
    c.strokeStyle = '#1a100a'; c.lineWidth = 6; c.strokeRect(1110, 240, 140, 320); c.strokeRect(1128, 262, 104, 120); c.strokeRect(1128, 400, 104, 140);
    c.fillStyle = `rgba(255,190,110,${0.9 * bulb.door})`; c.fillRect(1110, 554, 140, 7);
    // лампочка
    const sw = Math.sin(t * 1.3) * 0.15;
    const bx = 640 + Math.sin(sw) * 70, by = 60 + Math.cos(sw) * 70;
    c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(640, 0); c.lineTo(bx, by); c.stroke();
    c.fillStyle = `rgba(255,230,170,${bulb.on})`; c.beginPath(); c.arc(bx, by + 8, 11, 0, PI * 2); c.fill();
    return [bx, by + 8];
  }
  function clawMarks(n) {
    const c = g(); c.strokeStyle = 'rgba(200,180,150,.55)'; c.lineWidth = 3;
    for (let i = 0; i < n; i++) { const x = 1125 + (i * 29) % 100, y = 300 + (i * 47) % 220; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 9, y); c.lineTo(x + k * 9 + 14, y + 55); c.stroke(); } }
  }
  const lightsFor = (bp, bulb) => [{ x: bp[0], y: bp[1] + 40, r: 430 * bulb.on + 1, a: 0.85 * bulb.on }, { x: 1180, y: 560, r: 150, a: 0.9 * bulb.door }];
  function bulbState(t, flickFrom, blackAt) {
    if (t >= blackAt) return { on: 0, door: 0 };
    if (t >= flickFrom) { const f = flicker(t, 2.3) ? 1 : 0.08; return { on: f, door: f }; }
    return { on: 1, door: 1 };
  }
  const blackoutCues = at => [[at - 3, () => S.static(0.2, 0.15)], [at, () => { S.sting(); taiko(L.ac.currentTime, 0.9); }]];

  const DOOR = [
    { // 0. Название
      dur: 10,
      cues: [[0.8, () => { dmStart(); dmLevel(1); droneStart(); droneLevel(0.05); }]],
      draw(t) {
        fill('#000');
        const a = Math.min(seg(t, 1.5, 3.5), 1 - seg(t, 8.5, 10));
        g().globalAlpha = a;
        htext('ДВЕРЬ', W / 2, H / 2 - 20, 110, '#b01818', 'Georgia, serif');
        htext('музыкальный ужастик', W / 2, H / 2 + 70, 26, '#888', 'Georgia, serif');
        g().globalAlpha = 1;
      }
    },
    { // 1. Первая попытка: идёт по коридору
      dur: 35,
      cues: blackoutCues(33),
      draw(t) {
        const b = bulbState(t, 29.5, 33);
        const bp = corridor(t, b);
        const x = lerp(-180, 900, seg(t, 0, 31)) + Math.sin(t * 1.6) * 12;
        const eye = beast(x, 560, 1, 'walk', t);
        darkness(0.94, lightsFor(bp, b));
        if (t < 33) glowEyes(eye[0], eye[1], 5, 'rgba(255,30,10,1)', 1, 2.2);
      }
    },
    { // 2. Вторая попытка: по потолку
      dur: 35,
      cues: [[0.2, () => { dmLevel(2); droneLevel(0.08); }], ...blackoutCues(33)],
      draw(t) {
        const b = bulbState(t, 29.5, 33);
        const bp = corridor(t, b);
        const x = lerp(-220, 930, ease(seg(t, 0, 30)));
        const eye = beast(x, 62, 0.95, 'ceiling', t);
        darkness(0.94, lightsFor(bp, b));
        if (t < 33) glowEyes(eye[0], eye[1], 5, 'rgba(255,30,10,1)', 1, 2.2);
      }
    },
    { // 3. Третья попытка: добирается до двери и скребёт
      dur: 35,
      cues: [[0.2, () => { dmLevel(3); droneLevel(0.11); }], ...[...Array(14).keys()].map(i => [16.5 + i * 0.9, () => L.noise(0.35, 'bandpass', 1400, 4, 0.18)]), ...blackoutCues(33)],
      draw(t) {
        const b = bulbState(t, 30, 33);
        const bp = corridor(t, b);
        const reach = seg(t, 0, 15);
        const x = lerp(-300, 900, ease(reach));
        const scratching = t > 15.5;
        clawMarks(Math.floor(seg(t, 16, 31) * 14));
        // ноги за дверью в полоске света
        if (t > 20 && b.door > 0.5) { const c = g(); c.fillStyle = '#000'; c.fillRect(1150 + Math.sin(t * 2) * 2, 552, 18, 9); c.fillRect(1192, 552, 18, 9); }
        const eye = scratching ? beast(960 + Math.sin(t * 14) * 5, 560, 1, 'walk', t * 3) : beast(x, 560, 0.9, 'crawl', t);
        darkness(0.94, lightsFor(bp, b));
        if (t < 33) glowEyes(eye[0], eye[1], 5, 'rgba(255,30,10,1)', 1, 2.2);
        if (scratching && t < 33) { const c = g(); c.fillStyle = `rgba(255,190,110,${0.5 * b.door})`; c.beginPath(); c.arc(1135 + Math.sin(t * 30) * 3, 420, 7, 0, PI * 2); c.fill(); }
      }
    },
    { // 4. Внутри комнаты: дверь открывается
      dur: 30,
      cues: [[0.2, () => { dmLevel(4); droneLevel(0.15); }], [4, () => S.creak()], [12, () => S.creak()], [15, () => S.breath()], [24, () => { S.scream(0.9); taiko(L.ac.currentTime, 1); dmLevel(0); droneLevel(0.0001); }]],
      draw(t) {
        const c = g();
        if (t >= 24) { fill('#000'); return; }
        fill('#281e22');
        c.fillStyle = '#30242a'; for (let x = 0; x < W; x += 70) c.fillRect(x, 0, 32, 560);
        c.fillStyle = '#16100e'; c.fillRect(0, 560, W, 160);
        c.fillStyle = '#3a2618'; c.fillRect(120, 440, 160, 120);
        c.fillStyle = '#e8c890'; c.beginPath(); c.moveTo(165, 380); c.lineTo(235, 380); c.lineTo(250, 440); c.lineTo(150, 440); c.fill();
        const zoom = 1 + ease(seg(t, 20, 24)) * 2.2;
        c.save(); c.translate(640, 330); c.scale(zoom, zoom); c.translate(-640, -330);
        const open = ease(seg(t, 4, 20)) * 0.42;
        c.fillStyle = '#000'; c.fillRect(550, 140, 180, 420);
        c.fillStyle = '#4a3020'; c.fillRect(550 + 180 * open, 140, 180 * (1 - open), 420);
        c.strokeStyle = '#1a100a'; c.lineWidth = 8; c.strokeRect(546, 136, 188, 428);
        c.fillStyle = '#c0a060'; c.beginPath(); c.arc(550 + 180 * open + 20, 360, 8, 0, PI * 2); c.fill();
        if (t > 12) claws(550 + 180 * open - 4, 250, seg(t, 12, 14), 1);
        c.restore();
        darkness(0.9, [{ x: 200, y: 420, r: 420, a: 0.95 }, { x: 640, y: 350, r: 380, a: 0.6 }]);
        if (t > 15) {
          c.save(); c.translate(640, 330); c.scale(zoom, zoom); c.translate(-640, -330);
          glowEyes(550 + 180 * open * 0.5, 270, 7, 'rgba(255,30,10,1)', t > 18 && t < 18.2 ? 0.1 : 1, 1.5);
          c.restore();
        }
      }
    },
    { // 5. «Я буду у тебя»
      dur: 18,
      cues: [[0.1, () => { dmStop(); stopAll(); }], [4, () => L.speak('thing', 'Я буду у тебя.')], [13, () => S.knock()]],
      draw(t) {
        fill('#000');
        if (t > 3.6) {
          const a = seg(t, 3.6, 5.5);
          const c = g(); c.save(); c.globalAlpha = a;
          const j = t < 7 ? (Math.random() - 0.5) * 3 : 0;
          c.shadowColor = '#f00'; c.shadowBlur = 30;
          htext('Я БУДУ У ТЕБЯ.', W / 2 + j, H / 2, 84, '#c01010', 'Georgia, serif');
          c.restore();
        }
        if (t > 9.5) { g().globalAlpha = seg(t, 9.5, 11); htext('...скоро.', W / 2, H / 2 + 90, 30, '#666', 'Georgia, serif'); g().globalAlpha = 1; }
      }
    }
  ];

  Cartoon.register('door', {
    title: 'Дверь',
    scenes: DOOR,
    start() {},
    stop() { dmStop(); stopAll(); },
    line() {},
    post(T, t, si) { if (si > 0 && si < 5) vhs(T, false); }
  });
})();

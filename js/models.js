'use strict';
// Утилиты и 3D-модели, собранные из простых фигур.
const Util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  canvasTex(size, draw, rx = 1, ry = rx) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return t;
  },
  noise(g, size, rgb, vari) {
    const img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = (Math.random() - 0.5) * vari;
      img.data[i * 4] = rgb[0] + n; img.data[i * 4 + 1] = rgb[1] + n; img.data[i * 4 + 2] = rgb[2] + n;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  },
  blotches(g, size, count, color, rmin, rmax) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      g.beginPath();
      g.arc(Math.random() * size, Math.random() * size, rmin + Math.random() * (rmax - rmin), 0, Math.PI * 2);
      g.fill();
    }
  },
  // Белая маска с улыбкой (для Безликого и скримера)
  drawMask(g, cx, cy, s) {
    g.fillStyle = '#e8e4da';
    g.beginPath(); g.ellipse(cx, cy, s * 0.8, s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000';
    [-1, 1].forEach(k => {
      g.beginPath(); g.ellipse(cx + k * s * 0.32, cy - s * 0.2, s * 0.17, s * 0.09, k * 0.35, 0, Math.PI * 2); g.fill();
    });
    g.beginPath(); g.moveTo(cx - s * 0.55, cy + s * 0.25);
    g.quadraticCurveTo(cx, cy + s * 0.95, cx + s * 0.55, cy + s * 0.25);
    g.quadraticCurveTo(cx, cy + s * 0.6, cx - s * 0.55, cy + s * 0.25); g.fill();
    g.strokeStyle = '#e8e4da'; g.lineWidth = Math.max(1, s * 0.03);
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(cx + i * s * 0.11, cy + s * 0.35); g.lineTo(cx + i * s * 0.11, cy + s * 0.62 - Math.abs(i) * s * 0.03); g.stroke(); }
  },
  _glow: null,
  glowSprite(color, size, opacity = 1) {
    if (!Util._glow) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      Util._glow = new THREE.CanvasTexture(c);
    }
    const m = new THREE.SpriteMaterial({ map: Util._glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1);
    return s;
  },
  textSprite(text, color, size) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 52px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(text, 32, 34);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
    s.scale.set(size, size, 1);
    return s;
  }
};

const Models = (() => {
  const P = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 4 }, o || {}));
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const Cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (parent) parent.add(m);
    return m;
  }
  function limb(len, r, mat) {
    const g = new THREE.Group();
    mesh(Cyl(r, r * 0.8, len, 7), mat, 0, -len / 2, 0, g);
    return g;
  }

  // ---------- текстуры ----------
  const TEX = {
    wood: Util.canvasTex(64, (g, s) => {
      Util.noise(g, s, [46, 36, 27], 18);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2;
      for (let x = 0; x < s; x += 11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
    }, 2, 1),
    stone: Util.canvasTex(64, (g, s) => {
      Util.noise(g, s, [70, 70, 72], 30);
      Util.blotches(g, s, 30, 'rgba(20,25,20,.25)', 2, 7);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      for (let y = 0; y < s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
    }, 2, 2),
    rock: Util.canvasTex(128, (g, s) => {
      Util.noise(g, s, [48, 43, 38], 34);
      Util.blotches(g, s, 60, 'rgba(0,0,0,.25)', 3, 12);
      Util.blotches(g, s, 30, 'rgba(90,80,70,.2)', 2, 8);
    }, 2, 1),
    bark: Util.canvasTex(32, (g, s) => {
      Util.noise(g, s, [40, 32, 26], 26);
      g.strokeStyle = 'rgba(0,0,0,.5)';
      for (let x = 0; x < s; x += 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 2, s); g.stroke(); }
    }, 1, 3),
    dirt: Util.canvasTex(128, (g, s) => {
      Util.noise(g, s, [48, 40, 30], 26);
      Util.blotches(g, s, 50, 'rgba(20,16,10,.3)', 2, 9);
    }, 10, 10)
  };

  // ---------- люди ----------
  function humanoid(o) {
    const g = new THREE.Group();
    const legL = limb(0.9, 0.09, o.legs); legL.position.set(-0.13, 0.9, 0); g.add(legL);
    const legR = limb(0.9, 0.09, o.legs); legR.position.set(0.13, 0.9, 0); g.add(legR);
    const torso = mesh(B(0.5, 0.72, 0.28), o.body, 0, 1.25, 0, g);
    const armL = limb(0.7, 0.065, o.body); armL.position.set(-0.33, 1.57, 0); g.add(armL);
    const armR = limb(0.7, 0.065, o.body); armR.position.set(0.33, 1.57, 0); g.add(armR);
    mesh(new THREE.SphereGeometry(0.065, 6, 5), o.skin, 0, -0.72, 0, armL);
    mesh(new THREE.SphereGeometry(0.065, 6, 5), o.skin, 0, -0.72, 0, armR);
    const head = new THREE.Group(); head.position.y = 1.82; g.add(head);
    mesh(new THREE.SphereGeometry(o.headR || 0.17, 14, 12), o.skin, 0, 0, 0, head);
    const hand = new THREE.Group(); hand.position.y = -0.72; armR.add(hand);
    g.userData = { legL, legR, armL, armR, head, hand, torso };
    return g;
  }

  function walkAnim(g, phase, amount, armAmount = 0.5) {
    const u = g.userData, s = Math.sin(phase);
    u.legL.rotation.x = s * 0.7 * amount;
    u.legR.rotation.x = -s * 0.7 * amount;
    u.armL.rotation.x = -s * armAmount * amount;
    u.armR.rotation.x = s * armAmount * amount;
  }

  function axe() {
    const g = new THREE.Group();
    mesh(Cyl(0.025, 0.03, 0.7, 6), P(0x6a4a2a), 0, -0.25, 0, g);
    mesh(B(0.04, 0.16, 0.2), P(0x6d6d70, { shininess: 20 }), 0, -0.52, 0.1, g);
    mesh(B(0.06, 0.08, 0.06), P(0x3a2a1a), 0, -0.52, 0, g);
    return g;
  }
  function pickaxe() {
    const g = new THREE.Group();
    const wood = P(0x8a6a42);
    mesh(Cyl(0.025, 0.03, 0.75, 6), wood, 0, -0.27, 0, g);
    const head = mesh(B(0.05, 0.06, 0.6), wood, 0, -0.6, 0, g);
    const tipA = mesh(new THREE.ConeGeometry(0.035, 0.14, 5), wood, 0, 0, 0.36, head); tipA.rotation.x = Math.PI / 2;
    const tipB = mesh(new THREE.ConeGeometry(0.035, 0.14, 5), wood, 0, 0, -0.36, head); tipB.rotation.x = -Math.PI / 2;
    return g;
  }
  function shovel() {
    const g = new THREE.Group();
    const wood = P(0x7a5a38);
    mesh(Cyl(0.025, 0.03, 0.85, 6), wood, 0, -0.3, 0, g);
    mesh(B(0.22, 0.3, 0.025), P(0x8a6a44), 0, -0.85, 0.02, g);
    return g;
  }

  // ---------- скины игрока ----------
  // Общие детали: фонарик на груди и инструменты в руке
  function equip(g) {
    mesh(B(0.08, 0.08, 0.12), P(0x222222), 0.14, 1.42, 0.17, g);
    const lens = mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0.14, 1.42, 0.231, g);
    g.userData.lens = lens;
    const tools = { axe: axe(), pickaxe: pickaxe(), shovel: shovel() };
    for (const k in tools) { tools[k].visible = false; g.userData.hand.add(tools[k]); }
    g.userData.tools = tools;
    return g;
  }
  function hood(g, mat) {
    const h = mesh(new THREE.SphereGeometry(0.205, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat, 0, 0.03, -0.03, g.userData.head);
    h.rotation.x = -0.25;
    return h;
  }
  function eyes(head, mat, r = 0.03, y = 0.03, z = 0.15, dx = 0.065) {
    mesh(new THREE.SphereGeometry(r, 8, 6), mat, -dx, y, z, head);
    mesh(new THREE.SphereGeometry(r, 8, 6), mat, dx, y, z, head);
  }
  const basic = c => new THREE.MeshBasicMaterial({ color: c });

  function skin(id) {
    let g, h;
    const skinM = P(0xc9a98a);
    switch (id) {
      case 'forester': {
        const jacket = P(0x3a4a2a), red = P(0x6a1a1a);
        g = humanoid({ body: jacket, skin: skinM, legs: P(0x3a2c1e) }); h = g.userData.head;
        mesh(Cyl(0.18, 0.18, 0.12, 12), red, 0, 0.1, 0, h);
        mesh(B(0.22, 0.03, 0.14), red, 0, 0.07, 0.17, h);
        mesh(B(0.22, 0.15, 0.08), P(0x4a3020), 0, -0.1, 0.12, h);
        mesh(B(0.52, 0.08, 0.3), P(0x1a120a), 0, 0.95, 0, g);
        for (let i = 0; i < 3; i++) mesh(B(0.52, 0.03, 0.29), P(0x2a3a1e), 0, 1.05 + i * 0.2, 0.001, g);
        break;
      }
      case 'girl': {
        const coat = P(0xc9a020, { shininess: 40 });
        g = humanoid({ body: coat, skin: skinM, legs: P(0x1a1a1a) }); h = g.userData.head;
        hood(g, coat);
        mesh(Cyl(0.27, 0.36, 0.5, 10), coat, 0, 0.83, 0, g);
        mesh(B(0.07, 0.3, 0.1), P(0x2a1a10), -0.15, -0.1, 0.06, h);
        mesh(B(0.07, 0.3, 0.1), P(0x2a1a10), 0.15, -0.1, 0.06, h);
        eyes(h, basic(0x111111), 0.02, 0.02, 0.16, 0.06);
        break;
      }
      case 'hunter': {
        const suit = P(0x8a7a5a);
        g = humanoid({ body: suit, skin: skinM, legs: suit }); h = g.userData.head;
        mesh(B(0.42, 0.56, 0.22), P(0x4a4a4e), 0, 1.3, -0.25, g);
        const c = mesh(Cyl(0.06, 0.06, 0.5, 8), P(0x8a8a90), 0.14, 1.3, -0.38, g);
        mesh(new THREE.SphereGeometry(0.05, 6, 5), basic(0x40ff80), -0.12, 1.45, -0.37, g);
        [-0.065, 0.065].forEach(x => { const gg = mesh(Cyl(0.045, 0.045, 0.05, 10), P(0x111111), x, 0.1, 0.14, h); gg.rotation.x = Math.PI / 2; });
        mesh(B(0.36, 0.03, 0.3), P(0x222222), 0, 0.1, 0, h);
        mesh(B(0.14, 0.1, 0.02), P(0xa02020), 0.12, 1.45, 0.145, g);
        break;
      }
      case 'miner': {
        const suit = P(0x2a3a5a);
        g = humanoid({ body: suit, skin: skinM, legs: suit }); h = g.userData.head;
        mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), P(0xd0a020, { shininess: 50 }), 0, 0.03, 0, h);
        mesh(Cyl(0.24, 0.24, 0.02, 14), P(0xd0a020), 0, 0.03, 0, h);
        const lamp = mesh(Cyl(0.05, 0.05, 0.06, 10), P(0x333333), 0, 0.12, 0.19, h); lamp.rotation.x = Math.PI / 2;
        mesh(new THREE.CircleGeometry(0.04, 10), basic(0xfff0a0), 0, 0.12, 0.225, h);
        const gl = Util.glowSprite(0xfff0a0, 0.6, 0.8); gl.position.set(0, 0.12, 0.25); h.add(gl);
        mesh(B(0.52, 0.07, 0.3), P(0xd06010), 0, 1.35, 0, g);
        mesh(B(0.52, 0.07, 0.3), P(0xd06010), 0, 1.15, 0, g);
        mesh(B(0.22, 0.12, 0.06), P(0x2a1a10), 0, -0.12, 0.13, h);
        break;
      }
      case 'priest': {
        const black = P(0x0e0e10);
        g = humanoid({ body: black, skin: skinM, legs: black }); h = g.userData.head;
        mesh(Cyl(0.26, 0.42, 0.95, 12), black, 0, 0.5, 0, g);
        mesh(B(0.14, 0.05, 0.02), basic(0xf0f0f0), 0, 1.58, 0.145, g);
        const gold = P(0xc0a040, { shininess: 60 });
        mesh(B(0.04, 0.18, 0.02), gold, 0, 1.3, 0.15, g);
        mesh(B(0.12, 0.04, 0.02), gold, 0, 1.34, 0.15, g);
        mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), P(0x3a3a3a), 0, 0.02, -0.02, h);
        break;
      }
      case 'plague': {
        const black = P(0x111012);
        g = humanoid({ body: black, skin: P(0x1a1818), legs: black }); h = g.userData.head;
        mesh(Cyl(0.27, 0.45, 1.0, 12), black, 0, 0.55, 0, g);
        mesh(Cyl(0.34, 0.34, 0.03, 16), black, 0, 0.13, 0, h);
        mesh(Cyl(0.15, 0.17, 0.26, 12), black, 0, 0.27, 0, h);
        const beak = mesh(new THREE.ConeGeometry(0.075, 0.4, 8), P(0xd8ccb0), 0, -0.05, 0.3, h); beak.rotation.x = Math.PI / 2;
        eyes(h, P(0x802020, { shininess: 90, emissive: 0x300808 }), 0.045, 0.03, 0.14, 0.07);
        break;
      }
      case 'skeleton': {
        const bone = P(0xd8d0c0), black = P(0x111111);
        g = humanoid({ body: black, skin: bone, legs: bone }); h = g.userData.head;
        for (let i = 0; i < 4; i++) mesh(B(0.44 - i * 0.04, 0.05, 0.02), bone, 0, 1.45 - i * 0.12, 0.145, g);
        mesh(B(0.04, 0.6, 0.02), bone, 0, 1.25, 0.146, g);
        eyes(h, basic(0x000000), 0.05, 0.03, 0.13, 0.07);
        mesh(B(0.05, 0.04, 0.03), basic(0x000000), 0, -0.04, 0.16, h);
        mesh(B(0.2, 0.05, 0.1), bone, 0, -0.16, 0.08, h);
        break;
      }
      case 'pale': {
        const skin = P(0xc8c4bc), dress = P(0x7a7670);
        g = humanoid({ body: dress, skin, legs: skin }); h = g.userData.head;
        mesh(Cyl(0.2, 0.42, 1.0, 10), dress, 0, 0.95, 0, g);
        mesh(B(0.36, 0.8, 0.36), P(0x030303), 0, -0.22, 0.01, h);
        mesh(new THREE.SphereGeometry(0.025, 6, 4), basic(0xffffff), 0.05, -0.02, 0.185, h);
        g.scale.set(1, 1.12, 1);
        break;
      }
      case 'misha': {
        g = humanoid({ body: P(0x5d6166), skin: P(0xd5cec6), legs: P(0x2a2622), headR: 0.21 }); h = g.userData.head;
        eyes(h, basic(0x000000), 0.045, 0.03, 0.18, 0.075);
        const hair = mesh(new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), P(0x1a1410), 0, 0.02, -0.01, h);
        hair.rotation.x = -0.3;
        g.scale.setScalar(0.85);
        break;
      }
      case 'pumpkin': {
        const coat = P(0x2a1a2a);
        g = humanoid({ body: coat, skin: skinM, legs: P(0x1a1a1a) }); h = g.userData.head;
        const pm = mesh(new THREE.SphereGeometry(0.27, 14, 10), P(0xd0600a), 0, 0.03, 0, h); pm.scale.set(1.15, 0.9, 1.05);
        mesh(Cyl(0.03, 0.04, 0.14, 6), P(0x3a4a1a), 0, 0.3, 0, h);
        const yellow = basic(0xffd040);
        [-0.1, 0.1].forEach(x => { const e = mesh(new THREE.ConeGeometry(0.06, 0.08, 3), yellow, x, 0.08, 0.255, h); e.rotation.x = Math.PI / 2; e.rotation.y = Math.PI; });
        mesh(B(0.22, 0.05, 0.02), yellow, 0, -0.07, 0.265, h);
        const gl = Util.glowSprite(0xff9020, 0.9, 0.5); gl.position.set(0, 0.03, 0.3); h.add(gl);
        mesh(B(0.56, 0.2, 0.32), P(0x5a1a10), 0, 1.5, 0, g);
        break;
      }
      case 'eater': {
        const dark = P(0x141111, { shininess: 25, specular: 0x331111 }), bone = P(0x8c8578);
        g = humanoid({ body: dark, skin: dark, legs: dark }); h = g.userData.head;
        eyes(h, basic(0xff2200), 0.035, 0.04, 0.15, 0.065);
        [-0.065, 0.065].forEach(x => { const gl = Util.glowSprite(0xff2200, 0.35, 0.9); gl.position.set(x, 0.04, 0.2); h.add(gl); });
        const hl = mesh(new THREE.ConeGeometry(0.035, 0.3, 6), bone, -0.1, 0.22, 0, h); hl.rotation.z = 0.5;
        const hr = mesh(new THREE.ConeGeometry(0.035, 0.3, 6), bone, 0.1, 0.22, 0, h); hr.rotation.z = -0.5;
        for (let i = 0; i < 4; i++) { const s = mesh(new THREE.ConeGeometry(0.04, 0.18, 5), bone, 0, 1.05 + i * 0.16, -0.16, g); s.rotation.x = -1.2; }
        for (let i = 0; i < 4; i++) mesh(B(0.4, 0.03, 0.02), bone, 0, 1.45 - i * 0.1, 0.145, g);
        mesh(B(0.14, 0.04, 0.02), basic(0x220000), 0, -0.07, 0.16, h);
        g.scale.setScalar(1.08);
        break;
      }
      case 'angel': {
        const robe = P(0xf8f4ec, { emissive: 0x2a2620 });
        g = humanoid({ body: robe, skin: skinM, legs: robe }); h = g.userData.head;
        mesh(Cyl(0.27, 0.42, 1.0, 12), robe, 0, 0.55, 0, g);
        const halo = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), basic(0xffd860), 0, 0.3, 0, h); halo.rotation.x = Math.PI / 2;
        const hg = Util.glowSprite(0xfff0a0, 0.9, 0.6); hg.position.y = 0.3; h.add(hg);
        [-1, 1].forEach(k => { const w = mesh(B(0.05, 1.1, 0.75), robe, k * 0.3, 1.45, -0.32, g); w.rotation.set(0.25, k * 0.55, k * 0.35); });
        mesh(B(0.1, 0.04, 0.02), P(0xd0a040), 0, 1.45, 0.146, g);
        mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), P(0xd8b060), 0, 0.03, -0.02, h);
        break;
      }
      default: { // Путник
        const coat = P(0x2c323a);
        g = humanoid({ body: coat, skin: skinM, legs: P(0x1c1c20) });
        hood(g, coat);
        mesh(Cyl(0.26, 0.33, 0.45, 8), coat, 0, 0.85, 0, g);
        mesh(B(0.36, 0.42, 0.16), P(0x3b2f22), 0, 1.3, -0.21, g);
      }
    }
    return equip(g);
  }
  function player() { return skin('traveler'); }
  // Чёрный силуэт — пропадает, когда на него посмотрят
  function silhouette() {
    const m = new THREE.MeshBasicMaterial({ color: 0x030303, fog: false });
    const g = humanoid({ body: m, skin: m, legs: m });
    g.scale.set(1.02, 1.12, 1.02);
    return g;
  }
  // Пассажир без лица
  function passenger(mat) { return humanoid({ body: mat, skin: P(0xb8b4ac), legs: P(0x222226) }); }

  function boy() {
    const skin = P(0xd5cec6), shirt = P(0x5d6166), shorts = P(0x2a2622);
    const g = humanoid({ body: shirt, skin, legs: shorts, headR: 0.21 });
    const head = g.userData.head;
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM, -0.075, 0.03, 0.18, head);
    mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM, 0.075, 0.03, 0.18, head);
    mesh(B(0.07, 0.015, 0.02), eyeM, 0, -0.08, 0.2, head);
    const hair = mesh(new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), P(0x1a1410), 0, 0.02, -0.01, head);
    hair.rotation.x = -0.3;
    g.scale.setScalar(0.68);
    return g;
  }

  function monster() {
    const g = new THREE.Group();
    const skin = P(0x141111, { shininess: 25, specular: 0x331111 });
    const bone = P(0x8c8578);
    const legL = limb(3.0, 0.2, skin); legL.position.set(-0.45, 3.0, 0); g.add(legL);
    const legR = limb(3.0, 0.2, skin); legR.position.set(0.45, 3.0, 0); g.add(legR);
    const body = new THREE.Group(); body.position.y = 2.95; body.rotation.x = 0.32; g.add(body);
    mesh(B(1.1, 2.4, 0.6), skin, 0, 1.2, 0, body);
    for (let i = 0; i < 5; i++) mesh(B(0.95 - i * 0.05, 0.06, 0.05), bone, 0, 0.8 + i * 0.28, 0.31, body);
    for (let i = 0; i < 5; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.08, 0.35, 5), bone, 0, 0.6 + i * 0.4, -0.32, body);
      sp.rotation.x = -1.2;
    }
    const armL = limb(3.6, 0.13, skin); armL.position.set(-0.75, 2.2, 0); armL.rotation.z = -0.12; body.add(armL);
    const armR = limb(3.6, 0.13, skin); armR.position.set(0.75, 2.2, 0); armR.rotation.z = 0.12; body.add(armR);
    [armL, armR].forEach(a => {
      for (let i = -1; i <= 1; i++) {
        const c = mesh(new THREE.ConeGeometry(0.04, 0.5, 5), bone, i * 0.08, -3.8, 0.05, a);
        c.rotation.x = Math.PI;
      }
    });
    const head = new THREE.Group(); head.position.set(0, 2.75, 0.25); body.add(head);
    const skull = mesh(new THREE.SphereGeometry(0.5, 14, 12), skin, 0, 0, 0, head);
    skull.scale.set(0.75, 1.05, 0.85);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    mesh(new THREE.SphereGeometry(0.085, 8, 6), eyeM, -0.17, 0.12, 0.37, head);
    mesh(new THREE.SphereGeometry(0.085, 8, 6), eyeM, 0.17, 0.12, 0.37, head);
    const eg1 = Util.glowSprite(0xff2200, 0.7, 0.9); eg1.position.set(-0.17, 0.12, 0.45); head.add(eg1);
    const eg2 = Util.glowSprite(0xff2200, 0.7, 0.9); eg2.position.set(0.17, 0.12, 0.45); head.add(eg2);
    mesh(B(0.46, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0x050000 }), 0, -0.27, 0.36, head);
    for (let i = 0; i < 6; i++) {
      const t = mesh(new THREE.ConeGeometry(0.03, 0.12, 4), bone, -0.18 + i * 0.072, -0.16, 0.41, head);
      t.rotation.x = Math.PI;
      const b = mesh(new THREE.ConeGeometry(0.03, 0.1, 4), bone, -0.16 + i * 0.066, -0.39, 0.41, head);
    }
    const hornL = mesh(new THREE.ConeGeometry(0.08, 0.7, 6), bone, -0.25, 0.55, -0.05, head); hornL.rotation.z = 0.5;
    const hornR = mesh(new THREE.ConeGeometry(0.08, 0.7, 6), bone, 0.25, 0.55, -0.05, head); hornR.rotation.z = -0.5;
    g.userData = { legL, legR, armL, armR, head, body };
    return g;
  }

  // ---------- постройки ----------
  function house(w, d, h, lit) {
    const g = new THREE.Group();
    const wood = P(0xffffff, { map: TEX.wood });
    mesh(B(w, h, d), wood, 0, h / 2, 0, g);
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4), P(0x1c1616), 0, h + h * 0.3, 0, g);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set((w / 2 + 0.5) / 0.707, h * 0.6, (d / 2 + 0.5) / 0.707);
    mesh(B(1.1, 2.1, 0.08), P(0x0d0a08), 0, 1.05, d / 2 + 0.03, g);
    const winM = lit ? new THREE.MeshBasicMaterial({ color: 0x8a6424 }) : P(0x050505);
    const board = P(0x4a3a2a);
    [-w / 4 - 0.3, w / 4 + 0.3].forEach((x, i) => {
      mesh(B(0.9, 0.8, 0.06), winM, x, h * 0.6, d / 2 + 0.02, g);
      if (!lit || i === 1) {
        const b1 = mesh(B(1.1, 0.12, 0.04), board, x, h * 0.6, d / 2 + 0.07, g); b1.rotation.z = 0.5;
        const b2 = mesh(B(1.1, 0.12, 0.04), board, x, h * 0.6, d / 2 + 0.08, g); b2.rotation.z = -0.5;
      }
    });
    mesh(B(0.6, 1.6, 0.6), P(0x2a2422), w / 4, h + 0.9, -d / 4, g);
    if (lit) { const gl = Util.glowSprite(0xffa040, 2.2, 0.35); gl.position.set(-w / 4 - 0.3, h * 0.6, d / 2 + 0.3); g.add(gl); }
    return g;
  }

  function church() {
    const g = new THREE.Group();
    const stone = P(0xffffff, { map: TEX.stone });
    const roofM = P(0x161414);
    mesh(B(9, 7, 15), stone, 0, 3.5, 0, g);
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4), roofM, 0, 9.5, 0, g);
    roof.rotation.y = Math.PI / 4; roof.scale.set(5.2 / 0.707, 5, 8.2 / 0.707);
    mesh(B(4.5, 14, 4.5), stone, 0, 7, 9.5, g);
    const spire = mesh(new THREE.ConeGeometry(3.3, 6, 4), roofM, 0, 17, 9.5, g); spire.rotation.y = Math.PI / 4;
    const cm = P(0x2a2a2a);
    const cr = mesh(B(0.25, 2.4, 0.25), cm, 0, 21, 9.5, g);
    const crb = mesh(B(1.3, 0.22, 0.22), cm, 0, 21.4, 9.5, g);
    cr.rotation.z = 0.25; crb.rotation.z = 0.25; // покосившийся крест
    mesh(B(1.8, 3.2, 0.1), P(0x0a0806), 0, 1.6, 11.8, g);
    mesh(B(1.4, 1.8, 0.1), P(0x050505), 0, 9.5, 11.8, g);
    [-3, 0, 3].forEach(z => {
      mesh(B(0.1, 2.2, 1), P(0x050505), 4.52, 4.3, z, g);
      mesh(B(0.1, 2.2, 1), P(0x050505), -4.52, 4.3, z, g);
    });
    return g;
  }

  function well() {
    const g = new THREE.Group();
    const stone = P(0xffffff, { map: TEX.stone });
    mesh(Cyl(1.25, 1.3, 0.9, 16), stone, 0, 0.45, 0, g);
    mesh(new THREE.CircleGeometry(1.0, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, 0.91, 0, g).rotation.x = -Math.PI / 2;
    const wood = P(0x3a2c1e);
    mesh(B(0.15, 2.2, 0.15), wood, 1.1, 1.1, 0, g);
    mesh(B(0.15, 2.2, 0.15), wood, -1.1, 1.1, 0, g);
    const bar = mesh(Cyl(0.06, 0.06, 2.4, 6), wood, 0, 1.9, 0, g); bar.rotation.z = Math.PI / 2;
    const roof = mesh(new THREE.ConeGeometry(1.7, 0.9, 4), P(0x1c1616), 0, 2.6, 0, g); roof.rotation.y = Math.PI / 4;
    mesh(Cyl(0.012, 0.012, 1.2, 4), P(0x888070), 0.3, 1.3, 0, g);
    mesh(Cyl(0.16, 0.13, 0.25, 8), wood, 0.3, 0.72, 0, g);
    return g;
  }

  function crypt() {
    const g = new THREE.Group();
    const stone = P(0xffffff, { map: TEX.stone });
    mesh(B(6, 4, 7), stone, 0, 2, 0, g);
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4), P(0x1a1818), 0, 5, 0, g);
    roof.rotation.y = Math.PI / 4; roof.scale.set(3.6 / 0.707, 2, 4.1 / 0.707);
    mesh(B(1.6, 2.6, 0.1), P(0x020202), 0, 1.3, 3.52, g);
    mesh(Cyl(0.25, 0.3, 3.6, 8), stone, -1.4, 1.8, 3.8, g);
    mesh(Cyl(0.25, 0.3, 3.6, 8), stone, 1.4, 1.8, 3.8, g);
    mesh(B(3.6, 0.4, 0.8), stone, 0, 3.8, 3.8, g);
    return g;
  }

  function graveCross() {
    const g = new THREE.Group();
    const wood = P(0x4a3826);
    const cross = new THREE.Group(); g.add(cross);
    mesh(B(0.14, 1.5, 0.1), wood, 0, 0.75, 0, cross);
    mesh(B(0.75, 0.12, 0.1), wood, 0, 1.1, 0, cross);
    mesh(B(1.1, 0.3, 2.1), P(0x2a2016), 0, 0.12, 0.9, g);
    const fl = P(0x3a1a2a);
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.07, 5, 4), fl, -0.3 + i * 0.2, 0.3, 0.5 + (i % 2) * 0.2, g);
    g.userData.cross = cross;
    return g;
  }

  function deadTree(scale = 1) {
    const g = new THREE.Group();
    const bark = P(0xffffff, { map: TEX.bark });
    mesh(Cyl(0.2, 0.4, 6, 6), bark, 0, 3, 0, g);
    const r = Util.rng(Math.floor(scale * 1000));
    for (let i = 0; i < 5; i++) {
      const br = new THREE.Group(); br.position.y = 2.5 + i * 0.7; br.rotation.y = r() * 6.28; g.add(br);
      const len = 1.5 + r() * 1.5;
      const m = mesh(Cyl(0.04, 0.1, len, 5), bark, 0, len / 2, 0, br);
      br.rotation.z = 0.7 + r() * 0.5;
    }
    g.scale.setScalar(scale);
    return g;
  }

  function oak() {
    const g = new THREE.Group();
    const bark = P(0xffffff, { map: TEX.bark });
    mesh(Cyl(0.9, 1.6, 7, 10), bark, 0, 3.5, 0, g);
    const r = Util.rng(77);
    for (let i = 0; i < 7; i++) {
      const br = new THREE.Group(); br.position.y = 5 + r() * 2; br.rotation.y = i * 0.9 + r(); g.add(br);
      const len = 4 + r() * 3;
      mesh(Cyl(0.12, 0.45, len, 6), bark, 0, len / 2, 0, br);
      br.rotation.z = 0.9 + r() * 0.4;
    }
    // горизонтальная ветка с качелями
    const arm = mesh(Cyl(0.22, 0.4, 6, 6), bark, 3, 5.6, 0, g); arm.rotation.z = Math.PI / 2;
    const rope = P(0x8a7a5a);
    mesh(Cyl(0.02, 0.02, 4.3, 4), rope, 3.5, 3.4, -0.4, g);
    mesh(Cyl(0.02, 0.02, 4.3, 4), rope, 3.5, 3.4, 0.4, g);
    const seat = mesh(B(0.35, 0.06, 1.0), P(0x5a4430), 3.5, 1.25, 0, g);
    g.userData.swing = [seat];
    return g;
  }

  function scarecrow() {
    const g = new THREE.Group();
    const wood = P(0x4a3a28);
    mesh(B(0.12, 2.8, 0.12), wood, 0, 1.4, 0, g);
    mesh(B(2.0, 0.1, 0.1), wood, 0, 2.15, 0, g);
    mesh(B(0.7, 0.9, 0.32), P(0x3a2a1a), 0, 1.85, 0, g);
    mesh(B(1.9, 0.18, 0.18), P(0x3a2a1a), 0, 2.15, 0, g);
    const head = new THREE.Group(); head.position.y = 2.6; g.add(head);
    mesh(new THREE.SphereGeometry(0.27, 10, 8), P(0x9a845a), 0, 0, 0, head);
    const eye = new THREE.MeshBasicMaterial({ color: 0x000000 });
    mesh(B(0.07, 0.07, 0.02), eye, -0.09, 0.05, 0.26, head);
    mesh(B(0.07, 0.07, 0.02), eye, 0.09, 0.05, 0.26, head);
    mesh(B(0.2, 0.03, 0.02), eye, 0, -0.1, 0.26, head);
    mesh(new THREE.ConeGeometry(0.3, 0.45, 8), P(0x1a1410), 0, 0.42, 0, head);
    mesh(Cyl(0.5, 0.5, 0.04, 12), P(0x1a1410), 0, 0.22, 0, head);
    g.userData.head = head;
    return g;
  }

  function campfire() {
    const g = new THREE.Group();
    const wood = P(0x3a2a1a), stone = P(0x555555);
    for (let i = 0; i < 4; i++) {
      const l = mesh(Cyl(0.08, 0.08, 1.0, 6), wood, 0, 0.12, 0, g);
      l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4;
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      mesh(new THREE.DodecahedronGeometry(0.13), stone, Math.cos(a) * 0.65, 0.08, Math.sin(a) * 0.65, g);
    }
    const f1 = mesh(new THREE.ConeGeometry(0.35, 1.0, 7), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.6, 0, g);
    const f2 = mesh(new THREE.ConeGeometry(0.2, 0.7, 7), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.45, 0, g);
    const gl = Util.glowSprite(0xff7a20, 4, 0.6); gl.position.y = 0.7; g.add(gl);
    g.userData.flames = [f1, f2];
    return g;
  }

  function questItem(kind) {
    const g = new THREE.Group();
    const inner = new THREE.Group(); g.add(inner);
    switch (kind) {
      case 0: { // кукла
        mesh(new THREE.ConeGeometry(0.14, 0.3, 8), P(0x7a2a2a), 0, 0.15, 0, inner);
        mesh(new THREE.SphereGeometry(0.09, 8, 6), P(0xd8c8b0), 0, 0.36, 0, inner);
        const e = new THREE.MeshBasicMaterial({ color: 0 });
        mesh(new THREE.SphereGeometry(0.018, 5, 4), e, -0.035, 0.37, 0.08, inner);
        mesh(new THREE.SphereGeometry(0.018, 5, 4), e, 0.035, 0.37, 0.08, inner);
        break;
      }
      case 1: // свеча
        mesh(Cyl(0.05, 0.05, 0.3, 8), P(0xe8e0c8), 0, 0.15, 0, inner);
        mesh(new THREE.ConeGeometry(0.03, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0xffb030 }), 0, 0.35, 0, inner);
        break;
      case 2: { // ключ
        const t = mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), P(0x7a4a2a, { shininess: 30 }), 0, 0.3, 0, inner);
        mesh(B(0.03, 0.3, 0.03), P(0x7a4a2a), 0, 0.08, 0, inner);
        mesh(B(0.08, 0.03, 0.03), P(0x7a4a2a), 0.04, -0.04, 0, inner);
        break;
      }
      case 3: // фотография
        mesh(B(0.28, 0.36, 0.03), P(0x3a2a1a), 0, 0.2, 0, inner);
        mesh(B(0.22, 0.29, 0.01), new THREE.MeshBasicMaterial({ color: 0x8a8070 }), 0, 0.2, 0.02, inner);
        break;
      case 4: { // заяц
        const f = P(0x9a9088);
        mesh(new THREE.SphereGeometry(0.13, 8, 6), f, 0, 0.13, 0, inner);
        mesh(new THREE.SphereGeometry(0.09, 8, 6), f, 0, 0.3, 0.02, inner);
        mesh(B(0.04, 0.18, 0.02), f, -0.04, 0.46, 0, inner);
        mesh(B(0.04, 0.18, 0.02), f, 0.04, 0.46, 0, inner);
        break;
      }
      default: // шкатулка
        mesh(B(0.3, 0.16, 0.22), P(0x4a2018), 0, 0.08, 0, inner);
        mesh(B(0.32, 0.04, 0.24), P(0xa08030, { shininess: 40 }), 0, 0.18, 0, inner);
    }
    const gl = Util.glowSprite(0xd8e0ff, 1.4, 0.55); gl.position.y = 0.3; g.add(gl);
    g.userData.inner = inner;
    return g;
  }

  // Ночные существа, которые выглядывают из-за углов
  function watcher(type) {
    const basic = c => new THREE.MeshBasicMaterial({ color: c });
    let g;
    if (type === 'pale') {
      const skin = P(0xc8c4bc), dress = P(0x7a7670);
      g = humanoid({ body: dress, skin, legs: skin });
      mesh(Cyl(0.2, 0.42, 1.0, 8), dress, 0, 0.95, 0, g);
      const hair = mesh(B(0.36, 0.8, 0.36), P(0x030303), 0, -0.22, 0.01, g.userData.head);
      mesh(new THREE.SphereGeometry(0.025, 6, 4), basic(0xffffff), 0.05, -0.02, 0.185, g.userData.head);
      g.scale.set(0.95, 1.38, 0.95);
    } else if (type === 'mask') {
      const black = P(0x0a0a0a);
      g = humanoid({ body: black, skin: black, legs: black });
      mesh(new THREE.ConeGeometry(0.55, 1.9, 10), black, 0, 0.95, 0, g);
      const tex = new THREE.CanvasTexture((() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        Util.drawMask(c.getContext('2d'), 64, 64, 60); return c;
      })());
      const mask = mesh(new THREE.PlaneGeometry(0.3, 0.38), new THREE.MeshBasicMaterial({ map: tex, transparent: true }), 0, 0, 0.175, g.userData.head);
      [g.userData.armL, g.userData.armR].forEach(a => mesh(new THREE.SphereGeometry(0.07, 6, 5), basic(0xd8d4ca), 0, -0.72, 0, a));
      g.scale.setScalar(1.12);
    } else if (type === 'crooked') {
      const skin = P(0x5e5a54), rag = P(0x2a2420);
      g = humanoid({ body: rag, skin, legs: skin });
      g.userData.head.position.y = 2.25;
      mesh(Cyl(0.05, 0.06, 0.5, 6), skin, 0, -0.25, 0, g.userData.head);
      g.userData.head.rotation.z = 1.2;
      const e = basic(0x000000);
      mesh(new THREE.SphereGeometry(0.05, 6, 4), e, -0.07, 0.03, 0.15, g.userData.head);
      mesh(new THREE.SphereGeometry(0.05, 6, 4), e, 0.07, 0.03, 0.15, g.userData.head);
      mesh(B(0.12, 0.1, 0.03), e, 0, -0.08, 0.16, g.userData.head);
      g.userData.armL.scale.y = 1.7; g.userData.armR.scale.y = 1.7;
      g.userData.hunch = 0.35;
    } else {
      const sh = basic(0x020202);
      g = humanoid({ body: sh, skin: sh, legs: sh });
      [-0.07, 0.07].forEach(x => {
        mesh(new THREE.SphereGeometry(0.04, 8, 6), basic(0xffffff), x, 0.02, 0.16, g.userData.head);
        const gl = Util.glowSprite(0xffffff, 0.35, 0.9); gl.position.set(x, 0.02, 0.2); g.userData.head.add(gl);
      });
      g.scale.setScalar(0.62);
    }
    g.userData.type = type;
    return g;
  }

  return {
    P, TEX, mesh, walkAnim, player, skin, passenger, silhouette, boy, monster, watcher, house, church, well, crypt,
    graveCross, deadTree, oak, scarecrow, campfire, questItem
  };
})();

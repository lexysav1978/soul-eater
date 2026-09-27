'use strict';
// Часть вторая: рай (парящие острова) и Бездна, где Пожиратель держит душу героя.
const Heaven = (() => {
  const HX = 3000, HZ = 0, BX = 3000, BZ = 500, BR = 28;
  const ISLES = { A: [0, 0, 14], B: [-42, -28, 11], C: [42, -28, 12], P: [0, -52, 5], D: [0, -95, 13], E: [0, 46, 13] };
  const SEGS = [[0, 0, -42, -28], [0, 0, 42, -28], [0, -10, 0, -47], [0, 10, 0, 34]];
  const BELL_COLORS = [0xf0c040, 0xc8d0d8, 0xf090a0, 0x80c0f0];
  const BELL_X = [-48, -44, -40, -36], BELL_Z = -34;
  const FOUNT = { x: 42, z: -28 };

  function wings(mat, s = 1) {
    const g = new THREE.Group();
    [-1, 1].forEach(k => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3 * s, 0.9 * s), mat);
      w.position.set(k * 0.35 * s, 0.1, -0.25 * s); w.rotation.set(0.25, k * 0.55, k * 0.35);
      g.add(w);
    });
    return g;
  }

  function build(scene, W) {
    const P = Models.P;
    const rnd = Util.rng(2024);
    const Rr = (a, b) => a + (b - a) * rnd();
    const blockers = [];
    const add = (m, x, y, z) => { m.position.set(HX + x, y, HZ + z); scene.add(m); return m; };
    const circ = (x, z, r) => W.circles.push({ x: HX + x, z: HZ + z, r, on: true });

    const marbleTex = Util.canvasTex(128, (c, s) => {
      Util.noise(c, s, [226, 218, 204], 10);
      c.strokeStyle = 'rgba(160,150,140,.35)'; c.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        c.beginPath(); let x = Math.random() * s, y = 0; c.moveTo(x, y);
        while (y < s) { x += (Math.random() - 0.5) * 20; y += 10; c.lineTo(x, y); }
        c.stroke();
      }
    }, 3);
    const marbleM = P(0xffffff, { map: marbleTex, shininess: 30 });
    const goldM = P(0xe0b040, { shininess: 80, specular: 0xfff0a0, emissive: 0x3a2800 });
    const cloudM = new THREE.MeshLambertMaterial({ color: 0xf4f0ea, emissive: 0x4a4438 });

    // ---------- небо, солнце, облачное море ----------
    const skyTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 256;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#9ec8f0'); gr.addColorStop(0.45, '#fdf2d8'); gr.addColorStop(0.6, '#fbe2b0'); gr.addColorStop(1, '#f0c888');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      return new THREE.CanvasTexture(c);
    })();
    add(new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })), 0, 0, 0);
    const sunG = Util.glowSprite(0xfff4c0, 160, 0.9); sunG.material.fog = false; add(sunG, 160, 110, -260);
    const seaTex = Util.canvasTex(256, (c, s) => {
      c.fillStyle = '#f6ecd8'; c.fillRect(0, 0, s, s);
      Util.blotches(c, s, 140, 'rgba(255,255,255,.55)', 6, 26);
      Util.blotches(c, s, 60, 'rgba(230,200,150,.25)', 8, 30);
    }, 6);
    const sea = add(new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: seaTex })), 0, -30, 0);
    sea.rotation.x = -Math.PI / 2;

    // облачные «клубы» (инстансы)
    const puffs = [];
    const puff = (x, y, z, s) => puffs.push([x, y, z, s]);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = Rr(70, 260), y = Rr(-24, 20), n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) puff(Math.cos(a) * r + Rr(-8, 8), y + Rr(-2, 3), Math.sin(a) * r + Rr(-8, 8), Rr(4, 10));
    }

    // ---------- острова ----------
    for (const key in ISLES) {
      const [x, z, r] = ISLES[key];
      add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, 1.4, 48), marbleM), x, -0.7, z);
      const rim = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 64), goldM), x, 0.02, z); rim.rotation.x = Math.PI / 2;
      for (let k = 0; k < Math.round(r * 0.9); k++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r * 0.85;
        puff(x + Math.cos(a) * rr, Rr(-4, -1.6), z + Math.sin(a) * rr, Rr(2, 4.5));
      }
    }
    // облачные мосты
    SEGS.forEach(([ax, az, bx, bz]) => {
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.Group(); g.position.set(HX + (ax + bx) / 2, -0.25, HZ + (az + bz) / 2); g.rotation.y = Math.atan2(bx - ax, bz - az);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, len), cloudM)); scene.add(g);
      for (let t = 0; t <= len; t += 2.2) {
        const k = t / len;
        [-1, 1].forEach(sd => {
          const px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
          const nx = -(bz - az) / len, nz = (bx - ax) / len;
          puff(px + nx * sd * 2.2, Rr(-0.6, -0.2), pz + nz * sd * 2.2, Rr(0.7, 1.2));
        });
      }
    });
    const puffIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), cloudM, puffs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    puffs.forEach(([x, y, z, s], i) => { m4.compose(v.set(HX + x, y, HZ + z), q, sc.set(s, s * 0.6, s)); puffIM.setMatrixAt(i, m4); });
    puffIM.frustumCulled = false; scene.add(puffIM);

    // колонны на центральном острове
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 12, z = Math.sin(a) * 12;
      let nearBridge = false;
      [[-42, -28], [42, -28], [0, -47], [0, 34]].forEach(([bx, bz]) => { const d = Math.hypot(bx, bz); if ((x * bx + z * bz) / (12 * d) > 0.93) nearBridge = true; });
      if (nearBridge) continue;
      const col = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 6, 16), marbleM), x, 3, z); blockers.push(col);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), goldM), x, 6.2, z);
      circ(x, z, 0.7);
    }

    // ---------- Хранитель ----------
    const robe = P(0xfaf6ee, { emissive: 0x3a3630 });
    const guardian = Models.passenger(robe);
    guardian.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 12), robe)).position.y = 0.75;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd860, fog: false }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 0.32; guardian.userData.head.add(halo);
    const hg = Util.glowSprite(0xfff0a0, 1.6, 0.7); hg.position.y = 0.3; guardian.userData.head.add(hg);
    const gw = wings(robe, 1.3); gw.position.set(0, 1.4, -0.1); guardian.add(gw);
    guardian.scale.setScalar(1.25);
    add(guardian, 5, 0, -3); circ(5, -3, 0.6);

    // ---------- колокола (запад) ----------
    const bells = [];
    BELL_X.forEach((x, i) => {
      [-1, 1].forEach(k => add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), goldM), x + k * 1.3, 1.7, BELL_Z));
      add(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.22, 0.25), goldM), x, 3.4, BELL_Z);
      const pivot = new THREE.Group(); pivot.position.set(HX + x, 3.3, HZ + BELL_Z); scene.add(pivot);
      const mat = P(BELL_COLORS[i], { shininess: 90, specular: 0xffffff, side: THREE.DoubleSide });
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 1.1, 18, 1, true), mat); bell.position.y = -0.7; pivot.add(bell);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat); cap.position.y = -0.15; pivot.add(cap);
      const glow = Util.glowSprite(BELL_COLORS[i], 3, 0); glow.position.y = -0.7; pivot.add(glow);
      circ(x - 1.3, BELL_Z, 0.25); circ(x + 1.3, BELL_Z, 0.25);
      bells.push({ x: HX + x, z: HZ + BELL_Z + 1.6, pivot, mat, glow, swing: 0 });
    });
    const bellStand = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 12), marbleM), -42, 0.55, -22);
    const sheet = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), P(0xf4ead0)), -42, 1.13, -22); sheet.rotation.x = -0.3;
    circ(-42, -22, 0.6);

    // ---------- статуи и фонтан (восток) ----------
    const basin = add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 24), marbleM), FOUNT.x, 0.4, FOUNT.z); blockers.push(basin);
    const water = add(new THREE.Mesh(new THREE.CircleGeometry(2, 24), new THREE.MeshBasicMaterial({ color: 0x9ad8f0 })), FOUNT.x, 0.81, FOUNT.z); water.rotation.x = -Math.PI / 2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.6, 10), marbleM), FOUNT.x, 1.2, FOUNT.z);
    const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), FOUNT.x, 20, FOUNT.z);
    beam.visible = false;
    circ(FOUNT.x, FOUNT.z, 2.5);
    const stoneM = P(0xe4e0d6, { map: marbleTex });
    const statues = [];
    [[6.5, 0], [-6.5, 0], [0, 6.5], [0, -6.5]].forEach(([dx, dz], i) => {
      const x = FOUNT.x + dx, z = FOUNT.z + dz;
      add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), marbleM), x, 0.5, z);
      const g = new THREE.Group(); g.position.set(HX + x, 1, HZ + z); scene.add(g);
      const fig = Models.passenger(stoneM); fig.scale.setScalar(1.15); g.add(fig);
      fig.userData.armR.rotation.x = -1.5;
      const w = wings(stoneM, 1.2); w.position.set(0, 1.6, -0.1); fig.add(w);
      const target = Math.atan2(FOUNT.x - x, FOUNT.z - z);
      const k = [1, 2, 3, 2][i];
      const start = target + k * Math.PI / 2;
      g.rotation.y = start;
      circ(x, z, 0.9);
      statues.push({ x: HX + x, z: HZ + z, g, target, angle: start, goal: start });
    });
    const plaque = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.15), goldM), FOUNT.x - 4, 0.6, FOUNT.z + 4); plaque.rotation.y = -Math.PI / 4;

    // ---------- невидимый мост (север) ----------
    const stone = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), P(0xd8d4f0, { emissive: 0x302850 })), 0, 0.7, -49.5);
    circ(0, -49.5, 0.8);
    const tiles = [];
    let col = 1;
    const path = [];
    for (let r = 0; r < 7; r++) { if (r > 0) col = Util.clamp(col + [-1, 0, 1][Math.floor(rnd() * 3)], 0, 2); path.push(col); }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
      const x = (c - 1) * 3.6, z = -59 - r * 3.6;
      const mat = P(0xcfe8ff, { transparent: true, opacity: 0.5, emissive: 0x203040, shininess: 90 });
      const t = add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), mat), x, -0.12, z);
      tiles.push({ x: HX + x, z: HZ + z, real: path[r] === c, mesh: t, mat, flash: 0 });
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 12), marbleM), 0, 0.6, -95);
    circ(0, -95, 0.6);

    // ---------- Золотые врата (юг) ----------
    const gz = 52;
    [-3.6, 3.6].forEach(x => { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 9, 16), goldM), x, 4.5, gz); blockers.push(p); circ(x, gz, 0.8); });
    add(new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.9, 1.1), goldM), 0, 9.2, gz);
    const sockets = [-2, 0, 2].map(x => add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), P(0x555566)), x, 10, gz + 0.3));
    const doorM = P(0xc89a30, { shininess: 70, emissive: 0x2a1800 });
    const doors = [-1, 1].map(k => {
      const pv = new THREE.Group(); pv.position.set(HX + k * 3.0, 0, HZ + gz); scene.add(pv);
      const d = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.3), doorM); d.position.set(-k * 1.5, 4, 0); pv.add(d);
      for (let y = 1.5; y < 8; y += 2) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), goldM); o.position.set(-k * 1.5, y, 0.18); pv.add(o); }
      return pv;
    });
    const doorBox = { x1: HX - 3, x2: HX + 3, z1: HZ + gz - 0.3, z2: HZ + gz + 0.3, on: true }; W.boxes.push(doorBox);
    const portal = add(new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshBasicMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })), 0, 4, gz + 0.6);
    portal.visible = false;

    // ---------- осколки света ----------
    const shardAt = [[-42, 1.9, -22], [FOUNT.x, 2.6, FOUNT.z], [0, 1.9, -95]];
    const shards = shardAt.map(([x, y, z]) => {
      const g = new THREE.Group(); g.position.set(HX + x, y, HZ + z); scene.add(g);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xbfe8ff })); c.scale.y = 1.6; g.add(c);
      g.add(Util.glowSprite(0x9ad8ff, 2.4, 0.8));
      g.visible = false; g.userData.baseY = y;
      return g;
    });

    // ---------- Бездна (арена битвы) ----------
    const abyssTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 256;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#05010a'); gr.addColorStop(0.5, '#2a0612'); gr.addColorStop(1, '#0a0004');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      return new THREE.CanvasTexture(c);
    })();
    const abyss = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.MeshBasicMaterial({ map: abyssTex, side: THREE.BackSide, fog: false }));
    abyss.position.set(BX, 0, BZ); scene.add(abyss);
    const arenaTex = Util.canvasTex(256, (c, s) => {
      Util.noise(c, s, [34, 26, 34], 18);
      c.strokeStyle = 'rgba(230,170,60,.55)'; c.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        c.beginPath(); let x = Math.random() * s, y = Math.random() * s; c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; c.lineTo(x, y); }
        c.stroke();
      }
    }, 3);
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR * 0.7, 4, 64), P(0xffffff, { map: arenaTex }));
    arena.position.set(BX, -2, BZ); scene.add(arena);
    const arim = new THREE.Mesh(new THREE.TorusGeometry(BR, 0.15, 6, 80), new THREE.MeshBasicMaterial({ color: 0xc08030 }));
    arim.rotation.x = Math.PI / 2; arim.position.set(BX, 0.02, BZ); scene.add(arim);
    const pillars = [45, 135, 225, 315].map(deg => {
      const a = deg * Math.PI / 180, x = BX + Math.cos(a) * 20, z = BZ + Math.sin(a) * 20;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 12), P(0x3a3040)); col.position.set(x, 2.5, z); scene.add(col);
      const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: 0xfff0a0 })); cry.position.set(x, 5.8, z); cry.scale.y = 1.6; scene.add(cry);
      const gl = Util.glowSprite(0xfff0a0, 4, 0.7); gl.position.copy(cry.position); scene.add(gl);
      W.circles.push({ x, z, r: 1, on: true });
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      ray.visible = false; scene.add(ray);
      return { x, z, cry, gl, ray, cd: 0, rayT: 0 };
    });
    const boss = Models.monster(); boss.scale.setScalar(3.6); boss.position.set(BX, -9, BZ - 40); scene.add(boss);
    const soul = Util.glowSprite(0x80d0ff, 1.2, 1); soul.position.set(0, 1.4, 0.4); boss.userData.body.add(soul);
    // Рука, которая бьёт по арене
    const claw = new THREE.Group();
    const clawM = P(0x141010, { shininess: 30 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 3.4), clawM); claw.add(palm);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.6, 6), clawM); f.rotation.x = Math.PI / 2; f.position.set(-1.1 + i * 0.73, -0.1, 2.8); claw.add(f); }
    const thumb = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2, 6), clawM); thumb.rotation.set(Math.PI / 2, 0, -0.8); thumb.position.set(2, 0, 0.9); claw.add(thumb);
    const weak = Util.glowSprite(0x80d0ff, 2.2, 0); weak.position.y = 0.8; claw.add(weak);
    const weakGem = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0x80d0ff })); weakGem.position.y = 0.55; claw.add(weakGem);
    claw.visible = false; scene.add(claw);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.7, 40), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.18 }));
    disc.rotation.x = -Math.PI / 2; disc.visible = false; scene.add(disc);
    const orbs = [];
    for (let i = 0; i < 6; i++) {
      const o = Util.glowSprite(0x6a10a0, 2, 1); o.visible = false; scene.add(o);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a0020 })); o.add(core);
      orbs.push({ s: o, on: false, vx: 0, vz: 0, t: 0 });
    }

    // ---------- проверки ----------
    const segD = (x, z, [ax, az, bx, bz]) => {
      const dx = bx - ax, dz = bz - az, t = Util.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      return Math.hypot(x - ax - dx * t, z - az - dz * t);
    };
    function islandAt(wx, wz) {
      const x = wx - HX, z = wz - HZ;
      for (const k in ISLES) { const [ix, iz, r] = ISLES[k]; if (Math.hypot(x - ix, z - iz) <= r) return k; }
      return null;
    }
    function tileAt(wx, wz) { return tiles.find(t => Math.abs(wx - t.x) <= 1.8 && Math.abs(wz - t.z) <= 1.8) || null; }
    function onGround(wx, wz, arenaMode) {
      if (arenaMode) return Math.hypot(wx - BX, wz - BZ) <= BR;
      if (islandAt(wx, wz)) return true;
      const x = wx - HX, z = wz - HZ;
      for (const s of SEGS) if (segD(x, z, s) <= 2.2) return true;
      const t = tileAt(wx, wz);
      return !!(t && t.real);
    }

    return {
      HX, HZ, BX, BZ, BR, ISLES, blockers, guardian, bells, bellStand: { x: HX - 42, z: HZ - 22 }, statues, beam, plaque: { x: HX + FOUNT.x - 4, z: HZ + FOUNT.z + 4 },
      fount: { x: HX + FOUNT.x, z: HZ + FOUNT.z }, stone: { x: HX, z: HZ - 49.5, mesh: stone }, tiles, shards, sockets, doors, doorBox, portal,
      gate: { x: HX, z: HZ + 50 }, pillars, boss, soul, claw, weak, weakGem, ring, disc, orbs,
      spawn: { x: HX, z: HZ + 6 }, arenaSpawn: { x: BX, z: BZ + 20 },
      islandAt, tileAt, onGround, wings
    };
  }
  return { build, wings };
})();

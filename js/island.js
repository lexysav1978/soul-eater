'use strict';
// Туманный остров: светлая добрая локация, где в море бродит гигант. И пещера с Пожирателем душ.
const Island = (() => {
  const IX = 0, IZ = 3000, R = 95;
  const CX = 0, CZ = 2500, CR = 30;

  function build(scene, W) {
    const P = Models.P;
    const rnd = Util.rng(777);
    const Rr = (a, b) => a + (b - a) * rnd();
    const blockers = [];
    const box = (cx, cz, w, d) => W.boxes.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, on: true });
    const circle = (x, z, r) => W.circles.push({ x, z, r, on: true });
    const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };

    // ---------- море, песок, трава ----------
    const sea = add(new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), P(0x2a8ac8, { shininess: 90, specular: 0x88ccff })), IX, -0.4, IZ);
    sea.rotation.x = -Math.PI / 2;
    const sandTex = Util.canvasTex(64, (c, s) => { Util.noise(c, s, [226, 206, 150], 22); }, 20);
    const sand = add(new THREE.Mesh(new THREE.CircleGeometry(R + 12, 64), P(0xffffff, { map: sandTex, shininess: 0 })), IX, -0.1, IZ);
    sand.rotation.x = -Math.PI / 2;
    const grassTex = Util.canvasTex(128, (c, s) => {
      Util.noise(c, s, [84, 138, 64], 30);
      Util.blotches(c, s, 60, 'rgba(60,120,40,.35)', 2, 8);
      Util.blotches(c, s, 40, 'rgba(150,200,90,.3)', 2, 6);
    }, 40);
    const grass = add(new THREE.Mesh(new THREE.CircleGeometry(R, 64), P(0xffffff, { map: grassTex, shininess: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), IX, 0, IZ);
    grass.rotation.x = -Math.PI / 2;

    // тропинки
    const pathM = P(0xd8c08a, { shininess: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const PATHS = [[-30, 45, 8, 12], [8, 12, 60, -26], [8, 12, 0, -48]];
    PATHS.forEach(([ax, az, bx, bz]) => {
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.Group(); g.position.set(IX + (ax + bx) / 2, 0.02, IZ + (az + bz) / 2); g.rotation.y = Math.atan2(bx - ax, bz - az);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, len), pathM); m.rotation.x = -Math.PI / 2; g.add(m); scene.add(g);
    });
    const segD = (x, z, [ax, az, bx, bz]) => {
      const dx = bx - ax, dz = bz - az, t = Util.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      return Math.hypot(x - ax - dx * t, z - az - dz * t);
    };
    const clearAt = (x, z) => {
      if (Math.hypot(x - 8, z - 12) < 22) return true;            // деревня
      if (Math.hypot(x - 62, z + 30) < 12) return true;           // маяк
      if (Math.hypot(x, z + 72) < 32) return true;                // гора
      if (x > -60 && x < -20 && z > 38 && z < 64) return true;    // поле с самолётом
      for (const p of PATHS) if (segD(x, z, p) < 3.5) return true;
      return false;
    };

    // ---------- деревья и цветы ----------
    const trees = [];
    for (let k = 0; k < 600 && trees.length < 130; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 6);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (clearAt(x, z)) continue;
      trees.push([x, z, Rr(0.8, 1.3)]);
    }
    const trunkG = new THREE.CylinderGeometry(0.2, 0.3, 1, 7); trunkG.translate(0, 0.5, 0);
    const crownG = new THREE.IcosahedronGeometry(1, 1);
    const tIM = new THREE.InstancedMesh(trunkG, P(0x7a5230), trees.length);
    const cIM = new THREE.InstancedMesh(crownG, P(0xffffff), trees.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    trees.forEach(([x, z, s], i) => {
      m4.compose(v.set(IX + x, 0, IZ + z), q.identity(), sc.set(s, 3.2 * s, s)); tIM.setMatrixAt(i, m4);
      m4.compose(v.set(IX + x, 4 * s, IZ + z), q.identity(), sc.set(2.2 * s, 1.9 * s, 2.2 * s)); cIM.setMatrixAt(i * 2, m4);
      m4.compose(v.set(IX + x + 0.5 * s, 5.2 * s, IZ + z - 0.3 * s), q.identity(), sc.set(1.5 * s, 1.3 * s, 1.5 * s)); cIM.setMatrixAt(i * 2 + 1, m4);
      col.setHSL(0.26 + rnd() * 0.06, 0.55, 0.36 + rnd() * 0.1); cIM.setColorAt(i * 2, col);
      col.offsetHSL(0, 0, 0.06); cIM.setColorAt(i * 2 + 1, col);
      circle(IX + x, IZ + z, 0.4 * s);
    });
    [tIM, cIM].forEach(im => { im.frustumCulled = false; scene.add(im); });
    const FL_COLORS = [0xff5a6a, 0xffd23a, 0xffffff, 0xff9ad0, 0x9a7aff, 0xff8a2a];
    const fIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), 900);
    const stemIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), P(0x3a8a2a), 900);
    for (let i = 0; i < 900; i++) {
      let x, z, k = 0;
      do { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 3); x = Math.cos(a) * r; z = Math.sin(a) * r; k++; } while (Math.hypot(x, z + 72) < 30 && k < 10);
      m4.compose(v.set(IX + x, 0.32, IZ + z), q.identity(), sc.set(1, 0.7, 1)); fIM.setMatrixAt(i, m4);
      m4.compose(v.set(IX + x, 0.15, IZ + z), q.identity(), sc.set(1, 1, 1)); stemIM.setMatrixAt(i, m4);
      fIM.setColorAt(i, col.setHex(FL_COLORS[i % FL_COLORS.length]));
    }
    [fIM, stemIM].forEach(im => { im.frustumCulled = false; scene.add(im); });

    // ---------- уютные домики ----------
    const HOUSES = [[-4, 2, 0xf2d7a0], [16, -2, 0xbfe0f0], [22, 18, 0xf5c0c8], [0, 24, 0xd0f0c0]];
    HOUSES.forEach(([x, z, c], i) => {
      const g = new THREE.Group(); g.position.set(IX + x, 0, IZ + z); g.rotation.y = Math.atan2(8 - x, 12 - z); scene.add(g);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 5), P(c)); walls.position.y = 1.6; g.add(walls); blockers.push(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), P(0xc0402a)); roof.rotation.y = Math.PI / 4; roof.scale.set(4.3, 2.2, 4.3); roof.position.y = 4.3; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.06), P(0x8a5a30)); door.position.set(0, 0.95, 2.52); g.add(door);
      [-1.5, 1.5].forEach(wx => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.05), new THREE.MeshBasicMaterial({ color: 0x9ad0f0 })); w.position.set(wx, 1.9, 2.52); g.add(w);
        const fb = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.25), P(0x8a5a30)); fb.position.set(wx, 1.4, 2.65); g.add(fb);
        for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), new THREE.MeshLambertMaterial({ color: FL_COLORS[(i + k) % FL_COLORS.length] })); f.position.set(wx - 0.35 + k * 0.23, 1.58, 2.65); g.add(f); }
      });
      box(IX + x, IZ + z, 5.6, 5.6);
    });

    // ---------- маяк ----------
    const LX = IX + 62, LZ = IZ - 30;
    const rockM = P(0xffffff, { map: Models.TEX.rock });
    [[0, 0, 5], [3, 2, 3], [-3, 1, 3.5]].forEach(([dx, dz, r]) => { const rk = add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockM), LX + dx, 0, LZ + dz); rk.scale.y = 0.5; });
    const white = P(0xf4f2ec), red = P(0xd03a2a);
    const tower = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.3, 16, 20), white), LX, 8, LZ); blockers.push(tower);
    [4, 10].forEach(y => add(new THREE.Mesh(new THREE.CylinderGeometry(2.2 - y * 0.035, 2.25 - y * 0.035, 2.2, 20), red), LX, y, LZ));
    add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 20), P(0x333333)), LX, 16.1, LZ);
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.8, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a0 })), LX, 17.1, LZ);
    add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.4, 16), red), LX, 18.7, LZ);
    const lg = Util.glowSprite(0xfff0a0, 7, 0.6); add(lg, LX, 17.1, LZ);
    circle(LX, LZ, 3);

    // ---------- самолёт на поле ----------
    const PX0 = IX - 40, PZ0 = IZ + 52;
    const pw = P(0xf2f2f2, { shininess: 60 });
    const fus = add(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 22, 20), pw), PX0, 2.3, PZ0); fus.rotation.z = Math.PI / 2; blockers.push(fus);
    const nose = add(new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), pw), PX0 - 11, 2.3, PZ0); nose.rotation.z = Math.PI / 2; nose.scale.y = 1.6;
    const tail = add(new THREE.Mesh(new THREE.ConeGeometry(1.9, 5, 20), pw), PX0 + 13.5, 2.6, PZ0); tail.rotation.z = -Math.PI / 2;
    add(new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 22), pw), PX0 + 1, 1.6, PZ0);
    const fin = add(new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), P(0x2a5aa0)), PX0 + 14, 5, PZ0); fin.rotation.z = -0.3;
    add(new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.02), P(0x2a5aa0)), PX0, 1.6, PZ0 + 1.91);
    for (let k = -8; k <= 8; k += 1.2) add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), new THREE.MeshBasicMaterial({ color: 0x223344 })), PX0 + k, 2.9, PZ0 + 1.9);
    box(PX0 + 1, PZ0, 26, 4); box(PX0 + 1, PZ0, 4, 22);

    // ---------- гора с пещерой ----------
    [[0, -80, 28, 0.8], [-18, -68, 16, 0.9], [18, -70, 17, 0.85], [0, -64, 12, 1.1]].forEach(([x, z, r, sy]) => {
      const h = add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), P(0xffffff, { map: Models.TEX.rock, color: 0x9a948a })), IX + x, 0, IZ + z);
      h.scale.y = sy; h.rotation.y = x; circle(IX + x, IZ + z, r * 0.92);
    });
    const face = add(new THREE.Mesh(new THREE.BoxGeometry(14, 9, 3), P(0xffffff, { map: Models.TEX.rock, color: 0x9a948a })), IX, 4.5, IZ - 54);
    blockers.push(face); box(IX, IZ - 54, 14, 3);
    const hole = add(new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0x000000 })), IX, 2.0, IZ - 52.45);
    hole.scale.y = 1.25;
    // пещера — светящиеся кристаллы у входа (слабо)
    [-2.6, 2.6].forEach(dx => { const c = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: 0x8a6aff })), IX + dx, 0.4, IZ - 52.2); c.scale.y = 1.8; });

    // ---------- бабочки ----------
    const butterflies = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const wm = new THREE.MeshBasicMaterial({ color: FL_COLORS[i % FL_COLORS.length], side: THREE.DoubleSide });
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), wm); w1.position.x = -0.11; const p1 = new THREE.Group(); p1.add(w1); g.add(p1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), wm); w2.position.x = 0.11; const p2 = new THREE.Group(); p2.add(w2); g.add(p2);
      const cx = IX + Rr(-50, 50), cz = IZ + Rr(-30, 60);
      g.position.set(cx, 1.2, cz); scene.add(g);
      butterflies.push({ g, p1, p2, cx, cz, a: rnd() * 6, s: Rr(0.3, 0.7), r: Rr(2, 6) });
    }

    // ---------- гигант в море ----------
    const giant = Models.monster(); giant.scale.setScalar(5.6); scene.add(giant);
    // сразу ставим гиганта в море у острова, а не в центр мира (там деревня)
    giant.position.set(IX + 175, -2, IZ);
    const giantState = { a: 2.2, phase: 0, stepT: 0 };

    // ---------- Миша ----------
    const misha = Models.boy(); scene.add(misha);
    misha.position.set(IX - 27, 0, IZ + 43);

    // ---------- пещера внутри ----------
    const caveRock = P(0xffffff, { map: Models.TEX.rock, color: 0x6a6070, side: THREE.BackSide });
    add(new THREE.Mesh(new THREE.SphereGeometry(CR, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), caveRock), CX, 0, CZ);
    const cfloor = add(new THREE.Mesh(new THREE.CircleGeometry(CR, 40), P(0xffffff, { map: Models.TEX.rock, color: 0x4a4450 })), CX, 0.01, CZ);
    cfloor.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, r = Rr(8, CR - 2);
      const h = Rr(1, 5);
      const st = add(new THREE.Mesh(new THREE.ConeGeometry(Rr(0.3, 0.9), h, 6), P(0x5a5260)), CX + Math.cos(a) * r, h / 2, CZ + Math.sin(a) * r);
      if (Math.hypot(Math.cos(a) * r, Math.sin(a) * r - 20) < 5) st.visible = false;
      const top = add(new THREE.Mesh(new THREE.ConeGeometry(Rr(0.3, 0.8), Rr(2, 6), 6), P(0x5a5260)), CX + Math.cos(a + 1) * Rr(4, CR - 4), 0, CZ + Math.sin(a + 1) * Rr(4, CR - 4));
      top.rotation.x = Math.PI; top.position.y = Math.sqrt(Math.max(0, CR * CR - (top.position.x - CX) ** 2 - (top.position.z - CZ) ** 2)) - 2;
    }
    const cryC = [0x6a8aff, 0xa060ff, 0x60d0ff];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = Rr(10, CR - 3);
      const x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      const c = add(new THREE.Mesh(new THREE.OctahedronGeometry(Rr(0.3, 0.8), 0), new THREE.MeshBasicMaterial({ color: cryC[i % 3] })), x, 0.5, z);
      c.scale.y = 2; c.rotation.z = Rr(-0.4, 0.4);
      const gl = Util.glowSprite(cryC[i % 3], 3, 0.4); add(gl, x, 0.8, z);
    }
    for (let i = 0; i < 12; i++) {
      const bn = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 5), P(0xd0c8b0)), CX + Rr(-8, 8), 0.07, CZ - 8 + Rr(-4, 4));
      bn.rotation.set(Math.PI / 2, rnd() * 3, 0);
    }
    const caveMonster = Models.monster(); caveMonster.scale.setScalar(3.2); caveMonster.position.set(CX, 0, CZ - 14); scene.add(caveMonster);
    const souls = [];
    for (let i = 0; i < 14; i++) {
      const s = Util.glowSprite(0x80c8ff, 1.2, 0.8); scene.add(s);
      souls.push({ s, a: rnd() * 6.28, r: Rr(4, 12), y: Rr(4, 16), sp: Rr(0.2, 0.5) });
    }
    const mishaCave = Models.boy(); mishaCave.position.set(CX + 2.5, 0, CZ + 19); mishaCave.visible = false; scene.add(mishaCave);
    const rubble = new THREE.Group();
    for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(Rr(0.8, 1.6), 0), P(0x5a5260)); r.position.set(CX + Rr(-3, 3), Rr(0, 2), CZ + 27 + Rr(-0.5, 0.5)); rubble.add(r); }
    rubble.visible = false; scene.add(rubble);

    function update(dt, t) {
      butterflies.forEach(b => {
        b.a += dt * b.s;
        b.g.position.set(b.cx + Math.cos(b.a) * b.r, 1.1 + Math.sin(b.a * 3) * 0.4, b.cz + Math.sin(b.a * 1.3) * b.r);
        b.g.rotation.y = -b.a;
        const f = Math.sin(t * 18 + b.a * 10) * 0.9;
        b.p1.rotation.y = f; b.p2.rotation.y = -f;
      });
      giantState.a += dt * 0.018;
      const gx = IX + Math.cos(giantState.a) * 175, gz = IZ + Math.sin(giantState.a) * 175;
      giant.position.set(gx, -2, gz);
      giant.rotation.y = Math.atan2(-Math.sin(giantState.a), Math.cos(giantState.a));
      giantState.phase += dt * 0.9;
      const u = giant.userData, s = Math.sin(giantState.phase);
      u.legL.rotation.x = s * 0.35; u.legR.rotation.x = -s * 0.35;
      u.armL.rotation.x = -s * 0.25; u.armR.rotation.x = s * 0.25;
      souls.forEach(o => { o.a += dt * o.sp; o.s.position.set(CX + Math.cos(o.a) * o.r, o.y + Math.sin(o.a * 2) * 0.8, CZ - 14 + Math.sin(o.a) * o.r); });
      const cu = caveMonster.userData;
      cu.body.scale.y = 1 + Math.sin(t * 0.8) * 0.02;
      cu.head.rotation.z = Math.sin(t * 0.3) * 0.15;
    }

    return {
      IX, IZ, R, CX, CZ, CR, blockers, giant, giantState, misha, mishaCave, caveMonster, rubble, update,
      spawn: { x: IX - 30, z: IZ + 46 },
      lighthouse: { x: LX, z: LZ },
      caveDoor: { x: IX, z: IZ - 50.5 },
      caveIn: { x: CX, z: CZ + 23 },
      village: { x: IX + 8, z: IZ + 12 },
      plane: { x: PX0, z: PZ0 },
      houses: HOUSES.map(([x, z]) => ({ x: IX + x, z: IZ + z }))
    };
  }
  return { build };
})();

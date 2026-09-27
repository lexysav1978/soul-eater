'use strict';
// Построение мира: лес, деревня, кладбище, шахта. Коллизии и взаимодействия с объектами.
const World = (() => {
  const HALF = 236;
  const MINE = { x0: 1000, z0: 0, N: 8, C: 7 };
  const POI = {
    well: { x: 0, z: 0 },
    boySpot: { x: 2.4, z: 3.4 },
    boyHouse: { x: 0, z: -18 },
    boyDoor: { x: 0, z: -13.5 },
    church: { x: -30, z: -10 },
    churchDoor: { x: -16.5, z: -10 },
    cem: { x1: 84, x2: 136, z1: -112, z2: -68 },
    crypt: { x: 128, z: -90 },
    cryptDoor: { x: 122, z: -90 },
    momGrave: { x: 93, z: -78 },
    mine: { x: -130, z: 96 },
    homeDoor: { x: -14, z: 18.3 },
    hill: { x: -130, z: 122 },
    oak: { x: -100, z: -110 },
    field: { x: 70, z: 70 }
  };
  const PATHS = [[6, -4, 82, -90], [-5, 6, -130, 93], [-6, -6, -99, -104], [6, 6, 66, 66]];
  const HOUSES = [
    { x: 0, z: -18, w: 8, d: 7, h: 4.6, r: 0, lit: true },
    { x: -14, z: -30, w: 7, d: 6, h: 4, r: 0 },
    { x: 20, z: -6, w: 7, d: 6, h: 4, r: -Math.PI / 2 },
    { x: -14, z: 22, w: 7, d: 6, h: 4, r: Math.PI },
    { x: 26, z: 14, w: 6, d: 6, h: 4, r: -Math.PI / 2 },
    { x: 34, z: -24, w: 6, d: 5, h: 3.6, r: -Math.PI / 2 },
    { x: 10, z: 34, w: 6, d: 5, h: 3.6, r: Math.PI }
  ];

  const boxes = [], circles = [];
  const blockersOut = [], blockersMine = [];
  const trees = [];
  const grid = new Map();
  const CELL = 8;
  const stones = [];
  let trunkIM, lowIM, highIM, stumpIM;

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  function setIM(im, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _p.set(x, y, z); _s.set(sx, sy, sz); _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
  }
  function addBox(cx, cz, w, d) { const b = { x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, on: true }; boxes.push(b); return b; }
  function addCircle(x, z, r) { const c = { x, z, r, on: true }; circles.push(c); return c; }
  function segDist(x, z, s) {
    const [ax, az, bx, bz] = s;
    const dx = bx - ax, dz = bz - az;
    const t = Util.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  }
  function inClear(x, z) {
    if (x * x + z * z < 50 * 50) return true;
    if (x > 78 && x < 142 && z > -118 && z < -62) return true;
    if (Math.hypot(x - POI.hill.x, z - (POI.hill.z - 6)) < 36) return true;
    if (Math.hypot(x - POI.oak.x, z - POI.oak.z) < 14) return true;
    if (Math.hypot(x - POI.field.x, z - POI.field.z) < 26) return true;
    for (const p of PATHS) if (segDist(x, z, p) < 4.5) return true;
    return false;
  }
  const gkey = (cx, cz) => (cx + 200) * 1000 + (cz + 200);

  function place(scene, obj, x, z, r = 0) { obj.position.set(x, 0, z); obj.rotation.y = r; scene.add(obj); return obj; }
  function blockerMeshes(obj, list) { obj.traverse(o => { if (o.isMesh && !o.material.transparent) list.push(o); }); }

  function build(scene) {
    const rnd = Util.rng(1337);
    const R = (a, b) => a + (b - a) * rnd();
    const P = Models.P;

    // ---------- земля ----------
    const groundTex = Util.canvasTex(256, (g, s) => {
      Util.noise(g, s, [30, 34, 24], 22);
      Util.blotches(g, s, 120, 'rgba(15,18,10,.35)', 3, 14);
      Util.blotches(g, s, 80, 'rgba(50,44,30,.25)', 2, 10);
    }, 90);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), P(0xffffff, { map: groundTex, shininess: 0 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    const dirtM = P(0xffffff, { map: Models.TEX.dirt, shininess: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const vg = new THREE.Mesh(new THREE.CircleGeometry(46, 40), dirtM);
    vg.rotation.x = -Math.PI / 2; vg.position.y = 0.01; scene.add(vg);
    const cg = new THREE.Mesh(new THREE.PlaneGeometry(52, 44), dirtM);
    cg.rotation.x = -Math.PI / 2; cg.position.set(110, 0.01, -90); scene.add(cg);

    const pathM = P(0x3a3024, { shininess: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [ax, az, bx, bz] of PATHS) {
      const len = Math.hypot(bx - ax, bz - az);
      const grp = new THREE.Group(); grp.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
      grp.rotation.y = Math.atan2(bx - ax, bz - az);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, len), pathM); m.rotation.x = -Math.PI / 2;
      grp.add(m); scene.add(grp);
    }

    // ---------- деревья ----------
    for (let k = 0; k < 2200 && trees.length < 1150; k++) {
      const x = R(-HALF, HALF), z = R(-HALF, HALF);
      if (inClear(x, z)) continue;
      trees.push({ x, z, s: R(0.8, 1.45), state: 0, hits: 0, rot: R(0, 6.28) });
    }
    // кольцо плотного леса по краю карты
    for (let a = 0; a < Math.PI * 2; a += 0.012) {
      const rr = HALF + R(2, 12);
      trees.push({ x: Math.cos(a) * rr * 1.0, z: Math.sin(a) * rr, s: R(1.1, 1.6), state: 0, hits: 0, rot: R(0, 6.28), edge: true });
    }
    const n = trees.length;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
    trunkIM = new THREE.InstancedMesh(trunkGeo, P(0xffffff, { map: Models.TEX.bark }), n);
    stumpIM = new THREE.InstancedMesh(trunkGeo, P(0xffffff, { map: Models.TEX.bark }), n);
    lowIM = new THREE.InstancedMesh(coneGeo, P(0xffffff), n);
    highIM = new THREE.InstancedMesh(coneGeo, P(0xffffff), n);
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      const k = 0.7 + rnd() * 0.4;
      col.setRGB(0.07 * k, 0.13 * k, 0.09 * k); lowIM.setColorAt(i, col);
      col.setRGB(0.08 * k, 0.15 * k, 0.1 * k); highIM.setColorAt(i, col);
      setTree(i);
      const cx = Math.floor(t.x / CELL), cz = Math.floor(t.z / CELL);
      const key = gkey(cx, cz);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    });
    [trunkIM, stumpIM, lowIM, highIM].forEach(im => { im.frustumCulled = false; scene.add(im); });

    // ---------- валуны ----------
    const bouldGeo = new THREE.DodecahedronGeometry(1, 0);
    const bould = new THREE.InstancedMesh(bouldGeo, P(0xffffff, { map: Models.TEX.rock }), 90);
    let bi = 0;
    for (let k = 0; k < 500 && bi < 90; k++) {
      const x = R(-HALF, HALF), z = R(-HALF, HALF);
      if (x * x + z * z < 55 * 55) continue;
      if (x > 78 && x < 142 && z > -118 && z < -62) continue;
      let onPath = false; for (const p of PATHS) if (segDist(x, z, p) < 4) onPath = true;
      if (onPath) continue;
      const s = R(0.6, 2.2);
      setIM(bould, bi++, x, s * 0.2, z, s, s * R(0.5, 0.9), s * R(0.8, 1.2), R(0, 1), R(0, 6), 0);
      addCircle(x, z, s * 0.9);
    }
    bould.count = bi; bould.frustumCulled = false; scene.add(bould);

    // ---------- деревня ----------
    HOUSES.forEach((h, i) => {
      const obj = place(scene, Models.house(h.w, h.d, h.h, !!h.lit), h.x, h.z, h.r);
      const side = Math.abs(Math.sin(h.r)) > 0.5;
      W.coverBoxes.push(addBox(h.x, h.z, side ? h.d : h.w, side ? h.w : h.d));
      if (i === 3) {
        // дом игрока: фонарик над дверью
        const lamp = Util.glowSprite(0xffb050, 1.6, 0.8); lamp.position.set(h.x, 2.5, h.z - h.d / 2 - 0.2); scene.add(lamp);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 })); bulb.position.copy(lamp.position); scene.add(bulb);
      }
      blockerMeshes(obj, blockersOut);
    });
    const ch = place(scene, Models.church(), POI.church.x, POI.church.z, Math.PI / 2);
    W.coverBoxes.push(addBox(POI.church.x, POI.church.z, 15, 9));
    addBox(POI.church.x + 9.5, POI.church.z, 4.5, 4.5);
    blockerMeshes(ch, blockersOut);
    place(scene, Models.well(), 0, 0);
    addCircle(0, 0, 1.45);
    // сломанный забор и бочки в деревне
    const fenceM = P(0x3a2c1e);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + 0.1;
      if (rnd() < 0.35) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, R(0.8, 1.4), 0.15), fenceM);
      post.position.set(Math.cos(a) * 44, 0.5, Math.sin(a) * 44); post.rotation.z = R(-0.3, 0.3);
      scene.add(post);
    }
    const barrelM = P(0x3a2a1c);
    [[5, -12], [-5, -13], [16, 2], [-8, 16], [30, -16]].forEach(([x, z]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.0, 10), barrelM);
      b.position.set(x, 0.5, z); scene.add(b); addCircle(x, z, 0.5);
    });

    // ---------- кладбище ----------
    const c = POI.cem;
    const postGeo = new THREE.BoxGeometry(0.14, 1.5, 0.14);
    const posts = [];
    for (let x = c.x1; x <= c.x2; x += 2) { posts.push([x, c.z1]); posts.push([x, c.z2]); }
    for (let z = c.z1 + 2; z < c.z2; z += 2) { if (!(z > -94 && z < -86)) posts.push([c.x1, z]); posts.push([c.x2, z]); }
    const postIM = new THREE.InstancedMesh(postGeo, P(0x1c1c1c, { shininess: 30 }), posts.length);
    posts.forEach(([x, z], i) => setIM(postIM, i, x, 0.75, z, 1, R(0.7, 1.1), 1, R(-0.08, 0.08), 0, R(-0.08, 0.08)));
    postIM.frustumCulled = false; scene.add(postIM);
    const railM = P(0x1c1c1c);
    const rail = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), railM);
      r.position.set((x1 + x2) / 2, 1.2, (z1 + z2) / 2); r.rotation.y = Math.atan2(x2 - x1, z2 - z1); scene.add(r);
    };
    rail(c.x1, c.z1, c.x2, c.z1); rail(c.x1, c.z2, c.x2, c.z2); rail(c.x2, c.z1, c.x2, c.z2);
    rail(c.x1, c.z1, c.x1, -94); rail(c.x1, -86, c.x1, c.z2);
    addBox((c.x1 + c.x2) / 2, c.z1, c.x2 - c.x1, 0.4);
    addBox((c.x1 + c.x2) / 2, c.z2, c.x2 - c.x1, 0.4);
    addBox(c.x2, (c.z1 + c.z2) / 2, 0.4, c.z2 - c.z1);
    addBox(c.x1, (c.z1 + (-94)) / 2, 0.4, -94 - c.z1);
    addBox(c.x1, (-86 + c.z2) / 2, 0.4, c.z2 + 86);

    const graves = [];
    for (let x = 90; x <= 120; x += 3.2) for (let z = -108; z <= -72; z += 3.6) {
      if (z > -93 && z < -87) continue;
      if (Math.abs(x - POI.momGrave.x) < 2.5 && Math.abs(z - POI.momGrave.z) < 3) continue;
      if (rnd() < 0.15) continue;
      graves.push([x + R(-0.4, 0.4), z + R(-0.4, 0.4), rnd() < 0.55 ? 0 : 1]);
    }
    const stoneG = new THREE.BoxGeometry(0.7, 1.0, 0.18);
    const crossV = new THREE.BoxGeometry(0.13, 1.3, 0.12), crossH = new THREE.BoxGeometry(0.6, 0.12, 0.12);
    const graveStoneM = P(0xffffff, { map: Models.TEX.stone });
    const crossM = P(0x2a2622);
    const nS = graves.filter(g => g[2] === 0).length, nC = graves.length - nS;
    const gsIM = new THREE.InstancedMesh(stoneG, graveStoneM, nS);
    const cvIM = new THREE.InstancedMesh(crossV, crossM, nC), chIM = new THREE.InstancedMesh(crossH, crossM, nC);
    const moundIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.2, 1.8), P(0x241c14), graves.length);
    let si = 0, ci = 0;
    graves.forEach(([x, z, t], i) => {
      const tilt = R(-0.25, 0.25), tiltX = R(-0.15, 0.15);
      if (t === 0) setIM(gsIM, si++, x, 0.45, z, 1, R(0.8, 1.2), 1, tiltX, 0, tilt);
      else {
        setIM(cvIM, ci, x, 0.6, z, 1, 1, 1, tiltX, 0, tilt);
        setIM(chIM, ci++, x - Math.sin(tilt) * 0.35, 0.95 + Math.cos(tilt) * 0 - 0.02, z, 1, 1, 1, tiltX, 0, tilt);
      }
      setIM(moundIM, i, x, 0.05, z + 1.1, 1, 1, 1, 0, 0, 0);
    });
    [gsIM, cvIM, chIM, moundIM].forEach(im => { im.frustumCulled = false; scene.add(im); });
    const cr = place(scene, Models.crypt(), POI.crypt.x, POI.crypt.z, -Math.PI / 2);
    W.coverBoxes.push(addBox(POI.crypt.x, POI.crypt.z, 7, 6));
    blockerMeshes(cr, blockersOut);
    [[88, -108, 1.1], [134, -72, 0.9], [112, -110, 1.3], [80, -60, 1.2]].forEach(([x, z, s]) => {
      place(scene, Models.deadTree(s), x, z, x); addCircle(x, z, 0.4 * s);
    });
    const mom = place(scene, Models.graveCross(), POI.momGrave.x, POI.momGrave.z, 0);
    W.momCross = mom.userData.cross;

    // ---------- старый дуб и поле ----------
    const oakObj = place(scene, Models.oak(), POI.oak.x, POI.oak.z, 0.4);
    W.oakSwing = oakObj.userData.swing[0];
    addCircle(POI.oak.x, POI.oak.z, 1.6);
    blockerMeshes(oakObj, blockersOut);
    const sc = place(scene, Models.scarecrow(), POI.field.x, POI.field.z, -2.4);
    W.scarecrowHead = sc.userData.head;
    addCircle(POI.field.x, POI.field.z, 0.4);
    // сухие стебли на поле
    const stalkIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1, 0.04), P(0x5a4a2a), 500);
    for (let i = 0; i < 500; i++) {
      const a = R(0, 6.28), r = Math.sqrt(rnd()) * 22;
      const x = POI.field.x + Math.cos(a) * r, z = POI.field.z + Math.sin(a) * r;
      if (Math.hypot(x - POI.field.x, z - POI.field.z) < 2.5) { setIM(stalkIM, i, 0, -5, 0, 0, 0, 0); continue; }
      setIM(stalkIM, i, x, 0.5, z, 1, R(0.6, 1.3), 1, R(-0.3, 0.3), 0, R(-0.3, 0.3));
    }
    stalkIM.frustumCulled = false; scene.add(stalkIM);

    // ---------- вход в шахту ----------
    const rockM = P(0xffffff, { map: Models.TEX.rock });
    const face = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 4), rockM);
    face.position.set(POI.mine.x, 5, 100); scene.add(face);
    addBox(POI.mine.x, 100, 16, 4);
    blockersOut.push(face);
    [[-130, 122, 20, 0.75], [-143, 112, 12, 0.9], [-117, 113, 12, 0.85], [-130, 108, 9, 1.2]].forEach(([x, z, r, sy]) => {
      const h = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockM);
      h.position.set(x, 0, z); h.scale.y = sy; h.rotation.y = x; scene.add(h);
      addCircle(x, z, r * 0.95);
    });
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    opening.position.set(POI.mine.x, 1.6, 97.97); opening.rotation.y = Math.PI; scene.add(opening);
    const beam = P(0x3a2a1a);
    [-1.7, 1.7].forEach(dx => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), beam); p.position.set(POI.mine.x + dx, 1.8, 97.8); scene.add(p); });
    const lint = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.35), beam); lint.position.set(POI.mine.x, 3.6, 97.8); scene.add(lint);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), P(0x4a3a28)); sign.position.set(POI.mine.x + 0.3, 4.2, 97.7); sign.rotation.z = -0.2; scene.add(sign);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), P(0xffffff, { map: Models.TEX.dirt }));
    mound.position.set(POI.mine.x, 0, 96.8); mound.scale.set(1, 1.0, 0.75); scene.add(mound);
    W.mound = mound;
    W.moundBox = addBox(POI.mine.x, 96.5, 4.2, 3.2);

    // ---------- камни на земле ----------
    const stoneGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const stoneM = P(0x8a8a88);
    const addStone = (x, z) => {
      const m = new THREE.Mesh(stoneGeo, stoneM);
      m.position.set(x, 0.12, z); m.rotation.set(R(0, 3), R(0, 3), 0); m.scale.set(1, 0.7, 1.2);
      scene.add(m); stones.push({ x, z, mesh: m, picked: false });
    };
    for (let i = 0; i < 8; i++) { const a = R(0, 6.28), r = R(38, 47); addStone(Math.cos(a) * r, Math.sin(a) * r); }
    for (let k = 0; k < 400 && stones.length < 60; k++) {
      const x = R(-200, 200), z = R(-200, 200);
      if (x * x + z * z < 50 * 50) continue;
      addStone(x, z);
    }

    // ---------- шахта ----------
    buildMine(scene);
    buildHome(scene);
    return W;
  }

  // Комната в доме игрока (строится далеко, как шахта)
  function buildHome(scene) {
    const X = 1000, Z = 300, RW = 5, RD = 6, RH = 2.8, T = 0.2;
    const P = Models.P;
    const g = new THREE.Group(); g.position.set(X, 0, Z); scene.add(g);
    const blockers = [];
    const wood = P(0xffffff, { map: Models.TEX.wood });
    const planks = Util.canvasTex(64, (c, s) => {
      Util.noise(c, s, [58, 44, 30], 20);
      c.fillStyle = 'rgba(0,0,0,.45)';
      for (let y = 0; y < s; y += 10) c.fillRect(0, y, s, 2);
    }, 4, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), P(0xffffff, { map: planks, shininess: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; g.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), P(0x1e1610));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; g.add(ceil);
    for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.18, 0.18), P(0x2a1c12)); b.position.set(0, RH - 0.09, i * 2); g.add(b); }
    const wall = (w, h, d, x, y, z, coll = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); g.add(m); blockers.push(m);
      if (coll) addBox(X + x, Z + z, w, d);
      return m;
    };
    wall(T, RH, RD, -RW / 2, RH / 2, 0);
    wall(T, RH, RD, RW / 2, RH / 2, 0);
    wall(RW, RH, T, 0, RH / 2, -RD / 2);
    // передняя стена с дверным проёмом
    const dw = 1.1, dh = 2.1, side = (RW - dw) / 2;
    wall(side, RH, T, -RW / 2 + side / 2, RH / 2, RD / 2, false);
    wall(side, RH, T, RW / 2 - side / 2, RH / 2, RD / 2, false);
    wall(dw, RH - dh, T, 0, dh + (RH - dh) / 2, RD / 2, false);
    addBox(X, Z + RD / 2, RW, T);
    // дверь на петлях
    const doorPivot = new THREE.Group(); doorPivot.position.set(-dw / 2, 0, RD / 2); g.add(doorPivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.07), P(0x2a1e14));
    door.position.set(dw / 2, dh / 2, 0); doorPivot.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), P(0x8a7a50, { shininess: 60 }));
    knob.position.set(dw - 0.12, 1.0, -0.06); doorPivot.add(knob);
    // темнота за дверью
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0x05070a }));
    outside.position.set(0, 1.5, RD / 2 + 1.6); outside.rotation.y = Math.PI; g.add(outside);
    // окно
    const winM = new THREE.MeshBasicMaterial({ color: 0x8a9098 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), winM);
    win.position.set(RW / 2 - T / 2 - 0.01, 1.55, -0.4); win.rotation.y = -Math.PI / 2; g.add(win);
    const frameM = P(0x2a1c12);
    [[0.08, 0.95, 1.0], [0.08, 0.06, 1.0], [0.08, 0.95, 0.06]].forEach(([a, b, c], i) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), frameM);
      f.position.set(RW / 2 - T / 2 - 0.03, 1.55, -0.4); g.add(f);
      if (i === 0) { f.scale.set(1, 1, 1); f.visible = false; }
    });
    // кровать
    const bed = new THREE.Group(); bed.position.set(-1.7, 0, -1.9); g.add(bed);
    const bw = P(0x3a2818);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 2.0), bw); frame.position.y = 0.3; bed.add(frame);
    const matt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 1.9), P(0xb8b0a0)); matt.position.y = 0.55; bed.add(matt);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 1.3), P(0x5a2a22)); blanket.position.set(0, 0.64, 0.3); bed.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), P(0xd8d0c0)); pillow.position.set(0, 0.68, -0.72); bed.add(pillow);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.08), bw); head.position.set(0, 0.6, -1.0); bed.add(head);
    [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), bw); l.position.set(x, 0.15, z); bed.add(l); });
    addBox(X - 1.7, Z - 1.9, 1.0, 2.0);
    // табуретка
    const stool = new THREE.Group(); stool.position.set(1.5, 0, -0.9); g.add(stool);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), bw); seat.position.y = 0.48; stool.add(seat);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.48, 5), bw);
      l.position.set(Math.cos(a) * 0.13, 0.24, Math.sin(a) * 0.13); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); stool.add(l);
    }
    addCircle(X + 1.5, Z - 0.9, 0.25);
    const light = new THREE.PointLight(0x9aaacc, 0.6, 7, 1.2); light.position.set(X + 1.9, 1.6, Z - 0.4); scene.add(light);
    W.home = {
      X, Z, RW, RD, blockers, doorPivot, winM, light,
      door: { x: X, z: Z + RD / 2 - 0.6 },
      bed: { x: X - 1.7, z: Z - 1.9 },
      stool: { x: X + 1.5, z: Z - 0.9 },
      win: { x: X + RW / 2 - T / 2 - 0.02, y: 1.55, z: Z - 0.4 },
      outside: { x: X, z: Z + RD / 2 + 1.1 },
      corners: [[-1.9, 2.3], [1.9, 2.3], [1.9, -2.5], [0.2, -2.6], [-0.4, 2.4]].map(([x, z]) => ({ x: X + x, z: Z + z }))
    };
  }

  function buildMine(scene) {
    const { x0, z0, N, C } = MINE;
    const r = Util.rng(4242);
    const wallE = [], wallS = [], vis = [];
    for (let i = 0; i < N; i++) { wallE.push(Array(N).fill(true)); wallS.push(Array(N).fill(true)); vis.push(Array(N).fill(false)); }
    const stack = [[0, 0]]; vis[0][0] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [];
      if (i > 0 && !vis[i - 1][j]) nb.push([i - 1, j]);
      if (i < N - 1 && !vis[i + 1][j]) nb.push([i + 1, j]);
      if (j > 0 && !vis[i][j - 1]) nb.push([i, j - 1]);
      if (j < N - 1 && !vis[i][j + 1]) nb.push([i, j + 1]);
      if (!nb.length) { stack.pop(); continue; }
      const [ni, nj] = nb[Math.floor(r() * nb.length)];
      if (ni > i) wallE[i][j] = false; else if (ni < i) wallE[ni][j] = false;
      else if (nj > j) wallS[i][j] = false; else wallS[i][nj] = false;
      vis[ni][nj] = true; stack.push([ni, nj]);
    }
    for (let k = 0; k < 6; k++) wallE[Math.floor(r() * (N - 1))][Math.floor(r() * N)] = false;
    // самая дальняя клетка — там Камень души
    const dist = []; for (let i = 0; i < N; i++) dist.push(Array(N).fill(-1));
    const q = [[0, 0]]; dist[0][0] = 0; let far = [0, 0];
    while (q.length) {
      const [i, j] = q.shift();
      const d = dist[i][j];
      if (d > dist[far[0]][far[1]]) far = [i, j];
      const go = (a, b) => { if (dist[a][b] < 0) { dist[a][b] = d + 1; q.push([a, b]); } };
      if (i < N - 1 && !wallE[i][j]) go(i + 1, j);
      if (i > 0 && !wallE[i - 1][j]) go(i - 1, j);
      if (j < N - 1 && !wallS[i][j]) go(i, j + 1);
      if (j > 0 && !wallS[i][j - 1]) go(i, j - 1);
    }
    const P = Models.P;
    const H = 4.2, T = 0.8;
    const rockM = P(0xffffff, { map: Models.TEX.rock });
    const floorTex = Util.canvasTex(128, (g, s) => { Util.noise(g, s, [34, 30, 26], 26); Util.blotches(g, s, 40, 'rgba(0,0,0,.3)', 2, 9); }, N * 2);
    const size = N * C;
    const cx = x0 + (N - 1) * C / 2, cz = z0 + (N - 1) * C / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), P(0xffffff, { map: floorTex, shininess: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), P(0x14110e));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); scene.add(ceil);
    const geoS = new THREE.BoxGeometry(C + T, H, T), geoE = new THREE.BoxGeometry(T, H, C + T);
    const wall = (geo, x, z, w, d) => {
      const m = new THREE.Mesh(geo, rockM); m.position.set(x, H / 2, z); scene.add(m);
      blockersMine.push(m); addBox(x, z, w, d);
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = x0 + i * C, z = z0 + j * C;
      if (j === 0) wall(geoS, x, z - C / 2, C + T, T);
      if (i === 0) wall(geoE, x - C / 2, z, T, C + T);
      if (i === N - 1 || wallE[i][j]) wall(geoE, x + C / 2, z, T, C + T);
      if (j === N - 1 || wallS[i][j]) wall(geoS, x, z + C / 2, C + T, T);
    }
    // крепи, кости, светящиеся грибы
    const beamM = P(0x3a2a1a);
    const boneM = P(0xb0a890);
    for (let k = 0; k < 16; k++) {
      const i = Math.floor(r() * N), j = Math.floor(r() * N);
      const x = x0 + i * C, z = z0 + j * C, o = C / 2 - 0.7;
      [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([dx, dz]) => {
        if (r() < 0.5) return;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, H, 0.25), beamM);
        p.position.set(x + dx, H / 2, z + dz); scene.add(p);
      });
    }
    for (let k = 0; k < 10; k++) {
      const x = x0 + Math.floor(r() * N) * C + (r() - 0.5) * 4, z = z0 + Math.floor(r() * N) * C + (r() - 0.5) * 4;
      for (let b = 0; b < 3; b++) {
        const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), boneM);
        bn.position.set(x + (r() - 0.5), 0.05, z + (r() - 0.5)); bn.rotation.set(Math.PI / 2, r() * 3, 0); scene.add(bn);
      }
      if (r() < 0.5) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), boneM); sk.position.set(x, 0.12, z); scene.add(sk); }
    }
    const mushM = new THREE.MeshBasicMaterial({ color: 0x40d0c0 });
    for (let k = 0; k < 12; k++) {
      const i = Math.floor(r() * N), j = Math.floor(r() * N);
      const side = Math.floor(r() * 4), o = C / 2 - T / 2 - 0.15;
      const x = x0 + i * C + (side === 0 ? o : side === 1 ? -o : (r() - 0.5) * 4);
      const z = z0 + j * C + (side === 2 ? o : side === 3 ? -o : (r() - 0.5) * 4);
      for (let m = 0; m < 4; m++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 + r() * 0.05, 6, 4), mushM);
        s.position.set(x + (r() - 0.5) * 0.6, 0.05, z + (r() - 0.5) * 0.6); scene.add(s);
      }
      const gl = Util.glowSprite(0x30c0b0, 1.6, 0.45); gl.position.set(x, 0.2, z); scene.add(gl);
    }
    // лестница наверх
    const lx = x0 - C / 2 + T / 2 + 0.25, lz = z0;
    const ladder = new THREE.Group();
    [-0.35, 0.35].forEach(dz => { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, 0.1), beamM); rl.position.set(0, H / 2, dz); ladder.add(rl); });
    for (let y = 0.3; y < H; y += 0.4) { const rg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.7), beamM); rg.position.set(0, y, 0); ladder.add(rg); }
    ladder.position.set(lx, 0, lz); scene.add(ladder);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, H, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8090a0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(lx + 0.8, H / 2, lz); scene.add(shaft);
    // Камень души
    const fx = x0 + far[0] * C, fz = z0 + far[1] * C;
    const crystal = new THREE.Group();
    const cm = P(0x6a2aa0, { emissive: 0x3a0a6a, shininess: 90, specular: 0xffffff });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), cm); main.scale.y = 1.7; main.position.y = 0.85; crystal.add(main);
    [[0.5, 0.3, 0.2, 0.25], [-0.4, 0.25, 0.3, 0.2], [0.1, 0.2, -0.45, 0.22]].forEach(([x, y, z, s]) => {
      const c2 = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), cm); c2.position.set(x, y, z); c2.scale.y = 1.8; c2.rotation.z = x; crystal.add(c2);
    });
    const rockBase = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), rockM); rockBase.scale.y = 0.4; crystal.add(rockBase);
    const cg = Util.glowSprite(0xa040ff, 4, 0.5); cg.position.y = 0.9; crystal.add(cg);
    crystal.position.set(fx, 0, fz); scene.add(crystal);
    const cl = new THREE.PointLight(0x9a40ff, 1.6, 14, 1.5); cl.position.set(fx, 1.6, fz); scene.add(cl);

    W.mine = { x0, z0, N, C, wallE, wallS, start: { x: x0, z: z0 }, ladder: { x: lx, z: lz }, crystalPos: { x: fx, z: fz }, crystal, crystalMain: main, crystalLight: cl };
  }

  // ---------- деревья: состояние ----------
  function setTree(i) {
    const t = trees[i], s = t.s, H = 7 * s;
    const Z = 0.0001;
    if (t.state === 2) {
      setIM(trunkIM, i, t.x, 0, t.z, Z, Z, Z);
      setIM(lowIM, i, t.x, 0, t.z, Z, Z, Z);
      setIM(highIM, i, t.x, 0, t.z, Z, Z, Z);
      setIM(stumpIM, i, t.x, 0, t.z, s, 0.5, s);
    } else {
      setIM(trunkIM, i, t.x, 0, t.z, s, H, s, 0, t.rot, 0);
      if (t.state === 1) setIM(lowIM, i, t.x, 0, t.z, Z, Z, Z);
      else setIM(lowIM, i, t.x, 1.8 * s, t.z, 2.4 * s, 3.8 * s, 2.4 * s, 0, t.rot, 0);
      setIM(highIM, i, t.x, 4.0 * s, t.z, 1.6 * s, 3.6 * s, 1.6 * s, 0, t.rot + 0.5, 0);
      setIM(stumpIM, i, t.x, 0, t.z, Z, Z, Z);
    }
    trunkIM.instanceMatrix.needsUpdate = lowIM.instanceMatrix.needsUpdate = highIM.instanceMatrix.needsUpdate = stumpIM.instanceMatrix.needsUpdate = true;
  }

  function treesNear(x, z, fn) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = grid.get(gkey(cx + dx, cz + dz));
      if (arr) for (const i of arr) fn(i, trees[i]);
    }
  }

  const W = {
    HALF, MINE, POI, PATHS, HOUSES, trees, stones, boxes, circles, blockersOut, blockersMine,
    coverBoxes: [],
    build,
    nearestTree(x, z, maxD) {
      let best = -1, bd = maxD;
      treesNear(x, z, (i, t) => {
        if (t.state === 2 || t.edge) return;
        const d = Math.hypot(t.x - x, t.z - z) - 0.35 * t.s;
        if (d < bd) { bd = d; best = i; }
      });
      return best < 0 ? null : { i: best, d: bd };
    },
    stripTree(i) { trees[i].state = 1; setTree(i); },
    cutTree(i) { trees[i].state = 2; setTree(i); },
    shakeTree(i, amt) {
      const t = trees[i], s = t.s;
      if (t.state === 2) return;
      setIM(trunkIM, i, t.x, 0, t.z, s, 7 * s, s, amt, t.rot, amt * 0.5);
      setIM(highIM, i, t.x + amt * 2, 4.0 * s, t.z, 1.6 * s, 3.6 * s, 1.6 * s, amt, t.rot + 0.5, 0);
      if (t.state === 0) setIM(lowIM, i, t.x + amt, 1.8 * s, t.z, 2.4 * s, 3.8 * s, 2.4 * s, amt, t.rot, 0);
      trunkIM.instanceMatrix.needsUpdate = highIM.instanceMatrix.needsUpdate = lowIM.instanceMatrix.needsUpdate = true;
    },
    resetTree(i) { setTree(i); },
    treeState() { return trees.map(t => t.state).join(''); },
    applyTreeState(str) {
      trees.forEach((t, i) => { t.state = str && str[i] ? +str[i] : 0; t.hits = 0; setTree(i); });
    },
    stoneState() { return stones.map(s => (s.picked ? 1 : 0)).join(''); },
    applyStoneState(str) { stones.forEach((s, i) => { s.picked = !!(str && str[i] === '1'); s.mesh.visible = !s.picked; }); },
    pickStone(i) { stones[i].picked = true; stones[i].mesh.visible = false; },
    setMound(on) { W.mound.visible = on; W.moundBox.on = on; },
    setCrystal(on) { W.mine.crystal.visible = on; W.mine.crystalLight.intensity = on ? 1.6 : 0; },
    setCrossBroken(b) {
      const c = W.momCross;
      c.rotation.set(b ? 0.3 : 0, 0, b ? 1.25 : 0);
      c.position.set(b ? 0.5 : 0, b ? 0.05 : 0, 0);
    },

    // Выталкивание из препятствий
    resolve(pos, r) {
      for (const b of boxes) {
        if (!b.on) continue;
        if (pos.x < b.x1 - r || pos.x > b.x2 + r || pos.z < b.z1 - r || pos.z > b.z2 + r) continue;
        const nx = Util.clamp(pos.x, b.x1, b.x2), nz = Util.clamp(pos.z, b.z1, b.z2);
        const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
        else {
          const l = pos.x - b.x1, rr = b.x2 - pos.x, t = pos.z - b.z1, bb = b.z2 - pos.z;
          const m = Math.min(l, rr, t, bb);
          if (m === l) pos.x = b.x1 - r; else if (m === rr) pos.x = b.x2 + r; else if (m === t) pos.z = b.z1 - r; else pos.z = b.z2 + r;
        }
      }
      for (const c of circles) {
        const dx = pos.x - c.x, dz = pos.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = c.x + dx / d * rr; pos.z = c.z + dz / d * rr; }
      }
      treesNear(pos.x, pos.z, (i, t) => {
        if (t.state === 2) return;
        const tr = 0.3 * t.s + r;
        const dx = pos.x - t.x, dz = pos.z - t.z, d2 = dx * dx + dz * dz;
        if (d2 < tr * tr && d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = t.x + dx / d * tr; pos.z = t.z + dz / d * tr; }
      });
    }
  };
  return W;
})();

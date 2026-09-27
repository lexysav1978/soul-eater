'use strict';
// Салон самолёта: строится далеко от основного мира.
const Plane = (() => {
  const PX = -1000, PZ = 0, L = 24, R = 1.9, CY = 1.2;
  const ROWS = 18, ROW0 = -9, PITCH = 1.05;
  const SEAT_X = [-1.25, -0.72, 0.72, 1.25];

  function build(scene) {
    const P = Models.P;
    const g = new THREE.Group(); g.position.set(PX, 0, PZ); scene.add(g);
    const blockers = [];

    // ---------- корпус ----------
    const shellTex = Util.canvasTex(128, (c, s) => {
      Util.noise(c, s, [214, 210, 202], 8);
      c.strokeStyle = 'rgba(120,115,105,.35)'; c.lineWidth = 2;
      for (let y = 0; y < s; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke(); }
    }, 6, 8);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 28, 1, true), P(0xffffff, { map: shellTex, side: THREE.BackSide }));
    shell.rotation.x = Math.PI / 2; shell.position.y = CY; g.add(shell); blockers.push(shell);
    const carpet = Util.canvasTex(64, (c, s) => {
      Util.noise(c, s, [52, 62, 88], 14);
      c.fillStyle = 'rgba(160,40,40,.25)';
      for (let i = 0; i < 6; i++) c.fillRect(i * 11, 0, 3, s);
    }, 3, 24);
    const fw = 2 * Math.sqrt(R * R - CY * CY);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, L), P(0xffffff, { map: carpet, shininess: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; g.add(floor);
    const capM = P(0xd0ccc4, { side: THREE.DoubleSide });
    const front = new THREE.Mesh(new THREE.CircleGeometry(R, 28), capM); front.position.set(0, CY, -L / 2); g.add(front); blockers.push(front);
    const back = new THREE.Mesh(new THREE.CircleGeometry(R, 28), capM); back.position.set(0, CY, L / 2); back.rotation.y = Math.PI; g.add(back); blockers.push(back);

    // потолок, полки, лампы
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(1.5, L), P(0xe8e6e0));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 2.42; g.add(ceil);
    const binM = P(0xdedad2, { shininess: 30 });
    [-1, 1].forEach(sd => {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, L - 2), binM);
      bin.position.set(sd * 1.28, 2.08, 0); g.add(bin);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, L - 2), P(0x9a968e));
      lip.position.set(sd * 0.93, 1.86, 0); g.add(lip);
    });
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2d8 });
    [-0.72, 0.72].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, L - 2), lampM); l.position.set(x, 2.4, 0); g.add(l); });

    // двери
    const doorM = P(0x8a8a90, { shininess: 40 });
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.95, 0.06), doorM); cockpit.position.set(0, 0.98, -L / 2 + 0.04); g.add(cockpit);
    const wc = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.95, 0.06), doorM); wc.position.set(0, 0.98, L / 2 - 0.04); g.add(wc);
    const sign = (text, color, bg) => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 48;
      const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 128, 48);
      x.fillStyle = color; x.font = 'bold 26px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 25);
      return new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    };
    const s1 = sign('ЭКИПАЖ', '#fff', '#222'); s1.position.set(0, 2.15, -L / 2 + 0.08); g.add(s1);
    const s2 = sign('WC', '#fff', '#224'); s2.position.set(0, 2.15, L / 2 - 0.08); s2.rotation.y = Math.PI; g.add(s2);
    const ex1 = sign('ВЫХОД', '#fff', '#1a7a2a'); ex1.position.set(1.2, 2.05, -L / 2 + 0.08); g.add(ex1);

    // ---------- кресла ----------
    const n = ROWS * SEAT_X.length;
    const fabricTex = Util.canvasTex(32, (c, s) => { Util.noise(c, s, [44, 58, 104], 26); c.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < s; y += 6) c.fillRect(0, y, s, 2); }, 2, 2);
    const fabric = P(0xffffff, { map: fabricTex });
    const baseIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), fabric, n);
    const backIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.8, 0.12), fabric, n);
    const headIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.18, 0.02), P(0xeeeeea), n);
    const legIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.42, 0.4), P(0x555558), n);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < ROWS; r++) {
      const z = ROW0 + r * PITCH;
      for (const x of SEAT_X) {
        m.makeTranslation(x, 0.45, z); baseIM.setMatrixAt(k, m);
        m.makeRotationX(-0.12); m.setPosition(x, 0.92, z + 0.25); backIM.setMatrixAt(k, m);
        m.makeRotationX(-0.12); m.setPosition(x, 1.2, z + 0.18); headIM.setMatrixAt(k, m);
        m.makeTranslation(x, 0.21, z); legIM.setMatrixAt(k, m);
        k++;
      }
    }
    [baseIM, backIM, headIM, legIM].forEach(im => { im.frustumCulled = false; g.add(im); });

    // ---------- иллюминаторы ----------
    const sky = document.createElement('canvas'); sky.width = 128; sky.height = 192;
    const skyTex = new THREE.CanvasTexture(sky);
    const frameTex = (() => {
      const c = document.createElement('canvas'); c.width = 80; c.height = 108;
      const x = c.getContext('2d');
      x.fillStyle = '#c8c4bc'; x.beginPath(); x.roundRect(0, 0, 80, 108, 30); x.fill();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.roundRect(14, 14, 52, 80, 22); x.fill();
      return new THREE.CanvasTexture(c);
    })();
    const winM = new THREE.MeshBasicMaterial({ map: skyTex });
    const frameM = new THREE.MeshPhongMaterial({ map: frameTex, transparent: true });
    const wx = Math.sqrt(R * R - 0.0025) - 0.05;
    const windows = [];
    for (let r = 0; r < ROWS; r++) {
      const z = ROW0 + r * PITCH - 0.05;
      [-1, 1].forEach(sd => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.4), winM);
        w.position.set(sd * wx, 1.15, z); w.rotation.y = -sd * Math.PI / 2; g.add(w);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.54), frameM);
        f.position.set(sd * (wx - 0.01), 1.15, z); f.rotation.y = -sd * Math.PI / 2; g.add(f);
        windows.push({ x: sd * wx, z });
      });
    }
    const clouds = [];
    for (let i = 0; i < 26; i++) clouds.push({ x: Math.random() * 180 - 20, y: 20 + Math.random() * 170, r: 8 + Math.random() * 20, s: 12 + Math.random() * 30 });
    function drawSky(dt, progress, dark) {
      const c = sky.getContext('2d'), w = sky.width, h = sky.height, hz = h * 0.5;
      let gr = c.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#2f6cb4'); gr.addColorStop(1, '#bcd8ee');
      c.fillStyle = gr; c.fillRect(0, 0, w, hz);
      gr = c.createLinearGradient(0, hz, 0, h);
      gr.addColorStop(0, '#6a8ea8'); gr.addColorStop(0.2, '#2a5a80'); gr.addColorStop(1, '#16304a');
      c.fillStyle = gr; c.fillRect(0, hz, w, h - hz);
      if (progress > 0.7) {
        const k = Math.min(1, (progress - 0.7) / 0.3);
        const ix = w * 0.55, iy = hz + 18 + k * 30, iw = 12 + k * 60, ih = 4 + k * 16;
        c.fillStyle = '#2a4a2a'; c.beginPath(); c.ellipse(ix, iy, iw, ih, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(200,210,220,.5)'; c.beginPath(); c.ellipse(ix, iy - ih * 0.4, iw * 0.8, ih * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ddd'; c.fillRect(ix + iw * 0.4, iy - ih - 10 * k, 2 + k * 2, 8 + k * 10);
      }
      for (const cl of clouds) {
        cl.x -= cl.s * dt;
        if (cl.x < -40) { cl.x = w + 40; cl.y = 20 + Math.random() * 170; }
        c.fillStyle = cl.y > hz ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.9)';
        c.beginPath(); c.ellipse(cl.x, cl.y, cl.r * 1.6, cl.r * 0.55, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(cl.x + cl.r * 0.5, cl.y - cl.r * 0.3, cl.r * 0.9, cl.r * 0.5, 0, 0, Math.PI * 2); c.fill();
      }
      if (dark > 0) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, w, h); }
      skyTex.needsUpdate = true;
    }

    // ---------- пассажиры (без лиц) ----------
    const passengers = [];
    const seated = (model, x, z) => {
      const hip = 0.9 * model.scale.y;
      model.position.set(x, 0.5 - hip, z + 0.08);
      model.rotation.y = Math.PI;
      model.userData.legL.rotation.x = model.userData.legR.rotation.x = -Math.PI / 2;
      model.userData.armL.rotation.x = model.userData.armR.rotation.x = -0.5;
      g.add(model);
      return model;
    };
    const colors = [0x3a2a2a, 0x2a3a2a, 0x4a4a52, 0x5a4030, 0x202028, 0x6a5a4a];
    [[1.25, 3], [0.72, 5], [-0.72, 7], [1.25, 10], [-1.25, 12], [0.72, 14], [-0.72, 2], [1.25, 16]].forEach(([x, r], i) => {
      const pm = Models.P(colors[i % colors.length]);
      const model = seated(Models.passenger(pm), x, ROW0 + r * PITCH);
      passengers.push(model);
    });

    // Миша сидит рядом (у прохода), игрок — у окна
    const playerRow = 9;
    const seatZ = ROW0 + playerRow * PITCH;
    const boy = Models.boy();
    seated(boy, SEAT_X[1], seatZ);

    return {
      PX, PZ, L, g, blockers, windows, passengers, boy, drawSky, lampM,
      seat: { x: PX + SEAT_X[0], z: PZ + seatZ },
      aisleSeat: { x: PX, z: PZ + seatZ },
      window: { x: PX - wx, z: PZ + seatZ - 0.05 },
      toLocal: (x, z) => ({ x: x - PX, z: z - PZ })
    };
  }
  return { build };
})();

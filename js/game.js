'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if (typeof THREE === 'undefined') { $('loadErr').classList.remove('hidden'); $('btnNew').disabled = true; return; }

  const V3 = THREE.Vector3;
  const clamp = Util.clamp;
  const CYCLE = 240, NIGHT_START = 150, WIN_NIGHTS = 99, SAVE_KEY = 'soul_eater_save_v1';
  const RES = { палка: { icon: '🥢', name: 'Палки' }, камень: { icon: '🪨', name: 'Камни' }, бревно: { icon: '🪵', name: 'Брёвна' } };
  const SHOVEL_SVG = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 2v11" stroke="#b08a5a" stroke-width="2"/><path d="M9 2h6" stroke="#b08a5a" stroke-width="2"/><path d="M8 13h8l-1 7-3 2-3-2z" fill="#9a7a50"/></svg>';

  // ---------- рендер ----------
  const canvas = $('c');
  // Телефон или планшет?
  const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x4a5058, 0.012);
  scene.background = new THREE.Color(0x4a5058);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 420);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });

  const hemi = new THREE.HemisphereLight(0x9aa4b0, 0x1a1510, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xbfc6d0, 0.5); sun.position.set(60, 100, 30); scene.add(sun);
  const flash = new THREE.SpotLight(0xfff4dd, 0, 70, 0.58, 0.4, 0.7); scene.add(flash, flash.target);
  // мягкая подсветка вокруг игрока, пока включён фонарь
  const flashFill = new THREE.PointLight(0xffe8c8, 0, 11, 1.2); scene.add(flashFill);
  const monsterLight = new THREE.PointLight(0xff2200, 0, 9, 1.5); scene.add(monsterLight);
  const firePool = [0, 1].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 20, 1.3); scene.add(l); return l; });

  const W = World.build(scene);
  const POI = W.POI;

  // ---------- профиль и скины ----------
  const PROFILE_KEY = 'soul_eater_profile_v1';
  const RARITY = {
    common: { name: 'Обычный', cls: 'r-common' }, rare: { name: 'Редкий', cls: 'r-rare' },
    epic: { name: 'Эпический', cls: 'r-epic' }, legend: { name: 'Легендарный', cls: 'r-legend' }
  };
  const SKINS = [
    { id: 'traveler', name: 'Путник', rarity: 'common', desc: 'Заблудился в тумане и вышел к деревне.' },
    { id: 'forester', name: 'Лесник', rarity: 'common', desc: 'Знает каждую ёлку в этом лесу. Почти каждую.' },
    { id: 'girl', name: 'Девочка в плаще', rarity: 'common', desc: 'Жёлтый плащ видно даже в темноте.' },
    { id: 'hunter', name: 'Охотник за призраками', rarity: 'rare', desc: 'Пришёл ловить призраков. Призраки пришли за ним.', stat: 'nights', need: 3, req: 'Пережить 3 ночи' },
    { id: 'miner', name: 'Шахтёр', rarity: 'rare', desc: 'Каска с фонарём. В шахте — как дома.', stat: 'soul', need: 1, req: 'Добыть Камень души' },
    { id: 'priest', name: 'Священник', rarity: 'rare', desc: 'Церковь давно пуста. Но он всё ещё молится.', stat: 'quests', need: 10, req: 'Выполнить 10 заданий' },
    { id: 'plague', name: 'Чумной доктор', rarity: 'epic', desc: 'Маска с клювом. Что под ней — лучше не знать.', stat: 'nights', need: 10, req: 'Пережить 10 ночей' },
    { id: 'skeleton', name: 'Скелет', rarity: 'epic', desc: 'Слишком много раз падал в обморок.', stat: 'faints', need: 5, req: 'Упасть в обморок 5 раз' },
    { id: 'pale', name: 'Бледная', rarity: 'epic', desc: 'Теперь ты — та, кто выглядывает из-за угла.', stat: 'screams', need: 20, req: 'Пережить 20 скримеров' },
    { id: 'misha', name: 'Миша', rarity: 'legend', desc: 'Мальчик, которого ты спасал. Теперь он спасает себя сам.', stat: 'saves', need: 3, req: 'Вернуть Мишу Камнем души 3 раза' },
    { id: 'pumpkin', name: 'Тыквоголовый', rarity: 'legend', desc: 'Тридцать ночей без сна сделали своё дело.', stat: 'nights', need: 30, req: 'Пережить 30 ночей' },
    { id: 'angel', name: 'Ангел', rarity: 'legend', desc: 'Вернул свою душу из рая. Нимб остался.', stat: 'wins2', need: 1, req: 'Пройти вторую часть' },
    { id: 'eater', name: 'Пожиратель душ', rarity: 'legend', desc: 'Он забрал твою душу. Теперь его облик — твой.', stat: 'wins', need: 1, req: 'Пройти игру до конца' }
  ];
  function loadProfile() {
    const def = { skin: 'traveler', stats: { nights: 0, quests: 0, soul: 0, faints: 0, screams: 0, saves: 0, wins: 0, wins2: 0 }, seen: [] };
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (p) return { skin: p.skin || def.skin, stats: Object.assign(def.stats, p.stats), seen: p.seen || [] };
    } catch (e) { /* ignore */ }
    return def;
  }
  const profile = loadProfile();
  function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ } }
  function isUnlocked(sk) { return !sk.stat || profile.stats[sk.stat] >= sk.need; }
  function skinById(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
  if (!isUnlocked(skinById(profile.skin))) profile.skin = 'traveler';
  // Увеличиваем статистику и сообщаем об открытых скинах
  function addStat(k, n = 1) {
    const before = SKINS.filter(isUnlocked).map(s => s.id);
    profile.stats[k] += n;
    SKINS.forEach(s => {
      if (isUnlocked(s) && !before.includes(s.id)) {
        setTimeout(() => { msg(`🔓 Открыт новый скин: «${s.name}»!`, 7); Sound.chime(); }, 1200);
      }
    });
    saveProfile();
  }

  // Луна и звёзды
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd8dce8, fog: false, transparent: true }));
  scene.add(moon);
  const moonGlow = Util.glowSprite(0xa0b0d0, 60, 0.4); moonGlow.material.fog = false; scene.add(moonGlow);
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15, r = 330;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
  scene.add(stars);

  // ---------- персонажи ----------
  const player = {
    pos: new V3(0, 0, 14), model: Models.player(), facing: Math.PI, phase: 0, walkAmt: 0,
    stamina: 100, tired: false, actT: 0, swingT: 0, stepAcc: 0, vy: 0, grounded: true, jumpReq: false
  };
  scene.add(player.model);
  let camYaw = 0, camPitch = -0.12;

  const boy = Models.boy(); scene.add(boy);
  const mark = Util.textSprite('!', '#e04040', 0.9); scene.add(mark);
  const monster = Models.monster(); monster.visible = false; scene.add(monster);
  const MON = { pos: new V3(), target: new V3(), state: 'wander', t: 0, stalkT: 25, appearT: 45, growlT: 4, grow: 1, phase: 0, twitch: 0 };
  let boyRevertT = 0;

  // ---------- состояние ----------
  function newState() {
    return {
      day: 1, time: 14, nightFlag: false,
      inv: { палка: 0, камень: 0, бревно: 0 },
      tools: { axe: false, pickaxe: false, shovel: false, soul: false },
      mineOpen: false, dig: 0, fear: 0, inMine: false, boyState: 'boy',
      introDone: false, quest: null, crystalHits: 0, flashlight: true, held: null, inHouse: false, sleeping: false, homeVisited: false, onIsland: false, inCave: false, islandStage: 0, islandT: 0, giantSeen: false
    };
  }
  let S = newState();
  let state = 'title';     // title | play | paused | craft | jump | ending
  let dialog = null;
  let locked = false;
  const fires = [];
  let questItemObj = null;
  let current = null;       // текущее доступное действие
  let saveT = 0, hudT = 0, mapT = 0, flashT = 0, redT = 0;

  // ---------- задания ----------
  const ITEMS = [
    { name: 'Тряпичная кукла', acc: 'свою тряпичную куклу', icon: '🪆' },
    { name: 'Свеча', acc: 'мамину свечу', icon: '🕯️' },
    { name: 'Ржавый ключ', acc: 'ключ от подвала', icon: '🗝️' },
    { name: 'Старая фотография', acc: 'фотографию мамы', icon: '🖼️' },
    { name: 'Плюшевый заяц', acc: 'своего плюшевого зайца', icon: '🐇' },
    { name: 'Музыкальная шкатулка', acc: 'музыкальную шкатулку', icon: '🎶' }
  ];
  const SPOTS = [
    { x: -24, z: 4, zone: 'в деревне, у церкви' }, { x: 14, z: -26, zone: 'в деревне' }, { x: 38, z: 4, zone: 'на краю деревни' },
    { x: -4, z: 42, zone: 'на краю деревни' }, { x: -40, z: -22, zone: 'за церковью' },
    { x: 100, z: -104, zone: 'на кладбище' }, { x: 118, z: -74, zone: 'на кладбище' }, { x: 131, z: -107, zone: 'на кладбище' },
    { x: -95, z: -115, zone: 'у старого дуба' }, { x: 77, z: 62, zone: 'на поле с пугалом' }, { x: 60, z: 81, zone: 'на поле с пугалом' },
    { x: -123, z: 91, zone: 'у входа в шахту' }
  ];
  W.PATHS.forEach(([ax, az, bx, bz]) => {
    const t = 0.55, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const len = Math.hypot(bx - ax, bz - az);
    SPOTS.push({ x: x + (bz - az) / len * 2.6, z: z - (bx - ax) / len * 2.6, zone: 'в лесу у тропы' });
  });
  const PLACES = [
    { name: 'Церковь', x: POI.churchDoor.x, z: POI.churchDoor.z, text: 'Сходи к старой церкви. Постучи в дверь. Три раза.', ev: 'Ты постучал. Из-за двери кто-то постучал в ответ... три раза.' },
    { name: 'Склеп', x: POI.cryptDoor.x, z: POI.cryptDoor.z, text: 'Сходи к склепу на кладбище (северо-восток). Посмотри, закрыт ли он.', ev: 'Дверь склепа приоткрыта. Изнутри тянет холодом и кто-то дышит.' },
    { name: 'Старый дуб', x: POI.oak.x + 3.5, z: POI.oak.z + 3, text: 'Сходи к старому дубу с качелями (северо-запад). Это было моё место.', ev: 'Качели медленно раскачиваются. Ветра нет.' },
    { name: 'Пугало', x: POI.field.x, z: POI.field.z + 3, text: 'Сходи на поле к пугалу (юго-восток). Проверь, стоит ли оно на месте.', ev: 'Пугало на месте. Но секунду назад оно смотрело в другую сторону.' },
    { name: 'Шахта', x: POI.mine.x, z: POI.mine.z - 3, text: 'Сходи к старой шахте (юго-запад). Послушай, что там внутри.', ev: 'Из-под земли доносится тихое детское пение.' }
  ];

  function plural(n, a, b, c) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }

  function makeQuest(day) {
    const r = Util.rng(day * 7919 + 13);
    const pick = arr => arr[Math.floor(r() * arr.length)];
    if (day === 1) return { kind: 'bring', res: 'палка', n: 3, text: 'Принеси мне 3 палки. Обломай ветки с ёлок в лесу.' };
    const fetch = (idx) => {
      const it = idx != null ? idx : Math.floor(r() * ITEMS.length);
      const sp = pick(SPOTS);
      return { kind: 'fetch', item: it, x: sp.x, z: sp.z, picked: false, text: `Я потерял ${ITEMS[it].acc}. Она где-то ${sp.zone}. Найди и принеси мне.` };
    };
    if (day === 2) return fetch(0);
    const kinds = ['fetch', 'fetch', 'visit', 'visit', 'bring', 'cross'];
    if (S.tools.axe) kinds.push('fire', 'logs');
    const k = pick(kinds);
    if (k === 'fetch') return fetch();
    if (k === 'visit') { const p = Math.floor(r() * PLACES.length); return { kind: 'visit', place: p, text: PLACES[p].text }; }
    if (k === 'cross') return { kind: 'cross', text: 'Почини крест на маминой могиле. Кладбище на северо-востоке. Нужно 2 палки.' };
    if (k === 'fire') return { kind: 'fire', text: 'Разожги костёр у моего дома. Когда горит огонь, он боится выходить.' };
    if (k === 'logs') { const n = 3 + Math.floor(r() * 2); return { kind: 'bring', res: 'бревно', n, text: `Принеси ${n} бревна. Дома совсем холодно.` }; }
    if (r() < 0.5) { const n = 2 + Math.floor(r() * 2); return { kind: 'bring', res: 'камень', n, text: `Принеси ${n} ${plural(n, 'камень', 'камня', 'камней')}. Я выложу ими круг вокруг дома.` }; }
    const n = 4 + Math.floor(r() * 3);
    return { kind: 'bring', res: 'палка', n, text: `Принеси ${n} ${plural(n, 'палку', 'палки', 'палок')}. Я строю шалаш, чтобы прятаться.` };
  }

  function spawnQuestItem() {
    if (questItemObj) { scene.remove(questItemObj); questItemObj = null; }
    const q = S.quest;
    if (q && q.kind === 'fetch' && !q.picked && !q.done) {
      questItemObj = Models.questItem(q.item);
      questItemObj.position.set(q.x, 0, q.z);
      scene.add(questItemObj);
    }
  }

  function setupQuestWorld() {
    W.setCrossBroken(!!(S.quest && S.quest.kind === 'cross' && !S.quest.done));
    spawnQuestItem();
  }

  function completeQuest(silent) {
    addStat('quests');
    S.quest.done = true;
    Sound.chime();
    if (!silent) msg('Задание выполнено. Этой ночью мальчик будет спать спокойно.');
    save();
  }

  // ---------- диалоги ----------
  const GREET = ['Ты пришёл... Хорошо.', 'Я не спал всю ночь. Кто-то ходил вокруг дома.', 'Мне снилось, что я большой. Очень большой. И голодный.', 'Не смотри на меня так. Сегодня я — это я.', 'Мама говорила, что по ночам нельзя смотреть в окно.'];
  const NAG = ['Ты ещё не сделал то, о чём я просил.', 'Солнце не будет ждать.', 'Пожалуйста... поторопись. Я чувствую его внутри.', 'Он шевелится. Он знает, что ты не успеваешь.'];
  const THANKS = ['Спасибо. Сегодня ночью я буду спать.', 'Ты хороший. Он тебя не любит. А я — люблю.', 'Теперь он уснёт вместе со мной.'];
  const pickR = arr => arr[Math.floor(Math.random() * arr.length)];

  function say(lines, who, done) {
    dialog = { lines, i: 0, who: who || 'Мальчик', done };
    renderDialog();
  }
  function renderDialog() {
    const d = $('dialog');
    d.style.display = 'block';
    d.querySelector('.who').textContent = dialog.who;
    d.querySelector('.txt').textContent = dialog.lines[dialog.i];
  }
  function advanceDialog() {
    Sound.click();
    dialog.i++;
    if (dialog.i >= dialog.lines.length) {
      const cb = dialog.done; dialog = null; $('dialog').style.display = 'none';
      if (cb) cb();
    } else renderDialog();
  }

  function talkBoy() {
    const q = S.quest;
    if (!S.introDone) {
      say([
        'Ты... ты тоже здесь заблудился?',
        'Меня зовут Миша. Я живу вон в том доме, за колодцем.',
        'Все отсюда ушли. Остались только я... и он.',
        'Внутри меня живёт Пожиратель душ. Днём он спит.',
        'Но если ты не поможешь мне до темноты — он проснётся. И я стану... другим.',
        'В старой шахте на юго-западе есть камень. Он помнит, кем я был. Покажи его мне, если я изменюсь.',
        'Только вход засыпан землёй. Тебе понадобятся инструменты.',
        q.text
      ], 'Мальчик', () => { S.introDone = true; save(); });
      return;
    }
    if (q.kind === 'flight' && !q.done) {
      say(['Ты продержался пять ночей... Со мной никто столько не выдерживал.', 'Я хочу улететь. На другой остров. На Туманный остров.', 'Там мама. Я знаю, она там. Она зажигала маяк.', 'Самолёт уже ждёт. Полетели со мной?'], 'Миша', () => startFlight());
      return;
    }
    if (q.done) { say([pickR(THANKS), 'Иди. Мне нужно поспать, пока светло.']); return; }
    if (q.kind === 'bring' && S.inv[q.res] >= q.n) {
      S.inv[q.res] -= q.n;
      say(['Ты принёс! Спасибо...', pickR(THANKS)], 'Мальчик', () => completeQuest());
      return;
    }
    if (q.kind === 'fetch' && q.picked) {
      say([`${ITEMS[q.item].name}! Ты нашёл её...`, 'Я думал, она потерялась навсегда. Как мама.', pickR(THANKS)], 'Мальчик', () => completeQuest());
      return;
    }
    if (!q.told) { q.told = true; say([pickR(GREET), q.text]); return; }
    say([pickR(NAG), q.text]);
  }

  // ---------- сообщения ----------
  function msg(text, dur = 4.5) {
    const box = $('msgs');
    const d = document.createElement('div'); d.textContent = text; box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.opacity = '0'; }, dur * 1000);
    setTimeout(() => { d.remove(); }, dur * 1000 + 1100);
  }
  function screenFlash(color, strength) { const f = $('flash'); f.style.background = color; flashT = strength; }
  function fadeTo(text, hold, cb) {
    const f = $('fade'); $('fadeText').textContent = text || '';
    f.style.transition = 'opacity .5s'; f.style.opacity = '1';
    setTimeout(() => { if (cb) cb(); setTimeout(() => { f.style.opacity = '0'; }, hold); }, 550);
  }

  // ---------- действия ----------
  function swing() { player.swingT = 0.35; }

  // ---------- инструменты в руках ----------
  const TOOLS = [
    { id: 'axe', key: '1', name: 'Топор', acc: 'топор', icon: '🪓' },
    { id: 'pickaxe', key: '2', name: 'Кирка', acc: 'кирку', icon: '⛏️' },
    { id: 'shovel', key: '3', name: 'Лопата', acc: 'лопату', icon: SHOVEL_SVG }
  ];
  const toolById = id => TOOLS.find(t => t.id === id);
  function selectTool(id, quiet) {
    if (id && !S.tools[id]) {
      if (!quiet) { msg(`У тебя ещё нет: ${toolById(id).name.toLowerCase()}. Сделай в крафте (C).`, 2.5); Sound.click(); }
      return;
    }
    if (id === S.held) id = null;
    S.held = id;
    Sound.click();
    if (!quiet) msg(id ? `В руках: ${toolById(id).name}` : 'Руки свободны', 1.5);
  }
  function cycleTool(dir) {
    const list = [null].concat(TOOLS.filter(t => S.tools[t.id]).map(t => t.id));
    if (list.length < 2) return;
    let i = list.indexOf(S.held); if (i < 0) i = 0;
    i = (i + dir + list.length) % list.length;
    S.held = list[i]; Sound.click();
  }
  // Подсказка: нужный инструмент есть, но не в руках
  const needHeld = id => `Возьми ${toolById(id).acc} в руки — клавиша [${toolById(id).key}]`;

  function actTree(i) {
    const t = W.trees[i];
    if (S.held === 'axe') {
      swing(); Sound.chop();
      t.hits++; W.shakeTree(i, 0.06); setTimeout(() => W.resetTree(i), 120);
      if (t.hits >= 3) {
        const extra = t.state === 0 ? 2 : 0;
        W.cutTree(i); Sound.treeFall();
        S.inv.бревно += 2; S.inv.палка += 1 + extra;
        msg(`+2 бревна, +${1 + extra} ${plural(1 + extra, 'палка', 'палки', 'палок')}`, 2.5);
      }
    } else if (t.state === 0) {
      swing(); Sound.snap(); W.stripTree(i);
      S.inv.палка += 2; msg('+2 палки', 2);
    }
  }

  function digMine() {
    swing(); Sound.dig();
    S.dig++;
    if (S.dig >= 5) {
      S.mineOpen = true; W.setMound(false);
      msg('Вход в шахту раскопан! Изнутри тянет холодом...');
      Sound.whisper(); save();
    }
  }
  function enterMine() {
    fadeTo('Ты спускаешься в шахту...', 600, () => {
      S.inMine = true;
      player.pos.set(W.mine.start.x + 1, 0, W.mine.start.z);
      camYaw = -Math.PI / 2; camPitch = -0.1;
      msg(S.tools.soul ? 'Шахта. Камень души уже у тебя.' : 'Где-то в глубине шахты светится Камень души.');
    });
  }
  function exitMine() {
    fadeTo('', 400, () => {
      S.inMine = false;
      player.pos.set(POI.mine.x, 0, POI.mine.z - 3);
      camYaw = 0; camPitch = -0.1;
    });
  }
  function hitCrystal() {
    swing(); Sound.mineHit();
    S.crystalHits++;
    screenFlash('#a040ff', 0.25);
    if (S.crystalHits >= 4) {
      S.tools.soul = true; W.setCrystal(false); addStat('soul');
      Sound.whisper(); Sound.chime();
      msg('Ты добыл КАМЕНЬ ДУШИ. Он тёплый и бьётся, как сердце.', 6);
      save();
    }
  }
  function fixCross() {
    S.inv.палка -= 2; swing(); Sound.chop();
    W.setCrossBroken(false);
    msg('Ты починил крест. На могиле лежат засохшие цветы...');
    completeQuest(true);
  }
  function pickQuestItem() {
    S.quest.picked = true;
    Sound.pick();
    if (questItemObj) { scene.remove(questItemObj); questItemObj = null; }
    msg(`Ты нашёл: ${ITEMS[S.quest.item].name}. Отнеси мальчику.`);
    save();
  }
  function showStone() {
    Sound.chime(); Sound.whisper();
    screenFlash('#ffffff', 1);
    S.boyState = 'sleep';
    boyRevertT = 9;
    addStat('saves');
    boy.position.copy(MON.pos);
    S.fear = Math.max(0, S.fear - 40);
    say(['...Где я?', 'Этот камень... Он тёплый. Я помню маму.', 'Спасибо. Я пойду домой. Этой ночью он больше не выйдет.'], 'Мальчик');
    save();
  }

  function act() {
    if (dialog) { advanceDialog(); return; }
    if (player.actT > 0 || !current || !current.fn) return;
    player.actT = 0.42;
    current.fn();
  }

  function findInteraction() {
    const p = player.pos;
    let best = null;
    const cand = (pri, d, label, fn) => { if (!best || pri < best.pri || (pri === best.pri && d < best.d)) best = { pri, d, label, fn }; };
    const dist = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (S.inMine) {
      const dl = dist(W.mine.ladder.x, W.mine.ladder.z);
      if (dl < 2.6) cand(1, dl, 'Подняться наверх', exitMine);
      if (!S.tools.soul) {
        const dc = dist(W.mine.crystalPos.x, W.mine.crystalPos.z);
        if (dc < 2.8) {
          if (S.held === 'pickaxe') cand(1, dc, `Добыть Камень души (${S.crystalHits}/4)`, hitCrystal);
          else cand(1, dc, S.tools.pickaxe ? needHeld('pickaxe') : 'Нужна кирка, чтобы добыть камень', null);
        }
      }
      return best;
    }
    if (S.inHouse) {
      const dd = dist(HM.door.x, HM.door.z);
      if (dd < 1.5) cand(1, dd, 'Выйти на улицу', exitHome);
      const db = dist(HM.bed.x + 0.6, HM.bed.z);
      if (db < 1.6) {
        if (S.time >= NIGHT_START) cand(1, db, 'Лечь спать до утра', goSleep);
        else cand(1, db, 'Ещё светло. Спать не хочется.', null);
      }
      const ds = dist(HM.stool.x, HM.stool.z);
      if (ds < 1.2) cand(2, ds, 'Старая табуретка. Шатается.', null);
      return best;
    }
    {
      const dh = dist(POI.homeDoor.x, POI.homeDoor.z);
      if (dh < 2.3) cand(1, dh, 'Войти в свой дом', enterHome);
    }
    if (boy.visible && S.boyState === 'boy') {
      const d = dist(boy.position.x, boy.position.z);
      if (d < 3) cand(0, d, 'Поговорить с мальчиком', talkBoy);
    }
    if (S.boyState === 'monster' && monster.visible) {
      const d = dist(MON.pos.x, MON.pos.z);
      if (S.tools.soul && d < 11) cand(0, d, 'Показать Камень души', showStone);
    }
    const q = S.quest;
    if (q && q.kind === 'fetch' && !q.picked && !q.done) {
      const d = dist(q.x, q.z);
      if (d < 2.3) cand(1, d, `Поднять: ${ITEMS[q.item].name}`, pickQuestItem);
    }
    if (q && q.kind === 'cross' && !q.done) {
      const d = dist(POI.momGrave.x, POI.momGrave.z + 0.5);
      if (d < 2.8) cand(1, d, S.inv.палка >= 2 ? 'Починить крест (2 палки)' : 'Нужно 2 палки, чтобы починить крест', S.inv.палка >= 2 ? fixCross : null);
    }
    {
      const d = dist(POI.mine.x, POI.mine.z);
      if (d < 4.2) {
        if (S.mineOpen) cand(1, d, 'Спуститься в шахту', enterMine);
        else if (S.held === 'shovel') cand(1, d, `Раскопать завал (${S.dig}/5)`, digMine);
        else if (S.tools.shovel) cand(1, d, needHeld('shovel'), null);
        else cand(1, d, 'Вход завален землёй — нужна лопата', null);
      }
    }
    W.stones.forEach((s, i) => {
      if (s.picked) return;
      const d = dist(s.x, s.z);
      if (d < 2) cand(2, d, 'Подобрать камень', () => { W.pickStone(i); S.inv.камень++; Sound.pick(); msg('+1 камень', 2); });
    });
    const t = W.nearestTree(p.x, p.z, 2.2);
    if (t) {
      const tr = W.trees[t.i];
      if (S.held === 'axe') cand(3, t.d, `Рубить дерево (${tr.hits}/3)`, () => actTree(t.i));
      else if (tr.state === 0) cand(3, t.d, 'Обломать ветки', () => actTree(t.i));
      else cand(3, t.d, S.tools.axe ? 'Чтобы срубить: ' + needHeld('axe').toLowerCase() : 'Веток больше нет. Чтобы срубить — нужен топор', null);
    }
    return best;
  }

  // ---------- крафт ----------
  const RECIPES = [
    { id: 'axe', name: 'Каменный топор', icon: '🪓', need: { палка: 2, камень: 1 }, tool: 'axe', desc: 'Рубить деревья' },
    { id: 'pickaxe', name: 'Деревянная кирка', icon: '⛏️', need: { бревно: 2, палка: 2 }, tool: 'pickaxe', desc: 'Добывать камень в шахте' },
    { id: 'shovel', name: 'Лопата', icon: SHOVEL_SVG, need: { бревно: 1, палка: 2 }, tool: 'shovel', desc: 'Раскопать вход в шахту' },
    { id: 'fire', name: 'Костёр', icon: '🔥', need: { бревно: 2, палка: 3 }, desc: 'Разжигается прямо перед тобой. Свет прогоняет страх.' }
  ];
  function canCraft(r) {
    if (r.tool && S.tools[r.tool]) return false;
    for (const k in r.need) if (S.inv[k] < r.need[k]) return false;
    return true;
  }
  function renderCraft() {
    const box = $('recipes'); box.innerHTML = '';
    RECIPES.forEach(r => {
      const el = document.createElement('div'); el.className = 'recipe';
      const need = Object.keys(r.need).map(k => `<span class="${S.inv[k] >= r.need[k] ? 'ok' : 'no'}">${RES[k].name}: ${S.inv[k]}/${r.need[k]}</span>`).join(' · ');
      const have = r.tool && S.tools[r.tool];
      el.innerHTML = `<div class="ic">${r.icon}</div><div class="info"><div class="nm">${r.name}</div><div class="ds">${r.desc}</div><div class="need">${have ? '<span class="ok">Уже есть</span>' : need}</div></div>`;
      const b = document.createElement('button');
      b.textContent = have ? '✔' : 'Создать';
      b.disabled = !canCraft(r);
      b.onclick = () => craft(r);
      el.appendChild(b); box.appendChild(el);
    });
  }
  function craft(r) {
    if (!canCraft(r)) return;
    for (const k in r.need) S.inv[k] -= r.need[k];
    Sound.craft();
    if (r.tool) { S.tools[r.tool] = true; msg(`Создано: ${r.name}. Теперь в руках (клавиша ${toolById(r.tool).key}).`); S.held = r.tool; }
    else { placeFire(); closeCraft(); }
    save();
    if (state === 'craft') renderCraft();
  }
  function openCraft() {
    if (dialog) return;
    state = 'craft';
    renderCraft();
    $('craft').classList.remove('hidden');
    document.exitPointerLock();
  }
  function closeCraft() {
    $('craft').classList.add('hidden');
    state = 'paused';
    requestLock();
  }

  function placeFire() {
    const fx = player.pos.x - Math.sin(camYaw) * 2, fz = player.pos.z - Math.cos(camYaw) * 2;
    if (fires.length >= 2) { const old = fires.shift(); scene.remove(old.obj); }
    const obj = Models.campfire(); obj.position.set(fx, 0, fz); scene.add(obj);
    fires.push({ obj, x: fx, z: fz, life: CYCLE });
    msg('Ты разжёг костёр. Рядом с огнём не так страшно.');
    const q = S.quest;
    if (q && q.kind === 'fire' && !q.done && Math.hypot(fx - POI.boyDoor.x, fz - (POI.boyDoor.z + 4)) < 16) completeQuest();
  }

  // ---------- сохранение ----------
  function save() {
    if (S.part2) { saveP2(); return; }
    if (state === 'title' || state === 'ending') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, S, p: [player.pos.x, player.pos.z], yaw: camYaw,
        trees: W.treeState(), stones: W.stoneState()
      }));
    } catch (e) { /* хранилище недоступно */ }
  }
  function readSave() {
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 1 ? d : null; } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  function resetWorld() {
    fires.forEach(f => scene.remove(f.obj)); fires.length = 0;
    W.setMound(!S.mineOpen);
    W.setCrystal(!S.tools.soul);
    setupQuestWorld();
    boyRevertT = 0;
    if (S.boyState === 'monster') {
      MON.pos.set(POI.boySpot.x + 30, 0, POI.boySpot.z + 30); MON.grow = 1; MON.state = 'wander'; MON.t = 0;
    }
  }

  function startGame(cont) {
    Sound.init(); goFullscreen();
    const d = cont ? readSave() : null;
    if (d) {
      S = Object.assign(newState(), d.S);
      S.inv = Object.assign(newState().inv, d.S.inv);
      S.tools = Object.assign(newState().tools, d.S.tools);
      player.pos.set(d.p[0], 0, d.p[1]); camYaw = d.yaw || 0;
      W.applyTreeState(d.trees); W.applyStoneState(d.stones);
    } else {
      clearSave();
      S = newState(); S.quest = makeQuest(1);
      player.pos.set(0, 0, 14); camYaw = 0;
      W.applyTreeState(null); W.applyStoneState(null);
    }
    if (!S.quest) S.quest = makeQuest(S.day);
    if (S.inPlane) { S.inPlane = false; player.pos.set(0, 0, 9); }
    if (S.boyState === 'monster' && S.time < NIGHT_START) S.boyState = 'boy';
    monster.visible = false;
    S.sleeping = false;
    resetWorld();
    CUT.on = false;
    ISL.rubble.visible = !!S.inCave; ISL.mishaCave.visible = !!S.inCave;
    ISL.misha.visible = !S.onIsland || S.islandStage < 2;
    if (S.onIsland && !S.inCave) ISL.misha.position.set(player.pos.x + 2, 0, player.pos.z + 1);
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    state = 'paused';
    requestLock();
    if (!d) {
      setTimeout(() => msg('Ты очнулся в заброшенной деревне. Уже вечереет... нет, это просто туман.', 6), 600);
      setTimeout(() => msg('У колодца стоит мальчик. Он смотрит прямо на тебя.', 6), 3500);
      setTimeout(() => msg('Твой дом отмечен на карте зелёным домиком. Там можно переждать ночь.', 7), 8000);
    } else msg(`С возвращением. День ${S.day}.`);
  }

  // ---------- день и ночь ----------
  function onNightfall() {
    if (!S.quest.done) {
      S.boyState = 'monster';
      MON.pos.set(boy.position.x, 0, boy.position.z);
      MON.grow = 0; MON.state = 'stare'; MON.t = 3.5; MON.stalkT = 20; MON.appearT = 50;
      Sound.transform();
      msg(`Ночь ${S.day}. Мальчик не дождался помощи...`, 6);
      setTimeout(() => msg('Он превращается в ЧУДОВИЩЕ.', 6), 1500);
      if (!S.tools.soul) setTimeout(() => msg('Продержись до рассвета — или найди Камень души.', 6), 4000);
      else setTimeout(() => msg('Найди его и покажи ему Камень души!', 6), 4000);
    } else {
      S.boyState = 'sleep';
      const ct = CREATURES[tonightType()];
      msg(`Ночь ${S.day}. Мальчик спит спокойно...`, 6);
      setTimeout(() => msg(`...но этой ночью в деревню пришли другие. ${ct.intro}`, 7), 2500);
      setTimeout(() => Sound.laugh(), 4500);
    }
    WT.spawnT = 12; scareT = 25 + Math.random() * 15;
    save();
  }
  function onDawn() {
    addStat('nights');
    if (S.day >= WIN_NIGHTS) { win(); return; }
    if (S.boyState === 'monster') msg('С первыми лучами чудовище съёжилось и снова стало мальчиком.', 6);
    S.day++;
    S.boyState = 'boy'; boyRevertT = 0;
    if (WT.mode && WT.mode !== 'glimpse') endWatcher();
    S.quest = makeQuest(S.day);
    if (S.day >= 6 && !S.flightDone) S.quest = { kind: 'flight', text: 'Миша хочет тебе что-то сказать. Подойди к нему у колодца.' };
    setupQuestWorld();
    Sound.dawn();
    setTimeout(() => msg(`Рассвет. День ${S.day}. Мальчик ждёт тебя у колодца.`, 6), 400);
    save();
  }
  function win() {
    state = 'ending';
    addStat('wins');
    clearSave();
    document.exitPointerLock();
    $('hud').classList.add('hidden');
    $('endText').innerHTML = `
      <p>Девяносто девять ночей Пожиратель душ пытался выбраться из Миши. Девяносто девять ночей ты не давал ему этого сделать.</p>
      <p>На рассвете сотого дня Камень души треснул, и из него вышел тёплый свет. Мальчик впервые улыбнулся.</p>
      <p>«Мама ждёт меня, — сказал он. — Спасибо, что не ушёл».</p>
      <p>Он шагнул в свет и исчез. В деревне стало тихо. По-настоящему тихо.</p>`;
    $('ending').classList.remove('hidden');
  }

  // ---------- лица для скримеров ----------
  const jumpCanvas = $('jump');
  jumpCanvas.width = 800; jumpCanvas.height = 600;
  function cracks(g, n, color) {
    g.strokeStyle = color; g.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      g.beginPath(); let x = 200 + Math.random() * 400, y = 40 + Math.random() * 250; g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 40; g.lineTo(x, y); }
      g.stroke();
    }
  }
  const FACES = [
    g => { // 0 — Пожиратель
      const gr = g.createRadialGradient(400, 280, 40, 400, 300, 300);
      gr.addColorStop(0, '#6a625a'); gr.addColorStop(0.6, '#2a2320'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.beginPath(); g.ellipse(400, 300, 230, 300, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      [[300, 230], [500, 230]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 65, 50, x < 400 ? 0.3 : -0.3, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#ff1a00'; g.shadowColor = '#f00'; g.shadowBlur = 30;
      [[305, 235], [495, 235]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); });
      g.shadowBlur = 0;
      g.fillStyle = '#050000'; g.beginPath(); g.ellipse(400, 440, 150, 110, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8d0c0';
      for (let i = 0; i < 12; i++) {
        const x = 270 + i * 22;
        g.beginPath(); g.moveTo(x, 360 + Math.abs(6 - i) * 4); g.lineTo(x + 20, 360 + Math.abs(6 - i) * 4); g.lineTo(x + 10, 420); g.fill();
        g.beginPath(); g.moveTo(x, 525 - Math.abs(6 - i) * 4); g.lineTo(x + 20, 525 - Math.abs(6 - i) * 4); g.lineTo(x + 10, 470); g.fill();
      }
      cracks(g, 14, 'rgba(0,0,0,.6)');
    },
    g => { // 1 — Бледная
      const gr = g.createRadialGradient(400, 300, 30, 400, 300, 280);
      gr.addColorStop(0, '#d8d4cc'); gr.addColorStop(0.7, '#8a8680'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.beginPath(); g.ellipse(400, 320, 190, 290, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      [[320, 250], [480, 250]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 48, 62, 0, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#fff'; [[322, 258], [478, 258]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(400, 470, 55, 120, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 6;
      for (let i = 0; i < 40; i++) {
        const x = 180 + Math.random() * 440;
        g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (Math.random() - 0.5) * 80, 200, x + (Math.random() - 0.5) * 120, 400, x + (Math.random() - 0.5) * 60, 600);
        if (Math.abs(x - 400) > 90 || Math.random() < 0.3) g.stroke();
      }
    },
    g => { // 2 — Безликий
      g.fillStyle = '#050505'; g.fillRect(0, 0, 800, 600);
      Util.drawMask(g, 400, 300, 270);
      cracks(g, 10, 'rgba(60,0,0,.7)');
      g.fillStyle = '#ff2a10'; g.shadowColor = '#f00'; g.shadowBlur = 25;
      [[314, 246], [486, 246]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); });
      g.shadowBlur = 0;
    },
    g => { // 3 — Кривой
      g.save(); g.translate(400, 300); g.rotate(1.1);
      const gr = g.createRadialGradient(0, 0, 30, 0, 0, 300);
      gr.addColorStop(0, '#7a766e'); gr.addColorStop(0.7, '#3a3632'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 210, 280, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(-80, -60, 45, 45, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(90, -50, 25, 25, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0, 130, 130, 60, 0.1, 0, Math.PI * 2); g.fill();
      g.restore();
      cracks(g, 20, 'rgba(0,0,0,.5)');
    },
    g => { // 4 — Тени
      g.fillStyle = '#000'; g.fillRect(0, 0, 800, 600);
      g.fillStyle = '#0c0c0c'; g.beginPath(); g.ellipse(400, 330, 230, 270, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 60;
      [[310, 260], [490, 260]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 42, 34, 0, 0, Math.PI * 2); g.fill(); });
      g.shadowBlur = 0;
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(230, 400); g.quadraticCurveTo(400, 560, 570, 400); g.quadraticCurveTo(400, 470, 230, 400); g.stroke();
      g.fillStyle = '#300'; [[300, 300], [500, 300]].forEach(([x, y]) => g.fillRect(x - 3, y, 6, 140 + Math.random() * 60));
    }
  ];
  const faceCanvases = FACES.map(draw => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 800, 600); draw(g);
    return c;
  });
  let jumpTimer = null;
  function jumpShow(face, ms) {
    const g = jumpCanvas.getContext('2d');
    g.drawImage(faceCanvases[face], 0, 0);
    jumpCanvas.classList.add('on');
    clearTimeout(jumpTimer);
    jumpTimer = setTimeout(() => jumpCanvas.classList.remove('on'), ms);
  }
  // Короткий скример без обморока
  function screamer(face, fearAdd = 22, ms = 550) {
    if (state !== 'play') return;
    jumpShow(face, ms);
    addStat('screams');
    Sound.scream(0.9);
    S.fear = Math.min(97, S.fear + fearAdd);
    redT = 0.6;
  }

  function faint() {
    state = 'jump';
    addStat('faints');
    endWatcher();
    jumpShow(S.boyState === 'monster' ? 0 : CREATURES[tonightType()].face, 950);
    Sound.scream(0.9);
    setTimeout(() => {
      const f = $('fade'); f.style.transition = 'none'; f.style.opacity = '1';
      $('fadeText').textContent = 'Ты потерял сознание от страха...';
      const lost = [];
      for (const k in S.inv) { const l = Math.ceil(S.inv[k] / 2); if (l > 0) { S.inv[k] -= l; lost.push(`${RES[k].name.toLowerCase()} ×${l}`); } }
      const q = S.quest;
      if (q.kind === 'fetch' && q.picked && !q.done) { q.picked = false; spawnQuestItem(); lost.push(ITEMS[q.item].name.toLowerCase()); }
      S.inMine = false; S.inHouse = false; S.sleeping = false; hideHouseScare();
      player.pos.set(0, 0, 9); camYaw = 0;
      S.fear = 20;
      if (S.boyState === 'monster') teleportMonsterFar();
      setTimeout(() => {
        f.style.transition = 'opacity 1.5s'; f.style.opacity = '0';
        state = locked ? 'play' : 'paused';
        if (!locked) $('pause').classList.remove('hidden');
        msg('Ты очнулся у колодца.', 5);
        if (lost.length) msg('Потеряно: ' + lost.join(', '), 6);
        save();
      }, 2600);
    }, 950);
  }

  // ---------- ночные существа ----------
  const TYPES = ['pale', 'mask', 'crooked', 'shadow'];
  const CREATURES = {
    pale: { name: 'Бледная', face: 1, intro: 'Бледная женщина с длинными волосами.', calls: ['Иди ко мне...', 'Здесь тепло...', 'Я знаю, где его мама...', 'Не оборачивайся. Просто иди.'] },
    mask: { name: 'Безликий', face: 2, intro: 'Кто-то в белой маске.', calls: ['Поиграем?', 'Сюда. Здесь весело.', 'Не бойся. Иди за мной.', 'Хочешь увидеть моё лицо?'] },
    crooked: { name: 'Кривой', face: 3, intro: 'Что-то с вывернутой шеей.', calls: ['Помоги мне... я упал...', 'Сюда... мне больно...', 'Подойди ближе... я не вижу тебя...', 'Мои кости... собери мои кости...'] },
    shadow: { name: 'Тени', face: 4, intro: 'Дети-тени с белыми глазами.', calls: ['Мы тут прячемся... иди к нам!', 'Ты водишь!', 'Раз, два, три... иди сюда...', 'Найди нас!'] }
  };
  function tonightType() { return TYPES[(S.day - 1) % TYPES.length]; }
  const watcherObjs = {};
  function getWatcher(type) {
    if (!watcherObjs[type]) {
      const w = Models.watcher(type); w.visible = false; scene.add(w); watcherObjs[type] = w;
      // слабое призрачное свечение, чтобы их было видно в темноте
      w.traverse(o => { if (o.isMesh && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.copy(o.material.color).multiplyScalar(0.45); } });
    }
    return watcherObjs[type];
  }
  const WT = { obj: null, type: null, mode: null, t: 0, x: 0, z: 0, hx: 0, hz: 0, lean: 0, hops: 0, stare: 0, slide: 0, spawnT: 12, next: null };
  let scareT = 40, glimpseT = 120, flickerT = 0, darkT = 0, subT = 0;
  const windowFace = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.75), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(faceCanvases[1]) }));
  windowFace.visible = false; scene.add(windowFace);
  let windowT = 0;

  function subtitle(text) { const s = $('subtitle'); s.textContent = `«${text}»`; s.style.opacity = '1'; subT = 4; }

  function camFwd() { return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }; }
  function lookDot(x, y, z) {
    const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const dir = new V3(); camera.getWorldDirection(dir);
    return (dir.x * dx + dir.y * dy + dir.z * dz) / d;
  }

  // Ищем укрытие (угол дома или дерево), из-за которого можно выглянуть
  function findCover(minD, maxD, needView, tx, tz) {
    const px = player.pos.x, pz = player.pos.z, f = camFwd();
    const list = [];
    const ok = (x, z) => {
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) return false;
      if (needView && ((x - px) * f.x + (z - pz) * f.z) / d < needView) return false;
      return true;
    };
    W.coverBoxes.forEach(b => { const x = (b.x1 + b.x2) / 2, z = (b.z1 + b.z2) / 2; if (ok(x, z)) list.push({ box: b, x, z }); });
    for (const t of W.trees) {
      if (t.state === 2 || t.edge || Math.abs(t.x - px) > maxD || Math.abs(t.z - pz) > maxD) continue;
      if (ok(t.x, t.z)) list.push({ tree: t, x: t.x, z: t.z });
    }
    if (!list.length) return null;
    if (tx != null) { list.sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz)); return list[Math.floor(Math.random() * Math.min(3, list.length))]; }
    return list[Math.floor(Math.random() * list.length)];
  }

  // Положение «выглядывания» из-за укрытия
  function peekSpot(c) {
    const px = player.pos.x, pz = player.pos.z;
    let dx = c.x - px, dz = c.z - pz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const perpX = -dz, perpZ = dx;
    let side = Math.random() < 0.5 ? -1 : 1, x, z, hx, hz;
    if (c.open) {
      x = c.x; z = c.z; hx = c.x + dx * 0.01; hz = c.z + dz * 0.01;
    } else if (c.tree) {
      const r = 0.35 * c.tree.s;
      x = c.x + dx * (r + 0.45) + perpX * side * (r + 0.15); z = c.z + dz * (r + 0.45) + perpZ * side * (r + 0.15);
      hx = c.x + dx * (r + 0.5); hz = c.z + dz * (r + 0.5);
    } else {
      const b = c.box;
      const corners = [[b.x1, b.z1], [b.x2, b.z1], [b.x1, b.z2], [b.x2, b.z2]];
      let best = null, bv = -Infinity;
      corners.forEach(([cx, cz]) => { const v = ((cx - c.x) * perpX + (cz - c.z) * perpZ) * side; if (v > bv) { bv = v; best = [cx, cz]; } });
      x = best[0] + dx * 0.7 + perpX * side * 0.1; z = best[1] + dz * 0.7 + perpZ * side * 0.1;
      hx = x - perpX * side * 1.2; hz = z - perpZ * side * 1.2;
    }
    return { x, z, hx, hz, side, perpX, perpZ };
  }

  function showWatcher(type, x, z, mode, t) {
    if (WT.obj && WT.obj !== getWatcher(type)) WT.obj.visible = false;
    WT.obj = getWatcher(type); WT.type = type; WT.mode = mode; WT.t = t;
    WT.x = x; WT.z = z; WT.stare = 0; WT.lean = 0;
    WT.obj.visible = true;
    WT.obj.position.set(x, 0, z);
    WT.obj.rotation.set(WT.obj.userData.hunch || 0, Math.atan2(player.pos.x - x, player.pos.z - z), 0);
  }
  function endWatcher() {
    if (WT.obj) WT.obj.visible = false;
    WT.mode = null; WT.next = null;
    WT.spawnT = 8 + Math.random() * 10;
  }

  function startPeek(type, cover) {
    const sp = peekSpot(cover);
    showWatcher(type, sp.hx, sp.hz, 'peek', 11 + Math.random() * 4);
    WT.px = sp.x; WT.pz = sp.z; WT.hx = sp.hx; WT.hz = sp.hz; WT.slide = 0;
    // наклон наружу — в сторону, куда выглядывает
    const ry = Math.atan2(player.pos.x - sp.x, player.pos.z - sp.z);
    const lx = Math.cos(ry), lz = -Math.sin(ry);
    const s = Math.sign(sp.perpX * sp.side * lx + sp.perpZ * sp.side * lz) || 1;
    WT.lean = cover.open ? 0 : -s * 0.38;
    const d = Math.hypot(player.pos.x - sp.x, player.pos.z - sp.z);
    if (d < 45) {
      const line = CREATURES[type].calls[Math.floor(Math.random() * CREATURES[type].calls.length)];
      setTimeout(() => { if (WT.mode === 'peek') { Sound.voice(line); subtitle(line); } }, 700);
    }
  }

  function updateWatcher(dt, nightK) {
    const calmNight = S.boyState === 'sleep' && boyRevertT <= 0 && nightK > 0.7 && !S.inMine && !S.inHouse;
    // появление
    if (!WT.mode) {
      if (calmNight) {
        WT.spawnT -= dt;
        if (WT.spawnT <= 0) {
          const c = findCover(9, 24, 0.5) || findCover(9, 30, 0);
          WT.hops = 0;
          if (c) startPeek(tonightType(), c);
          else {
            // укрыться негде — просто стоит в темноте и манит
            const f = camFwd(), a = (Math.random() - 0.5) * 0.8;
            const fx = f.x * Math.cos(a) - f.z * Math.sin(a), fz = f.x * Math.sin(a) + f.z * Math.cos(a);
            const x = player.pos.x + fx * 17, z = player.pos.z + fz * 17;
            startPeek(tonightType(), { x, z, open: true });
          }
        }
      } else if (nightK < 0.3 && !S.inMine && !S.inHouse) {
        glimpseT -= dt;
        if (glimpseT <= 0) {
          glimpseT = 110 + Math.random() * 70;
          const c = findCover(38, 58, 0.7);
          if (c && c.tree) { const sp = peekSpot(c); showWatcher(TYPES[S.day % TYPES.length], sp.x, sp.z, 'glimpse', 150); }
        }
      }
      return;
    }
    const o = WT.obj, u = o.userData;
    const px = player.pos.x, pz = player.pos.z;
    const d = Math.hypot(px - o.position.x, pz - o.position.z);
    const headY = 1.8 * o.scale.y;
    const looking = lookDot(o.position.x, headY, o.position.z) > 0.93 && d < 50;
    WT.t -= dt;
    const tt = performance.now() / 1000;
    switch (WT.mode) {
      case 'peek': {
        WT.slide = Math.min(1, WT.slide + dt * 1.6);
        o.position.set(Util.lerp(WT.hx, WT.px, WT.slide), 0, Util.lerp(WT.hz, WT.pz, WT.slide));
        o.rotation.y = Util.lerpAngle(o.rotation.y, Math.atan2(px - o.position.x, pz - o.position.z), Math.min(1, dt * 3));
        o.rotation.z = WT.lean * WT.slide;
        // манит рукой
        u.armR.rotation.x = -1.5 + Math.sin(tt * 5) * 0.45;
        u.armR.rotation.z = 0.2;
        u.head.rotation.z = (u.type === 'crooked' ? 1.2 : 0) + Math.sin(tt * 1.3) * 0.15;
        if (looking) WT.stare += dt;
        if (d < 7) {
          if (WT.hops < 2) {
            // уводит дальше
            const ax = o.position.x - px, az = o.position.z - pz, al = Math.hypot(ax, az) || 1;
            WT.next = { tx: o.position.x + ax / al * 16, tz: o.position.z + az / al * 16 };
            WT.mode = 'hide'; WT.t = 0.5; Sound.laugh();
          } else { WT.mode = 'rush'; Sound.stinger(); }
        } else if (WT.stare > 3.2) {
          if (Math.random() < 0.35) { WT.mode = 'rush'; Sound.stinger(); }
          else { WT.mode = 'hide'; WT.t = 0.5; WT.next = null; }
        } else if (WT.t <= 0) { WT.mode = 'hide'; WT.t = 0.6; WT.next = null; }
        break;
      }
      case 'hide':
        WT.slide = Math.max(0, WT.slide - dt * 2.2);
        o.position.set(Util.lerp(WT.hx, WT.px, WT.slide), 0, Util.lerp(WT.hz, WT.pz, WT.slide));
        if (WT.slide <= 0) {
          o.visible = false;
          const nx = WT.next;
          if (nx && calmNight) {
            let c = findCover(9, 30, 0, nx.tx, nx.tz);
            if (!c || Math.hypot(c.x - nx.tx, c.z - nx.tz) > 14) c = { x: nx.tx, z: nx.tz, open: true };
            WT.mode = null; WT.next = null;
            WT.hops++; startPeek(WT.type, c);
          } else endWatcher();
        }
        break;
      case 'rush': {
        o.rotation.z = 0;
        const dx = px - o.position.x, dz = pz - o.position.z;
        o.position.x += dx / (d || 1) * 13 * dt; o.position.z += dz / (d || 1) * 13 * dt;
        o.rotation.y = Math.atan2(dx, dz);
        Models.walkAnim(o, tt * 18, 1.3, 1.2);
        u.armL.rotation.x = u.armR.rotation.x = -1.6;
        if (d < 1.8) { screamer(CREATURES[WT.type].face, 25); endWatcher(); }
        break;
      }
      case 'behind':
        o.rotation.y = Math.atan2(px - o.position.x, pz - o.position.z);
        if (lookDot(o.position.x, headY, o.position.z) > 0.55) { screamer(CREATURES[WT.type].face, 22, 500); endWatcher(); }
        else if (WT.t <= 0) { Sound.breath(); endWatcher(); }
        break;
      case 'glimpse':
        o.rotation.y = Math.atan2(px - o.position.x, pz - o.position.z);
        if (looking) WT.stare += dt;
        if (WT.stare > 0.2 || WT.t <= 0 || S.inHouse || S.inMine) { if (WT.stare > 0.2) Sound.whisper(); endWatcher(); glimpseT = 110 + Math.random() * 70; }
        break;
      case 'flicker':
        o.rotation.y = Math.atan2(px - o.position.x, pz - o.position.z);
        if (WT.t <= 0) { darkT = 0.5; S.fear = Math.min(97, S.fear + 14); Sound.stinger(); endWatcher(); }
        break;
    }
    if (o.visible && d < 20 && WT.mode !== 'glimpse') S.fear = Math.min(99, S.fear + (1 - d / 20) * 3 * dt);
  }

  // Случайные ночные пугалки
  function runScare(nightK) {
    if (S.inHouse) { runHouseScare(); return; }
    const px = player.pos.x, pz = player.pos.z, f = camFwd();
    const type = S.boyState === 'monster' ? TYPES[Math.floor(Math.random() * 4)] : tonightType();
    const face = S.boyState === 'monster' && Math.random() < 0.5 ? 0 : CREATURES[type].face;
    const opts = ['face', 'sound', 'flicker'];
    if (!S.inMine) opts.push('behind', 'behind', 'window');
    let ev = opts[Math.floor(Math.random() * opts.length)];
    if ((ev === 'behind' || ev === 'flicker') && WT.mode) ev = 'sound';
    if (ev === 'face') {
      flickerT = 0.8;
      setTimeout(() => screamer(face, 15, 380), 700);
    } else if (ev === 'sound') {
      const s = Math.floor(Math.random() * 4);
      if (s === 0) Sound.laugh(); else if (s === 1) Sound.knock(); else if (s === 2) Sound.stepsBehind(); else Sound.breath();
      if (Math.random() < 0.5) { const line = pickR(CREATURES[type].calls); setTimeout(() => { Sound.voice(line); subtitle(line); }, 900); }
    } else if (ev === 'behind') {
      Sound.stepsBehind();
      setTimeout(() => {
        if (state !== 'play' || WT.mode) return;
        showWatcher(type, player.pos.x + Math.sin(camYaw) * 6.8, player.pos.z + Math.cos(camYaw) * 6.8, 'behind', 7);
        Sound.breath();
      }, 2300);
    } else if (ev === 'flicker') {
      flickerT = 1.6;
      let dist = 5.5;
      if (S.inMine) {
        raycaster.set(new V3(px, 1.5, pz), new V3(f.x, 0, f.z)); raycaster.far = 6;
        const h = raycaster.intersectObjects(W.blockersMine, false); if (h.length) dist = Math.max(1.8, h[0].distance - 0.6);
      }
      setTimeout(() => {
        if (state !== 'play' || WT.mode) return;
        showWatcher(type, player.pos.x + f.x * dist, player.pos.z + f.z * dist, 'flicker', 0.9);
      }, 700);
    } else if (ev === 'window') {
      let best = null, bd = 32;
      W.HOUSES.forEach(h => { const d = Math.hypot(h.x - px, h.z - pz); if (d < bd) { bd = d; best = h; } });
      if (!best) { Sound.knock(); return; }
      const lx = (Math.random() < 0.5 ? -1 : 1) * (best.w / 4 + 0.3), ly = best.h * 0.6, lz = best.d / 2 + 0.14;
      const c = Math.cos(best.r), s = Math.sin(best.r);
      windowFace.position.set(best.x + lx * c + lz * s, ly, best.z - lx * s + lz * c);
      windowFace.rotation.y = best.r;
      windowFace.material.map.image = faceCanvases[face]; windowFace.material.map.needsUpdate = true;
      windowFace.visible = true; windowT = 2.2;
      Sound.knock();
      setTimeout(() => { if (windowFace.visible) { Sound.stinger(); S.fear = Math.min(97, S.fear + 10); } }, 900);
    }
  }

  function updateScares(dt, nightK) {
    updateWatcher(dt, nightK);
    if (subT > 0) { subT -= dt; if (subT <= 0) $('subtitle').style.opacity = '0'; }
    if (windowT > 0) {
      windowT -= dt;
      if (windowT <= 0) windowFace.visible = false;
      else if (lookDot(windowFace.position.x, windowFace.position.y, windowFace.position.z) > 0.97 && windowT < 1.8) { windowT = 0; windowFace.visible = false; screamer(0, 12, 350); }
    }
    flickerT = Math.max(0, flickerT - dt);
    darkT = Math.max(0, darkT - dt);
    if (nightK > 0.7 && !dialog && !S.sleeping) {
      scareT -= dt;
      if (scareT <= 0) {
        scareT = (32 + Math.random() * 35) * Math.max(0.45, 1 - S.day / 120);
        runScare(nightK);
      }
    }
  }

  // ---------- монстр ----------
  function teleportMonsterFar() {
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 25;
    MON.pos.set(clamp(player.pos.x + Math.cos(a) * r, -W.HALF + 5, W.HALF - 5), 0, clamp(player.pos.z + Math.sin(a) * r, -W.HALF + 5, W.HALF - 5));
    MON.state = 'wander'; MON.t = 0;
  }
  function moveToward(tx, tz, speed, dt) {
    const dx = tx - MON.pos.x, dz = tz - MON.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.1) {
      const s = Math.min(d, speed * dt);
      MON.pos.x += dx / d * s; MON.pos.z += dz / d * s;
      monster.rotation.y = Util.lerpAngle(monster.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 4));
    }
    return d;
  }
  function updateMonster(dt) {
    const active = S.boyState === 'monster';
    monster.visible = active;
    if (!active) { monsterLight.intensity = 0; return; }
    const lvl = 1 + S.day / 60;
    const px = player.pos.x, pz = player.pos.z;
    const away = S.inMine || S.inHouse;
    const d = away ? 999 : Math.hypot(px - MON.pos.x, pz - MON.pos.z);
    MON.grow = Math.min(1, MON.grow + dt / 2.5);
    const sc = 0.25 + 0.75 * (1 - Math.pow(1 - MON.grow, 3));
    monster.scale.setScalar(sc);
    let speed = 0;
    MON.t -= dt;
    switch (MON.state) {
      case 'wander': {
        speed = 2.3;
        const dd = moveToward(MON.target.x, MON.target.z, speed, dt);
        if (dd < 1 || MON.t <= 0) {
          const cx = away ? 0 : px, cz = away ? 0 : pz;
          const a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 35;
          MON.target.set(clamp(cx + Math.cos(a) * r, -W.HALF + 5, W.HALF - 5), 0, clamp(cz + Math.sin(a) * r, -W.HALF + 5, W.HALF - 5));
          MON.t = 10;
        }
        if (!away) {
          MON.stalkT -= dt; MON.appearT -= dt;
          if (MON.stalkT <= 0) { MON.state = 'stalk'; MON.t = 14; Sound.growl(0.6 * Math.max(0.2, 1 - d / 60)); }
          else if (MON.appearT <= 0 && d > 30) {
            // появляется за спиной
            MON.pos.set(px + Math.sin(camYaw) * 16 + (Math.random() - 0.5) * 8, 0, pz + Math.cos(camYaw) * 16 + (Math.random() - 0.5) * 8);
            MON.state = 'stare'; MON.t = 4;
            MON.appearT = (45 + Math.random() * 35) / lvl;
            Sound.stinger();
          }
        }
        break;
      }
      case 'stare':
        monster.rotation.y = Util.lerpAngle(monster.rotation.y, Math.atan2(px - MON.pos.x, pz - MON.pos.z), Math.min(1, dt * 3));
        if (MON.t <= 0) { MON.state = Math.random() < 0.6 ? 'stalk' : 'wander'; MON.t = 12; }
        break;
      case 'stalk':
        speed = Math.min(4.6 * lvl, 6.3);
        moveToward(px, pz, speed, dt);
        if (d < 3.2) {
          S.fear = Math.min(97, S.fear + 30); jumpShow(0, 450); Sound.scream(0.9); screenFlash('#900', 0.7); redT = 0.6;
          MON.state = 'retreat'; MON.t = 5;
        } else if (MON.t <= 0 || away) { MON.state = 'wander'; MON.t = 0; MON.stalkT = (25 + Math.random() * 20) / lvl; }
        break;
      case 'retreat':
        speed = 7;
        moveToward(MON.pos.x * 2 - px, MON.pos.z * 2 - pz, speed, dt);
        if (MON.t <= 0) { teleportMonsterFar(); MON.stalkT = (25 + Math.random() * 20) / lvl; }
        break;
    }
    MON.pos.x = clamp(MON.pos.x, -W.HALF, W.HALF); MON.pos.z = clamp(MON.pos.z, -W.HALF, W.HALF);
    monster.position.copy(MON.pos);
    MON.phase += dt * speed * 0.9;
    const u = monster.userData, s = Math.sin(MON.phase);
    u.legL.rotation.x = s * 0.5 * Math.min(1, speed); u.legR.rotation.x = -s * 0.5 * Math.min(1, speed);
    u.armL.rotation.x = -s * 0.3 + Math.sin(performance.now() / 700) * 0.1;
    u.armR.rotation.x = s * 0.3 + Math.cos(performance.now() / 800) * 0.1;
    MON.twitch -= dt;
    if (MON.twitch <= 0) { MON.twitch = 0.5 + Math.random() * 2.5; u.head.rotation.z = (Math.random() - 0.5) * 0.9; u.head.rotation.y = (Math.random() - 0.5) * 0.6; }
    const hp = new V3(); u.head.getWorldPosition(hp);
    monsterLight.position.set(hp.x + Math.sin(monster.rotation.y) * 1.2, hp.y, hp.z + Math.cos(monster.rotation.y) * 1.2);
    monsterLight.intensity = 0.8;
    if (!away) {
      MON.growlT -= dt;
      if (MON.growlT <= 0 && d < 45) { MON.growlT = 5 + Math.random() * 6; Sound.growl(0.7 * (1 - d / 45)); }
    }
  }

  // ---------- страх ----------
  function updateFear(dt, nightK) {
    if (S.sleeping) { S.fear = Math.max(0, S.fear - dt * 3); return; }
    let rate = 0;
    if (!S.inMine && nightK < 0.5) rate -= 5;
    if (nightK >= 0.5 && !S.inMine) rate += S.flashlight ? 0.15 : 0.9;
    if (S.inMine) rate += S.flashlight ? 0.3 : 1.2;
    if (S.boyState === 'monster' && monster.visible && !S.inMine && !S.inHouse) {
      const lvl = 1 + S.day / 50;
      const dx = MON.pos.x - camera.position.x, dz = MON.pos.z - camera.position.z, d = Math.hypot(dx, dz);
      if (d < 35) rate += (1 - d / 35) * 9 * lvl;
      const dir = new V3(); camera.getWorldDirection(dir);
      if (d < 45 && (dir.x * dx + dir.z * dz) / d > 0.75) rate += 3 * lvl;
    }
    for (const f of fires) if (Math.hypot(f.x - player.pos.x, f.z - player.pos.z) < 9) rate -= 6;
    S.fear = clamp(S.fear + rate * dt, 0, 100);
    if (S.fear >= 100) faint();
  }

  // ---------- окружение ----------
  const cDayFog = new THREE.Color(0x4a5058), cNightFog = new THREE.Color(0x05070b), cMine = new THREE.Color(0x000000), tmpC = new THREE.Color();
  function nightAmount() {
    const t = S.time;
    if (t < 10) return 1 - t / 10;
    if (t < NIGHT_START - 20) return 0;
    if (t < NIGHT_START) return (t - (NIGHT_START - 20)) / 20;
    if (t > CYCLE - 10) return (CYCLE - t) / 10;
    return 1;
  }
  function updateEnv(nightK) {
    if (S.inMine) {
      scene.fog.color.copy(cMine); scene.background.copy(cMine); scene.fog.density = 0.055;
      hemi.intensity = 0.12; sun.intensity = 0;
    } else if (S.inHouse) {
      scene.fog.color.setHex(0x080604); scene.background.setHex(0x000000); scene.fog.density = 0.04;
      hemi.intensity = 0.4 - nightK * 0.34; sun.intensity = 0;
    } else {
      tmpC.copy(cDayFog).lerp(cNightFog, nightK);
      scene.fog.color.copy(tmpC); scene.background.copy(tmpC);
      scene.fog.density = 0.012 + nightK * 0.022;
      hemi.intensity = 0.75 - nightK * 0.68;
      sun.intensity = 0.45 - nightK * 0.35;
      sun.color.setHex(nightK > 0.5 ? 0x6070a0 : 0xbfc6d0);
    }
    const sky = !S.inMine && !S.inHouse;
    moon.visible = moonGlow.visible = stars.visible = sky;
    moon.material.opacity = nightK; moonGlow.material.opacity = nightK * 0.4; stars.material.opacity = nightK;
    moon.position.set(camera.position.x - 120, 170, camera.position.z - 240);
    moonGlow.position.copy(moon.position);
    stars.position.set(camera.position.x, 0, camera.position.z);
  }

  // ---------- игрок и камера ----------
  const keys = {};
  const raycaster = new THREE.Raycaster();
  function updatePlayer(dt) {
    const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
    const rX = -fwdZ, rZ = fwdX;
    let mx = 0, mz = 0;
    if (!dialog && !S.sleeping) {
      if (keys.KeyW || keys.ArrowUp) { mx += fwdX; mz += fwdZ; }
      if (keys.KeyS || keys.ArrowDown) { mx -= fwdX; mz -= fwdZ; }
      if (keys.KeyD || keys.ArrowRight) { mx += rX; mz += rZ; }
      if (keys.KeyA || keys.ArrowLeft) { mx -= rX; mz -= rZ; }
    }
    const len = Math.hypot(mx, mz);
    const moving = len > 0.01;
    const wantRun = moving && (keys.ShiftLeft || keys.ShiftRight);
    if (player.stamina <= 0) player.tired = true;
    if (player.tired && player.stamina > 30) player.tired = false;
    const running = wantRun && !player.tired;
    player.stamina = clamp(player.stamina + (running ? -18 : 12) * dt, 0, 100);
    const speed = moving ? (running ? 7.4 : 4.1) : 0;
    if (moving) {
      player.pos.x += mx / len * speed * dt; player.pos.z += mz / len * speed * dt;
      player.facing = Util.lerpAngle(player.facing, Math.atan2(mx, mz), Math.min(1, dt * 10));
    }
    W.resolve(player.pos, 0.35);
    if (!S.inMine && !S.inHouse && !S.onIsland && !S.part2) { player.pos.x = clamp(player.pos.x, -W.HALF, W.HALF); player.pos.z = clamp(player.pos.z, -W.HALF, W.HALF); }
    if (S.onIsland) {
      const cx = S.inCave ? ISL.CX : ISL.IX, cz = S.inCave ? ISL.CZ : ISL.IZ, rr = S.inCave ? ISL.CR - 3 : ISL.R + 8;
      const dx = player.pos.x - cx, dz = player.pos.z - cz, dd = Math.hypot(dx, dz);
      if (dd > rr) { player.pos.x = cx + dx / dd * rr; player.pos.z = cz + dz / dd * rr; }
      if (S.inCave) player.pos.z = Math.min(player.pos.z, ISL.CZ + 24.5);
    }
    // прыжок
    if (player.jumpReq) {
      player.jumpReq = false;
      if (player.grounded && !dialog && !S.sleeping && player.stamina > 8) {
        player.vy = 6.6; player.grounded = false; player.stamina -= 8; Sound.jump();
      }
    }
    if (!player.grounded || player.pos.y > 0) {
      player.vy -= 18 * dt; player.pos.y += player.vy * dt;
      if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; if (!player.grounded) Sound.step(true); player.grounded = true; }
    }
    const m = player.model;
    m.position.copy(player.pos); m.rotation.y = player.facing;
    player.walkAmt = Util.lerp(player.walkAmt, moving ? (running ? 1.3 : 1) : 0, Math.min(1, dt * 8));
    player.phase += dt * speed * 1.7;
    Models.walkAnim(m, player.phase, player.walkAmt);
    if (!player.grounded) {
      const u = m.userData;
      u.legL.rotation.x = -0.7; u.legR.rotation.x = 0.35;
      u.armL.rotation.x = -1.1; u.armR.rotation.x = -0.6;
    }
    if (player.swingT > 0) {
      player.swingT -= dt;
      const t = 1 - Math.max(0, player.swingT) / 0.35;
      m.userData.armR.rotation.x = -2.8 + t * 2.4;
    }
    player.actT -= dt;
    const tl = m.userData.tools;
    for (const k in tl) tl[k].visible = S.held === k && S.tools[k];
    m.userData.lens.material.color.setHex(S.flashlight ? 0xfff2c0 : 0x333333);
    if (moving && player.grounded) {
      player.stepAcc += speed * dt;
      if (player.stepAcc > (running ? 1.7 : 1.35)) { player.stepAcc = 0; Sound.step(running); }
    }
  }

  function updateCamera(dt) {
    const cp = Math.cos(camPitch);
    const f = new V3(-Math.sin(camYaw) * cp, Math.sin(camPitch), -Math.cos(camYaw) * cp);
    const right = new V3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const origin = new V3(player.pos.x, 1.6 + player.pos.y, player.pos.z).addScaledVector(right, 0.55);
    let dist = 4.2;
    const back = f.clone().negate();
    raycaster.set(origin, back); raycaster.far = dist + 0.3;
    const hits = raycaster.intersectObjects(S.part2 ? H2.blockers : S.onIsland ? (S.inCave ? [] : ISL.blockers) : S.inMine ? W.blockersMine : S.inHouse ? HM.blockers : W.blockersOut, false);
    if (hits.length) dist = Math.max(0.6, hits[0].distance - 0.3);
    camera.position.copy(origin).addScaledVector(back, dist);
    camera.position.y = Math.max(0.35, camera.position.y);
    if (S.inMine) camera.position.y = Math.min(3.8, camera.position.y);
    if (S.inHouse) camera.position.y = Math.min(2.5, camera.position.y);
    if (S.inCave) {
      const dx = camera.position.x - ISL.CX, dz = camera.position.z - ISL.CZ, dd = Math.hypot(dx, dz);
      if (dd > ISL.CR - 2) { camera.position.x = ISL.CX + dx / dd * (ISL.CR - 2); camera.position.z = ISL.CZ + dz / dd * (ISL.CR - 2); }
    }
    const look = origin.clone().addScaledVector(f, 10);
    camera.lookAt(look);
    if (S.fear > 65) {
      const k = (S.fear - 65) / 35 * 0.012;
      camera.rotation.x += (Math.random() - 0.5) * k; camera.rotation.y += (Math.random() - 0.5) * k;
    }
    camera.fov = 70 + (S.fear > 50 ? (S.fear - 50) / 50 * 8 : 0);
    camera.updateProjectionMatrix();
    // фонарик
    flash.position.set(player.pos.x, 1.45 + player.pos.y, player.pos.z).addScaledVector(right, 0.3);
    flash.target.position.copy(look);
    flash.intensity = darkT > 0 ? 0 : S.flashlight ? (S.inMine ? 4.6 : 4.2) * ((S.fear > 85 || flickerT > 0) && Math.random() < (flickerT > 0 ? 0.5 : 0.15) ? 0.1 : 1) : 0;
    flashFill.position.set(player.pos.x, 2.2, player.pos.z).addScaledVector(right, 0.2);
    flashFill.intensity = flash.intensity > 0.5 ? (S.inMine ? 0.9 : 0.7) : 0;
  }

  function updateBoy(dt) {
    if (boyRevertT > 0) {
      boyRevertT -= dt;
      boy.visible = true;
      if (boyRevertT <= 0) boy.visible = false;
    } else if (S.boyState === 'boy') {
      boy.visible = true;
      boy.position.set(POI.boySpot.x, 0, POI.boySpot.z);
    } else boy.visible = false;
    if (boy.visible) {
      const dx = player.pos.x - boy.position.x, dz = player.pos.z - boy.position.z;
      if (Math.hypot(dx, dz) < 20) boy.rotation.y = Util.lerpAngle(boy.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 3));
      const tt = performance.now() / 1000;
      boy.userData.head.rotation.z = Math.sin(tt * 0.7) * 0.08 + (Math.sin(tt * 0.31) > 0.97 ? 0.5 : 0);
      Models.walkAnim(boy, 0, 0);
    }
    mark.visible = boy.visible && S.boyState === 'boy' && S.quest && !S.quest.done;
    mark.position.set(boy.position.x, 1.75 + Math.sin(performance.now() / 300) * 0.06, boy.position.z);
  }

  function updateMisc(dt) {
    const tt = performance.now() / 1000;
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.life -= dt;
      if (f.life <= 0) { scene.remove(f.obj); fires.splice(i, 1); continue; }
      f.obj.userData.flames.forEach((fl, k) => { fl.scale.y = 0.8 + Math.random() * 0.45; fl.rotation.y += dt * (k ? -3 : 2); });
    }
    firePool.forEach((l, i) => {
      const f = fires[i];
      if (f) { l.position.set(f.x, 1.2, f.z); l.intensity = 1.6 + Math.random() * 0.5; } else l.intensity = 0;
    });
    if (questItemObj) { questItemObj.userData.inner.rotation.y += dt; questItemObj.userData.inner.position.y = 0.1 + Math.sin(tt * 2) * 0.05; }
    if (W.oakSwing) W.oakSwing.position.z = Math.sin(tt * 1.1) * (S.time > NIGHT_START ? 0.5 : 0.08);
    if (W.scarecrowHead) W.scarecrowHead.rotation.y = Math.sin(tt * 0.13) > 0.9 ? 1.2 : 0;
    if (W.mine.crystal.visible) { W.mine.crystalMain.rotation.y += dt * 0.5; W.mine.crystalLight.intensity = 1.4 + Math.sin(tt * 3) * 0.4; }
    // посещение места
    const q = S.quest;
    if (q && q.kind === 'visit' && !q.done && !S.inMine) {
      const p = PLACES[q.place];
      if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 6) { Sound.whisper(); msg(p.ev, 7); completeQuest(true); msg('Задание выполнено.', 4); }
    }
  }

  // ---------- интерфейс ----------
  let invSig = '';
  function updateHUD(nightK) {
    const night = S.time >= NIGHT_START;
    $('dayLabel').textContent = night ? `Ночь ${S.day} / ${WIN_NIGHTS}` : `День ${S.day}`;
    const left = night ? CYCLE - S.time : NIGHT_START - S.time;
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    $('timeText').textContent = (night ? 'До рассвета ' : 'До ночи ') + `${mm}:${String(ss).padStart(2, '0')}`;
    $('timefill').style.width = (night ? (S.time - NIGHT_START) / (CYCLE - NIGHT_START) : S.time / NIGHT_START) * 100 + '%';
    $('timefill').style.background = night ? '#4a5a9a' : '#c9a66b';
    const qb = $('quest');
    const q = S.quest;
    let qt = '', qtitle = 'Задание мальчика';
    if (!S.introDone) qt = 'Поговори с мальчиком у колодца.';
    else if (S.boyState === 'monster') { qtitle = 'Опасность'; qt = S.tools.soul ? 'Мальчик стал чудовищем. Найди его и покажи Камень души!' : 'Мальчик стал чудовищем. Держись от него подальше до рассвета.'; }
    else if (night && S.boyState === 'sleep') qt = 'Мальчик спит. Переживи ночь.';
    else if (q.done) qt = '✔ Выполнено. Мальчик спокоен.';
    else {
      qt = q.text;
      if (q.kind === 'bring') qt += ` (${Math.min(S.inv[q.res], q.n)}/${q.n})`;
      if (q.kind === 'fetch' && q.picked) qt = `Отнеси «${ITEMS[q.item].name}» мальчику.`;
    }
    qb.className = q && q.done && S.boyState !== 'monster' ? 'done' : '';
    qb.innerHTML = `<div class="t">${qtitle}</div>${qt}`;
    let goal = '';
    if (!S.tools.axe) goal = 'Цель: обломай ветки с ёлки (E), найди камень на земле и сделай топор (C).';
    else if (!S.tools.shovel || !S.tools.pickaxe) goal = 'Цель: сруби деревья топором и сделай лопату и кирку (C).';
    else if (!S.mineOpen) goal = 'Цель: раскопай лопатой вход в шахту (юго-запад, по тропе).';
    else if (!S.tools.soul) goal = 'Цель: найди Камень души в глубине шахты и добудь его киркой.';
    $('goal').textContent = goal;
    $('fearfill').style.width = S.fear + '%';
    $('stamfill').style.width = player.stamina + '%';
    $('stamfill').style.background = player.tired ? '#6a3a3a' : '#8c8c7a';
    // инвентарь
    const q2 = S.quest;
    const sig = JSON.stringify([S.inv, S.tools, S.held, q2 && q2.picked && !q2.done ? q2.item : -1]);
    if (sig !== invSig) {
      invSig = sig;
      let h = '';
      for (const k in RES) h += `<div class="slot"><div class="ic">${RES[k].icon}</div><div>${RES[k].name}</div><div class="n">${S.inv[k]}</div></div>`;
      TOOLS.forEach(t => {
        if (S.tools[t.id]) h += `<div class="slot tool${S.held === t.id ? ' sel' : ''}"><div class="k">${t.key}</div><div class="ic">${t.icon}</div><div>${t.name}</div></div>`;
      });
      if (S.tools.soul) h += '<div class="slot soul"><div class="ic">🔮</div><div>Камень души</div></div>';
      if (q2 && q2.kind === 'fetch' && q2.picked && !q2.done) h += `<div class="slot quest"><div class="ic">${ITEMS[q2.item].icon}</div><div>${ITEMS[q2.item].name}</div></div>`;
      $('inv').innerHTML = h;
    }
    // подсказка
    const pr = $('prompt');
    if (current && !dialog) {
      pr.style.display = 'block';
      pr.textContent = current.fn ? `[E] ${current.label}` : current.label;
      pr.className = 'hud' + (current.fn ? '' : ' off');
    } else pr.style.display = 'none';
  }

  const mm = $('minimap'), mg = mm.getContext('2d');
  const MS = 180 / 480;
  const mapBg = document.createElement('canvas'); mapBg.width = mapBg.height = 180;
  (function drawMapBg() {
    const g = mapBg.getContext('2d');
    const X = x => (x + 240) * MS, Y = z => (z + 240) * MS;
    g.fillStyle = '#0b160e'; g.fillRect(0, 0, 180, 180);
    g.fillStyle = '#2a261e'; g.beginPath(); g.arc(X(0), Y(0), 46 * MS, 0, 7); g.fill();
    const c = POI.cem; g.fillStyle = '#26241f'; g.fillRect(X(c.x1), Y(c.z1), (c.x2 - c.x1) * MS, (c.z2 - c.z1) * MS);
    g.strokeStyle = '#555'; g.strokeRect(X(c.x1), Y(c.z1), (c.x2 - c.x1) * MS, (c.z2 - c.z1) * MS);
    g.fillStyle = '#3a342c'; g.beginPath(); g.arc(X(POI.hill.x), Y(POI.hill.z), 20 * MS, 0, 7); g.fill();
    g.fillStyle = '#2e2818'; g.beginPath(); g.arc(X(POI.field.x), Y(POI.field.z), 22 * MS, 0, 7); g.fill();
    g.fillStyle = '#1e2a1a'; g.beginPath(); g.arc(X(POI.oak.x), Y(POI.oak.z), 12 * MS, 0, 7); g.fill();
    g.strokeStyle = '#5a4a30'; g.lineWidth = 1.5;
    W.PATHS.forEach(([ax, az, bx, bz]) => { g.beginPath(); g.moveTo(X(ax), Y(az)); g.lineTo(X(bx), Y(bz)); g.stroke(); });
    g.fillStyle = '#6a5a48';
    W.HOUSES.forEach(h => g.fillRect(X(h.x) - 1.5, Y(h.z) - 1.5, 3, 3));
    g.fillRect(X(POI.church.x) - 3, Y(POI.church.z) - 2, 6, 4);
    g.fillStyle = '#8a8a8a'; g.font = '9px Georgia';
    g.fillText('С', 86, 9);
  })();
  function drawMinimap() {
    if (S.inPlane) {
      mg.fillStyle = '#05070a'; mg.fillRect(0, 0, 180, 180);
      mg.fillStyle = '#8a9ab0'; mg.font = '70px serif'; mg.textAlign = 'center'; mg.fillText('✈', 90, 115); mg.textAlign = 'start';
      return;
    }
    mg.clearRect(0, 0, 180, 180);
    if (S.inMine) {
      const { x0, z0, N, C, wallE, wallS } = W.mine;
      mg.fillStyle = '#050505'; mg.fillRect(0, 0, 180, 180);
      const cs = 160 / N, ox = 10, oy = 10;
      mg.strokeStyle = '#6a5a4a'; mg.lineWidth = 2;
      mg.strokeRect(ox, oy, N * cs, N * cs);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i < N - 1 && wallE[i][j]) { mg.beginPath(); mg.moveTo(ox + (i + 1) * cs, oy + j * cs); mg.lineTo(ox + (i + 1) * cs, oy + (j + 1) * cs); mg.stroke(); }
        if (j < N - 1 && wallS[i][j]) { mg.beginPath(); mg.moveTo(ox + i * cs, oy + (j + 1) * cs); mg.lineTo(ox + (i + 1) * cs, oy + (j + 1) * cs); mg.stroke(); }
      }
      const px = ox + ((player.pos.x - x0) / C + 0.5) * cs, pz = oy + ((player.pos.z - z0) / C + 0.5) * cs;
      mg.fillStyle = '#8a7'; mg.fillRect(ox + 2, oy + cs / 2 - 3, 6, 6);
      drawArrow(px, pz);
      return;
    }
    mg.drawImage(mapBg, 0, 0);
    const X = x => (x + 240) * MS, Y = z => (z + 240) * MS;
    let target = null;
    const q = S.quest;
    if (q && !q.done && S.introDone) {
      if (q.kind === 'fetch' && !q.picked) target = { x: q.x, z: q.z };
      else if (q.kind === 'visit') target = PLACES[q.place];
      else if (q.kind === 'cross') target = POI.momGrave;
      else if (q.kind === 'fire') target = { x: POI.boyDoor.x, z: POI.boyDoor.z + 4 };
    }
    if (target) { mg.fillStyle = '#e0c040'; mg.beginPath(); mg.arc(X(target.x), Y(target.z), 3.5, 0, 7); mg.fill(); }
    if (S.tools.shovel && !S.tools.soul) { mg.fillStyle = '#a060e0'; mg.fillRect(X(POI.mine.x) - 3, Y(POI.mine.z) - 3, 6, 6); }
    if (boy.visible) { mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(X(boy.position.x), Y(boy.position.z), 2.5, 0, 7); mg.fill(); }
    if (S.boyState === 'monster' && S.tools.soul && Math.sin(performance.now() / 200) > 0) {
      const d = Math.hypot(MON.pos.x - player.pos.x, MON.pos.z - player.pos.z);
      if (d < 60) { mg.fillStyle = '#e02020'; mg.beginPath(); mg.arc(X(MON.pos.x), Y(MON.pos.z), 3, 0, 7); mg.fill(); }
    }
    fires.forEach(f => { mg.fillStyle = '#ff8a30'; mg.fillRect(X(f.x) - 1.5, Y(f.z) - 1.5, 3, 3); });
    mg.fillStyle = '#50c060';
    mg.fillRect(X(POI.homeDoor.x) - 3, Y(POI.homeDoor.z + 3.5) - 2, 6, 5);
    mg.beginPath(); mg.moveTo(X(POI.homeDoor.x) - 4.5, Y(POI.homeDoor.z + 3.5) - 2); mg.lineTo(X(POI.homeDoor.x), Y(POI.homeDoor.z + 3.5) - 6); mg.lineTo(X(POI.homeDoor.x) + 4.5, Y(POI.homeDoor.z + 3.5) - 2); mg.fill();
    if (S.inHouse) drawArrow(X(POI.homeDoor.x), Y(POI.homeDoor.z + 3));
    else drawArrow(X(player.pos.x), Y(player.pos.z));
  }
  function drawArrow(x, y) {
    mg.save(); mg.translate(x, y); mg.rotate(-camYaw);
    mg.fillStyle = '#7ad07a'; mg.beginPath(); mg.moveTo(0, -6); mg.lineTo(4, 4); mg.lineTo(0, 2); mg.lineTo(-4, 4); mg.closePath(); mg.fill();
    mg.restore();
  }

  // ---------- ввод ----------
  function requestLock() {
    // На телефоне захвата мыши нет — сразу играем
    if (IS_TOUCH) { if (state === 'paused') { state = 'play'; $('pause').classList.add('hidden'); } return; }
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { if (state === 'paused') $('pause').classList.remove('hidden'); });
    } catch (e) { /* ignore */ }
    setTimeout(() => { if (state === 'paused' && !locked) $('pause').classList.remove('hidden'); }, 400);
  }
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) {
      if (state === 'paused') { state = 'play'; $('pause').classList.add('hidden'); }
    } else if (state === 'play') {
      state = 'paused'; $('pause').classList.remove('hidden'); save();
    }
  });
  let wheelAcc = 0;
  addEventListener('wheel', e => {
    if (state !== 'play' || dialog) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 50) { cycleTool(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  }, { passive: true });
  document.addEventListener('mousemove', e => {
    if (!locked || state !== 'play') return;
    camYaw -= e.movementX * 0.0024;
    camPitch = clamp(camPitch - e.movementY * 0.0024, -0.9, 0.6);
  });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state === 'play' && S.part2 && P2.intro) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); endIntro(); }
      return;
    }
    if (state === 'play' && S.inPlane) {
      if (dialog) { if (e.code === 'KeyE') advanceDialog(); }
      else planeKey(e.code);
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    if (state === 'play' && S.sleeping) {
      if (e.code === 'KeyE') wakeUp('Ты не можешь уснуть. Ночь ещё не кончилась.');
      return;
    }
    if (state === 'play') {
      if (e.code === 'KeyE') act();
      else if (e.code === 'KeyC') openCraft();
      else if (e.code === 'KeyF') { S.flashlight = !S.flashlight; Sound.click(); }
      else if (e.code === 'Space') { e.preventDefault(); player.jumpReq = true; }
      else if (e.code === 'Digit1' || e.code === 'Numpad1') selectTool('axe');
      else if (e.code === 'Digit2' || e.code === 'Numpad2') selectTool('pickaxe');
      else if (e.code === 'Digit3' || e.code === 'Numpad3') selectTool('shovel');
      else if (e.code === 'KeyQ' && S.held) selectTool(S.held);
    } else if (state === 'craft' && (e.code === 'KeyC' || e.code === 'Escape')) closeCraft();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('keydown', e => { if (e.code === 'Escape' && !$('skins').classList.contains('hidden')) closeSkins(); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('mousedown', () => {
    if (state === 'play' && locked && S.part2 && P2.intro) { endIntro(); return; }
    if (state === 'play' && locked) act();
    else if (state === 'paused') requestLock();
  });

  $('btnNew').onclick = () => { if (readSave() && !confirm('Начать новую игру? Текущее сохранение будет удалено.')) return; startGame(false); };
  $('btnSkins').onclick = () => { Sound.init(); openSkins(); };
  // Кнопка второй части появляется после прохождения игры
  if (profile.stats.wins >= 1) $('btnPart2').classList.remove('hidden');
  $('btnPart2').onclick = () => { Sound.init(); Sound.chime(); $('btnP2Cont').classList.toggle('hidden', !readSave2()); $('part2').classList.remove('hidden'); };
  $('btnP2New').onclick = () => startPart2(false);
  $('btnP2Cont').onclick = () => startPart2(true);
  $('btnPart2Back').onclick = () => $('part2').classList.add('hidden');

  // ---------- строка команд и телепорт ----------
  const TP_COMMANDS = ['/tp', 'tp', '/телепорт', 'телепорт', '/teleport', 'teleport'];
  function runCommand() {
    const cmd = $('cmdInput').value.trim().toLowerCase();
    if (!cmd) return;
    if (['/мультик', 'мультик', '/cartoon', 'cartoon', '/мультики', 'мультики'].includes(cmd)) {
      $('cmdErr').textContent = ''; $('cmdInput').value = '';
      openFilms();
      return;
    }
    if (['/ужастик', 'ужастик', '/horror', 'horror'].includes(cmd)) {
      $('cmdErr').textContent = ''; $('cmdInput').value = '';
      Sound.init(); Cartoon.play('horror');
      return;
    }
    if (TP_COMMANDS.includes(cmd)) {
      $('cmdErr').textContent = '';
      $('cmdInput').value = '';
      Sound.init(); Sound.chime();
      $('tpMenu').classList.remove('hidden');
    } else {
      $('cmdErr').textContent = 'Неизвестная команда';
      const row = document.querySelector('.cmdRow');
      row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
    }
  }
  $('cmdGo').onclick = runCommand;
  $('cmdInput').addEventListener('keydown', e => { if (e.key === 'Enter') runCommand(); e.stopPropagation(); });
  $('tpClose').onclick = () => $('tpMenu').classList.add('hidden');
  document.querySelectorAll('.tpBtn').forEach(b => { b.onclick = () => teleport(b.dataset.tp); });

  function teleport(dest) {
    $('tpMenu').classList.add('hidden');
    startGame(!!readSave());
    // сбрасываем все особые места
    S.inPlane = false; S.onIsland = false; S.inCave = false; S.inHouse = false; S.inMine = false; S.sleeping = false;
    S.introDone = true;
    CUT.on = false; ISL.rubble.visible = false; ISL.mishaCave.visible = false; ISL.misha.visible = true;
    hideHouseScare(); hideSil(); endWatcher();
    hemi.color.setHex(0x9aa4b0); hemi.groundColor.setHex(0x1a1510);
    $('planeHint').classList.add('hidden');
    // монстр не должен оставаться в деревне после телепорта
    monster.visible = false; monsterLight.intensity = 0; MON.grow = 1;
    if (dest === 'village') {
      player.pos.set(0, 0, 9); camYaw = 0; camPitch = -0.12;
      S.time = 20; S.nightFlag = false; S.boyState = 'boy'; S.fear = 0; boyRevertT = 0;
      if (S.quest && S.quest.kind === 'flight' && S.flightDone) S.quest.done = true;
      setupQuestWorld();
      setTimeout(() => msg('Телепорт: деревня. Утро, всё спокойно.', 4), 300);
    } else if (dest === 'plane') {
      S.quest = { kind: 'flight', text: 'Летим на Туманный остров вместе с Мишей.' };
      player.pos.set(0, 0, 9);
      startFlight();
    } else if (dest === 'island') {
      S.flightDone = true;
      if (!S.quest || S.quest.kind === 'flight') S.quest = { kind: 'flight', text: '', done: true };
      arriveIsland();
    }
    save();
  }
  $('btnSkinsBack').onclick = () => closeSkins();
  $('btnCont').onclick = () => startGame(true);
  $('btnResume').onclick = () => requestLock();
  $('btnMenu').onclick = () => { save(); location.reload(); };
  $('btnCloseCraft').onclick = () => closeCraft();
  $('btnAgain').onclick = () => location.reload();
  // Выбор мультика
  const openFilms = () => { Sound.init(); $('films').classList.remove('hidden'); };
  $('btnCartoon').onclick = openFilms;
  $('btnFilms').onclick = openFilms;
  $('filmsBack').onclick = () => $('films').classList.add('hidden');
  document.querySelectorAll('.film').forEach(el => {
    el.querySelector('button').onclick = () => { $('films').classList.add('hidden'); Cartoon.play(el.dataset.film); };
  });
  if (readSave()) $('btnCont').classList.remove('hidden');

  // ---------- полёт на самолёте ----------
  const PL = Plane.build(scene);
  const FLIGHT_TIME = 200;
  const FL = { mode: 'seat', t: 0, page: 0, ev: {}, toilet: 0, warned: false, backDone: false, shake: 0, dark: 0, flick: 0, turned: 0, skyT: 0, hideT: 12, hider: null, talk: 0, winT: 0, winScare: false };
  const binEyes = new THREE.Group();
  [-0.09, 0.09].forEach(x => { const e = Util.glowSprite(0xff2200, 0.2, 1); e.material.fog = false; e.position.x = x; binEyes.add(e); });
  binEyes.visible = false; scene.add(binEyes);
  const winFace = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.36), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(faceCanvases[2]) }));
  winFace.visible = false; scene.add(winFace);
  const paxWorld = PL.passengers.map(p => { const v = new V3(); p.getWorldPosition(v); return v; });

  const BOOK = [
    '<h3>СКАЗКИ<br>ТУМАННОГО<br>ОСТРОВА</h3><div class="c">Для Миши.<br>Читай, когда страшно.<br><br>— Мама</div>',
    'Давным-давно на острове, где туман никогда не уходит, жил тот, кто ест души.<br><br>Он не любил свет. Он любил детей, которые очень скучают.',
    'Пожиратель душ не может жить сам по себе. Ему нужен дом.<br><br>Чаще всего его домом становится ребёнок. Днём ребёнок — это просто ребёнок. А ночью...',
    '<div class="pic">👦</div><div class="c">(На картинке нарисован мальчик. За его спиной — огромная тень с красными глазами. Кто-то обвёл эти глаза карандашом. Много раз.)</div>',
    'Чтобы тень уснула, нужно выполнять просьбы ребёнка. Каждый день, пока светит солнце.<br><br>Тогда ребёнок помнит, кем он был.',
    'Камень души хранит память. Покажи его тени — и ребёнок вернётся.<br><br>Ненадолго. Всегда ненадолго.',
    'На Туманном острове стоит маяк. Говорят, его свет может прогнать тень навсегда.<br><br>Но маяк давно погас. А смотритель маяка...',
    '<div class="c">(Здесь несколько страниц вырвано.)</div><div class="scrawl">МАМА ЖДЁТ<br>НА ОСТРОВЕ</div>',
    'Если ты читаешь это в самолёте — не вставай с места.<br><br>И ни в коем случае не смотри в конец салона.',
    '<div class="scrawl" style="font-size:40px;margin-top:120px">ОН УЖЕ<br>ЗДЕСЬ</div>',
    'Они прячутся за спинками кресел. Они смотрят в окна снаружи. Они ждут, когда погаснет свет.<br><br>Не смотри на них слишком долго.',
    '<h3>Конец</h3><div class="c">...или только начало.</div>'
  ];
  const MISHA_LINES = [
    ['Я никогда не летал.', 'Мама обещала, что мы полетим вместе. Она не успела.'],
    ['Смотри, облака похожи на овец.', 'А вон то облако... похоже на него.'],
    ['На острове есть маяк. Мама там работала.', 'Она зажигала свет, чтобы он не приходил.'],
    ['Мне не страшно, когда ты рядом.', 'Он спит. Я слышу, как он дышит.'],
    ['Не смотри долго на пассажиров.', 'Они не люди. Они просто притворяются.'],
    ['Ты слышишь?', 'Кто-то стучит в туалете. Уже давно.']
  ];

  function startFlight() {
    fadeTo('Миша берёт тебя за руку... Вспышка — и вы уже в самолёте.', 1600, () => {
      S.inPlane = true; S.inMine = false; S.inHouse = false; S.sleeping = false; hideSil();
      Object.assign(FL, { mode: 'seat', t: 0, page: 0, ev: {}, toilet: 0, warned: false, backDone: false, shake: 0, dark: 0, flick: 0, turned: 0, hideT: 10, hider: null, winScare: false });
      endWatcher(); S.fear = 0;
      player.pos.set(PL.seat.x, 0, PL.seat.z);
      camYaw = 0; camPitch = -0.08;
      Sound.engine(true);
      $('planeHint').classList.remove('hidden');
      setTimeout(() => msg('Ты в самолёте. Рядом сидит Миша и смотрит на тебя.', 5), 1700);
    });
  }
  function endFlight() {
    closeBook(); hideHider();
    fadeTo('Самолёт идёт на посадку...', 2500, () => {
      S.inPlane = false; S.flightDone = true;
      Sound.engine(false);
      $('planeHint').classList.add('hidden');
      if (S.quest && S.quest.kind === 'flight' && !S.quest.done) completeQuest(true);
      arriveIsland();
    });
  }

  // ---------- книжка ----------
  function renderBook() {
    const b = $('book');
    const Lp = b.querySelector('.left'), Rp = b.querySelector('.right');
    Lp.querySelector('.pt').innerHTML = BOOK[FL.page] || '';
    Rp.querySelector('.pt').innerHTML = BOOK[FL.page + 1] || '';
    Lp.querySelector('.pn').textContent = FL.page + 1;
    Rp.querySelector('.pn').textContent = FL.page + 2;
    if (FL.page >= 8) FL.warned = true;
  }
  function openBook() { FL.mode = 'book'; $('book').classList.remove('hidden'); renderBook(); Sound.whisper(); }
  function flipBook(d) {
    const np = clamp(FL.page + d, 0, BOOK.length - 2);
    if (np === FL.page) return;
    FL.page = np; renderBook();
    Sound.snap();
  }
  function closeBook() { $('book').classList.add('hidden'); if (FL.mode === 'book') FL.mode = 'seat'; }

  function talkMishaPlane() {
    const lines = MISHA_LINES[FL.talk % MISHA_LINES.length]; FL.talk++;
    say(lines, 'Миша');
  }
  function sitDown() { FL.mode = 'seat'; camYaw = 0; camPitch = -0.08; msg('Ты садишься на своё место.', 2); }
  function knockCockpit() {
    swing(); Sound.knock();
    setTimeout(() => msg('Никто не отвечает. Из-за двери доносится тихое детское пение.', 5), 1200);
  }
  function openToilet() {
    if (FL.toilet === 0) { Sound.knock(); setTimeout(() => Sound.knock(), 900); msg('Занято. Изнутри постучали в ответ.', 4); FL.toilet = 1; }
    else { FL.toilet = 2; screamer(3, 15, 500); setTimeout(() => msg('Дверь распахнулась. Внутри никого. На зеркале написано: «НЕ ВЕРЬ ЕМУ».', 7), 700); }
  }

  function planeKey(code) {
    if (FL.mode === 'book') {
      if (code === 'ArrowRight' || code === 'KeyD') flipBook(2);
      else if (code === 'ArrowLeft' || code === 'KeyA') flipBook(-2);
      else if (code === 'KeyE' || code === 'KeyR' || code === 'Space') closeBook();
      return;
    }
    if (FL.mode === 'window') { if (code === 'KeyE' || code === 'Space') { FL.mode = 'seat'; camYaw = 0; camPitch = -0.08; } return; }
    if (FL.mode === 'seat') {
      if (code === 'KeyE') { FL.mode = 'window'; FL.winT = 0; }
      else if (code === 'KeyR') openBook();
      else if (code === 'KeyT') talkMishaPlane();
      else if (code === 'Space') {
        FL.mode = 'walk'; player.pos.set(PL.aisleSeat.x, 0, PL.aisleSeat.z); player.facing = Math.PI; camYaw = 0; camPitch = -0.1;
        msg('Ты встаёшь и выходишь в проход.', 2.5);
      }
      return;
    }
    if (FL.mode === 'walk' && code === 'KeyE') act();
  }

  // ---------- монстры, которые прячутся в самолёте ----------
  function hideHider() {
    const h = FL.hider;
    if (h && h.obj) h.obj.visible = false;
    binEyes.visible = false; winFace.visible = false;
    FL.hider = null;
    FL.hideT = 12 + Math.random() * 14;
  }
  function spawnHider() {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const opts = ['seat', 'seat', 'window', 'bin'];
    if (FL.mode === 'seat') opts.push('aisle');
    const kind = opts[Math.floor(Math.random() * opts.length)];
    const prow = Math.round((player.pos.z - PL.PZ + 9) / 1.05);
    const rowZ = r => PL.PZ - 9 + r * 1.05;
    if (kind === 'seat') {
      const r = FL.mode === 'walk' ? clamp(prow + (Math.random() < 0.5 ? -3 : 3), 1, 16) : clamp(prow - 3 - Math.floor(Math.random() * 3), 1, 16);
      const x = PL.PX + (Math.random() < 0.5 ? -0.72 : 0.72);
      const o = getWatcher(type);
      o.visible = true; o.rotation.set(0, 0, 0);
      const y = 1.4 - 1.82 * o.scale.y;
      FL.hider = { kind, obj: o, t: 7, look: 0, x, z: rowZ(r) + 0.55, y, rise: 0 };
      o.position.set(x, y - 0.5, rowZ(r) + 0.55);
    } else if (kind === 'window') {
      const r = clamp(prow - 1 - Math.floor(Math.random() * 3), 0, 17);
      const side = Math.random() < 0.6 ? 1 : -1;
      const wx = PL.PX + side * (Math.abs(PL.window.x - PL.PX) - 0.004);
      winFace.material.map.image = faceCanvases[CREATURES[type].face]; winFace.material.map.needsUpdate = true;
      winFace.position.set(wx, 1.15, rowZ(r) - 0.05); winFace.rotation.y = -side * Math.PI / 2;
      winFace.visible = true;
      FL.hider = { kind, t: 6, look: 0, type };
    } else if (kind === 'bin') {
      const side = Math.random() < 0.5 ? -1 : 1;
      const z = clamp(player.pos.z - PL.PZ - 1.5 - Math.random() * 3, -10, 10) + PL.PZ;
      binEyes.position.set(PL.PX + side * 0.99, 1.8, z);
      binEyes.visible = true;
      FL.hider = { kind, t: 8, look: 0 };
    } else {
      const o = getWatcher(type);
      o.visible = true; o.rotation.set(0, 0, 0);
      o.position.set(PL.PX, 0, PL.PZ - 9.5);
      FL.flick = 1.5;
      FL.hider = { kind, obj: o, t: 1.5, look: 0 };
      Sound.stinger();
    }
  }
  function updateHider(dt, light) {
    // фигура в конце салона — после страницы «не смотри в конец салона»
    const lz = player.pos.z - PL.PZ;
    if (FL.mode === 'walk' && FL.warned && !FL.backDone && lz > 3 && !FL.hider) {
      const o = getWatcher('pale'); o.visible = true; o.rotation.set(0, 0, 0); o.position.set(PL.PX, 0, PL.PZ + 10.6);
      FL.hider = { kind: 'back', obj: o, t: 60, look: 0 };
      Sound.breath();
    }
    if (!FL.hider) {
      FL.hideT -= dt;
      if (FL.hideT <= 0 && FL.mode !== 'book' && FL.dark <= 0) spawnHider();
      return;
    }
    const h = FL.hider;
    h.t -= dt;
    const px = player.pos.x, pz = player.pos.z;
    if (h.obj) {
      const o = h.obj;
      o.rotation.y = Math.atan2(px - o.position.x, pz - o.position.z);
      const hy = o.position.y + 1.8 * o.scale.y;
      const looking = lookDot(o.position.x, hy, o.position.z) > 0.9 && light > 0.5;
      const d = Math.hypot(px - o.position.x, pz - o.position.z);
      if (h.kind === 'seat') {
        if (h.look > 0.35 || h.t <= 0) { h.rise = Math.max(0, h.rise - dt * 3); if (h.rise <= 0) { if (h.look > 0.35) Sound.whisper(); hideHider(); return; } }
        else h.rise = Math.min(1, h.rise + dt * 1.5);
        o.position.y = h.y - 0.5 * (1 - h.rise);
        if (looking) h.look += dt;
        if (d < 1.4 && FL.mode === 'walk') { screamer(CREATURES[o.userData.type].face, 15, 500); hideHider(); }
      } else if (h.kind === 'back') {
        if (FL.mode !== 'walk') { o.visible = false; FL.hider = null; return; }
        if (lz > 8) { screamer(1, 18, 600); FL.backDone = true; hideHider(); }
      } else if (h.kind === 'aisle') {
        if (h.t <= 0) { FL.dark = 0.4; hideHider(); }
      }
    } else if (h.kind === 'window') {
      if (lookDot(winFace.position.x, winFace.position.y, winFace.position.z) > 0.93 && light > 0.5) h.look += dt;
      if (h.look > 0.3) { Sound.stinger(); S.fear = 0; hideHider(); }
      else if (h.t <= 0) hideHider();
    } else if (h.kind === 'bin') {
      if (lookDot(binEyes.position.x, binEyes.position.y, binEyes.position.z) > 0.9) h.look += dt;
      if (h.look > 0.4) { Sound.breath(); hideHider(); }
      else if (h.t <= 0) hideHider();
    }
  }

  function updatePlane(dt) {
    FL.t += dt;
    const prog = Math.min(1, FL.t / FLIGHT_TIME);
    const once = (k, at, fn) => { if (FL.t >= at && !FL.ev[k]) { FL.ev[k] = true; fn(); } };
    once('cap1', 6, () => { Sound.bell(); const t = 'Говорит капитан. Мы набрали высоту. Полёт до Туманного острова займёт около трёх минут.'; msg(t, 7); setTimeout(() => Sound.say(t, 0.8, 1.05), 900); });
    once('boy1', 35, () => { subtitle('Мама говорила, что на острове никто не спит...'); Sound.say('Мама говорила, что на острове никто не спит', 1.7, 0.9); });
    once('turb', 70, () => { FL.shake = 3.5; FL.flick = 3; Sound.rumble(); Sound.bell(); msg('Турбулентность! Самолёт трясёт.', 4); });
    once('dark', 110, () => { FL.dark = 2.2; hideHider(); Sound.whisper(); });
    once('turn', 112.2, () => { FL.turned = 7; Sound.stinger(); msg('Все пассажиры повернулись и смотрят на тебя.', 5); });
    once('cap2', 160, () => { Sound.bell(); const t = 'Начинаем снижение. Пожалуйста, вернитесь на свои места и пристегните ремни.'; msg(t, 7); setTimeout(() => Sound.say(t, 0.8, 1.05), 900); });
    if (FL.t >= FLIGHT_TIME && !FL.ev.end) { FL.ev.end = true; endFlight(); }
    FL.shake = Math.max(0, FL.shake - dt); FL.flick = Math.max(0, FL.flick - dt);
    FL.dark = Math.max(0, FL.dark - dt); FL.turned = Math.max(0, FL.turned - dt);
    player.actT -= dt;

    // свет в салоне
    let light = 1;
    if (FL.dark > 0) light = 0.04; else if (FL.flick > 0 && Math.random() < 0.35) light = 0.15;
    PL.lampM.color.setHex(light > 0.5 ? 0xfff2d8 : 0x1a1a1a);
    scene.fog.color.setHex(0x14120f); scene.background.setHex(0x000000); scene.fog.density = 0.035;
    hemi.intensity = 1.0 * light; sun.intensity = 0;
    flash.intensity = 0; flashFill.intensity = 0; monsterLight.intensity = 0;
    moon.visible = moonGlow.visible = stars.visible = false;
    FL.skyT += dt;
    if (FL.skyT > 0.05) { PL.drawSky(FL.skyT, prog, light < 0.5 ? 0.75 : 0); FL.skyT = 0; }

    // движение по проходу
    const md = FL.mode;
    player.model.visible = md === 'walk';
    if (md === 'walk' && !dialog) {
      const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw), rX = -fwdZ, rZ = fwdX;
      let mx = 0, mz = 0;
      if (keys.KeyW || keys.ArrowUp) { mx += fwdX; mz += fwdZ; }
      if (keys.KeyS || keys.ArrowDown) { mx -= fwdX; mz -= fwdZ; }
      if (keys.KeyD || keys.ArrowRight) { mx += rX; mz += rZ; }
      if (keys.KeyA || keys.ArrowLeft) { mx -= rX; mz -= rZ; }
      const len = Math.hypot(mx, mz), sp = (keys.ShiftLeft || keys.ShiftRight) ? 3.6 : 2.3;
      if (len > 0.01) {
        player.pos.x += mx / len * sp * dt; player.pos.z += mz / len * sp * dt;
        player.facing = Util.lerpAngle(player.facing, Math.atan2(mx, mz), Math.min(1, dt * 10));
        player.stepAcc += sp * dt;
        if (player.stepAcc > 1.2) { player.stepAcc = 0; Sound.step(false); }
      }
      player.pos.x = PL.PX + clamp(player.pos.x - PL.PX, -0.33, 0.33);
      player.pos.z = PL.PZ + clamp(player.pos.z - PL.PZ, -11.1, 11.1);
      player.walkAmt = Util.lerp(player.walkAmt, len > 0.01 ? 1 : 0, Math.min(1, dt * 8));
      player.phase += dt * sp * 1.7;
      const m = player.model;
      m.position.copy(player.pos); m.rotation.y = player.facing;
      Models.walkAnim(m, player.phase, player.walkAmt);
      if (player.swingT > 0) { player.swingT -= dt; m.userData.armR.rotation.x = -2.8 + (1 - Math.max(0, player.swingT) / 0.35) * 2.4; }
      const tl = m.userData.tools; for (const k in tl) tl[k].visible = false;
    } else if (md !== 'walk') player.pos.set(PL.seat.x, 0, PL.seat.z);

    // действия в проходе
    current = null;
    if (md === 'walk') {
      const lz = player.pos.z - PL.PZ;
      if (Math.abs(player.pos.z - PL.aisleSeat.z) < 0.8) current = { label: 'Сесть на своё место', fn: sitDown };
      else if (lz < -10.3) current = { label: 'Постучать в кабину пилотов', fn: knockCockpit };
      else if (lz > 10.3) current = FL.toilet < 2 ? { label: FL.toilet ? 'Открыть туалет ещё раз' : 'Открыть туалет', fn: openToilet } : { label: 'В туалете никого нет', fn: null };
    }

    // пассажиры поворачивают головы
    const watchMe = md === 'walk' || FL.turned > 0;
    PL.passengers.forEach((p, i) => {
      const w = paxWorld[i];
      let target = 0;
      if (watchMe) {
        let a = Math.atan2(player.pos.x - w.x, player.pos.z - w.z) - Math.PI;
        while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
        target = FL.turned > 0 ? a : clamp(a, -1.3, 1.3);
      }
      p.userData.head.rotation.y = Util.lerpAngle(p.userData.head.rotation.y, target, Math.min(1, dt * (FL.turned > 0 ? 20 : 1.5)));
    });
    PL.boy.userData.head.rotation.y = md === 'window' ? -1.2 : Math.sin(FL.t * 0.4) * 0.3 - 0.6;

    // камера
    const cp = Math.cos(camPitch);
    const f = new V3(-Math.sin(camYaw) * cp, Math.sin(camPitch), -Math.cos(camYaw) * cp);
    if (md === 'seat' || md === 'book') {
      camYaw = clamp(camYaw, -2.1, 2.1);
      camera.position.set(PL.seat.x + 0.05, 1.34, PL.seat.z + 0.12);
      camera.lookAt(camera.position.clone().add(f));
      camera.fov = 70;
    } else if (md === 'window') {
      FL.winT += dt;
      const tp = new V3(PL.window.x + 0.2, 1.15, PL.window.z);
      camera.position.lerp(tp, Math.min(1, dt * 5));
      camera.lookAt(PL.window.x - 1, 1.15 + camPitch * 0.3, PL.window.z + Math.sin(camYaw) * 0.3);
      camera.fov = 58;
      // иногда в окне появляется лицо
      if (!FL.winScare && FL.winT > 4 && Math.random() < dt * 0.15) {
        FL.winScare = true; screamer(CREATURES[TYPES[Math.floor(Math.random() * 4)]].face, 15, 500);
        FL.mode = 'seat'; camYaw = 0;
      }
    } else {
      const head = new V3(player.pos.x, 1.55, player.pos.z);
      const cam = head.clone().addScaledVector(f, -2.1); cam.y += 0.25;
      cam.x = PL.PX + clamp(cam.x - PL.PX, -1.2, 1.2);
      cam.z = PL.PZ + clamp(cam.z - PL.PZ, -11.7, 11.7);
      cam.y = clamp(cam.y, 0.6, 2.2);
      camera.position.copy(cam);
      camera.lookAt(head.clone().addScaledVector(f, 3));
      camera.fov = 70;
    }
    if (FL.shake > 0) { camera.position.x += (Math.random() - 0.5) * 0.05; camera.position.y += (Math.random() - 0.5) * 0.05; }
    camera.updateProjectionMatrix();

    updateHider(dt, light);
    if (subT > 0) { subT -= dt; if (subT <= 0) $('subtitle').style.opacity = '0'; }
    S.fear = Math.max(0, S.fear - dt * 2);
    Sound.update(dt, 0, S.fear, false, true);

    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      updateHUD(0);
      $('dayLabel').textContent = '✈ Полёт';
      const left = Math.max(0, FLIGHT_TIME - FL.t);
      $('timeText').textContent = `До посадки ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      $('timefill').style.width = prog * 100 + '%';
      $('timefill').style.background = '#6a9ad0';
      $('quest').className = '';
      $('quest').innerHTML = '<div class="t">Полёт</div>Летим на Туманный остров вместе с Мишей.';
      $('goal').textContent = '';
      const hints = {
        seat: '<b>[E]</b> Посмотреть в иллюминатор · <b>[R]</b> Полистать книжку<br><b>[T]</b> Поговорить с Мишей · <b>[Пробел]</b> Встать',
        window: '<b>[E]</b> Отвернуться от окна',
        book: '',
        walk: '<b>WASD</b> — идти по проходу · дойди до своего ряда, чтобы сесть'
      };
      $('planeHint').innerHTML = hints[md];
      $('planeHint').style.display = hints[md] && !dialog ? 'block' : 'none';
    }
    mapT -= dt; if (mapT <= 0) { mapT = 0.5; drawMinimap(); }
  }

  // ---------- главное меню: превью скина ----------
  const pvCanvas = $('skinPreview');
  const pvRenderer = new THREE.WebGLRenderer({ canvas: pvCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  pvRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const pvScene = new THREE.Scene();
  pvScene.add(new THREE.HemisphereLight(0xb0b8c8, 0x201010, 0.9));
  const pvKey = new THREE.DirectionalLight(0xffe0c0, 0.9); pvKey.position.set(2, 3, 4); pvScene.add(pvKey);
  const pvRim = new THREE.PointLight(0xff2020, 2.2, 8); pvRim.position.set(-1.5, 1.8, -1.5); pvScene.add(pvRim);
  const pvCam = new THREE.PerspectiveCamera(30, 3 / 4, 0.1, 50);
  pvCam.position.set(0, 1.25, 5.2); pvCam.lookAt(0, 1.0, 0);
  let pvModel = null, pvSpin = 0.5;
  function setPreview(id) {
    if (pvModel) pvScene.remove(pvModel);
    pvModel = Models.skin(id); pvScene.add(pvModel);
    const sk = skinById(id);
    $('skinName').textContent = sk.name;
    $('skinDesc').textContent = sk.desc;
    $('skinRarity').textContent = RARITY[sk.rarity].name;
    $('skinRarity').className = 'rarity ' + RARITY[sk.rarity].cls;
  }
  function resizePreview() {
    const r = pvCanvas.getBoundingClientRect();
    if (r.width > 0) pvRenderer.setSize(r.width, r.height, false);
  }
  function renderPreview(dt) {
    if (!pvModel) return;
    pvSpin += dt * 0.6;
    pvModel.rotation.y = pvSpin;
    const t = performance.now() / 1000, u = pvModel.userData;
    u.armL.rotation.x = Math.sin(t * 1.3) * 0.08; u.armR.rotation.x = -Math.sin(t * 1.3) * 0.08;
    u.head.rotation.y = Math.sin(t * 0.7) * 0.3;
    pvRim.intensity = 2 + Math.sin(t * 3) * 0.4;
    pvRenderer.render(pvScene, pvCam);
  }
  function setPlayerSkin(id) {
    profile.skin = id; saveProfile();
    scene.remove(player.model);
    player.model = Models.skin(id); scene.add(player.model);
    setPreview(id);
  }

  // Картинки для карточек рисуем один раз тем же рендером
  const thumbs = {};
  function makeThumb(id) {
    if (thumbs[id]) return thumbs[id];
    const m = Models.skin(id); m.rotation.y = 0.45;
    const old = pvModel; if (old) pvScene.remove(old);
    pvScene.add(m);
    pvRenderer.setSize(240, 320, false);
    pvRenderer.render(pvScene, pvCam);
    thumbs[id] = pvCanvas.toDataURL();
    pvScene.remove(m); if (old) pvScene.add(old);
    resizePreview();
    return thumbs[id];
  }

  function renderSkins() {
    const grid = $('skinGrid'); grid.innerHTML = '';
    const open = SKINS.filter(isUnlocked).length;
    $('skinCount').textContent = `Открыто: ${open} / ${SKINS.length}`;
    SKINS.forEach(sk => {
      const un = isUnlocked(sk), eq = profile.skin === sk.id;
      const card = document.createElement('div');
      card.className = `card ${sk.rarity}` + (un ? '' : ' locked') + (eq ? ' equipped' : '');
      const r = RARITY[sk.rarity];
      let status;
      if (eq) status = '✔ Выбран';
      else if (un) status = 'Нажми, чтобы выбрать';
      else status = `🔒 ${sk.req}`;
      const prog = !un ? `<div class="prog"><div style="width:${Math.min(100, profile.stats[sk.stat] / sk.need * 100)}%"></div></div><div class="st" style="color:#8a7a70">${Math.min(profile.stats[sk.stat], sk.need)} / ${sk.need}</div>` : '';
      const isNew = un && sk.stat && !profile.seen.includes(sk.id);
      card.innerHTML = `<img src="${makeThumb(sk.id)}" alt="">${un ? '' : '<div class="lock">🔒</div>'}${eq ? '<div class="eq">НАДЕТ</div>' : isNew ? '<div class="eq" style="background:#c02020;color:#fff">NEW</div>' : ''}
        <div class="rr ${r.cls}">${r.name}</div><div class="nm">${un ? sk.name : '???'}</div><div class="st">${status}</div>${prog}`;
      card.onclick = () => {
        if (!un) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); Sound.init(); Sound.click(); return; }
        Sound.init(); Sound.craft();
        setPlayerSkin(sk.id);
        renderSkins();
      };
      grid.appendChild(card);
    });
    SKINS.forEach(sk => { if (isUnlocked(sk) && sk.stat && !profile.seen.includes(sk.id)) profile.seen.push(sk.id); });
    saveProfile();
    updateBadge();
  }
  function updateBadge() {
    const hasNew = SKINS.some(sk => isUnlocked(sk) && sk.stat && !profile.seen.includes(sk.id));
    $('skinBadge').classList.toggle('hidden', !hasNew);
  }
  function openSkins() { $('skins').classList.remove('hidden'); renderSkins(); }
  function closeSkins() { $('skins').classList.add('hidden'); setPreview(profile.skin); }

  scene.remove(player.model);
  player.model = Models.skin(profile.skin); scene.add(player.model);
  setPreview(profile.skin);
  resizePreview();
  addEventListener('resize', resizePreview);
  updateBadge();

  // ---------- дом игрока ----------
  const HM = W.home;
  const HS = { t: 0, mode: null, obj: null, look: 0, type: null, doorOpen: 0, doorTarget: 0, wakeAt: null, wakeChance: 0.6 };
  const homeFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(faceCanvases[1]) }));
  homeFace.position.set(HM.win.x - 0.015, HM.win.y, HM.win.z); homeFace.rotation.y = -Math.PI / 2;
  homeFace.visible = false; scene.add(homeFace);

  function enterHome() {
    fadeTo('', 400, () => {
      S.inHouse = true; endWatcher(); hideSil(); hideHouseScare();
      player.pos.set(HM.door.x, 0, HM.door.z - 0.3); camYaw = 0; camPitch = -0.1;
      if (!S.homeVisited) {
        S.homeVisited = true;
        setTimeout(() => msg('Твой дом. Кровать, табуретка... и больше ничего.', 5), 600);
        setTimeout(() => msg('Ночью здесь можно переждать до утра. Но стены спасают не от всего.', 6), 3200);
      }
    });
  }
  function exitHome() {
    fadeTo('', 400, () => {
      S.inHouse = false; hideHouseScare(); hideSil();
      player.pos.set(POI.homeDoor.x, 0, POI.homeDoor.z - 1.2); camYaw = 0; camPitch = -0.1;
    });
  }

  // Сон до утра — но могут разбудить
  function goSleep() {
    S.sleeping = true;
    hideHouseScare(); hideSil();
    player.pos.set(HM.bed.x + 0.9, 0, HM.bed.z);
    HS.wakeAt = Math.random() < HS.wakeChance ? S.time + 6 + Math.random() * Math.max(4, CYCLE - S.time - 18) : null;
    if (HS.wakeAt != null && HS.wakeAt > CYCLE - 8) HS.wakeAt = null;
    const f = $('fade'); f.style.transition = 'opacity 1.2s'; f.style.opacity = '1';
    $('fadeText').innerHTML = 'Ты засыпаешь...<br><span style="font-size:15px;color:#888">[E] — проснуться</span>';
    Sound.breath();
  }
  function wakeUp(text) {
    S.sleeping = false;
    const f = $('fade'); f.style.transition = 'opacity 1.2s'; f.style.opacity = '0';
    if (text) msg(text, 5);
  }
  function interruptSleep() {
    wakeUp();
    HS.wakeChance *= 0.5;
    const type = S.boyState === 'monster' ? TYPES[Math.floor(Math.random() * TYPES.length)] : tonightType();
    const o = getWatcher(type); o.visible = true; o.rotation.set(0, 0, 0);
    o.position.set(HM.bed.x + 1.2, 0, HM.bed.z + 1.5);
    player.pos.set(HM.bed.x + 0.85, 0, HM.bed.z - 0.5);
    camYaw = Math.atan2(-(o.position.x - player.pos.x), -(o.position.z - player.pos.z)); camPitch = 0;
    HS.mode = 'bedside'; HS.obj = o; HS.t = 1.6; HS.type = type; HS.doorTarget = 1;
    msg('Ты проснулся от скрипа двери... Кто-то стоит у кровати.', 4);
    Sound.creak(); Sound.breath();
  }

  function runHouseScare() {
    if (HS.mode) return;
    const r = Math.random();
    const type = S.boyState === 'monster' ? TYPES[Math.floor(Math.random() * TYPES.length)] : tonightType();
    if (r < 0.35) {
      // дверь медленно открывается, на пороге кто-то стоит
      const o = getWatcher(type); o.visible = true; o.rotation.set(0, Math.PI, 0);
      o.position.set(HM.outside.x, 0, HM.outside.z);
      HS.mode = 'door'; HS.obj = o; HS.t = 10; HS.look = 0; HS.type = type; HS.doorTarget = 1;
      Sound.creak();
    } else if (r < 0.55) {
      homeFace.material.map.image = faceCanvases[CREATURES[type].face]; homeFace.material.map.needsUpdate = true;
      homeFace.visible = true; HS.mode = 'window'; HS.t = 7; HS.look = 0;
      Sound.snap(); setTimeout(() => Sound.snap(), 500);
    } else if (r < 0.75) {
      Sound.knock();
      const line = pickR(['Открой... это я, Миша.', 'Пусти меня. Мне холодно.', 'Я знаю, что ты там.', 'Тук-тук... Кто в домике живёт?']);
      setTimeout(() => { Sound.voice(line); subtitle(line); }, 1300);
    } else if (r < 0.9) {
      Sound.stepsBehind(); setTimeout(() => Sound.stepsBehind(), 2400);
      msg('Кто-то ходит по крыше...', 4);
    } else {
      Sound.breath(); subtitle('Я под кроватью...');
    }
  }
  function hideHouseScare() {
    if (HS.obj) HS.obj.visible = false;
    HS.obj = null; HS.mode = null; homeFace.visible = false;
    if (HS.doorTarget) { HS.doorTarget = 0; setTimeout(() => Sound.knock(), 350); }
  }
  function updateHouse(dt, nightK) {
    HS.doorOpen += (HS.doorTarget - HS.doorOpen) * Math.min(1, dt * (HS.doorTarget ? 1.0 : 7));
    HM.doorPivot.rotation.y = HS.doorOpen * 1.3;
    if (!S.inHouse) return;
    HM.winM.color.setRGB(0.54 - nightK * 0.5, 0.56 - nightK * 0.51, 0.6 - nightK * 0.5);
    HM.light.intensity = 0.7 - nightK * 0.45;
    if (S.sleeping) {
      if (HS.wakeAt != null && S.time >= HS.wakeAt) { HS.wakeAt = null; interruptSleep(); }
      return;
    }
    const m = HS.mode;
    if (!m) return;
    HS.t -= dt;
    if (m === 'door' || m === 'bedside') {
      const o = HS.obj;
      o.rotation.y = Math.atan2(player.pos.x - o.position.x, player.pos.z - o.position.z);
      const d = Math.hypot(player.pos.x - o.position.x, player.pos.z - o.position.z);
      if (m === 'bedside') { if (HS.t <= 0) { screamer(CREATURES[HS.type].face, 25); hideHouseScare(); } return; }
      if (lookDot(o.position.x, 1.8 * o.scale.y, o.position.z) > 0.9) HS.look += dt;
      S.fear = Math.min(97, S.fear + dt * 4);
      if (d < 2.4) { screamer(CREATURES[HS.type].face, 22); hideHouseScare(); }
      else if (HS.look > 0.5 || HS.t <= 0) hideHouseScare();
    } else if (m === 'window') {
      if (lookDot(homeFace.position.x, homeFace.position.y, homeFace.position.z) > 0.93) HS.look += dt;
      if (HS.look > 0.3) { Sound.stinger(); S.fear = Math.min(97, S.fear + 12); hideHouseScare(); }
      else if (HS.t <= 0) hideHouseScare();
    }
  }

  // ---------- силуэты: пропадают, только когда их увидишь ----------
  const silObj = Models.silhouette(); silObj.visible = false; scene.add(silObj);
  const SIL = { on: false, t: 0, seen: 0, spawnT: 50, inHouse: false };
  const silRay = new THREE.Raycaster();
  function hideSil() { silObj.visible = false; SIL.on = false; SIL.spawnT = 45 + Math.random() * 60; }
  function spawnSil() {
    const f = camFwd();
    let pos = null;
    if (S.inHouse) {
      const opts = HM.corners.filter(c => {
        const dx = c.x - player.pos.x, dz = c.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
        return (dx * f.x + dz * f.z) / d < 0.1 && d > 1.8;
      });
      if (opts.length) pos = pickR(opts);
    } else {
      const back = Math.atan2(-f.x, -f.z);
      for (let k = 0; k < 14 && !pos; k++) {
        const a = back + (Math.random() - 0.5) * 2.4, r = 16 + Math.random() * 24;
        const x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r;
        if (Math.abs(x) > W.HALF - 4 || Math.abs(z) > W.HALF - 4) continue;
        const v = new V3(x, 0, z); W.resolve(v, 0.5);
        if (Math.hypot(v.x - x, v.z - z) > 0.01) continue;
        pos = { x, z };
      }
    }
    if (!pos) { SIL.spawnT = 8; return; }
    silObj.position.set(pos.x, 0, pos.z); silObj.visible = true;
    SIL.on = true; SIL.seen = 0; SIL.t = 180; SIL.inHouse = S.inHouse;
  }
  function silSeen() {
    const hx = silObj.position.x, hy = 1.75, hz = silObj.position.z;
    if (lookDot(hx, hy, hz) < 0.9) return false;
    const dir = new V3(hx, hy, hz).sub(camera.position);
    const d = dir.length();
    if (d > 70) return false;
    dir.normalize();
    silRay.set(camera.position, dir); silRay.far = d - 0.3;
    const list = S.inHouse ? HM.blockers : W.blockersOut;
    return silRay.intersectObjects(list, false).length === 0;
  }
  function updateSil(dt) {
    if (S.inMine || S.sleeping) { if (SIL.on) hideSil(); return; }
    if (!SIL.on) { SIL.spawnT -= dt; if (SIL.spawnT <= 0) spawnSil(); return; }
    silObj.rotation.y = Math.atan2(player.pos.x - silObj.position.x, player.pos.z - silObj.position.z);
    SIL.t -= dt;
    if (silSeen()) SIL.seen += dt;
    if (SIL.seen > 0.12) {
      hideSil();
      if (Math.random() < 0.5) Sound.whisper();
      S.fear = Math.min(97, S.fear + 4);
    } else if (SIL.inHouse !== S.inHouse || SIL.t <= 0 || Math.hypot(player.pos.x - silObj.position.x, player.pos.z - silObj.position.z) > 95) hideSil();
  }

  // ---------- Туманный остров ----------
  const ISL = Island.build(scene, W);
  const islMark = Util.textSprite('!', '#e04040', 0.9); islMark.visible = false; scene.add(islMark);
  const CUT = { on: false, t: 0, soul: null, from: new V3(), camFrom: new V3() };
  const IS = { birdT: 2, waveT: 3, whisperT: 0 };

  function arriveIsland() {
    S.onIsland = true; S.inCave = false; S.islandStage = 0; S.islandT = 0; S.giantSeen = false;
    player.pos.set(ISL.spawn.x, 0, ISL.spawn.z);
    ISL.misha.position.set(ISL.spawn.x + 2, 0, ISL.spawn.z - 1);
    camYaw = -0.9; camPitch = -0.08;
    msg('Туманный остров... Но тумана нет. Светит солнце.', 7);
    setTimeout(() => say(['Смотри, как красиво!', 'Здесь поют птицы. У нас в деревне птицы давно не пели.', 'Давай погуляем. Я хочу посмотреть на маяк — мама там работала.'], 'Миша'), 2500);
    save();
  }

  function islandQuestText() {
    if (S.inCave) return 'Иди вглубь пещеры. Миша сказал, что мама там.';
    return [
      'Погуляй по острову вместе с Мишей. Загляни на маяк.',
      'Миша хочет тебе что-то сказать. Подойди к нему.',
      'Иди в пещеру на севере острова.'
    ][S.islandStage] || '';
  }

  function talkMishaIsland() {
    if (S.islandStage === 1) {
      say([
        'Ты слышишь? Из горы кто-то зовёт меня по имени.',
        'Это мама. Я знаю её голос.',
        'Нам нужно пойти в пещеру. Прямо сейчас.',
        'Я пойду первым. Догоняй.'
      ], 'Миша', () => { S.islandStage = 2; ISL.misha.visible = false; msg('Миша убежал к пещере на севере острова.', 5); save(); });
    } else if (S.islandStage === 0) {
      say([pickR(['Здесь совсем не страшно.', 'Бабочки! Настоящие!', 'Видишь того, большого, в море? Не смотри на него.', 'Мама говорила, что на острове всегда солнце.']), 'Пойдём к маяку.'], 'Миша');
    }
  }

  function enterCave() {
    fadeTo('Ты заходишь в пещеру...', 1200, () => {
      S.inCave = true;
      player.pos.set(ISL.caveIn.x, 0, ISL.caveIn.z - 1);
      camYaw = 0; camPitch = 0;
      ISL.mishaCave.visible = true;
      ISL.rubble.visible = true;
      Sound.rumble();
      msg('За спиной с грохотом обрушились камни. Выхода больше нет.', 6);
      setTimeout(() => say(['Ты пришёл...', 'Здесь темно. Как у нас в деревне.', 'Мама там, впереди. Иди. Не бойся.'], 'Миша'), 1800);
      save();
    });
  }

  function islandInteraction() {
    const p = player.pos;
    const d = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (S.inCave) return null;
    if (ISL.misha.visible && S.islandStage < 2) {
      const dm = d(ISL.misha.position.x, ISL.misha.position.z);
      if (dm < 2.6) return { label: 'Поговорить с Мишей', fn: talkMishaIsland };
    }
    const dc = d(ISL.caveDoor.x, ISL.caveDoor.z);
    if (dc < 3.5) return S.islandStage >= 2 ? { label: 'Войти в пещеру', fn: enterCave } : { label: 'Тёмная пещера. Изнутри тянет холодом.', fn: null };
    return null;
  }

  // Финал: гигант хватает игрока и забирает душу
  function startCutscene() {
    CUT.on = true; CUT.t = 0;
    if (dialog) { dialog = null; $('dialog').style.display = 'none'; }
    CUT.from.copy(player.pos);
    CUT.camFrom.copy(camera.position);
    Sound.growl(1); setTimeout(() => Sound.growl(1), 1200);
    subtitle('Прости меня... Он обещал вернуть маму.');
    Sound.say('Прости меня. Он обещал вернуть маму.', 1.7, 0.85);
  }
  function updateCutscene(dt) {
    CUT.t += dt;
    const t = CUT.t, g = ISL.caveMonster, u = g.userData;
    const k1 = clamp(t / 1.6, 0, 1);
    u.armR.rotation.x = -k1 * 1.5; u.armL.rotation.x = -k1 * 0.6;
    u.head.rotation.x = k1 * 0.3;
    const head = new V3(); u.head.getWorldPosition(head);
    const k2 = clamp((t - 1.6) / 2.2, 0, 1), e2 = k2 * k2 * (3 - 2 * k2);
    const hold = new V3(head.x, head.y - 2.5, head.z + 4.5);
    player.pos.lerpVectors(CUT.from, hold, e2);
    const m = player.model;
    m.visible = true;
    m.position.copy(player.pos); m.rotation.y = Math.PI;
    const w = Math.sin(t * 14);
    m.userData.armL.rotation.x = -2.6 + w * 0.5; m.userData.armR.rotation.x = -2.6 - w * 0.5;
    m.userData.legL.rotation.x = w * 0.6 * (1 - k1 * 0.3); m.userData.legR.rotation.x = -w * 0.6;
    // камера — сбоку, чтобы видеть руку и лицо чудовища
    const camTo = new V3(player.pos.x + 9, player.pos.y + 2.5, player.pos.z + 8);
    camera.position.lerpVectors(CUT.camFrom, camTo, clamp(t / 2.5, 0, 1));
    camera.lookAt((player.pos.x + head.x) / 2, (player.pos.y + 1 + head.y) / 2, (player.pos.z + head.z) / 2);
    camera.fov = 60; camera.updateProjectionMatrix();
    if (t > 1.6 && t < 1.7) { Sound.scream(0.8); redT = 0.6; }
    // душа улетает в пасть
    if (t > 4.2 && !CUT.soul) {
      CUT.soul = Util.glowSprite(0x80d0ff, 1.8, 1); scene.add(CUT.soul);
      Sound.whisper(); Sound.chime();
    }
    if (CUT.soul) {
      const k3 = clamp((t - 4.2) / 2.4, 0, 1);
      const chest = new V3(player.pos.x, player.pos.y + 1.3, player.pos.z);
      const mouth = new V3(head.x, head.y - 0.8, head.z + 1.5);
      CUT.soul.position.lerpVectors(chest, mouth, k3 * k3);
      CUT.soul.scale.setScalar(1.8 - k3 * 1.2);
      m.userData.armL.rotation.x = Util.lerp(m.userData.armL.rotation.x, 0.2, k3);
      m.userData.armR.rotation.x = Util.lerp(m.userData.armR.rotation.x, 0.2, k3);
      if (k3 >= 1) CUT.soul.visible = false;
    }
    if (t > 6.2) { const f = $('fade'); f.style.transition = 'opacity 1.5s'; f.style.opacity = '1'; $('fadeText').textContent = ''; }
    if (t > 8.2 && state === 'play') finishGame();
  }
  function finishGame() {
    state = 'ending';
    CUT.on = false;
    addStat('wins');
    clearSave();
    Sound.engine(false);
    document.exitPointerLock();
    $('hud').classList.add('hidden');
    $('endTitle').textContent = 'КОНЕЦ';
    $('endText').innerHTML = `
      <p>Огромная рука сомкнулась вокруг тебя. Последнее, что ты увидел, — голубой огонёк. Твоя душа улетела в пасть чудовища.</p>
      <p>Пожиратель душ ждал на этом острове очень долго. Он знал: мальчик приведёт того, кто о нём заботится.</p>
      <p>«Он обещал, что вернёт маму», — плакал Миша в темноте.</p>
      <p>Но на острове больше никогда не светило солнце.</p>`;
    $('ending').classList.remove('hidden');
    setTimeout(() => { $('fade').style.opacity = '0'; }, 500);
  }

  function updateIsland(dt) {
    S.islandT += dt;
    const tt = performance.now() / 1000;
    ISL.update(dt, tt);
    if (CUT.on) { updateCutscene(dt); islandEnv(); return; }
    updatePlayer(dt);
    updateCamera(dt);
    islandEnv();
    // Миша ходит рядом
    const mi = ISL.misha;
    if (!S.inCave && mi.visible) {
      const dx = player.pos.x - mi.position.x, dz = player.pos.z - mi.position.z, d = Math.hypot(dx, dz);
      let sp = 0;
      if (d > 30) { mi.position.set(player.pos.x - dx / d * 3, 0, player.pos.z - dz / d * 3); }
      else if (d > 3) { sp = Math.min(6.5, d * 1.5); mi.position.x += dx / d * sp * dt; mi.position.z += dz / d * sp * dt; }
      const v = new V3(mi.position.x, 0, mi.position.z); W.resolve(v, 0.3); mi.position.copy(v);
      mi.rotation.y = Util.lerpAngle(mi.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5));
      Models.walkAnim(mi, tt * 9, sp > 0 ? 1 : 0);
      islMark.visible = S.islandStage === 1;
      islMark.position.set(mi.position.x, 1.75 + Math.sin(tt * 3) * 0.06, mi.position.z);
    } else islMark.visible = false;
    // этапы
    if (S.islandStage === 0 && !S.inCave) {
      if (Math.hypot(player.pos.x - ISL.lighthouse.x, player.pos.z - ISL.lighthouse.z) < 9 || S.islandT > 170) {
        S.islandStage = 1; Sound.chime();
        msg('Миша замер и прислушался. Кажется, он хочет что-то сказать.', 6);
      }
    }
    if (!S.giantSeen && !S.inCave) {
      const h = new V3(); ISL.giant.userData.head.getWorldPosition(h);
      if (lookDot(h.x, h.y, h.z) > 0.96) { S.giantSeen = true; Sound.growl(0.35); msg('Вдалеке, прямо по морю, шагает что-то огромное...', 6); }
    }
    // пещера
    if (S.inCave) {
      const mc = ISL.mishaCave;
      mc.rotation.y = Math.atan2(player.pos.x - mc.position.x, player.pos.z - mc.position.z);
      const dMon = Math.hypot(player.pos.x - ISL.CX, player.pos.z - (ISL.CZ - 14));
      IS.whisperT -= dt;
      if (IS.whisperT <= 0 && dMon < 34) { IS.whisperT = 6; const l = pickR(['Ближе...', 'Иди ко мне...', 'Мы так долго ждали...']); Sound.voice(l); subtitle(l); }
      if (player.pos.z > ISL.CZ + 24.5) msg('Выход завален камнями.', 2);
      if (dMon < 17 && !dialog) startCutscene();
    }
    current = islandInteraction();
    // звуки острова
    if (!S.inCave) {
      IS.birdT -= dt;
      if (IS.birdT <= 0) { IS.birdT = 0.8 + Math.random() * 2.5; Sound.bird(); }
      IS.waveT -= dt;
      if (IS.waveT <= 0) { IS.waveT = 4 + Math.random() * 3; Sound.wave(); }
      ISL.giantState.stepT -= dt;
      if (ISL.giantState.stepT <= 0) {
        ISL.giantState.stepT = 3.4;
        const gd = Math.hypot(player.pos.x - ISL.giant.position.x, player.pos.z - ISL.giant.position.z);
        Sound.boom(Math.max(0.08, 0.5 - gd / 600));
      }
    }
    S.fear = S.inCave ? Math.min(90, S.fear + dt * 2) : Math.max(0, S.fear - dt * 4);
    Sound.update(dt, S.inCave ? 1 : 0, S.fear, false, !S.inCave);
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      updateHUD(0);
      $('dayLabel').textContent = S.inCave ? 'Пещера' : '🏝 Туманный остров';
      $('timeText').textContent = '';
      $('timefill').style.width = '0%';
      $('quest').className = '';
      $('quest').innerHTML = `<div class="t">Остров</div>${islandQuestText()}`;
      $('goal').textContent = '';
    }
    mapT -= dt; if (mapT <= 0) { mapT = 0.15; drawIslandMap(); }
    saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  }

  function islandEnv() {
    moon.visible = moonGlow.visible = stars.visible = false;
    monsterLight.intensity = 0;
    if (S.inCave) {
      scene.fog.color.setHex(0x040308); scene.background.setHex(0x000000); scene.fog.density = 0.022;
      hemi.color.setHex(0x8a90c0); hemi.groundColor.setHex(0x100818); hemi.intensity = 0.35;
      sun.intensity = 0;
    } else {
      scene.fog.color.setHex(0xa8d8f4); scene.background.setHex(0x8ccaf2); scene.fog.density = 0.0024;
      hemi.color.setHex(0xdcefff); hemi.groundColor.setHex(0x6a8a4a); hemi.intensity = 0.82;
      sun.color.setHex(0xfff0d0); sun.intensity = 0.75;
      flash.intensity = 0; flashFill.intensity = 0;
    }
  }

  function drawIslandMap() {
    const s = 180 / 420, X = x => (x - ISL.IX + 210) * s, Y = z => (z - ISL.IZ + 210) * s;
    mg.fillStyle = '#1a5a8a'; mg.fillRect(0, 0, 180, 180);
    if (S.inCave) {
      mg.fillStyle = '#05040a'; mg.fillRect(0, 0, 180, 180);
      mg.fillStyle = '#6a5aa0'; mg.font = '14px Georgia'; mg.textAlign = 'center'; mg.fillText('ПЕЩЕРА', 90, 95); mg.textAlign = 'start';
      return;
    }
    mg.fillStyle = '#e2cc92'; mg.beginPath(); mg.arc(X(ISL.IX), Y(ISL.IZ), (ISL.R + 12) * s, 0, 7); mg.fill();
    mg.fillStyle = '#5a9a46'; mg.beginPath(); mg.arc(X(ISL.IX), Y(ISL.IZ), ISL.R * s, 0, 7); mg.fill();
    mg.fillStyle = '#8a847a'; mg.beginPath(); mg.arc(X(ISL.IX), Y(ISL.IZ - 74), 26 * s, 0, 7); mg.fill();
    mg.fillStyle = '#c0402a'; ISL.houses.forEach(h => mg.fillRect(X(h.x) - 2, Y(h.z) - 2, 4, 4));
    mg.fillStyle = '#fff'; mg.fillRect(X(ISL.lighthouse.x) - 2, Y(ISL.lighthouse.z) - 2, 4, 4);
    mg.fillStyle = '#eee'; mg.fillRect(X(ISL.plane.x) - 5, Y(ISL.plane.z) - 1, 10, 2);
    if (S.islandStage >= 2) { mg.fillStyle = '#e0c040'; mg.beginPath(); mg.arc(X(ISL.caveDoor.x), Y(ISL.caveDoor.z), 3.5, 0, 7); mg.fill(); }
    else if (S.islandStage === 0) { mg.fillStyle = '#e0c040'; mg.beginPath(); mg.arc(X(ISL.lighthouse.x), Y(ISL.lighthouse.z), 3.5, 0, 7); mg.fill(); }
    if (ISL.misha.visible) { mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(X(ISL.misha.position.x), Y(ISL.misha.position.z), 2.5, 0, 7); mg.fill(); }
    const gx = X(ISL.giant.position.x), gy = Y(ISL.giant.position.z);
    if (gx > 0 && gx < 180 && gy > 0 && gy < 180) { mg.fillStyle = '#300'; mg.beginPath(); mg.arc(gx, gy, 4, 0, 7); mg.fill(); }
    drawArrow(X(player.pos.x), Y(player.pos.z));
  }

  // ================= ЧАСТЬ ВТОРАЯ: РАЙ =================
  const H2 = Heaven.build(scene, W);
  const SAVE2 = 'soul_eater_save2_v1';
  const BELL_SEQ = [0, 2, 1, 3, 2];
  const BELL_F = [523.3, 659.3, 784, 987.8];
  const UPV = new V3(0, 1, 0);
  const P2 = {};
  function resetP2() {
    Object.assign(P2, {
      stage: 'heaven', shards: [false, false, false], solved: [false, false, false], placed: false, met: false,
      hp: 100, bossHp: 100, bellInput: 0, melody: null, reveal: 0, falling: false, shake: 0,
      checkpoint: { x: H2.spawn.x, z: H2.spawn.z }, intro: null, introTimer: null,
      boss: { state: 'idle', t: 3, tx: 0, tz: 0, orbT: 4 }, dying: null
    });
  }
  resetP2();

  function readSave2() { try { const d = JSON.parse(localStorage.getItem(SAVE2)); return d && d.v === 1 ? d : null; } catch (e) { return null; } }
  function clearSave2() { try { localStorage.removeItem(SAVE2); } catch (e) { /* ignore */ } }
  function saveP2() {
    if (!S.part2 || P2.dying || state === 'ending') return;
    try {
      localStorage.setItem(SAVE2, JSON.stringify({
        v: 1, shards: P2.shards, solved: P2.solved, placed: P2.placed, met: P2.met,
        rot: H2.statues.map(s => s.goal), arena: P2.stage === 'arena',
        pos: [P2.checkpoint.x, P2.checkpoint.z]
      }));
    } catch (e) { /* ignore */ }
  }

  function applyP2World() {
    H2.shards.forEach((s, i) => { s.visible = P2.solved[i] && !P2.shards[i]; });
    H2.beam.visible = P2.solved[1];
    H2.sockets.forEach(s => s.material.color.setHex(P2.placed ? 0x9ad8ff : 0x555566));
    H2.doors.forEach((d, i) => { d.rotation.y = P2.placed ? (i === 0 ? -1.6 : 1.6) : 0; });
    H2.doorBox.on = !P2.placed; H2.portal.visible = P2.placed;
    resetBossVisuals();
  }
  function resetBossVisuals() {
    const b = H2.boss;
    b.position.set(H2.BX, -9, H2.BZ - 40); b.rotation.set(0, 0, 0); b.scale.setScalar(3.6); b.visible = true;
    H2.soul.visible = true;
    if (H2.soul.parent !== b.userData.body) { scene.remove(H2.soul); b.userData.body.add(H2.soul); H2.soul.position.set(0, 1.4, 0.4); H2.soul.scale.set(1.2, 1.2, 1); }
    H2.claw.visible = false; H2.ring.visible = false; H2.disc.visible = false;
    H2.orbs.forEach(o => { o.on = false; o.s.visible = false; });
    H2.pillars.forEach(p => { p.cd = 0; p.ray.visible = false; });
  }
  function makeGhost() {
    player.model.traverse(o => {
      if (o.isMesh && !o.userData.ghost) {
        o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.userData.ghost = true;
      }
    });
  }

  function startPart2(cont) {
    Sound.init(); goFullscreen();
    const d = cont ? readSave2() : null;
    if (!cont) clearSave2();
    S = newState(); S.part2 = true; S.introDone = true; S.flashlight = false;
    S.quest = { kind: 'none', text: '', done: true };
    resetP2();
    if (d) {
      P2.shards = d.shards; P2.solved = d.solved; P2.placed = d.placed; P2.met = d.met;
      if (d.rot) H2.statues.forEach((s, i) => { s.angle = s.goal = d.rot[i]; s.g.rotation.y = s.angle; });
    }
    applyP2World();
    makeGhost();
    ['title', 'part2'].forEach(id => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    $('bars').querySelector('.lbl').textContent = 'Свет души';
    if (d && d.arena) enterArena(true);
    else if (d) { player.pos.set(d.pos[0], 0, d.pos[1]); P2.checkpoint = { x: d.pos[0], z: d.pos[1] }; camYaw = 0; Sound.pad(true); msg('С возвращением в рай.', 4); }
    else { player.pos.set(H2.spawn.x, 0, H2.spawn.z); camYaw = 0; camPitch = -0.1; startIntro(); }
    state = 'paused';
    requestLock();
  }

  // ---------- заставка ----------
  function introText(txt) {
    const el = $('introText'); el.textContent = txt; el.style.opacity = '1';
    clearTimeout(P2.introTimer); P2.introTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }
  function startIntro() {
    P2.intro = { t: 0, ev: {} };
    const f = $('fade'); f.style.transition = 'none'; f.style.opacity = '1'; $('fadeText').textContent = '';
    $('skipHint').style.opacity = '1';
    $('hud').classList.add('hidden');
  }
  function endIntro() {
    if (!P2.intro) return;
    P2.intro = null;
    $('titleCard').classList.remove('on'); $('skipHint').style.opacity = '0'; $('introText').style.opacity = '0';
    const f = $('fade'); f.style.transition = 'opacity .6s'; f.style.opacity = '0';
    camYaw = 0; camPitch = -0.1; camera.fov = 70; camera.updateProjectionMatrix();
    $('hud').classList.remove('hidden');
    Sound.pad(true);
    setTimeout(() => msg('Ты в раю. Рядом стоит кто-то в белом.', 5), 600);
  }
  function updateIntro(dt) {
    const it = P2.intro; it.t += dt;
    const t = it.t;
    const once = (k, at, fn) => { if (t >= at && !it.ev[k]) { it.ev[k] = true; fn(); } };
    once('a', 0.6, () => introText('Тьма...'));
    once('b', 2.4, () => introText('Холод. Пустота. Внутри чего-то не хватает.'));
    once('c', 4.8, () => {
      const f = $('fade'); f.style.transition = 'opacity 2.5s'; f.style.opacity = '0';
      screenFlash('#ffffff', 1.2); Sound.chime(); Sound.pad(true); introText('Потом — свет.');
    });
    once('d', 7, () => $('titleCard').classList.add('on'));
    once('e', 11.6, () => $('titleCard').classList.remove('on'));
    once('f', 13.2, () => introText('У тебя больше нет души. Её держит Пожиратель.'));
    // полёт камеры сквозь облака к островам
    const p0 = new V3(H2.HX + 90, -45, H2.HZ + 160), p1 = new V3(H2.HX + 40, 28, H2.HZ + 70);
    const p2 = new V3(player.pos.x, 2.3, player.pos.z + 4.6);
    let look;
    if (t < 12.5) {
      const k = clamp((t - 4.8) / 7.7, 0, 1), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(p0, p1, e);
      look = new V3(H2.HX, Util.lerp(-10, 2, e), H2.HZ - 10);
    } else {
      const k = clamp((t - 12.5) / 3.5, 0, 1), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(p1, p2, e);
      look = new V3(player.pos.x, 1.5, player.pos.z - 10 * e);
    }
    camera.lookAt(look);
    camera.fov = 62; camera.updateProjectionMatrix();
    const m = player.model; m.visible = true; m.position.copy(player.pos); m.rotation.y = Math.PI;
    Models.walkAnim(m, 0, 0);
    heavenEnv();
    if (t >= 16.6) endIntro();
  }

  // ---------- Хранитель ----------
  function talkGuardian() {
    if (!P2.met) {
      P2.met = true;
      say([
        'Здравствуй, путник. Ты здесь... но ты неполный.',
        'Твоя душа у того, кто её съел. Он прячется в Бездне, за Золотыми вратами.',
        'Врата откроются, только если в них сияют три осколка света.',
        'Первый осколок — у колоколов на западе. Второй — у статуй на востоке. Третий — за невидимым мостом на севере.',
        'Иди. И помни: в раю тоже можно упасть.'
      ], 'Хранитель', () => saveP2());
      return;
    }
    const n = P2.shards.filter(Boolean).length;
    if (P2.placed) { say(['Врата открыты. Он ждёт тебя внизу.', 'Бей по его руке, когда она лежит на земле. И зажигай столпы света.'], 'Хранитель'); return; }
    if (n === 3) { say(['Три осколка сияют у тебя в руках.', 'Иди к Золотым вратам на юге.'], 'Хранитель'); return; }
    const hints = [];
    if (!P2.shards[0]) hints.push('Колокола на западе помнят мелодию. Послушай её и повтори.');
    if (!P2.shards[1]) hints.push('Статуи на востоке отвернулись от света. Прочитай табличку у фонтана.');
    if (!P2.shards[2]) hints.push('Камень памяти на севере покажет путь по мосту. Запоминай быстро.');
    say([`У тебя ${n} из 3 осколков.`, pickR(hints)], 'Хранитель');
  }

  // ---------- головоломки ----------
  function solvePuzzle(k) {
    P2.solved[k] = true;
    H2.shards[k].visible = true;
    Sound.chime();
    msg(['Колокола отозвались. Над подставкой засиял осколок света!', 'Статуи смотрят на свет. Из фонтана поднялся осколок!', 'Ты прошёл невидимый мост. Осколок ждёт тебя на постаменте.'][k], 6);
    if (k === 1) H2.beam.visible = true;
    saveP2();
  }
  function takeShard(i) {
    P2.shards[i] = true; H2.shards[i].visible = false;
    Sound.chime(); Sound.whisper();
    const n = P2.shards.filter(Boolean).length;
    msg(`Осколок света! (${n}/3)`, 4);
    if (n === 3) setTimeout(() => msg('Все осколки у тебя! Иди к Золотым вратам на юге.', 6), 1500);
    saveP2();
  }
  function ringBell(i, auto) {
    const b = H2.bells[i];
    b.swing = 1; Sound.bellNote(BELL_F[i]);
    if (auto || P2.solved[0] || P2.melody) return;
    if (i === BELL_SEQ[P2.bellInput]) {
      P2.bellInput++;
      if (P2.bellInput >= BELL_SEQ.length) solvePuzzle(0);
    } else {
      P2.bellInput = 0; Sound.buzz();
      msg('Неверно. Послушай мелодию ещё раз.', 3);
    }
  }
  function playMelody() { P2.melody = { i: 0, t: 0.5 }; P2.bellInput = 0; msg('Слушай внимательно...', 3); }
  function turnStatue(s) { if (Math.abs(s.goal - s.angle) > 0.05) return; s.goal += Math.PI / 2; Sound.dig(); }
  function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function revealPath() { P2.reveal = 4; Sound.whisper(); Sound.bellNote(784); msg('Путь светится! Запоминай...', 3); }
  function openGate() {
    P2.placed = true;
    H2.sockets.forEach(s => s.material.color.setHex(0x9ad8ff));
    H2.doorBox.on = false; H2.portal.visible = true;
    Sound.rumble(); Sound.chime();
    msg('Осколки встали на место. Врата открываются... За ними — Бездна.', 6);
    saveP2();
  }

  function fall() {
    P2.falling = true;
    const t = H2.tileAt(player.pos.x, player.pos.z);
    if (t && !t.real) { t.flash = 1; Sound.snap(); }
    Sound.whisper();
    fadeTo(P2.stage === 'arena' ? 'Ты сорвался в Бездну...' : 'Ты падаешь сквозь облака...', 700, () => {
      player.pos.set(P2.stage === 'arena' ? H2.arenaSpawn.x : P2.checkpoint.x, 0, P2.stage === 'arena' ? H2.arenaSpawn.z : P2.checkpoint.z);
      if (P2.stage === 'arena') hurt(15);
      P2.falling = false;
    });
  }

  function heavenInteraction() {
    const p = player.pos;
    const d = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (P2.stage === 'arena') {
      const B = P2.boss;
      if (B.state === 'down' && d(H2.claw.position.x, H2.claw.position.z) < 4.4) return { label: 'Ударить по руке светом', fn: strikeHand };
      for (const pl of H2.pillars) if (d(pl.x, pl.z) < 2.7) return pl.cd <= 0 ? { label: 'Зажечь столп света', fn: () => firePillar(pl) } : { label: `Столп заряжается... ${Math.ceil(pl.cd)}`, fn: null };
      return null;
    }
    const g = H2.guardian.position;
    if (d(g.x, g.z) < 3) return { label: 'Поговорить с Хранителем', fn: talkGuardian };
    for (let i = 0; i < 3; i++) { const s = H2.shards[i]; if (s.visible && d(s.position.x, s.position.z) < (i === 1 ? 4 : 2.3)) return { label: 'Взять осколок света', fn: () => takeShard(i) }; }
    if (d(H2.bellStand.x, H2.bellStand.z) < 2) {
      if (P2.solved[0]) return null;
      return P2.melody ? { label: 'Слушай...', fn: null } : { label: 'Послушать мелодию колоколов', fn: playMelody };
    }
    for (let i = 0; i < 4; i++) { const b = H2.bells[i]; if (d(b.x, b.z) < 1.5) return { label: 'Ударить в колокол', fn: () => ringBell(i, false) }; }
    if (d(H2.plaque.x, H2.plaque.z) < 2) return { label: 'Прочитать табличку', fn: () => msg('«Все четверо должны смотреть на свет».', 5) };
    if (!P2.solved[1]) for (const s of H2.statues) if (d(s.x, s.z) < 2.4) return { label: 'Повернуть статую', fn: () => turnStatue(s) };
    if (d(H2.stone.x, H2.stone.z) < 2.3) return { label: 'Прикоснуться к камню памяти', fn: revealPath };
    if (d(H2.gate.x, H2.gate.z) < 4.5) {
      if (P2.placed) return null;
      const n = P2.shards.filter(Boolean).length;
      return n === 3 ? { label: 'Вставить осколки света', fn: openGate } : { label: `Золотые врата закрыты. Осколков: ${n}/3`, fn: null };
    }
    return null;
  }

  // ---------- Бездна: битва ----------
  function enterArena(fromLoad) {
    const go = () => {
      P2.stage = 'arena'; P2.hp = 100; P2.bossHp = 100;
      resetBossVisuals();
      player.pos.set(H2.arenaSpawn.x, 0, H2.arenaSpawn.z); camYaw = 0; camPitch = 0.05;
      player.vy = 0; player.grounded = true; player.model.position.copy(player.pos);
      P2.falling = false; setTimeout(() => { P2.entering = false; }, 700);
      P2.boss = { state: 'intro', t: 5, tx: 0, tz: 0, orbT: 4 };
      $('bossBar').classList.remove('hidden');
      Sound.pad(false); Sound.growl(1);
      subtitle('Ты пришёл за своей душой? Попробуй забрать!');
      Sound.say('Ты пришёл за своей душой? Попробуй забрать!', 0.1, 0.8);
      setTimeout(() => msg('Уходи из красного круга! Когда рука лежит на земле — бей по ней светом (E).', 7), 2500);
      setTimeout(() => msg('Светящиеся столбы тоже помогают: подойди и нажми E.', 7), 6500);
      saveP2();
    };
    if (fromLoad) go(); else fadeTo('Ты шагаешь сквозь врата... и падаешь в темноту.', 1200, go);
  }
  function hurt(n) {
    P2.hp = Math.max(0, P2.hp - n);
    redT = 0.6; screenFlash('#900', 0.5); Sound.heartbeat(0.5);
  }
  function startTele() {
    const B = P2.boss;
    B.state = 'tele'; B.t = P2.bossHp <= 50 ? 1.0 : 1.35;
    B.tx = player.pos.x; B.tz = player.pos.z;
    H2.ring.position.set(B.tx, 0.06, B.tz); H2.disc.position.set(B.tx, 0.05, B.tz);
    H2.ring.visible = H2.disc.visible = true;
    Sound.growl(0.4);
  }
  function strikeHand() {
    const B = P2.boss;
    if (B.state !== 'down') return;
    swing(); Sound.mineHit();
    P2.bossHp -= 5; B.flash = 0.15;
    if (Math.random() < 0.4) Sound.growl(0.5);
    if (P2.bossHp <= 0) bossDie();
  }
  function firePillar(pl) {
    pl.cd = 25; pl.rayT = 0.7;
    const a = pl.cry.position, b = new V3(); H2.soul.getWorldPosition(b);
    const dir = b.clone().sub(a), len = dir.length();
    pl.ray.position.copy(a).addScaledVector(dir, 0.5);
    pl.ray.scale.set(1, len, 1);
    pl.ray.quaternion.setFromUnitVectors(UPV, dir.normalize());
    pl.ray.visible = true;
    Sound.chime(); Sound.growl(0.9); screenFlash('#fff4c0', 0.4);
    P2.bossHp -= 12;
    if (P2.bossHp <= 0) bossDie();
  }
  function spawnOrb() {
    const o = H2.orbs.find(x => !x.on); if (!o) return;
    const h = new V3(); H2.boss.userData.head.getWorldPosition(h);
    o.on = true; o.t = 7; o.s.visible = true; o.s.position.copy(h);
    const dir = new V3(player.pos.x - h.x, 1.2 - h.y, player.pos.z - h.z).normalize();
    o.vx = dir.x * 7; o.vy = dir.y * 7; o.vz = dir.z * 7;
    Sound.whisper();
  }
  function p2Die() {
    P2.boss.state = 'wait';
    fadeTo('Тьма поглотила тебя... Но свет ещё не погас.', 1600, () => {
      P2.hp = 100; P2.bossHp = 100; resetBossVisuals();
      player.pos.set(H2.arenaSpawn.x, 0, H2.arenaSpawn.z); camYaw = 0;
      P2.boss = { state: 'idle', t: 3, tx: 0, tz: 0, orbT: 4 };
    });
  }
  function bossDie() {
    P2.bossHp = 0;
    P2.boss.state = 'dead';
    P2.dying = { t: 0, soulFrom: null };
    H2.claw.visible = false; H2.ring.visible = H2.disc.visible = false;
    H2.orbs.forEach(o => { o.on = false; o.s.visible = false; });
    $('bossBar').classList.add('hidden');
    Sound.scream(1); Sound.growl(1);
    subtitle('Не-е-ет... Это... моя... душа...');
  }
  function updateDying(dt) {
    const D = P2.dying; D.t += dt;
    const b = H2.boss;
    b.position.y = -9 - D.t * 2.2; b.rotation.z = Math.sin(D.t * 3) * 0.08 + D.t * 0.05;
    if (D.t > 2) b.scale.setScalar(Math.max(0.01, 3.6 * (1 - (D.t - 2) / 3)));
    P2.shake = D.t < 3 ? 0.6 : 0;
    if (D.t > 1.5 && !D.soulFrom) {
      D.soulFrom = new V3(); H2.soul.getWorldPosition(D.soulFrom);
      b.userData.body.remove(H2.soul); scene.add(H2.soul); H2.soul.position.copy(D.soulFrom);
      H2.soul.scale.set(2.5, 2.5, 1);
      Sound.chime(); Sound.whisper();
    }
    if (D.soulFrom) {
      const k = clamp((D.t - 1.5) / 2.6, 0, 1), e = k * k * (3 - 2 * k);
      const to = new V3(player.pos.x, 1.3, player.pos.z);
      H2.soul.position.lerpVectors(D.soulFrom, to, e);
      H2.soul.position.y += Math.sin(k * Math.PI) * 6;
      if (k >= 1 && !D.got) {
        D.got = true; H2.soul.visible = false;
        player.model.traverse(o => { if (o.isMesh && o.userData.ghost) o.material.opacity = 1; });
        screenFlash('#bfe8ff', 1.2); Sound.chime();
        msg('Твоя душа вернулась!', 5);
      }
    }
    if (D.t > 5.6 && !D.white) { D.white = true; const f = $('fade'); f.style.background = '#fff'; f.style.transition = 'opacity 2s'; f.style.opacity = '1'; $('fadeText').textContent = ''; }
    if (D.t > 8 && state === 'play') finishPart2();
  }
  function finishPart2() {
    state = 'ending';
    addStat('wins2');
    clearSave2();
    Sound.pad(false);
    document.exitPointerLock();
    $('hud').classList.add('hidden');
    $('endTitle').textContent = 'ТЫ ВЕРНУЛ СВОЮ ДУШУ';
    $('endText').innerHTML = `
      <p>Голубой огонёк вернулся в твою грудь. Стало тепло. Ты снова целый.</p>
      <p>Облака расступились, и ты полетел вниз — туда, где остался мир живых.</p>
      <p>Ты открываешь глаза. Деревня. Утро. Колодец.</p>
      <p>У колодца стоит Миша. Он улыбается — слишком широко.</p>
      <p>«Ты вернулся, — говорит он чужим, низким голосом. — Я знал, что ты вернёшься».</p>
      <p>А в глубине его глаз горит маленький красный огонёк...</p>
      <p style="color:#d0a030;letter-spacing:4px;margin-top:22px">ПРОДОЛЖЕНИЕ СЛЕДУЕТ</p>`;
    $('ending').classList.remove('hidden');
    setTimeout(() => { const f = $('fade'); f.style.opacity = '0'; setTimeout(() => { f.style.background = '#000'; }, 1200); }, 400);
  }

  function updateBoss(dt) {
    const B = P2.boss, b = H2.boss, bu = b.userData;
    const tt = performance.now() / 1000;
    const phase2 = P2.bossHp <= 50;
    B.t -= dt;
    // голова следит за игроком
    const hp = new V3(); bu.head.getWorldPosition(hp);
    bu.head.rotation.y = Util.lerpAngle(bu.head.rotation.y, clamp(Math.atan2(player.pos.x - hp.x, player.pos.z - hp.z), -0.8, 0.8), Math.min(1, dt * 2));
    bu.body.scale.y = 1 + Math.sin(tt * 1.2) * 0.02;
    const claw = H2.claw;
    switch (B.state) {
      case 'intro':
        bu.armL.rotation.x = -0.6 + Math.sin(tt * 2) * 0.3; bu.armR.rotation.x = -0.6 - Math.sin(tt * 2) * 0.3;
        if (B.t <= 0) { B.state = 'idle'; B.t = 1.2; }
        break;
      case 'idle':
        bu.armR.rotation.x = Util.lerp(bu.armR.rotation.x, -0.3, dt * 3); bu.armL.rotation.x = Util.lerp(bu.armL.rotation.x, -0.2, dt * 3);
        if (B.t <= 0) startTele();
        break;
      case 'tele': {
        bu.armR.rotation.x = Util.lerp(bu.armR.rotation.x, -2.6, dt * 5);
        const p = 0.6 + Math.sin(tt * 18) * 0.3;
        H2.ring.material.opacity = p; H2.disc.material.opacity = 0.12 + p * 0.15;
        if (B.t <= 0) { B.state = 'slam'; B.t = 0.3; claw.visible = true; claw.rotation.y = Math.atan2(B.tx - b.position.x, B.tz - b.position.z); }
        break;
      }
      case 'slam': {
        const k = 1 - Math.max(0, B.t) / 0.3;
        claw.position.set(B.tx, 24 - k * 23.4, B.tz);
        bu.armR.rotation.x = Util.lerp(-2.6, -1.0, k);
        if (B.t <= 0) {
          H2.ring.visible = H2.disc.visible = false;
          Sound.boom(0.9); P2.shake = 0.5;
          if (Math.hypot(player.pos.x - B.tx, player.pos.z - B.tz) < 3.7) hurt(25);
          B.state = 'down'; B.t = 2.6;
        }
        break;
      }
      case 'down': {
        const glow = 0.6 + Math.sin(tt * 8) * 0.3;
        H2.weak.material.opacity = glow;
        H2.weakGem.material.color.setHex(B.flash > 0 ? 0xffffff : 0x80d0ff);
        if (B.flash > 0) B.flash -= dt;
        if (B.t <= 0) { B.state = 'up'; B.t = 0.6; H2.weak.material.opacity = 0; }
        break;
      }
      case 'up': {
        const k = 1 - Math.max(0, B.t) / 0.6;
        claw.position.y = 0.6 + k * 24;
        if (B.t <= 0) { claw.visible = false; B.state = 'idle'; B.t = phase2 ? (Math.random() < 0.4 ? 0.25 : 1.3) : 2.2; }
        break;
      }
    }
    // тёмные шары во второй фазе
    if (phase2 && ['idle', 'tele', 'down', 'up'].includes(B.state)) {
      B.orbT -= dt;
      if (B.orbT <= 0) { B.orbT = 3.2; spawnOrb(); }
    }
    H2.orbs.forEach(o => {
      if (!o.on) return;
      const dx = player.pos.x - o.s.position.x, dy = 1.2 - o.s.position.y, dz = player.pos.z - o.s.position.z;
      const dd = Math.hypot(dx, dy, dz) || 1;
      o.vx = Util.lerp(o.vx, dx / dd * 7, dt * 1.2); o.vy = Util.lerp(o.vy, dy / dd * 7, dt * 1.2); o.vz = Util.lerp(o.vz, dz / dd * 7, dt * 1.2);
      o.s.position.x += o.vx * dt; o.s.position.y += o.vy * dt; o.s.position.z += o.vz * dt;
      o.t -= dt;
      if (dd < 1.3) { hurt(12); o.on = false; o.s.visible = false; }
      else if (o.t <= 0) { o.on = false; o.s.visible = false; }
    });
    H2.pillars.forEach(pl => {
      pl.cd = Math.max(0, pl.cd - dt);
      pl.gl.material.opacity = pl.cd <= 0 ? 0.6 + Math.sin(tt * 4) * 0.2 : 0.1;
      pl.cry.material.color.setHex(pl.cd <= 0 ? 0xfff0a0 : 0x5a5040);
      if (pl.rayT > 0) { pl.rayT -= dt; if (pl.rayT <= 0) pl.ray.visible = false; }
    });
    if (P2.hp <= 0 && B.state !== 'wait') p2Die();
  }

  function heavenEnv() {
    moon.visible = moonGlow.visible = stars.visible = false;
    monsterLight.intensity = 0; flash.intensity = 0; flashFill.intensity = 0;
    if (P2.stage === 'arena') {
      scene.fog.color.setHex(0x1a0510); scene.background.setHex(0x0a0206); scene.fog.density = 0.01;
      hemi.color.setHex(0x9a70b0); hemi.groundColor.setHex(0x200010); hemi.intensity = 0.7;
      sun.color.setHex(0xff9060); sun.intensity = 0.35;
    } else {
      scene.fog.color.setHex(0xfbf0d8); scene.background.setHex(0xfbf0d8); scene.fog.density = 0.004;
      hemi.color.setHex(0xfff4e0); hemi.groundColor.setHex(0xb8a080); hemi.intensity = 0.72;
      sun.color.setHex(0xffe8c0); sun.intensity = 0.5;
    }
  }

  function drawHeavenMap() {
    mg.fillStyle = P2.stage === 'arena' ? '#0a0206' : '#f4e8cc'; mg.fillRect(0, 0, 180, 180);
    if (P2.stage === 'arena') {
      const s = 180 / 90, X = x => (x - H2.BX + 45) * s, Y = z => (z - H2.BZ + 45) * s;
      mg.fillStyle = '#2a1a2a'; mg.beginPath(); mg.arc(X(H2.BX), Y(H2.BZ), H2.BR * s, 0, 7); mg.fill();
      H2.pillars.forEach(p => { mg.fillStyle = p.cd <= 0 ? '#fff0a0' : '#5a5040'; mg.fillRect(X(p.x) - 3, Y(p.z) - 3, 6, 6); });
      if (H2.ring.visible) { mg.strokeStyle = '#f22'; mg.lineWidth = 2; mg.beginPath(); mg.arc(X(H2.ring.position.x), Y(H2.ring.position.z), 3.6 * s, 0, 7); mg.stroke(); }
      drawArrow(X(player.pos.x), Y(player.pos.z));
      return;
    }
    const s = 180 / 180, X = x => (x - H2.HX + 90) * s, Y = z => (z - H2.HZ + 115) * s;
    mg.strokeStyle = '#fff'; mg.lineWidth = 4;
    [[0, 0, -42, -28], [0, 0, 42, -28], [0, -10, 0, -47], [0, 10, 0, 34]].forEach(([a, b, c, d]) => { mg.beginPath(); mg.moveTo(X(H2.HX + a), Y(H2.HZ + b)); mg.lineTo(X(H2.HX + c), Y(H2.HZ + d)); mg.stroke(); });
    for (const k in H2.ISLES) { const [x, z, r] = H2.ISLES[k]; mg.fillStyle = '#e8e2d4'; mg.beginPath(); mg.arc(X(H2.HX + x), Y(H2.HZ + z), r * s, 0, 7); mg.fill(); mg.strokeStyle = '#d0a040'; mg.lineWidth = 1; mg.stroke(); }
    if (P2.solved[2]) H2.tiles.filter(t => t.real).forEach(t => { mg.fillStyle = '#e0c060'; mg.fillRect(X(t.x) - 1.5, Y(t.z) - 1.5, 3, 3); });
    const mark = (x, z, c) => { mg.fillStyle = c; mg.beginPath(); mg.arc(X(x), Y(z), 3.5, 0, 7); mg.fill(); };
    if (!P2.shards[0]) mark(H2.bellStand.x, H2.bellStand.z, '#e0a020');
    if (!P2.shards[1]) mark(H2.fount.x, H2.fount.z, '#e0a020');
    if (!P2.shards[2]) mark(H2.HX, H2.HZ - 95, '#e0a020');
    mark(H2.gate.x, H2.gate.z, P2.placed ? '#6ab0ff' : '#b08030');
    mark(H2.guardian.position.x, H2.guardian.position.z, '#ffffff');
    drawArrow(X(player.pos.x), Y(player.pos.z));
  }

  function p2HUD() {
    updateHUD(0);
    const arena = P2.stage === 'arena';
    $('dayLabel').textContent = arena ? 'Бездна' : '☁ Рай';
    $('timeText').textContent = ''; $('timefill').style.width = '0%';
    const n = P2.shards.filter(Boolean).length;
    let q;
    if (arena) q = 'Победи Пожирателя душ и забери свою душу.';
    else if (!P2.met) q = 'Поговори с Хранителем.';
    else if (P2.placed) q = 'Пройди через Золотые врата.';
    else if (n === 3) q = 'Вставь осколки в Золотые врата на юге.';
    else q = `Собери осколки света (${n}/3): колокола, статуи, невидимый мост.`;
    $('quest').className = '';
    $('quest').innerHTML = `<div class="t">${arena ? 'Битва' : 'Часть вторая'}</div>${q}`;
    $('goal').textContent = '';
    $('fearfill').style.width = P2.hp + '%';
    $('fearfill').style.background = 'linear-gradient(90deg, #4a80c0, #bfe8ff)';
    $('bossFill').style.width = Math.max(0, P2.bossHp) + '%';
    let inv = '';
    for (let i = 0; i < 3; i++) inv += `<div class="slot ${P2.shards[i] ? 'soul' : ''}"><div class="ic" style="opacity:${P2.shards[i] ? 1 : 0.2}">💠</div><div>Осколок</div></div>`;
    $('inv').innerHTML = inv;
  }

  function updateHeaven(dt) {
    if (P2.intro) { updateIntro(dt); return; }
    const tt = performance.now() / 1000;
    const arena = P2.stage === 'arena';
    if (P2.dying) {
      updateDying(dt);
      updateCamera(dt);
    } else {
      if (P2.entering) { /* переход через врата — стоим на месте */ }
      else if (P2.falling) { player.pos.y -= dt * 14; player.model.position.copy(player.pos); }
      else {
        updatePlayer(dt);
        if (player.grounded && !H2.onGround(player.pos.x, player.pos.z, arena)) fall();
      }
      updateCamera(dt);
    }
    if (P2.shake > 0) { P2.shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.3; camera.position.y += (Math.random() - 0.5) * 0.3; }
    heavenEnv();
    if (!arena) {
      const isl = H2.islandAt(player.pos.x, player.pos.z);
      if (isl && !P2.falling) { const [x, z] = H2.ISLES[isl]; P2.checkpoint = { x: H2.HX + x, z: H2.HZ + z + (isl === 'A' ? 6 : 0) }; }
      if (isl === 'D' && !P2.solved[2]) solvePuzzle(2);
      // Хранитель
      const g = H2.guardian;
      g.rotation.y = Util.lerpAngle(g.rotation.y, Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z), Math.min(1, dt * 2));
      g.position.y = Math.sin(tt * 1.5) * 0.08;
      if (!P2.met && !dialog && Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z) < 6) talkGuardian();
      // осколки
      H2.shards.forEach(s => { if (s.visible) { s.rotation.y += dt * 1.5; s.position.y = s.userData.baseY + Math.sin(tt * 2) * 0.15; } });
      // колокола
      H2.bells.forEach(b => {
        b.swing = Math.max(0, b.swing - dt * 0.7);
        b.pivot.rotation.x = Math.sin(tt * 9) * 0.35 * b.swing;
        b.glow.material.opacity = b.swing * 0.9;
      });
      if (P2.melody) {
        P2.melody.t -= dt;
        if (P2.melody.t <= 0) {
          ringBell(BELL_SEQ[P2.melody.i], true);
          P2.melody.i++; P2.melody.t = 0.8;
          if (P2.melody.i >= BELL_SEQ.length) { P2.melody = null; setTimeout(() => msg('Теперь повтори мелодию: подходи к колоколам и нажимай E.', 5), 600); }
        }
      }
      // статуи
      let turning = false;
      H2.statues.forEach(s => {
        if (Math.abs(s.goal - s.angle) > 0.001) { s.angle = Util.lerp(s.angle, s.goal, Math.min(1, dt * 4)); if (Math.abs(s.goal - s.angle) < 0.01) s.angle = s.goal; turning = true; }
        s.g.rotation.y = s.angle;
      });
      if (!P2.solved[1] && !turning && H2.statues.every(s => Math.abs(angDiff(s.goal, s.target)) < 0.05)) solvePuzzle(1);
      // плитки моста
      P2.reveal = Math.max(0, P2.reveal - dt);
      H2.tiles.forEach(t => {
        const lit = t.real && (P2.solved[2] || P2.reveal > 0);
        t.flash = Math.max(0, t.flash - dt);
        t.mat.emissive.setHex(t.flash > 0 ? 0x8a1010 : lit ? 0x8a6010 : 0x203040);
        t.mat.opacity = lit ? 0.8 : 0.5;
      });
      // врата
      H2.doors.forEach((d, i) => { d.rotation.y = Util.lerp(d.rotation.y, P2.placed ? (i === 0 ? -1.6 : 1.6) : 0, Math.min(1, dt * 1.5)); });
      if (P2.placed) H2.portal.material.opacity = 0.45 + Math.sin(tt * 3) * 0.15;
      if (P2.placed && !P2.falling && !P2.entering && player.pos.z > H2.gate.z + 2.8 && Math.abs(player.pos.x - H2.HX) < 3.2) { P2.entering = true; enterArena(false); }
    } else if (!P2.dying) updateBoss(dt);
    current = P2.dying ? null : heavenInteraction();
    Sound.update(dt, arena ? 1 : 0, arena ? 35 : 0, false, !arena);
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; p2HUD(); }
    mapT -= dt; if (mapT <= 0) { mapT = 0.15; drawHeavenMap(); }
    saveT += dt; if (saveT > 15) { saveT = 0; saveP2(); }
  }

  // ---------- мобильная версия: сенсорное управление ----------
  // Полный экран. Вызывать только из клика или отпускания пальца — иначе браузер откажет.
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || navigator.standalone === true;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function lockLandscape() { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* не поддерживается */ } }
  function goFullscreen(toggle) {
    if (!IS_TOUCH || isStandalone()) return;
    const el = document.documentElement;
    try {
      if (fsElement()) {
        if (toggle) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
      }
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(lockLandscape).catch(() => { if (toggle) showFsHelp(); });
        else lockLandscape();
      } else if (toggle) showFsHelp();
    } catch (e) { if (toggle) showFsHelp(); }
  }
  function showFsHelp() {
    const otherIOSBrowser = IS_IOS && /YaBrowser|CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
    const txt = otherIOSBrowser
      ? 'На iPhone браузеры не могут открыть игру на весь экран — это запрет Apple. Но есть способ: открой эту ссылку в Safari, нажми «Поделиться» ⬆ → «На экран Домой». Запускай игру с иконки на экране — она будет на весь экран, как приложение.'
      : IS_IOS
      ? 'На iPhone полный экран включается так: нажми «Поделиться» ⬆ внизу Safari → «На экран Домой». Потом запускай игру с иконки — она откроется на весь экран, как приложение.'
      : 'Браузер не разрешил полный экран. Попробуй меню браузера ⋮ → «Добавить на главный экран» и запускай игру с иконки.';
    const el = $('fsHelp'); el.querySelector('.t').textContent = txt; el.classList.remove('hidden');
  }
  if (IS_TOUCH) {
    document.body.classList.add('touch');
    const fireKey = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const isKey = c => c.startsWith('Key') || c.startsWith('Arrow') || c === 'Space' || c === 'Enter';
    function bindBtn(b) {
      const code = b.dataset.key;
      b.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation(); b.classList.add('on');
        if (code === 'Tools') cycleTool(1);
        else if (code === 'Pause') { if (state === 'play') { state = 'paused'; $('pause').classList.remove('hidden'); save(); } }
        else if (code === 'Mute') toggleMute();
        else fireKey(code, true);
      }, { passive: false });
      const up = e => { e.preventDefault(); b.classList.remove('on'); if (isKey(code)) fireKey(code, false); if (code === 'Full' && e.type === 'touchend') goFullscreen(true); };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    }
    document.querySelectorAll('#touchUI [data-key]').forEach(bindBtn);
    $('fsHelpOk').onclick = () => $('fsHelp').classList.add('hidden');
    if (isStandalone()) document.querySelectorAll('[data-key="Full"]').forEach(b => b.classList.add('hidden'));

    // Джойстик (левая половина) и камера (правая половина)
    const layer = $('touchLayer'), base = $('joyBase'), knob = $('joyKnob');
    const R = 62;
    let joyId = null, jx = 0, jy = 0, lookId = null, lx = 0, ly = 0, moved = 0, lookStart = 0;
    function setMove(x, y) {
      keys.KeyW = y < -0.3; keys.KeyS = y > 0.3; keys.KeyA = x < -0.3; keys.KeyD = x > 0.3;
      keys.ShiftLeft = Math.hypot(x, y) > 0.92;
    }
    layer.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && joyId === null) {
          joyId = t.identifier; jx = t.clientX; jy = t.clientY;
          base.style.left = jx + 'px'; base.style.top = jy + 'px'; base.classList.add('on');
          knob.style.transform = 'translate(-50%,-50%)';
        } else if (lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY; moved = 0; lookStart = performance.now();
        }
      }
    }, { passive: false });
    layer.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - jx, dy = t.clientY - jy; const d = Math.hypot(dx, dy);
          if (d > R) { dx = dx / d * R; dy = dy / d * R; }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          setMove(dx / R, dy / R);
        } else if (t.identifier === lookId) {
          const dx = t.clientX - lx, dy = t.clientY - ly;
          if (state === 'play') {
            camYaw -= dx * 0.0065;
            camPitch = clamp(camPitch - dy * 0.005, -0.9, 0.6);
          }
          lx = t.clientX; ly = t.clientY; moved += Math.abs(dx) + Math.abs(dy);
        }
      }
    }, { passive: false });
    const end = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; setMove(0, 0); base.classList.remove('on'); }
        else if (t.identifier === lookId) {
          lookId = null;
          // короткое касание — действие
          if (moved < 10 && performance.now() - lookStart < 350 && state === 'play') {
            if (S.part2 && P2.intro) endIntro();
            else if (S.inPlane && !dialog) { if (FL.mode === 'walk') act(); }
            else if (S.sleeping) wakeUp('Ты не можешь уснуть. Ночь ещё не кончилась.');
            else act();
          }
        }
      }
    };
    layer.addEventListener('touchend', end, { passive: false });
    layer.addEventListener('touchcancel', end, { passive: false });

    // Кнопки по ситуации и подсказка про поворот
    let ctxSig = '';
    setInterval(() => {
      const playing = state === 'play';
      $('touchUI').classList.toggle('hidden', !playing);
      layer.classList.toggle('hidden', !playing);
      $('rotateHint').classList.toggle('hidden', !(playing && innerHeight > innerWidth));
      if (!playing) { setMove(0, 0); joyId = null; base.classList.remove('on'); }
      let ctx = [];
      if (S.inPlane) {
        if (FL.mode === 'seat') ctx = [['🪟 Окно', 'KeyE'], ['📖 Книга', 'KeyR'], ['💬 Миша', 'KeyT'], ['🚶 Встать', 'Space']];
        else if (FL.mode === 'window') ctx = [['↩ Отвернуться', 'KeyE']];
        else if (FL.mode === 'book') ctx = [['◀', 'ArrowLeft'], ['▶', 'ArrowRight'], ['✕ Закрыть', 'KeyE']];
      } else if (S.part2 && P2.intro) ctx = [['⏭ Пропустить', 'Space']];
      else if (S.sleeping) ctx = [['☀ Проснуться', 'KeyE']];
      const sig = JSON.stringify(ctx);
      if (sig !== ctxSig) {
        ctxSig = sig;
        const box = $('ctxBtns'); box.innerHTML = '';
        ctx.forEach(([label, key]) => { const b = document.createElement('button'); b.className = 'tb ctx'; b.dataset.key = key; b.textContent = label; bindBtn(b); box.appendChild(b); });
      }
      $('touchUI').classList.toggle('seated', !!(S.inPlane && FL.mode !== 'walk') || !!(S.part2 && P2.intro) || !!S.sleeping);
    }, 200);
  }

  // ---------- главный цикл ----------
  const clock = new THREE.Clock();
  let titleT = 0;
  function update(dt) {
    if (S.part2) { updateHeaven(dt); return; }
    if (S.inPlane) { updatePlane(dt); return; }
    if (S.onIsland) { updateIsland(dt); return; }
    S.time += S.sleeping ? dt * 15 : dt;
    if (S.time >= NIGHT_START && !S.nightFlag) { S.nightFlag = true; onNightfall(); }
    if (S.time >= CYCLE) { S.time -= CYCLE; S.nightFlag = false; onDawn(); if (state === 'ending') return; HS.wakeChance = 0.6; if (S.sleeping) wakeUp('Ты проснулся. Наступило утро.'); }
    const nightK = nightAmount();
    updatePlayer(dt);
    updateBoy(dt);
    updateMonster(dt);
    updateCamera(dt);
    updateFear(dt, nightK);
    updateScares(dt, nightK);
    updateHouse(dt, nightK);
    updateSil(dt);
    updateMisc(dt);
    updateEnv(nightK);
    current = findInteraction();
    Sound.update(dt, S.inMine ? 1 : nightK, S.fear, S.inMine, S.inHouse);
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHUD(nightK); }
    mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMinimap(); }
    saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  }
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'play') update(dt);
    else if (state === 'title') {
      titleT += dt * 0.05;
      camera.position.set(Math.sin(titleT) * 26, 7, Math.cos(titleT) * 26);
      camera.lookAt(0, 2, 0);
      boy.position.set(POI.boySpot.x, 0, POI.boySpot.z);
      boy.rotation.y = Math.atan2(camera.position.x - boy.position.x, camera.position.z - boy.position.z);
      player.model.visible = false;
      renderPreview(dt);
      S.time = 140; updateEnv(0.45);
    }
    if (state !== 'title') player.model.visible = true;
    if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.5); }
    $('flash').style.opacity = flashT;
    redT = Math.max(0, redT - dt);
    $('vignette').style.opacity = Math.min(1, S.fear / 100 * 1.1 + redT);
    renderer.render(scene, camera);
  }
  loop();

  // ---------- кнопка звука ----------
  const MUTE_KEY = 'soul_eater_muted';
  function applyMute(m) {
    Sound.setMuted(m); Cartoon.setMuted(m);
    $('muteBtn').textContent = m ? '🔇' : '🔊';
    $('muteBtn').classList.toggle('muted', m);
    $('btnMutePause').textContent = m ? '🔇 Звук: выключен' : '🔊 Звук: включён';
    $('btnMutePause').classList.toggle('muted', m);
    document.querySelectorAll('.muteT').forEach(b => { b.textContent = m ? '🔇' : '🔊'; });
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  function toggleMute() { applyMute(!Sound.muted); if (state === 'play') msg(Sound.muted ? 'Звук выключен (M — включить)' : 'Звук включён', 2); }
  let startMuted = false;
  try { startMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }
  applyMute(startMuted);
  $('muteBtn').onclick = e => { e.stopPropagation(); toggleMute(); };
  $('btnMutePause').onclick = e => { e.stopPropagation(); toggleMute(); };
  addEventListener('keydown', e => { if (e.code === 'KeyM' && state === 'play' && !(e.target && e.target.tagName === 'INPUT')) toggleMute(); });
  // кнопка звука не мешает во время игры на компьютере (мышь всё равно захвачена)
  setInterval(() => document.body.classList.toggle('playing', state === 'play'), 300);

  // Для отладки из консоли браузера
  window.__soul = { toggleMute, get S() { return S; }, scene, camera, monster, player, W, MON, get state() { return state; }, set state(v) { state = v; }, act, keys, WT, H2, P2, startPart2, endIntro, bossDie, solvePuzzle, enterArena, ISL, CUT, arriveIsland, enterCave, startCutscene, HS, SIL, silObj, goSleep, enterHome, runHouseScare, FL, startFlight, planeKey, PL, selectTool, runScare, jumpShow, renderPreview, profile, addStat, get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; },
    tick(n, dt = 1 / 30) { for (let i = 0; i < n; i++) if (state === 'play') update(dt); renderer.render(scene, camera); } };
})();

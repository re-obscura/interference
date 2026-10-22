/* interference · сайт. main.js — сборка всего: рендер-цикл героя (погружение,
   сцены, спираль, CRT), дорожная карта (знаковое поле + терминальный лог),
   настройки, галерея и контакты. Порт main_menu.gd / loading_screen.gd. */
'use strict';

/* ============================= ДАННЫЕ ============================= */
/* Меняйте тексты здесь — остальная страница подстроится сама. */

const SYS = [
  { l: 'БАЛЛИСТИЧЕСКАЯ КРОВЬ', v: 92, h: 'капли-баллистика, декали поверхностей, раны на теле' },
  { l: 'АКТИВНЫЕ РАГДОЛЛЫ', v: 85, h: 'физические тела по костям, анатомические суставы' },
  { l: 'РАСЧЛЕНЕНИЕ', v: 65, h: 'хирургия меша по костям, сквозные дыры, отсечения' },
  { l: 'СВЕТ И АТМОСФЕРА', v: 75, h: 'объёмный туман, SDFGI, шторм и дождь' },
  { l: 'ПРОЛОГ', v: 45, h: 'уровень, враги, сценарий прохода' },
];

/* st: ok — сделано · now — в работе (since — дата старта шага) · plan — план */
const ROADMAP = [
  { l: 'вертикальный срез: стрельба и горя', st: 'ok', dur: '0.8' },
  { l: 'кровь: капли, декали, раны на теле', st: 'ok', dur: '0.6' },
  { l: 'рагдоллы и реакции по зонам', st: 'ok', dur: '0.7' },
  { l: 'мобильный порт · android', st: 'ok', dur: '0.9' },
  { l: 'пролог: полный проход и полировка', st: 'now', since: '2026-09-01', frac: 0.45 },
  { l: 'глава 1: город', st: 'plan' },
  { l: 'демо · ранний доступ', st: 'plan' },
];

const SHOTS = [
  { f: 'photo_20261010_005142_530', c: 'зимний двор · баллистическая кровь' },
  { f: 'photo_20261010_010541_877', c: 'горя сверху · следы боя' },
  { f: 'photo_20261010_215554_216', c: 'ночная лестница · объёмный туман' },
  { f: 'photo_20261017_132524_144', c: 'промзона · холодный ключевой свет' },
  { f: 'photo_20261017_230445_989', c: 'склад · дымка по глубине кадра' },
  { f: 'photo_20261017_230947_890', c: 'погрузочная · смешанный свет' },
  { f: 'photo_20261021_004145_214', c: 'труп врага · активный рагдолл' },
  { f: 'photo_20261021_194023_905', c: 'кровь крупным планом · декали' },
];

const BOOT_LINES = [
  'reobscura · чб-терминал 1.0',
  'самотест памяти …… ОК',
  'носитель ………… подключён',
  'план погрузки …… 7 шагов',
];

/* ============================= ОБЩЕЕ ============================= */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (n, m) => ((n % m) + m) % m;

const app = $('#app');
const scr = new ScrEngine();
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 700px)').matches;

let t = 0;               // глобальное время страницы
let T0 = performance.now();

/* ============================= НАСТРОЙКИ ============================= */
/* Панель настроек убрана: страница живёт на дефолтах игры — ЯРКОСТЬ 60,
   СВЕЧЕНИЕ 60, ЗЕРНО 50, СКАН-ЛИНИИ и МЕРЦАНИЕ включены. */

const el = {
  sceneWrap: $('#scene-wrap'), sc: $('#sc'), glow: $('#glow'), spiral: $('#spiral'),
  scan: $('#scan'), grain: $('#grain'), vig: $('#vig'), flash: $('#flash'),
  paper: $('#paper'), hero: $('#hero'), head: $('#head'), menu: $('#menu'),
  msg: $('#msg-txt'), figtag: $('#figtag'), title: $('#title'),
};

const SENS = 0.5;   /* ЧУВСТВИТЕЛЬНОСТЬ 20/40 */

function applyLook() {
  const f = 'brightness(1.13)';   /* ЯРКОСТЬ 60 → 0.35 + 0.6·1.3 */
  el.sceneWrap.style.filter = f;
  el.paper.style.filter = f;
  el.glow.style.opacity = 1;
  el.grain.style.opacity = (50 / 110).toFixed(3);
}

/* ============================= ГЕРОЙ: ГЕОМЕТРИЯ ============================= */

let W = 0, H = 0, DW = 0, DH = 0, DX = 0, DY = 0;
let rw = 0, rh = 0, phiX = 0, phiY = 0, eye = { x: 0, y: 0 };
let spir = null;           // спираль из 14 квадратов
let mx = 0, my = 0, tmx = 0, tmy = 0;

function heroResize() {
  W = el.hero.clientWidth;
  H = el.hero.clientHeight;
  if (W / H > 16 / 9) { DH = H; DW = H * 16 / 9; } else { DW = W; DH = W * 9 / 16; }
  DX = (W - DW) / 2; DY = (H - DH) / 2;

  const m = DH * 0.06;
  let h = DH - 2 * m;
  rw = h * PHI;
  if (rw > DW - 2 * m) { rw = DW - 2 * m; h = rw / PHI; }
  rh = h;
  phiX = DX + DW - m - rw;
  phiY = DY + (DH - rh) / 2;
  spir = buildSpiral(phiX, phiY, rw, rh, 14, 25);
  eye = spir.eye;

  for (const c of [el.sc, el.spiral]) {
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
  }
  el.glow.width = Math.round(W * DPR * 0.5);
  el.glow.height = Math.round(H * DPR * 0.5);
  el.sceneWrap.style.transformOrigin = `${eye.x}px ${eye.y}px`;

  const mLeft = DX + Math.max(DW * 0.05, 28);
  document.documentElement.style.setProperty('--mx', mLeft + 'px');
  document.documentElement.style.setProperty('--heady', (DY + DH * 0.06) + 'px');
  layoutMenu();
}

function layoutMenu() {
  if (!el.menu) return;
  const items = $$('#menu .it');
  if (!items.length) return;
  const box = el.menu.offsetHeight;
  el.menu.style.top = Math.max(eye.y - box / 2, DY + DH * 0.06 + 90) + 'px';
}

/* ============================= СЦЕНЫ ============================= */

const sceneFns = [];
function resetScenes() {
  for (let i = 0; i < SCENE_N; i++) {
    sceneFns[i] = createScene(i, {
      lorenzCap: 2400,
      juliaCount: MOBILE ? 1100 : 2000,
    });
  }
}
resetScenes();

let cur = 0, sStart = 0, glitchT = -9, flashT = -9, fadeT0 = -9;
let figNameSlot = null;

function setScene(i) {
  cur = mod(i, SCENE_N);
  sStart = t;
  glitchT = t;
  flashT = t;
  sceneFns[0] = makeLorenz(2400);
  if (figNameSlot !== null) {
    scr.set(el.figtag, `РИС. ${cur + 1}/7 · ${FIG_NAMES[cur]}`, 1.7);
  }
}

/* ============================= СПИРАЛЬ МЕНЮ ============================= */

let lrot = 0, lsh = 0, hoff = 0;

function drawSpiral(ctx, zz, dim) {
  const alpha = a => `rgba(255,255,255,${(a * dim).toFixed(3)})`;
  ctx.strokeStyle = alpha(0.09);
  ctx.lineWidth = 1;
  ctx.strokeRect(phiX, phiY, rw, rh);

  for (let m = 0; m < 3; m++) {
    const k = zz + m;
    const scl = Math.pow(PHI, k);
    const kk = -Math.PI / 2 * k;
    const w = 1 / scl;
    ctx.save();
    ctx.translate(eye.x, eye.y);
    ctx.rotate(kk);
    ctx.scale(scl, scl);
    ctx.translate(-eye.x, -eye.y);
    const targets = m === 0 ? spir.sqs : [spir.sqs[0]];
    ctx.strokeStyle = alpha(0.09);
    ctx.lineWidth = w;
    for (let i = 0; i < targets.length; i++) {
      const q = targets[i];
      ctx.strokeRect(q[0], q[1], q[2], q[2]);
      const al = clamp((q[2] * scl - 20) / 12, 0, 1);
      if (al > 0) {
        const cx = q[0] + q[2] / 2, cy = q[1] + q[2] / 2;
        const dx = cx - eye.x, dy = cy - eye.y;
        const px = eye.x + (dx * Math.cos(kk) - dy * Math.sin(kk)) * scl;
        const py = eye.y + (dx * Math.sin(kk) + dy * Math.cos(kk)) * scl;
        ctx.save();
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.translate(px, py);
        ctx.rotate(kk + lrot + m * Math.PI / 2);
        ctx.fillStyle = alpha(0.3 * al);
        ctx.font = '15px DotGothic16, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(fib(12 - i + m + lsh)), -q[2] / 2 + 7 / scl, -q[2] / 2 + 16 / scl);
        ctx.restore();
      }
    }
    const seg = m === 0 ? spir.pts : spir.pts.slice(0, 25);
    ctx.strokeStyle = alpha(0.2);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.stroke();
    ctx.restore();
  }
  drawDotTrail(ctx, zz, dim);
}

function drawDotTrail(ctx, zz, dim) {
  const pts = spir.pts;
  const n = pts.length;
  const Z = Math.pow(PHI, zz);
  const rest = 6 * 38;
  const ph = mod(t * 38 + hoff, n + rest);
  const hd = Math.floor(Math.min(ph, n - 1)) % n;
  let vis = 1;
  if (ph > n) vis = 1 - clamp((ph - n) / 22.8, 0, 1);
  else if (ph < 22.8) vis = clamp(ph / 22.8, 0, 1);
  if (vis <= 0) return;
  const tail = 70;
  ctx.save();
  ctx.translate(eye.x, eye.y);
  ctx.rotate(-Math.PI / 2 * zz);
  ctx.scale(Z, Z);
  ctx.translate(-eye.x, -eye.y);
  ctx.lineWidth = 1 / Z;
  for (let i = 1; i < tail; i++) {
    const a = pts[mod(hd - i, n)];
    const b = pts[mod(hd - i + 1, n)];
    if (Math.abs(a.x - b.x) > rw / 2) continue;
    ctx.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - i / tail) * vis * dim).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.fillStyle = `rgba(232,230,227,${(vis * dim).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(pts[hd].x, pts[hd].y, Math.max(1 / Z, 0.7), 0, 6.2832);
  ctx.fill();
  ctx.restore();
}

/* ============================= ПОГРУЖЕНИЕ ============================= */

let busy = false, diveDir = 0, diveT0 = -10;

function dive(dir, target) {
  if (busy) return;
  busy = true;
  diveDir = dir;
  diveT0 = t;
  msgTarget = 0;
  flashT = t;
  glitchT = t;
  const items = $$('#menu .it');
  items.forEach((it, i) => {
    it.classList.remove('rin');
    it.style.setProperty('--d', (i * 0.04) + 's');
    it.classList.add('out');
  });
  const jump = () => target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  if (REDUCED) { setTimeout(jump, 60); }
  else setTimeout(jump, 650);
  setTimeout(() => setScene(cur + 1), 650);
  setTimeout(() => {
    busy = false;
    items.forEach(it => it.classList.remove('out'));
    msgTarget = 1;
  }, 1700);
}

function diveTick() {
  if (diveDir === 0) return;
  const p = clamp((t - diveT0) / 1.2, 0, 1);
  if (p >= 1) {
    lrot += diveDir > 0 ? -Math.PI / 2 : Math.PI / 2;
    lsh += diveDir > 0 ? -1 : 1;
    hoff += diveDir > 0 ? -25 : 25;
    fadeT0 = t;
    diveDir = 0;
  }
}

function diveXform() {
  if (diveDir === 0) return '';
  const p = clamp((t - diveT0) / 1.2, 0, 1);
  const e = bez(0.7, 0, 0.25, 1, p);
  const rot = (-90 * diveDir) * e * Math.PI / 180;
  const scl = Math.pow(PHI, diveDir * e);
  return `rotate(${rot}rad) scale(${scl.toFixed(4)})`;
}

function zz() {
  if (diveDir === 0) return 0;
  const p = clamp((t - diveT0) / 1.2, 0, 1);
  return diveDir * p * p * p * (p * (6 * p - 15) + 10);
}

/* ============================= МЕНЮ ============================= */

let act = -1;
let msgTarget = 1, msgA = 1;
let liveNext = 0, beatEnd = 0, nextB = 3;
const items = $$('#menu .it');

function setAct(i, silent) {
  if (i === act) return;
  act = i;
  if (act >= 0) {
    items[act].classList.add('on');
  }
  items.forEach((it, k) => { if (k !== act) it.classList.remove('on'); });
  if (act < 0) return;
  const it = items[act];
  const lab = it.querySelector('.lab');
  if (!silent) scr.set(lab, lab.dataset.full || lab.textContent, 0.55);
  scr.set(el.msg, it.dataset.hint, 2.2);
  msgTarget = 1;
  liveNext = t + 1.1;
  beatEnd = 0;
}

function liveTick() {
  if (act < 0 || t < liveNext) return;
  const lab = items[act].querySelector('.lab');
  const tgt = lab.dataset.full || lab.textContent;
  if (t > nextB) {
    nextB = t + 2 + Math.random() * 3;
    beatEnd = t + 0.11;
    const k = (Math.random() * tgt.length) | 0;
    if (tgt[k] && tgt[k] !== ' ') {
      lab.textContent = tgt.slice(0, k) + SCR_CHARS[(Math.random() * SCR_CHARS.length) | 0] + tgt.slice(k + 1);
    }
  }
  if (beatEnd && t > beatEnd) {
    lab.textContent = tgt;
    beatEnd = 0;
  }
}

items.forEach((it, i) => {
  const lab = it.querySelector('.lab');
  lab.dataset.full = lab.textContent;
  lab.textContent = '';
  it.addEventListener('mouseenter', () => setAct(i));
  it.addEventListener('click', e => {
    e.preventDefault();
    if (busy) return;
    setAct(i);
    const sec = document.querySelector(it.getAttribute('href'));
    if (sec) dive(1, sec);
  });
});

/* печать заголовка — как в интро игры: по символу за 0.11 с */
function typeTitle() {
  const full = 'interference';
  let i = 0;
  el.title.textContent = '';
  const start = performance.now() + 300;
  function step(now) {
    const k = Math.floor((now - start) / 110);
    if (k > i) { i = k; el.title.textContent = full.slice(0, clamp(i, 0, full.length)); }
    if (i < full.length) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ============================= ЗЕРНО ============================= */

const grainCtx = el.grain.getContext('2d');
el.grain.width = 160; el.grain.height = 160;
let lastGrain = 0;

function regenGrain() {
  const img = grainCtx.createImageData(160, 160);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  grainCtx.putImageData(img, 0, 0);
}

/* ============================= КАДР ============================= */

const scCtx = el.sc.getContext('2d');
const glowCtx = el.glow.getContext('2d');
const spCtx = el.spiral.getContext('2d');

let flickerPrev = -1;

function flickerAlpha() {
  if (REDUCED) return 1;   /* МЕРЦАНИЕ: уважаем prefers-reduced-motion */
  const k = mod(t, 6) / 6;
  if (k < 0.91) return 1;
  if (k < 0.92) return lerp(1, 0.88, (k - 0.91) / 0.01);
  if (k < 0.93) return lerp(0.88, 1, (k - 0.92) / 0.01);
  if (k < 0.95) return 1;
  return lerp(0.93, 1, (k - 0.95) / 0.05);
}

function frame(now) {
  const tNow = (now - T0) / 1000;
  const dt = clamp(tNow - t, 0.001, 0.1);
  t = tNow;
  frameCount++;

  mx += (tmx - mx) * (1 - Math.exp(-dt * 3));
  my += (tmy - my) * (1 - Math.exp(-dt * 3));

  /* смена сцен каждые 16 с */
  if (!busy && t - sStart > 16) setScene(cur + 1);
  diveTick();

  /* --- сцена --- */
  const sc = scCtx;
  sc.setTransform(DPR, 0, 0, DPR, 0, 0);
  sc.fillStyle = '#000';
  sc.fillRect(0, 0, W, H);
  let a = 1;
  const g = t - glitchT;
  const k = g < 0.55 ? 1 - g / 0.55 : 0;
  if (k <= 0) a = Math.min(1, (t - sStart) / 1.2);
  if (diveDir !== 0) a *= 1 - clamp((t - diveT0) / 0.9, 0, 1);
  else if (t < fadeT0 + 1) a *= clamp((t - fadeT0) / 1, 0, 1);

  const env = {
    cx: eye.x + mx * 16 * SENS,
    cy: eye.y + my * 12 * SENS,
    R: rh * 0.31,
  };
  env.proj = makeProj(env.cx, env.cy, env.R);
  sc.globalAlpha = a;
  sceneFns[cur](new CanvasSink(sc), t, env);
  sc.globalAlpha = 1;

  if (k > 0) {
    for (let i = 0; i < 9; i++) {
      const y = Math.random() * H;
      const h = 4 + Math.random() * 50;
      const dx = (Math.random() - 0.5) * 90 * k;
      sc.drawImage(el.sc, 0, y * DPR, el.sc.width, h * DPR, dx, y, W, h);
    }
    sc.fillStyle = `rgba(0,0,0,${(1 - (0.35 + 0.65 * (1 - k))).toFixed(3)})`;
    sc.fillRect(0, 0, W, H);
  }

  /* свечение — уменьшенная копия кадра, CSS blur + screen */
  glowCtx.clearRect(0, 0, el.glow.width, el.glow.height);
  glowCtx.drawImage(el.sc, 0, 0, el.glow.width, el.glow.height);

  el.sceneWrap.style.transform = diveXform();

  /* --- спираль --- */
  const sp = spCtx;
  sp.setTransform(DPR, 0, 0, DPR, 0, 0);
  sp.clearRect(0, 0, W, H);
  drawSpiral(sp, zz(), 1);

  /* --- меню-текст --- */
  liveTick();
  scr.tick(t);
  msgA += (msgTarget - msgA) * (1 - Math.exp(-dt * 9));
  $('#msg').style.opacity = msgA.toFixed(3);

  /* --- CRT --- */
  const fa = flickerAlpha();
  if (Math.abs(fa - flickerPrev) > 0.001) {
    app.style.opacity = fa.toFixed(3);
    flickerPrev = fa;
  }
  const fp = clamp((t - flashT) / 0.45, 0, 1);
  const pq = Math.floor(fp * 6) / 6;
  el.flash.style.opacity = (pq < 0.3 ? 0.16 * (1 - pq / 0.3)
    : pq < 0.45 ? 0.08 * (1 - (pq - 0.3) / 0.15) : 0).toFixed(3);

  /* виньетка экрана загрузки проявляется при прокрутке */
  el.vig.style.opacity = clamp(scrollY / (H * 0.8), 0, 1).toFixed(3);

  if (t - lastGrain > 0.05) {
    lastGrain = t;
    regenGrain();
  }

  if ((frameCount & 7) === 0) updateTPlus();

  if (roadVisible) roadFrame(dt);

  requestAnimationFrame(frame);
}

/* ============================= КЛАВИАТУРА ============================= */

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const heroOn = scrollY < H * 0.5;
  if (e.key === 'Escape') {
    if (!$('#lightbox').hidden) { closeLightbox(); return; }
  }
  if (!heroOn || busy) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    setAct(mod(act + (e.key === 'ArrowDown' ? 1 : -1), items.length));
  } else if (e.key === 'Enter' && act >= 0) {
    items[act].click();
  } else if (e.key === '[' || e.key === ']') {
    setScene(cur + (e.key === ']' ? 1 : -1));
  } else if (/^[1-7]$/.test(e.key)) {
    setScene(parseInt(e.key, 10) - 1);
  }
});

document.addEventListener('mousemove', e => {
  tmx = e.clientX / W - 0.5;
  tmy = e.clientY / H - 0.5;
});

/* «▲ МЕНЮ» — обратное погружение */
$$('.to-menu').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  if (busy) { window.scrollTo({ top: 0 }); return; }
  const target = $('#hero');
  dive(-1, target);
  window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}));

/* ============================= СИСТЕМЫ (ОБ ИГРЕ) ============================= */

function buildSys() {
  const box = $('#sys');
  for (const s of SYS) {
    const row = document.createElement('div');
    row.className = 'sysrow';
    row.innerHTML =
      `<div class="sys-lab"><span>${s.l}</span><span class="sys-pct">0%</span></div>` +
      `<div class="sys-track"><i class="sys-rail"></i><i class="sys-fill"></i>` +
      `<i class="sys-dot"></i></div>` +
      `<div class="sys-hint">${s.h}</div>`;
    box.appendChild(row);
    row._sys = s;
  }
}

function animateSys() {
  $$('#sys .sysrow').forEach((row, i) => {
    const s = row._sys;
    setTimeout(() => {
      row.querySelector('.sys-fill').style.width = s.v + '%';
      row.querySelector('.sys-dot').style.left = s.v + '%';
      const pct = row.querySelector('.sys-pct');
      const t0 = performance.now();
      (function count(now) {
        const p = clamp((now - t0) / 900, 0, 1);
        pct.textContent = Math.round(s.v * p) + '%';
        if (p < 1) requestAnimationFrame(count);
      })(t0);
    }, i * 140);
  });
}

/* ============================= ДОРОЖНАЯ КАРТА ============================= */

let roadVisible = false;
let roadBuilt = false;
let figIdx = 0, figT0 = -9, figPulse = 0, figOverride = -1, figOverrideT = -9;
const glitchRows = new Map();
let miniSpir = null;
let nowStepIdx = -1;
let roadPct = 0;

function buildRoad() {
  roadBuilt = true;
  const log = $('#road-log');
  const lines = [];
  for (const b of BOOT_LINES) {
    const d = document.createElement('div');
    d.className = 'rlog-boot';
    d.textContent = b;
    log.appendChild(d);
    lines.push(d);
  }
  let i = 0;
  for (const r of ROADMAP) {
    const d = document.createElement('div');
    d.className = 'rlog-line ' + r.st;
    const time = r.st === 'ok' ? `— ${r.dur} с`
      : r.st === 'now' ? `— 0.0 с` : '· в очереди';
    d.innerHTML =
      `<span class="rl-main">${r.st === 'ok' ? 'ОК · ' : '· '}${r.l}</span>` +
      `<span class="rl-time">${time}</span><span class="rl-state"></span>`;
    d._step = i;
    d.addEventListener('mouseenter', () => { figOverride = i; figOverrideT = t; });
    d.addEventListener('mouseleave', () => { figOverride = -1; });
    log.appendChild(d);
    if (r.st === 'now') nowStepIdx = i;
    i++;
  }
  /* счётчик шагов и шкала */
  const done = ROADMAP.filter(r => r.st === 'ok').length;
  const frac = ROADMAP.filter(r => r.st === 'now').reduce((s, r) => s + (r.frac || 0), 0);
  roadPct = (done + frac) / ROADMAP.length;
  const nowIdx = nowStepIdx >= 0 ? nowStepIdx : ROADMAP.length - 1;
  $('#road-step').textContent = '→ ' + ROADMAP[nowIdx].l;
  $('#road-count').textContent = `ШАГ ${String(nowIdx + 1).padStart(2, '0')} / ${String(ROADMAP.length).padStart(2, '0')}`;
  $('#road-pct').textContent = Math.round(roadPct * 100) + '%';
  const notches = $('#hairbar-notches');
  for (let j = 1; j < ROADMAP.length; j++) {
    const b = document.createElement('b');
    b.style.left = (j / ROADMAP.length * 100) + '%';
    notches.appendChild(b);
  }
  requestAnimationFrame(() => { $('#hairbar-fill').style.width = (roadPct * 100) + '%'; });

  /* сценарий появления: бут-строки скрэмблятся по очереди */
  lines.forEach((d, i) => scr.set(d, d.textContent, 2.6, i * 0.14));

  /* поле фигур */
  fieldInit();
}

/* --- знаковое поле --- */

const field = {
  cv: null, ctx: null, cols: 0, rows: 0, cw: 10, ch: 14, fx: 0, fy: 0,
  glow: new Map(), add: new Map(), pichar: new Map(), decay: 0.34,
  feed(x, y, v, ch) {
    const c = Math.floor((x - this.fx) / this.cw);
    const r = Math.floor((y - this.fy) / this.ch);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const k = r * this.cols + c;
    this.add.set(k, Math.min((this.add.get(k) || 0) + v, 1.5));
    if (ch) this.pichar.set(k, ch);
  },
};

const roadScenes = [];
for (let i = 0; i < SCENE_N; i++) {
  roadScenes.push(createScene(i, { lorenzCap: 1600, juliaCount: 700 }));
}

function fieldInit() {
  field.cv = $('#field');
  field.ctx = field.cv.getContext('2d');
  const rect = field.cv.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  field.cv.width = Math.round(w * DPR);
  field.cv.height = Math.round(h * DPR);
  field.fx = 0; field.fy = 0;
  field.ch = clamp(Math.floor(h / 34), 11, 20);
  field.rows = Math.floor(h / field.ch);
  field.cw = clamp(Math.floor(field.ch * 0.62), 7, 14);
  field.cols = Math.floor(w / field.cw);
  miniSpir = buildMiniSpiral();
}

function buildMiniSpiral() {
  const cv = $('#mini-spiral');
  const rect = cv.getBoundingClientRect();
  cv.width = Math.round(rect.width * DPR);
  cv.height = Math.round(rect.height * DPR);
  let w = clamp(rect.height * PHI * 1.2, 90, Math.min(170, rect.width));
  let h = w / PHI;
  return {
    cv, w, h, x: (rect.width - w) / 2, y: (rect.height - h) / 2,
    ...buildSpiral((rect.width - w) / 2, (rect.height - h) / 2, w, h, 9, 20),
  };
}

function setFig(i) {
  figIdx = mod(i, SCENE_N);
  figT0 = t;
  figPulse = Math.max(figPulse, 0.85);
  glitchRows.clear();
  const n = 3 + ((Math.random() * 3) | 0);
  for (let j = 0; j < n; j++) {
    glitchRows.set((Math.random() * Math.max(field.rows, 1)) | 0, ((Math.random() * 7) | 0) - 3);
  }
  scr.set($('#field-cap'), `РИС. ${figIdx + 1}/7 · ${FIG_NAMES[figIdx]}`, 1.7);
}

function roadFrame(dt) {
  if (!roadBuilt) return;
  /* фигура: цикл по достигнутым фазам, наведение — приоритет */
  const reach = figOverride >= 0 ? figOverride
    : Math.max(nowStepIdx, 0);
  const cycleN = reach + 1;
  if (figOverride >= 0 && figIdx !== figOverride) {
    setFig(figOverride);
  } else if (figOverride < 0 && t - figT0 > 8 && figIdx !== mod(figIdx + 1, cycleN)) {
    setFig(mod(figIdx + 1, cycleN));
  }
  figPulse = Math.max(figPulse - dt * 2.4, 0);

  /* feed */
  field.add.clear();
  field.pichar.clear();
  const w = field.cv.width / DPR, h = field.cv.height / DPR;
  const env = {
    cx: field.fx + w / 2, cy: field.fy + h / 2,
    R: Math.min(w, h) * 0.46,
  };
  env.proj = makeProj(env.cx, env.cy, env.R);
  roadScenes[figIdx](new FieldSink(field), t, env);

  /* послесвечение и отрисовка */
  const ctx = field.ctx;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070708';
  ctx.fillRect(0, 0, w, h);
  const decay = Math.exp(-dt / field.decay);
  const boost = 1 + 0.45 * figPulse;
  const g = t - figT0;
  const keys = new Set([...field.add.keys(), ...field.glow.keys()]);
  for (const k of keys) {
    let v = (field.glow.get(k) || 0) * decay + (field.add.get(k) || 0);
    if (v <= 0.02) { field.glow.delete(k); continue; }
    if (v > 1.6) v = 1.6;
    field.glow.set(k, v);
    const c = k % field.cols;
    const r = Math.floor(k / field.cols);
    let ch = field.pichar.has(k) ? field.pichar.get(k)
      : RAMP[clamp(Math.floor(Math.pow(Math.min(v, 1), 0.72) * (RAMP.length - 1)), 0, RAMP.length - 1)];
    let px = field.fx + (c + 0.5) * field.cw;
    const py = field.fy + (r + 0.74) * field.ch;
    let a = clamp(clamp(v * 1.15, 0.05, 0.92) * boost, 0, 1);
    if (g < 0.5 && glitchRows.has(r)) {
      const kk = 1 - g / 0.5;
      px += glitchRows.get(r) * field.cw * kk;
      if (Math.random() < 0.3 * kk) ch = SCR_CHARS[(Math.random() * SCR_CHARS.length) | 0];
    }
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.font = `${Math.round(field.ch)}px DotGothic16, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(ch, px, py);
  }
  /* луч медленной развёртки */
  const sy = mod(t * 90, h + 60) - 30;
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0, sy, w, 22);

  drawMiniSpiral();

  /* тикающее время активного шага */
  if (nowStepIdx >= 0 && (frameCount & 7) === 0) {
    const r = ROADMAP[nowStepIdx];
    const el = document.querySelectorAll('.rlog-line.now .rl-time')[0];
    if (el && r.since) {
      const sec = (Date.now() - new Date(r.since + 'T00:00:00')) / 1000;
      el.textContent = `— ${fmtDur(sec)}`;
    }
  }
  updateTPlus();
}

function fmtDur(sec) {
  const d = Math.floor(sec / 86400);
  if (d >= 1) return `${d} дн`;
  const hh = Math.floor(sec / 3600);
  if (hh >= 1) return `${hh} ч`;
  return `${(sec / 60).toFixed(0)} мин`;
}

function drawMiniSpiral() {
  const ctx = miniSpir.cv.getContext('2d');
  const w = miniSpir.cv.width / DPR, h = miniSpir.cv.height / DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(miniSpir.x, miniSpir.y, miniSpir.w, miniSpir.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  for (const q of miniSpir.sqs) ctx.strokeRect(q[0], q[1], q[2], q[2]);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '11px DotGothic16, monospace';
  ctx.textAlign = 'left';
  miniSpir.sqs.forEach((q, idx) => {
    if (idx < 3 && q[2] >= 58) {
      ctx.fillText(String(fib(9 - idx)), q[0] + 6, q[1] + 16);
    }
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  miniSpir.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();

  const n = miniSpir.pts.length;
  const hd = clamp(Math.floor(roadPct * (n - 1)), 0, n - 1);
  if (hd > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    for (let i = 0; i <= hd; i++) {
      const p = miniSpir.pts[i];
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }
  const tail = 40;
  for (let i = 1; i < tail; i++) {
    const a2 = miniSpir.pts[mod(hd - i, n)];
    const b2 = miniSpir.pts[mod(hd - i + 1, n)];
    if (Math.abs(a2.x - b2.x) > miniSpir.w * 0.5) continue;
    ctx.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - i / tail)).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(miniSpir.pts[hd].x, miniSpir.pts[hd].y, 1.6, 0, 6.2832);
  ctx.fill();
  if (nowStepIdx >= 0) {
    const p = 0.5 + 0.4 * hb(t);
    ctx.fillStyle = `rgba(255,255,255,${(0.12 * p).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(miniSpir.eye.x, miniSpir.eye.y, 4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(p * 0.7).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(miniSpir.eye.x, miniSpir.eye.y, 1.4, 0, 6.2832); ctx.fill();
  }
}

/* ============================= T+ ============================= */

let frameCount = 0;
function updateTPlus() {
  const s = `T+${t.toFixed(1).padStart(5, ' ')}`;
  for (const e of tPlusEls) e.textContent = s;
}
const tPlusEls = $$('.t-plus');

/* ============================= ПОЯВЛЕНИЕ РАЗДЕЛОВ ============================= */

const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const sec = en.target;
    io.unobserve(sec);
    if (sec.id === 'about') animateSys();
    if (sec.id === 'roadmap' && !roadBuilt) buildRoad();
    sec.querySelectorAll('[data-scr]').forEach((d, i) => {
      const txt = d.dataset.full || (d.dataset.full = d.textContent);
      d.textContent = '';
      scr.set(d, txt, 2.2, i * 0.05);
    });
  }
}, { threshold: 0.18 });

$$('.sec').forEach(s => io.observe(s));

const ioRoad = new IntersectionObserver(entries => {
  roadVisible = entries[0].isIntersecting;
}, { threshold: 0.02 });
ioRoad.observe($('#roadmap'));

/* ============================= ГАЛЕРЕЯ ============================= */

function buildGallery() {
  const g = $('#gallery');
  SHOTS.forEach((s, i) => {
    const fig = document.createElement('figure');
    fig.className = 'shot';
    fig.innerHTML =
      `<img src="img/shots/${s.f}.t.webp" data-full="img/shots/${s.f}.webp" ` +
      `alt="${s.c}" loading="lazy">` +
      `<span class="zoom">⤢ УВЕЛИЧИТЬ</span>` +
      `<figcaption>· ${String(i + 1).padStart(2, '0')} · ${s.c}</figcaption>`;
    fig.addEventListener('click', () => openLightbox(s));
    g.appendChild(fig);
  });
}

const lb = $('#lightbox');
function openLightbox(s) {
  $('#lb-img').src = 'img/shots/' + s.f + '.webp';
  $('#lb-img').alt = s.c;
  $('#lb-cap').textContent = '· ' + s.c;
  lb.hidden = false;
}
function closeLightbox() { lb.hidden = true; }
lb.addEventListener('click', closeLightbox);

/* ============================= КОНТАКТЫ ============================= */

$$('.crow[data-copy]').forEach(b => {
  b.addEventListener('click', async () => {
    const val = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(val);
      const act = b.querySelector('.cact');
      const old = 'СКОПИРОВАТЬ';
      scr.set(act, 'СКОПИРОВАНО', 0.9);
      setTimeout(() => scr.set(act, old, 0.9), 1800);
    } catch (e) { /* clipboard недоступен */ }
  });
});

/* ============================= СТАРТ ============================= */

buildSys();
buildGallery();
applyLook();
heroResize();
addEventListener('resize', () => { heroResize(); if (roadBuilt) fieldInit(); });
document.fonts && document.fonts.ready.then(layoutMenu);

typeTitle();
setScene(0);
figNameSlot = 1;
scr.set(el.figtag, `РИС. 1/7 · ${FIG_NAMES[0]}`, 1.7, 0.6);

/* вход меню: пункты каскадом, как _build(true) игры */
items.forEach((it, i) => {
  const lab = it.querySelector('.lab');
  it.style.setProperty('--d', (i * 0.07) + 's');
  it.classList.add('rin');
  scr.set(lab, lab.dataset.full, 0.55, 0.12 + i * 0.07);
});
setTimeout(() => setAct(0, true), 60);
setTimeout(() => { if (act >= 0) scr.set(el.msg, items[act].dataset.hint, 2.2); }, 500);

requestAnimationFrame(now => { T0 = now; requestAnimationFrame(frame); });

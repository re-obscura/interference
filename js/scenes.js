/* interference · семь фоновых сцен главного меню: аттрактор Лоренца,
   филлотаксис, тор, сфера π, тессеракт, морфящийся торус-узел и множество
   Жюлиа. Порт _scene_* из main_menu.gd. Каждый вебер-рисовалка получает
   sink (CanvasSink для меню, FieldSink для знакового поля дорожной карты)
   и env: {cx, cy, R, proj}. */
'use strict';

const SCENE_N = 7;
const FIG_NAMES = ['АТТРАКТОР ЛОРЕНЦА', 'ФИЛЛОТАКСИС', 'ТОР', 'СФЕРА π',
  'ТЕССЕРАКТ', 'ТОРУС-УЗЕЛ', 'МНОЖЕСТВО ЖЮЛИА'];
const PI_DIGITS = '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';

/* Проекция P() меню: повороты y/x + перспектива FOC=3.2. */
function makeProj(cx, cy, R) {
  const FOC = 3.2;
  return (x, y, z, ax, ay) => {
    let c = Math.cos(ay), s = Math.sin(ay);
    const x1 = x * c + z * s;
    const z1 = -x * s + z * c;
    c = Math.cos(ax); s = Math.sin(ax);
    const y1 = y * c - z1 * s;
    const z2 = y * s + z1 * c;
    const f = FOC / (FOC + z2);
    return { x: cx + x1 * f * R, y: cy + y1 * f * R, f, w: z2 };
  };
}

/* --- 1. Лоренц: 12 «рукавов» с нарастающей прозрачностью + маркер головы --- */
function makeLorenz(cap) {
  let L = { x: 1 + Math.random() * 0.1, y: 1, z: 1 };
  const lp = [];
  return (sink, t, env) => {
    for (let i = 0; i < 7; i++) {
      const dt = 0.0055;
      const { x, y, z } = L;
      L = {
        x: x + 10 * (y - x) * dt,
        y: y + (x * (28 - z) - y) * dt,
        z: z + (x * y - 8 / 3 * z) * dt,
      };
      lp.push(L);
    }
    while (lp.length > cap) lp.shift();
    const q = [];
    for (const v of lp) {
      const pr = env.proj(v.x / 22, v.y / 22, (v.z - 25) / 22, 0.25, t * 0.28);
      q.push({ x: pr.x, y: pr.y });
    }
    const n = q.length, ch = 12;
    for (let c = 0; c < ch; c++) {
      const lo = Math.floor(n * c / ch), hi = Math.floor(n * (c + 1) / ch);
      if (hi - lo < 2) continue;
      sink.poly(q.slice(lo, hi + 1), 0.06 + 0.5 * c / ch, 1);
    }
    if (n > 0) sink.rect(q[n - 1].x - 2, q[n - 1].y - 2, 4, 1);
  };
}

/* --- 2. Филлотаксис: точки по золотому углу 137.5° --- */
function scenePhyllo(sink, t, env) {
  const n = 780;
  const ax = 1.0 + 0.15 * Math.sin(t * 0.3);
  for (let i = 1; i < n; i++) {
    const a = i * 2.3999632 + t * 0.05;
    const r = Math.sqrt(i / n) * 1.25;
    const pr = env.proj(Math.cos(a) * r, Math.sin(a) * r, 0.3 * Math.sin(r * 5 - t * 1.2), ax, 0);
    const al = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(i * 0.05 - t * 2))) * Math.min(1, pr.f * 1.1);
    const s = (0.8 + i / n * 1.8) * pr.f;
    sink.rect(pr.x, pr.y, s, al);
  }
}

/* --- 3. Тор: каркас 40×18 + точки по глубине --- */
function sceneTorus(sink, t, env) {
  const u_n = 40, v_n = 18;
  const ax = t * 0.35, ay = t * 0.22;
  const g = [];
  for (let i = 0; i < u_n; i++) {
    const row = [];
    const u = i / u_n * 6.2832;
    for (let j = 0; j < v_n; j++) {
      const v = j / v_n * 6.2832;
      const r2 = 0.32 * (1 + 0.18 * Math.sin(t * 1.3 + u * 3));
      row.push(env.proj(
        (0.75 + r2 * Math.cos(v)) * Math.cos(u),
        (0.75 + r2 * Math.cos(v)) * Math.sin(u),
        r2 * Math.sin(v), ax, ay));
    }
    g.push(row);
  }
  const seg = [];
  for (let i = 0; i < u_n; i++) {
    for (let j = 0; j < v_n; j++) {
      const a = g[i][j], b = g[(i + 1) % u_n][j], c = g[i][(j + 1) % v_n];
      seg.push({ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: a.y }, { x: c.x, y: c.y });
    }
  }
  sink.lines(seg, 0.4, 1);
  for (let i = 0; i < u_n; i++) {
    for (let j = 0; j < v_n; j++) {
      const a = g[i][j];
      const s = 2.2 * a.f;
      sink.rect(a.x - s * 0.5, a.y - s * 0.5, s, 0.3 + 0.7 * Math.max(0, 1 - a.w));
    }
  }
}

/* --- 4. Сфера из цифр π: 13 широт, чередующееся вращение --- */
function scenePi(sink, t, env) {
  let idx = 0;
  for (let k = 0; k < 13; k++) {
    const lat = (k / 12 - 0.5) * Math.PI * 0.94;
    const cnt = Math.max(3, Math.round(26 * Math.cos(lat)));
    for (let m = 0; m < cnt; m++) {
      const lon = m / cnt * 6.2832 + t * 0.3 * (k % 2 ? 1 : -1);
      const pr = env.proj(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), 0.3, 0);
      const al = Math.pow(Math.min(Math.max((1.4 - pr.w) / 2.4, 0), 1), 2);
      const sz = Math.max(9, env.R * 0.1 * pr.f);
      sink.str(pr.x, pr.y + sz * 0.35, sz, PI_DIGITS[idx % PI_DIGITS.length], al, true);
      idx++;
    }
  }
}

/* --- 5. Тессеракт: двойное вращение XW/YW, перспектива 4D→3D --- */
function sceneTesseract(sink, t, env) {
  const ca = Math.cos(t * 0.31), sa = Math.sin(t * 0.31);
  const cb = Math.cos(t * 0.21), sb = Math.sin(t * 0.21);
  const verts = [], f4s = [];
  for (let i = 0; i < 16; i++) {
    const vx = (i & 1) * 2 - 1, vy = ((i >> 1) & 1) * 2 - 1;
    const vz = ((i >> 2) & 1) * 2 - 1, vw = ((i >> 3) & 1) * 2 - 1;
    let x = vx * ca - vw * sa;
    let w = vx * sa + vw * ca;
    let y = vy * cb - w * sb;
    w = vy * sb + w * cb;
    const f4 = 3 / (3 - w);
    verts.push({ x: x * f4 * 0.42, y: y * f4 * 0.42, z: vz * f4 * 0.42 });
    f4s.push(f4);
  }
  for (let i = 0; i < 16; i++) {
    for (let k = 0; k < 4; k++) {
      const j = i | (1 << k);
      if (j === i) continue;
      const pa = env.proj(verts[i].x, verts[i].y, verts[i].z, 0.15, t * 0.1);
      const pb = env.proj(verts[j].x, verts[j].y, verts[j].z, 0.15, t * 0.1);
      const al = Math.min(Math.max(0.12 * (f4s[i] + f4s[j]), 0.08), 0.8);
      sink.line(pa.x, pa.y, pb.x, pb.y, al, 1);
    }
  }
  for (let i = 0; i < 16; i++) {
    const pr = env.proj(verts[i].x, verts[i].y, verts[i].z, 0.15, t * 0.1);
    sink.rect(pr.x - 1.2, pr.y - 1.2, 2.4, Math.min(Math.max(0.1 + 0.18 * f4s[i], 0.15), 0.6));
  }
}

/* --- 6. Морфящийся (p,q)-торус-узел --- */
function sceneKnot(sink, t, env) {
  const pm = 2 + 0.9 * Math.sin(t * 0.09);
  const qm = 3 + 1.5 * Math.sin(t * 0.061 + 1.7);
  const n = 440;
  let prev = null;
  let first = null;
  for (let i = 0; i <= n; i++) {
    const th = 6.2832 * i / n;
    const rr = 0.42 + 0.04 * Math.sin(t * 0.7 + qm * th);
    const pr = env.proj(
      Math.cos(pm * th) * (1 + rr * Math.cos(qm * th)),
      Math.sin(pm * th) * (1 + rr * Math.cos(qm * th)),
      rr * Math.sin(qm * th), 0.22, t * 0.13);
    if (i === 0) first = pr;
    if (i > 0) {
      const al = Math.min(Math.max(0.55 - 0.4 * pr.w / 1.5, 0.1), 0.85);
      sink.line(prev.x, prev.y, pr.x, pr.y, al, 1);
    }
    prev = pr;
  }
  sink.rect(first.x - 1.5, first.y - 1.5, 3, 0.85);
  sink.rect(prev.x - 1.5, prev.y - 1.5, 3, 0.85);
}

/* --- 7. Множество Жюлиа обратной итерацией --- */
function sceneJulia(count) {
  return (sink, t, env) => {
    const phi = t * 0.12;
    const c = { x: 0.7885 * Math.cos(phi), y: 0.7885 * Math.sin(phi) };
    let z = { x: 2, y: 0 };
    const n = count || 2000;
    for (let i = 0; i < n; i++) {
      const wx = z.x - c.x, wy = z.y - c.y;
      const ang = Math.atan2(wy, wx);
      const half = 0.5 * ang + (Math.random() < 0.5 ? 0 : Math.PI);
      const r = Math.sqrt(Math.max(wx * wx + wy * wy, 1e-8));
      z = { x: Math.cos(half) * r, y: Math.sin(half) * r };
      if (i < 12) continue;
      const pr = env.proj(z.x * 0.9, z.y * 0.9, 0, 0.28, t * 0.09);
      const al = 0.14 + 0.16 * Math.min(Math.max(r, 0), 1.6) + 0.1 * Math.random();
      sink.rect(pr.x - 1, pr.y - 1, 2, al);
    }
  };
}

/* Фабрика: createScene(i, opts) → draw(sink, t, env). Лоренц держит
   состояние на инстанс (меню и поле дорожной карты — отдельные нити). */
function createScene(i, opts) {
  const o = opts || {};
  switch (i) {
    case 0: return makeLorenz(o.lorenzCap || 2400);
    case 1: return scenePhyllo;
    case 2: return sceneTorus;
    case 3: return scenePi;
    case 4: return sceneTesseract;
    case 5: return sceneKnot;
    default: return sceneJulia(o.juliaCount || 2000);
  }
}

/* ---------------------------------------------------------------------------
   FieldSink — знаковое поле экрана загрузки: геометрия сэмплится в клетки
   моноширинной сетки, яркость клетки → символ RAMP, послесвечение τ=.34 с. */
const RAMP = ' .,:;+*x%#@';

class FieldSink {
  constructor(field) { this.f = field; }

  line(x1, y1, x2, y2, a) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(d / (this.f.cw * 0.5)));
    for (let i = 0; i <= steps; i++) {
      this.f.feed(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, a);
    }
  }

  poly(pts, a) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, a);
  }

  lines(seg, a) {
    for (let i = 0; i < seg.length; i += 2) this.line(seg[i].x, seg[i].y, seg[i + 1].x, seg[i + 1].y, a);
  }

  rect(x, y, s, a) { this.f.feed(x + s / 2, y + s / 2, a); }

  dot(x, y, r, a) { this.f.feed(x, y, a); }

  str(x, y, size, ch, a) { this.f.feed(x, y, a * 1.4, ch); }
}

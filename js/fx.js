/* interference · эффекты главного меню: скрэмбл-текст, золотая спираль,
   кубические кривые, сердцебиение. Порт scr()/resize()/bez()/hb() из
   main_menu.gd один-в-один. */
'use strict';

const PHI = 1.6180339;
const SCR_CHARS = '0123456789πΣ∫φ';

/* cubic-bezier(x1,y1,x2,y2) в точке x — бинарный поиск параметра. */
function bez(x1, y1, x2, y2, x) {
  let lo = 0, hi = 1, tt = Math.min(Math.max(x, 0), 1);
  for (let i = 0; i < 8; i++) {
    const xx = 3 * tt * (1 - tt) * (1 - tt) * x1
      + 3 * tt * tt * (1 - tt) * x2 + tt * tt * tt;
    if (Math.abs(xx - x) < 0.001) break;
    if (xx < x) lo = tt; else hi = tt;
    tt = (lo + hi) * 0.5;
  }
  return 3 * tt * (1 - tt) * (1 - tt) * y1
    + 3 * tt * (1 - tt) * tt * y2 + tt * tt * tt;
}

function fib(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
  return a;
}

/* Двойной удар сердца — пульс фосфорной точки (порт _heartbeat). */
function hb(tt) {
  const ph = (tt % 1.15) / 1.15;
  const g = p => Math.exp(-Math.pow((p) * 10, 2));
  return Math.max(g(ph - 0.14), 0.55 * g(ph - 0.38));
}

/* Золотая спираль из n квадратов (порт resize()/_build_spiral):
   четвертные дуги по 20–25 точек, «глаз» — центр оставшегося прямоугольника. */
function buildSpiral(x, y, w, h, n, ptsPerArc) {
  const sqs = [];
  const pts = [];
  const ang = [
    [Math.PI, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI],
    [0, 0.5 * Math.PI], [0.5 * Math.PI, Math.PI],
  ];
  const pp = ptsPerArc || 25;
  for (let i = 0; i < n; i++) {
    const k = i % 4;
    const a = ang[k];
    let s, qx, qy, cx, cy;
    if (k === 0) {
      s = h; qx = x; qy = y; cx = qx + s; cy = qy + s;
      x += s; w -= s;
    } else if (k === 1) {
      s = w; qx = x; qy = y; cx = qx; cy = qy + s;
      y += s; h -= s;
    } else if (k === 2) {
      s = h; qx = x + w - s; qy = y; cx = qx; cy = qy;
      w -= s;
    } else {
      s = w; qx = x; qy = y + h - s; cx = qx + s; cy = qy;
      h -= s;
    }
    sqs.push([qx, qy, s]);
    for (let j = 0; j < pp; j++) {
      const a2 = a[0] + (a[1] - a[0]) * j / (pp - 1);
      pts.push({ x: cx + s * Math.cos(a2), y: cy + s * Math.sin(a2) });
    }
  }
  return { sqs, pts, eye: { x: x + w / 2, y: y + h / 2 } };
}

/* ---------------------------------------------------------------------------
   Скрэмбл-движок: порт _scr/_scramble_tick. Тик каждые 0.028 с, за тик
   раскрывается sp символов; нераскрытые — случайные знаки SCR_CHARS.
   Обратный скрэмбл (dying) рассыпает текст в шум и гасит его. */
class ScrEngine {
  constructor() { this.slots = new Set(); this.t = 0; }

  /* slot: {el, target, disp, si, sp, tick, dying, delay, onDone} */
  set(el, txt, sp = 0.55, delay = 0) {
    const s = this._slot(el);
    if (s.dying && s.target === txt) {
      // рассыпающийся текст оживает с той же позиции
      s.dying = false;
    } else {
      s.target = txt; s.si = 0;
    }
    s.sp = sp; s.tick = this.t; s.delay = delay;
    el.textContent = txt;
    this.slots.add(s);
    return s;
  }

  /* обратный скрэмбл: текст рассыпается в шум и исчезает. */
  off(el, sp = 1.0) {
    const s = this._slot(el);
    if (!s.target || s.dying) return;
    s.dying = true;
    s.si = s.target.length;
    s.sp = sp;
    s.tick = this.t;
  }

  _slot(el) {
    if (!el._scr) el._scr = { el, target: '', disp: '', si: 0, sp: 0.55, tick: 0, dying: false, delay: 0 };
    return el._scr;
  }

  tick(t) {
    this.t = t;
    for (const s of this.slots) {
      if (s.delay > 0) { s.delay -= (t - s.tick); s.tick = t; continue; }
      const tgt = s.target;
      if (!tgt || t < s.tick) continue;
      s.tick = t + 0.028;
      if (s.dying) {
        s.si -= s.sp;
        if (s.si <= 0) {
          s.disp = '';
          this.slots.delete(s);
        } else {
          s.disp = mask(tgt, s.si, true);
        }
      } else {
        if (s.si >= tgt.length) continue;
        s.si += s.sp;
        s.disp = s.si >= tgt.length ? tgt : mask(tgt, s.si, false);
      }
      s.el.textContent = s.disp;
    }
  }
}

function mask(tgt, si, dying) {
  let out = '';
  for (let k = 0; k < tgt.length; k++) {
    const c = tgt[k];
    out += (c === ' ' || (dying ? k < si : k < si))
      ? c : SCR_CHARS[(Math.random() * SCR_CHARS.length) | 0];
  }
  return out;
}

/* Канвасный «вебер»: рисует белым с альфой — общий язык фоновых сцен. */
class CanvasSink {
  constructor(ctx) { this.ctx = ctx; }

  line(x1, y1, x2, y2, a, w) {
    const c = this.ctx;
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.lineWidth = w || 1;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  poly(pts, a, w) {
    if (pts.length < 2) return;
    const c = this.ctx;
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.lineWidth = w || 1;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
  }

  lines(seg, a, w) {
    const c = this.ctx;
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.lineWidth = w || 1;
    c.beginPath();
    for (let i = 0; i < seg.length; i += 2) {
      c.moveTo(seg[i].x, seg[i].y);
      c.lineTo(seg[i + 1].x, seg[i + 1].y);
    }
    c.stroke();
  }

  rect(x, y, s, a) {
    const c = this.ctx;
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.fillRect(x, y, s, s);
  }

  dot(x, y, r, a) {
    const c = this.ctx;
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }

  str(x, y, size, ch, a, center) {
    const c = this.ctx;
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.font = `${size}px DotGothic16, monospace`;
    c.textAlign = center ? 'center' : 'left';
    c.fillText(ch, x, y);
  }
}

/* weave: нить-спираль под разделами + рельса. Тот же ход, что «погружение» в меню:
   каждый раздел — поворот на 90° и зум φ вокруг «глаза» спирали. */
(() => {
  'use strict';
  const cv = document.getElementById('thread'), c = cv.getContext('2d');
  const rail = document.getElementById('rail'), dot = document.getElementById('rail-dot');
  const secs = Array.from(document.querySelectorAll('.sec'));
  const ris = Array.from(rail.querySelectorAll('.ri'));
  let w, h, d, sp;
  function size() {
    w = innerWidth; h = innerHeight; d = Math.min(DPR, 1.5);
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    let rh = h * 0.86, rw = rh * PHI;
    if (rw > w * 0.86) { rw = w * 0.86; rh = rw / PHI; }
    sp = buildSpiral((w - rw) / 2, (h - rh) / 2, rw, rh, 14, 25);
    draw();
  }
  function pos() { /* дробный номер раздела под центром экрана */
    const y = scrollY + h * 0.4;
    let i = 0;
    secs.forEach((s, k) => { if (s.offsetTop <= y) i = k; });
    return i + clamp((y - secs[i].offsetTop) / secs[i].offsetHeight, 0, 1);
  }
  function draw() {
    const fade = clamp((scrollY - h * 0.45) / (h * 0.35), 0, 1);
    cv.style.opacity = fade; rail.style.opacity = fade;
    rail.style.pointerEvents = fade > 0.5 ? 'auto' : 'none';
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    if (fade <= 0) return;
    const z = pos(), n = secs.length, e = sp.eye, s = Math.pow(PHI, z);
    dot.style.top = (Math.min(z, n - 1) / (n - 1) * 100) + '%';
    const cur = Math.min(n - 1, Math.floor(z));
    ris.forEach((r, k) => r.classList.toggle('on', k === cur));
    c.translate(e.x, e.y); c.rotate(-Math.PI / 2 * z); c.scale(s, s); c.translate(-e.x, -e.y);
    c.lineWidth = 1 / s;
    c.strokeStyle = 'rgba(255,255,255,.06)';
    sp.sqs.forEach(q => c.strokeRect(q[0], q[1], q[2], q[2]));
    c.strokeStyle = 'rgba(255,255,255,.15)';
    c.beginPath(); sp.pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    const p = sp.pts[Math.floor(clamp(z / (n - 1), 0, 1) * (sp.pts.length - 1))];
    c.fillStyle = 'rgba(232,230,227,.9)';
    c.beginPath(); c.arc(p.x, p.y, Math.max(2 / s, 1), 0, 6.2832); c.fill();
  }
  addEventListener('scroll', draw, { passive: true });
  addEventListener('resize', size);
  size();
})();

// scene.mjs — original procedural artwork; no external assets.
const C = { firstStart:0.8, firstEnd:2.8, secondStart:5.2, secondEnd:7.2 };
const TAU = Math.PI * 2;
const STEP = TAU / 6;
const BASE = -Math.PI / 2;
const vertices = Array.from({length:6}, (_, i) => ({
  x:Math.cos(BASE + i * STEP), y:Math.sin(BASE + i * STEP)
}));
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x*x*x*(10 + x*(-15 + 6*x)); };

export function createScene(canvas) {
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const cx = 960, cy = 455, radius = 286;

  function snowflake(angle, color, width) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = BASE + i * STEP;
      const ux = Math.cos(a), uy = Math.sin(a);
      const vx = -uy, vy = ux;
      const point = (s, h) => [radius*(s*ux+h*vx), radius*(s*uy+h*vy)];
      ctx.moveTo(...point(0, 0));
      ctx.lineTo(...point(1, 0));
      for (const [s, length] of [[0.34,0.14],[0.57,0.21],[0.79,0.16]]) {
        for (const sign of [-1, 1]) {
          ctx.moveTo(...point(s, 0));
          ctx.lineTo(...point(s-length*0.64, sign*length));
        }
      }
      ctx.moveTo(...point(0.86, 0));
      ctx.lineTo(...point(0.93, -0.045));
      ctx.lineTo(...point(1, 0));
      ctx.lineTo(...point(0.93, 0.045));
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }

  function arc(r, start, sweep, color) {
    if (sweep < 0.0001) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, start+sweep);
    ctx.stroke();
    const a = start+sweep;
    ctx.translate(r*Math.cos(a), r*Math.sin(a));
    ctx.rotate(a+Math.PI/2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-13, -6);
    ctx.lineTo(-13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function label(text, x, y, size, color) {
    ctx.font = `400 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw(t) {
    t = Math.max(0, Math.min(10, Number.isFinite(t) ? t : 0));
    const p1 = ease((t-C.firstStart)/(C.firstEnd-C.firstStart));
    const p2 = ease((t-C.secondStart)/(C.secondEnd-C.secondStart));
    const angle = STEP*(p1+p2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 1920, 1080);
    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 920);
    bg.addColorStop(0, '#142b38');
    bg.addColorStop(1, '#080f19');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    // A broad, faint reference remains visible beneath coincident strokes.
    snowflake(0, '#65818d', 9);
    snowflake(0, '#adbdc5', 1.5);
    snowflake(angle, '#b7eced', 4);

    // This bead identifies a material branch; it is not part of the outline.
    const a = BASE+angle;
    const beadX = cx+radius*0.9*Math.cos(a);
    const beadY = cy+radius*0.9*Math.sin(a);
    ctx.fillStyle = '#ffc982';
    ctx.beginPath();
    ctx.arc(beadX, beadY, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffc982';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy-radius*0.9, 11, 0, TAU);
    ctx.stroke();

    arc(345, BASE, STEP*p1, '#93c8d5');
    if (t >= C.firstStart) {
      label('① 60°', cx+211, cy-357, 25, '#93c8d5');
    }
    // All second-action arc and marker timing comes from C.
    if (t >= C.secondStart) {
      arc(345, BASE+STEP, STEP*p2, '#ffc982');
      label('② 60°', cx+415, cy, 25, '#ffc982');
    }
    if (t >= C.secondEnd) {
      arc(390, BASE, angle, '#718f9e');
      label('120°', cx+282, cy+285, 25, '#a8bdc8');
    }

    // Fixed caption timing keeps later local action edits isolated.
    if (t >= 2.8) {
      label('转过一瓣，轮廓重合', 960, 864, 34, '#d9e8ec');
    }
    if (t >= 7.2) {
      label('60° + 60° = 120° · 轮廓仍重合', 960, 925, 30, '#a8bdc8');
    }
    return {
      mechanism: {
        angle,
        referenceAngle:0,
        vertices:vertices.map(({x,y}) => ({x,y}))
      }
    };
  }

  return { meta:{width:1920, height:1080, duration:10}, render:draw };
}

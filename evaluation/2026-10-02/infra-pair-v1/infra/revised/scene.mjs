import { tween, envelope } from './runtime/concept-runtime.mjs';

const C = { firstStart: 0.8, firstEnd: 2.8, secondStart: 4.85, secondEnd: 6.85 };
const STEP = Math.PI / 3;
const TOP = -Math.PI / 2;
const vertices = Array.from({ length: 6 }, (_, i) => ({
  x: Math.cos(TOP + i * STEP),
  y: Math.sin(TOP + i * STEP)
}));

export function createScene(rt) {
  const flake = rt.object('six-armed-crystal', {
    kind: 'sixfold-snowflake',
    geometry: { vertices },
    bounds: { x: -1.04, y: -1.04, width: 2.08, height: 2.08 },
    draw(ctx, style) {
      ctx.strokeStyle = style.color || '#bce7ec';
      ctx.lineWidth = style.lineWidth || 0.009;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(style.ghost ? [0.018, 0.018] : []);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(TOP + i * STEP);
        ctx.moveTo(0, 0);
        ctx.lineTo(1, 0);
        for (const [position, length] of [[0.38, 0.22], [0.62, 0.23], [0.82, 0.14]]) {
          for (const side of [-1, 1]) {
            ctx.moveTo(position, 0);
            ctx.lineTo(position - length * 0.5, side * length * Math.sqrt(3) / 2);
          }
        }
        ctx.moveTo(0.88, 0);
        ctx.lineTo(0.94, -0.035);
        ctx.lineTo(1, 0);
        ctx.lineTo(0.94, 0.035);
        ctx.closePath();
        ctx.restore();
      }
      ctx.stroke();
    }
  });
  const tracer = rt.object('branch-tracer', {
    kind: 'tracking-marker',
    bounds: { x: -0.04, y: -1.04, width: 0.08, height: 0.37 },
    draw(ctx) {
      ctx.strokeStyle = '#edb975';
      ctx.lineWidth = 0.013;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -0.71);
      ctx.lineTo(0, -0.94);
      ctx.stroke();
      ctx.fillStyle = '#edb975';
      ctx.beginPath();
      ctx.arc(0, -1, 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return rt.scene({
    duration: 10, fps: 24, caseId: 'symmetry-compose-10s',
    background: '#101c29',
    shots: [{
      id: 'two-turns-one-outline', start: 0, end: 10,
      camera: { x: 960, y: 540, zoom: 1 },
      draw(f, t) {
        const first = tween(0, STEP, t, C.firstStart, C.firstEnd);
        const second = tween(0, STEP, t, C.secondStart, C.secondEnd);
        const angle = first + second;
        const x = 960, y = 445, scale = 300;
        f.draw(flake, {
          id: 'original-outline', x, y, scale, rotation: 0,
          color: '#7b91a7', opacity: 0.55, lineWidth: 0.006,
          ghost: true, layer: 10
        });
        f.draw(flake, { x, y, scale, rotation: angle, layer: 20 });
        f.draw(tracer, { x, y, scale, rotation: angle, layer: 30 });
        f.arcArrow('first-turn', x, y, 352, TOP, TOP + first, {
          color: '#7daebd', width: 3, opacity: envelope(t, C.firstStart, 10), layer: 35
        });
        f.arcArrow('second-turn', x, y, 352, TOP + STEP, TOP + STEP + second, {
          color: '#edb975', width: 3, opacity: envelope(t, C.secondStart, 10), layer: 35
        });
        const label = (id, text, a, opacity, color) => f.text(
          id, text, x + 402 * Math.cos(a), y + 402 * Math.sin(a) + 10,
          { size: 27, align: 'center', color, opacity }
        );
        label('first-angle', '60°', TOP + STEP / 2,
          envelope(t, C.firstStart, 10), '#7daebd');
        label('second-angle', '+60°', TOP + STEP * 1.5,
          envelope(t, C.secondStart, 10), '#edb975');
        f.text('caption', '每转 60°，雪花轮廓又与原位重合', 960, 883, {
          size: 34, align: 'center', color: '#d8e5e9',
          screen: true, opacity: envelope(t, 0.25, 10)
        });
        f.text('composition', '60° + 60° = 120°', 960, 943, {
          size: 30, align: 'center', color: '#edb975',
          screen: true, opacity: envelope(t, 7.4, 10)
        });
        return {
          mechanism: {
            angle, referenceAngle: 0,
            vertices: vertices.map(({ x, y }) => ({ x, y }))
          }
        };
      }
    }]
  });
}

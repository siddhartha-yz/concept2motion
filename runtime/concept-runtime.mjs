/** Deterministic, dependency-free Canvas scene primitives. No storyboard or model policy. */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const ease = Object.freeze({
  linear: p => clamp(p),
  smooth: p => { p = clamp(p); return p * p * (3 - 2 * p); },
  cubic: p => { p = clamp(p); return p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; },
  out: p => 1 - (1 - clamp(p)) ** 3,
});
export function progress(t, start, end, easing = ease.smooth) {
  if (!(end > start)) throw Error('An animation interval must have positive duration');
  return easing(clamp((t - start) / (end - start)));
}
export const tween = (a, b, t, start, end, easing = ease.smooth) => lerp(a, b, progress(t, start, end, easing));
export function envelope(t, start, end, fade = .25) {
  if (!(end > start) || !(fade >= 0)) throw Error('Invalid envelope interval');
  if (!fade) return t >= start && t < end ? 1 : 0;
  fade = Math.min(fade, (end - start) / 2);
  return progress(t, start, start + fade) * (1 - progress(t, end - fade, end));
}
// D6 action on vertex j: r + (-1)^f j (mod 6). composeD6(a,b) means a after b.
const mod6 = n => ((n % 6) + 6) % 6;
function d6(a) {
  if (!a || !Number.isInteger(a.r) || ![0, 1].includes(a.f)) throw Error('D6 action requires integer r and f in {0,1}');
  return { r: mod6(a.r), f: a.f };
}
export function composeD6(a, b) { a = d6(a); b = d6(b); return { r: mod6(a.r + (a.f ? -b.r : b.r)), f: a.f ^ b.f }; }
export function d6Permutation(a) { a = d6(a); return Array.from({ length: 6 }, (_, j) => mod6(a.r + (a.f ? -j : j))); }
export function snowflakeSegments(depth = 1) {
  if (!Number.isInteger(depth) || depth < 0 || depth > 2) throw Error('Snowflake depth must be 0..2');
  const segments = [];
  const branch = (x, y, angle, length, level) => {
    const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length;
    segments.push([x, y, ex, ey]);
    if (!level) return;
    for (const fraction of [.34, .6, .82]) for (const sign of [-1, 1]) {
      branch(lerp(x, ex, fraction), lerp(y, ey, fraction), angle + sign * Math.PI / 3,
        length * .3 * (1.15 - fraction), level - 1);
    }
  };
  for (let arm = 0; arm < 6; arm++) branch(0, 0, arm * TAU / 6 - Math.PI / 2, 1, depth);
  return segments;
}
export function transformPoint(x, y, pose = {}) {
  const sx = pose.scaleX ?? pose.scale ?? 1, sy = pose.scaleY ?? pose.scale ?? 1;
  const c = Math.cos(pose.rotation ?? 0), s = Math.sin(pose.rotation ?? 0);
  return { x: (pose.x ?? 0) + x * sx * c - y * sy * s, y: (pose.y ?? 0) + x * sx * s + y * sy * c };
}
function cameraPoint(p, camera, width, height) {
  return transformPoint(p.x - camera.x, p.y - camera.y,
    { x: width / 2, y: height / 2, scale: camera.zoom, rotation: camera.rotation });
}
function measuredBounds(local, pose, camera, width, height, screen = false, points = null, padding = 0) {
  const corners = (points ?? [[local.x, local.y], [local.x + local.width, local.y],
    [local.x, local.y + local.height], [local.x + local.width, local.y + local.height]]).map(([x, y]) => {
    const p = transformPoint(x, y, pose); return screen ? p : cameraPoint(p, camera, width, height);
  });
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const pad = padding * Math.max(Math.abs(pose.scaleX ?? pose.scale ?? 1), Math.abs(pose.scaleY ?? pose.scale ?? 1)) * (screen ? 1 : camera.zoom);
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + 2 * pad, height: Math.max(...ys) - Math.min(...ys) + 2 * pad };
}
function applyPose(ctx, pose) {
  ctx.translate(pose.x ?? 0, pose.y ?? 0); ctx.rotate(pose.rotation ?? 0);
  ctx.scale(pose.scaleX ?? pose.scale ?? 1, pose.scaleY ?? pose.scale ?? 1);
}
function strokeSegments(ctx, segments, amount, width, color) {
  const lengths = segments.map(s => Math.hypot(s[2] - s[0], s[3] - s[1]));
  let left = lengths.reduce((a, b) => a + b, 0) * clamp(amount);
  ctx.beginPath();
  for (let i = 0; i < segments.length && left > 0; i++) {
    const [x, y, ex, ey] = segments[i], p = Math.min(1, left / lengths[i]);
    ctx.moveTo(x, y); ctx.lineTo(lerp(x, ex, p), lerp(y, ey, p)); left -= lengths[i];
  }
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}

function timingDictionary(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} must be a timing dictionary`);
  return Object.entries(value);
}
function timingRecord(id, value, partial = false) {
  if (!id.trim()) throw Error('Timing id must be nonempty');
  const entries = timingDictionary(value, `Timing ${id}`);
  if (!entries.length || entries.some(([key, number]) => !['start', 'end'].includes(key) || !Number.isFinite(number))) {
    throw Error(`Timing ${id} permits only finite start/end fields`);
  }
  if (!partial && (!Object.hasOwn(value, 'start') || !Object.hasOwn(value, 'end'))) throw Error(`Timing ${id} requires start and end`);
  if (Object.hasOwn(value, 'start') && Object.hasOwn(value, 'end') && value.end <= value.start) throw Error(`Timing ${id} requires end > start`);
  return Object.freeze(Object.fromEntries(entries));
}

export function createRuntime(canvas, options = {}) {
  if (!canvas?.getContext) throw Error('A Canvas is required');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas 2D context is unavailable');
  const width = options.width ?? canvas.width ?? 1920, height = options.height ?? canvas.height ?? 1080;
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw Error('Invalid canvas dimensions');
  canvas.width = width; canvas.height = height;
  const font = options.font ?? '"Noto Serif CJK SC", "Noto Serif SC", "Songti SC", serif';
  const safe = Object.freeze({ x: width * .06, y: height * .06, width: width * .88,
    height: height * .76, subtitleY: height * .91, subtitleWidth: width * .86 });
  const overrides = new Map(timingDictionary(options.timings === undefined ? {} : options.timings, 'Timing overrides').map(([id, value]) => [id, timingRecord(id, value, true)]));
  const registeredTimings = new Map();
  let timingsSealed = false;
  const timings = definitions => {
    if (timingsSealed) throw Error('Register timings before creating a scene');
    const entries = timingDictionary(definitions, 'Timing definitions');
    if (!entries.length) throw Error('Timing definitions must not be empty');
    // Validate the complete group before registering any entry.
    const effective = entries.map(([id, value]) => {
      if (registeredTimings.has(id)) throw Error(`Duplicate timing id: ${id}`);
      const original = timingRecord(id, value);
      const merged = timingRecord(id, { ...original, ...(overrides.get(id) ?? {}) });
      return [id, merged];
    });
    for (const [id, value] of effective) registeredTimings.set(id, value);
    return Object.freeze(Object.fromEntries(effective));
  };
  const objects = new Map();
  const object = (id, definition) => {
    if (typeof id !== 'string' || !id || objects.has(id)) throw Error(`Duplicate or empty object id: ${id}`);
    if (typeof definition.draw !== 'function' || !definition.bounds ||
      !['x', 'y', 'width', 'height'].every(k => Number.isFinite(definition.bounds[k])) ||
      definition.bounds.width < 0 || definition.bounds.height < 0) throw Error('Object needs draw(ctx, style) and finite bounds');
    const result = Object.freeze({ ...definition, id, bounds: Object.freeze({ ...definition.bounds }) });
    objects.set(id, result); return result;
  };
  const snowflake = (id, settings = {}) => {
    const segments = snowflakeSegments(settings.depth ?? 1);
    return object(id, { kind: 'snowflake', bounds: { x: -1.025, y: -1.025, width: 2.05, height: 2.05 },
      geometry: { segments }, measurementPoints: segments.flatMap(([x,y,ex,ey]) => [[x,y],[ex,ey]]), padding: .025, draw(c, style) {
        const color = style.color ?? settings.color ?? '#b9e6ff', amount = style.reveal ?? 1;
        if (style.glow ?? settings.glow ?? true) {
          c.globalAlpha *= .12; strokeSegments(c, segments, amount, .035, color); c.globalAlpha /= .12;
        }
        strokeSegments(c, segments, amount, style.lineWidth ?? .008, color);
      } });
  };
  const hexagon = (id, settings = {}) => {
    const colors = settings.colors ?? ['#e6bc71', '#dd8360', '#b881b6', '#819ec9', '#7ebaa5', '#c7ca80'];
    const vertices = Array.from({ length: 6 }, (_, j) => ({ x: Math.sin(j * TAU / 6), y: -Math.cos(j * TAU / 6) }));
    return object(id, { kind: 'hexagon', bounds: { x: -1.025, y: -1.025, width: 2.05, height: 2.05 },
      geometry: { vertices }, measurementPoints: vertices.map(p => [p.x,p.y]), padding: .025, draw(c, style) {
        for (let j = 0; j < 6; j++) {
          c.beginPath(); c.moveTo(0, 0); c.lineTo(vertices[j].x, vertices[j].y);
          c.lineTo(vertices[(j + 1) % 6].x, vertices[(j + 1) % 6].y); c.closePath();
          c.fillStyle = colors[j % colors.length]; c.fill();
        }
        c.beginPath(); vertices.forEach((p, j) => c[j ? 'lineTo' : 'moveTo'](p.x, p.y)); c.closePath();
        c.lineWidth = .015; c.strokeStyle = style.color ?? '#edf1f9'; c.stroke();
        if (style.marker ?? settings.marker ?? true) { c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -.72, .04, 0, TAU); c.fill(); }
      } });
  };

  function scene(settings) {
    const { duration, shots } = settings;
    const fps = settings.fps ?? options.fps ?? 30;
    if (!(duration > 0 && Number.isFinite(duration)) || !Number.isFinite(fps) || fps <= 0 || !Array.isArray(shots) || !shots.length) throw Error('Scene needs positive duration/fps and shots');
    const ids = new Set(); let boundary = 0;
    const frozenShots = shots.map(shot => {
      if (!shot.id || ids.has(shot.id) || shot.start !== boundary || !(shot.end > shot.start) || typeof shot.draw !== 'function') throw Error('Shots require unique ids and contiguous increasing intervals');
      ids.add(shot.id); boundary = shot.end; return { ...shot };
    });
    if (boundary !== duration) throw Error('Shots must cover the exact scene duration');
    for (const id of overrides.keys()) if (!registeredTimings.has(id)) throw Error(`Unknown timing override id: ${id}`);
    timingsSealed = true;
    const effectiveTimings = Object.freeze(Object.fromEntries(registeredTimings));
    const meta = Object.freeze({ version: 2, renderer: 'canvas2d', runtime: 'concept-runtime-v1',
      caseId: settings.caseId ?? options.caseId ?? 'concept', width, height, duration, fps, timings: effectiveTimings,
      shots: frozenShots.map(({ id, start, end }) => ({ id, start, end })) });
    function render(requestedTime) {
      if (!Number.isFinite(requestedTime)) throw Error('Render time must be finite');
      const time = clamp(requestedTime, 0, duration);
      const shot = frozenShots.find(s => time >= s.start && time < s.end) ?? frozenShots.at(-1);
      const localTime = time - shot.start;
      const camera = { x: width / 2, y: height / 2, zoom: 1, rotation: 0,
        ...(typeof shot.camera === 'function' ? shot.camera(localTime) : shot.camera) };
      if (![camera.x, camera.y, camera.zoom, camera.rotation].every(Number.isFinite) || camera.zoom <= 0) throw Error('Camera requires finite x/y/rotation and positive zoom');
      const commands = [], bounds = [], poses = [], findings = [], usedIds = new Set();
      let index = 0;
      const enqueue = (id, kind, local, pose, draw, style = {}, points = null, padding = 0) => {
        if (!id || usedIds.has(id)) throw Error(`Duplicate or empty frame id: ${id}`); usedIds.add(id);
        if (!['x', 'y', 'rotation', 'scale', 'scaleX', 'scaleY', 'opacity'].every(k => pose[k] == null || Number.isFinite(pose[k]))) throw Error('Pose values must be finite');
        const opacity = clamp(pose.opacity ?? 1), screen = style.screen ?? false;
        const rect = measuredBounds(local, pose, camera, width, height, screen, points, padding);
        bounds.push({ id, kind, ...rect, opacity });
        commands.push({ index: index++, layer: style.layer ?? (screen ? 100 : 20), draw() {
          ctx.save(); ctx.globalAlpha = opacity;
          if (!screen) { ctx.translate(width / 2, height / 2); ctx.rotate(camera.rotation); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y); }
          applyPose(ctx, pose); draw(ctx); ctx.restore();
        } });
      };
      const f = {
        time, localTime, shot: shot.id, width, height, safe, camera,
        draw(obj, pose = {}) {
          if (!obj || objects.get(obj.id) !== obj) throw Error('Draw an object from this runtime');
          const id = pose.id ?? obj.id;
          enqueue(id, 'shape', obj.bounds, pose, c => obj.draw(c, pose), pose, obj.measurementPoints, Math.max(obj.padding ?? 0, (pose.lineWidth ?? 0) / 2));
          poses.push({ id, sourceId: obj.id, kind: obj.kind ?? 'custom', x: pose.x ?? 0, y: pose.y ?? 0,
            rotation: pose.rotation ?? 0, scale: pose.scale ?? 1, scaleX: pose.scaleX ?? pose.scale ?? 1, scaleY: pose.scaleY ?? pose.scale ?? 1,
            opacity: clamp(pose.opacity ?? 1), ...(obj.geometry ? { geometry: obj.geometry } : {}) });
          return obj;
        },
        text(id, text, x, y, style = {}) {
          const size = style.size ?? 42, align = style.align ?? 'center';
          ctx.save(); ctx.font = `${style.weight ?? 400} ${size}px ${style.font ?? font}`;
          const m = ctx.measureText(String(text)); ctx.restore();
          const local = { x: align === 'center' ? -m.width / 2 : align === 'right' ? -m.width : 0,
            y: -(m.actualBoundingBoxAscent ?? size * .8), width: m.width,
            height: (m.actualBoundingBoxAscent ?? size * .8) + (m.actualBoundingBoxDescent ?? size * .2) };
          enqueue(id, 'text', local, { x, y, opacity: style.opacity ?? 1 }, c => {
            c.font = `${style.weight ?? 400} ${size}px ${style.font ?? font}`; c.textAlign = align; c.textBaseline = 'alphabetic';
            c.fillStyle = style.color ?? '#f3eee5'; c.fillText(String(text), 0, 0);
          }, style);
          return local.width;
        },
        caption(text, style = {}) {
          const measuredWidth = f.text(style.id ?? 'caption', text, width / 2, safe.subtitleY,
            { size: 40, weight: 500, ...style, screen: true, layer: 100 });
          if (measuredWidth > safe.subtitleWidth) findings.push({ code: 'caption_too_wide', id: style.id ?? 'caption', measuredWidth, safeWidth: safe.subtitleWidth });
        },
        raw(id, draw, localBounds, style = {}) {
          if (typeof draw !== 'function' || !localBounds || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(localBounds[k]))) throw Error('raw requires draw callback and declared finite bounds');
          enqueue(id, style.kind ?? 'shape', localBounds, style, c => draw(c, f), style);
        },
        line(id, x1, y1, x2, y2, style = {}) {
          const lineWidth = style.width ?? 3;
          f.raw(id, c => { c.strokeStyle = style.color ?? '#e9c681'; c.lineWidth = lineWidth;
            c.setLineDash(style.dash ?? []); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); },
          { x: Math.min(x1, x2) - lineWidth / 2, y: Math.min(y1, y2) - lineWidth / 2,
            width: Math.abs(x2 - x1) + lineWidth, height: Math.abs(y2 - y1) + lineWidth }, style);
        },
        arcArrow(id, x, y, radius, start, end, style = {}) {
          if (Math.abs(end - start) < 1e-6) return;
          f.raw(id, c => {
            c.strokeStyle = c.fillStyle = style.color ?? '#edc57d'; c.lineWidth = style.width ?? 3;
            const ccw = end < start; c.beginPath(); c.arc(x, y, radius, start, end, ccw); c.stroke();
            const hx = x + Math.cos(end) * radius, hy = y + Math.sin(end) * radius;
            const direction = end + (ccw ? -1 : 1) * Math.PI / 2;
            c.beginPath(); c.moveTo(hx, hy);
            for (const angle of [direction + 2.55, direction - 2.55]) c.lineTo(hx + Math.cos(angle) * 16, hy + Math.sin(angle) * 16);
            c.closePath(); c.fill();
          }, { x: x - radius - 18, y: y - radius - 18, width: 2 * radius + 36, height: 2 * radius + 36 }, style);
        },
      };
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; ctx.filter = 'none'; ctx.setLineDash([]);
      const background = shot.background ?? settings.background ?? '#08101b';
      ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
      const evidence = shot.draw(f, localTime) ?? {};
      commands.sort((a, b) => a.layer - b.layer || a.index - b.index).forEach(c => c.draw());
      return { ...evidence, time, requestedTime, stage: shot.id, shot: shot.id, camera, bounds, objects: poses, findings };
    }
    return Object.freeze({ meta, render });
  }
  return Object.freeze({ canvas, width, height, safe, object, snowflake, hexagon, scene, timings, ease, progress, tween, envelope, composeD6, d6Permutation });
}

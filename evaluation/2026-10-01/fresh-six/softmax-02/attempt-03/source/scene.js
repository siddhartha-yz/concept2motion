(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const COLORS = ['#F6A66C', '#6FCBCD', '#A995F2'];
  const BG = '#10151F', WHITE = '#EDF0F5', MUTED = '#97A2B5', LINE = '#465367';
  const logits = [-1.0, 0.6, 1.8];
  const masses = logits.map(Math.exp);
  const denominator = masses.reduce((a, b) => a + b, 0);
  const probabilities = masses.map(v => v / denominator);
  const stages = ['logits', 'exponential', 'shared-total', 'normalizing', 'normalized'];
  const starts = [0, 2.3, 4.5, 6.6, 9.4];
  const ends = [2.3, 4.5, 6.6, 9.4, 12];
  const rows = [360, 510, 660];
  const capacity = {id: 'capacity', x: 480, y: 502, width: 1170, height: 76};
  const rawScale = 90;
  const rawWidth = denominator * rawScale;
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = v => { const u = clamp(v); return u * u * u * (u * (u * 6 - 15) + 10); };
  const mix = (a, b, u) => a + (b - a) * u;
  let bounds;

  function rect(id, x, y, width, height, color, opacity = 1) {
    if (width <= 0 || height <= 0 || opacity <= 0) return;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    bounds.push({id, kind: 'shape', x, y, width, height, opacity});
  }
  function line(id, x1, y1, x2, y2, color, thickness = 2, opacity = 1) {
    if (opacity <= 0 || (x1 === x2 && y1 === y2)) return;
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const p = thickness / 2;
    bounds.push({id, kind: 'shape', x: Math.min(x1, x2) - p, y: Math.min(y1, y2) - p,
      width: Math.abs(x2 - x1) + thickness, height: Math.abs(y2 - y1) + thickness, opacity});
  }
  function circle(id, x, y, radius, color, opacity = 1) {
    if (opacity <= 0) return;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    bounds.push({id, kind: 'shape', x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, opacity});
  }
  function text(id, value, x, baseline, size, color = WHITE, opacity = 1, weight = 400, centered = false) {
    if (opacity <= 0) return 0;
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(value);
    const drawX = centered ? x - m.width / 2 : x;
    const left = m.actualBoundingBoxLeft;
    const right = m.actualBoundingBoxRight;
    const ascent = m.actualBoundingBoxAscent;
    const descent = m.actualBoundingBoxDescent;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(value, drawX, baseline);
    bounds.push({id, kind: 'text', text: value, x: drawX - left, y: baseline - ascent,
      width: left + right, height: ascent + descent, opacity});
    return m.width;
  }
  function signedBars(amount, opacity) {
    logits.forEach((v, i) => {
      const displacement = v * 140 * amount;
      rect(`logit-${i}`, 670 + Math.min(0, displacement), rows[i] - 19,
        Math.abs(displacement), 38, COLORS[i], opacity);
    });
  }
  function sumExpression(normalized, opacity) {
    const values = normalized ? probabilities.map(v => v.toFixed(3)) : masses.map(v => v.toFixed(3));
    let x = 480;
    values.forEach((v, i) => {
      x += text(`sum-term-${i}`, v, x, 735, 30, COLORS[i], opacity, 500) + 18;
      if (i < 2) x += text(`sum-plus-${i}`, '+', x, 735, 30, MUTED, opacity) + 18;
    });
    x += text('sum-equals', '=', x, 735, 30, MUTED, opacity) + 18;
    text('sum-result', normalized ? '1.000' : denominator.toFixed(3), x, 735, 30, WHITE, opacity, 600);
    text('sum-description', normalized ? 'PROBABILITY SUM' : 'SHARED DENOMINATOR', 480, 787, 18, MUTED, opacity, 500);
  }
  function capacityFrame(opacity) {
    const x = capacity.x - 8, y = capacity.y - 8;
    const w = capacity.width + 16, h = capacity.height + 16;
    line('capacity-top', x, y, x + w, y, LINE, 2, opacity);
    line('capacity-bottom', x, y + h, x + w, y + h, LINE, 2, opacity);
    line('capacity-left', x, y, x, y + h, LINE, 2, opacity);
    line('capacity-right', x + w, y, x + w, y + h, LINE, 2, opacity);
  }
  function probabilitySumIndicator() {
    const right = capacity.x + capacity.width;
    line('sum-trace', capacity.x, 646, right, 646, MUTED, 2, 0.75);
    line('sum-trace-start', capacity.x, 636, capacity.x, 656, MUTED, 2, 0.75);
    line('sum-trace-end', right, 636, right, 656, MUTED, 2, 0.75);
    text('sum-trace-label', 'FIXED WHOLE  1.000', capacity.x, 621, 18, MUTED, 1, 500);
  }

  function render(requestedTime) {
    const n = Number(requestedTime);
    const time = Math.max(0, Math.min(12, Number.isFinite(n) ? n : 0));
    let index = 0;
    while (index < 4 && time >= ends[index]) index++;
    const stage = stages[index];
    const local = clamp((time - starts[index]) / (ends[index] - starts[index]));
    const q = ease(local);
    bounds = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, 1920, 1080);
    bounds.push({id: 'backdrop', kind: 'background', x: 0, y: 0, width: 1920, height: 1080, opacity: 1});

    text('title', 'Shared denominator', 120, 111, 56, WHITE, 1, 600);
    text('eyebrow', 'SOFTMAX · THREE CLASSES', 1465, 105, 18, MUTED, 1, 500);
    const subtitles = ['Signed evidence', 'Positive exponential mass', 'Every class contributes', 'Divide by the same total · rescale the lengths', 'Three shares. One whole.'];
    text('subtitle', subtitles[index], 122, 177, 26, MUTED);
    const formulas = ['z = (−1.0, +0.6, +1.8)', 'mᵢ = exp(zᵢ)', 'S = m₀ + m₁ + m₂', 'pᵢ = mᵢ / S     S = 8.240', 'p₀ + p₁ + p₂ = 1'];
    text('formula', formulas[index], 480, 252, 38, WHITE, 1, 500);
    const headings = ['LOGIT', 'MASS', 'MASS', 'MASS / S → PROBABILITY', 'PROBABILITY'];
    text('column-heading', headings[index], 140, 294, 18, MUTED, 1, 500);
    const displayed = index === 0 ? ['−1.0', '+0.6', '+1.8'] : index < 4 ? masses.map(v => v.toFixed(3)) : probabilities.map(v => v.toFixed(3));
    rows.forEach((y, i) => {
      text(`class-label-${i}`, ['A', 'B', 'C'][i], 140, y + 11, 32, COLORS[i], 1, 600);
      if (index === 3) {
        text(`class-division-${i}`, `${masses[i].toFixed(3)} / ${denominator.toFixed(3)}`, 205, y - 8, 24, COLORS[i], 1, 500);
        text(`class-value-${i}`, `= ${probabilities[i].toFixed(3)}`, 205, y + 27, 28, COLORS[i], 1, 600);
      } else {
        text(`class-value-${i}`, displayed[i], 205, y + 11, 32, COLORS[i], 1, 500);
      }
    });

    let geometry = {};
    if (index <= 1) {
      const oldOpacity = index === 0 ? 1 : 1 - ease(local / 0.33);
      line('zero-axis', 670, 333, 670, 704, LINE, 2, oldOpacity);
      text('zero-label', '0', 670, 312, 21, MUTED, oldOpacity, 400, true);
      signedBars(index === 0 ? q : 1, oldOpacity);
      if (index === 1) masses.forEach((m, i) => {
        rect(`class-${i}`, 670, rows[i] - 19, m * rawScale * q, 38, COLORS[i]);
      });
    } else if (index === 2) {
      let cumulative = 0;
      masses.forEach((m, i) => {
        const targetX = 480 + cumulative * rawScale;
        const centerY = mix(rows[i], 540, q);
        const height = mix(38, 76, q);
        rect(`class-${i}`, mix(670, targetX, q), centerY - height / 2, m * rawScale, height, COLORS[i]);
        cumulative += m;
      });
      const annotationOpacity = ease((local - 0.73) / 0.27);
      text('total-label', `SHARED TOTAL  ${denominator.toFixed(3)}`, 480, 440, 21, MUTED, annotationOpacity, 500);
      line('total-bracket', 480, 474, 480 + rawWidth, 474, MUTED, 2, annotationOpacity);
      line('total-bracket-left', 480, 474, 480, 486, MUTED, 2, annotationOpacity);
      line('total-bracket-right', 480 + rawWidth, 474, 480 + rawWidth, 486, MUTED, 2, annotationOpacity);
      sumExpression(false, ease(local / 0.3));
    } else {
      const totalWidth = index === 3 ? mix(rawWidth, capacity.width, q) : capacity.width;
      capacityFrame(index === 3 ? ease(local / 0.3) : 1);
      text('capacity-label', index === 3 ? 'TARGET CAPACITY  1' : 'TOTAL CAPACITY  1', 480, 440, 21, MUTED, 1, 500);
      if (index === 3) {
        text('rescaling-units', '8.240 MASS UNITS → 1.000 PROBABILITY · LENGTH SCALE CHANGES', 480, 478, 18, MUTED, 1, 500);
      }
      const segments = [];
      let x = capacity.x;
      probabilities.forEach((p, i) => {
        const width = i === 2 ? capacity.x + totalWidth - x : totalWidth * p;
        rect(`class-${i}`, x, capacity.y, width, capacity.height, COLORS[i]);
        segments.push({id: `class-${i}`, x, y: capacity.y, width, height: capacity.height, color: COLORS[i]});
        x += width;
      });
      sumExpression(true, 1);
      probabilitySumIndicator();
      if (index === 4) geometry = {capacity: {...capacity}, segments};
    }

    const nodes = [140, 530, 920, 1310, 1700];
    line('stage-track', nodes[0], 932, nodes[4], 932, LINE, 2, 0.65);
    const navLabels = ['logits', 'exponential', 'shared total', 'normalizing', 'normalized'];
    nodes.forEach((x, i) => {
      circle(`stage-node-${i}`, x, 932, 5, i <= index ? WHITE : LINE, i <= index ? 0.7 : 1);
      text(`stage-name-${i}`, navLabels[i], x, 986, 21, i === index ? WHITE : MUTED, 1, i === index ? 600 : 400, true);
    });
    const cursor = index === 4 ? nodes[4] : mix(nodes[index], nodes[index + 1], q);
    const cursorRadius = index === 4 ? 8 + 2 * Math.sin(Math.PI * local) : 8;
    circle('stage-cursor', cursor, 932, cursorRadius, WHITE);
    ctx.globalAlpha = 1;
    return {
      time, stage,
      mechanism: {logits: [...logits], masses: [...masses], denominator, probabilities: [...probabilities]},
      geometry, bounds
    };
  }

  window.C2M = {
    meta: {version: 1, caseId: 'softmax', renderer: 'canvas2d', width: 1920, height: 1080, duration: 12, fps: 60},
    render
  };
  render(0);
  if (new URLSearchParams(window.location.search).get('export') !== '1') {
    let origin = null, previousFrame = -1;
    function playback(timestamp) {
      if (origin === null) origin = timestamp;
      const frame = Math.min(720, Math.floor((timestamp - origin) * 60 / 1000));
      if (frame !== previousFrame) {
        render(frame / 60);
        previousFrame = frame;
      }
      if (frame < 720) requestAnimationFrame(playback);
    }
    requestAnimationFrame(playback);
  }
})();
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const W = 1920, H = 1080, duration = 12;
  const background = '#101521';
  const ink = '#EDF1FA', muted = '#9BA9BF', rail = '#293449';
  const colors = ['#F28C78', '#70C8DA', '#B5A0F3'];
  const logits = [-1.0, 0.6, 1.8];
  const masses = logits.map(Math.exp);
  const denominator = masses.reduce((a, b) => a + b, 0);
  const probabilities = masses.map(m => m / denominator);
  const cumulative = [0, masses[0], masses[0] + masses[1]];
  const stages = ['logits', 'exponential', 'shared-total', 'normalizing', 'normalized'];
  const stageLabels = ['SIGNED LOGITS', 'POSITIVE MASS', 'SHARED TOTAL', 'DIVIDE TOGETHER', 'TOTAL ONE'];
  const centers = [410, 600, 790];
  const rawScale = 110;
  const cap = {x: 520, y: 566, width: 1200, height: 108};
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, u) => a + (b - a) * u;

  function render(requestedTime) {
    const time = clamp(Number.isFinite(requestedTime) ? requestedTime : 0, 0, duration);
    const stageIndex = time < 2.25 ? 0 : time < 4.5 ? 1 : time < 6.75 ? 2 : time < 9 ? 3 : 4;
    const stage = stages[stageIndex];
    const bounds = [];
    const geometry = {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    function record(id, type, x, y, width, height, opacity, color) {
      bounds.push({id, kind: 'shape', type, x, y, width, height, opacity, color});
    }
    function rect(id, x, y, width, height, color, opacity = 1) {
      if (opacity <= 0 || width <= 0 || height <= 0) return;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
      record(id, 'rect', x, y, width, height, opacity, color);
    }
    function line(id, x1, y1, x2, y2, color, thickness = 2, opacity = 1) {
      if (opacity <= 0) return;
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const horizontal = y1 === y2;
      const vertical = x1 === x2;
      record(id, 'line', Math.min(x1, x2) - (vertical ? thickness / 2 : horizontal ? 0 : thickness / 2), Math.min(y1, y2) - (horizontal ? thickness / 2 : vertical ? 0 : thickness / 2), Math.abs(x2 - x1) + (vertical ? thickness : horizontal ? 0 : thickness), Math.abs(y2 - y1) + (horizontal ? thickness : vertical ? 0 : thickness), opacity, color);
    }
    function circle(id, x, y, radius, color, opacity = 1) {
      if (opacity <= 0) return;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      record(id, 'circle', x - radius, y - radius, radius * 2, radius * 2, opacity, color);
    }
    function triangle(id, x, y, color) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 13);
      ctx.lineTo(x + 7, y + 13);
      ctx.closePath();
      ctx.fill();
      record(id, 'triangle', x - 7, y, 14, 13, 1, color);
    }
    function text(id, content, x, baseline, size, color = ink, align = 'left', opacity = 1, weight = 400) {
      if (opacity <= 0) return;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(content);
      const drawX = align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x;
      ctx.fillText(content, drawX, baseline);
      bounds.push({id, kind: 'text', text: content, x: drawX - m.actualBoundingBoxLeft, y: baseline - m.actualBoundingBoxAscent, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, opacity, color});
    }
    function signedBars(opacity, reveal) {
      if (opacity <= 0) return;
      for (let i = 0; i < 3; i++) {
        const origin = 860;
        const end = origin + logits[i] * 180 * reveal;
        line(`zero-axis-${i}`, origin, centers[i] - 44, origin, centers[i] + 44, muted, 2, opacity);
        rect(`signed-logit-${i}`, Math.min(origin, end), centers[i] - 31, Math.abs(end - origin), 62, colors[i], opacity);
      }
      text('zero-label', '0', 860, 335, 23, muted, 'center', opacity);
    }
    function bracket(width, opacity) {
      line('total-bracket', 520, 746, 520 + width, 746, muted, 2, opacity);
      line('total-left-tick', 520, 734, 520, 758, muted, 2, opacity);
      line('total-right-tick', 520 + width, 734, 520 + width, 758, muted, 2, opacity);
    }

    text('title', 'Shared denominator', 120, 116, 50, ink, 'left', 1, 600);
    text('stage-label', `${String(stageIndex + 1).padStart(2, '0')} / 05   ${stageLabels[stageIndex]}`, 1800, 111, 23, muted, 'right');
    line('header-divider', 120, 158, 1800, 158, rail, 2);

    const equations = [
      'z = (−1.0, 0.6, 1.8)',
      `exp(z) = (${masses.map(v => v.toFixed(3)).join(', ')})`,
      `D = ${masses.map(v => v.toFixed(3)).join(' + ')} = ${denominator.toFixed(3)}`,
      `pᵢ = exp(zᵢ) / ${denominator.toFixed(3)}`,
      `p = (${probabilities.map(v => v.toFixed(4)).join(', ')})`
    ];
    text('equation', equations[stageIndex], 520, 244, 39, ink);

    for (let i = 0; i < 3; i++) {
      text(`class-label-${i}`, `CLASS ${['A', 'B', 'C'][i]}`, 120, centers[i] - 7, 26, colors[i], 'left', 1, 600);
      let value;
      if (stageIndex === 0) value = `z = ${logits[i].toFixed(1).replace('-', '−')}`;
      else if (stageIndex === 1) value = `${logits[i].toFixed(1).replace('-', '−')} → ${masses[i].toFixed(3)}`;
      else if (stageIndex === 2) value = `mass = ${masses[i].toFixed(3)}`;
      else if (stageIndex === 3) value = `${masses[i].toFixed(3)} / ${denominator.toFixed(3)}`;
      else value = `p = ${probabilities[i].toFixed(4)}`;
      text(`class-value-${i}`, value, 120, centers[i] + 33, 25, muted);
    }

    if (stageIndex === 0) {
      const u = time / 2.25;
      for (let i = 0; i < 3; i++) line(`lane-${i}`, 520, centers[i], 1720, centers[i], rail, 2);
      signedBars(1, mix(0.22, 1, smooth(u)));
      text('footer', 'Signed values: the first class begins left of zero.', 520, 980, 27, muted);
    } else if (stageIndex === 1) {
      const u = (time - 2.25) / 2.25;
      const transform = smooth(u / 0.34);
      for (let i = 0; i < 3; i++) line(`lane-${i}`, 520, centers[i], 1720, centers[i], rail, 2);
      signedBars(1 - transform, 1);
      for (let i = 0; i < 3; i++) {
        const width = masses[i] * rawScale * mix(0.65, 1, smooth(u));
        rect(`exponential-mass-${i}`, 520, centers[i] - 31, width, 62, colors[i], transform);
      }
      text('footer', 'Exponentiation makes every class mass positive.', 520, 980, 27, muted);
    } else if (stageIndex === 2) {
      const u = (time - 4.5) / 2.25;
      const gather = smooth(u);
      for (let i = 0; i < 3; i++) {
        line(`lane-${i}`, 520, centers[i], 1720, centers[i], rail, 2, 1 - gather);
        const height = mix(62, cap.height, gather);
        const centerY = mix(centers[i], cap.y + cap.height / 2, gather);
        const x = mix(520, 520 + cumulative[i] * rawScale, gather);
        rect(`shared-mass-${i}`, x, centerY - height / 2, masses[i] * rawScale, height, colors[i]);
      }
      const alpha = smooth((u - 0.52) / 0.38);
      bracket(denominator * rawScale, alpha);
      text('denominator-label', `shared total  D = ${denominator.toFixed(3)}`, 520, 820, 28, muted, 'left', alpha);
      text('footer', 'All three masses join the same total.', 520, 980, 27, muted);
    } else if (stageIndex === 3) {
      const u = (time - 6.75) / 2.25;
      const divide = smooth(u);
      const width = mix(denominator * rawScale, cap.width, divide);
      const scale = width / denominator;
      for (let i = 0; i < 3; i++) {
        rect(`normalizing-mass-${i}`, cap.x + cumulative[i] * scale, cap.y, masses[i] * scale, cap.height, colors[i]);
      }
      bracket(width, 1);
      text('normalization-label', `one common divisor: ${denominator.toFixed(3)}`, 520, 820, 28, muted);
      text('footer', 'A common scale preserves the three proportions.', 520, 980, 27, muted);
    } else {
      rect('capacity-border', cap.x - 2, cap.y - 2, cap.width + 4, cap.height + 4, '#48566E');
      geometry.capacity = {...cap};
      geometry.segments = [];
      let cursor = cap.x;
      for (let i = 0; i < 3; i++) {
        const width = probabilities[i] * cap.width;
        const segment = {id: `class-${i}`, x: cursor, y: cap.y, width, height: cap.height, color: colors[i]};
        geometry.segments.push(segment);
        rect(segment.id, segment.x, segment.y, segment.width, segment.height, segment.color);
        cursor += width;
      }
      bracket(cap.width, 1);
      text('capacity-zero', '0', cap.x, 797, 25, muted, 'center');
      text('capacity-one', '1', cap.x + cap.width, 797, 25, muted, 'center');
      text('total-one-label', 'Σ pᵢ = 1', cap.x + cap.width / 2, 821, 36, ink, 'center');
      const probeX = cap.x + cap.width * smooth((time - 9) / 3);
      triangle('partition-probe-head', probeX, 701, ink);
      line('partition-probe-stem', probeX, 714, probeX, 730, ink, 2);
      text('footer', 'Three probabilities. One fixed capacity.', 520, 980, 27, muted);
    }
    ctx.globalAlpha = 1;
    return {
      time,
      stage,
      mechanism: {
        logits: [...logits],
        masses: [...masses],
        denominator,
        probabilities: [...probabilities]
      },
      geometry,
      bounds,
      background
    };
  }

  window.C2M = {
    meta: {version: 1, caseId: 'softmax', renderer: 'canvas2d', width: W, height: H, duration, fps: 60},
    render
  };
  render(0);
  if (new URLSearchParams(window.location.search).get('export') !== '1') {
    let playbackStart;
    let lastFrame = -1;
    function playback(timestamp) {
      if (playbackStart === undefined) playbackStart = timestamp;
      const elapsed = Math.min(duration, (timestamp - playbackStart) / 1000);
      const frame = Math.min(duration * 60, Math.floor(elapsed * 60));
      if (frame !== lastFrame) {
        render(frame / 60);
        lastFrame = frame;
      }
      if (elapsed < duration) requestAnimationFrame(playback);
    }
    requestAnimationFrame(playback);
  }
})();
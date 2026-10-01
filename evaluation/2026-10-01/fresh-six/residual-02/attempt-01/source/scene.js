(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const W = 1920, H = 1080;
  const background = '#0b111b';
  const foreground = '#edf2fa';
  const muted = '#929fb5';
  const colors = ['#5EBDEB', '#F5B65B', '#B89CFF'];
  const input = [1, -0.5, 0.25];
  const correction = [0.2, 0.4, -0.1];
  const output = input.map((v, i) => v + correction[i]);
  const scale = 240;
  const upper = [350, 420, 490];
  const lower = [660, 730, 800];
  const stages = ['input', 'branches', 'merging', 'output'];
  let bounds;

  const mix = (a, b, u) => a + (b - a) * u;
  function ease(t, a, b) {
    const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return u * u * (3 - 2 * u);
  }
  function record(id, kind, x, y, width, height, opacity) {
    bounds.push({id, kind, x, y, width, height, opacity});
  }
  function text(id, value, x, y, size, color = foreground, weight = 400, opacity = 1) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(value);
    const left = m.actualBoundingBoxLeft;
    const right = m.actualBoundingBoxRight;
    const ascent = m.actualBoundingBoxAscent;
    const descent = m.actualBoundingBoxDescent;
    ctx.fillText(value, x, y);
    record(id, 'text', x - left, y - ascent, left + right, ascent + descent, opacity);
    ctx.restore();
  }
  function rect(id, x, y, width, height, color, opacity = 1) {
    if (opacity <= 0 || width <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    record(id, 'rect', x, y, width, height, opacity);
    ctx.restore();
  }
  function vector(id, value, x, y, color, opacity = 1) {
    const end = x + value * scale;
    const result = {id, start: {x, y}, end: {x: end, y}, color};
    if (opacity <= 0) return result;
    const direction = Math.sign(value);
    const length = Math.abs(end - x);
    const head = Math.min(15, length * 0.42);
    const shoulder = end - direction * head;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(shoulder, y - 6);
    ctx.lineTo(shoulder, y - 11);
    ctx.lineTo(end, y);
    ctx.lineTo(shoulder, y + 11);
    ctx.lineTo(shoulder, y + 6);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    record(id, 'vector', Math.min(x, end), y - 11, length, 22, opacity);
    ctx.restore();
    return result;
  }
  function junction(id, x, y, opacity) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = background;
    ctx.strokeStyle = foreground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    record(id, 'circle', x - 6, y - 6, 12, 12, opacity);
    ctx.restore();
  }

  function render(timeInSeconds) {
    const t = Math.max(0, Math.min(12, Number.isFinite(timeInSeconds) ? timeInSeconds : 0));
    const stageIndex = t < 2 ? 0 : t < 5 ? 1 : t < 8.5 ? 2 : 3;
    const stage = stages[stageIndex];
    bounds = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    // The full-canvas fill is the clearing surface, not a foreground shape.
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    text('title', 'Identity survives', 220, 100, 52, foreground, 600);
    text('subtitle', 'An unchanged path. A small correction. A componentwise sum.', 220, 151, 24, muted);
    text('formula', 'y = x + F(x)', 1390, 102, 32, foreground, 500);
    rect('header-rule', 220, 190, 1480, 2, '#263348');

    text('identity-heading', 'IDENTITY PATH', 240, 290, 18, muted, 600);
    text('identity-caption', 'x unchanged', 240, 340, 28, foreground, 500);

    if (stage === 'branches') {
      text('correction-heading', 'CORRECTION PATH', 240, 600, 18, muted, 600);
      text('correction-caption', 'F(x)', 240, 650, 30, foreground, 500);
      text('correction-origin', 'Illustrative, hand-selected', 240, 694, 18, muted);
    } else if (stage === 'merging') {
      text('merge-heading', 'MERGE', 240, 600, 18, muted, 600);
      text('merge-caption', 'Add corresponding components', 240, 650, 22, foreground, 500);
    } else if (stage === 'output') {
      text('output-heading', 'OUTPUT', 240, 600, 18, muted, 600);
      text('output-caption', 'y = x + F(x)', 240, 650, 28, foreground, 500);
    }

    const settle = 12 * ease(t, 8.5, 12);
    const origin = 630 + 170 * ease(t, 0, 4.5) + settle;
    const merge = ease(t, 5, 7.8);
    const correctionOpacity = ease(t, 2, 2.55);
    const outputOpacity = ease(t, 7.8, 8.4);
    const geometry = {unitScale: scale, identity: []};
    for (let i = 0; i < 3; i++) {
      geometry.identity.push(vector(`identity-${i}`, input[i], origin, upper[i], colors[i]));
    }

    if (stage !== 'input') {
      geometry.correction = [];
      const branchOrigin = 1100 - 50 * ease(t, 2, 5) + settle;
      for (let i = 0; i < 3; i++) {
        const endpoint = geometry.identity[i].end.x;
        const cx = mix(branchOrigin, endpoint, merge);
        const cy = mix(lower[i], upper[i], merge);
        geometry.correction.push(vector(`correction-${i}`, correction[i], cx, cy, colors[i], correctionOpacity));
      }
    }

    if (outputOpacity > 0 || stage === 'output') {
      geometry.output = [];
      for (let i = 0; i < 3; i++) {
        geometry.output.push(vector(`output-${i}`, output[i], origin, lower[i], colors[i], stage === 'output' ? 1 : outputOpacity));
      }
    }

    const junctionOpacity = ease(t, 7.35, 7.8);
    for (let i = 0; i < 3; i++) {
      junction(`junction-${i}`, geometry.identity[i].end.x, upper[i], junctionOpacity);
    }

    const identityLabels = ['1.00', '−0.50', '0.25'];
    const correctionLabels = ['+0.20', '+0.40', '−0.10'];
    const sumLabels = ['1.00 + 0.20 = 1.20', '−0.50 + 0.40 = −0.10', '0.25 − 0.10 = 0.15'];
    const outputLabels = ['1.20', '−0.10', '0.15'];
    for (let i = 0; i < 3; i++) {
      text(`identity-value-${i}`, stage === 'output' ? sumLabels[i] : identityLabels[i], 1280, upper[i] + 9, 26, colors[i], 500);
      if (stage === 'branches') {
        text(`correction-value-${i}`, correctionLabels[i], 1280, lower[i] + 9, 26, colors[i], 500, correctionOpacity);
      }
      if (stage === 'output') {
        text(`output-value-${i}`, outputLabels[i], 1280, lower[i] + 9, 26, colors[i], 500);
      }
    }

    const statements = [
      'Three signed components enter the identity path.',
      'The upper path preserves x; the lower path carries F(x).',
      'Each correction travels to the endpoint of its matching identity component.',
      'Three additions produce three output components.'
    ];
    text('stage-statement', statements[stageIndex], 220, 886, 24, foreground);

    const starts = [0, 2, 5, 8.5];
    const ends = [2, 5, 8.5, 12];
    for (let i = 0; i < 4; i++) {
      const x = 220 + i * 380;
      rect(`timeline-track-${i}`, x, 948, 340, 3, '#263348');
      const progress = Math.max(0, Math.min(1, (t - starts[i]) / (ends[i] - starts[i])));
      rect(`timeline-progress-${i}`, x, 948, 340 * progress, 3, '#EDF2FA');
      text(`timeline-label-${i}`, `${String(i + 1).padStart(2, '0')}  ${stages[i]}`, x, 990, 19, i === stageIndex ? foreground : muted, i === stageIndex ? 600 : 400);
    }

    return {
      time: t,
      stage,
      mechanism: {
        input: input.slice(),
        identity: input.slice(),
        correction: correction.slice(),
        output: output.slice()
      },
      geometry,
      bounds
    };
  }

  window.C2M = {
    meta: {version: 1, caseId: 'residual', renderer: 'canvas2d', width: W, height: H, duration: 12, fps: 60},
    render
  };
  render(0);
  if (new URLSearchParams(window.location.search).get('export') !== '1') {
    // Playback supplies explicit times; render itself has no clock or accumulated state.
    let epoch;
    let lastFrame = -1;
    function play(timestamp) {
      if (epoch === undefined) epoch = timestamp;
      const frame = Math.floor((timestamp - epoch) * 60 / 1000);
      if (frame !== lastFrame) {
        render((frame % 720) / 60);
        lastFrame = frame;
      }
      requestAnimationFrame(play);
    }
    requestAnimationFrame(play);
  }
})();
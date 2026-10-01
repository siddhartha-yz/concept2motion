(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const W = 1920, H = 1080, DURATION = 12;
  const INPUT = [1, -0.5, 0.25];
  const CORRECTION = [0.2, 0.4, -0.1];
  const OUTPUT = INPUT.map((v, i) => v + CORRECTION[i]);
  const COLORS = ['#67D9E8', '#FFB86B', '#BA9CFF'];
  const SCALE = 240;
  const ROWS = [450, 650, 850];
  const BACKGROUND = '#10151F';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const mix = (a, b, p) => a + (b - a) * p;
  const phase = (t, a, b) => smooth((t - a) / (b - a));
  const number = v => (Math.abs(v) < 0.000001 ? 0 : v).toFixed(2);
  const signed = v => (v > 0 ? '+' : '') + number(v);
  const subscripts = ['₁', '₂', '₃'];
  let bounds = [];

  function register(id, kind, x, y, width, height, opacity) {
    bounds.push({ id, kind, x, y, width, height, opacity });
  }

  function rectangle(id, x, y, width, height, color, opacity = 1) {
    if (width <= 0 || height <= 0 || opacity <= 0) return;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    register(id, 'shape', x, y, width, height, opacity);
  }

  function text(id, value, x, baseline, size, color = '#E9EEF7', opacity = 1, weight = 400) {
    if (opacity <= 0) return;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    const m = ctx.measureText(value);
    const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width;
    const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : size;
    const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : size * 0.25;
    ctx.fillText(value, x, baseline);
    register(id, 'text', x - left, baseline - ascent, left + right, ascent + descent, opacity);
  }

  function vector(id, startX, y, value, color, opacity = 1, thickness = 8) {
    const endX = startX + value * SCALE;
    const direction = Math.sign(value);
    if (opacity > 0) {
      rectangle(`${id}-shaft`, Math.min(startX, endX), y - thickness / 2,
        Math.abs(endX - startX), thickness, color, opacity);
      const headLength = Math.min(8, Math.abs(endX - startX) * 0.35);
      const headBase = endX - direction * headLength;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(endX, y);
      ctx.lineTo(headBase, y - 10);
      ctx.lineTo(headBase, y + 10);
      ctx.closePath();
      ctx.fill();
      register(`${id}-head`, 'shape', Math.min(headBase, endX), y - 10, headLength, 20, opacity);
    }
    return { id, start: { x: startX, y }, end: { x: endX, y }, color };
  }

  function render(requestedTime) {
    const t = clamp(Number.isFinite(requestedTime) ? requestedTime : 0, 0, DURATION);
    const stage = t < 2.5 ? 'input' : t < 6 ? 'branches' : t < 9 ? 'merging' : 'output';
    bounds = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);

    text('title', 'Identity survives', 140, 112, 52, '#F3F6FC', 1, 600);
    text('subtitle', 'A residual connection, in three signed components', 140, 161, 24, '#A7B3C5');

    const stageNames = ['input', 'branches', 'merging', 'output'];
    const stepX = [140, 550, 980, 1420];
    const activeIndex = stageNames.indexOf(stage);
    stageNames.forEach((name, i) => {
      text(`stage-label-${i}`, `${String(i + 1).padStart(2, '0')}  ${name}`, stepX[i], 232, 21,
        i === activeIndex ? '#F3F6FC' : '#8492A7', 1, i === activeIndex ? 600 : 400);
      rectangle(`stage-rule-${i}`, stepX[i], 255, 300, 3,
        i === activeIndex ? '#E9EEF7' : '#566277', i === activeIndex ? 1 : 0.35);
    });

    const captions = {
      input: 'Three signed components enter.',
      branches: 'One path carries x unchanged. The other supplies F(x).',
      merging: 'Bring each correction to the matching identity endpoint.',
      output: 'Add corresponding components: y = x + F(x).'
    };
    text('stage-caption', captions[stage], 140, 326, 29);
    text('components-heading', 'COMPONENTS', 140, 376, 17, '#8492A7', 1, 600);

    const mergeProgress = phase(t, 6, 8.2);
    const finalTransport = 130 * phase(t, 9, 12);
    const identityX = t < 2.5 ? mix(560, 640, phase(t, 0, 2.5))
      : t < 6 ? mix(640, 790, phase(t, 2.5, 6))
      : mix(790, 900, mergeProgress) + finalTransport;
    const branchHeadingOpacity = t < 6 ? 1 : 1 - phase(t, 6, 6.5);
    text('identity-heading', 'IDENTITY · x unchanged', 560, 376, 17, '#A7B3C5', branchHeadingOpacity, 600);
    if (stage !== 'input') {
      text('correction-heading', 'CORRECTION · F(x)', 1260, 376, 17, '#A7B3C5', branchHeadingOpacity, 600);
    }

    const geometry = { unitScale: SCALE, identity: [] };
    if (stage !== 'input') geometry.correction = [];
    const resultOpacity = phase(t, 8.2, 8.95);
    if (t > 8.2) geometry.output = [];

    ROWS.forEach((row, i) => {
      const identityY = row - 42;
      rectangle(`identity-rail-${i}`, 500, identityY - 1, 1140, 2, '#8C9CB5', 0.10);
      text(`input-value-${i}`, `x${subscripts[i]} = ${number(INPUT[i])}`, 140, row - 43, 25, COLORS[i]);
      geometry.identity.push(vector(`identity-${i}`, identityX, identityY, INPUT[i], COLORS[i]));

      if (stage !== 'input') {
        const correctionOpacity = phase(t, 2.5, 3.05);
        const separateX = mix(1390, 1310, phase(t, 2.5, 6));
        const correctionX = stage === 'branches' ? separateX
          : mix(1310, identityX + INPUT[i] * SCALE, mergeProgress);
        const correctionY = mix(row + 42, identityY, mergeProgress);
        rectangle(`correction-rail-${i}`, 500, correctionY - 1, 1140, 2, '#8C9CB5', 0.10 * correctionOpacity);
        text(`correction-value-${i}`, `F${subscripts[i]} = ${signed(CORRECTION[i])}`, 140, row + 22, 23,
          COLORS[i], correctionOpacity);
        geometry.correction.push(vector(`correction-${i}`, correctionX, correctionY,
          CORRECTION[i], COLORS[i], correctionOpacity));
      }

      if (t > 8.2) {
        const outputY = mix(row + 94, row + 64, phase(t, 8.2, 9));
        rectangle(`output-rail-${i}`, 500, outputY - 1, 1140, 2, '#8C9CB5', 0.10 * resultOpacity);
        text(`output-value-${i}`, `y${subscripts[i]} = ${number(OUTPUT[i])}`, 140, row + 83, 27,
          COLORS[i], resultOpacity, 600);
        geometry.output.push(vector(`output-${i}`, identityX, outputY,
          OUTPUT[i], COLORS[i], resultOpacity, 12));
      }
    });

    text('fixed-correction-note', 'Illustrative F(x) · fixed correction', 140, 1004, 19, '#8492A7');
    if (t >= 8.2) {
      text('addition-note', 'Three inputs + three corrections → three outputs', 1050, 1004, 19,
        '#A7B3C5', resultOpacity);
    }
    rectangle('time-track', 140, 1040, 1640, 2, '#566277', 0.30);
    rectangle('elapsed-time', 140, 1040, 1640 * t / DURATION, 2, '#A7B3C5', 1);
    ctx.globalAlpha = 1;

    return {
      time: t,
      stage,
      mechanism: {
        input: INPUT.slice(),
        identity: INPUT.slice(),
        correction: CORRECTION.slice(),
        output: OUTPUT.slice()
      },
      geometry,
      bounds,
      background: { id: 'background', kind: 'background', x: 0, y: 0,
        width: W, height: H, opacity: 1, color: BACKGROUND }
    };
  }

  window.C2M = {
    meta: { version: 1, caseId: 'residual', renderer: 'canvas2d',
      width: W, height: H, duration: DURATION, fps: 60 },
    render
  };
  render(0);
  if (new URLSearchParams(window.location.search).get('export') !== '1') {
    let start = null;
    let previousFrame = -1;
    function playback(timestamp) {
      if (start === null) start = timestamp;
      const elapsed = Math.min(DURATION, (timestamp - start) / 1000);
      const frame = Math.min(720, Math.floor(elapsed * 60));
      if (frame !== previousFrame) {
        render(frame / 60);
        previousFrame = frame;
      }
      if (elapsed < DURATION) requestAnimationFrame(playback);
    }
    requestAnimationFrame(playback);
  }
})();
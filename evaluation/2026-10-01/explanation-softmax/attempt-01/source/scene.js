(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const W = 1920, H = 1080, DURATION = 32;
  const BG = '#101722', WHITE = '#EDF2F7', MUTED = '#A8B4C5';
  const COLORS = ['#3B82F6', '#F59E0B', '#10B981'];
  const NAMES = ['猫', '狗', '鸟'];
  const logits = [-1.0, 0.6, 1.8];
  const masses = logits.map(z => Math.exp(z));
  const denominator = masses.reduce((a, b) => a + b, 0);
  const probabilities = masses.map(m => m / denominator);
  const rows = [370, 520, 670];
  const rawScale = 160;
  const rawX = 300, rawY = 490, rawHeight = 64;
  const rawWidth = denominator * rawScale;
  const capacity = { x: 410, y: 590, width: 1100, height: 80 };
  const labelCenters = [430, 900, 1370];
  const FONT = '"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif';
  const mix = (a, b, u) => a + (b - a) * u;
  const smooth = (t, a, b) => {
    const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  let bounds = [];

  function register(id, kind, x, y, width, height, opacity) {
    bounds.push({ id, kind, x, y, width, height, opacity });
  }
  function text(id, value, x, y, size = 32, color = WHITE, align = 'left', opacity = 1) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `500 ${size}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(value);
    const drawX = align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x;
    ctx.fillText(value, drawX, y);
    const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width;
    const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : size;
    const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : size * 0.22;
    register(id, 'text', drawX - left, y - ascent, left + right, ascent + descent, opacity);
    ctx.restore();
  }
  function rect(id, x, y, width, height, color, opacity = 1) {
    if (opacity <= 0 || width <= 0 || height <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    register(id, 'shape', x, y, width, height, opacity);
    ctx.restore();
  }
  function line(id, x1, y1, x2, y2, color = MUTED, width = 2, opacity = 1) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const pad = width / 2;
    register(id, 'shape', Math.min(x1, x2) - pad, Math.min(y1, y2) - pad,
      Math.abs(x2 - x1) + width, Math.abs(y2 - y1) + width, opacity);
    ctx.restore();
  }
  function frame(id, box, color = WHITE, opacity = 1) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    register(id, 'shape', box.x - 1.5, box.y - 1.5, box.width + 3, box.height + 3, opacity);
    ctx.restore();
  }
  function bracket(id, x, y, width, opacity = 1) {
    line(`${id}-left`, x, y, x, y + 14, MUTED, 2, opacity);
    line(`${id}-span`, x, y + 14, x + width, y + 14, MUTED, 2, opacity);
    line(`${id}-right`, x + width, y, x + width, y + 14, MUTED, 2, opacity);
  }
  function scoreRuler(origin, opacity = 1) {
    line('score-zero', origin, 350, origin, 738, MUTED, 2, opacity);
    line('score-ruler', 300, 780, 1230, 780, MUTED, 2, opacity);
    [-1, 0, 1, 2].forEach((v, i) => {
      const x = origin + v * 280;
      line(`score-tick-${i}`, x, 774, x, 788, MUTED, 2, opacity);
      text(`score-tick-label-${i}`, v < 0 ? '−1' : String(v), x, 828, 26, MUTED, 'center', opacity);
    });
  }
  function massRuler(origin, opacity = 1) {
    line('mass-zero', origin, 350, origin, 738, MUTED, 2, opacity);
    line('mass-ruler', origin - 24, 780, origin + 6.25 * rawScale, 780, MUTED, 2, opacity);
    [0, 2, 4, 6].forEach((v, i) => {
      const x = origin + v * rawScale;
      line(`mass-tick-${i}`, x, 774, x, 788, MUTED, 2, opacity);
      text(`mass-tick-label-${i}`, String(v), x, 828, 26, MUTED, 'center', opacity);
    });
  }
  function rowLabels(mode, opacity = 1) {
    const scoreLabels = ['−1.0', '0.6', '1.8'];
    const expressions = ['e^(−1.0) ≈ 0.368', 'e^0.6 ≈ 1.822', 'e^1.8 ≈ 6.050'];
    rows.forEach((y, i) => {
      text(`class-label-${i}`, NAMES[i], 145, y + 35, 34, COLORS[i], 'left', opacity);
      if (mode === 'logits') {
        text(`score-value-${i}`, `分数 ${scoreLabels[i]}`, 1400, y + 33, 30, WHITE, 'left', opacity);
      } else {
        text(`original-score-${i}`, `原分数 ${scoreLabels[i]}`, 1400, y + 4, 25, MUTED, 'left', opacity);
        text(`mass-value-${i}`, expressions[i], 1400, y + 47, 28, COLORS[i], 'left', opacity);
      }
    });
  }
  function leaders(segments, targetTop, opacity = 1) {
    segments.forEach((s, i) => {
      line(`class-leader-${i}`, labelCenters[i], 450,
        s.x + s.width / 2, targetTop - 14, COLORS[i], 2, opacity);
    });
  }
  function partition(x, y, width, height) {
    let cursor = x;
    return probabilities.map((p, i) => {
      const segmentWidth = i === 2 ? x + width - cursor : p * width;
      const s = { id: `class-${i}`, x: cursor, y, width: segmentWidth, height, color: COLORS[i] };
      cursor += segmentWidth;
      return s;
    });
  }
  function drawSegments(segments) {
    segments.forEach(s => rect(s.id, s.x, s.y, s.width, s.height, s.color));
  }

  function render(timeInSeconds) {
    const inputTime = Number(timeInSeconds);
    const t = Number.isFinite(inputTime) ? Math.max(0, Math.min(DURATION, inputTime)) : 0;
    const stage = t < 6 ? 'logits' : t < 12 ? 'exponential' : t < 18 ? 'shared-total' : t < 25 ? 'normalizing' : 'normalized';
    bounds = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    text('question', '猫、狗、鸟的分数，怎样变成总和为 1 的概率？', 960, 105, 44, WHITE, 'center');
    const captions = {
      logits: '分数可以为负，不能直接当概率。',
      exponential: '取指数后，权重都为正，大小顺序不变。',
      'shared-total': '三份权重相加，得到同一个总和。',
      normalizing: '每份都除以同一总和，变成整体的占比。',
      normalized: '先取指数，再各除以总和，概率总和为 1。'
    };
    text('caption', captions[stage], 960, 190, 36, WHITE, 'center');
    let geometry = {};

    if (stage === 'logits') {
      text('rule', '蓝色是猫，橙色是狗，绿色是鸟。', 960, 270, 30, MUTED, 'center');
      const reveal = mix(0.12, 1, smooth(t, 0, 1.6));
      rows.forEach((y, i) => {
        const signedLength = logits[i] * 280 * reveal;
        rect(`class-${i}`, 610 + Math.min(0, signedLength), y, Math.abs(signedLength), 48, COLORS[i]);
      });
      scoreRuler(610);
      rowLabels('logits');
      text('scale-note', '共用零点：左侧为负分数，右侧为正分数。', 960, 895, 30, MUTED, 'center');
    }

    if (stage === 'exponential') {
      text('rule', '本片采用指数规则：正权重 = e^分数', 960, 270, 30, MUTED, 'center');
      const u = smooth(t, 6.2, 8.5);
      const origin = mix(610, 360, u);
      rows.forEach((y, i) => {
        const signedLength = mix(logits[i] * 280, masses[i] * rawScale, u);
        rect(`class-${i}`, origin + Math.min(0, signedLength), y, Math.abs(signedLength), 48, COLORS[i]);
      });
      massRuler(origin);
      rowLabels('masses');
      text('scale-note', '新刻度：长度表示正权重，三类共用同一尺度。', 960, 895, 30, MUTED, 'center');
    }

    if (stage === 'shared-total') {
      text('rule', '保留每一份的长度，把三份首尾相接。', 960, 270, 30, MUTED, 'center');
      const u = smooth(t, 12.8, 16.0);
      let accumulated = 0;
      const segments = masses.map((mass, i) => {
        const width = mass * rawScale;
        const s = {
          id: `class-${i}`,
          x: mix(360, rawX + accumulated, u),
          y: mix(rows[i], rawY, u),
          width,
          height: mix(48, rawHeight, u),
          color: COLORS[i]
        };
        accumulated += width;
        return s;
      });
      drawSegments(segments);
      const oldOpacity = 1 - smooth(t, 12.0, 12.6);
      massRuler(360, oldOpacity);
      rowLabels('masses', oldOpacity);
      const settledOpacity = smooth(t, 16.15, 16.65);
      ['猫：0.368', '狗：1.822', '鸟：6.050'].forEach((v, i) => {
        text(`contribution-${i}`, v, labelCenters[i], 420, 30, COLORS[i], 'center', settledOpacity);
      });
      leaders(segments, rawY, settledOpacity);
      bracket('shared-bracket', rawX, 580, rawWidth, settledOpacity);
      text('shared-label', '共同总和', rawX + rawWidth / 2, 652, 32, WHITE, 'center', settledOpacity);
      text('denominator-equation', '总权重 = e^(−1.0) + e^0.6 + e^1.8 ≈ 8.240', 960, 811, 32, WHITE, 'center', settledOpacity);
    }

    if (stage === 'normalizing') {
      text('rule', '新单位：整个框 = 1', 960, 270, 32, MUTED, 'center');
      const fractions = ['猫：e^(−1.0) / 总权重', '狗：e^0.6 / 总权重', '鸟：e^1.8 / 总权重'];
      fractions.forEach((v, i) => text(`division-${i}`, v, labelCenters[i], 420, 26, COLORS[i], 'center'));
      const u = smooth(t, 19.0, 23.0);
      const segments = partition(
        mix(rawX, capacity.x, u), mix(rawY, capacity.y, u),
        mix(rawWidth, capacity.width, u), mix(rawHeight, capacity.height, u)
      );
      drawSegments(segments);
      frame('fixed-capacity', capacity);
      leaders(segments, capacity.y, smooth(t, 23.1, 23.7));
      bracket('capacity-bracket', capacity.x, 697, capacity.width);
      text('whole-label', '整体 = 1', 960, 754, 32, WHITE, 'center');
      text('shared-denominator', '同一个总权重：e^(−1.0) + e^0.6 + e^1.8 ≈ 8.240', 960, 842, 30, WHITE, 'center');
      text('division-explanation', '每一份都用自己的正权重，除以这个总权重。', 960, 930, 32, WHITE, 'center');
    }

    if (stage === 'normalized') {
      text('rule', '新单位：整个框 = 1', 960, 270, 32, MUTED, 'center');
      const segments = partition(capacity.x, capacity.y, capacity.width, capacity.height);
      drawSegments(segments);
      frame('fixed-capacity', capacity);
      ['猫 ≈ 0.045', '狗 ≈ 0.221', '鸟 ≈ 0.734'].forEach((v, i) => {
        text(`probability-label-${i}`, v, labelCenters[i], 420, 32, COLORS[i], 'center');
      });
      leaders(segments, capacity.y);
      bracket('capacity-bracket', capacity.x, 697, capacity.width);
      text('whole-label', '整体 = 1', 960, 754, 32, WHITE, 'center');
      text('rounded-sum', '0.045 + 0.221 + 0.734 ≈ 1（显示值已舍入）', 960, 842, 30, MUTED, 'center');
      text('answer-first', 'Softmax 先把分数变成正权重，', 960, 926, 34, WHITE, 'center');
      text('answer-second', '再把每份除以同一个总和，得到总和为 1 的概率。', 960, 982, 34, WHITE, 'center');
      geometry = {
        capacity: { id: 'probability-capacity', ...capacity },
        segments: segments.map(s => ({ ...s }))
      };
    }

    return {
      time: t,
      stage,
      mechanism: {
        logits: logits.slice(),
        masses: masses.slice(),
        denominator,
        probabilities: probabilities.slice()
      },
      geometry,
      bounds: bounds.map(b => ({ ...b }))
    };
  }

  window.C2M = {
    meta: { version: 1, caseId: 'softmax', renderer: 'canvas2d', width: W, height: H, duration: DURATION, fps: 60 },
    render
  };
  render(0);
  const exportMode = new URLSearchParams(window.location.search).get('export') === '1';
  if (!exportMode) {
    const playbackStart = performance.now();
    let previousFrame = -1;
    function playback(now) {
      const elapsed = Math.max(0, (now - playbackStart) / 1000);
      if (elapsed >= DURATION) {
        render(DURATION);
        return;
      }
      const frameNumber = Math.floor(elapsed * 60);
      if (frameNumber !== previousFrame) {
        render(frameNumber / 60);
        previousFrame = frameNumber;
      }
      requestAnimationFrame(playback);
    }
    requestAnimationFrame(playback);
  }
})();
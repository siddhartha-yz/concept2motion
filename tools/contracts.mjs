/** Independent checks of numerical and measured scene evidence. */
export function softmaxReference(logits) {
  const maximum = Math.max(...logits);
  const weights = logits.map(z => Math.exp(z - maximum));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

const stages = {
  softmax: ['logits', 'exponential', 'shared-total', 'normalizing', 'normalized'],
  residual: ['input', 'branches', 'merging', 'output']
};

export function checkCoverage(frames, brief) {
  const expected = stages[brief.id];
  const observed = frames.map(f => f.stage).filter((s, i, a) => i === 0 || s !== a[i - 1]);
  const passed = Boolean(expected) && JSON.stringify(expected) === JSON.stringify(observed);
  return { passed, expected, observed, findings: passed ? [] : [
    { code: 'stage_coverage', detail: 'Required mechanism stages must occur once, in order' }
  ] };
}

export function checkFrame(frame, brief, meta) {
  const findings = [];
  const fail = (code, detail) => findings.push({ code, detail, time_s: frame.time });
  const close = (a, b, tolerance = 1e-9) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
  if (!stages[brief.id]) fail('unsupported_case', 'No scene evidence contract for this case');
  else if (!stages[brief.id].includes(frame.stage)) fail('unknown_stage', String(frame.stage));
  if (!close(frame.time, frame.requestedTime, 1e-8)) fail('frame_time', 'Scene did not use requested time');
  if (brief.id === 'softmax') {
    const reference = softmaxReference(brief.inputs.logits);
    const m = frame.mechanism;
    if (!m || m.probabilities?.length !== reference.length || m.logits?.length !== reference.length) {
      fail('missing_mechanism', 'Expected one logit and probability per class');
    } else {
      brief.inputs.logits.forEach((z, i) => {
        if (!close(m.logits[i], z)) fail('input_mismatch', `logit ${i}`);
        if (!close(m.probabilities[i], reference[i])) fail('wrong_probability', `class ${i}`);
        if (!close(m.masses?.[i], Math.exp(z))) fail('wrong_mass', `class ${i}`);
      });
      const total = brief.inputs.logits.map(Math.exp).reduce((a, b) => a + b, 0);
      if (!close(m.denominator, total)) fail('wrong_denominator', 'All classes must share the exponential total');
      if (!close(m.probabilities.reduce((a, b) => a + b, 0), 1)) fail('probability_sum', 'Expected total 1');
    }
    if (frame.stage === 'normalized') {
      const segments = frame.geometry?.segments;
      const capacity = frame.geometry?.capacity;
      if (segments?.length !== reference.length || !capacity) {
        fail('missing_partition', 'Normalized stage needs one fixed capacity and three class segments');
      } else {
        let cursor = capacity.x;
        segments.forEach((segment, i) => {
          if (segment.id !== `class-${i}`) fail('identity_changed', `class ${i}`);
          if (!close(segment.width / capacity.width, reference[i], 1e-6)) {
            fail('wrong_geometry', `class ${i}: width does not encode its probability`);
          }
          if (!close(segment.x, cursor, 1e-5)) fail('partition_gap', `class ${i}`);
          cursor = segment.x + segment.width;
        });
        if (!close(cursor, capacity.x + capacity.width, 1e-5)) fail('capacity_total', 'Partition does not fill capacity');
      }
    }
  }
  if (brief.id === 'residual') {
    const { x, residual } = brief.inputs;
    const m = frame.mechanism;
    const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]));
    const output = x.map((v, i) => v + residual[i]);
    if (!m || !same(m.input, x) || !same(m.identity, x) || !same(m.correction, residual) || !same(m.output, output)) {
      fail('residual_mechanism', 'Identity must preserve x; output must be componentwise x + F(x)');
    }
    const geometry = frame.geometry;
    const scale = geometry?.unitScale;
    if (!Number.isFinite(scale) || scale <= 0) fail('invalid_scale', 'Positive shared signed unit scale required');
    const checkVectors = (vectors, values, prefix) => {
      if (!Array.isArray(vectors) || vectors.length !== values.length) {
        fail('missing_vectors', prefix); return;
      }
      vectors.forEach((v, i) => {
        if (v.id !== `${prefix}-${i}`) fail('identity_changed', `${prefix} ${i}`);
        if (!v.start || !v.end || !close(v.end.x - v.start.x, values[i] * scale, 1e-6) ||
            !close(v.end.y, v.start.y)) fail('wrong_vector_geometry', `${prefix} ${i}`);
      });
    };
    checkVectors(geometry?.identity, x, 'identity');
    if (frame.stage !== 'input') checkVectors(geometry?.correction, residual, 'correction');
    if (frame.stage === 'output') {
      checkVectors(geometry?.output, output, 'output');
      for (let i = 0; i < x.length; i++) {
        const a = geometry?.identity?.[i], b = geometry?.correction?.[i], c = geometry?.output?.[i];
        if (!a?.start || !a?.end || !b?.start || !b?.end || !c?.start || !c?.end ||
            !close(a.end.x, b.start.x) || !close(a.end.y, b.start.y) ||
            !close(a.start.x, c.start.x) || !close(b.end.x, c.end.x)) {
          fail('wrong_merge', `component ${i}: signed vectors must join head to tail at the merge`);
        }
      }
    }
  }
  const bounds = (frame.bounds || []).filter(b => b.opacity > 0.2);
  for (const b of bounds) {
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width < 0 || b.height < 0) fail('invalid_bounds', b.id);
    if (b.x < -1 || b.y < -1 || b.x + b.width > meta.width + 1 || b.y + b.height > meta.height + 1) {
      fail('clipped', b.id);
    }
  }
  const text = bounds.filter(b => b.kind === 'text');
  const intersects = (a, b) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 2 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 2;
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) {
    const a = text[i], b = text[j];
    if (intersects(a, b)) {
      fail('text_overlap', `${a.id} / ${b.id}`);
    }
  }
  for (const label of text) for (const shape of bounds.filter(b => b.kind === 'shape')) {
    if (intersects(label, shape)) fail('text_shape_overlap', `${label.id} / ${shape.id}`);
  }
  return { passed: findings.length === 0, findings };
}

export function checkVideo(stream, meta) {
  const fps = String(stream.r_frame_rate).split('/').map(Number);
  const rate = fps[0] / fps[1];
  const expectedFrames = Math.round(meta.duration * meta.fps);
  const findings = [];
  if (Number(stream.nb_frames) !== expectedFrames) findings.push('frame_count');
  if (Math.abs(rate - meta.fps) > 1e-9) findings.push('fps');
  if (Math.abs(Number(stream.duration) - expectedFrames / meta.fps) > 1 / meta.fps / 2) findings.push('duration');
  if (stream.width !== meta.width || stream.height !== meta.height) findings.push('resolution');
  return { passed: findings.length === 0, findings, expectedFrames };
}

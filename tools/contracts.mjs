/** Independent checks of numerical and measured scene evidence. */
export function softmaxReference(logits) {
  const maximum = Math.max(...logits);
  const weights = logits.map(z => Math.exp(z - maximum));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

export function checkFrame(frame, brief, meta) {
  const findings = [];
  const fail = (code, detail) => findings.push({ code, detail, time_s: frame.time });
  const close = (a, b, tolerance = 1e-9) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
  if (brief.id !== 'softmax') fail('unsupported_case', 'This scene evidence validator currently supports Softmax only');
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
  const bounds = (frame.bounds || []).filter(b => b.opacity > 0.2);
  for (const b of bounds) {
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite)) fail('invalid_bounds', b.id);
    if (b.x < -1 || b.y < -1 || b.x + b.width > meta.width + 1 || b.y + b.height > meta.height + 1) {
      fail('clipped', b.id);
    }
  }
  const text = bounds.filter(b => b.kind === 'text');
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) {
    const a = text[i], b = text[j];
    if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 2 &&
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 2) {
      fail('text_overlap', `${a.id} / ${b.id}`);
    }
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

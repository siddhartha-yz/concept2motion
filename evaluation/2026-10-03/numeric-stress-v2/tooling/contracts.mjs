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

/** Independent timeline checks: no import from the drawing/runtime implementation. */
export function checkStageTimeline(meta,brief,time) {
  const timeline=meta?.stageTimeline,order=stages[brief.id];
  if(timeline===undefined)return {available:false,passed:false,detail:'Explicit reveals require metadata stageTimeline'};
  const entries=timeline?.entries;
  if(timeline?.version!==1||timeline.caseId!==brief.id||timeline.duration!==meta.duration||
      !order||!Array.isArray(entries)||entries.length!==order.length)
    return {available:true,passed:false,detail:'Timeline version, case, duration and ordered phases must match'};
  let cursor=0;
  for(let i=0;i<entries.length;i++) {
    const p=entries[i];
    if(p?.stage!==order[i]||![p.start,p.end,p.settledAt].every(Number.isFinite)||
       Math.abs(p.start-cursor)>1e-9||p.end<=p.start||p.settledAt<=p.start||p.end-p.settledAt<.75-1e-9)
      return {available:true,passed:false,detail:`Invalid timeline phase ${i}; contiguous intervals and 0.75 seconds of settled time required`};
    cursor=p.end;
  }
  if(Math.abs(cursor-meta.duration)>1e-9||!Number.isFinite(time)||time<0||time>meta.duration)
    return {available:true,passed:false,detail:'Timeline must cover duration and requested time'};
  const current=entries.find(p=>time>=p.start&&time<p.end)??entries.at(-1);
  return {available:true,passed:true,entries,current};
}

function visibleHold(timeline,stage,time) {
  if(!timeline.passed||timeline.current.stage!==stage)return false;
  const p=timeline.current,last=p===timeline.entries.at(-1);
  return time>=p.settledAt&&(last||time<=p.end-.25);
}

// A zero-intercept common scale preserves ratios; correct labels alone do not.
// Legacy IDs are an explicit compatibility rule, not inferred semantics.
export function checkMassGeometry(frame, brief,meta) {
  const result={status:'not_applicable',source:null,findings:[]};
  if(brief.id!=='softmax'||frame.stage!=='exponential')return result;
  const explicit=frame.geometry?.massBars;
  const timeline=checkStageTimeline(meta,brief,frame.time);
  const legacy=Array.isArray(frame.bounds)?frame.bounds.filter(b=>b?.kind==='shape'&&/^mass-[0-2]$/.test(b.id)):[];
  const bars=Array.isArray(explicit)?explicit:legacy;
  result.source=Array.isArray(explicit)?'massBars':'legacy mass-i bounds';
  if(bars.length!==brief.inputs.logits.length) {
    result.status='unavailable';
    if(Array.isArray(explicit))result.findings.push({code:'missing_mass_geometry',time_s:frame.time,detail:'One mass bar per class is required'});
    return result;
  }
  if(bars.some(b=>!b||typeof b.id!=='string'||!Number.isFinite(b.width)||b.width<0||!Number.isFinite(b.opacity??1))||new Set(bars.map(b=>b.id)).size!==bars.length) {
    result.status='invalid';result.findings.push({code:'invalid_mass_geometry',time_s:frame.time,detail:'Unique class bars with finite nonnegative widths required'});return result;
  }
  if(visibleHold(timeline,'exponential',frame.time)&&bars.some(b=>(b.opacity??1)<=.2))
    result.findings.push({code:'invisible_mass',time_s:frame.time,detail:'All exponential masses must be visible during settled hold'});
  const revealed=bars.some(b=>b.reveal!==undefined||b.targetWidth!==undefined);
  if(!revealed&&(bars.some(b=>(b.opacity??1)<.99)||bars.reduce((s,b)=>s+b.width,0)<=1e-8)) {
    result.status='transient';return result;
  }
  const sorted=[...bars].sort((a,b)=>a.id.localeCompare(b.id));
  if(sorted.some((b,i)=>b.id!==`mass-${i}`)) {
    result.status='invalid';result.findings.push({code:'mass_identity_changed',time_s:frame.time,detail:'Expected mass-0..2 in class order'});return result;
  }
  if(revealed&&!timeline.passed)result.findings.push({code:'reveal_timeline_required',time_s:frame.time,detail:timeline.detail});
  const widths=sorted.map(b=>b.targetWidth??b.width),sum=widths.reduce((a,b)=>a+b,0);
  const expected=softmaxReference(brief.inputs.logits);
  result.status=revealed&&sorted.some(b=>(b.reveal??1)<1||(b.opacity??1)<.99)?'target_only':'checked';
  if(widths.some(w=>!Number.isFinite(w)||w<=0)||sum<=1e-8) {
    result.status='invalid';result.findings.push({code:'invalid_mass_target',time_s:frame.time,detail:'Positive finite target widths required'});return result;
  }
  sorted.forEach((b,i)=>{
    const reveal=b.reveal??1;
    if(!Number.isFinite(reveal)||reveal<0||reveal>1||Math.abs(b.width-widths[i]*reveal)>1e-6)
      result.findings.push({code:'wrong_mass_reveal',time_s:frame.time,detail:`class ${i}: actual width must equal target width × reveal`});
    if(Math.abs(widths[i]/sum-expected[i])>1e-6)result.findings.push({code:'wrong_mass_geometry',time_s:frame.time,
      detail:`class ${i}: target bar share ${widths[i]/sum} differs from exp-mass share ${expected[i]}`});
    if(revealed&&visibleHold(timeline,'exponential',frame.time)&&(reveal<1-1e-9||(b.opacity??1)<=.2))
      result.findings.push({code:'incomplete_mass_reveal',time_s:frame.time,detail:`class ${i}: fully revealed visible mass required during settled hold`});
  });
  return result;
}

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
  const timeline=checkStageTimeline(meta,brief,frame.time);
  const massGeometry=checkMassGeometry(frame,brief,meta);
  findings.push(...massGeometry.findings);
  const fail = (code, detail) => findings.push({ code, detail, time_s: frame.time });
  const close = (a, b, tolerance = 1e-9) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
  // Raw exponential masses can be tiny or huge. Absolute 1e-9 tolerance would
  // accept an erased 1e-300 mass and reject harmless rounding of a 1e9 mass.
  const positiveRelative = (actual, expected) => Number.isFinite(actual) &&
    Number.isFinite(expected) && actual > 0 && expected > 0 &&
    Math.abs(actual / expected - 1) <= 1e-9;
  if(timeline.available&&!timeline.passed)fail('invalid_stage_timeline',timeline.detail);
  if(timeline.passed&&frame.stage!==timeline.current.stage)fail('timeline_stage_mismatch',`Expected ${timeline.current.stage}`);
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
        if (!positiveRelative(m.masses?.[i], Math.exp(z))) fail('wrong_mass', `class ${i}`);
      });
      const total = brief.inputs.logits.map(Math.exp).reduce((a, b) => a + b, 0);
      if (!positiveRelative(m.denominator, total)) fail('wrong_denominator', 'All classes must share a positive finite exponential total');
      if (!close(m.probabilities.reduce((a, b) => a + b, 0), 1)) fail('probability_sum', 'Expected total 1');
    }
    if (frame.stage === 'normalized') {
      const segments = frame.geometry?.segments;
      const capacity = frame.geometry?.capacity;
      if (segments?.length !== reference.length || !capacity) {
        fail('missing_partition', 'Normalized stage needs one fixed capacity and three class segments');
      } else {
        if((visibleHold(timeline,'normalized',frame.time)||!timeline.available)&&(capacity.opacity??1)<=.2)
          fail('invisible_partition','Normalized probability capacity must be visible during settled hold');
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
        const revealed=v.reveal!==undefined||v.targetValue!==undefined||v.targetEnd!==undefined,reveal=revealed?v.reveal:1;
        if(revealed) {
          if(!timeline.passed)fail('reveal_timeline_required',timeline.detail);
          if(!Number.isFinite(reveal)||reveal<0||reveal>1||!close(v.targetValue,values[i])||
             !v.targetEnd||!v.start||!close(v.targetEnd.x-v.start.x,values[i]*scale,1e-6)||!close(v.targetEnd.y,v.start.y))
            fail('wrong_vector_target',`${prefix} ${i}: target must match the brief independently of reveal`);
          const phase={identity:'input',correction:'branches',output:'output'}[prefix];
          const completed=timeline.passed&&frame.time>=timeline.entries.find(p=>p.stage===phase).settledAt;
          if(completed&&!close(reveal,1))fail('incomplete_vector_reveal',`${prefix} ${i}: reveal must finish by ${phase} settled time`);
        }
        const phase={identity:'input',correction:'branches',output:'output'}[prefix];
        if((visibleHold(timeline,phase,frame.time)||visibleHold(timeline,'output',frame.time)||(!timeline.available&&frame.stage==='output'))&&(v.opacity??1)<=.2)
          fail('invisible_required_vector',`${prefix} ${i}`);
        if (!v.start || !v.end || !close(v.end.x - v.start.x, values[i] * scale * reveal, 1e-6) ||
            !close(v.end.y, v.start.y)) fail('wrong_vector_geometry', `${prefix} ${i}`);
      });
    };
    checkVectors(geometry?.identity, x, 'identity');
    if (frame.stage !== 'input') checkVectors(geometry?.correction, residual, 'correction');
    if (frame.stage === 'output') {
      checkVectors(geometry?.output, output, 'output');
      for (let i = 0; i < x.length; i++) {
        const a = geometry?.identity?.[i], b = geometry?.correction?.[i], c = geometry?.output?.[i];
        if (!a?.start || !a?.end || !b?.start || !b?.end ||
            !close(a.end.x, b.start.x) || !close(a.end.y, b.start.y) ||
            !Number.isFinite(b.end.x)) {
          fail('wrong_merge', `component ${i}: signed vectors must join head to tail at the merge`);
        }
        // Aligned origins are this protocol's narrow layout convention, not
        // an arithmetic law: translating a free output vector preserves its sum.
        if(!a?.start||!c?.start||!c?.end||!b?.end||!close(a.start.x,c.start.x)||
            !close(b.end.x,c.reveal===undefined?c.end.x:c.targetEnd?.x))
          fail('output_origin_alignment',`component ${i}: this protocol requires a shared horizontal origin; separate output columns are not covered`);
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
  return { passed: findings.length === 0, findings, massGeometry };
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

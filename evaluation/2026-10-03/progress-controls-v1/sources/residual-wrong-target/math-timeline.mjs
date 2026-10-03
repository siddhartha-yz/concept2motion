/** Explicit-time phase utility. Authors choose timing; no drawing or lesson content. */
const ORDER=Object.freeze({
  softmax:Object.freeze(['logits','exponential','shared-total','normalizing','normalized']),
  residual:Object.freeze(['input','branches','merging','output'])
});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

export function createMathTimeline({caseId,duration,entries}) {
  const order=ORDER[caseId];
  if(!order||!Number.isFinite(duration)||duration<=0||!Array.isArray(entries)||entries.length!==order.length)
    throw Error('Supported case, positive duration and all ordered phases required');
  let cursor=0;
  const phases=entries.map((entry,index)=>{
    const {stage,start,end,settledAt}=entry??{};
    if(stage!==order[index]||![start,end,settledAt].every(Number.isFinite)||Math.abs(start-cursor)>1e-9||
       end<=start||settledAt<=start||end-settledAt<.75-1e-9)
      throw Error(`Invalid phase ${index}: contiguous start/end, settledAt after start and at least 0.75 seconds of settled time required`);
    cursor=end;return Object.freeze({stage,start,end,settledAt});
  });
  if(Math.abs(cursor-duration)>1e-9)throw Error('Phases must cover the entire duration');
  const checkTime=t=>{if(!Number.isFinite(t)||t<0||t>duration)throw Error('Timeline time must be within duration');};
  const named=stage=>{const phase=phases.find(p=>p.stage===stage);if(!phase)throw Error(`Unknown timeline phase "${stage}"`);return phase;};
  const meta=Object.freeze({version:1,caseId,duration,entries:Object.freeze(phases)});
  return Object.freeze({
    meta,
    at(t) {
      checkTime(t);
      const phase=phases.find(p=>t>=p.start&&t<p.end)??phases.at(-1);
      return Object.freeze({...phase,reveal:smooth((t-phase.start)/(phase.settledAt-phase.start))});
    },
    reveal(stage,t) {
      checkTime(t);const phase=named(stage);
      return smooth((t-phase.start)/(phase.settledAt-phase.start));
    },
    opacity(stage,t,{fade=.2,persist=false}={}) {
      checkTime(t);const phase=named(stage);
      if(!Number.isFinite(fade)||fade<=0||fade>.25)throw Error('Fade must be positive and at most 0.25 seconds');
      const enter=clamp((t-phase.start)/fade);
      // The final answer remains visible at the exact final frame.
      const exit=persist||phase===phases.at(-1)?1:clamp((phase.end-t)/fade);
      return Math.min(enter,exit);
    }
  });
}

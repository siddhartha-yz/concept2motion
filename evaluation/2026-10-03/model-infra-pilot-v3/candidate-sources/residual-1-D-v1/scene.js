import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';

const canvas = document.getElementById('scene');
const timeline = createMathTimeline({
  caseId: 'residual', duration: 18,
  entries: [
    { stage: 'input', start: 0, end: 4, settledAt: 1.3 },
    { stage: 'branches', start: 4, end: 8, settledAt: 5.5 },
    { stage: 'merging', start: 8, end: 13, settledAt: 11.5 },
    { stage: 'output', start: 13, end: 18, settledAt: 14.5 }
  ]
});
const C = { identity:'#57c7ef', correction:'#ffb65b', output:'#8ee3ac', ink:'#edf3fb', muted:'#a7b4c6' };
const unitScale = 230;
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(n); return n*n*(3-2*n); };
const signed = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2);
const captions = {
  input: '什么沿恒等路径保留下来？加法又发生在哪里？',
  branches: '蓝色原样保留 x；橙色是另一路的修正量 F(x)。',
  merging: '每项修正的起点，移到对应蓝色箭头的终点。',
  output: '在接点逐项相加：绿色从原起点指向最终终点。'
};

function render(time) {
  const t = Math.max(0, Math.min(18, Number.isFinite(time) ? time : 0));
  const phase = timeline.at(t);
  const f = createMathFrame(canvas, {
    caseId:'residual', time:t, stage:phase.stage,
    inputs:{ x:[0.7,-0.4,0.2], residual:[-0.2,0.15,-0.3] }
  });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101722';
  ctx.fillRect(0,0,854,480);

  const title = f.text('title','残差连接：原样保留，再加修正',30,39,{size:25,color:C.ink});
  const captionY = title.y + title.height + 33;
  for (const stage of ['input','branches','merging','output']) {
    f.layer(timeline.opacity(stage,t,{fade:0.2,persist:false}), () => {
      f.text('caption-'+stage,captions[stage],30,captionY,{size:19,color:C.ink});
    });
  }
  const legend = f.text('legend-identity','蓝：恒等路径 x',30,116,{size:17,color:C.identity});
  const legend2 = f.text('legend-correction','橙：修正 F(x)',legend.x+legend.width+35,116,{size:17,color:C.correction});
  f.text('legend-output','绿：输出 y',legend2.x+legend2.width+35,116,{size:17,color:C.output});

  const merging = smooth((t-8)/3.5);
  const hasCorrection = phase.stage !== 'input';
  const hasOutput = phase.stage === 'output';
  for (let i=0;i<3;i++) {
    const y = 181 + i*99;
    const row = f.text('component-'+i,'分量 '+(i+1),30,y+5,{size:18,color:C.muted});
    const xLabel = f.text('input-value-'+i,'x'+(i+1)+' = '+signed(f.values.identity[i]),row.x+row.width+27,y-21,{size:17,color:C.identity});
    const origin = Math.max(365,xLabel.x+xLabel.width+100);
    const a = f.vector('identity',i,{
      start:{x:origin,y}, value:f.values.identity[i], unitScale,
      color:C.identity, strokeWidth:7, reveal:timeline.reveal('input',t)
    });
    if (hasCorrection) {
      const end = a.targetEnd || a.end;
      const correctionStart = 690 + (end.x-690)*merging;
      f.vector('correction',i,{
        start:{x:correctionStart,y}, value:f.values.correction[i], unitScale,
        color:C.correction, strokeWidth:4, reveal:timeline.reveal('branches',t)
      });
      f.text('correction-value-'+i,'F'+(i+1)+' = '+signed(f.values.correction[i]),610,y-21,{size:17,color:C.correction});
    }
    if (hasOutput) {
      f.vector('output',i,{
        start:{x:origin,y:y+31}, value:f.values.output[i], unitScale,
        color:C.output, strokeWidth:6, reveal:timeline.reveal('output',t)
      });
      f.layer(timeline.opacity('output',t,{fade:0.2,persist:false}),()=>{
        const correction = f.values.correction[i];
        const equation = signed(f.values.input[i])+' '+(correction<0?'−':'+')+' '+Math.abs(correction).toFixed(2)+' = '+signed(f.values.output[i]);
        f.text('equation-'+i,equation,565,y+37,{size:18,color:C.output});
      });
    }
  }
  f.text('illustrative','F(x) 为给定的示意修正量，非训练所得。',30,459,{size:16,color:C.muted});
  return f.finish();
}

window.C2M = {
  meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},
  render
};
render(0);
if (new URLSearchParams(location.search).get('export') !== '1') {
  let epoch;
  const tick = timestamp => {
    if (epoch === undefined) epoch = timestamp;
    const elapsed = Math.min(18,(timestamp-epoch)/1000);
    render(Math.floor(elapsed*15)/15);
    if (elapsed < 18) requestAnimationFrame(tick);
    else render(18);
  };
  requestAnimationFrame(tick);
}
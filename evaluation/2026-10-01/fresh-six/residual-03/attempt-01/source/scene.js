(() => {
'use strict';
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const W = 1920, H = 1080, DURATION = 12;
const BG = '#0C111B', WHITE = '#E8EDF5', MUTED = '#8C99AF';
const COLORS = ['#73DCCA', '#F3B96C', '#9FAEFF'];
const INPUT = [1, -0.5, 0.25];
const CORRECTION = [0.2, 0.4, -0.1];
const OUTPUT = INPUT.map((v, i) => v + CORRECTION[i]);
const SCALE = 300, START = 800;
const ROWS = [430, 610, 790];
const STAGES = ['input', 'branches', 'merging', 'output'];
const LIMITS = [0, 2.4, 5.6, 8.8, 12];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
let bounds;

function record(id, kind, x, y, width, height, opacity, extra = {}) {
  bounds.push({id, kind, x, y, width, height, opacity, ...extra});
}
function rect(id, x, y, width, height, color, opacity = 1) {
  if (opacity <= 0 || width <= 0 || height <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  record(id, 'shape', x, y, width, height, opacity, {color, primitive:'rectangle'});
}
function line(id, x1, y1, x2, y2, color, width = 2, opacity = 1, dashed = false) {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.setLineDash(dashed ? [9, 6] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  record(id, 'shape', Math.min(x1,x2)-width/2, Math.min(y1,y2)-width/2,
    Math.abs(x2-x1)+width, Math.abs(y2-y1)+width, opacity, {color, primitive:'line'});
}
function disk(id, x, y, radius, color, opacity = 1) {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI*2);
  ctx.fill();
  record(id, 'shape', x-radius, y-radius, radius*2, radius*2, opacity, {color, primitive:'circle'});
}
function triangle(id, points, color, opacity = 1) {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i=1; i<points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  record(id, 'shape', Math.min(...xs), Math.min(...ys),
    Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys), opacity,
    {color, primitive:'triangle'});
}
function text(id, content, x, baseline, size, color = WHITE, opacity = 1, weight = 400) {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(content);
  const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
  const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width;
  const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : size*0.8;
  const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : size*0.2;
  ctx.fillStyle = color;
  ctx.fillText(content, x, baseline);
  record(id, 'text', x-left, baseline-ascent, left+right, ascent+descent, opacity,
    {text:content, font:ctx.font, color});
}
function arrow(v, opacity, style, t) {
  const {id, start, end, color} = v;
  const dir = Math.sign(end.x-start.x);
  const output = style === 'output';
  const thickness = output ? 12 : 6;
  if (style === 'correction') {
    line(id, start.x, start.y, end.x, end.y, color, thickness, opacity, true);
  } else {
    rect(id, Math.min(start.x,end.x), start.y-thickness/2,
      Math.abs(end.x-start.x), thickness, color, opacity);
  }
  const headLength = output ? 12 : 11;
  const headHeight = output ? 9 : 7;
  triangle(id+'-head', [[end.x,end.y], [end.x-dir*headLength,end.y-headHeight],
    [end.x-dir*headLength,end.y+headHeight]], color, opacity);
  disk(id+'-origin', start.x, start.y, output ? 4.5+0.5*Math.sin(t*2) : 4, color, opacity);
  if (!output) {
    const phase = (t/2.8 + Number(id.slice(-1))*0.23) % 1;
    const a = opacity * Math.pow(Math.sin(Math.PI*phase), 2);
    disk(id+'-traveler', mix(start.x,end.x,phase), start.y, 5, color, a);
  }
}
function schematic(t, branchAlpha, mergeAlpha) {
  text('source-symbol', 'x', 585, 261, 34, WHITE, 1, 500);
  line('source-lead', 635,250,700,250,MUTED,2,0.65);
  line('identity-elbow',700,250,700,220,MUTED,2,0.65);
  line('identity-route',700,220,1150,220,MUTED,2,0.65);
  triangle('identity-route-head',[[1150,220],[1139,214],[1139,226]],MUTED,0.65);
  text('identity-route-label','identity · x',850,185,24,WHITE);
  line('correction-elbow',700,250,700,290,MUTED,2,0.65*branchAlpha);
  line('correction-route',700,290,1510,290,MUTED,2,0.65*branchAlpha);
  triangle('correction-route-head',[[1510,290],[1499,284],[1499,296]],MUTED,0.65*branchAlpha);
  text('correction-route-label','F(x) · illustrative',1290,340,24,WHITE,branchAlpha);
  disk('fork',700,250,4,MUTED,0.8);
  for(let i=0;i<3;i++) {
    const p=(t/3.7+i*0.22)%1;
    const a=0.95*Math.pow(Math.sin(Math.PI*p),2);
    disk('identity-packet-'+i,mix(710,1135,p),220,5,COLORS[i],a);
    disk('correction-packet-'+i,mix(710,1495,p),290,5,COLORS[i],a*branchAlpha);
  }
  line('merge-upper-lead',1150,220,1640,220,MUTED,2,0.65*mergeAlpha);
  line('merge-upper-turn',1640,220,1640,235,MUTED,2,0.65*mergeAlpha);
  line('merge-upper-arrival',1640,235,1680,235,MUTED,2,0.65*mergeAlpha);
  triangle('merge-upper-head',[[1680,235],[1670,230],[1670,240]],MUTED,0.65*mergeAlpha);
  line('merge-lower-lead',1510,290,1640,290,MUTED,2,0.65*mergeAlpha);
  line('merge-lower-turn',1640,290,1640,275,MUTED,2,0.65*mergeAlpha);
  line('merge-lower-arrival',1640,275,1680,275,MUTED,2,0.65*mergeAlpha);
  triangle('merge-lower-head',[[1680,275],[1670,270],[1670,280]],MUTED,0.65*mergeAlpha);
  text('merge-plus','+',1705,266,38,WHITE,mergeAlpha,500);
  line('merged-route',1755,255,1830,255,WHITE,2,mergeAlpha);
  triangle('merged-route-head',[[1830,255],[1819,249],[1819,261]],WHITE,mergeAlpha);
}

function render(timeInSeconds) {
  const requested = Number(timeInSeconds);
  const t = clamp(Number.isFinite(requested) ? requested : 0, 0, DURATION);
  const stageIndex = t < 2.4 ? 0 : t < 5.6 ? 1 : t < 8.8 ? 2 : 3;
  const stage = STAGES[stageIndex];
  bounds = [];
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([]);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = BG;
  ctx.fillRect(0,0,W,H);

  const branchAlpha = ease((t-2.4)/0.65);
  const mergeAlpha = ease((t-5.6)/0.65);
  const arrival = ease((t-5.6)/2.4);
  const resultAlpha = ease((t-8.05)/0.6);
  const identity = INPUT.map((value,i)=>({id:'identity-'+i,
    start:{x:START,y:ROWS[i]}, end:{x:START+value*SCALE,y:ROWS[i]}, color:COLORS[i]}));
  const correction = stageIndex === 0 ? [] : CORRECTION.map((value,i)=>{
    const x=mix(1400,identity[i].end.x,arrival);
    const y=ROWS[i]+18*(1-arrival);
    return {id:'correction-'+i,start:{x,y},end:{x:x+value*SCALE,y},color:COLORS[i]};
  });
  const output = t < 8.05 ? [] : OUTPUT.map((value,i)=>({id:'output-'+i,
    start:{x:START,y:ROWS[i]+64},end:{x:START+value*SCALE,y:ROWS[i]+64},color:COLORS[i]}));

  text('title','Identity survives',120,127,64,WHITE,1,600);
  text('equation','y = x + F(x)',1320,125,42,WHITE,1,400);
  const stageTitles=['01 / INPUT','02 / TWO PATHS','03 / MERGE','04 / OUTPUT'];
  text('stage-title',stageTitles[stageIndex],120,224,27,MUTED,1,500);
  schematic(t,branchAlpha,mergeAlpha);
  text('input-column','INPUT x',120,365,19,MUTED,1,500);
  text('identity-column','IDENTITY / unchanged',650,365,19,MUTED,1,500);
  text('correction-column','CORRECTION / dashed',1270,365,19,MUTED,branchAlpha,500);
  line('column-divider',420,387,420,895,MUTED,1,0.23);

  const inputStrings=['1.00','−0.50','0.25'];
  const correctionStrings=['+0.20','+0.40','−0.10'];
  const sums=['1.00 + 0.20 = 1.20','−0.50 + 0.40 = −0.10','0.25 − 0.10 = 0.15'];
  for(let i=0;i<3;i++) {
    const y=ROWS[i], color=COLORS[i];
    text('component-index-'+i,'0'+(i+1),120,y+9,23,MUTED);
    text('input-value-'+i,inputStrings[i],225,y+12,35,color,1,500);
    line('lane-'+i,600,y,1560,y,MUTED,1,0.12);
    line('row-divider-'+i,120,y+108,1800,y+108,MUTED,1,0.18);
    arrow(identity[i],0.9,'identity',t);
    if(correction[i]) arrow(correction[i],branchAlpha,'correction',t);
    text('correction-value-'+i,correctionStrings[i],1590,y+12,31,color,branchAlpha,500);
    if(output[i]) {
      const end=output[i].end.x;
      line('sum-start-guide-'+i,START,y+14,START,y+51,color,1,0.3*resultAlpha);
      line('sum-end-guide-'+i,end,y+14,end,y+51,color,1,0.3*resultAlpha);
      arrow(output[i],resultAlpha,'output',t);
      text('output-symbol-'+i,'y'+['₁','₂','₃'][i],710,y+73,26,color,resultAlpha,500);
      text('component-sum-'+i,sums[i],1290,y+73,28,color,resultAlpha,500);
    }
  }
  const notes=[
    'The identity path carries the same three numbers.',
    'F(x) is a fixed illustrative correction.',
    'Match components, then add at the merge.',
    'Three components in. Three components out.'
  ];
  text('stage-note',notes[stageIndex],120,958,26,WHITE);
  for(let i=0;i<4;i++) {
    const x=120+i*420;
    text('timeline-label-'+i,STAGES[i],x,1012,17,i===stageIndex?WHITE:MUTED);
    rect('timeline-track-'+i,x,1037,396,3,MUTED,0.23);
    const p=clamp((t-LIMITS[i])/(LIMITS[i+1]-LIMITS[i]));
    rect('timeline-fill-'+i,x,1037,396*p,3,WHITE,0.9);
  }
  ctx.globalAlpha=1;
  return {
    time:t,
    stage,
    mechanism:{input:INPUT.slice(),identity:INPUT.slice(),correction:CORRECTION.slice(),output:OUTPUT.slice()},
    geometry:{unitScale:SCALE,identity,correction,output},
    bounds,
    background:BG
  };
}

window.C2M={
  meta:{version:1,caseId:'residual',renderer:'canvas2d',width:W,height:H,duration:DURATION,fps:60},
  render
};
render(0);
if(new URLSearchParams(window.location.search).get('export') !== '1') {
  let origin;
  let lastFrame=-1;
  function play(timestamp) {
    if(origin===undefined) origin=timestamp;
    const elapsed=Math.min(DURATION,(timestamp-origin)/1000);
    const frame=Math.min(720,Math.floor(elapsed*60));
    if(frame!==lastFrame) {
      render(frame/60);
      lastFrame=frame;
    }
    if(elapsed<DURATION) requestAnimationFrame(play);
  }
  requestAnimationFrame(play);
}
})();
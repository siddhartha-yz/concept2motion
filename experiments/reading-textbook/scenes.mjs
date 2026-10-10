import {Scene, Rectangle, Text, Line, Easing, Transform2D, MANIM, createTheme, setTheme} from './vendor/zanim/src/zanim.js';
import {tensorCells, stableSoftmax, roofline} from './math.mjs';

const PAPER = '#f6f3ed', INK = '#24313a', BLUE = '#a8c9e2', GREEN = '#afc9b5', RED = '#dfa894';
setTheme(createTheme(MANIM, {name: 'reading-paper', canvas: {width:840,height:330,unitSize:58.333,background:PAPER}, style:{stroke:INK}, text:{color:INK,fontFamily:'"Noto Sans CJK SC",sans-serif'}}));
const text = (scene, value, x, y, size=17, options={}) => scene.add(new Text(value,{fontSize:size*1.5*90/58.333,color:INK,...options}).shift(x,y));
const rectangle = (scene, width, height, x, y, color, options={}) => scene.add(new Rectangle(width,height,{fill:color,stroke:null,...options}).shift(x,y));
function pose(scene, object, x, y, at) {
  scene.at(at-1);
  scene.animate(object,{transform:Transform2D.translation(x,y),duration:1,easing:Easing.LINEAR});
}
function stageLabels(scene, titles) {
  titles.forEach((title,i) => {
    scene.at(0);
    const label = text(scene,title,0,2.42,18,{opacity:i===0?1:0});
    if (i>0) { scene.at(i-1); scene.animate(label,{opacity:1,duration:1,easing:Easing.LINEAR}); }
    if (i<titles.length-1) { scene.at(i); scene.animate(label,{opacity:0,duration:1,easing:Easing.LINEAR}); }
  });
}
function tensor(scene) {
  for (const cell of tensorCells()) {
    scene.at(0);
    const {value,batch:b,head:h,feature:d,address} = cell;
    const positions = [[-4.65+(value-1)%8*1.33,1.23-b*.95],[-5.45+b*4.25+d*.73,1.1-h*1.2],[-4.55+h*6.15+d*.77,1.2-b*.85],[-4.55+h*6.15+d*.77,1.2-b*.85]];
    const box = rectangle(scene,.63,.63,...positions[0],h===0?BLUE:GREEN);
    const n = text(scene,value,...positions[0],19);
    for (let stage=1; stage<4; stage++) { pose(scene,box,...positions[stage],stage); pose(scene,n,...positions[stage],stage); }
    scene.at(0);
    const memoryX=-5.17+(address%12)*.94,memoryY=-1.55-Math.floor(address/12)*.58;
    const memory = rectangle(scene,.82,.43,memoryX,memoryY,h===0?BLUE:GREEN);
    text(scene,value,memoryX,memoryY,16);
    if (address===8) {
      scene.at(2); scene.animate(memory,{style:{...scene.stateAt(memory,2).style,fill:'#e1b987'},duration:1});
    }
  }
  text(scene,'同一批数的存储顺序（固定）',0,-2.61,13);
  stageLabels(scene,['输入 [3, 8]','每份输入拆成 2 个头：[3, 2, 4]','先看 head，再看 batch：[2, 3, 4]','逻辑换轴 ≠ 物理复制']);
}
function softmax(scene) {
  const a=stableSoftmax([1,2,3]), b=stableSoftmax([3,2,3]);
  const values=[a.logits,a.numerators,a.probabilities,b.probabilities];
  const scales=[.72,2.5,2.5,2.5];
  scene.add(new Line([-5.6,-1.18],[5.6,-1.18],{stroke:'#bcc5ba',strokeWidth:.016}));
  for(let i=0;i<3;i++) {
    scene.at(0);
    const x=-3.45+i*3.45, h=values[0][i]*scales[0];
    const proper = scene.add(new Rectangle(1.62,1,{fill:[BLUE,GREEN,RED][i],stroke:null,transform:Transform2D.translation(x,-1.18+h/2).mul(Transform2D.scaling(1,h))}));
    for(let stage=1;stage<4;stage++) {
      const nextH=values[stage][i]*scales[stage];
      scene.at(stage-1);
      scene.animate(proper,{transform:Transform2D.translation(x,-1.18+nextH/2).mul(Transform2D.scaling(1,nextH)),duration:1,easing:Easing.LINEAR});
    }
    scene.at(0);text(scene,`候选 ${i+1}`,x,-2.18,15);
    for(let stage=0;stage<4;stage++) {
      scene.at(0);
      const label=text(scene,values[stage][i].toFixed(stage===0?0:4),x,-1.58,18,{opacity:stage===0?1:0});
      if(stage>0) { scene.at(stage-1); scene.animate(label,{opacity:1,duration:1,easing:Easing.LINEAR}); }
      if(stage<3) { scene.at(stage); scene.animate(label,{opacity:0,duration:1,easing:Easing.LINEAR}); }
    }
  }
  scene.at(0);
  stageLabels(scene,['原始分数 z = [1, 2, 3]','指数值 exp(z − max(z))','概率：每项除以同一个 1.5032','分数变为 [3, 2, 3] → 三项概率一起变']);
}
function intensity(scene) {
  const samples=[1000,1000,100,50].map(bytes=>roofline({flops:1000,bytes,computePerMs:100,bytesPerMs:10}));
  const scale=.084;
  for(const [field,y,color,title] of [['computeMs',.85,BLUE,'计算'],['memoryMs',-.7,GREEN,'搬运']]) {
    scene.at(0);
    const w=8.4;
    const bar=scene.add(new Rectangle(1,.72,{fill:color,stroke:null,transform:Transform2D.translation(-4.1+w/2,y).mul(Transform2D.scaling(w,1))}));
    text(scene,title,-5.35,y,18);
    for(let stage=1;stage<4;stage++) {
      const next=samples[stage][field]*scale;
      scene.at(stage-1); scene.animate(bar,{transform:Transform2D.translation(-4.1+next/2,y).mul(Transform2D.scaling(next,1)),duration:1,easing:Easing.LINEAR});
    }
    for(let stage=0;stage<4;stage++) {
      scene.at(0);
      const label=text(scene,stage===0?(field==='computeMs'?'1000 FLOPs':'1000 Bytes'):`${samples[stage][field]} ms`,5.3,y,16,{opacity:stage===0?1:0});
      if(stage>0) { scene.at(stage-1); scene.animate(label,{opacity:1,duration:1,easing:Easing.LINEAR}); }
      if(stage<3) { scene.at(stage); scene.animate(label,{opacity:0,duration:1,easing:Easing.LINEAR}); }
    }
  }
  scene.at(0);
  text(scene,'假想机器 · 充分重叠 · 不是 GPU 性能实测',0,-2.1,14);
  stageLabels(scene,samples.map((s,i)=>i===0?'1000 FLOPs / 1000 Bytes = 1 FLOP/Byte':`I = ${s.intensity} FLOP/Byte · 总时间 ≈ ${s.estimatedMs} ms`));
}
export async function createMechanism(canvas,kind,options={}) {
  const scene=await Scene.create(canvas,options);
  ({tensor,softmax,intensity}[kind])(scene);
  scene.seek(0);
  return scene;
}

import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const duration=18;
const timeline=createMathTimeline({caseId:'residual',duration,entries:[
 {stage:'input',start:0,end:4,settledAt:1.4},
 {stage:'branches',start:4,end:8,settledAt:5.6},
 {stage:'merging',start:8,end:13,settledAt:11.2},
 {stage:'output',start:13,end:18,settledAt:14.5}
]});
const colors={identity:'#58d9ce',correction:'#ffb65b',output:'#b8a3ff',text:'#edf2fa',muted:'#aab8cd'};
const captions={input:'原值 x：向右为正，向左为负。恒等路径完整保留它。',branches:'另一路提供修正量 F(x)；原值的三个分量都没有改变。',merging:'相加发生在这里：把每个修正箭头的尾端，接到对应原值的头端。',output:'结果从原值起点量到修正终点；原值与修正仍可分别辨认。'};
const signed=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(2);
function render(time){
 const t=Math.min(duration,Math.max(0,Number.isFinite(time)?time:0));
 const phase=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage:phase.stage,inputs:{x:[.7,-.4,.2],residual:[-.2,.15,-.3]}});
 f.text('question','恒等路径保留什么？加法在哪里发生？',32,40,{size:27,color:colors.text});
 f.text('subtitle','残差连接  /  y = x + F(x)',32,69,{size:17,color:colors.muted});
 for(const stage of ['input','branches','merging','output']){
  f.layer(timeline.opacity(stage,t,{fade:.2,persist:false}),()=>{
   f.text('caption-'+stage,captions[stage],32,101,{size:18,color:colors.text});
  });
 }
 let legend=f.text('legend-identity','青绿：原值 / 恒等路径',32,134,{size:16,color:colors.identity});
 legend=f.text('legend-correction','橙色：修正量',legend.x+legend.width+30,134,{size:16,color:colors.correction});
 f.text('legend-output','紫色：相加结果',legend.x+legend.width+30,134,{size:16,color:colors.output});
 const scale=180;
 const join=timeline.reveal('merging',t);
 const showCorrection=phase.stage!=='input';
 const showOutput=phase.stage==='output';
 for(let i=0;i<3;i++){
  const y=185+i*96;
  const label=f.text('component-'+i,'分量 '+(i+1),32,y+5,{size:19,color:colors.text});
  const valueLabel=f.text('input-value-'+i,'x = '+signed(f.values.input[i]),label.x+label.width+22,y+5,{size:17,color:colors.identity});
  const origin=Math.max(310,valueLabel.x+valueLabel.width+75);
  const a=f.vector('identity',i,{start:{x:origin,y},value:f.values.identity[i],unitScale:scale,color:colors.identity,strokeWidth:10,reveal:timeline.reveal('input',t)});
  if(showCorrection){
   const endpoint={x:origin+f.values.identity[i]*scale,y};
   const end=a.targetEnd||endpoint;
   f.vector('correction',i,{start:{x:600+(end.x-600)*join,y:end.y},value:f.values.correction[i],unitScale:scale,color:colors.correction,strokeWidth:4,reveal:timeline.reveal('branches',t)});
   f.layer(timeline.opacity('branches',t,{fade:.2,persist:false}),()=>{
    f.text('branch-value-'+i,'F(x) = '+signed(f.values.correction[i]),535,y+32,{size:17,color:colors.correction});
   });
   f.layer(timeline.opacity('merging',t,{fade:.2,persist:false}),()=>{
    f.text('joining-value-'+i,'修正 '+signed(f.values.correction[i])+'：向左回退',530,y+7,{size:17,color:colors.correction});
   });
  }
  if(showOutput){
   f.vector('output',i,{start:{x:origin,y:y+30},value:f.values.output[i],unitScale:scale,color:colors.output,strokeWidth:7,reveal:timeline.reveal('output',t)});
   f.layer(timeline.opacity('output',t,{fade:.2,persist:false}),()=>{
    f.text('equation-'+i,signed(f.values.identity[i])+' '+(f.values.correction[i]<0?'−':'+')+' '+Math.abs(f.values.correction[i]).toFixed(2)+' = '+signed(f.values.output[i]),526,y+33,{size:20,color:colors.output});
   });
  }
 }
 f.text('note','F(x) 为示意修正量，非训练所得权重。统一比例：1 单位 = 180 像素。',32,456,{size:15,color:colors.muted});
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration,fps:15,stageTimeline:timeline.meta},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 let start;
 function play(now){if(start===undefined)start=now;const elapsed=Math.min(18,(now-start)/1000);render(elapsed===18?18:Math.floor(elapsed*15)/15);if(elapsed<18)requestAnimationFrame(play);}
 requestAnimationFrame(play);
}
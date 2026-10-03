import {createMathFrame} from './math-frame.mjs';
const c=document.getElementById('scene'),caseId="softmax",inputs={"logits": [-0.8, 0.4, 1.2]},colors=['#57c7ff','#b48cff','#ffb45e'];
window.C2M={meta:{version:1,caseId,width:854,height:480,duration:18,fps:15},render(t){
 const stages=caseId==='softmax'?['logits','exponential','shared-total','normalizing','normalized']:['input','branches','merging','output'];
 const stage=stages[Math.min(stages.length-1,Math.floor(t/18*stages.length))];
 const f=createMathFrame(c,{caseId,time:t,stage,inputs});
 f.text('title','Deterministic adapter test: '+caseId,28,38,{size:22});
 f.text('phase',stage,28,69,{size:16});
 if(caseId==='softmax'){
  if(stage==='exponential'||stage==='shared-total'||stage==='normalizing')inputs.logits.forEach((z,i)=>{
   f.massBar(i,{x:140,y:130+i*65,width:34+60*Math.exp(z),height:18,color:colors[i]});
   f.text('value-'+i,'exp('+z+')='+Math.exp(z).toFixed(3),140,115+i*65,{size:14,color:colors[i]});
  });
  if(stage==='normalized'){
   const masses=inputs.logits.map(Math.exp),sum=masses.reduce((a,b)=>a+b,0);
   f.partition({x:110,y:300,width:630,height:24},masses.map((m,i)=>({probability:m/sum,color:colors[i]})));
   f.text('total','one shared capacity = 1',110,280,{size:18});
  }
 }else{
  inputs.x.forEach((v,i)=>{
   const a=f.vector('identity',i,{start:{x:300,y:130+i*100},value:v,unitScale:150,color:colors[i]});
   f.text('input-'+i,'x='+v,40,115+i*100,{size:15});
   if(stage!=='input')f.vector('correction',i,{start:a.end,value:inputs.residual[i],unitScale:150,color:'#f0c060'});
   if(stage==='output')f.vector('output',i,{start:{x:300,y:160+i*100},value:v+inputs.residual[i],unitScale:150,color:'#86efac'});
  });
 }
 const evidence=f.finish();
 if(false&&stage==='normalized'){
  const s=evidence.geometry.segments[0],g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(s.x+s.width/2-4,s.y+s.height/2-4,8,8);
 }
 return evidence;
}};

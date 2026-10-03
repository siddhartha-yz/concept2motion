"""Local-only frozen factual judge probes. Never calls models."""
import argparse
import json
import math
from pathlib import Path
import shutil
import re
from batch import digest,save
import progress_controls as controls
from model_infra_pilot import ROOT
REPORT=ROOT/'evaluation/2026-10-03/judge-fact-probes-v1'
WORK=ROOT/'work/judge-fact-probes-v1'
TIMES=[1,4,6.5,8,11,17.5]
FIXTURES=[
 ('Q7','join','supported',{}),('T2','join','supported',{'scale':210}),
 ('H9','join','contradicted',{'joinOffset':55}),('L4','join','unverifiable',{'hide':True}),
 ('B8','ratio','supported',{}),('D3','ratio','supported',{'massScale':40}),
 ('K6','ratio','contradicted',{'massOffset':80}),('M1','ratio','unverifiable',{'hide':True}),
 ('P5','sum','supported',{}),('R8','sum','supported',{'scale':210}),
 ('S3','sum','contradicted',{'outputOffset':.35}),('V6','sum','contradicted',{'outputReveal':.4})]
SCENE=r'''import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const cfg=__CONFIG__,canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const names=cfg.caseId==='residual'?['input','branches','merging','output']:['logits','exponential','shared-total','normalizing','normalized'];
const duration=18,span=duration/names.length,colors=['#57c7ef','#af87ff','#ffb65b'];
const timeline=createMathTimeline({caseId:cfg.caseId,duration,entries:names.map((stage,i)=>({stage,start:i*span,end:(i+1)*span,settledAt:(i+1)*span-.9}))});
window.C2M={meta:{version:1,caseId:cfg.caseId,width:854,height:480,duration,fps:15,renderer:'canvas2d',stageTimeline:timeline.meta},render(t){
 const stage=timeline.at(t).stage,f=createMathFrame(canvas,{caseId:cfg.caseId,time:t,stage,inputs:cfg.inputs});
 f.text('title',cfg.caseId==='residual'?'直通输入与分量相加':'三项指数质量，共享同一个总量',28,36,{size:22});
 f.text('phase',stage,28,68,{size:14});
 if(cfg.caseId==='residual'){
  const {x,residual:r}=cfg.inputs,scale=cfg.scale??160,sx=350;
  f.text('claim','蓝色保留输入；橙色从蓝色终点开始；紫色表示两者的和',28,100,{size:17});
  for(let i=0;i<3;i++){
   const y=150+i*80;
   f.text(`numbers-${i}`,`x=${x[i]}，修正=${r[i]}，和=${(x[i]+r[i]).toFixed(2)}`,28,y-15,{size:16});
   if(!cfg.hide){
    const a=f.vector('identity',i,{start:{x:sx,y},value:x[i],unitScale:scale,color:colors[0],reveal:timeline.reveal('input',t)});
    if(stage!=='input')f.vector('correction',i,{start:{x:a.targetEnd.x+(cfg.joinOffset??0),y},value:r[i],unitScale:scale,color:colors[2],reveal:timeline.reveal('branches',t)});
    if(stage==='output')f.vector('output',i,{start:{x:sx,y:y+30},value:x[i]+r[i]+(cfg.outputOffset??0),unitScale:scale,color:colors[1],reveal:cfg.outputReveal??timeline.reveal('output',t)});
   }
  }
  f.text('scale-label',`${scale} 像素代表 1 个单位；正值向右，负值向左`,28,410,{size:16});
  if(!cfg.hide){ctx.fillStyle='#b8c3d5';ctx.fillRect(350,433,scale,3);ctx.fillRect(350,427,2,14);ctx.fillRect(350+scale-2,427,2,14);}
 }else{
  const z=cfg.inputs.logits,m=z.map(Math.exp),d=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/d);
  f.text('claim','指数条长度与标出的指数质量成比例；三项最终组成总量 1',28,100,{size:17});
  if(stage==='logits')z.forEach((value,i)=>f.text(`logit-${i}`,`类别 ${i+1}，输入 ${value}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='exponential')m.forEach((value,i)=>{
   f.text(`mass-${i}`,`exp(${z[i]}) = ${value.toFixed(3)}`,28,155+i*70,{size:17,color:colors[i]});
   if(!cfg.hide)f.massBar(i,{x:270,y:137+i*70,width:(cfg.massScale??65)*value+(cfg.massOffset??0),height:22,color:colors[i],reveal:timeline.reveal('exponential',t)});
  });
  if(stage==='shared-total')f.text('total',`三项共同总量 = ${d.toFixed(3)}`,28,190,{size:22});
  if(stage==='normalizing')m.forEach((value,i)=>f.text(`division-${i}`,`${value.toFixed(3)} ÷ ${d.toFixed(3)} = ${p[i].toFixed(3)}`,28,155+i*70,{size:18,color:colors[i]}));
  if(stage==='normalized'){
   p.forEach((value,i)=>f.text(`probability-${i}`,`类别 ${i+1}：${value.toFixed(3)}`,28,155+i*50,{size:17,color:colors[i]}));
   if(!cfg.hide)f.partition({x:270,y:310,width:500,height:30},p.map((probability,i)=>({probability,color:colors[i]})));
   f.text('capacity','三项概率填满同一总量 1',270,380,{size:20});
  }
 }
 const result=f.finish();
 if(cfg.caseId==='residual'&&!cfg.hide)result.bounds.push({id:'unit-scale',kind:'shape',x:350,y:427,width:(cfg.scale??160),height:14,opacity:1});
 return result;
}};'''


def prepare():
 if REPORT.exists() or WORK.exists():raise ValueError('Probe version must be new')
 REPORT.mkdir(parents=True);WORK.mkdir(parents=True);plan=[];oracle=[]
 for ident,fact,expected,options in FIXTURES:
  case='softmax' if fact=='ratio' else 'residual';inputs={'logits':[-1,.7,1.3]} if case=='softmax' else {'x':[.7,-.4,.2],'residual':[-.2,.15,-.3]}
  cfg={'caseId':case,'inputs':inputs,**options};source=REPORT/'sources'/ident;source.mkdir(parents=True)
  (source/'index.html').write_text('<!doctype html><meta charset="utf-8"><canvas id="scene" width="854" height="480"></canvas><script type="module" src="scene.js"></script>')
  (source/'scene.js').write_text(SCENE.replace('__CONFIG__',json.dumps(cfg)))
  save(source/'brief.json',{'id':case,'inputs':inputs,'duration_s':18})
  for name in ('math-frame.mjs','math-timeline.mjs'):shutil.copyfile(ROOT/'runtime'/name,source/name)
  technical='pass' if expected=='supported' else ('wrong_merge' if fact=='join' and expected=='contradicted' else 'wrong_mass_geometry' if fact=='ratio' and expected=='contradicted' else 'wrong_vector_target' if options.get('outputOffset') else 'incomplete_vector_reveal' if options.get('outputReveal') else 'missing_vectors' if case=='residual' else 'missing_mass_geometry')
  plan.append({'id':ident,'expected':technical,'source':str(source.relative_to(ROOT)),'sources':{file.name:digest(file) for file in source.iterdir()}})
  oracle.append({'id':ident,'fact':fact,'expected_fact':expected,'inputs':inputs,'intervention':options,
   'independent_truth':{'exp_masses':[math.exp(v) for v in inputs['logits']]} if case=='softmax' else {'component_sums':[a+b for a,b in zip(inputs['x'],inputs['residual'])]},
   'artistic_truth':'not_assigned'})
 for relative in ('tools/judge_fact_probes.py','tools/progress_controls.py','tools/render_scene.mjs','tools/contracts.mjs','tools/capture_frame.mjs','benchmarks/cases.json'):
  target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/relative,target)
 save(REPORT/'plan.json',{'kind':'hand-authored factual judge challenge, render only; no external model calls authorized','cases':plan,'model_calls':0,'samples_s':TIMES,'artifact_ids':'Opaque IDs only; role labels and source not sent to future judges'})
 save(REPORT/'oracle.json',{'facts':oracle,'limits':'fact consistency/support only; no global artistic or teaching labels; synthetic two-family controls, not broad judge validation'})
 (REPORT/'prompt.txt').write_text('''Only inspect supplied frames. Do not infer correctness from formulas or prior mathematics. For the requested visible relation, return supported/contradicted/unverifiable, an exact supplied time, the concrete geometric evidence and limitations. No source, model or control-role information is supplied. Do not score beauty or human learning.\n''')
 save(REPORT/'frozen.json',[{'path':str(file.relative_to(REPORT)),'sha256':digest(file)} for file in REPORT.rglob('*') if file.is_file()]);print('12 factual controls frozen locally, no model calls')


def run():
 # The runner consumes this pack's frozen sampling times, including settled 17.5s.
 controls.REPORT,controls.WORK=REPORT,WORK
 controls.run()


if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','run']);parser.add_argument('--version',default='judge-fact-probes-v2');args=parser.parse_args()
 if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}',args.version):parser.error('Lowercase new version name required')
 REPORT=ROOT/'evaluation/2026-10-03'/args.version;WORK=ROOT/'work'/args.version
 globals()[args.phase]()

"""Freeze/render controlled reveal, visibility, geometry and pixel regressions."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
from pathlib import Path
import shutil
import subprocess
import time

from batch import digest, save
from model_infra_pilot import ROOT, NODE, render_environment

REPORT=ROOT/'evaluation/2026-10-03/progress-controls-v1'
WORK=ROOT/'work/progress-controls-v1'
EXPECTED={
    'residual-reveal-correct':'pass', 'residual-wrong-target':'wrong_vector_target',
    'residual-forged-geometry':'wrong_vector_geometry', 'residual-no-timeline':'reveal_timeline_required',
    'residual-never-finished':'incomplete_vector_reveal', 'residual-invisible-output':'invisible_required_vector',
    'residual-wrong-merge':'wrong_merge', 'residual-zero-output':'pass',
    'softmax-staggered-reveal':'pass', 'softmax-affine-target':'wrong_mass_geometry',
    'softmax-forged-width':'wrong_mass_reveal', 'softmax-never-finished':'incomplete_mass_reveal',
    'softmax-hidden-partition':'invisible_partition', 'softmax-overpaint':'pixel_mismatch',
    'softmax-opacity-groups':'pass', 'softmax-phase-overlap':'text_overlap'
}
SCENE=r'''import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const cfg=__CONFIG__,canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const names=cfg.caseId==='residual'?['input','branches','merging','output']:['logits','exponential','shared-total','normalizing','normalized'];
const duration=18,span=duration/names.length;
const timeline=createMathTimeline({caseId:cfg.caseId,duration,entries:names.map((stage,i)=>({stage,start:i*span,end:(i+1)*span,settledAt:(i+1)*span-.9}))});
const colors=['#57c7ef','#af87ff','#ffb65b'];
window.C2M={meta:{version:1,caseId:cfg.caseId,renderer:'canvas2d',width:854,height:480,duration,fps:15,
 ...(cfg.id==='residual-no-timeline'?{}:{stageTimeline:timeline.meta})},render(t){
 const phase=timeline.at(t),stage=phase.stage,f=createMathFrame(canvas,{caseId:cfg.caseId,time:t,stage,inputs:cfg.inputs});
 f.text('title','Controlled explicit-progress fixture',28,35,{size:22});
 f.text('case',cfg.id,28,63,{size:15});
 f.text('stage',stage,28,90,{size:15});
 if(cfg.caseId==='residual'){
  const {x,residual:r}=cfg.inputs;
  for(let i=0;i<3;i++){
   const y=150+i*90;
   f.text(`input-label-${i}`,`x=${x[i]}, correction=${r[i]}`,28,y-15,{size:15});
   const a=f.vector('identity',i,{start:{x:320,y},value:x[i],unitScale:110,color:colors[0],reveal:timeline.reveal('input',t)});
   if(stage!=='input')f.vector('correction',i,{start:{x:a.end.x+(cfg.id==='residual-wrong-merge'?30:0),y},
    value:cfg.id==='residual-wrong-target'?r[i]*2:r[i],unitScale:110,color:colors[2],reveal:timeline.reveal('branches',t)});
   if(stage==='output'){
    f.vector('output',i,{start:{x:320,y:y+30},value:x[i]+r[i],unitScale:110,color:colors[1],
     opacity:cfg.id==='residual-invisible-output'?0:1,reveal:cfg.id==='residual-never-finished'?.4:timeline.reveal('output',t)});
    f.text(`output-label-${i}`,`result=${(x[i]+r[i]).toFixed(2)}`,520,y+35,{size:15});
   }
  }
 }else{
  const z=cfg.inputs.logits,m=z.map(Math.exp),d=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/d);
  if(stage==='logits')z.forEach((value,i)=>f.text(`logit-${i}`,`class ${i}: logit ${value}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='exponential')z.forEach((value,i)=>{
   const amount=cfg.id==='softmax-never-finished'?.4:Math.max(0,Math.min(1,3*timeline.reveal('exponential',t)-i));
   f.text(`mass-label-${i}`,`exp(${value})=${m[i].toFixed(3)}`,28,145+i*70,{size:16,color:colors[i]});
   f.massBar(i,{x:220,y:132+i*70,width:60*m[i]+(cfg.id==='softmax-affine-target'?34:0),height:18,color:colors[i],reveal:amount});
  });
  if(stage==='shared-total')f.text('shared-total',`All three masses share total ${d.toFixed(3)}`,28,170,{size:20});
  if(stage==='normalizing')p.forEach((value,i)=>f.text(`division-${i}`,`${m[i].toFixed(3)} / ${d.toFixed(3)} = ${value.toFixed(3)}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='normalized'){
   f.partition({x:140,y:255,width:550,height:25,opacity:cfg.id==='softmax-hidden-partition'?0:1},p.map((probability,i)=>({probability,color:colors[i]})));
   f.text('sum','The three probabilities fill one total-one capacity',28,335,{size:19});
   if(cfg.id==='softmax-overpaint'){ctx.fillStyle='#ff00ff';ctx.fillRect(140+550*p[0]/2-3,264,6,6);}
  }
  if(cfg.id==='softmax-opacity-groups'||cfg.id==='softmax-phase-overlap'){
   f.layer(timeline.opacity('exponential',t,{persist:cfg.id==='softmax-phase-overlap'}),()=>f.text('earlier-caption','Earlier phase caption',470,425,{size:17}));
   f.layer(timeline.opacity('normalized',t),()=>f.text('later-caption','Final phase caption',470,425,{size:17}));
  }
 }
 const state=f.finish();
 if(cfg.id==='residual-forged-geometry'&&state.geometry.correction.length)state.geometry.correction[0].end.x+=3;
 if(cfg.id==='softmax-forged-width'&&state.geometry.massBars.length)state.geometry.massBars[0].width+=3;
 return state;
}};
'''


def prepare():
    if REPORT.exists() or WORK.exists():raise ValueError('Control version must be new')
    REPORT.mkdir(parents=True);WORK.mkdir(parents=True)
    plan=[]
    for ident,expected in EXPECTED.items():
        case='residual' if ident.startswith('residual') else 'softmax'
        inputs={'x':[.8,-.6,.3],'residual':[-.2,.4,-.1]} if case=='residual' else {'logits':[-.8,.4,1.2]}
        if ident=='residual-zero-output':inputs={'x':[.2,-.4,.1],'residual':[-.2,.4,-.1]}
        cfg={'id':ident,'caseId':case,'inputs':inputs};source=REPORT/'sources'/ident;source.mkdir(parents=True)
        (source/'index.html').write_text('<!doctype html><meta charset="utf-8"><canvas id="scene" width="854" height="480"></canvas><script type="module" src="scene.js"></script>')
        (source/'scene.js').write_text(SCENE.replace('__CONFIG__',json.dumps(cfg)))
        save(source/'brief.json',{'id':case,'inputs':inputs,'duration_s':18})
        for name in ['math-frame.mjs','math-timeline.mjs']:shutil.copyfile(ROOT/'runtime'/name,source/name)
        plan.append({'id':ident,'expected':expected,'source':str(source.relative_to(ROOT)),'sources':{p.name:digest(p) for p in source.iterdir()}})
    for relative in ['tools/progress_controls.py','tools/render_scene.mjs','tools/contracts.mjs','tools/capture_frame.mjs','benchmarks/cases.json']:
        target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/relative,target)
    save(REPORT/'plan.json',{'kind':'hand-authored controlled engineering fixtures; no model generation or artistic approval',
         'cases':plan,'model_calls':0,'max_workers':4,'phase_hold_s':.9,'samples_s':[1,4,8,11,14,17]})
    save(REPORT/'frozen.json',[{'path':str(p.relative_to(REPORT)),'sha256':digest(p)} for p in REPORT.rglob('*') if p.is_file()])
    print('Frozen 16 controlled sources and expected outcomes',flush=True)


def run():
    for item in json.loads((REPORT/'frozen.json').read_text()):
        if digest(REPORT/item['path'])!=item['sha256']:raise ValueError('Frozen control changed')
    plan=json.loads((REPORT/'plan.json').read_text());results=[]
    if digest(Path(__file__))!=digest(REPORT/'tooling/tools/progress_controls.py'):
        raise ValueError('Control runner changed after freeze; use a new version')
    def render(case):
        ident=case['id'];directory=WORK/ident
        if directory.exists():raise ValueError('Never overwrite a control run')
        directory.mkdir();source=ROOT/case['source'];began=time.monotonic()
        process=subprocess.run([NODE,str(REPORT/'tooling/tools/render_scene.mjs'),'--scene',str(source/'index.html'),
          '--brief',str(source/'brief.json'),'--out',str(directory/'render'),'--render-invalid',
          '--samples',','.join(map(str,plan['samples_s'])),'--author','hand-authored progress control'],env=render_environment(),capture_output=True,text=True,timeout=90)
        (directory/'stdout.log').write_text(process.stdout);(directory/'stderr.log').write_text(process.stderr)
        m=json.loads((directory/'render/manifest.json').read_text());codes=sorted({f['code'] for f in m.get('checks',{}).get('findings',[])})
        correct=m['status']=='render_passed' and not codes if case['expected']=='pass' else m['status']=='checks_failed' and case['expected'] in codes
        result={'id':ident,'expected':case['expected'],'actual_status':m['status'],'finding_codes':codes,
          'expectation_met':bool(correct and m.get('video',{}).get('full_decode_passed',False)),
          'video_exported':(directory/'render/video.mp4').exists(),'full_decode':m.get('video',{}).get('full_decode_passed',False),
          'source':case['source'],'source_hashes':case['sources'],'render_directory':str(directory/'render'),
          'mass_geometry':m.get('checks',{}).get('mass_geometry'),'wall_s':time.monotonic()-began,
          'review':{'kind':'technical oracle check','independent_artistic_approval':False},'revision_history':'initial frozen hand-authored fixture'}
        save(REPORT/'results'/f'{ident}.json',result);print(ident,result['expectation_met'],codes,flush=True);return result
    began=time.monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(render,case) for case in plan['cases']]
        for future in as_completed(futures):results.append(future.result());save(REPORT/'results.json',results)
    summary={'fixtures':len(results),'expectations_met':sum(r['expectation_met'] for r in results),
             'actual_video_exports':sum(r['video_exported'] for r in results),'full_decodes':sum(r['full_decode'] for r in results),
             'model_calls':0,'batch_wall_s':time.monotonic()-began}
    save(REPORT/'summary.json',summary);print(json.dumps(summary),flush=True)
    if not all(r['expectation_met'] for r in results):raise SystemExit(1)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','run'])
    parser.add_argument('--version',default='progress-controls-v1')
    args=parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}',args.version):parser.error('Version must be a lowercase directory label')
    REPORT=ROOT/'evaluation/2026-10-03'/args.version;WORK=ROOT/'work'/args.version
    globals()[args.phase]()

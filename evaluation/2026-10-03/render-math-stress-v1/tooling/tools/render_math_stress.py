"""Freeze and actually render fixed numerical edge cases, zero model calls."""
import argparse
from pathlib import Path
import json
import shutil
from batch import digest,save
import progress_controls as c
from model_infra_pilot import ROOT
REPORT=ROOT/'evaluation/2026-10-03/render-math-stress-v1'
WORK=ROOT/'work/render-math-stress-v1'
INPUTS={
 'softmax-equal':{'logits':[0,0,0]},'softmax-negative':{'logits':[-3,-2,-1]},
 'softmax-small-mass':{'logits':[-690,-689,-688]},'softmax-large-mass':{'logits':[20,21,22]},
 'softmax-tiny-share':{'logits':[-8,-4,0]},'softmax-new-brief':{'logits':[-1,.7,1.3]},
 'residual-zero-input':{'x':[0,0,0],'residual':[.2,-.2,0]},
 'residual-zero-correction':{'x':[.8,-.6,0],'residual':[0,0,0]},
 'residual-zero-output':{'x':[.2,-.4,.1],'residual':[-.2,.4,-.1]},
 'residual-all-negative':{'x':[-.2,-.4,-.6],'residual':[-.1,-.2,-.3]},
 'residual-sign-flip':{'x':[-.2,.2,0],'residual':[.6,-.6,-.3]},
 'residual-new-brief':{'x':[.7,-.4,.2],'residual':[-.2,.15,-.3]}}


def prepare():
 if REPORT.exists() or WORK.exists():raise ValueError('New stress version required')
 REPORT.mkdir(parents=True);WORK.mkdir(parents=True);plan=[]
 # Shared shape scale is normalized by largest exponential to fit every finite fixture.
 scene=c.SCENE.replace('width:60*m[i]+','width:220*Math.exp(value-Math.max(...z))+')
 for ident,inputs in INPUTS.items():
  case=ident.split('-')[0];source=REPORT/'sources'/ident;source.mkdir(parents=True)
  (source/'index.html').write_text('<!doctype html><meta charset="utf-8"><canvas id="scene" width="854" height="480"></canvas><script type="module" src="scene.js"></script>')
  (source/'scene.js').write_text(scene.replace('__CONFIG__',json.dumps({'id':ident,'caseId':case,'inputs':inputs})))
  save(source/'brief.json',{'id':case,'inputs':inputs,'duration_s':18})
  for name in ('math-frame.mjs','math-timeline.mjs'):shutil.copyfile(ROOT/'runtime'/name,source/name)
  plan.append({'id':ident,'expected':'pass','source':str(source.relative_to(ROOT)),'sources':{file.name:digest(file) for file in source.iterdir()}})
 for relative in ('tools/render_math_stress.py','tools/progress_controls.py','tools/render_scene.mjs','tools/contracts.mjs','tools/capture_frame.mjs','benchmarks/cases.json'):
  target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/relative,target)
 save(REPORT/'plan.json',{'kind':'hand-authored numerical edge-case actual-render controls; no model or artistic approval','cases':plan,'model_calls':0,'max_workers':4,'samples_s':[1,4,8,11,14,17]})
 save(REPORT/'frozen.json',[{'path':str(file.relative_to(REPORT)),'sha256':digest(file)} for file in REPORT.rglob('*') if file.is_file()]);print('12 numerical edge controls frozen')


if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','run']);args=parser.parse_args()
 if args.phase=='prepare':prepare()
 else:c.REPORT,c.WORK=REPORT,WORK;c.run()

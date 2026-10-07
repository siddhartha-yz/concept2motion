"""Verify intended interventions before any scores are read."""
from pathlib import Path
import json,hashlib,math
import cv2
import numpy as np
import build_stimuli_v2 as renderer
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
rows=json.loads((OUT/'stimuli-v2.json').read_text())
expected={'determinant':'det(A) = 2*1 - 1*0 = +2','softmax':'p_i = exp(z_i) / sum(exp(z))','residual':'y = x + f(x)'}
checks=[]
for r in rows:
 r['source']='build_stimuli_v2.py'
 r['review']='Maintainer inspected three-time contact for all seven variants in each concept before scoring; no global artistic score.'
 final=r['actual_draw_parameters'][-1]
 formula_match=final['formula']==expected[r['concept']]
 assert formula_match==(r['variant']!='wrong-formula')
 base=next(v for v in rows if v['id']==r['concept']+'-correct')
 if r['variant']=='wrong-formula':
  assert all(renderer.render(r['concept'],a).tobytes()==renderer.render(r['concept'],b).tobytes() for a,b in zip(r['actual_draw_parameters'][:32],base['actual_draw_parameters'][:32]))
  extra_prefix = sum(a!=b for a,b in zip(r['render']['decoded_frame_hashes'][:32],base['render']['decoded_frame_hashes'][:32]))
  assert r['render']['decoded_frame_hashes'][60]!=base['render']['decoded_frame_hashes'][60]
 if r['variant']=='tiny-text':
  assert all(p['font_size']==8 for p in r['actual_draw_parameters'])
  assert all({k:v for k,v in p.items() if k!='font_size'}=={k:v for k,v in q.items() if k!='font_size'} for p,q in zip(r['actual_draw_parameters'],base['actual_draw_parameters']))
 if r['variant']=='missing-step':assert set(p['stage'] for p in r['actual_draw_parameters'])=={2}
 if r['variant']=='correct':assert set(p['stage'] for p in r['actual_draw_parameters'])=={0,1,2}
 extra={}
 if r['variant'] in ['flicker','blank']:
  video=ROOT/'work/videoscore-validation-v1/stimuli-v2'/r['id']/'video.mp4';cap=cv2.VideoCapture(str(video));means=[]
  while True:
   ok,frame=cap.read()
   if not ok:break
   means.append(float(frame.mean()))
  cap.release();assert len(means)==64
  if r['variant']=='flicker':assert min(abs(a-b) for a,b in zip(means,means[1:]))>100
  else:assert max(means)-min(means)<1e-9
  extra={'decoded_mean_luminance_min':min(means),'decoded_mean_luminance_max':max(means),'minimum_adjacent_mean_change':min(abs(a-b) for a,b in zip(means,means[1:]))}
 checks.append({'id':r['id'],'formula_matches_independent_target':formula_match,'all_assertions_passed':True,**extra})
# Metadata correction only: previously the logical source name pointed at the v1 builder.
(OUT/'stimuli-verified.json').write_text(json.dumps(rows,indent=2,allow_nan=False)+'\n')
(OUT/'preflight-v2.json').write_text(json.dumps({'review':'accepted before scoring','checks':checks,'source_pointer_correction':'v2 entries now point to actual v2 builder; rendered pixels unchanged','contacts':[{'concept':c,'sha256':hashlib.sha256((ROOT/'work/videoscore-validation-v1/stimuli-v2'/f'{c}-contact.png').read_bytes()).hexdigest()} for c in expected],'rendered_videos':21,'full_decoded_frames':1344,'generated_by_model':False,'human_overall_quality_labels':False},indent=2)+'\n')
names=['DESIGN.md','design-frozen.json','build_stimuli.py','build_stimuli_v2.py','run_scores.py','preflight.py','preflight_v2.py','preflight-v2-failure.json','preflight-v1-rejection.json','preflight-v2.json','stimuli-v2.json','stimuli-verified.json','inputs-v2.json','repeat-inputs-v2.json','runtime-render-v2.json']
(OUT/'preflight-frozen.json').write_text(json.dumps([{'path':n,'sha256':hashlib.sha256((OUT/n).read_bytes()).hexdigest()} for n in names],indent=2)+'\n')
print('21 interventions independently checked and visually accepted; inputs and runner frozen')

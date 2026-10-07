"""Report pre-specified pair directions; never hide missing, ties or reversals."""
from collections import Counter, defaultdict
import hashlib,json
from pathlib import Path
OUT=Path(__file__).resolve().parent
FROZEN_INPUT=OUT.parent/'videoscore-validation-v1'
ASPECTS=['visual_quality','temporal_consistency','dynamic_degree','text_to_video_alignment','factual_consistency']
MAIN={'wrong-formula':4,'wrong-geometry':4,'missing-step':3,'tiny-text':0,'flicker':1,'blank':3,'mismatched-prompt':3}
CONCEPTS=['determinant','softmax','residual']

def load(name):return json.loads((OUT/name).read_text())
def compare(a,b,aspect,group):
 if a not in scores or b not in scores:return {'correct':a,'intervention':b,'group':group,'aspect':ASPECTS[aspect],'direction':'missing'}
 delta=scores[a][aspect]-scores[b][aspect]
 return {'correct':a,'intervention':b,'group':group,'aspect':ASPECTS[aspect], 'correct_score':scores[a][aspect],'intervention_score':scores[b][aspect], 'difference_correct_minus_intervention':delta, 'direction':'expected' if delta>0 else 'tie' if delta==0 else 'reverse'}

if __name__=='__main__':
 for r in json.loads((FROZEN_INPUT/'preflight-frozen.json').read_text()):
  assert hashlib.sha256((FROZEN_INPUT/r['path']).read_bytes()).hexdigest()==r['sha256']
 first=load('inference-results.json');repeat=load('repeat/inference-results.json')
 assert not first['unexecuted'] and not repeat['unexecuted']
 assert len(first['rows'])==36 and len(repeat['rows'])==3
 rows=first['rows']+repeat['rows'];assert all(r['status']=='completed' for r in rows)
 scores={r['id']:r['logits'] for r in rows}
 original={r['id']:r for r in first['rows']}
 repeats=[]
 for r in repeat['rows']:
  o=original[r['id'].removesuffix('-repeat')]
  assert r['processed_input_tensors']==o['processed_input_tensors']
  assert r['sampled_frame_hashes']==o['sampled_frame_hashes']
  repeats.append({'case':o['id'],'tensor_hashes_equal':True,'frame_hashes_equal':True, 'differences':[a-b for a,b in zip(o['logits'],r['logits'])]})
 drift=max(abs(x) for r in repeats for x in r['differences'])
 pairs=[compare(c+'-correct',c+'-'+v,aspect,v) for v,aspect in MAIN.items() for c in CONCEPTS]
 legacy=[compare('legacy-'+a,'legacy-'+b,axis,'legacy-'+kind) for a,b,axis,kind in [('Q7','H9',4,'join-error'),('B8','K6',4,'ratio-error'),('Q7','S3',4,'sum-error'),('Q7','V6',4,'incomplete-output'),('Q7','L4',3,'missing-vectors'),('B8','M1',3,'missing-masses')]]
 groups={}
 for group in MAIN:
  sub=[r for r in pairs if r['group']==group];counts=Counter(r['direction'] for r in sub)
  groups[group]={'comparisons':len(sub),'expected':counts['expected'],'tie':counts['tie'],'reverse':counts['reverse'],'missing':counts['missing'],'absolute_difference_not_above_observed_repeat_drift':sum(abs(r.get('difference_correct_minus_intervention',0))<=drift for r in sub)}
 result={'local_forward_calls':len(rows),'completed':len(rows),'primary_concepts':3,'primary_videos':21,'legacy_unique_videos':10,'legacy_concepts':2,'pairs':pairs,'groups':groups,'legacy_pairs':legacy,
 'valid_geometry_scale_observations':{k:scores[k] for k in ['legacy-Q7','legacy-T2','legacy-B8','legacy-D3']},
 'repeats':repeats,'maximum_absolute_repeat_difference':drift,
 'manimator_observation':{'before':scores['manimator-before'],'after':scores['manimator-after'],'after_minus_before':[b-a for a,b in zip(scores['manimator-before'],scores['manimator-after'])],'scope':'Technical revision only, no human total quality or expected score direction'},
 'aspects':ASPECTS,'scores':scores,'wall_s_sum':sum(r['wall_s'] for r in rows), 'maximum_gpu_allocated_bytes':max(r['GPU_peak_allocated_bytes'] for r in rows),'maximum_gpu_reserved_bytes':max(r['GPU_peak_reserved_bytes'] for r in rows),
 'official_codex_calls':0,'weight_updates':0,
 'limits':['Shared baselines make pairs correlated; not21 independent quality judgments','Predefined mathematical/control truths, no human artistic/learning score','Original 7000-video benchmark/correlation not reproduced','Uniform48-frame sampling is original model protocol, not every-frame perception','Repeat observation covers3 fixed inputs and this device only']}
 (OUT/'analysis.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
 print(json.dumps({'groups':groups,'legacy':legacy,'repeat_drift':drift,'manimator':result['manimator_observation']},indent=2))

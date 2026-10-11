"""Independent equations applied to targeted replay's actual browser facts.
No shared numeric module or author's verifier is executed; does not certify art.
"""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('runs',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
if args.output.exists():raise SystemExit('Fresh output required')
count=0

def near(a,b):
 global count
 if isinstance(b,(list,tuple,np.ndarray)):
  assert len(a)==len(b)
  for x,y in zip(a,b):near(x,y)
 else:
  count+=1;assert math.isfinite(float(a)) and abs(a-b)<1e-9*max(1,abs(b)),(a,b)
def sm(a):
 x=np.array(a,float);e=np.exp(x-max(x));return e/sum(e)
def check(ident,f,params):
 if ident=='zero-bias':
  t,b1,b2=params['step'],params['beta1'],params['beta2'];g=np.array([2,-3]);first=f['mean']['rows'];second=f['square']['rows'];near(first[0]['values'],g);near(first[1]['values'],g*(1-b1**t));near(first[2]['values'],g);near(second[0]['values'],g*g);near(second[1]['values'],g*g*(1-b2**t));near(second[2]['values'],g*g)
 elif ident=='sparse-memory':
  b,n=f['beta'],f['n'];near(f['initialSquareMoment'],1-b);near(f['adamSquareMoment'],(1-b)*b**n);near(f['yogiSquareMoment'],1-b);near(f['adamRetention'],b**n);near(f['yogiRetention'],1);near(f['gradientSequence'],[1]+[0]*n)
 elif ident=='class-competition':
  logits=np.array([-1,params['score'],1])+params['shift'];near(f['score-view']['rows'][0]['values'],logits);near(f['probabilities']['rows'][0]['values'],sm(logits))
 elif ident=='loss-step':
  logits=np.array([-1,0,1]);prob=sm(logits);grad=prob-np.eye(3)[params['target']];new=sm(logits-params['eta']*grad);near(f['probabilities']['rows'][0]['values'],prob);near(f['probabilities']['rows'][1]['values'],new);near(f['readout']['items'][0]['value'],grad);near(f['readout']['items'][1]['value'],-math.log(prob[params['target']]));near(f['readout']['items'][2]['value'],-math.log(new[params['target']]))
 else:raise AssertionError('Unknown replay figure '+ident)
records=[];failures=[]
for name in ['adam','softmax-regression']:
 d=args.runs/name;plan=json.loads((d/'book.json').read_text());defaults={}
 for f in plan['figures']:
  parameters=f.get('params',[])
  for override in f.get('overrides',[]):
   if override['path']=='/params':parameters=override['value']
  defaults[f['id']]={p['key']:p['value']for p in parameters}
 r=sorted(d.glob('preview-*/report.json'),key=lambda p:p.stat().st_mtime)[-1];j=json.loads(r.read_text());cases=[{'id':s['id'],'width':v['width'],'facts':f['facts'],'params':defaults[s['id']]} for v in j['viewports'] for s in v['shapes'] for f in s['frames']];parameter=r.parent/'parameters/report.json'
 if parameter.exists():cases+=json.loads(parameter.read_text())['cases']
 before=count;errors=[]
 for i,c in enumerate(cases):
  try:check(c['id'],c['facts'],c['params'])
  except Exception as e:errors.append({'case':i,'id':c['id'],'width':c['width'],'error':str(e)})
 records.append({'id':name,'browserFactRecords':len(cases),'assertions':count-before,'reportSha256':hashlib.sha256(r.read_bytes()).hexdigest(),'failures':errors});failures+=errors
args.output.write_text(json.dumps({'kind':__doc__,'numpyVersion':np.__version__,'records':records,'assertions':count,'failures':failures},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'facts':sum(r['browserFactRecords']for r in records),'assertions':count,'failures':failures}));raise SystemExit(bool(failures))

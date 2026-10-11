"""Independent production checks from actual saved browser facts, not author reports.
Custom-layer uses the latest completed earlier preview because final preview has
no frames; this is explicit and does not validate its failed final candidate.
"""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('runs',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
if args.output.exists():raise SystemExit('Fresh output required')
assertions=0

def near(a,b):
 global assertions
 if isinstance(b,(list,tuple,np.ndarray)):
  assert len(a)==len(b);[near(x,y) for x,y in zip(a,b)]
 else:
  assertions+=1;assert math.isfinite(float(a)) and abs(a-b)<1e-9*max(1,abs(b)),(a,b)
def sm(a):
 a=np.array(a,float);v=np.exp(a-max(a));return v/sum(v)
def check(name,ident,f,params):
 if name=='adam':
  if ident=='bias-mass':
   b,t=f['beta'],f['t'];near(f['raw'],1-b**t);near(f['mass'],1-b**t);near(f['corrected'],1);near(f['missingMass'],b**t)
   for t,v in f['curve']:near(v,1-b**t)
  else:
   q,s,b=f['q'],f['previousSquare'],f['beta'];a=(1-b)*(q-s);y=(1-b)*np.sign(q-s)*q
   near(f['adamDelta'],a);near(f['yogiDelta'],y);near(f['adamNext'],s+a);near(f['yogiNext'],s+y)
 elif name=='softmax-regression':
  logits=f['logits'];probs=sm(logits);near(f['probabilities'],probs)
  if ident=='softmax-competition':near(f['sum'],1);near(f['chickenDogRatio'],math.exp(logits[1]-logits[2]));near(f['catChickenRatio'],math.exp(logits[0]-logits[1]))
  else:
   grad=probs-np.eye(3)[f['target']];updated=np.array(logits)-f['eta']*grad;near(f['gradient'],grad);near(f['updatedLogits'],updated);near(f['updatedProbabilities'],sm(updated));near(f['loss'],-math.log(probs[f['target']]));near(f['nextLoss'],-math.log(sm(updated)[f['target']]))
 elif name=='multihead-attention':
  if ident=='head-index':
   selected=f['selected'];b=selected//8;q=(selected%8)//4;h=(selected%4)//2;d=selected%2;near(f['inputIndex'],[b,q,2*h+d]);near(f['outputIndex'],[2*b+h,q,d]);near(f['values'],list(range(16)));near(f['outputShape'],[4,2,2])
  else:
   a=params.get('mix',0);keys=np.array([[2,0],[0,2],[-1,-1]]);w1=sm(keys[:,0]);w2=sm((a+1)*(keys@np.array([a,1])));v1=w1@keys[:,0];v2=w2@keys[:,1];near(f['weight-row']['weights-one']['values'],[w1]);near(f['weight-row']['weights-two']['values'],[w2]);near(f['output-row']['concat']['values'],[[v1,v2]]);near(f['output-row']['mixed-readout']['items'][0]['value'],v1-v2)
 elif name=='custom-layer':
  if ident=='center-coupling':
   rows=f['paired']['rows'];x=np.array(rows[0]['values']);near(rows[1]['values'],x-np.mean(x));near(f['mean']['items'][0]['value'],np.mean(x));near(f['mean']['items'][1]['value'],0)
  else:
   z=f['layer'];x=np.array(z['input']);w=np.array(z['weights']);bias=np.array(z['bias']);pre=x@w+bias;y=np.maximum(0,pre);near(z['preactivation'],pre);near(z['output'],y);seed=np.array(z['outputGradient']);dz=seed*(pre>0);near(z['preactivationGradient'],dz);near(z['inputGradient'],dz@w.T);near(z['weightGradient'],x.T@dz);near(z['biasGradient'],np.sum(dz,axis=0));near(z['seededValue'],np.sum(y*seed))
 else:raise AssertionError('Unknown chapter')
records=[];failures=[]
for name in ['adam','softmax-regression','multihead-attention','custom-layer']:
 d=args.runs/name;reports=sorted(d.glob('preview-*/report.json'),key=lambda p:p.stat().st_mtime);last=reports[-1];r=last
 if name=='custom-layer':r=next(p for p in reversed(reports) if json.loads(p.read_text()).get('status')=='completed')
 j=json.loads(r.read_text());cases=[{'id':s['id'],'width':v['width'],'facts':f['facts'],'params':{}} for v in j.get('viewports',[]) for s in v['shapes'] for f in s['frames']];params=r.parent/'parameters/report.json'
 if params.exists():cases+=json.loads(params.read_text())['cases']
 before=assertions;errors=[]
 for index,c in enumerate(cases):
  try:check(name,c['id'],c['facts'],c.get('params',{}))
  except Exception as e:errors.append({'case':index,'id':c['id'],'width':c['width'],'error':str(e)})
 record={'id':name,'preview':r.parent.name,'latestPreview':last.parent.name,'validatesFinalCandidate':r==last,'previewCompleted':j.get('status')=='completed','browserFactRecords':len(cases),'assertions':assertions-before,'reportSha256':hashlib.sha256(r.read_bytes()).hexdigest(),'failures':errors};records.append(record);failures+=errors
args.output.write_text(json.dumps({'kind':__doc__,'numpyVersion':np.__version__,'records':records,'assertions':assertions,'failures':failures},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'facts':sum(r['browserFactRecords'] for r in records),'assertions':assertions,'failures':failures}));raise SystemExit(bool(failures))

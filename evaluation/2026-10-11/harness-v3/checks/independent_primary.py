"""Independent maintainer arithmetic from stored real browser facts.
No import of candidate drawing code, shared kernels or model self-check scripts.
"""
import json, math, hashlib, argparse
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--runs',type=Path,default=Path(__file__).resolve().parents[1]/'candidates');parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();runs=args.runs;records=[];errors=[];assertions=0
if args.output.exists():raise SystemExit('Output exists; use a fresh arithmetic replay file')

def close(actual,expected,label):
 global assertions
 assertions+=1
 if isinstance(expected,list):
  if not isinstance(actual,list) or len(actual)!=len(expected):raise AssertionError((label,actual,expected))
  for i,(a,b) in enumerate(zip(actual,expected)):close(a,b,label+f'[{i}]')
 elif not isinstance(actual,(int,float)) or not math.isfinite(actual) or abs(actual-expected)>1e-8*max(1,abs(expected)):
  raise AssertionError((label,actual,expected))
def equal(a,b,label):
 global assertions
 assertions+=1
 if a!=b:raise AssertionError((label,a,b))
def mse(data,w,b):return sum((w*x+b-y)**2 for x,y in data)/(2*len(data))
def branch(x):
 y=2*x;k=2;loops=0
 while abs(y)<1000:y*=2;k*=2;loops+=1
 if y<=0:y*=100;k*=100
 return y,k,loops

def check(name,ident,f):
 if name.startswith('autograd-'):
  if ident in ['backward-seed','weighted-backward']:
   x=[0,1,2,3];s=f['seed'];close(f['x'],x,'x');close(f['gradient'],[2*v*seed for v,seed in zip(x,s)],'J-transpose-seed')
   if 'weightedScalar'in f:close(f['weightedScalar'],sum(seed*v*v for v,seed in zip(x,s)),'weighted scalar')
   else:
    delta=f['delta'];w=s[2];close(f['exactDeltaL'],w*((2+delta)**2-4),'exact objective change');close(f['tangentDeltaL'],w*4*delta,'linear tangent')
  elif ident in ['detach-path','detach-paths']:
   x=f['x'];close(f['z'],x**3,'forward value');close(f['fullGradient'],3*x*x,'full gradient');close(f['detachedGradient'],x*x,'detached gradient');close(f['directContribution'],x*x,'direct contribution');close(f.get('viaContribution',f.get('indirectContribution')),2*x*x,'other contribution')
  elif ident=='executed-slope':
   x=f['probe'];v,k,n=branch(x);close(f['output'],v,'branch value');close(f['recordedSlope'],k,'path slope');equal(f['whileIterations'],n,'iterations')
   if x==500:equal(f['classicalDerivative'],None,'jump derivative undefined')
  elif ident=='executed-branch':
   for field,x in [('base',f['a']),('probe',f['probeInput'])]:
    v,k,n=branch(x);close(f[field]['value'],v,'branch value');close(f[field]['k'],k,'path slope');equal(f[field]['whileIterations'],n,'iterations')
   close(f['baseGraphExtrapolation'],f['base']['value']+f['base']['k']*(f['probeInput']-f['a']),'local graph extrapolation')
 elif name.startswith('linear-regression-'):
  if ident=='residual-landscape':
   data=f['data'];w=f['weight'];b=f['bias'];close(f['predictions'],[w*x+b for x,y in data],'predictions');close(f['residuals'],[w*x+b-y for x,y in data],'residuals');close(f['loss'],mse(data,w,b),'mean half square');opt=sum(x*(y-b) for x,y in data)/sum(x*x for x,y in data);close(f['optimumWeight'],opt,'fixed bias optimum');close(f['optimumLoss'],mse(data,opt,b),'minimum')
  elif ident in ['batch-update','residual-step']:
   data=f['data'];start=f['start'];w,b=(start if isinstance(start,list) else [start['w'],start['b']]);r=[w*x+b-y for x,y in data];g=[sum(r_i*x for r_i,(x,y) in zip(r,data))/len(data),sum(r)/len(data)];eta=f['eta'];target=[w-eta*g[0],b-eta*g[1]];progress=f['progress'];current=[w+progress*(target[0]-w),b+progress*(target[1]-b)];close(f.get('gradient',f.get('initialGradient')),g,'batch gradient');close(f.get('end',list(f.get('target',{}).values())),target,'one update');close(f['current'],current,'interpolation');close(f.get('currentLoss',f.get('loss')),mse(data,*current),'current loss');close(f.get('endLoss',f.get('targetLoss')),mse(data,*target),'target loss')
  elif ident=='gaussian-equivalence':
   r=[f['weight']*x+f['bias']-y for x,y in f['data']];s=f['sigma'];n=len(r);L=sum(v*v for v in r)/(2*n);constant=n*math.log(s*math.sqrt(2*math.pi));close(f['loss'],L,'mean half square');close(f['nll'],constant+sum(v*v for v in r)/(2*s*s),'total NLL');close(f['constant'],constant,'total constant');close(f['scale'],n/(s*s),'total scale')
  elif ident=='gaussian-objective':
   r=[f['bias']-y for y in f['observations']];s=f['sigma'];n=len(r);L=sum(v*v for v in r)/(2*n);constant=math.log(s*math.sqrt(2*math.pi));close(f['meanHalfSquaredLoss'],L,'mean half square');close(f['negativeLogLikelihood'],n*constant+sum(v*v for v in r)/(2*s*s),'total NLL');close(f['meanNegativeLogLikelihood'],constant+L/(s*s),'mean NLL');close(f['densities'],[math.exp(-v*v/(2*s*s))/(s*math.sqrt(2*math.pi)) for v in r],'densities')
 elif name.startswith('backprop-'):
  if ident=='gradient-branches':
   i=f['input'];h,w,y,lam=i['h'],i['w'],i['y'],i['lambda'];o=sum(a*b for a,b in zip(h,w));up=o-y;close(f['output'],o,'linear output');close(f['dataGradient'],[up*x for x in h],'data grad');close(f['regularizationGradient'],[lam*x for x in w],'penalty grad');close(f['totalGradient'],[up*x+lam*v for x,v in zip(h,w)],'sum gradient')
  elif ident=='gradient-sum':
   w,lam=f['w'],f['lambda'];close(f['objective'],(2*w-1)**2/2+lam*w*w/2,'objective');close(f['totalGradient'],2*(2*w-1)+lam*w,'gradient')
  elif ident=='reverse-gate':
   W,g,z=f['W2'],f['outputGradient'],f['z'];hidden=[sum(W[o][i]*g[o] for o in range(2)) for i in range(2)];close(f['hiddenGradient'],hidden,'transpose multiplication');close(f['preactivationGradient'],[v if a>0 else 0 for v,a in zip(hidden,z)],'ReLU gate')
  elif ident=='activation-lifetimes':
   alive=[a<=f['progress']<b for a,b in zip(f['births'],f['lastBackwardReads'])];equal(f['saved'],alive,'half-open lifetimes');equal(f['savedActivationCount'],sum(alive),'count')
  elif ident=='cache-lifetime':
   alive=[a<=f['progress']<b for a,b in zip(f['birth'],f['death'])];equal(f['retained'],alive,'half-open lifetimes');equal(f['retainedCount'],sum(alive),'count');close(f['activationBytes'],sum(alive)*f['batch']*64*4,'declared bytes')
 elif name.startswith('async-computation-'):
  if ident=='queued-clock':
   t1,t2=f['submissionDuration'],f['computeDuration'];ready=0
   for index,job in enumerate(f['jobs']):
    start=max((index+1)*t1,ready);close(job['start'],start,'start');ready=start+t2;close(job['end'],ready,'finish')
   close(f['completionEnd'],ready,'all done');equal(f['completed'],sum(j['end']<=f['time'] for j in f['jobs']),'completed count');equal(f['submitted'],sum(j['end']<=f['time'] for j in f['submissions']),'submitted count')
  elif ident=='timing-boundary':
   d=f['gpuDuration'];close(f['gpuStarts'],[1,1+d,1+2*d],'starts');close(f['completion'],1+3*d,'finish');close(f['synchronizationWait'],1+3*d-3,'wait');equal(f['completedTasks'],sum(1+(i+1)*d<=f['observedTime'] for i in range(3)),'done')
  elif ident=='pipeline-bottleneck':
   n=f.get('N',f.get('taskCount'));a,b,c=f['t1'],f['t2'],f['t3'];T=a+b+(n-1)*max(a,b)+c;serial=n*(a+b+c);close(f.get('asynchronousTotal',f.get('asynchronous')),T,'pipeline total');close(f.get('synchronousTotal',f.get('synchronous')),serial,'serial total')
 else:raise AssertionError('Unknown candidate')

for directory in sorted(runs.glob('*-phase[1-4]')):
 name=directory.name;reportFile=sorted(directory.glob('preview-*/report.json'))[-1];report=json.loads(reportFile.read_text());cases=[]
 for view in report['viewports']:
  for shape in view['shapes']:
   for frame in shape['frames']:cases.append({'id':shape['id'],'width':view['width'],'progress':frame['progress'],'facts':frame['facts'],'origin':'default pose'})
 param=reportFile.parent/'parameters/report.json'
 if param.exists():
  for case in json.loads(param.read_text())['cases']:cases.append({**case,'origin':'parameter probe'})
 before=assertions;fail=[]
 for index,case in enumerate(cases):
  try:check(name,case['id'],case['facts'])
  except Exception as error:fail.append({'index':index,'id':case['id'],'width':case['width'],'origin':case['origin'],'error':str(error)})
 records.append({'run':name,'browserFactRecords':len(cases),'assertions':assertions-before,'failures':fail,'originalReportSha256':hashlib.sha256(reportFile.read_bytes()).hexdigest(),'htmlSha256':json.loads((directory/'identity.json').read_text())['rawHtmlSha256']});errors.extend(fail)
out=args.output;out.write_text(json.dumps({'kind':'maintainer arithmetic independently recomputed from real browser facts; no shared kernels or model self-tests; not proof of drawn geometry, art or teaching','records':records,'assertions':assertions,'failures':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'runs':len(records),'browserFactRecords':sum(r['browserFactRecords'] for r in records),'assertions':assertions,'failures':errors},ensure_ascii=False));raise SystemExit(bool(errors))

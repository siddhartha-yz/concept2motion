"""Independent formulas and SVD recomputation from stored browser facts.
Requires NumPy; never imports shared drawing/calculation kernels. Input constants
embedded by the author are data, not verification code. This does not inspect the
actual SVG geometry or establish artistic/learning quality.
"""
import argparse,hashlib,json,math,re
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--runs',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
if args.output.exists():raise SystemExit('Fresh report required')
count=0

def near(a,b,tol=2e-7):
 global count
 if isinstance(b,(list,tuple,np.ndarray)):
  assert len(a)==len(b)
  for x,y in zip(a,b):near(x,y,tol)
 else:
  count+=1;assert math.isfinite(float(a)) and abs(a-b)<=tol*max(1,abs(b)),(a,b)
def pooling(data,q,w=1):
 scores=np.array([-((q-x)*w)**2/2 for x,y in data]);e=np.exp(scores-max(scores));weight=e/sum(e);return scores,weight,float(sum(weight[i]*data[i][1] for i in range(len(data))))
def check(name,ident,f,plan):
 if name.startswith('calculus'):
  if ident=='secant-limit':
   if 'slope' in f:
    z=f['slope'];h=z['h'];x=z['x'];near(z['value'],3*x*x-4*x);near(z['derivative'],6*x-4);near(z['secantSlope'],6*x+3*h-4)
   else:near(f['secantSlope'],2+3*f['h']);near(f['error'],3*f['h']);near(f['tangentSlope'],2)
  elif ident=='gradient-direction':
   x,y=f['point'];near(f['gradient'],[2*x,4*y]);u=f['unitDirection'];near(sum(v*v for v in u),1);near(f['directionalDerivative'],2*x*u[0]+4*y*u[1])
  elif ident=='partials-gradient':
   x,y=f['point'];near(f['value'],x*x+2*y*y);near(f['gradient'],[2*x,4*y]);near(f['endpoint'],[3*x,5*y]);near([s['slope'] for s in f['slices']],[2*x,4*y])
  elif ident=='chain-paths':
   x=f['x'];a=f.get('a',-1);near(f.get('u',f.get('u1')),x*x);near(f.get('v',f.get('u2')),a*x);near(f['y'],x*x+a*x);near(f['pathContributions'],[2*x,a]);near(f['derivative'],2*x+a)
  else:raise AssertionError('Unknown calculus figure')
 elif name.startswith('underfit-overfit'):
  if ident=='coin-selection':
   n=f['n'];mass={}
   for k in range(n+1):e=min(k,n-k)/n;mass[e]=mass.get(e,0)+math.comb(n,k)/2**n
   dist=f.get('distribution',f.get('probabilities'));near([d['error'] for d in dist],list(sorted(mass)));near([d.get('p',d.get('probability')) for d in dist],[mass[e] for e in sorted(mass)]);near(f['expectedTrainingError'],sum(e*v for e,v in mass.items()));near(f['generalizationError'],.5);near(f['probabilitySum'],1)
  elif ident=='polynomial-sensitivity':
   x=np.array(f['xs']);y=np.array(f['ys']);X=np.vander(x,f['degree']+1,increasing=True);coef=np.linalg.lstsq(X,y,rcond=None)[0];near(f['coefficients'],coef);near(f['trainingMSE'],float(np.mean((X@coef-y)**2)));gx=np.linspace(*f['gridDomain'],f['gridCount']);pred=np.vander(gx,len(coef),increasing=True)@coef;truth=5+1.2*gx-1.7*gx**2+(5.6/6)*gx**3;near(f['gridMSE'],float(np.mean((pred-truth)**2)));near(f['curveRange'],[float(min(pred)),float(max(pred))])
  elif ident=='polynomial-noise':
   code=next(g['code'] for g in plan['figures'] if g['id']==ident);data=json.loads(re.search(r'const data=(\{.*?\});',code).group(1));x=np.array(data['x']);vx=np.array(data['vx']);degree=f['degree'];sigma=f['noiseSigma'];truth=lambda t:5+1.2*t-3.4*t*t/2+5.6*t**3/6;y=truth(x)+sigma*np.array(data['z']);vy=truth(vx)+sigma*np.array(data['vz']);basis=lambda t:np.column_stack([t**j/math.factorial(j) for j in range(degree+1)]);X=basis(x);coef=np.linalg.lstsq(X,y,rcond=None)[0];near(f['weightsFactorialBasis'],coef,2e-5);near(f['trainingMSE'],float(np.mean((X@coef-y)**2)));near(f['validationGridMSE'],float(np.mean((basis(vx)@coef-vy)**2)))
  else:raise AssertionError('Unknown underfit figure')
 elif name.startswith('nadaraya-waston'):
  data=f.get('data',list(zip(f.get('keys',[]),f.get('values',[]))))
  if ident in ['query-pooling','query-to-prediction','bandwidth']:
   q=f['query'];w=f.get('w',1);scores,weight,out=pooling(data,q,w);near(f['weights'],weight);near(f.get('prediction',f.get('output')),out);near(f['weightSum'],1)
   if 'scores' in f:near(f['scores'],scores)
   if 'terms' in f:near(f['terms'],[weight[i]*data[i][1] for i in range(len(data))])
   if 'rawKernel' in f:near(f['rawKernel'],np.exp(scores))
  if 'curve' in f:
   w=f.get('w',1)
   for q,v in f['curve']:near(v,pooling(data,q,w)[2])
   if 'mean' in f:near(f['mean'],sum(y for x,y in data)/len(data))
  if ident not in ['query-pooling','query-to-prediction','bandwidth','w-controls-locality']:raise AssertionError('Unknown kernel figure')
 elif name.startswith('parameters'):
  if ident=='threshold-mass':
   threshold=f['threshold'];near(f.get('leftMass',f.get('negativeProbability')),(10-threshold)/20);near(f.get('rightMass',f.get('positiveProbability')),(10-threshold)/20);near(f.get('zeroMass',f.get('zeroProbability')),threshold/10);
   if 'totalMass' in f:near(f['totalMass'],1)
   for p in f.get('quantilePoints',[]):near(p['w'],p['z'] if abs(p['z'])>=threshold else 0)
  elif ident=='shared-gradient':
   if 'calculation' in f:
    t=f['calculation']['trace'];nodes={n['id']:n for n in t['nodes']};w=nodes['w']['value'];x=nodes['x']['value'];near(t['value'],w*w*x);near(t['gradients']['w'],2*w*x);near(nodes['h']['value'],w*x);near(nodes['h']['gradient'],w)
   else:
    w,x,b,t=f['w'],f['x'],f['bias'],f['target'];h=w*x+b;y=w*h+b;delta=y-t;near(f['h'],h);near(f['y'],y);near(f['loss'],delta*delta/2);near(f['firstUseGradient'],delta*w*x);near(f['secondUseGradient'],delta*h);near(f['totalWeightGradient'],delta*(2*w*x+b))
  elif ident=='nested-path':
   block,layer=f['blockIndex'],f['layerIndex'];assert block in range(4) and layer in [0,2];near(f['biasShape'],[8 if layer==0 else 4]);near(f['weightShape'],[8,4] if layer==0 else [4,8]);assert f['indexPath']==f'rgnet[0][{block}][{layer}].bias';assert f['parameterName']==f'0.block {block}.{layer}.bias'
  else:raise AssertionError('Unknown parameter figure '+ident+' '+str(list(f)))
 else:raise AssertionError('Unknown chapter')
records=[];errors=[]
for d in sorted(args.runs.glob('*-phase7')):
 reportfile=sorted(d.glob('preview-*/report.json'))[-1];report=json.load(open(reportfile));plan=json.load(open(d/'book.json'));cases=[{'id':s['id'],'width':v['width'],'facts':f['facts']} for v in report['viewports'] for s in v['shapes'] for f in s['frames']];param=reportfile.parent/'parameters/report.json'
 if param.exists():cases+=json.load(open(param))['cases']
 before=count;fails=[]
 for i,c in enumerate(cases):
  try:check(d.name,c['id'],c['facts'],plan)
  except Exception as e:fails.append({'case':i,'id':c['id'],'width':c['width'],'error':str(e)})
 records.append({'run':d.name,'browserFactRecords':len(cases),'assertions':count-before,'reportSha256':hashlib.sha256(reportfile.read_bytes()).hexdigest(),'failures':fails});errors+=fails
args.output.write_text(json.dumps({'kind':__doc__,'numpyVersion':np.__version__,'records':records,'assertions':count,'failures':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'runs':len(records),'facts':sum(r['browserFactRecords'] for r in records),'assertions':count,'failures':errors},ensure_ascii=False));raise SystemExit(bool(errors))

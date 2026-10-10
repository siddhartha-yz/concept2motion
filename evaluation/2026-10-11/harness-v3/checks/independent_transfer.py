"""Independent Python arithmetic over actual browser facts; no shared kernels.
Counts assertions including nested scalar entries, not independent theorems.
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
def variance(values):
 mean=sum(values)/len(values)
 return mean,sum((v-mean)**2 for v in values)/len(values)
def mse(data,w,b):return sum((w*x+b-y)**2 for x,y in data)/(2*len(data))
def branch(a):
 y=2*a;k=2;n=0
 while abs(y)<1000:y*=2;k*=2;n+=1
 return y,k,n

def check(name,ident,f):
 if name=='probability':
  if ident=='positive-denominator':
   p=f['prior'];s=f['sensitivity'];q=f['falsePositiveRate'];n=f['population'];e=p*s+(1-p)*q
   close(f['truePositive'],n*p*s,'true positive count');close(f['falsePositive'],n*(1-p)*q,'false positive count');close(f['positiveTotal'],n*e,'positive total');close(f['evidence'],e,'evidence');close(f['posterior'],p*s/e,'posterior')
  elif ident=='retest-dependence':
   p=f['prior'];q=f['q'];t=p*.98;e=t+(1-p)*.01*q
   close(f['falsePositiveJoint'],.01*q,'false-positive joint');close(f['truePositiveJoint'],.98,'true-positive joint');close(f['posterior'],t/e,'two positives posterior');close(f['firstPosterior'],p/(p+(1-p)*.01),'first posterior');close(f['evidence'],e,'two-positive evidence')
   close(f['secondFalsePositiveMarginal'],.03,'fixed second marginal');r=(.03-.01*q)/.99;close(f['secondFalsePositiveGivenFirstNegative'],r,'complement conditional');close(.01*q+.99*r,.03,'fixed marginal recomposed')
   for q_i,p_i in f['posteriorCurve']:close(p_i,t/(t+(1-p)*.01*q_i),'posterior curve')
  elif ident=='mean-fixed-variance':
   x,p=f['values'],f['probabilities'];m=sum(v*w for v,w in zip(x,p));s=sum(v*v*w for v,w in zip(x,p));v=sum(w*(x_i-m)**2 for x_i,w in zip(x,p))
   close(f['probabilitySum'],sum(p),'probability normalization');close(f['mean'],m,'mean');close(f['secondMoment'],s,'second moment');close(f['variance'],v,'variance');close(f['varianceByMoments'],s-m*m,'moments variance');close(f['squaredDistances'],[(v-m)**2 for v in x],'squared distances')
  else:raise AssertionError('unknown probability figure')
 elif name=='weight-decay':
  if ident=='minimum-shifts':
   lam=f['lambda'];w=2/(1+lam);data=(w-2)**2/2;pen=lam*w*w/2
   close(f['optimum'],w,'regularized optimum');close(f['dataLoss'],data,'data loss');close(f['penalty'],pen,'penalty');close(f['totalLoss'],data+pen,'total loss');close(f['derivativeAtOptimum'],(w-2)+lam*w,'stationary derivative')
  elif ident=='one-update':
   w,g,eta,lam=f['old'],f['dataGradient'],f['eta'],f['lambda'];r=1-eta*lam;s=[-eta*lam*v for v in w];d=[-eta*v for v in g];n=[v+s_i+d_i for v,s_i,d_i in zip(w,s,d)]
   close(f['shrinkFactor'],r,'shrink factor');close(f['shrinkStep'],s,'shrink vector');close(f['shrunk'],[v*r for v in w],'shrunk position');close(f['dataStep'],d,'old-position data step');close(f['next'],n,'one simultaneous SGD update');close(f['oldNorm'],math.hypot(*w),'old norm');close(f['nextNorm'],math.hypot(*n),'new norm')
  else:raise AssertionError('unknown decay figure')
 elif name=='batch-norm':
  if ident=='learnable-scale':
   x=f['input'];m,v=variance(x);eps=f['epsilon'];g,b=f['gamma'],f['beta'];z=[(t-m)/math.sqrt(v+eps) for t in x];out=[g*t+b for t in z];om,ov=variance(out)
   close(f['mean'],m,'batch mean');close(f['variance'],v,'population variance');close(f['standardized'],z,'standardized');close(f['output'],out,'affine normalized');close(f['outputMean'],om,'output mean');close(f['outputVariance'],ov,'output variance');equal(f['statisticDenominator'],len(x),'denominator')
  elif ident=='channel-pool':
   equal(f['shape'],[2,2,2,2],'NCHW shape');equal(f['reductionAxes'],[0,2,3],'reduced axes');equal(f['retainedAxis'],1,'channel axis');expected=list(range(1,9)) if f['selectedChannel']==0 else [10,12,14,16,18,20,22,24];close(f['collected'],expected,'actual channel values');m,v=variance(expected);close(f['mean'],m,'channel mean');close(f['variance'],v,'channel population variance');equal(f['statisticDenominator'],8,'channel denominator')
  elif ident=='batch-dependence':
   q=f['q'];expected=[2,q-1,q+1];close(f['input'],expected,'batch');m,v=variance(expected);close(f['batchMean'],m,'batch mean');close(f['batchVariance'],v,'batch variance');close(f['trainingOutput'],(2-m)/math.sqrt(v+f['epsilon']),'batch-dependent target');close(f['predictionOutput'],(2-f['runningMean'])/math.sqrt(f['runningVariance']+f['epsilon']),'fixed prediction target');equal(f['statisticDenominator'],3,'denominator')
   for q_i,out in f['curve']:
    m,v=variance([2,q_i-1,q_i+1]);close(out,(2-m)/math.sqrt(v+f['epsilon']),'batch dependence curve')
  else:raise AssertionError('unknown batchnorm figure')
 elif name=='ndarray':
  if ident=='reshape-order':
   equal(f['values'],list(range(12)),'element order');equal(f['inputShape'],[12],'input shape');equal(f['outputShape'],[3,4],'output shape');equal(f['count'],12,'count');sel=f['selected'];equal([sel['row'],sel['col']],[sel['k']//4,sel['k']%4],'row-major index');equal(len(f['positions']),12,'actual mark positions')
  elif ident=='broadcast-index':
   a,b=f['a'],f['b'];out=[[row[0]+b[0][c] for c in range(2)] for row in a];close(f['output'],out,'broadcast sum');equal(f['inputShapes'],[[3,1],[1,2]],'shapes');equal(f['outputShape'],[3,2],'result shape');s=f['selected'];equal(s['leftIndex'],[s['row'],0],'left singleton reuse');equal(s['rightIndex'],[0,s['col']],'right singleton reuse');close(s['sum'],out[s['row']][s['col']],'selected sum')
  elif ident=='numpy-storage':
   step=f['step'];equal(f['sharedBuffer'],[0,9 if step>=4 else 1,2],'shared write');equal(f['copyBuffer'],[0,1,2] if step>=3 else None,'copied buffer');bindings={'X':'shared'}
   if step>=2:bindings['A']='shared'
   if step>=3:bindings['B']='copy'
   equal(f['bindings'],bindings,'different wrappers share storage only')
  else:raise AssertionError('unknown ndarray figure')
 elif name.startswith('autograd-'):
  if ident=='repeated-input':
   x=[0,1,2,3];total=[4*t for t in x];close(f['sum'],total,'2 dot(x,x) gradient');p=f['prefix'];expected=[v*max(0,min(2,p))/2 for v in total];close(f['visibleSum'],expected,'construction prefix');close(f['partialSums'],[[0]*4,[2*t for t in x],total],'two use contributions')
  elif ident in ['backward-seed','weighted-backward']:
   x=f['x'];seeds=f.get('seeds',f.get('v'));g=[2*t*s for t,s in zip(x,seeds)];close(f.get('inputGradient',f.get('gradient')),g,'J transpose seeds');close(f['y'],[t*t for t in x],'square forward');J=[[2*x[i] if i==j else 0 for j in range(4)] for i in range(4)];close(f.get('jacobian',f.get('jacobianTranspose')),J,'diagonal Jacobian')
   if 'weightedObjective'in f:close(f['weightedObjective'],sum(t*t*s for t,s in zip(x,seeds)),'weighted objective')
  elif ident=='detach-path':
   x=f['x'];detached=f.get('detached',f.get('mode')=='detach');direct=x*x;via=0 if detached else 2*x*x;close(f['z'],x**3,'identical forward');close(f.get('directContribution',f.get('directPathGradient')),direct,'direct path');close(f.get('viaYContribution',f.get('viaUGradient')),via,'via path');close(f.get('inputGradient',f.get('gradient')),direct+via,'selected graph derivative')
  elif ident=='control-flow':
   y,k,n=branch(f['a']);close(f['f'],y,'executed forward');close(f['k'],k,'executed multiplier');equal(f['whileIterations'],n,'loop count');close(f['executedPathGradient'],k,'path derivative');equal(f['classicalDerivativeExists'],f['a'] not in [125,250,500],'jump versus path derivative')
  else:raise AssertionError('unknown latest autograd figure')
 elif name.startswith('linear-regression-'):
  if ident=='residual-to-loss':
   data,w,b=f['data'],f['weight'],f['bias'];r=[w*x+b-y for x,y in data];close(f['predictions'],[w*x+b for x,y in data],'predictions');close(f['residuals'],r,'residuals');close(f['meanHalfSquaredLoss'],mse(data,w,b),'half MSE');close(f['weightGradient'],sum(t*x for t,(x,y) in zip(r,data))/len(data),'weight derivative');close(f['biasGradient'],sum(r)/len(data),'bias derivative');opt=sum(x*(y-b) for x,y in data)/sum(x*x for x,y in data);close(f['minimumWeightAtFixedBias'],opt,'fixed bias optimum');close(f['minimumLossAtFixedBias'],mse(data,opt,b),'fixed bias minimum')
  elif ident=='batch-gradient':
   data,w_b=f['batch'],f['initialParameters'];w,b=w_b;r=[w*x+b-y for x,y in data];gs=[[t*x,t] for t,(x,y) in zip(r,data)];g=[sum(row[j] for row in gs)/len(gs) for j in range(2)];eta=f['eta'];out=[w-eta*g[0],b-eta*g[1]];close(f['sampleGradients'],gs,'sample derivatives');close(f['averageGradient'],g,'mean derivative');close(f['updatedParameters'],out,'single update');close(f['beforeLoss'],mse(data,w,b),'before half MSE');close(f['afterLoss'],mse(data,*out),'after half MSE');prefix=f['constructionProgress']*2;vis=[sum(gs[i][j]*max(0,min(1,prefix-i))/2 for i in range(2)) for j in range(2)];close(f['visibleAverage'],vis,'partial contributions')
  elif ident=='rows-to-predictions':
   X,w,b=f['X'],f['w'],f['b'];close(f['predictions'],[sum(a*v for a,v in zip(row,w))+b for row in X],'row products plus broadcast');row=X[f['row']];close(f['terms'],[row[0]*w[0],row[1]*w[1],b],'selected contributions')
  elif ident=='one-gradient-step':
   data=f['data'];w,b=f['start'];r=[w*x+b-y for x,y in data];g=[sum(t*x for t,(x,y) in zip(r,data))/len(data),sum(r)/len(data)];out=[w-f['eta']*g[0],b-f['eta']*g[1]];p=f['progress'];cur=[w+p*(out[0]-w),b+p*(out[1]-b)];close(f['gradient'],g,'batch gradient');close(f['end'],out,'exact update');close(f['current'],cur,'position interpolation');close(f['startLoss'],mse(data,w,b),'initial loss');close(f['endLoss'],mse(data,*out),'final loss');close(f['currentLoss'],mse(data,*cur),'intermediate loss')
  elif ident=='gaussian-to-square':
   r=f.get('residual');s=f['sigma'];density=math.exp(-r*r/(2*s*s))/(s*math.sqrt(2*math.pi));c=math.log(s*math.sqrt(2*math.pi));ex=r*r/(2*s*s);close(f['density'],density,'density');close(f['constant'],c,'log normalizer');close(f.get('excessNLL',f.get('excessNegativeLogLikelihood')),ex,'quadratic excess');close(f.get('negativeLogDensity',f.get('negativeLogLikelihood')),c+ex,'negative log density')
  else:raise AssertionError('unknown latest regression figure')
 else:raise AssertionError('unknown chapter')

dirs=[(d.name.removesuffix('-harness-phase5'),d) for d in sorted(runs.glob('*-harness-phase5'))]+[(d.name,d) for d in sorted(runs.glob('*-phase6'))]
for name,d in dirs:
 previews=sorted(d.glob('preview-*/report.json'))
 if not previews:records.append({'run':name,'status':'no completed preview'});continue
 reportFile=previews[-1];report=json.loads(reportFile.read_text());cases=[]
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
 records.append({'run':name,'browserFactRecords':len(cases),'assertions':assertions-before,'failures':fail,'originalReportSha256':hashlib.sha256(reportFile.read_bytes()).hexdigest(),'htmlSha256':json.loads((d/'identity.json').read_text())['rawHtmlSha256']});errors.extend(fail)
out=args.output;out.write_text(json.dumps({'kind':'maintainer arithmetic independently recomputed from actual browser facts; not proof of drawing, art or teaching','records':records,'assertions':assertions,'failures':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'runs':len(records),'browserFactRecords':sum(r.get('browserFactRecords',0) for r in records),'assertions':assertions,'failures':errors},ensure_ascii=False));raise SystemExit(bool(errors))

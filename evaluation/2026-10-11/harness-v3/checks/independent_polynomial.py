import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.linalg import lstsq
root=Path(__file__).resolve().parents[4]
module=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'packages/visualbook/polynomial.cjs'
rng=np.random.default_rng(732105)
cases=[]
for degree in [0,1,3,6,10,12]:
 for lam in [0,.0001,.03,1.0]:
  x=np.linspace(-1,1,max(15,degree+3)); y=.2+x-.5*x*x+.1*rng.normal(size=len(x))
  cases.append(dict(data=np.column_stack([x,y]).tolist(),degree=degree,lambda_=lam,center=.2,scale=1.3,xDomain=[-1,1],samples=101))
requests=[{('lambda' if k=='lambda_' else k):v for k,v in c.items()} for c in cases]
js="const p=require(process.argv[1]);let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(p.polynomialFit))));"
outputs=json.loads(subprocess.check_output(['node','-e',js,str(module)],input=json.dumps(requests),text=True))
maximum={'coefficient_error':0,'prediction_error':0,'objective_error':0,'stationarity':0}
for c,o in zip(requests,outputs):
 data=np.array(c['data']);X=np.vander((data[:,0]-c['center'])/c['scale'],c['degree']+1,increasing=True);A=X.copy();b=data[:,1].copy();lam=c['lambda']
 if lam:
  penalty=np.eye(c['degree']+1)[1:]*np.sqrt(len(X)*lam); A=np.vstack([A,penalty]);b=np.r_[b,np.zeros(c['degree'])]
 coef=np.linalg.lstsq(A,b,rcond=None)[0];qr=lstsq(A,b,lapack_driver='gelsy')[0]
 assert np.allclose(coef,qr,rtol=1e-7,atol=1e-7)
 got=np.array(o['coefficients']);pred=X@coef
 assert np.allclose(got,coef,rtol=1e-6,atol=1e-6),(c['degree'],lam,got,coef)
 assert np.allclose(o['predictions'],pred,rtol=1e-9,atol=1e-9)
 obj=np.mean((pred-data[:,1])**2)/2+lam*np.sum(coef[1:]**2)/2
 assert abs(o['objective']-obj)<1e-10
 for name,v in [('coefficient_error',np.max(abs(got-coef))),('prediction_error',np.max(abs(np.array(o['predictions'])-pred))),('objective_error',abs(o['objective']-obj)),('stationarity',np.max(abs(np.array(o['gradient']))))]:maximum[name]=max(maximum[name],float(v))
print(json.dumps({'configurations':len(cases),'references':['NumPy 2.2.6 SVD lstsq','SciPy LAPACK gelsy'],'maximum':maximum,'scope':'Independent numerical fit checks; not rendering, teaching or model generation'},indent=2))

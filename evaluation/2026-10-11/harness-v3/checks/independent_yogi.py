"""Independent CPU float64 tensor recurrence, D2L PyTorch Yogi convention.
This is a separately written recurrence, not torch.optim.Yogi or D2L training.
"""
import json,subprocess,sys
import torch
requests=[]
for beta1 in [0,.9]:
 for beta2 in [0,.5,.9,.999]:
  for mode in ['impulse','alternating','field']:
   r={'kind':'yogi','start':[.4,-.7],'eta':.1,'beta1':beta1,'beta2':beta2,'epsilon':1e-3,'steps':31}
   if mode=='field':r['field']={'type':'quadratic','matrix':[[3,1],[1,1]]}
   else:r['gradients']=[[1,-2]]+([[0,0]for _ in range(30)] if mode=='impulse' else [[.2*(i%5-2),.3*((i*7)%6-3)]for i in range(30)])
   requests.append(r)
module=str(__import__('pathlib').Path('packages/visualbook/optimizers.cjs').resolve());js="let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(require(process.argv[1]).optimizerTrace))));";results=json.loads(subprocess.check_output(['node','-e',js,module],input=json.dumps(requests),text=True));maximum=0;updates=0
for r,res in zip(requests,results):
 theta=torch.tensor(r['start'],dtype=torch.float64,requires_grad=True);m=torch.zeros_like(theta);v=torch.zeros_like(theta);H=torch.tensor([[3,1],[1,1]],dtype=torch.float64)
 for step in range(1,32):
  if 'field'in r:
   if theta.grad is not None:theta.grad.zero_()
   (theta@H@theta/2).backward();g=theta.grad.detach().clone()
  else:g=torch.tensor(r['gradients'][step-1],dtype=torch.float64)
  with torch.no_grad():
   before=theta.clone();m=r['beta1']*m+(1-r['beta1'])*g;v=v+(1-r['beta2'])*torch.sign(g*g-v)*g*g;assert torch.all(v>=0);mc=m/(1-r['beta1']**step);vc=v/(1-r['beta2']**step);delta=r['eta']*mc/(torch.sqrt(vc)+r['epsilon']);theta-=delta
  record=res['records'][step]
  for key,value in [('before',before),('gradient',g),('firstMoment',m),('squareMoment',v),('correctedFirst',mc),('correctedSecond',vc),('update',delta),('point',theta.detach())]:
   error=float(torch.max(torch.abs(torch.tensor(record[key],dtype=torch.float64)-value)));maximum=max(maximum,error);assert error<1e-10,(r,step,key,error)
  for dim in range(2):
   assert record['squareMomentPoints'][dim]==[step,record['squareMoment'][dim]];assert res['squareMomentCurves'][dim][step]==record['squareMomentPoints'][dim]
  updates+=1
print(json.dumps({'scope':__doc__,'torchVersion':torch.__version__,'device':'cpu','dtype':'float64','configurations':len(requests),'completedUpdates':updates,'maximumStateDifference':maximum,'failures':0},indent=2))

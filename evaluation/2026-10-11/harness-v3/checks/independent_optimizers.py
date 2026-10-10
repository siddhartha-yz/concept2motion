"""Compare independent CPU float64 PyTorch optimizers with the draft recurrence."""
import json,subprocess,sys
from pathlib import Path
import torch
module=Path(sys.argv[1]).resolve();requests=[]
for kind in ['sgd','momentum','adagrad','rmsprop','adam']:
 for eta in [.01,.1,.25]:
  for mode in ['field','gradients']:
   r={'kind':kind,'start':[1.1,-.7],'eta':eta,'steps':20,'rho':.8,'beta1':.7,'beta2':.95,'epsilon':1e-6}
   if mode=='field':r['field']={'type':'quadratic','matrix':[[3,1],[1,1]]}
   else:r['gradients']=[[.2*(i%5-2),.3*((i*7)%6-3)] for i in range(20)]
   requests.append(r)
js="const o=require(process.argv[1]);let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(o.optimizerTrace))));"
results=json.loads(subprocess.check_output(['node','-e',js,str(module)],input=json.dumps(requests),text=True));maximum=0;states=0
for request,result in zip(requests,results):
 theta=torch.tensor(request['start'],dtype=torch.float64,requires_grad=True);eta=request['eta'];kind=request['kind'];eps=request['epsilon']
 if kind in ['sgd','momentum']:opt=torch.optim.SGD([theta],lr=eta,momentum=request['rho'] if kind=='momentum' else 0)
 elif kind=='rmsprop':opt=torch.optim.RMSprop([theta],lr=eta,alpha=request['rho'],eps=eps,momentum=0,centered=False)
 elif kind=='adagrad':opt=torch.optim.Adagrad([theta],lr=eta,eps=eps,initial_accumulator_value=0,lr_decay=0)
 else:opt=torch.optim.Adam([theta],lr=eta,betas=(request['beta1'],request['beta2']),eps=eps)
 H=torch.tensor([[3,1],[1,1]],dtype=torch.float64)
 for i in range(20):
  opt.zero_grad(set_to_none=True)
  if 'field' in request:loss=theta@H@theta/2;loss.backward()
  else:theta.grad=torch.tensor(request['gradients'][i],dtype=torch.float64)
  before=theta.detach().clone();gradient=theta.grad.detach().clone();opt.step();r=result['records'][i+1]
  for actual,expected in [(r['before'],before),(r['gradient'],gradient),(r['point'],theta.detach()),(r['update'],before-theta.detach())]:
   delta=float(torch.max(torch.abs(torch.tensor(actual,dtype=torch.float64)-expected)));maximum=max(maximum,delta);assert delta<1e-10,(kind,eta,i,delta)
  if 'field' in request:assert abs(r['value']-float((theta@H@theta/2).detach()))<1e-10
  state=opt.state[theta]
  if kind=='adam':
   assert torch.allclose(torch.tensor(r['firstMoment'],dtype=torch.float64),state['exp_avg'],atol=1e-12,rtol=1e-12);assert torch.allclose(torch.tensor(r['squareMoment'],dtype=torch.float64),state['exp_avg_sq'],atol=1e-12,rtol=1e-12)
  states+=1
print(json.dumps({'torchVersion':torch.__version__,'device':'cpu','dtype':'float64','configurations':len(requests),'completedUpdates':states,'maximumStateDifference':maximum,'scope':'Independent actual PyTorch recurrence and analytic objective comparisons; no neural network training, rendering, learning efficacy or art acceptance'},indent=2))

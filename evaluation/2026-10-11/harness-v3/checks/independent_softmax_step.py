"""Actual CPU float64 autograd and SGD against canonical logits/loss/update composition."""
import json,subprocess,sys
from pathlib import Path
import torch
module=Path(sys.argv[1]).resolve();requests=[]
for logits in [[-1,0,1],[0,0,0],[-1000,0,1000],[10,-10,3]]:
 for target in range(3):
  for eta in [0,.1,1,3]:
   for shift in [0,10]:requests.append({'logits':[[v+shift for v in logits]],'labels':[target],'eta':eta})
js="const C=require(process.argv[1]);let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(i=>{const b=C.compute('softmax-loss',{logits:i.logits,labels:i.labels}).result,u=C.compute('gradient-step',{values:b.logits,gradient:b.gradient,eta:i.eta}).result,a=C.compute('softmax-loss',{logits:u.after,labels:i.labels}).result;return{b,u,a}}))));"
actual=json.loads(subprocess.check_output(['node','-e',js,str(module)],input=json.dumps(requests),text=True));maximum=0
for i,r in zip(requests,actual):
 x=torch.tensor(i['logits'],dtype=torch.float64,requires_grad=True);y=torch.tensor(i['labels']);optimizer=torch.optim.SGD([x],lr=i['eta']);loss=torch.nn.functional.cross_entropy(x,y);loss.backward();p=torch.softmax(x.detach(),dim=-1);g=x.grad.detach().clone();optimizer.step();next_loss=torch.nn.functional.cross_entropy(x,y)
 for got,expected in [(r['b']['probabilities'],p),(r['b']['gradient'],g),(r['u']['after'],x.detach()),(r['a']['probabilities'],torch.softmax(x.detach(),dim=-1))]:
  delta=float(torch.max(torch.abs(torch.tensor(got,dtype=torch.float64)-expected)));maximum=max(maximum,delta);assert delta<1e-10
 assert abs(r['b']['loss']-float(loss.detach()))<1e-10;assert abs(r['a']['loss']-float(next_loss.detach()))<1e-10
print(json.dumps({'torchVersion':torch.__version__,'configurations':len(requests),'device':'cpu','dtype':'float64','maximumStateDifference':maximum,'failures':[],'scope':'Independent actual cross-entropy autograd and one SGD step on logits; not network training, browser design or learning efficacy.'},indent=2))

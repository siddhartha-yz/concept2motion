"""Independent NumPy row-major transpose and reshape against actual tool mappings."""
import itertools,json,subprocess,sys
from pathlib import Path
import numpy as np
module=str(Path(sys.argv[1]).resolve());requests=[]
for shape in [[2,2],[2,3,2],[2,2,2,2],[4,4,4],[1,2,1,3]]:
 n=int(np.prod(shape));columns=next(d for d in range(1,9) if n%d==0 and n/d<=8)
 for order in itertools.permutations(range(len(shape))):
  for reshape in [None,[n//columns,columns]]:
   requests.append({'values':list(range(n)),'shape':shape,'order':list(order),'reshape':reshape,'inputColumns':columns,'outputColumns':columns,'inputCell':[n//columns-1,columns-1]})
js="const r=require(process.argv[1]);let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(r.tensorReindex))));"
results=json.loads(subprocess.check_output(['node','-e',js,module],input=json.dumps(requests),text=True));mappings=0
for request,result in zip(requests,results):
 a=np.array(request['values']).reshape(request['shape']);b=a.transpose(request['order']);b=b.reshape(request['reshape']) if request['reshape'] else b
 assert b.ravel().tolist()==result['output'];assert list(b.shape)==result['outputShape']
 for m in result['mapping']:
  assert int(a[tuple(m['inputIndex'])])==m['value']==int(b[tuple(m['outputIndex'])]);assert np.ravel_multi_index(tuple(m['outputIndex']),b.shape)==m['outputFlat'];assert result['output'][m['outputFlat']]==m['value'];mappings+=1
 assert result['selected']['inputFlat']==len(request['values'])-1
print(json.dumps({'numpyVersion':np.__version__,'configurations':len(requests),'elementMappings':mappings,'failures':[],'scope':'Actual pure operation compared with independent NumPy transpose/reshape. Not browser geometry, measured memory, model generation or learning review.'},indent=2))

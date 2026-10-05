from pathlib import Path
import ast,json,hashlib
from manim import *
root=Path.cwd();rows=[]
for variant in ['render-v2','maintainer-repaired-v1']:
 p=root/'work/full-reproduction-v1/native-coordinate'/variant/'solution.py';tree=ast.parse(p.read_text());construct=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='construct');names={'axes','tracker','point','point_label'};nodes=[]
 for n in construct.body:
  if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in n.targets):nodes.append(n)
  if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and isinstance(n.value.func.value,ast.Name) and n.value.func.value.id in {'point','point_label'} and n.value.func.attr=='add_updater':nodes.append(n)
 ns=dict(globals());exec(compile(ast.Module(body=nodes,type_ignores=[]),str(p),'exec'),ns)
 a,t,point,label=[ns[k] for k in ['axes','tracker','point','point_label']];axis_x=float(a.c2p(0,0)[0]);checks=[]
 for x in [-2,-.27,0,1.33,2]+[-2+4*i/100 for i in range(101)]:
  t.set_value(x);point.update(0);label.update(0);left,right,bottom,top=float(label.get_left()[0]),float(label.get_right()[0]),float(label.get_bottom()[1]),float(label.get_top()[1]);crosses=left<=axis_x+.05 and right>=axis_x-.05
  checks.append({'x':x,'bbox':[left,bottom,right,top],'crosses_y_axis_band':crosses,'clipped':left<-64/9 or right>64/9 or bottom<-4 or top>4})
 rows.append({'variant':variant,'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'y_axis_x':axis_x,'checks':checks})
a,b=rows;targets=[b['checks'][i] for i in [1,2]]
result={'rows':rows,'gate_reviewed_positions_clear':all(not c['crosses_y_axis_band'] for c in targets),'gate_no_new_clipping':all(not c['clipped'] for c in b['checks']),'new_axis_crossing_positions':sum(not x['crosses_y_axis_band'] and y['crosses_y_axis_band'] for x,y in zip(a['checks'],b['checks'])),'limitations':'Native Text bounds and numeric point states; not all possible overlaps or artistic benefit. Reviewed positions approximated x=-0.27 and exactly x=0.'}
(root/'evaluation/2026-10-04/full-reproduction-v1/native-coordinate/geometry-maintainer-repaired-v1.json').write_text(json.dumps(result,indent=2)+'\n');print({k:v for k,v in result.items() if k!='rows'})

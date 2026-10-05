from pathlib import Path
import ast,hashlib,json
import cv2,numpy as np
root=Path.cwd();source=root/'work/full-reproduction-v1/upstreams/VBench/vbench/temporal_flickering.py';tree=ast.parse(source.read_text());names={'get_frames','mae_seq','calculate_mae','cal_score'};nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names];ns=dict(np=np,cv2=cv2);exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
w=root/'work/full-reproduction-v1/vbench-controls';w.mkdir(exist_ok=False);rows=[]
for name,count in [('blank_static',30),('white_black_flicker',30),('one_blank_frame',1)]:
 p=w/(name+'.mp4');writer=cv2.VideoWriter(str(p),cv2.VideoWriter_fourcc(*'mp4v'),30,(160,90));assert writer.isOpened()
 for i in range(count):writer.write(np.full((90,160,3),255 if name=='white_black_flicker' and i%2 else 0,dtype=np.uint8))
 writer.release();frames=ns['get_frames'](str(p));score=ns['cal_score'](str(p));rows.append({'id':name,'source':'hand-authored deterministic control, not model generation','video_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'decoded_frames':len(frames),'native_score':float(score) if np.isfinite(score) else None,'nonfinite':not bool(np.isfinite(score))})
(root/'evaluation/2026-10-04/full-reproduction-v1/vbench-flicker-native-controls.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'original_functions':sorted(names),'whole_VBench_installed':False,'rows':rows,'limitation':'Only native static-scene temporal flicker metric; blank static can score 1.0. Not semantic, pedagogical, artistic quality or full VBench reproduction.'},indent=2)+'\n');print(rows)

from pathlib import Path
import json,ast,time,hashlib
import cv2,numpy as np,torch
from PIL import Image
from transformers import CLIPModel,CLIPProcessor
root=Path.cwd();folder=root/'work/full-reproduction-v1/weights/clip-large';source=root/'work/full-reproduction-v1/upstreams/PhyEduVideo/scripts/multiimage.py'
torch.set_num_threads(4)
started=time.monotonic()
model=CLIPModel.from_pretrained(folder,local_files_only=True,use_safetensors=True).eval()
processor=CLIPProcessor.from_pretrained(folder,local_files_only=True)
tree=ast.parse(source.read_text());names={'sample_frames','calculate_clip_scores'}
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
namespace=dict(cv2=cv2,np=np,Image=Image,model=model,processor=processor)
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),namespace)
stimuli=json.loads((root/'evaluation/2026-10-03/judge-fact-probes-v3/stimuli.json').read_text());s=next(x for x in stimuli if x['id']=='P5');video=root/s['video']
frames=namespace['sample_frames'](str(video),32)
results=[]
with torch.no_grad():
 for prompt in ['A labeled diagram showing signed vector addition with blue orange and purple arrows.','A photograph of a dog playing on grass.']:
  t=time.monotonic();scores=namespace['calculate_clip_scores'](frames,prompt)
  results.append({'text':prompt,'logits':scores,'mean_logit':float(np.mean(scores)),'elapsed_s':time.monotonic()-t})
record={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'weights_revision':'32bd64288804d66eefd0ccbe215aa642df71cc41','torch':torch.__version__,'device':'cpu (native helper inputs/model stay on CPU)','original_AST_functions':sorted(names),'full_script':False,'adaptations':['local pinned weights instead of floating download','eval/no_grad inference context; four CPU threads','AST selects helper definitions to avoid unrelated top-level paid/large-model side effects'],'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'sampled_indices':[int(idx) for _,idx in frames],'results':results,'elapsed_total_s':time.monotonic()-started,'training':False,'quality_validated':False,'limitations':'CLIP logits are image-text similarity, not physical correctness, pedagogy, or original full Phy benchmark reproduction.'}
(root/'evaluation/2026-10-04/full-reproduction-v1/phy-clip-inference-v1.json').write_text(json.dumps(record,indent=2)+'\n')
print('CLIP local inference completed',len(frames),flush=True)

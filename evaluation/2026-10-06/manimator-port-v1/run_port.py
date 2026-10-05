"""Pinned Manimator text pipeline; explicit official Codex transport replacement."""
import ast
import contextlib
import hashlib
import importlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE=ROOT/'work/full-reproduction-v1/upstreams/manimator'
WORK=ROOT/'work/full-reproduction-v1/manimator-port-v1'
sys.path.insert(0,str(ROOT/'tools'))
from batch import digest
from reference_calls_v2 import invoke
BRIEF='Explain signed area and the 2D determinant for a beginner. Use a single class MainScene and at most 30 seconds. Show the unit square transformed by A=[[2,1],[0,1]] into a parallelogram of signed area 2. Separately show the unit square reflected by B=[[-1,0],[0,1]], signed area -1. Keep the basis vectors and corresponding corners identifiable. Show orientation reversal. Avoid overlapping labels. Use only Manim, numpy and math; no files, network or subprocess operations in the generated code.'
SCHEMA={'type':'object','additionalProperties':False,'properties':{'content':{'type':'string'}},'required':['content']}

def read(p):return json.loads(p.read_text())
def save(name,d):
    with (OUT/name).open('x') as f:f.write(json.dumps(d,ensure_ascii=False,indent=2,allow_nan=False)+'\n')

def prepare():
    assert subprocess.check_output(['git','-C',str(SOURCE),'rev-parse','HEAD'],text=True).strip()=='928b8b2331791bd46f1ad14676893be7528309d8'
    names=['requirements.txt','manimator/gradio_app.py','manimator/api/scene_description.py','manimator/api/animation_generation.py','manimator/utils/schema.py','manimator/utils/helpers.py','manimator/utils/system_prompts.py','manimator/few_shot/few_shot_prompts.py','manimator/few_shot/few_shot_1.pdf','LICENSE']
    save('source-pin.json',{'repository':'https://github.com/HyperCluster-Tech/manimator','commit':'928b8b2331791bd46f1ad14676893be7528309d8','files':[{'path':n,'sha256':digest(SOURCE/n)} for n in names]})
    save('brief.json',{'text':BRIEF,'audience':'beginner','task':'signed area/determinant','held_out_task':False,'model':'gpt-6-astra','generation_call_limit':4,'review_call_limit':1,'shared_authorization_limit':96,'already_used_before_design':53,'schema':SCHEMA})
    (OUT/'UPSTREAM-LICENSE').write_bytes((SOURCE/'LICENSE').read_bytes())
    save('frozen.json',[{'path':p.name,'sha256':digest(p)} for p in sorted(OUT.iterdir()) if p.is_file()])

def preflight(code):
    t=ast.parse(code)
    for n in ast.walk(t):
        if isinstance(n,ast.Import):
            assert all(a.name.split('.')[0] in {'manim','numpy','math'} for a in n.names)
        if isinstance(n,ast.ImportFrom):assert n.module and n.module.split('.')[0] in {'manim','numpy','math'} and n.level==0
        if isinstance(n,ast.Attribute):assert not n.attr.startswith('__')
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name):assert n.func.id not in {'open','exec','eval','compile','__import__','input','getattr','setattr','globals','locals'}
    return True

def run():
    for row in read(OUT/'frozen.json'):assert digest(OUT/row['path'])==row['sha256']
    for row in read(OUT/'source-pin.json')['files']:assert digest(SOURCE/row['path'])==row['sha256']
    WORK.mkdir(parents=True,exist_ok=False)
    sys.path.insert(0,str(SOURCE))
    import dotenv
    dotenv.load_dotenv=lambda *args,**kwargs:False  # explicit no-.env adaptation
    import litellm
    import manimator.api.scene_description as scene
    import manimator.api.animation_generation as animation
    from manimator.utils.schema import ManimProcessor
    from code2video_pilot import environment
    environment();os.environ['PATH']=str(ROOT/'work/full-reproduction-v1/manimator-venv/bin')+':'+os.environ['PATH']
    os.environ['GRADIO_ANALYTICS_ENABLED']='False'
    call_count=0;consecutive=0;call_rows=[];candidate_rows=[];current_source=None
    def completion(*,model,messages,num_retries=None,**kwargs):
        nonlocal call_count,consecutive
        if call_count>=4 or consecutive>=3:raise RuntimeError('fixed generation call/stop limit reached')
        call_count+=1;ident=f'manimator-determinant-generation-{call_count:02}-v1'
        prompt='Authorized original animation reproduction. Do not use tools, read files, browse, delegate, or invoke another model. All original role messages are serialized below; perform their requested task and put the complete native response in the content field.\n'+json.dumps(messages,ensure_ascii=False)
        save(ident+'-input.json',{'original_messages':messages,'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'requested_native_model':model,'native_num_retries_ignored':num_retries,'schema':SCHEMA})
        result=invoke(ident,prompt,SCHEMA,'gpt-6-astra');save(ident+'-result.json',result);call_rows.append({'id':ident,'status':result['status']})
        print(ident,result['status'],flush=True)
        if result['status']!='completed':consecutive+=1;raise RuntimeError('official transport failed; recorded without provider fallback')
        consecutive=0
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=result['response']['content']))])
    litellm.completion=completion
    original_save=ManimProcessor.save_code
    def preserving_save(self,code,temp_dir):
        nonlocal current_source
        ident=f'candidate-{len(candidate_rows)+1:02}';directory=WORK/ident;directory.mkdir()
        (directory/'extracted.py').write_text(code)
        row={'id':ident,'brief_sha256':digest(OUT/'brief.json'),'source_sha256':digest(directory/'extracted.py'),'code_path':str((directory/'extracted.py').relative_to(ROOT)),
             'revision_history':'native regeneration after failure only; no judge feedback; no source edits','preflight':'pending','render':None}
        candidate_rows.append(row);current_source=directory
        try:preflight(code);row['preflight']='passed'
        except Exception as error:row['preflight']='rejected:'+type(error).__name__;raise
        path=original_save(self,code,temp_dir);shutil.copyfile(path,directory/'native-saved.py');return path
    ManimProcessor.save_code=preserving_save
    original_subprocess_run=subprocess.run
    def render_run(command,*args,**kwargs):
        if isinstance(command,list) and command and command[0]=='manim':
            adapted=[('-ql' if a=='-pql' else a) for a in command];start=time.perf_counter()
            result=original_subprocess_run(adapted,*args,**{**kwargs,'check':False,'timeout':300})
            (current_source/'render.stdout.log').write_text(result.stdout or '');(current_source/'render.stderr.log').write_text(result.stderr or '')
            candidate_rows[-1]['render']={'native_command':command,'adapted_command':adapted,'exit_code':result.returncode,'elapsed_seconds':time.perf_counter()-start}
            if result.returncode:raise subprocess.CalledProcessError(result.returncode,adapted,output=result.stdout,stderr=result.stderr)
            return result
        return original_subprocess_run(command,*args,**kwargs)
    # The original process_prompt function, without importing Gradio's UI/telemetry initialization.
    tree=ast.parse((SOURCE/'manimator/gradio_app.py').read_text());node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='process_prompt')
    native={'ManimProcessor':ManimProcessor,'process_prompt_scene':scene.process_prompt_scene,'generate_animation_response':animation.generate_animation_response,'re':re}
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(SOURCE/'manimator/gradio_app.py'),'exec'),native)
    subprocess.run=render_run
    try:video,code,message=native['process_prompt'](BRIEF)
    finally:subprocess.run=original_subprocess_run
    output=None
    if video:
        output=WORK/'native-returned.mp4';shutil.copyfile(video,output);Path(video).unlink()
    save('generation-results.json',{'calls':call_rows,'candidates':candidate_rows,'native_message':message,'native_video_returned':bool(video),'video':str(output.relative_to(ROOT)) if output else None,
         'video_sha256':digest(output) if output else None,'original_source_changed':subprocess.run(['git','-C',str(SOURCE),'diff','--quiet']).returncode!=0,'complete_native_server_started':False,
         'adaptations':['official Codex replaces LiteLLM transport/model; retries disabled','original process_prompt AST without UI initialization','skip .env','archive sources before native temporary cleanup','remove preview p and limit render to300s','preflight generated code before execution'],
         'model_weight_updates':0})
    # Independent target math only, not a claim about all generated geometry.
    matrices={'A':[[2,1],[0,1]],'B':[[-1,0],[0,1]]};corners=[[0,0],[1,0],[1,1],[0,1]];checks={}
    for label,m in matrices.items():
        pts=[[m[0][0]*x+m[0][1]*y,m[1][0]*x+m[1][1]*y] for x,y in corners]
        area=sum(pts[i][0]*pts[(i+1)%4][1]-pts[i][1]*pts[(i+1)%4][0] for i in range(4))/2
        determinant=m[0][0]*m[1][1]-m[0][1]*m[1][0]
        checks[label]={'matrix':m,'transformed_corners':pts,'signed_polygon_area':area,'determinant':determinant,'agrees':area==determinant}
    save('target-math.json',{'checks':checks,'generated_geometry_independently_verified':False,'scope':'fixed input math, not video validity'})
    print('native pipeline',bool(video),message,flush=True)

if __name__=='__main__':globals()[sys.argv[1]]()

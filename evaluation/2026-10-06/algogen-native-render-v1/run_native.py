"""Run original ALGOGEN renderer, with independent terminal-state arithmetic."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE=ROOT/'work/full-reproduction-v1/upstreams/algogen_anonymous'
WORK=ROOT/'work/full-reproduction-v1/algogen-native-render-v1'
CASE=SOURCE/'outputs/CASE/array_leetcode_204_seed_01'

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,value):
    with (OUT/name).open('x') as f:f.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def prepare():
    files=['requirements.txt','renderer/manim_renderer.py','renderer/rsl_style_controller/rsl_interpreter.py','renderer/rsl_style_controller/rsl_semantic_checks.py','outputs/CASE/array_leetcode_204_seed_01/trace.json','outputs/CASE/array_leetcode_204_seed_01/trace_rsl.json','outputs/CASE/array_leetcode_204_seed_01/trace_render_config.json']
    assert subprocess.check_output(['git','-C',str(SOURCE),'rev-parse','HEAD'],text=True).strip()=='1bb093c76499135ecf54fc8030219a4e7ee4424c'
    save('source-pin.json',{'repository':'https://github.com/algenlab/algogen_anonymous','commit':'1bb093c76499135ecf54fc8030219a4e7ee4424c','files':[{'path':p,'sha256':digest(SOURCE/p)} for p in files]})
    save('frozen.json',[{'path':p.name,'sha256':digest(p)} for p in sorted(OUT.iterdir()) if p.is_file()])

def run():
    for x in json.loads((OUT/'frozen.json').read_text()):assert digest(OUT/x['path'])==x['sha256']
    for x in json.loads((OUT/'source-pin.json').read_text())['files']:assert digest(SOURCE/x['path'])==x['sha256']
    WORK.mkdir(parents=True,exist_ok=False)
    trace=json.loads((CASE/'trace.json').read_text());state={a['index']:a['value'] for a in trace['initial_frame']['data_state']['structure']};comments=[]
    for delta in trace['deltas']:
        for group in delta['operations']:
            for op in group if isinstance(group,list) else [group]:
                if op['op']=='updateValues':
                    for update in op['params']['updates']:state[update['index']]=update['value']
                if op['op']=='showComment':comments.append(op['params']['text'])
    n=len(state);expected=[k for k in range(2,n) if all(k%p for p in range(2,math.isqrt(k)+1))];observed=[k for k in sorted(state) if state[k]=='T']
    save('independent-math.json',{'input_n':n,'trace_deltas':len(trace['deltas']),'method':'independent trial division; trace applies updateValues only',
         'expected_primes':expected,'observed_terminal_primes':observed,'all_indices_match':all((state[k]=='T')==(k in expected) for k in state),
         'last_comment':comments[-1],'terminal_count_matches':f'Found {len(expected)} prime numbers less than {n}' in comments[-1],
         'intermediate_animation_or_general_algorithm_proof':False})
    semantic=module('native_rsl_semantic',SOURCE/'renderer/rsl_style_controller/rsl_semantic_checks.py')
    interpreter=module('native_rsl_interpreter',SOURCE/'renderer/rsl_style_controller/rsl_interpreter.py')
    rsl=json.loads((CASE/'trace_rsl.json').read_text())
    cases={'published_rsl':rsl,'empty':{},'out_of_bounds':{'rules':[{'when':{'op':'notAnOperation'},'do':{'animation':{'run_time':3},'style':{'scale':3}}}],'timeline':{'max_fps_for_changes':31}}}
    save('native-rsl-checks.json',{'results':{name:semantic.semantic_check_rsl(value) for name,value in cases.items()},'control_count':3,'model_calls':0})
    config=interpreter.rsl_to_render_config(rsl);(WORK/'interpreted-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    save('native-rsl-config.json',{'config':config,'source_sha256':digest(SOURCE/'renderer/rsl_style_controller/rsl_interpreter.py'),'model_calls':0})
    sys.path.insert(0,str(ROOT/'tools'))
    from code2video_pilot import environment
    environment();env=dict(os.environ)
    command=[str(ROOT/'work/full-reproduction-v1/algogen-venv/bin/python'),str(SOURCE/'renderer/manim_renderer.py'),str(CASE/'trace.json'),'--output',str(WORK/'native.mp4'),'--quality','low_quality']
    start=time.perf_counter()
    with (WORK/'renderer.log').open('w') as log:
        result=subprocess.run(command,env=env,cwd=WORK,stdout=log,stderr=subprocess.STDOUT,timeout=300)
    videos=sorted(WORK.rglob('*.mp4'))
    save('render-result.json',{'command':command,'exit_code':result.returncode,'wall_seconds':time.perf_counter()-start,'requested_output_exists':(WORK/'native.mp4').is_file(),
         'media_files':[{'path':str(p.relative_to(ROOT)),'sha256':digest(p),'bytes':p.stat().st_size} for p in videos if 'partial_movie_files' not in str(p)],
         'log_sha256':digest(WORK/'renderer.log'),'original_source_changed':subprocess.run(['git','-C',str(SOURCE),'diff','--quiet']).returncode!=0,
         'model_calls':0,'full_decode_and_sampled_review':'pending; do not infer from exit status'})
    print('native renderer exit',result.returncode,flush=True)

if __name__=='__main__':globals()[sys.argv[1]]()

from pathlib import Path
from dataclasses import asdict
import sys,os,json
sys.path.insert(0,'tools')
from code2video_pilot import environment
environment();root=Path.cwd();os.environ['PATH']=str(root/'work/full-reproduction-v1/bench-venv/bin')+':'+str(root/'work/full-reproduction-v1/bin')+':'+os.environ['PATH'];os.environ['LD_LIBRARY_PATH']='/home/yang-zhi/Documents/Codex/2026-09-21/la/work/ffmpeg-runtime/usr/lib/x86_64-linux-gnu:'+os.environ['LD_LIBRARY_PATH']
from manimbench.sandbox.local import LocalSandbox
from manimbench.runtime.manimce import ManimCERuntime
from manimbench.tasks import load_task
from manimbench.scoring import score_task
work=(root/'work/full-reproduction-v1/native-coordinate/maintainer-repaired-v1').resolve()
assert (work/'solution.py').is_file()
r=LocalSandbox(process_limit=8192).render(work,work/'solution.py',ManimCERuntime(),240,60,'MainScene');safe={k:v for k,v in asdict(r).items() if k not in ['stdout','stderr']}
out=root/'evaluation/2026-10-04/full-reproduction-v1/native-coordinate';(out/'render-maintainer-repaired-v1.json').write_text(json.dumps(safe,indent=2)+'\n')
task=load_task(root/'work/full-reproduction-v1/upstreams/manim-bench/benchmarks/v0.6/tasks/coordinate_system_animation.yaml');s=score_task(task,'gpt-6-astra plus maintainer syntax repair',(work/'solution.py').read_text(),r,work);(out/'native-score-maintainer-repaired-v1.json').write_text(json.dumps(asdict(s),indent=2,default=str)+'\n');print(r.exit_code,s.automated_score)

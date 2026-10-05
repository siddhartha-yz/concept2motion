import os,subprocess
from pathlib import Path
root=Path.cwd()
env={k:v for k,v in os.environ.items() if not any(x in k.upper() for x in ['API_KEY','SECRET','TOKEN','PASSWORD'])}
env['PYTHON_DOTENV_DISABLED']='1'
p=subprocess.run([str(root/'work/full-reproduction-v1/rlm-venv/bin/python'),'-m','pytest','-q','--junitxml='+str(root/'work/full-reproduction-v1/rlm-tests.xml')],cwd=root/'work/full-reproduction-v1/upstreams/rlm',env=env,timeout=300)
raise SystemExit(p.returncode)

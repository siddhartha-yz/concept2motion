"""Real Markdown preflight controls, no author process or model call."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Use a fresh directory')
out.mkdir(parents=True);original=out/'original';original.mkdir()
(original/'one.md').write_text('# 向量\n\n$\\mathbf{x}\\in\\mathbb{R}^2$\n\n![本地图](axis.svg)\n')
(original/'two.md').write_text('# 平方\n\n$$\nf(x)=x^2\n$$\n')
image=original/'axis.svg';image.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="6"/></svg>')
manifest=original/'manifest.json';manifest.write_text(json.dumps({'title':'两章准备控制','chapters':[{'id':'one','source':'one.md'},{'id':'two','source':'two.md'}]}))
records=[]
def invoke(label,input,output,resume=False,expect=0):
 command=[sys.executable,str(ROOT/'tools/run_visualbook.py'),str(input),str(output),'--prepare-only']+(['--resume']if resume else[])
 p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=90)
 (out/(label+'.stdout')).write_text(p.stdout);(out/(label+'.stderr')).write_text(p.stderr)
 assert (p.returncode==0)==(expect==0),(label,p.returncode,p.stderr)
 records.append({'label':label,'exit':p.returncode,'generationInvocations':len(list(output.rglob('invocation.json')))})
 assert not list(output.rglob('invocation.json'))
 return p
run=out/'prepared';invoke('good',manifest,run);snapshot=run/'inputs/one.source.json';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=sha(snapshot)
prepared=json.loads((run/'prepared-manifest.json').read_text());assert len(prepared['chapters'])==2
source=json.loads(snapshot.read_text());assert source['adaptation']['mathRendered']==1 and source['adaptation']['images']==1
invoke('resume-unchanged',manifest,run,True)
image.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="10" y="10" width="20" height="20"/></svg>')
p=invoke('changed-local-image',manifest,run,True,1);assert 'local image content changed' in p.stderr;assert sha(snapshot)==before
(original/'two.md').write_text('# 错公式\n\n$\\definitelyUnknownCommand{x}$\n')
bad=out/'bad-late-chapter';invoke('bad-late-chapter',manifest,bad,expect=1);assert not (bad/'inputs').exists();r=json.loads((bad/'preparation/attempt-001/report.json').read_text());assert r['status']=='failed' and r['records'][0]['status']=='prepared'
# Restore live input before testing snapshot corruption independently.
image.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="6"/></svg>')
(original/'two.md').write_text('# 平方\n\n$$\nf(x)=x^2\n$$\n');snapshot.write_text(snapshot.read_text()+' ')
p=invoke('corrupt-snapshot',manifest,run,True,1);assert 'snapshot was modified' in p.stderr
record={'passed':True,'modelCalls':0,'cases':records,'scope':'Actual two-chapter Markdown import, formula/image identity and resume rejection. Not full generation or browser/teaching validation.'}
(out/'control.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':True,'cases':len(records),'modelCalls':0}))

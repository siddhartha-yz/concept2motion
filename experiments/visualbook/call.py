"""One immutable, official signed-in Codex call. Serial lock; raw logs stay ignored."""
import argparse,fcntl,hashlib,json,os,signal,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'evaluation/2026-10-10/d2l-visualbook-v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('section');p.add_argument('attempt');p.add_argument('--feedback',type=Path);p.add_argument('--image',type=Path,action='append',default=[]);a=p.parse_args()
 raw=BASE/'raw'/a.section/a.attempt
 if raw.exists(): raise SystemExit('Refuse to overwrite attempt')
 raw.mkdir(parents=True);context=raw/'context';context.mkdir()
 book=json.loads((ROOT/'outputs/visualbook'/f'{a.section}.source.json').read_text())
 guide=(ROOT/'experiments/visualbook/generation-guide.md').read_text()
 prompt=guide+'\n原文（每块含可引用 id）：\n'+json.dumps([{k:b[k] for k in ('id','sha256','type','raw')} for b in book['blocks']],ensure_ascii=False)
 if a.feedback:
  prompt+='\n本次是修订。保持无关图不变。前次输出与具体反馈：\n'+a.feedback.read_text()
 (raw/'prompt.md').write_text(prompt);schema=ROOT/'experiments/visualbook/response.schema.json'
 cmd=['codex','exec','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--json','--output-schema',str(schema),'--output-last-message',str(raw/'response.json'),'--cd',str(context)]
 for img in a.image: cmd+=['--image',str(img.resolve())]
 cmd+=['-'];env=dict(os.environ)
 for k in ('OPENAI_API_KEY','CODEX_API_KEY'):env.pop(k,None)
 started=time.monotonic()
 with (BASE/'raw/serial.lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  attempts=list((BASE/'raw').glob('*/*/process.json'))
  if len(attempts)>=8: raise SystemExit('Eight-call scope reached')
  with (raw/'stdout.jsonl').open('w') as out,(raw/'stderr.log').open('w') as err:
   proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=out,stderr=err,env=env,start_new_session=True)
   timed_out=False
   try:proc.communicate(prompt.encode(),timeout=900)
   except subprocess.TimeoutExpired:
    timed_out=True;os.killpg(proc.pid,signal.SIGKILL);proc.communicate()
   except BaseException:
    os.killpg(proc.pid,signal.SIGKILL);proc.communicate();raise
  tools=[];usage=[]
  for line in (raw/'stdout.jsonl').read_text().splitlines():
   try:event=json.loads(line)
   except ValueError:continue
   if event.get('type')=='turn.completed':usage.append(event.get('usage'))
   item=event.get('item',{})
   if item.get('type') in ('command_execution','file_change','mcp_tool_call','web_search'):tools.append(item.get('type'))
  result=dict(section=a.section,attempt=a.attempt,exit_code=proc.returncode,timed_out=timed_out,wall_s=round(time.monotonic()-started,3),prompt_sha256=sha(raw/'prompt.md'),response_sha256=sha(raw/'response.json') if (raw/'response.json').exists() else None,tool_types=tools,usage=usage,auth='official Codex; existing ChatGPT login',images=len(a.image))
  (raw/'process.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
  public=BASE/'calls';public.mkdir(exist_ok=True);(public/f'{a.section}-{a.attempt}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps(result,ensure_ascii=False))
  if proc.returncode or timed_out or tools:raise SystemExit('Generation not accepted; raw evidence retained')
  response=json.loads((raw/'response.json').read_text())
  candidate=ROOT/'experiments/visualbook/candidates'/a.section/a.attempt;candidate.mkdir(parents=True)
  (candidate/'response.json').write_text(json.dumps(response,ensure_ascii=False,indent=2)+'\n')
  (candidate/'brief.json').write_text(json.dumps(dict(sourceCommit=book['sourceCommit'],sourceSha256=book['sourceSha256'],source=book['source'],sourceUrl=book['sourceUrl'],guideSha256=sha(ROOT/'experiments/visualbook/generation-guide.md'),**result),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()

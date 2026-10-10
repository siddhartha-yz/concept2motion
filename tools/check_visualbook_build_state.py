"""Actual MCP protocol controls for stale build rejection; no model or browser render."""
import json
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Output exists')
out.mkdir(parents=True)
source={'title':'构建状态控制','sourceSha256':'maintenance-control','blocks':[{'id':'state-1','raw':'控制','type':'paragraph','html':'<p>维护者协议控制，不是模型生成。</p>','sha256':'maintenance-control','math':{'expected':0}}]}
plan={'figures':[{'id':'state','title':'构建状态','afterAnchor':'state-1','height':200,'code':"function draw({board,progress}){board.circle('p',100+40*progress,80,5);return {progress};}"}]}
def write(name,value): (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
write('source.json',source);write('book.json',plan)
records=[]
with (out/'protocol-stderr.txt').open('w') as err:
 process=subprocess.Popen(['python3',str(ROOT/'tools/visualbook_mcp.py'),'--workspace',str(out)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True)
 try:
  def call(name):
   ident=len(records)+1
   args={'label':'should-not-render'} if name=='preview_book' else {}
   process.stdin.write(json.dumps({'jsonrpc':'2.0','id':ident,'method':'tools/call','params':{'name':name,'arguments':args}})+'\n');process.stdin.flush()
   result=json.loads(process.stdout.readline())['result'];records.append({'tool':name,'response':result});return result
  def reject():
   r=call('preview_book');assert r.get('isError') is True,r;assert 'build' in r['content'][0]['text'].lower()
  assert call('build_book').get('isError') is False
  plan['figures'][0]['title']='计划已经改变';write('book.json',plan);reject()
  plan['figures'][0]['height']=900;write('book.json',plan);assert call('build_book').get('isError') is True
  plan['figures'][0]['height']=200;write('book.json',plan);reject()
  assert call('build_book').get('isError') is False
  with (out/'book.html').open('a') as f:f.write('<!--changed-->')
  reject();assert call('build_book').get('isError') is False
  source['title']='原文输入变化';write('source.json',source);reject()
 finally:
  process.stdin.close();process.wait(timeout=10)
write('control.json',{'kind':'actual MCP protocol stale-build controls; no model and no browser rendering','modelCalls':0,'calls':records,'passed':True})
assert not list(out.glob('preview-*')),'A rejected stale candidate must not consume a preview'
print(json.dumps({'passed':True,'protocolCalls':len(records),'browserRenders':0,'modelCalls':0}))

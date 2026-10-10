"""Named design insertion through actual local MCP; zero model and browser calls."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Output exists')
out.mkdir(parents=True)
source={'title':'直接复用工具控制','sourceSha256':'maintenance-control','blocks':[{'id':'one','raw':'control','type':'paragraph','html':'<p>维护者协议控制。</p>','sha256':'maintenance-control','math':{'expected':0}}]}
def write(name,data):(out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
write('source.json',source);write('book.json',{'figures':[]})
records=[]
with (out/'stderr.log').open('w') as err:
 p=subprocess.Popen(['python3',str(ROOT/'tools/visualbook_mcp.py'),'--workspace',str(out)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True)
 try:
  def call(name,args):
   p.stdin.write(json.dumps({'jsonrpc':'2.0','id':len(records)+1,'method':'tools/call','params':{'name':name,'arguments':args}})+'\n');p.stdin.flush()
   result=json.loads(p.stdout.readline())['result'];records.append({'tool':name,'arguments':args,'response':result});return result
  request={'id':'field','design':'receptive-field','afterAnchor':'one'}
  assert call('put_design',request)['isError'] is False
  initial=(out/'book.json').read_bytes();expanded=json.loads((out/'resolved-plan.json').read_text())
  assert expanded['figures'][0]['scene']['props']['inputLength']==8
  assert expanded['figures'][0]['designRef']['id']=='receptive-field'
  assert call('put_design',request)['isError'] is True
  assert (out/'book.json').read_bytes()==initial
  changed={**request,'replace':True,'overrides':[{'path':'/scene/props/inputLength','value':6}]}
  assert call('put_design',changed)['isError'] is False
  assert json.loads((out/'resolved-plan.json').read_text())['figures'][0]['scene']['props']['inputLength']==6
  assert call('put_design',{**request,'id':'missing','replace':True})['isError'] is True
  bad={**request,'replace':True,'overrides':[{'path':'/scene/props/inputLenght','value':6}]}
  assert call('put_design',bad)['isError'] is True
  assert json.loads((out/'build-receipt.json').read_text())['status']=='failed'
  assert call('preview_book',{'label':'old-must-not-render'})['isError'] is True
  assert call('put_design',{**request,'replace':True})['isError'] is False
  assert call('put_design',{**request,'code':'function draw(){}'})['isError'] is True
 finally:p.stdin.close();p.wait(timeout=10)
snapshots=sorted((out/'builds').glob('build-*'))
assert [json.loads((s/'receipt.json').read_text())['status'] for s in snapshots]==['success','success','failed','success']
assert len(list((out/'plan-edits').glob('edit-*')))==4
assert (out/'plan-edits/edit-001/before.json').read_bytes()==b'{\n  "figures": []\n}\n'
assert json.loads((out/'builds/build-001/resolved-plan.json').read_text())['figures'][0]['scene']['props']['inputLength']==8
assert not list(out.glob('preview-*'))
# A direct arm has no library insertion capability.
with (out/'direct-stderr.log').open('w') as err:
 p=subprocess.run(['python3',str(ROOT/'tools/visualbook_mcp.py'),'--workspace',str(out),'--direct'],input=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'put_design','arguments':request}})+'\n',capture_output=False,stdout=subprocess.PIPE,stderr=err,text=True,timeout=30)
 direct=json.loads(p.stdout)['result'];assert direct['isError'] is True;assert 'Unknown tool' in direct['content'][0]['text']
write('control.json',{'passed':True,'modelCalls':0,'browserRenders':0,'calls':records,'directRejection':direct,'snapshots':4,'kind':'actual MCP insertion/replacement/failure/stale-preview controls; no artistic verdict'})
print(json.dumps({'passed':True,'protocolCalls':len(records)+1,'snapshots':4,'modelCalls':0,'browserRenders':0}))

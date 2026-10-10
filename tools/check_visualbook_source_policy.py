"""Actual local MCP source, annotation and composition policy controls, zero model calls."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
source={'title':'原文条件与插图位置','sourceSha256':'maintenance-control','blocks':[{'id':'intro','type':'paragraph','raw':'根据定义：','html':'<p>根据定义：</p>','sha256':'intro','math':{'expected':0}},{'id':'formula','type':'math','raw':'$$y=wx$$','html':'<p>y = wx</p>','sha256':'formula','math':{'expected':0}},{'id':'tail','type':'paragraph','raw':'下面讨论唯一性。','html':'<p>下面讨论唯一性。</p>','sha256':'tail','math':{'expected':0}}]}
def write(n,d):(out/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
write('source.json',source);write('book.json',{'figures':[]});original=(out/'source.json').read_bytes();calls=[]
with (out/'stderr.log').open('w') as err:
 p=subprocess.Popen(['python3',str(ROOT/'tools/visualbook_mcp.py'),'--workspace',str(out),'--library-first'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True)
 try:
  def call(n,a={}):
   p.stdin.write(json.dumps({'jsonrpc':'2.0','id':len(calls)+1,'method':'tools/call','params':{'name':n,'arguments':a}})+'\n');p.stdin.flush();r=json.loads(p.stdout.readline())['result'];calls.append({'name':n,'arguments':a,'result':r});return r
  r=call('inspect_source',{'anchors':['intro','formula']});assert not r['isError'];contexts=json.loads(r['content'][0]['text']);assert contexts[0]['recommendedAnchor']=='formula';assert contexts[1]['safeToInsertAfter']
  bad={'id':'f','design':'derivative','afterAnchor':'intro'};assert call('put_design',bad)['isError'];assert json.loads((out/'build-receipt.json').read_text())['status']=='failed'
  assert call('preview_book',{'label':'stale'})['isError'];assert not list(out.glob('preview-*'))
  assert not call('put_design',{**bad,'afterAnchor':'formula','replace':True})['isError']
  note={'id':'note-rank','afterAnchor':'tail','kind':'condition','text':'唯一参数解需要设计矩阵满列秩。','formula':r'\operatorname{rank}(X)=d'}
  assert not call('put_annotation',note)['isError'];html=(out/'book.html').read_text();assert 'vh-annotation' in html and 'katex' in html and '唯一参数解需要' in html
  assert (out/'source.json').read_bytes()==original
  assert call('put_annotation',note)['isError'];assert not call('put_annotation',{**note,'text':'参数唯一性需要满列秩。','replace':True})['isError']
  assert call('put_annotation',{**note,'formula':r'\notARealCommand{x}','replace':True})['isError'];assert json.loads((out/'build-receipt.json').read_text())['status']=='failed'
  assert call('preview_book',{'label':'bad-note'})['isError'];assert not call('put_annotation',{**note,'replace':True})['isError']
  math=call('compute_math',{'operation':'sample-grid','inputs':{'resolution':5},'fields':['shape']});assert not math['isError'];m=json.loads(math['content'][0]['text']);assert m['result']=={'shape':[5,5]};assert len(json.loads((out/m['fullResultPath']).read_text())['result']['points'])==25
  assert call('compute_math',{'operation':'sample-grid','inputs':{},'fields':['shpae']})['isError']
  custom={'id':'custom','afterAnchor':'formula','title':'确有缺口的自写图','height':240,'code':'function draw({board}){board.text("a","custom",30,40);return {value:1};}'}
  write('book.json',{'figures':[custom]});assert call('build_book')['isError'];assert json.loads((out/'build-receipt.json').read_text())['status']=='failed'
  gap={'figureId':'custom','attemptedDesigns':['derivative'],'reason':'维护者负向控制：这个人工示例特意使用独立文字图元，用于检验说明是否绑定当前源码，而非证明实际缺口。'}
  assert not call('declare_drawing_gap',gap)['isError'];assert not call('build_book')['isError'];receipt=json.load(open(out/'build-receipt.json'));assert receipt['composition_policy']=='prefer-library'
  custom['code']=custom['code'].replace('value:1','value:2');write('book.json',{'figures':[custom]});assert call('build_book')['isError'];assert call('preview_book',{'label':'changed-code'})['isError']
  assert not call('declare_drawing_gap',gap)['isError'];assert not call('build_book')['isError'];assert call('declare_drawing_gap',{**gap,'attemptedDesigns':['not-a-design']})['isError']
 finally:p.stdin.close();p.wait(timeout=10)
write('control.json',{'passed':True,'calls':calls,'modelCalls':0,'browserRenders':0,'sourceSha256':hashlib.sha256(original).hexdigest(),'scope':'Actual source adjacency, annotations/TeX, failed-build/stale-preview, selected math fields and code-hash escape controls; not art or autonomous-generation evidence'})
print(json.dumps({'passed':True,'protocolCalls':len(calls),'modelCalls':0,'browserRenders':0}))

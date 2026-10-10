"""Local stdio MCP: compile and preview authorized candidates, return real PNG content.

No credentials, HTTP server, remote calls or arbitrary shell arguments. The caller
supplies one workspace; file paths must stay within it. This is not an upload service.
"""
import argparse,base64,hashlib,json,re,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--workspace',type=Path,required=True);parser.add_argument('--direct',action='store_true');args=parser.parse_args()
 workspace=args.workspace.resolve(strict=True);tool=ROOT/'tools/visualbook.mjs'
 def inside(name):
  p=(workspace/name).resolve()
  if not p.is_relative_to(workspace):raise ValueError('Path outside current workspace')
  return p
 tools=[
  {'name':'build_book','description':'Compile source.json and book.json into book.html; original prose and formulas retained. Does not judge artistic quality.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},
  {'name':'preview_book','description':'Render actual desktop/mobile views and fractional progress. Returns numerical layout findings AND real PNG image content for every figure at mid-progress. Use a fresh label; at most three previews.','inputSchema':{'type':'object','properties':{'label':{'type':'string','description':'Fresh preview label, e.g. first or revised'}},'required':['label'],'additionalProperties':False}}
 ]
 def call(name,arguments):
  started=time.monotonic();images=[]
  if name=='build_book':
   cmd=['node',str(tool),'build',str(inside('source.json')),str(inside('book.json')),str(inside('book.html'))]
   if args.direct:cmd+=['--direct']
  elif name=='preview_book':
   label=arguments.get('label','')
   if not re.fullmatch(r'[a-z][a-z0-9-]{0,40}',label):raise ValueError('Invalid preview label')
   if len(list(workspace.glob('preview-*/report.json')))>=3:raise ValueError('Three-preview budget reached; preserve final issues')
   out=inside('preview-'+label)
   if out.exists():raise ValueError('Preview directory already exists')
   cmd=['node',str(tool),'preview',str(inside('book.html')),str(out)]
  else:raise ValueError('Unknown tool')
  p=subprocess.run(cmd,cwd=workspace,capture_output=True,text=True,timeout=180)
  if p.returncode:return {'content':[{'type':'text','text':p.stderr[-6000:] or p.stdout[-6000:]}],'isError':True}
  result=json.loads(p.stdout.splitlines()[-1]);content=[{'type':'text','text':json.dumps(result,ensure_ascii=False)}]
  if name=='preview_book':
   for path in result['screenshots']:
    file=Path(path).resolve()
    if not file.is_relative_to(workspace):raise ValueError('Screenshot outside workspace')
    if file.name.endswith('-0.5.png'):
     data=file.read_bytes();content+=[{'type':'text','text':'真实预览 '+file.name},{'type':'image','mimeType':'image/png','data':base64.b64encode(data).decode()}]
     images.append({'name':file.name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'mimeType':'image/png'})
   # Source-only previews still provide an actual cropped readable page image.
   if not images:
    for path in result['screenshots'][:1]:
     file=Path(path);data=file.read_bytes();content.append({'type':'image','mimeType':'image/png','data':base64.b64encode(data).decode()});images.append({'name':file.name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
  entry={'tool':name,'arguments':arguments,'wall_s':round(time.monotonic()-started,3),'images':images,'findings':result.get('findings',[]),'arm':'direct' if args.direct else 'harness'}
  with (workspace/'mcp-evidence.jsonl').open('a') as f:f.write(json.dumps(entry,ensure_ascii=False)+'\n')
  return {'content':content,'isError':False}
 for line in sys.stdin:
  try:
   request=json.loads(line);method=request.get('method');ident=request.get('id')
   if ident is None:continue
   if method=='initialize':result={'protocolVersion':request.get('params',{}).get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'visualbook-local','version':'0.2.0'}}
   elif method=='ping':result={}
   elif method=='tools/list':result={'tools':tools}
   elif method in ['resources/list','resources/templates/list','prompts/list']:result={('resourceTemplates' if method=='resources/templates/list' else 'resources' if method=='resources/list' else 'prompts'):[]}
   elif method=='tools/call':
    params=request.get('params',{});result=call(params.get('name'),params.get('arguments',{}))
   else:raise ValueError('Unsupported method')
   response={'jsonrpc':'2.0','id':ident,'result':result}
  except Exception as error:
   response={'jsonrpc':'2.0','id':locals().get('ident'),'result':{'content':[{'type':'text','text':str(error)}],'isError':True}}
  sys.stdout.write(json.dumps(response,ensure_ascii=False)+'\n');sys.stdout.flush()
if __name__=='__main__':main()

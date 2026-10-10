"""Bounded serial official Codex author session with real local tool use."""
import argparse,fcntl,hashlib,json,os,re,signal,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'work/harness-v2/runs'
PUBLIC=ROOT/'evaluation/2026-10-10/harness-v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,value):p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def main():
 p=argparse.ArgumentParser();p.add_argument('section');p.add_argument('arm',choices=['direct','harness']);p.add_argument('--attempt',default='');p.add_argument('--mcp',action='store_true');args=p.parse_args()
 if args.section not in ['geometry','optimization','programming']:raise SystemExit('Unknown frozen section')
 if args.attempt and not re.fullmatch(r'[a-z][a-z0-9-]*',args.attempt):raise SystemExit('Bad attempt')
 BASE.mkdir(parents=True,exist_ok=True);job=BASE/(args.section+'-'+args.arm+('-'+args.attempt if args.attempt else ''))
 if job.exists():raise SystemExit('Refuse to overwrite a session')
 source=ROOT/'work/harness-v2/sources'/f'{args.section}.source.json';book=json.loads(source.read_text())
 tool=ROOT/'tools/visualbook.mjs';api=ROOT/'packages/visualbook/API.md';libfiles=[ROOT/'packages/visualbook'/n for n in ['viz.js','runtime.js','theme.css','math.mjs','API.md']]+[tool]
 env=dict(os.environ)
 for key in ['OPENAI_API_KEY','CODEX_API_KEY']:env.pop(key,None)
 login=subprocess.run(['codex','login','status'],env=env,capture_output=True,text=True)
 if login.returncode or 'Logged in using ChatGPT' not in login.stdout+login.stderr:raise SystemExit('Requires official ChatGPT login')
 version=subprocess.check_output(['codex','--version'],env=env,text=True).strip()
 with (ROOT/'work/visualbook/codex-serial.lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if len(list(BASE.glob('*/invocation.json')))>=8:raise SystemExit('Eight attempt scope reached, including launch failures and pilot')
  previous=sorted(BASE.glob('*/result.json'),key=lambda f:f.stat().st_mtime)
  if len(previous)>=3 and all(json.loads(f.read_text())['exit_code']!=0 for f in previous[-3:]):raise SystemExit('Three service/process failures; diagnose first')
  job.mkdir();(job/'source.json').write_bytes(source.read_bytes());(job/'source.md').write_text('\n\n'.join(f'[{b["id"]}]\n{b["raw"]}' for b in book['blocks']))
  schema={'figures':[]};write(job/'book.json',schema)
  prompt=f'''你要把当前目录的完整教材变成优秀的段落内可视化教材。中文，保留原文与公式，不改source文件。阅读source.md的完整内容与锚点，source.json给编译器使用。选择1–3个原书没有解释清楚的关系，允许有依据地零图；不要把原文段落再次塞进图。
本次工具路径 TOOL={tool}。把绘图计划写到book.json，调用构建和预览工具，查看实际桌面与手机PNG，自行修订。需要连续的0–1进度、真实因果参数、清楚的轴与短标签、安静但有设计感的画面。不要只把进度取整后切换静态图片。连续变化由读者拖动或阅读控制，无自动播放。避免装饰卡片、说明墙和超过480px的桌面图。
两臂共享同一原文、基本任务、编译器、阅读运行时和预览检查。你的arm={args.arm}。
运行 node TOOL build source.json book.json book.html {'--direct' if args.arm=='direct' else ''}（TOOL换成上面绝对路径）。运行 node TOOL preview book.html preview-01 会得到真实PNG与report.json。至少预览一次并查看桌面和手机的图片。每次修改重新build，预览目录另起名。最多3次预览，1200秒会话上限；内部检查不能代替审美判断。失败保留，不自打分。
{('你使用普通SVG/DOM自行绘图，不调用VisualBook/Board库。draw收到svg,width,height,progress,params，可自己管理稳定SVG对象。' if args.arm=='direct' else '你可以使用可复用Board和VisualBook数学工具，使用稳定图元id，充分利用库减少布局与绘图负担。')}
输出book.json形状和接口见下面。源码是function draw(input)，绘图后返回实际使用的facts；不要自称训练结果或实测性能。公式已经编译，不重写教材。最终写AUTHOR.md说明图的取舍、实际预览与修订、未解决问题。
禁止网络、其他模型或代理、读取账号配置与凭据、修改工具源码或任务外文件。只操作当前目录，不需要git提交。预览若因sandbox被阻断可按正常审批请求执行本地Chromium，不跳过安全控制。
'''
  interface=api.read_text()
  if args.arm=='direct':interface=interface.split('## Board')[0]+interface[interface.index('## 命令行工作流程'):]
  prompt+='\n'+interface
  if args.mcp:prompt+='\n本轮有本地 visualbook MCP 工具。必须用 build_book 构建，再用 preview_book 预览；它直接返回真实桌面/手机PNG图片内容，不能仅凭文件路径或数值报告声称看过画面。观察图片后自行修订。CLI命令只用于读取原文和写book.json，不用shell替代图片预览。最多3次预览，不要更改工具源码。\n'
  (job/'prompt.md').write_text(prompt)
  before={str(f.relative_to(ROOT)):sha(f) for f in libfiles};write(job/'invocation.json',{'section':args.section,'arm':args.arm,'source_sha256':book['sourceSha256'],'prompt_sha256':sha(job/'prompt.md'),'tool_hashes':before,'cliVersion':version,'timeout_s':1200,'auth':'official existing ChatGPT login'})
  # This CLI release treats --approve-for-me as workspace-write already;
  # combining it with --sandbox fails before any model request.
  cmd=['codex','exec','--ephemeral','--skip-git-repo-check','--approve-for-me','--json','--cd',str(job),'--output-last-message',str(job/'last-message.md'),'-']
  if args.mcp:
   server_args=[str(ROOT/'tools/visualbook_mcp.py'),'--workspace',str(job)]+(['--direct'] if args.arm=='direct' else [])
   cmd=cmd[:-1]+['-c','mcp_servers.visualbook.command="python3"','-c','mcp_servers.visualbook.args='+json.dumps(server_args),'-c','mcp_servers.visualbook.tool_timeout_sec=180','-']
  started=time.monotonic();timed_out=False
  with (job/'events.jsonl').open('w') as stdout,(job/'stderr.log').open('w') as stderr:
   proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=stdout,stderr=stderr,env=env,start_new_session=True)
   try:proc.communicate(prompt.encode(),timeout=1200)
   except subprocess.TimeoutExpired:timed_out=True;os.killpg(proc.pid,signal.SIGKILL);proc.communicate()
   except KeyboardInterrupt:os.killpg(proc.pid,signal.SIGKILL);proc.communicate();raise
  events=[]
  for line in (job/'events.jsonl').read_text().splitlines():
   try:events.append(json.loads(line))
   except ValueError:pass
  items=[e.get('item',{}) for e in events if e.get('type')=='item.completed'];usage=[e['usage'] for e in events if e.get('type')=='turn.completed' and 'usage' in e]
  counts={kind:sum(i.get('type')==kind for i in items) for kind in sorted({i.get('type','unknown') for i in items})}
  image_calls=[json.loads(line) for line in (job/'mcp-evidence.jsonl').read_text().splitlines()] if (job/'mcp-evidence.jsonl').exists() else []
  result={'section':args.section,'arm':args.arm,'exit_code':proc.returncode,'timed_out':timed_out,'wall_s':round(time.monotonic()-started,3),'tool_item_counts':counts,'usage':usage,'tool_sources_unchanged':all(sha(f)==before[str(f.relative_to(ROOT))] for f in libfiles),'source_unchanged':sha(job/'source.json')==sha(source),'plan_sha256':sha(job/'book.json'),'html_exists':(job/'book.html').exists(),'preview_count':len(list(job.glob('preview-*/report.json'))),'returned_png_count':sum(len(c['images']) for c in image_calls),'mcp_enabled':args.mcp,'auth':'official existing ChatGPT login'}
  write(job/'result.json',result);(PUBLIC/'calls').mkdir(exist_ok=True);write(PUBLIC/'calls'/(job.name+'.json'),result);print(json.dumps(result,ensure_ascii=False))
  if proc.returncode or timed_out or not result['tool_sources_unchanged']:raise SystemExit('Session incomplete; retained raw evidence')
if __name__=='__main__':main()

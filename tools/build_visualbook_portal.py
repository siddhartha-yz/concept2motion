"""Package already reviewed exported books/designs into a quiet local reading entry.
No authoring, source rewrites or model calls; every copied HTML is hash verified.
"""
import argparse,hashlib,html,json,re,shutil,zipfile
from pathlib import Path

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('book',type=Path);p.add_argument('catalog',type=Path);p.add_argument('output',type=Path);a=p.parse_args();book=a.book.resolve();catalog=a.catalog.resolve();out=a.output.resolve()
 if out.exists():raise SystemExit('Fresh output required')
 chapters=json.load(open(book/'build-record.json'))['records'];designs=json.load(open(catalog/'catalog-record.json'))['records']
 if not chapters or not designs:raise ValueError('Completed book and catalog required')
 selected=[]
 for group,base,records in [('book',book,chapters),('designs',catalog,designs)]:
  for r in records:
   ident=r['id']
   if not re.fullmatch('[a-z][a-z0-9-]*',ident):raise ValueError('Invalid artifact id')
   if r.get('renderFindings',r.get('findings',[])) or not r.get('exported'):raise ValueError('Only passed exported artifacts can enter this portal')
   source=base/(ident+'.html');expected=r['exported']['sha256']
   if sha(source)!=expected:raise ValueError('Exported HTML identity mismatch: '+ident)
   selected.append((group,source,expected))
 out.mkdir(parents=True)
 for group,source,expected in selected:
  target=out/group/source.name;target.parent.mkdir(exist_ok=True);shutil.copyfile(source,target)
  if sha(target)!=expected:raise ValueError('Copy identity mismatch')
 for group,base in [('book',book),('designs',catalog)]:
  shutil.copyfile(base/'index.html',out/group/'index.html')
  for source in base.glob('*LICENSE*.txt'):shutil.copyfile(source,out/group/source.name)
 # Catalog index uses reviewed SVG thumbnails, plans and render records.
 for r in designs:
  ident=r['id']
  for relative in [f'evidence/{ident}/static/1280-{ident}.svg',f'evidence/{ident}/report.json',f'sources/{ident}/plan.json']:
   source=catalog/relative;target=out/'designs'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
 cards=''.join(f'<a class="chapter" href="book/{html.escape(r["id"])}.html"><span>{i+1:02d}</span><h2>{html.escape(r["title"])}</h2><p>{r["figures"]} 处可以停下来试一试</p><b aria-hidden="true">↗</b></a>' for i,r in enumerate(chapters))
 feature=next((d for d in designs if d['id']=='neural-response'),designs[0]);fid=feature['id']
 page=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'"><title>VisualBook · 读到这里，自己试一下</title><style>
:root{{--paper:#faf9f5;--ink:#263b43;--muted:#606f76;--blue:#337a98;--orange:#a8502f;--line:#dce5e6}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:17px/1.8 system-ui,'Noto Sans CJK SC',sans-serif}}main{{max-width:1080px;margin:auto;padding:30px 40px 72px}}header{{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:20px;font-size:13px}}header strong{{font-weight:550;letter-spacing:.07em}}a{{color:var(--blue);text-underline-offset:4px}}h1{{font-size:clamp(38px,6vw,64px);line-height:1.18;font-weight:550;letter-spacing:-.04em;margin:62px 0 22px}}.lead{{font-size:19px;max-width:630px;color:var(--muted);margin-bottom:28px}}.actions{{display:flex;gap:26px;flex-wrap:wrap;align-items:center}}.primary{{background:var(--ink);color:var(--paper);padding:11px 20px;text-decoration:none;border-radius:3px}}.feature{{display:grid;grid-template-columns:1fr 2fr;gap:32px;align-items:center;border-block:1px solid var(--line);margin:54px 0 40px;padding:28px 0}}.feature h2{{font-weight:500;font-size:24px;line-height:1.5}}.feature p{{font-size:14px;color:var(--muted)}}.feature img{{width:100%;max-height:285px;object-fit:contain}}.chapters{{display:grid;grid-template-columns:repeat(2,1fr);gap:0 40px}}.chapter{{display:grid;grid-template-columns:32px 1fr 24px;align-items:center;gap:0 16px;border-top:1px solid var(--line);padding:22px 0;color:inherit;text-decoration:none}}.chapter span{{color:var(--orange);font-size:12px}}.chapter h2{{margin:0;font-size:21px;font-weight:500}}.chapter p{{grid-column:2;margin:3px 0 0;color:var(--muted);font-size:13px}}.chapter b{{grid-column:3;grid-row:1 / 3;color:var(--blue);font-weight:400}}.chapter:hover h2{{color:var(--blue)}}footer{{border-top:1px solid var(--line);padding-top:24px;margin-top:44px;display:flex;justify-content:space-between;gap:20px;font-size:13px;color:var(--muted)}}a:focus-visible{{outline:2px solid var(--orange);outline-offset:5px}}@media(max-width:650px){{main{{padding:24px 22px 50px}}h1{{margin-top:44px}}.feature{{grid-template-columns:1fr;gap:12px;margin-top:40px}}.feature img{{max-height:240px}}.chapters{{grid-template-columns:1fr}}footer{{display:block}}}}
</style></head><body><main><header><strong>VISUALBOOK</strong><a href="designs/index.html">{len(designs)} 种设计积木 ↗</a></header><h1>读到这里，<br>停下来试一下。</h1><p class="lead">正文、公式和图解在一起。图不会跟着滚动跳走；你决定什么时候拖动、逐步查看，或者播放。</p><nav class="actions" aria-label="开始阅读"><a class="primary" href="book/index.html">打开教材试读</a><a href="visualbook-offline.zip" download>下载教材离线版本</a></nav><section class="feature"><div><h2>改变一个输入，<br>看见相关的变化。</h2><p>同一个位置连接两层响应。拖动图中的点，或调节参数，慢慢观察。</p><a href="designs/{html.escape(fid)}.html">试一试这幅图 ↗</a></div><a href="designs/{html.escape(fid)}.html"><img src="designs/evidence/{html.escape(fid)}/static/1280-{html.escape(fid)}.svg" alt="{html.escape(feature['title'])}"></a></section><section class="chapters" aria-label="教材章节">{cards}</section><footer><span>教材来自《动手学深度学习》；各页保留原文链接。试读为实验性生成结果。</span><a href="designs/index.html">查看可复用设计</a></footer></main></body></html>'''
 (out/'index.html').write_text(page)
 with zipfile.ZipFile(out/'visualbook-offline.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for file in sorted((out/'book').rglob('*')):
   if file.is_file():
    entry=zipfile.ZipInfo(file.relative_to(out/'book').as_posix(),date_time=(1980,1,1,0,0,0))
    entry.create_system=3;entry.external_attr=0o100644<<16
    z.writestr(entry,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
 record={'kind':__doc__,'modelCalls':0,'chapters':len(chapters),'designs':len(designs),'files':[{'path':str((Path(group)/source.name)),'sha256':expected} for group,source,expected in selected],'offlineZipScope':'Exported textbook chapters, index and licenses only; design gallery stays separate','offlineZipSha256':sha(out/'visualbook-offline.zip')}
 (out/'portal-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'output':str(out),'chapters':len(chapters),'designs':len(designs),'zipBytes':(out/'visualbook-offline.zip').stat().st_size}))
if __name__=='__main__':main()

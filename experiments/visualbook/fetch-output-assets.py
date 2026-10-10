import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT/'work/visualbook/source-snapshots'
def main():
 rows=[]
 for file in FOLDER.glob('*.outputs.json'):
  data=json.loads(file.read_text());assets=FOLDER/data['section'];assets.mkdir(exist_ok=True)
  for record in data['records']:
   if not record['matched']:continue
   for item in record['outputs']:
    if item['kind']!='image':continue
    url=item['url'];name=url.rsplit('/',1)[-1]
    if not url.startswith('https://zh.d2l.ai/_images/') or '/' in name:raise ValueError('Unexpected upstream asset URL')
    try:
     with urllib.request.urlopen(url,timeout=30) as response:content=response.read()
     if not name.endswith('.svg') or b'<svg' not in content:raise ValueError('Only reviewed source SVG supported')
     (assets/name).write_bytes(content);item['assetSha256']=hashlib.sha256(content).hexdigest();item['assetFile']=str((assets/name).relative_to(ROOT));rows.append(dict(section=data['section'],url=url,sha256=item['assetSha256'],bytes=len(content)))
    except Exception as e:rows.append(dict(section=data['section'],url=url,error=type(e).__name__))
  file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (FOLDER/'assets.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
if __name__=='__main__':main()

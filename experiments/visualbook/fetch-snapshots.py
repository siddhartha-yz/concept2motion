"""Optional live upstream outputs. Exact code matching happens separately."""
import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT/'work/visualbook/source-snapshots'
def main():
 FOLDER.mkdir(parents=True,exist_ok=True)
 manifests=[ROOT/'experiments/visualbook/sampling.json',ROOT/'experiments/visualbook/holdout-sampling.json']
 rows=[]
 for manifest in manifests:
  if not manifest.exists():continue
  for s in json.loads(manifest.read_text())['sections']:
   url='https://zh.d2l.ai/'+s['selected'].replace('.md','.html')
   try:
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
    (FOLDER/(s['stratum']+'.html')).write_bytes(data)
    rows.append(dict(section=s['stratum'],url=url,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
   except Exception as e:rows.append(dict(section=s['stratum'],url=url,error=type(e).__name__))
 (FOLDER/'fetch.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
if __name__=='__main__':main()

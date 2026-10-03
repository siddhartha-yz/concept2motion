"""Contact sheets from exact saved frames; no retouching or model calls."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from batch import digest,save
from model_infra_pilot import ROOT


def build(report,work):
 report=Path(report).resolve();work=Path(work).resolve();plan=json.loads((report/'plan.json').read_text());times=plan['samples_s']
 if (report/'stimuli.json').exists():raise ValueError('Never replace frozen stimuli')
 for item in json.loads((report/'frozen.json').read_text()):
  if digest(report/item['path'])!=item['sha256']:raise ValueError('Frozen probe changed')
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);samples=[]
 for entry in json.loads((report/'oracle.json').read_text())['facts']:
  ident=entry['id'];render=work/ident/'render';directory=work/'contacts'/ident;directory.mkdir(parents=True,exist_ok=False)
  sheet=Image.new('RGB',(1708,1524),'#202020');frames=[]
  for i,t in enumerate(times):
   frame=render/f'frame-{t:.2f}.jpg';picture=Image.open(frame).convert('RGB')
   if picture.size!=(854,480):raise ValueError('Unexpected size; no implicit resizing')
   x,y=i%2*854,i//2*508;sheet.paste(picture,(x,y+28));ImageDraw.Draw(sheet).text((x+8,y+4),f'{ident}: {t:.2f}s',font=font,fill='white')
   frames.append({'time_s':t,'frame':str(frame),'sha256':digest(frame)})
  contact=directory/'contact.png';sheet.save(contact)
  question={'join':'橙色修正箭头的尾端，是否在每一行都与蓝色输入箭头的头端相接？','ratio':'三个指数条的长度，是否与旁边标出的三个指数质量成比例？','sum':'最终紫色箭头的方向和长度，是否对应每一行标出的完整分量和？'}[entry['fact']]
  prompt=(report/'prompt.txt').read_text()+question+'\n供给的抽帧时间：'+json.dumps(times)+'。只评价这个关系，证据不充分时保留未知。'
  (directory/'prompt.txt').write_text(prompt)
  samples.append({'id':ident,'question':question,'contact':str(contact.relative_to(ROOT)),'contact_sha256':digest(contact),'video':str((render/'video.mp4').relative_to(ROOT)),'video_sha256':digest(render/'video.mp4'),'frames':frames,'prompt':str((directory/'prompt.txt').relative_to(ROOT)),'prompt_sha256':digest(directory/'prompt.txt')})
 save(report/'stimuli.json',samples);save(report/'stimuli-frozen.json',{'stimuli_sha256':digest(report/'stimuli.json'),'builder_sha256':digest(Path(__file__)),'samples':samples})
 print(f'{len(samples)} anonymous contact sheets frozen, no model calls')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',required=True);parser.add_argument('--work',required=True);args=parser.parse_args();build(args.report,args.work)

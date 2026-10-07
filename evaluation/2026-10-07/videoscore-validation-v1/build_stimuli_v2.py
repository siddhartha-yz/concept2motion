"""Hand-authored deterministic controls; no model generation or image editing."""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time
from PIL import Image, ImageDraw, ImageFont
import cv2

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
WORK = ROOT / 'work/videoscore-validation-v1/stimuli-v2'
WIDTH, HEIGHT, FPS, FRAMES = 854, 480, 8, 64
FONT = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
VARIANTS = ['correct', 'wrong-formula', 'wrong-geometry', 'missing-step', 'tiny-text', 'flicker', 'blank']
PROMPTS = {
 'determinant': 'Explain the two-dimensional determinant with a unit square, show its continuous transformation by A=[[2,1],[0,1]], and show that det(A)=2 and the final signed area is +2. Make the formula and labels clearly readable.',
 'softmax': 'Explain Softmax for z=[-1,0.7,1.3]. Show the original logits, then exponentiation with bar lengths proportional to exp(z), then normalization p_i=exp(z_i)/sum_j exp(z_j). Make the formula and labels clearly readable.',
 'residual': 'Explain a residual connection y=x+f(x), with x=[0.7,-0.4,0.2] and f(x)=[-0.2,0.15,-0.3]. Show input arrows, then join correction arrows at their heads, then show the componentwise output [0.5,-0.25,-0.1]. Make the formula and labels clearly readable.'
}


def sha(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, data):
 (OUT/name).write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')


def parameters(concept, variant, i):
 t=i/FPS
 stage=0 if t<2 else 1 if t<4 else 2
 if variant=='missing-step': stage=2
 p={'stage':stage, 'font_size':8 if variant=='tiny-text' else 20,
    'blank':variant=='blank', 'flicker_invert':variant=='flicker' and i%2==1}
 wrong_formula=variant=='wrong-formula' and stage==2
 if concept=='determinant':
  s=0 if stage==0 else min(1,(t-2)/2) if stage==1 else 1
  if variant=='wrong-geometry': s*=0.5
  p.update(vertices=[[0,0],[1+s,0],[1+2*s,1],[s,1]],
   formula='det(A) = 2*1 - 1*0 = '+('-2' if wrong_formula else '+2'),
   labels=['A = [[2,1],[0,1]]','Target signed area = +2','Orientation preserved'])
 elif concept=='softmax':
  z=[-1.,.7,1.3];mass=[math.exp(v) for v in z];prob=[v/sum(mass) for v in mass]
  p.update(z=z, masses=mass, probabilities=prob,
   shown_masses=[mass[0]+1.3,*mass[1:]] if variant=='wrong-geometry' else mass,
   formula='p_i = z_i / sum(z)' if wrong_formula else 'p_i = exp(z_i) / sum(exp(z))',
   labels=['z = [-1, 0.7, 1.3]','exp(z) = [0.368, 2.014, 3.669]', 'p = [0.061, 0.333, 0.606]'])
 else:
  x=[.7,-.4,.2];f=[-.2,.15,-.3]
  p.update(x=x, correction=f, output=[.5,-.25,.25] if variant=='wrong-geometry' else [.5,-.25,-.1],
   formula='y = x - f(x)' if wrong_formula else 'y = x + f(x)',
   labels=['x = [0.7, -0.4, 0.2]','f(x) = [-0.2, 0.15, -0.3]', 'y = [0.50, -0.25, -0.10]'])
 return p


def render(concept, p):
 image=Image.new('RGB',(WIDTH,HEIGHT),(128,128,128) if p['blank'] else '#101722')
 if p['blank']: return image
 d=ImageDraw.Draw(image);font=ImageFont.truetype(str(FONT),p['font_size'])
 def text(x,y,value,color='#edf4ff'):d.text((x,y),value,font=font,fill=color)
 def arrow(a,b,color):
  d.line([a,b],fill=color,width=5)
  angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=10
  d.polygon([b,(b[0]-length*math.cos(angle-.5),b[1]-length*math.sin(angle-.5)),(b[0]-length*math.cos(angle+.5),b[1]-length*math.sin(angle+.5))],fill=color)
 text(28,18,{'determinant':'Signed area and determinant','softmax':'Softmax: logits to probabilities','residual':'Residual: input plus correction'}[concept])
 text(28,63,['1. Start from the input','2. Show the transformation','3. Compute the output'][p['stage']])
 text(28,412,('TARGET: ' if concept=='determinant' else '')+p['formula'],'#ffde7b')
 for j,line in enumerate(p['labels'][:p['stage']+1]):
  assert font.getbbox(line)[2] <= WIDTH-460-16, line
  text(460,155+j*60,line)
 if concept=='determinant':
  pts=[(90+100*x,350-100*y) for x,y in p['vertices']]
  d.line([(55,350),(410,350)],fill='#61738b',width=2);d.line([(90,390),(90,160)],fill='#61738b',width=2)
  d.polygon(pts,fill='#244c72',outline='#85c5ff',width=3)
  arrow(pts[0],pts[1],'#ff8585');arrow(pts[0],pts[3],'#8fe5a8')
  for j,(x,y) in enumerate(pts):text(x+5,y+5,['O','u','u+v','v'][j])
 elif concept=='softmax':
  for j in range(3):
   y=160+j*70;value=p['z'][j] if p['stage']==0 else p['shown_masses'][j]
   a=180;length=value*70 if p['stage']==0 else value*60
   d.rectangle((min(a,a+length),y,max(a,a+length),y+32),fill=['#85c5ff','#8fe5a8','#ffde7b'][j])
   text(36,y,str(p['z'][j]) if p['stage']==0 else f"{p['masses'][j]:.3f}")
   if p['stage']==2:text(180,y+34,f"p={p['probabilities'][j]:.3f}")
 else:
  for j,(x,f,yout) in enumerate(zip(p['x'],p['correction'],p['output'])):
   y=145+j*80;a=180;end=a+x*240
   arrow((a,y),(end,y),'#85c5ff');text(30,y-12,f'x{j+1}')
   if p['stage']>=1:arrow((end,y),(end+f*240,y),'#ffbd79')
   if p['stage']==2:arrow((a,y+28),(a+yout*240,y+28),'#c6a5ff')
 if p['flicker_invert']:
  # This is a code-native alternate palette, not a modification of a supplied image.
  import numpy as np
  image=Image.fromarray(255-np.asarray(image))
 return image


def independent_check(concept, variant, final):
 formula_ok=variant!='wrong-formula'
 if concept=='determinant':
  # Integer determinant and shoelace use the actual plotted vertices.
  expected=2*1-1*0;v=final['vertices'];actual=sum(v[j][0]*v[(j+1)%4][1]-v[(j+1)%4][0]*v[j][1] for j in range(4))/2
  geometry_ok=abs(actual-expected)<1e-9;detail={'expected_signed_area':expected,'actual_drawn_signed_area':actual}
 elif concept=='softmax':
  expected=[math.exp(v) for v in [-1,.7,1.3]];shown=final['shown_masses']
  ratios=[shown[j]/expected[j] for j in range(3)]
  geometry_ok=max(ratios)-min(ratios)<1e-9
  detail={'expected_masses':expected,'actual_drawn_masses':shown,'scale_ratios':ratios,'probability_sum':sum(final['probabilities'])}
 else:
  expected=[a+b for a,b in zip([.7,-.4,.2],[-.2,.15,-.3])]
  errors=[abs(a-b) for a,b in zip(expected,final['output'])];geometry_ok=max(errors)<1e-9
  detail={'expected_component_sums':expected,'actual_drawn_output':final['output'],'max_error':max(errors)}
 assert geometry_ok==(variant!='wrong-geometry')
 assert formula_ok==(variant!='wrong-formula')
 return {'formula_correct':formula_ok,'geometry_correct':geometry_ok,'geometry_scope':'draw parameters; blank is not visible evidence', 'visible':variant!='blank',**detail}


def main():
 assert not (OUT/'stimuli-v2.json').exists(),'Preserve run: new version required'
 WORK.mkdir(parents=True,exist_ok=True);rows=[];inputs=[]
 for concept in PROMPTS:
  sheet=Image.new('RGB',(854,7*184),'white');sd=ImageDraw.Draw(sheet)
  for row_index,variant in enumerate(VARIANTS):
   ident=f'{concept}-{variant}';directory=WORK/ident;directory.mkdir();start=time.perf_counter()
   trajectory=[]
   command=['ffmpeg','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{WIDTH}x{HEIGHT}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-y',str(directory/'video.mp4')]
   with (directory/'render.log').open('w') as log:
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
    for i in range(FRAMES):
     p=parameters(concept,variant,i);trajectory.append(p);process.stdin.write(render(concept,p).tobytes())
    process.stdin.close();assert process.wait(timeout=120)==0
   cap=cv2.VideoCapture(str(directory/'video.mp4'));decoded=[];samples=[]
   while True:
    ok,bgr=cap.read()
    if not ok:break
    i=len(decoded);rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB);decoded.append(hashlib.sha256(rgb.tobytes()).hexdigest())
    if i in [4,13,20,29,44,61]:
     path=directory/f'frame-{i:03}.png';im=Image.fromarray(rgb);im.save(path);samples.append({'frame':i,'sha256':sha(path)})
    if i in [4,21,60]:sheet.paste(Image.fromarray(rgb).resize((284,160)),(284*[4,21,60].index(i),row_index*184+24))
   cap.release();assert len(decoded)==FRAMES
   sd.text((6,row_index*184+3),variant,fill='black')
   math_check=independent_check(concept,variant,trajectory[-1])
   inputs.append({'id':ident,'video':str((directory/'video.mp4').relative_to(ROOT)),'video_sha256':sha(directory/'video.mp4'),'prompt':PROMPTS[concept],'max_frames':48,'expected_selected_frames':48})
   rows.append({'id':ident,'concept':concept,'variant':variant,'brief':PROMPTS[concept], 'source':'build_stimuli.py','source_sha256':sha(Path(__file__)), 'math_checks':math_check,'actual_draw_parameters':trajectory,'render':{'frames':FRAMES,'fully_decoded':len(decoded),'width':WIDTH,'height':HEIGHT,'fps':FPS,'wall_s':time.perf_counter()-start,'decoded_frame_hashes':decoded},'sampled_frames':samples,'review':'pending visual preflight, before scoring','revision_history':[{'kind':'hand-authored controlled intervention','variant':variant}],'generated_by_model':False})
  sheet.save(WORK/f'{concept}-contact.png')
 save('stimuli-v2.json',rows)
 save('runtime-render-v2.json',{'font':str(FONT),'font_sha256':sha(FONT),'opencv':cv2.__version__,'source_sha256':sha(Path(__file__))})
 legacy=json.loads((ROOT/'evaluation/2026-10-03/judge-fact-probes-v3/stimuli.json').read_text())
 for ident in ['Q7','T2','H9','L4','B8','D3','K6','M1','S3','V6']:
  row=next(v for v in legacy if v['id']==ident)
  concept='softmax' if ident in ['B8','D3','K6','M1'] else 'residual'
  inputs.append({'id':'legacy-'+ident,'video':row['video'],'video_sha256':row['video_sha256'],'prompt':PROMPTS[concept],'max_frames':48,'expected_selected_frames':48})
 old=json.loads((ROOT/'evaluation/2026-10-06/videoscore-native-v1/inputs.json').read_text())[-1]
 baseline=ROOT/'work/full-reproduction-v1/manimator-port-v1/native-render'
 videos=list(baseline.rglob('*.mp4')) if baseline.exists() else []
 # The frozen prior workflow metadata specifies the actual baseline video path.
 if not videos:
  videos=list((ROOT/'work/full-reproduction-v1/manimator-port-v1').rglob('*.mp4'))
 assert len(videos)==1,[(str(v)) for v in videos]
 inputs.append({**old,'id':'manimator-before','video':str(videos[0].relative_to(ROOT)),'video_sha256':sha(videos[0])})
 inputs.append({**old,'id':'manimator-after'})
 for concept in PROMPTS:
  row=next(v for v in inputs if v['id']==concept+'-correct')
  inputs.append({**row,'id':concept+'-mismatched-prompt','prompt':'A realistic orange cat walks through a snowy forest at night, with visible paw prints and falling snow.'})
 save('inputs-v2.json',inputs);save('repeat-inputs-v2.json',[{**row,'id':row['id']+'-repeat'} for row in inputs if row['id'].endswith('-correct')])
 assert len(inputs)==36
 print('21 actual renders, 1344 full decoded frames; 36 first forwards + 3 repeat forwards prepared',flush=True)

if __name__=='__main__':main()

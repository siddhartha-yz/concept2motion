"""Two real diagnostic renders with malformed inspection-only fields, zero models."""
import argparse,json,shutil
from pathlib import Path
from batch import digest,save
import progress_controls as c
from model_infra_pilot import ROOT
REPORT=ROOT/'evaluation/2026-10-03/metadata-regression-v1';WORK=ROOT/'work/metadata-regression-v1'


def prepare():
 if REPORT.exists() or WORK.exists():raise ValueError('New regression output required')
 REPORT.mkdir(parents=True);WORK.mkdir(parents=True);plan=[]
 base=ROOT/'evaluation/2026-10-03/progress-controls-v3/sources/softmax-staggered-reveal'
 for ident,expected,patch in [('numeric-color','missing_pixel_reference',"if(state.geometry.segments?.length)state.geometry.segments[0].color=123;"),('malformed-bounds','invalid_frame_evidence',"state.bounds={unexpected:'not an array'};")]:
  source=REPORT/'sources'/ident;shutil.copytree(base,source)
  js=(source/'scene.js').read_text().replace('return state;',patch+'\n return state;');(source/'scene.js').write_text(js)
  plan.append({'id':ident,'expected':expected,'source':str(source.relative_to(ROOT)),'sources':{file.name:digest(file) for file in source.iterdir()}})
 for relative in ('tools/metadata_regression.py','tools/progress_controls.py','tools/render_scene.mjs','tools/contracts.mjs','tools/capture_frame.mjs','benchmarks/cases.json'):
  target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/relative,target)
 save(REPORT/'plan.json',{'kind':'hand-authored malformed inspection fields, still render diagnostic video; no model or art', 'cases':plan,'model_calls':0,'samples_s':[1,4,8,11,14,17]})
 save(REPORT/'frozen.json',[{'path':str(file.relative_to(REPORT)),'sha256':digest(file)} for file in REPORT.rglob('*') if file.is_file()]);print('2 malformed metadata controls frozen')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','run']);args=parser.parse_args()
 if args.phase=='prepare':prepare()
 else:c.REPORT,c.WORK=REPORT,WORK;c.run()

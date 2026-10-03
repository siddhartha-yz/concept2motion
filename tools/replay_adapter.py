"""Explicit dependency revision: replay frozen finals with a new drawing adapter.

Authored HTML/JS/storyboard are unchanged; the adapter change is recorded rather
than backfilled into the original experiment or counted as model generation.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import shutil
import subprocess
import time

from batch import digest, save
from model_infra_pilot import ROOT, NODE, render_environment


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--experiment',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--work',type=Path,required=True)
    parser.add_argument('--adapter',type=Path,default=ROOT/'runtime/math-frame.mjs')
    args=parser.parse_args()
    report,work,old,adapter=[p.resolve() for p in (args.out,args.work,args.experiment,args.adapter)]
    records=json.loads((old/'generation.json').read_text())
    # Check every input before creating output or rendering a subset.
    for group in records:
        record=group['final']
        for name,sha in record['source_sha256'].items():
            if digest(ROOT/record['source']/name)!=sha:raise ValueError('Original source changed')
        if 'math-frame.mjs' not in record['source_sha256']:raise ValueError('No original adapter to revise')
    if report.exists() or work.exists():raise ValueError('Replay output must be new')
    report.mkdir(parents=True);work.mkdir(parents=True)
    tooling=report/'tooling';tooling.mkdir()
    for relative in ['tools/replay_adapter.py','tools/render_scene.mjs','tools/contracts.mjs',
                     'tools/capture_frame.mjs','benchmarks/cases.json']:
        target=tooling/relative;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/relative,target)
    (tooling/'runtime').mkdir()
    shutil.copyfile(adapter,tooling/'runtime/math-frame.mjs')
    save(report/'plan.json',{'kind':'explicit adapter dependency revision, not a model capability experiment',
         'input_experiment':str(old),'all_finals':len(records),'model_calls':0,'adapter_sha256':digest(adapter),
         'policy':'Only math-frame.mjs replaced. Original authored source hashes remain unchanged. Old runs and judgements retained.',
         'max_workers':4,'samples_s':[1,4,8,11,14,17]})
    save(report/'tooling-hashes.json',{str(p.relative_to(tooling)):digest(p) for p in tooling.rglob('*') if p.is_file()})
    def render(group):
        prior=group['final'];ident=f"{group['case']}-{group['repeat']}-{group['arm']}"
        directory=work/ident;source=directory/'source';shutil.copytree(ROOT/prior['source'],source)
        shutil.copyfile(tooling/'runtime/math-frame.mjs',source/'math-frame.mjs')
        for name,sha in prior['source_sha256'].items():
            if name!='math-frame.mjs' and digest(source/name)!=sha:raise ValueError('Authored source changed')
        began=time.monotonic()
        process=subprocess.run([NODE,str(tooling/'tools/render_scene.mjs'),'--scene',str(source/'index.html'),
             '--out',str(directory/'render'),'--brief',str(ROOT/prior['input_brief']),
             '--render-invalid','--samples','1,4,8,11,14,17','--author','original model author; explicit adapter dependency revision'],
             env=render_environment(),capture_output=True,text=True,timeout=60)
        (directory/'stdout.log').write_text(process.stdout);(directory/'stderr.log').write_text(process.stderr)
        manifest=json.loads((directory/'render/manifest.json').read_text())
        result={'id':ident,'case':group['case'],'repeat':group['repeat'],'arm':group['arm'],
                'original_status':prior['status'],'original_technical_pass':prior.get('technical_pass',False),
                'original_source':prior['source'],'authored_sources_unchanged':True,
                'original_adapter_sha256':prior['source_sha256']['math-frame.mjs'],'new_adapter_sha256':digest(source/'math-frame.mjs'),
                'source':str(source),'render_directory':str(directory/'render'),'status':manifest['status'],
                'exit_code':process.returncode,'video_exported':(directory/'render/video.mp4').exists(),
                'full_decode':manifest.get('video',{}).get('full_decode_passed',False),'wall_s':time.monotonic()-began,
                'finding_codes':sorted({f['code'] for f in manifest.get('checks',{}).get('findings',[])}),
                'execution_errors':manifest.get('errors',[]),'source_hashes':{p.name:digest(p) for p in source.iterdir()},
                'review':{'kind':'technical dependency regression','independent_artistic_review':False,'artistic_acceptance':'not_assigned'},
                'revision_history':[{'kind':'model-authored original','version':prior['version']},
                                    {'kind':'explicit infrastructure dependency revision','changed_file':'math-frame.mjs','model_calls':0}]}
        save(report/'candidates'/f'{ident}.json',result)
        print(ident,result['status'],flush=True)
        return result
    began=time.monotonic();results=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(render,g) for g in records]
        for future in as_completed(futures):
            results.append(future.result());save(report/'results.json',results)
    summary={'candidates':len(results),'exported':sum(r['video_exported'] for r in results),
             'original_exported':sum(r['original_status']=='rendered' for r in results),
             'recovered':sum(r['video_exported'] and r['original_status']!='rendered' for r in results),
             'lost_exports':sum(not r['video_exported'] and r['original_status']=='rendered' for r in results),
             'full_decodes':sum(r['full_decode'] for r in results),'technical_pass':sum(r['status']=='render_passed' for r in results),
             'model_calls':0,'batch_wall_s':time.monotonic()-began}
    save(report/'summary.json',summary);print(json.dumps(summary),flush=True)


if __name__=='__main__':main()

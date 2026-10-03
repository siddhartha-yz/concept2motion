"""Replay all frozen v1 finals under new capture/check tooling, without model calls."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import shutil
import subprocess
import time

from batch import digest, save
from model_infra_pilot import ROOT, NODE, render_environment

OLD = ROOT/'evaluation/2026-10-02/model-infra-pilot-v1'
REPORT = ROOT/'evaluation/2026-10-03/render-evidence-v2'
WORK = ROOT/'work/render-evidence-v2'


def main():
    WORK.mkdir(parents=True,exist_ok=False)
    REPORT.mkdir(parents=True,exist_ok=False)
    (REPORT/'tooling').mkdir()
    for relative in ['tools/render_scene.mjs','tools/contracts.mjs','tools/capture_frame.mjs','runtime/math-frame.mjs','tools/replay_evidence.py']:
        shutil.copyfile(ROOT/relative,REPORT/'tooling'/Path(relative).name)
    generation=json.loads((OLD/'generation.json').read_text())
    save(REPORT/'plan.json',{'kind':'renderer/checker regression replay, NOT model capability rerun',
        'source_experiment':str(OLD.relative_to(ROOT)),'models_called':0,'all_final_candidates':16,
        'source_policy':'Original author HTML/JS not edited or repaired; source hashes verified against frozen generation record',
        'max_workers':4,'samples_s':[1,4,8,11,14,17], 'new_helper_policy':'Helper exercised separately by hand-authored fixtures; legacy candidates do not use it',
        'historical_policy':'New diagnostic exports do not change v1 blind outcomes or previous failures'})
    save(REPORT/'tooling-hashes.json',{p.name:digest(p) for p in (REPORT/'tooling').iterdir()})
    def task(g):
        r=g['final'];ident=f"{g['case']}-{g['repeat']}-{g['arm']}";source=ROOT/r['source']
        for name,sha in r['source_sha256'].items():
            if digest(source/name)!=sha:raise ValueError('Original source changed')
        out=WORK/ident
        command=[NODE,str(ROOT/'tools/render_scene.mjs'),'--scene',str(source/'index.html'),'--out',str(out),
                 '--brief',str(ROOT/r['input_brief']),'--render-invalid','--samples','1,4,8,11,14,17','--author','unchanged v1 source']
        began=time.monotonic()
        process=subprocess.run(command,env=render_environment(),capture_output=True,text=True,timeout=60)
        (out/'replay.stdout.log').write_text(process.stdout);(out/'replay.stderr.log').write_text(process.stderr)
        manifest=json.loads((out/'manifest.json').read_text())
        for item in manifest['sources']:
            if item['path'] in r['source_sha256'] and item['sha256']!=r['source_sha256'][item['path']]:raise ValueError('Capture used changed source')
        checks=manifest.get('checks',{})
        result={'id':ident,'case':g['case'],'repeat':g['repeat'],'arm':g['arm'],
            'original_source':r['source'],'original_source_sha256':r['source_sha256'],'original_render_status':r['status'],
            'render_directory':str(out.relative_to(ROOT)),'render_status':manifest['status'],
            'wall_s':time.monotonic()-began,'exit_code':process.returncode,
            'video_exported':(out/'video.mp4').exists(),'full_decode':manifest.get('video',{}).get('full_decode_passed',False),
            'video_sha256':manifest.get('video',{}).get('sha256'),
            'actual_frames':manifest.get('video',{}).get('stream',{}).get('nb_frames'),
            'findings':checks.get('findings',[]),'mass_geometry_coverage':checks.get('mass_geometry'),
            'frames':[{'time_s':t,'path':str((out/f'frame-{t:.2f}.jpg').relative_to(ROOT)),'sha256':digest(out/f'frame-{t:.2f}.jpg')} for t in [1,4,8,11,14,17] if (out/f'frame-{t:.2f}.jpg').exists()],
            'review':{'kind':'technical regression','artistic_acceptance':'not_assigned','new_model_review':False},
            'revision_history':'Source unchanged; new capture/check tooling only'}
        save(REPORT/'candidates'/f'{ident}.json',result)
        print(ident,result['video_exported'],manifest['status'],flush=True)
        return result
    started=time.monotonic();results=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs=[pool.submit(task,g) for g in generation]
        for job in as_completed(jobs):
            results.append(job.result());save(REPORT/'results.json',results)
    summary={'candidates':len(results),'exported':sum(r['video_exported'] for r in results),
             'fully_decoded':sum(r['full_decode'] for r in results),
             'recovered_previous_export_failures':sum(r['video_exported'] and r['original_render_status']!='rendered' for r in results),
             'technical_pass':sum(r['render_status']=='render_passed' for r in results),
             'model_calls':0,'batch_wall_s':time.monotonic()-started,
             'limits':'Actual rerenders of previously generated source. No regenerated candidates, no new blind review, no claim of better animation quality.'}
    save(REPORT/'summary.json',summary);print(json.dumps(summary,ensure_ascii=False),flush=True)


if __name__=='__main__':main()

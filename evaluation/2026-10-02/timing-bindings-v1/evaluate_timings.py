"""Explicitly adapt one prior model candidate, then measure parameter-only edits."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.error
import urllib.request

from batch import save,load,digest,ROOT
from iterate import SAMPLES,mechanism_checks,revision_checks
from retime import retime


def request(origin,scene,out,checks=False,interval=(0,10)):
    payload={'sceneRoot':str(scene),'out':str(out),'arm':'infra','from':interval[0],'to':interval[1],
             'fps':24,'width':960,'times':SAMPLES,'checksOnly':checks,'timeoutS':20}
    req=urllib.request.Request(origin+'/preview',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:return json.load(response)
    except urllib.error.HTTPError as error:return json.load(error)


def evaluate(source,prior_preview,out):
    source,out=source.resolve(),out.resolve();out.mkdir(parents=True,exist_ok=False)
    runtime=out/'runtime';runtime.mkdir()
    shutil.copyfile(ROOT/'runtime/concept-runtime.mjs',runtime/'concept-runtime.mjs')
    save(out/'brief.json',load(source/'brief.json'))
    for name in ['studio.mjs','evaluate_timings.py','retime.py','iterate.py']:
        shutil.copyfile(ROOT/'tools'/name,out/name)
    original=(source/'scene.mjs').read_text()
    old='const C = { firstStart: 0.8, firstEnd: 2.8, secondStart: 5.2, secondEnd: 7.2 };'
    entry='export function createScene(rt) {'
    if original.count(old)!=1 or original.count(entry)!=1:raise ValueError('This recorded adapter applies to the first paired candidate only')
    adapter="""export function createScene(rt) {
  const T = rt.timings({
    'turn-one': { start: 0.8, end: 2.8 },
    'turn-two': { start: 5.2, end: 7.2 }
  });
  const C = { firstStart: T['turn-one'].start, firstEnd: T['turn-one'].end,
    secondStart: T['turn-two'].start, secondEnd: T['turn-two'].end };"""
    baseline=out/'baseline';baseline.mkdir()
    (baseline/'scene.mjs').write_text(original.replace(old,'').replace(entry,adapter))
    (baseline/'timing.json').write_text('{}\n')
    shutil.copyfile(source/'brief.json',baseline/'brief.json')
    save(out/'adapter.json',{'kind':'explicit_manual_source_adapter','from_sha256':digest(source/'scene.mjs'),
                           'to_sha256':digest(baseline/'scene.mjs'),'removed':old,'replaced_entry':entry,'replacement':adapter,
                           'new_model_generation':False,'setup_time_measured':False})
    process=subprocess.Popen(['node',str(ROOT/'tools/studio.mjs'),'--runtime',str(runtime)],stdout=subprocess.PIPE,stderr=(out/'studio-private.log').open('w'),text=True)
    ready=json.loads(process.stdout.readline());save(out/'studio.json',ready);origin=ready['origin']
    results={}
    try:
        first=request(origin,baseline,out/'preview-baseline');results['baseline']=first
        if first['status']!='preview_ready':raise RuntimeError(str(first.get('error')))
        initial_states=load(out/'preview-baseline/states.json');save(out/'math.json',mechanism_checks(initial_states['frames']+initial_states['samples']))
        old_samples={s['time_s']:s['sha256'] for s in load(prior_preview/'states.json')['samples']}
        same=all(old_samples[s['time_s']]==s['sha256'] for s in initial_states['samples'])
        if not same:raise RuntimeError('Source adapter changed baseline pixels')
        edited=out/'earlier';started=time.monotonic()
        edit=retime(baseline,first,'turn-two',-.35,edited)
        results['parameter_edit_s']=time.monotonic()-started;results['edit']=edit
        second=request(origin,edited,out/'preview-earlier',interval=(4,8));results['earlier']=second
        results['parameter_to_local_video_s']=time.monotonic()-started
        if second['status']!='preview_ready':raise RuntimeError(str(second.get('error')))
        revised_states=load(out/'preview-earlier/states.json')
        results['locality']=revision_checks(initial_states,revised_states)
        results['math_revised']=mechanism_checks(revised_states['frames']+revised_states['samples'],revised=True)
        results['baseline_pixels_preserved']=same
        # A deliberately invalid interval tests rollback, not model competence.
        invalid=out/'injected-invalid';invalid.mkdir()
        shutil.copyfile(edited/'scene.mjs',invalid/'scene.mjs')
        shutil.copyfile(edited/'brief.json',invalid/'brief.json')
        save(invalid/'timing.json',{'turn-two':{'start':8,'end':6.85}})
        started=time.monotonic();failure=request(origin,invalid,out/'preview-injected-invalid',checks=True)
        results['injected_failure']=failure
        if failure['status']!='failed':raise RuntimeError('Invalid interval was silently accepted')
        restored=out/'restored';restored.mkdir()
        for name in ['scene.mjs','brief.json','timing.json']:shutil.copyfile(edited/name,restored/name)
        restored_result=request(origin,restored,out/'preview-restored',checks=True)
        results['rollback']=restored_result;results['failure_to_restored_samples_s']=time.monotonic()-started
        if restored_result['status']!='samples_ready':raise RuntimeError(str(restored_result.get('error')))
        restored_states=load(out/'preview-restored/states.json')
        results['rollback_pixels_preserved']=[s['sha256'] for s in restored_states['samples']]==[s['sha256'] for s in revised_states['samples']]
        results['drawing_source_identical']=len({digest(p/'scene.mjs') for p in [baseline,edited,invalid,restored]})==1
        results['model_calls']=0;results['scope']='parameter-only retiming and deliberately injected invalid-interval rollback after one explicit source adaptation; no artistic improvement claim'
        results['passed']=all([results['locality']['passed'],results['math_revised']['passed'],results['rollback_pixels_preserved'],results['drawing_source_identical']])
    except Exception as error:
        results['passed']=False;results['error']=str(error)
    finally:
        save(out/'results.json',results);process.terminate();process.wait(timeout=10)
    return results


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene',type=Path,required=True);parser.add_argument('--prior-preview',type=Path,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();result=evaluate(args.scene,args.prior_preview,args.out)
    print(json.dumps({k:result.get(k) for k in ['passed','model_calls','parameter_to_local_video_s','failure_to_restored_samples_s','error']}))
    raise SystemExit(0 if result['passed'] else 1)

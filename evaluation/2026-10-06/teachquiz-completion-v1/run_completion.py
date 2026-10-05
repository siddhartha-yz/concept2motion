"""Four separately recorded calls, then offline composition of fixed TeachQuiz rows."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
from batch import digest
from bounded_calls import dispatch
from reference_calls_v2 import invoke
from code2video_metrics import teachquiz
from replay_code2video_metrics import native_definitions
from dataclasses import asdict

OUT=Path(__file__).resolve().parent
OLD=ROOT/'evaluation/2026-10-05/teachquiz-codex-port-v1'
SHARED=ROOT/'evaluation/2026-10-04/full-reproduction-v1'

def read(path):return json.loads(path.read_text())
def save(name,value):
    with (OUT/name).open('x') as f:f.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')

def verify_old():
    for item in read(OLD/'frozen.json'):assert digest(OLD/item['path'])==item['sha256']
    for item in read(OLD/'input-manifest.json'):assert digest(ROOT/item['path'])==item['sha256']
    for item in read(OLD/'results-frozen-v1.json'):assert digest(OLD/item['path'])==item['sha256']

def prepare():
    verify_old()
    jobs=read(OLD/'jobs.json');selected=[]
    for job in jobs:
        old=OLD/(job['id']+'.json')
        if old.exists() and read(old)['status']=='completed':continue
        assert job['stage']=='post_video'
        selected.append({**job,'old_id':job['id'],'id':job['id'].removesuffix('-v1')+'-completion-v1'})
    assert len(selected)==4
    save('jobs.json',selected)
    save('usage-availability.json',{'date':'2026-10-06','read_only_check':True,'ordinary_usage_allowed':True,
         'primary_used_percent':2,'secondary_used_percent':72,'account_identifiers_saved':False,
         'credits_purchased_or_reset_used':False})
    save('frozen.json',[{'path':f.name,'sha256':digest(f)} for f in sorted(OUT.iterdir()) if f.is_file()])

def run():
    verify_old()
    for item in read(OUT/'frozen.json'):assert digest(OUT/item['path'])==item['sha256']
    jobs=read(OUT/'jobs.json')
    def execute(job):
        result=invoke(job['id'],job['prompt'],job['schema'],job['model'],[ROOT/p for p in job['images']])
        save(job['id']+'.json',result);print(job['id'],result['status'],flush=True)
        return {'id':job['id'],'status':result['status']}
    gate=dispatch(jobs,execute,budget=4,workers=1,failure_limit=3);save('dispatch.json',gate)
    stages={name:[] for name in ['baseline','post_unlearning','post_video']};provenance=[];by_original={}
    new_by_old={j['old_id']:j for j in jobs}
    for job in read(OLD/'jobs.json'):
        old=OLD/(job['id']+'.json')
        path=old if old.exists() and read(old)['status']=='completed' else None
        if path is None:
            new=new_by_old[job['id']];new_path=OUT/(new['id']+'.json')
            if new_path.exists():path=new_path
        result=read(path) if path else None
        response=result.get('response',{}).get('response_text') if result else None
        if result:stages[job['stage']].append({'id':job['question_id'],'status':'completed' if result['status']=='completed' else 'call_failed','response':response})
        provenance.append({'stage':job['stage'],'question_id':job['question_id'],'selected_response':str(path.relative_to(ROOT)) if path else None,
                           'status':result['status'] if result else 'unstarted'})
        by_original[job['original_prompt']]=response if result and result['status']=='completed' else ''
    strict=teachquiz(read(OLD/'questions.json'),stages)
    native=native_definitions(ROOT/'work/code2video-reproduction/upstream')[0]['src/eval_TQ.py']
    concept='Linear transformations and matrices'
    questions=native['load_questions_from_json'](str(ROOT/'work/code2video-reproduction/upstream/json_files/questions_by_topic_10.json'))[concept]
    worker=native['SelectiveKnowledgeUnlearning'](lambda prompt:by_original[prompt],per_question_workers=1)
    replay=worker.evaluate_educational_video(concept,questions,lambda prompt:by_original[prompt])
    save('composite-results.json',{'selected_valid_responses':sum(p['status']=='completed' for p in provenance),
         'expected_responses':15,'old_attempts':14,'new_attempts':gate['attempts'],'total_attempts':14+gate['attempts'],
         'source_rows':provenance,'strict':strict,'native_cached_replay':asdict(replay),
         'native_cached_replay_additional_calls':0,'same_batch':False,'unlearning_is_weight_update':False,'human_learning_evaluation':False})
    ledger=read(SHARED/'new-call-ledger.json');counts={}
    for row in ledger['attempts']:counts[row['status']]=counts.get(row['status'],0)+1
    save('accounting.json',{'shared_budget':96,'shared_attempts':len(ledger['attempts']),'by_status':counts,'remaining':96-len(ledger['attempts'])})

if __name__=='__main__':globals()[sys.argv[1]]()

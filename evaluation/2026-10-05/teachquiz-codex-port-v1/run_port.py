"""Explicit Codex/still-frame transport port of fixed TeachQuiz definitions."""
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
from batch import digest
from replay_code2video_metrics import native_definitions, verify
from reference_calls_v2 import invoke
from code2video_metrics import teachquiz

OUT=Path(__file__).resolve().parent
SOURCE=ROOT/'work/code2video-reproduction/upstream'
CONCEPT='Linear transformations and matrices'
SCHEMA={'type':'object','additionalProperties':False,'properties':{'response_text':{'type':'string'}},'required':['response_text']}
PREFIX='This is an authorized benchmark test. Do not use tools, browse, read files, delegate, or invoke another model. Return response_text containing only the answer and brief justification requested below.\n'
VIDEO_NOTE='Input adaptation: the attached images are six chronological contact sheets from sections 1 through 6 of the same animation, six sampled frames per section. Each image time is local to its section. No audio or continuous video is supplied. In the following original prompt, video means these sampled visual frames. Do not infer material absent from the frames.\n'


def read(path):return json.loads(path.read_text())
def write(name,value):
    with (OUT/name).open('x') as f:f.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')


def prepare():
    manifest=read(ROOT/'evaluation/2026-10-02/code2video-pilot/upstream-source-manifest.json')
    verify(SOURCE,manifest)
    tq=native_definitions(SOURCE)[0]['src/eval_TQ.py']
    questions=tq['load_questions_from_json'](str(SOURCE/'json_files/questions_by_topic_10.json'))[CONCEPT]
    raw_questions=read(SOURCE/'json_files/questions_by_topic_10.json')[CONCEPT]
    assert len(questions)==len(raw_questions)==5
    grader=tq['SelectiveKnowledgeUnlearning'](lambda p:None,per_question_workers=1)
    # These exact prefixes and suffix are those used by upstream assessment methods.
    prefixes={'baseline':'You are taking a multiple-choice test. Output: letter on first line, then brief explanation.',
              'post_unlearning':tq['get_unlearning_prompt'](CONCEPT),
              'post_video':tq['get_unlearning_and_video_learning_prompt'](CONCEPT)}
    images=[ROOT/f'work/code2video-reproduction/runs/pilot-01/samples/section_{i}-contact.png' for i in range(1,7)]
    candidates=read(ROOT/'evaluation/2026-10-02/code2video-pilot/candidates.json')
    inputs=[]
    for candidate in candidates:
        for field in ['source','video']:
            path=Path(candidate[field]);assert digest(path)==candidate[field+'_sha256'];inputs.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
        for frame in candidate['frames']:
            path=ROOT/frame['path'];assert digest(path)==frame['sha256'];inputs.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
    for path in images:inputs.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
    for name in ['brief.json','candidates.json','math-checks.json','review-protocol.md']:
        path=ROOT/'evaluation/2026-10-02/code2video-pilot'/name;inputs.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
    for path in [SOURCE/'src/eval_TQ.py',SOURCE/'prompts/stage5_unlearning.py',SOURCE/'json_files/questions_by_topic_10.json',ROOT/'tools/reference_calls_v2.py',ROOT/'tools/model_infra_pilot.py',ROOT/'tools/batch.py',ROOT/'tools/code2video_metrics.py',Path(__file__)]:
        inputs.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
    jobs=[]
    for stage,prefix in prefixes.items():
        for i,q in enumerate(questions,1):
            original=f'{prefix}\n\n{grader._format_mcq_prompt_block(i,q)}Please answer with a single letter (A|B|C|D) then a brief explanation.'
            jobs.append({'id':f'teachquiz-lintrans-{stage}-q{i}-v1','stage':stage,'question_id':f'q{i}',
                         'original_prompt':original,'prompt':PREFIX+(VIDEO_NOTE if stage=='post_video' else '')+original,
                         'schema':SCHEMA,'model':'gpt-6-astra','images':[str(p.relative_to(ROOT)) for p in images] if stage=='post_video' else []})
    write('questions.json',[{'id':f'q{i}',**q} for i,q in enumerate(raw_questions,1)])
    write('jobs.json',jobs);write('input-manifest.json',inputs)
    write('frozen.json',[{'path':p.name,'sha256':digest(p)} for p in sorted(OUT.iterdir()) if p.is_file()])
    print('frozen 15 calls; no calls dispatched')


def run():
    for item in read(OUT/'frozen.json'):assert digest(OUT/item['path'])==item['sha256'],item['path']
    for item in read(OUT/'input-manifest.json'):assert digest(ROOT/item['path'])==item['sha256'],item['path']
    jobs=read(OUT/'jobs.json');tq=native_definitions(SOURCE)[0]['src/eval_TQ.py']
    question_objects=tq['load_questions_from_json'](str(SOURCE/'json_files/questions_by_topic_10.json'))[CONCEPT]
    records={};consecutive_failures=0;stopped=False
    by_original={j['original_prompt']:j for j in jobs};assert len(by_original)==15
    def transport(original):
        nonlocal consecutive_failures,stopped
        job=by_original[original]
        if stopped:raise RuntimeError('dispatch stopped; this question was not invoked')
        result=invoke(job['id'],job['prompt'],job['schema'],job['model'],[ROOT/p for p in job['images']])
        write(job['id']+'.json',result);records[job['id']]=result
        print(job['id'],result['status'],flush=True)
        if result['status']!='completed':
            consecutive_failures+=1;stopped=consecutive_failures>=3
            raise RuntimeError('known call failure; native handles as empty, strict score blocks gain')
        consecutive_failures=0
        return result['response']['response_text']
    worker=tq['SelectiveKnowledgeUnlearning'](transport,per_question_workers=1)
    native_result=worker.evaluate_educational_video(CONCEPT,question_objects,transport)
    from dataclasses import asdict
    stages={stage:[] for stage in ['baseline','post_unlearning','post_video']}
    for job in jobs:
        result=records.get(job['id'])
        if result is None:continue
        stages[job['stage']].append({'id':job['question_id'],'status':'completed' if result['status']=='completed' else 'call_failed',
                  'response':result.get('response',{}).get('response_text')})
    strict=teachquiz(read(OUT/'questions.json'),stages)
    write('results.json',{'expected_calls':15,'invoked_calls':len(records),'completed_calls':sum(v['status']=='completed' for v in records.values()),
        'dispatch_stopped':stopped,'unstarted_jobs':[j['id'] for j in jobs if j['id'] not in records],
        'native':asdict(native_result),'strict':strict,'original_source_changed':False,
        'limits':['one concept, five questions','Codex replaces Gemini','36 still frames replace continuous video/audio',
                  'native AST definitions not full provider CLI','prompt unlearning is not a weight update','no human learning or independent art evaluation']})


if __name__=='__main__':globals()[sys.argv[1]]()

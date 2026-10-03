"""Narrow frozen reveal pilot, equal one-revision B/C budgets, pair-only judges."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import copy
import json
import math
from pathlib import Path
import shutil
import time

from batch import digest, save
import model_infra_pilot as p
import model_infra_pilot_v2 as v2
from report_model_infra_pilot import stable_comparison

REPORT=p.ROOT/'evaluation/2026-10-03/model-infra-pilot-v3'
WORK=p.ROOT/'work/model-infra-pilot-v3'
CASES=copy.deepcopy(p.CASES)
CASES[0]['inputs']={'logits':[-1,.7,1.3]}
CASES[1]['inputs']={'x':[.7,-.4,.2],'residual':[-.2,.15,-.3]}
TOOL_FILES=[f for f in v2.TOOL_FILES if f!='tools/model_infra_pilot_v2.py']+[
 'tools/model_infra_pilot_v3.py','runtime/math-timeline.mjs']


def configure():
    p.REPORT,p.WORK,p.CASES=REPORT,WORK,CASES
    p.SUPPORT_FILES={name:REPORT/'tooling/runtime'/name for name in ('math-frame.mjs','math-timeline.mjs')}
    p.common_prompt=common_prompt
    p.verify=verify
    v2.REPORT=REPORT


def verify(current=True):
    for item in p.read(REPORT/'frozen.json'):
        if digest(REPORT/item['path'])!=item['sha256']:raise ValueError(f"Frozen v3 artifact changed: {item['path']}")
        if current and item.get('current_source') and digest(p.ROOT/item['current_source'])!=item['sha256']:
            raise ValueError(f"Tool changed after v3 freeze: {item['current_source']}")


def common_prompt(case):return (REPORT/f"prompts/{case['id']}.txt").read_text()


def prepare():
    if REPORT.exists() or WORK.exists():raise ValueError('Never overwrite an experiment')
    REPORT.mkdir(parents=True);WORK.mkdir(parents=True)
    for relative in TOOL_FILES:
        target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(p.ROOT/relative,target)
    for relative in ('docs/math-evidence.md','docs/scene-protocol.md','docs/decisions/2026-10-03-progress-pilot.md'):
        target=REPORT/'design'/Path(relative).name;target.parent.mkdir(exist_ok=True)
        shutil.copyfile(p.ROOT/relative,target)
    protocol=(p.ROOT/'docs/scene-protocol.md').read_text().split('## Run a candidate')[0]
    api=(p.ROOT/'docs/math-evidence.md').read_text().split('The narrow overlap contract')[0]
    # The adapter and timeline are installed identically for every arm. Source need not be returned.
    for case in CASES:
        prompt=f'''Authorized original mathematical animation benchmark. Return ONLY structured html/javascript/storyboard.
Do not use tools, browse, read files, delegate or invoke models. All material is supplied here.
Chinese-speaking newcomer, silent Canvas2D explanation, 854x480, 15fps, exactly 18 seconds.
Use a dark background, concise readable captions, stable class/role identities and geometric actions.
Make the question, objects and causal mechanism identifiable. Formulas alone are insufficient.
Soft budgets: JavaScript <=9000 characters, HTML <=1000, storyboard <=1500.
Expose canvas#scene, module scene.js, deterministic window.C2M version 1, caseId={case['id']}.
Redraw the complete frame at render(t); no accumulated state, no playback in ?export=1.
Two immutable local modules math-frame.mjs and math-timeline.mjs are preinstalled for all methods.
Import createMathFrame and createMathTimeline from them; do not redefine/edit/return their source.
Author the timeline yourself. Put stageTimeline: timeline.meta in C2M.meta.
Return f.finish() per frame. Draw required semantic shapes with the adapter, not raw Canvas.
For reveal, pass FULL target width/value and a separate reveal in 0..1. Do not scale the target itself.
Use f.values for mathematical targets. Use measured text rectangles to keep labels away from shapes.
Use phase opacity layers to remove obsolete captions; never draw the same kind/ID twice in a frame.
Residual roles are identity/correction/output. Identity and correction must stay identifiable at final merge.
Do not claim learned weights. Choose composition, captions, colors and interval timing yourself.
Brief:\n{json.dumps(case,ensure_ascii=False)}
Common protocol:\n{protocol}
Common drawing/progress API:\n{api}
'''
        target=REPORT/f"prompts/{case['id']}.txt";target.parent.mkdir(exist_ok=True);target.write_text(prompt)
        save(WORK/f"brief-{case['id']}.json",case)
    save(REPORT/'cases.json',CASES);save(REPORT/'author-schema.json',p.AUTHOR_SCHEMA);save(REPORT/'judge-schema.json',p.JUDGE_SCHEMA)
    screening=p.ROOT/'evaluation/2026-10-03/model-infra-pilot-v2/calibration.json'
    if not p.read(screening)['screening_pass']:raise ValueError('Previous screening not matched')
    shutil.copyfile(screening,REPORT/'prior-screening.json')
    save(REPORT/'experiment.json',{'version':3,'weak':p.WEAK,'strong':p.STRONG,'reasoning':'low; no tools or agents',
      'cases':2,'repeats':2,'final_candidates':16,'unique_author_calls':16,'review_calls':8,'max_external_calls':24,
      'primary_comparison':'C vs B, both anonymous attachment orders',
      'budgets':{'A':1,'B':2,'C':2,'D':1},'selection':'Fixed last version; no manual fixes, best-of or fallback',
      'feedback':'Same initial source, frames and execution errors; only C sees deterministic findings',
      'support':'Identical frozen frame and timeline modules, omitted from prior source text for BOTH B/C',
      'judge_scope':'B/C only; A/D technical references, not quality rankings; reuse old screening with no new reliability claim',
      'samples_s':p.TIMES,'model_timeout_s':240,'render_timeout_s':120,'max_workers':4,
      'cost_scope':'Call/effort/soft source limits equal B/C; tokens measured separately; shared initial charged once actual',
      'stop':'No later batch after unknown model result; no recovery calls',
      'authorization':'prepare does not invoke models; separate explicit authorization required before external calls',
      'limits':'Two familiar task families, exploratory n=4 paired weak initials; no significance, broad generalization or human learning claim'})
    frozen=[]
    for file in sorted(REPORT.rglob('*')):
        if file.is_file():
            item={'path':str(file.relative_to(REPORT)),'sha256':digest(file)}
            if file.is_relative_to(REPORT/'tooling'):item['current_source']=str(file.relative_to(REPORT/'tooling'))
            frozen.append(item)
    save(REPORT/'frozen.json',frozen);save(REPORT/'progress.json',{'phase':'prepared','model_calls':0})
    print('v3 frozen locally: 16 author + 8 pair-only review calls planned, none invoked',flush=True)


def prior_material(record):
    if record.get('source'):
        directory=p.ROOT/record['source']
        for name,sha in record['source_sha256'].items():
            if digest(directory/name)!=sha:raise ValueError('Prior candidate source changed before revision')
    source,images,manifest=p.prior_material(record)
    return {name:content for name,content in source.items() if name not in p.SUPPORT_FILES},images,manifest


def generate():
    verify();started=time.monotonic();finals={}
    def add(record):
        key=(record['case'],record['repeat'],record['arm'])
        initial=finals[(record['case'],record['repeat'],'A')]['final'] if record['arm'] in ('B','C') else None
        finals[key]={'case':record['case'],'repeat':record['repeat'],'arm':record['arm'],
                     'attempts':([initial] if initial else [])+[record],'final':record}
        save(REPORT/'generation.partial.json',list(finals.values()))
    # A first batch serves as the planned availability check, no separate request.
    for arm in ('A','D'):
        v2.run_batch([(p.create_attempt,(case,r,arm,1,common_prompt(case))) for case in CASES for r in (1,2)],add,'initial')
    jobs=[]
    for case in CASES:
        for r in (1,2):
            prior=finals[(case['id'],r,'A')]['final'];source,images,manifest=prior_material(prior)
            for arm in ('B','C'):
                instruction='Use deterministic findings to target defects and keep the explanation clear.' if arm=='C' else 'Inspect the source and frames yourself, correct defects and improve the explanation.'
                prompt=common_prompt(case)+f'\nFixed final revision 2/2. {instruction}\nPrior authored source:\n'+json.dumps(source,ensure_ascii=False)+'\nPrior execution evidence:\n'+json.dumps(p.feedback(manifest,arm=='C'),ensure_ascii=False)+'\nAttached samples at seconds '+json.dumps(p.TIMES)+'. Return a complete replacement, not a patch.'
                jobs.append((p.create_attempt,(case,r,arm,2,prompt,images)))
    for offset in range(0,len(jobs),4):v2.run_batch(jobs[offset:offset+4],add,'revision')
    save(REPORT/'generation.json',list(finals.values()));save(REPORT/'generation-timing.json',{'batch_wall_s':time.monotonic()-started,'scope':'author requests and actual renders; includes resume orchestration if resumed'})
    save(REPORT/'progress.json',{'phase':'generation_completed'})


def sheets():
    p.sheets()  # Freeze ALL finals, including failed exports, before selecting preplanned B/C panels.
    all_panels=p.read(REPORT/'panels.json')
    save(REPORT/'all-arm-panels.json',all_panels)
    pairs=[{**pa,'items':[i for i in pa['items'] if i['arm'] in ('B','C')]} for pa in all_panels]
    save(REPORT/'pair-panels.json',pairs)


def validate_pair(response,ids):
    videos=response.get('videos',[])
    if len(videos)!=2 or {v['id'] for v in videos}!=set(ids):raise ValueError('Two distinct candidate decisions required')
    for video in videos:
        if len(video['checks'])!=4 or {c['criterion'] for c in video['checks']}!={0,1,2,3}:raise ValueError('Four criteria required per candidate')
        for check in video['checks']:
            t=check['time_s']
            if type(t) not in (int,float) or not math.isfinite(t) or t not in p.TIMES or not check['evidence'].strip():raise ValueError('Exact timestamp and visible evidence required')
    pairs=response.get('comparisons',[])
    if len(pairs)!=1 or {pairs[0]['left'],pairs[0]['right']}!=set(ids) or pairs[0]['winner'] not in (*ids,'tie','uncertain') or not pairs[0]['reason'].strip():raise ValueError('One valid pairwise decision required')


def judge():
    verify();panels=p.read(REPORT/'pair-panels.json');records=[]
    if len(p.read(REPORT/'generation.json'))!=16 or len(panels)!=4:raise ValueError('All finals must precede review')
    def task(job):
        panel,order=job;items=panel['items'] if order==1 else list(reversed(panel['items']))
        case=next(c for c in CASES if c['id']==panel['case']);images=[p.ROOT/i['contact'] for i in items]
        for item,image in zip(items,images):
            if digest(image)!=item['sha256']:raise ValueError('Frozen panel changed')
        prompt=f'''Authorized blind visual assessment. No tools, browsing, source access or delegation.
Two anonymous contact sheets explain the same task. You do not know their models, methods, checks or revision counts.
Question: {case['question']}
Audience: Chinese newcomer. Assess only supplied frames, not unseen motion or actual human learning.
For each ID reconstruct its message and assess all criteria 0..3 as demonstrated/missing/contradicted/uncertain.
Every decision requires an exact supplied time and concrete visible evidence. Correct labels/formulas alone are insufficient; identify the supporting geometric relation. No frame means missing evidence, not invented content.
Criteria: {json.dumps(dict(enumerate(case['visual_checks'])),ensure_ascii=False)}
Compare the single pair for causal mechanism clarity, component identity, contradictions and readability. Winner must be an ID, tie or uncertain. Do not reward decoration or more text. No beauty score.
Supplied times {p.TIMES}; attachment order {[i['id'] for i in items]}. State limitations.
'''
        call=p.invoke(WORK/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}",prompt,p.JUDGE_SCHEMA,p.STRONG,images)
        record={'case':panel['case'],'repeat':panel['repeat'],'order':order,'call':call,'status':'unknown'}
        if call['status']=='completed':
            try:validate_pair(call['response'],[i['id'] for i in items]);record['status']='reviewed'
            except ValueError as exc:record['error']=str(exc)
        save(REPORT/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}.json",record);return record
    jobs=[(pa,o) for pa in panels for o in (1,2)]
    for offset in range(0,len(jobs),4):
        with ThreadPoolExecutor(max_workers=4) as pool:batch=list(pool.map(task,jobs[offset:offset+4]))
        records.extend(batch);save(REPORT/'judgements.json',records)
        if any(r['status']!='reviewed' for r in batch):v2.stop('final_review','Review failed; no later calls submitted')
    save(REPORT/'progress.json',{'phase':'final_review_completed'})


def report():
    verify(current=False)
    generation=p.read(REPORT/'generation.json') if (REPORT/'generation.json').exists() else p.read(REPORT/'generation.partial.json') if (REPORT/'generation.partial.json').exists() else []
    judges=p.read(REPORT/'judgements.json') if (REPORT/'judgements.json').exists() else []
    panels=p.read(REPORT/'pair-panels.json') if (REPORT/'pair-panels.json').exists() else []
    calls=[{'path':str(file.relative_to(p.ROOT)),**{k:v for k,v in p.read(file).items() if k!='response'}} for file in sorted(WORK.rglob('safe.json'))]
    cost={'attempted':len(calls),'completed':sum(c['status']=='completed' for c in calls),'input_tokens':sum(u['input_tokens'] for c in calls for u in c.get('process',{}).get('usage',[])),'output_tokens':sum(u['output_tokens'] for c in calls for u in c.get('process',{}).get('usage',[]))}
    comparisons=[]
    for panel in panels:
        mapping={i['id']:i['arm'] for i in panel['items']};answers=[]
        for order in (1,2):
            j=next((j for j in judges if (j['case'],j['repeat'],j['order'])==(panel['case'],panel['repeat'],order)),None)
            answer={'order':order,'winner':'unknown'}
            if j and j['status']=='reviewed':
                q=j['call']['response']['comparisons'][0];answer.update(winner=mapping.get(q['winner'],q['winner']),reason=q['reason'])
            answers.append(answer)
        comparisons.append({'case':panel['case'],'repeat':panel['repeat'],'both_orders':answers,'stable_winner':stable_comparison(answers,all(i['rendered_video'] for i in panel['items']))})
    counts={k:sum(c['stable_winner']==k for c in comparisons) for k in ('C','B','tie','uncertain','unresolved','not_comparable')}
    technical={arm:{'finals':sum(g['arm']==arm for g in generation),'exports':sum(g['arm']==arm and g['final']['status']=='rendered' for g in generation),'technical_pass':sum(g['arm']==arm and g['final'].get('technical_pass',False) for g in generation)} for arm in p.ARMS}
    for g in generation:
        for attempt in g['attempts']:
            if attempt.get('source'):
                dest=REPORT/'candidate-sources'/f"{attempt['case']}-{attempt['repeat']}-{attempt['arm']}-v{attempt['version']}"
                if not dest.exists():shutil.copytree(p.ROOT/attempt['source'],dest)
                for name,sha in attempt['source_sha256'].items():
                    if digest(dest/name)!=sha:raise ValueError('Candidate archive changed')
    summary={'generation_complete':(REPORT/'generation.json').exists(),'primary_C_vs_B':counts,'comparisons':comparisons,'technical':technical,'cost':cost,'candidates':generation,'review_completed':sum(j['status']=='reviewed' for j in judges),'review_planned':8,'artistic_acceptance':'not_assigned'}
    save(REPORT/'actual-calls.json',calls);save(REPORT/'summary.json',summary)
    lines=['# 显式进度接口的配对试验 · v3','',f"生成完整：{summary['generation_complete']}。实际请求 {cost['attempted']}，完成 {cost['completed']}；输入 tokens {cost['input_tokens']}，输出 {cost['output_tokens']}。审查 {summary['review_completed']}/8。",'', '| 组 | 已执行最终候选 | 导出 | 技术通过 |','|---|---:|---:|---:|']
    for arm,t in technical.items():lines.append(f"| {arm} | {t['finals']} | {t['exports']} | {t['technical_pass']} |")
    lines.extend(['','| C 对 B，两种顺序保持一致 | 数量 / 4 |','|---|---:|'])
    for k,label in [('C','C 更好'),('B','B 更好'),('tie','平局'),('uncertain','两次均不确定'),('unresolved','缺审查或顺序不一致'),('not_comparable','缺视频')]:lines.append(f'| {label} | {counts[k]} |')
    lines.extend(['','未执行计划不计成功。完整生成与四个配对未完成前，没有完整比较结论。','',
      'B/C 共用 A 初稿，各固定修订一次；相同接口、来源、抽帧和执行错误，仅 C 收到确定性检查。固定最终版本，无人工修改/挑选/回退。A/D 只有技术参考，此轮不做它们的画面排名。','',
      '裁判仅见匿名 B/C 静帧与问题，交换附件顺序。两个熟悉任务、四份初稿，探索性结果；不是总体能力、艺术接受、人类理解或完整运动评价。旧四项裁判筛查只作基础筛查，不是新可靠性证明。','',
      '验证分类：复用安装；模拟/单元检查单列；实际生成、渲染、数学检查逐版保存；模型静帧审查与技术检查分别记录。所有原始调用、视频与抽帧在 ignored work/。所有模型故障保留并计成本。','',
      '[冻结设计](experiment.json) · [源码/工具哈希](frozen.json) · [完整结果](summary.json) · [实际调用](actual-calls.json)'])
    (REPORT/'REPORT.md').write_text('\n'.join(lines)+'\n');print(json.dumps(summary['primary_C_vs_B']),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','generate','sheets','judge','report'])
    args=parser.parse_args();configure();v2.REPORT=REPORT
    globals()[args.phase]()

if __name__=='__main__':main()

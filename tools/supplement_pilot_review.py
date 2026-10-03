"""Explicit, separately costed review supplement for failed v2 final panels."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from itertools import combinations
import json
from pathlib import Path
import shutil

from batch import digest, save
import model_infra_pilot as p
from report_model_infra_pilot import stable_comparison

BASE=p.ROOT/'evaluation/2026-10-03/model-infra-pilot-v2'
REPORT=p.ROOT/'evaluation/2026-10-03/v2-review-supplement-v1'
WORK=p.ROOT/'work/v2-review-supplement-v1'


def prompt(case,items,times):
    return f'''Authorized final blind visual assessment. Do not use tools, browse, read source or delegate.
Four contact sheets are four independent explanations of the same task, identified ONLY by W/X/Y/Z. You do not know their model, method or revision count.
Task question: {case['question']}
Audience: Chinese-speaking newcomer. Judge only the attached sampled frames; do not infer unseen motion or actual human learning.
For each ID, reconstruct what the pictures explain. For each criterion below (0..3), report demonstrated/missing/contradicted/uncertain with an exact supplied time and concrete visible evidence.
'Demonstrated' requires a visible geometric relation supporting the words. A correct formula or prior mathematical knowledge alone is insufficient. No frame means missing evidence, not invented content.
Criteria: {json.dumps(dict(enumerate(case['visual_checks'])), ensure_ascii=False)}
Then compare ALL SIX unordered pairs. Prefer the candidate that makes the task's causal mechanism more identifiable and visually supported, considering contradictions, missing steps, component identity and readability. Return winner ID, 'tie' or 'uncertain', with concrete reasons. Do not prefer decoration, extra text or more claims without supporting geometry. No numerical beauty score.
Supplied times: {times}. Attachment order: {[i['id'] for i in items]}. State sample limitations.
'''


def prepare():
    if REPORT.exists() or WORK.exists():raise ValueError('Supplement must be a new version')
    original=p.read(BASE/'judgements.json');panels=p.read(BASE/'panels.json');cases=p.read(BASE/'cases.json')
    failed=[j for j in original if j['status']!='reviewed']
    if not failed:raise ValueError('No missing reviews to supplement')
    REPORT.mkdir(parents=True);WORK.mkdir(parents=True)
    jobs=[]
    for j in failed:
        panel=next(pa for pa in panels if pa['case']==j['case'] and pa['repeat']==j['repeat'])
        items=panel['items'] if j['order']==1 else list(reversed(panel['items']))
        case=next(c for c in cases if c['id']==j['case'])
        for item in items:
            if digest(p.ROOT/item['contact'])!=item['sha256']:raise ValueError('Original panel changed')
        ident=f"{j['case']}-{j['repeat']}-o{j['order']}"
        (REPORT/f'{ident}.txt').write_text(prompt(case,items,p.TIMES))
        jobs.append({'id':ident,'case':j['case'],'repeat':j['repeat'],'order':j['order'],'items':items,'prompt':f'{ident}.txt'})
    save(REPORT/'plan.json',{'kind':'separate review supplement, original failed calls retained',
         'selection':'All and only original reviews whose status was not reviewed; never select by quality verdict',
         'base':str(BASE),'base_judgements_sha256':digest(BASE/'judgements.json'),
         'base_panels_sha256':digest(BASE/'panels.json'),'model':p.STRONG,'jobs':jobs,
         'author_calls':0,'max_review_calls':len(jobs),'screening':'Reuse v2 four matched controlled screenings; no new screening claim',
         'stop_policy':'First planned review checks availability; stop on failed batch without hidden recovery'})
    shutil.copyfile(BASE/'judge-schema.json',REPORT/'schema.json')
    for relative in ['tools/supplement_pilot_review.py','tools/model_infra_pilot.py','tools/batch.py','tools/code2video_pilot.py','tools/report_model_infra_pilot.py']:
        target=REPORT/'tooling'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p.ROOT/relative,target)
    save(REPORT/'frozen.json',[{'path':str(f.relative_to(REPORT)),'sha256':digest(f)} for f in REPORT.rglob('*') if f.is_file()])
    print(f'Frozen {len(jobs)} supplemental review requests',flush=True)


def run():
    for item in p.read(REPORT/'frozen.json'):
        if digest(REPORT/item['path'])!=item['sha256']:raise ValueError('Supplement changed after freeze')
    plan=p.read(REPORT/'plan.json');schema=p.read(REPORT/'schema.json');records=[]
    def call(job):
        images=[p.ROOT/i['contact'] for i in job['items']]
        for item,image in zip(job['items'],images):
            if digest(image)!=item['sha256']:raise ValueError('Frozen image changed')
        response=p.invoke(WORK/job['id'],(REPORT/job['prompt']).read_text(),schema,plan['model'],images)
        result={k:job[k] for k in ('id','case','repeat','order')};result.update(call=response,status='unknown')
        if response['status']=='completed':
            try:p.validate_judge(response['response'],[i['id'] for i in job['items']]);result['status']='reviewed'
            except ValueError as exc:result['error']=str(exc)
        save(REPORT/'reviews'/f"{job['id']}.json",result);print(job['id'],result['status'],flush=True);return result
    batches=[plan['jobs'][:1],plan['jobs'][1:]]
    for jobs in batches:
        with ThreadPoolExecutor(max_workers=4) as pool:batch=list(pool.map(call,jobs))
        records.extend(batch);save(REPORT/'reviews.json',records)
        if any(j['status']!='reviewed' for j in batch):raise RuntimeError('Supplement service failed; no later calls submitted')


def report():
    plan=p.read(REPORT/'plan.json')
    if digest(BASE/'judgements.json')!=plan['base_judgements_sha256'] or digest(BASE/'panels.json')!=plan['base_panels_sha256']:
        raise ValueError('Original experiment changed')
    reviews=p.read(REPORT/'reviews.json') if (REPORT/'reviews.json').exists() else []
    original=p.read(BASE/'judgements.json');panels=p.read(BASE/'panels.json');combined=[]
    for j in original:
        extra=next((e for e in reviews if (e['case'],e['repeat'],e['order'])==(j['case'],j['repeat'],j['order'])),None)
        combined.append({**(extra if extra and extra['status']=='reviewed' else j),
                         'provenance':'supplement' if extra and extra['status']=='reviewed' else 'original',
                         'original_status':j['status']})
    comparisons=[]
    for panel in panels:
        mapping={i['id']:i['arm'] for i in panel['items']};available={i['arm']:i['rendered_video'] for i in panel['items']}
        for a,b in combinations(p.ARMS,2):
            answers=[]
            for j in combined:
                if (j['case'],j['repeat'])!=(panel['case'],panel['repeat']):continue
                answer={'order':j['order'],'winner':'unknown','provenance':j['provenance']}
                if j['status']=='reviewed':
                    pair=next(q for q in j['call']['response']['comparisons'] if {mapping[q['left']],mapping[q['right']]}=={a,b})
                    answer.update(winner=mapping.get(pair['winner'],pair['winner']),reason=pair['reason'])
                answers.append(answer)
            comparisons.append({'case':panel['case'],'repeat':panel['repeat'],'left_arm':a,'right_arm':b,
              'answers':answers,'stable_winner':stable_comparison(answers,available[a] and available[b])})
    primary=[c for c in comparisons if {c['left_arm'],c['right_arm']}=={'B','C'}]
    cost={'attempted':len(reviews),'completed':sum(j['status']=='reviewed' for j in reviews),
          'input_tokens':sum(u['input_tokens'] for j in reviews for u in j['call'].get('process',{}).get('usage',[])),
          'output_tokens':sum(u['output_tokens'] for j in reviews for u in j['call'].get('process',{}).get('usage',[]))}
    counts={k:sum(c['stable_winner']==k for c in primary) for k in ('C','B','tie','uncertain','unresolved','not_comparable')}
    save(REPORT/'summary.json',{'cost':cost,'primary_C_vs_B':counts,'comparisons':comparisons,'merged_reviews':combined,
         'original_failures_retained':sum(j['status']!='reviewed' for j in original),'base_report_unchanged':True,
         'limits':'Supplementary analysis, not original fixed-budget completion. Original 4 failures + new requests all counted. No new author source or quality selection.'})
    lines=['# v2 独立审查补充批次','',
      '原 v2 的四次用量限制失败保留为未知。本批在另存的设计和调用预算下，只补原先缺失的面板；不重看已完成面板、不按胜负选择样本、不给作者新反馈。原生成、图片、检查和报告不修改。','',
      f"新增请求 {cost['attempted']} 次，完成 {cost['completed']} 次；新增输入 tokens {cost['input_tokens']}，输出 tokens {cost['output_tokens']}。",'',
      '| 补充分析 C 对 B | 数量 / 4 |','|---|---:|']
    for k,label in [('C','C 更好'),('B','B 更好'),('tie','平局'),('uncertain','两次均无法判断'),('unresolved','顺序不一致或审查缺失'),('not_comparable','缺视频，不可比')]:lines.append(f'| {label} | {counts[k]} |')
    lines.extend(['','原 v2 预算下仍是 36 次请求、32 次完成、4 次失败；补充后总成本须另外加上本表，不能宣称原预算完成了全部评测。后续质量结论只来自原视频的抽帧，命名空间依赖升级的视频不进入这些判断。','',
      '[补充计划](plan.json) · [原始补充判断](reviews.json) · [含来源标记的合并分析](summary.json)','',
      '只有两个熟悉任务家族、四份弱初稿。模型静帧比较不代表人类理解或完整运动质量；同模型两种顺序不是更多独立样本。',''])
    (REPORT/'REPORT.md').write_text('\n'.join(lines));print(json.dumps({'cost':cost,'primary_C_vs_B':counts}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','run','report'])
    globals()[parser.parse_args().phase]()

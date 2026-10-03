"""Paired v2 experiment: same frozen drawing adapter for all four methods."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
from itertools import combinations
import json
from pathlib import Path
import shutil
import time

import model_infra_pilot as p
from batch import digest, save
from report_model_infra_pilot import stable_comparison

REPORT = p.ROOT/'evaluation/2026-10-03/model-infra-pilot-v2'
WORK = p.ROOT/'work/model-infra-pilot-v2'
TOOL_FILES = ['tools/model_infra_pilot_v2.py', 'tools/model_infra_pilot.py',
              'tools/render_scene.mjs', 'tools/contracts.mjs', 'tools/capture_frame.mjs',
              'tools/batch.py', 'tools/calibrate_review.py', 'tools/code2video_pilot.py',
              'tools/report_model_infra_pilot.py', 'runtime/math-frame.mjs']


def configure():
    p.REPORT, p.WORK = REPORT, WORK
    p.SUPPORT_FILES = {'math-frame.mjs': REPORT/'tooling/runtime/math-frame.mjs'}
    p.common_prompt = common_prompt
    p.verify = verify


def verify():
    for item in p.read(REPORT/'frozen.json'):
        if digest(REPORT/item['path']) != item['sha256']:
            raise ValueError(f"Frozen v2 artifact changed: {item['path']}")
        if item.get('current_source') and digest(p.ROOT/item['current_source']) != item['sha256']:
            raise ValueError(f"Tool changed after v2 freeze: {item['current_source']}")


def common_prompt(case):
    return (REPORT/f"prompts/{case['id']}.txt").read_text()


def prepare():
    # Empty report directory can be created by workspace setup, but never overwrite an experiment.
    if REPORT.exists() and any(REPORT.iterdir()):
        raise ValueError('Existing experiment cannot be overwritten')
    WORK.mkdir(parents=True, exist_ok=False)
    REPORT.mkdir(parents=True, exist_ok=True)
    for relative in TOOL_FILES:
        target = REPORT/'tooling'/relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p.ROOT/relative, target)
    protocol = (p.ROOT/'docs/scene-protocol.md').read_text().split('## Run a candidate')[0]
    protocol += '''\nAdditional exponential evidence: geometry.massBars must contain mass-0..2
with actual x/y/width/height/color/opacity. Opaque exponential widths must be
proportional to exp(logit) under one shared zero-intercept scale. Missing or
transparent bars are not verified ratios. The helper records these automatically.
Inspection findings do not stop diagnostic video export; drawing exceptions still do.
'''
    (REPORT/'protocol.md').write_text(protocol)
    api = (p.ROOT/'docs/math-evidence.md').read_text().split('The [controlled regression]')[0]
    (REPORT/'adapter-api.md').write_text(api)
    for case in p.CASES:
        prompt = f'''Authorized original mathematical animation benchmark. Return ONLY structured html/javascript/storyboard.
Do not use tools, read files, browse, delegate or invoke models. All material is supplied here.
Produce a Chinese silent explanation for a newcomer: Canvas2D exactly 854x480, 15fps, 18 seconds.
Use a dark background, legible concise captions, stable component identities/colors and meaningful changes.
Show the question and what the objects mean. Visible geometric actions must support the mechanism, not just formulas.
Keep authored JavaScript under 9000 characters, HTML under 1000, storyboard under 1500 (soft limits).
Expose deterministic window.C2M version 1 and canvas#scene. index.html must load scene.js as a module.
Redraw a whole frame at explicit render(t); no accumulated state or playback in ?export=1.
Meta caseId is {case['id']}. Preserve the required stages in order. No claim of trained weights.

Every candidate receives the exact same preinstalled local math-frame.mjs, copied unchanged by the harness.
Import {{createMathFrame}} from './math-frame.mjs'; create a fresh frame in render(t).
Use its text calls for labels, massBar for exponential bars, partition for the final probability capacity,
and vector for residual identity/correction/output arrows. Choose your own positions, colors, captions and timing.
Return f.finish() evidence. For any extra raw Canvas shape, append its truthful measured bounds to that snapshot.
Do not redefine, replace or edit the adapter. Do not fabricate registrations for unseen objects.
The adapter reduces evidence boilerplate; the animation's explanation and visual design are your responsibility.

Brief:
{json.dumps(case, ensure_ascii=False)}
Common protocol:
{protocol}
Common adapter API:
{api}
Exact local adapter implementation (not counted toward authored source-size limit):
{(REPORT/'tooling/runtime/math-frame.mjs').read_text()}
'''
        target = REPORT/f"prompts/{case['id']}.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(prompt)
        save(WORK/f"brief-{case['id']}.json", case)
    save(REPORT/'cases.json', p.CASES)
    save(REPORT/'judge-schema.json', p.JUDGE_SCHEMA)
    save(REPORT/'author-schema.json', p.AUTHOR_SCHEMA)
    samples = p.controls.check_frozen()
    save(REPORT/'calibration-plan.json', {'prompt': p.controls.prompt(), 'schema': p.controls.SCHEMA,
         'samples': samples, 'oracle': p.controls.CASES,
         'limits': 'Same four previously seen controlled stimuli. Screening, not a new judge reliability benchmark.'})
    save(REPORT/'experiment.json', {
        'version': 2, 'weak': p.WEAK, 'strong': p.STRONG, 'reasoning': 'low for both; no agents',
        'repeats': 2, 'cases': 2, 'arms': p.ARMS, 'primary_comparison': 'C vs B',
        'support_policy': 'Identical frozen drawing/evidence adapter available to A/B/C/D, mandatory semantic primitives',
        'pairing': 'Exactly shared A initial source for B/C; two independently generated weak starts per task',
        'generation_calls': {'A': 1, 'B': 3, 'C': 3, 'D': 1}, 'unique_generation_calls': 24,
        'final_selection': 'Fixed last version; no best-of, fallback, manual repair or extra calls',
        'feedback': 'B/C same prior source, sampled frames, execution errors. Only C receives deterministic findings.',
        'judge': 'Astra final only; anonymous WXYZ, both attachment orders; never sent to author',
        'planned_calls': {'calibration': 4, 'generation': 24, 'final_review': 8},
        'samples_s': p.TIMES, 'model_timeout_s': 240, 'render_timeout_s': 120, 'max_workers': 4,
        'budget_limits': 'Equal author call counts, effort and requested soft source limits for B/C; not equal tokens',
        'failure_policy': 'Stop submitting new requests after a failed batch; retain failures, no hidden recovery calls',
        'inference': 'Two familiar contract task families, exploratory only. Does not isolate adapter benefit vs v1.'})
    frozen = []
    for path in sorted(REPORT.rglob('*')):
        if path.is_file():
            item = {'path': str(path.relative_to(REPORT)), 'sha256': digest(path)}
            if path.is_relative_to(REPORT/'tooling'):
                item['current_source'] = str(path.relative_to(REPORT/'tooling'))
            frozen.append(item)
    save(REPORT/'frozen.json', frozen)
    save(REPORT/'progress.json', {'phase': 'prepared', 'models_called': 0})
    print('v2 prepared: 16 finals, 24 author + 4 calibration + 8 final review calls planned', flush=True)


def stop(phase, detail):
    save(REPORT/'progress.json', {'phase': phase, 'status': 'stopped', 'reason': detail})
    raise RuntimeError(detail)


def calibrate():
    verify()
    plan = p.read(REPORT/'calibration-plan.json')
    records = []
    # First planned screening call also checks current service availability.
    for sample in plan['samples']:
        image = p.ROOT/sample['contact']
        if digest(image) != sample['contact_sha256']:
            raise ValueError('Frozen calibration image changed')
        call = p.invoke(WORK/'calibration'/sample['id'], plan['prompt'], plan['schema'], p.STRONG, [image])
        record = {'id': sample['id'], 'call': call, 'status': 'unknown'}
        if call['status'] == 'completed':
            try:
                p.controls.validate(call['response'])
                record['matches'] = {axis: call['response'][axis] == plan['oracle'][sample['id']][axis] for axis in p.controls.FIELDS}
                record['status'] = 'matched' if all(record['matches'].values()) else 'mismatched'
            except ValueError as exc:
                record['error'] = str(exc)
        records.append(record)
        save(REPORT/'calibration.json', {'records': records, 'screening_pass': len(records)==4 and all(r['status']=='matched' for r in records)})
        print(f"screening {sample['id']}: {record['status']}", flush=True)
        if record['status'] != 'matched':
            stop('calibration', 'Screening failed or model service unavailable; no author calls started')
    save(REPORT/'progress.json', {'phase': 'calibration_completed'})


def run_batch(jobs, sink, phase):
    outcomes = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fn, *args) for fn, args in jobs]
        for future in as_completed(futures):
            outcome = future.result()
            outcomes.append(outcome)
            sink(outcome)
    if any(r['status'] == 'generation_unknown' for r in outcomes):
        stop(phase, 'A model call failed; completed and failed attempts retained, no later calls submitted')


def generate():
    verify()
    if not p.read(REPORT/'calibration.json')['screening_pass']:
        raise ValueError('Screening must pass before generation')
    started = time.monotonic()
    finals = {}
    def add(record):
        key = (record['case'], record['repeat'], record['arm'])
        if key not in finals:
            initial = finals[(record['case'], record['repeat'], 'A')]['attempts'][0] if record['arm'] in ('B','C') else None
            finals[key] = {'case': record['case'], 'repeat': record['repeat'], 'arm': record['arm'],
                           'attempts': [initial] if initial else []}
        finals[key]['attempts'].append(record)
        finals[key]['final'] = record
        save(REPORT/'generation.partial.json', list(finals.values()))
    for arm in ('A', 'D'):
        run_batch([(p.create_attempt, (case, repeat, arm, 1, common_prompt(case)))
                   for case in p.CASES for repeat in (1,2)], add, 'initial_generation')
    for version in (2,3):
        jobs = []
        for case in p.CASES:
            for repeat in (1,2):
                for arm in ('B','C'):
                    prior = finals[(case['id'],repeat,arm if version==3 else 'A')]['final']
                    source, images, manifest = p.prior_material(prior)
                    instruction = ('Use the deterministic findings to target specific defects while keeping the explanation clear.' if arm=='C'
                                   else 'Inspect the supplied source and sampled frames yourself; correct defects and improve the explanation.')
                    prompt = common_prompt(case)+f'\nRevision {version}/3. {instruction}\nPrior source:\n'+json.dumps(source,ensure_ascii=False)+\
                             '\nPrior execution evidence:\n'+json.dumps(p.feedback(manifest,arm=='C'),ensure_ascii=False)+\
                             '\nAttached samples, if present, are at seconds '+json.dumps(p.TIMES)+'. Return a complete replacement, not a patch.'
                    jobs.append((p.create_attempt,(case,repeat,arm,version,prompt,images)))
        for offset in range(0,len(jobs),4):
            run_batch(jobs[offset:offset+4], add, f'revision_{version}')
    save(REPORT/'generation.json', list(finals.values()))
    save(REPORT/'generation-timing.json', {'batch_wall_s': time.monotonic()-started,
         'limits': 'Includes renders and resumed orchestration; per-call historical times recorded separately'})
    save(REPORT/'progress.json', {'phase': 'generation_completed'})


def judge():
    verify()
    if not p.read(REPORT/'calibration.json')['screening_pass']:
        raise ValueError('Strong judge must pass screening')
    panels = p.read(REPORT/'panels.json')
    if len(panels) != 4 or len(p.read(REPORT/'generation.json')) != 16:
        raise ValueError('All final generation must precede blind review')
    records = []
    def task(panel, order):
        items = panel['items'] if order == 1 else list(reversed(panel['items']))
        images = [p.ROOT/item['contact'] for item in items]
        for item,image in zip(items,images):
            if digest(image) != item['sha256']:raise ValueError('Frozen judge image changed')
        case = next(c for c in p.CASES if c['id'] == panel['case'])
        prompt = f'''Authorized final blind visual assessment. Do not use tools, browse, read source or delegate.
Four contact sheets are four independent explanations of the same task, identified ONLY by W/X/Y/Z. You do not know their model, method or revision count.
Task question: {case['question']}
Audience: Chinese-speaking newcomer. Judge only the attached sampled frames; do not infer unseen motion or actual human learning.
For each ID, reconstruct what the pictures explain. For each criterion below (0..3), report demonstrated/missing/contradicted/uncertain with an exact supplied time and concrete visible evidence.
'Demonstrated' requires a visible geometric relation supporting the words. A correct formula or prior mathematical knowledge alone is insufficient. No frame means missing evidence, not invented content.
Criteria: {json.dumps(dict(enumerate(case['visual_checks'])), ensure_ascii=False)}
Then compare ALL SIX unordered pairs. Prefer the candidate that makes the task's causal mechanism more identifiable and visually supported, considering contradictions, missing steps, component identity and readability. Return winner ID, 'tie' or 'uncertain', with concrete reasons. Do not prefer decoration, extra text or more claims without supporting geometry. No numerical beauty score.
Supplied times: {p.TIMES}. Attachment order: {[i['id'] for i in items]}. State sample limitations.
'''
        call = p.invoke(WORK/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}", prompt, p.JUDGE_SCHEMA, p.STRONG, images)
        record = {'case':panel['case'],'repeat':panel['repeat'],'order':order,'call':call,'status':'unknown'}
        if call['status'] == 'completed':
            try:
                p.validate_judge(call['response'],[i['id'] for i in items])
                record['status']='reviewed'
            except ValueError as exc:record['error']=str(exc)
        save(REPORT/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}.json",record)
        return record
    jobs = [(panel,order) for panel in panels for order in (1,2)]
    for offset in range(0,len(jobs),4):
        with ThreadPoolExecutor(max_workers=4) as pool:
            batch = list(pool.map(lambda job:task(*job),jobs[offset:offset+4]))
        records.extend(batch)
        save(REPORT/'judgements.json',records)
        if any(j['status'] != 'reviewed' for j in batch):
            stop('final_review','A final review failed; no later review batch submitted. Missing reviews remain unresolved.')
    save(REPORT/'progress.json', {'phase': 'final_review_completed'})


def report():
    verify()
    calls = []
    for file in sorted(WORK.rglob('safe.json')):
        record = p.read(file)
        calls.append({'path': str(file.relative_to(p.ROOT)),
                      **{k: v for k,v in record.items() if k!='response'}})
    save(REPORT/'actual-calls.json', calls)
    cost = {'attempted': len(calls), 'completed': sum(c['status']=='completed' for c in calls),
            'unknown': sum(c['status']!='completed' for c in calls),
            'input_tokens': sum(u['input_tokens'] for c in calls for u in c.get('process',{}).get('usage',[])),
            'output_tokens': sum(u['output_tokens'] for c in calls for u in c.get('process',{}).get('usage',[]))}
    complete = (REPORT/'generation.json').exists()
    generation = p.read(REPORT/('generation.json' if complete else 'generation.partial.json')) if complete or (REPORT/'generation.partial.json').exists() else []
    judges = p.read(REPORT/'judgements.json') if (REPORT/'judgements.json').exists() else []
    panels = p.read(REPORT/'panels.json') if (REPORT/'panels.json').exists() else []
    comparisons = []
    reviewed = 0
    for panel in panels:
        mapping = {i['id']: i['arm'] for i in panel['items']}
        available = {i['arm']: i['rendered_video'] for i in panel['items']}
        for a,b in combinations(p.ARMS,2):
            answers=[]
            for order in (1,2):
                j=next((j for j in judges if j['case']==panel['case'] and j['repeat']==panel['repeat'] and j['order']==order),None)
                answer={'order':order,'winner':'unknown'}
                if j and j['status']=='reviewed':
                    pair=next(q for q in j['call']['response']['comparisons'] if {mapping[q['left']],mapping[q['right']]}=={a,b})
                    answer.update(winner=mapping.get(pair['winner'],pair['winner']),reason=pair['reason'])
                answers.append(answer)
            comparisons.append({'case':panel['case'],'repeat':panel['repeat'],'left_arm':a,'right_arm':b,
                                'both_orders':answers,'stable_winner':stable_comparison(answers,available[a] and available[b])})
    primary=[c for c in comparisons if {c['left_arm'],c['right_arm']}=={'B','C'}]
    counts={k:sum(c['stable_winner']==k for c in primary) for k in ('C','B','tie','uncertain','unresolved','not_comparable')}
    candidates=REPORT/'candidate-sources'
    items=[]
    for g in generation:
        for attempt in g['attempts']:
            if attempt.get('source'):
                source=p.ROOT/attempt['source']
                dest=candidates/f"{attempt['case']}-{attempt['repeat']}-{attempt['arm']}-v{attempt['version']}"
                if not dest.exists():shutil.copytree(source,dest)
                for name,sha in attempt['source_sha256'].items():
                    if digest(dest/name)!=sha:raise ValueError('Frozen candidate source changed')
        reviews=[]
        panel=next((pa for pa in panels if pa['case']==g['case'] and pa['repeat']==g['repeat']),None)
        if panel:
            ident=next(i['id'] for i in panel['items'] if i['arm']==g['arm'])
            for j in judges:
                if j['case']==g['case'] and j['repeat']==g['repeat'] and j['status']=='reviewed':
                    verdict=next(v for v in j['call']['response']['videos'] if v['id']==ident)
                    reviews.append({'order':j['order'],'demonstrated':sum(c['status']=='demonstrated' for c in verdict['checks']), 'verdict':verdict})
        items.append({**g,'reviews':reviews,'artistic_acceptance':'not_assigned'})
    reviewed=sum(j['status']=='reviewed' for j in judges)
    summary={'generation_complete':complete,'primary_C_vs_B':counts,'all_comparisons':comparisons,
             'cost':cost,'final_review_completed':reviewed,'final_review_planned':8,'candidates':items,
             'limits':'Exploratory 2 familiar tasks x 2 initial samples; model sampled-frame judgement, not human understanding or full-motion evaluation'}
    save(REPORT/'summary.json',summary)
    progress=p.read(REPORT/'progress.json')
    lines=['# 同绘图接口的弱模型对照 · v2','',
           '本轮冻结相同绘图接口、任务与调用预算，主要比较普通修订 B 和确定性反馈修订 C。没有人工改候选或挑最佳版本。', '',
           f"当前阶段：`{progress['phase']}`；实际模型请求 {cost['attempted']} 次，完成 {cost['completed']} 次，未知/失败 {cost['unknown']} 次。",
           f"生成{'完成' if complete else '未完成'}；最终独立审查 {reviewed}/8 次完成。输入 tokens {cost['input_tokens']}，输出 tokens {cost['output_tokens']}。",'']
    if progress.get('reason'):lines.extend([f"停止原因：{progress['reason']}",''])
    if complete and len(primary)==4:
        lines.extend(['| C 对 B，交换附件顺序后 | 数量 / 4 |','|---|---:|'])
        for key,label in [('C','C 更好'),('B','B 更好'),('tie','平局'),('uncertain','两次均无法判断'),('unresolved','审查失败或顺序不一致'),('not_comparable','缺少视频，不可比较')]:lines.append(f'| {label} | {counts[key]} |')
        lines.append('')
    else:lines.extend(['**当前没有完整的模型质量对照结论。** 未执行的计划项不计成成功、平局或更多样本。',''])
    lines.extend(['| 任务 | 重复 | 组 | 固定最终版本 | 导出 | 技术检查 | 画面证据项 / 4（正反顺序） |','|---|---:|---|---:|---|---|---|'])
    for g in sorted(items,key=lambda g:(g['case'],g['repeat'],g['arm'])):
        f=g['final'];scores=' / '.join(str(next((r['demonstrated'] for r in g['reviews'] if r['order']==o),'未知')) for o in (1,2))
        lines.append(f"| {g['case']} | {g['repeat']} | {g['arm']} | {f['version']} | {'有' if f['status']=='rendered' else '失败'} | {'通过' if f.get('technical_pass') else '未通过'} | {scores} |")
    lines.extend(['','画面证据项是四项固定机制要求的模型判断，不是理解率或艺术评分。只有生成完成，版本列才是完整计划的最终版本；中断时保留最后已执行尝试。','',
                 'A/B/C 由 Luna 生成，D 由 Astra 一次生成；A 的初稿与 B/C 完全共享。B/C 固定各修两轮，前版源码、可用抽帧和执行错误条件相同，仅 C 获得检查发现。A/B/C/D 都可使用同一个冻结的 math-frame.mjs。B/C 调用数/effort/软长度预算相同，实际 tokens 不保证相等。','',
                 'Astra 裁判只看匿名 WXYZ 联系表、任务问题与固定四项要求；方法、源码、模型身份、技术结论不提供。每个面板交换附件顺序复评，冲突/缺失记未决；无视频记不可比较。裁判结果从未反馈给作者。D 与裁判同模型可能产生偏好，主要比较 C/B。','',
                 '[冻结设计](experiment.json) · [冻结哈希](frozen.json) · [裁判筛查](calibration.json) · [实际调用](actual-calls.json) · [全部结果与证据](summary.json)','',
                 '验证分类：本轮复用安装环境；单元/模拟检查单列于运行文档。实际模型生成与渲染状态逐版记录，所有源码保存在 candidate-sources/；视频、抽帧与原始 provider 日志位于 ignored work/。模型审看是六个时刻的静帧，不是完整动画、人类教学研究或用户艺术接受。','',
                 '本轮没有隔离“绘图接口本身”的收益；与 v1 跨轮比较不能证明该接口的因果效果。仅两个已开发契约任务、四份弱初稿，不作统计显著性或泛化能力提升结论。服务端权重版本无法固定。实验设计成本未单独测量，不能推断总投入回报。',''])
    for panel in panels:
        lines.append(f"### {panel['case']} · 重复 {panel['repeat']}\n")
        for item in sorted(panel['items'],key=lambda x:x['arm']):
            g=next(g for g in generation if (g['case'],g['repeat'],g['arm'])==(panel['case'],panel['repeat'],item['arm']))
            f=g['final'];clip=p.ROOT/f['render']/'video.mp4' if f['render'] else None
            video=f'[视频]({clip})' if clip and clip.exists() else '无视频'
            lines.append(f"- {item['arm']}：{video} · [抽帧]({p.ROOT/item['contact']})")
        lines.append('')
    (REPORT/'REPORT.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({'cost':cost,'generation_complete':complete,'primary_C_vs_B':counts},ensure_ascii=False))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase',choices=['prepare','calibrate','generate','sheets','judge','report'])
    args=parser.parse_args()
    configure()
    if args.phase=='sheets':p.sheets()
    else:globals()[args.phase]()


if __name__=='__main__':main()

"""Report all attempts and order-sensitive judgements without cherry-picking."""
from itertools import combinations
import json
from pathlib import Path
import shutil

from batch import save, digest
import model_infra_pilot as p


def stable_comparison(answers, both_available):
    # Missing artifacts are export failures, not visual-quality ties or losses.
    if not both_available:
        return 'not_comparable'
    winners = [q['winner'] for q in answers]
    return winners[0] if len(winners)==2 and winners[0]==winners[1] and winners[0]!='unknown' else 'unresolved'


def main():
    # Reports describe frozen historical tooling, not today's renderer version.
    for item in p.read(p.REPORT/'frozen.json'):
        if digest(p.REPORT/item['path'])!=item['sha256']:
            raise ValueError('Historical frozen archive changed')
    generation = p.read(p.REPORT/'generation.json')
    judges = p.read(p.REPORT/'judgements.json')
    panels = p.read(p.REPORT/'panels.json')
    expected = {(c['id'], r, a) for c in p.CASES for r in (1,2) for a in p.ARMS}
    if len(generation) != 16 or {(g['case'],g['repeat'],g['arm']) for g in generation} != expected:
        raise ValueError('Do not omit failed candidates')
    if len(judges) != 8 or {(j['case'],j['repeat'],j['order']) for j in judges} != {(c['id'],r,o) for c in p.CASES for r in (1,2) for o in (1,2)}:
        raise ValueError('Do not omit unsuccessful judges')
    costs, comparisons, items = {}, [], []
    candidates = p.REPORT/'candidate-sources'
    candidates.mkdir(exist_ok=True)
    for arm in p.ARMS:
        group = [g for g in generation if g['arm'] == arm]
        calls = [p.read(p.ROOT/r['call']) for g in group for r in g['attempts']]
        token_records = [u for c in calls for u in c.get('process',{}).get('usage',[])]
        costs[arm] = {'final_candidates':len(group), 'generation_attempts_including_shared_initials':len(calls),
            'unknown_calls':sum(c['status']!='completed' for c in calls),
            'input_tokens':sum(u['input_tokens'] for u in token_records),
            'output_tokens':sum(u['output_tokens'] for u in token_records),
            'generation_wall_s_sum':sum(c.get('process',{}).get('wall_s',0) for c in calls),
            'render_wall_s_sum':sum(r.get('render_wall_s',0) for g in group for r in g['attempts']),
            'final_rendered':sum(g['final']['status']=='rendered' for g in group),
            'final_technical_pass':sum(g['final'].get('technical_pass',False) for g in group)}
    for g in generation:
        for r in g['attempts']:
            if r.get('source'):
                source = p.ROOT/r['source']
                dest = candidates/f"{r['case']}-{r['repeat']}-{r['arm']}-v{r['version']}"
                if not dest.exists():
                    shutil.copytree(source,dest)
                for name, sha in r['source_sha256'].items():
                    if digest(dest/name) != sha:
                        raise ValueError('Archived source changed')
        final = g['final']
        ident = next(item['id'] for panel in panels if panel['case']==g['case'] and panel['repeat']==g['repeat'] for item in panel['items'] if item['arm']==g['arm'])
        observations = []
        for judge in judges:
            if judge['case']==g['case'] and judge['repeat']==g['repeat']:
                v = next((v for v in judge.get('call',{}).get('response',{}).get('videos',[]) if v['id']==ident),None)
                observations.append({'order':judge['order'],'judge_status':judge['status'],'review':v,
                                     'demonstrated_count':sum(c['status']=='demonstrated' for c in v['checks']) if v and judge['status']=='reviewed' else None})
        items.append({'case':g['case'],'repeat':g['repeat'],'arm':g['arm'],'opaque_id':ident,
                      'final':final,'reviews':observations})
    for panel in panels:
        mapping = {i['id']:i['arm'] for i in panel['items']}
        available = {i['arm']:i['rendered_video'] for i in panel['items']}
        for a,b in combinations(p.ARMS,2):
            answers=[]
            for j in [j for j in judges if j['case']==panel['case'] and j['repeat']==panel['repeat']]:
                answer={'order':j['order'],'winner':'unknown'}
                if j['status']=='reviewed':
                    pair=next(q for q in j['call']['response']['comparisons'] if {mapping[q['left']],mapping[q['right']]}=={a,b})
                    answer.update(winner=mapping.get(pair['winner'],pair['winner']),reason=pair['reason'])
                answers.append(answer)
            stable=stable_comparison(answers, available[a] and available[b])
            comparisons.append({'case':panel['case'],'repeat':panel['repeat'],'left_arm':a,'right_arm':b,
                                'both_orders':answers,'stable_winner':stable})
    primary=[c for c in comparisons if {c['left_arm'],c['right_arm']}=={'B','C'}]
    summary={'primary_C_vs_B':{k:sum(c['stable_winner']==k for c in primary) for k in ['C','B','tie','uncertain','unresolved','not_comparable']},
             'all_comparisons':comparisons,'costs_per_arm':costs,'candidates':items,
             'limits':'Two contract task families x two initial samples. Attachment-order disagreement is unresolved, not majority-selected. No statistical significance, human comprehension or full-motion quality claim.',
             'cost_scope':'A initial is shared by B/C, charged to each standalone arm for comparison but counted once in actual unique calls; duration sums overlap and are not batch elapsed.',
             'setup_scope':'Experiment harness authored in this Codex session; setup time/model use not instrumented, excluded from generation cost; candidate sources never hand-edited.'}
    save(p.REPORT/'summary.json',summary)
    unique={r['call'] for g in generation for r in g['attempts']}
    save(p.REPORT/'unique-generation-calls.json',[{'path':path,'record':{k:v for k,v in p.read(p.ROOT/path).items() if k!='response'}} for path in sorted(unique)])
    lines=['# 弱模型 + infra 对照试验 v1\n',
           '**本轮没有证明能力提升。** 两个可比较的 Softmax 配对，普通重试 B 在两种附件顺序下都胜过 infra 反馈 C；两个残差配对未能导出弱模型视频，无法比较画面质量。',
           '实验于 2026-10-02 启动，2026-10-03 汇总；沿用已冻结的 v1 目录。',
           '这是探索性试验：2 个已有契约任务 × 2 次独立初稿，不支持显著性或总体能力提升结论。',
           '\n主要比较 **C（确定性检查反馈）与 B（普通自查修订）**。A 是弱模型初稿，D 是强模型一次生成参考。',
           '\n| C 对 B：交换附件顺序后保持的结果 | 数量 / 4 |\n|---|---:|']
    for key,label in [('C','C 更好'),('B','B 更好'),('tie','平局'),('uncertain','两次均无法判断'),('unresolved','顺序不一致或审查失败'),('not_comparable','至少一组没有可用视频，画面不可比')]:
        lines.append(f"| {label} | {summary['primary_C_vs_B'][key]} |")
    lines+=['\n## 每条结果与实际成本\n',
            '| 任务 | 重复 | 组 | 导出视频 | 技术检查 | 画面证据项 / 4（两次盲评） |\n|---|---:|---|---|---|---|']
    for item in sorted(items,key=lambda x:(x['case'],x['repeat'],x['arm'])):
        f=item['final'];scores=' / '.join(str(r['demonstrated_count']) if r['demonstrated_count'] is not None else '未知' for r in item['reviews'])
        lines.append(f"| {item['case']} | {item['repeat']} | {item['arm']} | {'是' if f['status']=='rendered' else '失败'} | {'通过' if f.get('technical_pass') else '未通过'} | {scores} |")
    lines+=['\n“证据项”来自统一的四项具体要求，是裁判的画面判断，不是看懂率或艺术总分。无画面的 0 项表示没有证据可评，不是画面差。完整判断、时刻证据和顺序敏感性见 [summary.json](summary.json) 与 [judgements.json](judgements.json)。',
            '\n| 组 | 有效调用预算 | 生成用时合计（秒） | 渲染用时合计（秒） | 输出 tokens |\n|---|---|---:|---:|---:|']
    for arm,cost in costs.items():
        lines.append(f"| {arm} | {cost['generation_attempts_including_shared_initials']} 次，4 个候选 | {cost['generation_wall_s_sum']:.1f} | {cost['render_wall_s_sum']:.1f} | {cost['output_tokens']} |")
    lines+=['\n时长是重叠调用的合计，不是用户等待时间；批次等待见 [generation-timing.json](generation-timing.json)。B/C 共用 A 的初稿，上表分别计入初稿成本，实际调用总量见 [unique-generation-calls.json](unique-generation-calls.json)。不是严格相等 token 实验。',
            '\n## 设计与冻结\n',
            'Luna 生成 A/B/C，Astra 生成 D 并做最终盲评，两者 reasoning=low。每次官方 CLI 独立临时上下文、禁止工具；没有 subagent 或凭据转换。',
            'A/B/C 共享完全相同初稿。B/C 都收到相同要求、前版源、同样抽帧与执行错误，每次返回完整替换源；只有 C 收到确定性数字、声明几何、抽样像素、布局与阶段顺序的检查反馈。此轮测试该窄反馈机制，不等于验证整个平台或运行时资产复用。',
            'B/C 固定修两轮，不以通过为由提前停止；最后一版作为最终结果，即使它比前版差。没有 best-of、回退、人工挑选、候选代码手改或超预算恢复。源码长度是提示中的软限制，实际是否遵守在每版记录中保留。',
            '强裁判的4个负对照全部匹配预设标签，见 [calibration.json](calibration.json)。仅一遍、同一批旧样例，是换模型后的基础筛查，不能外推到新视频的总体可靠性。',
            '所有生成完成后，裁判每次看同任务的四张匿名联系表。方法、模型、源码、修订次数、技术检查结论不提供给裁判。每组正序与逆序各一次，评四项证据并比较全部六对；结果冲突标为 unresolved，不挑有利的顺序。D 的作品也由 Astra 评价，因此同模型偏好仍可能影响强弱比较；主要 C/B 都由 Luna 生成。',
            'brief、通用协议、生成/审查脚本与 schema 在真实调用前冻结，见 [experiment.json](experiment.json)、[frozen.json](frozen.json)、[tooling](tooling)。任务数值与既有成片不同，但仍属于已开发过的契约家族，不是广泛的未见概念集。',
            '\n## 验证层次与局限\n',
            '- 安装：复用本地 Playwright/Chromium/FFmpeg，没有本轮安装；依赖版本每次渲染 manifest 记录。',
            '- mock/代码验证：58 项 Python 测试通过，三个 Node 测试文件通过；覆盖 B 无法获得 C 检查结果、裁判缺项不可接受，以及缺视频不能计为画面平局或败北。',
            '- 真实生成：独立 CLI 调用，所有模型失败、超时和源码版本保留。实际完成与调用统计见逐项记录；不能把调用退出码当作艺术质量。',
            '- 实际渲染：固定 t=frame/fps，18 秒、854×480、15fps；诊断模式允许导出有检查错误的片，但 exit=1/checks_failed 保持不变。本地故意错误片验证见 [renderer-regression.json](renderer-regression.json)。',
            '- 数学检查：[math-reference.json](math-reference.json) 独立计算预期值。每个 render 的 checks/frame-evidence/manifest 保存重算、几何与像素检查；候选提供的证据 registry 不是全像素或语义正确性证明。',
            '- 艺术审看：强模型只审查六个时刻的静帧，不评价完整连续运动、教学效果或人类理解。当前代理的视觉抽检也不作为独立盲评。',
            '- 没有显著性结论；四次配对高度受两个任务影响，不把反复审查当作更多独立任务。模型标识固定，但服务端权重版本无法固定。',
            '- infra 的实现与准备成本未单独计时，不能由边际生成耗时推断总投入回报。',
            '\n## 每条最终视频\n']
    for panel in panels:
        lines.append(f"\n### {panel['case']} · 重复 {panel['repeat']}\n")
        for item in sorted(panel['items'],key=lambda i:i['arm']):
            g=next(g for g in generation if (g['case'],g['repeat'],g['arm'])==(panel['case'],panel['repeat'],item['arm']))
            render=g['final']['render']
            clip=p.ROOT/render/'video.mp4' if render else None
            video=f'[视频]({clip})' if clip and clip.exists() else '未导出视频'
            lines.append(f"- {item['arm']}：{video} · [联系表]({p.ROOT/item['contact']})")
    rendered = '\n'.join(lines)+'\n'
    if (p.REPORT/'DIAGNOSIS.md').exists():
        rendered = rendered.replace('## 每条最终视频', (p.REPORT/'DIAGNOSIS.md').read_text()+'## 每条最终视频')
    (p.REPORT/'REPORT.md').write_text(rendered)
    print(json.dumps(summary['primary_C_vs_B'],ensure_ascii=False))


if __name__=='__main__':
    main()

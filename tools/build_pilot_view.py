"""Local evidence viewer: paired videos, checks and independent order-specific reasons."""
import argparse
import html
import json
import os
from pathlib import Path
from batch import save,digest
ROOT=Path(__file__).resolve().parents[1]


def local_path(value):
    path=Path(value)
    path=path if path.is_absolute() else ROOT/path
    path=path.resolve()
    if not path.is_relative_to(ROOT):raise ValueError('Evidence path must stay in repository workspace')
    return path


def build(experiment,out):
    experiment=local_path(experiment);out=local_path(out)
    if out.exists():raise ValueError('Viewer output must be a new version')
    summary=json.loads((experiment/'summary.json').read_text());cases=json.loads((experiment/'cases.json').read_text())
    panels_file=experiment/('pair-panels.json' if (experiment/'pair-panels.json').exists() else 'panels.json')
    panels=json.loads(panels_file.read_text())
    candidates=summary['candidates'];comparisons=summary.get('comparisons',summary.get('all_comparisons',[]))
    groups=[]
    def link(path):return os.path.relpath(local_path(path),out)
    for case in cases:
      for repeat in (1,2):
        group={'case':case['id'],'repeat':repeat,'question':case['question'],'inputs':case['inputs'],'candidates':[]}
        panel=next((pa for pa in panels if (pa['case'],pa['repeat'])==(case['id'],repeat)),None)
        for arm in ('B','C','A','D'):
          g=next((g for g in candidates if (g['case'],g['repeat'],g['arm'])==(case['id'],repeat,arm)),None)
          if not g:continue
          final=g['final'];render=local_path(final['render']) if final.get('render') else None
          video=render/'video.mp4' if render else None
          manifest=json.loads((render/'manifest.json').read_text()) if render and (render/'manifest.json').exists() else {}
          finding_groups={}
          for finding in manifest.get('checks',{}).get('findings',[]):
            key=(finding.get('code'),finding.get('detail'))
            f=finding_groups.setdefault(key,{'code':key[0],'detail':key[1],'first_time_s':finding.get('time_s'),'count':0});f['count']+=1
          item=next((i for i in panel['items'] if i['arm']==arm),None) if panel else None
          group['candidates'].append({'arm':arm,'label':{'A':'弱模型初稿','B':'普通自查修订','C':'检查反馈修订','D':'强模型一次生成参考'}[arm],
            'version':final['version'],'video':link(video) if video and video.exists() else None,
            'contact':link(item['contact']) if item else None,'export':final['status']=='rendered',
            'technical_pass':bool(final.get('technical_pass')),'errors':manifest.get('errors',[]),
            'findings':list(finding_groups.values()),'checks':link(render/'checks.json') if render and (render/'checks.json').exists() else None,
            'source':link(local_path(final['source'])/'scene.js') if final.get('source') else None,
            'revisions':[{'version':a['version'],'arm':a['arm'],'status':a['status'],'source_sha256':a.get('source_sha256',{}),'technical_pass':a.get('technical_pass',False)} for a in g['attempts']]})
        comparison=next((c for c in comparisons if (c['case'],c['repeat'])==(case['id'],repeat) and (('left_arm' not in c) or {c['left_arm'],c['right_arm']}=={'B','C'})),None)
        group['comparison']=comparison;groups.append(group)
    data={'experiment':experiment.name,'cost':summary.get('cost',{}),'review_completed':summary.get('review_completed',summary.get('final_review_completed')),
          'review_planned':summary.get('review_planned',summary.get('final_review_planned')),'counts':summary['primary_C_vs_B'],'groups':groups}
    out.mkdir(parents=True);save(out/'evidence.json',data)
    payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    page=PAGE.replace('__DATA__',payload)
    (out/'index.html').write_text(page)
    save(out/'manifest.json',{'kind':'local evidence viewer; no model requests, scoring or source modification','input_summary':str(experiment/'summary.json'),
      'input_summary_sha256':digest(experiment/'summary.json'),'builder_sha256':digest(Path(__file__)),'artistic_acceptance':'not_assigned'})
    print(out/'index.html')

PAGE='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Concept2Motion 实验证据</title>
<style>body{margin:0;background:#10151f;color:#e8edf6;font:16px/1.6 system-ui,sans-serif}main{max-width:1400px;margin:35px auto;padding:0 24px}h1{font-size:26px}h2{font-size:20px}.muted{color:#a6b3c8}.pill{display:inline-block;border:1px solid #425069;border-radius:6px;padding:3px 9px;margin:4px 6px 4px 0}section{border-top:1px solid #39445a;margin-top:28px;padding-top:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}article{background:#192130;border-radius:10px;padding:15px;min-width:0}video,img{width:100%;background:#0b0f16;border-radius:5px}video{aspect-ratio:854/480}.empty{aspect-ratio:854/480;display:grid;place-items:center;background:#0b0f16;color:#acb4c4}.ok{color:#8ae0ae}.fail{color:#ffc38f}a{color:#91cfff}button{background:#dce8ff;color:#13203a;border:0;padding:9px 15px;border-radius:6px;cursor:pointer;margin:6px 10px 6px 0}input{width:260px;max-width:70%}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,monospace;color:#b8c5db}details{margin-top:14px}summary{cursor:pointer}blockquote{border-left:3px solid #566886;margin-left:0;padding-left:14px}.refs{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px}.reason{padding:10px;background:#192130;border-radius:6px;margin:8px 0}@media(max-width:800px){.pair,.refs{grid-template-columns:1fr}}</style>
<main><h1>生成实验：看证据和失败原因</h1><p id="title" class="muted"></p><p>主要比较 B 普通自查与 C 检查反馈。两者从同一份初稿出发，固定修改预算。技术通过、画面偏好和实际成本分别展示。</p><div id="metrics"></div><p class="muted">裁判只看六个时刻的抽帧；顺序冲突记未决，缺视频记不可比较。小样本结果不代表总体能力或人类理解。</p><div id="groups"></div></main>
<script type="application/json" id="data">__DATA__</script><script>
const data=JSON.parse(document.querySelector('#data').textContent),$=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={C:'C 获胜',B:'B 获胜',tie:'平局',uncertain:'均不确定',unresolved:'未决',not_comparable:'缺视频'};
$('#title').textContent=data.experiment+' · 原始证据快照';
$('#metrics').innerHTML=Object.entries(data.counts).map(([k,v])=>`<span class="pill">${labels[k]} ${v}/4</span>`).join('')+`<div class="muted">请求 ${data.cost.attempted??'未汇总'} · 完成 ${data.cost.completed??'未汇总'} · 独立审查 ${data.review_completed??'未知'}/${data.review_planned??'未知'}</div>`;
function card(c){return `<article><h3>${c.arm} · ${escape(c.label)}</h3><p><span class="${c.export?'ok':'fail'}">${c.export?'已导出':'未导出'}</span> · <span class="${c.technical_pass?'ok':'fail'}">${c.technical_pass?'技术通过':'技术未通过'}</span> · 固定版本 ${c.version}</p>${c.video?`<video controls preload="metadata" data-arm="${c.arm}" src="${escape(c.video)}"></video>`:'<div class="empty">没有视频，不能判断画面胜负</div>'}<details><summary>检查、执行错误与修改历史</summary><pre>${escape(JSON.stringify({errors:c.errors,findings:c.findings,revisions:c.revisions},null,2))}</pre>${c.source?`<a href="${escape(c.source)}">作者源码</a> `:''}${c.checks?`<a href="${escape(c.checks)}">完整检查</a>`:''}</details>${c.contact?`<details><summary>裁判实际收到的抽帧</summary><img loading="lazy" src="${escape(c.contact)}"></details>`:''}</article>`;}
for(const g of data.groups){const section=document.createElement('section');const comp=g.comparison,answers=comp?.both_orders??comp?.answers??[];section.innerHTML=`<h2>${escape(g.case)} · 第 ${g.repeat} 份独立初稿</h2><p>${escape(g.question)}</p><p class="muted">输入 ${escape(JSON.stringify(g.inputs))}</p><div><button class="play">B/C 同时播放</button><button class="pause">暂停</button><input type="range" min="0" max="18" step="0.05" value="0" aria-label="共同播放时间"><span class="time">0.00 秒</span></div><div class="pair">${g.candidates.filter(c=>['B','C'].includes(c.arm)).map(card).join('')}</div><p><strong>交换顺序后的结果：${escape(comp?labels[comp.stable_winner]:'未审查')}</strong></p>${answers.map(a=>`<div class="reason">附件顺序 ${a.order}：${escape(labels[a.winner]??a.winner)}<br>${escape(a.reason??'没有完整独立判断')}</div>`).join('')}<details><summary>A 初稿 / D 强模型参考（本轮不做它们的画面排名）</summary><div class="refs">${g.candidates.filter(c=>['A','D'].includes(c.arm)).map(card).join('')}</div></details>`;
 const videos=()=>[...section.querySelectorAll('.pair video')],range=section.querySelector('input'),time=section.querySelector('.time');
 section.querySelector('.play').onclick=()=>{const vs=videos(),t=Number(range.value);vs.forEach(v=>{v.currentTime=t;v.play().catch(()=>{});});};
 section.querySelector('.pause').onclick=()=>videos().forEach(v=>v.pause());range.oninput=()=>{const t=Number(range.value);videos().forEach(v=>{v.pause();v.currentTime=t;});time.textContent=t.toFixed(2)+' 秒';};
 videos()[0]?.addEventListener('timeupdate',()=>{const vs=videos(),t=vs[0].currentTime;range.value=t;time.textContent=t.toFixed(2)+' 秒';if(!vs[0].paused)vs.slice(1).forEach(v=>{if(Math.abs(v.currentTime-t)>.12)v.currentTime=t;});});
 $('#groups').append(section);
}
</script></html>'''

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--experiment',required=True);parser.add_argument('--out',required=True);args=parser.parse_args();build(args.experiment,args.out)

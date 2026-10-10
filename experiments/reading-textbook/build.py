#!/usr/bin/env python3
"""Build a local, static reading experiment. No model call and no source mutation."""
import argparse
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import subprocess
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
COURSE = Path("计算机/人工智能/大模型/Stanford-CS336-从头构建大语言模型")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def e(value):
    return html.escape(str(value), quote=True)


def svg(kind, stage):
    """Text-accessible static fallback, derived independently from the same inputs."""
    items = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 360" role="img">',
             '<rect width="840" height="360" fill="#f6f3ed"/>']
    def label(x, y, text, size=18):
        items.append(f'<text x="{x}" y="{y}" text-anchor="middle" fill="#24313a" font-size="{size*1.5}" font-family="sans-serif">{e(text)}</text>')
    if kind == "tensor":
        for i in range(24):
            b, h, d = i // 8, i % 8 // 4, i % 4
            if stage == 0:
                x, y = 170 + (i % 8)*70, 65+b*55
            elif stage == 1:
                x, y = 80+b*260+d*52, 80+h*65
            else:
                x, y = 165+h*340+d*52, 65+b*55
            color = "#d4e6f3" if h == 0 else "#cddfd2"
            items.append(f'<rect x="{x}" y="{y}" width="44" height="42" rx="7" fill="{color}"/>')
            label(x+22,y+27,i+1)
        label(420, 245, "shape " + ("[3,8]" if stage == 0 else "[3,2,4]" if stage == 1 else "[2,3,4]"))
        for i in range(24):
            x, y = 80 + (i%12)*56, 260 + (i//12)*31
            color = '#e1b987' if stage == 3 and i == 8 else '#d4e6f3' if i % 8 < 4 else '#cddfd2'
            items.append(f'<rect x="{x}" y="{y}" width="50" height="27" rx="3" fill="{color}"/>')
            label(x+25,y+22,i+1,16)
        label(420, 346, "存储地址顺序固定；逻辑分组变化不等于物理复制",13)
    elif kind == "softmax":
        z = [3,2,3] if stage == 3 else [1,2,3]
        ex = [math.exp(v-max(z)) for v in z]
        p = [v/sum(ex) for v in ex]
        values = z if stage == 0 else ex if stage == 1 else p
        scale = 48 if stage == 0 else 160
        for i, v in enumerate(values):
            x, height = 180+i*200, v*scale
            items.append(f'<rect x="{x}" y="{240-height}" width="110" height="{height}" rx="7" fill="{["#a8c9e2","#afc9b5","#dfa894"][i]}"/>')
            label(x+55,270,f"{v:.4f}")
            label(x+55,300, f"候选 {i+1}",16)
        label(420,40,["原始分数","指数值","概率（总和为 1）","改变一个分数后的概率"][stage])
    else:
        nbytes = [1000,1000,100,50][stage]
        memory, compute = nbytes/10, 10
        for y, v, color, name in [(85,100 if stage == 0 else compute,"#a8c9e2","计算"),(170,100 if stage == 0 else memory,"#afc9b5","搬运")]:
            items.append(f'<rect x="180" y="{y}" width="{v*4.8}" height="48" rx="7" fill="{color}"/>')
            label(95,y+30,name)
            label(745,y+30,('1000 FLOPs' if name=='计算' else '1000 Bytes') if stage == 0 else f"{v:g} ms")
        label(420,275,'1000 FLOPs / 1000 Bytes = 1 FLOP/Byte' if stage == 0 else f"I = {1000/nbytes:g} FLOP/Byte · 简化总时间 ≈ {max(memory,compute):g} ms")
        label(420,315,"假想机器；充分重叠的简化估计；不是实测",16)
    items.append('</svg>')
    return ''.join(items)


def build(output, courses, zanim, npm):
    content = json.loads((HERE / 'content.json').read_text())
    lock = json.loads((HERE / 'bindings.lock.json').read_text())
    if digest((HERE/'content.json').read_bytes()) != lock['content_sha256']:
        raise ValueError('authored content changed: review paragraph/state mapping before refreshing bindings.lock.json')
    output.mkdir(parents=True, exist_ok=True)
    (output/'static').mkdir(exist_ok=True)
    provenance = {"schema": 1, "content_sha256": digest((HERE/'content.json').read_bytes()), "sources": [], "bindings": []}
    sections = []
    course_sha = subprocess.check_output(['git','-C',str(courses),'rev-parse','HEAD'],text=True).strip()
    zanim_sha = subprocess.check_output(['git','-C',str(zanim),'rev-parse','HEAD'],text=True).strip()
    for unit in content['units']:
        candidates = list((courses/COURSE).glob(unit['source']['glob']))
        if len(candidates) != 1:
            raise ValueError(f"source ambiguous or missing: {unit['source']['glob']}")
        path = candidates[0]
        raw = path.read_bytes()
        frozen = [s for s in lock['sources'] if s['unit'] == unit['id']]
        if len(frozen) != 1 or digest(raw) != frozen[0]['file_sha256']:
            raise ValueError('source changed: disable binding until a new source review')
        lines = raw.decode('utf-8').splitlines()
        start, end = unit['source']['start'], unit['source']['end']
        if not (1 <= start <= end <= len(lines)):
            raise ValueError('source line range invalid')
        excerpt = '\n'.join(lines[start-1:end])
        url = 'https://github.com/LINJIANG12/video2book-courses/blob/' + course_sha + '/' + quote(str(path.relative_to(courses))) + f'#L{start}'
        provenance['sources'].append({"unit": unit['id'], "path": str(path.relative_to(courses)), "commit": course_sha, "file_sha256": digest(raw), "lines": [start,end], "excerpt_sha256": digest(excerpt.encode()), "url": url})
        paragraphs = []
        for p in unit['paragraphs']:
            if not 0 <= p['state'] < len(unit['states']):
                raise ValueError('unknown state')
            provenance['bindings'].append({"id": p['id'], "text_sha256": digest(p['text'].encode()), "unit": unit['id'], "state": p['state'], "time": unit['states'][p['state']]['time']})
            paragraphs.append(f'<p id="{e(p["id"])}" class="reading-step" tabindex="0" data-unit="{e(unit["id"])}" data-stage="{p["state"]}" aria-describedby="{e(unit["id"])}-caption"><span class="step-index" aria-hidden="true">{p["state"]+1:02d}</span>{e(p["text"])}</p>')
        for stage in range(len(unit['states'])):
            (output/'static'/f'{unit["id"]}-{stage}.svg').write_text(svg(unit['id'], stage))
        refs = ' · '.join(f'<a href="{e(r["url"])}" target="_blank" rel="noopener">{e(r["label"])}</a>' for r in unit['references'])
        sections.append(f'''<section class="reading-unit" id="{e(unit['id'])}">
          <header class="unit-heading"><span class="chapter-number">{e(unit['number'])}</span><h2>{e(unit['title'])}</h2><p>{e(unit['intro'])}</p></header>
          <figure class="mechanism" data-unit="{e(unit['id'])}" data-stage="0">
            <div class="figure-meta"><span>{e(unit['title'])}</span><span class="state-name">{e(unit['states'][0]['name'])}</span></div>
            <div class="canvas-wrap"><img class="fallback" src="static/{e(unit['id'])}-0.svg" alt="{e(unit['states'][0]['caption'])}"><canvas role="img" aria-label="{e(unit['states'][0]['caption'])}"></canvas></div>
            <figcaption id="{e(unit['id'])}-caption">{e(unit['states'][0]['caption'])}</figcaption>
            <div class="state-track" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i></div>
          </figure>
          <div class="reading-body">{''.join(paragraphs)}</div>
          <p class="formula" data-tex="{e(unit['formula'])}">{e(unit['formula'])}</p>
          <aside class="note"><span>读图提醒</span>{e(unit['correction'])}</aside>
          <details class="question"><summary>{e(unit['question'])}</summary><p>{e(unit['answer'])}</p></details>
          <details class="source"><summary>查看教材选段与出处</summary><p>原文保留；本页讲解和图示为额外编写。<a href="{e(url)}" target="_blank" rel="noopener">固定提交 · 第 {start}–{end} 行</a></p><pre>{e(excerpt)}</pre><p>{refs}</p></details>
        </section>''')
    page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="同一阅读流中的 CS336 可视化教材实验"><title>{e(content['title'])} · 阅读实验</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="vendor/katex/katex.min.css"></head><body>
      <a class="skip" href="#tensor-input">直接进入正文</a>
      <header class="topbar"><a href="#top" class="brand">READ / UNDERSTAND</a><div class="controls"><label>图跟随 <select id="mode" disabled><option value="pointer">光标</option><option value="scroll">阅读位置</option><option value="static">静态对照</option></select></label><button id="pause" disabled aria-pressed="false">暂停跟随</button><button id="text-only" disabled aria-pressed="false">只读文字</button></div></header>
      <main id="top"><header class="book-heading"><p class="eyebrow">阅读实验 · {e(content['subtitle'])}</p><h1>{e(content['title'])}</h1><p class="lead">图不用自己播放。读到哪一段，就停在那一段的意思上。</p><p class="instructions">把光标停在正文上，图会跟随这一段。回读时也能往回看；选字复制时保持静止。触屏可选“阅读位置”，键盘用 Tab 聚焦段落。随时可以暂停。</p><nav class="contents" aria-label="本页目录"><a href="#tensor">01 / 张量的分组</a><a href="#softmax">02 / 共享的分母</a><a href="#intensity">03 / 计算与搬运</a></nav><p id="status" role="status" aria-live="polite">文字与静态图已可阅读。</p></header>
      {''.join(sections)}
      <footer><p>{e(content['authorship'])}</p><p>仅供本机个人学习实验。课程选段遵守原仓库使用说明。没有上传阅读轨迹，也没有浏览器端模型调用。</p><a href="provenance.json">来源与文字绑定记录</a> · <a href="content.json">本页结构</a></footer></main>
      <noscript><p class="noscript">JavaScript 已关闭：正文与静态图仍完整可读，自动跟随不可用。</p></noscript><script type="module" src="app.mjs"></script></body></html>'''
    (output/'index.html').write_text(page)
    for name in ['style.css','app.mjs','controls.mjs','scenes.mjs','math.mjs','content.json']:
        shutil.copy2(HERE/name, output/name)
    shutil.copytree(zanim/'web/src', output/'vendor/zanim/src', dirs_exist_ok=True)
    (output/'vendor/zanim/dist').mkdir(parents=True,exist_ok=True)
    shutil.copy2(zanim/'web/dist/zanim_web_core.wasm', output/'vendor/zanim/dist/zanim_web_core.wasm')
    shutil.copy2(zanim/'LICENSE', output/'vendor/zanim/LICENSE')
    shutil.copytree(npm/'node_modules/katex/dist', output/'vendor/katex', dirs_exist_ok=True)
    provenance['runtime'] = {"zanim_commit": zanim_sha, "wasm_sha256": digest((zanim/'web/dist/zanim_web_core.wasm').read_bytes()), "upstream_modified": False}
    provenance['binding_lock_sha256'] = digest((HERE/'bindings.lock.json').read_bytes())
    (output/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({"output": str(output), "units": len(sections), "bindings": len(provenance['bindings']), "course_commit": course_sha, "zanim_commit": zanim_sha},ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    base = ROOT/'work/reading-textbook'
    parser.add_argument('--output',type=Path,default=ROOT/'outputs/reading-textbook')
    parser.add_argument('--courses',type=Path,default=base/'upstreams/video2book-courses')
    parser.add_argument('--zanim',type=Path,default=base/'upstreams/zanim')
    parser.add_argument('--npm',type=Path,default=base/'node-mirror')
    args = parser.parse_args()
    build(args.output,args.courses,args.zanim,args.npm)

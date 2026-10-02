"""Export a paired run without provider logs; preserve pending artistic judgement."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def export(run, evidence, media):
    comparison=read(run/'comparison.json')
    evidence.mkdir(parents=True,exist_ok=False);media.mkdir(parents=True,exist_ok=False)
    arms=comparison['arms']
    labels=dict(zip(['A','B'],[a['arm'] for a in arms]))
    write(media/'mapping.json',labels)
    rows=[];cards=[]
    for label,arm in labels.items():
        receipt=read(run/arm/'receipt.json')
        safe=evidence/arm;safe.mkdir()
        for version in ['initial','revised','repaired']:
            source=run/arm/version
            if source.exists():
                target=safe/version;target.mkdir()
                for name in ['scene.mjs','brief.json','intent.md','revision.json']:
                    if (source/name).exists():shutil.copyfile(source/name,target/name)
        for name in ['revision-patch.json','repair-patch.json','receipt.json']:
            if (run/arm/name).exists():shutil.copyfile(run/arm/name,safe/name)
        calls=safe/'calls';calls.mkdir()
        for call in (run/arm/'calls').iterdir():
            dest=calls/call.name;dest.mkdir()
            for name in ['prompt.md','schema.json','process.json']:
                if (call/name).exists():shutil.copyfile(call/name,dest/name)
        for version in ['initial','revised','repaired']:
            source=run/arm/f'preview-{version}'
            if not (source/'result.json').exists():continue
            dest=safe/f'preview-{version}';dest.mkdir()
            for name in ['result.json','math.json','locality.json','states.json']:
                if (source/name).exists():
                    if name=='states.json':(dest/name).write_text(json.dumps(read(source/name),ensure_ascii=False,separators=(',',':'))+'\n')
                    else:shutil.copyfile(source/name,dest/name)
            if (source/'preview.mp4').exists():
                shutil.copyfile(source/'preview.mp4',media/f'{label}-{version}.mp4')
            if (source/'samples').exists():
                shutil.copytree(source/'samples',media/f'{label}-{version}-samples')
        source_bytes=receipt.get('initial_source_bytes',0)
        loader=run/arm/'preview-initial/source/loader.html'
        required_bytes=source_bytes+(loader.stat().st_size if loader.exists() else 0)
        if arm=='infra':required_bytes+=(run/'frozen-runtime.mjs').stat().st_size
        calls={c['id']:c for c in receipt['calls']}
        metrics={'arm':arm,'label':label,'status':receipt['status'],
                 'source_bytes':source_bytes,'required_playable_code_bytes':required_bytes,
                 'author_s':calls.get('author',{}).get('wall_s'),
                 'revision_s':calls.get('revision',{}).get('wall_s'),
                 'model_s':receipt.get('model_wall_s'),'arm_s':receipt.get('arm_wall_s'),
                 'patch_bytes':receipt.get('patch_bytes'),
                 'previews':{v:receipt.get(v+'_preview',{}).get('timing',{}).get('total_s') for v in ['initial','revised']},
                 'response_bytes':{c.name:(c/'response.json').stat().st_size for c in (run/arm/'calls').iterdir() if (c/'response.json').exists()},
                 'usage':{c['id']:c['usage'] for c in receipt['calls']},
                 'artistic_acceptance':'pending_user'}
        rows.append(metrics)
        video=media/f'{label}-initial.mp4'
        if video.exists():
            cards.append(f'<article><h2>候选 {label}</h2><video id="{label}" controls playsinline preload="metadata" src="{label}-initial.mp4"></video><p>10 秒，960×540，24 fps。请先看物体、动作和最终关系。</p><details><summary>局部修订预览：原片 4–8 秒</summary><video controls playsinline src="{label}-revised.mp4"></video></details></article>')
        else:cards.append(f'<article><h2>候选 {label}</h2><p>生成或预览失败；保留在报告。</p></article>')
    for name in ['brief.json','environment.json','studio.json','comparison.json','audit.json','frozen-api.md','frozen-runtime.mjs']:
        if (run/name).exists():shutil.copyfile(run/name,evidence/name)
    shutil.copytree(run/'executed-tools',evidence/'executed-tools')
    summary={'arms':rows,'pair_wall_s':comparison['wall_s'],
             'runtime_bytes':(run/'frozen-runtime.mjs').stat().st_size,
             'setup_cost':'runtime/studio/coordinator implementation time was not measured and is excluded from trial wall time',
             'human_intervention':'shared timing feedback specified before generation; no manual edits to either generated candidate',
             'artistic_acceptance':'pending_user; no model score counts as acceptance'}
    write(evidence/'metrics.json',summary)
    (media/'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Concept2Motion 对照</title>
<style>body{margin:28px;background:#111820;color:#e2e7ee;font:16px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px}video{width:100%;background:#000}h1{font-size:24px}p{color:#b8c1cc}button{padding:10px 16px;margin-bottom:20px}details{margin-top:16px}</style>
<h1>两个匿名候选</h1><p>先不读作者解释，观察物体、发生的动作和最终关系。技术检查通过不等于画面被接受。</p><button id="play">同步从头播放</button><main>'''+''.join(cards)+'''</main><script>document.getElementById('play').onclick=()=>{for(const id of ['A','B']){const v=document.getElementById(id);if(v){v.currentTime=0;v.play()}}}</script>''')
    lines=['# 首轮运行时对照：没有证明提速','',
           '本次用已登录的官方 Codex CLI、相同配置模型和显式 low reasoning，独立新上下文完成一对真实生成和一对局部修改。两臂没有工具调用，也没有人工改候选源码。',
           '', '| 指标 | Direct | Infra |','| --- | ---: | ---: |']
    keys=[('初稿模型等待（秒）','author_s'),('局部修改模型等待（秒）','revision_s'),('模型合计（秒）','model_s'),('整臂墙钟（秒）','arm_s'),('初稿源码（字节）','source_bytes'),('含必需运行时代码包（字节）','required_playable_code_bytes'),('修改补丁（字节）','patch_bytes')]
    for title,key in keys:lines.append(f'| {title} | {rows[0].get(key)} | {rows[1].get(key)} |')
    for version,title in [('initial','10 秒预览（秒）'),('revised','4 秒局部预览（秒）')]:
        lines.append(f'| {title} | {rows[0]["previews"][version]:.3f} | {rows[1]["previews"][version]:.3f} |')
    lines += ['',f'两臂顺序执行，总墙钟 {comparison["wall_s"]:.3f} 秒。常驻浏览器启动成本见 studio.json，运行时 {summary["runtime_bytes"]} 字节；初始运行时、工具和协议的人工设计耗时没有测量，不能算成零。',
              '', '结论：本轮 Infra 模型等待更长，源码减少有限；新增 API 本身没有证明端到端提速。Direct 同样可以小补丁修改，不能把小补丁收益单独归给运行时。一个顺序配对样本也无法推总体性能。',
              '', '四个实际 MP4 全片解码、尺寸、帧率、帧数、时长和逐帧源时间核对结果见 audit.json。保存的角度/顶点通过独立代数检查；这不是像素轮廓对应的证明。局部修改检查验证了角度轨迹提前 0.35 秒，以及 [4,8] 秒之外的抽样 PNG 保持一致，不能据此声称区间内全部视觉都未变。',
              '', '两次生成均首稿通过机器检查，没有自然发生的修复案例；不得把这次结果写成自动故障恢复已实测。主代理检查了源码、时间证据和抽样画面；未将抽帧冒充整片视觉观看。用户匿名连续审看待定，没有质量优胜结论。',
              '', '安装/程序检查、真实模型生成、真实渲染、独立代数、媒体解码和艺术审看分开记录。样本不是最终作品；视频、抽帧和依赖留在 ignored outputs/，原始 provider 日志只在 ignored runs/。',
              '', '重现命令（需要 Node/Playwright、FFmpeg/ffprobe 和已登录官方 Codex CLI）：',
              '', '```bash','python3 tools/iterate.py --run runs/new-pair','python3 tools/audit_preview.py --run runs/new-pair','```','']
    (evidence/'REPORT.md').write_text('\n'.join(lines))
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',type=Path,required=True);parser.add_argument('--evidence',type=Path,required=True);parser.add_argument('--media',type=Path,required=True)
    args=parser.parse_args();result=export(args.run,args.evidence,args.media)
    print(json.dumps({'pair_wall_s':result['pair_wall_s'],'evidence':str(args.evidence),'media':str(args.media)}))

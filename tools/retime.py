"""Retiming a registered action creates a new candidate; drawing source stays intact."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import tempfile


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def retime(scene, result, action, shift, out):
    scene,out=Path(scene).resolve(),Path(out).resolve()
    if out.exists() or out.is_relative_to(scene):raise ValueError('New output must be outside the source')
    if type(shift) not in (int,float) or not math.isfinite(shift) or shift==0:
        raise ValueError('Shift must be a finite nonzero number')
    if result.get('status') not in ('preview_ready','samples_ready'):
        raise ValueError('Retiming requires a measured candidate')
    meta=result['meta'];intervals=meta.get('timings',{})
    if action not in intervals:raise ValueError('Action is not registered in this candidate')
    sources={};seen=set()
    for entry in result['sources']:
        name=entry['path']
        if not isinstance(name,str) or not name or '\\' in name or PurePosixPath(name).is_absolute() or any(p in ('','..','.') for p in name.split('/')) or name in seen:
            raise ValueError('Source asset paths must be unique normalized relative paths')
        seen.add(name)
        if name.startswith('runtime/'):continue
        asset=scene/name
        if not asset.resolve().is_relative_to(scene) or any(p.is_symlink() for p in [asset,*asset.parents] if p.is_relative_to(scene)):
            raise ValueError('Source asset escaped the candidate or used a symlink')
        sources[name]=entry['sha256']
    if 'scene.mjs' not in sources:raise ValueError('Measured source manifest needs scene.mjs')
    for name,expected in sources.items():
        if sha(scene/name)!=expected:raise ValueError('Stale candidate hash')
    interval=intervals[action];start,end=interval['start']+shift,interval['end']+shift
    if start<0 or end>meta['duration']:raise ValueError('Retimed action must stay inside the scene')
    overrides=json.loads((scene/'timing.json').read_text()) if (scene/'timing.json').exists() else {}
    overrides[action]={'start':round(start,12),'end':round(end,12)}
    out.parent.mkdir(parents=True,exist_ok=True)
    temp=Path(tempfile.mkdtemp(prefix='.c2m-retime-',dir=out.parent))
    try:
        for name in sources:
            if (scene/name).is_symlink():raise ValueError('Symlink assets are unsupported')
            target=temp/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(scene/name,target)
        (temp/'timing.json').write_text(json.dumps(overrides,indent=2)+'\n')
        record={'kind':'registered_action_retime','action':action,'shift_s':shift,
                'before':interval,'after':overrides[action],
                'source_hashes':sources,'scene_source_unchanged':sha(temp/'scene.mjs')==sha(scene/'scene.mjs'),
                'timing_sha256':sha(temp/'timing.json'),'model_calls':0,
                'verification':'not rendered; no artistic verdict'}
        (temp/'revision.json').write_text(json.dumps(record,indent=2)+'\n')
        temp.rename(out)
    except BaseException:
        shutil.rmtree(temp);raise
    return record


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene',type=Path,required=True);parser.add_argument('--result',type=Path,required=True)
    parser.add_argument('--action',required=True);parser.add_argument('--shift',type=float,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(retime(args.scene,json.loads(args.result.read_text()),args.action,args.shift,args.out)))

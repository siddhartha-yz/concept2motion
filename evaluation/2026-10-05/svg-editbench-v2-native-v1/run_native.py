"""Run pinned upstream functions; never import provider or neural weight entrypoints."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
SOURCE = ROOT / 'work/full-reproduction-v1/upstreams/SVGEditBenchV2'
RUN = ROOT / 'work/full-reproduction-v1/svg-native-run-v1'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def save(name, value):
    path = EVIDENCE / name
    if path.exists():
        raise FileExistsError(path)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def stage(label, script, *args):
    start = time.perf_counter()
    with (RUN / f'{label}.log').open('w') as log:
        process = subprocess.run([sys.executable, str(SOURCE / 'src' / script), *map(str, args)],
                                 cwd=RUN, stdout=log, stderr=subprocess.STDOUT)
    result = {'exit_code': process.returncode, 'elapsed_seconds': time.perf_counter()-start,
              'source_sha256': digest(SOURCE / 'src' / script), 'log_sha256': digest(RUN / f'{label}.log')}
    save(f'{label}.json', result)
    if process.returncode:
        raise RuntimeError(label)


def main():
    pin = json.loads((EVIDENCE / 'source-pin.json').read_text())
    actual_pin = subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD'], text=True).strip()
    assert actual_pin == pin['commit']
    for sub in pin['submodules']:
        actual = subprocess.check_output(['git', '-C', str(SOURCE / sub['path']), 'rev-parse', 'HEAD'], text=True).strip()
        assert actual == sub['commit'], (sub['path'], actual)
    assert digest(SOURCE / 'assets/dataset.json') == pin['dataset_sha256']
    RUN.mkdir(parents=True, exist_ok=False)
    (RUN / 'assets').symlink_to(SOURCE / 'assets', target_is_directory=True)
    (RUN / 'datasets').symlink_to(SOURCE / 'datasets', target_is_directory=True)
    stage('rasterize-native-v1', '1_rasterize_images.py', 'data', 64)
    stage('restore-native-v1', 'restore_dataset.py', 'data')
    tasks = json.loads((SOURCE / 'assets/dataset.json').read_text())
    missing = []
    inventory = hashlib.sha256()
    for task in tasks:
        directory = RUN / 'triplets' / f"{task['id']:04}"
        for filename in ['before.svg', 'after.svg', 'before.png', 'after.png', 'instruction.txt', 'metadata.json']:
            file = directory / filename
            if not file.is_file():
                missing.append(str(file.relative_to(RUN)))
            else:
                inventory.update(f'{task["id"]:04}/{filename}\0{digest(file)}\n'.encode())
    save('dataset-coverage-v1.json', {'expected_tasks': 1683, 'restored_directories': len(list((RUN / 'triplets').iterdir())),
         'expected_files_per_task': 6, 'missing_files': missing, 'sorted_task_file_hash_stream_sha256': inventory.hexdigest(),
         'restored_svg_count': len(list((RUN / 'triplets').glob('*/*.svg'))),
         'all_rasterized_png_count': len(list((RUN / 'data').glob('*.png')))})
    assert len(tasks) == 1683 and not missing
    nop = load('native_nop', SOURCE / 'src/inference/nop.py')
    mse = load('native_mse', SOURCE / 'src/evaluation/mse.py')
    chamfer = load('native_chamfer', SOURCE / 'src/evaluation/chamfer.py')
    from cairosvg import svg2png
    import cv2
    import numpy as np
    config = dict(output_width=224, output_height=224, parent_width=224, parent_height=224, background_color='white')
    refs = RUN / 'ref_png'; refs.mkdir()
    for task in tasks:
        ident = f"{task['id']:04}"
        svg2png(url=str(RUN / 'triplets' / ident / 'after.svg'), write_to=str(refs / f'{ident}.png'), **config)
    results = {}
    for label, func in [('nop', nop.nop_inference), ('perfect', nop.pefect_inference)]:
        start = time.perf_counter()
        out = RUN / label
        func(str(RUN / 'triplets'), str(out))
        pngs = RUN / f'{label}_png'; pngs.mkdir()
        for file in sorted(out.glob('*.svg')):
            svg2png(url=str(file), write_to=str(pngs / f'{file.stem}.png'), **config)
        values = mse.calculate_MSE(str(pngs), str(refs))
        contour_values = {}
        for ident in ['0000', '0001', '0002']:
            try:
                value = chamfer.chamfer_distance(str(out / f'{ident}.svg'), str(RUN / 'triplets' / ident / 'after.svg'), 100)
                contour_values[ident] = {'value': value if math.isfinite(value) else None, 'error': None}
            except Exception as error:
                contour_values[ident] = {'value': None, 'error': type(error).__name__ + ': ' + str(error)}
        results[label] = {'model_generation': False, 'expected_tasks': 1683, 'svg_count':len(list(out.glob('*.svg'))),
                          'mse_count':len(values), 'mse_nonfinite':sum(not math.isfinite(v) for v in values.values()),
                          'mse_mean': float(np.mean(list(values.values()))), 'mse_by_task':values,
                          'chamfer_expected_tasks':3, 'chamfer':contour_values, 'elapsed_seconds':time.perf_counter()-start}
    save('native-baselines-v1.json', {'raster_config':config, 'baseline_results':results,
                                     'source_sha256':{name:digest(SOURCE / 'src' / name) for name in ['inference/nop.py','evaluation/mse.py','evaluation/chamfer.py']},
                                     'neural_metrics_executed':False, 'original_full_entrypoint_executed':False})
    controls = RUN / 'controls'; controls.mkdir()
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="10" y="20" width="20" height="10" fill="{color}"/></svg>'
    red=controls/'red.svg'; blue=controls/'blue.svg'; blank=controls/'blank.svg'
    red.write_text(svg.format(color='red')); blue.write_text(svg.format(color='blue'))
    blank.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>')
    control_results = {}
    for label, first, second in [('identical',red,red),('color_only',red,blue),('blank',blank,red)]:
        try:
            value=chamfer.chamfer_distance(str(first),str(second),100)
            control_results[label]={'value':value if math.isfinite(value) else None,'error':None}
        except Exception as error:
            control_results[label]={'value':None,'error':type(error).__name__+': '+str(error)}
    rotate='rotate(90 10 20)'
    original=chamfer.parse_transform(rotate)
    expected=np.array([[0,-1,30],[1,0,10],[0,0,1]],dtype=float)
    point=np.array([10,20,1],dtype=float)
    control_results['rotate_center']={'transform':rotate,'point':point.tolist(), 'expected_point':point.tolist(),
        'native_point':(original@point).tolist(),'expected_matrix':expected.tolist(),'native_matrix':original.tolist(),
        'max_matrix_error':float(np.abs(expected-original).max())}
    rotated=controls/'rotated.svg'
    rotated.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="10" cy="20" r="2" transform="rotate(90 10 20)"/></svg>')
    svg2png(url=str(rotated),write_to=str(controls/'rotated.png'),**config)
    image=cv2.imread(str(controls/'rotated.png'))
    ys,xs=np.where(np.all(image<128,axis=2))
    control_results['rotate_center']['cairo_dark_pixel_centroid']=[float(xs.mean()),float(ys.mean())]
    control_results['rotate_center']['expected_pixel_center_continuous']=[10*224/64-0.5,20*224/64-0.5]
    for file in [red,blue,blank]:
        svg2png(url=str(file),write_to=str(file.with_suffix('.png')),**config)
    from PIL import Image, ImageDraw
    sheet=Image.new('RGB',(224*4,250),'white')
    draw=ImageDraw.Draw(sheet)
    for i,(file,label) in enumerate([(red,'red'),(blue,'blue: same contour'),(blank,'blank'),(rotated,'rotate about center')]):
        sheet.paste(Image.open(file.with_suffix('.png')).convert('RGB'),(i*224,26));draw.text((i*224+5,5),label,fill='black')
    sheet.save(controls/'contact.png')
    save('native-metric-controls-v1.json', {'hand_controls':4,'results':control_results,
         'contact_sha256':digest(controls/'contact.png'),'artistic_or_learning_review':False})
    print('native data/baselines/controls complete',flush=True)


if __name__=='__main__':
    main()

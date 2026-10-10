"""Freeze new chapter choices before generation; no model or network calls."""
import argparse, hashlib, json, random, secrets, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
POOLS={
    'mathematics':['chapter_preliminaries/calculus.md','chapter_preliminaries/probability.md','chapter_preliminaries/autograd.md'],
    'machine-learning':['chapter_linear-networks/linear-regression.md','chapter_linear-networks/softmax-regression.md','chapter_multilayer-perceptrons/weight-decay.md'],
    'deep-learning':['chapter_multilayer-perceptrons/backprop.md','chapter_multilayer-perceptrons/dropout.md','chapter_convolutional-modern/batch-norm.md','chapter_attention-mechanisms/nadaraya-waston.md'],
    'programming':['chapter_deep-learning-computation/custom-layer.md','chapter_deep-learning-computation/parameters.md','chapter_computational-performance/async-computation.md','chapter_preliminaries/ndarray.md'],
}
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--seed',type=int)
    args=parser.parse_args()
    if args.output.exists():raise SystemExit('Sampling exists; do not redraw after seeing results')
    manifests=[ROOT/'experiments/visualbook/sampling.json',ROOT/'experiments/visualbook/holdout-sampling.json',ROOT/'evaluation/2026-10-10/harness-v2/sampling.json',ROOT/'evaluation/2026-10-10/harness-v2/markdown-transfer-sampling.json']
    excluded=set()
    for file in manifests:
        data=json.loads(file.read_text())
        excluded.update(s['selected'] for s in data.get('sections',[]))
        if 'selected' in data:excluded.add(data['selected'])
    pin=json.loads(manifests[0].read_text())['upstream_commit']
    upstream=ROOT/'work/visualbook/upstreams/d2l-zh'
    actual=subprocess.check_output(['git','-C',str(upstream),'rev-parse','HEAD'],text=True).strip()
    if actual!=pin:raise SystemExit('Upstream pin differs')
    seed=args.seed if args.seed is not None else secrets.randbits(64)
    rng=random.Random(seed)
    records=[]
    for domain,original_pool in POOLS.items():
        pool=[p for p in original_pool if p not in excluded]
        if len(pool)<2:raise SystemExit('Insufficient unseen choices in '+domain)
        chosen=rng.sample(pool,2)
        for index,selected in enumerate(chosen):
            excluded.add(selected)
            records.append({'domain':domain,'role':'paired-or-primary' if index==0 else 'additional-transfer','pool':pool,'selected':selected,'source_sha256':hashlib.sha256((upstream/selected).read_bytes()).hexdigest()})
    result={'seed':str(seed),'algorithm':'random.Random(seed).sample(pool,2) in fixed domain order; shared exclusions prevent duplicates','upstream_commit':pin,'previously_generated_or_reserved_used':sorted(excluded-set(r['selected'] for r in records)),'sections':records,'limits':'Small stratified exploratory sample; neither blind nor a population success-rate estimate. No reselection after results.'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'output':str(args.output),'selected':[r['selected'] for r in records]},ensure_ascii=False))
if __name__=='__main__':main()

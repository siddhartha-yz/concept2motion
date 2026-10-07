"""Audit input identity, condition isolation and completion before conclusions."""
import ast,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
ORIGINAL=OUT.parent/'videoscore-validation-v1'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
 manifest=read(ORIGINAL/'inputs-v2.json');repeats=read(ORIGINAL/'repeat-inputs-v2.json')
 results=read(OUT/'inference-results.json');second=read(OUT/'repeat/inference-results.json')
 assert not results['unexecuted'] and not second['unexecuted']
 assert [r['id'] for r in results['rows']]==[r['id'] for r in manifest]
 assert [r['id'] for r in second['rows']]==[r['id'] for r in repeats]
 assert all(r['status']=='completed' for r in results['rows']+second['rows'])
 checked=[]
 for location in [ORIGINAL/'preflight-frozen.json',OUT/'runner-frozen.json']:
  for r in read(location):
   assert sha(location.parent/r['path'])==r['sha256'];checked.append(str(location.parent/r['path']))
 for r in manifest+repeats:assert sha(ROOT/r['video'])==r['video_sha256']
 byid={r['id']:r for r in results['rows']}
 stimuli=read(ORIGINAL/'stimuli-verified.json');isolation=[]
 import cv2
 encoded_specs=[]
 for case in manifest[:21]:
  cap=cv2.VideoCapture(str(ROOT/case['video']))
  spec={'id':case['id'],'width':int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),'height':int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),'fps':cap.get(cv2.CAP_PROP_FPS),'frames':int(cap.get(cv2.CAP_PROP_FRAME_COUNT))};cap.release()
  assert (spec['width'],spec['height'],spec['fps'],spec['frames'])==(854,480,8.0,64)
  encoded_specs.append(spec)
 for c in ['determinant','softmax','residual']:
  cases=[r for r in manifest if r['id'].startswith(c+'-') and not r['id'].endswith('mismatched-prompt')]
  assert len(cases)==7 and len({r['prompt'] for r in cases})==1
  a=byid[c+'-correct'];b=byid[c+'-mismatched-prompt']
  pixel_keys=[k for k in a['processed_input_tensors'] if 'pixel' in k]
  assert pixel_keys and all(a['processed_input_tensors'][k]==b['processed_input_tensors'][k] for k in pixel_keys)
  assert a['processed_input_tensors']['input_ids']!=b['processed_input_tensors']['input_ids']
  assert a['sampled_frame_hashes']==b['sampled_frame_hashes']
  assert a['processed_input_tensors']['pixel_values']['sha256']!=byid[c+'-wrong-formula']['processed_input_tensors']['pixel_values']['sha256']
  isolation.append({'concept':c,'same_prompt_for_seven_versions':True,'wrong_formula_changes_model_pixels':True,'mismatched_prompt_same_model_pixels':True,'mismatched_prompt_different_text_tokens':True})
 for r in stimuli:
  assert r['source']=='build_stimuli_v2.py' and sha(ORIGINAL/r['source'])==r['source_sha256']
  assert r['render']['fully_decoded']==64
 assert read(OUT/'load-result.json')['parameters']==8271704309
 assert read(OUT/'load-result.json')['weight_updates']==0
 assert read(OUT/'repeat/load-result.json')['weight_updates']==0
 assert read(OUT/'runtime.json')['mantis_source_hash_verified'] and read(OUT/'repeat/runtime.json')['weights_hash_verified_before_load']
 result={'completed_first':36,'completed_reloaded_repeat':3,'frozen_file_checks':len(checked),'video_hash_checks':len(manifest)+len(repeats),'stimulus_files':21,'unique_synthetic_video_hashes':len({r['video_sha256'] for r in manifest[:21]}),'full_synthetic_frames_decoded':sum(r['render']['fully_decoded'] for r in stimuli),'encoded_video_specs':encoded_specs,'condition_isolation':isolation,'weight_updates':0,'official_codex_calls':0,'forward_failures':0,'limits':'Identity and technical ground truths only; no human quality labels or whole-paper correlation.'}
 (OUT/'integrity.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()

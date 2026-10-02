"""Small, bounded subscription author → warm preview → exact local revision loop.

Provider logs remain under ignored runs/. No artistic acceptance is automated.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import selectors
import time
from types import SimpleNamespace
import urllib.request
import urllib.error

from batch import model_call, save, load, digest, ROOT
from apply_edit import apply
from retime import retime

AUTHOR = {"type": "object", "additionalProperties": False,
          "properties": {k: {"type": "string"} for k in ("source", "intent")},
          "required": ["source", "intent"]}
EDIT = {"type": "object", "additionalProperties": False, "properties": {
    "files": {"type": "array", "items": {"type": "object", "additionalProperties": False,
        "properties": {"path": {"type": "string"}, "sha256": {"type": "string"},
            "edits": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                "properties": {"old": {"type": "string"}, "new": {"type": "string"}},
                "required": ["old", "new"]}}}, "required": ["path", "sha256", "edits"]}}},
    "required": ["files"]}
SAMPLES = [0, .8, 1.8, 2.8, 4.8, 5.2, 6.2, 7.2, 9.8]
CLIENT_CONFIG = ['model_reasoning_effort="low"',
                 'mcp_servers.cua_repl={command="true",enabled=false}',
                 'mcp_servers.node_repl={command="true",enabled=false}']


def author_prompt(brief, arm, api):
    interface = ("export function createScene(canvas) returns {meta:{width:1920,height:1080,duration:10},render(t)}. "
                 "Implement original Canvas2D drawing and explicit-time complete redraw yourself. No imports."
                 if arm == "direct" else
                 "export function createScene(rt) returns rt.scene(...). Use the frozen reusable runtime below; "
                 "you may import helpers ONLY from './runtime/concept-runtime.mjs' or use rt.tween, rt.envelope etc.\n" + api)
    timing_contract = ("Put firstStart:0.8, firstEnd:2.8, secondStart:5.2, secondEnd:7.2 in one top-level C object."
                       if arm=='direct' else
                       "Inside createScene register rt.timings({'turn-one':{start:0.8,end:2.8},'turn-two':{start:5.2,end:7.2}}). "
                       "Derive all first/second rotation intervals and attached marker intervals from this returned dictionary. "
                       "The host supplies timing.json overrides; never read timing.json yourself or bake overrides into geometry.")
    return f"""Create an original mathematical motion scene. This is an authorized isolated benchmark.
Return structured source and short intent only. Do not use any tools, inspect files, browse,
spawn agents or invoke another model. All inputs are here. Keep code concise, not minified.
Write one ES module scene.mjs. No playback loop: host renders arbitrary t deterministically.
Choose an appealing composition, restrained typography and visible object motion; explain by
geometry and temporal correspondence. You may use offscreen canvas and custom shapes.
{timing_contract}
Derive second-action attached arcs/markers from these values, for future local edits.
After each render return mechanism: {{angle:<actual accumulated drawn rotation, radians>,
referenceAngle:0, vertices:[{{x,y}},...six actual local unit tip coordinates]}}.
For the runtime return it from shot.draw. Keep this evidence faithful to drawn geometry.
Instrumentation does not establish artistic quality. All asset generation is your own code.

Same frozen brief for both arms:
{json.dumps(brief,ensure_ascii=False)}

Arm interface:
{interface}
"""


def edit_prompt(source, feedback, api=""):
    return f"""Apply this concrete feedback as a minimal exact-match edit to scene.mjs.
Return only the patch JSON. Do not use tools, read files or invoke another model.
Do not regenerate the scene, change unrelated visuals, or weaken evidence/validators.
The old string of each edit must occur exactly once. sha256 is the current file hash.
Feedback: {feedback}
Current sha256: {hashlib.sha256(source.encode()).hexdigest()}
Current scene.mjs:
{source}
Frozen interface (if present):
{api}
"""


def mechanism_checks(states, revised=False):
    """Recompute algebra from reported poses/vertices; pixels/art remain separate."""
    findings = []
    trajectory=[]
    for state in states:
        t = state.get("time_s",state.get("time", state.get("t")))
        if type(t) not in (int,float) or not math.isfinite(t) or not 0<=t<=10:
            findings.append({"code":"invalid_sample_time"});continue
        evidence = state.get("evidence", state.get("state", state))
        if not isinstance(evidence,dict):
            findings.append({'time':t,'code':'missing_mechanism_evidence'});continue
        m = evidence.get("mechanism", {})
        angle, vertices = m.get("angle"), m.get("vertices")
        if type(angle) not in (int, float) or not math.isfinite(angle):
            findings.append({"time": t, "code": "missing_finite_angle"}); continue
        trajectory.append((t,angle))
        target = 0 if t <= .8 else math.pi / 3 if 2.8 <= t < (4.85 if revised else 5.2) else 2*math.pi/3 if t >= (6.85 if revised else 7.2) else None
        if target is not None and abs(angle-target) > 1e-6:
            findings.append({"time": t, "code": "rotation_endpoint", "actual": angle, "expected": target})
        if not -1e-6<=angle<=2*math.pi/3+1e-6 or (t<2.8 and angle>math.pi/3+1e-6) or (t>=2.8 and angle<math.pi/3-1e-6):
            findings.append({'time':t,'code':'rotation_range','actual':angle})
        if not isinstance(vertices, list) or len(vertices) != 6:
            findings.append({"time": t, "code": "need_six_actual_tips"}); continue
        try:
            points = [(float(p["x"]), float(p["y"])) for p in vertices]
            if any(not math.isfinite(v) for p in points for v in p) or len(set(points)) != 6:
                raise ValueError("nonfinite or duplicate tips")
            if any(abs(math.hypot(x,y)-1) > 1e-6 for x,y in points):
                raise ValueError("tips are not normalized")
            for theta in (math.pi/3, 2*math.pi/3):
                c,s = math.cos(theta), math.sin(theta)
                if any(min(math.hypot(c*x-s*y-u,s*x+c*y-v) for u,v in points) > 1e-6 for x,y in points):
                    raise ValueError("tip set lacks sixfold symmetry")
        except (KeyError, ValueError, TypeError) as error:
            findings.append({"time": t, "code": "tip_geometry", "detail": str(error)})
        if type(m.get("referenceAngle")) not in (int,float) or m.get("referenceAngle") != 0:
            findings.append({"time": t, "code": "moving_reference"})
    trajectory.sort()
    for (t0,a0),(t1,a1) in zip(trajectory,trajectory[1:]):
        if a1<a0-1e-6:findings.append({'time':t1,'code':'rotation_reversal'})
    return {"scope": "independent algebra on reported actual poses and normalized tip coordinates; not pixel correspondence or artistic review",
            "passed": bool(states) and not findings, "findings": findings}


def revision_checks(before, after):
    """Measured locality and 0.35s motion shift; not an aesthetic verdict."""
    findings=[]
    if len(before.get('frames',[]))!=240 or len(after.get('frames',[]))!=96 or not before.get('samples') or not after.get('samples'):
        return {'passed':False,'findings':[{'code':'missing_revision_evidence'}]}
    if any(abs(f['time_s']-i/24)>1e-7 for i,f in enumerate(before['frames'])) or any(abs(f['time_s']-(4+i/24))>1e-7 for i,f in enumerate(after['frames'])):
        return {'passed':False,'findings':[{'code':'wrong_revision_frame_grid'}]}
    samples={s['time_s']:s for s in before['samples']}
    for sample in after['samples']:
        t=sample['time_s']
        if (t<=4 or t>=8) and samples[t]['sha256']!=sample['sha256']:
            findings.append({'time':t,'code':'unrelated_pixel_drift'})
    frames=before['frames']
    for frame in after['frames']:
        t=frame['time_s']
        angle=frame['state']['mechanism']['angle']
        # Sample a shifted baseline at 24fps with linear interpolation; permit
        # interpolation error, not an unchanged trajectory. Endpoints exact above.
        baseline_t=t+.35 if t>=4.85 else t
        index=baseline_t*24
        lo=min(int(index),len(frames)-1);hi=min(lo+1,len(frames)-1)
        a=frames[lo]['state']['mechanism']['angle'];b=frames[hi]['state']['mechanism']['angle']
        expected=a+(b-a)*(index-lo)
        if abs(angle-expected)>.001:
            findings.append({'time':t,'code':'wrong_revision_trajectory','actual':angle,'expected':expected})
    return {'passed':not findings,'findings':findings,'scope':'motion shift plus unchanged sample pixels outside [4,8]; no artistic verdict'}


def checked_patch(source, patch, out):
    if any(f.get('path')!='scene.mjs' for f in patch.get('files',[])):
        raise ValueError('Candidate revisions may edit scene.mjs only; frozen assets are immutable')
    return apply(source,patch,out)


def preview(url, scene, out, arm, interval=(0,10),deadline=None):
    payload = {"sceneRoot": str(scene), "out": str(out), "arm": arm,
               "from": interval[0], "to": interval[1], "fps": 24, "width": 960, "times": SAMPLES}
    if (out/'result.json').exists():
        result=load(out/'result.json')
        for entry in result.get('sources',[]):
            if entry['path'].startswith('runtime/'):continue
            if digest(scene/entry['path'])!=entry['sha256']:
                raise RuntimeError('Cannot reuse preview: source hash changed')
        request=result['request']
        if any(request[k]!=payload[k] for k in ('arm','from','to','fps','width','times')):
            raise RuntimeError('Cannot reuse preview: render request changed')
        return result
    remaining=min(60,deadline-time.monotonic()) if deadline else 60
    if remaining<1:raise RuntimeError('Render budget exhausted')
    payload['timeoutS']=remaining
    request = urllib.request.Request(url+"/preview", data=json.dumps(payload).encode(),
                                     headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(request, timeout=remaining+2) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        result = json.load(error)
    return result


def call(args, directory, prompt, schema, started):
    if directory.exists():
        if (directory/'prompt.md').read_text()!=prompt or load(directory/'schema.json')!=schema:
            raise RuntimeError('Cannot reuse call: frozen inputs changed')
        process=load(directory/'process.json')
        if process.get('exit_code')!=0 or process.get('timed_out') or process.get('tool_types'):
            raise RuntimeError('Prior model call failed; preserved without an automatic retry')
        print(f'  reuse {directory.name}: no model call',flush=True)
        return load(directory/'response.json')
    remaining = args.budget - (time.monotonic()-started)
    if remaining < 3: raise RuntimeError("Experiment wall-clock budget exhausted")
    return model_call(SimpleNamespace(codex=args.codex,model_timeout=min(args.timeout,remaining),codex_config=CLIENT_CONFIG),
                      directory,prompt,schema)


def run_arm(args, arm, brief, api, root, studio, started):
    arm_started=time.monotonic()
    # Equal wall-clock allowance; one arm cannot consume the other's entire budget.
    args=SimpleNamespace(**vars(args))
    args.budget=min(args.budget-(arm_started-started),args.budget/2)
    deadline_start=arm_started
    deadline=arm_started+args.budget
    folder = root/arm; folder.mkdir(exist_ok=getattr(args,'resume',False))
    receipt = {"arm": arm, "artistic_acceptance": "pending_user", "calls": [], "revisions": []}
    receipt_path=folder/('resume-receipt.json' if getattr(args,'resume',False) else 'receipt.json')
    save(receipt_path, receipt)
    initial = folder/"initial"; initial.mkdir(exist_ok=getattr(args,'resume',False))
    save(initial/"brief.json", brief)
    try:
        frozen_author=root/'frozen-prompts'/f'{arm}.md'
        if frozen_author.exists():prompt=frozen_author.read_text()
        elif getattr(args,'resume',False) and (folder/'calls/author/prompt.md').exists():prompt=(folder/'calls/author/prompt.md').read_text()
        else:
            prompt=author_prompt(brief,arm,api)
            frozen_author.parent.mkdir(exist_ok=True);frozen_author.write_text(prompt)
        response = call(args, folder/"calls"/"author", prompt,AUTHOR,deadline_start)
        if (initial/'scene.mjs').exists() and (initial/'scene.mjs').read_text()!=response['source']:
            raise RuntimeError('Frozen generated source was modified; refusing to overwrite')
        (initial/"scene.mjs").write_text(response["source"])
        (initial/"intent.md").write_text(response["intent"])
        if arm=='infra' and not getattr(args,'resume',False):(initial/'timing.json').write_text('{}\n')
        receipt["initial_source_bytes"] = len(response["source"].encode())
        receipt["initial_source_sha256"] = digest(initial/"scene.mjs")
        if args.generate_only:
            receipt["status"] = "generated_not_rendered"; return receipt
        result = preview(studio,initial,folder/"preview-initial",arm,deadline=deadline)
        frozen_hash=digest(root/'frozen-runtime.mjs')
        if result.get('sources') and not any(s['path']=='runtime/concept-runtime.mjs' and s['sha256']==frozen_hash for s in result['sources']):
            raise RuntimeError('Studio used a different runtime than the frozen experiment')
        receipt["initial_preview"] = result
        all_states=load(folder/"preview-initial"/"states.json") if not result.get('error') else {'frames':[],'samples':[]}
        math_result = mechanism_checks(all_states['frames']+all_states['samples'])
        save(folder/"preview-initial"/"math.json",math_result)
        receipt["initial_math"] = math_result
        # One automatic repair maximum. Feedback comes from measured failure, not a score.
        if result.get('error') or not math_result["passed"]:
            feedback = "Correct only these measured render/mechanism defects: " + json.dumps({'render_error':result.get('error'),'math':math_result['findings'][:20]})
            patch=call(args,folder/"calls"/"repair",edit_prompt((initial/"scene.mjs").read_text(),feedback,api if arm=="infra" else ""),EDIT,deadline_start)
            save(folder/"repair-patch.json",patch)
            repaired=folder/"repaired"
            record=load(repaired/'revision.json') if repaired.exists() else checked_patch(initial,patch,repaired)
            receipt["revisions"].append({"kind":"automatic_mechanism_repair","record":record})
            result=preview(studio,repaired,folder/"preview-repaired",arm,deadline=deadline)
            receipt["repair_preview"]=result
            if result.get("error"): raise RuntimeError(str(result["error"]))
            all_states=load(folder/"preview-repaired"/"states.json")
            fixed=mechanism_checks(all_states['frames']+all_states['samples']);save(folder/"preview-repaired"/"math.json",fixed)
            if not fixed["passed"]:raise RuntimeError("Measured defects remain after bounded repair")
            initial=repaired
        feedback = (Path(args.feedback).read_text() if args.feedback else brief["shared_revision"]["instruction"])
        revised=folder/"revised"
        if getattr(args,'retime_action',None):
            if arm!='infra':raise ValueError('Parameter retiming needs registered Infra actions')
            record=load(revised/'revision.json') if revised.exists() else retime(initial,result,args.retime_action,args.shift,revised)
            patch={'timing':record};feedback=f'Retime {args.retime_action} by {args.shift} seconds'
        else:
            patch=call(args,folder/"calls"/"revision",edit_prompt((initial/"scene.mjs").read_text(),feedback,api if arm=="infra" else ""),EDIT,deadline_start)
            record=load(revised/'revision.json') if revised.exists() else checked_patch(initial,patch,revised)
        save(folder/"revision-patch.json",patch)
        for name,expected_hash in record.get('changed_hashes',{}).items():
            if digest(revised/name)!=expected_hash:raise RuntimeError('Saved revision source hash changed')
        receipt["revisions"].append({"kind":"feedback_local_edit","feedback":feedback,"record":record})
        receipt["patch_bytes"]=len(json.dumps(patch,ensure_ascii=False).encode())
        result=preview(studio,revised,folder/"preview-revised",arm,interval=(4,8),deadline=deadline)
        receipt["revised_preview"]=result
        if result.get("error"):raise RuntimeError(str(result["error"]))
        revised_states=load(folder/"preview-revised"/"states.json")
        checks=mechanism_checks(revised_states['frames']+revised_states['samples'],revised=True);save(folder/"preview-revised"/"math.json",checks)
        locality=revision_checks(all_states,revised_states);save(folder/"preview-revised"/"locality.json",locality)
        receipt['revision_locality']=locality
        receipt["revised_math"]=checks
        receipt["status"]="ready_for_user_review" if checks["passed"] and locality['passed'] else "measured_revision_failure"
    except Exception as error:
        receipt["status"]="failed";receipt["error"]=str(error)
    finally:
        for path in sorted((folder/"calls").glob("*/process.json")):
            receipt["calls"].append({"id":path.parent.name,**load(path)})
        receipt["model_wall_s"]=round(sum(c["wall_s"] for c in receipt["calls"]),3)
        receipt['arm_wall_s']=round(time.monotonic()-arm_started,3)
        save(receipt_path,receipt)
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run",required=True);parser.add_argument("--arm",choices=["both","direct","infra"],default="both")
    parser.add_argument("--brief",default=str(ROOT/"benchmarks/infra-brief.json"))
    parser.add_argument("--codex",default="/usr/lib/chatgpt/resources/codex")
    parser.add_argument("--timeout",type=float,default=120);parser.add_argument("--budget",type=float,default=600)
    parser.add_argument("--studio");parser.add_argument("--feedback");parser.add_argument("--generate-only",action="store_true")
    parser.add_argument('--resume',action='store_true')
    parser.add_argument('--retime-action',help='Optional parameter-only revision; pilot supports turn-two / shift -0.35')
    parser.add_argument('--shift',type=float,default=-.35)
    args=parser.parse_args();root=Path(args.run).resolve()
    if args.retime_action and (args.arm!='infra' or args.retime_action!='turn-two' or abs(args.shift+.35)>1e-9):
        raise ValueError('This benchmark validates turn-two shifted -0.35 only; use retime.py for other registered edits')
    if args.resume:
        brief=load(root/'brief.json');api=(root/'frozen-api.md').read_text()
        environment=load(root/'environment.json')
        if environment['client_sha256']!=digest(Path(args.codex)) or environment['runtime_sha256']!=digest(root/'runtime/concept-runtime.mjs'):
            raise RuntimeError('Cannot resume: client or frozen runtime changed')
        if environment['codex_config']!=CLIENT_CONFIG:raise RuntimeError('Cannot resume: client config changed')
    else:
        root.mkdir(parents=True,exist_ok=False)
        brief=load(Path(args.brief));api=(ROOT/'runtime/API.md').read_text()
        save(root/'brief.json',brief);(root/'frozen-api.md').write_text(api)
        (root/'frozen-runtime.mjs').write_bytes((ROOT/'runtime/concept-runtime.mjs').read_bytes())
        (root/'runtime').mkdir()
        (root/'runtime/concept-runtime.mjs').write_bytes((root/'frozen-runtime.mjs').read_bytes())
        save(root/"environment.json",{"native_client":args.codex,"client_sha256":digest(Path(args.codex)),
        "timeout_s":args.timeout,"experiment_budget_s":args.budget,"codex_config":CLIENT_CONFIG,
        "runtime_sha256":digest(root/"frozen-runtime.mjs"),"acceptance":"pending_user"})
    process=None
    if not args.generate_only and not args.studio:
        process=subprocess.Popen([os.environ.get("C2M_NODE","node"),str(ROOT/"tools/studio.mjs"),"--runtime",str(root/"runtime")],
                                 stdout=subprocess.PIPE,stderr=(root/"studio-private.log").open("w"),text=True)
        selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
        if not selector.select(timeout=15):
            process.kill();process.wait();save(root/'startup-error.json',{'error':'Studio startup exceeded 15 seconds'})
            raise RuntimeError('Studio startup failed; private diagnostic saved')
        line=process.stdout.readline();selector.close()
        try:ready=json.loads(line)
        except ValueError:
            process.terminate();process.wait();raise RuntimeError('Studio failed before ready; private diagnostic saved')
        args.studio=ready["origin"];save(root/('resume-studio.json' if args.resume else 'studio.json'),ready)
    started=time.monotonic();receipts=[]
    try:
        for arm in (["direct","infra"] if args.arm=="both" else [args.arm]):
            print(f"Starting {arm}",flush=True)
            receipts.append(run_arm(args,arm,brief,api,root,args.studio,started))
            print(json.dumps({"arm":arm,"status":receipts[-1]["status"],"model_wall_s":receipts[-1]["model_wall_s"]}),flush=True)
    finally:
        comparison_path=root/('resume-comparison.json' if args.resume else 'comparison.json')
        save(comparison_path,{"wall_s":round(time.monotonic()-started,3),"arms":receipts,
                                   "quality_conclusion":"pending_user; one paired trial cannot prove a general quality advantage"})
        if process:process.terminate();process.wait(timeout=10)


if __name__=="__main__":main()

"""Actual MCP review/identity/motion gates. No model calls."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
if out.exists():
    raise SystemExit("Output exists")
out.mkdir(parents=True)
source = {"title":"运动导出协议控制","sourceSha256":"maintenance-control","blocks":[{"id":"motion-1","raw":"控制","type":"paragraph","html":"<p>维护者协议控制，不是生成教材。</p>","sha256":"maintenance-control","math":{"expected":0}}]}
plan = {"figures":[{"id":"motion","title":"同一对象移动","afterAnchor":"motion-1","height":200,"code":"function draw({board,progress}){board.circle('point',40+200*progress,90,7);return {x:40+200*progress};}"}]}
def write(name,value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n")
write("source.json",source)
write("book.json",plan)
records=[]
with (out/"protocol-stderr.txt").open("w") as err:
    process=subprocess.Popen([sys.executable,str(ROOT/"tools/visualbook_mcp.py"),"--workspace",str(out)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True)
    try:
        def call(name,arguments=None):
            ident=len(records)+1
            process.stdin.write(json.dumps({"jsonrpc":"2.0","id":ident,"method":"tools/call","params":{"name":name,"arguments":arguments or {}}})+"\n")
            process.stdin.flush()
            result=json.loads(process.stdout.readline())["result"]
            records.append({"tool":name,"arguments":arguments or {},"isError":result.get("isError"),"texts":[item["text"] for item in result["content"] if item["type"]=="text"],"imageCount":sum(item["type"]=="image" for item in result["content"])})
            return result
        assert not call("build_book")["isError"]
        assert not call("preview_book",{"label":"first"})["isError"]
        motion={"label":"before-review","id":"motion","width":375,"fps":5,"duration":1,"formats":["mp4"]}
        assert call("export_motion",motion)["isError"]
        assert not list(out.glob("motion-*"))
        for width in [1280,375]:
            for progress in [0,1]:
                assert not call("inspect_frame",{"id":"motion","width":width,"progress":progress})["isError"]
        assert not call("finalize_book",{"issues":[],"mathCheckNote":"核对给定坐标40+200p的端点；维护者控制。","limits":"没有艺术或教学判断。"})["isError"]
        result=call("export_motion",{**motion,"label":"complete"})
        assert not result["isError"],result
        assert records[-1]["imageCount"]==3
        exported=json.loads((out/"motion-complete/report.json").read_text())
        assert exported["status"]=="completed"
        assert exported["outputs"][0]["decodedFrameCount"]==5
        result=call("export_motion",{**motion,"label":"inert","from":0,"to":0})
        assert result["isError"]
        assert json.loads((out/"motion-inert/report.json").read_text())["status"]=="failed"
        assert call("export_motion",{**motion,"label":"third"})["isError"]
        assert not (out/"motion-third").exists()
        plan["figures"][0]["title"]="已改计划"
        write("book.json",plan)
        assert call("export_motion",{**motion,"label":"changed"})["isError"]
        assert not (out/"motion-changed").exists()
    finally:
        process.stdin.close()
        process.wait(timeout=10)
write("control.json",{"kind":"actual MCP protocol, Chromium capture and FFmpeg decode; no models/artistic verdict","passed":True,"modelCalls":0,"calls":records})
print(json.dumps({"passed":True,"calls":len(records),"completedMotion":1,"retainedFailedMotion":1,"modelCalls":0}))

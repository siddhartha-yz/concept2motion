Create an original mathematical motion scene. This is an authorized isolated benchmark.
Return structured source and short intent only. Do not use any tools, inspect files, browse,
spawn agents or invoke another model. All inputs are here. Keep code concise, not minified.
Write one ES module scene.mjs. No playback loop: host renders arbitrary t deterministically.
Choose an appealing composition, restrained typography and visible object motion; explain by
geometry and temporal correspondence. You may use offscreen canvas and custom shapes.
Put firstStart:0.8, firstEnd:2.8, secondStart:5.2, secondEnd:7.2 in one top-level C object;
derive second-action attached arcs/markers from these values, for future local edits.
After each render return mechanism: {angle:<actual accumulated drawn rotation, radians>,
referenceAngle:0, vertices:[{x,y},...six actual local unit tip coordinates]}.
For the runtime return it from shot.draw. Keep this evidence faithful to drawn geometry.
Instrumentation does not establish artistic quality. All asset generation is your own code.

Same frozen brief for both arms:
{"id": "symmetry-compose-10s", "version": 1, "title": "两个动作，还是一个对称", "language": "zh-CN", "duration_s": 10, "width": 1920, "height": 1080, "preview": {"width": 960, "fps": 24}, "audience": "知道旋转是什么、没学过抽象代数的观众", "question": "为什么连续做两次对称动作，仍然是这片雪花的对称？", "takeaway": "六瓣雪花转 60° 后轮廓重合；再转 60° 等同于一次转 120°，轮廓仍重合。", "mechanism": {"kind": "cyclic_rotation_composition", "order": 6, "first_rotation_degrees": 60, "second_rotation_degrees": 60, "composed_rotation_degrees": 120, "angle_convention": "画面顺时针为正；角度为累计角度，不在第二次操作时归零", "claim_scope": "演示六阶旋转对称的一个组合实例，不把实例当成封闭性的完整证明，不引入反射或四条群公理"}, "visual_direction": {"reference": "https://github.com/AnctyEnly453/abstract-algebra-promo", "reference_commit": "5d01a758af8b4b3b7bb5a2a5b7f0efb4cf1667eb", "principle": "一个有细节的具体物体，在有停顿的动作中显出抽象关系；运动本身承担解释。参考对象连续、运动节奏与轮廓重合，不复制源代码或资产。", "hero": "六瓣、六阶旋转对称的雪花。必须能跟踪正在转动的分支；静止的细线残影给出原轮廓。", "composition": "雪花是主体；允许层叠、光效与少量景深感，但它们不能遮掉轮廓重合的证据。第二次动作须让人看出同一物体接续旋转。", "text": "最多两行短字幕和必要的角度/动作标记。字幕辅助解释，不成为读文字的幻灯片。无需标题页。", "style_freedom": "构图、配色、分支细节、光效、运镜、插值和字幕位置由作者选择；不得用固定仪表板替代主要运动。"}, "beats": [{"id": "establish", "start_s": 0, "end_s": 0.8, "purpose": "看清原轮廓与主体；不先抛抽象术语"}, {"id": "turn-one", "start_s": 0.8, "end_s": 2.8, "purpose": "累计旋转 0° → 60°；运动中能跟踪分支，终点轮廓重新重合"}, {"id": "recognize", "start_s": 2.8, "end_s": 5.2, "purpose": "停顿让观众识别轮廓未变，并准备第二个同类动作"}, {"id": "turn-two", "start_s": 5.2, "end_s": 7.2, "purpose": "同一物体累计旋转 60° → 120°；让两次操作与合成的 120° 对应"}, {"id": "resolve", "start_s": 7.2, "end_s": 10, "purpose": "稳定呈现重合轮廓与两个 60° 合成 120° 的关系，观众有时间看清结论"}], "hard_constraints": ["离线、自包含或使用随候选冻结的本地资源；不依赖外网、墙钟和未固定随机数。", "显式时间渲染；相同 t 必须可重绘，duration 固定为 10 秒。", "主体轮廓满足六阶旋转对称；两个端点操作为累计 60°、120°；不存在瞬间归零、第三次操作或反射。", "移动轮廓和静止参照轮廓在旋转期间可区分，在操作终点可看出重合。", "候选必须保存 brief、可编辑源码或场景规格、预览、来源和修改记录；预览不标记为最终艺术通过。"], "shared_revision": {"id": "second-turn-earlier", "instruction": "只把第二次 60° 旋转整体提前 0.35 秒：起止从 5.2–7.2 秒改为 4.85–6.85 秒，旋转时长保持 2 秒；直接依附此动作的箭头或动作标记同步提前。其余物体、配色、几何、第一段动作、字幕内容、运镜与总时长保持原样。终点留到 10 秒，因此第二次旋转后的观看停顿多 0.35 秒。", "allowed_scope": ["turn-two 的起止时间", "直接依附 turn-two 的动作标记时间", "因第二次动作提前而增加的终点停顿"], "preserve": ["第一段 0° → 60° 动作", "六瓣雪花几何", "全部字幕文字", "配色", "构图", "摄像机轨迹", "10 秒总时长"], "purpose": "测量同一具体局部修订的生成耗时、补丁大小和局部性；这条人为指定改动不代表艺术质量提高"}, "review_questions": ["不看作者说明，复述物体、发生的动作和最终关系。", "在连续运动中，是否能跟踪一次动作结束、第二次接续，以及两次操作合成 120°？给出时间点。", "主体与残影是否在终点真实重合，还是仅由字幕声称？", "如果去掉字幕，主要关系还剩下多少可见证据？", "第二版除了被要求的时间变化，是否发生了无关视觉漂移？"], "delivery_contract": {"source_file": "scene.mjs", "module_type": "ES module", "entrypoint": "createScene", "direct_argument": "canvas", "infra_argument": "rt", "interface_document": "runtime/API.md", "output": "候选通过 loader 获取显式时间 render(t)；遵循冻结 API 的返回值契约，不沿用 Softmax/residual evidence。", "asset_policy": "除已冻结本地 runtime 以外不得使用外网资产；两臂共享同一 brief 中的视觉方向。"}}

Arm interface:
export function createScene(rt) returns rt.scene(...). Use the frozen reusable runtime below; you may import helpers ONLY from './runtime/concept-runtime.mjs' or use rt.tween, rt.envelope etc.
# Concept runtime (v1)

This is a small Canvas 2D drawing library, not a storyboard generator. The scene author chooses the object, composition, camera, action and timing. All samples are explicit-time and can be drawn in any order. No external dependencies or assets.

```js
import { createRuntime, tween, envelope } from './concept-runtime.mjs';
export function createScene(rt) {
  // Local revision changes these intervals without regenerating drawing infrastructure.
  const C = { secondStart: 5.2, secondEnd: 7.4 };
  const flake = rt.snowflake('flake', { depth: 1 });
  return rt.scene({ duration: 10, fps: 30, caseId: 'snowflake-rotation', shots: [{
    id: 'rotate-and-compose', start: 0, end: 10,
    camera: { x: 960, y: 500, zoom: 1 },
    draw(f, t) {
      const angle = tween(0, Math.PI / 3, t, 1.0, 2.7)
        + tween(0, Math.PI / 3, t, C.secondStart, C.secondEnd);
      f.draw(flake, { id: 'reference', x: 960, y: 460, scale: 280,
        color: '#fff', opacity: .16, layer: 10 });
      f.draw(flake, { x: 960, y: 460, scale: 280, rotation: angle });
      f.arcArrow('rotation', 960, 460, 345, -Math.PI / 2,
        -Math.PI / 2 + angle, { opacity: envelope(t, .8, 8.5) });
      f.caption('转过60°，轮廓又与原位重合', { opacity: envelope(t, .4, 4.8) });
      return { mechanism: { angle, turnDegrees: angle * 180 / Math.PI } };
    }
  }] });
}
const rt = createRuntime(document.getElementById('scene'), { width: 1920, height: 1080 });
window.C2M = createScene(rt); // meta.version = 2; render(t) returns generic evidence.
```

The example is an API illustration, not a generated candidate or accepted artwork. Choose your own composition; keep one visible action per beat and let the same object persist through its transformations. A sixfold shape's endpoint is symmetric: use a subdued ghost plus a motion arc or a highlighted arm to make the rotation visible. Colors or markers on a hexagon make its permutation identifiable; those markings are not themselves invariant.

- `createRuntime(canvas, {width,height,fps,font,caseId})`: defaults dimensions to the canvas intrinsic size. Returns runtime `rt`.
- `rt.scene({duration,fps,caseId,background,shots})`: shots are contiguous `{id,start,end,draw(f, localTime),camera?,background?}` intervals covering the exact duration. `camera` is a pose or a function of local time, with `{x,y,zoom,rotation}`. It acts on world objects; screen text is independent of it. `render(t)` always draws a complete frame.
- `rt.object(id, {draw(ctx, style), bounds:{x,y,width,height},kind?,geometry?})`: reusable custom object in local coordinates. Identity and geometry persist; animation is provided as a pose when drawing. `draw` must be deterministic and must not keep animation state. Bounds are required declarations, not verified against all pixels.
- `rt.snowflake(id,{depth:0|1|2,color?,glow?})`: recursive sixfold line geometry in unit coordinates. Style override `reveal` draws 0..1 of total path length, `lineWidth` is in object units.
- `rt.hexagon(id,{colors?,marker?})`: six colored sectors in unit coordinates, with an optional top-vertex marker. An explicit diagnostic object, not an invariant colored snowflake.
- `f.draw(object,{id?,x?,y?,scale?,scaleX?,scaleY?,rotation?,opacity?,layer?,screen?,...style})`: pose is in pixels/radians; default scale is 1. `scaleX`/`scaleY` override uniform scale. To reflect, set `scaleX:-scale`, `scaleY:scale`; combine with rotation without replacing object identity. Extra instances (e.g. ghost) require unique `id`. Returns the original object. Default layer 20. Returned evidence records source identity, pose and local geometry.
- `f.text(id,text,x,y,{size?,font?,weight?,align?,color?,opacity?,screen?,layer?})`: measured text bounds; default world space, baseline coordinate. Returns measured width.
- `f.caption(text,{id?,size?,opacity?,...textStyle})`: screen overlay, layer 100, centered in subtitle area. Overwide text produces `caption_too_wide` evidence. It does not automatically wrap or shrink text.
- `f.line(id,x1,y1,x2,y2,{color?,width?,dash?,opacity?,layer?})`: world line.
- `f.arcArrow(id,cx,cy,radius,startAngle,endAngle,{color?,width?,opacity?,layer?})`: world-space signed rotation arc and arrowhead. Zero angle draws nothing.
- `f.raw(id,draw(ctx,f),bounds,style)`: Canvas escape hatch; no mandatory snowflake or numerical protocol. Default world space, `screen:true` disables camera. Supply conservative bounds and deterministic draw code. Runtime records these declared bounds; independent rendering/review is still necessary.
- `f.safe`: recommended composition area `{x,y,width,height,subtitleY,subtitleWidth}`. It is guidance, not an enforced template. Keep focal objects away from subtitle area; custom layout remains possible.
- `progress(t,start,end,easing= ease.smooth)`, `tween(a,b,t,start,end,easing)` and `envelope(t,start,end,fade=.25)`: clamped deterministic time functions. `ease` exports `linear`, `smooth`, `cubic`, `out`.
- `composeD6(a,b)`: exact D6 composition, **a after b**; element `{r:integer,f:0|1}` maps vertex `j` to `r + (-1)^f j mod 6`. `d6Permutation(element)` returns the vertex mapping. This checks action algebra, not whether the viewer understands it.

`render(t)` returns `{time,requestedTime,stage,shot,camera,bounds,objects,findings,...sceneEvidence}`. The runtime fixes `stage` to the current shot ID. Place concept-specific truth under `mechanism`; validators should recompute it independently. Every active instance has a stable frame ID, and bounds include camera and pose transforms. For duplicated instances `sourceId` identifies the shared object. A passing runtime test or numerical contract is never artistic acceptance.


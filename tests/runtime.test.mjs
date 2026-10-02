import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, composeD6, d6Permutation, snowflakeSegments, transformPoint, tween, envelope } from '../runtime/concept-runtime.mjs';
function mockCanvas() {
  const calls = [];
  const ctx = new Proxy({ calls, measureText: t => ({ width: t.length * 20, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 }) },
    { get(o, k) { return k in o ? o[k] : (...args) => calls.push([k, ...args]); } });
  return { width: 1920, height: 1080, getContext: () => ctx, ctx };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('time helpers clamp endpoints and fade never creates NaN', () => {
  assert.equal(tween(0, 60, -1, 1, 3), 0); assert.equal(tween(0, 60, 4, 1, 3), 60);
  assert.equal(tween(0, 60, 2, 1, 3), 30);
  assert.equal(envelope(2, 1, 3, 0), 1); assert.equal(envelope(3, 1, 3, 0), 0);
  assert.equal(envelope(2, 1, 3, 10), 1);
  assert.throws(() => tween(0, 1, 0, 2, 2));
});
test('all 144 D6 compositions agree with their actual vertex permutations', () => {
  const group = Array.from({ length: 12 }, (_, i) => ({ r: i % 6, f: i >= 6 ? 1 : 0 }));
  for (const a of group) for (const b of group) {
    const pa = d6Permutation(a), pb = d6Permutation(b);
    assert.deepEqual(d6Permutation(composeD6(a, b)), pb.map(j => pa[j]));
  }
  assert.deepEqual(composeD6({r:1,f:0},{r:1,f:0}), {r:2,f:0});
  assert.deepEqual(composeD6({r:0,f:1},{r:1,f:0}), {r:5,f:1});
  assert.throws(() => d6Permutation({r:.1,f:0}));
});
test('the snowflake segment set is exactly sixfold and reflection symmetric', () => {
  const canonical = segments => segments.map(s => {
    const a = s.slice(0,2).map(x => +x.toFixed(7)), b = s.slice(2).map(x => +x.toFixed(7));
    return [JSON.stringify(a), JSON.stringify(b)].sort().join(':');
  }).sort();
  for (const depth of [0,1,2]) {
    const segments = snowflakeSegments(depth), target = canonical(segments);
    for (const pose of [{rotation:Math.PI/3},{scaleX:-1}]) {
      const transformed = segments.map(([x,y,ex,ey]) => {
        const a = transformPoint(x,y,pose), b = transformPoint(ex,ey,pose); return [a.x,a.y,b.x,b.y];
      }); assert.deepEqual(canonical(transformed), target);
    }
  }
});
test('seek history cannot change pose evidence, object identity, camera or bounds', () => {
  const canvas = mockCanvas(), rt = createRuntime(canvas), flake = rt.snowflake('flake');
  const scene = rt.scene({ duration: 10, shots: [{id:'rotate',start:0,end:10,
    camera:t=>({zoom:tween(1,1.1,t,0,10)}), draw(f,t) {
      f.draw(flake,{x:960,y:450,scale:200,rotation:tween(0,Math.PI/3,t,1,3)});
      f.caption('转过60°'); return {mechanism:{angle:tween(0,Math.PI/3,t,1,3)}};
    }}] });
  const at2 = scene.render(2); scene.render(8); assert.deepEqual(scene.render(2), at2);
  assert.equal(at2.objects[0].sourceId,'flake'); assert.equal(at2.objects[0].scale,200);
  close(at2.objects[0].rotation, Math.PI/6); assert.equal(at2.bounds[1].y,1080*.91-30);
  assert.equal(scene.meta.version,2); assert.equal(scene.render(10).shot,'rotate');
});
test('local transforms and camera produce screen bounds; reflections preserve identity', () => {
  const canvas = mockCanvas(), rt = createRuntime(canvas);
  const obj=rt.object('custom',{draw(){},bounds:{x:0,y:0,width:100,height:20}});
  const scene=rt.scene({duration:2,shots:[{id:'one',start:0,end:2,camera:{x:960,y:540,zoom:2},
    draw(f){f.draw(obj,{x:960,y:540,scaleX:-1,scaleY:1});}}]});
  const frame=scene.render(1); assert.deepEqual(frame.bounds[0],{id:'custom',kind:'shape',x:760,y:540,width:200,height:40,opacity:1});
  assert.equal(frame.objects[0].sourceId,'custom');assert.equal(frame.objects[0].scaleX,-1);
});
test('layers draw background, world, then screen subtitles regardless of enqueue order', () => {
  const canvas=mockCanvas(),rt=createRuntime(canvas),obj=rt.object('arbitrary',{bounds:{x:0,y:0,width:10,height:10},draw:c=>c.calls.push(['custom'])});
  const scene=rt.scene({duration:1,shots:[{id:'one',start:0,end:1,draw(f){f.caption('字幕');f.draw(obj);}}]});
  scene.render(.5); const names=canvas.ctx.calls.map(c=>c[0]);
  assert.ok(names.indexOf('custom')<names.indexOf('fillText'));assert.ok(names.indexOf('fillRect')<names.indexOf('custom'));
});
test('scene rejects gaps, duplicate identity and invalid camera instead of silently drawing', () => {
  const rt=createRuntime(mockCanvas());
  assert.throws(()=>rt.scene({duration:3,shots:[{id:'a',start:0,end:1,draw(){}},{id:'b',start:2,end:3,draw(){}}]}));
  assert.throws(()=>rt.scene({duration:3,shots:[{id:'a',start:0,end:1,draw(){}}]}));
  const obj=rt.snowflake('flake');assert.throws(()=>rt.snowflake('flake'));
  const scene=rt.scene({duration:1,shots:[{id:'a',start:0,end:1,draw(f){f.draw(obj);f.draw(obj);}}]});assert.throws(()=>scene.render(.5));
  const bad=rt.scene({duration:1,shots:[{id:'b',start:0,end:1,camera:{zoom:0},draw(){}}]});assert.throws(()=>bad.render(.5));
});
test('raw escape hatch accepts new concept geometry and records its declared bounds', () => {
  const canvas=mockCanvas(),rt=createRuntime(canvas);const scene=rt.scene({duration:1,shots:[{id:'new-concept',start:0,end:1,
    draw(f,t){f.raw('wave',c=>c.calls.push(['wave',t]),{x:100,y:100,width:600,height:100});f.caption('x'.repeat(100));}}]});
  const frame=scene.render(.5);assert.equal(frame.bounds[0].id,'wave');assert.equal(frame.findings[0].code,'caption_too_wide');
  assert.ok(canvas.ctx.calls.some(c=>c[0]==='wave'&&c[1]===.5));
});
test('rotating built-in geometry uses transformed vertices rather than an inflated square', () => {
  const rt=createRuntime(mockCanvas()),flake=rt.snowflake('flake');
  const scene=rt.scene({duration:1,shots:[{id:'turn',start:0,end:1,draw(f){f.draw(flake,{x:960,y:450,scale:380,rotation:Math.PI/6});}}]});
  const bound=scene.render(.5).bounds[0];
  assert.ok(bound.y>100);assert.ok(bound.height<700);close(bound.width,779);
});

const twoTurns = () => ({'turn-one':{start:.8,end:2.8},'turn-two':{start:5.2,end:7.2}});
const emptyShot = () => ({duration:10,shots:[{id:'one',start:0,end:10,draw(){}}]});
test('named timing overrides merge and freeze effective metadata without mutating caller data', () => {
  const definitions=twoTurns(), overrides={'turn-two':{start:4.85,end:6.85}};
  const beforeDefinitions=JSON.stringify(definitions), beforeOverrides=JSON.stringify(overrides);
  const rt=createRuntime(mockCanvas(),{timings:overrides}), actions=rt.timings(definitions);
  assert.deepEqual(actions,{'turn-one':{start:.8,end:2.8},'turn-two':{start:4.85,end:6.85}});
  assert.equal(JSON.stringify(definitions),beforeDefinitions);assert.equal(JSON.stringify(overrides),beforeOverrides);
  assert.ok(Object.isFrozen(actions)&&Object.isFrozen(actions['turn-two']));
  overrides['turn-two'].start=3;definitions['turn-one'].end=5;
  const scene=rt.scene(emptyShot());assert.deepEqual(scene.meta.timings,actions);
  assert.ok(Object.isFrozen(scene.meta.timings));assert.throws(()=>{actions['turn-two'].start=0;});
  assert.throws(()=>rt.timings({'third':{start:8,end:9}}));
});
test('timing groups may register disjoint ids; duplicate ids and unregistered overrides fail', () => {
  const rt=createRuntime(mockCanvas(),{timings:{'turn-two':{start:4.85,end:6.85}}});
  rt.timings({'turn-one':{start:.8,end:2.8}});
  rt.timings({'turn-two':{start:5.2,end:7.2}});
  assert.equal(rt.scene(emptyShot()).meta.timings['turn-two'].start,4.85);
  const duplicate=createRuntime(mockCanvas());duplicate.timings({'turn-one':{start:.8,end:2.8}});
  assert.throws(()=>duplicate.timings({'turn-one':{start:3,end:4}}));
  const unknown=createRuntime(mockCanvas(),{timings:{'typo':{start:4,end:6}}});
  unknown.timings(twoTurns());assert.throws(()=>unknown.scene(emptyShot()),/Unknown timing/);
});
test('timing validation rejects malformed dictionaries, empty ids/records and unknown fields', () => {
  for (const invalid of [[],null,42,{'':{start:0,end:1}},{' ': {start:0,end:1}},{a:{}},
    {a:{start:0,end:1,foo:2}},{a:{start:NaN}},{a:{end:Infinity}},{a:{start:false}}]) {
    assert.throws(()=>createRuntime(mockCanvas(),{timings:invalid}));
  }
  const rt=createRuntime(mockCanvas());
  for (const invalid of [{},[],{a:{}},{a:{start:0}},{a:{start:0,end:NaN}},{a:{start:1,end:1}},{a:{start:2,end:1}}]) {
    assert.throws(()=>rt.timings(invalid));
  }
  assert.throws(()=>createRuntime(mockCanvas(),{timings:{a:{start:2,end:1}}}));
  const partial=createRuntime(mockCanvas(),{timings:{a:{start:2}}});
  assert.throws(()=>partial.timings({a:{start:0,end:1}}));
});
test('failed timing groups register no partial entries; partial override retains its other endpoint', () => {
  const rt=createRuntime(mockCanvas(),{timings:{a:{start:1}}});
  assert.throws(()=>rt.timings({a:{start:0,end:2},b:{start:5,end:4}}));
  const group=rt.timings({a:{start:0,end:2}});assert.deepEqual(group.a,{start:1,end:2});
});
test('timing overrides change only requested pose timing and preserve source objects and seek determinism', () => {
  const build=overrides=>{
    const rt=createRuntime(mockCanvas(),{timings:overrides}), actions=rt.timings(twoTurns()), object=rt.snowflake('flake');
    const geometryBefore=JSON.stringify(object.geometry);
    const scene=rt.scene({duration:10,shots:[{id:'turns',start:0,end:10,draw(f,t){
      const angle=tween(0,Math.PI/3,t,actions['turn-one'].start,actions['turn-one'].end)
        +tween(0,Math.PI/3,t,actions['turn-two'].start,actions['turn-two'].end);
      f.draw(object,{x:960,y:450,scale:280,rotation:angle});return {mechanism:{angle}};
    }}]});return {scene,object,geometryBefore};
  };
  const baseline=build({}), revised=build({'turn-two':{start:4.85,end:6.85}});
  assert.deepEqual(baseline.scene.render(2),revised.scene.render(2));
  close(revised.scene.render(5.5).mechanism.angle,baseline.scene.render(5.85).mechanism.angle);
  const sample=revised.scene.render(5.5);revised.scene.render(8);assert.deepEqual(revised.scene.render(5.5),sample);
  assert.equal(JSON.stringify(revised.object.geometry),revised.geometryBefore);
  assert.deepEqual(baseline.object.geometry,revised.object.geometry);
  assert.deepEqual(createRuntime(mockCanvas()).scene(emptyShot()).meta.timings,{});
});

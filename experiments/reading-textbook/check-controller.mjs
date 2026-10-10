import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ReadingController} from './controls.mjs';
const output=path.resolve(process.env.CHECK_OUTPUT??'evaluation/2026-10-10/reading-textbook-v1/raw/controller-v1');fs.mkdirSync(output,{recursive:true});
function setup(mode='pointer'){
  let seq=0;const timers=new Map(),a={},b={},events=[];
  const clock={setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)};
  const c=new ReadingController({steps:[a,b],onActivate:step=>events.push(step===a?'a':'b'),mode,clock});
  const tick=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};return {c,a,b,events,timers,tick};
}
const checks=[];
function check(name,fn){try{fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:String(e.stack)});}console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);}
check('returning to active paragraph cancels pending adjacent paragraph',()=>{const {c,a,b,tick,events}=setup();c.pointer(a);tick();c.pointer(b);c.pointer(a);tick();assert.deepEqual(events,['a']);});
check('small movements within a paragraph do not postpone dwell forever',()=>{const {c,a,tick,timers,events}=setup();c.pointer(a);const first=[...timers.keys()];for(let i=0;i<100;i++)c.pointer(a);assert.deepEqual([...timers.keys()],first);tick();assert.deepEqual(events,['a']);});
check('leaving paragraph cancels its dwell',()=>{const {c,a,tick,events}=setup();c.pointer(a);c.pointer(null);tick();assert.deepEqual(events,[]);});
check('scrolling with stationary mouse cancels pointer dwell',()=>{const {c,a,tick,events}=setup();c.pointer(a);c.scroll();tick();assert.deepEqual(events,[]);});
check('selecting and pausing cancel pending motion',()=>{const {c,a,tick,events}=setup();c.pointer(a);c.setSelecting(true);tick();c.setSelecting(false);c.pointer(a);c.setPaused(true);tick();assert.deepEqual(events,[]);});
check('reading-position jitter waits for a stable paragraph',()=>{const {c,a,b,tick,events}=setup('scroll');c.readingPosition(a);c.readingPosition(b);c.readingPosition(a);assert.deepEqual(events,[]);tick();assert.deepEqual(events,['a']);});
check('keyboard focus takes priority over pending dwell',()=>{const {c,a,b,tick,events}=setup();c.pointer(a);c.focus(b);tick();assert.deepEqual(events,['b']);});
check('static comparison and text-only keep figures still',()=>{const {c,a,tick,events}=setup();c.setMode('static');c.pointer(a);c.focus(a);tick();c.setMode('pointer');c.setTextOnly(true);c.pointer(a);c.focus(a);tick();assert.deepEqual(events,[]);});
check('destroy removes timers',()=>{const {c,a,timers}=setup();c.pointer(a);c.destroy();assert.equal(timers.size,0);});
const report={checks,passed:checks.filter(c=>c.pass).length,total:checks.length,scope:'Deterministic input-sequence controls, not recordings of a human reader'};fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:report.total}));process.exitCode=report.passed===report.total?0:1;

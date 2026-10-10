import {ReadingController} from './controls.mjs';
import {createMechanism} from './scenes.mjs';
import katex from './vendor/katex/katex.mjs';
import {mechanismData} from './math.mjs';

const content = await fetch('./content.json').then(r=>{if(!r.ok)throw new Error(`content HTTP ${r.status}`);return r.json();});
const units = new Map(content.units.map(unit=>[unit.id,unit]));
const expectedParagraphs=new Map(content.units.flatMap(unit=>unit.paragraphs.map(p=>[p.id,{...p,unit:unit.id}])));
const rejectedSteps=[];
const steps = [...document.querySelectorAll('.reading-step')].filter(step=>{
  const expected=expectedParagraphs.get(step.id);
  const actual=[...step.childNodes].filter(n=>!(n.nodeType===1&&n.classList.contains('step-index'))).map(n=>n.textContent).join('').trim();
  const valid=expected && actual===expected.text && step.dataset.unit===expected.unit && Number(step.dataset.stage)===expected.state;
  if(!valid){rejectedSteps.push(step.id);step.classList.remove('reading-step');step.removeAttribute('tabindex');}
  return valid;
});
const figures = new Map([...document.querySelectorAll('.mechanism')].map(figure=>[figure.dataset.unit,figure]));
const scenes = new Map(), loading = new Map();
const status = document.querySelector('#status');
const mode = document.querySelector('#mode');
const pause = document.querySelector('#pause');
const textOnly = document.querySelector('#text-only');
for(const control of [mode,pause,textOnly])control.disabled=false;
const counts = {rendered: 0, errors: [], events: [], seekMs: []};
const coarse = matchMedia('(hover: none)').matches;
if(coarse) mode.value='scroll';

for(const element of document.querySelectorAll('[data-tex]')) {
  try { katex.render(element.dataset.tex,element,{throwOnError:true,displayMode:true,trust:false,strict:'error'}); }
  catch(error) { counts.errors.push(`formula: ${error.message}`); }
}

async function mount(id) {
  if(scenes.has(id)) return scenes.get(id);
  if(loading.has(id)) return loading.get(id);
  const promise = (async()=>{
    const figure=figures.get(id), canvas=figure.querySelector('canvas');
    try {
      const scene=await createMechanism(canvas,id);
      if(disposed){scene.destroy();return null;}
      scenes.set(id,scene);
      scene.seek(Number(figure.dataset.stage));
      counts.rendered++;
      figure.classList.add('ready');
      return scene;
    } catch(error) {
      counts.errors.push(`${id}: ${error.message}`);
      status.textContent='交互图暂不可用；正文、静态图和阅读操作仍可使用。';
      return null;
    }
  })();
  loading.set(id,promise);
  return promise;
}

function activate(step,reason) {
  const id=step.dataset.unit, stage=Number(step.dataset.stage), unit=units.get(id), state=unit.states[stage], figure=figures.get(id);
  for(const paragraph of steps) paragraph.classList.toggle('active',paragraph===step);
  figure.dataset.stage=String(stage);
  figure.querySelector('.state-name').textContent=state.name;
  figure.querySelector('figcaption').textContent=state.caption;
  const fallback=figure.querySelector('.fallback');
  fallback.src=`static/${id}-${stage}.svg`;
  fallback.alt=state.caption;
  figure.querySelector('canvas').setAttribute('aria-label',state.caption);
  [...figure.querySelectorAll('.state-track i')].forEach((point,i)=>point.classList.toggle('on',i===stage));
  const scene=scenes.get(id);
  if(scene) {
    scene.seek(state.time);
    counts.seekMs.push(scene.stats.seekMs);
    if(counts.seekMs.length>500) counts.seekMs.shift();
  } else void mount(id);
  counts.events.push({id:step.id,stage,reason});
  if(counts.events.length>200) counts.events.shift();
}

const controller=new ReadingController({steps,onActivate:activate,mode:mode.value});
let lastPointer=null, needsFreshPointer=false, pendingScroll=null, disposed=false;
const listeners=[];
function listen(target,type,fn,options) {target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
function hasSelection(){return !window.getSelection()?.isCollapsed;}

listen(document,'pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  const previous=lastPointer;
  if(needsFreshPointer && previous && Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<2)return;
  lastPointer={x:event.clientX,y:event.clientY};
  needsFreshPointer=false;
  if(hasSelection()) {controller.cancel();return;}
  controller.pointer(event.target.closest('.reading-step'));
},{passive:true});
listen(document,'pointerdown',()=>controller.setSelecting(true),{passive:true});
listen(document,'pointerup',()=>{controller.setSelecting(false);needsFreshPointer=true;},{passive:true});
listen(document,'selectionchange',()=>{if(hasSelection())controller.cancel();});
listen(window,'blur',()=>controller.cancel());
listen(document,'visibilitychange',()=>{if(document.hidden)controller.cancel();});
listen(document,'focusin',event=>{
  if(hasSelection()){controller.cancel();return;}
  const step=event.target.closest('.reading-step');
  if(step) controller.focus(step);
});

function readingPosition() {
  pendingScroll=null;
  if(controller.mode!=='scroll'||controller.blocked()||hasSelection())return;
  if(steps.includes(document.activeElement)){controller.focus(document.activeElement);return;}
  const line=innerHeight*.76;
  const visible=steps.map(step=>({step,r:step.getBoundingClientRect()})).filter(({r})=>r.bottom>100 && r.top<innerHeight-20);
  visible.sort((a,b)=>Math.abs((a.r.top+a.r.bottom)/2-line)-Math.abs((b.r.top+b.r.bottom)/2-line));
  if(visible[0])controller.readingPosition(visible[0].step);
}
function schedulePosition(){if(pendingScroll===null)pendingScroll=requestAnimationFrame(readingPosition);}
listen(window,'scroll',()=>{controller.scroll();needsFreshPointer=true;schedulePosition();},{passive:true});
listen(window,'resize',()=>{controller.cancel();schedulePosition();},{passive:true});
listen(mode,'change',()=>{
  controller.setMode(mode.value);
  document.body.classList.toggle('static',mode.value==='static');
  status.textContent=mode.value==='static'?'静态对照：图保持当前位置。':mode.value==='scroll'?'图按屏幕下部的阅读位置切换；随时可以暂停。':'把光标停在正文上，图跟随这一段。';
  if(mode.value==='scroll')schedulePosition();
});
listen(pause,'click',()=>{
  controller.setPaused(!controller.paused);
  pause.setAttribute('aria-pressed',String(controller.paused));
  pause.textContent=controller.paused?'恢复跟随':'暂停跟随';
  status.textContent=controller.paused?'跟随已暂停。':'跟随已恢复。';
  if(!controller.paused)schedulePosition();
});
listen(textOnly,'click',()=>{
  controller.setTextOnly(!controller.textOnly);
  textOnly.setAttribute('aria-pressed',String(controller.textOnly));
  textOnly.textContent=controller.textOnly?'显示图形':'只读文字';
  document.body.classList.toggle('text-only',controller.textOnly);
  if(!controller.textOnly)schedulePosition();
});

const observer = new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)void mount(entry.target.dataset.unit);
},{rootMargin:'250px 0px'});
for(const figure of figures.values())observer.observe(figure);
status.textContent=coarse?'触屏模式：按阅读位置切换图形；也可以暂停。':'把光标停在正文上，图跟随这一段。';
if(rejectedSteps.length)status.textContent='有讲解与图的对应关系发生变化；这些段落的跟随已暂停。';
if(coarse)schedulePosition();

function dispose() {
  if(disposed)return;
  disposed=true;
  controller.destroy(); observer.disconnect(); listeners.forEach(fn=>fn());
  if(pendingScroll!==null)cancelAnimationFrame(pendingScroll);
  for(const scene of scenes.values())scene.destroy();
}
listen(window,'pagehide',event=>{if(!event.persisted)dispose();});

// Narrow inspection interface for reproducible engineering checks. No coordinates,
// session identifier, persistence, request logging, model, or background playback.
window.readingLab = {
  snapshot:()=>({mode:controller.mode,paused:controller.paused,textOnly:controller.textOnly,active:controller.active?.id??null,metrics:{...controller.metrics},rendered:counts.rendered,errors:[...counts.errors],rejectedSteps:[...rejectedSteps],events:[...counts.events],seekMs:[...counts.seekMs],stages:Object.fromEntries([...figures].map(([id,figure])=>[id,Number(figure.dataset.stage)])),scenes:[...scenes.keys()]}),
  inspect:(id)=>mechanismData(id,Number(figures.get(id).dataset.stage)),
  seekForCheck:(id,time)=>{const scene=scenes.get(id);if(!scene)throw new Error('scene not mounted');scene.seek(time);return scene.stats.seekMs;},
  dispose
};

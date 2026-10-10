function startVisualbook(data){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const controllers=[];const follow=document.querySelector('#follow');
 const original=document.querySelector('#original');
 const announce=(el,text)=>{el.querySelector('.figure-status').textContent=text};
 for(const f of data.figures){
  const el=document.getElementById('figure-'+f.id);if(!el)continue;
  const graphic=el.querySelector('.graphic'),live=graphic.querySelector('.live');
  const params=Object.fromEntries(f.controls.map(c=>[c.key,c.value]));
  let state=f.states[0].key,manual=false,lastWidth=0,reservedWidth=0;
  const fn=data.renderers[f.id];
  const c={f,el,params,get state(){return state},get manual(){return manual},setState(key,user=false){state=key;manual=user;draw();},resume(){manual=false;for(const control of f.controls){params[control.key]=control.value;const input=el.querySelector('[data-param="'+control.key+'"]');input.value=control.value;input.nextElementSibling.value=control.value}update();draw()},facts:null,draw};
  function draw(){
   const width=Math.floor(graphic.clientWidth);if(!width)return;
   try{
    if(reservedWidth!==width){
     const examples=[Object.fromEntries(f.controls.map(c=>[c.key,c.value]))];
     for(const control of f.controls)for(const value of [control.min,control.max])examples.push({...examples[0],[control.key]:value});
     let maxHeight=0;
     for(const s of f.states)for(const p of examples){const svg=fn({width,state:s.key,params:p}).svg;const doc=new DOMParser().parseFromString(svg,'image/svg+xml');const node=doc.documentElement;const box=node.getAttribute('viewBox').trim().split(/\s+/).map(Number);if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0)throw Error('Invalid SVG viewBox');maxHeight=Math.max(maxHeight,box[3]*width/box[2])}
     graphic.style.minHeight=Math.ceil(maxHeight)+'px';reservedWidth=width;
    }
    const value=fn({width,state,params});
    live.innerHTML=value.svg;c.facts=value.facts;lastWidth=width;
    graphic.classList.remove('failed');
    el.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===state)));
    announce(el,manual?'已停在你选择的状态。':'');sizePolicy();
   }catch(error){graphic.classList.add('failed');announce(el,'互动图暂不可用，已显示静态图。');c.error=String(error)}
  }
  el.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>c.setState(b.dataset.state,true)));
  el.querySelectorAll('[data-param]').forEach(input=>input.addEventListener('input',()=>{params[input.dataset.param]=Number(input.value);input.nextElementSibling.value=input.value;manual=true;draw()}));
  el.querySelector('.reset').addEventListener('click',()=>c.resume());
  const observer=new ResizeObserver(()=>{if(Math.floor(graphic.clientWidth)!==lastWidth)draw()});observer.observe(graphic);
  controllers.push(c);draw();
 }
 let scheduled=false;
 function update(){
  scheduled=false;if(!follow.checked||document.body.classList.contains('original'))return;
  const line=Math.min(innerHeight*.48,380);
  for(const c of controllers){
   if(c.manual)continue;
   const scope=c.el.closest('.viz-scope').getBoundingClientRect();
   if(scope.bottom<64||scope.top>innerHeight)continue;
   let next=c.f.states[0].key;
   for(const s of c.f.states){const b=document.getElementById(s.anchor);if(b&&b.getBoundingClientRect().top<=line)next=s.key}
   if(next!==c.state)c.setState(next);
  }
 }
 addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}},{passive:true});
 follow.addEventListener('change',()=>{controllers.forEach(c=>c.resume());update()});
 original.addEventListener('click',()=>{const yes=document.body.classList.toggle('original');original.setAttribute('aria-pressed',String(yes));original.textContent=yes?'显示图解':'只看原文';update()});
 const originalParam=new URLSearchParams(location.search).get('original');if(originalParam==='1')original.click();
 // Avoid a fixed figure consuming most of a short screen. Static placement
 // remains available; reading position still selects a coarse state.
 function sizePolicy(){for(const c of controllers)c.el.classList.toggle('no-sticky',c.el.getBoundingClientRect().height>innerHeight*.43||reduced.matches)}
 addEventListener('resize',sizePolicy);reduced.addEventListener('change',sizePolicy);sizePolicy();update();
 window.visualbook={controllers,update,sizePolicy};
}

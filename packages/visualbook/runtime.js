(function(global) {
  const instances=[];const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function mount(element,figure,draw,library=true) {
    const svg=element.querySelector('svg'),range=element.querySelector('.vh-progress'),status=element.querySelector('.vh-status');
    const params=Object.fromEntries((figure.params??[]).map(c=>[c.key,c.value]));let progress=0,target=0,manual=false,raf=null;
    const board=library?new VisualBook.Board(svg):null;const height=figure.height??320;
    const context={svg,board,get width(){return element.querySelector('.vh-canvas').clientWidth;},height};
    function paint(p) { const width=Math.floor(context.width);if(width<1)return;const h=width<450?(figure.mobileHeight??height):height;
      svg.setAttribute('viewBox',`0 0 ${width} ${h}`);svg.style.height=h+'px';if(board)board.begin(width,h);
      const result=draw({...context,width,height:h,progress:p,params,board});if(board)board.end();
      instance.facts=result??{};instance.progress=p;range.value=p;
      status.textContent=figure.stages?.length?figure.stages[Math.min(figure.stages.length-1,Math.floor(p*figure.stages.length))]:'';
    }
    function frame(){raf=null;const delta=target-progress;progress=Math.abs(delta)<.0005?target:progress+delta*.22;try{paint(progress);}catch(error){instance.error=String(error);status.textContent='图解暂不可用';element.dataset.failed='true';return;}if(progress!==target)raf=requestAnimationFrame(frame);}
    function setProgress(p,immediate=false){target=Math.max(0,Math.min(1,p));if(immediate||reduced.matches){if(raf)cancelAnimationFrame(raf);raf=null;progress=target;paint(progress);}else if(!raf)raf=requestAnimationFrame(frame);}
    const instance={id:figure.id,figure,element,svg,params,context,progress:0,facts:{},setProgress,setParam(key,value){if(!(key in params))throw Error('Unknown parameter');params[key]=value;paint(progress);},get manual(){return manual;},resume(){manual=false;sync();},paint};
    range.addEventListener('input',()=>{manual=true;setProgress(+range.value,true);});
    for(const input of element.querySelectorAll('[data-param]'))input.addEventListener('input',()=>{manual=true;params[input.dataset.param]=+input.value;input.nextElementSibling.value=input.value;paint(progress);});
    element.querySelector('.vh-resume').addEventListener('click',()=>instance.resume());
    function sync(){if(manual||global.__VH_SNAPSHOT)return;const start=document.getElementById(figure.afterAnchor),end=document.getElementById(figure.endAnchor??figure.afterAnchor);if(!start||!end)return;
      const a=start.getBoundingClientRect().top,b=end.getBoundingClientRect().top,line=Math.min(innerHeight*.46,380);setProgress(a===b?0:(line-a)/(b-a));}
    new ResizeObserver(()=>paint(progress)).observe(element.querySelector('.vh-canvas'));
    addEventListener('scroll',sync,{passive:true});addEventListener('resize',sync);
    instances.push(instance);paint(0);sync();return instance;
  }
  global.VisualBookRuntime={mount,instances};
})(window);

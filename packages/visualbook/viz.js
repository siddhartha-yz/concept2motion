/* VisualBook reusable drawing tools. D3 7.9.0 is bundled separately under ISC. */
(function (global) {
  const palette = { ink:'#263b43', muted:'#73838a', blue:'#337a98', orange:'#c36d43', faint:'#dce5e6', paper:'#faf9f5' };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
  const finite = v => { if (!Number.isFinite(v)) throw Error('Non-finite geometry'); return v; };
  const textCanvas = document.createElement('canvas').getContext('2d');
  function measure(text,size=15) { textCanvas.font=`${size}px system-ui, sans-serif`; return textCanvas.measureText(String(text)).width; }
  function lines(text,width,size=15) {
    const out=[]; let line='';
    for (const char of String(text)) { if (line && measure(line+char,size)>width) { out.push(line);line=''; } line+=char; }
    if (line) out.push(line); return out;
  }
  class Board {
    constructor(svg) { this.svg=svg;this.nodes=new Map();this.seen=new Set();this.labels=[]; }
    begin(width,height) { this.width=width;this.height=height;this.seen.clear();this.labels=[];this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`); }
    mark(id,tag,attrs={},text=null) {
      this.seen.add(id);let node=this.nodes.get(id);
      if (node && node.tagName!==tag) { node.remove();this.nodes.delete(id);node=null; }
      if (!node) { node=document.createElementNS('http://www.w3.org/2000/svg',tag);node.dataset.vizKey=id;this.svg.append(node);this.nodes.set(id,node); }
      for (const name of node.getAttributeNames()) if (name!=='data-viz-key' && !(name in attrs)) node.removeAttribute(name);
      for (const [name,value] of Object.entries(attrs)) { if (typeof value==='number') finite(value);node.setAttribute(name,String(value)); }
      if (text!==null) node.textContent=String(text);return node;
    }
    end() { for (const [id,node] of this.nodes) if (!this.seen.has(id)) { node.remove();this.nodes.delete(id); } }
    line(id,x1,y1,x2,y2,color=palette.ink,width=2,opacity=1) { return this.mark(id,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,opacity,'stroke-linecap':'round'}); }
    circle(id,x,y,r=4,color=palette.blue) { return this.mark(id,'circle',{cx:x,cy:y,r,fill:color}); }
    rect(id,x,y,w,h,fill=palette.faint,extra={}) { return this.mark(id,'rect',{x,y,width:w,height:h,rx:3,fill,...extra}); }
    text(id,text,x,y,{size=15,color=palette.ink,anchor='start',opacity=1,weight=400}={}) { return this.mark(id,'text',{x,y,fill:color,'font-size':size,'text-anchor':anchor,'font-weight':weight,opacity,'font-family':'system-ui, sans-serif'},text); }
    label(id,text,x,y,{size=15,color=palette.ink,maxWidth=140,anchor='start',avoid=true}={}) {
      const wrapped=lines(text,maxWidth,size),h=wrapped.length*(size+4),w=Math.max(...wrapped.map(v=>measure(v,size)),0);
      let left=anchor==='middle'?x-w/2:anchor==='end'?x-w:x;
      left=clamp(left,8,Math.max(8,this.width-w-8));let top=clamp(y-size,8,Math.max(8,this.height-h-8));
      if (avoid) for(let attempt=0;attempt<8;attempt++) {
        const collision=this.labels.find(r=>left<r.x+r.w+5 && left+w+5>r.x && top<r.y+r.h+4 && top+h+4>r.y);
        if(!collision)break;top=collision.y+collision.h+6;
        if(top+h>this.height-8) { top=Math.max(8,y-size-h-8);left=clamp(left+w+10,8,this.width-w-8); }
      }
      this.labels.push({id,x:left,y:top,w,h});
      wrapped.forEach((v,i)=>this.text(`${id}-${i}`,v,left,top+size+i*(size+4),{size,color}));
      return {x:left,y:top,w,h};
    }
    path(id,points,{color=palette.blue,width=2.5,opacity=1,closed=false}={}) {
      const d=global.d3.line()(points)+(closed?'Z':'');return this.mark(id,'path',{d:d||'',fill:closed?color:'none',stroke:color,'stroke-width':width,opacity,'stroke-linejoin':'round','stroke-linecap':'round'});
    }
    axes(id,{xDomain=[-1,1],yDomain=[-1,1],equalUnits=false,xLabel='x',yLabel='y',box=null,grid=true,xTicks=true}={}) {
      if(xDomain[0]>=xDomain[1]||yDomain[0]>=yDomain[1])throw Error('Axis domain must increase');
      let [left,top,right,bottom]=box??[52,36,this.width-24,this.height-70];
      if(equalUnits) { const unit=Math.min((right-left)/(xDomain[1]-xDomain[0]),(bottom-top)/(yDomain[1]-yDomain[0]));const cx=(left+right)/2,cy=(top+bottom)/2;const w=unit*(xDomain[1]-xDomain[0]),h=unit*(yDomain[1]-yDomain[0]);left=cx-w/2;right=cx+w/2;top=cy-h/2;bottom=cy+h/2; }
      const x=global.d3.scaleLinear(xDomain,[left,right]),y=global.d3.scaleLinear(yDomain,[bottom,top]);
      const xt=xTicks?global.d3.ticks(...xDomain,this.width<450?3:5):[],yt=global.d3.ticks(...yDomain,3);
      for(const tick of xt) { if(grid)this.line(`${id}-x-grid-${tick}`,x(tick),top,x(tick),bottom,palette.faint,1);this.text(`${id}-x-tick-${tick}`,global.d3.format('~g')(tick),x(tick),bottom+22,{size:13,color:palette.muted,anchor:'middle'}); }
      for(const tick of yt) { if(grid)this.line(`${id}-y-grid-${tick}`,left,y(tick),right,y(tick),palette.faint,1);this.text(`${id}-y-tick-${tick}`,global.d3.format('~g')(tick),left-10,y(tick)+4,{size:13,color:palette.muted,anchor:'end'}); }
      this.line(`${id}-x-axis`,left,bottom,right,bottom,palette.muted,1.2);this.line(`${id}-y-axis`,left,top,left,bottom,palette.muted,1.2);
      this.label(`${id}-x-label`,xLabel,right,bottom+52,{size:14,anchor:'end',maxWidth:Math.min(180,right-left),avoid:false});
      this.label(`${id}-y-label`,yLabel,left,16,{size:14,maxWidth:Math.min(200,right-left),avoid:false});
      return {x,y,left,right,top,bottom,unitX:(right-left)/(xDomain[1]-xDomain[0]),unitY:(bottom-top)/(yDomain[1]-yDomain[0])};
    }
    vector(id,frame,from,to,{color=palette.blue,label=null}={}) {
      const x1=frame.x(from[0]),y1=frame.y(from[1]),x2=frame.x(to[0]),y2=frame.y(to[1]);this.line(id,x1,y1,x2,y2,color,2.5);
      const a=Math.atan2(y2-y1,x2-x1),s=9;
      this.path(id+'-head',[[x2-s*Math.cos(a-.45),y2-s*Math.sin(a-.45)],[x2,y2],[x2-s*Math.cos(a+.45),y2-s*Math.sin(a+.45)]],{color,width:2.5});
      if(label)this.label(id+'-label',label,x2+8,y2-8,{color,maxWidth:120});return {from,to,x1,y1,x2,y2};
    }
    curve(id,frame,points,options={}) { return this.path(id,points.map(([x,y])=>[frame.x(x),frame.y(y)]),options); }
    matrix(id,values,{x=20,y=30,cell=40,activeRow=-1,activeCol=-1,activeCell=null,label=null,color=palette.blue,precision=2}={}) {
      if(!values.length||!values[0].length||values.some(r=>r.length!==values[0].length))throw Error('Matrix must be rectangular');
      const rows=values.length,cols=values[0].length;const max=Math.max(...values.flat().map(Math.abs),1);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
        const v=finite(values[r][c]),active=r===activeRow||c===activeCol||(activeCell&&r===activeCell[0]&&c===activeCell[1]);
        this.rect(`${id}-${r}-${c}`,x+c*cell,y+r*cell,cell-3,cell-3,active?global.d3.interpolateRgb('#eef4f5',color)(.25):'#eff0eb',{stroke:active?color:'none','stroke-width':1.2});
        this.text(`${id}-v-${r}-${c}`,Number(v.toFixed(precision)),x+(c+.5)*cell-1.5,y+(r+.5)*cell+4,{size:Math.min(16,cell*.4),anchor:'middle',color:active?palette.ink:palette.muted});
      }
      if(label)this.label(id+'-label',label,x,y-10,{maxWidth:cols*cell,color,avoid:false});
      return {x,y,width:cols*cell,height:rows*cell,rows,cols,max};
    }
    sequence(id,nodes,{active=0,x=20,y=45,width=this.width-40,height=this.height-80}={}) {
      const vertical=width<500,n=nodes.length,gap=vertical?12:20;
      const w=vertical?Math.min(width,280):(width-gap*(n-1))/n,h=vertical?Math.min(48,(height-gap*(n-1))/n):66;
      const boxes=nodes.map((node,i)=>({id:node.id,x:vertical?x+(width-w)/2:x+i*(w+gap),y:vertical?y+i*(h+gap):y+(height-h)/2,w,h}));
      for(let i=0;i<n;i++) { const b=boxes[i],node=nodes[i],focus=clamp(active-i,0,1);this.rect(`${id}-${node.id}`,b.x,b.y,b.w,b.h,global.d3.interpolateRgb('#eff0eb','#e0edf0')(focus),{stroke:focus?palette.blue:palette.faint});
        this.label(`${id}-${node.id}-label`,node.label,b.x+b.w/2,b.y+(b.h/2)+5,{anchor:'middle',maxWidth:b.w-20,color:focus?palette.ink:palette.muted,avoid:false});
        if(i<n-1) { const next=boxes[i+1],x1=vertical?b.x+b.w/2:b.x+b.w,y1=vertical?b.y+b.h:b.y+b.h/2,x2=vertical?next.x+next.w/2:next.x,y2=vertical?next.y:next.y+next.h/2;this.line(`${id}-link-${i}`,x1,y1,x2,y2,palette.faint,2);this.circle(`${id}-flow-${i}`,mix(x1,x2,clamp(active-i-1,0,1)),mix(y1,y2,clamp(active-i-1,0,1)),3.5,palette.orange); }
      }
      return boxes;
    }
    product(id,a,b,{progress=0,row=0,col=0}={}) {
      const c=matmul(a,b),n=a[0].length,small=this.width<500;
      if(a.length>5||b[0].length>5||n>5)throw Error('Product design supports up to five rows/columns; split larger tensors');
      const cell=Math.min(42,Math.floor((this.width-64)/(small?Math.max(n+b[0].length+1,c[0].length+2):n+b[0].length+c[0].length+3)));
      if(cell<28)throw Error('Matrix product too dense for this viewport');
      const left=16,top=44,bx=left+(n+1)*cell,cx=small?(this.width-c[0].length*cell)/2:bx+(b[0].length+1)*cell,cy=small?top+Math.max(a.length,b.length)*cell+66:top;
      this.matrix(id+'-a',a,{x:left,y:top,cell,activeRow:row,label:'A'});this.matrix(id+'-b',b,{x:bx,y:top,cell,activeCol:col,label:'B',color:palette.orange});this.matrix(id+'-c',c,{x:cx,y:cy,cell,activeCell:[row,col],label:'AB'});
      const at=clamp(progress,0,1)*n,k=Math.min(n-1,Math.floor(at)),phase=at===n?1:at-k;
      const source=[left+(k+.5)*cell,top+(row+.5)*cell],target=[cx+(col+.5)*cell,cy+(row+.5)*cell];
      this.circle(id+'-contribution',mix(source[0],target[0],phase),mix(source[1],target[1],phase),4,palette.orange);
      const terms=a[row].map((v,i)=>v*b[i][col]),sum=terms.reduce((s,v)=>s+v,0);
      this.label(id+'-dot',terms.map(v=>Number(v.toFixed(2))).join(' + ')+' = '+Number(sum.toFixed(2)),this.width/2,this.height-22,{anchor:'middle',maxWidth:this.width-32,avoid:false});
      return {a,b,c,row,col,terms,sum,term:k,phase,assumption:'An interpolated contribution marker is explanatory, not measured execution'};
    }
    optimization(id,{a=.1,b=2,start=[-5,-2],kind='rmsprop',eta=.4,rho=.9,epsilon=1e-6,steps=30,progress=0,compare='sgd',xDomain=[-5.5,.5],yDomain=[-3,3]}={}) {
      const gradient=([x,y])=>[2*a*x,2*b*y],points=trace(kind,gradient,start,{eta,rho,epsilon,steps}),frame=this.axes(id+'-axes',{xDomain,yDomain,xLabel:'参数 x₁',yLabel:'参数 x₂',equalUnits:true});
      for(const level of [0.2,1,3,6,10]) { const rx=Math.sqrt(level/a),ry=Math.sqrt(level/b);let segment=[],part=0;const flush=()=>{if(segment.length>1)this.curve(`${id}-contour-${level}-${part++}`,frame,segment,{color:palette.faint,width:1});segment=[];};for(let i=0;i<=120;i++){const x=rx*Math.cos(i/120*Math.PI*2),y=ry*Math.sin(i/120*Math.PI*2);if(x>=xDomain[0]&&x<=xDomain[1]&&y>=yDomain[0]&&y<=yDomain[1])segment.push([x,y]);else flush();}flush(); }
      if(compare){const other=trace(compare,gradient,start,{eta,rho,epsilon,steps});this.curve(id+'-comparison',frame,other.map(p=>p.theta).filter(([x,y])=>x>=xDomain[0]&&x<=xDomain[1]&&y>=yDomain[0]&&y<=yDomain[1]),{color:palette.muted,width:1.5,opacity:.55});}
      const current=interpolateTrace(points,progress),shown=points.slice(0,Math.floor(current.index)+1).map(p=>p.theta);shown.push(current.theta);
      this.curve(id+'-path',frame,shown,{color:palette.blue,width:2.5});this.circle(id+'-position',frame.x(current.theta[0]),frame.y(current.theta[1]),5,palette.orange);
      this.label(id+'-position-label',`第 ${current.index.toFixed(1)} 步`,frame.x(current.theta[0])+10,frame.y(current.theta[1])-12,{maxWidth:110});
      return {objective:{a,b},kind,eta,rho,epsilon,steps,trace:points,current,unitX:frame.unitX,unitY:frame.unitY,interpolation:'between discrete updates, not an additional optimizer step'};
    }
    probabilities(id,scores,{temperature=1,progress=1,labels=null}={}) {
      if(temperature<=0||scores.length>10)throw Error('Positive temperature and at most ten bars required');
      const m=Math.max(...scores),weights=scores.map(s=>Math.exp((s-m)/temperature)),z=weights.reduce((s,v)=>s+v,0),p=weights.map(v=>v/z);
      const frame=this.axes(id+'-axes',{xDomain:[0,scores.length],yDomain:[0,1],xLabel:'候选项',yLabel:'注意力权重（概率）',xTicks:!labels}),cell=(frame.right-frame.left)/scores.length;
      p.forEach((v,i)=>{const drawn=mix(1/p.length,v,progress),x=frame.left+i*cell+cell*.18,y=frame.y(drawn);this.rect(`${id}-bar-${i}`,x,y,cell*.64,frame.bottom-y,palette.blue);this.text(`${id}-value-${i}`,drawn.toFixed(2),x+cell*.32,y-8,{anchor:'middle',size:14});if(labels)this.label(`${id}-label-${i}`,labels[i],x+cell*.32,frame.bottom+22,{anchor:'middle',size:13,maxWidth:cell*.9,avoid:false});});
      return {scores,temperature,probabilities:p,sum:p.reduce((s,v)=>s+v,0),progress};
    }
  }
  function dot(a,b) { if(a.length!==b.length)throw Error('Vector shapes differ');return a.reduce((s,v,i)=>s+v*b[i],0); }
  function matmul(a,b) { if(!a.length||!b.length||a[0].length!==b.length)throw Error('Matrix shapes differ');return a.map(row=>b[0].map((_,j)=>dot(row,b.map(r=>r[j])))); }
  function trace(kind,gradient,start,{eta=.1,rho=.9,epsilon=1e-8,steps=30}={}) {
    let theta=[...start],square=theta.map(()=>0),velocity=theta.map(()=>0);const out=[{theta:[...theta],square:[...square],gradient:gradient(theta),step:0}];
    for(let t=1;t<=steps;t++) { const g=gradient(theta);if(g.length!==theta.length)throw Error('Gradient shape differs');
      theta=theta.map((v,i)=> { if(kind==='rmsprop') { square[i]=rho*square[i]+(1-rho)*g[i]**2;return v-eta*g[i]/Math.sqrt(square[i]+epsilon); }if(kind==='adagrad') { square[i]+=g[i]**2;return v-eta*g[i]/Math.sqrt(square[i]+epsilon); }if(kind==='momentum') { velocity[i]=rho*velocity[i]+g[i];return v-eta*velocity[i]; }if(kind==='sgd')return v-eta*g[i];throw Error('Unknown optimizer '+kind); });
      if(!theta.every(Number.isFinite))throw Error('Optimizer diverged to non-finite');out.push({theta:[...theta],square:[...square],gradient:[...g],step:t});
    }return out;
  }
  function interpolateTrace(points,progress) { const at=clamp(progress,0,1)*(points.length-1),i=Math.floor(at),j=Math.min(points.length-1,i+1);return {theta:points[i].theta.map((v,k)=>mix(v,points[j].theta[k],at-i)),index:at,previous:points[i],next:points[j]}; }
  global.VisualBook={Board,palette,measure,lines,clamp,mix,dot,matmul,trace,interpolateTrace};
})(window);

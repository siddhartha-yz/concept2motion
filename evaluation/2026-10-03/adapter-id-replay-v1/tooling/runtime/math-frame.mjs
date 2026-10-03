/** Small drawing/evidence adapter for the two existing math contracts. No lesson template.
 * Text and mathematical shapes have separate ID namespaces in the bounds registry.
 */
export function createMathFrame(canvas,{caseId,time,stage,inputs,background='#10151f'}) {
  const ctx=canvas.getContext('2d');
  if(!ctx||!Number.isFinite(time))throw Error('Canvas2D and finite frame time required');
  const finite=(...values)=>{if(!values.every(Number.isFinite))throw Error('Finite drawing coordinates required');};
  const triplet=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  let mechanism,geometry={};
  if(caseId==='softmax'&&triplet(inputs?.logits)) {
    const logits=[...inputs.logits],masses=logits.map(Math.exp),denominator=masses.reduce((a,b)=>a+b,0);
    if(!Number.isFinite(denominator)||denominator<=0)throw Error('Raw exponentials outside supported finite range');
    mechanism={logits,masses,denominator,probabilities:masses.map(m=>m/denominator)};
    geometry={massBars:[]};
  } else if(caseId==='residual'&&triplet(inputs?.x)&&triplet(inputs?.residual)) {
    mechanism={input:[...inputs.x],identity:[...inputs.x],correction:[...inputs.residual],output:inputs.x.map((v,i)=>v+inputs.residual[i])};
    geometry={identity:[],correction:[],output:[]};
  } else throw Error('Supported case and three finite inputs required');
  const bounds=[],used=new Set();
  const register=(id,kind,rect,opacity)=>{
    if(typeof id!=='string'||!id.trim())throw Error(`Nonempty ${kind} drawing ID required: ${String(id)}`);
    const key=`${kind}:${id}`;
    if(used.has(key))throw Error(`Duplicate ${kind} drawing ID "${id}" in one frame; draw each object once or give a separate instance a distinct ID`);
    finite(rect.x,rect.y,rect.width,rect.height,opacity);
    if(rect.width<0||rect.height<0||opacity<0||opacity>1)throw Error('Invalid bounds/opacity');
    used.add(key);bounds.push({...rect,id:key,sourceId:id,kind,opacity});
  };
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.shadowBlur=0;ctx.filter='none';ctx.setLineDash([]);ctx.fillStyle=background;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(0,0,canvas.width,canvas.height);
  const frame={
    text(id,text,x,y,{size=20,color='#edf2fa',align='left',opacity=1,font='sans-serif'}={}) {
      finite(x,y,size,opacity);if(size<=0)throw Error('Positive text size required');
      ctx.save();ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='alphabetic';
      const metrics=ctx.measureText(String(text)),ascent=metrics.actualBoundingBoxAscent??size*.8,descent=metrics.actualBoundingBoxDescent??size*.2;
      const rect={x:align==='center'?x-metrics.width/2:align==='right'?x-metrics.width:x,y:y-ascent,width:metrics.width,height:ascent+descent};
      register(id,'text',rect,opacity);ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fillText(String(text),x,y);ctx.restore();
    },
    massBar(index,{x,y,width,height=16,color,opacity=1}) {
      if(caseId!=='softmax'||!Number.isInteger(index)||index<0||index>2)throw Error(`massBar(index, options) requires softmax and an integer class index 0..2; received caseId=${caseId}, index=${String(index)}`);
      const id=`mass-${index}`,rect={x,y,width,height};register(id,'shape',rect,opacity);
      ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fillRect(x,y,width,height);ctx.restore();
      (geometry.massBars??=[]).push({id,...rect,color,opacity});
    },
    partition({x,y,width,height=22},segments) {
      finite(x,y,width,height);if(caseId!=='softmax'||width<=0||height<=0||!Array.isArray(segments)||segments.length!==3)throw Error('Three probability segments required');
      geometry.capacity={x,y,width,height};geometry.segments=[];let cursor=x;
      segments.forEach(({probability,color},i)=>{
        finite(probability);if(probability<0)throw Error('Nonnegative segment required');
        const segment={id:`class-${i}`,x:cursor,y,width:width*probability,height,color};
        register(segment.id,'shape',segment,1);ctx.fillStyle=color;ctx.fillRect(segment.x,y,segment.width,height);
        geometry.segments.push(segment);cursor+=segment.width;
      });
    },
    vector(role,index,{start,value,unitScale,color,strokeWidth=4}) {
      if(caseId!=='residual'||!['identity','correction','output'].includes(role)||!Number.isInteger(index)||index<0||index>2)throw Error(`vector(role, index, options) requires residual, role identity/correction/output and integer index 0..2; received caseId=${caseId}, role=${String(role)}, index=${String(index)}. Use identity for the unchanged input path`);
      finite(start?.x,start?.y,value,unitScale,strokeWidth);if(unitScale<=0||strokeWidth<=0)throw Error('Positive scale/stroke required');
      if(geometry.unitScale!==undefined&&geometry.unitScale!==unitScale)throw Error('All component vectors must share one scale');
      const id=`${role}-${index}`,end={x:start.x+value*unitScale,y:start.y},tip=6,sign=value<0?-1:1;
      register(id,'shape',{x:Math.min(start.x,end.x)-strokeWidth/2,y:start.y-tip,
        width:Math.abs(end.x-start.x)+strokeWidth,height:2*tip},1);
      ctx.save();ctx.lineWidth=strokeWidth;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();
      ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
      if(value!==0){ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-sign*tip,end.y-tip);ctx.lineTo(end.x-sign*tip,end.y+tip);ctx.closePath();ctx.fill();}
      ctx.restore();const vector={id,start:{...start},end,color};
      geometry.unitScale=unitScale;(geometry[role]??=[]).push(vector);return structuredClone(vector);
    },
    finish() {
      // Return a detached snapshot: modifying it cannot change subsequent measurements.
      return structuredClone({time,stage,mechanism,geometry,bounds});
    }
  };
  return Object.freeze(frame);
}

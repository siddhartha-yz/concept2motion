/** Browser-serializable capture. Missing inspection metadata cannot stop drawing. */
export function captureFrame({t,withImage=true,previewSize=null}) {
  const raw=window.C2M.render(t),canvas=document.getElementById('scene');
  if(!canvas||canvas.width!==window.C2M.meta.width||canvas.height!==window.C2M.meta.height) {
    throw Error('Canvas dimensions differ from metadata');
  }
  const valid=raw&&typeof raw==='object'&&!Array.isArray(raw);
  const state=valid?raw:{},pixels=[],captureFindings=[],skippedProbes=[];let potentialProbes=0;
  if(!valid)captureFindings.push({code:'missing_frame_evidence',time_s:t,detail:'render drew a frame but returned no evidence object'});
  const sample=(id,x,y,expected)=>{
    if(![x,y].every(Number.isFinite)||x<0||y<0||x>=canvas.width||y>=canvas.height) {
      captureFindings.push({code:'invalid_pixel_probe',time_s:t,detail:String(id)});return;
    }
    try {
      const color=canvas.getContext('2d').getImageData(Math.floor(x),Math.floor(y),1,1).data;
      pixels.push({id,color:Array.from(color),expected});
    } catch(error) {
      captureFindings.push({code:'pixel_probe_failed',time_s:t,detail:String(error)});
    }
  };
  if(state.stage==='normalized'&&Array.isArray(state.geometry?.segments)) {
    for(const segment of state.geometry.segments){
      potentialProbes++;
      if((segment?.opacity??state.geometry.capacity?.opacity??1)>=.99&&segment?.width>=2&&segment?.height>=2)
        sample(segment?.id,segment?.x+segment?.width/2,segment?.y+segment?.height/2,segment?.color);
      else skippedProbes.push({id:segment?.id,reason:'translucent or smaller than a full interior pixel'});
    }
  }
  if(window.C2M.meta.caseId==='residual'&&state.stage==='output'&&Array.isArray(state.geometry?.output)) {
    for(const vector of state.geometry.output){
      potentialProbes++;
      const length=Math.abs(vector?.end?.x-vector?.start?.x);
      if((vector?.opacity??1)<.99||(vector?.reveal??1)<=0)skippedProbes.push({id:vector?.id,reason:'translucent or unrevealed'});
      else if((vector?.strokeWidth??2)<2||(Number.isFinite(length)&&length>0&&length<2))
        skippedProbes.push({id:vector?.id,reason:'subpixel stroke or short partial vector'});
      else sample(vector?.id,(vector?.start?.x+vector?.end?.x)/2,vector?.start?.y,vector?.color);
    }
  }
  if(state.stage==='exponential'&&Array.isArray(state.geometry?.massBars)) {
    for(const bar of state.geometry.massBars){
      potentialProbes++;
      if(bar?.opacity>=.99&&bar?.width>=2&&bar?.height>=2)sample(bar?.id,bar?.x+bar?.width/2,bar?.y+bar?.height/2,bar?.color);
      else skippedProbes.push({id:bar?.id,reason:'translucent or smaller than a full interior pixel'});
    }
  }
  let output=canvas;
  if(withImage&&previewSize) {
    output=document.createElement('canvas');output.width=previewSize.width;output.height=previewSize.height;
    output.getContext('2d').drawImage(canvas,0,0,output.width,output.height);
  }
  return {state:{...state,requestedTime:t},pixels,captureFindings,
    pixelCoverage:{potential:potentialProbes,sampled:pixels.length,unavailable:potentialProbes-pixels.length,skipped:skippedProbes},
    data:withImage?output.toDataURL('image/jpeg',.95):null};
}

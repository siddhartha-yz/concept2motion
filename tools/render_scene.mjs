/** Render a local scene at fixed frame times, preserving source and evidence. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { checkFrame, checkVideo } from './contracts.mjs';

const { values }=parseArgs({options:{
  scene:{type:'string'},out:{type:'string'},'checks-only':{type:'boolean',default:false},
  brief:{type:'string'},author:{type:'string',default:'unspecified'},samples:{type:'string',default:'0.5,2,4.5,6.5,7.8,9.3,10.7,11.8'}
}});
if(!values.scene||!values.out)throw Error('--scene and --out are required');
const scene=await realpath(resolve(values.scene)),root=dirname(scene),out=resolve(values.out);
if(out===root||out.startsWith(root+sep))throw Error('Output must be outside the source directory');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourceHash=data=>createHash('sha256').update(data).digest('hex');
const require=createRequire(import.meta.url);
const playwrightPath=process.env.C2M_NODE_MODULES?join(process.env.C2M_NODE_MODULES,'playwright'):'playwright';
const {chromium}=require(playwrightPath);
const playwrightVersion=require(join(playwrightPath,'package.json')).version;
const cases=JSON.parse(await readFile(join(repo,'benchmarks/cases.json'),'utf8'));
await mkdir(dirname(out),{recursive:true});
await mkdir(out); // Refuse to overwrite an existing attempt.
await mkdir(join(out,'source'));
const sources=[];
const assetExtensions=new Set(['.html','.js','.mjs','.css','.json','.png','.jpg','.jpeg','.svg','.woff','.woff2']);
async function snapshot(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.name==='node_modules')continue;
    if(entry.isSymbolicLink())throw Error('Scene sources must not be symlinks');
    const p=join(dir,entry.name),name=relative(root,p);
    if(entry.isDirectory()){await mkdir(join(out,'source',name),{recursive:true});await snapshot(p);}
    else if(assetExtensions.has(extname(p))){const data=await readFile(p);await writeFile(join(out,'source',name),data);sources.push({path:name,sha256:sourceHash(data)});}
  }
}
await snapshot(root);
const frozenRoot=join(out,'source');
const started=Date.now(),manifest={status:'started',author:values.author,sources,
  playwrightVersion,artistic_acceptance:'pending_user_review',errors:[],externalRequests:[]};
const saveManifest=()=>writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await saveManifest();
const server=createServer(async(req,res)=>{
  try{
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
    const path=join(frozenRoot,route||relative(root,scene));
    if(!path.startsWith(frozenRoot+sep)||!assetExtensions.has(extname(path)))throw Error('Unavailable asset');
    const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,encoder;
async function processResult(command,args){
  const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const done=once(child,'close');const [code]=await done;
  if(code!==0)throw Error(`${command} exited ${code}: ${stderr.slice(-2000)}`);
  return stdout;
}
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.C2M_CHROMIUM,
    args:['--no-sandbox','--ozone-platform=headless','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']});
  manifest.chromiumVersion=browser.version();
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>manifest.errors.push(e.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    manifest.externalRequests.push(route.request().url());return route.abort();
  });
  await page.goto(`${origin}/${relative(root,scene).split(sep).join('/')}?export=1`,{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  const meta=await page.evaluate(()=>window.C2M?.meta);
  if(!meta||meta.version!==1||![meta.width,meta.height,meta.duration,meta.fps].every(x=>Number.isFinite(x)&&x>0)){
    throw Error('Scene must expose valid window.C2M version 1 metadata');
  }
  if(meta.width%2||meta.height%2||!Number.isInteger(meta.fps)||!Number.isInteger(meta.duration*meta.fps)){
    throw Error('Video dimensions must be even and duration*fps must be an integer');
  }
  await page.setViewportSize({width:meta.width,height:meta.height});
  const brief=values.brief?JSON.parse(await readFile(values.brief,'utf8')):cases.find(c=>c.id===meta.caseId);
  if(!brief||brief.id!==meta.caseId)throw Error('Brief must match scene caseId');
  await writeFile(join(out,'brief.json'),JSON.stringify(brief,null,2)+'\n');
  Object.assign(manifest,{meta,brief_sha256:sourceHash(JSON.stringify(brief)),mode:values['checks-only']?'checks':'video'});
  const capture=async(t,withImage=true)=>page.evaluate(({t,withImage})=>{
    const state=window.C2M.render(t),canvas=document.getElementById('scene');
    if(canvas.width!==window.C2M.meta.width||canvas.height!==window.C2M.meta.height)throw Error('Canvas dimensions differ from metadata');
    const pixels=[];
    if(state.stage==='normalized')for(const segment of state.geometry.segments){
      const color=canvas.getContext('2d').getImageData(Math.floor(segment.x+segment.width/2),Math.floor(segment.y+segment.height/2),1,1).data;
      pixels.push({id:segment.id,color:Array.from(color),expected:segment.color});
    }
    return {state:{...state,requestedTime:t},pixels,data:withImage?canvas.toDataURL('image/jpeg',0.95):null};
  },{t,withImage});
  const inspect=result=>{
    const checked=checkFrame(result.state,brief,meta);
    for(const pixel of result.pixels){
      const expected=pixel.expected?.match(/^#([0-9a-f]{6})$/i)?.[1];
      if(!expected){checked.findings.push({code:'missing_pixel_reference',detail:pixel.id,time_s:result.state.time});continue;}
      const rgb=[0,2,4].map(i=>parseInt(expected.slice(i,i+2),16));
      if(rgb.some((c,i)=>Math.abs(c-pixel.color[i])>12))checked.findings.push({code:'pixel_mismatch',detail:pixel.id,time_s:result.state.time});
    }
    checked.passed=checked.findings.length===0;return checked;
  };
  const evidence=[],findings=[];
  const times=[...new Set([...Array.from({length:49},(_,i)=>meta.duration*i/48),
    ...values.samples.split(',').map(Number)])].sort((a,b)=>a-b);
  for(const t of times){const result=await capture(t,false),checked=inspect(result);findings.push(...checked.findings);evidence.push({...result.state,pixelSamples:result.pixels});}
  for(const t of values.samples.split(',').map(Number)){
    const result=await capture(t);await writeFile(join(out,`frame-${t.toFixed(2)}.jpg`),Buffer.from(result.data.split(',')[1],'base64'));
  }
  const repeatedTime=meta.duration*11/12,interveningTime=meta.duration/12;
  const a=await capture(repeatedTime);await capture(interveningTime);const c=await capture(repeatedTime);
  manifest.determinism={time_s:repeatedTime,intervening_time_s:interveningTime,first_sha256:sourceHash(a.data),second_sha256:sourceHash(c.data),passed:a.data===c.data};
  if(!manifest.determinism.passed)findings.push({code:'nondeterministic_frame',time_s:repeatedTime});
  if(manifest.errors.length)findings.push({code:'pageerror',detail:manifest.errors.join('; ')});
  if(manifest.externalRequests.length)findings.push({code:'external_request',detail:'Scene requested external assets'});
  const checks={sampled_frames:times.length,passed:findings.length===0,findings};
  await writeFile(join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');
  await writeFile(join(out,'frame-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  manifest.checks=checks;
  if(!checks.passed){manifest.status='checks_failed';process.exitCode=1;}
  else if(values['checks-only'])manifest.status='checks_passed';
  else{
    const ffmpeg=process.env.C2M_FFMPEG||'ffmpeg';
    manifest.ffmpegVersion=(await processResult(ffmpeg,['-version'])).split('\n')[0];
    encoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg',
      '-framerate',String(meta.fps),'-i','pipe:0','-c:v','libx264','-threads','2','-preset','medium',
      '-crf','19','-pix_fmt','yuv420p','-an','-movflags','+faststart',join(out,'video.mp4')],{stdio:['pipe','ignore','pipe']});
    let encoderError='';encoder.stderr.on('data',b=>encoderError+=b);
    const done=once(encoder,'close');encoder.stdin.on('error',()=>{});
    const frames=meta.duration*meta.fps,fullFindings=[];
    for(let i=0;i<frames;i++){
      const result=await capture(i/meta.fps),checked=inspect(result);fullFindings.push(...checked.findings);
      if(encoder.exitCode!==null)throw Error(`FFmpeg stopped during capture: ${encoderError}`);
      if(!encoder.stdin.write(Buffer.from(result.data.split(',')[1],'base64'))){
        const drained=await Promise.race([once(encoder.stdin,'drain').then(()=>true),done.then(()=>false)]);
        if(!drained)throw Error(`FFmpeg closed before frame stream completed: ${encoderError}`);
      }
      if(i%120===0)console.log(`${i}/${frames} frames`);
    }
    encoder.stdin.end();const [code]=await done;encoder=undefined;
    if(code!==0)throw Error(`FFmpeg exited ${code}: ${encoderError}`);
    checks.full_video_frame_checks={frames,passed:fullFindings.length===0,findings:fullFindings};
    const probe=JSON.parse(await processResult(process.env.C2M_FFPROBE||'ffprobe',[
      '-v','error','-select_streams','v:0','-show_streams','-of','json',join(out,'video.mp4')]));
    const stream=probe.streams[0];manifest.video=checkVideo(stream,meta);manifest.video.stream=stream;
    await processResult(ffmpeg,['-v','error','-i',join(out,'video.mp4'),'-f','null','-']);
    manifest.video.full_decode_passed=true;
    if(manifest.errors.length||manifest.externalRequests.length){
      checks.findings.push({code:'late_page_error_or_request',detail:'See manifest errors and externalRequests'});
      checks.passed=false;
    }
    checks.passed=checks.passed&&checks.full_video_frame_checks.passed&&manifest.video.passed;
    await writeFile(join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');
    manifest.status=checks.passed?'render_passed':'checks_failed';if(!checks.passed)process.exitCode=1;
    manifest.video.sha256=sourceHash(await readFile(join(out,'video.mp4')));
  }
}catch(error){manifest.status='execution_failed';manifest.errors.push(String(error));process.exitCode=1;console.error(error);}
finally{
  encoder?.kill();await browser?.close();server.close();
  manifest.wall_seconds=(Date.now()-started)/1000;await saveManifest();
  console.log(JSON.stringify({status:manifest.status,out,wall_seconds:manifest.wall_seconds}));
}

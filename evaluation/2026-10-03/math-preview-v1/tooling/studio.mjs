/** Warm, deterministic local motion preview service. No model calls. */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, join, extname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import {captureFrame} from './capture_frame.mjs';
import {checkCaptured} from './contracts.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const extensions = new Set(['.mjs','.js','.html','.css','.json','.png','.jpg','.jpeg','.svg','.woff','.woff2']);
const types = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
const json = value => JSON.stringify(value, null, 2) + '\n';

export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Request must be an object');
  if (typeof body.sceneRoot !== 'string' || !body.sceneRoot || typeof body.out !== 'string' || !body.out) throw Error('sceneRoot and out are required');
  if (!['direct','infra','math'].includes(body.arm)) throw Error('arm must be direct, infra or math');
  const math=body.arm==='math',brief=math?structuredClone(body.brief):null;
  if(math&&(!brief||!['softmax','residual'].includes(brief.id)||!Number.isFinite(brief.duration_s)||brief.duration_s<=0||brief.duration_s>60))
    throw Error('math preview requires a supported brief with duration_s in (0,60]');
  if(math) {
    const arrays=brief.id==='softmax'?[brief.inputs?.logits]:[brief.inputs?.x,brief.inputs?.residual];
    if(arrays.some(a=>!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite)))throw Error('math preview requires three finite inputs per role');
  }
  const duration=math?brief.duration_s:10;
  const from = body.from ?? 0, to = body.to ?? duration, fps = body.fps ?? 24, width = body.width ?? 960;
  if (![from,to,fps,width].every(Number.isFinite) || from < 0 || to > duration || from >= to) throw Error(`Require 0 <= from < to <= ${duration}`);
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw Error('fps must be an integer from 1 to 60');
  if (!Number.isInteger(width) || width < 160 || width > 1920 || width % 32 !== 0) throw Error('width must be divisible by 32, from 160 to 1920');
  if (body.checksOnly !== undefined && typeof body.checksOnly !== 'boolean') throw Error('checksOnly must be boolean');
  const checksOnly=body.checksOnly ?? false;
  const timeoutS=body.timeoutS ?? 60;
  if(!Number.isFinite(timeoutS)||timeoutS<1||timeoutS>60)throw Error('timeoutS must be from 1 to 60 seconds');
  const frames = Math.round((to-from)*fps);
  if (Math.abs(frames-(to-from)*fps) > 1e-7 || frames < 1) throw Error('Interval must contain an integral number of frames');
  const times = body.times ?? [from, (from+to)/2, to];
  if (!Array.isArray(times) || times.length > 100 || times.some(t => !Number.isFinite(t) || t < 0 || t > duration)) throw Error(`times must contain at most 100 finite times in [0,${duration}]`);
  if (checksOnly && times.length === 0) throw Error('checksOnly requires at least one sample time');
  const sceneRoot = resolve(body.sceneRoot), out = resolve(body.out);
  if (out === sceneRoot || out.startsWith(sceneRoot+sep)) throw Error('Output must be outside sceneRoot');
  return {sceneRoot,out,arm:body.arm,from,to,fps,width,height:width*9/16,frames,checksOnly,timeoutS,times:[...new Set(times)],...(math?{brief}:{})};
}

export function safeAssetPath(root, requestPath) {
  const path = resolve(root, '.' + '/' + requestPath);
  if (path === root || !path.startsWith(root+sep) || !extensions.has(extname(path))) throw Error('Unavailable asset');
  return path;
}

export async function freezeSource(root, out, runtimeRoot = join(repo,'runtime'), onCreated=()=>{}, {native=false}={}) {
  root = await realpath(root);
  await mkdir(dirname(out), {recursive:true});
  await mkdir(out); // Exclusive: never erase or reuse any prior candidate.
  onCreated();
  const frozen = join(out,'source'), sources = [];
  await mkdir(frozen);
  const copy = async (base, target, prefix='') => {
    for (const entry of await readdir(base,{withFileTypes:true})) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isSymbolicLink()) throw Error('Symlink sources are unsupported');
      const source = join(base,entry.name), name = join(prefix,entry.name), dest = join(target,entry.name);
      if (entry.isDirectory()) { await mkdir(dest); await copy(source,dest,name); }
      else if (extensions.has(extname(source))) { const data = await readFile(source); await writeFile(dest,data); sources.push({path:name.split(sep).join('/'),sha256:hash(data),bytes:data.length}); }
    }
  };
  await copy(root,frozen);
  // Runtime files always come from the infrastructure snapshot, never candidate overrides.
  if(!native) {
    if (sources.some(s=>s.path.startsWith('runtime/'))) throw Error('Candidate runtime/ directory is reserved');
    await mkdir(join(frozen,'runtime'));
    await copy(runtimeRoot,join(frozen,'runtime'),'runtime');
  }
  await readFile(join(frozen,native?'index.html':'scene.mjs')); // Entry point is mandatory.
  return {frozen,sources};
}

export async function readTimingOverride(frozen,arm) {
  let data;
  try {data=await readFile(join(frozen,'timing.json'));}
  catch(error) {if(error.code==='ENOENT')return null;throw error;}
  if(arm!=='infra')throw Error('timing.json requires the infra timing binding');
  const timings=JSON.parse(data.toString('utf8'));
  if(!timings || typeof timings!=='object' || Array.isArray(timings))throw Error('timing.json must contain an object');
  return {timings,path:'timing.json',sha256:hash(data),bytes:data.length};
}

export function loader(arm, timingOverride=null) {
  const timings=JSON.stringify(timingOverride?.timings ?? {}).replace(/</g,'\\u003c');
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style><canvas id="scene" width="1920" height="1080"></canvas><script type="module">
import {createScene} from './scene.mjs';
${arm === 'infra' ? "import {createRuntime} from './runtime/concept-runtime.mjs';" : ''}
try {
const canvas=document.getElementById('scene');
const candidate=await createScene(${arm === 'infra' ? `createRuntime(canvas,{width:1920,height:1080,fps:24,timings:${timings}})` : 'canvas'});
const render=candidate?.render;
if(typeof render!=='function'||!candidate?.meta)throw Error('createScene must return {render(t),meta}');
window.C2M={meta:candidate.meta,render:t=>render.call(candidate,t)};
window.C2M_READY=true;
} catch(error) {window.C2M_FAILURE={name:error?.name||'Error',message:error?.message||String(error)};}
</script>`;
}

async function encode(job, out,timeoutMs=60000) {
  const cmd = process.env.C2M_FFMPEG || 'ffmpeg';
  const child = spawn(cmd,['-hide_banner','-loglevel','error','-nostdin','-framerate',String(job.fps),'-start_number','0','-i',join(out,'frames','%06d.jpg'),'-frames:v',String(job.frames),'-c:v','libx264','-threads','2','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-an','-movflags','+faststart',join(out,'preview.mp4')],{stdio:['ignore','ignore','pipe']});
  let stderr=''; child.stderr.on('data',data=>{stderr=(stderr+data).slice(-4000);});
  const deadline=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
  try { const [code] = await once(child,'close'); if(code!==0) throw Error(`FFmpeg exited ${code}: ${stderr}`); }
  finally {clearTimeout(deadline);}
}

export async function startStudio({port=0, chromium:providedChromium, runtimeRoot=join(repo,'runtime'),checksOnly=false}={}) {
  const boot=performance.now();
  if (!providedChromium) {
    const require=createRequire(import.meta.url);
    ({chromium:providedChromium}=require(process.env.C2M_NODE_MODULES ? join(process.env.C2M_NODE_MODULES,'playwright') : 'playwright'));
  }
  const browser=await providedChromium.launch({headless:true,executablePath:process.env.C2M_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--ozone-platform=headless','--use-gl=angle','--use-angle=gl']});
  const jobs = new Map();
  let origin, queue=Promise.resolve(), closing=false;
  const send = (res,status,value) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(json(value));};
  const preview = async body => {
    const started=performance.now(), job=validateRequest(body);
    const deadline=started+job.timeoutS*1000;
    let outCreated=false, page, renderDeadline;
    const result={status:'started',mode:job.checksOnly?'samples':'video',jobId:randomUUID(),request:job,artistic_acceptance:'pending_user_review',errors:[],externalRequests:[],timing:{queue_excluded:true},browserVersion:browser.version()};
    try {
      const snapStart=performance.now();
      // realpath closes the source-directory alias hole in output ancestry checks.
      job.sceneRoot=await realpath(job.sceneRoot);
      const outParent=await realpath(dirname(job.out)).catch(()=>null);
      const physicalOut=outParent?join(outParent,job.out.slice(dirname(job.out).length+1)):job.out;
      if(physicalOut===job.sceneRoot || physicalOut.startsWith(job.sceneRoot+sep)) throw Error('Output must be outside sceneRoot');
      const {frozen,sources}=await freezeSource(job.sceneRoot,job.out,runtimeRoot,()=>{outCreated=true;},{native:job.arm==='math'});
      result.sources=sources;
      await writeFile(join(job.out,'result.json'),json(result)); result.timing.snapshot_s=(performance.now()-snapStart)/1000;
      const id=result.jobId; jobs.set(id,{root:frozen,arm:job.arm});
      if(!job.checksOnly)await mkdir(join(job.out,'frames'));
      await mkdir(join(job.out,'samples'));
      const timingOverride=job.arm==='math'?null:await readTimingOverride(frozen,job.arm);
      result.timing_source=timingOverride?{path:timingOverride.path,sha256:timingOverride.sha256,bytes:timingOverride.bytes}:null;
      if(job.arm!=='math')await writeFile(join(job.out,'source','loader.html'),loader(job.arm,timingOverride));
      if(job.arm==='math') {
        await writeFile(join(job.out,'brief.json'),json(job.brief));
        await mkdir(join(job.out,'tooling'));
        result.tooling=[];
        for(const name of ['studio.mjs','contracts.mjs','capture_frame.mjs']) {
          const data=await readFile(join(repo,'tools',name));await writeFile(join(job.out,'tooling',name),data);
          result.tooling.push({path:name,sha256:hash(data)});
        }
      }
      page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
      page.setDefaultTimeout(15000);
      renderDeadline=setTimeout(()=>page.close().catch(()=>{}),Math.max(1,deadline-performance.now()));
      const pageFailure=new Promise(resolveFailure=>{
        page.on('pageerror',e=>{result.errors.push(e.message);resolveFailure(e);});
      });
      await page.route('**/*',route=> {
        const url=route.request().url();
        if(new URL(url).origin===origin) return route.continue();
        result.externalRequests.push(url); return route.abort();
      });
      const loadStart=performance.now();
      await Promise.race([
        (async()=>{
          await page.goto(`${origin}/jobs/${id}/${job.arm==='math'?'index.html?export=1':'loader.html'}`,{waitUntil:'load'});
          await page.waitForFunction(()=>window.C2M?.meta || window.C2M_READY || window.C2M_FAILURE || false);
          const failure=await page.evaluate(()=>window.C2M_FAILURE ?? null);
          if(failure){const cause=Error(failure.message);cause.name=failure.name||'Error';throw cause;}
        })(),
        pageFailure.then(error=>{throw error;})
      ]);
      await page.evaluate(()=>document.fonts.ready);
      const meta=await page.evaluate(()=>window.C2M.meta);
      if(job.arm==='math') {
        if(!meta||meta.version!==1||meta.caseId!==job.brief.id||meta.duration!==job.brief.duration_s||
           ![meta.width,meta.height].every(x=>Number.isInteger(x)&&x>0&&x%2===0))throw Error('Native math metadata must match brief and valid even canvas dimensions');
        await page.setViewportSize({width:meta.width,height:meta.height});
      }else if(!meta || meta.width!==1920 || meta.height!==1080 || meta.duration!==10) throw Error('Metadata must be 1920x1080 and duration 10');
      result.meta=meta; result.timing.load_s=(performance.now()-loadStart)/1000;
      const mathFindings=[];let mathChecked=0,pixelPotential=0,pixelSampled=0;
      const capture=async (t,format='jpeg')=> {
        if(job.arm==='math') {
          const captured=await page.evaluate(captureFrame,{t,withImage:true,previewSize:{width:job.width,height:job.height}});
          const checked=checkCaptured(captured,job.brief,meta);mathFindings.push(...checked.findings);mathChecked++;
          pixelPotential+=captured.pixelCoverage.potential;pixelSampled+=captured.pixelCoverage.sampled;
          return {...captured,imageFormat:'jpeg'};
        }
        return page.evaluate(({t,format,width,height})=>{
        const state=window.C2M.render(t) ?? null;
        const source=document.getElementById('scene');
        if(source.width!==1920 || source.height!==1080) throw Error('Canvas changed dimensions');
        const output=document.createElement('canvas'); output.width=width;output.height=height;
        output.getContext('2d').drawImage(source,0,0,width,height);
        return {state,data:output.toDataURL('image/'+format,format==='jpeg'?.92:undefined)};
        },{t,format,width:job.width,height:job.height});
      };
      const bytes = data=>Buffer.from(data.slice(data.indexOf(',')+1),'base64');
      const captureStart=performance.now(), states=[];
      for(let i=0;!job.checksOnly && i<job.frames;i++) {
        const time=job.from+i/job.fps, captured=await capture(time);
        await writeFile(join(job.out,'frames',`${String(i).padStart(6,'0')}.jpg`),bytes(captured.data));
        states.push({frame:i,time_s:time,state:captured.state});
      }
      result.timing.capture_s=(performance.now()-captureStart)/1000;
      const samples=[], sampleStart=performance.now();
      for(let i=0;i<job.times.length;i++) {
        const t=job.times[i], captured=await capture(t,'png'), name=`sample-${String(i).padStart(3,'0')}-${t.toFixed(3)}.${job.arm==='math'?'jpg':'png'}`;
        await writeFile(join(job.out,'samples',name),bytes(captured.data));
        samples.push({time_s:t,file:`samples/${name}`,sha256:hash(bytes(captured.data)),state:captured.state});
      }
      result.timing.samples_s=(performance.now()-sampleStart)/1000;
      result.sample_count=samples.length;
      const repeated=job.from+(job.to-job.from)*.75, between=job.from+(job.to-job.from)*.25;
      const first=await capture(repeated,'png'); await capture(between,'png'); const second=await capture(repeated,'png');
      result.determinism={time_s:repeated,intervening_time_s:between,first_sha256:hash(bytes(first.data)),second_sha256:hash(bytes(second.data)),passed:first.data===second.data};
      await writeFile(join(job.out,'states.json'),json({frames:states,samples}));
      if(!result.determinism.passed) throw Error('History independence PNG check failed');
      if(result.errors.length) throw Error('Page errors: '+result.errors.join('; '));
      if(result.externalRequests.length) throw Error('External requests blocked');
      if(job.arm==='math') {
        result.math_checks={scope:'requested clip frames, samples and seek probes only; no whole-scene coverage or artistic approval',captures:mathChecked,passed:mathFindings.length===0,findings:mathFindings,
          pixel_coverage:{potential:pixelPotential,sampled:pixelSampled,unavailable:pixelPotential-pixelSampled}};
        result.determinism.format='jpeg';
      }
      if(job.checksOnly) {
        result.status='samples_ready';
        result.scope=`Sampled stills and ${job.arm==='math'?'JPEG':'PNG'} history check only; no encoded motion or artistic acceptance`;
      } else {
        const encodingStart=performance.now();
        const remainingMs=deadline-performance.now();
        if(remainingMs<=0)throw Error('Preview timeout exceeded');
        await encode(job,job.out,remainingMs); result.timing.encode_s=(performance.now()-encodingStart)/1000;
        result.status='preview_ready';result.scope='Draft local interval, no complete scene technical pass or artistic acceptance';result.video={path:'preview.mp4',width:job.width,height:job.height,fps:job.fps,frames:job.frames,duration_s:job.frames/job.fps,from_s:job.from,to_s:job.to};
      }
    } catch(error) {result.status='failed'; result.error={name:error.name,message:error.message};}
    finally {
      if(renderDeadline)clearTimeout(renderDeadline);
      if(page)await page.close().catch(()=>{});
      result.timing.total_s=(performance.now()-started)/1000;
      if(outCreated) await writeFile(join(job.out,'result.json'),json(result)).catch(e=>{result.errors.push('Could not save result: '+e.message);});
    }
    return result;
  };
  const server=createServer(async(req,res)=> {
    try {
      const url=new URL(req.url,origin||'http://127.0.0.1');
      if(req.method==='GET' && url.pathname==='/health')return send(res,200,{status:'ready',browserVersion:browser.version()});
      if(req.method==='POST' && url.pathname==='/preview') {
        if(closing)return send(res,503,{error:'Studio closing'});
        let data='',received=0;
        for await (const part of req) {received+=part.length;if(received>1024*1024)throw Error('Request too large');data+=part;}
        const body=JSON.parse(data);
        if(body && body.checksOnly===undefined)body.checksOnly=checksOnly;
        validateRequest(body);
        const queuedAt=performance.now();
        const pending=queue.then(()=>preview(body)); queue=pending.then(()=>{},()=>{});
        const value=await pending; value.timing.queue_s=(performance.now()-queuedAt)/1000-value.timing.total_s;
        // Persist queue timing too, without touching any preexisting failed output.
        if(value.sources)await writeFile(join(value.request.out,'result.json'),json(value));
        return send(res,['preview_ready','samples_ready'].includes(value.status)?200:422,value);
      }
      const match=url.pathname.match(/^\/jobs\/([a-f0-9-]+)\/(.*)$/);
      if(req.method==='GET' && match) {
        const job=jobs.get(match[1]);if(!job)return send(res,404,{error:'Unknown job'});
        const path=safeAssetPath(job.root,decodeURIComponent(match[2]));
        const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);return;
      }
      send(res,404,{error:'Not found'});
    }catch(error){if(!res.headersSent)send(res,400,{status:'failed',error:{name:error.name,message:error.message}});else res.end();}
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
  origin=`http://127.0.0.1:${server.address().port}`;
  return {origin,ready:{status:'ready',origin,port:server.address().port,capabilities:{timingFile:'timing.json',timingBinding:'infra-only',checksOnly:true,nativeMath:true},checksOnlyDefault:checksOnly,browserVersion:browser.version(),startup_s:(performance.now()-boot)/1000},async close(){closing=true;await queue;await new Promise(ok=>server.close(ok));await browser.close();}};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const index=process.argv.indexOf('--port');const port=index===-1?0:Number(process.argv[index+1]);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid --port');
  const runtimeIndex=process.argv.indexOf('--runtime');
  const runtimeRoot=runtimeIndex===-1?join(repo,'runtime'):resolve(process.argv[runtimeIndex+1] || '');
  const studio=await startStudio({port,runtimeRoot,checksOnly:process.argv.includes('--checks-only')}); process.stdout.write(JSON.stringify(studio.ready)+'\n');
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await studio.close();process.exit(0);};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}

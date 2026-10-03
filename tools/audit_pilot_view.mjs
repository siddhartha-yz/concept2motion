/** Actual browser/video interaction audit of the static evidence viewer. */
import {createRequire} from 'node:module';
import {mkdir,writeFile,stat} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.C2M_NODE_MODULES+'/playwright');
const [url,out]=process.argv.slice(2);if(!url||!out)throw Error('Local viewer URL and new audit directory required');
await mkdir(out,{recursive:false});const browser=await chromium.launch({headless:true,executablePath:process.env.C2M_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('section').length===4);
 const first=page.locator('section').nth(1);const vids=first.locator('.pair video');
 await page.waitForFunction(()=>[...document.querySelectorAll('section:nth-of-type(2) .pair video')].every(v=>v.readyState>=1));
 await first.locator('input').fill('11');await first.locator('input').dispatchEvent('input');
 await page.waitForFunction(()=>[...document.querySelectorAll('section:nth-of-type(2) .pair video')].every(v=>Math.abs(v.currentTime-11)<.02));
 await first.locator('button.play').click();await page.waitForTimeout(500);await first.locator('button.pause').click();
 const playback=await vids.evaluateAll(v=>v.map(x=>({time:x.currentTime,paused:x.paused,ready:x.readyState,width:x.videoWidth,height:x.videoHeight})));
 const privateLog='work/model-infra-pilot-v3/candidates/softmax-1-A/v1/call/stdout.log';
 const privateLogExists=(await stat(privateLog)).isFile();
 const response=await page.request.get(new URL('/'+privateLog,url).href);
 const json=await page.request.get(new URL('/work/pilot-view-v3-v1/evidence.json',url).href);const data=await json.json();
 const clip=data.groups[1].candidates.find(c=>c.arm==='B').video;
 const range=await page.request.get(new URL(clip,url).href,{headers:{Range:'bytes=0-99'}});
 const results={kind:'actual headless-browser evidence viewer audit; no model or artistic review',sections:await page.locator('section').count(),paired_videos:await page.locator('.pair video').count(),playback,errors,private_log_exists:privateLogExists,private_log_status:response.status(),range_status:range.status(),range_length:(await range.body()).length,
  passed:errors.length===0&&playback.length===2&&playback.every(v=>v.paused&&v.time>11&&v.width===854&&v.height===480)&&Math.abs(playback[0].time-playback[1].time)<.2&&privateLogExists&&response.status()===404&&range.status()===206};
 await page.screenshot({path:out+'/viewer.png',fullPage:true});await writeFile(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));if(!results.passed)process.exitCode=1;
}finally{await browser.close();}

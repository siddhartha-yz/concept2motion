/** Probe unmodified upstream modules independently of its full server. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  upstream: { type: 'string' }, out: { type: 'string' }
}});
if (!values.upstream || !values.out) throw new Error('--upstream and --out are required');
const upstream = resolve(values.upstream), out = resolve(values.out);
mkdirSync(out, { recursive: true });
const { register } = await import(pathToFileURL(join(upstream, 'node_modules/tsx/dist/esm/api/index.mjs')));
register();
const load = p => import(pathToFileURL(join(upstream, 'open-motion/src', p)));
const { MotionSpecSchema } = await load('shared/motion/spec.ts');
const { generateStandaloneHtml } = await load('motion/generator/html.ts');
const { generateVariations, extractDNA } = await load('agent/motionIntelligence.ts');
const { critiqueMotion } = await load('agent/motionCritique.ts');

const logits = [-1, 0.6, 1.8], colors = ['#64DCCA', '#8BA4FF', '#FFBA82'];
const masses = logits.map(Math.exp), total = masses.reduce((a, b) => a + b, 0);
const probabilities = masses.map(x => x / total);
let stackBottom = 130, partitionLeft = -300;
const timestamp = '2026-10-01T00:00:00Z';
const components = logits.map((value, i) => {
  const mass = masses[i], probability = probabilities[i];
  const stackY = stackBottom - 100;
  stackBottom -= mass * 28;
  const endX = partitionLeft;
  partitionLeft += probability * 600;
  const frame = (offset, x, y, sx, sy) => ({ offset, properties: {
    translateX: x, translateY: y, scaleX: sx, scaleY: sy
  }});
  const raw = [-200 + 200 * i, -100, 1, value];
  const exp = [-200 + 200 * i, -100, 1, mass * 0.28];
  const stack = [-180, stackY, 1.5, mass * 0.28];
  const normalized = [endX, -70, probability * 600 / 40, 0.6];
  return {
    id: `class${i}`, projectId: 'softmax-probe', name: `class ${i}`, durationMs: 12000,
    easing: { type: 'preset', name: 'ease-in-out' }, orderIndex: i,
    createdAt: timestamp, updatedAt: timestamp,
    style: { position: 'absolute', left: '50%', top: '50%', width: 40, height: 100,
      transformOrigin: 'left bottom', backgroundColor: colors[i], _content: ' ' },
    keyframes: [frame(0, ...raw), frame(0.15, ...raw), frame(0.35, ...exp),
      frame(0.4, ...exp), frame(0.6, ...stack), frame(0.65, ...stack),
      frame(0.85, ...normalized), frame(1, ...normalized)]
  };
});
const spec = MotionSpecSchema.parse({
  project: { id: 'softmax-probe', name: 'Shared denominator · module probe',
    globalTiming: { totalDurationMs: 12000 }, createdAt: timestamp, updatedAt: timestamp },
  components
});
const original = JSON.stringify(spec);
writeFileSync(join(out, 'spec.json'), JSON.stringify(spec, null, 2));
writeFileSync(join(out, 'original.html'), generateStandaloneHtml(structuredClone(spec)));
const edited = structuredClone(spec);
edited.components[0].durationMs = 6000;
edited.components[0].style.backgroundColor = '#FFFFFF';
const editedHtml = generateStandaloneHtml(edited);
assert.notEqual(editedHtml, generateStandaloneHtml(structuredClone(spec)));
writeFileSync(join(out, 'edited.html'), editedHtml);
const variants = generateVariations(spec.components[0], {
  axes: ['duration', 'easing', 'intensity'], countPerAxis: 3, seed: 42
});
assert.equal(variants.length, 9);
assert.equal(JSON.stringify(spec), original, 'variant generation mutated the original spec');
writeFileSync(join(out, 'variants.json'), JSON.stringify(variants, null, 2));
const critique = critiqueMotion(spec);
writeFileSync(join(out, 'critique.json'), JSON.stringify(critique, null, 2));
const result = {
  upstream_commit: execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: 'unmodified modules, not full application',
  schema_valid: true, html_generated: true, component_edit_changed_html: true,
  variation_count: variants.length, variations_preserved_original: true,
  dna: extractDNA(spec.components[0]), structural_critique_score: critique.overallScore,
  probabilities, probability_sum: probabilities.reduce((a, b) => a + b, 0),
  full_server_test: 'see separately recorded startup/build results',
  upstream_checkpoint_restore_tested: false, video_export_tested: false,
  upstream_model_calls: 0, live_vlm_tested: false,
  artistic_acceptance: 'pending_user_review'
};
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

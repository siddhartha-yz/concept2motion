// Independent of rendering and reading controls. All indexes are zero based.
export function tensorCells() {
  return Array.from({length: 24}, (_, i) => ({value: i + 1, batch: Math.floor(i / 8), head: Math.floor(i % 8 / 4), feature: i % 4, address: i}));
}
export function stableSoftmax(z) {
  if (!z.length || z.some(x => !Number.isFinite(x))) throw new RangeError('finite nonempty logits required');
  const max = Math.max(...z), numerators = z.map(x => Math.exp(x - max));
  const denominator = numerators.reduce((a, b) => a + b, 0);
  return {logits: [...z], max, numerators, denominator, probabilities: numerators.map(x => x / denominator)};
}
export function roofline({flops, bytes, computePerMs, bytesPerMs}) {
  if (![flops, bytes, computePerMs, bytesPerMs].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('positive finite quantities required');
  const computeMs = flops / computePerMs, memoryMs = bytes / bytesPerMs;
  return {intensity: flops / bytes, computeMs, memoryMs, estimatedMs: Math.max(computeMs, memoryMs)};
}
export function mechanismData(kind, stage) {
  if (kind === 'tensor') return {cells: tensorCells(), shape: [[3,8],[3,2,4],[2,3,4],[2,3,4]][stage], storageMoved: false};
  if (kind === 'softmax') return stableSoftmax(stage === 3 ? [3,2,3] : [1,2,3]);
  if (kind === 'intensity') return roofline({flops: 1000, bytes: [1000,1000,100,50][stage], computePerMs: 100, bytesPerMs: 10});
  throw new RangeError('unknown mechanism');
}

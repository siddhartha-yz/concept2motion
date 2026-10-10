// Reading is input to named states. A pointer is never treated as eye tracking.
export class ReadingController {
  constructor({steps, onActivate, mode = 'pointer', dwellMs = 170, clock = globalThis}) {
    this.steps = steps;
    this.onActivate = onActivate;
    this.mode = mode;
    this.dwellMs = dwellMs;
    this.clock = clock;
    this.paused = false;
    this.textOnly = false;
    this.selecting = false;
    this.active = null;
    this.candidate = null;
    this.timer = null;
    this.metrics = {activations: 0, candidates: 0, cancelled: 0};
  }
  blocked() { return this.paused || this.textOnly || this.selecting || this.mode === 'static'; }
  cancel() {
    if (this.timer !== null) { this.clock.clearTimeout(this.timer); this.metrics.cancelled++; }
    this.timer = null;
    this.candidate = null;
  }
  setMode(mode) {
    if (!['pointer','scroll','static'].includes(mode)) throw new RangeError('unknown reading mode');
    this.cancel(); this.mode = mode;
  }
  setPaused(paused) { this.cancel(); this.paused = !!paused; }
  setTextOnly(value) { this.cancel(); this.textOnly = !!value; }
  setSelecting(value) { this.cancel(); this.selecting = !!value; }
  scroll() { if (this.mode === 'pointer') this.cancel(); }
  pointer(step) {
    if (this.mode !== 'pointer' || this.blocked() || !step || !this.steps.includes(step)) { this.cancel(); return; }
    this.offer(step,'pointer');
  }
  offer(step,reason) {
    if(this.active===step){this.cancel();return;}
    if(this.candidate===step)return;
    this.cancel();
    this.candidate = step;
    this.metrics.candidates++;
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      const target = this.candidate;
      this.candidate = null;
      if (!this.blocked()) this.activate(target, reason);
    }, this.dwellMs);
  }
  focus(step) { this.cancel(); if (!this.blocked()) this.activate(step, 'keyboard'); }
  readingPosition(step) { if (this.mode === 'scroll' && !this.blocked() && this.steps.includes(step)) this.offer(step, 'scroll'); }
  activate(step, reason) {
    if (!step || !this.steps.includes(step) || this.active === step) return;
    this.active = step; this.metrics.activations++;
    this.onActivate(step, reason);
  }
  destroy() { this.cancel(); }
}

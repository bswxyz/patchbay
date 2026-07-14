/* The rack's voice — a single Web Audio graph that mirrors the patch.
   osc (saw) → filter (Bloom) → vca (Ledger) → master → out
   One LFO (Wobble) fans out through three depth gains to cutoff,
   tremolo and vibrato. Everything starts silent; the AudioContext is
   only created inside the user's click, so autoplay policy is happy. */

export interface PatchState {
  tone: boolean; // signal reaches the output module
  filtered: boolean; // Bloom sits in the signal path
  wobbleCutoff: boolean; // Wobble → Bloom CV
  wobbleTrem: boolean; // Wobble → Ledger CV
  wobbleVib: boolean; // Wobble → Drift V/OCT
}

const QUIET: PatchState = {
  tone: false,
  filtered: false,
  wobbleCutoff: false,
  wobbleTrem: false,
  wobbleVib: false,
};

export class PatchAudio {
  enabled = false;

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private vca!: GainNode;
  private filter!: BiquadFilterNode;
  private osc!: OscillatorNode;
  private lfoCut!: GainNode;
  private lfoTrem!: GainNode;
  private lfoVib!: GainNode;
  private state: PatchState = { ...QUIET };

  /** Toggle sound. Returns the new enabled state. */
  async toggle(): Promise<boolean> {
    if (!this.ctx) {
      try {
        this.build();
      } catch {
        return false; // no Web Audio — the panel still patches fine
      }
    }
    const ctx = this.ctx;
    if (!ctx) return false;
    this.enabled = !this.enabled;
    try {
      if (this.enabled) await ctx.resume();
    } catch {
      /* resume can be denied; apply() will keep the master at 0 */
    }
    this.apply();
    if (!this.enabled) {
      // let the release ramp finish before suspending
      window.setTimeout(() => {
        if (!this.enabled) void ctx.suspend();
      }, 350);
    }
    return this.enabled;
  }

  update(s: PatchState): void {
    this.state = { ...s };
    this.apply();
  }

  private build(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.vca = ctx.createGain();
    this.vca.gain.value = 0.7;
    this.vca.connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 16000;
    this.filter.Q.value = 0.0001;
    this.filter.connect(this.vca);

    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 110; // A2 — a drone with manners
    this.osc.connect(this.filter);
    this.osc.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 0.55;

    this.lfoCut = ctx.createGain();
    this.lfoCut.gain.value = 0;
    lfo.connect(this.lfoCut);
    this.lfoCut.connect(this.filter.frequency);

    this.lfoTrem = ctx.createGain();
    this.lfoTrem.gain.value = 0;
    lfo.connect(this.lfoTrem);
    this.lfoTrem.connect(this.vca.gain);

    this.lfoVib = ctx.createGain();
    this.lfoVib.gain.value = 0;
    lfo.connect(this.lfoVib);
    this.lfoVib.connect(this.osc.detune);

    lfo.start();
  }

  private apply(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.state;
    const t = ctx.currentTime;
    const on = this.enabled && s.tone;
    this.master.gain.setTargetAtTime(on ? 0.12 : 0, t, on ? 0.12 : 0.08);
    this.filter.frequency.setTargetAtTime(s.filtered ? 640 : 16000, t, 0.12);
    this.filter.Q.setTargetAtTime(s.filtered ? 6 : 0.0001, t, 0.12);
    this.lfoCut.gain.setTargetAtTime(s.wobbleCutoff ? 430 : 0, t, 0.15);
    this.lfoTrem.gain.setTargetAtTime(s.wobbleTrem ? 0.3 : 0, t, 0.15);
    this.lfoVib.gain.setTargetAtTime(s.wobbleVib ? 30 : 0, t, 0.15);
  }
}

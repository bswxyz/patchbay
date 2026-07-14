/* PB-SCOPE — the hero module's screen.
   A filtered saw drawn as its first six harmonics, with the "cutoff"
   drifting slowly, like someone left a hand on the knob.
   Costs: DPR capped at 1.5, ~30 fps, pauses off-screen, and under
   prefers-reduced-motion it renders exactly ONE frame. */

const AMBER = '#ffb020';
const GRID = 'rgba(223, 226, 230, 0.07)';
const GRID_MID = 'rgba(223, 226, 230, 0.14)';

export function initScope(canvas: HTMLCanvasElement, reduce: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr()));
    canvas.height = Math.max(1, Math.floor(h * dpr()));
  };

  /* a saw wave through a resonant lowpass, harmonic by harmonic */
  const sample = (phase: number, t: number): number => {
    const cutoff = 3.2 + 1.8 * Math.sin(t * 0.23); // the drifting hand
    let y = 0;
    for (let n = 1; n <= 6; n++) {
      const roll = 1 / (1 + Math.pow(n / cutoff, 4)); // 4-pole-ish rolloff
      const reso = 1 + 0.9 * Math.exp(-Math.pow(n - cutoff, 2)); // resonant bump
      y += (Math.sin(n * (phase + t * 1.6)) / n) * roll * reso;
    }
    return y;
  };

  const draw = (t: number) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    /* graticule */
    ctx.lineWidth = 1;
    const step = h / 6;
    for (let i = 1; i < 6; i++) {
      ctx.strokeStyle = i === 3 ? GRID_MID : GRID;
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(w, i * step);
      ctx.stroke();
    }
    for (let i = 1; i < 10; i++) {
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      ctx.moveTo((i * w) / 10, 0);
      ctx.lineTo((i * w) / 10, h);
      ctx.stroke();
    }

    /* the trace */
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = Math.max(1.5, h / 90);
    ctx.shadowColor = 'rgba(255, 176, 32, 0.55)';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    const mid = h / 2;
    const amp = h * 0.3;
    for (let x = 0; x <= w; x += 2) {
      const phase = (x / w) * Math.PI * 5;
      const y = mid - sample(phase, t) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const ro = new ResizeObserver(() => {
    resize();
    if (reduce) draw(1.7);
  });
  ro.observe(canvas);
  resize();

  if (reduce) {
    draw(1.7); // one still frame — the trace, frozen mid-sweep
    return;
  }

  let running = true;
  let last = 0;
  const t0 = performance.now();
  const loop = (t: number) => {
    if (!running) return;
    if (t - last >= 33) {
      draw((t - t0) / 1000);
      last = t;
    }
    requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(
    (es) => {
      const vis = es[0]?.isIntersecting ?? false;
      if (vis && !running) {
        running = true;
        requestAnimationFrame(loop);
      } else if (!vis) {
        running = false;
      }
    },
    { threshold: 0 },
  );
  io.observe(canvas);
  requestAnimationFrame(loop);
}

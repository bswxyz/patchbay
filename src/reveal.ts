/* Scroll-in reveals + animated counters.
   Hidden states are gated behind the .js class in CSS, so nothing
   is invisible without JavaScript. */

export function initReveals(reduce: boolean): void {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
  );
  targets.forEach((t) => io.observe(t));
}

export function initCounters(reduce: boolean): void {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const to = parseFloat(el.dataset.to ?? '0');
        const dec = Number(el.dataset.dec ?? 0);
        io.unobserve(el);
        if (reduce) {
          /* the real value is already authored in the HTML — leave it */
          el.textContent = to.toFixed(dec);
          continue;
        }
        /* zero only now, right before the count-up starts */
        el.textContent = (0).toFixed(dec);
        const dur = 1300;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = clamp((t - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (to * eased).toFixed(dec);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll<HTMLElement>('.c-num').forEach((el) => io.observe(el));
}

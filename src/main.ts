/* PATCHBAY — wiring for the page.
   Progressive enhancement: the page reads fully without JS; the .js
   class (set inline in <head>) gates every hidden state. */

import { initReveals, initCounters } from './reveal';
import { initScope } from './scope';
import { PatchAudio } from './audio';
import { initPatchbay } from './patchbay';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ---------- theme toggle ---------- */
const themeBtn = document.getElementById('themeBtn');
const syncTheme = () => {
  const dark = root.dataset.theme !== 'light';
  themeBtn?.setAttribute('aria-pressed', String(dark));
  themeBtn?.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#131417' : '#e6e4df');
};
syncTheme();
themeBtn?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem('patchbay-theme', root.dataset.theme);
  } catch {
    /* private mode — theme just won't persist */
  }
  syncTheme();
});

/* ---------- hero intro ---------- */
const hero = document.querySelector('.hero');
requestAnimationFrame(() => hero?.classList.add('loaded'));

/* ---------- reveals + counters ---------- */
initReveals(reduce);
initCounters(reduce);

/* ---------- the scope ---------- */
const scopeCanvas = document.getElementById('scope') as HTMLCanvasElement | null;
if (scopeCanvas) initScope(scopeCanvas, reduce);

/* ---------- the patch panel ---------- */
const host = document.getElementById('patchbay');
const statusEl = document.getElementById('patchStatus');
const setStatus = (msg: string) => {
  if (statusEl) statusEl.textContent = msg;
};

if (host && statusEl) {
  const audio = new PatchAudio();
  const bay = initPatchbay(host, audio, setStatus, reduce);

  const soundBtn = document.getElementById('soundBtn') as HTMLButtonElement | null;
  soundBtn?.addEventListener('click', async () => {
    const on = await audio.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? 'Sound: on' : 'Sound: off';
    setStatus(
      on
        ? 'Sound on. Patch VCO → VCF → VCA → out and the rack will hum at you.'
        : 'Sound off. The cables still work; they just gossip silently.',
    );
  });

  document.getElementById('presetVoice')?.addEventListener('click', () => bay.patchClassic());
  document.getElementById('presetSurprise')?.addEventListener('click', () => bay.surprise());
  document.getElementById('clearBtn')?.addEventListener('click', () => bay.clearAll());
}

/* ---------- build-slot demo form ---------- */
const form = document.getElementById('slotForm') as HTMLFormElement | null;
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = form.querySelector<HTMLInputElement>('#sEmail');
  if (!email || !email.checkValidity()) {
    email?.reportValidity();
    return;
  }
  const system = form.querySelector<HTMLSelectElement>('#sSystem');
  const chosen = system?.selectedOptions[0]?.textContent?.split('—')[0]?.trim() ?? 'a system';
  form.innerHTML =
    '<div class="slot-done"><strong>Slot held.</strong>' +
    `<span class="mono">${chosen} · batch 32 — demo only, nothing was sent. a real shop would write back in a day.</span></div>`;
});

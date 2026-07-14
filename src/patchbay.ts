/* ============================================================
   THE PATCH PANEL — the signature flourish.
   An SVG eurorack row built from data. Drag a cable from any OUT
   to any IN; the cable sags like a real one (quadratic bezier,
   gravity approximated by enthusiasm), settles with a damped
   bounce, then sways idly. Complete VCO → VCF → VCA → out and
   the rack "sings" (LEDs pulse; audio if enabled).
   Reduced motion: cables draw instantly, nothing sways.
   Keyboard: every jack is a focusable button — Enter picks up,
   Enter plugs in, Esc drops. Presets do the wiring one-handed.
   ============================================================ */

import type { PatchAudio, PatchState } from './audio';

type Dir = 'in' | 'out';

interface JackDef {
  id: string;
  module: string;
  label: string;
  dir: Dir;
  x: number;
  y: number;
}

interface KnobDef {
  x: number;
  y: number;
  r: number;
  turn: number;
  label?: string;
}

interface ModuleDef {
  id: string;
  name: string;
  hp: number;
  x: number;
  w: number;
  knobs: KnobDef[];
  jacks: JackDef[];
}

interface Connection {
  from: string; // an out jack
  to: string; // an in jack
  color: number;
  born: number;
  phase: number;
  group: SVGGElement;
  shadow: SVGPathElement;
  core: SVGPathElement;
  hit: SVGPathElement;
  plugA: SVGCircleElement;
  plugB: SVGCircleElement;
}

const NS = 'http://www.w3.org/2000/svg';

/* ---------- the rack, as data ---------- */
const jack = (id: string, module: string, label: string, dir: Dir, x: number, y: number): JackDef => ({
  id, module, label, dir, x, y,
});

const MODULES: ModuleDef[] = [
  {
    id: 'drift', name: 'DRIFT', hp: 12, x: 20, w: 190,
    knobs: [
      { x: 115, y: 108, r: 28, turn: 35, label: 'FREQ' },
      { x: 70, y: 182, r: 12, turn: -50 },
      { x: 160, y: 182, r: 12, turn: 20 },
    ],
    jacks: [
      jack('drift.voct', 'Drift', 'V/OCT', 'in', 70, 232),
      jack('drift.saw', 'Drift', 'SAW OUT', 'out', 160, 232),
    ],
  },
  {
    id: 'wobble', name: 'WOBBLE', hp: 8, x: 218, w: 130,
    knobs: [{ x: 283, y: 112, r: 26, turn: -20, label: 'RATE' }],
    jacks: [jack('wobble.tri', 'Wobble', 'TRI OUT', 'out', 283, 232)],
  },
  {
    id: 'bloom', name: 'BLOOM', hp: 14, x: 356, w: 214,
    knobs: [
      { x: 463, y: 108, r: 30, turn: 70, label: 'CUTOFF' },
      { x: 405, y: 180, r: 12, turn: 120 },
      { x: 521, y: 180, r: 12, turn: -30 },
    ],
    jacks: [
      jack('bloom.in', 'Bloom', 'AUDIO IN', 'in', 400, 232),
      jack('bloom.cv', 'Bloom', 'CUT CV', 'in', 463, 232),
      jack('bloom.lp', 'Bloom', 'LP OUT', 'out', 526, 232),
    ],
  },
  {
    id: 'ledger', name: 'LEDGER', hp: 11, x: 578, w: 176,
    knobs: [
      { x: 666, y: 112, r: 24, turn: 45, label: 'GAIN' },
      { x: 666, y: 180, r: 12, turn: 0 },
    ],
    jacks: [
      jack('ledger.in', 'Ledger', 'IN', 'in', 620, 232),
      jack('ledger.cv', 'Ledger', 'CV', 'in', 666, 232),
      jack('ledger.out', 'Ledger', 'OUT', 'out', 712, 232),
    ],
  },
  {
    id: 'main', name: 'MAIN', hp: 11, x: 762, w: 178,
    knobs: [{ x: 851, y: 165, r: 20, turn: 10, label: 'LEVEL' }],
    jacks: [jack('main.in', 'Main out', 'L/MONO', 'in', 851, 232)],
  },
];

const JACKS = new Map<string, JackDef>();
for (const m of MODULES) for (const j of m.jacks) JACKS.set(j.id, j);

/* signal flows through these modules: in-jack ⇒ out-jack */
const THROUGH: Record<string, string> = {
  'bloom.in': 'bloom.lp',
  'ledger.in': 'ledger.out',
};

/* ---------- the shop's voice ---------- */
const PAIR_NOTES: Record<string, string> = {
  'drift.saw>bloom.in': 'Saw into the filter. It has something to chew on now.',
  'bloom.lp>ledger.in': 'Filter into the VCA. Civilised.',
  'ledger.out>main.in': 'VCA to the output. Almost a synthesizer.',
  'drift.saw>main.in': 'Saw straight to the out. Bold. Unfiltered. Slightly rude.',
  'wobble.tri>bloom.cv': 'LFO on the cutoff — the filter is breathing.',
  'wobble.tri>ledger.cv': 'LFO on the VCA. Tremolo, very 1957.',
  'wobble.tri>drift.voct': 'LFO on pitch. A polite vibrato.',
  'wobble.tri>main.in': "The LFO, alone, into the output. That's not music, that's weather.",
  'drift.saw>drift.voct': 'The oscillator modulating itself. Self-FM — the shop favourite.',
  'drift.saw>bloom.cv': 'Audio-rate cutoff modulation. Chaos. Keep it.',
  'bloom.lp>bloom.cv': 'The filter feeding its own cutoff. Squelch physics.',
};

const label = (id: string): string => {
  const j = JACKS.get(id);
  return j ? `${j.module} ${j.label.toLowerCase()}` : id;
};

const pairNote = (from: string, to: string): string =>
  PAIR_NOTES[`${from}>${to}`] ?? `${label(from)} into ${label(to)}. No idea if that's wise. That's the point.`;

/* ---------- svg helpers ---------- */
function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

function text(parent: Element, x: number, y: number, cls: string, content: string): SVGTextElement {
  const t = el('text', { x: String(x), y: String(y), class: cls }, parent);
  t.textContent = content;
  return t;
}

/* the cable curve: endpoints + a low midpoint. gravity, roughly. */
function cablePath(ax: number, ay: number, bx: number, by: number, slack = 0): string {
  const dist = Math.hypot(bx - ax, by - ay);
  const sag = Math.min(95, 24 + dist * 0.22) + slack;
  const mx = (ax + bx) / 2;
  const my = Math.max(ay, by) + sag;
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

export interface PatchbayApi {
  patchClassic: () => void;
  surprise: () => void;
  clearAll: () => void;
}

export function initPatchbay(
  host: HTMLElement,
  audio: PatchAudio,
  setStatus: (msg: string) => void,
  reduce: boolean,
): PatchbayApi {
  /* ---------- build the rack ---------- */
  const svg = el('svg', { viewBox: '0 0 960 300', role: 'group' }, host);
  svg.setAttribute('aria-label', 'Interactive patch panel: five modules with patchable jacks');

  el('rect', { x: '0', y: '0', width: '960', height: '300', rx: '16', class: 'pb-bgplate' }, svg);
  el('rect', { x: '8', y: '8', width: '944', height: '12', rx: '3', class: 'pb-rail' }, svg);
  el('rect', { x: '8', y: '280', width: '944', height: '12', rx: '3', class: 'pb-rail' }, svg);

  const moduleLeds = new Map<string, SVGCircleElement>();
  const jackEls = new Map<string, SVGGElement>();

  let screwSeed = 0;
  const screw = (x: number, y: number) => {
    el('circle', { cx: String(x), cy: String(y), r: '3.4', class: 'pb-screw' }, svg);
    const a = ((screwSeed++ * 47) % 180) * (Math.PI / 180);
    const dx = Math.cos(a) * 2.6;
    const dy = Math.sin(a) * 2.6;
    el('line', {
      x1: (x - dx).toFixed(1), y1: (y - dy).toFixed(1),
      x2: (x + dx).toFixed(1), y2: (y + dy).toFixed(1),
      class: 'pb-screw-slot',
    }, svg);
  };

  for (const m of MODULES) {
    el('rect', { x: String(m.x), y: '24', width: String(m.w), height: '252', rx: '6', class: 'pb-face' }, svg);
    screw(m.x + 10, 14);
    screw(m.x + m.w - 10, 14);
    screw(m.x + 10, 286);
    screw(m.x + m.w - 10, 286);

    const cx = m.x + m.w / 2;
    text(svg, cx, 46, 'pb-label pb-label--name', m.name);
    text(svg, cx, 60, 'pb-label pb-hp', `${m.hp} HP`);

    for (const k of m.knobs) {
      el('circle', { cx: String(k.x), cy: String(k.y), r: String(k.r), class: 'pb-knob' }, svg);
      const rad = ((k.turn - 90) * Math.PI) / 180;
      const x1 = k.x + Math.cos(rad) * (k.r * 0.45);
      const y1 = k.y + Math.sin(rad) * (k.r * 0.45);
      const x2 = k.x + Math.cos(rad) * (k.r - 3);
      const y2 = k.y + Math.sin(rad) * (k.r - 3);
      el('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), class: 'pb-mark' }, svg);
      if (k.label) text(svg, k.x, k.y + k.r + 14, 'pb-label', k.label);
    }

    /* status LED — amber when the module is in use; MAIN gets the SIG led */
    if (m.id === 'main') {
      const led = el('circle', { cx: '851', cy: '104', r: '5', class: 'pb-led' }, svg);
      text(svg, 851, 90, 'pb-label', 'SIG');
      text(svg, 851, 268, 'pb-label pb-hp', 'PATCHBAY');
      moduleLeds.set(m.id, led);
    } else {
      const led = el('circle', { cx: String(m.x + m.w - 18), cy: '40', r: '3.5', class: 'pb-led' }, svg);
      moduleLeds.set(m.id, led);
    }
    if (m.id === 'wobble') {
      el('circle', { cx: '283', cy: '172', r: '4', class: 'pb-led lit--green pb-blink' }, svg);
    }
  }

  /* layers: cables under jacks (plugs appear to enter the nuts), drag on top */
  const cableLayer = el('g', { class: 'pb-cables' }, svg);
  const jackLayer = el('g', { class: 'pb-jacks' }, svg);
  const dragLayer = el('g', { class: 'pb-drag', style: 'pointer-events:none' }, svg);

  for (const m of MODULES) {
    for (const j of m.jacks) {
      const g = el('g', { transform: `translate(${j.x} ${j.y})`, class: 'pb-jack' }, jackLayer);
      g.dataset.jack = j.id;
      g.dataset.dir = j.dir;
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      el('circle', { r: '15', class: 'pb-halo' }, g);
      if (j.dir === 'out') el('circle', { r: '13', class: 'pb-out-ring' }, g);
      el('circle', { r: '10', class: 'pb-nut' }, g);
      el('circle', { r: '4.5', class: 'pb-hole' }, g);
      el('circle', { r: '17', class: 'pb-hit' }, g);
      text(svg, j.x, j.y + 26, 'pb-label', j.label);
      jackEls.set(j.id, g);
    }
  }

  /* ---------- state ---------- */
  const connections: Connection[] = [];
  let colorIdx = 0;
  let wasSinging = false;

  const has = (from: string, to: string) => connections.some((c) => c.from === from && c.to === to);
  const atInput = (to: string) => connections.find((c) => c.to === to);

  const reachFrom = (start: string): Set<string> => {
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop() as string;
      for (const c of connections) {
        if (c.from === cur && !seen.has(c.to)) {
          seen.add(c.to);
          queue.push(c.to);
        }
      }
      const through = THROUGH[cur];
      if (through && !seen.has(through)) {
        seen.add(through);
        queue.push(through);
      }
    }
    return seen;
  };

  const computeState = (): PatchState => {
    const fromSaw = reachFrom('drift.saw');
    const tone = fromSaw.has('main.in');
    const inPath = (inJack: string, outJack: string) =>
      tone && fromSaw.has(inJack) && reachFrom(outJack).has('main.in');
    const filtered = inPath('bloom.in', 'bloom.lp');
    const ledgered = inPath('ledger.in', 'ledger.out');
    return {
      tone,
      filtered,
      wobbleCutoff: filtered && has('wobble.tri', 'bloom.cv'),
      wobbleTrem: ledgered && has('wobble.tri', 'ledger.cv'),
      wobbleVib: tone && has('wobble.tri', 'drift.voct'),
    };
  };

  /* ---------- rendering ---------- */
  const drawConnection = (c: Connection, slack: number) => {
    const a = JACKS.get(c.from) as JackDef;
    const b = JACKS.get(c.to) as JackDef;
    const d = cablePath(a.x, a.y, b.x, b.y, slack);
    c.shadow.setAttribute('d', d);
    c.core.setAttribute('d', d);
    c.hit.setAttribute('d', d);
    c.plugA.setAttribute('cx', String(a.x));
    c.plugA.setAttribute('cy', String(a.y));
    c.plugB.setAttribute('cx', String(b.x));
    c.plugB.setAttribute('cy', String(b.y));
  };

  const refresh = () => {
    /* LEDs */
    const used = new Set<string>();
    for (const c of connections) {
      used.add((JACKS.get(c.from) as JackDef).module.toLowerCase());
      used.add((JACKS.get(c.to) as JackDef).module.toLowerCase());
    }
    const state = computeState();
    for (const m of MODULES) {
      const led = moduleLeds.get(m.id);
      if (!led) continue;
      if (m.id === 'main') {
        led.classList.toggle('lit--green', state.tone);
      } else {
        led.classList.toggle('lit', used.has(m.id));
      }
    }
    svg.classList.toggle('singing', state.tone);

    /* aria labels reflect the wiring */
    for (const [id, g] of jackEls) {
      const j = JACKS.get(id) as JackDef;
      let suffix = '';
      if (j.dir === 'in') {
        const c = atInput(id);
        if (c) suffix = `, patched from ${label(c.from)}`;
      } else {
        const outs = connections.filter((c) => c.from === id).map((c) => label(c.to));
        if (outs.length) suffix = `, feeding ${outs.join(' and ')}`;
      }
      g.setAttribute('aria-label', `${j.module}, ${j.label.toLowerCase()} — ${j.dir === 'out' ? 'output' : 'input'} jack${suffix}`);
    }

    audio.update(state);

    if (state.tone && !wasSinging) {
      setStatus(
        'Signal path complete — the rack is singing.' +
          (audio.enabled ? ' Listen.' : ' Enable sound to hear it.'),
      );
    } else if (!state.tone && wasSinging) {
      setStatus('The voice went quiet — signal no longer reaches the output.');
    }
    wasSinging = state.tone;
    ensureLoop();
  };

  const removeConnection = (c: Connection) => {
    c.group.remove();
    const i = connections.indexOf(c);
    if (i >= 0) connections.splice(i, 1);
  };

  const addConnection = (from: string, to: string, quiet = false): void => {
    if (has(from, to)) return;
    const prev = atInput(to);
    if (prev) removeConnection(prev);

    const group = el('g', {}, cableLayer);
    const shadow = el('path', { class: 'pb-cable-shadow' }, group);
    const core = el('path', { class: `pb-cable pb-cable--${'abc'[colorIdx % 3]}` }, group);
    const plugA = el('circle', { r: '6', class: 'pb-plug' }, group);
    const plugB = el('circle', { r: '6', class: 'pb-plug' }, group);
    const hit = el('path', { class: 'pb-cable-hit' }, group);
    const title = document.createElementNS(NS, 'title');
    title.textContent = `Cable: ${label(from)} → ${label(to)}. Click to unplug.`;
    hit.appendChild(title);
    colorIdx++;

    const c: Connection = {
      from, to, color: colorIdx, born: performance.now(),
      phase: Math.random() * Math.PI * 2,
      group, shadow, core, hit, plugA, plugB,
    };
    connections.push(c);
    drawConnection(c, 0);

    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      removeConnection(c);
      setStatus(`Pulled the cable from ${label(to)}.`);
      refresh();
    });

    if (!quiet) setStatus(pairNote(from, to));
    refresh();
  };

  /* ---------- idle sway + settle bounce (skipped entirely under reduced motion) ---------- */
  let looping = false;
  let visible = true;
  let lastFrame = 0;

  const loopFrame = (t: number) => {
    if (!looping) return;
    if (t - lastFrame >= 33) {
      // ~30fps is plenty — cables sway slowly
      for (const c of connections) {
        const age = t - c.born;
        let slack = Math.sin(t / 950 + c.phase) * 2.2; // the idle sway
        if (age < 900) {
          slack += 30 * Math.exp(-age / 200) * Math.cos(age / 65); // the plug-in bounce
        }
        drawConnection(c, slack);
      }
      lastFrame = t;
    }
    requestAnimationFrame(loopFrame);
  };

  const ensureLoop = () => {
    if (reduce) {
      for (const c of connections) drawConnection(c, 0);
      return;
    }
    if (!looping && visible && connections.length) {
      looping = true;
      requestAnimationFrame(loopFrame);
    }
    if (!connections.length) looping = false;
  };

  const vio = new IntersectionObserver(
    (es) => {
      visible = es[0]?.isIntersecting ?? true;
      if (!visible) looping = false;
      else ensureLoop();
    },
    { threshold: 0 },
  );
  vio.observe(svg);

  /* ---------- pointer wiring ---------- */
  const toSvg = (e: PointerEvent): { x: number; y: number } => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  let dragFrom: JackDef | null = null;
  let dragPath: SVGPathElement | null = null;
  let dragPlug: SVGCircleElement | null = null;

  const beginDrag = (j: JackDef) => {
    dragFrom = j;
    svg.classList.add(j.dir === 'out' ? 'pb--from-out' : 'pb--from-in');
    dragPath = el('path', { class: `pb-cable pb-cable--${'abc'[colorIdx % 3]}`, opacity: '0.9' }, dragLayer);
    dragPlug = el('circle', { r: '6', class: 'pb-plug' }, dragLayer);
  };

  const endDrag = () => {
    dragFrom = null;
    dragPath?.remove();
    dragPlug?.remove();
    dragPath = null;
    dragPlug = null;
    svg.classList.remove('pb--from-out', 'pb--from-in');
  };

  const tryConnect = (a: JackDef, b: JackDef): boolean => {
    if (a.dir === b.dir) {
      setStatus(
        a.dir === 'out'
          ? "Two outputs can't talk to each other. Find a jack marked IN."
          : 'Two inputs, no signal. One end needs an OUT.',
      );
      return false;
    }
    const from = a.dir === 'out' ? a : b;
    const to = a.dir === 'out' ? b : a;
    addConnection(from.id, to.id);
    return true;
  };

  svg.addEventListener('pointerdown', (e) => {
    const target = (e.target as Element).closest<SVGGElement>('[data-jack]');
    if (!target) return;
    e.preventDefault();
    const j = JACKS.get(target.dataset.jack as string) as JackDef;

    /* grabbing a patched input pulls its cable out and re-drags it */
    const existing = j.dir === 'in' ? atInput(j.id) : undefined;
    if (existing) {
      const from = JACKS.get(existing.from) as JackDef;
      removeConnection(existing);
      refresh();
      beginDrag(from);
    } else {
      beginDrag(j);
    }

    const move = (ev: PointerEvent) => {
      if (!dragFrom || !dragPath || !dragPlug) return;
      const p = toSvg(ev);
      dragPath.setAttribute('d', cablePath(dragFrom.x, dragFrom.y, p.x, p.y));
      dragPlug.setAttribute('cx', String(p.x));
      dragPlug.setAttribute('cy', String(p.y));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!dragFrom) return;
      const under = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<SVGGElement>('[data-jack]');
      const dropped = under ? (JACKS.get(under.dataset.jack as string) as JackDef) : null;
      if (dropped && dropped.id !== dragFrom.id) {
        tryConnect(dragFrom, dropped);
      } else if (!dropped) {
        setStatus('Cable dropped. They land soft.');
      }
      endDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });

  /* ---------- keyboard wiring ---------- */
  let pending: JackDef | null = null;

  const setPending = (j: JackDef | null) => {
    for (const g of jackEls.values()) g.classList.remove('pb-pending');
    svg.classList.remove('pb--from-out', 'pb--from-in');
    pending = j;
    if (j) {
      jackEls.get(j.id)?.classList.add('pb-pending');
      svg.classList.add(j.dir === 'out' ? 'pb--from-out' : 'pb--from-in');
    }
  };

  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pending) {
      setPending(null);
      setStatus('Cable dropped. They land soft.');
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = (e.target as Element).closest<SVGGElement>('[data-jack]');
    if (!target) return;
    e.preventDefault();
    const j = JACKS.get(target.dataset.jack as string) as JackDef;

    if (!pending) {
      const existing = j.dir === 'in' ? atInput(j.id) : undefined;
      if (existing) {
        removeConnection(existing);
        setStatus(`Pulled the cable from ${label(j.id)}.`);
        refresh();
        return;
      }
      setPending(j);
      setStatus(
        `Cable picked up at ${label(j.id)}. Tab to a${j.dir === 'out' ? 'n input' : 'n output'} and press Enter — Esc drops it.`,
      );
      return;
    }

    if (pending.id === j.id) {
      setPending(null);
      setStatus('Cable dropped. They land soft.');
      return;
    }
    if (tryConnect(pending, j)) setPending(null);
  });

  /* ---------- presets (the one-click / assistive path) ---------- */
  const CLASSIC: Array<[string, string]> = [
    ['drift.saw', 'bloom.in'],
    ['bloom.lp', 'ledger.in'],
    ['ledger.out', 'main.in'],
  ];

  const patchClassic = () => {
    const missing = CLASSIC.filter(([f, t]) => !has(f, t));
    if (!missing.length) {
      setStatus('The classic voice is already patched. Add the LFO somewhere — live a little.');
      return;
    }
    if (reduce) {
      missing.forEach(([f, t]) => addConnection(f, t, true));
      refresh();
    } else {
      missing.forEach(([f, t], i) => window.setTimeout(() => addConnection(f, t, true), i * 190));
    }
  };

  const surprise = () => {
    const outs = [...JACKS.values()].filter((j) => j.dir === 'out');
    const ins = [...JACKS.values()].filter((j) => j.dir === 'in');
    const options: Array<[string, string]> = [];
    for (const o of outs) for (const i of ins) if (!has(o.id, i.id)) options.push([o.id, i.id]);
    if (!options.length) {
      setStatus('Every jack is spoken for. Impressive. Slightly alarming.');
      return;
    }
    const [f, t] = options[Math.floor(Math.random() * options.length)];
    addConnection(f, t, true);
    setStatus(`Random patch: ${pairNote(f, t)}`);
  };

  const clearAll = () => {
    while (connections.length) removeConnection(connections[0]);
    setStatus('All cables pulled. The rack is quiet again.');
    refresh();
  };

  refresh();
  return { patchClassic, surprise, clearAll };
}

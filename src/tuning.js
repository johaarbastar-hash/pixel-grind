// Tuning panel (debug mode): sliders for the gameplay numbers in config.js,
// applied live. COPY VALUES puts them on the clipboard as JSON to paste back
// into config.js. Tune feel on the phone, not in the code.
// Values are not saved: a reload goes back to config.js.

// [section path, [[key, min, max, step], ...]]
const SPECS = [
  ['physics', [
    ['ollieAirtime', 0.3, 1.2, 0.01],
    ['ollieApex', 10, 80, 1],
    ['kickerAirtime', 0.4, 1.6, 0.01],
  ]],
  ['world', [
    ['startSpeed', 40, 300, 5],
    ['maxSpeed', 60, 400, 5],
    ['speedRampTime', 30, 600, 10],
  ]],
  ['timing', [
    ['jumpBuffer', 0, 0.3, 0.01],
    ['lateLandingGrace', 0, 0.2, 0.005],
    ['coyoteTime', 0, 0.2, 0.01],
  ]],
  ['input', [
    ['swipeDistance', 5, 60, 1],
    ['swipeTime', 0.05, 0.6, 0.01],
  ]],
  ['tricks.kickflip', [['duration', 0.1, 0.8, 0.01], ['points', 0, 1000, 5]]],
  ['tricks.heelflip', [['duration', 0.1, 0.8, 0.01], ['points', 0, 1000, 5]]],
  ['tricks.shoveit', [['duration', 0.1, 0.8, 0.01], ['points', 0, 1000, 5]]],
  ['tricks.treflip', [['duration', 0.1, 0.8, 0.01], ['points', 0, 1000, 5]]],
  ['tricks.ollie', [['points', 0, 100, 1]]],
  ['tricks.grind', [['points', 0, 50, 1]]],
  ['landing', [['sketchyBank', 0, 1, 0.05]]],
  ['grind', [
    ['tickTime', 0.05, 0.5, 0.01],
    ['landTolerance', 0, 8, 1],
  ]],
  ['gap', [['fallDepth', 0, 16, 1]]],
  ['skater', [
    ['hitboxW', 4, 16, 1],
    ['hitboxH', 8, 24, 1],
  ]],
  ['obstacles', [['hitboxInset', 0, 3, 1]]],
  ['spawn', [
    ['openingClear', 0, 10, 0.5],
    ['gapPadding', 0, 1.5, 0.05],
    ['randomExtra', 0, 3, 0.1],
  ]],
  ['score', [['pxPerPoint', 1, 50, 1]]],
  ['ui', [['comboHoldTime', 0.2, 3, 0.1]]],
  ['bail', [
    ['slideTime', 0.1, 1.5, 0.05],
    ['retryDelay', 0, 2, 0.05],
  ]],
];

// Debug toggles shown above the sliders. Each control:
//   { type: 'check', label, get, set }
//   { type: 'select', label, options: [[value, text]], get, set }
//   { type: 'button', label, onClick }
function buildControls(controls, panel) {
  if (!controls.length) return;
  const h = document.createElement('div');
  h.className = 'tune-section';
  h.textContent = 'debug';
  panel.appendChild(h);
  const refreshers = [];
  for (const c of controls) {
    const row = document.createElement('label');
    row.className = 'tune-row tune-control';
    const name = document.createElement('span');
    name.textContent = c.label;
    row.appendChild(name);
    if (c.type === 'check') {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => c.set(box.checked));
      refreshers.push(() => (box.checked = !!c.get()));
      row.appendChild(box);
    } else if (c.type === 'select') {
      const sel = document.createElement('select');
      for (const [value, text] of c.options) {
        const o = document.createElement('option');
        o.value = String(value);
        o.textContent = text;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => c.set(sel.value));
      refreshers.push(() => (sel.value = String(c.get())));
      row.appendChild(sel);
    } else if (c.type === 'button') {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.addEventListener('click', () => {
        b.blur();
        c.onClick();
      });
      name.textContent = '';
      row.appendChild(b);
    }
    panel.appendChild(row);
  }
  return () => refreshers.forEach((f) => f());
}

function resolve(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj);
}

function decimals(step) {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

export function createTuningPanel(cfg, { onOpen, controls = [] } = {}) {
  const defaults = JSON.parse(JSON.stringify(cfg));
  const rows = []; // { section, key, input, value, row, step }
  let panel = null;
  let status = null;
  let fallback = null;
  let refreshControls = () => {};

  const button = document.createElement('button');
  button.id = 'tune-btn';
  button.type = 'button';
  button.textContent = 'TUNE';
  button.setAttribute('data-ui', '');
  button.hidden = true;
  // blur() so Space goes back to the game instead of re-clicking the button.
  button.addEventListener('click', () => {
    button.blur();
    api.toggle();
  });
  document.body.appendChild(button);

  function format(v, step) {
    return v.toFixed(decimals(step));
  }

  function refreshRow(r) {
    const v = resolve(cfg, r.section)[r.key];
    r.input.value = String(v);
    r.value.textContent = format(v, r.step);
    r.row.classList.toggle('changed', v !== resolve(defaults, r.section)[r.key]);
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'tune';
    panel.setAttribute('data-ui', '');

    const head = document.createElement('div');
    head.className = 'tune-head';
    const title = document.createElement('b');
    title.textContent = 'TUNING';
    head.appendChild(title);
    for (const [label, fn] of [
      ['COPY VALUES', copyValues],
      ['RESET', reset],
      ['CLOSE', () => api.close()],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => {
        b.blur();
        fn();
      });
      head.appendChild(b);
    }
    status = document.createElement('div');
    status.className = 'tune-status';
    head.appendChild(status);
    panel.appendChild(head);
    refreshControls = buildControls(controls, panel) || (() => {});

    for (const [section, keys] of SPECS) {
      const h = document.createElement('div');
      h.className = 'tune-section';
      h.textContent = section;
      panel.appendChild(h);
      for (const [key, min, max, step] of keys) {
        const row = document.createElement('label');
        row.className = 'tune-row';
        const name = document.createElement('span');
        name.textContent = key;
        const value = document.createElement('span');
        value.className = 'tune-value';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        const r = { section, key, input, value, row, step };
        input.addEventListener('input', () => {
          resolve(cfg, section)[key] = Number(input.value);
          refreshRow(r);
        });
        row.append(name, value, input);
        panel.appendChild(row);
        rows.push(r);
      }
    }

    fallback = document.createElement('textarea');
    fallback.className = 'tune-fallback';
    fallback.readOnly = true;
    fallback.hidden = true;
    panel.appendChild(fallback);

    document.body.appendChild(panel);
  }

  function values() {
    const out = {};
    for (const [section, keys] of SPECS) {
      let o = out;
      for (const k of section.split('.')) o = o[k] || (o[k] = {});
      for (const [key] of keys) o[key] = resolve(cfg, section)[key];
    }
    return JSON.stringify(out, null, 2);
  }

  async function copyValues() {
    const text = values();
    fallback.hidden = true;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied to clipboard.';
      return;
    } catch {
      // Clipboard API needs HTTPS (or localhost); fall through.
    }
    fallback.value = text;
    fallback.hidden = false;
    fallback.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    status.textContent = ok ? 'Copied to clipboard.' : 'Copy blocked: select the text below and copy it.';
  }

  function reset() {
    for (const r of rows) {
      resolve(cfg, r.section)[r.key] = resolve(defaults, r.section)[r.key];
      refreshRow(r);
    }
    status.textContent = 'Reset to config.js values.';
  }

  const api = {
    isOpen: false,
    open() {
      if (!panel) build();
      for (const r of rows) refreshRow(r);
      refreshControls();
      status.textContent = '';
      fallback.hidden = true;
      panel.hidden = false;
      api.isOpen = true;
      if (onOpen) onOpen();
    },
    close() {
      if (panel) panel.hidden = true;
      api.isOpen = false;
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
    setButtonVisible(on) {
      button.hidden = !on;
      if (!on) api.close();
    },
    // How many values differ from config.js (shown in the debug overlay).
    changedCount() {
      let n = 0;
      for (const [section, keys] of SPECS) {
        for (const [key] of keys) if (resolve(cfg, section)[key] !== resolve(defaults, section)[key]) n++;
      }
      return n;
    },
  };
  return api;
}

/* ============================================================
   Cupping QC — UI shell
   Dummy data, real scoring math. No persistence yet.
   ============================================================ */

'use strict';

/* ── Domain constants ────────────────────────────────────── */

// Descriptive assessment: 7 intensity scales (0–15). No "overall".
const INTENSITY_ATTRS = [
  'Fragrance', 'Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Sweetness', 'Mouthfeel'
];

// Affective assessment: 8 quality scales (1–9). Includes "overall".
const AFFECTIVE_ATTRS = [...INTENSITY_ATTRS, 'Overall'];

const CUP_STATES = [
  { key: 'uniform',    label: 'Uniform' },
  { key: 'nonUniform', label: 'Non-unif.' },
  { key: 'defective',  label: 'Defective' }
];

const REST_GATE_HOURS = 72;

/* ── Batch screening ─────────────────────────────────────── */

// Labels mirror the vocabulary already used in the vault QC log.
const VERDICTS = [
  { key: 'pass',   label: 'Pass',         full: 'Hopper & Client',  tone: 'good' },
  { key: 'pulled', label: 'Consumption',  full: 'Pulled Shot',      tone: 'warn' },
  { key: 'fail',   label: 'Fail',         full: 'FAIL — check log', tone: 'bad'  }
];

const verdictOf = key => VERDICTS.find(v => v.key === key);

// The three attributes that actually move a PASS/FAIL call at the bench.
const TREND_ATTRS = ['Acidity', 'Sweetness', 'Body'];

// Defect vocabulary taken from the QC log's sensory template.
const REASON_CODES = [
  'Bake', 'Scorching', 'Underdevelopment', 'Tipping',
  'Taint', 'Quakers', 'Off STD curve', 'Other'
];

const MAX_BATCHES = 60;   // per lot
const MAX_LOTS = 8;

/* ── Scoring — SCA Standard 104-2024 ─────────────────────── */

/**
 * Score = 0.65625 × Σ(8 affective sections) + 52.75 − 2·nonUniform − 4·defective
 * Σ ranges 8–72 → 58.00–100.00 before deductions. Rounded to nearest 0.25.
 */
function cvaScore(affective, cups) {
  const vals = AFFECTIVE_ATTRS.map(a => affective[a]);

  // A partially-scored sample has no score. Never substitute a default —
  // that would invent a number for a coffee nobody finished tasting.
  if (vals.some(v => v == null)) return null;

  const sum = vals.reduce((a, b) => a + b, 0);
  const nonUniform = cups.filter(c => c === 'nonUniform').length;
  const defective  = cups.filter(c => c === 'defective').length;

  const raw = 0.65625 * sum + 52.75 - 2 * nonUniform - 4 * defective;
  return Math.round(raw * 4) / 4;
}

const fmtScore = s => s == null ? '—' : s.toFixed(2);

function restHours(roastDate, sessionDate) {
  return Math.round((new Date(sessionDate) - new Date(roastDate)) / 36e5);
}

/** Encodes the existing 4th Street gates. Invents nothing. */
function disposition(sample) {
  if (cvaScore(sample.affective, sample.cups) == null) {
    return { label: 'Not scored', tone: 'muted' };
  }

  const defective = sample.cups.filter(c => c === 'defective').length;
  const rested    = restHours(sample.roastDate, state.session.date) >= REST_GATE_HOURS;

  if (!rested)        return { label: '🔶 PRELIM', tone: 'warn' };
  if (defective <= 1) return { label: 'Hopper & Client', tone: 'good' };
  return { label: 'Pulled Shot', tone: 'bad' };
}

/* ── Sample construction ─────────────────────────────────── */

const MIN_SAMPLES = 2;
const MAX_SAMPLES = 6;

const blankScores = () => ({
  intensity: Object.fromEntries(INTENSITY_ATTRS.map(a => [a, 0])),
  affective: Object.fromEntries(AFFECTIVE_ATTRS.map(a => [a, null]))
});

function newSample() {
  const roast = new Date(Date.now() - 96 * 36e5);       // default: 96 h ago, comfortably rested
  return {
    tag: '?', label: '', lotName: '', origin: '',
    process: '', profile: '', batchNo: '',
    roastDate: roast.toISOString().slice(0, 16),
    cups: ['uniform', 'uniform', 'uniform'],
    ...blankScores()
  };
}

/** Tags are positional, so removing a sample renumbers the rest cleanly. */
function normalizeTags() {
  state.samples.forEach((s, i) => { s.tag = String.fromCharCode(65 + i); });
}

/* ── Dummy state ─────────────────────────────────────────── */

const state = {
  screen: 'sessions',
  mode: 'calibration',          // 'calibration' | 'screening'
  activeSample: 0,

  lotFilter: null,              // null = show every lot
  lots: [
    {
      id: 1, lotName: 'Vietnam Son La', origin: 'Son La, VN',
      process: 'Washed Catimor', profile: '221',
      roastDate: '2026-08-09T08:00', from: 1, to: 8
    },
    {
      id: 2, lotName: 'Vietnam Son La', origin: 'Son La, VN',
      process: 'Washed Catimor', profile: '217',
      roastDate: '2026-08-09T13:00', from: 1, to: 6
    }
  ],
  batches: [],

  session: {
    date: '2026-08-15T09:00',
    location: 'Central Roastery HQ — Matina',
    taster: 'Gerome'
  },
  samples: [
    {
      tag: 'A', label: 'Sample A', lotName: 'Vietnam Son La', origin: 'Son La, VN',
      process: 'Washed Catimor', profile: '221', batchNo: '#024',
      roastDate: '2026-08-09T08:00',
      intensity: { Fragrance: 9, Aroma: 10, Flavor: 11, Aftertaste: 8, Acidity: 7, Sweetness: 9, Mouthfeel: 8 },
      affective: { Fragrance: 7, Aroma: 7, Flavor: 8, Aftertaste: 7, Acidity: 7, Sweetness: 7, Mouthfeel: 7, Overall: 7 },
      cups: ['uniform', 'uniform', 'uniform']
    },
    {
      tag: 'B', label: 'Sample B', lotName: 'Vietnam Robusta S16', origin: 'Lam Dong, VN',
      process: 'Natural G2', profile: '226', batchNo: '#025',
      roastDate: '2026-08-08T14:00',
      intensity: { Fragrance: 7, Aroma: 8, Flavor: 9, Aftertaste: 7, Acidity: 4, Sweetness: 6, Mouthfeel: 11 },
      affective: { Fragrance: 6, Aroma: 6, Flavor: 6, Aftertaste: 5, Acidity: 5, Sweetness: 5, Mouthfeel: 7, Overall: 6 },
      cups: ['uniform', 'nonUniform', 'uniform']
    },
    {
      tag: 'C', label: 'Sample C', lotName: 'Alta Vista Excelsa', origin: 'Bansalan, Davao',
      process: 'Washed', profile: '217', batchNo: '#026',
      roastDate: '2026-08-13T16:00',
      intensity: { Fragrance: 10, Aroma: 10, Flavor: 10, Aftertaste: 9, Acidity: 12, Sweetness: 5, Mouthfeel: 7 },
      affective: { Fragrance: 7, Aroma: 7, Flavor: 6, Aftertaste: 5, Acidity: 4, Sweetness: 4, Mouthfeel: 6, Overall: 5 },
      cups: ['uniform', 'uniform', 'defective']
    },
    {
      tag: 'D', label: 'Sample D', lotName: 'Mt. Apo Arabica', origin: 'Kapatagan, Davao',
      process: 'Honey', profile: '221', batchNo: '#027',
      roastDate: '2026-08-07T10:00',
      intensity: { Fragrance: 11, Aroma: 12, Flavor: 12, Aftertaste: 11, Acidity: 10, Sweetness: 11, Mouthfeel: 9 },
      affective: { Fragrance: 8, Aroma: 8, Flavor: 8, Aftertaste: 8, Acidity: 8, Sweetness: 8, Mouthfeel: 7, Overall: 8 },
      cups: ['uniform', 'uniform', 'uniform']
    }
  ],
  history: [
    { date: '2026-08-12', location: 'Matina HQ', samples: 5, best: 'Vietnam Son La · 221', score: 82.5 },
    { date: '2026-08-08', location: 'Matina HQ', samples: 3, best: 'Mt. Apo Arabica · 221', score: 84.25 },
    { date: '2026-08-03', location: 'Matina HQ', samples: 5, best: 'Vietnam Son La · 221', score: 76.0 }
  ]
};

/* ══ PERSISTENCE ═════════════════════════════════════════ */

/** Only these keys are persisted. `screen` and transient UI flags are not. */
const PERSIST_KEYS = ['mode', 'session', 'samples', 'lots', 'batches', 'activeSample', 'lotFilter'];

const snapshot = () => JSON.parse(JSON.stringify(
  Object.fromEntries(PERSIST_KEYS.map(k => [k, state[k]]))));

let saveTimer = null;
let saveHealthy = true;

/**
 * Debounced autosave. Every mutation routes through `mutate()`, which calls
 * this — so persistence cannot be forgotten by a new handler.
 */
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const ok = await kvSet('currentSession', snapshot());
    const healthy = ok !== null;

    if (healthy !== saveHealthy) {
      saveHealthy = healthy;
      renderSaveState();
    }
    if (healthy) flashSaved();
  }, 400);
}

function renderSaveState() {
  const chip = $('#sessionChip');
  chip.classList.toggle('is-error', !saveHealthy);
  $('#saveState').textContent = saveHealthy ? 'Saved' : 'NOT SAVING';
  chip.title = saveHealthy
    ? 'Work is saved to this device automatically'
    : 'Storage is unavailable — your work is only in memory. Export before closing.';
}

let flashTimer = null;
function flashSaved() {
  const chip = $('#sessionChip');
  chip.classList.add('is-flash');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => chip.classList.remove('is-flash'), 600);
}

/* ── Session archive ─────────────────────────────────────── */

function summarize() {
  if (state.mode === 'screening') {
    const t = tally(state.batches);
    return {
      label: state.lots.map(lotLabel).join(' · ') || 'Batch screening',
      detail: `${state.lots.length} lot${state.lots.length > 1 ? 's' : ''} · ${state.batches.length} batches`,
      stat: `${t.passRate}%`,
      statLabel: 'pass rate'
    };
  }

  const scores = state.samples.map(s => cvaScore(s.affective, s.cups)).filter(v => v != null);
  const top = scores.length ? Math.max(...scores) : null;
  return {
    label: state.samples.map(nameOf).join(' · ') || 'Table cupping',
    detail: `${state.samples.length} samples`,
    stat: top == null ? '—' : top.toFixed(2),
    statLabel: 'top score'
  };
}

async function archiveCurrent() {
  const s = summarize();
  await sessionPut({
    id: `s-${Date.now()}`,
    savedAt: new Date().toISOString(),
    date: (state.session.date || '').slice(0, 10),
    mode: state.mode,
    ...s,
    snapshot: snapshot()
  });
  await renderSessions();
}

/* ── Tiny DOM helpers ────────────────────────────────────── */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

/* ── Navigation ──────────────────────────────────────────── */

const STEP_FLOW = {
  calibration: [
    ['sessions', 'Sessions'], ['setup', 'Setup'],
    ['cup', 'Cup'], ['cups', 'Cup Check'], ['results', 'Results']
  ],
  screening: [
    ['sessions', 'Sessions'], ['setup', 'Setup'],
    ['screen', 'Screen'], ['results', 'Results']
  ]
};

function renderSteps() {
  const flow = STEP_FLOW[state.mode];

  $('#steps').replaceChildren(...flow.map(([id, label], i) => {
    const b = el('button', 'step' + (id === state.screen ? ' is-active' : ''),
      `<span>${i + 1}</span>${label}`);
    b.dataset.screen = id;
    return b;
  }));
}

function go(screen) {
  // Guard against landing on a screen the current mode doesn't have.
  const valid = STEP_FLOW[state.mode].some(([id]) => id === screen);
  state.screen = valid ? screen : 'setup';

  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === `screen-${state.screen}`));
  renderSteps();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMode(mode) {
  state.mode = mode;

  $$('#modeToggle button').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  $('#panel-calibration').hidden = mode !== 'calibration';
  $('#panel-screening').hidden   = mode !== 'screening';
  $('#results-calibration').hidden = mode !== 'calibration';
  $('#results-screening').hidden   = mode !== 'screening';
  $('#restBanner').style.display = mode === 'calibration' ? '' : 'none';

  go(STEP_FLOW[mode].some(([id]) => id === state.screen) ? state.screen : 'setup');
  render({ setup: true });
  scheduleSave();
}

document.addEventListener('click', e => {
  const step = e.target.closest('.step');
  if (step) return go(step.dataset.screen);

  const mode = e.target.closest('#modeToggle button');
  if (mode) return setMode(mode.dataset.mode);

  const goto = e.target.closest('[data-goto]');
  if (goto) return go(goto.dataset.goto);
});

/* ── Render: sessions ────────────────────────────────────── */

let archiveCache = [];

async function renderSessions() {
  archiveCache = (await sessionsAll()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  paintSessions();
}

function paintSessions() {
  const q = ($('#sessionSearch')?.value || '').toLowerCase().trim();
  const list = $('#sessionList');

  const rows = archiveCache.filter(r =>
    !q || `${r.date} ${r.label} ${r.detail} ${r.mode}`.toLowerCase().includes(q));

  if (!rows.length) {
    list.replaceChildren(el('li', 'empty-state', archiveCache.length
      ? 'No sessions match that search.'
      : 'No archived sessions yet. Exporting a completed session archives it here.'));
    return;
  }

  list.replaceChildren(...rows.map(r => {
    const li = el('li', 'session-item');

    li.append(
      el('div', 'meta',
        `<strong>${r.date || r.savedAt.slice(0, 10)} · ${r.mode === 'screening' ? 'Screening' : 'Table cupping'}</strong>
         <span>${r.label} — ${r.detail}</span>`),
      el('div', 'stat', `<b>${r.stat}</b><span>${r.statLabel}</span>`)
    );

    const actions = el('div', 'session-actions');

    const open = el('button', 'btn btn-sm', 'Open');
    open.onclick = e => { e.stopPropagation(); openArchived(r); };

    const del = el('button', 'remove', '&times;');
    del.title = 'Delete this archived session';
    del.onclick = async e => {
      e.stopPropagation();
      if (!confirm(`Delete the archived session from ${r.date}? This cannot be undone.`)) return;
      await sessionDelete(r.id);
      await renderSessions();
    };

    actions.append(open, del);
    li.append(actions);
    return li;
  }));
}

/** Loading an archive replaces current work, so it asks first. */
function openArchived(rec) {
  if (!confirm(`Open the session from ${rec.date}? Your current working session will be replaced.`)) return;
  mutate(() => { Object.assign(state, rec.snapshot); normalizeTags(); }, { setup: true });
  go('setup');
}

function startFresh() {
  if (!confirm('Clear the current working session and start fresh? Archived sessions are not affected.')) return;

  mutate(() => {
    state.mode = 'calibration';
    state.activeSample = 0;
    state.lotFilter = null;
    state.session = {
      date: new Date().toISOString().slice(0, 16),
      location: state.session.location,
      taster: state.session.taster
    };
    state.samples = [newSample(), newSample()];
    state.lots = [{ ...newLot(), id: 1 }];
    state.batches = [];
  }, { setup: true });

  setMode('calibration');
  go('setup');
}

/* ── Render: setup ───────────────────────────────────────── */

const SAMPLE_FIELDS = [
  { key: 'origin',  label: 'Origin',  placeholder: 'Region, country' },
  { key: 'process', label: 'Process', placeholder: 'Washed / Natural' },
  { key: 'profile', label: 'Profile', placeholder: '221' },
  { key: 'batchNo', label: 'Batch #', placeholder: '#024' }
];

function restPill(sample) {
  const hrs = restHours(sample.roastDate, state.session.date);
  if (!Number.isFinite(hrs)) return '<span class="pill pill-warn">no date</span>';
  const tone = hrs < REST_GATE_HOURS ? 'pill-warn' : 'pill-good';
  return `<span class="pill ${tone}">${hrs} h</span>`;
}

function renderSetup() {
  normalizeTags();
  $('#sampleCount').textContent = state.samples.length;

  $('#sampleGrid').replaceChildren(...state.samples.map((s, i) => {
    const card = el('article', 'sample-card');

    /* header: tag · lot name · remove */
    const head = el('header');
    head.append(el('span', 'tag', s.tag));

    const lot = el('input', 'lot-input');
    lot.value = s.lotName;
    lot.placeholder = 'Lot name';
    lot.setAttribute('aria-label', `Sample ${s.tag} lot name`);
    lot.oninput = () => mutate(() => { s.lotName = lot.value; }, { light: true });
    head.append(lot);

    const del = el('button', 'remove', '&times;');
    del.title = 'Remove sample';
    del.setAttribute('aria-label', `Remove sample ${s.tag}`);
    del.disabled = state.samples.length <= MIN_SAMPLES;
    del.onclick = () => removeSample(i);
    head.append(del);

    card.append(head);

    /* metadata fields */
    const grid = el('div', 'mini-grid');

    SAMPLE_FIELDS.forEach(f => {
      const wrap = el('label', 'mini');
      wrap.append(el('span', null, f.label));
      const input = el('input');
      input.value = s[f.key];
      input.placeholder = f.placeholder;
      input.oninput = () => mutate(() => { s[f.key] = input.value; }, { light: true });
      wrap.append(input);
      grid.append(wrap);
    });

    const dateWrap = el('label', 'mini mini-wide');
    dateWrap.append(el('span', null, 'Roast date & time'));
    const date = el('input');
    date.type = 'datetime-local';
    date.value = s.roastDate;
    date.onchange = () => mutate(() => {
      s.roastDate = date.value;
      $('.rest-row', card).innerHTML = `Rest off roast ${restPill(s)}`;
    }, { light: true });
    dateWrap.append(date);
    grid.append(dateWrap);

    card.append(grid, el('div', 'rest-row', `Rest off roast ${restPill(s)}`));
    return card;
  }));

  const addBtn = $('#addSample');
  addBtn.disabled = state.samples.length >= MAX_SAMPLES;
  addBtn.textContent = state.samples.length >= MAX_SAMPLES
    ? `Maximum ${MAX_SAMPLES} samples per table`
    : '+ Add sample';
}

/* ── Mutations ───────────────────────────────────────────── */

function addSample() {
  if (state.samples.length >= MAX_SAMPLES) return;
  mutate(() => { state.samples.push(newSample()); }, { setup: true });
}

function removeSample(index) {
  if (state.samples.length <= MIN_SAMPLES) return;
  mutate(() => {
    state.samples.splice(index, 1);
    if (state.activeSample >= state.samples.length) state.activeSample = state.samples.length - 1;
  }, { setup: true });
}

/* ══ RENDER CYCLE ════════════════════════════════════════ */

/**
 * Full redraw of every data-driven surface for the active mode.
 *
 * `setup: true` also rebuilds the Setup panels. That is opt-in because
 * rebuilding them destroys the <input> the user may be typing into.
 */
function render({ setup = false } = {}) {
  renderSteps();

  if (setup) {
    renderSetup();
    renderLots();
  }

  if (state.mode === 'calibration') {
    renderCup();
    renderCupCheck();
    renderResults();
  } else {
    renderScreening();
    renderScreeningResults();
  }
}

/**
 * Derived views only — leaves every input surface untouched.
 * For continuous input (sliders, text fields) where a full redraw
 * would destroy the control mid-interaction.
 */
function renderDerived() {
  if (state.mode === 'calibration') {
    // Rail and footer show scoring progress, so they must track every tap —
    // but neither is an input surface, so rebuilding them is safe here.
    renderSampleRail();
    renderCupFooter();
    renderCupCheck();
    renderResults();
  } else {
    // Progress bar and jump button track completion, so they refresh on every
    // verdict — but the batch cards themselves are updated in place.
    renderScreeningProgress();
    renderScreenJump();
    renderScreeningResults();
  }
}

/**
 * The single entry point for changing state.
 *
 * Every mutation goes through here, so redraw and autosave are structural
 * rather than something each handler has to remember. Forgetting one was
 * exactly the bug that let a fully-scored session report "19 not evaluated".
 */
function mutate(fn, { setup = false, light = false } = {}) {
  fn();
  if (light) renderDerived();
  else render({ setup });
  scheduleSave();
}

/* ══ BATCH SCREENING ═════════════════════════════════════ */

const newBatch = (lotId, no) => ({
  lotId, no,
  verdict: null,
  reason: null,
  attrs: Object.fromEntries(TREND_ATTRS.map(a => [a, null]))
});

const newLot = () => ({
  id: Math.max(0, ...state.lots.map(l => l.id)) + 1,
  lotName: '', origin: '', process: '', profile: '',
  roastDate: new Date(Date.now() - 96 * 36e5).toISOString().slice(0, 16),
  from: 1, to: 5
});

/** A fail without a reason code is incomplete — the reason is required. */
const batchComplete = b => b.verdict != null && (b.verdict !== 'fail' || !!b.reason);

const lotById = id => state.lots.find(l => l.id === id);
const batchesOf = lotId => state.batches.filter(b => b.lotId === lotId);

/** Human label for a lot — profile is what actually distinguishes two lots of the same coffee. */
const lotLabel = l => {
  const name = (l.lotName || '').trim() || 'Unnamed lot';
  return l.profile ? `${name} · ${l.profile}` : name;
};

const lotCount = l => Math.max(0, Math.min(l.to - l.from + 1, MAX_BATCHES));

/* ── Lot setup ───────────────────────────────────────────── */

const LOT_FIELDS = [
  { key: 'origin',  label: 'Origin',  placeholder: 'Region, country' },
  { key: 'process', label: 'Process', placeholder: 'Washed / Natural' },
  { key: 'profile', label: 'Profile', placeholder: '221' }
];

function renderLots() {
  $('#lotCount').textContent = state.lots.length;

  $('#lotGrid').replaceChildren(...state.lots.map((l, i) => {
    const card = el('article', 'sample-card');

    const head = el('header');
    head.append(el('span', 'tag', String(i + 1)));

    const name = el('input', 'lot-input');
    name.value = l.lotName;
    name.placeholder = 'Lot name';
    name.oninput = () => mutate(() => { l.lotName = name.value; }, { light: true });
    head.append(name);

    const del = el('button', 'remove', '&times;');
    del.title = 'Remove lot';
    del.disabled = state.lots.length <= 1;
    del.onclick = () => removeLot(l.id);
    head.append(del);

    card.append(head);

    const grid = el('div', 'mini-grid');

    LOT_FIELDS.forEach(f => {
      const wrap = el('label', 'mini');
      wrap.append(el('span', null, f.label));
      const input = el('input');
      input.value = l[f.key];
      input.placeholder = f.placeholder;
      input.oninput = () => mutate(() => { l[f.key] = input.value; }, { light: true });
      wrap.append(input);
      grid.append(wrap);
    });

    /* batch range */
    [['from', 'Batch from'], ['to', 'Batch to']].forEach(([key, label]) => {
      const wrap = el('label', 'mini');
      wrap.append(el('span', null, label));
      const input = el('input');
      input.type = 'number';
      input.min = 1;
      input.value = l[key];
      input.oninput = () => mutate(() => {
        l[key] = Math.max(1, Number(input.value) || 1);
        if (l.to < l.from) l.to = l.from;
        $('.rest-row', card).innerHTML = lotCardFooter(l);
        updateRangeSummary();
      }, { light: true });
      wrap.append(input);
      grid.append(wrap);
    });

    const dateWrap = el('label', 'mini mini-wide');
    dateWrap.append(el('span', null, 'Roast date & time'));
    const date = el('input');
    date.type = 'datetime-local';
    date.value = l.roastDate;
    date.onchange = () => mutate(() => {
      l.roastDate = date.value;
      $('.rest-row', card).innerHTML = lotCardFooter(l);
    }, { light: true });
    dateWrap.append(date);
    grid.append(dateWrap);

    card.append(grid, el('div', 'rest-row', lotCardFooter(l)));
    return card;
  }));

  $('#addLot').disabled = state.lots.length >= MAX_LOTS;
  updateRangeSummary();
}

const lotCardFooter = l =>
  `<span>${lotCount(l)} batches · #${l.from}–#${l.from + lotCount(l) - 1}</span>${restPill(l)}`;

function addLot() {
  if (state.lots.length >= MAX_LOTS) return;
  mutate(() => { state.lots.push(newLot()); }, { setup: true });
}

function removeLot(id) {
  if (state.lots.length <= 1) return;
  mutate(() => {
    state.lots = state.lots.filter(l => l.id !== id);
    state.batches = state.batches.filter(b => b.lotId !== id);
    if (state.lotFilter === id) state.lotFilter = null;
  }, { setup: true });
}

function updateRangeSummary() {
  const total = state.lots.reduce((n, l) => n + lotCount(l), 0);
  $('#rangeSummary').textContent =
    `${state.lots.length} lot${state.lots.length > 1 ? 's' : ''} · ${total} batches total`;
}

function generateBatches() {
  // Preserve verdicts already entered, keyed by lot + batch number.
  const previous = new Map(state.batches.map(b => [`${b.lotId}:${b.no}`, b]));

  state.batches = state.lots.flatMap(l =>
    Array.from({ length: lotCount(l) }, (_, i) => {
      const no = l.from + i;
      return previous.get(`${l.id}:${no}`) || newBatch(l.id, no);
    })
  );

  mutate(() => {}, { setup: true });
  go('screen');
}

/* ── Screening ───────────────────────────────────────────── */

function renderLotFilter() {
  const chips = [[null, `All · ${state.batches.length}`]]
    .concat(state.lots.map(l => [l.id, `${lotLabel(l)} · ${batchesOf(l.id).length}`]));

  $('#lotFilter').replaceChildren(...chips.map(([id, label]) => {
    const b = el('button', 'sample-tab' + (state.lotFilter === id ? ' is-active' : ''), label);
    b.onclick = () => mutate(() => { state.lotFilter = id; });
    return b;
  }));

  $('#lotFilter').hidden = state.lots.length < 2;
}

function renderScreeningProgress() {
  const total = state.batches.length;
  const done = state.batches.filter(batchComplete).length;

  $('#screenProgressFill').style.width = total ? `${(done / total) * 100}%` : '0';
  $('#screenProgress').textContent = `${done} of ${total} batches evaluated`;
}

/* ── Batch navigation ────────────────────────────────────── */

const batchKey = b => `${b.lotId}:${b.no}`;
const batchNo = b => `#${String(b.no).padStart(3, '0')}`;

/**
 * Next batch needing attention — either no verdict, or a fail with no cause.
 * Searches the visible lot first so filtering stays meaningful, then falls
 * back to any lot and switches the filter to follow.
 */
function nextIncomplete() {
  const inFilter = state.batches.filter(b =>
    state.lotFilter == null || b.lotId === state.lotFilter);

  return inFilter.find(b => !batchComplete(b))
      || state.batches.find(b => !batchComplete(b))
      || null;
}

function scrollToBatch(b) {
  const card = $(`.batch-card[data-batch="${CSS.escape(batchKey(b))}"]`);
  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('is-target');
  void card.offsetWidth;
  card.classList.add('is-target');
  setTimeout(() => card.classList.remove('is-target'), 1600);
}

function jumpToBatch(b) {
  // If the target sits outside the active filter, follow it rather than
  // scrolling to a card that isn't on screen.
  if (state.lotFilter != null && b.lotId !== state.lotFilter) {
    mutate(() => { state.lotFilter = b.lotId; });
  }
  scrollToBatch(b);
}

function renderScreenJump() {
  const btn = $('#screenJump');

  if (!state.batches.length) { btn.hidden = true; return; }

  const remaining = state.batches.filter(b => !batchComplete(b));
  btn.hidden = false;

  if (!remaining.length) {
    btn.className = 'screen-jump is-done';
    btn.innerHTML = `<span class="jump-count">All ${state.batches.length}</span> evaluated — see results →`;
    btn.onclick = () => go('results');
    return;
  }

  const target = nextIncomplete();
  const needsCause = target.verdict === 'fail' && !target.reason;

  btn.className = 'screen-jump' + (needsCause ? ' is-cause' : '');
  btn.innerHTML = `<span class="jump-count">${remaining.length}</span> ${
    needsCause ? `cause needed — ${batchNo(target)} →` : `left — next ${batchNo(target)} →`}`;
  btn.onclick = () => jumpToBatch(target);
}

function renderScreening() {
  $('#screenTitle').textContent = state.lots.length > 1
    ? `Batch screening — ${state.lots.length} lots`
    : lotLabel(state.lots[0] || { lotName: '' });

  $('#screenMeta').textContent = state.lots
    .map(l => `${lotLabel(l)} (${batchesOf(l.id).length})`)
    .join(' · ');

  renderScreeningProgress();
  renderScreenJump();
  renderLotFilter();

  const visible = state.lots.filter(l => state.lotFilter == null || state.lotFilter === l.id);

  $('#batchGroups').replaceChildren(...visible.map(l => {
    const section = el('section', 'lot-group');
    const hrs = restHours(l.roastDate, state.session.date);

    section.append(el('div', 'lot-group-head', `
      <div>
        <h2>${lotLabel(l)}</h2>
        <span>${[l.origin, l.process, `#${l.from}–#${l.from + lotCount(l) - 1}`].filter(Boolean).join(' · ')}</span>
      </div>
      ${restPill(l)}`));

    const grid = el('div', 'batch-grid');
    grid.append(...batchesOf(l.id).map(b => renderBatchCard(b, l)));
    section.append(grid);

    return section;
  }));
}

function renderBatchCard(b, lot) {
  {
    const card = el('article', 'batch-card' + (b.verdict ? ` v-${b.verdict}` : ''));
    card.dataset.batch = batchKey(b);
    if (b.verdict === 'fail' && !b.reason) card.classList.add('needs-reason');

    /** Swap just this card, rather than rebuilding every batch on the screen. */
    const refreshCard = () => card.replaceWith(renderBatchCard(b, lot));

    card.append(el('div', 'batch-head',
      `<h3>Batch #${String(b.no).padStart(3, '0')}</h3>
       <span class="rest">${lot.profile ? `Profile ${lot.profile}` : ''}</span>`));

    /* verdict */
    const verdicts = el('div', 'verdicts');
    VERDICTS.forEach(v => {
      const btn = el('button', b.verdict === v.key ? `on-${v.key}` : '', v.label);
      btn.title = v.full;
      btn.onclick = () => mutate(() => {
        b.verdict = b.verdict === v.key ? null : v.key;
        if (b.verdict !== 'fail') b.reason = null;
        refreshCard();
      }, { light: true });
      verdicts.append(btn);
    });
    card.append(verdicts);

    /* trend indicators */
    const trend = el('div', 'trend');
    TREND_ATTRS.forEach(attr => {
      const row = el('div', 'trend-row');
      row.append(el('label', null, attr));

      const slider = el('input', 'trend-slider' + (b.attrs[attr] == null ? ' unset' : ''));
      Object.assign(slider, { type: 'range', min: 1, max: 9, step: 1, value: b.attrs[attr] ?? 5 });
      slider.setAttribute('aria-label', `Batch ${b.no} ${attr}`);

      const val = el('b', b.attrs[attr] == null ? 'unset' : '', b.attrs[attr] ?? '—');

      slider.oninput = () => mutate(() => {
        b.attrs[attr] = Number(slider.value);
        slider.classList.remove('unset');
        val.className = '';
        val.textContent = b.attrs[attr];
      }, { light: true });

      row.append(slider, val);
      trend.append(row);
    });
    card.append(trend);

    /* reason code — required on fail */
    if (b.verdict === 'fail') {
      const wrap = el('div', 'reason-wrap');
      wrap.append(el('span', null, b.reason ? 'Defect cause' : 'Defect cause required'));

      const sel = el('select');
      sel.required = true;
      sel.append(el('option', null, '— select cause —'));
      sel.firstChild.value = '';
      REASON_CODES.forEach(r => {
        const o = el('option', null, r);
        o.value = r;
        if (b.reason === r) o.selected = true;
        sel.append(o);
      });
      sel.onchange = () => mutate(() => {
        b.reason = sel.value || null;
        refreshCard();
      }, { light: true });

      wrap.append(sel);
      card.append(wrap);
    }

    return card;
  }
}

/* ── Render: cup ─────────────────────────────────────────── */

/** Empty lot names are normal mid-entry — fall back to the positional tag. */
const nameOf = s => s.lotName.trim() || `Sample ${s.tag}`;

function renderSampleTabs() {
  $('#sampleTabs').replaceChildren(...state.samples.map((s, i) => {
    const b = el('button', 'sample-tab' + (i === state.activeSample ? ' is-active' : ''),
      `${s.tag} · ${nameOf(s)}`);
    b.onclick = () => { state.activeSample = i; renderCup(); };
    return b;
  }));
}

function renderCup() {
  normalizeTags();
  if (state.activeSample >= state.samples.length) state.activeSample = 0;

  const s = state.samples[state.activeSample];
  renderSampleTabs();

  $('#cupSampleName').textContent = `${s.tag} — ${nameOf(s)}`;
  $('#cupSampleMeta').textContent = [
    s.origin, s.process,
    s.profile && `Profile ${s.profile}`,
    s.batchNo,
    `rested ${restHours(s.roastDate, state.session.date)} h`
  ].filter(Boolean).join(' · ');

  const grid = $('#attrGrid');
  grid.replaceChildren(...AFFECTIVE_ATTRS.map(attr => {
    const hasIntensity = INTENSITY_ATTRS.includes(attr);
    const card = el('article', 'attr');
    card.dataset.attr = attr;

    const head = el('div', 'attr-head');
    head.innerHTML = `<h3>${attr}</h3>
      <div class="vals">
        ${hasIntensity ? `<span class="v-int">int <b data-int="${attr}">${s.intensity[attr]}</b></span>` : ''}
        <span class="v-qual">qual <b data-qual="${attr}">${s.affective[attr] ?? '—'}</b></span>
      </div>`;
    card.append(head);

    if (hasIntensity) {
      const axis = el('div', 'axis');
      axis.append(el('span', 'axis-label', 'Intensity'));

      const slider = el('input', 'slider');
      Object.assign(slider, { type: 'range', min: 0, max: 15, step: 1, value: s.intensity[attr] });
      slider.setAttribute('aria-label', `${attr} intensity`);
      slider.style.setProperty('--fill', `${(s.intensity[attr] / 15) * 100}%`);

      slider.oninput = () => mutate(() => {
        const v = Number(slider.value);
        s.intensity[attr] = v;
        slider.style.setProperty('--fill', `${(v / 15) * 100}%`);
        $(`[data-int="${attr}"]`).textContent = v;
      }, { light: true });

      axis.append(slider, el('div', 'anchors', '<span>0 · Low</span><span>8 · Medium</span><span>15 · High</span>'));
      card.append(axis);
    }

    const qAxis = el('div', 'axis');
    qAxis.append(el('span', 'axis-label', 'Quality'));

    const qual = el('div', 'qual');
    for (let v = 1; v <= 9; v++) {
      const b = el('button', s.affective[attr] === v ? 'is-on' : '', String(v));
      b.setAttribute('aria-label', `${attr} quality ${v}`);
      b.onclick = () => mutate(() => {
        s.affective[attr] = v;
        $$('button', qual).forEach((x, i) => x.classList.toggle('is-on', i + 1 === v));
        $(`[data-qual="${attr}"]`).textContent = v;
        updateLiveScore();
      }, { light: true });
      qual.append(b);
    }
    qAxis.append(qual);
    card.append(qAxis);

    return card;
  }));

  updateLiveScore();
  renderSampleRail();
  renderCupFooter();
}

/* ── Sample navigation ───────────────────────────────────── */

const scoredCount = s => AFFECTIVE_ATTRS.filter(a => s.affective[a] != null).length;

/** First attribute still missing a quality rating, in form order. */
const firstGap = s => AFFECTIVE_ATTRS.find(a => s.affective[a] == null) || null;

/** Centres an attribute card and pulses it so the target is obvious on arrival. */
function scrollToAttr(attr) {
  const card = $(`.attr[data-attr="${CSS.escape(attr)}"]`);
  if (!card) return window.scrollTo({ top: 0, behavior: 'smooth' });

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('is-target');
  void card.offsetWidth;              // restart the animation if it's still running
  card.classList.add('is-target');
  setTimeout(() => card.classList.remove('is-target'), 1600);
}

/**
 * Switching samples lands you where the work actually is: a partly-scored
 * sample jumps to its first unrated attribute rather than the top of a form
 * you have already filled in.
 */
function goToSample(index) {
  mutate(() => { state.activeSample = index; });

  const s = state.samples[index];
  const gap = firstGap(s);

  // Untouched or complete samples start at the top; partial ones jump to the gap.
  if (gap && scoredCount(s) > 0) scrollToAttr(gap);
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Vertical rail — random access to any sample without scrolling up. */
function renderSampleRail() {
  const rail = $('#sampleRail');

  rail.replaceChildren(...state.samples.map((s, i) => {
    const done = scoredCount(s);
    const gap = firstGap(s);
    const cls = done === AFFECTIVE_ATTRS.length ? 'is-done' : done > 0 ? 'is-partial' : '';

    const b = el('button', `rail-btn ${cls}` + (i === state.activeSample ? ' is-active' : ''), s.tag);
    b.title = done === AFFECTIVE_ATTRS.length
      ? `${nameOf(s)} — fully scored`
      : `${nameOf(s)} — ${done}/${AFFECTIVE_ATTRS.length} scored${done > 0 ? ` · resumes at ${gap}` : ''}`;
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-current', i === state.activeSample ? 'true' : 'false');
    b.onclick = () => goToSample(i);
    return b;
  }));
}

/** End-of-form navigation — the natural next action after scoring Overall. */
function renderCupFooter() {
  // renderDerived() can reach this after a sample was removed.
  const i = Math.min(state.activeSample, state.samples.length - 1);
  const s = state.samples[i];
  if (!s) return;

  const remaining = AFFECTIVE_ATTRS.length - scoredCount(s);
  const isLast = i >= state.samples.length - 1;

  const footer = $('#cupFooter');
  footer.replaceChildren();

  const prev = el('button', 'btn', i > 0 ? `← ${state.samples[i - 1].tag}` : '← Previous');
  prev.disabled = i === 0;
  prev.onclick = () => goToSample(i - 1);

  const mid = el('div', 'cup-footer-mid');
  mid.append(el('strong', null, `Sample ${i + 1} of ${state.samples.length}`));

  const gap = firstGap(s);

  if (gap) {
    // Jumping straight to the next unrated attribute beats hunting for it.
    const jump = el('button', 'jump-link',
      `${remaining} left — go to ${gap}`);
    jump.onclick = () => scrollToAttr(gap);
    mid.append(jump);
  } else {
    mid.append(el('span', null, 'Fully scored'));
  }

  const next = el('button', 'btn btn-primary',
    isLast ? 'Cup check →' : `Next — ${state.samples[i + 1].tag} →`);
  next.onclick = () => isLast ? go('cups') : goToSample(i + 1);

  footer.append(prev, mid, next);
}

function updateLiveScore() {
  const s = state.samples[state.activeSample];
  const score = cvaScore(s.affective, s.cups);
  const remaining = AFFECTIVE_ATTRS.filter(a => s.affective[a] == null).length;

  $('#liveScore').textContent = fmtScore(score);
  $('.live-score-label').textContent = remaining
    ? `${remaining} attribute${remaining > 1 ? 's' : ''} left`
    : 'Live score';
}

/* ── Render: cup check ───────────────────────────────────── */

function renderCupCheck() {
  normalizeTags();

  $('#cupcheckGrid').replaceChildren(...state.samples.map(s => {
    const card = el('article', 'cupcheck');
    const score = cvaScore(s.affective, s.cups);

    const head = el('header', null,
      `<h3>${s.tag} — ${nameOf(s)}</h3>
       <span class="pill ${score == null ? 'pill-muted' : 'pill-good'}" data-cc-score>${fmtScore(score)}</span>`);
    card.append(head);

    s.cups.forEach((_, idx) => {
      const row = el('div', 'cup-row');
      row.append(el('span', null, `Cup ${idx + 1}`));

      const opts = el('div', 'cup-opts');
      CUP_STATES.forEach(({ key, label }) => {
        const b = el('button', s.cups[idx] === key ? `on-${key}` : '', label);
        b.onclick = () => mutate(() => {
          s.cups[idx] = key;
          $$('button', opts).forEach(x => x.className = '');
          b.className = `on-${key}`;
          $('[data-cc-score]', card).textContent = fmtScore(cvaScore(s.affective, s.cups));
          updateLiveScore();
        }, { light: true });
        opts.append(b);
      });

      row.append(opts);
      card.append(row);
    });

    return card;
  }));
}

/* ── Render: results ─────────────────────────────────────── */

function renderResults() {
  normalizeTags();

  const ranked = state.samples
    .map(s => ({ s, score: cvaScore(s.affective, s.cups), disp: disposition(s) }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

  // Unknown rest is treated as under-rested — an unverifiable rest time is not a safe one.
  const under = state.samples.filter(s => {
    const h = restHours(s.roastDate, state.session.date);
    return !Number.isFinite(h) || h < REST_GATE_HOURS;
  });

  const banner = $('#restBanner');

  if (under.length) {
    const detail = under.map(s => {
      const h = restHours(s.roastDate, state.session.date);
      return `${s.tag} (${Number.isFinite(h) ? `${h} h` : 'no roast date'})`;
    }).join(', ');

    banner.style.display = '';
    banner.innerHTML =
      `<strong>🔶 PRELIM — rest under ${REST_GATE_HOURS} h</strong>
       <span>${detail}. No binding disposition assigned — re-cup at day 5–7.</span>`;
  } else {
    banner.style.display = 'none';
  }

  const table = $('#resultsTable');
  table.replaceChildren(el('div', 'rt-head',
    '<span></span><span>Sample</span><span>Score</span><span>Defect cups</span><span>Disposition</span>'));

  ranked.forEach((r, i) => {
    const defective = r.s.cups.filter(c => c === 'defective').length;

    // An unscored sample can never be the Control Coffee, even at rank 1.
    const isWinner = i === 0 && r.score != null;

    const sub = [
      r.s.tag,
      r.s.profile && `Profile ${r.s.profile}`,
      r.s.batchNo,
      isWinner && 'Control Coffee candidate'
    ].filter(Boolean).join(' · ');

    const row = el('div', 'rt-row' + (isWinner ? ' is-winner' : ''));
    row.innerHTML = `
      <span class="rank">${i + 1}</span>
      <span class="rt-name">
        <strong>${nameOf(r.s)}${isWinner ? ' ★' : ''}</strong>
        <span>${sub}</span>
      </span>
      <span class="rt-score">${fmtScore(r.score)}</span>
      <span>${defective} / 3</span>
      <span><span class="badge badge-${r.disp.tone}">${r.disp.label}</span></span>`;
    table.append(row);
  });

  refreshExportState();
}

/** Verdict tally for any batch collection. */
function tally(batches) {
  const n = key => batches.filter(x => x.verdict === key).length;
  const pass = n('pass'), pulled = n('pulled'), fail = n('fail');
  const scored = pass + pulled + fail;
  return { pass, pulled, fail, scored, total: batches.length,
           passRate: scored ? Math.round((pass / scored) * 100) : 0 };
}

function renderScreeningResults() {
  const b = state.batches;
  const total = b.length;
  const { pass, pulled, fail, scored, passRate } = tally(b);

  /* incomplete work — fails missing a cause, or batches not yet evaluated */
  const missingReason = b.filter(x => x.verdict === 'fail' && !x.reason).length;
  const unscored = total - scored;
  const banner = $('#incompleteBanner');

  if (missingReason || unscored) {
    const parts = [];
    if (missingReason) parts.push(`${missingReason} fail${missingReason > 1 ? 's' : ''} missing a defect cause`);
    if (unscored) parts.push(`${unscored} batch${unscored > 1 ? 'es' : ''} not yet evaluated`);
    banner.style.display = '';
    banner.innerHTML = `<strong>Session incomplete</strong><span>${parts.join(' · ')}. Not ready to export.</span>`;
  } else {
    banner.style.display = 'none';
  }

  /* stat tiles */
  $('#statRow').replaceChildren(...[
    ['', total, 'batches'],
    ['t-good', pass, 'Hopper & Client'],
    ['t-warn', pulled, 'Pulled Shot'],
    ['t-bad', fail, 'Fail'],
    [passRate === 0 && scored ? 't-bad' : 't-good', `${passRate}%`, 'pass rate']
  ].map(([tone, value, label]) => el('div', `stat ${tone}`, `<b>${value}</b><span>${label}</span>`)));

  /* per-lot comparison — the point of screening several profiles at once */
  const cmp = $('#lotComparison');
  cmp.replaceChildren();

  if (state.lots.length > 1) {
    const rows = state.lots.map(l => ({ l, t: tally(batchesOf(l.id)) }))
      .sort((a, c) => c.t.passRate - a.t.passRate);

    const best = rows[0], worst = rows[rows.length - 1];
    const gap = best.t.scored && worst.t.scored ? best.t.passRate - worst.t.passRate : 0;

    cmp.append(el('h2', 'section-title', 'By lot / profile'));

    const table = el('div', 'results-table lot-compare');
    table.append(el('div', 'rt-head',
      '<span>Lot / profile</span><span>Batches</span><span>Pass</span><span>Pulled</span><span>Fail</span><span>Pass rate</span>'));

    rows.forEach(({ l, t }) => {
      const tone = t.passRate >= 80 ? 'good' : t.passRate >= 50 ? 'warn' : 'bad';
      const row = el('div', 'rt-row');
      row.innerHTML = `
        <span class="rt-name"><strong>${lotLabel(l)}</strong><span>${[l.origin, l.process].filter(Boolean).join(' · ')}</span></span>
        <span>${t.total}</span>
        <span>${t.pass}</span>
        <span>${t.pulled}</span>
        <span>${t.fail}</span>
        <span><span class="badge badge-${t.scored ? tone : 'muted'}">${t.scored ? `${t.passRate}%` : '—'}</span></span>`;
      table.append(row);
    });

    cmp.append(table);

    // Only claim a difference once every lot has actually been evaluated.
    if (gap >= 20 && rows.every(r => r.t.scored === r.t.total && r.t.total > 0)) {
      cmp.append(el('div', 'banner banner-info',
        `<strong>${lotLabel(best.l)} is outperforming ${lotLabel(worst.l)} by ${gap} points</strong>
         <span>${best.t.passRate}% vs ${worst.t.passRate}% pass rate across ${best.t.total} and ${worst.t.total} batches.
         Small samples move fast — confirm across more runs before changing a profile.</span>`));
    }
  }

  /* defect cause breakdown */
  const reasons = {};
  b.forEach(x => { if (x.verdict === 'fail' && x.reason) reasons[x.reason] = (reasons[x.reason] || 0) + 1; });

  const entries = Object.entries(reasons).sort((a, c) => c[1] - a[1]);
  const list = $('#reasonBreakdown');

  list.replaceChildren();
  if (entries.length) {
    list.append(el('h2', 'section-title', 'Defect causes'));
    list.append(el('div', 'reason-list',
      entries.map(([r, n]) => `<span class="reason-tag">${r} <b>${n}</b></span>`).join('')));
  }

  /* per-batch table */
  const table = $('#batchResultsTable');
  table.replaceChildren(el('div', 'rt-head',
    '<span>Lot / profile</span><span>Batch</span><span>Verdict</span><span>Acid / Sweet / Body</span><span>Defect cause</span>'));

  b.forEach(x => {
    const v = verdictOf(x.verdict);
    const lot = lotById(x.lotId);
    const trend = TREND_ATTRS.map(a => x.attrs[a] ?? '–').join(' · ');

    const row = el('div', 'rt-row');
    row.innerHTML = `
      <span class="rt-name"><strong>${lot ? lotLabel(lot) : '—'}</strong></span>
      <span style="font-variant-numeric:tabular-nums">#${String(x.no).padStart(3, '0')}</span>
      <span>${v ? `<span class="badge badge-${v.tone}">${v.full}</span>` : '<span class="badge badge-muted">Not evaluated</span>'}</span>
      <span style="font-variant-numeric:tabular-nums;color:var(--muted)">${trend}</span>
      <span>${x.reason ? x.reason : (x.verdict === 'fail' ? '<span class="badge badge-bad">Cause required</span>' : '—')}</span>`;
    table.append(row);
  });

  refreshExportState();
}

/* ── Export wiring ───────────────────────────────────────── */

function setExportStatus(message, tone) {
  const node = $('#exportStatus');
  node.hidden = !message;
  node.textContent = message || '';
  node.className = 'export-status' + (tone ? ` is-${tone}` : '');
}

/** Export buttons stay disabled until the session is actually complete. */
function refreshExportState() {
  const blocked = exportBlocker();
  const buttons = ['#btnCopy', '#btnDownload', '#btnSaveVault'].map(s => $(s));

  buttons.forEach(b => { b.disabled = !!blocked; });
  $('#btnSaveVault').hidden = !canSaveToVault();

  $('#resultsSub').textContent = state.mode === 'screening'
    ? 'Batch verdicts and trend indicators. No CVA score is produced in this mode.'
    : 'Ranked by CVA affective score.';

  if (blocked) setExportStatus(`Not ready to export — ${blocked}`, 'blocked');
  else setExportStatus('', null);
}

async function runExport(fn) {
  try {
    const message = await fn();
    // A successful export means the session is finished — archive it.
    await archiveCurrent();
    setExportStatus(`${message} Archived to Sessions.`, null);
  } catch (err) {
    if (err && err.name === 'AbortError') return setExportStatus('Cancelled.', 'blocked');
    setExportStatus(`Export failed — ${err.message || err}`, 'error');
  }
}

/* ── Self-check on the formula ───────────────────────────── */

(function verifyFormula() {
  const all = v => Object.fromEntries(AFFECTIVE_ATTRS.map(a => [a, v]));
  const clean = ['uniform', 'uniform', 'uniform'];

  const checks = [
    ['all 9s → 100.00', cvaScore(all(9), clean), 100],
    ['all 1s → 58.00',  cvaScore(all(1), clean), 58],
    ['all 9s, 1 defective → 96.00', cvaScore(all(9), ['uniform', 'uniform', 'defective']), 96],
    ['all 9s, 1 non-uniform → 98.00', cvaScore(all(9), ['uniform', 'uniform', 'nonUniform']), 98],
    ['unscored → null', cvaScore(blankScores().affective, clean), null],
    ['partially scored → null', cvaScore({ ...all(9), Overall: null }, clean), null]
  ];

  checks.forEach(([name, got, want]) => {
    console[got === want ? 'log' : 'error'](`${got === want ? '✓' : '✗'} ${name} — got ${got}`);
  });
})();

/* ── Boot ────────────────────────────────────────────────── */

$('#addSample').onclick = addSample;
$('#addLot').onclick = addLot;
$('#generateBatches').onclick = generateBatches;
$('#btnNewSession').onclick = startFresh;
$('#sessionSearch').oninput = paintSessions;

$('#btnCopy').onclick      = () => runExport(copyMarkdown);
$('#btnDownload').onclick  = () => runExport(async () => downloadMarkdown());
$('#btnSaveVault').onclick = () => runExport(saveToVault);

/**
 * Restores a persisted snapshot over the seeded demo state.
 * Missing keys keep their seeded value, so an older snapshot from a
 * previous version of the app still loads instead of blanking the UI.
 */
function restore(saved) {
  if (!saved || typeof saved !== 'object') return false;

  PERSIST_KEYS.forEach(k => {
    if (saved[k] !== undefined && saved[k] !== null) state[k] = saved[k];
  });

  // Guard against a snapshot that predates a field or was hand-edited.
  if (!Array.isArray(state.samples) || state.samples.length < MIN_SAMPLES) {
    state.samples = [newSample(), newSample()];
  }
  if (!Array.isArray(state.lots) || !state.lots.length) state.lots = [{ ...newLot(), id: 1 }];
  if (!Array.isArray(state.batches)) state.batches = [];

  // Drop orphaned batches whose lot no longer exists.
  const ids = new Set(state.lots.map(l => l.id));
  state.batches = state.batches.filter(b => ids.has(b.lotId));

  return true;
}

async function boot() {
  const available = await storageAvailable();
  const saved = available ? await kvGet('currentSession') : null;

  const restored = restore(saved);

  if (!restored) {
    // First run — seed batches so the Screen isn't empty.
    state.batches = state.lots.flatMap(l =>
      Array.from({ length: lotCount(l) }, (_, i) => newBatch(l.id, l.from + i)));
  }

  normalizeTags();
  saveHealthy = available;
  renderSaveState();

  await renderSessions();

  renderSetup();
  renderLots();
  setMode(state.mode);
  go(restored ? 'setup' : 'sessions');

  $('#sessionLabel').textContent =
    `${(state.session.date || '').slice(0, 10)} · ${state.mode === 'screening' ? 'Screening' : 'Table cupping'}`;

  if (!available) {
    setExportStatus('Storage unavailable on this origin — work is held in memory only. Export before closing.', 'error');
  }
}

boot();

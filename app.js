'use strict';

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey(new Date());
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ICONS = ['🏃', '💪', '🧘', '🚴', '💧', '📖', '📚', '💼', '✍️', '🎸', '🥗', '😴', '🧹', '💊', '🙏', '🌱', '🧠', '🚶', '🎨', '💰'];
const COLORS = ['#4f46e5', '#0a84c9', '#1f9d55', '#d97706', '#d43d3d', '#c026a3', '#0d9488', '#6b7280'];

function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
function fmtClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
}

/* ---------- Estado ---------- */
const KEY = 'habitos.v1';
let state = load();
let ui = { tab: 'today', day: today(), period: 'week', draft: null, alarmQueue: [] };

function seed() {
  const created = today();
  const all = [0, 1, 2, 3, 4, 5, 6], wk = [1, 2, 3, 4, 5];
  const h = (name, icon, color, type, goal, unit, days, reminders) =>
    ({ id: uid(), name, icon, color, type, goal, unit, days, reminders, created });
  return {
    habits: [
      h('Ejercicio', '🏃', COLORS[4], 'time', 30, 'min', all, ['07:00']),
      h('Tomar agua', '💧', COLORS[1], 'count', 8, 'vasos', all, ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00']),
      h('Leer', '📖', COLORS[3], 'time', 20, 'min', all, ['21:00']),
      h('Estudiar', '📚', COLORS[0], 'time', 45, 'min', wk, ['18:00']),
      h('Avanzar con el trabajo', '💼', COLORS[2], 'time', 120, 'min', wk, ['09:30'])
    ],
    log: {}, timers: {}, fired: {}, snoozes: [], sound: true
  };
}
// Marca como ya avisadas las alarmas de hoy cuya hora pasó (al crear o editar hábitos).
function skipPastAlarms(s, h) {
  const d = new Date(), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  h.reminders.forEach(t => { if (t < hm) s.fired[`${today()}|${h.id}|${t}`] = 1; });
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.habits)) return Object.assign({ log: {}, timers: {}, fired: {}, snoozes: [], sound: true }, s);
  } catch (e) { /* datos corruptos: se reinicia */ }
  const s = seed();
  s.habits.forEach(h => skipPastAlarms(s, h));
  return s;
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ---------- Lógica de hábitos ---------- */
const habit = id => state.habits.find(h => h.id === id);
const goalUnits = h => h.type === 'time' ? h.goal * 60 : h.type === 'count' ? h.goal : 1;
const scheduled = (h, k) => k >= h.created && h.days.includes(fromKey(k).getDay());
function value(h, k) {
  let v = (state.log[k] && state.log[k][h.id]) || 0;
  if (h.type === 'time' && state.timers[h.id] && k === today()) v += (Date.now() - state.timers[h.id]) / 1000;
  return v;
}
const isDone = (h, k) => value(h, k) >= goalUnits(h);
function setValue(h, k, v) {
  v = Math.max(0, v);
  if (!state.log[k]) state.log[k] = {};
  if (v) state.log[k][h.id] = v; else delete state.log[k][h.id];
  save();
}
function progressText(h, k) {
  const v = value(h, k);
  if (h.type === 'time') return `<b>${fmtDur(v)}</b> de ${fmtDur(h.goal * 60)} mínimo`;
  if (h.type === 'count') return `<b>${v}</b> de ${h.goal} ${esc(h.unit || 'veces')}`;
  return v ? '<b>Realizado</b>' : 'Pendiente';
}
function streak(h) {
  let k = today(), n = 0;
  if (!isDone(h, k) || !scheduled(h, k)) k = addDays(k, -1);
  while (k >= h.created) {
    if (scheduled(h, k)) { if (isDone(h, k)) n++; else break; }
    k = addDays(k, -1);
  }
  return n;
}
const GOAL_DAYS = 66;
const MILESTONES = [3, 7, 14, 21, 30, 45, 66];
function bestStreak(h) {
  let best = 0, n = 0;
  for (let k = h.created, t = today(); k <= t; k = addDays(k, 1)) {
    if (!scheduled(h, k)) continue;
    if (isDone(h, k)) { if (++n > best) best = n; } else if (k !== t) n = 0;
  }
  return best;
}
// Al llegar a 66 días seguidos el hábito queda marcado como logrado.
function checkGoals() {
  let changed = false;
  for (const h of state.habits) {
    if (h.achieved || streak(h) < GOAL_DAYS) continue;
    h.achieved = today(); changed = true;
    ui.alarmQueue.push({ id: h.id, goal: true });
  }
  if (changed) { save(); beep(); showAlarm(); }
}
function stopTimer(h) {
  const start = state.timers[h.id];
  if (!start) return;
  delete state.timers[h.id];
  const k = today();
  setValue(h, k, ((state.log[k] && state.log[k][h.id]) || 0) + (Date.now() - start) / 1000);
}

/* ---------- Vistas ---------- */
function ring(pct, label) {
  const r = 32, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 76 76" role="img" aria-label="${label}">
    <circle class="t" cx="38" cy="38" r="${r}"/>
    <circle class="p" cx="38" cy="38" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 38 38)"/>
    <text x="38" y="45" text-anchor="middle">${Math.round(pct * 100)}%</text></svg>`;
}

function viewToday() {
  const k = ui.day, isToday = k === today();
  const list = state.habits.filter(h => scheduled(h, k));
  const done = list.filter(h => isDone(h, k)).length;
  let dateTxt = fromKey(k).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  dateTxt = dateTxt[0].toUpperCase() + dateTxt.slice(1);
  let html = `<div class="head"><div><h1>${isToday ? 'Hoy' : k === addDays(today(), -1) ? 'Ayer' : 'Día anterior'}</h1><div class="sub">${dateTxt}</div></div>
    <div class="nav-day"><button data-a="day" data-n="-1" aria-label="Día anterior">‹</button><button data-a="day" data-n="1" aria-label="Día siguiente" ${isToday ? 'disabled' : ''}>›</button></div></div>`;
  if (!list.length) {
    return html + `<div class="empty"><div class="e">🌤️</div><p>No hay hábitos programados para este día.</p></div>
      <button class="btn" data-a="new">Crear un hábito</button>`;
  }
  const pct = done / list.length;
  html += `<div class="card hero">${ring(pct, 'Avance del día')}<div><div class="big">${done} de ${list.length} cumplidos</div>
    <div class="sub">${pct === 1 ? '¡Día completo! Excelente trabajo 🎉' : done ? 'Vas bien, sigue así.' : 'Empieza por el más fácil.'}</div></div></div>`;
  const sorted = list.slice().sort((a, b) => isDone(a, k) - isDone(b, k));
  for (const h of sorted) {
    const d = isDone(h, k), v = value(h, k), running = !!state.timers[h.id] && isToday;
    let act;
    if (h.type === 'check') act = `<button class="act ${d ? 'done' : ''}" data-a="toggle" data-id="${h.id}" aria-label="Marcar ${esc(h.name)}">${d ? '✓' : '○'}</button>`;
    else if (h.type === 'count') act = `<button class="act ${d ? 'done' : ''}" data-a="inc" data-id="${h.id}" aria-label="Sumar uno a ${esc(h.name)}">${d ? '✓' : '+1'}</button>`;
    else if (running) act = `<button class="act run" data-a="timer" data-id="${h.id}" aria-label="Detener cronómetro"><span data-clock="${h.id}">${fmtClock(v)}</span>&nbsp;■</button>`;
    else if (isToday && !d) act = `<button class="act" data-a="timer" data-id="${h.id}" aria-label="Iniciar cronómetro de ${esc(h.name)}">▶</button>`;
    else act = `<button class="act ${d ? 'done' : ''}" data-a="detail" data-id="${h.id}" aria-label="Registrar ${esc(h.name)}">${d ? '✓' : '+'}</button>`;
    const st = streak(h);
    const bar = h.type === 'count' && h.goal <= 20
      ? `<div class="segs ${h.goal <= 10 ? 'big' : ''}" role="group" aria-label="${esc(h.unit || 'veces')} registrados">${Array.from({ length: h.goal }, (_, i) =>
        `<button data-a="setcount" data-id="${h.id}" data-n="${i + 1}" class="${i < v ? 'on' : ''}" aria-label="${i + 1} ${esc(h.unit || '')}" aria-pressed="${i < v}">${h.goal <= 10 ? h.icon : ''}</button>`).join('')}</div>`
      : `<div class="bar"><i data-bar="${h.id}" style="width:${Math.min(100, v / goalUnits(h) * 100)}%"></i></div>`;
    const next = isToday && !d ? (h.reminders.filter(t => t > nowHM())[0] || '') : '';
    html += `<div class="card ${d ? 'done-card' : ''}" style="--c:${h.color}">
      <div class="row"><button class="row grow" data-a="detail" data-id="${h.id}" style="text-align:left">
        <div class="icon">${h.icon}</div>
        <div class="grow"><div class="name">${esc(h.name)}</div><div class="meta" data-prog="${h.id}">${progressText(h, k)}${next ? ` · ⏰ ${next}` : ''}${h.achieved ? ' · 🏆' : st ? ` · 🔥 ${st}/${GOAL_DAYS}` : ''}</div></div>
      </button>${act}</div>${bar}</div>`;
  }
  const age = state.lastBackup ? Math.floor((Date.now() - state.lastBackup) / 864e5) : null;
  if (isToday && Object.keys(state.log).length >= 3 && (age === null || age >= 7) && Date.now() - (state.backupSnooze || 0) > 7 * 864e5) {
    html += `<div class="card"><div class="row"><div class="icon sm">☁️</div><div class="grow"><div class="name">Guarda una copia en la nube</div>
      <div class="meta">${age === null ? 'Aún no tienes una copia de tus datos.' : `Tu última copia es de hace ${age} días.`}</div></div></div>
      <div class="two" style="margin-top:10px"><button class="btn sec" style="margin:0" data-a="backup-later">Ahora no</button><button class="btn" style="margin:0" data-a="backup">Guardar copia</button></div></div>`;
  }
  return html + `<p class="hint">Toca un hábito para registrar tiempo o corregir el avance.${list.some(h => h.type === 'count') ? ' En los de cantidad, toca la barra para marcar cada uno.' : ''}</p>`;
}

function periodDays(shift = 0) {
  const n = ui.period === 'day' ? 1 : ui.period === 'week' ? 7 : 30;
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today(), -i - shift * n));
  return out;
}
function dayStats(k) {
  const l = state.habits.filter(h => scheduled(h, k));
  return { n: l.length, d: l.filter(h => isDone(h, k)).length };
}
function periodPct(days) {
  let n = 0, d = 0;
  for (const k of days) { const s = dayStats(k); n += s.n; d += s.d; }
  return { n, d, pct: n ? d / n : null };
}
function motivation() {
  const k = today(), list = state.habits.filter(h => scheduled(h, k)), pending = list.filter(h => !isDone(h, k));
  if (list.length && !pending.length) return ['🎉', '¡Día perfecto!', `Cumpliste todo lo de hoy. Un paso más hacia los ${GOAL_DAYS} días.`];
  const risk = pending.map(h => [streak(h), h]).sort((a, b) => b[0] - a[0])[0];
  if (risk && risk[0] >= 2) return ['🔥', `No rompas tu racha de ${risk[0]} días`, `Hoy te falta «${risk[1].name}» para seguir sumando.`];
  const q = [
    ['🌱', 'Cada día cuenta', `Un hábito se forma repitiéndolo: ${GOAL_DAYS} días seguidos y será parte de ti.`],
    ['💪', 'Empieza por el más fácil', 'Cumplir uno te da impulso para el siguiente.'],
    ['⏱️', 'Solo el mínimo', 'No tiene que ser perfecto: cumple el tiempo mínimo y suma el día.'],
    ['🚀', 'Hoy es un buen día', 'Lo que hagas hoy es la racha de la que presumirás mañana.']
  ];
  return q[Math.floor(Date.now() / 864e5) % q.length];
}
function quickAct(h) {
  if (h.type === 'check') return `<button class="act" data-a="toggle" data-id="${h.id}" aria-label="Marcar ${esc(h.name)}">✓</button>`;
  if (h.type === 'count') return `<button class="act" data-a="inc" data-id="${h.id}" aria-label="Sumar uno a ${esc(h.name)}">+1</button>`;
  return `<button class="act" data-a="detail" data-id="${h.id}" aria-label="Registrar ${esc(h.name)}">+</button>`;
}
function dayDetail(k) {
  const list = state.habits.filter(h => scheduled(h, k));
  let t = fromKey(k).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  t = t[0].toUpperCase() + t.slice(1);
  let html = `<div class="daybox"><div class="row"><b class="grow">${t}</b><button class="link" data-a="goto-day" data-k="${k}">Editar este día ›</button></div>`;
  if (!list.length) html += `<div class="meta">Sin hábitos programados.</div>`;
  for (const h of list) {
    const v = value(h, k);
    const b = isDone(h, k) ? ['ok', 'Cumplido'] : v > 0 ? ['warn', 'Bajo el mínimo'] : k === today() ? ['na', 'Pendiente'] : ['bad', 'No realizado'];
    html += `<div class="kv"><span>${h.icon} ${esc(h.name)}${h.type !== 'check' && v ? ` · ${h.type === 'time' ? fmtDur(v) : v + ' ' + esc(h.unit || '')}` : ''}</span><span class="badge ${b[0]}">${b[1]}</span></div>`;
  }
  return html + `</div>`;
}
function viewSummary() {
  const days = periodDays(), k0 = today();
  let html = `<div class="head"><div><h1>Resumen</h1><div class="sub">${ui.period === 'day' ? 'Hoy' : `Últimos ${days.length} días`}</div></div></div>
    <div class="seg">${[['day', 'Hoy'], ['week', '7 días'], ['month', '30 días']].map(([p, l]) => `<button data-a="period" data-p="${p}" class="${ui.period === p ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (!state.habits.length) return html + `<div class="empty"><div class="e">📊</div><p>Crea tu primer hábito para ver tu resumen.</p></div>`;

  const m = motivation();
  html += `<div class="card moti row"><div class="e">${m[0]}</div><div class="grow"><div class="big">${m[1]}</div><div class="sub">${m[2]}</div></div></div>`;

  const pending = state.habits.filter(h => scheduled(h, k0) && !isDone(h, k0));
  if (pending.length) {
    html += `<h2>Hoy te falta</h2><div class="card">${pending.map(h => `<div class="row todo" style="--c:${h.color}"><div class="icon sm">${h.icon}</div>
      <div class="grow"><div class="name">${esc(h.name)}</div><div class="meta">${progressText(h, k0)}</div></div>${quickAct(h)}</div>`).join('')}</div>`;
  }

  const cur = periodPct(days), prev = periodPct(periodDays(1));
  const perfect = days.filter(k => { const s = dayStats(k); return s.n && s.d === s.n; }).length;
  let trend = '';
  if (ui.period !== 'day' && prev.pct !== null && cur.pct !== null) {
    const diff = Math.round((cur.pct - prev.pct) * 100);
    trend = diff > 0 ? `<span class="badge ok">▲ ${diff} puntos vs. período anterior</span>` : diff < 0 ? `<span class="badge bad">▼ ${-diff} puntos vs. período anterior</span>` : `<span class="badge na">Igual que el período anterior</span>`;
  }
  html += `<h2>Cumplimiento</h2><div class="card"><div class="hero">${ring(cur.pct || 0, 'Cumplimiento general')}<div><div class="big">${cur.d} de ${cur.n} metas cumplidas</div>
    <div class="sub">${ui.period === 'day' ? (cur.pct === 1 ? 'Cumpliste todo lo de hoy 🎉' : 'Aún puedes completar el día.') : `${perfect} ${perfect === 1 ? 'día perfecto' : 'días perfectos'}`}</div>${trend ? `<div style="margin-top:6px">${trend}</div>` : ''}</div></div>`;
  if (ui.period === 'week') {
    html += `<div class="chart">${days.map(k => {
      const s = dayStats(k), p = s.n ? s.d / s.n : 0;
      return `<button class="col ${ui.selDay === k ? 'sel' : ''}" data-a="sel-day" data-k="${k}" aria-label="${k}: ${Math.round(p * 100)}%">
        <span class="pc">${s.n ? Math.round(p * 100) + '%' : ''}</span><span class="b ${p ? '' : 'zero'} ${p === 1 ? 'full' : ''}" style="height:${p ? Math.max(6, p * 100) : 3}%"></span><span class="l">${DAY_LETTERS[fromKey(k).getDay()]}</span></button>`;
    }).join('')}</div>`;
  } else if (ui.period === 'month') {
    const padN = (fromKey(days[0]).getDay() + 6) % 7;
    html += `<div class="cal">${DAY_ORDER.map(d => `<span class="l">${DAY_LETTERS[d]}</span>`).join('')}${'<span></span>'.repeat(padN)}${days.map(k => {
      const s = dayStats(k), p = s.n ? s.d / s.n : 0;
      return `<button class="${ui.selDay === k ? 'sel' : ''} ${p === 1 ? 'full' : ''}" style="--p:${Math.round(p * 100)}%" data-a="sel-day" data-k="${k}" aria-label="${k}: ${Math.round(p * 100)}%">${fromKey(k).getDate()}</button>`;
    }).join('')}</div>`;
  }
  if (ui.period !== 'day') html += ui.selDay && days.includes(ui.selDay) ? dayDetail(ui.selDay) : `<p class="hint" style="text-align:center">Toca un día para ver el detalle.</p>`;
  html += `</div><h2>Camino a los ${GOAL_DAYS} días</h2>`;

  for (const h of state.habits) {
    const s = streak(h), best = Math.max(bestStreak(h), h.achieved ? GOAL_DAYS : 0), open = ui.open === h.id;
    const sd = days.filter(k => scheduled(h, k));
    const dn = sd.filter(k => isDone(h, k)).length;
    const total = sd.reduce((a, k) => a + value(h, k), 0);
    const required = sd.length * goalUnits(h);
    const nextM = MILESTONES.find(x => x > s);
    const status = h.achieved ? `🏆 Objetivo logrado · racha actual ${s}` : s ? `🔥 Día ${s} de ${GOAL_DAYS} · ${nextM === GOAL_DAYS ? `faltan ${GOAL_DAYS - s} para el objetivo` : `próxima medalla en ${nextM - s}`}` : 'Cúmplelo hoy para empezar tu racha';
    html += `<div class="card" style="--c:${h.color}"><button class="row full" data-a="open-h" data-id="${h.id}" aria-expanded="${open}"><div class="icon">${h.icon}</div>
      <div class="grow"><div class="name">${esc(h.name)}</div><div class="meta">${status}</div></div><span class="chev">${open ? '▴' : '▾'}</span></button>
      <div class="bar tall"><i style="width:${Math.min(100, (h.achieved ? GOAL_DAYS : s) / GOAL_DAYS * 100)}%"></i></div>
      <div class="medals">${MILESTONES.map(x => `<span class="${best >= x ? 'on' : ''}" title="${x} días seguidos">${x === GOAL_DAYS ? '🏆' : x}</span>`).join('')}</div>`;
    if (open) {
      const gb = !sd.length ? ['na', 'Sin días programados'] : dn === sd.length ? ['ok', 'Cumplida'] : dn ? ['warn', 'En parte'] : ['bad', 'No cumplida'];
      html += `<div class="kv"><span>Meta del período (${dn} de ${sd.length} ${sd.length === 1 ? 'día' : 'días'})</span><span class="badge ${gb[0]}">${gb[1]}</span></div>`;
      if (sd.length && h.type === 'time') {
        const ok = total >= required;
        html += `<div class="kv"><span>Tiempo realizado</span><b>${fmtDur(total)}</b></div>
          <div class="kv"><span>Tiempo mínimo (${h.goal} min × ${sd.length})</span><b>${fmtDur(required)}</b></div>
          <div class="kv"><span>¿Se cumplió el tiempo mínimo?</span><span class="badge ${ok ? 'ok' : 'bad'}">${ok ? 'Sí' : `No, faltan ${fmtDur(Math.ceil((required - total) / 60) * 60)}`}</span></div>`;
      } else if (sd.length && h.type === 'count') {
        const ok = total >= required;
        html += `<div class="kv"><span>Total</span><b>${total} de ${required} ${esc(h.unit || 'veces')}</b></div>
          <div class="kv"><span>¿Se alcanzó la cantidad mínima?</span><span class="badge ${ok ? 'ok' : 'bad'}">${ok ? 'Sí' : `No, faltan ${required - total}`}</span></div>`;
      }
      html += `<div class="kv"><span>Mejor racha</span><b>${best} ${best === 1 ? 'día' : 'días'}</b></div>`;
      if (h.achieved) html += `<div class="kv"><span>Objetivo de ${GOAL_DAYS} días logrado</span><b>${fromKey(h.achieved).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>`;
      if (days.length > 1) {
        html += `<div class="dots">${days.map(k => {
          const c = !scheduled(h, k) ? 'off' : isDone(h, k) ? 'ok' : value(h, k) > 0 ? 'part' : k === k0 ? '' : 'miss';
          return `<i class="${c}" title="${k}"></i>`;
        }).join('')}</div><div class="legend"><span><i style="background:var(--ok)"></i>Cumplido</span><span><i style="background:var(--warn)"></i>Bajo el mínimo</span><span><i style="background:color-mix(in srgb, var(--bad) 55%, var(--track))"></i>No realizado</span></div>`;
      }
    }
    html += `</div>`;
  }
  return html + `<p class="hint">La racha cuenta los días programados seguidos en que cumpliste la meta. Al llegar a ${GOAL_DAYS}, el hábito se da por logrado.</p>`;
}

function habitDesc(h) {
  const goal = h.type === 'time' ? `${h.goal} min mínimo` : h.type === 'count' ? `${h.goal} ${esc(h.unit || 'veces')}` : 'Una vez';
  const days = h.days.length === 7 ? 'todos los días' : DAY_ORDER.filter(d => h.days.includes(d)).map(d => DAY_LETTERS[d]).join(' ');
  return `${goal} · ${days}${h.reminders.length ? ' · ⏰ ' + h.reminders.join(', ') : ''}`;
}
function viewHabits() {
  let html = `<div class="head"><div><h1>Hábitos</h1><div class="sub">Metas, días y alarmas</div></div><button class="act" data-a="new" aria-label="Nuevo hábito">＋</button></div>`;
  if (!state.habits.length) html += `<div class="empty"><div class="e">🎯</div><p>Aún no tienes hábitos.</p></div>`;
  for (const h of state.habits) {
    html += `<button class="card row" data-a="edit" data-id="${h.id}" style="--c:${h.color};width:100%;text-align:left">
      <div class="icon">${h.icon}</div><div class="grow"><div class="name">${esc(h.name)}</div><div class="meta">${habitDesc(h)}</div></div><span class="chev">›</span></button>`;
  }
  return html + `<button class="btn" data-a="new" style="margin-top:8px">Nuevo hábito</button>`;
}

function viewSettings() {
  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const permTxt = { granted: 'Activadas', denied: 'Bloqueadas: actívalas en Ajustes del iPhone › Notificaciones', default: 'Toca para activarlas', unsupported: standalone ? 'No disponibles en este dispositivo' : 'Primero instala la app en la pantalla de inicio' }[perm];
  return `<div class="head"><div><h1>Ajustes</h1><div class="sub">Alarmas y datos</div></div></div>
  <h2>Alarmas</h2>
  <div class="card">
    <button class="list-btn" data-a="perm"><span>Notificaciones<small>${permTxt}</small></span><span class="chev">›</span></button>
    <button class="list-btn" data-a="sound"><span>Sonido de alarma<small>Suena cuando la app está abierta</small></span><span class="badge ${state.sound ? 'ok' : 'na'}">${state.sound ? 'Activado' : 'Apagado'}</span></button>
    <button class="list-btn" data-a="test"><span>Probar alarma<small>Muestra un aviso de ejemplo</small></span><span class="chev">›</span></button>
    <button class="list-btn" data-a="ics"><span>Enviar alarmas al Calendario<small>Para que suenen aunque la app esté cerrada</small></span><span class="chev">›</span></button>
  </div>
  <p class="hint">Dentro de la app las alarmas suenan mientras está abierta. Para recibirlas siempre, usa «Enviar alarmas al Calendario»: el iPhone te avisará a la hora de cada hábito. Si cambias horarios, vuelve a enviarlas.</p>
  ${standalone ? '' : `<h2>Instalar en el iPhone</h2><div class="card"><div class="meta">1. Abre esta página en <b>Safari</b>.<br>2. Toca <b>Compartir</b> (el cuadrado con la flecha).<br>3. Elige <b>Agregar a pantalla de inicio</b>.<br>4. Abre «Hábitos» desde el ícono nuevo.</div></div>`}
  <h2>Copia en la nube</h2>
  <div class="card">
    <button class="list-btn" data-a="backup"><span>Guardar en iCloud o Google Drive<small>${state.lastBackup ? 'Última copia: ' + new Date(state.lastBackup).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Aún no has guardado una copia'}</small></span><span class="chev">›</span></button>
    <button class="list-btn" data-a="restore"><span>Restaurar desde iCloud o Google Drive<small>Reemplaza los datos actuales por los de una copia</small></span><span class="chev">›</span></button>
  </div>
  <div class="card"><div class="meta"><b>Para guardar:</b> toca «Guardar…», elige <b>Guardar en Archivos</b> y luego <b>iCloud Drive</b> o <b>Google Drive</b>. También puedes elegir directamente la app <b>Drive</b>.<br><br>
    <b>Para restaurar:</b> toca «Restaurar…» y busca el archivo <b>habitos-copia</b> en iCloud Drive o Google Drive.<br><br>
    <b>¿No aparece Google Drive?</b> Instala la app Google Drive e inicia sesión. Luego abre Archivos › Explorar › ⋯ › Editar y activa Google Drive.</div></div>
  <p class="hint">Tus datos viven en este iPhone; la copia es un archivo que tú guardas en tu nube. La app te recordará hacerla cada semana.</p>
  <h2>Datos</h2>
  <div class="card">
    <button class="list-btn" data-a="reset" style="color:var(--bad)"><span>Borrar todo<small>Elimina hábitos y registros</small></span></button>
  </div>
  <input type="file" id="file" accept="application/json,.json" hidden>`;
}

function render() {
  const v = { today: viewToday, summary: viewSummary, habits: viewHabits, settings: viewSettings }[ui.tab];
  $('#view').innerHTML = v();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
}

/* ---------- Hojas (formularios) ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = html;
  $('#sheet').hidden = false; $('#sheet-backdrop').hidden = false;
  $('#sheet').scrollTop = 0;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; ui.draft = null; ui.detail = null; }

function sheetDetail(h) {
  ui.detail = h.id;
  const k = ui.day, v = value(h, k);
  const shown = h.type === 'time' ? Math.floor(v / 60) : v;
  let body;
  if (h.type === 'check') {
    body = `<button class="btn" data-a="set-done">${v ? 'Marcar como pendiente' : 'Marcar como realizado'}</button>`;
  } else {
    const unit = h.type === 'time' ? 'minutos' : esc(h.unit || 'veces');
    const quick = h.type === 'time' ? [5, 15, 30] : [1, 2];
    body = `<label class="f" for="d-val">Avance registrado (${unit})</label>
      <input class="inp" id="d-val" type="number" inputmode="numeric" min="0" value="${shown}">
      <div class="two" style="margin-top:8px">${quick.map(q => `<button class="btn sec" style="margin:0" data-a="quick" data-n="${q}">+${q}${h.type === 'time' ? ' min' : ''}</button>`).join('')}</div>
      <button class="btn" style="margin-top:14px" data-a="save-val">Guardar</button>
      <button class="btn sec" data-a="set-done">Marcar meta cumplida (${h.type === 'time' ? h.goal + ' min' : h.goal + ' ' + unit})</button>`;
  }
  openSheet(`<div class="sheet-head"><button data-a="close">Cerrar</button><h3>${h.icon} ${esc(h.name)}</h3><button data-a="edit" data-id="${h.id}">Editar</button></div>
    <div class="card"><div class="meta">${progressText(h, k)}</div><div class="meta">${habitDesc(h)}</div></div>${body}
    ${v ? '<button class="btn danger" data-a="clear-val">Borrar registro de este día</button>' : ''}`);
}

function sheetForm() {
  const d = ui.draft;
  openSheet(`<div class="sheet-head"><button data-a="close">Cancelar</button><h3>${d.isNew ? 'Nuevo hábito' : 'Editar hábito'}</h3><button data-a="save-habit">Guardar</button></div>
    <label class="f" for="f-name">Nombre</label>
    <input class="inp" id="f-name" maxlength="40" placeholder="Ej. Meditar" value="${esc(d.name)}">
    <label class="f">Ícono</label>
    <div class="pick">${ICONS.map(i => `<button data-a="f-icon" data-v="${i}" class="${d.icon === i ? 'on' : ''}">${i}</button>`).join('')}</div>
    <label class="f">Color</label>
    <div class="pick colors">${COLORS.map(c => `<button data-a="f-color" data-v="${c}" style="--c:${c}" class="${d.color === c ? 'on' : ''}" aria-label="Color"></button>`).join('')}</div>
    <label class="f">¿Cómo se mide?</label>
    <div class="seg" style="margin:0">${[['time', 'Tiempo'], ['count', 'Cantidad'], ['check', 'Solo marcar']].map(([t, l]) => `<button data-a="f-type" data-v="${t}" class="${d.type === t ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${d.type === 'time' ? `<label class="f" for="f-goal">Tiempo mínimo por día (minutos)</label><input class="inp" id="f-goal" type="number" inputmode="numeric" min="1" value="${d.goal}">` : ''}
    ${d.type === 'count' ? `<div class="two"><div><label class="f" for="f-goal">Meta diaria</label><input class="inp" id="f-goal" type="number" inputmode="numeric" min="1" value="${d.goal}"></div>
      <div><label class="f" for="f-unit">Unidad</label><input class="inp" id="f-unit" maxlength="14" placeholder="vasos" value="${esc(d.unit || '')}"></div></div>` : ''}
    <label class="f">Días</label>
    <div class="pick days">${DAY_ORDER.map(n => `<button data-a="f-day" data-v="${n}" class="${d.days.includes(n) ? 'on' : ''}">${DAY_LETTERS[n]}</button>`).join('')}</div>
    <label class="f">Alarmas</label>
    ${d.reminders.map((t, i) => `<div class="rem"><input class="inp" type="time" data-rem="${i}" value="${t}" aria-label="Hora de la alarma"><button data-a="f-rem-del" data-v="${i}" aria-label="Quitar alarma">✕</button></div>`).join('')}
    <button class="btn sec" data-a="f-rem-add">＋ Agregar alarma</button>
    ${d.isNew ? '' : '<button class="btn danger" style="margin-top:16px" data-a="del-habit">Eliminar hábito</button>'}`);
}
function readForm() {
  const d = ui.draft; if (!d) return;
  const n = $('#f-name'); if (n) d.name = n.value;
  const g = $('#f-goal'); if (g) d.goal = g.value;
  const u = $('#f-unit'); if (u) d.unit = u.value;
  document.querySelectorAll('[data-rem]').forEach(i => { d.reminders[+i.dataset.rem] = i.value; });
}

/* ---------- Alarmas ---------- */
function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
let audioCtx;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* sin audio */ }
}
function beep() {
  if (!state.sound || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, .28, .56, 1.1, 1.38, 1.66].forEach((dt, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = i % 3 === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + .02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + .22);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + dt); o.stop(t0 + dt + .25);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: title });
    else new Notification(title, { body });
  } catch (e) { /* sin notificaciones */ }
}
function triggerAlarm(h, test) {
  ui.alarmQueue.push({ id: h.id, test: !!test });
  beep();
  notify(`${h.icon} ${h.name}`, h.type === 'time' ? `Es hora: ${h.goal} min como mínimo.` : 'Es hora de tu hábito.');
  showAlarm();
}
function showAlarm() {
  const el = $('#alarm'), a = ui.alarmQueue[0];
  if (!a) { el.hidden = true; return; }
  if (a.goal) {
    const g = habit(a.id);
    if (!g) { ui.alarmQueue.shift(); return showAlarm(); }
    el.innerHTML = `<div class="alarm-box pop"><div class="e">🏆</div><h3>¡Objetivo logrado!</h3>
      <p>${GOAL_DAYS} días seguidos de «${esc(g.name)}». Ya es parte de ti: sigue así.</p>
      <button class="btn" data-a="al-close">¡Genial!</button></div>`;
    el.hidden = false; return;
  }
  const h = a.test ? { icon: '⏰', name: 'Alarma de prueba', type: 'check', goal: 1 } : habit(a.id);
  if (!h) { ui.alarmQueue.shift(); return showAlarm(); }
  const main = a.test ? '' : h.type === 'time' ? `<button class="btn" data-a="al-start">▶ Iniciar ahora</button>` : `<button class="btn" data-a="al-done">${h.type === 'count' ? '+1 Registrar' : '✓ Ya lo hice'}</button>`;
  el.innerHTML = `<div class="alarm-box"><div class="e">${h.icon}</div><h3>${esc(h.name)}</h3>
    <p>${a.test ? 'Así se verán tus alarmas.' : 'Es hora de tu hábito. ' + (h.type === 'time' ? `Mínimo ${h.goal} min.` : '')}</p>
    ${main}${a.test ? '' : '<button class="btn sec" data-a="al-snooze">Posponer 10 min</button>'}
    <button class="btn danger" data-a="al-close">Cerrar</button></div>`;
  el.hidden = false;
}
function checkAlarms() {
  const k = today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  let changed = false;
  for (const key of Object.keys(state.fired)) if (!key.startsWith(k)) { delete state.fired[key]; changed = true; }
  for (const h of state.habits) {
    if (!scheduled(h, k)) continue;
    for (const t of h.reminders) {
      const [hh, mm] = t.split(':').map(Number), late = nowMin - (hh * 60 + mm), key = `${k}|${h.id}|${t}`;
      if (late < 0 || state.fired[key]) continue;
      state.fired[key] = 1; changed = true;
      if (late <= 60 && !isDone(h, k) && !state.timers[h.id]) triggerAlarm(h);
    }
  }
  const due = state.snoozes.filter(s => s.at <= Date.now());
  if (due.length) {
    state.snoozes = state.snoozes.filter(s => s.at > Date.now()); changed = true;
    for (const s of due) { const h = habit(s.id); if (h && !isDone(h, k)) triggerAlarm(h); }
  }
  if (changed) save();
}

/* ---------- Calendario (.ics) ---------- */
function buildICS() {
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const txt = s => String(s).replace(/([\\;,])/g, '\\$1').replace(/\n/g, ' ');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mis Habitos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const h of state.habits) {
    if (!h.days.length) continue;
    let d = new Date();
    while (!h.days.includes(d.getDay())) d.setDate(d.getDate() + 1);
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    for (const t of h.reminders) {
      const dur = h.type === 'time' ? Math.min(h.goal, 600) : 10;
      L.push('BEGIN:VEVENT', `UID:${h.id}-${t.replace(':', '')}@mis-habitos`, `DTSTAMP:${stamp}`,
        `DTSTART:${date}T${t.replace(':', '')}00`, `DURATION:PT${dur}M`,
        `RRULE:FREQ=WEEKLY;BYDAY=${h.days.map(n => BY[n]).join(',')}`,
        `SUMMARY:${txt(h.icon + ' ' + h.name)}`,
        `DESCRIPTION:${txt(h.type === 'time' ? `Tiempo mínimo: ${h.goal} min. Márcalo en la app Hábitos.` : 'Márcalo en la app Hábitos.')}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(h.name)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
async function shareFile(name, type, content) {
  const file = new File([content], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

/* ---------- Acciones ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}
function celebrate(h, before) {
  if (before || !isDone(h, ui.day)) return;
  const s = streak(h);
  toast(ui.day === today() && MILESTONES.includes(s) && s < GOAL_DAYS ? `🔥 ¡${s} días seguidos de ${h.name}!` : `¡${h.name} cumplido! 🎉`);
}

const actions = {
  day(el) { const k = addDays(ui.day, +el.dataset.n); if (k <= today()) ui.day = k; },
  period(el) { ui.period = el.dataset.p; ui.selDay = null; },
  'sel-day'(el) { ui.selDay = ui.selDay === el.dataset.k ? null : el.dataset.k; },
  'open-h'(el) { ui.open = ui.open === el.dataset.id ? null : el.dataset.id; },
  'goto-day'(el) { ui.tab = 'today'; ui.day = el.dataset.k; scrollTo(0, 0); },
  setcount(el) {
    const h = habit(el.dataset.id), b = isDone(h, ui.day), n = +el.dataset.n;
    setValue(h, ui.day, value(h, ui.day) === n ? n - 1 : n); celebrate(h, b);
  },
  'backup-later'() { state.backupSnooze = Date.now(); save(); },
  toggle(el) { const h = habit(el.dataset.id), b = isDone(h, ui.day); setValue(h, ui.day, b ? 0 : 1); celebrate(h, b); },
  inc(el) { const h = habit(el.dataset.id), b = isDone(h, ui.day); setValue(h, ui.day, value(h, ui.day) + 1); celebrate(h, b); },
  timer(el) {
    const h = habit(el.dataset.id);
    if (state.timers[h.id]) { const b = (state.log[today()] || {})[h.id] >= goalUnits(h); stopTimer(h); celebrate(h, b); if (!isDone(h, today())) toast(`Registrado: ${fmtDur(value(h, today()))}`); }
    else { state.timers[h.id] = Date.now(); save(); }
  },
  detail(el) { sheetDetail(habit(el.dataset.id)); return false; },
  close() { closeSheet(); },
  quick(el) { const i = $('#d-val'); i.value = (+i.value || 0) + +el.dataset.n; return false; },
  'save-val'() {
    const h = habit(ui.detail), b = isDone(h, ui.day), n = Math.max(0, Math.floor(+$('#d-val').value || 0));
    if (state.timers[h.id]) delete state.timers[h.id];
    setValue(h, ui.day, h.type === 'time' ? n * 60 : n); closeSheet(); celebrate(h, b);
  },
  'set-done'() {
    const h = habit(ui.detail), b = isDone(h, ui.day);
    if (state.timers[h.id]) stopTimer(h);
    setValue(h, ui.day, h.type === 'check' && b ? 0 : Math.max(goalUnits(h), (state.log[ui.day] || {})[h.id] || 0));
    closeSheet(); celebrate(h, b);
  },
  'clear-val'() { const h = habit(ui.detail); delete state.timers[h.id]; setValue(h, ui.day, 0); closeSheet(); },
  new() {
    ui.draft = { isNew: true, id: uid(), name: '', icon: ICONS[0], color: COLORS[0], type: 'time', goal: 30, unit: '', days: [0, 1, 2, 3, 4, 5, 6], reminders: ['08:00'], created: today() };
    sheetForm(); return false;
  },
  edit(el) { ui.draft = JSON.parse(JSON.stringify(habit(el.dataset.id))); sheetForm(); return false; },
  'f-icon'(el) { readForm(); ui.draft.icon = el.dataset.v; sheetFormKeep(); return false; },
  'f-color'(el) { readForm(); ui.draft.color = el.dataset.v; sheetFormKeep(); return false; },
  'f-type'(el) {
    readForm(); const d = ui.draft; d.type = el.dataset.v;
    if (d.type === 'count' && !d.unit) d.unit = 'veces';
    sheetFormKeep(); return false;
  },
  'f-day'(el) { readForm(); const d = ui.draft, n = +el.dataset.v; d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : d.days.concat(n); sheetFormKeep(); return false; },
  'f-rem-add'() { readForm(); ui.draft.reminders.push('12:00'); sheetFormKeep(); return false; },
  'f-rem-del'(el) { readForm(); ui.draft.reminders.splice(+el.dataset.v, 1); sheetFormKeep(); return false; },
  'save-habit'() {
    readForm();
    const d = ui.draft;
    d.name = d.name.trim();
    if (!d.name) { toast('Escribe un nombre para el hábito'); return false; }
    if (!d.days.length) { toast('Elige al menos un día'); return false; }
    d.goal = d.type === 'check' ? 1 : Math.max(1, Math.floor(+d.goal || 0));
    if (d.type === 'time') { d.goal = Math.min(d.goal, 1440); d.unit = 'min'; }
    d.reminders = [...new Set(d.reminders.filter(t => /^\d\d:\d\d$/.test(t)))].sort();
    const old = habit(d.id), isNew = d.isNew; delete d.isNew;
    if (old && old.type !== d.type) { for (const k in state.log) delete state.log[k][d.id]; delete state.timers[d.id]; }
    if (old) state.habits[state.habits.indexOf(old)] = d; else state.habits.push(d);
    // Las alarmas de hoy que ya pasaron no deben sonar al guardar.
    skipPastAlarms(state, d);
    save(); closeSheet(); toast(isNew ? 'Hábito creado' : 'Cambios guardados');
  },
  'del-habit'() {
    const d = ui.draft;
    if (!confirm(`¿Eliminar «${d.name}» y todo su historial?`)) return false;
    state.habits = state.habits.filter(h => h.id !== d.id);
    for (const k in state.log) delete state.log[k][d.id];
    delete state.timers[d.id];
    save(); closeSheet();
  },
  async perm() {
    if (!('Notification' in window)) { toast('Instala la app en la pantalla de inicio para activar notificaciones'); return false; }
    if (Notification.permission === 'denied') { toast('Actívalas en Ajustes del iPhone › Notificaciones'); return false; }
    await Notification.requestPermission();
    if (Notification.permission === 'granted') notify('Hábitos', 'Notificaciones activadas ✅');
  },
  sound() { state.sound = !state.sound; save(); if (state.sound) beep(); },
  test() { triggerAlarm({ id: 'test', icon: '⏰', name: 'Alarma de prueba', type: 'check' }, true); return false; },
  ics() {
    if (!state.habits.some(h => h.reminders.length)) { toast('Ningún hábito tiene alarmas'); return false; }
    shareFile('habitos-alarmas.ics', 'text/calendar', buildICS()); return false;
  },
  async backup() {
    if (await shareFile(`habitos-copia-${today()}.json`, 'application/json', JSON.stringify(state))) { state.lastBackup = Date.now(); save(); }
  },
  restore() { $('#file').click(); return false; },
  reset() {
    if (!confirm('¿Borrar todos los hábitos y registros? No se puede deshacer.')) return false;
    state = { habits: [], log: {}, timers: {}, fired: {}, snoozes: [], sound: true }; save();
  },
  'al-start'() { const a = ui.alarmQueue.shift(); state.timers[a.id] = Date.now(); save(); ui.tab = 'today'; ui.day = today(); showAlarm(); },
  'al-done'() { const a = ui.alarmQueue.shift(), h = habit(a.id), k = today(); if (h && !isDone(h, k)) setValue(h, k, value(h, k) + 1); showAlarm(); },
  'al-snooze'() { const a = ui.alarmQueue.shift(); state.snoozes.push({ id: a.id, at: Date.now() + 10 * 60000 }); save(); toast('Te aviso en 10 minutos'); showAlarm(); },
  'al-close'() { ui.alarmQueue.shift(); showAlarm(); }
};
function sheetFormKeep() { const s = $('#sheet').scrollTop; sheetForm(); $('#sheet').scrollTop = s; }

document.addEventListener('click', async e => {
  unlockAudio();
  const tab = e.target.closest('#tabs button');
  if (tab) { ui.tab = tab.dataset.tab; ui.day = today(); ui.selDay = null; render(); scrollTo(0, 0); return; }
  if (e.target.id === 'sheet-backdrop') { closeSheet(); return; }
  const el = e.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
  const r = await actions[el.dataset.a](el);
  checkGoals();
  if (r !== false) render();
});
document.addEventListener('change', e => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const s = JSON.parse(fr.result);
      if (!s || !Array.isArray(s.habits) || typeof s.log !== 'object') throw 0;
      if (!confirm('¿Reemplazar los datos actuales con esta copia?')) return;
      localStorage.setItem(KEY, JSON.stringify(s)); state = load(); render(); toast('Copia restaurada');
    } catch (err) { toast('El archivo no es una copia válida'); }
  };
  fr.readAsText(e.target.files[0]);
});

/* ---------- Ciclo ---------- */
let lastDay = today();
// Un cronómetro que quedó en marcha de un día anterior se cierra a la medianoche de ese día.
function settleTimers() {
  let changed = false;
  for (const id of Object.keys(state.timers)) {
    const start = state.timers[id], sk = dkey(new Date(start));
    if (sk === today()) continue;
    delete state.timers[id]; changed = true;
    if (!habit(id)) continue;
    if (!state.log[sk]) state.log[sk] = {};
    state.log[sk][id] = (state.log[sk][id] || 0) + (fromKey(addDays(sk, 1)) - start) / 1000;
  }
  if (changed) save();
  return changed;
}
setInterval(() => {
  // Actualiza cronómetros en marcha sin redibujar toda la pantalla.
  if (ui.tab === 'today' && ui.day === today()) {
    for (const id of Object.keys(state.timers)) {
      const h = habit(id); if (!h) continue;
      const v = value(h, ui.day);
      const c = $(`[data-clock="${id}"]`), b = $(`[data-bar="${id}"]`), p = $(`[data-prog="${id}"]`);
      if (c) c.textContent = fmtClock(v);
      if (b) b.style.width = Math.min(100, v / goalUnits(h) * 100) + '%';
      if (p) p.innerHTML = progressText(h, ui.day);
    }
  }
}, 1000);
function tick() {
  const k = today();
  const settled = settleTimers();
  const newDay = k !== lastDay;
  if (newDay) { if (ui.day === lastDay) ui.day = k; lastDay = k; }
  if (settled || newDay) render();
  checkAlarms();
}
setInterval(tick, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
tick();
checkGoals();

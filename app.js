const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
async function api(u, m = 'GET', b) {
  const r = await fetch('/api' + u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error); return j;
}
const tm = t => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const PAGES = [['dashboard', '🏠', 'Dashboard'], ['patient', '👤', 'Patient'], ['bottle', '🧴', 'Bottle'], ['reminders', '⏰', 'Reminders'], ['analytics', '📊', 'Analytics'], ['caregiver', '🩺', 'Caregiver'], ['iot', '📡', 'IoT Monitor'], ['hardware', '🔧', 'Hardware'], ['settings', '⚙️', 'Settings']];
$('#nav').innerHTML = PAGES.map(p => `<a href="#${p[0]}" data-p="${p[0]}">${p[1]} ${p[2]}</a>`).join('');
function route() { const h = location.hash.slice(1) || 'dashboard'; $$('section').forEach(s => s.classList.toggle('on', s.id === h)); $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === h)); }
addEventListener('hashchange', route); route();
let S, charts = {}, firing = false;
const chart = (id, cfg) => { if (charts[id]) { charts[id].data = cfg.data; charts[id].update(); } else charts[id] = new Chart($('#' + id), { ...cfg, options: { responsive: true, ...(cfg.options || {}) } }); };
async function refresh() {
  S = await api('/hydration/today'); const w = await api('/hydration/weekly'), b = S.bottle;
  const V = { name: S.patient.name, pct: S.pct, ml: S.ml, target: S.target, remaining: S.remaining, level: b.level, cap: b.capacity, bpct: Math.round(b.level / b.capacity * 100),
    scoreTxt: `${S.score}/100`, last: tm(S.last), nextT: tm(S.next), missed: S.missed, streak: S.streak, weeklyConsistency: S.weeklyConsistency };
  $$('[data-k]').forEach(e => e.textContent = V[e.dataset.k]);
  $('#ring').style.setProperty('--p', S.pct); $('#water').style.height = V.bpct + '%';
  $$('.bottle .water').forEach(x => x.style.height = V.bpct + '%');
  const cls = S.status.split(' ')[0], icon = { Hydrated: '🟢', Needs: '🟡', Long: '🔴' }[cls];
  $('#st').className = 'pill ' + cls; $('#st').textContent = `${icon} ${S.status}`; $('#cst').textContent = `${icon} ${S.status}`;
  const al = S.alerts.map(a => `<div class="alert ${a.level}">⚠ ${a.msg}</div>`).join('');
  $('#alerts').innerHTML = al; $('#calerts').innerHTML = al || '<p class="note">No active alerts.</p>';
  $('#tl').innerHTML = S.logs.length ? S.logs.map(l => `<li><b>${tm(l.ts)}</b> — ${l.ml} ml</li>`).join('') : '<li>No water logged yet today. Tap Drink 250 ml to start.</li>';
  $('#gap').innerHTML = S.alerts.find(a => a.msg.startsWith('You have')) ? `<p class="alert red" style="margin-top:1rem">⚠ ${S.alerts[0].msg}</p><button onclick="drink(250)">Drink 250 ml</button>` : '';
  if (document.activeElement.id !== 'ri' && document.activeElement.id !== 'ra') { $('#ri').value = S.interval; $('#ra').value = S.alertAfter; }
  const est = Math.round(S.patient.weight * 33);
  $('#est').textContent = `Estimated target: ${est} ml/day (about 33 ml per kg). This is an estimate only. A doctor or caregiver can change it.`;
  chart('c1', { type: 'bar', data: { labels: [...Array(24).keys()].map(h => h + ':00'), datasets: [{ label: 'ml', data: S.byHour, backgroundColor: '#22b8cf' }] } });
  chart('c2', { type: 'bar', data: { labels: w.days.map(d => d.label), datasets: [{ label: 'ml', data: w.days.map(d => d.ml), backgroundColor: '#1668d9' }, { type: 'line', label: 'Target', data: w.days.map(() => w.target), borderColor: '#e04848' }] } });
  chart('c3', { type: 'doughnut', data: { labels: ['Actual', 'Remaining'], datasets: [{ data: [S.ml, S.remaining], backgroundColor: ['#22b8cf', '#dbe5f1'] }] } });
  let cum = 0; chart('c4', { type: 'line', data: { labels: S.logs.map(l => tm(l.ts)), datasets: [{ label: 'Cumulative ml', data: S.logs.map(l => cum += l.ml), borderColor: '#1668d9', fill: true, backgroundColor: 'rgba(22,104,217,.15)' }] } });
  const s = await api('/sensor'); $('#feed').textContent = JSON.stringify(s, null, 2);
}
async function post(u, b) { try { await api(u, 'POST', b); } catch (e) { alert(e.message); } hide(); refresh(); }
const drink = ml => post('/hydration/log', { ml });
const bd = ml => post('/bottle/drink', { ml });
const sim = type => post('/sensor/simulate', { type });
const snooze = () => post('/reminders', { snoozeMin: 10 });
const saveR = () => post('/reminders', { interval: $('#ri').value, alertAfter: $('#ra').value });
$('#demo').onclick = () => post('/demo/run');
// Patient form
const F = [['name', 'Name', 'text'], ['age', 'Age', 'number'], ['weight', 'Weight (kg)', 'number'], ['target', 'Daily water target (ml)', 'number'], ['wake', 'Wake-up time', 'time'], ['sleep', 'Sleep time', 'time'], ['interval', 'Reminder interval (min)', 'number'], ['notes', 'Medical / health notes', 'text']];
$('#pf').innerHTML = F.map(f => `<label>${f[1]}</label><input id="p_${f[0]}" type="${f[2]}">`).join('');
api('/patient').then(p => F.forEach(f => $('#p_' + f[0]).value = p[f[0]]));
const saveP = async () => { try { await api('/patient', 'PUT', Object.fromEntries(F.map(f => [f[0], $('#p_' + f[0]).value]))); refresh(); alert('Profile saved'); } catch (e) { alert(e.message); } };
const useEst = () => { $('#p_target').value = Math.round($('#p_weight').value * 33); };
const PROF = { 'Elderly patient': { name: 'Margaret Wilson', age: 72, weight: 65, target: 2000, interval: 120 }, 'Post-surgery': { name: 'Raj Patel', age: 45, weight: 80, target: 2800, interval: 90 }, 'Child': { name: 'Ava Chen', age: 9, weight: 30, target: 1200, interval: 90 } };
$('#profiles').innerHTML = Object.keys(PROF).map(k => `<button class="ghost" data-pr="${k}">${k}</button>`).join('');
$$('[data-pr]').forEach(b => b.onclick = async () => { await api('/patient', 'PUT', PROF[b.dataset.pr]); Object.entries(PROF[b.dataset.pr]).forEach(([k, v]) => $('#p_' + k).value = v); refresh(); });
// Reminders
let missTimer;
function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .4); } catch {} }
function fire() {
  if (firing) return; firing = true; $('#banner').style.display = 'block'; beep();
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Time to drink water', { body: 'Log your drink to stop this reminder.' });
  missTimer = setTimeout(() => { if (firing) api('/reminders', 'POST', { miss: true }).then(refresh); }, 60000);
}
function hide() { firing = false; clearTimeout(missTimer); $('#banner').style.display = 'none'; }
$('#bell').onclick = () => 'Notification' in window ? Notification.requestPermission().then(p => $('#bell').textContent = p === 'granted' ? '🔔 Alerts on' : '🔕 Blocked') : alert('Notifications are not supported here.');
setInterval(() => { if (S && !firing && Date.now() >= new Date(S.next)) fire(); }, 1000);
// Theme
function toggleTheme() { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; localStorage.setItem('theme', d); }
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
refresh(); setInterval(refresh, 5000);

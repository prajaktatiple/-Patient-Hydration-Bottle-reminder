const router = require('express').Router();
const db = require('../database/db');
const bad = (msg) => { const e = new Error(msg); e.status = 400; return e; };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const todayLogs = () => db.get().logs.filter(l => sameDay(l.ts, Date.now()));
const sum = a => a.reduce((s, l) => s + l.ml, 0);
const dayTotals = n => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
  return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en', { weekday: 'short' }), ml: sum(db.get().logs.filter(l => sameDay(l.ts, d))) };
});
function today() {
  const d = db.get(), L = todayLogs(), ml = sum(L), t = d.patient.target;
  const last = L.length ? L[L.length - 1].ts : null;
  const gapMin = last ? Math.round((Date.now() - new Date(last)) / 6e4) : null;
  const pct = Math.min(100, Math.round(ml / t * 100));
  const hours = new Set(L.map(l => new Date(l.ts).getHours())).size;
  const gapPen = gapMin === null ? 1 : Math.min(1, gapMin / 240);
  const score = Math.max(0, Math.min(100, Math.round(pct * .5 + Math.min(1, hours / 8) * 20 + (1 - gapPen) * 20 + Math.max(0, 10 - d.reminders.missed * 3))));
  const longGap = gapMin !== null && gapMin >= d.reminders.alertAfter;
  const status = longGap ? 'Long Gap' : pct >= 50 ? 'Hydrated' : 'Needs Attention';
  const base = last ? new Date(last).getTime() : Date.now();
  let next = base + d.reminders.interval * 6e4;
  if (d.reminders.snoozedUntil && d.reminders.snoozedUntil > next) next = d.reminders.snoozedUntil;
  const byHour = Array(24).fill(0); L.forEach(l => byHour[new Date(l.ts).getHours()] += l.ml);
  const totals = dayTotals(7); let streak = 0;
  for (let i = totals.length - 1; i >= 0; i--) { if (totals[i].ml >= t) streak++; else if (i !== totals.length - 1) break; }
  const alerts = [];
  if (longGap) {
    alerts.push({ level: 'red', msg: `You have not logged water for ${Math.floor(gapMin / 60)} hours ${gapMin % 60} minutes.` });
    alerts.push({ level: 'red', msg: `Caregiver alert (simulated): no hydration activity for over ${d.reminders.alertAfter} minutes.` });
  }
  if (d.bottle.level < d.bottle.capacity * .2) alerts.push({ level: 'amber', msg: 'Bottle is low. Please refill.' });
  if (d.reminders.missed >= 2) alerts.push({ level: 'amber', msg: `${d.reminders.missed} reminders missed today.` });
  return { patient: d.patient, ml, target: t, remaining: Math.max(0, t - ml), pct, last, gapMin, next, missed: d.reminders.missed,
    interval: d.reminders.interval, alertAfter: d.reminders.alertAfter, score, status, logs: L, byHour, bottle: d.bottle, alerts,
    streak, weeklyConsistency: Math.round(totals.filter(x => x.ml >= t * .8).length / 7 * 100), goalMet: ml >= t };
}
function addLog(ml, src) {
  ml = Number(ml);
  if (!Number.isFinite(ml) || ml < 1 || ml > 2000) throw bad('ml must be a number between 1 and 2000');
  const d = db.get(); d.logs.push({ ts: new Date().toISOString(), ml, src }); d.reminders.snoozedUntil = null; db.save();
}
router.get('/patient', (q, r) => r.json(db.get().patient));
router.put('/patient', (q, r) => {
  const b = q.body, p = db.get().patient;
  ['age', 'weight', 'target', 'interval'].forEach(k => { if (b[k] !== undefined && !(Number(b[k]) > 0)) throw bad(`${k} must be a positive number`); });
  ['name', 'wake', 'sleep', 'notes'].forEach(k => { if (b[k] !== undefined) p[k] = String(b[k]).slice(0, 300); });
  ['age', 'weight', 'target', 'interval'].forEach(k => { if (b[k] !== undefined) p[k] = Number(b[k]); });
  db.get().reminders.interval = p.interval; db.save(); r.json(p);
});
router.get('/hydration/today', (q, r) => r.json(today()));
router.get('/hydration/weekly', (q, r) => r.json({ days: dayTotals(7), target: db.get().patient.target }));
router.post('/hydration/log', (q, r) => { addLog(q.body.ml, 'manual'); r.json(today()); });
router.post('/bottle/drink', (q, r) => {
  const ml = Number(q.body.ml || 250), b = db.get().bottle;
  if (b.level < ml) throw bad('Not enough water in bottle. Refill first.');
  addLog(ml, 'bottle'); b.level -= ml; db.save(); r.json(today());
});
router.post('/bottle/refill', (q, r) => { const b = db.get().bottle; b.level = b.capacity; db.save(); r.json(today()); });
router.get('/reminders', (q, r) => r.json(db.get().reminders));
router.post('/reminders', (q, r) => {
  const b = q.body, m = db.get().reminders;
  if (b.interval !== undefined) { if (!(Number(b.interval) >= 1)) throw bad('interval must be at least 1 minute'); m.interval = Number(b.interval); db.get().patient.interval = m.interval; }
  if (b.alertAfter !== undefined) { if (!(Number(b.alertAfter) >= 1)) throw bad('alertAfter must be at least 1 minute'); m.alertAfter = Number(b.alertAfter); }
  if (b.snoozeMin) m.snoozedUntil = Date.now() + Number(b.snoozeMin) * 6e4;
  if (b.miss) m.missed++;
  db.save(); r.json(m);
});
router.get('/sensor', (q, r) => { const b = db.get().bottle; r.json({ ...b, weightG: Math.round(b.level + 180), timestamp: new Date().toISOString(), source: 'simulation' }); });
router.post('/sensor/simulate', (q, r) => {
  const b = db.get().bottle, t = q.body.type;
  if (t === 'drink') { const ml = Math.min(250, b.level); if (!ml) throw bad('Bottle is empty'); addLog(ml, 'sensor'); b.level -= ml; }
  else if (t === 'refill') b.level = b.capacity;
  else if (t === 'low') b.level = Math.round(b.capacity * .1);
  else if (t === 'temp') b.temp = Math.round((15 + Math.random() * 20) * 10) / 10;
  else if (t === 'reading') b.battery = Math.max(5, b.battery - 1);
  else if (t === 'response') db.get().reminders.snoozedUntil = null;
  else throw bad('type must be drink, refill, low, temp, reading or response');
  db.save(); r.json({ ok: true, sensor: b });
});
router.get('/alerts', (q, r) => r.json(today().alerts));
router.post('/demo/run', (q, r) => {
  const d = db.get(), t0 = new Date();
  d.logs = d.logs.filter(l => !sameDay(l.ts, Date.now()));
  [[9, 0, 250], [11, 15, 200], [13, 0, 300], [17, 0, 250]].forEach(([h, m, ml]) => { const x = new Date(t0); x.setHours(h, m, 0, 0); d.logs.push({ ts: x.toISOString(), ml, src: 'demo' }); });
  d.logs.sort((a, b) => a.ts.localeCompare(b.ts)); d.reminders.missed = 2; d.bottle.level = 300; db.save(); r.json(today());
});
router.post('/reset', (q, r) => { const d = db.get(); d.logs = d.logs.filter(l => !sameDay(l.ts, Date.now())); d.reminders.missed = 0; d.reminders.snoozedUntil = null; d.bottle.level = d.bottle.capacity; db.save(); r.json(today()); });
router.get('/report.csv', (q, r) => {
  r.setHeader('Content-Type', 'text/csv'); r.setHeader('Content-Disposition', 'attachment; filename=hydration-report.csv');
  r.send('timestamp,ml,source\n' + db.get().logs.map(l => `${l.ts},${l.ml},${l.src}`).join('\n'));
});
module.exports = router;

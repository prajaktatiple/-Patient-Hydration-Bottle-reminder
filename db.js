// Simple local JSON database. Swap this module for SQLite later without touching routes.
const fs = require('fs'), path = require('path'), os = require('os');
const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.patient-hydration-bottle');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'data.json');
function seed() {
  const out = [];
  [1800, 2100, 1500, 2000, 2200, 1700].forEach((t, i) => {
    [8, 11, 14, 17].forEach(h => {
      const x = new Date(); x.setDate(x.getDate() - i - 1); x.setHours(h, 0, 0, 0);
      out.push({ ts: x.toISOString(), ml: Math.round(t / 4), src: 'seed' });
    });
  });
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}
const defaults = () => ({
  patient: { name: 'Margaret Wilson', age: 72, weight: 65, target: 2000, wake: '07:00', sleep: '22:00', interval: 120, notes: 'Post-surgery recovery, on daily medication.' },
  logs: seed(),
  reminders: { interval: 120, alertAfter: 180, missed: 0, snoozedUntil: null },
  bottle: { capacity: 750, level: 750, temp: 22, battery: 87 }
});
let data;
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = defaults(); }
const save = () => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
module.exports = { get: () => data, save };

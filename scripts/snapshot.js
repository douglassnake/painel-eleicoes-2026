const fs = require('fs');
const vm = require('vm');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('data.js', 'utf8'), sandbox);
const D = sandbox.window.DASH_DATA;

const historySandbox = { window: {} };
vm.createContext(historySandbox);
vm.runInContext(fs.readFileSync('history.js', 'utf8'), historySandbox);
const history = historySandbox.window.DASH_HISTORY || [];

const now = new Date();
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(now).reduce((a,p)=>(a[p.type]=p.value,a),{});
const date = `${parts.year}-${parts.month}-${parts.day}`;
const label = new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', day:'2-digit', month:'short', year:'numeric'}).format(now).replace('.', '');

const pick = arr => Object.fromEntries(arr.filter(x=>x.poll!=null).map(x=>[x.nome, x.poll]));
const snapshot = {
  date,
  label,
  model: D.meta?.model || '',
  simulations: D.meta?.simulations || null,
  regional: Object.fromEntries(D.regional.map(x=>[x.nome, x.prob])),
  governador: pick(D.governador),
  senado: pick(D.senado),
  presidente: pick(D.presidente)
};

const sameDayIndex = history.findIndex(x=>x.date===date);
if (sameDayIndex >= 0) history[sameDayIndex] = snapshot;
else history.push(snapshot);
history.sort((a,b)=>a.date.localeCompare(b.date));

const content = 'window.DASH_HISTORY = ' + JSON.stringify(history, null, 2) + ';\n';
fs.writeFileSync('history.js', content, 'utf8');
console.log(`Snapshot ${date} salvo. Total: ${history.length}`);

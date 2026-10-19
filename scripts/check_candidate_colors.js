#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.createContext(sandbox);
const run=path=>vm.runInContext(fs.readFileSync(path,'utf8'),sandbox,{filename:path});
run('data.js');
run('presidential-colors.js');
const palette=sandbox.window.PresidentialColors;
assert.equal(palette.classFor('Flávio Bolsonaro','22',1),'candidate-flavio');
assert.equal(palette.classFor('FLAVIO BOLSONARO','',1),'candidate-flavio');
assert.equal(palette.classFor('Lula','13',1),'candidate-lula');
assert.equal(palette.classFor('LUIZ INÁCIO LULA DA SILVA','',1),'candidate-lula');
assert.equal(palette.classFor('Flávio Roscoe','22',3),'');
assert.equal(palette.classFor('Patrus Ananias','13',3),'');
assert.equal(palette.classFor('Domingos Sávio','22',5),'');
assert.equal(palette.classFor('Marília Campos','13',5),'');
assert.equal(palette.classFor('Outro candidato','30',1),'');
assert.equal(palette.classFor('Outro candidato','',6),'');
run('presidential-surveys.js');
const board=sandbox.window.SecondRoundPolls;
for(const markup of [board.compact(),board.full()]){
 assert.match(markup,/class="s2-face candidate-flavio"/);
 assert.match(markup,/class="s2-face candidate-lula"/);
 assert.match(markup,/class="s2-result candidate-flavio"/);
 assert.match(markup,/class="s2-result candidate-lula"/);
}
run('presidential-poll.js');
const verita=sandbox.window.PresidentialPoll.card();
assert.match(verita,/class="verita-person candidate-flavio"/);
assert.match(verita,/class="verita-person candidate-lula"/);
const app=fs.readFileSync('app.js','utf8');
const tse=fs.readFileSync('apuracao-2t.js','utf8');
const firstTurn=fs.readFileSync('resultados-ui.js','utf8');
assert.ok(app.includes("key==='presidente'?window.PresidentialColors.classFor"));
assert.ok(app.includes("presidential?window.PresidentialColors.classFor"));
assert.ok(app.includes("lineSvg(buildSeries('presidente',presTop),'%',true)"));
assert.ok(app.includes("lineSvg(buildSeries('presidenteSegundoTurno'"));
assert.ok(tse.includes('window.PresidentialColors.classFor(c.name,c.number,1)'));
assert.ok(firstTurn.includes('code===1?window.PresidentialColors.classFor'));
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('src="presidential-colors.js"')<html.indexOf('src="presidential-surveys.js"'));
assert.ok(html.indexOf('href="presidential-colors.css"')>html.indexOf('href="apuracao-2t.css"'));
const css=fs.readFileSync('presidential-colors.css','utf8');
for(const cls of ['s2-face','s2-result','verita-person','poll-line','snapshot-row',
 'chart-line','chart-dot','result-major-row','runoff-candidate']){
 assert.ok(css.includes('.'+cls+'.candidate-flavio'), 'Verde ausente em '+cls);
 assert.ok(css.includes('.'+cls+'.candidate-lula'), 'Vermelho ausente em '+cls);
}
assert.ok(css.includes('.history-legend span.candidate-flavio'));
assert.ok(css.includes('.history-legend span.candidate-lula'));
assert.match(css,/--pres-flavio-green:#[0-9a-f]{6}/);
assert.match(css,/--pres-lula-red:#[0-9a-f]{6}/);
console.log('OK: Flávio verde / Lula vermelho em todas as visualizações presidenciais; outros cargos preservados.');

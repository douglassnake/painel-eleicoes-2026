#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.join(__dirname,'..');
const dir=path.join(root,'municipais-2028');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
const ctx={window:{},URL,Intl,Date,console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir,'data.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(dir,'history-six.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(dir,'app.js'),'utf8'),ctx);
const history=ctx.window.MunicipalHistorySix;
assert.equal(typeof history.mount,'function');
assert.equal(history.elected({status:'MÉDIA'}),true);
assert.equal(history.elected({status:'NÃO ELEITO'}),false);
const htmlRows=history.table([{office:'vereador',ballotName:'Exemplo',ballotNumber:'12345',party:'TESTE',votes:152,status:'MÉDIA',fullName:'Exemplo Completo',zones:[]}],'vereador','Exem',true);
assert.ok(htmlRows.includes('Exemplo'));
const emptyRows=history.table([{office:'vereador',ballotName:'Exemplo',party:'TESTE',votes:152,status:'SUPLENTE'}],'vereador','',true);
assert.ok(emptyRows.includes('Nenhum registro'));
const db=ctx.window.Municipal2028Data;
const app=ctx.window.Municipal2028;

assert.equal(db.election.year,2028);
assert.equal(db.election.firstRound,'2028-10-01');
assert.equal(db.election.secondRound,'2028-10-29');
assert.equal(new Date('2028-10-01T12:00:00Z').getUTCDay(),0);
assert.equal(new Date('2028-10-29T12:00:00Z').getUTCDay(),0);

assert.equal(db.municipalities.length,3);
assert.equal(new Set(db.municipalities.map(m=>m.ibge)).size,3);
assert.ok(db.municipalities.every(m=>/^\d{7}$/.test(m.ibge)&&m.uf==='MG'));
assert.deepEqual(Array.from(db.municipalities.map(m=>m.ibge)),['3128600','3171006','3147006']);
assert.equal(db.historicalResults.length,0,'Números eleitorais não verificados não podem ser publicados.');

for(const city of db.municipalities){
  for(const section of ['visao-geral','historico','prefeito','vereadores','fontes']){
    const view=app.renderPage(city.ibge,section);
    assert.ok(view.includes(city.name));
    assert.ok(!view.includes('NaN'));
  }
  assert.equal(app.availableResults(city.ibge,2024).length,0);
}
assert.throws(()=>app.renderPage('0000000','visao-geral'));
assert.throws(()=>app.renderPage('3128600','desconhecida'));

const base={year:2024,office:'prefeito',round:1,ibge:'3128600',candidate:'Exemplo exclusivamente de teste',party:'XX',votes:100,sourceUrl:'https://dadosabertos.tse.jus.br/dataset/resultados-2024'};
assert.equal(app.validateHistoricalEntry(base),true);
assert.equal(app.validateHistoricalEntry({...base,year:2028}),false,'Não aceitar votação futura como histórica.');
assert.equal(app.validateHistoricalEntry({...base,votes:-1}),false);
assert.equal(app.validateHistoricalEntry({...base,votes:10.5}),false);
assert.equal(app.validateHistoricalEntry({...base,sourceUrl:'https://example.com/election'}),false);
assert.equal(app.validateHistoricalEntry({...base,office:'vereador',round:2}),false);
assert.equal(app.validateHistoricalEntry({...base,candidate:''}),false);

assert.ok(html.includes('id="municipal2028App"'));
assert.ok(html.includes('id="municipalityPicker"'));
assert.ok(html.includes('id="municipal2028View"'));
assert.ok(html.includes('<script src="data.js"></script>'));
assert.ok(html.includes('<script src="app.js"></script>'));
assert.ok(css.includes('@media(max-width:560px)'));
assert.ok(!html.includes('candidato vencedor 2028'));
console.log('OK: municipal 2028, datas, IBGE, navegação, fontes, ausência de votos fictícios.');

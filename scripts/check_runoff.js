#!/usr/bin/env node
/* Contratos do adaptador EA20 oficial para o 2º turno presidencial de 2026. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{},document:{querySelector:()=>null}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('apuracao-2t.js','utf8'),sandbox);
const api=sandbox.window.Runoff2026;
assert.ok(api&&api.render&&api.parseOfficial&&api.sourceUrl);
assert.equal(api.sourceUrl('br'),'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json');
assert.equal(api.sourceUrl('mg'),'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/mg/mg-c0001-e006258-u.json');
assert.equal(api.sourceUrl('zz'),'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-c0001-e006258-u.json');
assert.throws(()=>api.sourceUrl('invalid'));
const fixture={
 ele:'6258',t:'2',cdabr:'br',dg:'15/10/2026',hg:'09:38:12',idg:'3535426',tf:'n',and:'n',
 s:{ts:'499248',st:'0',pst:'0,00'},
 v:{tv:'0',vv:'0',vb:'0',vn:'0'},
 carg:[{cd:'1',agr:[
  {par:[{sg:'PL',cand:[{n:'22',nmu:'FLAVIO BOLSONARO',vap:'0',pvap:'0,00',st:''}]}]},
  {par:[{sg:'PT',cand:[{n:'13',nmu:'LULA',vap:'0',pvap:'0,00',st:''}]}]}
 ]}]
};
const pre=api.parseOfficial(fixture);
assert.equal(pre.sectionsDone,0);
assert.equal(pre.sectionsTotal,499248);
assert.equal(pre.candidates.length,2);
assert.equal(pre.total,0);
assert.equal(pre.uf,'br');
assert.equal(pre.final,false);
const copy=JSON.parse(JSON.stringify(fixture));
copy.dg='25/10/2026';copy.hg='17:30:00';copy.s.st='24255';copy.s.pst='4,86';
copy.v.tv='6.800.000';copy.v.vv='6.300.000';copy.v.vb='200.000';copy.v.vn='300.000';
copy.carg[0].agr[0].par[0].cand[0].vap='3.450.000';
copy.carg[0].agr[0].par[0].cand[0].pvap='54,76';
copy.carg[0].agr[1].par[0].cand[0].vap='2.850.000';
copy.carg[0].agr[1].par[0].cand[0].pvap='45,24';
const live=api.parseOfficial(copy);
assert.equal(live.sectionsShare,4.86);
assert.equal(live.candidates[0].number,'22');
assert.equal(live.candidates[0].votes,3450000);
assert.equal(live.candidates[0].share,54.76);
assert.equal(live.candidates[1].votes,2850000);
assert.equal(live.valid,6300000);
assert.equal(live.total,6800000);
copy.ele='6257';assert.throws(()=>api.parseOfficial(copy));
copy.ele='6258';copy.t='1';assert.throws(()=>api.parseOfficial(copy));
copy.t='2';copy.carg=[];assert.throws(()=>api.parseOfficial(copy));
console.log('OK: EA20 2º turno 6258, zero votos, parcial, totais, UF e rejeição de eleição incorreta.');

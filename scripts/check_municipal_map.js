#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},document:{},setInterval,clearInterval};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('runoff-municipal-2026.js','utf8'),ctx);
const api=ctx.window.RunoffMunicipal2026;
assert.equal(typeof api.mount,'function');
const fixture={abr:[{cdabr:'mg',mu:[{cd:'41238',cdi:'3106200',nm:'Belo Horizonte'},{cd:'9999',cdi:'3100000',nm:'Teste'}]},{cdabr:'sp',mu:[{cd:'71072',cdi:'3550308',nm:'São Paulo'}]}]};
const mg=api.indexMunicipalities(fixture,'MG');
assert.equal(mg.get('3106200'),'41238');
assert.equal(mg.get('3100000'),'09999');
assert.equal(mg.has('3550308'),false);
assert.equal(api.municipalUrl('mg','41238'),'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/mg/mg41238-c0001-e006258-u.json');
assert.throws(()=>api.municipalUrl('mg','3106200'));
assert.throws(()=>api.municipalUrl('mg','abcde'));
console.log('OK: mapa municipal, EA12, UF, zeros à esquerda e URL de resultados.');

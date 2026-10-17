#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('competitividade-data.js','utf8'), sandbox);
const d = sandbox.window.IMD_WCR_2026;

assert.ok(d, 'Base IMD inexistente');
assert.strictEqual(d.ano, 2026);
assert.strictEqual(d.publicacao, '2026-06-18');
assert.strictEqual(d.economias.length, 70, 'São esperadas exatamente 70 economias');
assert.deepStrictEqual([...new Set(d.economias.map(x=>x.posicao))], Array.from({length:70},(_,i)=>i+1));
assert.strictEqual(new Set(d.economias.map(x=>x.nome)).size,70,'Nome de economia repetido');
assert.ok(d.economias.every((x,i)=>x.indice>0&&x.indice<=100&&(!i||d.economias[i-1].indice>=x.indice)),'Pontuações fora de ordem');
assert.strictEqual(d.economias[0].nome, 'Singapura');
assert.strictEqual(d.economias[1].nome, 'Hong Kong (RAE)');
assert.strictEqual(d.economias[2].nome, 'Suíça');
const b = d.economias.find(x=>x.nome==='Brasil');
assert.strictEqual(b.posicao,65);
assert.strictEqual(b.indice,40.15);
assert.strictEqual(b.regiao,'americas');
assert.strictEqual(d.brasil2025Posicao,58);
const regionCount = code => d.economias.filter(x=>x.regiao===code).length;
assert.strictEqual(regionCount('americas'),10);
assert.strictEqual(regionCount('asia_pacifico'),15);
assert.strictEqual(regionCount('emea'),45);
assert.strictEqual(d.economias.filter(x=>x.regiao==='americas').findIndex(x=>x.nome==='Brasil')+1,9);
assert.ok(d.fontes.ranking.startsWith('https://www.imd.org/'));
const ui = fs.readFileSync('competitividade-ui.js','utf8');
assert.ok(ui.includes('window.Competitiveness2026'));
assert.ok(ui.includes('function drawRows()'));
assert.ok(ui.includes("getElementById") === false || ui.includes('Competitiveness2026'));
console.log('OK: IMD 2026 — 70 economias, 3 regiões, Brasil 65º/70 (40,15), UI e fontes.');

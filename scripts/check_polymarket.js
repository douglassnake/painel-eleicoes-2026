#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert').strict;
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('polymarket-election.js','utf8'),sandbox);
const poly=sandbox.window.PolymarketElection;
assert.ok(poly&&poly.mount&&poly.extract&&poly.api);
assert.equal(poly.api,'https://gamma-api.polymarket.com/events/slug/brazil-presidential-election');
const fixture={slug:'brazil-presidential-election',closed:false,markets:[
 {groupItemTitle:'Flávio Bolsonaro',question:'Will Flávio Bolsonaro win the 2026 Brazilian presidential election?',
 outcomes:'["Yes","No"]',outcomePrices:'["0.80","0.20"]',closed:false},
 {groupItemTitle:'Luiz Inácio Lula da Silva',question:'Will Luiz Inácio Lula da Silva win the 2026 Brazilian presidential election?',
 outcomes:['Yes','No'],outcomePrices:['0.19','0.81'],closed:false},
 {groupItemTitle:'Renan Santos',outcomes:'["Yes","No"]',outcomePrices:'["0.01","0.99"]'}
]};
const d=poly.extract(fixture);
assert.equal(d.entries.length,2);
assert.deepEqual(d.entries.map(x=>[x.id,x.price]),[['flavio',.8],['lula',.19]]);
assert.equal(d.slug,'brazil-presidential-election');
const noLula=JSON.parse(JSON.stringify(fixture));noLula.markets=noLula.markets.filter(x=>!x.groupItemTitle.includes('Luiz'));
assert.throws(()=>poly.extract(noLula));
const wrong=JSON.parse(JSON.stringify(fixture));wrong.slug='random-event';
assert.throws(()=>poly.extract(wrong));
const closed=JSON.parse(JSON.stringify(fixture));closed.closed=true;
assert.throws(()=>poly.extract(closed));
const invalid=JSON.parse(JSON.stringify(fixture));
invalid.markets[0].outcomePrices='["1.2","-0.2"]';
assert.throws(()=>poly.extract(invalid));
const ui=fs.readFileSync('polymarket-election.js','utf8');
assert.ok(ui.includes('cache:')&&ui.includes("cache:'no-store'"));
assert.ok(ui.includes("fetch(API"));
assert.ok(ui.includes("Sem cotação verificada nesta consulta"));
assert.ok(!ui.includes('api-key')&&!ui.includes('buyOrder'));
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('src="polymarket-election.js"'));
assert.ok(html.includes('href="polymarket-election.css"'));
assert.ok(html.indexOf('src="polymarket-election.js"')<html.indexOf('src="presidential-poll.js"'));
const poll=fs.readFileSync('presidential-poll.js','utf8');
assert.ok(poll.includes('polymarket-president-spotlight'));
assert.ok(poll.includes('polymarket-president-detail'));
console.log('OK: Polymarket Gamma read-only, preços Yes verificados, contratos corretos e falha segura.');

#!/usr/bin/env node
'use strict';
// Audit saved official TSE extracts independently of the importer.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..','municipais-2028','historico');
const years=[2004,2008,2012,2016,2020,2024];
const cityIds=['3128600','3171006','3147006'];
const seats={
  '3128600':[9,9,9,9,9,9],
  '3171006':[9,9,11,11,11,11],
  '3147006':[10,10,17,17,17,17]
};
const elected=s=>{
  const val=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  return val.startsWith('ELEITO')||val==='MEDIA';
};
let total=0,officialMayorWins=0,officialCouncilWinners=0;
for(const [idx,year] of years.entries()){
  const file=JSON.parse(fs.readFileSync(path.join(root,'candidates-'+year+'.json'),'utf8'));
  assert.equal(file.year,year);
  assert.equal(file.schemaVersion,1);
  for(const kind of ['consulta_cand','votacao_candidato_munzona']){
    const p=file.provenance[kind];
    assert.ok(p.url.startsWith('https://cdn.tse.jus.br/estatistica/sead/odsele/'));
    assert.match(p.sha256,/^[a-f0-9]{64}$/);
    assert.ok(p.bytes>1000);
  }
  assert.deepEqual(file.municipalities.map(x=>x.ibge).sort(),[...cityIds].sort());
  for(const city of file.municipalities){
    const mayor=city.candidates.filter(c=>c.office==='prefeito'&&elected(c.status));
    const council=city.candidates.filter(c=>c.office==='vereador'&&elected(c.status));
    assert.equal(mayor.length,1,city.name+' '+year+' requires one official elected mayor');
    assert.equal(council.length,seats[city.ibge][idx],city.name+' '+year+' mismatched official council seat allocation');
    assert.ok(city.audit.eligibleForSummary);
    assert.ok(city.candidates.length>10);
    assert.equal(city.audit.electedCouncil,council.length);
    assert.ok(mayor[0].votes>0);
    for(const c of city.candidates){
      assert.ok(['prefeito','vereador'].includes(c.office));
      assert.equal(c.municipalityIbge,city.ibge);
      assert.equal(c.year,year);
      assert.ok(!Object.keys(c).some(k=>/CPF|EMAIL|NASCIMENTO|TITULO_ELEITOR|BIRTH_DATE|PHONE/i.test(k)),
        'Never publish sensitive contact/identity fields');
      if(c.votes!=null){
        assert.ok(Number.isSafeInteger(c.votes)&&c.votes>=0);
        assert.ok(c.votesNominal>=c.votes);
        assert.equal(c.votesNotCountedValid,c.votesNominal-c.votes);
      }
    }
    total+=city.candidates.length;
    officialMayorWins++;
    officialCouncilWinners+=council.length;
  }
}
const analysis=JSON.parse(fs.readFileSync(path.join(root,'analysis.json'),'utf8'));
assert.deepEqual(Array.from(analysis.sourceYears),years);
assert.equal(analysis.municipalities.length,3);
for(const city of analysis.municipalities){
  assert.equal(city.cycles.length,6);
  for(const [idx,year] of years.entries()){
    assert.equal(city.cycles[idx].year,year);
    assert.equal(city.cycles[idx].councilElectedCount,seats[city.ibge][idx]);
  }
}
const vazante2024=JSON.parse(fs.readFileSync(path.join(root,'candidates-2024.json'),'utf8'))
  .municipalities.find(c=>c.name==='Vazante');
const benedito=vazante2024.candidates.find(c=>c.office==='prefeito'&&String(c.ballotName).includes('JOSÉ BENEDITO'));
assert.equal(benedito.votesNominal,1854);
assert.equal(benedito.votes,0);
assert.equal(benedito.votesNotCountedValid,1854);
const winner=vazante2024.candidates.find(c=>c.office==='prefeito'&&elected(c.status));
assert.equal(winner.votes,9487);
assert.equal(winner.ballotName,'GABRIEL ROSA');
console.log('DATASET_AUDIT_OK',JSON.stringify({
  electionCycles:years.length,municipalities:3,mayoralElections:officialMayorWins,
  councilElectedRecords:officialCouncilWinners,candidates:total,
  vazante2024ValidVotesMayor:vazante2024.audit.validVotesMayor,
  vazante2024MayorWinnerSharePct:Math.round(winner.votes*10000/vazante2024.audit.validVotesMayor)/100
}));

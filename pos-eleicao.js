(() => {
  'use strict';

  const TSE_BASE='https://resultados.tse.jus.br/oficial';
  const ELECTION_STATE='6259';
  const pad=(v,n)=>String(v).padStart(n,'0');
  const resultUrl=(cargo)=>`${TSE_BASE}/ele2026/${ELECTION_STATE}/dados/mg/mg-c${pad(cargo,4)}-e${pad(ELECTION_STATE,6)}-u.json`;
  const fmtInt=n=>new Intl.NumberFormat('pt-BR').format(Math.round(Number(n||0)));
  const fmtPct=(n,d=1)=>`${Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})}%`;
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const onlyDigits=v=>parseInt(String(v??'').replace(/\D/g,''),10)||0;
  const dec=v=>{const s=String(v??'').trim(); if(!s)return 0; const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s); return Number.isFinite(n)?n:0;};
  const active=()=>document.querySelector('.tab.active')?.dataset.view==='pos-eleicao';
  const view=()=>document.querySelector('#view');

  function normalize(json){
    const cargo=json?.carg?.[0]||{}; const rows=[];
    for(const agr of cargo.agr||[]) for(const par of agr.par||[]) for(const c of par.cand||[]){
      rows.push({numero:String(c.n||''),nome:c.nmu||c.nm||'',partido:par.sg||'',votos:onlyDigits(c.vap),pct:dec(c.pvap),situacao:c.st||'',eleitoFlag:String(c.e||'').toLowerCase()});
    }
    return {rows,geradoEm:[json?.dg,json?.hg].filter(Boolean).join(' '),final:String(json?.tf||'').toLowerCase()==='s'};
  }

  const isElected=r=>{const s=String(r?.situacao||'').toLowerCase(); return r?.eleitoFlag==='s'||(s.includes('eleit')&&!s.includes('não eleito')&&!s.includes('nao eleito'));};
  const probClass=p=>p>=70?'high':p>=35?'mid':'low';
  const resultLabel=r=>r?.situacao|| (isElected(r)?'Eleito':'Não eleito');

  async function fetchJson(url){const r=await fetch(`${url}?t=${Date.now()}`,{cache:'no-store'}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json();}

  function bandRows(rows){
    const defs=[['≥ 70%',p=>p>=70],['50–69,9%',p=>p>=50&&p<70],['30–49,9%',p=>p>=30&&p<50],['< 30%',p=>p<30]];
    return defs.map(([label,test])=>{const a=rows.filter(x=>test(x.prob)); const elected=a.filter(x=>x.elected).length; return {label,n:a.length,elected,rate:a.length?100*elected/a.length:0};});
  }

  function render(rows,generatedAt){
    const n=rows.length, elected=rows.filter(x=>x.elected).length, expected=rows.reduce((s,x)=>s+x.prob/100,0);
    const cutoff=rows.filter(x=>(x.prob>=50)===x.elected).length;
    const brier=rows.reduce((s,x)=>s+Math.pow(x.prob/100-(x.elected?1:0),2),0)/Math.max(1,n);
    const voteRows=rows.filter(x=>x.actualVotes>0&&x.projectedVotes>0);
    const maeVotes=voteRows.reduce((s,x)=>s+Math.abs(x.actualVotes-x.projectedVotes),0)/Math.max(1,voteRows.length);
    const bands=bandRows(rows);
    const highMiss=rows.filter(x=>x.prob>=70&&!x.elected).sort((a,b)=>b.prob-a.prob);
    const lowHit=rows.filter(x=>x.prob<50&&x.elected).sort((a,b)=>a.prob-b.prob);
    const closest=[...voteRows].sort((a,b)=>Math.abs(a.voteErrPct)-Math.abs(b.voteErrPct))[0];
    const largest=[...voteRows].sort((a,b)=>Math.abs(b.voteErrPct)-Math.abs(a.voteErrPct))[0];

    view().innerHTML=`
      <div class="section-title"><div><h2>Pós-eleição — auditoria do modelo</h2><p>Comparação entre o snapshot pré-eleição do Monte Carlo v3 e a votação oficial de 2026 em Minas Gerais.</p></div><span class="model-pill">${n} candidatos monitorados</span></div>
      <div class="audit-kpis">
        <div class="audit-kpi"><span>Eleitos observados</span><strong>${elected}</strong><small>de ${n} candidatos monitorados</small></div>
        <div class="audit-kpi"><span>Eleitos esperados pelo modelo</span><strong>${expected.toFixed(2).replace('.',',')}</strong><small>soma das probabilidades individuais</small></div>
        <div class="audit-kpi"><span>Coincidência no corte de 50%</span><strong>${cutoff}/${n}</strong><small>${fmtPct(100*cutoff/n,1)} de correspondência binária</small></div>
        <div class="audit-kpi"><span>Brier Score</span><strong>${brier.toFixed(3).replace('.',',')}</strong><small>quanto menor, melhor a calibração probabilística</small></div>
      </div>
      <div class="audit-grid">
        <article class="audit-card"><h3>Calibração por faixa</h3><p>Frequência observada de eleição dentro de cada faixa de probabilidade do snapshot.</p><div class="audit-bands">${bands.map(b=>`<div class="audit-band"><div class="audit-band-label">${b.label}</div><div class="audit-band-track"><i style="width:${b.rate}%"></i></div><div class="audit-band-value">${b.elected}/${b.n} • ${fmtPct(b.rate,1)}</div></div>`).join('')}</div></article>
        <article class="audit-card"><h3>Leituras principais</h3><p>Casos que ajudam a identificar onde o modelo funcionou e onde precisa evoluir.</p><div class="audit-insights">
          <div class="audit-insight"><strong>Estimativa agregada</strong><span>O modelo somava ${expected.toFixed(2).replace('.',',')} mandatos esperados; o resultado observado foi ${elected}.</span></div>
          <div class="audit-insight"><strong>Alta probabilidade sem eleição</strong><span>${highMiss.length?highMiss.map(x=>`${safe(x.nome)} (${fmtPct(x.prob,1)})`).join(', '):'Nenhum caso.'}</span></div>
          <div class="audit-insight"><strong>Eleição abaixo de 50%</strong><span>${lowHit.length?lowHit.map(x=>`${safe(x.nome)} (${fmtPct(x.prob,1)})`).join(', '):'Nenhum caso.'}</span></div>
          <div class="audit-insight"><strong>Estimativa de votos mais próxima</strong><span>${closest?`${safe(closest.nome)}: ${fmtInt(closest.projectedVotes)} previstos × ${fmtInt(closest.actualVotes)} obtidos (${fmtPct(Math.abs(closest.voteErrPct),1)} de erro absoluto).`:'Sem dados suficientes.'}</span></div>
          <div class="audit-insight"><strong>Maior desvio de votos</strong><span>${largest?`${safe(largest.nome)}: ${fmtInt(largest.projectedVotes)} previstos × ${fmtInt(largest.actualVotes)} obtidos (${fmtPct(Math.abs(largest.voteErrPct),1)} de erro absoluto).`:'Sem dados suficientes.'}</span></div>
          <div class="audit-insight"><strong>Erro absoluto médio de votos</strong><span>${fmtInt(maeVotes)} votos entre os casos com votação oficial disponível.</span></div>
        </div></article>
      </div>
      <div class="section-subtitle"><h3>Candidato a candidato</h3><p>Probabilidade, média de votos usada pelo modelo e resultado oficial observado.</p></div>
      <div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Candidato</th><th>Prob.</th><th>ITR</th><th>Votos previstos</th><th>Votos 2026</th><th>Erro</th><th>Erro %</th><th>Resultado oficial</th></tr></thead><tbody>${rows.map(x=>`<tr><td><div class="audit-person"><strong>${safe(x.nome)}</strong><small>${safe(x.cargo)} • ${safe(x.partido)} • ${safe(x.numero)}</small></div></td><td><span class="audit-prob ${probClass(x.prob)}">${fmtPct(x.prob,1)}</span></td><td>${x.itr==null?'—':x.itr.toFixed(2).replace('.',',')}</td><td>${fmtInt(x.projectedVotes)}</td><td>${fmtInt(x.actualVotes)}</td><td class="${x.voteError>=0?'audit-error-pos':'audit-error-neg'}">${x.voteError>=0?'+':''}${fmtInt(x.voteError)}</td><td>${Number.isFinite(x.voteErrPct)?`${x.voteErrPct>=0?'+':''}${fmtPct(x.voteErrPct,1)}`:'—'}</td><td><span class="audit-result ${x.elected?'yes':'no'}">${safe(resultLabel(x.official))}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="audit-note"><strong>Como interpretar:</strong> esta é uma auditoria retrospectiva do snapshot pré-eleição. O Monte Carlo v3 é um modelo simplificado por limiar e não reproduz integralmente quociente eleitoral, cadeiras de partido/federação, sobras e posição interna na lista. Por isso, uma estimativa de votos próxima pode coexistir com erro na condição final de eleito ou não eleito. Arquivo TSE usado nesta leitura: ${safe(generatedAt||'—')}.</div>`;
  }

  async function openAudit(){
    if(!active())return;
    view().innerHTML='<div class="audit-loading"><div><div class="audit-spinner"></div><p>Comparando o modelo com os resultados oficiais do TSE…</p></div></div>';
    try{
      const [model,fedJson,stateJson]=await Promise.all([fetchJson('model-results.json'),fetchJson(resultUrl(6)),fetchJson(resultUrl(7))]);
      if(!active())return;
      const fed=normalize(fedJson), est=normalize(stateJson); const byCargo={6:new Map(fed.rows.map(r=>[String(r.numero),r])),7:new Map(est.rows.map(r=>[String(r.numero),r]))};
      const rows=(model.results||[]).map(m=>{const code=/Federal/i.test(m.cargo)?6:7; const official=byCargo[code].get(String(m.numero)); const projected=Math.round(Number(m.muAjustadoMil||0)*1000); const actual=official?.votos||0; const err=actual-projected; return {...m,prob:Number(m.probV3??m.probV2??0),projectedVotes:projected,actualVotes:actual,voteError:err,voteErrPct:projected?100*err/projected:NaN,elected:isElected(official),official};}).sort((a,b)=>b.prob-a.prob);
      render(rows,[fed.geradoEm,est.geradoEm].filter(Boolean).sort().slice(-1)[0]);
    }catch(err){
      console.error(err); if(!active())return; view().innerHTML=`<div class="audit-error"><div><h3>Não foi possível concluir a auditoria</h3><p>${safe(err.message||err)}</p><p>O cálculo depende do snapshot local do modelo e dos arquivos oficiais de resultados do TSE.</p></div></div>`;
    }
  }

  document.querySelectorAll('.tab[data-view="pos-eleicao"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(openAudit,0)));
})();

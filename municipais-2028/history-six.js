/* Six official TSE cycles: accessible candidate history and descriptive outcomes. */
(() => {
  'use strict';
  const YEARS=[2024,2020,2016,2012,2008,2004];
  const cache=new Map();
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmt=n=>n==null?'—':Number(n).toLocaleString('pt-BR');
  const percent=n=>n==null?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const label=r=>r.ballotName||r.fullName||('Candidatura '+r.ballotNumber);
  const elected=r=>{const s=String(r.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();return s.startsWith('ELEITO')||s==='MEDIA';};
  const load=async file=>{
    if(!cache.has(file)){
      cache.set(file,fetch('./historico/'+file,{cache:'no-store'}).then(r=>{
        if(!r.ok)throw Error('HTTP '+r.status);
        return r.json();
      }).catch(e=>{cache.delete(file);throw e;}));
    }
    return cache.get(file);
  };
  const overview=(city)=>{
    if(!city)return '<p role="status">Sem análise histórica validada.</p>';
    const p=city.historicalPatterns;
    return '<div class="historic-highlights">'+
      '<article><span>VITÓRIAS CONSECUTIVAS / MESMO NOME COMPLETO</span><strong>'+fmt(p.consecutiveMayorWinnerSameFullName)+'</strong><small>Em cinco transições eleitorais; correspondência nominal não certifica identidade.</small></article>'+
      '<article><span>VITÓRIAS CONSECUTIVAS / MESMO PARTIDO</span><strong>'+fmt(p.consecutiveMayorWinnerSameParty)+'</strong><small>Comparação literal da sigla; fusões e incorporações não são deduzidas.</small></article>'+
      '<article><span>VEREADOR: NÃO ELEITOS COM MAIS VOTOS</span><strong>'+fmt(p.councilNonElectedOutpolledElectedCycles)+'/6</strong><small>Eleições em que ao menos um não eleito superou em votos um eleito.</small></article>'+
      '</div>'+
      '<div class="table-scroller"><table><thead><tr><th>Eleição</th><th>Prefeito eleito</th><th>Partido</th><th>Votos</th><th>% dos válidos nominais</th><th>Vereadores eleitos</th></tr></thead><tbody>'+
      city.cycles.slice().reverse().map(c=>'<tr><td>'+c.year+'</td><td>'+esc(c.mayor.ballotName)+'</td><td>'+esc(c.mayor.party)+'</td><td>'+fmt(c.mayor.votes)+'</td><td>'+percent(c.mayor.shareValidPct)+'</td><td>'+fmt(c.councilElectedCount)+'</td></tr>').join('')+
      '</tbody></table></div>'+
      '<p class="footnote">Proporções históricas descrevem eleições passadas; não são previsões para 2028. Quando os números são obtidos, as situações de eleição vêm dos arquivos do TSE, e não do ranking nominal.</p>';
  };
  const table=(records,office,search,onlyElected)=>{
    const q=String(search||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const list=records.filter(c=>(office==='todos'||c.office===office) &&
      (!onlyElected||elected(c)) &&
      (!q||(String(c.fullName||'')+' '+String(c.ballotName||'')+' '+String(c.party||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(q)));
    return !list.length?'<p class="footnote">Nenhum registro corresponde aos filtros selecionados.</p>':
      '<p class="footnote">'+fmt(list.length)+' candidaturas exibidas. Votos agrupados por candidatura e município, somando as zonas eleitorais.</p>'+
      '<div class="table-scroller"><table><thead><tr><th>Candidatura</th><th>Cargo</th><th>Partido</th><th>Votos válidos nominais</th><th>Situação oficial</th><th>Perfil e zonas</th></tr></thead><tbody>'+
      list.map(c=>'<tr><td><strong>'+esc(label(c))+'</strong><small class="candidate-full-name">'+esc(c.fullName)+' · nº '+esc(c.ballotNumber)+'</small></td>'+
        '<td>'+esc(c.office)+'</td><td>'+esc(c.party)+'</td><td>'+fmt(c.votes)+'</td>'+
        '<td><span class="'+(elected(c)?'elected-flag':'')+'">'+esc(c.status||'Não informado')+'</span></td>'+
        '<td><details><summary>Detalhes</summary><dl class="candidate-details">'+
        [['Nome completo',c.fullName],['Identificador TSE',c.tseCandidateId],['Federação',c.federation],['Coligação',c.coalition],['Composição da coligação',c.coalitionParties],['Gênero declarado',c.gender],['Escolaridade',c.education],['Ocupação',c.occupation],['Idade na posse',c.ageAtTakingOffice],['Situação da candidatura',c.registrationStatus],['Votos nominais totais',c.votesNominal],['Votos não contados como válidos',c.votesNotCountedValid],['Destinação de votos',Array.isArray(c.voteDestinations)?c.voteDestinations.join(', '):null]].filter(x=>x[1]!=null).map(([a,b])=>'<dt>'+esc(a)+'</dt><dd>'+esc(b)+'</dd>').join('')+
        '<dt>Votos por zona eleitoral</dt><dd>'+esc((c.zones||[]).map(z=>'Zona '+z.zone+': '+fmt(z.votes)).join(' · ')||'Indisponível')+'</dd></dl></details></td></tr>'
      ).join('')+'</tbody></table></div>';
  };
  async function mount(host,ibge){
    if(!host)return;
    host.innerHTML='<p role="status">Carregando a série oficial do TSE (2004–2024)…</p>';
    try{
      const analysis=await load('analysis.json');
      if(!host.isConnected)return;
      const cityAnalysis=analysis.municipalities.find(c=>c.ibge===ibge);
      if(!cityAnalysis)throw Error('Município não incluído na análise validada');
      host.innerHTML=overview(cityAnalysis)+
        '<section class="history-explorer"><h3>Todas as candidaturas</h3><p class="footnote">Selecione o ano e cargo. A base preserva também os candidatos não eleitos e suplentes.</p>'+
        '<div class="history-controls"><label>Ano<select id="historyYear">'+YEARS.map(y=>'<option>'+y+'</option>').join('')+'</select></label>'+
        '<label>Cargo<select id="historyOffice"><option value="todos">Todos</option><option value="prefeito">Prefeito</option><option value="vereador">Vereador</option></select></label>'+
        '<label>Buscar candidatura<input type="search" id="historySearch" placeholder="Nome ou partido"></label>'+
        '<label class="checkbox-label"><input id="historyElectedOnly" type="checkbox"> Apenas eleitos</label></div>'+
        '<div id="historicalCandidates" aria-live="polite"></div></section>';
      const year=host.querySelector('#historyYear'),office=host.querySelector('#historyOffice'),
        search=host.querySelector('#historySearch'),only=host.querySelector('#historyElectedOnly'),rows=host.querySelector('#historicalCandidates');
      let selection=0;
      const refresh=async()=>{
        const seq=++selection,chosen=Number(year.value);
        rows.textContent='Lendo candidatos e votos oficiais de '+chosen+'…';
        try{
          const raw=await load('candidates-'+chosen+'.json');
          if(!host.isConnected||seq!==selection)return;
          const city=raw.municipalities.find(c=>c.ibge===ibge);
          if(!city||!city.audit?.eligibleForSummary)throw Error('Dados não homologados para esta cidade');
          rows.innerHTML=table(city.candidates,office.value,search.value,only.checked)+
            '<p class="footnote">Fonte: <a href="'+esc(raw.provenance.consulta_cand.url)+'" rel="noopener noreferrer" target="_blank">Candidaturas TSE</a> · '+
            '<a href="'+esc(raw.provenance.votacao_candidato_munzona.url)+'" rel="noopener noreferrer" target="_blank">Votação nominal TSE</a>. Arquivos oficiais com SHA-256 registrado. Eleições ordinárias, primeiro turno.</p>';
        }catch(e){
          if(seq===selection&&host.isConnected)rows.textContent='Não foi possível validar o arquivo de '+chosen+': '+e.message;
        }
      };
      year.addEventListener('change',refresh);
      office.addEventListener('change',refresh);
      search.addEventListener('input',refresh);
      only.addEventListener('change',refresh);
      await refresh();
    }catch(e){
      if(host.isConnected)host.textContent='A série histórica oficial ainda está em preparação ou indisponível. Nenhum dado foi estimado. '+e.message;
    }
  }
  window.MunicipalHistorySix=Object.freeze({mount,overview,table,elected});
})();
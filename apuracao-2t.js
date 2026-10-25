/* Apuração presidencial 2026 • segundo turno • exclusivamente EA20 TSE.
 * Fonte direta: resultados.tse.jus.br/oficial/ele2026/6258.
 * As pesquisas de opinião não são utilizadas no cálculo nem na exibição.
 */
(() => {
  'use strict';
  const BASE='https://resultados.tse.jus.br/oficial/ele2026/6258/dados';
  const PORTAL='https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados';
  const ELECTION_DATE='2026-10-25';
  const STATES={
    br:'Brasil',ac:'Acre',al:'Alagoas',ap:'Amapá',am:'Amazonas',
    ba:'Bahia',ce:'Ceará',df:'Distrito Federal',es:'Espírito Santo',
    go:'Goiás',ma:'Maranhão',mt:'Mato Grosso',ms:'Mato Grosso do Sul',
    mg:'Minas Gerais',pa:'Pará',pb:'Paraíba',pr:'Paraná',pe:'Pernambuco',
    pi:'Piauí',rj:'Rio de Janeiro',rn:'Rio Grande do Norte',rs:'Rio Grande do Sul',
    ro:'Rondônia',rr:'Roraima',sc:'Santa Catarina',sp:'São Paulo',se:'Sergipe',to:'Tocantins'
  };
  const fmt=new Intl.NumberFormat('pt-BR');
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=x=>{
    const s=String(x??'').trim();
    if(!s)return 0;
    const normalized=s.includes(',') ? s.replace(/\./g,'').replace(',','.') : /^\d{1,3}(?:\.\d{3})+$/.test(s) ? s.replace(/\./g,'') : s;
    const value=Number(normalized);
    return Number.isFinite(value)?value:0;
  };
  const pct=n=>num(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const active=()=>document.querySelector('.tab.active')?.dataset.view==='apuracao-2t';
  const sourceUrl=uf=>{
    if(!Object.prototype.hasOwnProperty.call(STATES,uf))throw Error('UF não reconhecida');
    return BASE+'/'+uf+'/'+uf+'-c0001-e006258-u.json';
  };
  const parts=()=>new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
  const electionStarted=()=>{
    const p=parts(),day=p.year+'-'+p.month+'-'+p.day;
    return day>ELECTION_DATE || (day===ELECTION_DATE && Number(p.hour)>=17);
  };
  const clock=()=>new Date().toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',second:'2-digit'
  });
  function parseOfficial(j){
    if(!j || String(j.ele)!=='6258' || String(j.t)!=='2')throw Error('O arquivo recebido não é o segundo turno presidencial de 2026.');
    const cargo=(j.carg||[]).find(c=>String(c.cd)==='1');
    if(!cargo||!j.s||!j.v)throw Error('O arquivo não contém os campos presidenciais do TSE esperados.');
    const candidates=[];
    for(const agr of cargo.agr||[])for(const partido of agr.par||[])for(const c of partido.cand||[]){
      candidates.push({name:String(c.nmu||c.nm||'Candidatura'),number:String(c.n||''),party:String(partido.sg||''),
        votes:num(c.vap),share:num(c.pvap),status:String(c.st||''),elected:String(c.e||'').toLowerCase()==='s'});
    }
    candidates.sort((a,b)=>b.votes-a.votes||Number(a.number)-Number(b.number));
    return {
      uf:String(j.cdabr||'').toLowerCase(),candidates,
      sectionsTotal:num(j.s.ts),sectionsDone:num(j.s.st),sectionsShare:num(j.s.pst),
      valid:num(j.v.vv),blank:num(j.v.vb),nullVotes:num(j.v.vn),total:num(j.v.tv),
      generated:[j.dg,j.hg].filter(Boolean).join(' às '),idg:String(j.idg||''),
      final:String(j.tf||'').toLowerCase()==='s'||String(j.and||'').toLowerCase()==='f'
    };
  }
  let uf='br',timer=null,controller=null,token=0,failed=false;
  function shell(){
    const options=Object.entries(STATES).map(pair=>'<option value="'+pair[0]+'">'+safe(pair[1])+'</option>').join('');
    return '<div class="section-title runoff-title"><div><span class="runoff-eyebrow">25 OUT 2026 • 2º TURNO</span>'+
      '<h2>Apuração do segundo turno</h2><p>Presidência da República: dados oficiais recebidos diretamente do TSE. Sem sondagens, simulações ou estimativas.</p></div>'+
      '<a class="runoff-portal" href="'+PORTAL+'" target="_blank" rel="noopener noreferrer">Portal oficial TSE ↗</a></div>'+
      '<section class="card runoff-panel" aria-label="Apuração presidencial oficial do segundo turno">'+
        '<div class="runoff-toolbar"><div class="runoff-source"><span class="runoff-source-indicator"></span><div>'+
          '<strong>Fonte principal: arquivo JSON do TSE</strong><small>EA20 · Eleição 6258 · Cargo presidente 0001</small>'+
        '</div></div><div class="runoff-toolbar-actions"><label for="runoffUf">Localidade<select id="runoffUf">'+options+
          '</select></label><button id="runoffReload" type="button">Atualizar agora</button></div></div>'+
        '<p id="runoffStatus" class="runoff-status" role="status" aria-live="polite">Preparando consulta oficial…</p>'+
        '<div id="runoffProgress"></div><div id="runoffResults"></div>'+
        '<div class="runoff-footer"><span id="runoffSource">Fonte: TSE • segundo turno</span><span id="runoffInterval">Atualização automática</span></div>'+
      '</section>'+
      '<div class="note runoff-note"><strong>Transparência:</strong> os dados desta seção são exclusivamente votos reais publicados pelo TSE, não pesquisas eleitorais. '+
      'A divulgação está prevista para 25/10/2026 a partir das 17h (Brasília). Em Minas Gerais, o governador foi eleito no 1º turno. '+
      '<a href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noopener noreferrer">Documentação técnica ↗</a></div>';
  }
  function photo(c){
    const initials=c.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('');
    return '<div class="candidate-photo photo-md" data-candidate-photo data-name="'+safe(c.name)+'" data-number="'+safe(c.number)+
      '" data-cargo="1" data-uf="BR" data-photo-alt="Retrato do candidato '+safe(c.name)+'"><span>'+safe(initials)+'</span></div>';
  }
  function candidate(c,hasVotes){
    const situation=hasVotes?(c.status||'Em totalização'):'Aguardando apuração';
    return '<article class="runoff-candidate '+window.PresidentialColors.classFor(c.name,c.number,1)+'"><div class="runoff-candidate-heading">'+photo(c)+
      '<div class="runoff-candidate-name"><strong>'+safe(c.name)+'</strong><small>'+safe(c.party)+' · '+safe(c.number)+'</small></div></div>'+
      '<div class="runoff-candidate-pct">'+(hasVotes?pct(c.share):'—')+'</div>'+
      '<div class="runoff-candidate-bar"><i style="width:'+(hasVotes?Math.max(0,Math.min(100,c.share)):0)+'%"></i></div>'+
      '<div class="runoff-candidate-foot"><strong>'+(hasVotes?fmt.format(c.votes):'—')+' votos</strong><span>'+safe(situation)+'</span></div></article>';
  }
  function paint(data){
    const waiting=!electionStarted(),hasVotes=data.sectionsDone>0&&data.total>0;
    const done=hasVotes&&data.final;
    const state=document.getElementById('runoffStatus');
    if(state){
      state.className='runoff-status '+(done?'is-final':hasVotes?'is-live':'is-waiting');
      state.textContent=(waiting?'Aguardando 25/10/2026':!hasVotes?'Aguardando os primeiros votos':done?'Totalização final':'Apuração oficial em andamento')+' • '+STATES[uf];
    }
    const n=hasVotes?data.sectionsShare:0;
    const bar=document.getElementById('runoffProgress');
    if(bar)bar.innerHTML='<div class="runoff-progress-heading"><span>Seções totalizadas</span><strong>'+pct(n)+'</strong></div>'+
      '<div class="runoff-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+n+'" aria-label="Seções totalizadas">'+
      '<i style="width:'+Math.max(0,Math.min(100,n))+'%"></i></div><p class="runoff-progress-description">'+
      (hasVotes?fmt.format(data.sectionsDone)+' de '+fmt.format(data.sectionsTotal)+' seções':'Nenhuma seção com votos divulgados')+'</p>';
    const holder=document.getElementById('runoffResults');
    if(holder){
      const cards=data.candidates.map(c=>candidate(c,hasVotes)).join('');
      holder.innerHTML='<div class="runoff-candidates">'+(cards||'<p>Lista de candidaturas ainda não fornecida no arquivo.</p>')+'</div>'+
        '<div class="runoff-metrics">'+
        [['Votos válidos',data.valid],['Brancos',data.blank],['Nulos',data.nullVotes],['Total de votos',data.total]]
          .map(v=>'<div><span>'+v[0]+'</span><strong>'+(hasVotes?fmt.format(v[1]):'—')+'</strong></div>').join('')+
        '</div>';
      window.CandidatePhotos?.hydrate(holder);
    }
    const source=document.getElementById('runoffSource');
    if(source)source.textContent='Arquivo TSE gerado em '+(data.generated||'—')+' · IDG '+(data.idg||'—')+' · consultado em '+clock();
  }
  function errorState(e){
    const state=document.getElementById('runoffStatus');
    if(state){state.className='runoff-status is-error';state.textContent='Consulta direta indisponível';}
    const area=document.getElementById('runoffResults');
    if(area)area.innerHTML='<div class="runoff-error"><p>'+safe(e.message||'Falha de acesso aos arquivos oficiais')+'</p>'+
      '<p>Nenhum resultado de pesquisa será utilizado como substituição. Consulte o portal oficial e tente novamente.</p>'+
      '<a href="'+PORTAL+'" target="_blank" rel="noopener noreferrer">Abrir resultados oficiais do TSE ↗</a></div>';
    const progress=document.getElementById('runoffProgress');
    if(progress)progress.innerHTML='';
    const source=document.getElementById('runoffSource');
    if(source)source.textContent='Consulta direta ao TSE não concluída • '+clock();
  }
  function schedule(){
    clearTimeout(timer);
    if(!active())return;
    const ms=failed?300000:electionStarted()?60000:600000;
    const label=document.getElementById('runoffInterval');
    if(label)label.textContent='Atualização a cada '+(ms/60000)+' min (enquanto aba aberta)';
    timer=setTimeout(()=>{if(active())load();},ms);
  }
  async function load(){
    if(!active())return;
    const current=++token;
    controller?.abort();
    controller=new AbortController();
    const ctrl=controller;
    const button=document.getElementById('runoffReload');
    if(button){button.disabled=true;button.textContent='Consultando…';}
    try{
      if(uf!=='br'&&!electionStarted()){
        const e=Error('A consulta por UF será habilitada em 25/10/2026 às 17h (Brasília) para evitar arquivos estaduais ainda não publicados.');
        e.premature=true;throw e;
      }
      const timeout=setTimeout(()=>ctrl.abort(),12000);
      let response;
      try{response=await fetch(sourceUrl(uf),{cache:'no-store',signal:ctrl.signal});}
      finally{clearTimeout(timeout);}
      if(!response.ok)throw Error('O TSE retornou HTTP '+response.status+' para '+STATES[uf]+'.');
      const parsed=parseOfficial(await response.json());
      if(parsed.uf!==uf)throw Error('O arquivo retornado não corresponde à localidade escolhida.');
      if(current!==token||!active())return;
      failed=false;paint(parsed);
    }catch(e){
      if(current!==token||!active())return;
      if(e.name==='AbortError')e=Error('Tempo limite para resposta do servidor oficial do TSE.');
      failed=!e.premature;errorState(e);
    }finally{
      if(current===token&&active()){
        const b=document.getElementById('runoffReload');
        if(b){b.disabled=false;b.textContent='Atualizar agora';}
        schedule();
      }
    }
  }
  function render(root){
    if(!root)return;
    clearTimeout(timer);controller?.abort();token++;
    uf='br';failed=false;root.innerHTML=shell();
    // O mapa deve ser visível mesmo quando o script auxiliar falha ou está em cache antigo.
    const mapHost=document.createElement('div');
    mapHost.id='runoffMapHost';
    mapHost.innerHTML='<section class="runoff-map-panel"><h3>Mapa interativo da apuração do segundo turno</h3><p id="runoffMapBootStatus" role="status">Carregando mapa do Brasil e dados oficiais do TSE…</p></section>';
    root.appendChild(mapHost);
    const startMap=()=>{
      if(!root.isConnected)return;
      if(window.RunoffMap2026?.render){
        mapHost.replaceChildren();
        Promise.resolve(window.RunoffMap2026.render(mapHost)).catch(err=>{
          mapHost.innerHTML='<section class="runoff-map-panel"><h3>Mapa do Brasil indisponível</h3><p>Falha ao carregar a geometria ou os dados. Atualize a página para tentar novamente.</p></section>';
          console.error('Mapa segundo turno:',err);
        });
      }else{
        mapHost.querySelector('#runoffMapBootStatus').textContent='Não foi possível carregar o módulo do mapa. Verifique a conexão e atualize a página.';
      }
    };
    if(window.RunoffMap2026?.render)startMap();
    else {
      const script=document.createElement('script');
      script.src='runoff-map-2026.js?v=20261025-12';
      script.onload=startMap;
      script.onerror=()=>{const el=mapHost.querySelector('#runoffMapBootStatus');if(el)el.textContent='Falha no download do módulo do mapa. Tente atualizar a página.';};
      document.head.appendChild(script);
    }
    root.querySelector('#runoffUf').addEventListener('change',e=>{uf=e.target.value;load();});
    root.querySelector('#runoffReload').addEventListener('click',()=>load());
    if(!electionStarted())root.querySelector('#runoffStatus').textContent='Aguardando apuração: 25/10/2026, 17h (Brasília)';
    load();
  }
  window.Runoff2026={render,parseOfficial,sourceUrl,electionStarted};
})();
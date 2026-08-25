(() => {
  const D=window.DASH_DATA;
  const view=document.querySelector('#view');
  if(!D||!view)return;

  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const fmt=n=>n==null?'—':Number(n).toLocaleString('pt-BR');
  const money=n=>n==null?'—':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const logNorm=(v,max)=>max>0?Math.log1p(Math.max(0,v))/Math.log1p(max):0;
  const cargoKey=x=>norm(x.cargo).includes('FEDERAL')?'Federal':'Estadual';
  const baseRegion=x=>norm(x.base).includes('NOROESTE')?'Noroeste de MG':norm(x.base).includes('ALTO PARANAIBA')?'Alto Paranaiba':null;
  const probClass=p=>p>=70?'good':p>=35?'warn':'bad';
  const pct=v=>Number.isFinite(v)?`${v.toFixed(1)}%`:'—';

  function historyFor(h,sq){return h?.byCandidate?.[String(sq)]||{};}
  function chooseHistory(hist){
    if(hist['2022'])return {year:2022,...hist['2022'],quality:'comparável'};
    if(hist['2024'])return {year:2024,...hist['2024'],quality:'local/alternativa'};
    return null;
  }

  function buildRows(o,h){
    const monitored=o?.candidates||{};
    const prelim=D.regional.map(c=>{
      const official=monitored[c.nome];
      const hist=official?chooseHistory(historyFor(h,official.sqCandidato)):null;
      const nr=hist?.regioes?.['Noroeste de MG']||{votos:0,percentual:0};
      const ap=hist?.regioes?.['Alto Paranaiba']||{votos:0,percentual:0};
      const regionalVotes=Number(nr.votos||0)+Number(ap.votos||0);
      const regionalShare=Number(nr.percentual||0)+Number(ap.percentual||0);
      return {...c,official,hist,nr,ap,regionalVotes,regionalShare};
    });
    const withHist=prelim.filter(x=>x.hist);
    const maxRegional=Math.max(1,...withHist.map(x=>x.regionalVotes));
    const maxMuni=Math.max(1,...withHist.map(x=>Number(x.hist?.municipiosComVotos||0)));
    return prelim.map(x=>{
      if(!x.hist)return {...x,score:null};
      const shareScore=clamp(x.regionalShare/100);
      const votesScore=logNorm(x.regionalVotes,maxRegional);
      const reachScore=logNorm(Number(x.hist.municipiosComVotos||0),maxMuni);
      const dispersionScore=clamp(1-Number(x.hist.concentracaoTop3||0)/100);
      // Índice territorial: presença relativa na região + volume regional + alcance + dispersão.
      const score=100*(0.45*shareScore+0.30*votesScore+0.15*reachScore+0.10*dispersionScore);
      return {...x,score};
    });
  }

  function renderRanking(rows){
    const ranked=rows.filter(x=>x.score!=null).sort((a,b)=>b.score-a.score);
    const max=Math.max(1,...ranked.map(x=>x.score));
    return `<section class="territorial-block"><div class="section-title territorial-title"><div><h2>Ranking territorial regional</h2><p>Índice histórico de presença eleitoral no Noroeste de Minas e Alto Paranaíba. Não é pesquisa nem previsão de voto.</p></div><span class="model-pill">ITR • 0–100</span></div>
      <div class="territorial-method"><strong>Composição do ITR:</strong> 45% participação dos votos nas duas regiões, 30% volume regional, 15% alcance municipal e 10% dispersão. Quando há histórico de 2022, ele é priorizado por ser mais comparável à disputa legislativa estadual/federal; 2024 é usado apenas na ausência de 2022.</div>
      <div class="territorial-ranking">${ranked.map((x,i)=>`<div class="territorial-row">
        <div class="territorial-pos">${i+1}</div>
        <div class="territorial-name"><strong>${safe(x.nome)}</strong><small>${safe(x.partido)} • ${safe(cargoKey(x))} • base ${safe(x.base)}</small></div>
        <div class="territorial-track"><i style="width:${(x.score/max)*100}%"></i></div>
        <div class="territorial-score">${x.score.toFixed(1)}</div>
        <div class="territorial-detail"><span>Noroeste <b>${fmt(x.nr.votos)}</b> (${pct(x.nr.percentual)})</span><span>Alto Paranaíba <b>${fmt(x.ap.votos)}</b> (${pct(x.ap.percentual)})</span><span>${x.hist.year} • ${fmt(x.hist.municipiosComVotos)} municípios</span></div>
      </div>`).join('')}</div>
      ${rows.some(x=>x.score==null)?`<div class="territorial-pending"><strong>Sem histórico suficiente:</strong> ${rows.filter(x=>x.score==null).map(x=>safe(x.nome)).join(', ')}. Esses nomes não recebem nota territorial até haver eleição anterior cruzável.</div>`:''}
    </section>`;
  }

  function renderCards(rows){
    return `<div class="section-title territorial-subtitle"><div><h3>Candidaturas regionais</h3><p>Os cartões mantêm a probabilidade do Monte Carlo v2 separada do ITR. As duas métricas medem coisas diferentes.</p></div></div>
    <div class="toolbar territorial-toolbar"><input id="tr-q" placeholder="Buscar candidato, cidade ou partido…"><select id="tr-cargo"><option value="">Todos os cargos</option><option value="Federal">Deputado(a) Federal</option><option value="Estadual">Deputado(a) Estadual</option></select><select id="tr-order"><option value="itr">Ordenar por ITR</option><option value="prob">Ordenar por Monte Carlo</option><option value="regional">Mais votos nas duas regiões</option><option value="noroeste">Maior força no Noroeste</option><option value="alto">Maior força no Alto Paranaíba</option></select></div><div id="tr-cards" class="grid"></div>`;
  }

  function drawCards(rows){
    const target=document.querySelector('#tr-cards'); if(!target)return;
    const q=norm(document.querySelector('#tr-q')?.value||''), cargo=document.querySelector('#tr-cargo')?.value||'', order=document.querySelector('#tr-order')?.value||'itr';
    let a=rows.filter(x=>(!q||norm(`${x.nome} ${x.base} ${x.partido}`).includes(q))&&(!cargo||cargoKey(x)===cargo));
    const val=x=>x.score==null?-1:x.score;
    if(order==='prob')a.sort((x,y)=>y.prob-x.prob);
    else if(order==='regional')a.sort((x,y)=>y.regionalVotes-x.regionalVotes);
    else if(order==='noroeste')a.sort((x,y)=>Number(y.nr.percentual||0)-Number(x.nr.percentual||0));
    else if(order==='alto')a.sort((x,y)=>Number(y.ap.percentual||0)-Number(x.ap.percentual||0));
    else a.sort((x,y)=>val(y)-val(x));
    target.innerHTML=a.map(x=>`<article class="card candidate-card territorial-card"><div class="card-head"><div class="identity"><div class="avatar large">${safe(x.nome.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())}</div><div><div class="name">${safe(x.nome)}</div><div class="meta">${safe(x.cargo)} • ${safe(x.partido)}</div><span class="badge">${safe(x.base)}</span></div></div><div class="number">${safe(x.numero)}</div></div>
      <div class="territorial-card-kpis"><div><span>ITR</span><strong>${x.score==null?'N/D':x.score.toFixed(1)}</strong><small>${x.hist?`${x.hist.year} • ${safe(x.hist.quality)}`:'Sem histórico cruzável'}</small></div><div><span>Noroeste</span><strong>${x.hist?pct(Number(x.nr.percentual||0)):'—'}</strong><small>${x.hist?`${fmt(x.nr.votos)} votos`:'—'}</small></div><div><span>Alto Paranaíba</span><strong>${x.hist?pct(Number(x.ap.percentual||0)):'—'}</strong><small>${x.hist?`${fmt(x.ap.votos)} votos`:'—'}</small></div></div>
      <div class="metric-row"><div class="metric"><span>Votos nas duas regiões</span><strong>${x.hist?fmt(x.regionalVotes):'—'}</strong><small>${x.hist?`${fmt(x.hist.municipiosComVotos)} municípios com votos`:'Sem série histórica'}</small></div><div class="metric"><span>Patrimônio 2026</span><strong>${money(x.patrimonio)}</strong></div></div>
      <div class="prob"><div class="prob-head"><span>Monte Carlo v2</span><strong>${x.prob.toFixed(1)}%</strong></div><div class="bar"><i class="${probClass(x.prob)}" style="width:${x.prob}%"></i></div></div>
      ${x.hist?`<p class="status">Concentração Top 3: ${pct(Number(x.hist.concentracaoTop3||0))}. O ITR é descritivo da votação anterior e não altera automaticamente a probabilidade do modelo atual.</p>`:''}</article>`).join('')||'<div class="empty">Nenhum candidato encontrado.</div>';
  }

  async function render(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='regional'));
    view.innerHTML='<div class="card"><h2>Ranking territorial regional</h2><p class="muted">Carregando histórico eleitoral...</p></div>';
    try{
      const [o,h]=await Promise.all([fetch('official-data.json',{cache:'no-store'}).then(r=>r.json()),fetch('election-history.json',{cache:'no-store'}).then(r=>r.json())]);
      const rows=buildRows(o,h);
      view.innerHTML=renderRanking(rows)+renderCards(rows);
      ['tr-q','tr-cargo','tr-order'].forEach(id=>document.querySelector('#'+id)?.addEventListener('input',()=>drawCards(rows)));
      drawCards(rows);
    }catch(e){view.innerHTML=`<div class="note"><strong>Ranking territorial indisponível.</strong> ${safe(e.message)}</div>`;}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.addEventListener('click',e=>{
    const tab=e.target.closest('.tab[data-view="regional"]');
    const go=e.target.closest('[data-go="regional"]');
    if(!tab&&!go)return;
    e.preventDefault();e.stopImmediatePropagation();render();
  },true);
})();

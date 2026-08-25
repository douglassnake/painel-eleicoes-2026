const D=window.DASH_DATA; const view=document.querySelector('#view');
const fmtInt=n=>n==null?'—':new Intl.NumberFormat('pt-BR').format(n);
const fmtMoney=n=>n===0?'Não informado/sem valor positivo':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
const initials=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const probClass=p=>p>=70?'good':p>=35?'warn':'bad';
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function kpis(){
  const r=D.regional; const federais=r.filter(x=>x.cargo.includes('Federal')).length; const estaduais=r.filter(x=>x.cargo.includes('Estadual')).length;
  const favoritos=r.filter(x=>x.prob>=70).length;
  document.querySelector('#updatedAt').textContent=D.meta?.updatedAt||'25 ago 2026';
  document.querySelector('#kpis').innerHTML=`
    <div class="kpi"><div class="label">Candidatos regionais</div><div class="value">${r.length}</div><div class="hint">${safe(D.meta.region)}</div></div>
    <div class="kpi"><div class="label">Federais monitorados</div><div class="value">${federais}</div><div class="hint">53 vagas em MG</div></div>
    <div class="kpi"><div class="label">Estaduais monitorados</div><div class="value">${estaduais}</div><div class="hint">77 vagas em MG</div></div>
    <div class="kpi"><div class="label">≥ 70% no modelo</div><div class="value">${favoritos}</div><div class="hint">${fmtInt(D.meta.simulations)} simulações</div></div>`;
}

function candidateMini(x){return `<div class="mini-candidate"><div class="avatar">${initials(x.nome)}</div><div class="mini-main"><strong>${safe(x.nome)}</strong><span>${safe(x.partido)} • ${safe(x.cargo.replace('Deputada ','').replace('Deputado ',''))}</span></div><div class="mini-prob ${probClass(x.prob)}">${x.prob.toFixed(1)}%</div></div>`}

function overview(){
  const ranked=[...D.regional].sort((a,b)=>b.prob-a.prob);
  const top=ranked.slice(0,8);
  const gov=[...D.governador].filter(x=>x.poll!=null).sort((a,b)=>b.poll-a.poll).slice(0,3);
  const sen=[...D.senado].filter(x=>x.poll!=null).sort((a,b)=>b.poll-a.poll).slice(0,3);
  const pres=[...D.presidente].filter(x=>x.poll!=null).sort((a,b)=>b.poll-a.poll).slice(0,3);
  const maxP=Math.max(...top.map(x=>x.prob));
  view.innerHTML=`
    <div class="section-title"><div><h2>Visão geral</h2><p>Snapshot atual das disputas majoritárias e do modelo regional.</p></div><span class="model-pill">${safe(D.meta.model)} • ${fmtInt(D.meta.simulations)} cenários</span></div>
    <div class="overview-grid">
      <article class="card span-2"><div class="card-title-row"><div><h3>Ranking Monte Carlo — região</h3><p>Probabilidade estimada de conquistar mandato.</p></div><button class="text-btn" data-go="regional">Ver todos</button></div>
        <div class="rank-chart">${top.map((x,i)=>`<div class="rank-row"><div class="rank-label"><span>${i+1}</span><strong>${safe(x.nome)}</strong><small>${safe(x.partido)}</small></div><div class="rank-track"><i class="${probClass(x.prob)}" style="width:${(x.prob/maxP)*100}%"></i></div><b>${x.prob.toFixed(1)}%</b></div>`).join('')}</div>
      </article>
      <article class="card"><h3>Mais fortes no modelo</h3><p class="muted">Candidatos acima de 70% no snapshot atual.</p><div class="mini-list">${ranked.filter(x=>x.prob>=70).map(candidateMini).join('')}</div></article>
      <article class="card"><h3>Zona decisiva</h3><p class="muted">Entre 35% e 55%: pequenas mudanças alteram bastante o resultado.</p><div class="mini-list">${ranked.filter(x=>x.prob>=35&&x.prob<=55).map(candidateMini).join('')}</div></article>
    </div>
    <div class="section-subtitle"><h3>Disputas majoritárias</h3><p>Percentuais são do recorte de pesquisa incorporado ao painel.</p></div>
    <div class="major-grid">
      ${majorSnapshot('Governo de MG',gov,D.pollSources.governador,'governador')}
      ${majorSnapshot('Senado por MG',sen,D.pollSources.senado,'senado')}
      ${majorSnapshot('Presidência',pres,D.pollSources.presidente,'presidente')}
    </div>
    <div class="section-subtitle"><h3>Patrimônio × votação anterior</h3><p>Comparação exploratória dos candidatos regionais com votação disponível. Patrimônio declarado não implica desempenho eleitoral.</p></div>
    ${scatterRegional()}`;
  view.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
}

function majorSnapshot(title,arr,source,key){
  const max=Math.max(...arr.map(x=>x.poll||0),1);
  return `<article class="card major-card"><div class="card-title-row"><h3>${title}</h3><button class="text-btn" data-go="${key}">Detalhes</button></div><div class="snapshot-list">${arr.map((x,i)=>`<div class="snapshot-row"><span class="pos">${i+1}</span><div class="snapshot-name"><strong>${safe(x.nome)}</strong><small>${safe(x.partido)} • ${safe(x.numero)}</small></div><div class="snapshot-meter"><i style="width:${(x.poll/max)*100}%"></i></div><b>${x.poll}%</b></div>`).join('')}</div><p class="source-line">${safe(source)}</p></article>`;
}

function scatterRegional(){
  const pts=D.regional.filter(x=>x.ultimaVotacao!=null&&x.patrimonio>0);
  const maxVotes=Math.max(...pts.map(x=>x.ultimaVotacao),1); const maxPat=Math.max(...pts.map(x=>Math.log10(x.patrimonio+1)),1);
  return `<div class="card scatter-card"><div class="scatter-head"><span>Mais votos anteriores →</span><span>Patrimônio em escala logarítmica ↑</span></div><div class="scatter" aria-label="Gráfico de patrimônio versus votação anterior">${pts.map(x=>{const left=4+90*(x.ultimaVotacao/maxVotes); const bottom=5+83*(Math.log10(x.patrimonio+1)/maxPat); return `<button class="dot ${probClass(x.prob)}" style="left:${left}%;bottom:${bottom}%" title="${safe(x.nome)} — ${fmtInt(x.ultimaVotacao)} votos — ${fmtMoney(x.patrimonio)}"><span>${initials(x.nome)}</span></button>`}).join('')}</div><div class="scatter-legend"><span><i class="lg good"></i> ≥70%</span><span><i class="lg warn"></i> 35–69,9%</span><span><i class="lg bad"></i> &lt;35%</span></div></div>`;
}

function regional(){
 view.innerHTML=`<div class="section-title"><div><h2>Candidaturas regionais</h2><p>Probabilidade estimada pelo ${safe(D.meta.model)}; não é pesquisa eleitoral.</p></div><span class="model-pill">${fmtInt(D.meta.simulations)} simulações</span></div><div class="toolbar"><input id="q" placeholder="Buscar candidato, cidade ou partido…"><select id="cargo"><option value="">Todos os cargos</option><option>Deputado Federal</option><option>Deputado Estadual</option></select><select id="ord"><option value="prob">Ordenar por probabilidade</option><option value="votos">Ordenar por votação anterior</option><option value="patrimonio">Ordenar por patrimônio</option></select></div><div id="cards" class="grid"></div>`;
 const draw=()=>{let a=[...D.regional]; const q=document.querySelector('#q').value.toLowerCase(); const c=document.querySelector('#cargo').value; const o=document.querySelector('#ord').value; a=a.filter(x=>(!q||`${x.nome} ${x.base} ${x.partido}`.toLowerCase().includes(q))&&(!c||x.cargo===c)); a.sort((x,y)=>o==='votos'?(y.ultimaVotacao||0)-(x.ultimaVotacao||0):o==='patrimonio'?y.patrimonio-x.patrimonio:y.prob-x.prob); document.querySelector('#cards').innerHTML=a.map(x=>`<article class="card candidate-card"><div class="card-head"><div class="identity"><div class="avatar large">${initials(x.nome)}</div><div><div class="name">${safe(x.nome)}</div><div class="meta">${safe(x.cargo)} • ${safe(x.partido)}</div><span class="badge">${safe(x.base)}</span></div></div><div class="number">${safe(x.numero)}</div></div><div class="metric-row"><div class="metric"><span>Última votação</span><strong>${fmtInt(x.ultimaVotacao)}</strong><small>${safe(x.ultimaEleicao)}</small></div><div class="metric"><span>Patrimônio 2026</span><strong>${fmtMoney(x.patrimonio)}</strong></div></div><div class="prob"><div class="prob-head"><span>Probabilidade do modelo</span><strong>${x.prob.toFixed(1)}%</strong></div><div class="bar"><i class="${probClass(x.prob)}" style="width:${x.prob}%"></i></div></div>${x.nota?`<p class="status">${safe(x.nota)}</p>`:''}</article>`).join('')||'<div class="empty">Nenhum candidato encontrado.</div>'}; ['q','cargo','ord'].forEach(id=>document.querySelector('#'+id).addEventListener('input',draw)); draw();
}

function majoritario(key,title,description){ const arr=D[key]; const poll=arr.filter(x=>x.poll!=null).sort((a,b)=>b.poll-a.poll); const max=Math.max(...poll.map(x=>x.poll),1); view.innerHTML=`<div class="section-title"><div><h2>${title}</h2><p>${description}</p></div></div>${poll.length?`<div class="card poll-card"><div class="card-title-row"><div><h3>Último recorte de pesquisa utilizado</h3><p>${safe(D.pollSources[key])}</p></div></div><div class="poll">${poll.map((x,i)=>`<div class="poll-line"><span class="pos">${i+1}</span><div class="poll-name"><strong>${safe(x.nome)}</strong><small>${safe(x.partido)} • ${safe(x.numero)}</small></div><div class="poll-track"><div class="poll-fill" style="width:${(x.poll/max)*100}%"></div></div><div class="poll-value">${x.poll}%</div></div>`).join('')}</div></div>`:''}<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Candidato</th><th>Número</th><th>Partido</th><th>Pesquisa no painel</th><th>Observação</th></tr></thead><tbody>${arr.map(x=>`<tr><td><div class="table-person"><div class="avatar sm">${initials(x.nome)}</div><strong>${safe(x.nome)}</strong></div></td><td>${safe(x.numero)}</td><td>${safe(x.partido)}</td><td>${x.poll==null?'—':x.poll+'%'}</td><td class="status">${safe(x.status||'Pedido de registro sujeito ao julgamento eleitoral')}</td></tr>`).join('')}</tbody></table></div><div class="note">Ausência de percentual não significa 0%. O painel mostra número apenas quando o nome consta no recorte de pesquisa incorporado.</div>`; }

function metodo(){view.innerHTML=`<div class="section-title"><div><h2>Metodologia e transparência</h2><p>Como ler os números do painel.</p></div></div><div class="method"><div class="card"><h3>Monte Carlo dos deputados regionais</h3><ul><li><strong>${fmtInt(D.meta.simulations)} simulações</strong> no snapshot atual.</li><li>Probabilidades são cenários simulados, não pesquisas.</li><li>Entram como premissas: votação anterior, força territorial, incumbência, incerteza de expansão regional e efeito da legenda no sistema proporcional.</li><li>O sistema proporcional impede definir um corte individual fixo: votação total do partido/federação e sobras alteram a linha de eleição.</li><li>O modelo deve ser recalibrado quando surgirem novas pesquisas, composição definitiva das chapas ou dados oficiais relevantes.</li></ul></div><div class="card"><h3>Fontes principais</h3><ul><li><a href="${D.fontes.tse}" target="_blank" rel="noopener">Dados Abertos do TSE — Candidatos 2026</a></li><li><a href="${D.fontes.gov}" target="_blank" rel="noopener">Lista Governo de MG baseada no TSE</a></li><li><a href="${D.fontes.sen}" target="_blank" rel="noopener">Lista Senado por MG baseada no TSE</a></li><li><a href="${D.fontes.pres}" target="_blank" rel="noopener">Lista e números presidenciais baseada no TSE</a></li></ul></div></div><div class="note"><strong>Importante:</strong> patrimônio declarado não equivale necessariamente ao patrimônio líquido ou valor de mercado atual. Pesquisas têm metodologia, amostra e margem de erro próprias. A candidatura pode mudar de situação durante o julgamento pela Justiça Eleitoral.</div>`}

function show(v){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v)); if(v==='overview')overview(); else if(v==='regional')regional(); else if(v==='governador')majoritario('governador','Governo de Minas Gerais','Lista registrada para 2026 e último recorte estadual incorporado.'); else if(v==='senado')majoritario('senado','Senado Federal — Minas Gerais','Em 2026, cada eleitor mineiro votará em dois candidatos ao Senado.'); else if(v==='presidente')majoritario('presidente','Presidência da República','Pedidos de registro e último recorte nacional incorporado ao painel.'); else metodo(); window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view))); kpis(); show('overview');

(() => {
  const view=document.querySelector('#view');
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const missing=v=>['','#NE','#NULO','#N/A','N/A','NA','-1','-3','NULL','NONE'].includes(String(v??'').trim().toUpperCase());
  const clean=v=>missing(v)?'':String(v??'').trim();
  const money=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const fmtDate=iso=>{if(!iso)return'—';const d=new Date(iso);return Number.isNaN(d.getTime())?iso:new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)};
  const statusClass=s=>{const x=String(s||'').toUpperCase();if(x.includes('DEFERID')||x.includes('APTO'))return'tse-ok';if(x.includes('INDEFER')||x.includes('CANCEL')||x.includes('RENUNC'))return'tse-bad';return'tse-warn'};

  async function render(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='governadores-brasil'));
    view.innerHTML='<div class="card"><h2>Governadores do Brasil</h2><p class="muted">Carregando candidaturas oficiais do TSE...</p></div>';
    try{
      const r=await fetch('governadores-data.json',{cache:'no-store'});if(!r.ok)throw new Error('Base nacional ainda não gerada');
      const o=await r.json(); const source=(o.candidates||[]).map(x=>({...x,situacao:clean(x.situacao)||'Não informado',federacao:clean(x.federacao),detalhe:clean(x.detalhe)}));
      const ufs=[...new Set(source.map(x=>x.uf).filter(Boolean))].sort();
      const partidos=[...new Set(source.map(x=>x.partido).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      view.innerHTML=`<div class="section-title"><div><h2>Governadores do Brasil</h2><p>Candidaturas a governador em todas as UFs, conforme base oficial do TSE.</p></div><span class="model-pill">${Number(o.count||source.length).toLocaleString('pt-BR')} candidaturas</span></div>
      <div class="official-summary"><div class="kpi"><div class="label">UFs com registros</div><div class="value">${ufs.length}</div><div class="hint">Estados + Distrito Federal</div></div><div class="kpi"><div class="label">Última sincronização</div><div class="value small-value">${safe(fmtDate(o.checkedAt))}</div><div class="hint">Base TSE</div></div><div class="kpi"><div class="label">Fonte</div><div class="value small-value">TSE</div><div class="hint">Dados Abertos</div></div></div>
      <div class="toolbar"><input id="govq" placeholder="Buscar candidato ou partido…"><select id="govuf"><option value="">Todas as UFs</option>${ufs.map(x=>`<option>${safe(x)}</option>`).join('')}</select><select id="govpart"><option value="">Todos os partidos</option>${partidos.map(x=>`<option>${safe(x)}</option>`).join('')}</select><select id="govord"><option value="uf">Ordenar por UF</option><option value="nome">Ordenar por nome</option><option value="pat">Maior patrimônio</option></select></div><div id="govresult"></div>`;
      const draw=()=>{let a=[...source];const q=norm(document.querySelector('#govq').value),uf=document.querySelector('#govuf').value,p=document.querySelector('#govpart').value,ord=document.querySelector('#govord').value;
        a=a.filter(x=>(!q||norm(`${x.nomeUrna} ${x.nomeCompleto} ${x.partido} ${x.numero}`).includes(q))&&(!uf||x.uf===uf)&&(!p||x.partido===p));
        if(ord==='pat')a.sort((x,y)=>(y.patrimonio??-1)-(x.patrimonio??-1));else if(ord==='nome')a.sort((x,y)=>(x.nomeUrna||x.nomeCompleto||'').localeCompare(y.nomeUrna||y.nomeCompleto||'','pt-BR'));else a.sort((x,y)=>x.uf.localeCompare(y.uf)||(x.nomeUrna||x.nomeCompleto||'').localeCompare(y.nomeUrna||y.nomeCompleto||'','pt-BR'));
        document.querySelector('#govresult').innerHTML=`<div class="result-meta"><strong>${a.length.toLocaleString('pt-BR')}</strong> candidaturas encontradas</div><div class="grid gov-grid">${a.map(x=>`<article class="card candidate-card"><div class="card-head"><div class="identity"><div class="avatar large">${safe(x.uf)}</div><div><div class="name">${safe(x.nomeUrna||x.nomeCompleto)}</div><div class="meta">${safe(x.nomeCompleto)}</div><span class="badge">${safe(x.uf)} • ${safe(x.partido)}</span></div></div><div class="number">${safe(x.numero)}</div></div><div class="metric-row"><div class="metric"><span>Situação</span><strong><span class="tse-status ${statusClass(x.situacao)}">${safe(x.situacao)}</span></strong></div><div class="metric"><span>Patrimônio</span><strong>${money(x.patrimonio)}</strong><small>${x.qtdBens==null?'':' '+x.qtdBens+' bem(ns)'}</small></div></div>${x.federacao?`<p class="status">Federação/coligação: ${safe(x.federacao)}</p>`:''}</article>`).join('')||'<div class="empty">Nenhuma candidatura encontrada.</div>'}</div><div class="note"><strong>Fonte:</strong> Tribunal Superior Eleitoral — Dados Abertos. Marcadores técnicos de ausência como #NE e #NULO são apresentados como “Não informado” ou ocultados. Situação de registro, nomes, partidos e patrimônio podem ser retificados pelo TSE.</div>`;};
      ['govq','govuf','govpart','govord'].forEach(id=>document.querySelector('#'+id).addEventListener('input',draw));draw();
    }catch(err){view.innerHTML=`<div class="note"><strong>Base nacional ainda não sincronizada.</strong> Rode o atualizador local para gerar os candidatos a governador de todas as UFs. (${safe(err.message)})</div>`;}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.addEventListener('click',e=>{const b=e.target.closest('.tab[data-view="governadores-brasil"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();render()},true);
})();

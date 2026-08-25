(() => {
  const view = document.querySelector('#view');
  const safe = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);
  };
  const statusClass = s => {
    const x = String(s||'').toUpperCase();
    if (x.includes('DEFERID') || x.includes('APTO')) return 'tse-ok';
    if (x.includes('INDEFER') || x.includes('CANCEL') || x.includes('RENÚNCIA') || x.includes('RENUNCIA')) return 'tse-bad';
    return 'tse-warn';
  };
  const normalize = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  async function loadOfficial(){
    const r = await fetch('official-data.json', {cache:'no-store'});
    if (!r.ok) throw new Error('Arquivo official-data.json ainda não foi gerado.');
    return r.json();
  }

  function monitoredSet(o){
    const set = new Set();
    Object.values(o.candidates||{}).forEach(x=>x?.sqCandidato && set.add(String(x.sqCandidato)));
    return set;
  }

  function renderBrowser(o){
    const source = Array.isArray(o.database) ? o.database : [];
    const monitored = monitoredSet(o);
    const cargos = [...new Set(source.map(x=>x.cargo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const partidos = [...new Set(source.map(x=>x.partido).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    let page = 1;
    const perPage = 50;

    view.innerHTML = `
      <div class="section-title"><div><h2>Banco de candidatos</h2><p>Presidência nacional e todas as candidaturas de Minas Gerais aos cargos majoritários e proporcionais monitorados pelo painel.</p></div><span class="model-pill">${Number(o.totalCandidates||source.length).toLocaleString('pt-BR')} registros</span></div>
      <div class="official-summary">
        <div class="kpi"><div class="label">Candidaturas no banco</div><div class="value">${Number(o.totalCandidates||source.length).toLocaleString('pt-BR')}</div><div class="hint">TSE 2026</div></div>
        <div class="kpi"><div class="label">Última consulta</div><div class="value small-value">${safe(fmtDate(o.checkedAt))}</div><div class="hint">Horário de Brasília</div></div>
        <div class="kpi"><div class="label">Monitorados encontrados</div><div class="value">${safe(o.matched||0)}</div><div class="hint">de ${safe(o.monitored||0)} nomes analíticos</div></div>
      </div>
      <div class="card bank-stats"><h3>Distribuição por cargo</h3><div class="bank-counts">${Object.entries(o.countsByCargo||{}).map(([k,v])=>`<span><strong>${Number(v).toLocaleString('pt-BR')}</strong>${safe(k)}</span>`).join('')}</div></div>
      <div class="toolbar bank-toolbar">
        <input id="tse-q" placeholder="Buscar nome, número, partido ou ocupação…">
        <select id="tse-cargo"><option value="">Todos os cargos</option>${cargos.map(x=>`<option>${safe(x)}</option>`).join('')}</select>
        <select id="tse-partido"><option value="">Todos os partidos</option>${partidos.map(x=>`<option>${safe(x)}</option>`).join('')}</select>
        <select id="tse-status"><option value="">Todas as situações</option><option value="defer">Deferido/apto</option><option value="pend">Em análise/outros</option><option value="bad">Indeferido/cancelado/renúncia</option></select>
        <label class="bank-check"><input type="checkbox" id="tse-monitored"> Só monitorados</label>
      </div>
      <div class="bank-result-head"><span id="tse-result-count"></span><span id="tse-page-label"></span></div>
      <div class="table-wrap"><table><thead><tr><th>Candidato</th><th>Cargo</th><th>Nº</th><th>Partido</th><th>Situação</th><th>Ocupação</th><th>Idade</th></tr></thead><tbody id="tse-body"></tbody></table></div>
      <div class="bank-pagination"><button id="tse-prev" class="text-btn">← Anterior</button><button id="tse-next" class="text-btn">Próxima →</button></div>
      ${o.notFound?.length ? `<div class="note"><strong>Monitorados não localizados automaticamente:</strong> ${o.notFound.map(safe).join(', ')}. Diferenças de nome eleitoral podem exigir conferência manual.</div>` : ''}
      <div class="note"><strong>Fonte:</strong> Tribunal Superior Eleitoral, Dados Abertos — Candidatos 2026. Esta camada é oficial e independente do Monte Carlo e das pesquisas eleitorais.</div>`;

    const q = document.querySelector('#tse-q');
    const cargo = document.querySelector('#tse-cargo');
    const partido = document.querySelector('#tse-partido');
    const status = document.querySelector('#tse-status');
    const onlyMon = document.querySelector('#tse-monitored');

    const isMonitored = x => x.sqCandidato && monitored.has(String(x.sqCandidato));
    const statusGroup = s => {
      const x = String(s||'').toUpperCase();
      if (x.includes('DEFERID') || x.includes('APTO')) return 'defer';
      if (x.includes('INDEFER') || x.includes('CANCEL') || x.includes('RENÚNCIA') || x.includes('RENUNCIA')) return 'bad';
      return 'pend';
    };

    const draw = () => {
      const term = normalize(q.value.trim());
      let rows = source.filter(x => {
        const hay = normalize(`${x.nomeUrna} ${x.nomeCompleto} ${x.numero} ${x.partido} ${x.ocupacao} ${x.municipioNascimento}`);
        return (!term || hay.includes(term)) &&
          (!cargo.value || x.cargo===cargo.value) &&
          (!partido.value || x.partido===partido.value) &&
          (!status.value || statusGroup(x.situacao)===status.value) &&
          (!onlyMon.checked || isMonitored(x));
      });
      rows.sort((a,b)=>(a.cargo||'').localeCompare(b.cargo||'','pt-BR') || (a.nomeUrna||a.nomeCompleto||'').localeCompare(b.nomeUrna||b.nomeCompleto||'','pt-BR'));
      const totalPages = Math.max(1, Math.ceil(rows.length/perPage));
      page = Math.min(page,totalPages);
      const slice = rows.slice((page-1)*perPage,page*perPage);
      document.querySelector('#tse-result-count').textContent = `${rows.length.toLocaleString('pt-BR')} candidato${rows.length===1?'':'s'} encontrado${rows.length===1?'':'s'}`;
      document.querySelector('#tse-page-label').textContent = `Página ${page} de ${totalPages}`;
      document.querySelector('#tse-body').innerHTML = slice.map(x=>`<tr class="${isMonitored(x)?'monitored-row':''}"><td><strong>${safe(x.nomeUrna||x.nomeCompleto)}</strong><small class="bank-fullname">${safe(x.nomeCompleto)}</small>${isMonitored(x)?'<span class="monitor-tag">Monitorado</span>':''}</td><td>${safe(x.cargo)}</td><td><strong>${safe(x.numero)}</strong></td><td>${safe(x.partido)}</td><td><span class="tse-status ${statusClass(x.situacao)}">${safe(x.situacao||'Não informado')}</span>${x.detalhe?`<small class="bank-fullname">${safe(x.detalhe)}</small>`:''}</td><td>${safe(x.ocupacao||'—')}</td><td>${x.idadePosse??'—'}</td></tr>`).join('') || '<tr><td colspan="7">Nenhum candidato encontrado.</td></tr>';
      document.querySelector('#tse-prev').disabled = page<=1;
      document.querySelector('#tse-next').disabled = page>=totalPages;
    };

    [q,cargo,partido,status,onlyMon].forEach(el=>el.addEventListener('input',()=>{page=1;draw();}));
    document.querySelector('#tse-prev').addEventListener('click',()=>{if(page>1){page--;draw();window.scrollTo({top:view.offsetTop,behavior:'smooth'});}});
    document.querySelector('#tse-next').addEventListener('click',()=>{page++;draw();window.scrollTo({top:view.offsetTop,behavior:'smooth'});});
    draw();
  }

  async function render(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='oficial'));
    view.innerHTML = '<div class="card"><h2>Banco de candidatos</h2><p class="muted">Consultando a base oficial do TSE...</p></div>';
    try {
      const o = await loadOfficial();
      renderBrowser(o);
    } catch (err) {
      view.innerHTML = `<div class="section-title"><div><h2>Banco de candidatos</h2><p>Camada automática de conferência.</p></div></div><div class="note"><strong>Aguardando sincronização.</strong> ${safe(err.message)}</div>`;
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.tab[data-view="oficial"]');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    render();
  }, true);
})();

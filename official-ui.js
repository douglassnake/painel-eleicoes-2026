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

  async function loadOfficial(){
    const r = await fetch('official-data.json', {cache:'no-store'});
    if (!r.ok) throw new Error('Arquivo oficial-data.json ainda não foi gerado.');
    return r.json();
  }

  async function render(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='oficial'));
    view.innerHTML = '<div class="card"><h2>Dados oficiais TSE</h2><p class="muted">Consultando a base oficial...</p></div>';
    try {
      const o = await loadOfficial();
      const rows = Object.entries(o.candidates || {}).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
      view.innerHTML = `
        <div class="section-title"><div><h2>Dados oficiais TSE</h2><p>Camada automática separada do modelo Monte Carlo e das pesquisas.</p></div><span class="model-pill">${safe(o.matched)}/${safe(o.monitored)} localizados</span></div>
        <div class="official-summary">
          <div class="kpi"><div class="label">Última consulta</div><div class="value small-value">${safe(fmtDate(o.checkedAt))}</div><div class="hint">Horário de Brasília</div></div>
          <div class="kpi"><div class="label">Registros lidos</div><div class="value">${Number(o.rowsRead||0).toLocaleString('pt-BR')}</div><div class="hint">Arquivo nacional de candidatos</div></div>
          <div class="kpi"><div class="label">Monitorados encontrados</div><div class="value">${safe(o.matched)}</div><div class="hint">de ${safe(o.monitored)} nomes do painel</div></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Nome no painel</th><th>Nome de urna TSE</th><th>Cargo</th><th>Nº</th><th>Partido</th><th>UF</th><th>Situação oficial</th><th>Detalhe</th></tr></thead><tbody>
          ${rows.map(([display,x])=>`<tr><td><strong>${safe(display)}</strong></td><td>${safe(x.nomeUrna||x.nomeCompleto)}</td><td>${safe(x.cargo)}</td><td>${safe(x.numero)}</td><td>${safe(x.partido)}</td><td>${safe(x.uf)}</td><td><span class="tse-status ${statusClass(x.situacao)}">${safe(x.situacao||'Não informado')}</span></td><td class="status">${safe(x.detalhe||'—')}</td></tr>`).join('')}
        </tbody></table></div>
        ${o.notFound?.length ? `<div class="note"><strong>Nomes não localizados automaticamente:</strong> ${o.notFound.map(safe).join(', ')}. Isso pode ocorrer por diferença entre nome eleitoral e nome cadastrado; não significa ausência de candidatura.</div>` : ''}
        <div class="note"><strong>Fonte:</strong> Tribunal Superior Eleitoral, Dados Abertos — Candidatos 2026. A consulta automática ocorre três vezes ao dia. A situação oficial não altera automaticamente a probabilidade do Monte Carlo.</div>`;
    } catch (err) {
      view.innerHTML = `<div class="section-title"><div><h2>Dados oficiais TSE</h2><p>Camada automática de conferência.</p></div></div><div class="note"><strong>Aguardando primeira sincronização.</strong> ${safe(err.message)}</div>`;
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
